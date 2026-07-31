/**
 * Keranjang dan penyelesaian transaksi kasir.
 *
 * ## Batas penyelesaian
 *
 * `selesaikan()` menjalankan sepuluh langkah dalam **satu transaksi basis
 * data**: validasi penjualan, shift, stok, dan total pembayaran; menyimpan
 * pembayaran; memotong persediaan; membentuk peristiwa akuntansi; menerbitkan
 * struk; menandai selesai; lalu menitipkan peristiwa ke outbox.
 *
 * Kesatuannya bukan kerapian melainkan syarat: stok yang berkurang tanpa jurnal
 * adalah selisih yang tidak dapat dijelaskan siapa pun kemudian, dan uang yang
 * diterima tanpa transaksi yang menaunginya lebih buruk lagi.
 *
 * ## Yang tidak dipercaya dari peramban
 *
 * Harga, pajak, diskon, dan total. Seluruhnya dihitung ulang di sini dari buku
 * harga dan tarif yang berlaku pada tanggal usaha, lalu dibandingkan dengan
 * yang dikirim peramban. Bila berbeda, permintaannya ditolak — bukan diperbaiki
 * diam-diam, sebab perbedaan itu berarti layar kasir menampilkan angka yang
 * bukan angka sesungguhnya.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { PosCatalogService } from './pos-catalog.service';
import { PosStockService } from './pos-stock.service';
import { bulatkan, totalKeranjang, type HasilKuotasi } from './pos-pricing';
import {
  bolehPindah,
  bolehSuntingBaris,
  type PosSaleStatus,
} from './pos-sale-state';

interface BarisTersimpan {
  id: string;
  productId: string;
  uomId: string;
  warehouseId: string | null;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: string;
  costSnapshot: string;
  requiresApproval: boolean;
}

@Injectable()
export class PosSaleService {
  private readonly logger = new Logger(PosSaleService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly katalog: PosCatalogService,
    private readonly stok: PosStockService,
  ) {}

  // --- Keranjang -------------------------------------------------------------

  async buatKeranjang(
    schemaName: string,
    input: { outletId: string; terminalId: string; shiftId: string; customerId?: string | null },
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    const setelan = await this.katalog.setelanPos(schemaName);
    const outlet = await this.tenantDb.query<{ brand_id: string | null; timezone: string | null }>(
      schemaName,
      `SELECT brand_id, timezone FROM "${schemaName}".outlet WHERE id = $1`,
      [input.outletId],
    );
    if (!outlet.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Outlet tidak ditemukan.');
    }

    const shift = await this.shiftTerbuka(schemaName, input.shiftId, subjectId);
    const warehouseId = await this.stok.gudangOutlet(schemaName, input.outletId);

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".pos_sale
         (shift_id, outlet_id, brand_id, terminal_id, customer_id, warehouse_id,
          business_date, sale_at, currency_code, status, cashier_id, active_role_id,
          subtotal, discount_total, tax_total, grand_total, paid_total, change_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, 'DRAFT', $9, $10, 0, 0, 0, 0, 0, 0)
       RETURNING id`,
      [
        input.shiftId,
        input.outletId,
        outlet[0].brand_id,
        input.terminalId,
        input.customerId ?? null,
        warehouseId,
        shift.business_date,
        setelan.currency,
        subjectId,
        user.activeRoleId ?? null,
      ],
    );

    await this.catatStatus(schemaName, rows[0].id, null, 'DRAFT', 'Keranjang dibuka', subjectId, user);
    return this.ambil(schemaName, rows[0].id);
  }

  /**
   * Menambahkan satu baris.
   *
   * Harga dikuotasi peladen, stok ditahan, dan keduanya harus berhasil bersama.
   * Baris yang masuk keranjang tanpa penahanan stok akan membuat dua kasir
   * sama-sama menjual barang terakhir yang sama.
   */
  async tambahBaris(
    schemaName: string,
    saleId: string,
    input: {
      productId: string;
      uomId?: string;
      quantity: number;
      priceOverride?: number | null;
      manualDiscount?: { type: 'PERCENT' | 'AMOUNT'; value: number; label?: string } | null;
    },
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    const sale = await this.ambilKepala(schemaName, saleId);
    this.pastikanBolehDisunting(sale.status);

    const kuotasi = await this.katalog.kuotasi(schemaName, {
      outletId: sale.outlet_id,
      productId: input.productId,
      uomId: input.uomId,
      quantity: input.quantity,
      customerId: sale.customer_id,
      brandId: sale.brand_id,
      priceOverride: input.priceOverride ?? null,
      manualDiscount: input.manualDiscount ?? null,
    });

    const setelan = await this.katalog.setelanPos(schemaName);
    const warehouseId = sale.warehouse_id;
    if (!warehouseId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Outlet ini belum memiliki gudang. Hubungi administrator toko sebelum berjualan.',
      );
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const nomor = await client.query<{ n: string }>(
        `SELECT COALESCE(MAX(line_no), 0) + 1 AS n FROM "${schemaName}".pos_sale_line WHERE pos_sale_id = $1`,
        [saleId],
      );

      const hpp = await this.hargaPokok(client, schemaName, warehouseId, input.productId);

      const baris = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".pos_sale_line
           (pos_sale_id, product_id, uom_id, warehouse_id, line_no, quantity, unit_price,
            discount_amount, tax_amount, line_total, cost_snapshot, price_book_id,
            requires_approval)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          saleId,
          kuotasi.productId,
          kuotasi.uomId,
          warehouseId,
          Number(nomor.rows[0].n),
          kuotasi.quantity,
          kuotasi.unitPrice,
          kuotasi.discountAmount,
          kuotasi.taxAmount,
          kuotasi.lineTotal,
          hpp,
          kuotasi.priceBookId === 'DEFAULT_SALE_PRICE' ? null : kuotasi.priceBookId,
          kuotasi.requiresApproval,
        ],
      );
      const lineId = baris.rows[0].id;

      await this.simpanRincian(client, schemaName, lineId, kuotasi);

      return { lineId, warehouseId, kuotasi, allowNegative: setelan.allowNegativeStock };
    }).then(async (hasil) => {
      // Penahanan stok berada di luar transaksi penyisipan barisnya sendiri
      // supaya penolakan stok mengembalikan pesan yang jelas, bukan menggulung
      // balik seluruhnya tanpa keterangan. Baris yang gagal ditahan dihapus.
      try {
        await this.stok.tahan(
          schemaName,
          {
            warehouseId: hasil.warehouseId,
            productId: input.productId,
            quantity: input.quantity,
            saleId,
            lineId: hasil.lineId,
            allowNegative: hasil.allowNegative,
          },
          subjectId,
        );
      } catch (e) {
        await this.tenantDb.query(
          schemaName,
          `DELETE FROM "${schemaName}".pos_sale_line WHERE id = $1`,
          [hasil.lineId],
        );
        throw e;
      }
      await this.hitungUlang(schemaName, saleId);
      return this.ambil(schemaName, saleId);
    });
  }

  async ubahBaris(
    schemaName: string,
    saleId: string,
    lineId: string,
    quantity: number,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    const sale = await this.ambilKepala(schemaName, saleId);
    this.pastikanBolehDisunting(sale.status);

    const baris = await this.tenantDb.query<{ product_id: string; uom_id: string; warehouse_id: string }>(
      schemaName,
      `SELECT product_id, uom_id, warehouse_id FROM "${schemaName}".pos_sale_line
        WHERE id = $1 AND pos_sale_id = $2`,
      [lineId, saleId],
    );
    if (!baris.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Baris tidak ditemukan.');

    const setelan = await this.katalog.setelanPos(schemaName);
    const kuotasi = await this.katalog.kuotasi(schemaName, {
      outletId: sale.outlet_id,
      productId: baris[0].product_id,
      uomId: baris[0].uom_id,
      quantity,
      customerId: sale.customer_id,
      brandId: sale.brand_id,
    });

    // Stok disesuaikan lebih dahulu: bila jumlah baru tidak tersedia, barisnya
    // tidak boleh terlanjur berubah.
    await this.stok.tahan(
      schemaName,
      {
        warehouseId: baris[0].warehouse_id,
        productId: baris[0].product_id,
        quantity,
        saleId,
        lineId,
        allowNegative: setelan.allowNegativeStock,
      },
      subjectId,
    );

    await this.tenantDb.transaction(schemaName, async (client) => {
      await client.query(
        `UPDATE "${schemaName}".pos_sale_line
            SET quantity = $2, unit_price = $3, discount_amount = $4,
                tax_amount = $5, line_total = $6, requires_approval = $7, version = version + 1
          WHERE id = $1`,
        [
          lineId,
          kuotasi.quantity,
          kuotasi.unitPrice,
          kuotasi.discountAmount,
          kuotasi.taxAmount,
          kuotasi.lineTotal,
          kuotasi.requiresApproval,
        ],
      );
      await client.query(
        `DELETE FROM "${schemaName}".pos_sale_line_tax WHERE pos_sale_line_id = $1`,
        [lineId],
      );
      await client.query(
        `DELETE FROM "${schemaName}".pos_sale_line_discount WHERE pos_sale_line_id = $1`,
        [lineId],
      );
      await this.simpanRincian(client, schemaName, lineId, kuotasi);
    });

    await this.hitungUlang(schemaName, saleId);
    return this.ambil(schemaName, saleId);
  }

  async hapusBaris(schemaName: string, saleId: string, lineId: string) {
    const sale = await this.ambilKepala(schemaName, saleId);
    this.pastikanBolehDisunting(sale.status);

    await this.stok.lepas(schemaName, lineId, 'Baris dihapus dari keranjang');
    await this.tenantDb.query(
      schemaName,
      `DELETE FROM "${schemaName}".pos_sale_line WHERE id = $1 AND pos_sale_id = $2`,
      [lineId, saleId],
    );
    await this.hitungUlang(schemaName, saleId);
    return this.ambil(schemaName, saleId);
  }

  async pindahStatus(
    schemaName: string,
    saleId: string,
    ke: PosSaleStatus,
    alasan: string,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    const sale = await this.ambilKepala(schemaName, saleId);
    const v = bolehPindah(sale.status as PosSaleStatus, ke);
    if (!v.allowed) {
      throw AppError.conflict(ErrorCodes.CONFLICT, v.message ?? 'Perpindahan status tidak sah.');
    }

    await this.tenantDb.query(
      schemaName,
      // `$2` dipakai dua kali dengan tipe yang disimpulkan berbeda — sebagai
      // nilai kolom `status` dan sebagai pembanding literal. PostgreSQL menolak
      // menyimpulkannya sendiri; keduanya diberi tipe secara tegas.
      `UPDATE "${schemaName}".pos_sale
          SET status = $2::varchar,
              held_at = CASE WHEN $2::varchar = 'HELD' THEN now() ELSE held_at END,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [saleId, ke],
    );
    await this.catatStatus(schemaName, saleId, sale.status, ke, alasan, subjectId, user);

    // Keranjang yang dibatalkan melepaskan seluruh penahanan stoknya. Tanpa ini,
    // barang tetap tertahan untuk transaksi yang tidak pernah terjadi.
    if (ke === 'CANCELLED') {
      const baris = await this.tenantDb.query<{ id: string }>(
        schemaName,
        `SELECT id FROM "${schemaName}".pos_sale_line WHERE pos_sale_id = $1`,
        [saleId],
      );
      for (const b of baris) await this.stok.lepas(schemaName, b.id, alasan);
    }

    return this.ambil(schemaName, saleId);
  }

  // --- Pembayaran dan penyelesaian ------------------------------------------

  async tambahPembayaran(
    schemaName: string,
    saleId: string,
    input: { paymentMethodId: string; amount: number; tenderedAmount?: number; reference?: string },
    idempotencyKey: string,
    /*
     * Penerima pembayaran sengaja TIDAK diteruskan ke sini.
     *
     * `pos_payment` tidak punya kolom `received_by`, dan menambahkannya sekarang
     * berarti menyimpan identitas yang sama di dua tempat — pada shift, pada
     * `pos_sale.cashier_id`, dan pada barisnya sendiri. Dua tempat yang menyimpan
     * hal yang sama adalah dua tempat yang dapat berbeda.
     *
     * Yang belum terjawab: supervisor yang mengambil alih di tengah transaksi.
     * Bila keadaan itu perlu dibedakan, kolomnya ditambahkan lewat migrasi
     * tersendiri beserta alasannya — bukan lewat parameter yang tidak dipakai.
     */
  ) {
    const sale = await this.ambilKepala(schemaName, saleId);
    if (sale.status !== 'DRAFT' && sale.status !== 'PAYMENT_PENDING') {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Transaksi berstatus ${sale.status} tidak dapat menerima pembayaran.`,
      );
    }

    const metode = await this.tenantDb.query<{
      allows_change: boolean;
      requires_reference: boolean;
      method_type: string;
      name: string;
    }>(
      schemaName,
      `SELECT allows_change, requires_reference, method_type, name
         FROM "${schemaName}".payment_method
        WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [input.paymentMethodId],
    );
    if (!metode.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Metode pembayaran tidak dikenal.');
    }
    const m = metode[0];

    if (m.requires_reference && !input.reference?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Metode ${m.name} memerlukan nomor rujukan dari mesin pembayaran.`,
      );
    }

    const diserahkan = input.tenderedAmount ?? input.amount;
    if (!m.allows_change && diserahkan > input.amount) {
      /*
       * Lebih bayar hanya sah pada tunai. Kelebihan pada kartu berarti
       * kesalahan ketik, dan menerimanya diam-diam menghasilkan selisih yang
       * baru ketahuan saat rekonsiliasi bank — berminggu-minggu kemudian,
       * ketika transaksinya sudah tidak diingat siapa pun.
       */
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Metode ${m.name} tidak memberi kembalian. Nilai yang diterima harus sama dengan nilai yang ditagih.`,
      );
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const sudah = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".pos_payment WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      if (sudah.rows.length) {
        // Klik ganda pada layar yang lambat. Keadaan yang pasti terjadi di
        // lapangan, bukan kemungkinan.
        return { paymentId: sudah.rows[0].id, duplicate: true };
      }

      const urut = await client.query<{ n: string }>(
        `SELECT COALESCE(MAX(sequence_no), 0) + 1 AS n FROM "${schemaName}".pos_payment WHERE pos_sale_id = $1`,
        [saleId],
      );

      const kembalian = m.allows_change ? Math.max(0, diserahkan - input.amount) : 0;

      const baru = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".pos_payment
           (pos_sale_id, payment_method_id, amount, tendered_amount, change_amount,
            reference, status, idempotency_key, sequence_no, received_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'RECEIVED', $7, $8, $9)
         RETURNING id`,
        [
          saleId,
          input.paymentMethodId,
          input.amount,
          diserahkan,
          kembalian,
          input.reference ?? null,
          idempotencyKey,
          Number(urut.rows[0].n),
          subjectId,
        ],
      );

      await client.query(
        `UPDATE "${schemaName}".pos_sale
            SET status = 'PAYMENT_PENDING',
                paid_total = (SELECT COALESCE(SUM(amount), 0) FROM "${schemaName}".pos_payment
                               WHERE pos_sale_id = $1 AND status = 'RECEIVED'),
                change_total = (SELECT COALESCE(SUM(change_amount), 0) FROM "${schemaName}".pos_payment
                                 WHERE pos_sale_id = $1 AND status = 'RECEIVED'),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [saleId],
      );

      return { paymentId: baru.rows[0].id, duplicate: false };
    });
  }

  /**
   * Batas penyelesaian.
   *
   * Sepuluh langkah dalam satu transaksi. Bila salah satu gagal, seluruhnya
   * digulung balik dan tidak ada jejak setengah jadi.
   */
  async selesaikan(
    schemaName: string,
    saleId: string,
    idempotencyKey: string,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    const setelan = await this.katalog.setelanPos(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      // 1. Validasi penjualan — dikunci supaya penyelesaian bersamaan berbaris.
      const kepala = await client.query<Record<string, string>>(
        `SELECT id, status, shift_id, outlet_id, terminal_id, warehouse_id, currency_code,
                subtotal::text, discount_total::text, tax_total::text, grand_total::text,
                paid_total::text, business_date::text, receipt_number
           FROM "${schemaName}".pos_sale WHERE id = $1 FOR UPDATE`,
        [saleId],
      );
      if (!kepala.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transaksi tidak ditemukan.');
      }
      const s = kepala.rows[0];

      // Penyelesaian yang terulang mengembalikan hasil yang sama, bukan
      // pergerakan stok kedua.
      if (s.status === 'COMPLETED') {
        return { saleId, receiptNumber: s.receipt_number, duplicate: true };
      }
      if (s.status !== 'PAYMENT_PENDING' && s.status !== 'PAID') {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Transaksi berstatus ${s.status} belum dapat diselesaikan.`,
        );
      }

      const baris = await client.query<Record<string, string>>(
        `SELECT id, product_id, uom_id, warehouse_id, quantity::text, cost_snapshot::text,
                line_total::text, tax_amount::text, discount_amount::text
           FROM "${schemaName}".pos_sale_line WHERE pos_sale_id = $1 ORDER BY line_no`,
        [saleId],
      );
      if (!baris.rows.length) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Transaksi tanpa baris tidak dapat diselesaikan.',
        );
      }

      // 2. Validasi shift — masih terbuka, dan milik kasir ini.
      const shift = await client.query<{ status: string; cashier_id: string }>(
        `SELECT status, cashier_id FROM "${schemaName}".pos_shift WHERE id = $1`,
        [s.shift_id],
      );
      if (!shift.rows.length || shift.rows[0].status !== 'OPEN') {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Shift sudah ditutup. Transaksi ini tidak dapat diselesaikan pada shift yang tertutup.',
        );
      }

      // 3. Validasi baris yang menunggu persetujuan.
      const menunggu = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "${schemaName}".pos_sale_line
          WHERE pos_sale_id = $1 AND requires_approval = TRUE AND approved_by IS NULL`,
        [saleId],
      );
      if (Number(menunggu.rows[0].n) > 0) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Masih ada baris yang menunggu persetujuan supervisor. Transaksi belum dapat diselesaikan.',
        );
      }

      // 4. Validasi total pembayaran.
      const bayar = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total FROM "${schemaName}".pos_payment
          WHERE pos_sale_id = $1 AND status = 'RECEIVED'`,
        [saleId],
      );
      const diterima = new Decimal(bayar.rows[0].total);
      const ditagih = new Decimal(s.grand_total);
      if (!diterima.equals(ditagih)) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          diterima.lessThan(ditagih)
            ? `Pembayaran kurang ${ditagih.minus(diterima)} dari total ${ditagih}.`
            : `Pembayaran lebih ${diterima.minus(ditagih)} dari total ${ditagih}.`,
        );
      }

      // 5. Nomor struk — unik ditegakkan basis data, bukan layanan.
      const nomorStruk = await this.nomorStruk(client, schemaName, s.outlet_id, s.business_date);

      // 6. Memotong persediaan.
      const { totalCost } = await this.stok.keluarkan(client, schemaName, {
        saleId,
        receiptNumber: nomorStruk,
        lines: baris.rows.map((b) => ({
          lineId: b.id,
          warehouseId: b.warehouse_id ?? s.warehouse_id,
          productId: b.product_id,
          uomId: b.uom_id,
          quantity: Number(b.quantity),
          unitCost: Number(b.cost_snapshot ?? 0),
        })),
        userId: subjectId,
      });

      // 7. Peristiwa akuntansi.
      await this.peristiwaAkuntansi(client, schemaName, {
        saleId,
        receiptNumber: nomorStruk,
        currency: s.currency_code ?? setelan.currency,
        gross: s.subtotal,
        net: new Decimal(s.grand_total).minus(new Decimal(s.tax_total)).toString(),
        tax: s.tax_total,
        discount: s.discount_total,
        cost: String(totalCost),
        userId: subjectId,
      });

      // 8. Menerbitkan struk.
      await client.query(
        `INSERT INTO "${schemaName}".pos_sale_receipt
           (pos_sale_id, receipt_number, issued_by, payload)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (pos_sale_id) DO NOTHING`,
        [saleId, nomorStruk, subjectId, JSON.stringify({ lines: baris.rows.length })],
      );

      // 9. Menandai selesai.
      await client.query(
        `UPDATE "${schemaName}".pos_sale
            SET status = 'COMPLETED', receipt_number = $2, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [saleId, nomorStruk],
      );
      await client.query(
        `INSERT INTO "${schemaName}".pos_sale_status_history
           (pos_sale_id, from_status, to_status, reason, actor_user_id, active_role_id)
         VALUES ($1, $2, 'COMPLETED', 'Pembayaran diterima', $3, $4)`,
        [saleId, s.status, subjectId, user.activeRoleId ?? null],
      );

      // 10. Menitipkan ke outbox — pola outbox supaya penerbitan peristiwa
      //     tidak dapat gagal setengah jalan setelah transaksi ini selesai.
      await client.query(
        `INSERT INTO "${schemaName}".sync_outbox
           (event_id, entity_type, entity_id, operation, payload, sequence_no, status)
         VALUES ($1, 'POS_SALE', $2, 'COMPLETE', $3,
                 (SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM "${schemaName}".sync_outbox),
                 'PENDING')
         ON CONFLICT DO NOTHING`,
        [
          `POS_SALE_COMPLETED:${saleId}`,
          saleId,
          JSON.stringify({ saleId, receiptNumber: nomorStruk, total: s.grand_total }),
        ],
      );

      return { saleId, receiptNumber: nomorStruk, duplicate: false };
    });
  }

  // --- Bagian dalam ----------------------------------------------------------

  private pastikanBolehDisunting(status: string) {
    const v = bolehSuntingBaris(status as PosSaleStatus);
    if (!v.allowed) throw AppError.conflict(ErrorCodes.CONFLICT, v.message ?? 'Tidak dapat diubah.');
  }

  private async shiftTerbuka(schemaName: string, shiftId: string, subjectId: string) {
    const rows = await this.tenantDb.query<{ business_date: string; cashier_id: string }>(
      schemaName,
      `SELECT business_date::text, cashier_id FROM "${schemaName}".pos_shift
        WHERE id = $1 AND status = 'OPEN'`,
      [shiftId],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Shift tidak ditemukan atau sudah ditutup. Buka shift terlebih dahulu.',
      );
    }
    if (rows[0].cashier_id !== subjectId) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Shift ini milik kasir lain.');
    }
    return rows[0];
  }

  private async ambilKepala(schemaName: string, saleId: string) {
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT id, status, outlet_id, brand_id, customer_id, warehouse_id, shift_id, currency_code
         FROM "${schemaName}".pos_sale WHERE id = $1`,
      [saleId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transaksi tidak ditemukan.');
    return rows[0];
  }

  async ambil(schemaName: string, saleId: string) {
    const [kepala, baris] = await Promise.all([
      this.tenantDb.query<Record<string, unknown>>(
        schemaName,
        `SELECT id, status, outlet_id, brand_id, terminal_id, shift_id, customer_id,
                business_date::text AS business_date, currency_code, receipt_number,
                subtotal::text, discount_total::text, tax_total::text, grand_total::text,
                paid_total::text, change_total::text, version
           FROM "${schemaName}".pos_sale WHERE id = $1`,
        [saleId],
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schemaName,
        `SELECT l.id, l.line_no, l.product_id, p.name AS product_name, l.uom_id,
                l.quantity::text, l.unit_price::text, l.discount_amount::text,
                l.tax_amount::text, l.line_total::text, l.requires_approval,
                l.approved_by, l.returned_qty::text
           FROM "${schemaName}".pos_sale_line l
      LEFT JOIN "${schemaName}".product p ON p.id = l.product_id
          WHERE l.pos_sale_id = $1 ORDER BY l.line_no`,
        [saleId],
      ),
    ]);
    if (!kepala.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transaksi tidak ditemukan.');
    return { ...kepala[0], lines: baris };
  }

  /**
   * Menghitung ulang total dari barisnya.
   *
   * Dijumlahkan dari nilai baris yang tersimpan, bukan dihitung ulang dari
   * harga mentah. Total pada struk harus benar-benar merupakan jumlah dari
   * baris yang dibaca pembeli.
   */
  private async hitungUlang(schemaName: string, saleId: string) {
    const baris = await this.tenantDb.query<BarisTersimpan & Record<string, string>>(
      schemaName,
      `SELECT id, quantity::text, unit_price::text, discount_amount::text,
              tax_amount::text, line_total::text
         FROM "${schemaName}".pos_sale_line WHERE pos_sale_id = $1`,
      [saleId],
    );
    const mata = (
      await this.tenantDb.query<{ currency_code: string }>(
        schemaName,
        `SELECT currency_code FROM "${schemaName}".pos_sale WHERE id = $1`,
        [saleId],
      )
    )[0]?.currency_code ?? 'IDR';

    const hasil: HasilKuotasi[] = baris.map((b) => ({
      productId: '',
      uomId: '',
      quantity: Number(b.quantity),
      currencyCode: mata,
      unitPrice: String(b.unit_price),
      grossAmount: bulatkan(
        new Decimal(String(b.unit_price)).times(new Decimal(String(b.quantity))),
        mata,
      ).toString(),
      discountAmount: String(b.discount_amount),
      netAmount: '0',
      taxAmount: String(b.tax_amount),
      lineTotal: String(b.line_total),
      priceBookId: null,
      discounts: [],
      taxes: [],
      warnings: [],
      requiresApproval: false,
    }));

    const total = totalKeranjang(hasil, mata);
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".pos_sale
          SET subtotal = $2, discount_total = $3, tax_total = $4, grand_total = $5,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [saleId, total.subtotal, total.discountTotal, total.taxTotal, total.grandTotal],
    );
  }

  private async simpanRincian(
    client: PoolClient,
    schemaName: string,
    lineId: string,
    kuotasi: HasilKuotasi,
  ) {
    for (const t of kuotasi.taxes) {
      await client.query(
        `INSERT INTO "${schemaName}".pos_sale_line_tax
           (pos_sale_line_id, tax_rate_id, tax_code, rate_snapshot, is_inclusive, taxable_base, tax_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [lineId, t.taxRateId, t.code, t.rate, t.isInclusive, t.taxableBase, t.taxAmount],
      );
    }
    for (const d of kuotasi.discounts) {
      await client.query(
        `INSERT INTO "${schemaName}".pos_sale_line_discount
           (pos_sale_line_id, source_type, source_id, label, discount_type, discount_value, discount_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [lineId, d.sourceType, d.sourceId, d.label, d.discountType, d.discountValue, d.discountAmount],
      );
    }
  }

  private async hargaPokok(
    client: PoolClient,
    schemaName: string,
    warehouseId: string,
    productId: string,
  ): Promise<string> {
    const rows = await client.query<{ average_cost: string }>(
      `SELECT COALESCE(average_cost, 0)::text AS average_cost
         FROM "${schemaName}".stock_balance
        WHERE warehouse_id = $1 AND product_id = $2 AND lot_id IS NULL`,
      [warehouseId, productId],
    );
    if (rows.rows.length) return rows.rows[0].average_cost;

    const std = await client.query<{ standard_cost: string }>(
      `SELECT COALESCE(standard_cost, 0)::text AS standard_cost
         FROM "${schemaName}".product WHERE id = $1`,
      [productId],
    );
    return std.rows[0]?.standard_cost ?? '0';
  }

  /**
   * Nomor struk berikutnya.
   *
   * Memakai `number_sequence` bila ada, dan penomoran per outlet per tanggal
   * usaha bila belum. Keunikannya tetap dijamin indeks unik pada basis data —
   * kunci baris di sini hanya mengurangi tabrakan, bukan menggantikannya.
   */
  private async nomorStruk(
    client: PoolClient,
    schemaName: string,
    outletId: string,
    businessDate: string,
  ): Promise<string> {
    const seq = await client.query<{ id: string; prefix: string; padding: number; next_number: string }>(
      `SELECT id, COALESCE(prefix, '') AS prefix, COALESCE(padding, 6) AS padding, next_number::text
         FROM "${schemaName}".number_sequence
        WHERE document_type = 'POS_RECEIPT' AND is_active = TRUE AND deleted_at IS NULL
          AND (scope_id IS NULL OR scope_id = $1)
        ORDER BY scope_id NULLS LAST
        LIMIT 1
        FOR UPDATE`,
      [outletId],
    );

    if (seq.rows.length) {
      const n = Number(seq.rows[0].next_number);
      await client.query(
        `UPDATE "${schemaName}".number_sequence SET next_number = $2, updated_at = now() WHERE id = $1`,
        [seq.rows[0].id, n + 1],
      );
      return `${seq.rows[0].prefix}${String(n).padStart(Number(seq.rows[0].padding), '0')}`;
    }

    const hitung = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM "${schemaName}".pos_sale
        WHERE outlet_id = $1 AND business_date = $2 AND receipt_number IS NOT NULL`,
      [outletId, businessDate],
    );
    const urut = Number(hitung.rows[0].n) + 1;
    return `${businessDate.replace(/-/g, '')}-${outletId.slice(0, 4).toUpperCase()}-${String(urut).padStart(5, '0')}`;
  }

  private async peristiwaAkuntansi(
    client: PoolClient,
    schemaName: string,
    ctx: {
      saleId: string;
      receiptNumber: string;
      currency: string;
      gross: string;
      net: string;
      tax: string;
      discount: string;
      cost: string;
      userId: string;
    },
  ) {
    const peristiwa: Array<[string, Record<string, number>]> = [
      ['POS_SALE', { gross: Number(ctx.gross), net: Number(ctx.net), tax: Number(ctx.tax) }],
      ['POS_CASH_RECEIPT', { amount: Number(ctx.gross) }],
    ];
    if (Number(ctx.tax) > 0) {
      peristiwa.push(['POS_TAX_OUTPUT', { taxBase: Number(ctx.net), taxAmount: Number(ctx.tax) }]);
    }
    if (Number(ctx.discount) > 0) {
      peristiwa.push(['POS_DISCOUNT', { discountAmount: Number(ctx.discount) }]);
    }
    if (Number(ctx.cost) > 0) {
      peristiwa.push(['POS_COGS', { cost: Number(ctx.cost) }]);
      peristiwa.push(['POS_INVENTORY_RELEASE', { inventoryValue: Number(ctx.cost) }]);
    }

    for (const [kode, nilai] of peristiwa) {
      await client.query(
        `INSERT INTO "${schemaName}".accounting_event
           (event_code, source_type, source_id, source_number, occurred_at, amounts,
            currency_code, status, idempotency_key, created_by)
         VALUES ($1, 'POS_SALE', $2, $3, now(), $4, $5, 'PENDING', $6, $7)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          kode,
          ctx.saleId,
          ctx.receiptNumber,
          JSON.stringify(nilai),
          ctx.currency,
          `${kode}:POS_SALE:${ctx.saleId}`,
          ctx.userId,
        ],
      );
    }
  }

  private async catatStatus(
    schemaName: string,
    saleId: string,
    dari: string | null,
    ke: string,
    alasan: string,
    subjectId: string,
    user: AuthenticatedUser,
  ) {
    await this.tenantDb.query(
      schemaName,
      `INSERT INTO "${schemaName}".pos_sale_status_history
         (pos_sale_id, from_status, to_status, reason, actor_user_id, active_role_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [saleId, dari, ke, alasan, subjectId, user.activeRoleId ?? null],
    );
  }
}
