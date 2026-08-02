/**
 * Nilai dan rapor (EP-O) — sisi basis datanya. Pola sama dengan
 * `pesantren-santri.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanKomponenNilai,
  MasukanMataPelajaran,
  MasukanNilai,
  MasukanSkalaHuruf,
  cariHurufMutu,
  validasiKomponenNilai,
  validasiMataPelajaran,
  validasiNilai,
  validasiSkalaHuruf,
} from './pesantren-nilai';

export interface BarisMataPelajaran {
  id: string;
  code: string;
  nama: string;
  kelompok: string | null;
}

export interface BarisKomponenNilai {
  id: string;
  mata_pelajaran_id: string;
  kode: string;
  nama: string;
  bobot_persen: string;
}

export interface BarisSkalaHuruf {
  id: string;
  huruf: string;
  nilai_minimum: string;
  nilai_maksimum: string;
  keterangan: string | null;
}

export interface BarisNilaiRapor {
  mata_pelajaran: string;
  komponen: { nama: string; nilai: number; bobot_persen: number }[];
  nilai_akhir: number | null;
  huruf_mutu: string | null;
}

export interface BarisNilai {
  id: string;
  santri_id: string;
  komponen_id: string;
  nilai_angka: string;
}

@Injectable()
export class PesantrenNilaiService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Mata pelajaran -------------------------------------------------------

  async daftarMataPelajaran(schemaName: string): Promise<BarisMataPelajaran[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisMataPelajaran>(
      schemaName,
      `SELECT id::text, code, nama, kelompok FROM ${S}.pesantren_mata_pelajaran
        WHERE deleted_at IS NULL ORDER BY sort_order ASC, nama ASC`,
    );
  }

  async catatMataPelajaran(schemaName: string, masukan: MasukanMataPelajaran, createdBy: string): Promise<BarisMataPelajaran> {
    const galat = validasiMataPelajaran(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisMataPelajaran>(
        schemaName,
        `INSERT INTO ${S}.pesantren_mata_pelajaran (code, nama, kelompok, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING id::text, code, nama, kelompok`,
        [masukan.code!.trim(), masukan.nama!.trim(), bersihkan(masukan.kelompok), createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_mata_pelajaran_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode mata pelajaran "${masukan.code}" sudah dipakai.`);
      }
      throw error;
    }
  }

  // --- Komponen nilai ---------------------------------------------------------

  async daftarKomponen(schemaName: string, mataPelajaranId: string): Promise<BarisKomponenNilai[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisKomponenNilai>(
      schemaName,
      `SELECT id::text, mata_pelajaran_id::text, kode, nama, bobot_persen::text
         FROM ${S}.pesantren_komponen_nilai
        WHERE mata_pelajaran_id = $1 AND deleted_at IS NULL
        ORDER BY sort_order ASC`,
      [mataPelajaranId],
    );
  }

  async catatKomponen(
    schemaName: string,
    mataPelajaranId: string,
    masukan: MasukanKomponenNilai,
    createdBy: string,
  ): Promise<BarisKomponenNilai> {
    const galat = validasiKomponenNilai(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const mapel = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_mata_pelajaran WHERE id = $1 AND deleted_at IS NULL`,
      [mataPelajaranId],
    );
    if (!mapel) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Mata pelajaran tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisKomponenNilai>(
        schemaName,
        `INSERT INTO ${S}.pesantren_komponen_nilai (mata_pelajaran_id, kode, nama, bobot_persen, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id::text, mata_pelajaran_id::text, kode, nama, bobot_persen::text`,
        [mataPelajaranId, masukan.kode!.trim(), masukan.nama!.trim(), masukan.bobotPersen, createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_komponen_nilai_kode')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode komponen "${masukan.kode}" sudah dipakai pada mata pelajaran ini.`);
      }
      throw error;
    }
  }

  /**
   * Total bobot komponen aktif satu mata pelajaran.
   *
   * TIDAK ditegakkan basis data sebagai batasan keras -- guru boleh sengaja
   * belum melengkapi seluruh komponen di tengah semester. Dipakai service
   * (dan dapat dipakai UI) untuk MEMPERINGATKAN, bukan menolak.
   */
  async totalBobot(schemaName: string, mataPelajaranId: string): Promise<number> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ total: string }>(
      schemaName,
      `SELECT COALESCE(SUM(bobot_persen), 0)::text AS total FROM ${S}.pesantren_komponen_nilai
        WHERE mata_pelajaran_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [mataPelajaranId],
    );
    return Number(row?.total ?? 0);
  }

  // --- Skala huruf ------------------------------------------------------------

  async daftarSkalaHuruf(schemaName: string): Promise<BarisSkalaHuruf[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisSkalaHuruf>(
      schemaName,
      `SELECT id::text, huruf, nilai_minimum::text, nilai_maksimum::text, keterangan
         FROM ${S}.pesantren_skala_huruf
        WHERE deleted_at IS NULL
        ORDER BY nilai_minimum DESC`,
    );
  }

  async catatSkalaHuruf(schemaName: string, masukan: MasukanSkalaHuruf, createdBy: string): Promise<BarisSkalaHuruf> {
    const galat = validasiSkalaHuruf(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisSkalaHuruf>(
        schemaName,
        `INSERT INTO ${S}.pesantren_skala_huruf (huruf, nilai_minimum, nilai_maksimum, keterangan, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id::text, huruf, nilai_minimum::text, nilai_maksimum::text, keterangan`,
        [masukan.huruf!.trim(), masukan.nilaiMinimum, masukan.nilaiMaksimum, bersihkan(masukan.keterangan), createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_skala_huruf_huruf')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Huruf mutu "${masukan.huruf}" sudah dipakai.`);
      }
      if (isExclusionViolation(error, 'ex_pesantren_skala_huruf_tanpa_tumpang_tindih')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Rentang nilai ${masukan.nilaiMinimum}-${masukan.nilaiMaksimum} tumpang tindih dengan skala huruf lain yang sudah ada.`,
        );
      }
      throw error;
    }
  }

  // --- Nilai --------------------------------------------------------------

  async catatNilai(schemaName: string, masukan: MasukanNilai, createdBy: string): Promise<BarisNilai> {
    const galat = validasiNilai(masukan);
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
    const komponen = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_komponen_nilai WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.komponenId],
    );
    if (!komponen) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Komponen nilai tidak ditemukan.');
    }

    // Guru memperbaiki nilai lewat UPSERT -- indeks unik menegakkan satu
    // baris per (santri, komponen, tahun ajaran); mencatat ulang berarti
    // memperbaiki, bukan menduakan.
    const rows = await this.tenantDb.query<BarisNilai>(
      schemaName,
      `INSERT INTO ${S}.pesantren_nilai (santri_id, komponen_id, tahun_ajaran_id, nilai_angka, catatan, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (santri_id, komponen_id, tahun_ajaran_id) WHERE deleted_at IS NULL
       DO UPDATE SET nilai_angka = EXCLUDED.nilai_angka, catatan = EXCLUDED.catatan,
                     updated_at = now(), updated_by = $6, version = ${S}.pesantren_nilai.version + 1
       RETURNING id::text, santri_id::text, komponen_id::text, nilai_angka::text`,
      [masukan.santriId, masukan.komponenId, masukan.tahunAjaranId, masukan.nilaiAngka, bersihkan(masukan.catatan), createdBy],
    );
    return rows[0];
  }

  /**
   * Rapor satu santri untuk satu tahun ajaran: seluruh mata pelajaran yang
   * punya nilai, nilai akhir berbobot, dan huruf mutunya.
   *
   * Nilai akhir DIHITUNG di sini dari komponen — tidak pernah disimpan
   * berduplikasi, pola yang sama dengan capaian tahfiz (EP-I).
   */
  async rapor(schemaName: string, santriId: string, tahunAjaranId: string): Promise<BarisNilaiRapor[]> {
    const S = `"${schemaName}"`;
    const baris = await this.tenantDb.query<{
      mata_pelajaran: string;
      komponen_nama: string;
      nilai_angka: string;
      bobot_persen: string;
    }>(
      schemaName,
      `SELECT mp.nama AS mata_pelajaran, kn.nama AS komponen_nama,
              n.nilai_angka::text, kn.bobot_persen::text
         FROM ${S}.pesantren_nilai n
         JOIN ${S}.pesantren_komponen_nilai kn ON kn.id = n.komponen_id
         JOIN ${S}.pesantren_mata_pelajaran mp ON mp.id = kn.mata_pelajaran_id
        WHERE n.santri_id = $1 AND n.tahun_ajaran_id = $2 AND n.deleted_at IS NULL
        ORDER BY mp.nama ASC, kn.sort_order ASC`,
      [santriId, tahunAjaranId],
    );

    const skala = await this.daftarSkalaHuruf(schemaName);

    const perMapel = new Map<string, { komponen: { nama: string; nilai: number; bobot_persen: number }[] }>();
    for (const b of baris) {
      if (!perMapel.has(b.mata_pelajaran)) perMapel.set(b.mata_pelajaran, { komponen: [] });
      perMapel.get(b.mata_pelajaran)!.komponen.push({
        nama: b.komponen_nama,
        nilai: Number(b.nilai_angka),
        bobot_persen: Number(b.bobot_persen),
      });
    }

    return [...perMapel.entries()].map(([mataPelajaran, data]) => {
      const totalBobot = data.komponen.reduce((t, k) => t + k.bobot_persen, 0);
      const nilaiAkhir =
        totalBobot > 0
          ? Math.round((data.komponen.reduce((t, k) => t + k.nilai * k.bobot_persen, 0) / totalBobot) * 100) / 100
          : null;
      return {
        mata_pelajaran: mataPelajaran,
        komponen: data.komponen,
        nilai_akhir: nilaiAkhir,
        huruf_mutu: nilaiAkhir !== null ? cariHurufMutu(nilaiAkhir, skala) : null,
      };
    });
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

function isExclusionViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23P01' && e?.constraint === constraintName;
}
