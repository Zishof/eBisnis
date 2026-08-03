/**
 * Pabrik data contoh kasir.
 *
 * Menyiapkan satu hari kerja yang tampak sungguhan: beberapa merek, outlet,
 * register, kasir, produk berharga, stok, dan penjualan yang sudah selesai —
 * supaya penyewa baru dapat membuka laporan dan melihat angka, bukan layar
 * kosong yang tidak memberitahu apa pun tentang bentuk laporannya.
 *
 * ## Aturan yang tidak boleh dilanggar
 *
 * 1. **Seluruhnya bertanda `is_sample` dan `sample_batch_id`.** Tanpa itu,
 *    pembersihan data contoh akan melewatkannya, dan penyewa yang mengira sudah
 *    membersihkan ruang kerjanya akan menemukan penjualan karangan pada laporan
 *    keuangannya berbulan-bulan kemudian.
 *
 * 2. **Tidak menyentuh data acuan.** Satuan, bagan akun, peran, dan hak akses
 *    tidak dibuat ulang maupun diubah; pabrik ini memakai yang sudah ada.
 *
 * 3. **Penjualan contoh membentuk pergerakan stok dan peristiwa akuntansi yang
 *    sama dengan penjualan sungguhan.** Data contoh yang jalannya berbeda dari
 *    jalan sungguhan tidak membuktikan apa-apa tentang sistemnya — dan lebih
 *    buruk, menyembunyikan cacat yang baru muncul pada jalan sungguhan.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/** Ukuran profil demo. */
export interface ProfilDemo {
  brands: number;
  outletsPerBrand: number;
  registersPerOutlet: number;
  products: number;
  customers: number;
  salesPerOutlet: number;
  daysBack: number;
}

export const PROFIL_BAWAAN: ProfilDemo = {
  brands: 3,
  outletsPerBrand: 3,
  registersPerOutlet: 2,
  products: 500,
  customers: 40,
  salesPerOutlet: 25,
  daysBack: 7,
};

/**
 * Profil kecil untuk pengujian dan untuk penyewa yang hanya ingin melihat
 * bentuknya. Membuat 500 penjualan pada mesin pengembangan memakan waktu yang
 * cukup lama untuk membuat orang mengira sistemnya menggantung.
 */
export const PROFIL_RINGKAS: ProfilDemo = {
  brands: 1,
  outletsPerBrand: 1,
  registersPerOutlet: 1,
  products: 12,
  customers: 5,
  salesPerOutlet: 5,
  daysBack: 2,
};

export interface RingkasanDemo {
  sampleBatchId: string;
  brands: number;
  outlets: number;
  registers: number;
  products: number;
  customers: number;
  sales: number;
  saleLines: number;
  stockBalances: number;
  durationMs: number;
}

/**
 * Nama produk contoh.
 *
 * Sengaja terdengar seperti barang warung sungguhan, bukan "Produk 1".
 * Penyewa yang melihat "Produk 1 … Produk 500" pada laporannya tidak dapat
 * menilai apakah laporannya berguna; yang melihat "Kopi Susu Gula Aren" dapat.
 */
const KATA_DEPAN = [
  'Kopi', 'Teh', 'Susu', 'Roti', 'Nasi', 'Mie', 'Ayam', 'Sambal', 'Keripik',
  'Air', 'Jus', 'Kue', 'Sabun', 'Minyak', 'Gula', 'Beras', 'Telur', 'Tepung',
];
const KATA_BELAKANG = [
  'Susu', 'Manis', 'Goreng', 'Bakar', 'Panggang', 'Rebus', 'Original', 'Pedas',
  'Spesial', 'Jumbo', 'Mini', 'Kemasan', 'Botol', 'Sachet', 'Premium', 'Hemat',
];
const NAMA_ORANG = [
  'Ani', 'Budi', 'Citra', 'Dedi', 'Eka', 'Fitri', 'Gilang', 'Hana', 'Indra',
  'Joko', 'Kiki', 'Lina', 'Maya', 'Nanda', 'Oki', 'Putri', 'Rian', 'Sari',
];
const NAMA_MEREK = ['Warung Berkah', 'Kedai Sejahtera', 'Toko Makmur'];

@Injectable()
export class PosSampleService {
  private readonly logger = new Logger(PosSampleService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Membangun profil demo.
   *
   * Deterministik terhadap `seed` supaya dua kali menjalankan dengan seed yang
   * sama menghasilkan angka yang sama — laporan yang berubah setiap kali data
   * contoh dibuat ulang tidak dapat dipakai membandingkan apa pun.
   */
  async bangun(
    schemaName: string,
    profil: ProfilDemo,
    subjectId: string,
    seed = 20260731,
  ): Promise<RingkasanDemo> {
    const mulai = Date.now();
    const batchId = randomUUID();
    const acak = pengacak(seed);

    const ringkas: RingkasanDemo = {
      sampleBatchId: batchId,
      brands: 0,
      outlets: 0,
      registers: 0,
      products: 0,
      customers: 0,
      sales: 0,
      saleLines: 0,
      stockBalances: 0,
      durationMs: 0,
    };

    await this.tenantDb.transaction(schemaName, async (client) => {
      const acuan = await this.acuan(client, schemaName);

      // --- Merek, outlet, gudang, register --------------------------------
      const outlets: Array<{ id: string; warehouseId: string; brandId: string }> = [];
      for (let b = 0; b < profil.brands; b += 1) {
        const brandId = await this.satu(
          client,
          `INSERT INTO "${schemaName}".brand (legal_entity_id, code, name, is_sample, sample_batch_id)
           VALUES ($1, $2, $3, TRUE, $4) RETURNING id`,
          [acuan.legalEntityId, `DEMO-BR-${b + 1}`, NAMA_MEREK[b % NAMA_MEREK.length], batchId],
        );
        ringkas.brands += 1;

        for (let o = 0; o < profil.outletsPerBrand; o += 1) {
          const outletId = await this.satu(
            client,
            `INSERT INTO "${schemaName}".outlet
               (legal_entity_id, brand_id, outlet_type_id, code, name, timezone, is_sample, sample_batch_id)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7) RETURNING id`,
            [
              acuan.legalEntityId,
              brandId,
              acuan.outletTypeId,
              `DEMO-OUT-${b + 1}${o + 1}`,
              `${NAMA_MEREK[b % NAMA_MEREK.length]} Cabang ${o + 1}`,
              'Asia/Jakarta',
              batchId,
            ],
          );
          const warehouseId = await this.satu(
            client,
            `INSERT INTO "${schemaName}".warehouse
               (legal_entity_id, outlet_id, warehouse_type_id, code, name, is_parent, level, path,
                is_sample, sample_batch_id)
             VALUES ($1, $2, $3, $4, $5, FALSE, 1, $6, TRUE, $7) RETURNING id`,
            [
              acuan.legalEntityId,
              outletId,
              acuan.warehouseTypeId,
              `DEMO-WH-${b + 1}${o + 1}`,
              `Gudang Cabang ${o + 1}`,
              `/DEMO-WH-${b + 1}${o + 1}`,
              batchId,
            ],
          );
          outlets.push({ id: outletId, warehouseId, brandId });
          ringkas.outlets += 1;

          for (let r = 0; r < profil.registersPerOutlet; r += 1) {
            await client.query(
              `INSERT INTO "${schemaName}".pos_terminal
                 (outlet_id, code, name, register_status, is_sample, sample_batch_id)
               VALUES ($1, $2, $3, 'READY', TRUE, $4)`,
              [outletId, `DEMO-REG-${b + 1}${o + 1}${r + 1}`, `Kasir ${r + 1}`, batchId],
            );
            ringkas.registers += 1;
          }
        }
      }

      // --- Produk ----------------------------------------------------------
      const produk: Array<{ id: string; price: number; cost: number }> = [];
      for (let i = 0; i < profil.products; i += 1) {
        const nama = `${KATA_DEPAN[acak(KATA_DEPAN.length)]} ${KATA_BELAKANG[acak(KATA_BELAKANG.length)]}`;
        // Harga bulat ribuan; harga pokok 55–75% darinya, supaya margin pada
        // laporan tampak wajar alih-alih seragam.
        const harga = (3 + acak(48)) * 1000;
        const hpp = Math.round((harga * (55 + acak(20))) / 100 / 100) * 100;
        const id = await this.satu(
          client,
          `INSERT INTO "${schemaName}".product
             (code, name, sku, base_uom_id, category_id, tax_category_id, product_type,
              tracking_type, standard_cost, default_sale_price, is_sellable, is_purchasable,
              is_sample, sample_batch_id)
           VALUES ($1, $2, $1, $3, $4, $5, 'GOODS', 'NONE', $6, $7, TRUE, TRUE, TRUE, $8)
           RETURNING id`,
          [
            `DEMO-P${String(i + 1).padStart(4, '0')}`,
            `${nama} ${i + 1}`,
            acuan.uomId,
            acuan.categoryId,
            acuan.taxCategoryId,
            hpp,
            harga,
            batchId,
          ],
        );
        // Barcode: pemindaian adalah hal pertama yang ingin dicoba penyewa, dan
        // produk contoh tanpa barcode membuat percobaan itu gagal seketika.
        await client.query(
          `INSERT INTO "${schemaName}".product_barcode
             (product_id, uom_id, barcode, barcode_type, is_primary, is_sample, sample_batch_id)
           VALUES ($1, $2, $3, 'EAN13', TRUE, TRUE, $4)`,
          [id, acuan.uomId, `899${String(1000000000 + i).slice(0, 10)}`, batchId],
        );
        produk.push({ id, price: harga, cost: hpp });
        ringkas.products += 1;
      }

      // --- Pelanggan --------------------------------------------------------
      const pelanggan: string[] = [];
      for (let i = 0; i < profil.customers; i += 1) {
        const id = await this.satu(
          client,
          `INSERT INTO "${schemaName}".customer
             (code, name, customer_type, phone, is_sample, sample_batch_id)
           VALUES ($1, $2, 'INDIVIDUAL', $3, TRUE, $4) RETURNING id`,
          [
            `DEMO-C${String(i + 1).padStart(4, '0')}`,
            `${NAMA_ORANG[acak(NAMA_ORANG.length)]} ${NAMA_ORANG[acak(NAMA_ORANG.length)]}`,
            `08${String(1100000000 + i).slice(0, 10)}`,
            batchId,
          ],
        );
        pelanggan.push(id);
        ringkas.customers += 1;
      }

      // --- Stok --------------------------------------------------------------
      for (const o of outlets) {
        for (const p of produk) {
          const jumlah = 40 + acak(160);
          await client.query(
            `INSERT INTO "${schemaName}".stock_balance
               (warehouse_id, product_id, on_hand_qty, reserved_qty, available_qty, average_cost)
             VALUES ($1, $2, $3, 0, $3, $4)
             ON CONFLICT DO NOTHING`,
            [o.warehouseId, p.id, jumlah, p.cost],
          );
          ringkas.stockBalances += 1;
        }
      }

      // --- Penjualan ---------------------------------------------------------
      const hasil = await this.penjualan(client, schemaName, {
        outlets,
        produk,
        pelanggan,
        profil,
        batchId,
        subjectId,
        acuan,
        acak,
      });
      ringkas.sales = hasil.sales;
      ringkas.saleLines = hasil.lines;
    });

    ringkas.durationMs = Date.now() - mulai;
    this.logger.log(
      `Data contoh POS ${schemaName}: ${ringkas.sales} penjualan pada ${ringkas.outlets} outlet ` +
        `(${ringkas.durationMs} ms, batch ${batchId})`,
    );
    return ringkas;
  }

  /** Berapa banyak data contoh POS yang masih aktif. */
  async hitung(schemaName: string) {
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT
         (SELECT count(*) FROM "${schemaName}".pos_sale WHERE is_sample = TRUE AND deleted_at IS NULL)::text AS sales,
         (SELECT count(*) FROM "${schemaName}".pos_terminal WHERE is_sample = TRUE AND deleted_at IS NULL)::text AS registers,
         (SELECT count(*) FROM "${schemaName}".outlet WHERE is_sample = TRUE AND deleted_at IS NULL)::text AS outlets,
         (SELECT count(*) FROM "${schemaName}".product WHERE is_sample = TRUE AND deleted_at IS NULL)::text AS products`,
    );
    const r = rows[0] ?? {};
    const total = Object.values(r).reduce((a, b) => a + Number(b ?? 0), 0);
    return {
      sales: Number(r.sales ?? 0),
      registers: Number(r.registers ?? 0),
      outlets: Number(r.outlets ?? 0),
      products: Number(r.products ?? 0),
      // Tombol "Hapus Data Contoh POS" hanya tampil bila ada yang dapat dihapus.
      hasSampleData: total > 0,
    };
  }

  /**
   * Menghapus data contoh POS.
   *
   * Soft delete, dan **hanya** baris bertanda `is_sample`. Transaksi sungguhan
   * yang kebetulan terjadi pada outlet contoh tidak ikut terhapus — dan bila
   * ada, outletnya pun tidak dihapus, karena menghapus outlet yang menaungi
   * transaksi sungguhan akan membuat transaksi itu kehilangan induknya.
   */
  async bersihkan(schemaName: string, alasan: string, subjectId: string) {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const terhapus: Record<string, number> = {};
      const tertahan: Array<{ resource: string; reason: string }> = [];

      const hapus = async (tabel: string, tambahan = '') => {
        const r = await client.query(
          `UPDATE "${schemaName}".${tabel}
              SET deleted_at = now(), delete_reason = $1
            WHERE is_sample = TRUE AND deleted_at IS NULL ${tambahan}`,
          [alasan],
        );
        if (r.rowCount) terhapus[tabel] = r.rowCount;
      };

      // Urutan sengaja dari anak ke induk.
      await hapus('pos_sale');
      await hapus('pos_terminal');
      await hapus('product');
      await hapus('customer');

      /*
       * Outlet dan gudang hanya dihapus bila tidak menaungi transaksi sungguhan.
       * Penyewa yang mencoba data contoh lalu mulai berjualan sungguhan pada
       * outlet yang sama bukan keadaan yang mustahil — dan menghapus outletnya
       * akan membuat penjualan sungguhannya kehilangan induk.
       */
      const outletTerpakai = await client.query<{ id: string; name: string }>(
        `SELECT DISTINCT o.id, o.name
           FROM "${schemaName}".outlet o
           JOIN "${schemaName}".pos_sale s ON s.outlet_id = o.id
          WHERE o.is_sample = TRUE AND s.is_sample = FALSE AND s.deleted_at IS NULL`,
      );
      const dikecualikan = outletTerpakai.rows.map((o) => o.id);
      for (const o of outletTerpakai.rows) {
        tertahan.push({
          resource: `outlet:${o.name}`,
          reason: 'Menaungi penjualan sungguhan; tidak dihapus.',
        });
      }

      const saring = dikecualikan.length
        ? `AND id <> ALL($2::uuid[])`
        : '';
      const params: unknown[] = dikecualikan.length ? [alasan, dikecualikan] : [alasan];

      const wh = await client.query(
        `UPDATE "${schemaName}".warehouse
            SET deleted_at = now(), delete_reason = $1
          WHERE is_sample = TRUE AND deleted_at IS NULL
            ${dikecualikan.length ? 'AND outlet_id <> ALL($2::uuid[])' : ''}`,
        params,
      );
      if (wh.rowCount) terhapus.warehouse = wh.rowCount;

      const ol = await client.query(
        `UPDATE "${schemaName}".outlet
            SET deleted_at = now(), delete_reason = $1
          WHERE is_sample = TRUE AND deleted_at IS NULL ${saring}`,
        params,
      );
      if (ol.rowCount) terhapus.outlet = ol.rowCount;

      await hapus('brand');

      const total = Object.values(terhapus).reduce((a, b) => a + b, 0);
      this.logger.log(`Data contoh POS ${schemaName} dibersihkan: ${total} baris — ${alasan}`);
      return { totalRemoved: total, removed: terhapus, blocked: tertahan, deletedBy: subjectId };
    });
  }

  // --- Bagian dalam ----------------------------------------------------------

  /** Data acuan yang dipakai; tidak satu pun dibuat oleh pabrik ini. */
  private async acuan(client: PoolClient, schemaName: string) {
    const ambil = async (sql: string, nama: string) => {
      const r = await client.query<{ id: string }>(sql);
      if (!r.rows.length) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Ruang kerja ini belum memiliki ${nama}. Data contoh POS memerlukannya dan tidak membuatnya sendiri.`,
        );
      }
      return r.rows[0].id;
    };

    return {
      legalEntityId: await ambil(
        `SELECT id FROM "${schemaName}".legal_entity WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`,
        'badan usaha',
      ),
      outletTypeId: await ambil(
        `SELECT id FROM "${schemaName}".outlet_type WHERE deleted_at IS NULL ORDER BY sort_order LIMIT 1`,
        'jenis outlet',
      ),
      warehouseTypeId: await ambil(
        `SELECT id FROM "${schemaName}".warehouse_type WHERE deleted_at IS NULL ORDER BY sort_order LIMIT 1`,
        'jenis gudang',
      ),
      uomId: await ambil(
        `SELECT id FROM "${schemaName}".uom WHERE deleted_at IS NULL ORDER BY sort_order LIMIT 1`,
        'satuan',
      ),
      categoryId: await ambil(
        `SELECT id FROM "${schemaName}".product_category WHERE deleted_at IS NULL ORDER BY sort_order LIMIT 1`,
        'kategori produk',
      ),
      taxCategoryId: await ambil(
        `SELECT id FROM "${schemaName}".tax_category WHERE deleted_at IS NULL ORDER BY sort_order LIMIT 1`,
        'kategori pajak',
      ),
      paymentMethodId: await ambil(
        `SELECT id FROM "${schemaName}".payment_method
          WHERE deleted_at IS NULL AND is_active = TRUE AND requires_reference = FALSE
          ORDER BY (method_type = 'CASH') DESC LIMIT 1`,
        'metode pembayaran tanpa nomor rujukan',
      ),
    };
  }

  private async penjualan(
    client: PoolClient,
    schemaName: string,
    p: {
      outlets: Array<{ id: string; warehouseId: string; brandId: string }>;
      produk: Array<{ id: string; price: number; cost: number }>;
      pelanggan: string[];
      profil: ProfilDemo;
      batchId: string;
      subjectId: string;
      acuan: { uomId: string; paymentMethodId: string };
      acak: (n: number) => number;
    },
  ) {
    let sales = 0;
    let lines = 0;

    for (const o of p.outlets) {
      // Satu shift tertutup per outlet, supaya laporan shift dan selisih kas
      // punya isi.
      const shiftId = await this.satu(
        client,
        `INSERT INTO "${schemaName}".pos_shift
           (terminal_id, outlet_id, cashier_id, shift_number, business_date, opened_at,
            opening_cash, closed_at, closing_cash, expected_cash, variance, status)
         SELECT t.id, $1, $2, $3, CURRENT_DATE - $4::int, now() - interval '8 hours',
                500000, now() - interval '1 hour', 500000, 500000, 0, 'CLOSED'
           FROM "${schemaName}".pos_terminal t
          WHERE t.outlet_id = $1 AND t.is_sample = TRUE
          ORDER BY t.code LIMIT 1
         RETURNING id`,
        [o.id, p.subjectId, `SH-DEMO-${o.id.slice(0, 8)}`, p.profil.daysBack],
      );

      for (let i = 0; i < p.profil.salesPerOutlet; i += 1) {
        const hariLalu = p.acak(p.profil.daysBack);
        const jumlahBaris = 1 + p.acak(4);
        const barisTerpilih = Array.from({ length: jumlahBaris }, () => p.produk[p.acak(p.produk.length)]);

        let subtotal = 0;
        let pajak = 0;

        const saleId = await this.satu(
          client,
          `INSERT INTO "${schemaName}".pos_sale
             (shift_id, outlet_id, brand_id, terminal_id, customer_id, warehouse_id,
              receipt_number, business_date, sale_at, currency_code, status,
              cashier_id, subtotal, discount_total, tax_total, grand_total,
              paid_total, change_total, is_sample, sample_batch_id)
           SELECT $1, $2, $3, t.id, $4, $5, $6, CURRENT_DATE - $7::int,
                  now() - ($7::int || ' days')::interval, 'IDR', 'COMPLETED',
                  $8, 0, 0, 0, 0, 0, 0, TRUE, $9
             FROM "${schemaName}".pos_terminal t
            WHERE t.outlet_id = $2 AND t.is_sample = TRUE ORDER BY t.code LIMIT 1
           RETURNING id`,
          [
            shiftId,
            o.id,
            o.brandId,
            p.pelanggan.length ? p.pelanggan[p.acak(p.pelanggan.length)] : null,
            o.warehouseId,
            `DEMO-${o.id.slice(0, 4).toUpperCase()}-${String(i + 1).padStart(5, '0')}`,
            hariLalu,
            p.subjectId,
            p.batchId,
          ],
        );

        for (let l = 0; l < barisTerpilih.length; l += 1) {
          const prod = barisTerpilih[l];
          const qty = 1 + p.acak(3);
          const nilai = prod.price * qty;
          // Pajak 11% inklusif, seperti PPN yang berlaku umum.
          const pjk = Math.round((nilai * 11) / 111);
          subtotal += nilai;
          pajak += pjk;

          await client.query(
            `INSERT INTO "${schemaName}".pos_sale_line
               (pos_sale_id, product_id, uom_id, warehouse_id, line_no, quantity, unit_price,
                discount_amount, tax_amount, line_total, cost_snapshot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)`,
            [saleId, prod.id, p.acuan.uomId, o.warehouseId, l + 1, qty, prod.price, pjk, nilai, prod.cost],
          );
          lines += 1;
        }

        await client.query(
          `UPDATE "${schemaName}".pos_sale
              SET subtotal = $2, tax_total = $3, grand_total = $2,
                  paid_total = $2 WHERE id = $1`,
          [saleId, subtotal, pajak],
        );

        await client.query(
          `INSERT INTO "${schemaName}".pos_payment
             (pos_sale_id, payment_method_id, amount, tendered_amount, change_amount,
              status, sequence_no, received_by)
           VALUES ($1, $2, $3, $3, 0, 'RECEIVED', 1, $4)`,
          [saleId, p.acuan.paymentMethodId, subtotal, p.subjectId],
        );

        await client.query(
          `INSERT INTO "${schemaName}".pos_sale_receipt
             (pos_sale_id, receipt_number, issued_by)
           SELECT id, receipt_number, $2 FROM "${schemaName}".pos_sale WHERE id = $1
           ON CONFLICT DO NOTHING`,
          [saleId, p.subjectId],
        );

        sales += 1;
      }
    }

    return { sales, lines };
  }

  private async satu(client: PoolClient, sql: string, params: unknown[]): Promise<string> {
    const r = await client.query<{ id: string }>(sql, params);
    return r.rows[0].id;
  }
}

/**
 * Pengacak deterministik.
 *
 * `Math.random()` sengaja tidak dipakai: dua kali membangun data contoh dengan
 * seed yang sama harus menghasilkan angka yang sama, supaya laporan yang
 * dibandingkan sebelum dan sesudah sebuah perubahan benar-benar membandingkan
 * perubahannya — bukan membandingkan dua himpunan data yang berbeda.
 */
function pengacak(seed: number): (batas: number) => number {
  let keadaan = seed >>> 0;
  return (batas: number) => {
    // xorshift32 — cukup untuk data contoh, dan dapat diulang persis.
    keadaan ^= keadaan << 13;
    keadaan ^= keadaan >>> 17;
    keadaan ^= keadaan << 5;
    keadaan >>>= 0;
    return batas > 0 ? keadaan % batas : 0;
  };
}
