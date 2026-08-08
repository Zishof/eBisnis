/**
 * Pembatalan, retur, dan refund kasir.
 *
 * Tiga aturan menentukan bentuk berkas ini, dan ketiganya soal uang:
 *
 * 1. **Transaksi yang sudah selesai tidak dihapus, melainkan dibalik.** Void
 *    membentuk peristiwa akuntansi pembalik dan mengembalikan stok; barisnya
 *    tetap ada. Transaksi yang lenyap dari riwayat adalah cara termudah
 *    menghilangkan uang tanpa jejak.
 *
 * 2. **Tidak ada yang menyetujui permintaannya sendiri.** Ditegakkan di tiga
 *    lapisan: mesin transisi status, layanan ini, dan constraint basis data
 *    `pos_return_no_self_approval`. Terkesan berlebihan sampai seseorang
 *    menambahkan jalan keempat menuju tabel itu dan lupa memeriksanya.
 *
 * 3. **Barang retur tidak otomatis kembali ke stok jual.** Kasir menyatakan
 *    disposisinya — layak jual, rusak, atau dimusnahkan. Mengembalikan semuanya
 *    ke stok jual adalah cara tercepat membuat catatan stok berbeda dari
 *    kenyataan di rak.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { assertWarehouseNotFrozen } from '../../infrastructure/provisioning/tenant-bootstrap.service';
import { AuthenticatedUser } from '../../common/decorators';
import {
  bolehMenyetujui,
  bolehPindah,
  statusRetur,
  type PosSaleStatus,
} from './pos-sale-state';
import { emberTujuanRetur, type Disposisi } from './pos-stock';

export interface BarisRetur {
  saleLineId: string;
  quantity: number;
  disposition?: Disposisi;
}

@Injectable()
export class PosReturnService {
  private readonly logger = new Logger(PosReturnService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Pembatalan transaksi selesai -----------------------------------------

  /** Mengajukan pembatalan atas transaksi yang sudah selesai. */
  async ajukanVoid(
    schemaName: string,
    saleId: string,
    alasan: string,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    if (!alasan?.trim()) {
      // Pembatalan tanpa alasan tidak dapat ditelusuri kemudian, dan
      // pembatalan yang tidak dapat ditelusuri adalah pembatalan yang tidak
      // dapat dipertanggungjawabkan.
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Alasan pembatalan wajib diisi.',
      );
    }
    const sale = await this.kepala(schemaName, saleId);
    const v = bolehPindah(sale.status as PosSaleStatus, 'VOID_REQUESTED');
    if (!v.allowed) throw AppError.conflict(ErrorCodes.CONFLICT, v.message ?? 'Tidak dapat dibatalkan.');

    await this.tenantDb.transaction(schemaName, async (client) => {
      await client.query(
        `UPDATE "${schemaName}".pos_sale
            SET status = 'VOID_REQUESTED', void_requested_by = $2, void_requested_at = now(),
                void_reason = $3, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [saleId, subjectId, alasan.trim()],
      );
      await this.catat(client, schemaName, saleId, sale.status, 'VOID_REQUESTED', alasan, subjectId, user);
    });

    return { saleId, status: 'VOID_REQUESTED', requestedBy: subjectId };
  }

  /**
   * Menyetujui pembatalan.
   *
   * Membalikkan stok dan membentuk peristiwa akuntansi pembalik — bukan
   * menghapus yang asli.
   */
  async setujuiVoid(
    schemaName: string,
    saleId: string,
    alasan: string,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    const sale = await this.kepala(schemaName, saleId);
    const v = bolehPindah(sale.status as PosSaleStatus, 'VOIDED');
    if (!v.allowed) throw AppError.conflict(ErrorCodes.CONFLICT, v.message ?? 'Tidak dapat disetujui.');

    const sod = bolehMenyetujui(sale.void_requested_by ?? null, subjectId);
    if (!sod.allowed) throw AppError.forbidden(ErrorCodes.FORBIDDEN, sod.message!);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const baris = await client.query<Record<string, string>>(
        `SELECT id, product_id, uom_id, warehouse_id, quantity::text, cost_snapshot::text
           FROM "${schemaName}".pos_sale_line WHERE pos_sale_id = $1`,
        [saleId],
      );

      let nilaiPersediaan = new Decimal(0);
      for (const b of baris.rows) {
        await this.kembalikanStok(client, schemaName, {
          warehouseId: b.warehouse_id ?? sale.warehouse_id,
          productId: b.product_id,
          uomId: b.uom_id,
          quantity: Number(b.quantity),
          unitCost: Number(b.cost_snapshot ?? 0),
          ember: 'AVAILABLE',
          referenceId: saleId,
          referenceNumber: sale.receipt_number,
          idempotencyKey: `POS_VOID:${saleId}:${b.id}`,
          movementType: 'POS_VOID',
          note: 'Pembatalan transaksi kasir',
          userId: subjectId,
        });
        nilaiPersediaan = nilaiPersediaan.plus(
          new Decimal(b.cost_snapshot ?? 0).times(new Decimal(b.quantity)),
        );
      }

      await this.peristiwaPembalik(client, schemaName, {
        saleId,
        receiptNumber: sale.receipt_number,
        currency: sale.currency_code,
        gross: sale.subtotal,
        tax: sale.tax_total,
        discount: sale.discount_total,
        cost: nilaiPersediaan.toString(),
        userId: subjectId,
      });

      await client.query(
        `UPDATE "${schemaName}".pos_sale
            SET status = 'VOIDED', void_approved_by = $2, void_approved_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [saleId, subjectId],
      );
      await this.catat(client, schemaName, saleId, sale.status, 'VOIDED', alasan, subjectId, user);

      return { saleId, status: 'VOIDED', approvedBy: subjectId, linesReversed: baris.rows.length };
    });
  }

  /**
   * Menolak permintaan pembatalan. Transaksi kembali `COMPLETED` — tidak ada
   * stok maupun peristiwa akuntansi yang perlu dibalik, sebab `setujuiVoid`
   * belum pernah menjalankannya untuk permintaan yang ditolak.
   *
   * Tanpa ini, `VOID_REQUESTED` adalah pintu satu arah: satu-satunya jalan
   * keluar bagi permintaan yang keliru adalah menyetujuinya juga.
   * `void_requested_by`/`void_reason` SENGAJA tidak dikosongkan — keduanya
   * tetap menjadi jejak bahwa pembatalan pernah diminta dan alasannya,
   * sedangkan siapa yang menolak dan mengapa tercatat pada
   * `pos_sale_status_history` lewat `catat()` di bawah, sama seperti setiap
   * transisi status lain.
   */
  async tolakVoid(
    schemaName: string,
    saleId: string,
    alasan: string,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    const sale = await this.kepala(schemaName, saleId);
    const v = bolehPindah(sale.status as PosSaleStatus, 'COMPLETED');
    if (!v.allowed) throw AppError.conflict(ErrorCodes.CONFLICT, v.message ?? 'Tidak dapat ditolak.');

    const sod = bolehMenyetujui(sale.void_requested_by ?? null, subjectId);
    if (!sod.allowed) throw AppError.forbidden(ErrorCodes.FORBIDDEN, sod.message!);

    return this.tenantDb.transaction(schemaName, async (client) => {
      await client.query(
        `UPDATE "${schemaName}".pos_sale
            SET status = 'COMPLETED', updated_at = now(), version = version + 1
          WHERE id = $1`,
        [saleId],
      );
      await this.catat(client, schemaName, saleId, sale.status, 'COMPLETED', alasan, subjectId, user);

      return { saleId, status: 'COMPLETED', rejectedBy: subjectId };
    });
  }

  // --- Retur ----------------------------------------------------------------

  /**
   * Mengajukan retur atas sebagian atau seluruh baris.
   *
   * Jumlah yang boleh diretur dibatasi constraint basis data
   * (`pos_sale_line_returned_bounded`), bukan dihitung di sini. Dua retur atas
   * transaksi yang sama yang diproses bersamaan sama-sama membaca sisa yang
   * sama, dan keduanya akan lolos bila hanya layanan yang memeriksa.
   */
  async buatRetur(
    schemaName: string,
    saleId: string,
    input: { lines: BarisRetur[]; reasonCode?: string; reason?: string },
    idempotencyKey: string,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    if (!input.lines?.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Retur tanpa baris tidak berarti apa-apa.');
    }
    const sale = await this.kepala(schemaName, saleId);
    /*
     * Yang menentukan boleh-tidaknya retur adalah "masih ada unit yang belum
     * dikembalikan", bukan sejauh mana refund sebelumnya sudah dibayar.
     *
     * Keduanya sempat tercampur: sesudah retur pertama disetujui, status
     * penjualan menjadi REFUND_PENDING, dan retur kedua atas barang yang masih
     * di tangan pembeli ikut tertolak. Pembeli yang mengembalikan dua barang
     * pada dua hari berbeda adalah keadaan biasa, bukan keadaan yang perlu
     * dilarang.
     *
     * Batas sesungguhnya — tidak melebihi yang dijual — dijaga constraint
     * `pos_sale_line_returned_bounded`.
     */
    const BOLEH_RETUR = [
      'COMPLETED',
      'RETURNED_PARTIAL',
      'REFUND_PENDING',
      'REFUNDED_PARTIAL',
    ];
    if (!BOLEH_RETUR.includes(sale.status)) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Transaksi berstatus ${sale.status} tidak dapat diretur.`,
      );
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const sudah = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".pos_return WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      if (sudah.rows.length) return { returnId: sudah.rows[0].id, duplicate: true };

      const retur = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".pos_return
           (original_sale_id, outlet_id, terminal_id, shift_id, customer_id,
            return_type, reason_code, reason, status, requested_by, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, 'PARTIAL', $6, $7, 'REQUESTED', $8, $9)
         RETURNING id`,
        [
          saleId,
          sale.outlet_id,
          sale.terminal_id,
          sale.shift_id,
          sale.customer_id,
          input.reasonCode ?? null,
          input.reason ?? null,
          subjectId,
          idempotencyKey,
        ],
      );
      const returnId = retur.rows[0].id;

      let subtotal = new Decimal(0);
      let pajak = new Decimal(0);

      for (const l of input.lines) {
        const asli = await client.query<Record<string, string>>(
          `SELECT id, product_id, uom_id, warehouse_id, quantity::text, returned_qty::text,
                  unit_price::text, tax_amount::text, line_total::text, cost_snapshot::text
             FROM "${schemaName}".pos_sale_line
            WHERE id = $1 AND pos_sale_id = $2
            FOR UPDATE`,
          [l.saleLineId, saleId],
        );
        if (!asli.rows.length) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Baris penjualan tidak ditemukan.');
        }
        const a = asli.rows[0];
        const dijual = new Decimal(a.quantity);
        const sudahRetur = new Decimal(a.returned_qty ?? 0);
        const diminta = new Decimal(l.quantity);

        if (diminta.lessThanOrEqualTo(0)) {
          throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Jumlah retur harus lebih dari nol.');
        }
        if (sudahRetur.plus(diminta).greaterThan(dijual)) {
          throw AppError.badRequest(
            ErrorCodes.VALIDATION_FAILED,
            `Sisa yang dapat diretur tinggal ${dijual.minus(sudahRetur)}, diminta ${diminta}.`,
          );
        }

        // Nilai retur dihitung proporsional terhadap baris aslinya, termasuk
        // diskonnya. Memakai harga satuan penuh akan mengembalikan lebih banyak
        // uang daripada yang pernah diterima atas barang itu.
        const porsi = diminta.dividedBy(dijual);
        const nilaiBaris = new Decimal(a.line_total).times(porsi);
        const pajakBaris = new Decimal(a.tax_amount ?? 0).times(porsi);

        await client.query(
          `INSERT INTO "${schemaName}".pos_return_line
             (pos_return_id, original_sale_line_id, product_id, uom_id, quantity,
              unit_price, tax_amount, line_total, disposition, restock_warehouse_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            returnId,
            l.saleLineId,
            a.product_id,
            a.uom_id,
            diminta.toString(),
            a.unit_price,
            pajakBaris.toString(),
            nilaiBaris.toString(),
            l.disposition ?? 'RESTOCK',
            a.warehouse_id,
          ],
        );

        await client.query(
          `UPDATE "${schemaName}".pos_sale_line
              SET returned_qty = returned_qty + $2, version = version + 1
            WHERE id = $1`,
          [l.saleLineId, diminta.toString()],
        );

        subtotal = subtotal.plus(nilaiBaris.minus(pajakBaris));
        pajak = pajak.plus(pajakBaris);
      }

      await client.query(
        `UPDATE "${schemaName}".pos_return
            SET subtotal = $2, tax_total = $3, grand_total = $4,
                return_type = $5::varchar, updated_at = now()
          WHERE id = $1`,
        [
          returnId,
          subtotal.toString(),
          pajak.toString(),
          subtotal.plus(pajak).toString(),
          (await this.seluruhnyaDiretur(client, schemaName, saleId)) ? 'FULL' : 'PARTIAL',
        ],
      );

      const statusBaru = await this.statusReturJual(client, schemaName, saleId);
      await client.query(
        `UPDATE "${schemaName}".pos_sale SET status = $2::varchar, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [saleId, statusBaru],
      );
      await this.catat(
        client,
        schemaName,
        saleId,
        sale.status,
        statusBaru,
        input.reason ?? 'Retur diajukan',
        subjectId,
        user,
      );

      return {
        returnId,
        duplicate: false,
        status: 'REQUESTED',
        grandTotal: subtotal.plus(pajak).toString(),
        saleStatus: statusBaru,
      };
    });
  }

  /**
   * Menyetujui retur: barang kembali sesuai disposisinya, jurnal dibalik,
   * dan refund menjadi terutang.
   */
  async setujuiRetur(
    schemaName: string,
    returnId: string,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    const r = await this.kepalaRetur(schemaName, returnId);
    if (r.status !== 'REQUESTED') {
      throw AppError.conflict(ErrorCodes.CONFLICT, `Retur berstatus ${r.status} tidak dapat disetujui.`);
    }

    const sod = bolehMenyetujui(r.requested_by ?? null, subjectId);
    if (!sod.allowed) throw AppError.forbidden(ErrorCodes.FORBIDDEN, sod.message!);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const baris = await client.query<Record<string, string>>(
        `SELECT rl.id, rl.product_id, rl.uom_id, rl.quantity::text, rl.line_total::text,
                rl.disposition, rl.restock_warehouse_id, sl.cost_snapshot::text
           FROM "${schemaName}".pos_return_line rl
      LEFT JOIN "${schemaName}".pos_sale_line sl ON sl.id = rl.original_sale_line_id
          WHERE rl.pos_return_id = $1`,
        [returnId],
      );

      let nilaiPersediaan = new Decimal(0);
      for (const b of baris.rows) {
        const ember = emberTujuanRetur(b.disposition as Disposisi);
        // Barang yang dimusnahkan tidak kembali ke ember mana pun, tetapi
        // pergerakannya tetap dicatat supaya selisihnya dapat dijelaskan.
        await this.kembalikanStok(client, schemaName, {
          warehouseId: b.restock_warehouse_id,
          productId: b.product_id,
          uomId: b.uom_id,
          quantity: Number(b.quantity),
          unitCost: Number(b.cost_snapshot ?? 0),
          ember,
          referenceId: returnId,
          referenceNumber: r.return_number,
          idempotencyKey: `POS_RETURN:${returnId}:${b.id}`,
          movementType: 'POS_RETURN',
          note: `Retur kasir (${b.disposition})`,
          userId: subjectId,
        });
        if (ember === 'AVAILABLE') {
          nilaiPersediaan = nilaiPersediaan.plus(
            new Decimal(b.cost_snapshot ?? 0).times(new Decimal(b.quantity)),
          );
        }
      }

      await this.peristiwa(client, schemaName, 'POS_RETURN', returnId, r.return_number, {
        returnValue: Number(r.grand_total),
        net: new Decimal(r.grand_total).minus(new Decimal(r.tax_total)).toNumber(),
        tax: Number(r.tax_total),
        inventoryValue: nilaiPersediaan.toNumber(),
      }, r.currency_code ?? 'IDR', subjectId);

      await client.query(
        `UPDATE "${schemaName}".pos_return
            SET status = 'APPROVED', approved_by = $2, approved_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [returnId, subjectId],
      );

      await client.query(
        `UPDATE "${schemaName}".pos_sale SET status = 'REFUND_PENDING',
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [r.original_sale_id],
      );
      await this.catat(
        client,
        schemaName,
        r.original_sale_id,
        null,
        'REFUND_PENDING',
        'Retur disetujui',
        subjectId,
        user,
      );

      return { returnId, status: 'APPROVED', refundDue: r.grand_total };
    });
  }

  /** Membayarkan refund atas retur yang sudah disetujui. */
  async refund(
    schemaName: string,
    returnId: string,
    input: { paymentMethodId?: string; amount: number; reference?: string },
    idempotencyKey: string,
    user: AuthenticatedUser,
    subjectId: string,
  ) {
    /*
     * Idempotensi diperiksa LEBIH DAHULU, sebelum status.
     *
     * Percobaan ulang atas permintaan yang sudah berhasil harus mengembalikan
     * hasil yang sama, bukan galat. Bila status diperiksa lebih dahulu, refund
     * yang sudah dibayar membuat status retur menjadi REFUNDED — dan percobaan
     * ulang yang wajar (jaringan putus sesudah pembayaran tercatat) dijawab
     * "retur belum disetujui". Kasir yang membaca itu akan mengira refundnya
     * gagal, lalu membayar tunai dari laci. Uangnya keluar dua kali.
     *
     * Pelajaran yang sama pernah diambil pada penomoran surat V10-6.
     */
    const sudahDibayar = await this.tenantDb.query<{ id: string; amount: string }>(
      schemaName,
      `SELECT id, amount::text FROM "${schemaName}".pos_refund WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    if (sudahDibayar.length) {
      const total = await this.tenantDb.query<{ total: string }>(
        schemaName,
        `SELECT COALESCE(SUM(amount), 0)::text AS total FROM "${schemaName}".pos_refund
          WHERE pos_return_id = $1 AND status = 'COMPLETED'`,
        [returnId],
      );
      const jual = await this.tenantDb.query<{ status: string }>(
        schemaName,
        `SELECT s.status FROM "${schemaName}".pos_sale s
           JOIN "${schemaName}".pos_return r ON r.original_sale_id = s.id
          WHERE r.id = $1`,
        [returnId],
      );
      return {
        refundId: sudahDibayar[0].id,
        duplicate: true,
        totalRefunded: total[0].total,
        saleStatus: jual[0]?.status ?? null,
      };
    }

    const r = await this.kepalaRetur(schemaName, returnId);
    if (r.status !== 'APPROVED') {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Refund hanya dapat dibayarkan atas retur yang sudah disetujui. Status sekarang ${r.status}.`,
      );
    }

    const sod = bolehMenyetujui(r.requested_by ?? null, subjectId);
    if (!sod.allowed) throw AppError.forbidden(ErrorCodes.FORBIDDEN, sod.message!);

    const terutang = new Decimal(r.grand_total);
    const diminta = new Decimal(input.amount);
    if (diminta.greaterThan(terutang)) {
      // Refund melebihi nilai retur berarti mengembalikan uang yang tidak
      // pernah diterima atas barang itu.
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Refund ${diminta} melebihi nilai retur ${terutang}.`,
      );
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const baru = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".pos_refund
           (pos_return_id, payment_method_id, amount, reference, status, refunded_at,
            refunded_by, idempotency_key)
         VALUES ($1, $2, $3, $4, 'COMPLETED', now(), $5, $6)
         RETURNING id`,
        [
          returnId,
          input.paymentMethodId ?? null,
          diminta.toString(),
          input.reference ?? null,
          subjectId,
          idempotencyKey,
        ],
      );

      const method = input.paymentMethodId
        ? await client.query<{ method_type: string }>(
            `SELECT method_type FROM "${schemaName}".payment_method WHERE id = $1`,
            [input.paymentMethodId],
          )
        : null;
      const cash = !method?.rows[0] || method.rows[0].method_type === 'CASH';
      await this.peristiwa(
        client,
        schemaName,
        'POS_REFUND',
        returnId,
        r.return_number,
        {
          refundAmount: diminta.toNumber(),
          cashAmount: cash ? diminta.toNumber() : 0,
          noncashAmount: cash ? 0 : diminta.toNumber(),
        },
        r.currency_code ?? 'IDR',
        subjectId,
      );

      const total = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total FROM "${schemaName}".pos_refund
          WHERE pos_return_id = $1 AND status = 'COMPLETED'`,
        [returnId],
      );
      const lunas = new Decimal(total.rows[0].total).greaterThanOrEqualTo(terutang);

      await client.query(
        `UPDATE "${schemaName}".pos_return SET status = $2::varchar, updated_at = now(),
                version = version + 1 WHERE id = $1`,
        [returnId, lunas ? 'REFUNDED' : 'PARTIALLY_REFUNDED'],
      );

      const statusJual = lunas
        ? (await this.seluruhnyaDiretur(client, schemaName, r.original_sale_id))
          ? 'REFUNDED_FULL'
          : 'REFUNDED_PARTIAL'
        : 'REFUND_PENDING';
      await client.query(
        `UPDATE "${schemaName}".pos_sale SET status = $2::varchar, updated_at = now(),
                version = version + 1 WHERE id = $1`,
        [r.original_sale_id, statusJual],
      );
      await this.catat(
        client,
        schemaName,
        r.original_sale_id,
        null,
        statusJual,
        'Refund dibayarkan',
        subjectId,
        user,
      );

      return {
        refundId: baru.rows[0].id,
        duplicate: false,
        totalRefunded: total.rows[0].total,
        saleStatus: statusJual,
      };
    });
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async kepala(schemaName: string, saleId: string) {
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT id, status, outlet_id, terminal_id, shift_id, customer_id, warehouse_id,
              receipt_number, currency_code, subtotal::text, discount_total::text,
              grand_total::text, tax_total::text,
              void_requested_by
         FROM "${schemaName}".pos_sale WHERE id = $1`,
      [saleId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transaksi tidak ditemukan.');
    return rows[0];
  }

  private async kepalaRetur(schemaName: string, returnId: string) {
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT r.id, r.status, r.original_sale_id, r.return_number, r.requested_by,
              r.grand_total::text, r.tax_total::text, s.currency_code
         FROM "${schemaName}".pos_return r
         JOIN "${schemaName}".pos_sale s ON s.id = r.original_sale_id
        WHERE r.id = $1`,
      [returnId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Retur tidak ditemukan.');
    return rows[0];
  }

  /**
   * Status retur transaksi menurut jumlah yang sudah dikembalikan.
   *
   * Angkanya dibaca dari basis data lalu diserahkan ke `statusRetur()` — fungsi
   * murni yang sudah diuji tersendiri. Menghitung ulang aturannya di sini akan
   * menghasilkan dua tempat yang menentukan hal yang sama, dan pengujiannya
   * hanya menjaga salah satunya.
   */
  private async statusReturJual(
    client: PoolClient,
    schemaName: string,
    saleId: string,
  ): Promise<PosSaleStatus> {
    const r = await client.query<{ dijual: string; diretur: string }>(
      `SELECT COALESCE(SUM(quantity), 0)::text AS dijual,
              COALESCE(SUM(returned_qty), 0)::text AS diretur
         FROM "${schemaName}".pos_sale_line WHERE pos_sale_id = $1`,
      [saleId],
    );
    return statusRetur(Number(r.rows[0].dijual), Number(r.rows[0].diretur));
  }

  private async seluruhnyaDiretur(client: PoolClient, schemaName: string, saleId: string) {
    return (await this.statusReturJual(client, schemaName, saleId)) === 'RETURNED_FULL';
  }

  /** Mengembalikan barang ke ember yang sesuai, dan mencatat pergerakannya. */
  private async kembalikanStok(
    client: PoolClient,
    schemaName: string,
    ctx: {
      warehouseId: string | null;
      productId: string;
      uomId: string | null;
      quantity: number;
      unitCost: number;
      ember: string | null;
      referenceId: string;
      referenceNumber: string | null;
      idempotencyKey: string;
      movementType: string;
      note: string;
      userId: string;
    },
  ) {
    const sudah = await client.query<{ id: string }>(
      `SELECT id FROM "${schemaName}".stock_movement WHERE idempotency_key = $1`,
      [ctx.idempotencyKey],
    );
    if (sudah.rows.length) return;

    if (ctx.warehouseId) {
      await assertWarehouseNotFrozen(client, `"${schemaName}"`, ctx.warehouseId);
    }

    if (ctx.warehouseId && ctx.ember) {
      const kolom = ctx.ember === 'DAMAGED' ? 'damaged_qty' : 'on_hand_qty';
      await client.query(
        `UPDATE "${schemaName}".stock_balance
            SET ${kolom} = ${kolom} + $3,
                available_qty = CASE WHEN $4::boolean
                                     THEN (on_hand_qty + $3) - reserved_qty
                                     ELSE available_qty END,
                last_movement_at = now(), updated_at = now(), version = version + 1
          WHERE warehouse_id = $1 AND product_id = $2 AND lot_id IS NULL`,
        [ctx.warehouseId, ctx.productId, ctx.quantity, ctx.ember === 'AVAILABLE'],
      );
    }

    await client.query(
      `INSERT INTO "${schemaName}".stock_movement
         (movement_number, movement_type, product_id, uom_id, quantity, unit_cost,
          destination_warehouse_id, bucket_from, bucket_to,
          reference_type, reference_id, reference_number, posting_key, idempotency_key,
          occurred_at, created_by, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'SOLD', $8, $9, $10, $11, $12, $12, now(), $13, $14)`,
      [
        `${ctx.movementType}-${ctx.referenceId.slice(0, 8)}-${ctx.idempotencyKey.slice(-8)}`,
        ctx.movementType,
        ctx.productId,
        ctx.uomId,
        ctx.quantity,
        ctx.unitCost,
        ctx.warehouseId,
        ctx.ember ?? 'DISPOSED',
        ctx.movementType,
        ctx.referenceId,
        ctx.referenceNumber,
        ctx.idempotencyKey,
        ctx.userId,
        ctx.note,
      ],
    );
  }

  private async peristiwaPembalik(
    client: PoolClient,
    schemaName: string,
    ctx: {
      saleId: string;
      receiptNumber: string | null;
      currency: string | null;
      gross: string;
      tax: string;
      discount: string;
      cost: string;
      userId: string;
    },
  ) {
    const paymentTotals = await client.query<{ cash: string; noncash: string }>(
      `SELECT
          COALESCE(SUM(p.amount) FILTER (WHERE pm.method_type = 'CASH'), 0)::text AS cash,
          COALESCE(SUM(p.amount) FILTER (WHERE pm.method_type <> 'CASH'), 0)::text AS noncash
         FROM "${schemaName}".pos_payment p
         JOIN "${schemaName}".payment_method pm ON pm.id = p.payment_method_id
        WHERE p.pos_sale_id = $1 AND p.status IN ('RECEIVED', 'REVERSED')`,
      [ctx.saleId],
    );
    await this.peristiwa(
      client,
      schemaName,
      'POS_SALE_VOID',
      ctx.saleId,
      ctx.receiptNumber,
      {
        gross: Number(ctx.gross),
        tax: Number(ctx.tax),
        discountAmount: Number(ctx.discount),
      },
      ctx.currency ?? 'IDR',
      ctx.userId,
      'VOID',
    );
    const cash = Number(paymentTotals.rows[0]?.cash ?? 0);
    const noncash = Number(paymentTotals.rows[0]?.noncash ?? 0);
    if (cash > 0) {
      await this.peristiwa(client, schemaName, 'POS_CASH_RECEIPT_VOID', ctx.saleId,
        ctx.receiptNumber, { amount: cash }, ctx.currency ?? 'IDR', ctx.userId, 'VOID');
    }
    if (noncash > 0) {
      await this.peristiwa(client, schemaName, 'POS_NONCASH_RECEIPT_VOID', ctx.saleId,
        ctx.receiptNumber, { amount: noncash }, ctx.currency ?? 'IDR', ctx.userId, 'VOID');
    }
    if (Number(ctx.cost) > 0) {
      await this.peristiwa(
        client,
        schemaName,
        'POS_COGS_VOID',
        ctx.saleId,
        ctx.receiptNumber,
        { cost: Number(ctx.cost) },
        ctx.currency ?? 'IDR',
        ctx.userId,
        'VOID',
      );
    }
  }

  private async peristiwa(
    client: PoolClient,
    schemaName: string,
    kode: string,
    sourceId: string,
    sourceNumber: string | null,
    nilai: Record<string, number>,
    currency: string,
    userId: string,
    imbuhan = '',
  ) {
    await client.query(
      `INSERT INTO "${schemaName}".accounting_event
         (event_code, source_type, source_id, source_number, occurred_at, amounts,
          currency_code, status, idempotency_key, created_by)
       VALUES ($1, 'POS_SALE', $2, $3, now(), $4, $5, 'PENDING', $6, $7)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        kode,
        sourceId,
        sourceNumber,
        JSON.stringify(nilai),
        currency,
        `${kode}${imbuhan ? `:${imbuhan}` : ''}:POS_SALE:${sourceId}`,
        userId,
      ],
    );
  }

  private async catat(
    client: PoolClient,
    schemaName: string,
    saleId: string,
    dari: string | null,
    ke: string,
    alasan: string,
    subjectId: string,
    user: AuthenticatedUser,
  ) {
    await client.query(
      `INSERT INTO "${schemaName}".pos_sale_status_history
         (pos_sale_id, from_status, to_status, reason, actor_user_id, active_role_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [saleId, dari, ke, alasan, subjectId, user.activeRoleId ?? null],
    );
  }
}
