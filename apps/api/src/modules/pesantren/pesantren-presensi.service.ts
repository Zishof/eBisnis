/**
 * Presensi santri (EP-E) — sisi basis datanya. Pola sama dengan
 * `pesantren-santri.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanPresensi, validasiPresensi } from './pesantren-presensi';

export interface BarisPresensi {
  id: string;
  santri_id: string;
  tanggal: string;
  jenis: string;
  status: string;
  keterangan: string | null;
  created_at: string;
}

@Injectable()
export class PesantrenPresensiService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { tanggal?: string; jenis?: string; santriId?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisPresensi[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.tanggal) {
      params.push(opsi.tanggal);
      kondisi.push(`tanggal = $${params.length}`);
    }
    if (opsi.jenis) {
      params.push(opsi.jenis);
      kondisi.push(`jenis = $${params.length}`);
    }
    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`santri_id = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_presensi WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisPresensi>(
      schemaName,
      `SELECT id::text, santri_id::text, tanggal::text, jenis, status, keterangan, created_at::text
         FROM ${S}.pesantren_presensi
        WHERE ${where}
        ORDER BY tanggal DESC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  /**
   * Mencatat presensi satu santri.
   *
   * Satu baris per santri per tanggal per jenis ditegakkan basis data lewat
   * indeks parsial (`ux_pesantren_presensi_satu_per_hari`); pelanggaran
   * ditangkap sebagai kode error PostgreSQL `23505` dan diterjemahkan ke
   * pesan yang dapat dipahami.
   */
  async catat(
    schemaName: string,
    masukan: MasukanPresensi,
    createdBy: string,
  ): Promise<BarisPresensi> {
    const galat = validasiPresensi(masukan);
    if (galat.length) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Ada isian yang belum benar. Periksa kembali formulir.',
        { errors: galat },
      );
    }

    const S = `"${schemaName}"`;
    const santri = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.santriId],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisPresensi>(
        schemaName,
        `INSERT INTO ${S}.pesantren_presensi
           (santri_id, tanggal, jenis, status, keterangan, dicatat_oleh, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $6)
         RETURNING id::text, santri_id::text, tanggal::text, jenis, status, keterangan, created_at::text`,
        [
          masukan.santriId,
          masukan.tanggal,
          masukan.jenis,
          masukan.status,
          bersihkan(masukan.keterangan),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_presensi_satu_per_hari')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Presensi santri ini untuk tanggal ${masukan.tanggal} dan jenis ${masukan.jenis} sudah tercatat. ` +
            'Ubah baris yang sudah ada, bukan mencatat baru.',
        );
      }
      throw error;
    }
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

/** Kode error PostgreSQL 23505 = unique_violation. */
function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
