/**
 * Blokir kamar (OOO/OOS/BLOCKED) per malam dan perhitungan ketersediaan
 * (MI-6). Pola query sama dengan `hospitality-properti.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanBlokir,
  MasukanRentangTanggal,
  daftarMalam,
  validasiBlokir,
  validasiRentangTanggal,
} from './hospitality-room-block';

export interface BarisBlokir {
  id: string;
  room_id: string;
  stay_date: string;
  status: string;
  reason: string | null;
  source: string;
}

export interface Ketersediaan {
  room_type_id: string;
  total_kamar: number;
  overbooking_limit: number;
  tersedia: number;
  per_malam: Array<{ tanggal: string; tersedia: number }>;
}

@Injectable()
export class HospitalityRoomBlockService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Memblokir satu kamar untuk rentang [checkin, checkout).
   *
   * Setiap malam di-upsert satu per satu di dalam SATU transaksi lewat
   * `INSERT ... ON CONFLICT (room_id, stay_date) DO UPDATE` -- dua
   * permintaan blokir bersamaan untuk kamar+malam yang sama tidak pernah
   * menghasilkan baris ganda atau gagal karena pelanggaran constraint;
   * yang datang belakangan memperbarui baris yang sama. Lihat catatan
   * kondisi pacu pada berkas migrasi.
   */
  async blokir(
    schemaName: string,
    propertyId: string,
    roomId: string,
    masukan: MasukanBlokir,
    actorUserId: string,
  ): Promise<BarisBlokir[]> {
    const galat = validasiBlokir(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    const S = `"${schemaName}"`;
    const kamar = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id FROM ${S}.hospitality_room WHERE id = $1 AND property_id = $2 AND deleted_at IS NULL`,
      [roomId, propertyId],
    );
    if (!kamar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kamar tidak ditemukan pada properti ini.');
    }

    const malam = daftarMalam(masukan.checkin!, masukan.checkout!);
    const alasan = masukan.alasan?.trim() || null;

    return this.tenantDb.transaction(schemaName, async (client) => {
      const hasil: BarisBlokir[] = [];
      for (const tanggal of malam) {
        const { rows } = await client.query<BarisBlokir>(
          `INSERT INTO ${S}.hospitality_room_block
             (room_id, stay_date, status, reason, source, created_by, updated_by)
           VALUES ($1, $2, $3, $4, 'MANUAL', $5, $5)
           ON CONFLICT (room_id, stay_date) WHERE deleted_at IS NULL
           DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason,
                         updated_at = now(), updated_by = EXCLUDED.updated_by,
                         version = ${S}.hospitality_room_block.version + 1
           RETURNING id::text, room_id::text, stay_date::text, status, reason, source`,
          [roomId, tanggal, masukan.status, alasan, actorUserId],
        );
        hasil.push(rows[0]);
      }
      return hasil;
    });
  }

  /** Membuka blokir (soft-delete) untuk rentang [checkin, checkout) pada satu kamar. */
  async bukaBlokir(
    schemaName: string,
    propertyId: string,
    roomId: string,
    masukan: MasukanRentangTanggal,
    actorUserId: string,
  ): Promise<{ dibuka: number }> {
    const galat = validasiRentangTanggal(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const kamar = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id FROM ${S}.hospitality_room WHERE id = $1 AND property_id = $2 AND deleted_at IS NULL`,
      [roomId, propertyId],
    );
    if (!kamar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kamar tidak ditemukan pada properti ini.');
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE ${S}.hospitality_room_block
          SET deleted_at = now(), deleted_by = $4, updated_at = now(), updated_by = $4, version = version + 1
        WHERE room_id = $1 AND stay_date >= $2 AND stay_date < $3 AND deleted_at IS NULL
        RETURNING id`,
      [roomId, masukan.checkin, masukan.checkout, actorUserId],
    );
    return { dibuka: rows.length };
  }

  async daftarBlokir(schemaName: string, roomId: string): Promise<BarisBlokir[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisBlokir>(
      schemaName,
      `SELECT id::text, room_id::text, stay_date::text, status, reason, source
         FROM ${S}.hospitality_room_block
        WHERE room_id = $1 AND deleted_at IS NULL
        ORDER BY stay_date ASC`,
      [roomId],
    );
  }

  /**
   * Ketersediaan tipe kamar untuk rentang menginap [checkin, checkout).
   *
   * Dihitung langsung dari baris blokir yang ADA saat ini -- bukan
   * penghitung tersimpan yang perlu direkonsiliasi. Satu kamar terhitung
   * tersedia untuk SELURUH rentang hanya bila TIDAK ADA satu pun malam di
   * rentang itu yang diblokir; itulah artinya "tersedia untuk menginap
   * 3 malam", bukan sekadar tersedia pada satu malam saja.
   */
  async hitungKetersediaan(
    schemaName: string,
    roomTypeId: string,
    masukan: MasukanRentangTanggal,
  ): Promise<Ketersediaan> {
    const galat = validasiRentangTanggal(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const roomType = await this.tenantDb.queryOne<{ overbooking_limit: number }>(
      schemaName,
      `SELECT overbooking_limit FROM ${S}.hospitality_room_type WHERE id = $1 AND deleted_at IS NULL`,
      [roomTypeId],
    );
    if (!roomType) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tipe kamar tidak ditemukan.');
    }

    const totalRow = await this.tenantDb.queryOne<{ n: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS n FROM ${S}.hospitality_room
        WHERE room_type_id = $1 AND deleted_at IS NULL AND status = 'AVAILABLE'`,
      [roomTypeId],
    );
    const totalKamar = Number(totalRow?.n ?? 0);

    // Kamar yang TIDAK punya satu pun baris blokir pada rentang ini --
    // yaitu kamar yang bebas untuk seluruh rentang menginap.
    const bebasRow = await this.tenantDb.queryOne<{ n: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS n
         FROM ${S}.hospitality_room r
        WHERE r.room_type_id = $1 AND r.deleted_at IS NULL AND r.status = 'AVAILABLE'
          AND NOT EXISTS (
            SELECT 1 FROM ${S}.hospitality_room_block b
             WHERE b.room_id = r.id AND b.deleted_at IS NULL
               AND b.stay_date >= $2 AND b.stay_date < $3
          )`,
      [roomTypeId, masukan.checkin, masukan.checkout],
    );
    const bebas = Number(bebasRow?.n ?? 0);

    const perMalam = await this.tenantDb.query<{ tanggal: string; terisi: string }>(
      schemaName,
      `SELECT gs::date::text AS tanggal, COUNT(b.id)::text AS terisi
         FROM generate_series($2::date, $3::date - INTERVAL '1 day', INTERVAL '1 day') AS gs
         LEFT JOIN ${S}.hospitality_room_block b
           ON b.stay_date = gs::date AND b.deleted_at IS NULL
           AND b.room_id IN (SELECT id FROM ${S}.hospitality_room WHERE room_type_id = $1 AND deleted_at IS NULL AND status = 'AVAILABLE')
        GROUP BY gs
        ORDER BY gs`,
      [roomTypeId, masukan.checkin, masukan.checkout],
    );

    return {
      room_type_id: roomTypeId,
      total_kamar: totalKamar,
      overbooking_limit: roomType.overbooking_limit,
      tersedia: bebas + roomType.overbooking_limit,
      per_malam: perMalam.map((r) => ({
        tanggal: r.tanggal,
        tersedia: totalKamar - Number(r.terisi) + roomType.overbooking_limit,
      })),
    };
  }
}
