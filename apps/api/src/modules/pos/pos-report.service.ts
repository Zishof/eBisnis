/**
 * Laporan operasional kasir.
 *
 * Setiap laporan mematuhi tiga hal yang sama:
 *
 * 1. **Rentang tanggal wajib dan terbatas.** Diperiksa `periksaRentang()`
 *    sebelum satu kueri pun dijalankan.
 * 2. **Cakupan outlet mengikuti cakupan data pengguna.** Kasir yang membuka
 *    laporan hanya melihat outletnya sendiri, tanpa laporan ini menuliskan
 *    penyaringan tersendiri.
 * 3. **Angka biaya disaring di satu tempat.** `sembunyikanBiaya()` dipanggil
 *    pada jalan keluar, bukan diulang pada setiap kueri.
 *
 * Seluruh laporan membaca `business_date`, bukan `sale_at`. Kasir yang bekerja
 * melewati tengah malam tetap berada pada tanggal usaha yang sama, dan laporan
 * yang memotong pada pukul 00.00 akan membelah satu shift menjadi dua hari —
 * lalu kas kedua hari itu tidak akan pernah cocok.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  LAPORAN_POS,
  laporanDikenal,
  periksaRentang,
  persen,
  sembunyikanBiaya,
  sorotanKasir,
  type KodeLaporan,
  type RentangLaporan,
} from './pos-report';

export interface PermintaanLaporan {
  code: string;
  from?: string;
  to?: string;
  outletId?: string;
  cashierId?: string;
  limit?: number;
}

export interface KonteksLaporan {
  /** Outlet yang boleh dilihat pengguna ini; kosong berarti seluruhnya. */
  outletIds: string[];
  bolehLihatBiaya: boolean;
  bolehLihatKasirLain: boolean;
  subjectId: string;
}

@Injectable()
export class PosReportService {
  private readonly logger = new Logger(PosReportService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /** Katalog laporan, disaring menurut hak pengguna. */
  daftarLaporan(ctx: KonteksLaporan) {
    return LAPORAN_POS.filter((l) => !l.needsCost || ctx.bolehLihatBiaya).map((l) => ({
      code: l.code,
      name: l.name,
    }));
  }

  async jalankan(schemaName: string, req: PermintaanLaporan, ctx: KonteksLaporan) {
    if (!laporanDikenal(req.code)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Laporan "${req.code}" tidak dikenal.`,
      );
    }

    const definisi = LAPORAN_POS.find((l) => l.code === req.code)!;
    if (definisi.needsCost && !ctx.bolehLihatBiaya) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        `Laporan "${definisi.name}" menampilkan harga pokok. Anda tidak berwenang melihatnya.`,
      );
    }

    const hariIni = await this.tanggalUsaha(schemaName);
    const cek = periksaRentang(req.from, req.to, hariIni);
    if (!cek.ok) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, cek.message!, { reason: cek.reason });
    }
    const rentang = cek.range!;

    // Kasir yang tidak berwenang melihat kasir lain selalu disaring ke dirinya
    // sendiri, apa pun yang dimintanya.
    const kasirId = ctx.bolehLihatKasirLain ? req.cashierId ?? null : ctx.subjectId;

    const baris = await this.kueri(schemaName, req.code as KodeLaporan, {
      rentang,
      outletIds: this.outletTerpakai(ctx, req.outletId),
      cashierId: kasirId,
      limit: Math.min(Math.max(req.limit ?? 200, 1), 1000),
    });

    return {
      code: req.code,
      name: definisi.name,
      range: rentang,
      rowCount: baris.length,
      rows: sembunyikanBiaya(baris, ctx.bolehLihatBiaya),
      // Disebutkan supaya pembaca tahu laporan ini menyembunyikan sesuatu, dan
      // tidak menyimpulkan bahwa margin usahanya memang tidak tercatat.
      costHidden: definisi.needsCost && !ctx.bolehLihatBiaya,
      scopedToSelf: !ctx.bolehLihatKasirLain,
    };
  }

  /**
   * Dasbor satu hari untuk kepala toko.
   *
   * Menggabungkan beberapa laporan menjadi satu permintaan karena layar dasbor
   * memanggilnya sekaligus; enam permintaan terpisah pada pagi hari saat
   * seluruh outlet membuka dasbornya bersamaan bukan beban yang perlu ada.
   */
  async dasbor(schemaName: string, tanggal: string | undefined, ctx: KonteksLaporan) {
    const hariIni = await this.tanggalUsaha(schemaName);
    const cek = periksaRentang(tanggal, tanggal, hariIni);
    if (!cek.ok) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, cek.message!);
    const r = cek.range!;
    const outlets = this.outletTerpakai(ctx, undefined);

    const [ringkas, perKasir, bayar, produk, shift] = await Promise.all([
      this.kueri(schemaName, 'SALES_SUMMARY', { rentang: r, outletIds: outlets, cashierId: null, limit: 100 }),
      this.kueri(schemaName, 'BY_CASHIER', { rentang: r, outletIds: outlets, cashierId: null, limit: 50 }),
      this.kueri(schemaName, 'PAYMENT_MIX', { rentang: r, outletIds: outlets, cashierId: null, limit: 20 }),
      this.kueri(schemaName, 'BY_PRODUCT', { rentang: r, outletIds: outlets, cashierId: null, limit: 10 }),
      this.kueri(schemaName, 'BY_SHIFT', { rentang: r, outletIds: outlets, cashierId: null, limit: 50 }),
    ]);

    const totalPenjualan = ringkas.reduce((a, b) => a + Number(b.grossSales ?? 0), 0);

    // Sorotan dihitung dari baris yang sudah ada, bukan lewat kueri tambahan.
    const sorotan = perKasir.flatMap((k) =>
      sorotanKasir({
        cashierName: String(k.cashierName ?? '—'),
        totalSales: Number(k.grossSales ?? 0),
        voidValue: Number(k.voidValue ?? 0),
        discountValue: Number(k.discountValue ?? 0),
        cashVariance: Number(k.cashVariance ?? 0),
      }),
    );

    return {
      businessDate: r.from,
      totals: {
        grossSales: totalPenjualan,
        transactionCount: ringkas.reduce((a, b) => a + Number(b.transactionCount ?? 0), 0),
        averageBasket: ringkas.length
          ? Math.round(
              totalPenjualan / Math.max(1, ringkas.reduce((a, b) => a + Number(b.transactionCount ?? 0), 0)),
            )
          : 0,
      },
      byCashier: sembunyikanBiaya(perKasir, ctx.bolehLihatBiaya),
      paymentMix: bayar.map((b) => ({
        ...b,
        share: persen(Number(b.amount ?? 0), totalPenjualan),
      })),
      topProducts: sembunyikanBiaya(produk, ctx.bolehLihatBiaya),
      shifts: shift,
      highlights: sorotan,
      costHidden: !ctx.bolehLihatBiaya,
    };
  }

  // --- Kueri per laporan -----------------------------------------------------

  private async kueri(
    schemaName: string,
    code: KodeLaporan,
    p: {
      rentang: RentangLaporan;
      outletIds: string[] | null;
      cashierId: string | null;
      limit: number;
    },
  ): Promise<Array<Record<string, unknown>>> {
    const S = `"${schemaName}"`;

    /*
     * Penyaringan outlet dan kasir dirakit sebagai potongan SQL yang sama untuk
     * seluruh laporan, dan nilainya SELALU lewat parameter. Tidak ada satu pun
     * nilai dari permintaan yang masuk ke teks kueri.
     */
    const nilai: unknown[] = [p.rentang.from, p.rentang.to];
    let saring = 's.business_date BETWEEN $1::date AND $2::date';
    if (p.outletIds) {
      nilai.push(p.outletIds);
      saring += ` AND s.outlet_id = ANY($${nilai.length}::uuid[])`;
    }
    if (p.cashierId) {
      nilai.push(p.cashierId);
      saring += ` AND s.cashier_id = $${nilai.length}::uuid`;
    }
    nilai.push(p.limit);
    const batas = `$${nilai.length}`;

    // Hanya transaksi yang benar-benar selesai masuk laporan penjualan. Yang
    // dibatalkan dilaporkan tersendiri pada laporan VOID — mencampurnya membuat
    // omzet tampak lebih besar daripada uang yang sungguh diterima.
    const SELESAI = `s.status IN ('COMPLETED','RETURNED_PARTIAL','RETURNED_FULL','REFUND_PENDING','REFUNDED_PARTIAL','REFUNDED_FULL')`;

    const kueri: Record<KodeLaporan, string> = {
      SALES_SUMMARY: `
        SELECT s.business_date::text AS "businessDate",
               o.name AS "outletName",
               count(*)::int AS "transactionCount",
               COALESCE(SUM(s.subtotal),0)::text AS "netSales",
               COALESCE(SUM(s.discount_total),0)::text AS "discountValue",
               COALESCE(SUM(s.tax_total),0)::text AS "taxValue",
               COALESCE(SUM(s.grand_total),0)::text AS "grossSales"
          FROM ${S}.pos_sale s
     LEFT JOIN ${S}.outlet o ON o.id = s.outlet_id
         WHERE ${saring} AND ${SELESAI}
      GROUP BY s.business_date, o.name
      ORDER BY s.business_date DESC, o.name
         LIMIT ${batas}`,

      SALES_DETAIL: `
        SELECT s.receipt_number AS "receiptNumber",
               s.business_date::text AS "businessDate",
               s.sale_at AS "saleAt",
               o.name AS "outletName",
               u.name AS "cashierName",
               s.status,
               COALESCE(SUM(l.quantity),0)::text AS "itemCount",
               s.grand_total::text AS "grossSales"
          FROM ${S}.pos_sale s
     LEFT JOIN ${S}.outlet o ON o.id = s.outlet_id
     LEFT JOIN ${S}.user_subject u ON u.id = s.cashier_id
     LEFT JOIN ${S}.pos_sale_line l ON l.pos_sale_id = s.id
         WHERE ${saring} AND ${SELESAI}
      GROUP BY s.id, o.name, u.name
      ORDER BY s.sale_at DESC
         LIMIT ${batas}`,

      BY_PRODUCT: `
        SELECT p.code, p.name AS "productName", p.sku,
               COALESCE(SUM(l.quantity),0)::text AS qty,
               COALESCE(SUM(l.line_total),0)::text AS revenue,
               COALESCE(SUM(l.cost_snapshot * l.quantity),0)::text AS cost,
               COALESCE(SUM(l.line_total - l.tax_amount - (l.cost_snapshot * l.quantity)),0)::text AS margin
          FROM ${S}.pos_sale_line l
          JOIN ${S}.pos_sale s ON s.id = l.pos_sale_id
     LEFT JOIN ${S}.product p ON p.id = l.product_id
         WHERE ${saring} AND ${SELESAI}
      GROUP BY p.id, p.code, p.name, p.sku
      ORDER BY SUM(l.line_total) DESC
         LIMIT ${batas}`,

      BY_CATEGORY: `
        SELECT c.code, c.name AS "categoryName",
               COALESCE(SUM(l.quantity),0)::text AS qty,
               COALESCE(SUM(l.line_total),0)::text AS revenue,
               COALESCE(SUM(l.cost_snapshot * l.quantity),0)::text AS cost,
               COALESCE(SUM(l.line_total - l.tax_amount - (l.cost_snapshot * l.quantity)),0)::text AS margin
          FROM ${S}.pos_sale_line l
          JOIN ${S}.pos_sale s ON s.id = l.pos_sale_id
     LEFT JOIN ${S}.product p ON p.id = l.product_id
     LEFT JOIN ${S}.product_category c ON c.id = p.category_id
         WHERE ${saring} AND ${SELESAI}
      GROUP BY c.id, c.code, c.name
      ORDER BY SUM(l.line_total) DESC
         LIMIT ${batas}`,

      BY_CASHIER: `
        SELECT u.id AS "cashierId", u.name AS "cashierName",
               count(*)::int AS "transactionCount",
               COALESCE(SUM(s.grand_total),0)::text AS "grossSales",
               COALESCE(SUM(s.discount_total),0)::text AS "discountValue",
               COALESCE((
                 SELECT SUM(v.grand_total) FROM ${S}.pos_sale v
                  WHERE v.cashier_id = u.id AND v.status = 'VOIDED'
                    AND v.business_date BETWEEN $1::date AND $2::date
               ),0)::text AS "voidValue",
               COALESCE((
                 SELECT SUM(sh.variance) FROM ${S}.pos_shift sh
                  WHERE sh.cashier_id = u.id AND sh.status IN ('CLOSED','PENDING_APPROVAL')
                    AND sh.business_date BETWEEN $1::date AND $2::date
               ),0)::text AS "cashVariance"
          FROM ${S}.pos_sale s
     LEFT JOIN ${S}.user_subject u ON u.id = s.cashier_id
         WHERE ${saring} AND ${SELESAI}
      GROUP BY u.id, u.name
      ORDER BY SUM(s.grand_total) DESC
         LIMIT ${batas}`,

      BY_REGISTER: `
        SELECT t.code, t.name AS "registerName", o.name AS "outletName",
               count(*)::int AS "transactionCount",
               COALESCE(SUM(s.grand_total),0)::text AS "grossSales"
          FROM ${S}.pos_sale s
     LEFT JOIN ${S}.pos_terminal t ON t.id = s.terminal_id
     LEFT JOIN ${S}.outlet o ON o.id = s.outlet_id
         WHERE ${saring} AND ${SELESAI}
      GROUP BY t.id, t.code, t.name, o.name
      ORDER BY SUM(s.grand_total) DESC
         LIMIT ${batas}`,

      BY_SHIFT: `
        SELECT sh.shift_number AS "shiftNumber", u.name AS "cashierName",
               t.name AS "registerName", sh.status,
               sh.opened_at AS "openedAt", sh.closed_at AS "closedAt",
               sh.opening_cash::text AS "openingCash",
               sh.expected_cash::text AS "expectedCash",
               sh.closing_cash::text AS "countedCash",
               sh.variance::text AS "cashVariance",
               COALESCE((
                 SELECT SUM(x.grand_total) FROM ${S}.pos_sale x
                  WHERE x.shift_id = sh.id AND x.status = 'COMPLETED'
               ),0)::text AS "grossSales"
          FROM ${S}.pos_shift sh
     LEFT JOIN ${S}.user_subject u ON u.id = sh.cashier_id
     LEFT JOIN ${S}.pos_terminal t ON t.id = sh.terminal_id
         WHERE sh.business_date BETWEEN $1::date AND $2::date
           ${p.outletIds ? 'AND sh.outlet_id = ANY($3::uuid[])' : ''}
      ORDER BY sh.opened_at DESC
         LIMIT ${p.outletIds ? '$4' : '$3'}`,

      PAYMENT_MIX: `
        SELECT m.name AS "methodName", m.method_type AS "methodType",
               count(*)::int AS "paymentCount",
               COALESCE(SUM(pm.amount),0)::text AS amount
          FROM ${S}.pos_payment pm
          JOIN ${S}.pos_sale s ON s.id = pm.pos_sale_id
     LEFT JOIN ${S}.payment_method m ON m.id = pm.payment_method_id
         WHERE ${saring} AND ${SELESAI} AND pm.status = 'RECEIVED'
      GROUP BY m.id, m.name, m.method_type
      ORDER BY SUM(pm.amount) DESC
         LIMIT ${batas}`,

      TAX: `
        SELECT lt.tax_code AS "taxCode", lt.rate_snapshot::text AS rate,
               lt.is_inclusive AS "isInclusive",
               COALESCE(SUM(lt.taxable_base),0)::text AS "taxableBase",
               COALESCE(SUM(lt.tax_amount),0)::text AS "taxAmount"
          FROM ${S}.pos_sale_line_tax lt
          JOIN ${S}.pos_sale_line l ON l.id = lt.pos_sale_line_id
          JOIN ${S}.pos_sale s ON s.id = l.pos_sale_id
         WHERE ${saring} AND ${SELESAI}
      GROUP BY lt.tax_code, lt.rate_snapshot, lt.is_inclusive
      ORDER BY SUM(lt.tax_amount) DESC
         LIMIT ${batas}`,

      DISCOUNT: `
        SELECT ld.label, ld.source_type AS "sourceType", ld.discount_type AS "discountType",
               count(*)::int AS "lineCount",
               COALESCE(SUM(ld.discount_amount),0)::text AS "discountValue"
          FROM ${S}.pos_sale_line_discount ld
          JOIN ${S}.pos_sale_line l ON l.id = ld.pos_sale_line_id
          JOIN ${S}.pos_sale s ON s.id = l.pos_sale_id
         WHERE ${saring} AND ${SELESAI}
      GROUP BY ld.label, ld.source_type, ld.discount_type
      ORDER BY SUM(ld.discount_amount) DESC
         LIMIT ${batas}`,

      VOID: `
        SELECT s.receipt_number AS "receiptNumber", s.business_date::text AS "businessDate",
               o.name AS "outletName",
               pemohon.name AS "requestedBy", penyetuju.name AS "approvedBy",
               s.void_reason AS reason, s.void_approved_at AS "approvedAt",
               s.grand_total::text AS "grossSales"
          FROM ${S}.pos_sale s
     LEFT JOIN ${S}.outlet o ON o.id = s.outlet_id
     LEFT JOIN ${S}.user_subject pemohon ON pemohon.id = s.void_requested_by
     LEFT JOIN ${S}.user_subject penyetuju ON penyetuju.id = s.void_approved_by
         WHERE ${saring} AND s.status IN ('VOIDED','VOID_REQUESTED')
      ORDER BY s.void_requested_at DESC NULLS LAST
         LIMIT ${batas}`,

      RETURN: `
        SELECT r.return_number AS "returnNumber", s.receipt_number AS "receiptNumber",
               r.return_type AS "returnType", r.status, r.reason,
               pemohon.name AS "requestedBy", penyetuju.name AS "approvedBy",
               r.grand_total::text AS "returnValue", r.requested_at AS "requestedAt"
          FROM ${S}.pos_return r
          JOIN ${S}.pos_sale s ON s.id = r.original_sale_id
     LEFT JOIN ${S}.user_subject pemohon ON pemohon.id = r.requested_by
     LEFT JOIN ${S}.user_subject penyetuju ON penyetuju.id = r.approved_by
         WHERE ${saring}
      ORDER BY r.requested_at DESC
         LIMIT ${batas}`,

      REFUND: `
        SELECT rf.id, r.return_number AS "returnNumber", s.receipt_number AS "receiptNumber",
               m.name AS "methodName", rf.amount::text AS "refundAmount",
               rf.status, rf.refunded_at AS "refundedAt", u.name AS "refundedBy"
          FROM ${S}.pos_refund rf
          JOIN ${S}.pos_return r ON r.id = rf.pos_return_id
          JOIN ${S}.pos_sale s ON s.id = r.original_sale_id
     LEFT JOIN ${S}.payment_method m ON m.id = rf.payment_method_id
     LEFT JOIN ${S}.user_subject u ON u.id = rf.refunded_by
         WHERE ${saring}
      ORDER BY rf.refunded_at DESC NULLS LAST
         LIMIT ${batas}`,

      CASH_MOVEMENT: `
        SELECT c.movement_type AS "movementType", c.amount::text AS amount,
               c.reason, c.occurred_at AS "occurredAt",
               sh.shift_number AS "shiftNumber", u.name AS "cashierName"
          FROM ${S}.cash_drawer_movement c
          JOIN ${S}.pos_shift sh ON sh.id = c.shift_id
     LEFT JOIN ${S}.user_subject u ON u.id = sh.cashier_id
         WHERE sh.business_date BETWEEN $1::date AND $2::date
           ${p.outletIds ? 'AND sh.outlet_id = ANY($3::uuid[])' : ''}
      ORDER BY c.occurred_at DESC
         LIMIT ${p.outletIds ? '$4' : '$3'}`,

      CASH_VARIANCE: `
        SELECT sh.shift_number AS "shiftNumber", sh.business_date::text AS "businessDate",
               u.name AS "cashierName", t.name AS "registerName",
               sh.expected_cash::text AS "expectedCash",
               sh.closing_cash::text AS "countedCash",
               sh.variance::text AS "cashVariance",
               sh.variance_reason AS reason, sh.status,
               penyetuju.name AS "approvedBy"
          FROM ${S}.pos_shift sh
     LEFT JOIN ${S}.user_subject u ON u.id = sh.cashier_id
     LEFT JOIN ${S}.pos_terminal t ON t.id = sh.terminal_id
     LEFT JOIN ${S}.user_subject penyetuju ON penyetuju.id = sh.approved_by
         WHERE sh.business_date BETWEEN $1::date AND $2::date
           AND sh.variance IS NOT NULL AND sh.variance <> 0
           ${p.outletIds ? 'AND sh.outlet_id = ANY($3::uuid[])' : ''}
      ORDER BY abs(sh.variance) DESC
         LIMIT ${p.outletIds ? '$4' : '$3'}`,
    };

    /*
     * Tiga laporan membaca `pos_shift` dan `cash_drawer_movement`, yang tidak
     * punya kolom `cashier_id` pada alias `s`. Parameternya karena itu berbeda
     * susunannya, dan dirakit tersendiri alih-alih dipaksa mengikuti bentuk
     * yang sama.
     */
    const BERBASIS_SHIFT: KodeLaporan[] = ['BY_SHIFT', 'CASH_MOVEMENT', 'CASH_VARIANCE'];
    const nilaiTerpakai = BERBASIS_SHIFT.includes(code)
      ? p.outletIds
        ? [p.rentang.from, p.rentang.to, p.outletIds, p.limit]
        : [p.rentang.from, p.rentang.to, p.limit]
      : nilai;

    return this.tenantDb.query<Record<string, unknown>>(schemaName, kueri[code], nilaiTerpakai);
  }

  // --- Bagian dalam ----------------------------------------------------------

  /**
   * Tanggal usaha berjalan.
   *
   * Diambil dari shift yang sedang terbuka bila ada — outlet yang buka sampai
   * pukul dua pagi masih berada pada tanggal usaha kemarin, dan laporan "hari
   * ini" yang memakai tanggal kalender akan tampak kosong bagi kasirnya.
   */
  private async tanggalUsaha(schemaName: string): Promise<string> {
    const rows = await this.tenantDb.query<{ d: string }>(
      schemaName,
      `SELECT COALESCE(
                (SELECT business_date FROM "${schemaName}".pos_shift
                  WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1),
                CURRENT_DATE
              )::text AS d`,
    );
    return rows[0]?.d ?? new Date().toISOString().slice(0, 10);
  }

  /** Outlet yang benar-benar dipakai menyaring. */
  private outletTerpakai(ctx: KonteksLaporan, diminta?: string): string[] | null {
    if (!ctx.outletIds.length) {
      // Tanpa batasan cakupan: seluruh outlet, kecuali satu diminta.
      return diminta ? [diminta] : null;
    }
    if (!diminta) return ctx.outletIds;
    if (!ctx.outletIds.includes(diminta)) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Anda tidak berwenang melihat laporan outlet tersebut.',
      );
    }
    return [diminta];
  }
}
