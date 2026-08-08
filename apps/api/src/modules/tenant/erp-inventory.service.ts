import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { NumberSequenceService } from '../../infrastructure/sequence/number-sequence.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { LifecycleContext } from './master-lifecycle.service';
import {
  applyBalanceDelta,
  assertWarehouseNotFrozen,
  consumeAvailable,
} from '../../infrastructure/provisioning/tenant-bootstrap.service';
import { DataScopeResolver } from '../../infrastructure/authorization/data-scope.resolver';

export interface StockTreeNode {
  type: 'REGION' | 'WAREHOUSE';
  id: string;
  code: string;
  name: string;
  onHand: string;
  available: string;
  reserved: string;
  inTransit: string;
  quarantine: string;
  damaged: string;
  totalChildren: number;
  children: StockTreeNode[];
}

/**
 * Semantik Internal Transfer:
 *   dispatch  → available sumber berkurang, in-transit bertambah,
 *               stok tujuan BELUM bertambah
 *   validasi  → in-transit berkurang, on-hand/available tujuan bertambah,
 *               selisih menjadi discrepancy
 */
@Injectable()
export class ErpInventoryService {
  private readonly logger = new Logger(ErpInventoryService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly sequences: NumberSequenceService,
    private readonly audit: AuditService,
    private readonly dataScope: DataScopeResolver,
  ) {}

  async createTransfer(
    ctx: LifecycleContext,
    input: {
      sourceWarehouseId: string;
      destinationWarehouseId: string;
      requestOrderId?: string;
      note?: string;
      lines: Array<{ productId: string; uomId?: string; requestedQty: number; note?: string }>;
    },
    idempotencyKey?: string,
  ) {
    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Gudang sumber dan tujuan tidak boleh sama.',
      );
    }
    if (!input.lines?.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Transfer harus memiliki baris.');
    }

    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;

        if (idempotencyKey) {
          const existing = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM ${S}.internal_transfer WHERE idempotency_key = $1`,
            [idempotencyKey],
          );
          if (existing.rows[0]) return this.loadTransfer(client, ctx.schemaName, existing.rows[0].id);
        }

        const transferNumber = await this.sequences.next(client, ctx.schemaName, 'INTERNAL_TRANSFER');
        const header = await client.query<{ id: string }>(
          `INSERT INTO ${S}.internal_transfer
             (transfer_number, source_warehouse_id, destination_warehouse_id, request_order_id,
              status, note, idempotency_key, created_by, updated_by)
           VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $7)
           RETURNING id::text AS id`,
          [
            transferNumber,
            input.sourceWarehouseId,
            input.destinationWarehouseId,
            input.requestOrderId ?? null,
            input.note ?? null,
            idempotencyKey ?? null,
            ctx.userId,
          ],
        );
        const transferId = header.rows[0].id;

        for (const [index, line] of input.lines.entries()) {
          if (!(line.requestedQty > 0)) {
            throw AppError.badRequest(
              ErrorCodes.VALIDATION_FAILED,
              `Kuantitas baris ${index + 1} harus lebih dari nol.`,
            );
          }
          await client.query(
            `INSERT INTO ${S}.internal_transfer_line
               (internal_transfer_id, product_id, uom_id, line_no, requested_qty, note)
             VALUES ($1, $2, COALESCE($3, (SELECT base_uom_id FROM ${S}.product WHERE id = $2)), $4, $5, $6)`,
            [transferId, line.productId, line.uomId ?? null, index + 1, line.requestedQty, line.note ?? null],
          );
        }

        await this.audit.record({
          moduleCode: 'INVENTORY',
          actionCode: 'TRANSFER_CREATED',
          entityType: 'internal_transfer',
          entityId: transferId,
          documentNumber: transferNumber,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
        });

        return this.loadTransfer(client, ctx.schemaName, transferId);
      },
      { ...ctx.audit, moduleCode: 'INVENTORY', actionCode: 'TRANSFER_CREATED' },
    );
  }

  async approveTransfer(ctx: LifecycleContext, id: string) {
    return this.simpleTransition(ctx, id, {
      from: ['DRAFT', 'WAITING_APPROVAL'],
      to: 'APPROVED',
      actionCode: 'TRANSFER_APPROVED',
      setApprover: true,
    });
  }

  /** Alokasi stok sumber: menetapkan allocated_qty tanpa memindahkan bucket. */
  async allocateTransfer(ctx: LifecycleContext, id: string) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const transfer = await client.query<{ status: string; transfer_number: string; source_warehouse_id: string }>(
          `SELECT status, transfer_number, source_warehouse_id::text AS source_warehouse_id
           FROM ${S}.internal_transfer WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!transfer.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transfer tidak ditemukan.');
        if (!['APPROVED', 'ALLOCATED'].includes(transfer.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Alokasi memerlukan status APPROVED, saat ini ${transfer.rows[0].status}.`,
          );
        }

        const lines = await client.query<{ id: string; product_id: string; requested_qty: string }>(
          `SELECT id::text AS id, product_id::text AS product_id, requested_qty::text AS requested_qty
           FROM ${S}.internal_transfer_line WHERE internal_transfer_id = $1`,
          [id],
        );

        for (const line of lines.rows) {
          const balance = await client.query<{ available: string }>(
            `SELECT COALESCE(sum(available_qty), 0)::text AS available
             FROM ${S}.stock_balance WHERE warehouse_id = $1 AND product_id = $2`,
            [transfer.rows[0].source_warehouse_id, line.product_id],
          );
          const available = new Decimal(balance.rows[0]?.available ?? '0');
          const requested = new Decimal(line.requested_qty);
          const allocated = Decimal.min(available, requested);

          if (allocated.lessThanOrEqualTo(0)) {
            throw AppError.unprocessable(
              ErrorCodes.INSUFFICIENT_STOCK,
              'Stok tersedia pada gudang sumber tidak mencukupi untuk dialokasikan.',
              { productId: line.product_id, available: available.toFixed(), requested: requested.toFixed() },
            );
          }

          await client.query(
            `UPDATE ${S}.internal_transfer_line SET allocated_qty = $2, updated_at = now(), version = version + 1
             WHERE id = $1`,
            [line.id, allocated.toFixed(6)],
          );
        }

        await client.query(
          `UPDATE ${S}.internal_transfer SET status = 'ALLOCATED', updated_at = now(), updated_by = $2, version = version + 1
           WHERE id = $1`,
          [id, ctx.userId],
        );

        await this.audit.record({
          moduleCode: 'INVENTORY',
          actionCode: 'TRANSFER_ALLOCATED',
          entityType: 'internal_transfer',
          entityId: id,
          documentNumber: transfer.rows[0].transfer_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          requestId: ctx.audit.requestId,
        });

        return this.loadTransfer(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'INVENTORY', actionCode: 'TRANSFER_ALLOCATED' },
    );
  }

  /** Dispatch: available sumber berkurang, in-transit bertambah. */
  async dispatchTransfer(ctx: LifecycleContext, id: string) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const transfer = await client.query<{
          status: string;
          transfer_number: string;
          source_warehouse_id: string;
          destination_warehouse_id: string;
          dispatch_posting_key: string | null;
        }>(
          `SELECT status, transfer_number, source_warehouse_id::text AS source_warehouse_id,
                  destination_warehouse_id::text AS destination_warehouse_id, dispatch_posting_key
           FROM ${S}.internal_transfer WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!transfer.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transfer tidak ditemukan.');
        if (transfer.rows[0].dispatch_posting_key) {
          throw AppError.conflict(ErrorCodes.INVALID_STATE_TRANSITION, 'Transfer sudah dikirim.');
        }
        if (!['ALLOCATED', 'PACKED', 'PICKING'].includes(transfer.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Pengiriman memerlukan status ALLOCATED, saat ini ${transfer.rows[0].status}.`,
          );
        }

        const lines = await client.query<{
          id: string;
          line_no: number;
          product_id: string;
          uom_id: string;
          lot_id: string | null;
          allocated_qty: string;
        }>(
          `SELECT id::text AS id, line_no, product_id::text AS product_id, uom_id::text AS uom_id,
                  lot_id::text AS lot_id, allocated_qty::text AS allocated_qty
           FROM ${S}.internal_transfer_line WHERE internal_transfer_id = $1 ORDER BY line_no`,
          [id],
        );

        await assertWarehouseNotFrozen(client, S, transfer.rows[0].source_warehouse_id);

        // Posting key harus muat pada VARCHAR(96): pakai nomor dokumen dan
        // nomor baris, bukan UUID.
        const postingKey = `ITD:${transfer.rows[0].transfer_number}`;

        for (const line of lines.rows) {
          const qty = new Decimal(line.allocated_qty);
          if (qty.lessThanOrEqualTo(0)) continue;

          const balance = await client.query<{ available: string }>(
            `SELECT COALESCE(sum(available_qty), 0)::text AS available
             FROM ${S}.stock_balance WHERE warehouse_id = $1 AND product_id = $2`,
            [transfer.rows[0].source_warehouse_id, line.product_id],
          );
          if (qty.greaterThan(new Decimal(balance.rows[0]?.available ?? '0'))) {
            throw AppError.unprocessable(
              ErrorCodes.INSUFFICIENT_STOCK,
              'Kuantitas transfer melebihi stok tersedia pada gudang sumber.',
              { productId: line.product_id },
            );
          }

          // Sumber: kurangi dari baris saldo yang benar-benar memiliki stok
          // (FEFO). Satu baris transfer dapat menghabiskan beberapa lot.
          let allocations: Array<{ lotId: string | null; binId: string | null; quantity: number }>;
          if (line.lot_id) {
            await applyBalanceDelta(client, S, {
              warehouseId: transfer.rows[0].source_warehouse_id,
              productId: line.product_id,
              lotId: line.lot_id,
              onHandDelta: -qty.toNumber(),
              availableDelta: -qty.toNumber(),
            });
            allocations = [{ lotId: line.lot_id, binId: null, quantity: qty.toNumber() }];
          } else {
            try {
              allocations = await consumeAvailable(client, S, {
                warehouseId: transfer.rows[0].source_warehouse_id,
                productId: line.product_id,
                quantity: qty.toNumber(),
              });
            } catch (error) {
              // Penyebab teknis alokasi FEFO disertakan agar dukungan dapat
              // membedakan stok kurang dari kegagalan lain.
              throw AppError.unprocessable(
                ErrorCodes.INSUFFICIENT_STOCK,
                'Stok tersedia pada gudang sumber tidak mencukupi saat pengiriman.',
                {
                  productId: line.product_id,
                  allocationError: error instanceof Error ? error.message : String(error),
                },
              );
            }
          }

          for (const [allocationIndex, allocation] of allocations.entries()) {
            const movementNumber = await this.sequences.next(client, ctx.schemaName, 'STOCK_MOVEMENT');
            await client.query(
              `INSERT INTO ${S}.stock_movement
                 (movement_number, movement_type, product_id, uom_id, lot_id, quantity,
                  source_warehouse_id, destination_warehouse_id, bucket_from, bucket_to,
                  reference_type, reference_id, reference_number, posting_key, created_by)
               VALUES ($1, 'TRANSFER_DISPATCH', $2, $3, $4, $5, $6, $7, 'AVAILABLE', 'IN_TRANSIT',
                       'internal_transfer', $8, $9, $10, $11)`,
              [
                movementNumber,
                line.product_id,
                line.uom_id,
                allocation.lotId,
                allocation.quantity,
                transfer.rows[0].source_warehouse_id,
                transfer.rows[0].destination_warehouse_id,
                id,
                transfer.rows[0].transfer_number,
                `${postingKey}:${line.line_no}:${allocationIndex}`,
                ctx.userId,
              ],
            );

            // Tujuan: in-transit bertambah, on-hand BELUM bertambah.
            await applyBalanceDelta(client, S, {
              warehouseId: transfer.rows[0].destination_warehouse_id,
              productId: line.product_id,
              lotId: allocation.lotId,
              inTransitDelta: allocation.quantity,
            });
          }

          await client.query(
            `UPDATE ${S}.internal_transfer_line
             SET dispatched_qty = $2, lot_id = COALESCE(lot_id, $3),
                 updated_at = now(), version = version + 1
             WHERE id = $1`,
            [line.id, qty.toFixed(6), allocations.length === 1 ? allocations[0].lotId : null],
          );
        }

        await client.query(
          `UPDATE ${S}.internal_transfer
           SET status = 'IN_TRANSIT', dispatch_date = now(), dispatch_posting_key = $2,
               updated_at = now(), updated_by = $3, version = version + 1
           WHERE id = $1`,
          [id, postingKey, ctx.userId],
        );

        await this.audit.record({
          moduleCode: 'INVENTORY',
          actionCode: 'TRANSFER_DISPATCHED',
          entityType: 'internal_transfer',
          entityId: id,
          documentNumber: transfer.rows[0].transfer_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          requestId: ctx.audit.requestId,
          metadata: { postingKey },
        });

        return this.loadTransfer(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'INVENTORY', actionCode: 'TRANSFER_DISPATCHED' },
    );
  }

  async arriveTransfer(ctx: LifecycleContext, id: string) {
    return this.simpleTransition(ctx, id, {
      from: ['IN_TRANSIT', 'DISPATCHED'],
      to: 'ARRIVED_WAITING_VALIDATION',
      actionCode: 'TRANSFER_ARRIVED',
      setArrival: true,
    });
  }

  /** Validasi tujuan: in-transit berkurang, on-hand tujuan bertambah. */
  async validateTransferReceipt(
    ctx: LifecycleContext,
    id: string,
    input: { lines: Array<{ lineId: string; receivedQty: number; rejectedQty?: number; note?: string }> },
  ) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const transfer = await client.query<{
          status: string;
          transfer_number: string;
          source_warehouse_id: string;
          destination_warehouse_id: string;
          receipt_posting_key: string | null;
        }>(
          `SELECT status, transfer_number, source_warehouse_id::text AS source_warehouse_id,
                  destination_warehouse_id::text AS destination_warehouse_id, receipt_posting_key
           FROM ${S}.internal_transfer WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!transfer.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transfer tidak ditemukan.');
        if (transfer.rows[0].receipt_posting_key) {
          throw AppError.conflict(ErrorCodes.INVALID_STATE_TRANSITION, 'Penerimaan transfer sudah divalidasi.');
        }
        if (!['IN_TRANSIT', 'ARRIVED_WAITING_VALIDATION', 'PARTIALLY_RECEIVED'].includes(transfer.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Validasi penerimaan memerlukan transfer dalam perjalanan, saat ini ${transfer.rows[0].status}.`,
          );
        }

        await assertWarehouseNotFrozen(client, S, transfer.rows[0].destination_warehouse_id);

        const receiptNumber = await this.sequences.next(client, ctx.schemaName, 'TRANSFER_RECEIPT');
        const receipt = await client.query<{ id: string }>(
          `INSERT INTO ${S}.internal_transfer_receipt
             (internal_transfer_id, receipt_number, arrived_at, validated_at, validated_by, status)
           VALUES ($1, $2, now(), now(), $3, 'VALIDATED')
           RETURNING id::text AS id`,
          [id, receiptNumber, ctx.userId],
        );

        // Posting key harus muat pada VARCHAR(96).
        const postingKey = `ITR:${transfer.rows[0].transfer_number}`;
        let hasDiscrepancy = false;
        let fullyReceived = true;

        for (const input_line of input.lines) {
          const line = await client.query<{
            id: string;
            line_no: number;
            product_id: string;
            uom_id: string;
            lot_id: string | null;
            dispatched_qty: string;
          }>(
            `SELECT id::text AS id, line_no, product_id::text AS product_id, uom_id::text AS uom_id,
                    lot_id::text AS lot_id, dispatched_qty::text AS dispatched_qty
             FROM ${S}.internal_transfer_line WHERE id = $1 AND internal_transfer_id = $2 FOR UPDATE`,
            [input_line.lineId, id],
          );
          if (!line.rows[0]) {
            throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Baris transfer tidak ditemukan.');
          }

          const dispatched = new Decimal(line.rows[0].dispatched_qty);
          const received = new Decimal(input_line.receivedQty);
          const rejected = new Decimal(input_line.rejectedQty ?? 0);
          const accepted = received.minus(rejected);

          if (received.greaterThan(dispatched)) {
            hasDiscrepancy = true;
            await client.query(
              `INSERT INTO ${S}.internal_transfer_discrepancy
                 (internal_transfer_line_id, discrepancy_type, quantity, note)
               VALUES ($1, 'OVER_RECEIVED', $2, $3)`,
              [line.rows[0].id, received.minus(dispatched).toFixed(6), input_line.note ?? null],
            );
          } else if (received.lessThan(dispatched)) {
            hasDiscrepancy = true;
            fullyReceived = false;
            await client.query(
              `INSERT INTO ${S}.internal_transfer_discrepancy
                 (internal_transfer_line_id, discrepancy_type, quantity, note)
               VALUES ($1, 'SHORT_RECEIVED', $2, $3)`,
              [line.rows[0].id, dispatched.minus(received).toFixed(6), input_line.note ?? null],
            );
          }
          if (rejected.greaterThan(0)) hasDiscrepancy = true;

          // Lot yang benar-benar dikirim diambil dari movement dispatch,
          // sehingga pengurangan in-transit selalu cocok per lot.
          const dispatchedLots = await client.query<{ lot_id: string | null; quantity: string }>(
            `SELECT lot_id::text AS lot_id, sum(quantity)::text AS quantity
             FROM ${S}.stock_movement
             WHERE reference_type = 'internal_transfer' AND reference_id = $1
               AND movement_type = 'TRANSFER_DISPATCH'
               AND product_id = $2
             GROUP BY lot_id`,
            [id, line.rows[0].product_id],
          );

          let remainingAccepted = accepted;
          let remainingRejected = rejected;

          for (const [lotIndex, lotRow] of dispatchedLots.rows.entries()) {
            const lotDispatched = new Decimal(lotRow.quantity);
            const lotAccepted = Decimal.min(remainingAccepted, lotDispatched);
            const lotRejected = Decimal.min(
              remainingRejected,
              lotDispatched.minus(lotAccepted),
            );

            if (lotAccepted.greaterThan(0)) {
              const movementNumber = await this.sequences.next(client, ctx.schemaName, 'STOCK_MOVEMENT');
              await client.query(
                `INSERT INTO ${S}.stock_movement
                   (movement_number, movement_type, product_id, uom_id, lot_id, quantity,
                    source_warehouse_id, destination_warehouse_id, bucket_from, bucket_to,
                    reference_type, reference_id, reference_number, posting_key, created_by)
                 VALUES ($1, 'TRANSFER_RECEIPT', $2, $3, $4, $5, $6, $7, 'IN_TRANSIT', 'ON_HAND',
                         'internal_transfer', $8, $9, $10, $11)`,
                [
                  movementNumber,
                  line.rows[0].product_id,
                  line.rows[0].uom_id,
                  lotRow.lot_id,
                  lotAccepted.toFixed(6),
                  transfer.rows[0].source_warehouse_id,
                  transfer.rows[0].destination_warehouse_id,
                  id,
                  transfer.rows[0].transfer_number,
                  `${postingKey}:${line.rows[0].line_no}:${lotIndex}`,
                  ctx.userId,
                ],
              );
            }

            await applyBalanceDelta(client, S, {
              warehouseId: transfer.rows[0].destination_warehouse_id,
              productId: line.rows[0].product_id,
              lotId: lotRow.lot_id,
              inTransitDelta: -lotDispatched.toNumber(),
              onHandDelta: lotAccepted.toNumber(),
              availableDelta: lotAccepted.toNumber(),
              quarantineDelta: lotRejected.toNumber(),
            });

            remainingAccepted = remainingAccepted.minus(lotAccepted);
            remainingRejected = remainingRejected.minus(lotRejected);
          }

          await client.query(
            `UPDATE ${S}.internal_transfer_line
             SET received_qty = $2, rejected_qty = $3, updated_at = now(), version = version + 1
             WHERE id = $1`,
            [line.rows[0].id, received.toFixed(6), rejected.toFixed(6)],
          );

          await client.query(
            `INSERT INTO ${S}.internal_transfer_receipt_line
               (transfer_receipt_id, internal_transfer_line_id, received_qty, accepted_qty, rejected_qty, discrepancy_type, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              receipt.rows[0].id,
              line.rows[0].id,
              received.toFixed(6),
              accepted.toFixed(6),
              rejected.toFixed(6),
              received.lessThan(dispatched) ? 'SHORT_RECEIVED' : received.greaterThan(dispatched) ? 'OVER_RECEIVED' : null,
              input_line.note ?? null,
            ],
          );
        }

        const finalStatus = hasDiscrepancy
          ? fullyReceived
            ? 'DISCREPANCY'
            : 'PARTIALLY_RECEIVED'
          : 'RECEIVED';

        await client.query(
          `UPDATE ${S}.internal_transfer
           SET status = $2, received_date = now(), receipt_posting_key = $3,
               updated_at = now(), updated_by = $4, version = version + 1
           WHERE id = $1`,
          [id, finalStatus, postingKey, ctx.userId],
        );

        await this.audit.record({
          moduleCode: 'INVENTORY',
          actionCode: 'TRANSFER_RECEIPT_VALIDATED',
          entityType: 'internal_transfer',
          entityId: id,
          documentNumber: transfer.rows[0].transfer_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          requestId: ctx.audit.requestId,
          metadata: { receiptNumber, finalStatus, hasDiscrepancy },
        });

        return this.loadTransfer(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'INVENTORY', actionCode: 'TRANSFER_RECEIPT_VALIDATED' },
    );
  }

  /**
   * Monitoring stok berbentuk tree: wilayah → gudang.
   * Parameter whitelist: regionId, productId, uomId, includeZero, includeInTransit, asOf.
   */
  async stockTree(
    ctx: LifecycleContext,
    filters: {
      regionId?: string;
      productId?: string;
      uomId?: string;
      includeZero?: boolean;
      includeInTransit?: boolean;
    },
  ): Promise<{ nodes: StockTreeNode[]; totals: Omit<StockTreeNode, 'children' | 'type' | 'id' | 'code' | 'name' | 'totalChildren'> }> {
    const S = `"${ctx.schemaName}"`;
    const params: unknown[] = [];
    const conditions: string[] = ['w.deleted_at IS NULL'];

    if (filters.regionId) {
      params.push(filters.regionId);
      conditions.push(`w.region_id = $${params.length}`);
    }
    if (filters.productId) {
      params.push(filters.productId);
      conditions.push(`b.product_id = $${params.length}`);
    }
    if (filters.uomId) {
      params.push(filters.uomId);
      conditions.push(`p.base_uom_id = $${params.length}`);
    }

    const rows = await this.tenantDb.query<{
      region_id: string | null;
      region_code: string | null;
      region_name: string | null;
      warehouse_id: string;
      warehouse_code: string;
      warehouse_name: string;
      on_hand: string;
      available: string;
      reserved: string;
      in_transit: string;
      quarantine: string;
      damaged: string;
    }>(
      ctx.schemaName,
      `SELECT r.id::text AS region_id, r.code AS region_code, r.name AS region_name,
              w.id::text AS warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
              COALESCE(sum(b.on_hand_qty), 0)::text AS on_hand,
              COALESCE(sum(b.available_qty), 0)::text AS available,
              COALESCE(sum(b.reserved_qty), 0)::text AS reserved,
              COALESCE(sum(b.in_transit_qty), 0)::text AS in_transit,
              COALESCE(sum(b.quarantine_qty), 0)::text AS quarantine,
              COALESCE(sum(b.damaged_qty), 0)::text AS damaged
       FROM ${S}.warehouse w
       LEFT JOIN ${S}.stock_balance b ON b.warehouse_id = w.id
       LEFT JOIN ${S}.product p ON p.id = b.product_id
       LEFT JOIN ${S}.region r ON r.id = w.region_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY r.id, r.code, r.name, w.id, w.code, w.name
       ORDER BY r.code NULLS LAST, w.level, w.code`,
      params,
    );

    const regions = new Map<string, StockTreeNode>();
    const totals = {
      onHand: new Decimal(0),
      available: new Decimal(0),
      reserved: new Decimal(0),
      inTransit: new Decimal(0),
      quarantine: new Decimal(0),
      damaged: new Decimal(0),
    };

    for (const row of rows) {
      const onHand = new Decimal(row.on_hand);
      const available = new Decimal(row.available);
      const inTransit = new Decimal(row.in_transit);

      if (
        !filters.includeZero &&
        onHand.isZero() &&
        available.isZero() &&
        (!filters.includeInTransit || inTransit.isZero()) &&
        inTransit.isZero()
      ) {
        continue;
      }

      const regionKey = row.region_id ?? 'NO_REGION';
      if (!regions.has(regionKey)) {
        regions.set(regionKey, {
          type: 'REGION',
          id: row.region_id ?? 'no-region',
          code: row.region_code ?? 'TANPA-WILAYAH',
          name: row.region_name ?? 'Tanpa Wilayah',
          onHand: '0',
          available: '0',
          reserved: '0',
          inTransit: '0',
          quarantine: '0',
          damaged: '0',
          totalChildren: 0,
          children: [],
        });
      }

      const region = regions.get(regionKey)!;
      region.children.push({
        type: 'WAREHOUSE',
        id: row.warehouse_id,
        code: row.warehouse_code,
        name: row.warehouse_name,
        onHand: onHand.toFixed(),
        available: available.toFixed(),
        reserved: new Decimal(row.reserved).toFixed(),
        inTransit: inTransit.toFixed(),
        quarantine: new Decimal(row.quarantine).toFixed(),
        damaged: new Decimal(row.damaged).toFixed(),
        totalChildren: 0,
        children: [],
      });

      region.onHand = new Decimal(region.onHand).plus(onHand).toFixed();
      region.available = new Decimal(region.available).plus(available).toFixed();
      region.reserved = new Decimal(region.reserved).plus(new Decimal(row.reserved)).toFixed();
      region.inTransit = new Decimal(region.inTransit).plus(inTransit).toFixed();
      region.quarantine = new Decimal(region.quarantine).plus(new Decimal(row.quarantine)).toFixed();
      region.damaged = new Decimal(region.damaged).plus(new Decimal(row.damaged)).toFixed();
      region.totalChildren = region.children.length;

      totals.onHand = totals.onHand.plus(onHand);
      totals.available = totals.available.plus(available);
      totals.reserved = totals.reserved.plus(new Decimal(row.reserved));
      totals.inTransit = totals.inTransit.plus(inTransit);
      totals.quarantine = totals.quarantine.plus(new Decimal(row.quarantine));
      totals.damaged = totals.damaged.plus(new Decimal(row.damaged));
    }

    return {
      nodes: [...regions.values()],
      totals: {
        onHand: totals.onHand.toFixed(),
        available: totals.available.toFixed(),
        reserved: totals.reserved.toFixed(),
        inTransit: totals.inTransit.toFixed(),
        quarantine: totals.quarantine.toFixed(),
        damaged: totals.damaged.toFixed(),
      },
    };
  }

  async listMovements(
    ctx: LifecycleContext,
    filters: { productId?: string; warehouseId?: string; limit?: number },
  ) {
    const S = `"${ctx.schemaName}"`;
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (filters.productId) {
      params.push(filters.productId);
      conditions.push(`m.product_id = $${params.length}`);
    }
    if (filters.warehouseId) {
      params.push(filters.warehouseId);
      conditions.push(
        `(m.source_warehouse_id = $${params.length} OR m.destination_warehouse_id = $${params.length})`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 100, 500);

    return this.tenantDb.query<Record<string, unknown>>(
      ctx.schemaName,
      `SELECT m.id::text, m.movement_number, m.movement_type, m.quantity::text AS quantity,
              m.occurred_at, m.reference_type, m.reference_number, m.bucket_from, m.bucket_to,
              p.code AS product_code, p.name AS product_name,
              sw.code AS source_warehouse_code, dw.code AS destination_warehouse_code
       FROM ${S}.stock_movement m
       JOIN ${S}.product p ON p.id = m.product_id
       LEFT JOIN ${S}.warehouse sw ON sw.id = m.source_warehouse_id
       LEFT JOIN ${S}.warehouse dw ON dw.id = m.destination_warehouse_id
       ${where}
       ORDER BY m.occurred_at DESC
       LIMIT ${limit}`,
      params,
    );
  }

  async listBalances(ctx: LifecycleContext, filters: { warehouseId?: string; productId?: string }) {
    const S = `"${ctx.schemaName}"`;
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (filters.warehouseId) {
      params.push(filters.warehouseId);
      conditions.push(`b.warehouse_id = $${params.length}`);
    }
    if (filters.productId) {
      params.push(filters.productId);
      conditions.push(`b.product_id = $${params.length}`);
    }

    // Batas data ditegakkan di sini, bukan pada controller. Pemegang batas
    // WAREHOUSE tanpa gudang yang ditugaskan memperoleh predikat FALSE sehingga
    // ia melihat nol baris, bukan seluruh gudang tenant.
    // `LifecycleContext.userId` adalah id pengguna platform, sedangkan tabel
    // role/scope tenant memakai `user_subject.id`. Tanpa resolusi ini seluruh
    // pengguna sah tampak tidak punya role dan endpoint saldo mengembalikan
    // nol baris, walaupun mutasi serta stock-tree sudah berisi data.
    const subject = await this.tenantDb.query<{ id: string }>(
      ctx.schemaName,
      `SELECT id::text AS id
         FROM ${S}.user_subject
        WHERE id = $1::uuid OR platform_user_id = $1::uuid
        LIMIT 1`,
      [ctx.userId],
    );
    if (!subject[0]) return [];

    const scope = await this.dataScope.buildPredicate(
      ctx.schemaName,
      subject[0].id,
      { WAREHOUSE: 'b.warehouse_id', LEGAL_ENTITY: 'w.legal_entity_id', OUTLET: 'w.outlet_id' },
      { startIndex: params.length + 1 },
    );
    conditions.push(scope.sql);
    params.push(...scope.params);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.tenantDb.query<Record<string, unknown>>(
      ctx.schemaName,
      `SELECT b.id::text, w.code AS warehouse_code, w.name AS warehouse_name,
              p.code AS product_code, p.name AS product_name, u.code AS uom_code,
              b.on_hand_qty::text AS on_hand_qty, b.available_qty::text AS available_qty,
              b.reserved_qty::text AS reserved_qty, b.in_transit_qty::text AS in_transit_qty,
              b.quarantine_qty::text AS quarantine_qty, b.last_movement_at
       FROM ${S}.stock_balance b
       JOIN ${S}.warehouse w ON w.id = b.warehouse_id
       JOIN ${S}.product p ON p.id = b.product_id
       JOIN ${S}.uom u ON u.id = p.base_uom_id
       ${where}
       ORDER BY w.code, p.code`,
      params,
    );
  }

  async listStockAlerts(ctx: LifecycleContext, status = 'OPEN') {
    return this.tenantDb.query<Record<string, unknown>>(
      ctx.schemaName,
      `SELECT a.id::text, a.alert_type, a.status, a.projected_qty::text AS projected_qty,
              a.threshold_qty::text AS threshold_qty, a.recommended_qty::text AS recommended_qty,
              a.detected_at, a.request_order_id::text AS request_order_id,
              w.code AS warehouse_code, w.name AS warehouse_name,
              p.code AS product_code, p.name AS product_name,
              ro.request_number
       FROM "${ctx.schemaName}".stock_alert a
       JOIN "${ctx.schemaName}".warehouse w ON w.id = a.warehouse_id
       JOIN "${ctx.schemaName}".product p ON p.id = a.product_id
       LEFT JOIN "${ctx.schemaName}".request_order ro ON ro.id = a.request_order_id
       WHERE a.status = $1
       ORDER BY a.detected_at DESC
       LIMIT 300`,
      [status],
    );
  }

  // -------------------------------------------------------------------------

  private async simpleTransition(
    ctx: LifecycleContext,
    id: string,
    options: {
      from: string[];
      to: string;
      actionCode: string;
      setApprover?: boolean;
      setArrival?: boolean;
    },
  ) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const current = await client.query<{ status: string; transfer_number: string }>(
          `SELECT status, transfer_number FROM ${S}.internal_transfer WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!current.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transfer tidak ditemukan.');
        if (!options.from.includes(current.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Aksi tidak diizinkan pada status ${current.rows[0].status}.`,
            { allowedFrom: options.from },
          );
        }

        await client.query(
          `UPDATE ${S}.internal_transfer
           SET status = $2
               ${options.setApprover ? ', approved_at = now(), approved_by = $3' : ''}
               ${options.setArrival ? ', arrival_date = now()' : ''},
               updated_at = now(), version = version + 1
           WHERE id = $1`,
          options.setApprover ? [id, options.to, ctx.userId] : [id, options.to],
        );

        await this.audit.record({
          moduleCode: 'INVENTORY',
          actionCode: options.actionCode,
          entityType: 'internal_transfer',
          entityId: id,
          documentNumber: current.rows[0].transfer_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          requestId: ctx.audit.requestId,
        });

        return this.loadTransfer(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'INVENTORY', actionCode: options.actionCode },
    );
  }

  private async loadTransfer(client: PoolClient, schemaName: string, id: string) {
    const S = `"${schemaName}"`;
    const header = await client.query(
      `SELECT it.*, sw.code AS source_warehouse_code, sw.name AS source_warehouse_name,
              dw.code AS destination_warehouse_code, dw.name AS destination_warehouse_name,
              ro.request_number
       FROM ${S}.internal_transfer it
       JOIN ${S}.warehouse sw ON sw.id = it.source_warehouse_id
       JOIN ${S}.warehouse dw ON dw.id = it.destination_warehouse_id
       LEFT JOIN ${S}.request_order ro ON ro.id = it.request_order_id
       WHERE it.id = $1`,
      [id],
    );
    const lines = await client.query(
      `SELECT itl.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM ${S}.internal_transfer_line itl
       JOIN ${S}.product p ON p.id = itl.product_id
       JOIN ${S}.uom u ON u.id = itl.uom_id
       WHERE itl.internal_transfer_id = $1 ORDER BY itl.line_no`,
      [id],
    );
    return { ...header.rows[0], lines: lines.rows };
  }
}
