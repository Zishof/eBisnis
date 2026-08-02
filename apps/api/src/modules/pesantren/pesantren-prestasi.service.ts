/**
 * Prestasi dan penghargaan santri (EP-S5) — sisi basis datanya. Pola sama
 * dengan `pesantren-pelanggaran.service.ts`, hanya catatannya positif,
 * bukan pelanggaran.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanPenghargaan,
  MasukanPrestasi,
  validasiPenghargaan,
  validasiPrestasi,
} from './pesantren-prestasi';

export interface BarisPrestasi {
  id: string;
  santri_id: string;
  cabang: string;
  nama_kompetisi: string;
  tingkat: string;
  peringkat: string;
  tanggal: string;
  penyelenggara: string | null;
  keterangan: string | null;
  dokumen_url: string | null;
  created_at: string;
}

const KOLOM_PRESTASI = `id::text, santri_id::text, cabang, nama_kompetisi, tingkat, peringkat, tanggal::text,
  penyelenggara, keterangan, dokumen_url, created_at::text`;

export interface BarisPenghargaan {
  id: string;
  santri_id: string;
  judul: string;
  jenis: string;
  tanggal: string;
  diberikan_oleh: string | null;
  keterangan: string | null;
  created_at: string;
}

const KOLOM_PENGHARGAAN = `id::text, santri_id::text, judul, jenis, tanggal::text, diberikan_oleh::text,
  keterangan, created_at::text`;

@Injectable()
export class PesantrenPrestasiService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Prestasi ------------------------------------------------------------

  async daftarPrestasi(
    schemaName: string,
    opsi: { santriId?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisPrestasi[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`santri_id = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_prestasi WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisPrestasi>(
      schemaName,
      `SELECT ${KOLOM_PRESTASI} FROM ${S}.pesantren_prestasi
        WHERE ${where}
        ORDER BY tanggal DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satuPrestasi(schemaName: string, id: string): Promise<BarisPrestasi | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisPrestasi>(
      schemaName,
      `SELECT ${KOLOM_PRESTASI} FROM ${S}.pesantren_prestasi WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async catatPrestasi(schemaName: string, masukan: MasukanPrestasi, createdBy: string): Promise<BarisPrestasi> {
    const galat = validasiPrestasi(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
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

    const rows = await this.tenantDb.query<BarisPrestasi>(
      schemaName,
      `INSERT INTO ${S}.pesantren_prestasi
         (santri_id, cabang, nama_kompetisi, tingkat, peringkat, tanggal, penyelenggara, keterangan, dokumen_url, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8, $9, $10, $10)
       RETURNING ${KOLOM_PRESTASI}`,
      [
        masukan.santriId,
        masukan.cabang!.trim(),
        masukan.namaKompetisi!.trim(),
        masukan.tingkat,
        masukan.peringkat,
        masukan.tanggal ? new Date(masukan.tanggal) : null,
        bersihkan(masukan.penyelenggara),
        bersihkan(masukan.keterangan),
        bersihkan(masukan.dokumenUrl),
        createdBy,
      ],
    );
    return rows[0];
  }

  // --- Penghargaan -------------------------------------------------------

  async daftarPenghargaan(
    schemaName: string,
    opsi: { santriId?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisPenghargaan[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`santri_id = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_penghargaan WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisPenghargaan>(
      schemaName,
      `SELECT ${KOLOM_PENGHARGAAN} FROM ${S}.pesantren_penghargaan
        WHERE ${where}
        ORDER BY tanggal DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async catatPenghargaan(schemaName: string, masukan: MasukanPenghargaan, createdBy: string): Promise<BarisPenghargaan> {
    const galat = validasiPenghargaan(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
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

    const rows = await this.tenantDb.query<BarisPenghargaan>(
      schemaName,
      `INSERT INTO ${S}.pesantren_penghargaan (santri_id, judul, jenis, tanggal, diberikan_oleh, keterangan, created_by, updated_by)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $7, $7)
       RETURNING ${KOLOM_PENGHARGAAN}`,
      [
        masukan.santriId,
        masukan.judul!.trim(),
        masukan.jenis,
        masukan.tanggal ? new Date(masukan.tanggal) : null,
        masukan.diberikanOleh || null,
        bersihkan(masukan.keterangan),
        createdBy,
      ],
    );
    return rows[0];
  }

  /** Rekap seluruh pencapaian (prestasi + penghargaan) seorang santri, digabung untuk rapor non-akademik. */
  async rekapSantri(schemaName: string, santriId: string): Promise<{ prestasi: BarisPrestasi[]; penghargaan: BarisPenghargaan[] }> {
    const S = `"${schemaName}"`;
    const [prestasi, penghargaan] = await Promise.all([
      this.tenantDb.query<BarisPrestasi>(
        schemaName,
        `SELECT ${KOLOM_PRESTASI} FROM ${S}.pesantren_prestasi WHERE santri_id = $1 AND deleted_at IS NULL ORDER BY tanggal DESC`,
        [santriId],
      ),
      this.tenantDb.query<BarisPenghargaan>(
        schemaName,
        `SELECT ${KOLOM_PENGHARGAAN} FROM ${S}.pesantren_penghargaan WHERE santri_id = $1 AND deleted_at IS NULL ORDER BY tanggal DESC`,
        [santriId],
      ),
    ]);
    return { prestasi, penghargaan };
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
