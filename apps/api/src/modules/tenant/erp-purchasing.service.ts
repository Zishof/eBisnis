import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { NumberSequenceService } from '../../infrastructure/sequence/number-sequence.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { statusPoDariPenerimaan } from './purchase-order-status';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { LifecycleContext } from './master-lifecycle.service';
import { applyBalanceDelta, assertWarehouseNotFrozen } from '../../infrastructure/provisioning/tenant-bootstrap.service';

export interface RequestOrderLineInput {
  productId: string;
  uomId?: string;
  requestedQty: number;
  note?: string;
}

/**
 * Alur pembelian: Request Order → konsolidasi → Purchase Order →
 * Penerimaan (validasi) → Backorder.
 *
 * Aturan yang ditegakkan:
 *  - penerimaan TIDAK menambah stok sebelum divalidasi;
 *  - `acceptedQty + rejectedQty <= receivedQty` (juga dijaga CHECK constraint);
 *  - received qty tidak melampaui sisa PO tanpa override;
 *  - backorder berasal dari shortage yang belum punya backorder aktif;
 *  - backorder TIDAK menambah stok;
 *  - reversal membuat movement lawan, bukan menghapus movement lama.
 */
@Injectable()
export class ErpPurchasingService {
  private readonly logger = new Logger(ErpPurchasingService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly sequences: NumberSequenceService,
    private readonly audit: AuditService,
  ) {}

  // --- REQUEST ORDER -------------------------------------------------------

  async createRequestOrder(
    ctx: LifecycleContext,
    input: {
      requestingWarehouseId: string;
      parentWarehouseId?: string;
      priority?: string;
      neededAt?: string;
      note?: string;
      lines: RequestOrderLineInput[];
    },
    idempotencyKey?: string,
  ) {
    if (!input.lines?.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Request Order harus memiliki baris.');
    }

    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;

        if (idempotencyKey) {
          const existing = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM ${S}.request_order WHERE idempotency_key = $1`,
            [idempotencyKey],
          );
          if (existing.rows[0]) return this.loadRequestOrder(client, ctx.schemaName, existing.rows[0].id);
        }

        const warehouse = await client.query<{ id: string; parent_warehouse_id: string | null; outlet_id: string | null }>(
          `SELECT id::text AS id, parent_warehouse_id::text AS parent_warehouse_id, outlet_id::text AS outlet_id
           FROM ${S}.warehouse WHERE id = $1 AND deleted_at IS NULL`,
          [input.requestingWarehouseId],
        );
        if (!warehouse.rows[0]) {
          throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Gudang peminta tidak ditemukan.');
        }

        const parentWarehouseId =
          input.parentWarehouseId ?? warehouse.rows[0].parent_warehouse_id ?? null;

        const requestNumber = await this.sequences.next(client, ctx.schemaName, 'REQUEST_ORDER');

        const header = await client.query<{ id: string }>(
          `INSERT INTO ${S}.request_order
             (request_number, requesting_warehouse_id, parent_warehouse_id, outlet_id,
              request_type, priority, needed_at, status, note, idempotency_key, created_by, updated_by)
           VALUES ($1, $2, $3, $4, 'MANUAL', $5, $6, 'DRAFT', $7, $8, $9, $9)
           RETURNING id::text AS id`,
          [
            requestNumber,
            input.requestingWarehouseId,
            parentWarehouseId,
            warehouse.rows[0].outlet_id,
            input.priority ?? 'NORMAL',
            input.neededAt ?? null,
            input.note ?? null,
            idempotencyKey ?? null,
            ctx.userId,
          ],
        );
        const requestOrderId = header.rows[0].id;

        for (const [index, line] of input.lines.entries()) {
          const product = await client.query<{ base_uom_id: string }>(
            `SELECT base_uom_id::text AS base_uom_id FROM ${S}.product
             WHERE id = $1 AND deleted_at IS NULL`,
            [line.productId],
          );
          if (!product.rows[0]) {
            throw AppError.badRequest(
              ErrorCodes.VALIDATION_FAILED,
              `Produk pada baris ${index + 1} tidak ditemukan.`,
            );
          }
          if (!(line.requestedQty > 0)) {
            throw AppError.badRequest(
              ErrorCodes.VALIDATION_FAILED,
              `Kuantitas baris ${index + 1} harus lebih dari nol.`,
            );
          }

          const snapshot = await client.query<{ available: string }>(
            `SELECT COALESCE(sum(available_qty), 0)::text AS available
             FROM ${S}.stock_balance WHERE warehouse_id = $1 AND product_id = $2`,
            [input.requestingWarehouseId, line.productId],
          );

          await client.query(
            `INSERT INTO ${S}.request_order_line
               (request_order_id, product_id, uom_id, requested_qty, remaining_qty, line_no, note, stock_snapshot)
             VALUES ($1, $2, $3, $4, $4, $5, $6, $7)`,
            [
              requestOrderId,
              line.productId,
              line.uomId ?? product.rows[0].base_uom_id,
              line.requestedQty,
              index + 1,
              line.note ?? null,
              JSON.stringify({ availableAtRequest: snapshot.rows[0]?.available ?? '0' }),
            ],
          );
        }

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'REQUEST_ORDER_CREATED',
          entityType: 'request_order',
          entityId: requestOrderId,
          documentNumber: requestNumber,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
        });

        return this.loadRequestOrder(client, ctx.schemaName, requestOrderId);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'REQUEST_ORDER_CREATED' },
    );
  }

  /**
   * Membuat draft Request Order otomatis dari kebijakan minimum stok.
   * Dedupe: satu alert OPEN per (gudang, produk) dijaga unique index, dan
   * alert yang sudah menghasilkan Request Order tidak membuat kebutuhan ganda.
   */
  async generateMinStockRequestOrders(ctx: LifecycleContext) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;

        const candidates = await client.query<{
          policy_id: string;
          warehouse_id: string;
          product_id: string;
          uom_id: string | null;
          minimum_stock: string;
          reorder_point: string;
          recommended_order_qty: string;
          projected: string;
        }>(
          `SELECT sp.id::text AS policy_id,
                  sp.warehouse_id::text AS warehouse_id,
                  sp.product_id::text AS product_id,
                  sp.uom_id::text AS uom_id,
                  sp.minimum_stock::text AS minimum_stock,
                  sp.reorder_point::text AS reorder_point,
                  sp.recommended_order_qty::text AS recommended_order_qty,
                  COALESCE(
                    (SELECT sum(b.available_qty + b.in_transit_qty)
                     FROM ${S}.stock_balance b
                     WHERE b.warehouse_id = sp.warehouse_id AND b.product_id = sp.product_id), 0
                  )::text AS projected
           FROM ${S}.stock_policy sp
           WHERE sp.deleted_at IS NULL
             AND sp.is_active = TRUE
             AND sp.auto_request_enabled = TRUE`,
        );

        const created: Array<{ requestOrderId: string; requestNumber: string; warehouseId: string; lines: number }> = [];
        const alertsCreated: string[] = [];
        const byWarehouse = new Map<string, typeof candidates.rows>();

        for (const row of candidates.rows) {
          const projected = new Decimal(row.projected);
          const threshold = Decimal.max(new Decimal(row.reorder_point), new Decimal(row.minimum_stock));
          if (projected.greaterThan(threshold)) continue;

          // Alert deduplikasi: hanya satu OPEN per (warehouse, product, type).
          const existingAlert = await client.query<{ id: string; request_order_id: string | null }>(
            `SELECT id::text AS id, request_order_id::text AS request_order_id
             FROM ${S}.stock_alert
             WHERE warehouse_id = $1 AND product_id = $2 AND alert_type = 'MIN_STOCK' AND status = 'OPEN'`,
            [row.warehouse_id, row.product_id],
          );

          if (existingAlert.rows[0]?.request_order_id) {
            // Kebutuhan sudah dibuatkan Request Order — tidak digandakan.
            continue;
          }

          if (!existingAlert.rows[0]) {
            const inserted = await client.query<{ id: string }>(
              `INSERT INTO ${S}.stock_alert
                 (stock_policy_id, warehouse_id, product_id, alert_type, projected_qty, threshold_qty, recommended_qty, status)
               VALUES ($1, $2, $3, 'MIN_STOCK', $4, $5, $6, 'OPEN')
               RETURNING id::text AS id`,
              [
                row.policy_id,
                row.warehouse_id,
                row.product_id,
                projected.toFixed(6),
                threshold.toFixed(6),
                row.recommended_order_qty,
              ],
            );
            alertsCreated.push(inserted.rows[0].id);
          }

          const list = byWarehouse.get(row.warehouse_id) ?? [];
          list.push(row);
          byWarehouse.set(row.warehouse_id, list);
        }

        for (const [warehouseId, rows] of byWarehouse.entries()) {
          const warehouse = await client.query<{ parent_warehouse_id: string | null; outlet_id: string | null }>(
            `SELECT parent_warehouse_id::text AS parent_warehouse_id, outlet_id::text AS outlet_id
             FROM ${S}.warehouse WHERE id = $1`,
            [warehouseId],
          );

          const requestNumber = await this.sequences.next(client, ctx.schemaName, 'REQUEST_ORDER');
          const header = await client.query<{ id: string }>(
            `INSERT INTO ${S}.request_order
               (request_number, requesting_warehouse_id, parent_warehouse_id, outlet_id,
                request_type, priority, status, note, generated_by_policy_id, created_by, updated_by)
             VALUES ($1, $2, $3, $4, 'MIN_STOCK_AUTO', 'HIGH', 'AUTO_GENERATED',
                     'Dibuat otomatis karena stok mencapai titik minimum.', $5, $6, $6)
             RETURNING id::text AS id`,
            [
              requestNumber,
              warehouseId,
              warehouse.rows[0]?.parent_warehouse_id ?? null,
              warehouse.rows[0]?.outlet_id ?? null,
              rows[0].policy_id,
              ctx.userId,
            ],
          );
          const requestOrderId = header.rows[0].id;

          for (const [index, row] of rows.entries()) {
            const qty = new Decimal(row.recommended_order_qty).greaterThan(0)
              ? new Decimal(row.recommended_order_qty)
              : Decimal.max(new Decimal(row.minimum_stock).minus(new Decimal(row.projected)), new Decimal(1));

            await client.query(
              `INSERT INTO ${S}.request_order_line
                 (request_order_id, product_id, uom_id, requested_qty, remaining_qty, line_no,
                  source_stock_policy_id, stock_snapshot)
               VALUES ($1, $2, COALESCE($3, (SELECT base_uom_id FROM ${S}.product WHERE id = $2)),
                       $4, $4, $5, $6, $7)`,
              [
                requestOrderId,
                row.product_id,
                row.uom_id,
                qty.toFixed(6),
                index + 1,
                row.policy_id,
                JSON.stringify({
                  projected: row.projected,
                  minimumStock: row.minimum_stock,
                  reorderPoint: row.reorder_point,
                }),
              ],
            );

            await client.query(
              `UPDATE ${S}.stock_alert SET request_order_id = $1
               WHERE warehouse_id = $2 AND product_id = $3 AND alert_type = 'MIN_STOCK' AND status = 'OPEN'`,
              [requestOrderId, row.warehouse_id, row.product_id],
            );
          }

          // Notifikasi kepada staf lokasi.
          await client.query(
            `INSERT INTO ${S}.notification
               (template_id, channel, title, body, entity_type, entity_id, severity, status, sent_at)
             SELECT nt.id, 'IN_APP',
                    'Request Order otomatis ' || $1,
                    'Request Order ' || $1 || ' dibuat otomatis karena stok mencapai titik minimum.',
                    'request_order', $2::uuid, 'WARNING', 'SENT', now()
             FROM ${S}.notification_template nt
             WHERE nt.code = 'REQUEST_ORDER_CREATED' AND nt.deleted_at IS NULL`,
            [requestNumber, requestOrderId],
          );

          created.push({
            requestOrderId,
            requestNumber,
            warehouseId,
            lines: rows.length,
          });
        }

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'MIN_STOCK_REQUEST_ORDERS_GENERATED',
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
          metadata: { requestOrders: created.length, alertsCreated: alertsCreated.length },
        });

        return { generated: created, alertsCreated: alertsCreated.length };
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'MIN_STOCK_AUTO' },
    );
  }

  async transitionRequestOrder(
    ctx: LifecycleContext,
    id: string,
    action: 'submit' | 'approve' | 'reject',
    payload: { reason?: string; approvedQty?: Record<string, number> } = {},
  ) {
    const transitions: Record<string, { from: string[]; to: string; actionCode: string }> = {
      submit: {
        from: ['DRAFT', 'AUTO_GENERATED'],
        to: 'SUBMITTED',
        actionCode: 'REQUEST_ORDER_SUBMITTED',
      },
      approve: {
        from: ['SUBMITTED', 'WAITING_APPROVAL'],
        to: 'APPROVED',
        actionCode: 'REQUEST_ORDER_APPROVED',
      },
      reject: {
        from: ['SUBMITTED', 'WAITING_APPROVAL'],
        to: 'REJECTED',
        actionCode: 'REQUEST_ORDER_REJECTED',
      },
    };
    const transition = transitions[action];

    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const current = await client.query<{ status: string; request_number: string }>(
          `SELECT status, request_number FROM ${S}.request_order WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!current.rows[0]) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Request Order tidak ditemukan.');
        }
        if (!transition.from.includes(current.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Aksi "${action}" tidak diizinkan pada status ${current.rows[0].status}.`,
            { allowedFrom: transition.from },
          );
        }

        const timestampColumn =
          action === 'submit' ? 'submitted_at' : action === 'approve' ? 'approved_at' : 'rejected_at';
        const actorColumn = action === 'reject' ? null : action === 'submit' ? 'submitted_by' : 'approved_by';

        await client.query(
          `UPDATE ${S}.request_order
           SET status = $2, ${timestampColumn} = now()
               ${actorColumn ? `, ${actorColumn} = $3` : ''}
               ${action === 'reject' ? ', reject_reason = $3' : ''},
               updated_at = now(), updated_by = $4, version = version + 1
           WHERE id = $1`,
          action === 'reject'
            ? [id, transition.to, payload.reason ?? 'Ditolak', ctx.userId]
            : [id, transition.to, ctx.userId, ctx.userId],
        );

        if (action === 'approve') {
          // approvedQty default = requestedQty bila tidak diberikan.
          await client.query(
            `UPDATE ${S}.request_order_line
             SET approved_qty = requested_qty, remaining_qty = requested_qty - fulfilled_qty,
                 updated_at = now(), version = version + 1
             WHERE request_order_id = $1`,
            [id],
          );
          for (const [lineId, qty] of Object.entries(payload.approvedQty ?? {})) {
            await client.query(
              `UPDATE ${S}.request_order_line
               SET approved_qty = $2, remaining_qty = $2 - fulfilled_qty,
                   updated_at = now(), version = version + 1
               WHERE id = $1 AND request_order_id = $3`,
              [lineId, qty, id],
            );
          }
        }

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: transition.actionCode,
          entityType: 'request_order',
          entityId: id,
          documentNumber: current.rows[0].request_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          reason: payload.reason,
          requestId: ctx.audit.requestId,
        });

        return this.loadRequestOrder(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: transition.actionCode },
    );
  }

  // --- PURCHASE ORDER ------------------------------------------------------

  /** Pemasok yang dapat memasok satu produk — dipakai saat memilih item PO. */
  async suppliersForProduct(ctx: LifecycleContext, productId: string) {
    return this.tenantDb.query<Record<string, unknown>>(
      ctx.schemaName,
      `SELECT ps.id::text AS product_supplier_id,
              s.id::text AS supplier_id, s.code, s.name,
              ps.supplier_sku, ps.lead_time_days, ps.minimum_order_qty::text AS minimum_order_qty,
              ps.last_price::text AS last_price, ps.currency_code, ps.is_preferred, ps.priority,
              s.rating::text AS rating, s.is_blacklisted
       FROM "${ctx.schemaName}".product_supplier ps
       JOIN "${ctx.schemaName}".supplier s ON s.id = ps.supplier_id
       WHERE ps.product_id = $1
         AND ps.deleted_at IS NULL AND ps.is_active = TRUE
         AND s.deleted_at IS NULL AND s.is_active = TRUE
       ORDER BY ps.is_preferred DESC, ps.priority ASC, s.name ASC`,
      [productId],
    );
  }

  async createPurchaseOrder(
    ctx: LifecycleContext,
    input: {
      supplierId: string;
      warehouseId: string;
      expectedDate?: string;
      note?: string;
      taxPercent?: number;
      sourceBackorderId?: string;
      lines: Array<{
        productId: string;
        uomId?: string;
        orderedQty: number;
        unitPrice: number;
        discountPercent?: number;
        batchNumber?: string;
        expiryDate?: string;
        requestOrderLineId?: string;
      }>;
    },
    idempotencyKey?: string,
  ) {
    if (!input.lines?.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Purchase Order harus memiliki baris.');
    }

    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;

        if (idempotencyKey) {
          const existing = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM ${S}.purchase_order WHERE idempotency_key = $1`,
            [idempotencyKey],
          );
          if (existing.rows[0]) return this.loadPurchaseOrder(client, ctx.schemaName, existing.rows[0].id);
        }

        const supplier = await client.query<{ id: string; is_blacklisted: boolean }>(
          `SELECT id::text AS id, is_blacklisted FROM ${S}.supplier
           WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
          [input.supplierId],
        );
        if (!supplier.rows[0]) {
          throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Pemasok tidak ditemukan atau nonaktif.');
        }
        if (supplier.rows[0].is_blacklisted) {
          throw AppError.unprocessable(
            ErrorCodes.VALIDATION_FAILED,
            'Pemasok berstatus blacklist dan tidak dapat dipakai.',
          );
        }

        const purchaseOrderNumber = await this.sequences.next(client, ctx.schemaName, 'PURCHASE_ORDER');
        const legalEntity = await client.query<{ id: string }>(
          `SELECT id::text AS id FROM ${S}.legal_entity WHERE deleted_at IS NULL ORDER BY sort_order LIMIT 1`,
        );

        let subtotal = new Decimal(0);
        let discountTotal = new Decimal(0);
        const header = await client.query<{ id: string }>(
          `INSERT INTO ${S}.purchase_order
             (purchase_order_number, supplier_id, legal_entity_id, warehouse_id, order_date,
              expected_date, status, note, source_backorder_id, idempotency_key, created_by, updated_by)
           VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, 'DRAFT', $6, $7, $8, $9, $9)
           RETURNING id::text AS id`,
          [
            purchaseOrderNumber,
            input.supplierId,
            legalEntity.rows[0]?.id ?? null,
            input.warehouseId,
            input.expectedDate ?? null,
            input.note ?? null,
            input.sourceBackorderId ?? null,
            idempotencyKey ?? null,
            ctx.userId,
          ],
        );
        const purchaseOrderId = header.rows[0].id;

        for (const [index, line] of input.lines.entries()) {
          if (!(line.orderedQty > 0)) {
            throw AppError.badRequest(
              ErrorCodes.VALIDATION_FAILED,
              `Kuantitas baris ${index + 1} harus lebih dari nol.`,
            );
          }

          // Pemasok harus punya mapping produk aktif.
          const mapping = await client.query(
            `SELECT 1 FROM ${S}.product_supplier
             WHERE product_id = $1 AND supplier_id = $2 AND deleted_at IS NULL AND is_active = TRUE`,
            [line.productId, input.supplierId],
          );
          if (!mapping.rowCount) {
            throw AppError.unprocessable(
              ErrorCodes.SUPPLIER_CANNOT_SUPPLY_PRODUCT,
              `Pemasok terpilih belum terdaftar sebagai pemasok untuk produk pada baris ${index + 1}.`,
              { productId: line.productId, supplierId: input.supplierId },
            );
          }

          const gross = new Decimal(line.orderedQty).mul(new Decimal(line.unitPrice));
          const discountAmount = gross.mul(new Decimal(line.discountPercent ?? 0)).div(100);
          const lineTotal = gross.minus(discountAmount);
          subtotal = subtotal.plus(gross);
          discountTotal = discountTotal.plus(discountAmount);

          const insertedLine = await client.query<{ id: string }>(
            `INSERT INTO ${S}.purchase_order_line
               (purchase_order_id, product_id, uom_id, line_no, ordered_qty, unit_price,
                discount_amount, line_total, planned_batch_number, planned_expiry_date)
             VALUES ($1, $2, COALESCE($3, (SELECT base_uom_id FROM ${S}.product WHERE id = $2)),
                     $4, $5, $6, $7, $8, $9, $10::date)
             RETURNING id::text AS id`,
            [
              purchaseOrderId,
              line.productId,
              line.uomId ?? null,
              index + 1,
              line.orderedQty,
              line.unitPrice,
              discountAmount.toFixed(4),
              lineTotal.toFixed(4),
              line.batchNumber?.trim() || null,
              line.expiryDate ?? null,
            ],
          );

          if (line.requestOrderLineId) {
            await client.query(
              `INSERT INTO ${S}.purchase_order_request_allocation
                 (purchase_order_line_id, request_order_line_id, allocated_qty)
               VALUES ($1, $2, $3)
               ON CONFLICT (purchase_order_line_id, request_order_line_id) DO NOTHING`,
              [insertedLine.rows[0].id, line.requestOrderLineId, line.orderedQty],
            );
            await client.query(
              `UPDATE ${S}.request_order SET status = 'CONVERTED_TO_PURCHASE', updated_at = now()
               WHERE id = (SELECT request_order_id FROM ${S}.request_order_line WHERE id = $1)
                 AND status IN ('APPROVED', 'CONSOLIDATED')`,
              [line.requestOrderLineId],
            );
          }
        }

        const taxable = subtotal.minus(discountTotal);
        const taxTotal = taxable.mul(new Decimal(input.taxPercent ?? 0)).div(100);
        const grandTotal = taxable.plus(taxTotal);
        await client.query(
          `UPDATE ${S}.purchase_order
              SET subtotal = $2, discount_total = $3, tax_total = $4, grand_total = $5
            WHERE id = $1`,
          [purchaseOrderId, subtotal.toFixed(4), discountTotal.toFixed(4),
            taxTotal.toFixed(4), grandTotal.toFixed(4)],
        );

        if (input.sourceBackorderId) {
          await client.query(
            `INSERT INTO ${S}.backorder_purchase_order_link (backorder_id, purchase_order_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [input.sourceBackorderId, purchaseOrderId],
          );
        }

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'PURCHASE_ORDER_CREATED',
          entityType: 'purchase_order',
          entityId: purchaseOrderId,
          documentNumber: purchaseOrderNumber,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
          metadata: { supplierId: input.supplierId, lines: input.lines.length },
        });

        return this.loadPurchaseOrder(client, ctx.schemaName, purchaseOrderId);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'PURCHASE_ORDER_CREATED' },
    );
  }

  async transitionPurchaseOrder(
    ctx: LifecycleContext,
    id: string,
    action: 'submit' | 'approve' | 'send',
  ) {
    const transitions: Record<string, { from: string[]; to: string; column?: string; actionCode: string }> = {
      submit: { from: ['DRAFT'], to: 'WAITING_APPROVAL', column: 'submitted_at', actionCode: 'PURCHASE_ORDER_SUBMITTED' },
      approve: { from: ['WAITING_APPROVAL'], to: 'APPROVED', column: 'approved_at', actionCode: 'PURCHASE_ORDER_APPROVED' },
      send: { from: ['APPROVED'], to: 'SENT', column: 'sent_at', actionCode: 'PURCHASE_ORDER_SENT' },
    };
    const transition = transitions[action];

    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const current = await client.query<{ status: string; purchase_order_number: string }>(
          `SELECT status, purchase_order_number FROM ${S}.purchase_order WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!current.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Purchase Order tidak ditemukan.');
        if (!transition.from.includes(current.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Aksi "${action}" tidak diizinkan pada status ${current.rows[0].status}.`,
            { allowedFrom: transition.from },
          );
        }

        await client.query(
          `UPDATE ${S}.purchase_order
           SET status = $2, ${transition.column} = now(),
               ${action === 'approve' ? 'approved_by = $3,' : ''}
               updated_at = now(), updated_by = $3, version = version + 1
           WHERE id = $1`,
          [id, transition.to, ctx.userId],
        );

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: transition.actionCode,
          entityType: 'purchase_order',
          entityId: id,
          documentNumber: current.rows[0].purchase_order_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
        });

        return this.loadPurchaseOrder(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: transition.actionCode },
    );
  }

  // --- GOODS RECEIPT -------------------------------------------------------

  /** Membuat penerimaan. TIDAK menambah stok. */
  async createGoodsReceipt(
    ctx: LifecycleContext,
    input: {
      purchaseOrderId: string;
      warehouseId?: string;
      supplierDoNumber?: string;
      note?: string;
      lines: Array<{
        purchaseOrderLineId: string;
        receivedQty: number;
        batchNumber?: string;
        expiryDate?: string;
        note?: string;
      }>;
    },
    idempotencyKey?: string,
    allowOverReceipt = false,
  ) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;

        if (idempotencyKey) {
          const existing = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM ${S}.goods_receipt WHERE idempotency_key = $1`,
            [idempotencyKey],
          );
          if (existing.rows[0]) return this.loadGoodsReceipt(client, ctx.schemaName, existing.rows[0].id);
        }

        const po = await client.query<{
          id: string;
          supplier_id: string;
          warehouse_id: string;
          status: string;
          purchase_order_number: string;
        }>(
          `SELECT id::text AS id, supplier_id::text AS supplier_id, warehouse_id::text AS warehouse_id,
                  status, purchase_order_number
           FROM ${S}.purchase_order WHERE id = $1 FOR UPDATE`,
          [input.purchaseOrderId],
        );
        if (!po.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Purchase Order tidak ditemukan.');
        if (!['SENT', 'APPROVED', 'SUPPLIER_CONFIRMED', 'PARTIALLY_RECEIVED', 'BACKORDERED'].includes(po.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Penerimaan tidak dapat dibuat pada PO berstatus ${po.rows[0].status}.`,
          );
        }

        const receiptNumber = await this.sequences.next(client, ctx.schemaName, 'GOODS_RECEIPT');
        const header = await client.query<{ id: string }>(
          `INSERT INTO ${S}.goods_receipt
             (receipt_number, purchase_order_id, supplier_id, warehouse_id, arrival_date, receipt_date,
              supplier_do_number, status, validation_status, note, idempotency_key, created_by, updated_by)
           VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE, $5, 'DRAFT', 'PENDING', $6, $7, $8, $8)
           RETURNING id::text AS id`,
          [
            receiptNumber,
            input.purchaseOrderId,
            po.rows[0].supplier_id,
            input.warehouseId ?? po.rows[0].warehouse_id,
            input.supplierDoNumber ?? null,
            input.note ?? null,
            idempotencyKey ?? null,
            ctx.userId,
          ],
        );
        const receiptId = header.rows[0].id;

        for (const [index, line] of input.lines.entries()) {
          const poLine = await client.query<{
            id: string;
            product_id: string;
            uom_id: string;
            ordered_qty: string;
            received_qty: string;
            cancelled_qty: string;
            unit_price: string;
          }>(
            `SELECT id::text AS id, product_id::text AS product_id, uom_id::text AS uom_id,
                    ordered_qty::text AS ordered_qty, received_qty::text AS received_qty,
                    cancelled_qty::text AS cancelled_qty, unit_price::text AS unit_price
             FROM ${S}.purchase_order_line
             WHERE id = $1 AND purchase_order_id = $2 FOR UPDATE`,
            [line.purchaseOrderLineId, input.purchaseOrderId],
          );
          if (!poLine.rows[0]) {
            throw AppError.badRequest(
              ErrorCodes.VALIDATION_FAILED,
              `Baris PO pada penerimaan baris ${index + 1} tidak ditemukan.`,
            );
          }

          const ordered = new Decimal(poLine.rows[0].ordered_qty);
          const alreadyReceived = new Decimal(poLine.rows[0].received_qty);
          const cancelled = new Decimal(poLine.rows[0].cancelled_qty);
          const remaining = ordered.minus(alreadyReceived).minus(cancelled);
          const receiving = new Decimal(line.receivedQty);

          if (receiving.lessThanOrEqualTo(0)) {
            throw AppError.badRequest(
              ErrorCodes.VALIDATION_FAILED,
              `Kuantitas diterima pada baris ${index + 1} harus lebih dari nol.`,
            );
          }
          if (receiving.greaterThan(remaining) && !allowOverReceipt) {
            throw AppError.unprocessable(
              ErrorCodes.RECEIVED_QTY_EXCEEDS_ORDER,
              `Kuantitas diterima (${receiving.toFixed()}) melampaui sisa PO (${remaining.toFixed()}) pada baris ${index + 1}.`,
              { orderedQty: ordered.toFixed(), remainingQty: remaining.toFixed() },
            );
          }

          let lotId: string | null = null;
          if (line.batchNumber) {
            const lot = await client.query<{ id: string }>(
              `INSERT INTO ${S}.inventory_lot
                 (product_id, supplier_id, code, name, lot_number, expiry_date, quality_status)
               VALUES ($1, $2, $3, $3, $4, $5, 'GOOD')
               ON CONFLICT (product_id, lot_number) WHERE deleted_at IS NULL DO UPDATE SET updated_at = now()
               RETURNING id::text AS id`,
              [
                poLine.rows[0].product_id,
                po.rows[0].supplier_id,
                `LOT-${line.batchNumber}`,
                line.batchNumber,
                line.expiryDate ?? null,
              ],
            );
            lotId = lot.rows[0]?.id ?? null;
          }

          await client.query(
            `INSERT INTO ${S}.goods_receipt_line
               (goods_receipt_id, purchase_order_line_id, product_id, uom_id, lot_id, line_no,
                ordered_qty, previously_received_qty, received_qty, unit_cost,
                batch_number, expiry_date, quality_status, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', $13)`,
            [
              receiptId,
              line.purchaseOrderLineId,
              poLine.rows[0].product_id,
              poLine.rows[0].uom_id,
              lotId,
              index + 1,
              ordered.toFixed(6),
              alreadyReceived.toFixed(6),
              receiving.toFixed(6),
              poLine.rows[0].unit_price,
              line.batchNumber ?? null,
              line.expiryDate ?? null,
              line.note ?? null,
            ],
          );
        }

        await client.query(
          `UPDATE ${S}.goods_receipt SET status = 'ARRIVED' WHERE id = $1`,
          [receiptId],
        );

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'GOODS_RECEIPT_CREATED',
          entityType: 'goods_receipt',
          entityId: receiptId,
          documentNumber: receiptNumber,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
          metadata: { purchaseOrderNumber: po.rows[0].purchase_order_number, note: 'Stok belum bertambah.' },
        });

        return this.loadGoodsReceipt(client, ctx.schemaName, receiptId);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'GOODS_RECEIPT_CREATED' },
    );
  }

  /** Pemeriksaan fisik: menetapkan accepted/rejected. TIDAK menambah stok. */
  async inspectGoodsReceipt(
    ctx: LifecycleContext,
    id: string,
    input: {
      result?: string;
      notes?: string;
      lines: Array<{ lineId: string; acceptedQty: number; rejectedQty?: number; qualityStatus?: string }>;
    },
  ) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const receipt = await client.query<{ status: string; receipt_number: string }>(
          `SELECT status, receipt_number FROM ${S}.goods_receipt WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!receipt.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penerimaan tidak ditemukan.');
        if (!['DRAFT', 'ARRIVED', 'INSPECTED', 'CORRECTION_REQUIRED'].includes(receipt.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Pemeriksaan tidak diizinkan pada status ${receipt.rows[0].status}.`,
          );
        }

        for (const line of input.lines) {
          const current = await client.query<{ received_qty: string }>(
            `SELECT received_qty::text AS received_qty FROM ${S}.goods_receipt_line
             WHERE id = $1 AND goods_receipt_id = $2 FOR UPDATE`,
            [line.lineId, id],
          );
          if (!current.rows[0]) {
            throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Baris penerimaan tidak ditemukan.');
          }
          const received = new Decimal(current.rows[0].received_qty);
          const accepted = new Decimal(line.acceptedQty);
          const rejected = new Decimal(line.rejectedQty ?? 0);

          // Aturan wajib: acceptedQty + rejectedQty <= receivedQty.
          if (accepted.plus(rejected).greaterThan(received)) {
            throw AppError.unprocessable(
              ErrorCodes.VALIDATION_FAILED,
              `Jumlah diterima + ditolak (${accepted.plus(rejected).toFixed()}) melampaui jumlah datang (${received.toFixed()}).`,
            );
          }

          const backorderQty = received.minus(accepted).minus(rejected);
          await client.query(
            `UPDATE ${S}.goods_receipt_line
             SET accepted_qty = $2, rejected_qty = $3, backorder_qty = $4,
                 quality_status = $5, updated_at = now(), version = version + 1
             WHERE id = $1`,
            [
              line.lineId,
              accepted.toFixed(6),
              rejected.toFixed(6),
              backorderQty.toFixed(6),
              line.qualityStatus ?? (rejected.greaterThan(0) ? 'PARTIAL' : 'PASS'),
            ],
          );

          if (rejected.greaterThan(0)) {
            await client.query(
              `INSERT INTO ${S}.goods_receipt_discrepancy (goods_receipt_line_id, discrepancy_type, quantity, note)
               VALUES ($1, 'REJECTED', $2, $3)`,
              [line.lineId, rejected.toFixed(6), input.notes ?? null],
            );
          }
        }

        await client.query(
          `INSERT INTO ${S}.goods_receipt_inspection (goods_receipt_id, inspector_id, result, notes)
           VALUES ($1, $2, $3, $4)`,
          [id, ctx.userId, input.result ?? 'PASS', input.notes ?? null],
        );

        await client.query(
          `UPDATE ${S}.goods_receipt
           SET status = 'WAITING_VALIDATION', validation_status = 'WAITING',
               inspected_at = now(), inspected_by = $2, updated_at = now(), version = version + 1
           WHERE id = $1`,
          [id, ctx.userId],
        );

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'GOODS_RECEIPT_INSPECTED',
          entityType: 'goods_receipt',
          entityId: id,
          documentNumber: receipt.rows[0].receipt_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
        });

        return this.loadGoodsReceipt(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'GOODS_RECEIPT_INSPECTED' },
    );
  }

  /**
   * Validasi penerimaan — INILAH satu-satunya titik stok bertambah.
   * Movement dan balance diperbarui dalam transaksi yang sama.
   */
  async validateGoodsReceipt(ctx: LifecycleContext, id: string) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const receipt = await client.query<{
          id: string;
          receipt_number: string;
          status: string;
          warehouse_id: string;
          purchase_order_id: string | null;
          supplier_id: string | null;
          receipt_date: string;
          posting_key: string | null;
        }>(
          `SELECT id::text AS id, receipt_number, status, warehouse_id::text AS warehouse_id,
                  purchase_order_id::text AS purchase_order_id, supplier_id::text AS supplier_id,
                  receipt_date::text AS receipt_date, posting_key
           FROM ${S}.goods_receipt WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!receipt.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penerimaan tidak ditemukan.');
        if (receipt.rows[0].status === 'STOCK_POSTED' || receipt.rows[0].posting_key) {
          throw AppError.conflict(
            ErrorCodes.RECEIPT_ALREADY_VALIDATED,
            'Penerimaan sudah divalidasi dan stok sudah diposting.',
          );
        }
        if (!['WAITING_VALIDATION', 'INSPECTED'].includes(receipt.rows[0].status)) {
          throw AppError.conflict(
            ErrorCodes.INVALID_STATE_TRANSITION,
            `Validasi memerlukan status WAITING_VALIDATION, saat ini ${receipt.rows[0].status}.`,
          );
        }

        const lines = await client.query<{
          id: string;
          product_id: string;
          uom_id: string;
          lot_id: string | null;
          purchase_order_line_id: string | null;
          accepted_qty: string;
          rejected_qty: string;
          received_qty: string;
          unit_cost: string;
        }>(
          `SELECT id::text AS id, product_id::text AS product_id, uom_id::text AS uom_id,
                  lot_id::text AS lot_id, purchase_order_line_id::text AS purchase_order_line_id,
                  accepted_qty::text AS accepted_qty, rejected_qty::text AS rejected_qty,
                  received_qty::text AS received_qty, unit_cost::text AS unit_cost
           FROM ${S}.goods_receipt_line WHERE goods_receipt_id = $1 ORDER BY line_no`,
          [id],
        );
        if (!lines.rows.length) {
          throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, 'Penerimaan tidak memiliki baris.');
        }
        await assertWarehouseNotFrozen(client, S, receipt.rows[0].warehouse_id);

        const postingKey = `GR::${receipt.rows[0].receipt_number}`;
        const movements: string[] = [];
        // Nilai barang yang benar-benar diterima (harga x kuantitas diterima,
        // BUKAN ditolak) — dasar hutang dagang yang dibuat di bawah. Diterima
        // dan dimiliki adalah yang ditagihkan; barang yang ditolak masuk
        // karantina dan bukan kewajiban membayar.
        let nilaiDiterima = new Decimal(0);

        for (const line of lines.rows) {
          const accepted = new Decimal(line.accepted_qty);
          const rejected = new Decimal(line.rejected_qty);

          // Barang yang ditolak masuk karantina, bukan stok tersedia.
          if (accepted.greaterThan(0)) {
            const movementNumber = await this.sequences.next(client, ctx.schemaName, 'STOCK_MOVEMENT');
            await client.query(
              `INSERT INTO ${S}.stock_movement
                 (movement_number, movement_type, product_id, uom_id, lot_id, quantity, unit_cost,
                  destination_warehouse_id, bucket_to, reference_type, reference_id, reference_number,
                  posting_key, created_by)
               VALUES ($1, 'GOODS_RECEIPT', $2, $3, $4, $5, $6, $7, 'ON_HAND',
                       'goods_receipt', $8, $9, $10, $11)`,
              [
                movementNumber,
                line.product_id,
                line.uom_id,
                line.lot_id,
                accepted.toFixed(6),
                line.unit_cost,
                receipt.rows[0].warehouse_id,
                id,
                receipt.rows[0].receipt_number,
                `${postingKey}::${line.id}`,
                ctx.userId,
              ],
            );
            movements.push(movementNumber);

            await applyBalanceDelta(client, S, {
              warehouseId: receipt.rows[0].warehouse_id,
              productId: line.product_id,
              lotId: line.lot_id,
              onHandDelta: accepted.toNumber(),
              availableDelta: accepted.toNumber(),
              inboundCost: new Decimal(line.unit_cost).toNumber(),
            });

            nilaiDiterima = nilaiDiterima.plus(accepted.times(new Decimal(line.unit_cost)));

            // Riwayat harga beli (layar legacy 11/18). Dipakai ulang, bukan
            // tabel baru — lihat V053. Hanya dicatat bila penerimaan ini
            // punya supplier: harga tanpa pihak yang menawarkannya bukan
            // riwayat, hanya angka lepas.
            if (receipt.rows[0].supplier_id) {
              await client.query(
                `INSERT INTO ${S}.legacy_price_history
                   (source_file, legacy_row_number, party_type, supplier_id, product_id,
                    effective_date, price, metadata)
                 VALUES ('LIVE:PURCHASING', nextval('${S}.live_price_history_seq'), 'SUPPLIER',
                         $1, $2, $3::date, $4, $5::jsonb)`,
                [
                  receipt.rows[0].supplier_id,
                  line.product_id,
                  receipt.rows[0].receipt_date,
                  line.unit_cost,
                  JSON.stringify({ origin: 'goods_receipt', goodsReceiptId: id, goodsReceiptLineId: line.id }),
                ],
              );
            }
          }

          if (rejected.greaterThan(0)) {
            const movementNumber = await this.sequences.next(client, ctx.schemaName, 'STOCK_MOVEMENT');
            await client.query(
              `INSERT INTO ${S}.stock_movement
                 (movement_number, movement_type, product_id, uom_id, lot_id, quantity, unit_cost,
                  destination_warehouse_id, bucket_to, reference_type, reference_id, reference_number,
                  posting_key, created_by)
               VALUES ($1, 'GOODS_RECEIPT_QUARANTINE', $2, $3, $4, $5, $6, $7, 'QUARANTINE',
                       'goods_receipt', $8, $9, $10, $11)`,
              [
                movementNumber,
                line.product_id,
                line.uom_id,
                line.lot_id,
                rejected.toFixed(6),
                line.unit_cost,
                receipt.rows[0].warehouse_id,
                id,
                receipt.rows[0].receipt_number,
                `${postingKey}::${line.id}::QUARANTINE`,
                ctx.userId,
              ],
            );
            movements.push(movementNumber);
            await applyBalanceDelta(client, S, {
              warehouseId: receipt.rows[0].warehouse_id,
              productId: line.product_id,
              lotId: line.lot_id,
              quarantineDelta: rejected.toNumber(),
            });
          }

          // Update sisa PO.
          if (line.purchase_order_line_id) {
            await client.query(
              `UPDATE ${S}.purchase_order_line
               SET received_qty = received_qty + $2, updated_at = now(), version = version + 1
               WHERE id = $1`,
              [line.purchase_order_line_id, accepted.plus(rejected).toFixed(6)],
            );
          }
        }

        await client.query(
          `UPDATE ${S}.goods_receipt
           SET status = 'STOCK_POSTED', validation_status = 'VALIDATED',
               validated_at = now(), validated_by = $2, posting_key = $3,
               updated_at = now(), version = version + 1
           WHERE id = $1`,
          [id, ctx.userId, postingKey],
        );

        await client.query(
          `INSERT INTO ${S}.goods_receipt_validation
             (goods_receipt_id, validator_id, posting_key, action, detail)
           VALUES ($1, $2, $3, 'VALIDATE', $4)`,
          [id, ctx.userId, postingKey, JSON.stringify({ movements })],
        );

        // Status PO mengikuti sisa penerimaan, lewat aturan yang SAMA dengan
        // jalur pembalikan (`purchase-order-status.ts`). Dua perhitungan yang
        // terpisah cepat atau lambat berbeda, dan yang terlihat bukan galat
        // melainkan pesanan pembelian berstatus salah.
        if (receipt.rows[0].purchase_order_id) {
          await this.selaraskanStatusPo(client, S, receipt.rows[0].purchase_order_id);
        }

        /*
         * Hutang dagang dan peristiwa akuntansi (layar legacy 20-29).
         *
         * Dibuat HANYA bila ada supplier dan ada nilai yang diterima — tanpa
         * keduanya tidak ada pihak yang ditagih dan tidak ada apa pun yang
         * berutang. Tidak melempar bila keduanya tidak ada: validasi
         * penerimaan (pemotongan stok) tidak boleh gagal karena penerimaan
         * langsung yang memang tidak menyebut supplier.
         */
        let payableLedgerId: string | null = null;
        if (receipt.rows[0].supplier_id && nilaiDiterima.greaterThan(0)) {
          const term = await client.query<{ due_days: number | null }>(
            `SELECT pt.due_days FROM ${S}.supplier s
               LEFT JOIN ${S}.payment_term pt ON pt.id = s.payment_term_id
              WHERE s.id = $1`,
            [receipt.rows[0].supplier_id],
          );
          const dueDays = term.rows[0]?.due_days ?? 0;

          const payable = await client.query<{ id: string }>(
            `INSERT INTO ${S}.legacy_payable_ledger
               (source_file, legacy_row_number, legacy_invoice_number, supplier_id,
                transaction_date, due_date, amount, status, metadata)
             VALUES ('LIVE:PURCHASING', nextval('${S}.live_payable_ledger_seq'), $1, $2, $3::date,
                     ($3::date + ($4 || ' days')::interval)::date, $5, 'OPEN', $6::jsonb)
             RETURNING id::text`,
            [
              receipt.rows[0].receipt_number,
              receipt.rows[0].supplier_id,
              receipt.rows[0].receipt_date,
              dueDays,
              nilaiDiterima.toFixed(4),
              JSON.stringify({
                origin: 'goods_receipt',
                goodsReceiptId: id,
                purchaseOrderId: receipt.rows[0].purchase_order_id,
              }),
            ],
          );
          payableLedgerId = payable.rows[0].id;

          /*
           * Peristiwa akuntansi (IR-003, lihat `purchasing-events.catalog.ts`).
           * SATU nilai (`inventoryValue`) dipakai kedua sisi jurnal lewat dua
           * baris `accounting_posting_rule` yang menunjuk medan yang sama —
           * bukan dua peristiwa terpisah yang dapat menjadi tidak seimbang.
           * Belum benar-benar dijurnal sampai operator tenant menyemai aturan
           * postingnya; lihat komentar pada katalog peristiwa.
           */
          await client.query(
            `INSERT INTO ${S}.accounting_event
               (event_code, source_type, source_id, source_number, occurred_at, amounts,
                currency_code, status, idempotency_key, created_by)
             VALUES ('PURCHASE_GOODS_RECEIPT_VALUED', 'GOODS_RECEIPT', $1, $2, now(), $3::jsonb,
                     'IDR', 'PENDING', $4, $5)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              id,
              receipt.rows[0].receipt_number,
              JSON.stringify({ inventoryValue: nilaiDiterima.toNumber() }),
              `PURCHASE_GOODS_RECEIPT_VALUED:GOODS_RECEIPT:${id}`,
              ctx.userId,
            ],
          );
        }

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'GOODS_RECEIPT_VALIDATED',
          entityType: 'goods_receipt',
          entityId: id,
          documentNumber: receipt.rows[0].receipt_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
          metadata: { postingKey, movements, payableLedgerId },
        });

        return this.loadGoodsReceipt(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'GOODS_RECEIPT_VALIDATED' },
    );
  }

  /** Reversal validasi: membuat movement lawan, tidak menghapus movement lama. */
  /**
   * Menyelaraskan status PO dengan jumlah yang benar-benar diterima.
   *
   * Satu-satunya tempat status PO dihitung dari kuantitas. Dipakai jalur
   * validasi penerimaan DAN jalur pembalikannya, supaya keduanya tidak dapat
   * menyimpang: aturannya sendiri ada di `purchase-order-status.ts` yang murni
   * dan teruji tanpa basis data.
   *
   * Baris dikunci `FOR UPDATE` sebelum dibaca. Dua penerimaan untuk PO yang
   * sama, divalidasi bersamaan, dapat sama-sama membaca sisa lama dan menulis
   * status yang sudah basi.
   */
  private async selaraskanStatusPo(
    client: PoolClient,
    S: string,
    purchaseOrderId: string,
  ): Promise<void> {
    const po = await client.query<{ status: string }>(
      `SELECT status FROM ${S}.purchase_order WHERE id = $1 FOR UPDATE`,
      [purchaseOrderId],
    );
    if (!po.rows[0]) return;

    const jumlah = await client.query<{
      dipesan: string;
      diterima: string;
      dibatalkan: string;
    }>(
      `SELECT COALESCE(sum(ordered_qty), 0)::text   AS dipesan,
              COALESCE(sum(received_qty), 0)::text  AS diterima,
              COALESCE(sum(cancelled_qty), 0)::text AS dibatalkan
         FROM ${S}.purchase_order_line WHERE purchase_order_id = $1`,
      [purchaseOrderId],
    );

    const statusBaru = statusPoDariPenerimaan({
      statusSekarang: po.rows[0].status,
      dipesan: jumlah.rows[0]?.dipesan ?? '0',
      diterima: jumlah.rows[0]?.diterima ?? '0',
      dibatalkan: jumlah.rows[0]?.dibatalkan ?? '0',
    });

    // null berarti tidak ada yang perlu diubah. Menulis ulang nilai yang sama
    // tetap menaikkan `version` dan tetap menghasilkan satu baris jejak audit.
    if (statusBaru === null) return;

    await client.query(
      `UPDATE ${S}.purchase_order
          SET status = $2, updated_at = now(), version = version + 1
        WHERE id = $1`,
      [purchaseOrderId, statusBaru],
    );
  }

  async reverseGoodsReceiptValidation(ctx: LifecycleContext, id: string, reason: string) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const receipt = await client.query<{ receipt_number: string; status: string; warehouse_id: string; posting_key: string | null }>(
          `SELECT receipt_number, status, warehouse_id::text AS warehouse_id, posting_key
           FROM ${S}.goods_receipt WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!receipt.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penerimaan tidak ditemukan.');
        if (receipt.rows[0].status !== 'STOCK_POSTED') {
          throw AppError.conflict(
            ErrorCodes.RECEIPT_NOT_VALIDATED,
            'Hanya penerimaan yang sudah diposting dapat dibatalkan validasinya.',
          );
        }

        /*
         * Hutang dagang yang dibuat saat validasi (lihat `validateGoodsReceipt`)
         * harus ikut dibalik -- sebelumnya reversal ini hanya membalik
         * stock_movement, meninggalkan `legacy_payable_ledger` tetap terbuka
         * ("hutang hantu") walau penerimaan barangnya sudah dibatalkan
         * (docs/pos-inventory-parity/evidence/screen-20/uat.md). Diblokir bila
         * sudah ada pembayaran BERSTATUS POSTED yang dialokasikan ke hutang
         * tsb -- uang sungguhan sudah keluar, tidak aman menyamarkan hutangnya
         * begitu saja lewat reversal otomatis; perlu koreksi manual.
         */
        const payables = await client.query<{ id: string; paid_amount: string }>(
          `SELECT l.id::text,
                  COALESCE(posted.allocated_amount, 0)::text AS paid_amount
             FROM ${S}.legacy_payable_ledger l
             LEFT JOIN LATERAL (
               SELECT sum(a.allocated_amount) AS allocated_amount
                 FROM ${S}.inventory_ap_payment_allocation a
                 JOIN ${S}.inventory_ap_payment p ON p.id = a.payment_id
                WHERE a.payable_ledger_id = l.id AND p.status = 'POSTED'
             ) posted ON TRUE
            WHERE l.metadata->>'goodsReceiptId' = $1 AND NOT l.is_settled
            FOR UPDATE OF l`,
          [id],
        );
        const alreadyPaid = payables.rows.find((row) => new Decimal(row.paid_amount).greaterThan(0));
        if (alreadyPaid) {
          throw AppError.conflict(
            ErrorCodes.PAYABLE_ALREADY_PAID,
            'Hutang dari penerimaan ini sudah memiliki pembayaran terposting; tidak dapat dibatalkan otomatis. Lakukan koreksi manual.',
            { payableLedgerId: alreadyPaid.id, paidAmount: alreadyPaid.paid_amount },
          );
        }

        const originals = await client.query<{
          product_id: string;
          uom_id: string;
          lot_id: string | null;
          quantity: string;
          unit_cost: string;
          bucket_to: string | null;
        }>(
          `SELECT product_id::text AS product_id, uom_id::text AS uom_id, lot_id::text AS lot_id,
                  quantity::text AS quantity, unit_cost::text AS unit_cost, bucket_to
           FROM ${S}.stock_movement
           WHERE reference_type = 'goods_receipt' AND reference_id = $1
             AND movement_type IN ('GOODS_RECEIPT', 'GOODS_RECEIPT_QUARANTINE')`,
          [id],
        );

        await assertWarehouseNotFrozen(client, S, receipt.rows[0].warehouse_id);

        for (const [index, movement] of originals.rows.entries()) {
          const movementNumber = await this.sequences.next(client, ctx.schemaName, 'STOCK_MOVEMENT');
          const qty = new Decimal(movement.quantity);
          await client.query(
            `INSERT INTO ${S}.stock_movement
               (movement_number, movement_type, product_id, uom_id, lot_id, quantity, unit_cost,
                source_warehouse_id, bucket_from, reference_type, reference_id, reference_number,
                posting_key, created_by, note)
             VALUES ($1, 'GOODS_RECEIPT_REVERSAL', $2, $3, $4, $5, $6, $7, $8,
                     'goods_receipt_reversal', $9, $10, $11, $12, $13)`,
            [
              movementNumber,
              movement.product_id,
              movement.uom_id,
              movement.lot_id,
              qty.toFixed(6),
              movement.unit_cost,
              receipt.rows[0].warehouse_id,
              movement.bucket_to,
              id,
              receipt.rows[0].receipt_number,
              `${receipt.rows[0].posting_key}::REVERSAL::${index}`,
              ctx.userId,
              reason,
            ],
          );

          if (movement.bucket_to === 'QUARANTINE') {
            await applyBalanceDelta(client, S, {
              warehouseId: receipt.rows[0].warehouse_id,
              productId: movement.product_id,
              lotId: movement.lot_id,
              quarantineDelta: -qty.toNumber(),
            });
          } else {
            await applyBalanceDelta(client, S, {
              warehouseId: receipt.rows[0].warehouse_id,
              productId: movement.product_id,
              lotId: movement.lot_id,
              onHandDelta: -qty.toNumber(),
              availableDelta: -qty.toNumber(),
            });
          }
        }

        await client.query(
          `UPDATE ${S}.goods_receipt
           SET status = 'CORRECTION_REQUIRED', validation_status = 'REVERSED',
               reversed_at = now(), reverse_reason = $2, posting_key = NULL,
               updated_at = now(), version = version + 1
           WHERE id = $1`,
          [id, reason],
        );

        /*
         * Sisa pesanan dikembalikan, lalu status PO diselaraskan.
         *
         * Sebelumnya pembalikan membalik stok, hutang dagang, dan peristiwa
         * akuntansi -- tetapi TIDAK PERNAH menyentuh `received_qty` maupun
         * status PO. Akibatnya PO tetap `RECEIVED` padahal barangnya tidak jadi
         * masuk: tidak ada yang menagih pemasok, dan `received_qty` yang
         * menggelembung membuat penerimaan berikutnya untuk PO yang sama
         * langsung tampak lunas.
         *
         * Dikurangi dari BARIS PENERIMAAN, bukan dari pergerakan stok: baris
         * yang ditolak (`rejected`) ikut menambah `received_qty` saat validasi
         * tetapi masuk ke karantina, sehingga menghitungnya dari pergerakan
         * akan menyisakan selisih sebesar jumlah yang ditolak.
         */
        const barisPenerimaan = await client.query<{
          purchase_order_line_id: string | null;
          dikembalikan: string;
        }>(
          `SELECT purchase_order_line_id::text AS purchase_order_line_id,
                  (COALESCE(accepted_qty, 0) + COALESCE(rejected_qty, 0))::text AS dikembalikan
             FROM ${S}.goods_receipt_line
            WHERE goods_receipt_id = $1 AND purchase_order_line_id IS NOT NULL`,
          [id],
        );

        for (const baris of barisPenerimaan.rows) {
          await client.query(
            `UPDATE ${S}.purchase_order_line
                SET received_qty = GREATEST(received_qty - $2::numeric, 0),
                    updated_at = now(), version = version + 1
              WHERE id = $1`,
            [baris.purchase_order_line_id, baris.dikembalikan],
          );
        }

        const poTerkait = await client.query<{ purchase_order_id: string | null }>(
          `SELECT purchase_order_id::text AS purchase_order_id
             FROM ${S}.goods_receipt WHERE id = $1`,
          [id],
        );
        const poId = poTerkait.rows[0]?.purchase_order_id ?? null;
        if (poId) await this.selaraskanStatusPo(client, S, poId);

        for (const payable of payables.rows) {
          await client.query(
            `UPDATE ${S}.legacy_payable_ledger
               SET is_settled = TRUE,
                   metadata = metadata || jsonb_build_object(
                     'reversedAt', now(), 'reversedBy', $1::uuid, 'reversalReason', $2
                   )
             WHERE id = $3`,
            [ctx.userId, reason, payable.id],
          );
        }
        /* Peristiwa akuntansi yang belum sempat dijurnal (masih PENDING) untuk
         * nilai yang baru saja dibalik tidak boleh menunggu lalu terjurnal
         * belakangan -- jika sudah POSTED (sudah terjurnal), dibiarkan berdiri
         * apa adanya (di luar cakupan reversal ini; perlu jurnal pembalik
         * terpisah mengikuti pola `reversal_of_id`). */
        await client.query(
          `UPDATE ${S}.accounting_event
             SET status = 'SKIPPED'
           WHERE source_type = 'GOODS_RECEIPT' AND source_id = $1 AND status = 'PENDING'`,
          [id],
        );

        await client.query(
          `INSERT INTO ${S}.goods_receipt_validation
             (goods_receipt_id, validator_id, posting_key, action, reason)
           VALUES ($1, $2, $3, 'REVERSE', $4)`,
          [id, ctx.userId, `${receipt.rows[0].posting_key}::REVERSAL`, reason],
        );

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'GOODS_RECEIPT_VALIDATION_REVERSED',
          entityType: 'goods_receipt',
          entityId: id,
          documentNumber: receipt.rows[0].receipt_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          reason,
          requestId: ctx.audit.requestId,
          metadata: { settledPayableLedgerIds: payables.rows.map((row) => row.id) },
        });

        return this.loadGoodsReceipt(client, ctx.schemaName, id);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'GOODS_RECEIPT_REVERSAL' },
    );
  }

  // --- BACKORDER -----------------------------------------------------------

  /** Backorder dari kekurangan penerimaan. TIDAK menambah stok. */
  async createBackorderFromReceipt(
    ctx: LifecycleContext,
    receiptId: string,
    input: { replacementSupplierId?: string; redirectReason?: string; dueDate?: string } = {},
    idempotencyKey?: string,
  ) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;

        if (idempotencyKey) {
          const existing = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM ${S}.purchase_backorder WHERE idempotency_key = $1`,
            [idempotencyKey],
          );
          if (existing.rows[0]) return this.loadBackorder(client, ctx.schemaName, existing.rows[0].id);
        }

        const receipt = await client.query<{
          id: string;
          receipt_number: string;
          purchase_order_id: string;
          supplier_id: string;
          warehouse_id: string;
        }>(
          `SELECT id::text AS id, receipt_number, purchase_order_id::text AS purchase_order_id,
                  supplier_id::text AS supplier_id, warehouse_id::text AS warehouse_id
           FROM ${S}.goods_receipt WHERE id = $1`,
          [receiptId],
        );
        if (!receipt.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penerimaan tidak ditemukan.');

        // Shortage = ordered - received - cancelled, dikurangi backorder aktif.
        const shortages = await client.query<{
          po_line_id: string;
          product_id: string;
          uom_id: string;
          shortage: string;
        }>(
          `SELECT pol.id::text AS po_line_id, pol.product_id::text AS product_id,
                  pol.uom_id::text AS uom_id,
                  (pol.ordered_qty - pol.received_qty - pol.cancelled_qty
                   - COALESCE((
                       SELECT sum(bl.shortage_qty - bl.fulfilled_qty - bl.cancelled_qty)
                       FROM ${S}.purchase_backorder_line bl
                       JOIN ${S}.purchase_backorder b ON b.id = bl.backorder_id
                       WHERE bl.source_purchase_order_line_id = pol.id
                         AND b.status NOT IN ('CANCELLED', 'CLOSED')
                         AND b.deleted_at IS NULL
                     ), 0))::text AS shortage
           FROM ${S}.purchase_order_line pol
           WHERE pol.purchase_order_id = $1`,
          [receipt.rows[0].purchase_order_id],
        );

        const eligible = shortages.rows.filter((row) => new Decimal(row.shortage).greaterThan(0));
        if (!eligible.length) {
          throw AppError.unprocessable(
            ErrorCodes.NO_SHORTAGE_FOR_BACKORDER,
            'Tidak ada kekurangan yang belum memiliki backorder aktif.',
          );
        }

        // Pemasok pengganti wajib punya mapping produk aktif.
        if (input.replacementSupplierId) {
          for (const row of eligible) {
            const mapping = await client.query(
              `SELECT 1 FROM ${S}.product_supplier
               WHERE product_id = $1 AND supplier_id = $2 AND deleted_at IS NULL AND is_active = TRUE`,
              [row.product_id, input.replacementSupplierId],
            );
            if (!mapping.rowCount) {
              throw AppError.unprocessable(
                ErrorCodes.SUPPLIER_CANNOT_SUPPLY_PRODUCT,
                'Pemasok pengganti belum terdaftar sebagai pemasok untuk salah satu produk kekurangan.',
                { productId: row.product_id, supplierId: input.replacementSupplierId },
              );
            }
          }
        }

        const backorderNumber = await this.sequences.next(client, ctx.schemaName, 'BACKORDER');
        const header = await client.query<{ id: string }>(
          `INSERT INTO ${S}.purchase_backorder
             (backorder_number, source_purchase_order_id, source_goods_receipt_id,
              original_supplier_id, replacement_supplier_id, warehouse_id, status,
              due_date, redirect_reason, idempotency_key, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8, $9, $10, $10)
           RETURNING id::text AS id`,
          [
            backorderNumber,
            receipt.rows[0].purchase_order_id,
            receiptId,
            receipt.rows[0].supplier_id,
            input.replacementSupplierId ?? null,
            receipt.rows[0].warehouse_id,
            input.dueDate ?? null,
            input.redirectReason ?? null,
            idempotencyKey ?? null,
            ctx.userId,
          ],
        );
        const backorderId = header.rows[0].id;

        for (const [index, row] of eligible.entries()) {
          const shortage = new Decimal(row.shortage);
          await client.query(
            `INSERT INTO ${S}.purchase_backorder_line
               (backorder_id, source_purchase_order_line_id, product_id, uom_id, line_no,
                shortage_qty, remaining_qty, target_supplier_id)
             VALUES ($1, $2, $3, $4, $5, $6, $6, $7)`,
            [
              backorderId,
              row.po_line_id,
              row.product_id,
              row.uom_id,
              index + 1,
              shortage.toFixed(6),
              input.replacementSupplierId ?? receipt.rows[0].supplier_id,
            ],
          );
          await client.query(
            `UPDATE ${S}.purchase_order_line
             SET backordered_qty = backordered_qty + $2, updated_at = now()
             WHERE id = $1`,
            [row.po_line_id, shortage.toFixed(6)],
          );
        }

        await client.query(
          `UPDATE ${S}.purchase_order SET status = 'BACKORDERED', updated_at = now() WHERE id = $1`,
          [receipt.rows[0].purchase_order_id],
        );

        if (input.replacementSupplierId) {
          await client.query(
            `INSERT INTO ${S}.backorder_supplier_decision
               (backorder_id, decision, from_supplier_id, to_supplier_id, reason, approved_by)
             VALUES ($1, 'REDIRECT_TO_OTHER_SUPPLIER', $2, $3, $4, $5)`,
            [
              backorderId,
              receipt.rows[0].supplier_id,
              input.replacementSupplierId,
              input.redirectReason ?? null,
              ctx.userId,
            ],
          );
        }

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'BACKORDER_CREATED',
          entityType: 'purchase_backorder',
          entityId: backorderId,
          documentNumber: backorderNumber,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
          metadata: {
            sourceReceipt: receipt.rows[0].receipt_number,
            replacementSupplierId: input.replacementSupplierId ?? null,
            lines: eligible.length,
          },
        });

        return this.loadBackorder(client, ctx.schemaName, backorderId);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'BACKORDER_CREATED' },
    );
  }

  async assignBackorderSupplier(
    ctx: LifecycleContext,
    backorderId: string,
    input: { supplierId: string; reason?: string },
  ) {
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const S = `"${ctx.schemaName}"`;
        const backorder = await client.query<{
          backorder_number: string;
          original_supplier_id: string;
          status: string;
        }>(
          `SELECT backorder_number, original_supplier_id::text AS original_supplier_id, status
           FROM ${S}.purchase_backorder WHERE id = $1 FOR UPDATE`,
          [backorderId],
        );
        if (!backorder.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Backorder tidak ditemukan.');

        const lines = await client.query<{ product_id: string }>(
          `SELECT product_id::text AS product_id FROM ${S}.purchase_backorder_line WHERE backorder_id = $1`,
          [backorderId],
        );
        for (const line of lines.rows) {
          const mapping = await client.query(
            `SELECT 1 FROM ${S}.product_supplier
             WHERE product_id = $1 AND supplier_id = $2 AND deleted_at IS NULL AND is_active = TRUE`,
            [line.product_id, input.supplierId],
          );
          if (!mapping.rowCount) {
            throw AppError.unprocessable(
              ErrorCodes.SUPPLIER_CANNOT_SUPPLY_PRODUCT,
              'Pemasok tersebut belum terdaftar untuk salah satu produk pada backorder.',
            );
          }
        }

        const isRedirect = input.supplierId !== backorder.rows[0].original_supplier_id;
        await client.query(
          `UPDATE ${S}.purchase_backorder
           SET replacement_supplier_id = $2, redirect_reason = $3,
               status = $4, updated_at = now(), updated_by = $5, version = version + 1
           WHERE id = $1`,
          [
            backorderId,
            isRedirect ? input.supplierId : null,
            input.reason ?? null,
            isRedirect ? 'REDIRECTED_TO_OTHER_SUPPLIER' : 'APPROVED',
            ctx.userId,
          ],
        );
        await client.query(
          `UPDATE ${S}.purchase_backorder_line SET target_supplier_id = $2, updated_at = now()
           WHERE backorder_id = $1`,
          [backorderId, input.supplierId],
        );
        await client.query(
          `INSERT INTO ${S}.backorder_supplier_decision
             (backorder_id, decision, from_supplier_id, to_supplier_id, reason, approved_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            backorderId,
            isRedirect ? 'REDIRECT_TO_OTHER_SUPPLIER' : 'KEEP_ORIGINAL_SUPPLIER',
            backorder.rows[0].original_supplier_id,
            input.supplierId,
            input.reason ?? null,
            ctx.userId,
          ],
        );

        await this.audit.record({
          moduleCode: 'PURCHASING',
          actionCode: 'BACKORDER_SUPPLIER_ASSIGNED',
          entityType: 'purchase_backorder',
          entityId: backorderId,
          documentNumber: backorder.rows[0].backorder_number,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          reason: input.reason,
          requestId: ctx.audit.requestId,
          metadata: { isRedirect, supplierId: input.supplierId },
        });

        return this.loadBackorder(client, ctx.schemaName, backorderId);
      },
      { ...ctx.audit, moduleCode: 'PURCHASING', actionCode: 'BACKORDER_SUPPLIER_ASSIGNED' },
    );
  }

  /** PO lanjutan dari backorder — tetap terlacak ke PO dan penerimaan sumber. */
  async createPurchaseOrderFromBackorder(ctx: LifecycleContext, backorderId: string) {
    const data = await this.tenantDb.transaction(ctx.schemaName, async (client) => {
      const S = `"${ctx.schemaName}"`;
      const backorder = await client.query<{
        id: string;
        warehouse_id: string;
        original_supplier_id: string;
        replacement_supplier_id: string | null;
      }>(
        `SELECT id::text AS id, warehouse_id::text AS warehouse_id,
                original_supplier_id::text AS original_supplier_id,
                replacement_supplier_id::text AS replacement_supplier_id
         FROM ${S}.purchase_backorder WHERE id = $1`,
        [backorderId],
      );
      if (!backorder.rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Backorder tidak ditemukan.');

      const lines = await client.query<{
        product_id: string;
        uom_id: string;
        remaining_qty: string;
        target_supplier_id: string | null;
      }>(
        `SELECT product_id::text AS product_id, uom_id::text AS uom_id,
                remaining_qty::text AS remaining_qty, target_supplier_id::text AS target_supplier_id
         FROM ${S}.purchase_backorder_line
         WHERE backorder_id = $1 AND remaining_qty > 0 ORDER BY line_no`,
        [backorderId],
      );
      if (!lines.rows.length) {
        throw AppError.unprocessable(
          ErrorCodes.NO_SHORTAGE_FOR_BACKORDER,
          'Tidak ada sisa kekurangan pada backorder ini.',
        );
      }

      const supplierId =
        backorder.rows[0].replacement_supplier_id ??
        lines.rows[0].target_supplier_id ??
        backorder.rows[0].original_supplier_id;

      const priced: Array<{ productId: string; uomId: string; orderedQty: number; unitPrice: number }> = [];
      for (const line of lines.rows) {
        const price = await client.query<{ last_price: string }>(
          `SELECT last_price::text AS last_price FROM ${S}.product_supplier
           WHERE product_id = $1 AND supplier_id = $2 AND deleted_at IS NULL LIMIT 1`,
          [line.product_id, supplierId],
        );
        priced.push({
          productId: line.product_id,
          uomId: line.uom_id,
          orderedQty: Number(line.remaining_qty),
          unitPrice: Number(price.rows[0]?.last_price ?? 0),
        });
      }

      return { supplierId, warehouseId: backorder.rows[0].warehouse_id, lines: priced };
    });

    const purchaseOrder = await this.createPurchaseOrder(ctx, {
      supplierId: data.supplierId,
      warehouseId: data.warehouseId,
      note: 'PO lanjutan dari backorder.',
      sourceBackorderId: backorderId,
      lines: data.lines,
    });

    await this.tenantDb.transaction(ctx.schemaName, async (client) => {
      await client.query(
        `UPDATE "${ctx.schemaName}".purchase_backorder
         SET status = 'WAITING_SUPPLIER_CONFIRMATION', updated_at = now(), version = version + 1
         WHERE id = $1`,
        [backorderId],
      );
    });

    await this.audit.record({
      moduleCode: 'PURCHASING',
      actionCode: 'BACKORDER_PURCHASE_ORDER_CREATED',
      entityType: 'purchase_backorder',
      entityId: backorderId,
      tenantId: ctx.tenantId,
      tenantSchema: ctx.schemaName,
      actorUserId: ctx.userId,
      actorUsername: ctx.username,
      requestId: ctx.audit.requestId,
      metadata: { purchaseOrderId: (purchaseOrder as { id?: string }).id ?? null },
    });

    return purchaseOrder;
  }

  // --- Loader --------------------------------------------------------------

  private async loadRequestOrder(client: PoolClient, schemaName: string, id: string) {
    const S = `"${schemaName}"`;
    const header = await client.query(
      `SELECT ro.*, w.code AS requesting_warehouse_code, w.name AS requesting_warehouse_name,
              pw.code AS parent_warehouse_code
       FROM ${S}.request_order ro
       LEFT JOIN ${S}.warehouse w ON w.id = ro.requesting_warehouse_id
       LEFT JOIN ${S}.warehouse pw ON pw.id = ro.parent_warehouse_id
       WHERE ro.id = $1`,
      [id],
    );
    const lines = await client.query(
      `SELECT rol.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM ${S}.request_order_line rol
       JOIN ${S}.product p ON p.id = rol.product_id
       JOIN ${S}.uom u ON u.id = rol.uom_id
       WHERE rol.request_order_id = $1 ORDER BY rol.line_no`,
      [id],
    );
    return { ...header.rows[0], lines: lines.rows };
  }

  private async loadPurchaseOrder(client: PoolClient, schemaName: string, id: string) {
    const S = `"${schemaName}"`;
    const header = await client.query(
      `SELECT po.*, s.code AS supplier_code, s.name AS supplier_name, w.code AS warehouse_code
       FROM ${S}.purchase_order po
       JOIN ${S}.supplier s ON s.id = po.supplier_id
       LEFT JOIN ${S}.warehouse w ON w.id = po.warehouse_id
       WHERE po.id = $1`,
      [id],
    );
    const lines = await client.query(
      `SELECT pol.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM ${S}.purchase_order_line pol
       JOIN ${S}.product p ON p.id = pol.product_id
       JOIN ${S}.uom u ON u.id = pol.uom_id
       WHERE pol.purchase_order_id = $1 ORDER BY pol.line_no`,
      [id],
    );
    return { ...header.rows[0], lines: lines.rows };
  }

  private async loadGoodsReceipt(client: PoolClient, schemaName: string, id: string) {
    const S = `"${schemaName}"`;
    const header = await client.query(
      `SELECT gr.*, po.purchase_order_number, s.code AS supplier_code, s.name AS supplier_name,
              w.code AS warehouse_code
       FROM ${S}.goods_receipt gr
       LEFT JOIN ${S}.purchase_order po ON po.id = gr.purchase_order_id
       LEFT JOIN ${S}.supplier s ON s.id = gr.supplier_id
       LEFT JOIN ${S}.warehouse w ON w.id = gr.warehouse_id
       WHERE gr.id = $1`,
      [id],
    );
    const lines = await client.query(
      `SELECT grl.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM ${S}.goods_receipt_line grl
       JOIN ${S}.product p ON p.id = grl.product_id
       JOIN ${S}.uom u ON u.id = grl.uom_id
       WHERE grl.goods_receipt_id = $1 ORDER BY grl.line_no`,
      [id],
    );
    return { ...header.rows[0], lines: lines.rows };
  }

  private async loadBackorder(client: PoolClient, schemaName: string, id: string) {
    const S = `"${schemaName}"`;
    const header = await client.query(
      `SELECT bo.*, po.purchase_order_number AS source_purchase_order_number,
              gr.receipt_number AS source_receipt_number,
              os.code AS original_supplier_code, os.name AS original_supplier_name,
              rs.code AS replacement_supplier_code, rs.name AS replacement_supplier_name
       FROM ${S}.purchase_backorder bo
       LEFT JOIN ${S}.purchase_order po ON po.id = bo.source_purchase_order_id
       LEFT JOIN ${S}.goods_receipt gr ON gr.id = bo.source_goods_receipt_id
       LEFT JOIN ${S}.supplier os ON os.id = bo.original_supplier_id
       LEFT JOIN ${S}.supplier rs ON rs.id = bo.replacement_supplier_id
       WHERE bo.id = $1`,
      [id],
    );
    const lines = await client.query(
      `SELECT bol.*, p.code AS product_code, p.name AS product_name, u.code AS uom_code
       FROM ${S}.purchase_backorder_line bol
       JOIN ${S}.product p ON p.id = bol.product_id
       JOIN ${S}.uom u ON u.id = bol.uom_id
       WHERE bol.backorder_id = $1 ORDER BY bol.line_no`,
      [id],
    );
    const links = await client.query(
      `SELECT l.purchase_order_id::text AS purchase_order_id, po.purchase_order_number, po.status
       FROM ${S}.backorder_purchase_order_link l
       JOIN ${S}.purchase_order po ON po.id = l.purchase_order_id
       WHERE l.backorder_id = $1`,
      [id],
    );
    return { ...header.rows[0], lines: lines.rows, purchaseOrders: links.rows };
  }
}
