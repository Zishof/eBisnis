/**
 * Adapter persediaan farmasi.
 *
 * Satu-satunya tempat di seluruh modul kesehatan yang menyentuh persediaan.
 * Perintah eMedik §12: *"Reuse shared inventory melalui public inventory
 * service; jangan menulis langsung ke tabel stock shared."*
 *
 * Mesin saldonya memang dipakai ulang — `applyBalanceDelta` milik Core, bukan
 * salinannya. Yang **tidak** dipakai ulang adalah pemilihan lot.
 *
 * `consumeAvailable` milik Core mengurutkan lot dengan FEFO: kedaluwarsa
 * terdekat lebih dahulu. Untuk barang dagangan itu benar — habiskan yang paling
 * cepat basi. Untuk obat itu justru berbahaya: lot yang **sudah** kedaluwarsa
 * berada di urutan paling depan, sehingga obat kedaluwarsa akan menjadi yang
 * pertama diserahkan kepada pasien.
 *
 * Karena itu berkas ini punya pemilihan lotnya sendiri: FEFO yang sama, tetapi
 * lot kedaluwarsa, lot nonaktif, dan lot yang tidak berstatus GOOD dikeluarkan
 * lebih dahulu. Aturan itu tidak boleh dititipkan ke mesin bersama — di sana ia
 * akan berlaku pada kaus dan kopi; di sini ia berlaku tepat pada tempatnya.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../../infrastructure/database/tenant-connection.service';
import { NumberSequenceService } from '../../../infrastructure/sequence/number-sequence.service';
import { applyBalanceDelta, assertWarehouseNotFrozen } from '../../../infrastructure/provisioning/tenant-bootstrap.service';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import type { InventoryPort, StokTersedia } from '../ports';

/**
 * Syarat sebuah lot boleh diserahkan kepada pasien.
 *
 * Baris tanpa lot (`lot_id IS NULL`) tetap dianggap layak: sebagian sediaan
 * memang tidak dikelola per lot. Menolaknya akan menghentikan pelayanan tanpa
 * menambah keamanan sedikit pun.
 */
const SYARAT_LOT_LAYAK = `(
  b.lot_id IS NULL
  OR (
    l.deleted_at IS NULL
    AND l.is_active = TRUE
    AND l.quality_status = 'GOOD'
    AND (l.expiry_date IS NULL OR l.expiry_date > CURRENT_DATE)
  )
)`;

/** Bagian stok yang dipilih dari satu baris saldo. */
interface Alokasi {
  lotId: string | null;
  binId: string | null;
  quantity: number;
}

@Injectable()
export class CoreInventoryAdapter implements InventoryPort {
  private readonly logger = new Logger(CoreInventoryAdapter.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly sequences: NumberSequenceService,
  ) {}

  /**
   * Berapa banyak obat ini yang benar-benar boleh diserahkan.
   *
   * Sengaja berbeda dari saldo gudang: lot kedaluwarsa dan lot karantina tidak
   * ikut dihitung. Angka yang menghitungnya akan menjanjikan sesuatu yang tidak
   * boleh diserahkan, dan janji itu baru ketahuan salah saat pasien sudah
   * menunggu di depan loket.
   */
  async availability(
    schema: string,
    req: { warehouseId: string; itemId: string; lotId?: string | null },
  ): Promise<StokTersedia | null> {
    const rows = await this.tenantDb.query<{
      on_hand: string;
      reserved: string;
      available: string;
      jumlah_baris: string;
    }>(
      schema,
      `SELECT COALESCE(sum(b.on_hand_qty), 0)::text   AS on_hand,
              COALESCE(sum(b.reserved_qty), 0)::text  AS reserved,
              COALESCE(sum(b.available_qty), 0)::text AS available,
              count(*)::text                          AS jumlah_baris
         FROM "${schema}".stock_balance b
         LEFT JOIN "${schema}".inventory_lot l ON l.id = b.lot_id
        WHERE b.warehouse_id = $1 AND b.product_id = $2
          AND ($3::uuid IS NULL OR b.lot_id = $3::uuid)
          AND ${SYARAT_LOT_LAYAK}`,
      [req.warehouseId, req.itemId, req.lotId ?? null],
    );

    if (!rows.length || Number(rows[0].jumlah_baris) === 0) return null;
    return {
      onHand: Number(rows[0].on_hand),
      reserved: Number(rows[0].reserved),
      available: Number(rows[0].available),
    };
  }

  /**
   * Menahan stok untuk sebuah resep.
   *
   * Idempoten terhadap `sourceId`: resep yang sama tidak menahan dua kali,
   * sekalipun layarnya diklik berulang atau permintaannya dicoba lagi.
   *
   * Satu baris reservasi dibuat **per lot**, bukan satu baris untuk seluruh
   * jumlah. Kalau satu baris menahan dua lot sekaligus, pelepasannya tidak tahu
   * berapa yang harus dikembalikan ke masing-masing lot, dan salah satunya akan
   * tertinggal tertahan selamanya.
   */
  async reserve(
    schema: string,
    req: {
      warehouseId: string;
      itemId: string;
      quantity: number;
      sourceType: string;
      sourceId: string;
      lotId?: string | null;
    },
    userId: string,
  ): Promise<{ reservationId: string }> {
    return this.tenantDb.transaction(schema, async (client) => {
      const ada = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM "${schema}".stock_reservation
          WHERE source_type = $1 AND source_id = $2 AND status = 'ACTIVE'
          ORDER BY created_at
          FOR UPDATE`,
        [req.sourceType, req.sourceId],
      );
      if (ada.rows.length) return { reservationId: ada.rows[0].id };

      // Memilih sekaligus mengunci baris saldonya sampai transaksi selesai.
      const alokasi = await this.pilihLot(client, schema, req);

      let pertama = '';
      for (const a of alokasi) {
        const baris = await client.query<{ id: string }>(
          `INSERT INTO "${schema}".stock_reservation
             (warehouse_id, product_id, lot_id, source_type, source_id, quantity, status,
              expires_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE', now() + interval '8 hours', $7)
           RETURNING id::text AS id`,
          [req.warehouseId, req.itemId, a.lotId, req.sourceType, req.sourceId, a.quantity, userId],
        );
        if (!pertama) pertama = baris.rows[0].id;

        await applyBalanceDelta(client, `"${schema}"`, {
          warehouseId: req.warehouseId,
          productId: req.itemId,
          lotId: a.lotId,
          binId: a.binId,
          reservedDelta: a.quantity,
          availableDelta: -a.quantity,
        });
      }
      return { reservationId: pertama };
    });
  }

  async release(schema: string, sourceId: string, reason: string): Promise<number> {
    return this.tenantDb.transaction(schema, async (client) => {
      const rows = await client.query<{
        id: string;
        warehouse_id: string;
        product_id: string;
        lot_id: string | null;
        quantity: string;
      }>(
        `SELECT id::text AS id, warehouse_id::text AS warehouse_id,
                product_id::text AS product_id, lot_id::text AS lot_id,
                quantity::text AS quantity
           FROM "${schema}".stock_reservation
          WHERE source_id = $1 AND status = 'ACTIVE'
          FOR UPDATE`,
        [sourceId],
      );

      for (const r of rows.rows) {
        await client.query(
          `UPDATE "${schema}".stock_reservation
              SET status = 'RELEASED', released_at = now(), version = version + 1
            WHERE id = $1`,
          [r.id],
        );
        await applyBalanceDelta(client, `"${schema}"`, {
          warehouseId: r.warehouse_id,
          productId: r.product_id,
          lotId: r.lot_id,
          reservedDelta: -Number(r.quantity),
          availableDelta: Number(r.quantity),
        });
      }

      if (rows.rows.length) {
        this.logger.debug(`Reservasi sumber ${sourceId} dilepas: ${reason}`);
      }
      return rows.rows.length;
    });
  }

  /**
   * Mengeluarkan obat dari gudang farmasi.
   *
   * Idempoten lewat `stock_movement.idempotency_key`: penyerahan yang terulang
   * karena klik ganda atau percobaan ulang jaringan tidak mengurangi stok dua
   * kali. Ini bukan soal kenyamanan — stok obat yang berkurang ganda menampakkan
   * kekurangan yang tidak nyata, dan kekurangan yang tidak nyata memicu
   * pengadaan yang tidak perlu sekaligus menyembunyikan kehilangan yang nyata.
   */
  async issue(
    schema: string,
    req: {
      warehouseId: string;
      itemId: string;
      quantity: number;
      lotId?: string | null;
      unitCost: number;
      referenceType: string;
      referenceId: string;
      idempotencyKey: string;
    },
    userId: string,
  ): Promise<{ movementId: string; totalCost: number }> {
    return this.tenantDb.transaction(schema, async (client) => {
      const sudah = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM "${schema}".stock_movement
          WHERE idempotency_key = $1 ORDER BY created_at LIMIT 1`,
        [req.idempotencyKey],
      );
      if (sudah.rows.length) {
        this.logger.debug(`Pengeluaran ${req.idempotencyKey} sudah tercatat; tidak diulang.`);
        return { movementId: sudah.rows[0].id, totalCost: req.unitCost * req.quantity };
      }

      await assertWarehouseNotFrozen(client, `"${schema}"`, req.warehouseId);

      const uom = await client.query<{ base_uom_id: string }>(
        `SELECT base_uom_id::text AS base_uom_id FROM "${schema}".product WHERE id = $1`,
        [req.itemId],
      );
      if (!uom.rows[0]) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Item obat tidak ditemukan pada katalog produk.');
      }

      const alokasi = await this.pakaiTahanan(client, schema, req);

      let movementId = '';
      for (const [urutan, a] of alokasi.entries()) {
        const movementNumber = await this.sequences.next(client, schema, 'STOCK_MOVEMENT');
        const gerak = await client.query<{ id: string }>(
          `INSERT INTO "${schema}".stock_movement
             (movement_number, movement_type, product_id, uom_id, lot_id, quantity, unit_cost,
              source_warehouse_id, source_bin_id, bucket_from, bucket_to,
              reference_type, reference_id, posting_key, idempotency_key,
              occurred_at, created_by, note)
           VALUES ($1, 'HEALTH_DISPENSE', $2, $3, $4, $5, $6, $7, $8, 'AVAILABLE', 'ISSUED',
                   $9, $10, $11, $12, now(), $13, 'Penyerahan obat')
           RETURNING id::text AS id`,
          [
            movementNumber,
            req.itemId,
            uom.rows[0].base_uom_id,
            a.lotId,
            a.quantity,
            req.unitCost,
            req.warehouseId,
            a.binId,
            req.referenceType,
            req.referenceId,
            `${req.idempotencyKey}:${urutan}`,
            req.idempotencyKey,
            userId,
          ],
        );
        if (!movementId) movementId = gerak.rows[0].id;
      }

      return { movementId, totalCost: req.unitCost * req.quantity };
    });
  }

  // --- Bagian dalam ----------------------------------------------------------

  /**
   * Mengeluarkan stok, memakai tahanan resep bila ada.
   *
   * Bila resepnya sudah menahan stok, yang dikeluarkan **harus** lot yang
   * ditahan itu juga. Mengalokasikan ulang dengan FEFO akan mengurangi `reserved`
   * pada lot yang tidak pernah menahan apa pun — kolomnya menjadi minus di satu
   * lot dan tertahan selamanya di lot yang lain.
   */
  private async pakaiTahanan(
    client: PoolClient,
    schema: string,
    req: { warehouseId: string; itemId: string; quantity: number; lotId?: string | null; referenceId: string },
  ): Promise<Alokasi[]> {
    const tahanan = await client.query<{
      id: string;
      lot_id: string | null;
      quantity: string;
    }>(
      `SELECT id::text AS id, lot_id::text AS lot_id, quantity::text AS quantity
         FROM "${schema}".stock_reservation
        WHERE source_id = $1 AND status = 'ACTIVE' AND product_id = $2
        ORDER BY created_at
        FOR UPDATE`,
      [req.referenceId, req.itemId],
    );

    const totalTahanan = tahanan.rows.reduce((a, r) => a + Number(r.quantity), 0);

    if (totalTahanan === 0) {
      // Tidak ada tahanan — penyerahan langsung. Ambil dari yang layak, FEFO.
      const alokasi = await this.pilihLot(client, schema, req);
      for (const a of alokasi) {
        await applyBalanceDelta(client, `"${schema}"`, {
          warehouseId: req.warehouseId,
          productId: req.itemId,
          lotId: a.lotId,
          binId: a.binId,
          onHandDelta: -a.quantity,
          availableDelta: -a.quantity,
        });
      }
      return alokasi;
    }

    if (totalTahanan < req.quantity) {
      throw AppError.unprocessable(
        ErrorCodes.INSUFFICIENT_STOCK,
        `Stok yang ditahan untuk resep ini hanya ${totalTahanan} unit, sedangkan yang ` +
          `diserahkan ${req.quantity} unit. Perbarui tahanan lebih dahulu.`,
        { ditahan: totalTahanan, diminta: req.quantity },
      );
    }

    const alokasi: Alokasi[] = [];
    let sisa = req.quantity;

    for (const r of tahanan.rows) {
      const ditahan = Number(r.quantity);
      const dipakai = Math.min(ditahan, sisa);
      const kembali = ditahan - dipakai;
      sisa -= dipakai;

      await client.query(
        `UPDATE "${schema}".stock_reservation
            SET status = 'CONSUMED', released_at = now(), version = version + 1
          WHERE id = $1`,
        [r.id],
      );

      /*
       * Satu perubahan saldo untuk kedua hal sekaligus: yang terpakai keluar
       * dari gudang, sisanya kembali menjadi tersedia. Memisahnya menjadi dua
       * perubahan akan membuat `available_qty` naik sesaat — dan pembacaan
       * bersamaan pada saat itu melihat stok yang sebenarnya tidak ada.
       */
      await applyBalanceDelta(client, `"${schema}"`, {
        warehouseId: req.warehouseId,
        productId: req.itemId,
        lotId: r.lot_id,
        onHandDelta: -dipakai,
        reservedDelta: -ditahan,
        availableDelta: kembali,
      });

      if (dipakai > 0) alokasi.push({ lotId: r.lot_id, binId: null, quantity: dipakai });
    }

    return alokasi;
  }

  /**
   * Memilih lot yang boleh diserahkan, FEFO di antara yang layak.
   *
   * Mengunci baris saldo yang dipilih sampai transaksi selesai. Tanpa penguncian
   * ini, dua penyerahan bersamaan membaca sisa yang sama dan keduanya lolos —
   * lalu stok tercatat minus dan tidak ada yang tahu obatnya ke mana.
   */
  private async pilihLot(
    client: PoolClient,
    schema: string,
    req: { warehouseId: string; itemId: string; quantity: number; lotId?: string | null },
  ): Promise<Alokasi[]> {
    if (!(req.quantity > 0)) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, 'Jumlah obat harus lebih dari nol.');
    }

    const rows = await client.query<{
      lot_id: string | null;
      bin_id: string | null;
      available_qty: string;
    }>(
      `SELECT b.lot_id::text AS lot_id, b.bin_id::text AS bin_id,
              b.available_qty::text AS available_qty
         FROM "${schema}".stock_balance b
         LEFT JOIN "${schema}".inventory_lot l ON l.id = b.lot_id
        WHERE b.warehouse_id = $1 AND b.product_id = $2 AND b.available_qty > 0
          AND ($3::uuid IS NULL OR b.lot_id = $3::uuid)
          AND ${SYARAT_LOT_LAYAK}
        ORDER BY l.expiry_date NULLS LAST, b.last_movement_at NULLS FIRST
        FOR UPDATE OF b`,
      [req.warehouseId, req.itemId, req.lotId ?? null],
    );

    const dipilih: Alokasi[] = [];
    let sisa = req.quantity;
    for (const r of rows.rows) {
      if (sisa <= 0) break;
      const ambil = Math.min(Number(r.available_qty), sisa);
      if (ambil <= 0) continue;
      dipilih.push({ lotId: r.lot_id, binId: r.bin_id, quantity: ambil });
      sisa -= ambil;
    }

    if (sisa > 0) {
      /*
       * Pesannya menyebut "layak pakai", bukan sekadar "tidak cukup". Apoteker
       * yang melihat rak penuh tetapi ditolak sistem perlu tahu bahwa isi rak
       * itu kedaluwarsa atau dikarantina — bukan menduga sistemnya rusak lalu
       * mencari jalan memutar.
       */
      throw AppError.unprocessable(
        ErrorCodes.INSUFFICIENT_STOCK,
        `Stok obat yang layak pakai tidak mencukupi: kurang ${sisa} unit. ` +
          'Lot kedaluwarsa dan lot yang dikarantina tidak ikut dihitung.',
        { productId: req.itemId, warehouseId: req.warehouseId, kurang: sisa },
      );
    }
    return dipilih;
  }
}
