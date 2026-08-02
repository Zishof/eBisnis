/**
 * Data santri — sisi basis datanya.
 *
 * Aturan ada pada `pesantren-santri.ts` sebagai fungsi murni; berkas ini
 * mengambil keadaan, memanggil aturan itu, lalu menuliskan hasilnya. Pola yang
 * sama dengan `CooperativeProfileService`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanSantri, validasiSantri } from './pesantren-santri';

export interface BarisSantri {
  id: string;
  nis: string;
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: string;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  unit_pendidikan_id: string | null;
  status: string;
  status_tinggal: string;
  tanggal_masuk: string;
  tanggal_keluar: string | null;
  alamat_asal: string | null;
  golongan_darah: string | null;
  catatan_alergi: string | null;
  catatan: string | null;
  created_at: string;
}

@Injectable()
export class PesantrenSantriService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { status?: string; cari?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisSantri[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }
    if (opsi.cari) {
      params.push(`%${opsi.cari}%`);
      kondisi.push(`(nama_lengkap ILIKE $${params.length} OR nis ILIKE $${params.length})`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_santri WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisSantri>(
      schemaName,
      `SELECT id::text, nis, nama_lengkap, nama_panggilan, jenis_kelamin,
              tempat_lahir, tanggal_lahir::text, unit_pendidikan_id::text,
              status, status_tinggal, tanggal_masuk::text, tanggal_keluar::text,
              alamat_asal, golongan_darah, catatan_alergi, catatan, created_at::text
         FROM ${S}.pesantren_santri
        WHERE ${where}
        ORDER BY nama_lengkap ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satu(schemaName: string, id: string): Promise<BarisSantri | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisSantri>(
      schemaName,
      `SELECT id::text, nis, nama_lengkap, nama_panggilan, jenis_kelamin,
              tempat_lahir, tanggal_lahir::text, unit_pendidikan_id::text,
              status, status_tinggal, tanggal_masuk::text, tanggal_keluar::text,
              alamat_asal, golongan_darah, catatan_alergi, catatan, created_at::text
         FROM ${S}.pesantren_santri
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  /**
   * Mendaftarkan santri baru.
   *
   * NIS unik ditegakkan basis data lewat indeks parsial
   * (`ux_pesantren_santri_nis`); pelanggaran ditangkap sebagai kode error
   * PostgreSQL `23505` dan diterjemahkan ke pesan yang dapat dipahami, bukan
   * dilempar sebagai galat SQL mentah.
   */
  async catat(
    schemaName: string,
    masukan: MasukanSantri,
    createdBy: string,
  ): Promise<BarisSantri> {
    const galat = validasiSantri(masukan);
    if (galat.length) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Ada isian yang belum benar. Periksa kembali formulir.',
        { errors: galat },
      );
    }

    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisSantri>(
        schemaName,
        `INSERT INTO ${S}.pesantren_santri
           (nis, nama_lengkap, nama_panggilan, jenis_kelamin, tempat_lahir,
            tanggal_lahir, unit_pendidikan_id, status_tinggal, tanggal_masuk,
            alamat_asal, golongan_darah, catatan_alergi, catatan, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_DATE), $10, $11, $12, $13, $14, $14)
         RETURNING id::text, nis, nama_lengkap, nama_panggilan, jenis_kelamin,
                   tempat_lahir, tanggal_lahir::text, unit_pendidikan_id::text,
                   status, status_tinggal, tanggal_masuk::text, tanggal_keluar::text,
                   alamat_asal, golongan_darah, catatan_alergi, catatan, created_at::text`,
        [
          masukan.nis!.trim(),
          masukan.namaLengkap!.trim(),
          bersihkan(masukan.namaPanggilan),
          masukan.jenisKelamin,
          bersihkan(masukan.tempatLahir),
          masukan.tanggalLahir ? new Date(masukan.tanggalLahir) : null,
          masukan.unitPendidikanId || null,
          masukan.statusTinggal,
          masukan.tanggalMasuk ? new Date(masukan.tanggalMasuk) : null,
          bersihkan(masukan.alamatAsal),
          bersihkan(masukan.golonganDarah)?.toUpperCase() ?? null,
          bersihkan(masukan.catatanAlergi),
          bersihkan(masukan.catatan),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_santri_nis')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `NIS "${masukan.nis}" sudah dipakai santri lain. Periksa kembali atau gunakan NIS lain.`,
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
