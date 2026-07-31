/**
 * Ketersediaan dan pergerakan stok kasir.
 *
 * Tiga hal yang menentukan bentuk berkas ini:
 *
 * 1. **Kunci baris, bukan pemeriksaan lalu tulis.** Setiap perubahan saldo
 *    membaca barisnya dengan `FOR UPDATE`. Tanpa itu, dua kasir yang menjual
 *    barang terakhir yang sama sama-sama membaca stok 1, sama-sama menyimpulkan
 *    cukup, dan keduanya berhasil.
 * 2. **Idempoten.** `stock_movement.idempotency_key` unik, sehingga penyelesaian
 *    yang terulang tidak mengurangi stok dua kali.
 * 3. **Tidak ada perubahan stok yang senyap.** Setiap perubahan saldo disertai
 *    satu baris `stock_movement` yang menyebut dokumen sumbernya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import type { PoolClient } from 'pg';
import {
  bolehJual,
  type KeputusanStok,
  type SaldoStok,
} from './pos-stock';

export interface PermintaanStok {
  warehouseId: string;
  productId: string;
  quantity: number;
  lotId?: string | null;
}

@Injectable()
export class PosStockService {
  private readonly logger = new Logger(PosStockService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /** Gudang yang melayani sebuah outlet. */
  async gudangOutlet(schemaName: string, outletId: string): Promise<string | null> {
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      // Gudang anak didahulukan atas gudang induk: outlet menyimpan barangnya
      // di gudang outlet, sedangkan gudang induk adalah gudang pusat yang
      // kebetulan juga tertaut ke outlet itu.
      `SELECT id FROM "${schemaName}".warehouse
        WHERE outlet_id = $1 AND deleted_at IS NULL AND is_active = TRUE
        ORDER BY is_parent ASC, level DESC, created_at
        LIMIT 1`,
      [outletId],
    );
    return rows[0]?.id ?? null;
  }

  /** Memeriksa ketersediaan tanpa mengubah apa pun. */
  async periksa(
    schemaName: string,
    req: PermintaanStok,
    allowNegative: boolean,
  ): Promise<KeputusanStok> {
    const saldo = await this.saldo(schemaName, req);
    return bolehJual({ saldo, quantity: req.quantity, allowNegative });
  }

  /**
   * Menahan stok untuk satu baris keranjang.
   *
   * Menahan, bukan memotong. Memotong saat baris ditambahkan akan menghilangkan
   * barang dari persediaan karena pembeli yang berubah pikiran di depan kasir.
   */
  async tahan(
    schemaName: string,
    req: PermintaanStok & { saleId: string; lineId: string; allowNegative: boolean },
    userId: string,
  ): Promise<{ reservationId: string; decision: KeputusanStok }> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const saldo = await this.saldoTerkunci(client, schemaName, req);
      const keputusan = bolehJual({
        saldo,
        quantity: req.quantity,
        allowNegative: req.allowNegative,
      });
      if (!keputusan.allowed) {
        throw AppError.conflict(ErrorCodes.CONFLICT, keputusan.message ?? 'Stok tidak mencukupi.', {
          reason: keputusan.reason,
          availableQty: keputusan.availableQty,
        });
      }

      // Satu reservasi per baris keranjang. Baris yang jumlahnya diubah
      // memperbarui reservasinya, bukan menambah reservasi kedua.
      const ada = await client.query<{ id: string; quantity: string }>(
        `SELECT id, quantity::text FROM "${schemaName}".stock_reservation
          WHERE source_type = 'POS_SALE_LINE' AND source_id = $1 AND status = 'HELD'
          FOR UPDATE`,
        [req.lineId],
      );

      let reservationId: string;
      let delta = req.quantity;

      if (ada.rows.length) {
        reservationId = ada.rows[0].id;
        delta = req.quantity - Number(ada.rows[0].quantity);
        await client.query(
          `UPDATE "${schemaName}".stock_reservation
              SET quantity = $2, version = version + 1
            WHERE id = $1`,
          [reservationId, req.quantity],
        );
      } else {
        const baru = await client.query<{ id: string }>(
          `INSERT INTO "${schemaName}".stock_reservation
             (warehouse_id, product_id, lot_id, source_type, source_id, quantity, status, expires_at, created_by)
           VALUES ($1, $2, $3, 'POS_SALE_LINE', $4, $5, 'HELD', now() + interval '4 hours', $6)
           RETURNING id`,
          [req.warehouseId, req.productId, req.lotId ?? null, req.lineId, req.quantity, userId],
        );
        reservationId = baru.rows[0].id;
      }

      if (delta !== 0) {
        await this.ubahSaldo(client, schemaName, req, { reservedDelta: delta });
      }

      return { reservationId, decision: keputusan };
    });
  }

  /** Melepaskan penahanan; baris dihapus atau keranjang dibatalkan. */
  async lepas(schemaName: string, lineId: string, alasan: string): Promise<number> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const rows = await client.query<{
        id: string;
        warehouse_id: string;
        product_id: string;
        lot_id: string | null;
        quantity: string;
      }>(
        `SELECT id, warehouse_id, product_id, lot_id, quantity::text
           FROM "${schemaName}".stock_reservation
          WHERE source_type = 'POS_SALE_LINE' AND source_id = $1 AND status = 'HELD'
          FOR UPDATE`,
        [lineId],
      );
      if (!rows.rows.length) return 0;

      for (const r of rows.rows) {
        await client.query(
          `UPDATE "${schemaName}".stock_reservation
              SET status = 'RELEASED', released_at = now(), version = version + 1
            WHERE id = $1`,
          [r.id],
        );
        await this.ubahSaldo(
          client,
          schemaName,
          {
            warehouseId: r.warehouse_id,
            productId: r.product_id,
            lotId: r.lot_id,
            quantity: Number(r.quantity),
          },
          { reservedDelta: -Number(r.quantity) },
        );
      }
      this.logger.debug(`Reservasi baris ${lineId} dilepas: ${alasan}`);
      return rows.rows.length;
    });
  }

  /**
   * Mewujudkan reservasi menjadi pengeluaran stok.
   *
   * Dipanggil dari dalam transaksi penyelesaian penjualan, sehingga `client`
   * diberikan pemanggil — pengurangan stok dan pembentukan peristiwa akuntansi
   * harus berhasil atau gagal bersama-sama. Stok yang berkurang tanpa jurnal
   * adalah selisih yang tidak dapat dijelaskan siapa pun kemudian.
   */
  async keluarkan(
    client: PoolClient,
    schemaName: string,
    ctx: {
      saleId: string;
      receiptNumber: string | null;
      lines: Array<{
        lineId: string;
        warehouseId: string;
        productId: string;
        uomId: string;
        lotId?: string | null;
        quantity: number;
        unitCost: number;
      }>;
      userId: string;
    },
  ): Promise<{ movements: number; totalCost: number }> {
    let movements = 0;
    let totalCost = 0;

    for (const l of ctx.lines) {
      const kunci = `POS_SALE:${ctx.saleId}:${l.lineId}`;

      // Idempoten: penyelesaian yang terulang tidak mengurangi stok dua kali.
      const sudah = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".stock_movement WHERE idempotency_key = $1`,
        [kunci],
      );
      if (sudah.rows.length) continue;

      await client.query(
        `UPDATE "${schemaName}".stock_reservation
            SET status = 'COMMITTED', released_at = now(), version = version + 1
          WHERE source_type = 'POS_SALE_LINE' AND source_id = $1 AND status = 'HELD'`,
        [l.lineId],
      );

      await this.ubahSaldo(
        client,
        schemaName,
        {
          warehouseId: l.warehouseId,
          productId: l.productId,
          lotId: l.lotId ?? null,
          quantity: l.quantity,
        },
        { onHandDelta: -l.quantity, reservedDelta: -l.quantity },
      );

      await client.query(
        `INSERT INTO "${schemaName}".stock_movement
           (movement_number, movement_type, product_id, uom_id, lot_id, quantity, unit_cost,
            source_warehouse_id, bucket_from, bucket_to,
            reference_type, reference_id, reference_number, posting_key, idempotency_key,
            occurred_at, created_by, note)
         VALUES ($1, 'POS_SALE', $2, $3, $4, $5, $6, $7, 'AVAILABLE', 'SOLD',
                 'POS_SALE', $8, $9, $10, $10, now(), $11, 'Penjualan kasir')`,
        [
          `POS-${ctx.saleId.slice(0, 8)}-${l.lineId.slice(0, 8)}`,
          l.productId,
          l.uomId,
          l.lotId ?? null,
          l.quantity,
          l.unitCost,
          l.warehouseId,
          ctx.saleId,
          ctx.receiptNumber,
          kunci,
          ctx.userId,
        ],
      );

      movements += 1;
      totalCost += l.unitCost * l.quantity;
    }

    return { movements, totalCost };
  }

  /**
   * Melepaskan reservasi kasir yang sudah kedaluwarsa.
   *
   * Keranjang yang ditinggalkan karena pembeli batal tidak boleh menahan stok
   * selamanya. Dijalankan penjadwal, dan sengaja dibatasi jumlahnya supaya satu
   * kali jalan tidak mengunci ribuan baris sekaligus.
   */
  async lepasKedaluwarsa(schemaName: string, batas = 500): Promise<number> {
    const rows = await this.tenantDb.query<{ source_id: string }>(
      schemaName,
      `SELECT source_id FROM "${schemaName}".stock_reservation
        WHERE source_type = 'POS_SALE_LINE' AND status = 'HELD' AND expires_at < now()
        LIMIT $1`,
      [batas],
    );
    let n = 0;
    for (const r of rows) {
      n += await this.lepas(schemaName, r.source_id, 'Reservasi kedaluwarsa');
    }
    if (n) this.logger.log(`${n} reservasi kasir kedaluwarsa dilepas pada ${schemaName}`);
    return n;
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async saldo(schemaName: string, req: PermintaanStok): Promise<SaldoStok | null> {
    const rows = await this.tenantDb.query<{
      on_hand_qty: string;
      reserved_qty: string;
      available_qty: string;
    }>(
      schemaName,
      `SELECT on_hand_qty::text, reserved_qty::text, available_qty::text
         FROM "${schemaName}".stock_balance
        WHERE warehouse_id = $1 AND product_id = $2
          AND lot_id IS NOT DISTINCT FROM $3::uuid`,
      [req.warehouseId, req.productId, req.lotId ?? null],
    );
    if (!rows.length) return null;
    return {
      warehouseId: req.warehouseId,
      productId: req.productId,
      onHand: Number(rows[0].on_hand_qty),
      reserved: Number(rows[0].reserved_qty),
      available: Number(rows[0].available_qty),
    };
  }

  /** Sama dengan `saldo`, tetapi mengunci barisnya. */
  private async saldoTerkunci(
    client: PoolClient,
    schemaName: string,
    req: PermintaanStok,
  ): Promise<SaldoStok | null> {
    const rows = await client.query<{
      on_hand_qty: string;
      reserved_qty: string;
      available_qty: string;
    }>(
      `SELECT on_hand_qty::text, reserved_qty::text, available_qty::text
         FROM "${schemaName}".stock_balance
        WHERE warehouse_id = $1 AND product_id = $2
          AND lot_id IS NOT DISTINCT FROM $3::uuid
        FOR UPDATE`,
      [req.warehouseId, req.productId, req.lotId ?? null],
    );
    if (!rows.rows.length) return null;
    return {
      warehouseId: req.warehouseId,
      productId: req.productId,
      onHand: Number(rows.rows[0].on_hand_qty),
      reserved: Number(rows.rows[0].reserved_qty),
      available: Number(rows.rows[0].available_qty),
    };
  }

  /**
   * Mengubah saldo dan menjaga `available` tetap cocok.
   *
   * `available_qty` disimpan sebagai kolom tersendiri, bukan dihitung saat
   * dibaca. Karena itu ia harus diperbarui bersama-sama pada setiap perubahan —
   * kolom turunan yang disimpan terpisah adalah kolom yang cepat atau lambat
   * tidak lagi cocok dengan sumbernya.
   */
  private async ubahSaldo(
    client: PoolClient,
    schemaName: string,
    req: { warehouseId: string; productId: string; lotId?: string | null; quantity: number },
    delta: { onHandDelta?: number; reservedDelta?: number },
  ): Promise<void> {
    const onHand = delta.onHandDelta ?? 0;
    const reserved = delta.reservedDelta ?? 0;

    const hasil = await client.query(
      `UPDATE "${schemaName}".stock_balance
          SET on_hand_qty  = on_hand_qty + $4,
              reserved_qty = GREATEST(0, reserved_qty + $5),
              available_qty = (on_hand_qty + $4) - GREATEST(0, reserved_qty + $5),
              last_movement_at = now(),
              updated_at = now(),
              version = version + 1
        WHERE warehouse_id = $1 AND product_id = $2
          AND lot_id IS NOT DISTINCT FROM $3::uuid`,
      [req.warehouseId, req.productId, req.lotId ?? null, onHand, reserved],
    );

    if (hasil.rowCount === 0) {
      // Belum ada baris saldo. Terjadi pada penjualan dengan kebijakan stok
      // negatif atas produk yang belum pernah masuk gudang.
      await client.query(
        `INSERT INTO "${schemaName}".stock_balance
           (warehouse_id, product_id, lot_id, on_hand_qty, reserved_qty, available_qty, last_movement_at)
         VALUES ($1, $2, $3, $4, GREATEST(0, $5), $4 - GREATEST(0, $5), now())
         ON CONFLICT DO NOTHING`,
        [req.warehouseId, req.productId, req.lotId ?? null, onHand, reserved],
      );
    }
  }
}
