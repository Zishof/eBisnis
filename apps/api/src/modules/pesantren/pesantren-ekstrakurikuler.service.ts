/**
 * Ekstrakurikuler dan organisasi siswa (EP-S4) — sisi basis datanya. Pola
 * sama dengan `pesantren-rombongan.service.ts` (keanggotaan + penempatan),
 * bedanya santri boleh aktif di banyak ekstrakurikuler sekaligus.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanAnggotaEkskul,
  MasukanEkstrakurikuler,
  MasukanNilaiPartisipasi,
  validasiAnggotaEkskul,
  validasiEkstrakurikuler,
  validasiNilaiPartisipasi,
} from './pesantren-ekstrakurikuler';

export interface BarisEkstrakurikuler {
  id: string;
  code: string;
  nama: string;
  jenis: string;
  pembina_guru_id: string | null;
  deskripsi: string | null;
  is_active: boolean;
  created_at: string;
}

const KOLOM_EKSKUL = `id::text, code, nama, jenis, pembina_guru_id::text, deskripsi, is_active, created_at::text`;

export interface BarisAnggotaEkskul {
  id: string;
  ekstrakurikuler_id: string;
  santri_id: string;
  tahun_ajaran_id: string;
  jabatan: string;
  tanggal_bergabung: string;
  status: string;
  nilai_partisipasi: string | null;
  catatan: string | null;
  created_at: string;
  nama_lengkap?: string;
  nis?: string;
}

const KOLOM_ANGGOTA = `id::text, ekstrakurikuler_id::text, santri_id::text, tahun_ajaran_id::text, jabatan,
  tanggal_bergabung::text, status, nilai_partisipasi::text, catatan, created_at::text`;
const KOLOM_ANGGOTA_A = `a.id::text, a.ekstrakurikuler_id::text, a.santri_id::text, a.tahun_ajaran_id::text, a.jabatan,
  a.tanggal_bergabung::text, a.status, a.nilai_partisipasi::text, a.catatan, a.created_at::text`;

@Injectable()
export class PesantrenEkstrakurikulerService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(schemaName: string, opsi: { jenis?: string }): Promise<BarisEkstrakurikuler[]> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    if (opsi.jenis) {
      params.push(opsi.jenis);
      kondisi.push(`jenis = $${params.length}`);
    }
    return this.tenantDb.query<BarisEkstrakurikuler>(
      schemaName,
      `SELECT ${KOLOM_EKSKUL} FROM ${S}.pesantren_ekstrakurikuler WHERE ${kondisi.join(' AND ')} ORDER BY nama`,
      params,
    );
  }

  async satu(schemaName: string, id: string): Promise<BarisEkstrakurikuler | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisEkstrakurikuler>(
      schemaName,
      `SELECT ${KOLOM_EKSKUL} FROM ${S}.pesantren_ekstrakurikuler WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async catat(schemaName: string, masukan: MasukanEkstrakurikuler, createdBy: string): Promise<BarisEkstrakurikuler> {
    const galat = validasiEkstrakurikuler(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisEkstrakurikuler>(
        schemaName,
        `INSERT INTO ${S}.pesantren_ekstrakurikuler (code, nama, jenis, pembina_guru_id, deskripsi, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING ${KOLOM_EKSKUL}`,
        [
          masukan.code!.trim(),
          masukan.nama!.trim(),
          masukan.jenis,
          masukan.pembinaGuruId || null,
          bersihkan(masukan.deskripsi),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_ekstrakurikuler_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode ekstrakurikuler "${masukan.code}" sudah dipakai.`);
      }
      throw error;
    }
  }

  async daftarAnggota(schemaName: string, ekstrakurikulerId: string): Promise<BarisAnggotaEkskul[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisAnggotaEkskul>(
      schemaName,
      `SELECT ${KOLOM_ANGGOTA_A}, s.nama_lengkap, s.nis
         FROM ${S}.pesantren_ekstrakurikuler_anggota a
         JOIN ${S}.pesantren_santri s ON s.id = a.santri_id
        WHERE a.ekstrakurikuler_id = $1 AND a.deleted_at IS NULL
        ORDER BY a.jabatan, s.nama_lengkap`,
      [ekstrakurikulerId],
    );
  }

  async daftarEkskulSantri(schemaName: string, santriId: string): Promise<BarisAnggotaEkskul[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisAnggotaEkskul>(
      schemaName,
      `SELECT ${KOLOM_ANGGOTA_A}, e.nama AS nama_ekstrakurikuler
         FROM ${S}.pesantren_ekstrakurikuler_anggota a
         JOIN ${S}.pesantren_ekstrakurikuler e ON e.id = a.ekstrakurikuler_id
        WHERE a.santri_id = $1 AND a.deleted_at IS NULL
        ORDER BY a.status, e.nama`,
      [santriId],
    );
  }

  async tambahAnggota(schemaName: string, masukan: MasukanAnggotaEkskul, createdBy: string): Promise<BarisAnggotaEkskul> {
    const galat = validasiAnggotaEkskul(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const ekskul = await this.satu(schemaName, masukan.ekstrakurikulerId!);
    if (!ekskul) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Ekstrakurikuler tidak ditemukan.');
    }
    const santri = await this.tenantDb.queryOne<{ status: string }>(
      schemaName,
      `SELECT status FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.santriId],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }
    if (santri.status !== 'AKTIF') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Hanya santri AKTIF yang dapat bergabung ekstrakurikuler.');
    }

    try {
      const rows = await this.tenantDb.query<BarisAnggotaEkskul>(
        schemaName,
        `INSERT INTO ${S}.pesantren_ekstrakurikuler_anggota
           (ekstrakurikuler_id, santri_id, tahun_ajaran_id, jabatan, tanggal_bergabung, created_by, updated_by)
         VALUES ($1, $2, $3, COALESCE($4, 'ANGGOTA'), COALESCE($5, CURRENT_DATE), $6, $6)
         RETURNING ${KOLOM_ANGGOTA}`,
        [
          masukan.ekstrakurikulerId,
          masukan.santriId,
          masukan.tahunAjaranId,
          masukan.jabatan || null,
          masukan.tanggalBergabung ? new Date(masukan.tanggalBergabung) : null,
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_ekskul_anggota_aktif')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Santri ini sudah menjadi anggota aktif ekstrakurikuler ini pada tahun ajaran yang sama.',
        );
      }
      throw error;
    }
  }

  async keluarkanAnggota(schemaName: string, id: string, actorUserId: string): Promise<BarisAnggotaEkskul> {
    const S = `"${schemaName}"`;
    const anggota = await this.tenantDb.queryOne<BarisAnggotaEkskul>(
      schemaName,
      `SELECT ${KOLOM_ANGGOTA} FROM ${S}.pesantren_ekstrakurikuler_anggota WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!anggota) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keanggotaan tidak ditemukan.');
    }
    if (anggota.status !== 'AKTIF') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Keanggotaan ini sudah tidak aktif.');
    }
    const rows = await this.tenantDb.query<BarisAnggotaEkskul>(
      schemaName,
      `UPDATE ${S}.pesantren_ekstrakurikuler_anggota
          SET status = 'KELUAR', updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_ANGGOTA}`,
      [id, actorUserId],
    );
    return rows[0];
  }

  async catatNilaiPartisipasi(
    schemaName: string,
    id: string,
    masukan: MasukanNilaiPartisipasi,
    actorUserId: string,
  ): Promise<BarisAnggotaEkskul> {
    const galat = validasiNilaiPartisipasi(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const anggota = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_ekstrakurikuler_anggota WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!anggota) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keanggotaan tidak ditemukan.');
    }
    const rows = await this.tenantDb.query<BarisAnggotaEkskul>(
      schemaName,
      `UPDATE ${S}.pesantren_ekstrakurikuler_anggota
          SET nilai_partisipasi = $2, catatan = $3, updated_at = now(), updated_by = $4, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_ANGGOTA}`,
      [id, masukan.nilaiPartisipasi ?? null, bersihkan(masukan.catatan), actorUserId],
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
