/**
 * Penutupan shift dan rekonsiliasi kas.
 *
 * Satu aturan menentukan bentuk berkas ini: **kas yang diharapkan dihitung
 * peladen, bukan dilaporkan kasir.** Kasir melaporkan berapa uang yang benar-
 * benar ada di laci; berapa yang seharusnya ada dihitung dari kas awal,
 * penjualan tunai, dan pergerakan kas yang tercatat. Selisihnya adalah selisih
 * sungguhan.
 *
 * Membiarkan kasir melaporkan keduanya berarti membiarkannya melaporkan bahwa
 * tidak ada selisih.
 */

import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';

/**
 * Ambang selisih yang menuntut persetujuan.
 *
 * Selisih kecil adalah kenyataan sehari-hari — uang receh yang kurang, pembeli
 * yang menolak kembalian. Menuntut persetujuan supervisor untuk setiap rupiah
 * akan membuat persetujuan itu diberikan tanpa dibaca, dan persetujuan yang
 * diberikan tanpa dibaca tidak menjaga apa pun.
 */
export const AMBANG_SELISIH = 50_000;

export interface HasilTutupShift {
  shiftId: string;
  shiftNumber: string;
  openingCash: string;
  cashSales: string;
  cashIn: string;
  cashOut: string;
  expectedCash: string;
  countedCash: string;
  variance: string;
  requiresApproval: boolean;
  status: string;
}

@Injectable()
export class PosShiftService {
  private readonly logger = new Logger(PosShiftService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /** Mencatat kas masuk atau keluar di tengah shift. */
  async gerakanKas(
    schemaName: string,
    shiftId: string,
    input: { movementType: 'CASH_IN' | 'CASH_OUT'; amount: number; reason: string },
    subjectId: string,
  ) {
    if (!input.reason?.trim()) {
      // Uang yang keluar dari laci tanpa alasan tercatat tidak dapat dibedakan
      // dari uang yang hilang.
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Alasan wajib diisi pada setiap pergerakan kas.',
      );
    }
    if (input.amount <= 0) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nilai harus lebih besar dari nol.');
    }

    const shift = await this.shiftTerbuka(schemaName, shiftId);

    await this.tenantDb.transaction(schemaName, async (client) => {
      const movement = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".cash_drawer_movement
           (shift_id, movement_type, amount, reason, source_type, occurred_at, created_by)
         VALUES ($1, $2::varchar, $3, $4, 'MANUAL', now(), $5)
         RETURNING id::text`,
        [shiftId, input.movementType, input.amount, input.reason.trim(), subjectId],
      );
      await client.query(
        `INSERT INTO "${schemaName}".accounting_event
           (event_code, source_type, source_id, source_number, occurred_at, amounts,
            currency_code, status, idempotency_key, created_by)
         VALUES ($1, 'CASH_DRAWER_MOVEMENT', $2::uuid, $3, now(), $4::jsonb,
                 (SELECT COALESCE(value, 'IDR') FROM "${schemaName}".app_setting
                   WHERE key = 'POS_CURRENCY' LIMIT 1),
                 'PENDING', $5, $6::uuid)`,
        [
          input.movementType === 'CASH_IN' ? 'POS_CASH_IN' : 'POS_CASH_OUT',
          movement.rows[0].id,
          shift.shift_number,
          JSON.stringify({ amount: input.amount }),
          `${input.movementType}:CASH_DRAWER_MOVEMENT:${movement.rows[0].id}`,
          subjectId,
        ],
      );
    });

    this.logger.log(
      `Kas ${input.movementType} ${input.amount} pada shift ${shift.shift_number}: ${input.reason}`,
    );
    return this.ringkasanKas(schemaName, shiftId);
  }

  /**
   * Ringkasan kas shift berjalan.
   *
   * Dipakai layar kasir sebelum menutup, supaya kasir dapat melihat berapa yang
   * seharusnya ada sebelum menghitung — bukan sesudah, ketika angka yang
   * terlihat lebih dahulu akan memengaruhi hitungannya.
   */
  async ringkasanKas(schemaName: string, shiftId: string) {
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT s.id, s.shift_number, s.status, s.opening_cash::text,
              COALESCE((
                SELECT SUM(p.amount) FROM "${schemaName}".pos_payment p
                  JOIN "${schemaName}".pos_sale sl ON sl.id = p.pos_sale_id
                  JOIN "${schemaName}".payment_method m ON m.id = p.payment_method_id
                 WHERE sl.shift_id = s.id AND p.status = 'RECEIVED'
                   AND m.method_type = 'CASH' AND sl.status = 'COMPLETED'
              ), 0)::text AS cash_sales,
              COALESCE((
                SELECT SUM(c.amount) FROM "${schemaName}".cash_drawer_movement c
                 WHERE c.shift_id = s.id AND c.movement_type = 'CASH_IN'
              ), 0)::text AS cash_in,
              COALESCE((
                SELECT SUM(c.amount) FROM "${schemaName}".cash_drawer_movement c
                 WHERE c.shift_id = s.id AND c.movement_type = 'CASH_OUT'
              ), 0)::text AS cash_out,
              COALESCE((
                SELECT SUM(p.change_amount) FROM "${schemaName}".pos_payment p
                  JOIN "${schemaName}".pos_sale sl ON sl.id = p.pos_sale_id
                 WHERE sl.shift_id = s.id AND p.status = 'RECEIVED' AND sl.status = 'COMPLETED'
              ), 0)::text AS change_given
         FROM "${schemaName}".pos_shift s WHERE s.id = $1`,
      [shiftId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Shift tidak ditemukan.');
    const r = rows[0];

    /*
     * Kembalian sudah termasuk dalam `change_amount`, dan `amount` pada
     * `pos_payment` adalah nilai yang ditagih — bukan yang diserahkan. Jadi kas
     * yang masuk laci adalah nilai tagihan, dan kembalian tidak perlu dikurangi
     * lagi. Menguranginya dua kali adalah kesalahan yang paling sering terjadi
     * pada perhitungan seperti ini.
     */
    const diharapkan = new Decimal(r.opening_cash)
      .plus(new Decimal(r.cash_sales))
      .plus(new Decimal(r.cash_in))
      .minus(new Decimal(r.cash_out));

    return {
      shiftId,
      shiftNumber: r.shift_number,
      status: r.status,
      openingCash: r.opening_cash,
      cashSales: r.cash_sales,
      cashIn: r.cash_in,
      cashOut: r.cash_out,
      changeGiven: r.change_given,
      expectedCash: diharapkan.toString(),
    };
  }

  /** Menutup shift dengan hasil hitungan fisik. */
  async tutupShift(
    schemaName: string,
    shiftId: string,
    input: { countedCash: number; note?: string; denominations?: Array<{ value: number; qty: number }> },
    user: AuthenticatedUser,
    subjectId: string,
  ): Promise<HasilTutupShift> {
    const shift = await this.shiftTerbuka(schemaName, shiftId);
    if (shift.cashier_id !== subjectId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Shift ini milik kasir lain dan hanya dapat ditutup olehnya atau oleh supervisor.',
      );
    }

    // Transaksi yang belum selesai menahan stok dan belum menghasilkan uang.
    // Menutup shift di atasnya membuat kas yang diharapkan tidak dapat dihitung
    // benar.
    const tertunda = await this.tenantDb.query<{ n: string }>(
      schemaName,
      `SELECT count(*)::text AS n FROM "${schemaName}".pos_sale
        WHERE shift_id = $1 AND status IN ('DRAFT', 'PAYMENT_PENDING', 'PAID')`,
      [shiftId],
    );
    if (Number(tertunda[0]?.n ?? 0) > 0) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Masih ada ${Number(tertunda[0].n)} transaksi yang belum selesai pada shift ini. ` +
          'Selesaikan atau batalkan lebih dahulu.',
      );
    }

    const ringkas = await this.ringkasanKas(schemaName, shiftId);
    const dihitung = new Decimal(input.countedCash);
    const selisih = dihitung.minus(new Decimal(ringkas.expectedCash));
    const perluPersetujuan = selisih.abs().greaterThan(AMBANG_SELISIH);

    return this.tenantDb.transaction(schemaName, async (client) => {
      if (input.denominations?.length) {
        for (const d of input.denominations) {
          await client.query(
            `INSERT INTO "${schemaName}".pos_cash_count
               (shift_id, count_type, denomination, quantity, subtotal, counted_by)
             VALUES ($1, 'CLOSING', $2, $3, $4, $5)`,
            [shiftId, d.value, d.qty, d.value * d.qty, subjectId],
          );
        }
      }

      await client.query(
        `UPDATE "${schemaName}".pos_shift
            SET status = $2::varchar, closed_at = now(), closing_cash = $3,
                expected_cash = $4, variance = $5, closed_by = $6,
                variance_reason = $7, version = version + 1
          WHERE id = $1`,
        [
          shiftId,
          perluPersetujuan ? 'PENDING_APPROVAL' : 'CLOSED',
          dihitung.toString(),
          ringkas.expectedCash,
          selisih.toString(),
          subjectId,
          input.note ?? null,
        ],
      );

      await client.query(
        `UPDATE "${schemaName}".pos_terminal SET register_status = 'READY' WHERE id = $1`,
        [shift.terminal_id],
      );

      // Selisih yang melampaui ambang membentuk peristiwa akuntansi tersendiri.
      // Kas yang hilang tetap uang yang hilang, dan jurnalnya harus menyebutkan
      // terhadap apa selisihnya diukur.
      if (!selisih.isZero()) {
        await client.query(
          `INSERT INTO "${schemaName}".accounting_event
             (event_code, source_type, source_id, source_number, occurred_at, amounts,
              currency_code, status, idempotency_key, created_by)
           VALUES ('POS_CASH_VARIANCE', 'POS_SHIFT', $1, $2, now(), $3,
                   (SELECT COALESCE(value, 'IDR') FROM "${schemaName}".app_setting
                     WHERE key = 'POS_CURRENCY' LIMIT 1),
                   'PENDING', $4, $5)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            shiftId,
            ringkas.shiftNumber,
            JSON.stringify({
              expected: Number(ringkas.expectedCash),
              counted: dihitung.toNumber(),
              variance: selisih.toNumber(),
              shortage: selisih.isNegative() ? selisih.abs().toNumber() : 0,
              overage: selisih.isPositive() ? selisih.toNumber() : 0,
            }),
            `POS_CASH_VARIANCE:POS_SHIFT:${shiftId}`,
            subjectId,
          ],
        );
      }

      this.logger.log(
        `Shift ${ringkas.shiftNumber} ditutup oleh ${subjectId}; selisih ${selisih.toString()}` +
          (perluPersetujuan ? ' — menunggu persetujuan supervisor' : ''),
      );

      return {
        shiftId,
        shiftNumber: ringkas.shiftNumber,
        openingCash: ringkas.openingCash,
        cashSales: ringkas.cashSales,
        cashIn: ringkas.cashIn,
        cashOut: ringkas.cashOut,
        expectedCash: ringkas.expectedCash,
        countedCash: dihitung.toString(),
        variance: selisih.toString(),
        requiresApproval: perluPersetujuan,
        status: perluPersetujuan ? 'PENDING_APPROVAL' : 'CLOSED',
      };
    });
  }

  /** Supervisor menyetujui shift yang selisihnya melampaui ambang. */
  async setujuiShift(schemaName: string, shiftId: string, alasan: string, subjectId: string) {
    const rows = await this.tenantDb.query<{ status: string; closed_by: string | null }>(
      schemaName,
      `SELECT status, closed_by FROM "${schemaName}".pos_shift WHERE id = $1`,
      [shiftId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Shift tidak ditemukan.');
    if (rows[0].status !== 'PENDING_APPROVAL') {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Shift berstatus ${rows[0].status} tidak menunggu persetujuan.`,
      );
    }
    if (rows[0].closed_by && rows[0].closed_by === subjectId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Anda tidak dapat menyetujui selisih kas pada shift yang Anda tutup sendiri.',
      );
    }

    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".pos_shift
          SET status = 'CLOSED', approved_by = $2, approved_at = now(),
              approval_note = $3, version = version + 1
        WHERE id = $1`,
      [shiftId, subjectId, alasan],
    );
    return { shiftId, status: 'CLOSED', approvedBy: subjectId };
  }

  private async shiftTerbuka(schemaName: string, shiftId: string) {
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT id, shift_number, terminal_id, cashier_id, status
         FROM "${schemaName}".pos_shift WHERE id = $1`,
      [shiftId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Shift tidak ditemukan.');
    if (rows[0].status !== 'OPEN') {
      throw AppError.conflict(ErrorCodes.CONFLICT, `Shift sudah berstatus ${rows[0].status}.`);
    }
    return rows[0];
  }
}
