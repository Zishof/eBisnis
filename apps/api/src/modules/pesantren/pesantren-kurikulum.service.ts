/**
 * Kurikulum dan jadwal pelajaran (EP-O4) — sisi basis datanya.
 *
 * Tabrakan jam (satu rombongan dua pelajaran sekaligus, atau satu
 * pengajar mengajar dua rombongan sekaligus) ditegakkan basis data lewat
 * `EXCLUDE USING gist` -- pelanggarannya ditangkap sebagai kode PostgreSQL
 * `23P01` (exclusion_violation) di sini, sama seperti pola unique_violation
 * (`23505`) pada service lain di modul ini, supaya pengguna tidak pernah
 * melihat galat SQL mentah.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanJadwal, MasukanKurikulum, validasiJadwalPelajaran, validasiKurikulum } from './pesantren-kurikulum';

export interface BarisKurikulum {
  id: string;
  unit_pendidikan_id: string;
  tahun_ajaran_id: string;
  tingkat: string;
  mata_pelajaran_id: string;
  jam_per_minggu: number;
  created_at: string;
}

const KOLOM_KURIKULUM = `id::text, unit_pendidikan_id::text, tahun_ajaran_id::text, tingkat,
  mata_pelajaran_id::text, jam_per_minggu, created_at::text`;

export interface BarisJadwal {
  id: string;
  rombongan_id: string;
  mata_pelajaran_id: string;
  hari: string;
  waktu_mulai: string;
  waktu_selesai: string;
  pengajar_user_id: string | null;
  ruangan: string | null;
  created_at: string;
}

const KOLOM_JADWAL = `id::text, rombongan_id::text, mata_pelajaran_id::text, hari, waktu_mulai::text,
  waktu_selesai::text, pengajar_user_id::text, ruangan, created_at::text`;

@Injectable()
export class PesantrenKurikulumService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftarKurikulum(
    schemaName: string,
    opsi: { unitPendidikanId?: string; tahunAjaranId?: string; tingkat?: string },
  ): Promise<BarisKurikulum[]> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.unitPendidikanId) {
      params.push(opsi.unitPendidikanId);
      kondisi.push(`unit_pendidikan_id = $${params.length}`);
    }
    if (opsi.tahunAjaranId) {
      params.push(opsi.tahunAjaranId);
      kondisi.push(`tahun_ajaran_id = $${params.length}`);
    }
    if (opsi.tingkat) {
      params.push(opsi.tingkat);
      kondisi.push(`tingkat = $${params.length}`);
    }

    return this.tenantDb.query<BarisKurikulum>(
      schemaName,
      `SELECT ${KOLOM_KURIKULUM} FROM ${S}.pesantren_kurikulum
        WHERE ${kondisi.join(' AND ')}
        ORDER BY tingkat ASC`,
      params,
    );
  }

  async catatKurikulum(schemaName: string, masukan: MasukanKurikulum, createdBy: string): Promise<BarisKurikulum> {
    const galat = validasiKurikulum(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const unit = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_unit_pendidikan WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.unitPendidikanId],
    );
    if (!unit) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tidak ditemukan.');
    }
    const tahunAjaran = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_tahun_ajaran WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.tahunAjaranId],
    );
    if (!tahunAjaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tahun ajaran tidak ditemukan.');
    }
    const mataPelajaran = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_mata_pelajaran WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.mataPelajaranId],
    );
    if (!mataPelajaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Mata pelajaran tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisKurikulum>(
        schemaName,
        `INSERT INTO ${S}.pesantren_kurikulum
           (unit_pendidikan_id, tahun_ajaran_id, tingkat, mata_pelajaran_id, jam_per_minggu, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING ${KOLOM_KURIKULUM}`,
        [
          masukan.unitPendidikanId,
          masukan.tahunAjaranId,
          masukan.tingkat!.trim(),
          masukan.mataPelajaranId,
          masukan.jamPerMinggu,
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_kurikulum_kombinasi')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Mata pelajaran ini sudah terdaftar pada kombinasi unit pendidikan, tingkat, dan tahun ajaran yang sama.',
        );
      }
      throw error;
    }
  }

  async daftarJadwal(schemaName: string, opsi: { rombonganId?: string; hari?: string }): Promise<BarisJadwal[]> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.rombonganId) {
      params.push(opsi.rombonganId);
      kondisi.push(`rombongan_id = $${params.length}`);
    }
    if (opsi.hari) {
      params.push(opsi.hari);
      kondisi.push(`hari = $${params.length}`);
    }

    return this.tenantDb.query<BarisJadwal>(
      schemaName,
      `SELECT ${KOLOM_JADWAL} FROM ${S}.pesantren_jadwal_pelajaran
        WHERE ${kondisi.join(' AND ')}
        ORDER BY hari ASC, waktu_mulai ASC`,
      params,
    );
  }

  /**
   * Menjadwalkan satu mata pelajaran pada satu rombongan. Tabrakan jam --
   * baik pada rombongan yang sama maupun pengajar yang sama -- ditolak
   * oleh dua `EXCLUDE` constraint basis data, ditangkap di sini dan
   * diterjemahkan ke pesan yang membedakan keduanya.
   */
  async catatJadwal(schemaName: string, masukan: MasukanJadwal, createdBy: string): Promise<BarisJadwal> {
    const galat = validasiJadwalPelajaran(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const rombongan = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_rombongan_belajar WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.rombonganId],
    );
    if (!rombongan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Rombongan belajar tidak ditemukan.');
    }
    const mataPelajaran = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_mata_pelajaran WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.mataPelajaranId],
    );
    if (!mataPelajaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Mata pelajaran tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisJadwal>(
        schemaName,
        `INSERT INTO ${S}.pesantren_jadwal_pelajaran
           (rombongan_id, mata_pelajaran_id, hari, waktu_mulai, waktu_selesai, pengajar_user_id, ruangan, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING ${KOLOM_JADWAL}`,
        [
          masukan.rombonganId,
          masukan.mataPelajaranId,
          masukan.hari,
          masukan.waktuMulai,
          masukan.waktuSelesai,
          masukan.pengajarUserId || null,
          bersihkan(masukan.ruangan),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isExclusionViolation(error, 'ex_pesantren_jadwal_pelajaran_rombongan_tanpa_tumpang_tindih')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Rombongan ini sudah memiliki jadwal pelajaran lain yang tumpang tindih pada jam tersebut.',
        );
      }
      if (isExclusionViolation(error, 'ex_pesantren_jadwal_pelajaran_pengajar_tanpa_tumpang_tindih')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Pengajar ini sudah mengajar rombongan lain pada jam yang tumpang tindih di hari yang sama.',
        );
      }
      throw error;
    }
  }

  async batalkanJadwal(schemaName: string, id: string, actorUserId: string): Promise<BarisJadwal> {
    const S = `"${schemaName}"`;
    const jadwal = await this.tenantDb.queryOne<BarisJadwal>(
      schemaName,
      `SELECT ${KOLOM_JADWAL} FROM ${S}.pesantren_jadwal_pelajaran WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!jadwal) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Jadwal pelajaran tidak ditemukan.');
    }
    const rows = await this.tenantDb.query<BarisJadwal>(
      schemaName,
      `UPDATE ${S}.pesantren_jadwal_pelajaran
          SET deleted_at = now(), updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_JADWAL}`,
      [id, actorUserId],
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

/** Kode error PostgreSQL 23P01 = exclusion_violation. */
function isExclusionViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23P01' && e?.constraint === constraintName;
}
