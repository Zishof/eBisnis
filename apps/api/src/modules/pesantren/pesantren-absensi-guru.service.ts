/**
 * Absensi guru dan piket (EP-S3) — sisi basis datanya. Pola sama dengan
 * `pesantren-presensi.service.ts`, hanya subjeknya guru, bukan santri.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanAbsensiGuru, MasukanPiket, validasiAbsensiGuru, validasiPiket } from './pesantren-absensi-guru';

export interface BarisAbsensiGuru {
  id: string;
  guru_id: string;
  tanggal: string;
  status: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  keterangan: string | null;
  created_at: string;
}

const KOLOM_ABSENSI = `id::text, guru_id::text, tanggal::text, status, jam_masuk::text, jam_pulang::text,
  keterangan, created_at::text`;

export interface BarisPiket {
  id: string;
  guru_id: string;
  tanggal: string;
  jenis_piket: string;
  status: string;
  keterangan: string | null;
  created_at: string;
}

const KOLOM_PIKET = `id::text, guru_id::text, tanggal::text, jenis_piket, status, keterangan, created_at::text`;

@Injectable()
export class PesantrenAbsensiGuruService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Absensi harian ------------------------------------------------------

  async daftarAbsensi(
    schemaName: string,
    opsi: { guruId?: string; dari?: string; sampai?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisAbsensiGuru[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.guruId) {
      params.push(opsi.guruId);
      kondisi.push(`guru_id = $${params.length}`);
    }
    if (opsi.dari) {
      params.push(opsi.dari);
      kondisi.push(`tanggal >= $${params.length}`);
    }
    if (opsi.sampai) {
      params.push(opsi.sampai);
      kondisi.push(`tanggal <= $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_absensi_guru WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisAbsensiGuru>(
      schemaName,
      `SELECT ${KOLOM_ABSENSI} FROM ${S}.pesantren_absensi_guru
        WHERE ${where}
        ORDER BY tanggal DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async catatAbsensi(schemaName: string, masukan: MasukanAbsensiGuru, createdBy: string): Promise<BarisAbsensiGuru> {
    const galat = validasiAbsensiGuru(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const guru = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_guru WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.guruId],
    );
    if (!guru) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Guru tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisAbsensiGuru>(
        schemaName,
        `INSERT INTO ${S}.pesantren_absensi_guru (guru_id, tanggal, status, jam_masuk, jam_pulang, keterangan, created_by, updated_by)
         VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $7)
         RETURNING ${KOLOM_ABSENSI}`,
        [
          masukan.guruId,
          masukan.tanggal ? new Date(masukan.tanggal) : null,
          masukan.status,
          masukan.jamMasuk || null,
          masukan.jamPulang || null,
          bersihkan(masukan.keterangan),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_absensi_guru_satu_per_hari')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Absensi guru ini pada tanggal tersebut sudah dicatat.');
      }
      throw error;
    }
  }

  /** Rekap kehadiran per status dalam rentang tanggal -- dihitung dari log, bukan disimpan. */
  async rekapKehadiran(schemaName: string, guruId: string, dari: string, sampai: string): Promise<Record<string, number>> {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<{ status: string; jumlah: string }>(
      schemaName,
      `SELECT status, COUNT(*)::text AS jumlah
         FROM ${S}.pesantren_absensi_guru
        WHERE guru_id = $1 AND tanggal BETWEEN $2 AND $3 AND deleted_at IS NULL
        GROUP BY status`,
      [guruId, dari, sampai],
    );
    const rekap: Record<string, number> = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 };
    for (const row of rows) {
      rekap[row.status] = Number(row.jumlah);
    }
    return rekap;
  }

  // --- Piket -----------------------------------------------------------------

  async daftarPiket(schemaName: string, opsi: { guruId?: string; tanggal?: string }): Promise<BarisPiket[]> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.guruId) {
      params.push(opsi.guruId);
      kondisi.push(`guru_id = $${params.length}`);
    }
    if (opsi.tanggal) {
      params.push(opsi.tanggal);
      kondisi.push(`tanggal = $${params.length}`);
    }

    return this.tenantDb.query<BarisPiket>(
      schemaName,
      `SELECT ${KOLOM_PIKET} FROM ${S}.pesantren_piket
        WHERE ${kondisi.join(' AND ')}
        ORDER BY tanggal DESC`,
      params,
    );
  }

  async jadwalkanPiket(schemaName: string, masukan: MasukanPiket, createdBy: string): Promise<BarisPiket> {
    const galat = validasiPiket(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const guru = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_guru WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.guruId],
    );
    if (!guru) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Guru tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisPiket>(
        schemaName,
        `INSERT INTO ${S}.pesantren_piket (guru_id, tanggal, jenis_piket, keterangan, created_by, updated_by)
         VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $5)
         RETURNING ${KOLOM_PIKET}`,
        [masukan.guruId, masukan.tanggal ? new Date(masukan.tanggal) : null, masukan.jenisPiket, bersihkan(masukan.keterangan), createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_piket_kombinasi')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Guru ini sudah dijadwalkan piket jenis yang sama pada tanggal tersebut.',
        );
      }
      throw error;
    }
  }

  async catatKehadiranPiket(schemaName: string, id: string, hadir: boolean, actorUserId: string): Promise<BarisPiket> {
    const S = `"${schemaName}"`;
    const piket = await this.tenantDb.queryOne<BarisPiket>(
      schemaName,
      `SELECT ${KOLOM_PIKET} FROM ${S}.pesantren_piket WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!piket) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Jadwal piket tidak ditemukan.');
    }
    if (piket.status !== 'DIJADWALKAN') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Kehadiran piket ini sudah dicatat.');
    }
    const rows = await this.tenantDb.query<BarisPiket>(
      schemaName,
      `UPDATE ${S}.pesantren_piket
          SET status = $2, updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_PIKET}`,
      [id, hadir ? 'HADIR' : 'TIDAK_HADIR', actorUserId],
    );
    return rows[0];
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
