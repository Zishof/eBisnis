/**
 * Rate plan dan kalender harga/restriksi (MI-10). Pola query sama dengan
 * `hospitality-room-block.service.ts` untuk perentangan tanggal dan upsert
 * per malam.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanHargaKalender,
  MasukanRatePlan,
  MasukanRentangTanggal,
  daftarMalam,
  validasiHargaKalender,
  validasiRatePlan,
  validasiRentangTanggal,
} from './hospitality-rate';

export interface BarisRatePlan {
  id: string;
  room_type_id: string;
  code: string;
  nama: string;
  deskripsi: string | null;
  is_refundable: boolean;
  extra_person_amount: string;
  default_min_los: number;
  default_max_los: number | null;
  status: string;
}

export interface BarisKalender {
  id: string;
  rate_plan_id: string;
  stay_date: string;
  amount: string;
  min_los: number | null;
  max_los: number | null;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  stop_sell: boolean;
  status: string;
}

/** Kutipan harga+restriksi rate plan untuk satu rentang menginap (dipakai MI-9). */
export interface KutipanRatePlan {
  rate_plan_id: string;
  code: string;
  nama: string;
  is_refundable: boolean;
  total: number;
  per_malam: Array<{ tanggal: string; amount: number }>;
}

const KOLOM_RATE_PLAN = `id::text, room_type_id::text, code, name AS nama, description AS deskripsi,
  is_refundable, extra_person_amount::text, default_min_los, default_max_los, status`;
const KOLOM_KALENDER = `id::text, rate_plan_id::text, stay_date::text, amount::text, min_los, max_los,
  closed_to_arrival, closed_to_departure, stop_sell, status`;

@Injectable()
export class HospitalityRateService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftarRatePlan(schemaName: string, roomTypeId: string): Promise<BarisRatePlan[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisRatePlan>(
      schemaName,
      `SELECT ${KOLOM_RATE_PLAN} FROM ${S}.hospitality_rate_plan
        WHERE room_type_id = $1 AND deleted_at IS NULL
        ORDER BY sort_order ASC, name ASC`,
      [roomTypeId],
    );
  }

  async catatRatePlan(
    schemaName: string,
    roomTypeId: string,
    masukan: MasukanRatePlan,
    createdBy: string,
  ): Promise<BarisRatePlan> {
    const galat = validasiRatePlan(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const roomType = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.hospitality_room_type WHERE id = $1 AND deleted_at IS NULL`,
      [roomTypeId],
    );
    if (!roomType) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tipe kamar tidak ditemukan.');
    }
    try {
      const rows = await this.tenantDb.query<BarisRatePlan>(
        schemaName,
        `INSERT INTO ${S}.hospitality_rate_plan
           (room_type_id, code, name, description, is_refundable, extra_person_amount,
            default_min_los, default_max_los, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING ${KOLOM_RATE_PLAN}`,
        [
          roomTypeId,
          masukan.code!.trim(),
          masukan.nama!.trim(),
          bersihkan(masukan.deskripsi),
          masukan.isRefundable ?? true,
          masukan.extraPersonAmount ?? 0,
          masukan.defaultMinLos ?? 1,
          masukan.defaultMaxLos ?? null,
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_hospitality_rate_plan_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode rate plan "${masukan.code}" sudah ada pada tipe kamar ini.`);
      }
      throw error;
    }
  }

  async daftarKalender(
    schemaName: string,
    ratePlanId: string,
    rentang: MasukanRentangTanggal,
  ): Promise<BarisKalender[]> {
    const galat = validasiRentangTanggal(rentang);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisKalender>(
      schemaName,
      `SELECT ${KOLOM_KALENDER} FROM ${S}.hospitality_rate_calendar
        WHERE rate_plan_id = $1 AND deleted_at IS NULL
          AND stay_date >= $2 AND stay_date < $3
        ORDER BY stay_date ASC`,
      [ratePlanId, rentang.checkin, rentang.checkout],
    );
  }

  /**
   * Menyusun harga+restriksi untuk rentang [checkin, checkout).
   *
   * Baris BARU dibuat berstatus DRAFT (tersembunyi dari booking engine
   * publik sampai diterbitkan). Baris yang SUDAH ADA mempertahankan
   * status yang sedang dipegangnya -- mengubah harga tanggal yang sudah
   * PUBLISHED berlaku seketika (revenue manager sering menyesuaikan
   * harga langsung), sedangkan tanggal yang belum pernah disentuh tetap
   * perlu diterbitkan secara sengaja. Publish karena itu adalah gerbang
   * untuk tanggal BARU, bukan persetujuan ulang setiap kali harga
   * diedit.
   */
  async aturHargaKalender(
    schemaName: string,
    ratePlanId: string,
    masukan: MasukanHargaKalender,
    actorUserId: string,
  ): Promise<BarisKalender[]> {
    const galat = validasiHargaKalender(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const ratePlan = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.hospitality_rate_plan WHERE id = $1 AND deleted_at IS NULL`,
      [ratePlanId],
    );
    if (!ratePlan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Rate plan tidak ditemukan.');
    }

    const malam = daftarMalam(masukan.checkin!, masukan.checkout!);
    return this.tenantDb.transaction(schemaName, async (client) => {
      const hasil: BarisKalender[] = [];
      for (const tanggal of malam) {
        const { rows } = await client.query<BarisKalender>(
          `INSERT INTO ${S}.hospitality_rate_calendar
             (rate_plan_id, stay_date, amount, min_los, max_los,
              closed_to_arrival, closed_to_departure, stop_sell, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
           ON CONFLICT (rate_plan_id, stay_date) WHERE deleted_at IS NULL
           DO UPDATE SET amount = EXCLUDED.amount, min_los = EXCLUDED.min_los,
                         max_los = EXCLUDED.max_los, closed_to_arrival = EXCLUDED.closed_to_arrival,
                         closed_to_departure = EXCLUDED.closed_to_departure, stop_sell = EXCLUDED.stop_sell,
                         updated_at = now(), updated_by = EXCLUDED.updated_by,
                         version = ${S}.hospitality_rate_calendar.version + 1
           RETURNING ${KOLOM_KALENDER}`,
          [
            ratePlanId,
            tanggal,
            masukan.amount,
            masukan.minLos ?? null,
            masukan.maxLos ?? null,
            masukan.closedToArrival ?? false,
            masukan.closedToDeparture ?? false,
            masukan.stopSell ?? false,
            actorUserId,
          ],
        );
        hasil.push(rows[0]);
      }
      return hasil;
    });
  }

  async terbitkan(schemaName: string, ratePlanId: string, rentang: MasukanRentangTanggal, actorUserId: string) {
    return this.ubahStatusKalender(schemaName, ratePlanId, rentang, 'PUBLISHED', actorUserId);
  }

  async tarik(schemaName: string, ratePlanId: string, rentang: MasukanRentangTanggal, actorUserId: string) {
    return this.ubahStatusKalender(schemaName, ratePlanId, rentang, 'DRAFT', actorUserId);
  }

  private async ubahStatusKalender(
    schemaName: string,
    ratePlanId: string,
    rentang: MasukanRentangTanggal,
    status: 'DRAFT' | 'PUBLISHED',
    actorUserId: string,
  ): Promise<{ jumlah: number }> {
    const galat = validasiRentangTanggal(rentang);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE ${S}.hospitality_rate_calendar
          SET status = $4::varchar, updated_at = now(), updated_by = $5, version = version + 1
        WHERE rate_plan_id = $1 AND stay_date >= $2 AND stay_date < $3 AND deleted_at IS NULL
        RETURNING id`,
      [ratePlanId, rentang.checkin, rentang.checkout, status, actorUserId],
    );
    return { jumlah: rows.length };
  }

  /**
   * Kutipan rate plan PUBLISHED untuk sebuah tipe kamar dan rentang
   * menginap -- dipakai booking engine publik (MI-9) menggantikan
   * `published_rate_amount` bila rate plan tersedia.
   *
   * Rate plan hanya ditawarkan bila SELURUH malam pada rentang punya
   * baris kalender PUBLISHED (bukan sebagian) -- kutipan yang hilang
   * satu malam berarti harga untuk malam itu tidak diketahui, dan
   * menawarkan harga yang tidak lengkap lebih berbahaya daripada tidak
   * menawarkan sama sekali. CTA diperiksa pada malam pertama, CTD pada
   * malam TERAKHIR (checkout - 1 hari) -- tamu berangkat SESUDAH malam
   * itu, bukan pada tanggal checkout itu sendiri yang tidak punya baris
   * kalender.
   */
  async kutipanTersedia(
    schemaName: string,
    roomTypeId: string,
    checkin: string,
    checkout: string,
  ): Promise<KutipanRatePlan[]> {
    const S = `"${schemaName}"`;
    const malam = daftarMalam(checkin, checkout);
    const ratePlans = await this.tenantDb.query<BarisRatePlan>(
      schemaName,
      `SELECT ${KOLOM_RATE_PLAN} FROM ${S}.hospitality_rate_plan
        WHERE room_type_id = $1 AND deleted_at IS NULL AND status = 'ACTIVE'`,
      [roomTypeId],
    );

    const hasil: KutipanRatePlan[] = [];
    for (const rp of ratePlans) {
      const kalender = await this.tenantDb.query<BarisKalender>(
        schemaName,
        `SELECT ${KOLOM_KALENDER} FROM ${S}.hospitality_rate_calendar
          WHERE rate_plan_id = $1 AND deleted_at IS NULL AND status = 'PUBLISHED'
            AND stay_date >= $2 AND stay_date < $3
          ORDER BY stay_date ASC`,
        [rp.id, checkin, checkout],
      );
      if (kalender.length !== malam.length) continue; // cakupan tidak lengkap
      if (kalender.some((k) => k.stop_sell)) continue;

      const malamPertama = kalender[0];
      const malamTerakhir = kalender[kalender.length - 1];
      if (malamPertama.closed_to_arrival) continue;
      if (malamTerakhir.closed_to_departure) continue;

      const minLos = malamPertama.min_los ?? rp.default_min_los;
      const maxLos = malamPertama.max_los ?? rp.default_max_los;
      if (malam.length < minLos) continue;
      if (maxLos !== null && malam.length > maxLos) continue;

      hasil.push({
        rate_plan_id: rp.id,
        code: rp.code,
        nama: rp.nama,
        is_refundable: rp.is_refundable,
        total: kalender.reduce((jumlah, k) => jumlah + Number(k.amount), 0),
        per_malam: kalender.map((k) => ({ tanggal: k.stay_date, amount: Number(k.amount) })),
      });
    }
    return hasil;
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
