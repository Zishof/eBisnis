/**
 * Pemenuhan pesanan marketplace: pengambilan, pengemasan, dan pengiriman.
 *
 * Pemenuhan tinggal di schema tenant karena barangnya ada di gudang tenant.
 * Pesanan tinggal di schema platform karena dibaca pembeli. Penghubungnya satu
 * kolom, `marketplace_order_id`, tanpa foreign key lintas schema — PostgreSQL
 * tidak mendukungnya dan memaksakannya lewat trigger akan membuat setiap
 * penulisan pesanan menyentuh setiap schema tenant.
 *
 * ## Yang tidak dibangun di sini
 *
 * Armada internal, trip, GPS, dan bukti terima berbasis lokasi. Audit
 * menunjukkan tabel-tabelnya tidak ada pada schema tenant mana pun, jadi tidak
 * ada yang dapat diintegrasikan — dan membuat armada sendiri di sini berarti
 * membangun modul kedua yang kelak bertabrakan dengan modul ekspedisi.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  canAdvance,
  validatePackage,
  validatePick,
  type FulfillmentStatus,
  type PickLine,
} from './fulfillment-rules';

export interface FulfillmentActor {
  tenantId: string;
  schemaName: string;
  userId: string;
  username: string;
  requestId?: string;
}

export interface FulfillmentOrderView {
  id: string;
  code: string;
  marketplaceOrderNumber: string | null;
  status: string;
  lines: {
    id: string;
    sku: string | null;
    description: string | null;
    orderedQty: number;
    pickedQty: number;
    packedQty: number;
  }[];
  packages: { id: string; code: string; status: string; weightGram: number | null }[];
  shipment: { id: string; code: string; status: string; trackingNumber: string | null } | null;
}

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  /**
   * Membuat perintah pemenuhan dari pesanan yang sudah dibayar.
   *
   * Idempoten lewat batasan unik `(marketplace_order_id, warehouse_id)`:
   * memanggilnya dua kali tidak menggandakan pekerjaan gudang.
   */
  async createFromOrder(actor: FulfillmentActor, marketplaceOrderId: string): Promise<string> {
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { id: marketplaceOrderId, tenantId: actor.tenantId },
      include: { lines: true },
    });
    if (!order) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesanan tidak ditemukan.');
    }
    // Pemenuhan hanya untuk pesanan yang sudah dibayar. Menyiapkan barang untuk
    // pesanan yang belum lunas berarti gudang bekerja untuk pesanan yang
    // mungkin tidak pernah jadi.
    if (!['PAID', 'PROCESSING'].includes(order.status)) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Pesanan berstatus ${order.status} belum siap dipenuhi.`,
      );
    }

    const S = `"${actor.schemaName}"`;

    const existing = await this.tenantDb.query<{ id: string }>(
      actor.schemaName,
      `SELECT id::text FROM ${S}.fulfillment_order
        WHERE marketplace_order_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [marketplaceOrderId],
    );
    if (existing[0]) return existing[0].id;

    const [warehouse] = await this.tenantDb.query<{ id: string }>(
      actor.schemaName,
      `SELECT id::text FROM ${S}.warehouse WHERE deleted_at IS NULL AND is_active ORDER BY created_at LIMIT 1`,
    );

    const fulfillmentId = randomUUID();
    const code = `FUL-${order.orderNumber}`;

    await this.tenantDb.transaction(
      actor.schemaName,
      async (client) => {
        await client.query(
          `INSERT INTO ${S}.fulfillment_order
             (id, code, marketplace_order_id, marketplace_order_number, warehouse_id,
              status, ship_to_snapshot, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, 'NEW', $6::jsonb, $7, $7)`,
          [
            fulfillmentId,
            code,
            marketplaceOrderId,
            order.orderNumber,
            warehouse?.id ?? null,
            JSON.stringify(order.addressSnapshot ?? {}),
            actor.userId,
          ],
        );

        for (const line of order.lines) {
          await client.query(
            `INSERT INTO ${S}.fulfillment_order_line
               (fulfillment_order_id, listing_id, variant_id, sku, description,
                ordered_qty, weight_gram, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [
              fulfillmentId,
              line.tenantListingId,
              line.variantRef,
              line.skuSnapshot,
              line.titleSnapshot,
              line.quantity,
              line.weightGram,
              actor.userId,
            ],
          );
        }
      },
      { requestId: actor.requestId, moduleCode: 'FULFILLMENT', actionCode: 'FULFILLMENT_CREATED' },
    );

    this.logger.log(`Perintah pemenuhan ${code} dibuat untuk pesanan ${order.orderNumber}.`);
    return fulfillmentId;
  }

  /**
   * Mencatat hasil pengambilan.
   *
   * Kekurangan diizinkan bila beralasan; kelebihan tidak. Alasannya ada pada
   * `fulfillment-rules.ts`.
   */
  async recordPick(
    actor: FulfillmentActor,
    fulfillmentId: string,
    picks: { lineId: string; pickedQty: number; discrepancyReason?: string }[],
  ): Promise<FulfillmentOrderView> {
    const S = `"${actor.schemaName}"`;

    const lines = await this.tenantDb.query<{
      id: string;
      sku: string | null;
      ordered_qty: string;
    }>(
      actor.schemaName,
      `SELECT id::text, sku, ordered_qty::text FROM ${S}.fulfillment_order_line
        WHERE fulfillment_order_id = $1 AND deleted_at IS NULL`,
      [fulfillmentId],
    );
    if (lines.length === 0) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perintah pemenuhan tidak ditemukan.');
    }

    const byId = new Map(lines.map((l) => [l.id, l]));
    const pickLines: PickLine[] = picks.map((pick) => {
      const line = byId.get(pick.lineId);
      if (!line) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Baris ${pick.lineId} bukan bagian dari perintah ini.`,
        );
      }
      return {
        lineId: pick.lineId,
        sku: line.sku ?? '(tanpa SKU)',
        orderedQty: Number(line.ordered_qty),
        pickedQty: pick.pickedQty,
        discrepancyReason: pick.discrepancyReason,
      };
    });

    const verdict = validatePick(pickLines);
    if (!verdict.ok) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Pengambilan ditolak: ${verdict.issues.map((i) => i.detail).join('; ')}`,
        { issues: verdict.issues },
      );
    }

    await this.tenantDb.transaction(
      actor.schemaName,
      async (client) => {
        for (const pick of picks) {
          await client.query(
            `UPDATE ${S}.fulfillment_order_line
                SET picked_qty = $2, updated_at = now(), updated_by = $3
              WHERE id = $1`,
            [pick.lineId, pick.pickedQty, actor.userId],
          );
        }
        await client.query(
          `UPDATE ${S}.fulfillment_order
              SET status = 'PICKED', picked_at = now(), updated_at = now(), updated_by = $2
            WHERE id = $1`,
          [fulfillmentId, actor.userId],
        );
      },
      { requestId: actor.requestId, moduleCode: 'FULFILLMENT', actionCode: 'PICK_RECORDED' },
    );

    return this.load(actor, fulfillmentId);
  }

  /**
   * Membuat paket dari barang yang sudah diambil.
   *
   * Berat dan dimensi wajib: ekspedisi menagih berdasarkan yang ditimbang,
   * bukan berdasarkan berat barang yang dijumlahkan.
   */
  async createPackage(
    actor: FulfillmentActor,
    fulfillmentId: string,
    input: {
      weightGram: number;
      lengthMm: number;
      widthMm: number;
      heightMm: number;
      lines: { lineId: string; quantity: number }[];
      note?: string;
    },
  ): Promise<FulfillmentOrderView> {
    const S = `"${actor.schemaName}"`;

    const picked = await this.tenantDb.query<{ id: string; picked_qty: string; packed_qty: string }>(
      actor.schemaName,
      `SELECT id::text, picked_qty::text, packed_qty::text FROM ${S}.fulfillment_order_line
        WHERE fulfillment_order_id = $1 AND deleted_at IS NULL`,
      [fulfillmentId],
    );
    const byId = new Map(picked.map((p) => [p.id, p]));

    const verdict = validatePackage({
      weightGram: input.weightGram,
      lengthMm: input.lengthMm,
      widthMm: input.widthMm,
      heightMm: input.heightMm,
      lines: input.lines.map((l) => {
        const row = byId.get(l.lineId);
        return {
          lineId: l.lineId,
          quantity: l.quantity,
          // Sisa yang masih boleh dikemas, bukan seluruh yang diambil.
          // Tanpa pengurangan ini, barang yang sama dapat masuk dua paket.
          pickedQty: row ? Number(row.picked_qty) - Number(row.packed_qty) : 0,
        };
      }),
    });
    if (!verdict.ok) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Paket ditolak: ${verdict.issues.map((i) => i.detail).join('; ')}`,
        { issues: verdict.issues },
      );
    }

    const packageId = randomUUID();
    await this.tenantDb.transaction(
      actor.schemaName,
      async (client) => {
        const seq = await client.query<{ n: string }>(
          `SELECT (count(*) + 1)::text AS n FROM ${S}.package WHERE fulfillment_order_id = $1`,
          [fulfillmentId],
        );

        await client.query(
          `INSERT INTO ${S}.package
             (id, code, fulfillment_order_id, weight_gram, length_mm, width_mm, height_mm,
              packaging_note, status, packed_by, packed_at, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SEALED', $9, now(), $9, $9)`,
          [
            packageId,
            `PKG-${fulfillmentId.slice(0, 8)}-${seq.rows[0].n}`,
            fulfillmentId,
            input.weightGram,
            input.lengthMm,
            input.widthMm,
            input.heightMm,
            input.note ?? null,
            actor.userId,
          ],
        );

        for (const line of input.lines) {
          await client.query(
            `INSERT INTO ${S}.package_line (package_id, fulfillment_order_line_id, quantity, created_by)
             VALUES ($1, $2, $3, $4)`,
            [packageId, line.lineId, line.quantity, actor.userId],
          );
          await client.query(
            `UPDATE ${S}.fulfillment_order_line
                SET packed_qty = packed_qty + $2, updated_at = now(), updated_by = $3
              WHERE id = $1`,
            [line.lineId, line.quantity, actor.userId],
          );
        }

        await client.query(
          `UPDATE ${S}.fulfillment_order
              SET status = 'PACKED', packed_at = now(), updated_at = now(), updated_by = $2
            WHERE id = $1`,
          [fulfillmentId, actor.userId],
        );
      },
      { requestId: actor.requestId, moduleCode: 'FULFILLMENT', actionCode: 'PACKAGE_CREATED' },
    );

    return this.load(actor, fulfillmentId);
  }

  /**
   * Mencatat penyerahan ke ekspedisi.
   *
   * Nomor resi diisi pemanggil, bukan dibuat sistem. Pemesanan kurir lewat API
   * belum tersambung, dan nomor yang dikarang membuat pembeli melacak ke
   * halaman yang tidak ada.
   */
  async ship(
    actor: FulfillmentActor,
    fulfillmentId: string,
    input: { carrierId?: string; serviceCode?: string; trackingNumber?: string },
  ): Promise<FulfillmentOrderView> {
    const S = `"${actor.schemaName}"`;

    const [current] = await this.tenantDb.query<{ status: string }>(
      actor.schemaName,
      `SELECT status FROM ${S}.fulfillment_order WHERE id = $1 AND deleted_at IS NULL`,
      [fulfillmentId],
    );
    if (!current) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perintah pemenuhan tidak ditemukan.');
    }

    // Perpindahan diperiksa lewat tabel yang sama dengan yang dipakai UI.
    const from = current.status as FulfillmentStatus;
    const viaReady = canAdvance(from, 'READY_TO_SHIP');
    const direct = canAdvance(from, 'SHIPPED');
    if (!viaReady.ok && !direct.ok) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        direct.reason ?? 'Belum dapat dikirim.',
      );
    }

    const shipmentId = randomUUID();
    await this.tenantDb.transaction(
      actor.schemaName,
      async (client) => {
        await client.query(
          `INSERT INTO ${S}.shipment
             (id, code, fulfillment_order_id, carrier_id, service_code, tracking_number,
              status, booked_at, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $8)`,
          [
            shipmentId,
            `SHP-${fulfillmentId.slice(0, 8)}`,
            fulfillmentId,
            input.carrierId ?? null,
            input.serviceCode ?? null,
            input.trackingNumber ?? null,
            input.trackingNumber ? 'BOOKED' : 'DRAFT',
            actor.userId,
          ],
        );

        await client.query(
          `UPDATE ${S}.package SET status = 'SHIPPED', updated_at = now(), updated_by = $2
            WHERE fulfillment_order_id = $1 AND status <> 'CANCELLED'`,
          [fulfillmentId, actor.userId],
        );

        await client.query(
          `UPDATE ${S}.fulfillment_order
              SET status = 'SHIPPED', shipped_at = now(), updated_at = now(), updated_by = $2
            WHERE id = $1`,
          [fulfillmentId, actor.userId],
        );
      },
      { requestId: actor.requestId, moduleCode: 'FULFILLMENT', actionCode: 'SHIPMENT_BOOKED' },
    );

    this.logger.log(`Pemenuhan ${fulfillmentId} diserahkan ke ekspedisi.`);
    return this.load(actor, fulfillmentId);
  }

  /**
   * Mencatat peristiwa pelacakan dari ekspedisi.
   *
   * Peristiwa yang sama dapat datang berulang; batasan unik pada
   * `(shipment_id, source_event_id)` memastikan pengulangan tidak menambah
   * baris.
   */
  async recordTrackingEvent(
    actor: FulfillmentActor,
    shipmentId: string,
    event: {
      eventCode: string;
      description?: string;
      location?: string;
      occurredAt: Date;
      sourceEventId?: string;
    },
  ): Promise<void> {
    const S = `"${actor.schemaName}"`;
    await this.tenantDb.query(
      actor.schemaName,
      `INSERT INTO ${S}.shipment_tracking_event
         (shipment_id, event_code, description, location, occurred_at, source_event_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        shipmentId,
        event.eventCode,
        event.description ?? null,
        event.location ?? null,
        event.occurredAt,
        event.sourceEventId ?? null,
      ],
    );

    if (event.eventCode === 'DELIVERED') {
      await this.tenantDb.query(
        actor.schemaName,
        `UPDATE ${S}.shipment SET status = 'DELIVERED', delivered_at = $2, updated_at = now()
          WHERE id = $1 AND status <> 'DELIVERED'`,
        [shipmentId, event.occurredAt],
      );
    }
  }

  /** Daftar perintah pemenuhan pada satu tenant. */
  async list(actor: FulfillmentActor, status?: string, limit = 20): Promise<FulfillmentOrderView[]> {
    const S = `"${actor.schemaName}"`;
    const rows = await this.tenantDb.query<{ id: string }>(
      actor.schemaName,
      `SELECT id::text FROM ${S}.fulfillment_order
        WHERE deleted_at IS NULL ${status ? 'AND status = $1' : ''}
        ORDER BY requested_at DESC LIMIT ${Math.min(limit, 50)}`,
      status ? [status] : [],
    );
    return Promise.all(rows.map((r) => this.load(actor, r.id)));
  }

  /** Satu perintah pemenuhan beserta baris, paket, dan pengirimannya. */
  async load(actor: FulfillmentActor, fulfillmentId: string): Promise<FulfillmentOrderView> {
    const S = `"${actor.schemaName}"`;

    const [order] = await this.tenantDb.query<{
      id: string;
      code: string;
      marketplace_order_number: string | null;
      status: string;
    }>(
      actor.schemaName,
      `SELECT id::text, code, marketplace_order_number, status
         FROM ${S}.fulfillment_order WHERE id = $1 AND deleted_at IS NULL`,
      [fulfillmentId],
    );
    if (!order) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perintah pemenuhan tidak ditemukan.');
    }

    const lines = await this.tenantDb.query<{
      id: string;
      sku: string | null;
      description: string | null;
      ordered_qty: string;
      picked_qty: string;
      packed_qty: string;
    }>(
      actor.schemaName,
      `SELECT id::text, sku, description, ordered_qty::text, picked_qty::text, packed_qty::text
         FROM ${S}.fulfillment_order_line
        WHERE fulfillment_order_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [fulfillmentId],
    );

    const packages = await this.tenantDb.query<{
      id: string;
      code: string;
      status: string;
      weight_gram: number | null;
    }>(
      actor.schemaName,
      `SELECT id::text, code, status, weight_gram FROM ${S}.package
        WHERE fulfillment_order_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [fulfillmentId],
    );

    const [shipment] = await this.tenantDb.query<{
      id: string;
      code: string;
      status: string;
      tracking_number: string | null;
    }>(
      actor.schemaName,
      `SELECT id::text, code, status, tracking_number FROM ${S}.shipment
        WHERE fulfillment_order_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [fulfillmentId],
    );

    return {
      id: order.id,
      code: order.code,
      marketplaceOrderNumber: order.marketplace_order_number,
      status: order.status,
      lines: lines.map((l) => ({
        id: l.id,
        sku: l.sku,
        description: l.description,
        orderedQty: Number(l.ordered_qty),
        pickedQty: Number(l.picked_qty),
        packedQty: Number(l.packed_qty),
      })),
      packages: packages.map((p) => ({
        id: p.id,
        code: p.code,
        status: p.status,
        weightGram: p.weight_gram,
      })),
      shipment: shipment
        ? {
            id: shipment.id,
            code: shipment.code,
            status: shipment.status,
            trackingNumber: shipment.tracking_number,
          }
        : null,
    };
  }
}
