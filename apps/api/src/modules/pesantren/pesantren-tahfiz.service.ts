/**
 * Setoran tahfiz (EP-I) — sisi basis datanya. Pola sama dengan
 * `pesantren-presensi.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanSetoran, validasiSetoran } from './pesantren-tahfiz';

export interface BarisSetoran {
  id: string;
  santri_id: string;
  tanggal: string;
  jenis: string;
  juz: number;
  predikat: string;
  catatan: string | null;
  created_at: string;
}

export interface Capaian {
  santri_id: string;
  juz_tertinggi: number | null;
  total_setoran: number;
}

@Injectable()
export class PesantrenTahfizService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { santriId?: string; tanggal?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisSetoran[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`santri_id = $${params.length}`);
    }
    if (opsi.tanggal) {
      params.push(opsi.tanggal);
      kondisi.push(`tanggal = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_tahfiz_setoran WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisSetoran>(
      schemaName,
      `SELECT id::text, santri_id::text, tanggal::text, jenis, juz, predikat, catatan, created_at::text
         FROM ${S}.pesantren_tahfiz_setoran
        WHERE ${where}
        ORDER BY tanggal DESC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  /** Capaian juz tertinggi (setoran berpredikat LANCAR) dan total setoran satu santri. */
  async capaian(schemaName: string, santriId: string): Promise<Capaian> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ juz_tertinggi: number | null; total_setoran: string }>(
      schemaName,
      `SELECT
         (SELECT MAX(juz) FROM ${S}.pesantren_tahfiz_setoran
           WHERE santri_id = $1 AND jenis = 'SETORAN' AND predikat = 'LANCAR' AND deleted_at IS NULL) AS juz_tertinggi,
         (SELECT COUNT(*) FROM ${S}.pesantren_tahfiz_setoran
           WHERE santri_id = $1 AND deleted_at IS NULL)::text AS total_setoran`,
      [santriId],
    );
    return {
      santri_id: santriId,
      juz_tertinggi: row?.juz_tertinggi ?? null,
      total_setoran: Number(row?.total_setoran ?? 0),
    };
  }

  async catat(schemaName: string, masukan: MasukanSetoran, createdBy: string): Promise<BarisSetoran> {
    const galat = validasiSetoran(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar. Periksa kembali formulir.', {
        errors: galat,
      });
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

    const rows = await this.tenantDb.query<BarisSetoran>(
      schemaName,
      `INSERT INTO ${S}.pesantren_tahfiz_setoran (santri_id, tanggal, jenis, juz, predikat, catatan, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id::text, santri_id::text, tanggal::text, jenis, juz, predikat, catatan, created_at::text`,
      [
        masukan.santriId,
        masukan.tanggal,
        masukan.jenis,
        masukan.juz,
        masukan.predikat,
        bersihkan(masukan.catatan),
        createdBy,
      ],
    );
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
