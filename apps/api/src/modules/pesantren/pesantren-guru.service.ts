/**
 * Guru dan penugasan mengajar (EP-S2) — sisi basis datanya. Pola sama
 * dengan `pesantren-santri.service.ts` (data induk) dan
 * `pesantren-kurikulum.service.ts` (relasi ke rombongan/mata pelajaran).
 *
 * Beban mengajar seorang guru DIHITUNG dari penugasan aktifnya, bukan
 * disimpan sebagai kolom akumulator -- pola yang sama dengan poin
 * pelanggaran (EP-S1) dan saldo dompet (EP-L).
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanGuru, MasukanPenugasan, validasiGuru, validasiPenugasan } from './pesantren-guru';

export interface BarisGuru {
  id: string;
  user_subject_id: string | null;
  nip: string | null;
  nama: string;
  jenis: string;
  no_hp: string | null;
  email: string | null;
  alamat: string | null;
  status: string;
  created_at: string;
}

const KOLOM_GURU = `id::text, user_subject_id::text, nip, nama, jenis, no_hp, email, alamat, status, created_at::text`;

export interface BarisPenugasan {
  id: string;
  guru_id: string;
  mata_pelajaran_id: string;
  rombongan_id: string;
  tahun_ajaran_id: string;
  jam_per_minggu: number;
  status: string;
  created_at: string;
}

const KOLOM_PENUGASAN = `id::text, guru_id::text, mata_pelajaran_id::text, rombongan_id::text,
  tahun_ajaran_id::text, jam_per_minggu, status, created_at::text`;

@Injectable()
export class PesantrenGuruService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { status?: string; cari?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisGuru[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }
    if (opsi.cari) {
      params.push(`%${opsi.cari}%`);
      kondisi.push(`(nama ILIKE $${params.length} OR nip ILIKE $${params.length})`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_guru WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisGuru>(
      schemaName,
      `SELECT ${KOLOM_GURU} FROM ${S}.pesantren_guru
        WHERE ${where}
        ORDER BY nama ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satu(schemaName: string, id: string): Promise<BarisGuru | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisGuru>(
      schemaName,
      `SELECT ${KOLOM_GURU} FROM ${S}.pesantren_guru WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async catat(schemaName: string, masukan: MasukanGuru, createdBy: string): Promise<BarisGuru> {
    const galat = validasiGuru(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisGuru>(
        schemaName,
        `INSERT INTO ${S}.pesantren_guru (user_subject_id, nip, nama, jenis, no_hp, email, alamat, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING ${KOLOM_GURU}`,
        [
          masukan.userSubjectId || null,
          bersihkan(masukan.nip),
          masukan.nama!.trim(),
          masukan.jenis,
          bersihkan(masukan.noHp),
          bersihkan(masukan.email)?.toLowerCase() ?? null,
          bersihkan(masukan.alamat),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_guru_nip')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `NIP "${masukan.nip}" sudah dipakai guru lain.`);
      }
      throw error;
    }
  }

  async nonaktifkan(schemaName: string, id: string, actorUserId: string): Promise<BarisGuru> {
    const S = `"${schemaName}"`;
    const guru = await this.satu(schemaName, id);
    if (!guru) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Guru tidak ditemukan.');
    }
    const rows = await this.tenantDb.query<BarisGuru>(
      schemaName,
      `UPDATE ${S}.pesantren_guru
          SET status = 'NONAKTIF', updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_GURU}`,
      [id, actorUserId],
    );
    return rows[0];
  }

  /** Total jam mengajar per minggu dari penugasan AKTIF -- dihitung, bukan disimpan. */
  async totalJamMengajar(schemaName: string, guruId: string): Promise<number> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ total: string }>(
      schemaName,
      `SELECT COALESCE(SUM(jam_per_minggu), 0)::text AS total
         FROM ${S}.pesantren_penugasan_mengajar
        WHERE guru_id = $1 AND status = 'AKTIF' AND deleted_at IS NULL`,
      [guruId],
    );
    return Number(row?.total ?? 0);
  }

  // --- Penugasan mengajar ------------------------------------------------

  async daftarPenugasan(schemaName: string, opsi: { guruId?: string; rombonganId?: string }): Promise<BarisPenugasan[]> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.guruId) {
      params.push(opsi.guruId);
      kondisi.push(`guru_id = $${params.length}`);
    }
    if (opsi.rombonganId) {
      params.push(opsi.rombonganId);
      kondisi.push(`rombongan_id = $${params.length}`);
    }

    return this.tenantDb.query<BarisPenugasan>(
      schemaName,
      `SELECT ${KOLOM_PENUGASAN} FROM ${S}.pesantren_penugasan_mengajar
        WHERE ${kondisi.join(' AND ')}
        ORDER BY created_at DESC`,
      params,
    );
  }

  async catatPenugasan(schemaName: string, masukan: MasukanPenugasan, createdBy: string): Promise<BarisPenugasan> {
    const galat = validasiPenugasan(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const guru = await this.satu(schemaName, masukan.guruId!);
    if (!guru) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Guru tidak ditemukan.');
    }
    if (guru.status !== 'AKTIF') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Guru berstatus NONAKTIF tidak dapat ditugaskan mengajar.');
    }
    const mataPelajaran = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_mata_pelajaran WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.mataPelajaranId],
    );
    if (!mataPelajaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Mata pelajaran tidak ditemukan.');
    }
    const rombongan = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_rombongan_belajar WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.rombonganId],
    );
    if (!rombongan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Rombongan belajar tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisPenugasan>(
        schemaName,
        `INSERT INTO ${S}.pesantren_penugasan_mengajar
           (guru_id, mata_pelajaran_id, rombongan_id, tahun_ajaran_id, jam_per_minggu, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING ${KOLOM_PENUGASAN}`,
        [masukan.guruId, masukan.mataPelajaranId, masukan.rombonganId, masukan.tahunAjaranId, masukan.jamPerMinggu, createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_penugasan_mengajar_kombinasi')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Guru ini sudah ditugaskan mengajar mata pelajaran dan rombongan yang sama pada tahun ajaran ini.',
        );
      }
      throw error;
    }
  }

  async selesaikanPenugasan(schemaName: string, id: string, actorUserId: string): Promise<BarisPenugasan> {
    const S = `"${schemaName}"`;
    const penugasan = await this.tenantDb.queryOne<BarisPenugasan>(
      schemaName,
      `SELECT ${KOLOM_PENUGASAN} FROM ${S}.pesantren_penugasan_mengajar WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!penugasan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penugasan tidak ditemukan.');
    }
    if (penugasan.status !== 'AKTIF') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Penugasan ini sudah selesai.');
    }
    const rows = await this.tenantDb.query<BarisPenugasan>(
      schemaName,
      `UPDATE ${S}.pesantren_penugasan_mengajar
          SET status = 'SELESAI', updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_PENUGASAN}`,
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
