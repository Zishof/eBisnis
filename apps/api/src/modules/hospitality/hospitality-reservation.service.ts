/**
 * Reservasi dan siklus hidupnya (MI-8). Pola query sama dengan
 * `hospitality-properti.service.ts`; idempotensi mengikuti pola
 * `pos-sale.service.ts` (baca dalam transaksi yang sama, bukan
 * `IdempotencyService` platform yang belum dipakai modul manapun).
 */

import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanBatalkan,
  MasukanReservasi,
  StatusReservasi,
  transisiDiizinkan,
  validasiBatalkan,
  validasiReservasi,
} from './hospitality-reservation';

export interface BarisRoomStay {
  id: string;
  reservation_id: string;
  room_type_id: string;
  room_id: string | null;
  guest_id: string | null;
  checkin_date: string;
  checkout_date: string;
  adults: number;
  children: number;
  rate_amount: string;
  rate_snapshot: Record<string, unknown>;
  restriction_snapshot: Record<string, unknown> | null;
}

export interface BarisReservasi {
  id: string;
  code: string;
  property_id: string;
  guest_id: string;
  status: string;
  source: string;
  market_segment: string | null;
  special_requests: string | null;
  cancel_reason: string | null;
  version: number;
  created_at: string;
}

export interface DetailReservasi extends BarisReservasi {
  room_stays: BarisRoomStay[];
}

const KOLOM_RESERVASI = `id::text, code, property_id::text, guest_id::text, status, source,
  market_segment, special_requests, cancel_reason, version, created_at::text`;
const KOLOM_ROOM_STAY = `id::text, reservation_id::text, room_type_id::text, room_id::text,
  guest_id::text, checkin_date::text, checkout_date::text, adults, children,
  rate_amount::text, rate_snapshot, restriction_snapshot`;

@Injectable()
export class HospitalityReservationService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftarReservasi(
    schemaName: string,
    opsi: { propertyId?: string; status?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisReservasi[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.propertyId) {
      params.push(opsi.propertyId);
      kondisi.push(`property_id = $${params.length}`);
    }
    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.hospitality_reservation WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisReservasi>(
      schemaName,
      `SELECT ${KOLOM_RESERVASI} FROM ${S}.hospitality_reservation
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async detailReservasi(schemaName: string, id: string): Promise<DetailReservasi> {
    const S = `"${schemaName}"`;
    const reservasi = await this.tenantDb.queryOne<BarisReservasi>(
      schemaName,
      `SELECT ${KOLOM_RESERVASI} FROM ${S}.hospitality_reservation WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!reservasi) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Reservasi tidak ditemukan.');
    }
    const roomStays = await this.tenantDb.query<BarisRoomStay>(
      schemaName,
      `SELECT ${KOLOM_ROOM_STAY} FROM ${S}.hospitality_reservation_room_stay
        WHERE reservation_id = $1 AND deleted_at IS NULL
        ORDER BY checkin_date ASC`,
      [id],
    );
    return { ...reservasi, room_stays: roomStays };
  }

  /**
   * Mencatat reservasi baru beserta seluruh kamarnya, satu transaksi.
   *
   * ## Idempotensi
   *
   * Kunci dari tajuk HTTP `Idempotency-Key` diperiksa DI DALAM transaksi
   * yang sama dengan penulisan (pola `pos-sale.service.ts`) -- klik ganda
   * pada layar yang lambat, atau permintaan booking engine yang diulang
   * setelah koneksi lambat, mengembalikan reservasi yang SAMA, bukan
   * membuat yang kedua.
   *
   * ## Kondisi pacu -- kapasitas tipe kamar
   *
   * Untuk SETIAP tipe kamar yang diminta, baris `hospitality_room_type`
   * dikunci (`SELECT ... FOR UPDATE`) sebelum kapasitas dihitung dan
   * baris `room_stay` ditulis -- permintaan bersamaan untuk tipe kamar
   * yang sama diserialkan basis data, sehingga penghitungan "berapa yang
   * sudah terisi" tidak pernah membaca angka yang sudah basi saat
   * permintaan lain menulis di waktu yang sama. Diuji dengan permintaan
   * bersamaan sungguhan (lihat docs/changelog/hospitality.md).
   */
  async catatReservasi(
    schemaName: string,
    masukan: MasukanReservasi,
    idempotencyKey: string | undefined,
    actorUserId: string,
  ): Promise<{ reservasi: DetailReservasi; diulang: boolean }> {
    const galat = validasiReservasi(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    const S = `"${schemaName}"`;
    const guest = await this.tenantDb.queryOne<{ id: string; do_not_rent: boolean }>(
      schemaName,
      `SELECT id, do_not_rent FROM ${S}.hospitality_guest WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.guestId],
    );
    if (!guest) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tamu tidak ditemukan.');
    }
    // Menghubungkan MI-7 dan MI-8: larangan menginap benar-benar mencegah
    // reservasi baru, bukan hanya penanda yang tidak pernah diperiksa.
    if (guest.do_not_rent) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Tamu ini berstatus do-not-rent dan tidak dapat dibuatkan reservasi baru.',
      );
    }
    const properti = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id FROM ${S}.hospitality_property WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.propertyId],
    );
    if (!properti) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      if (idempotencyKey) {
        const sudah = await client.query<{ id: string }>(
          `SELECT id FROM ${S}.hospitality_reservation WHERE idempotency_key = $1 AND deleted_at IS NULL`,
          [idempotencyKey],
        );
        if (sudah.rows.length) {
          const reservasi = await this.muatDetailDalamTransaksi(client, S, sudah.rows[0].id);
          return { reservasi, diulang: true };
        }
      }

      const kepala = await client.query<BarisReservasi>(
        `INSERT INTO ${S}.hospitality_reservation
           (property_id, guest_id, status, source, market_segment, special_requests,
            idempotency_key, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING ${KOLOM_RESERVASI}`,
        [
          masukan.propertyId,
          masukan.guestId,
          masukan.statusAwal ?? 'HOLD',
          masukan.source ?? 'DIRECT',
          bersihkan(masukan.marketSegment),
          bersihkan(masukan.specialRequests),
          idempotencyKey ?? null,
          actorUserId,
        ],
      );
      const reservationId = kepala.rows[0].id;

      // Menghitung berapa kamar dari tipe yang SAMA sudah diminta di
      // permintaan ini sendiri -- reservasi 3 kamar tipe Deluxe pada satu
      // permintaan harus menghitung ketiganya, bukan hanya melihat baris
      // yang SUDAH ada di basis data sebelum transaksi ini dimulai.
      const dipesanDalamPermintaanIni = new Map<string, number>();

      for (const rs of masukan.roomStays!) {
        const roomType = await client.query<{ id: string; overbooking_limit: number; property_id: string }>(
          `SELECT id, overbooking_limit, property_id::text FROM ${S}.hospitality_room_type
            WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [rs.roomTypeId],
        );
        if (!roomType.rows.length) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, `Tipe kamar tidak ditemukan.`);
        }
        if (roomType.rows[0].property_id !== masukan.propertyId) {
          throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Tipe kamar ini bukan milik properti yang dipilih.');
        }

        const totalRow = await client.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM ${S}.hospitality_room
            WHERE room_type_id = $1 AND deleted_at IS NULL AND status = 'AVAILABLE'`,
          [rs.roomTypeId],
        );
        // Kamar yang tidak punya satu pun blokir (MI-6) pada rentang ini.
        const bebasBlokirRow = await client.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n
             FROM ${S}.hospitality_room r
            WHERE r.room_type_id = $1 AND r.deleted_at IS NULL AND r.status = 'AVAILABLE'
              AND NOT EXISTS (
                SELECT 1 FROM ${S}.hospitality_room_block b
                 WHERE b.room_id = r.id AND b.deleted_at IS NULL
                   AND b.stay_date >= $2 AND b.stay_date < $3
              )`,
          [rs.roomTypeId, rs.checkinDate, rs.checkoutDate],
        );
        const sudahDipesanRow = await client.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n
             FROM ${S}.hospitality_reservation_room_stay rrs
             JOIN ${S}.hospitality_reservation r ON r.id = rrs.reservation_id
            WHERE rrs.room_type_id = $1 AND rrs.deleted_at IS NULL
              AND r.status IN ('HOLD', 'CONFIRMED') AND r.deleted_at IS NULL
              AND rrs.checkin_date < $3 AND rrs.checkout_date > $2`,
          [rs.roomTypeId, rs.checkinDate, rs.checkoutDate],
        );

        const kapasitas = Number(bebasBlokirRow.rows[0]?.n ?? 0) + roomType.rows[0].overbooking_limit;
        const sudahDipesan = Number(sudahDipesanRow.rows[0]?.n ?? 0) + (dipesanDalamPermintaanIni.get(rs.roomTypeId!) ?? 0);
        if (sudahDipesan + 1 > kapasitas) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `Tipe kamar penuh untuk tanggal ${rs.checkinDate} sampai ${rs.checkoutDate}. ` +
              `Kapasitas ${kapasitas} (termasuk alotmen lebih), sudah terisi ${sudahDipesan}.`,
          );
        }
        dipesanDalamPermintaanIni.set(rs.roomTypeId!, (dipesanDalamPermintaanIni.get(rs.roomTypeId!) ?? 0) + 1);

        const rateSnapshot = {
          source: 'MANUAL',
          currency: 'IDR',
          amount: rs.rateAmount,
          capturedAt: new Date().toISOString(),
        };
        const restrictionSnapshot = {
          totalKamarAktif: Number(totalRow.rows[0]?.n ?? 0),
          overbookingLimit: roomType.rows[0].overbooking_limit,
          kapasitasSaatPesan: kapasitas,
        };

        await client.query(
          `INSERT INTO ${S}.hospitality_reservation_room_stay
             (reservation_id, room_type_id, guest_id, checkin_date, checkout_date,
              adults, children, rate_amount, rate_snapshot, restriction_snapshot,
              created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
          [
            reservationId,
            rs.roomTypeId,
            rs.guestId ?? masukan.guestId,
            rs.checkinDate,
            rs.checkoutDate,
            rs.adults ?? 1,
            rs.children ?? 0,
            rs.rateAmount,
            JSON.stringify(rateSnapshot),
            JSON.stringify(restrictionSnapshot),
            actorUserId,
          ],
        );
      }

      const reservasi = await this.muatDetailDalamTransaksi(client, S, reservationId);
      return { reservasi, diulang: false };
    });
  }

  private async muatDetailDalamTransaksi(client: PoolClient, S: string, id: string): Promise<DetailReservasi> {
    const kepala = await client.query<BarisReservasi>(
      `SELECT ${KOLOM_RESERVASI} FROM ${S}.hospitality_reservation WHERE id = $1`,
      [id],
    );
    const roomStays = await client.query<BarisRoomStay>(
      `SELECT ${KOLOM_ROOM_STAY} FROM ${S}.hospitality_reservation_room_stay
        WHERE reservation_id = $1 AND deleted_at IS NULL ORDER BY checkin_date ASC`,
      [id],
    );
    return { ...kepala.rows[0], room_stays: roomStays.rows };
  }

  /**
   * Mengubah status reservasi (konfirmasi/batalkan/no-show/pulihkan).
   *
   * `expectedVersion` ditegakkan SUNGGUHAN lewat `WHERE version = $N` --
   * nol baris terpengaruh berarti reservasi ini sudah diubah pihak lain
   * sejak layar dimuat, dan layanan menolak dengan CONFLICT alih-alih
   * menimpa perubahan itu diam-diam.
   */
  async ubahStatus(
    schemaName: string,
    id: string,
    statusBaru: StatusReservasi,
    expectedVersion: number,
    actorUserId: string,
    opsi: { alasan?: string } = {},
  ): Promise<BarisReservasi> {
    const S = `"${schemaName}"`;
    const existing = await this.tenantDb.queryOne<{ status: string; version: number }>(
      schemaName,
      `SELECT status, version FROM ${S}.hospitality_reservation WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!existing) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Reservasi tidak ditemukan.');
    }
    if (!transisiDiizinkan(existing.status, statusBaru)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Reservasi berstatus ${existing.status} tidak dapat langsung menjadi ${statusBaru}.`,
      );
    }
    if (statusBaru === 'CANCELLED') {
      const galat = validasiBatalkan(opsi as MasukanBatalkan);
      if (galat.length) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
      }
    }

    const rows = await this.tenantDb.query<BarisReservasi>(
      schemaName,
      `UPDATE ${S}.hospitality_reservation
          SET status = $3::varchar,
              cancel_reason = CASE WHEN $3::varchar = 'CANCELLED' THEN $4::text ELSE cancel_reason END,
              updated_at = now(), updated_by = $5, version = version + 1
        WHERE id = $1 AND version = $2
        RETURNING ${KOLOM_RESERVASI}`,
      [id, expectedVersion, statusBaru, opsi.alasan ? opsi.alasan.trim() : null, actorUserId],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.VERSION_CONFLICT,
        'Reservasi ini sudah diubah pengguna lain. Muat ulang lalu coba lagi.',
      );
    }
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
