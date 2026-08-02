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
import { DataOrangTua, MasukanSantri, validasiSantri } from './pesantren-santri';

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

  // -- Kelengkapan setara Dapodik (lihat migrasi 20260802T340000) ----------
  nik: string | null;
  nisn: string | null;
  nipd: string | null;
  agama: string | null;
  kewarganegaraan: string;
  kebutuhan_khusus: string;
  anak_ke: number | null;
  jumlah_saudara: number | null;
  alat_transportasi: string | null;
  jarak_tempat_tinggal_km: string | null;
  telepon: string | null;
  hp: string | null;
  email: string | null;
  penerima_kip: boolean;
  nomor_kip: string | null;
  penerima_kks: boolean;
  nomor_kks: string | null;
  nomor_kk: string | null;
  nama_ayah: string | null;
  nik_ayah: string | null;
  tahun_lahir_ayah: number | null;
  pendidikan_ayah: string | null;
  pekerjaan_ayah: string | null;
  penghasilan_ayah: string | null;
  nama_ibu: string | null;
  nik_ibu: string | null;
  tahun_lahir_ibu: number | null;
  pendidikan_ibu: string | null;
  pekerjaan_ibu: string | null;
  penghasilan_ibu: string | null;
  nama_wali: string | null;
  nik_wali: string | null;
  tahun_lahir_wali: number | null;
  pendidikan_wali: string | null;
  pekerjaan_wali: string | null;
  penghasilan_wali: string | null;
}

/** Kolom yang dikembalikan `daftar()`/`satu()`/`catat()` -- satu tempat, dipakai tiga kali. */
const KOLOM_SANTRI = `
  id::text, nis, nama_lengkap, nama_panggilan, jenis_kelamin,
  tempat_lahir, tanggal_lahir::text, unit_pendidikan_id::text,
  status, status_tinggal, tanggal_masuk::text, tanggal_keluar::text,
  alamat_asal, golongan_darah, catatan_alergi, catatan, created_at::text,
  nik, nisn, nipd, agama, kewarganegaraan, kebutuhan_khusus, anak_ke,
  jumlah_saudara, alat_transportasi, jarak_tempat_tinggal_km::text,
  telepon, hp, email, penerima_kip, nomor_kip, penerima_kks, nomor_kks,
  nomor_kk, nama_ayah, nik_ayah, tahun_lahir_ayah, pendidikan_ayah,
  pekerjaan_ayah, penghasilan_ayah, nama_ibu, nik_ibu, tahun_lahir_ibu,
  pendidikan_ibu, pekerjaan_ibu, penghasilan_ibu, nama_wali, nik_wali,
  tahun_lahir_wali, pendidikan_wali, pekerjaan_wali, penghasilan_wali
`;

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
      kondisi.push(`(nama_lengkap ILIKE $${params.length} OR nis ILIKE $${params.length} OR nisn ILIKE $${params.length})`);
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
      `SELECT ${KOLOM_SANTRI}
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
      `SELECT ${KOLOM_SANTRI}
         FROM ${S}.pesantren_santri
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  /**
   * Mendaftarkan santri baru.
   *
   * NIS unik ditegakkan basis data lewat indeks parsial
   * (`ux_pesantren_santri_nis`), NISN lewat `ux_pesantren_santri_nisn` --
   * pelanggaran keduanya ditangkap sebagai kode error PostgreSQL `23505` dan
   * diterjemahkan ke pesan yang dapat dipahami, bukan dilempar sebagai galat
   * SQL mentah.
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
    const ayah = masukan.ayah ?? {};
    const ibu = masukan.ibu ?? {};
    const wali = masukan.wali ?? {};
    try {
      const rows = await this.tenantDb.query<BarisSantri>(
        schemaName,
        `INSERT INTO ${S}.pesantren_santri
           (nis, nama_lengkap, nama_panggilan, jenis_kelamin, tempat_lahir,
            tanggal_lahir, unit_pendidikan_id, status_tinggal, tanggal_masuk,
            alamat_asal, golongan_darah, catatan_alergi, catatan,
            nik, nisn, nipd, agama, kewarganegaraan, kebutuhan_khusus,
            anak_ke, jumlah_saudara, alat_transportasi, jarak_tempat_tinggal_km,
            telepon, hp, email, penerima_kip, nomor_kip, penerima_kks, nomor_kks,
            nomor_kk,
            nama_ayah, nik_ayah, tahun_lahir_ayah, pendidikan_ayah, pekerjaan_ayah, penghasilan_ayah,
            nama_ibu, nik_ibu, tahun_lahir_ibu, pendidikan_ibu, pekerjaan_ibu, penghasilan_ibu,
            nama_wali, nik_wali, tahun_lahir_wali, pendidikan_wali, pekerjaan_wali, penghasilan_wali,
            created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_DATE), $10, $11, $12, $13,
                 $14, $15, $16, $17, COALESCE($18, 'WNI'), COALESCE($19, 'TIDAK_ADA'),
                 $20, $21, $22, $23,
                 $24, $25, $26, COALESCE($27, FALSE), $28, COALESCE($29, FALSE), $30,
                 $31,
                 $32, $33, $34, $35, $36, $37,
                 $38, $39, $40, $41, $42, $43,
                 $44, $45, $46, $47, $48, $49,
                 $50, $50)
         RETURNING ${KOLOM_SANTRI}`,
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
          bersihkan(masukan.nik),
          bersihkan(masukan.nisn),
          bersihkan(masukan.nipd),
          bersihkan(masukan.agama),
          bersihkan(masukan.kewarganegaraan),
          bersihkan(masukan.kebutuhanKhusus)?.toUpperCase() ?? null,
          masukan.anakKe ?? null,
          masukan.jumlahSaudara ?? null,
          bersihkan(masukan.alatTransportasi),
          masukan.jarakTempatTinggalKm ?? null,
          bersihkan(masukan.telepon),
          bersihkan(masukan.hp),
          bersihkan(masukan.email),
          masukan.penerimaKip ?? false,
          bersihkan(masukan.nomorKip),
          masukan.penerimaKks ?? false,
          bersihkan(masukan.nomorKks),
          bersihkan(masukan.nomorKk),
          ...kolomOrangTua(ayah),
          ...kolomOrangTua(ibu),
          ...kolomOrangTua(wali),
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
      if (isUniqueViolation(error, 'ux_pesantren_santri_nisn')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `NISN "${masukan.nisn}" sudah dipakai santri lain. Periksa kembali atau kosongkan bila belum punya NISN.`,
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

function kolomOrangTua(data: DataOrangTua): [string | null, string | null, number | null, string | null, string | null, string | null] {
  return [
    bersihkan(data.nama),
    bersihkan(data.nik),
    data.tahunLahir ?? null,
    bersihkan(data.pendidikan),
    bersihkan(data.pekerjaan),
    bersihkan(data.penghasilan),
  ];
}

/** Kode error PostgreSQL 23505 = unique_violation. */
function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
