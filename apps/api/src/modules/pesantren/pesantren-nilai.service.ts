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
  hitungRankingPadat,
  validasiKomponenNilai,
  validasiMataPelajaran,
  validasiNilai,
  validasiSkalaHuruf,
} from './pesantren-nilai';
import { buatRaporPdf } from './pesantren-rapor-pdf';

export interface BarisMataPelajaran {
  id: string;
  code: string;
  nama: string;
  kelompok: string | null;
  kode_mapel_dapodik: string | null;
  jenjang: string | null;
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

export interface BarisGradebook {
  santri_id: string;
  nis: string;
  nama_lengkap: string;
  nilai: Record<string, string | null>;
}

export interface BarisLegerNilai {
  santri_id: string;
  nis: string;
  nama_lengkap: string;
  nilai: Array<{
    mata_pelajaran_id: string;
    mata_pelajaran: string;
    nilai_akhir: number | null;
    huruf_mutu: string | null;
  }>;
  rata_rata: number | null;
  ranking: number | null;
  status_kenaikan: 'NAIK' | 'BELUM_DITENTUKAN';
  catatan_kenaikan: string;
}

export interface BarisTahunAjaran {
  id: string;
  code: string;
  name: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: string;
}

export interface RaporPdfResult {
  filename: string;
  buffer: Buffer;
}

@Injectable()
export class PesantrenNilaiService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftarTahunAjaran(schemaName: string): Promise<BarisTahunAjaran[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisTahunAjaran>(
      schemaName,
      `SELECT id::text, code, name, tanggal_mulai::text, tanggal_selesai::text, status
         FROM ${S}.pesantren_tahun_ajaran
        WHERE deleted_at IS NULL
        ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
                 tanggal_mulai DESC,
                 code DESC`,
    );
  }

  // --- Mata pelajaran -------------------------------------------------------

  async daftarMataPelajaran(schemaName: string): Promise<BarisMataPelajaran[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisMataPelajaran>(
      schemaName,
      `SELECT id::text, code, nama, kelompok, kode_mapel_dapodik, jenjang FROM ${S}.pesantren_mata_pelajaran
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
        `INSERT INTO ${S}.pesantren_mata_pelajaran (code, nama, kelompok, kode_mapel_dapodik, jenjang, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING id::text, code, nama, kelompok, kode_mapel_dapodik, jenjang`,
        [
          masukan.code!.trim(),
          masukan.nama!.trim(),
          bersihkan(masukan.kelompok),
          bersihkan(masukan.kodeMapelDapodik),
          bersihkan(masukan.jenjang),
          createdBy,
        ],
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

  async gradebook(
    schemaName: string,
    opsi: { rombonganId: string; mataPelajaranId: string; tahunAjaranId: string },
  ): Promise<{ komponen: BarisKomponenNilai[]; rows: BarisGradebook[] }> {
    const S = `"${schemaName}"`;
    const komponen = await this.daftarKomponen(schemaName, opsi.mataPelajaranId);
    const rows = await this.tenantDb.query<{
      santri_id: string;
      nis: string;
      nama_lengkap: string;
      komponen_id: string | null;
      nilai_angka: string | null;
    }>(
      schemaName,
      `SELECT s.id::text AS santri_id, s.nis, s.nama_lengkap,
              n.komponen_id::text, n.nilai_angka::text
         FROM ${S}.pesantren_rombongan_anggota ra
         JOIN ${S}.pesantren_santri s ON s.id = ra.santri_id
         LEFT JOIN ${S}.pesantren_nilai n
           ON n.santri_id = s.id
          AND n.tahun_ajaran_id = $2
          AND n.deleted_at IS NULL
          AND n.komponen_id IN (
            SELECT id FROM ${S}.pesantren_komponen_nilai
             WHERE mata_pelajaran_id = $3 AND deleted_at IS NULL
          )
        WHERE ra.rombongan_id = $1
          AND ra.tahun_ajaran_id = $2
          AND ra.status = 'AKTIF'
          AND ra.deleted_at IS NULL
          AND s.deleted_at IS NULL
        ORDER BY s.nama_lengkap ASC`,
      [opsi.rombonganId, opsi.tahunAjaranId, opsi.mataPelajaranId],
    );

    const bySantri = new Map<string, BarisGradebook>();
    for (const row of rows) {
      if (!bySantri.has(row.santri_id)) {
        bySantri.set(row.santri_id, {
          santri_id: row.santri_id,
          nis: row.nis,
          nama_lengkap: row.nama_lengkap,
          nilai: Object.fromEntries(komponen.map((item) => [item.id, null])),
        });
      }
      if (row.komponen_id) {
        bySantri.get(row.santri_id)!.nilai[row.komponen_id] = row.nilai_angka;
      }
    }

    return { komponen, rows: [...bySantri.values()] };
  }

  async catatNilaiMassal(
    schemaName: string,
    masukan: {
      tahunAjaranId: string;
      nilai: Array<{ santriId: string; komponenId: string; nilaiAngka?: number | null; catatan?: string }>;
    },
    createdBy: string,
  ): Promise<{ tersimpan: number; dilewati: number }> {
    let tersimpan = 0;
    let dilewati = 0;
    for (const item of masukan.nilai) {
      if (item.nilaiAngka === null || item.nilaiAngka === undefined || Number.isNaN(item.nilaiAngka)) {
        dilewati += 1;
        continue;
      }
      await this.catatNilai(
        schemaName,
        {
          santriId: item.santriId,
          komponenId: item.komponenId,
          tahunAjaranId: masukan.tahunAjaranId,
          nilaiAngka: item.nilaiAngka,
          catatan: item.catatan,
        },
        createdBy,
      );
      tersimpan += 1;
    }
    return { tersimpan, dilewati };
  }

  async leger(
    schemaName: string,
    opsi: { rombonganId: string; tahunAjaranId: string },
  ): Promise<BarisLegerNilai[]> {
    const S = `"${schemaName}"`;
    const baris = await this.tenantDb.query<{
      santri_id: string;
      nis: string;
      nama_lengkap: string;
      mata_pelajaran_id: string | null;
      mata_pelajaran: string | null;
      komponen_nama: string | null;
      nilai_angka: string | null;
      bobot_persen: string | null;
    }>(
      schemaName,
      `SELECT s.id::text AS santri_id, s.nis, s.nama_lengkap,
              mp.id::text AS mata_pelajaran_id, mp.nama AS mata_pelajaran,
              kn.nama AS komponen_nama, n.nilai_angka::text, kn.bobot_persen::text
         FROM ${S}.pesantren_rombongan_anggota ra
         JOIN ${S}.pesantren_santri s ON s.id = ra.santri_id
         LEFT JOIN ${S}.pesantren_nilai n
           ON n.santri_id = s.id
          AND n.tahun_ajaran_id = $2
          AND n.deleted_at IS NULL
         LEFT JOIN ${S}.pesantren_komponen_nilai kn
           ON kn.id = n.komponen_id
          AND kn.deleted_at IS NULL
         LEFT JOIN ${S}.pesantren_mata_pelajaran mp
           ON mp.id = kn.mata_pelajaran_id
          AND mp.deleted_at IS NULL
        WHERE ra.rombongan_id = $1
          AND ra.tahun_ajaran_id = $2
          AND ra.status = 'AKTIF'
          AND ra.deleted_at IS NULL
          AND s.deleted_at IS NULL
        ORDER BY s.nama_lengkap ASC, mp.nama ASC NULLS LAST, kn.sort_order ASC NULLS LAST`,
      [opsi.rombonganId, opsi.tahunAjaranId],
    );

    const skala = await this.daftarSkalaHuruf(schemaName);
    const perSantri = new Map<
      string,
      {
        santri_id: string;
        nis: string;
        nama_lengkap: string;
        mapel: Map<string, { mata_pelajaran: string; komponen: { nilai: number; bobot_persen: number }[] }>;
      }
    >();

    for (const row of baris) {
      if (!perSantri.has(row.santri_id)) {
        perSantri.set(row.santri_id, {
          santri_id: row.santri_id,
          nis: row.nis,
          nama_lengkap: row.nama_lengkap,
          mapel: new Map(),
        });
      }

      if (!row.mata_pelajaran_id || !row.mata_pelajaran || row.nilai_angka === null || row.bobot_persen === null) {
        continue;
      }

      const santri = perSantri.get(row.santri_id)!;
      if (!santri.mapel.has(row.mata_pelajaran_id)) {
        santri.mapel.set(row.mata_pelajaran_id, { mata_pelajaran: row.mata_pelajaran, komponen: [] });
      }
      santri.mapel.get(row.mata_pelajaran_id)!.komponen.push({
        nilai: Number(row.nilai_angka),
        bobot_persen: Number(row.bobot_persen),
      });
    }

    const hasil: BarisLegerNilai[] = [...perSantri.values()].map((santri) => {
      const nilai = [...santri.mapel.entries()].map(([mataPelajaranId, data]) => {
        const totalBobot = data.komponen.reduce((total, item) => total + item.bobot_persen, 0);
        const nilaiAkhir =
          totalBobot > 0
            ? Math.round((data.komponen.reduce((total, item) => total + item.nilai * item.bobot_persen, 0) / totalBobot) * 100) / 100
            : null;
        return {
          mata_pelajaran_id: mataPelajaranId,
          mata_pelajaran: data.mata_pelajaran,
          nilai_akhir: nilaiAkhir,
          huruf_mutu: nilaiAkhir !== null ? cariHurufMutu(nilaiAkhir, skala) : null,
        };
      });
      const nilaiAkhir = nilai.map((item) => item.nilai_akhir).filter((value): value is number => value !== null);
      const rataRata = nilaiAkhir.length
        ? Math.round((nilaiAkhir.reduce((total, value) => total + value, 0) / nilaiAkhir.length) * 100) / 100
        : null;
      return {
        santri_id: santri.santri_id,
        nis: santri.nis,
        nama_lengkap: santri.nama_lengkap,
        nilai,
        rata_rata: rataRata,
        ranking: null,
        status_kenaikan: rataRata !== null && rataRata >= 70 ? 'NAIK' : 'BELUM_DITENTUKAN',
        catatan_kenaikan:
          rataRata !== null && rataRata >= 70
            ? 'Rekomendasi awal sistem; keputusan akhir tetap ditetapkan wali kelas dan kepala madrasah.'
            : 'Belum cukup data atau perlu keputusan wali kelas/kepala madrasah.',
      };
    });

    const ranking = hitungRankingPadat(hasil.map((row) => ({ id: row.santri_id, rataRata: row.rata_rata })));
    return hasil
      .map((row) => ({ ...row, ranking: ranking.get(row.santri_id) ?? null }))
      .sort((a, b) => (a.ranking ?? Number.MAX_SAFE_INTEGER) - (b.ranking ?? Number.MAX_SAFE_INTEGER) || a.nama_lengkap.localeCompare(b.nama_lengkap));
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

  async raporPdf(schemaName: string, santriId: string, tahunAjaranId: string): Promise<RaporPdfResult> {
    const S = `"${schemaName}"`;
    const santri = await this.tenantDb.queryOne<{ nis: string; nama_lengkap: string }>(
      schemaName,
      `SELECT nis, nama_lengkap FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [santriId],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }

    const tahun = await this.tenantDb.queryOne<{ code: string; name: string }>(
      schemaName,
      `SELECT code, name FROM ${S}.pesantren_tahun_ajaran WHERE id = $1 AND deleted_at IS NULL`,
      [tahunAjaranId],
    );
    if (!tahun) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tahun ajaran tidak ditemukan.');
    }

    const profil = await this.tenantDb.queryOne<{ nama_tampilan: string | null; alamat_publik: string | null }>(
      schemaName,
      `SELECT nama_tampilan, alamat_publik FROM ${S}.pesantren_website_setting WHERE singleton = TRUE`,
    );
    const rows = await this.rapor(schemaName, santriId, tahunAjaranId);
    const nilaiAkhir = rows.map((row) => row.nilai_akhir).filter((value): value is number => value !== null);
    const sebaran = new Map<string, number>();
    for (const row of rows) {
      if (row.huruf_mutu) sebaran.set(row.huruf_mutu, (sebaran.get(row.huruf_mutu) ?? 0) + 1);
    }
    const predikatDominan = [...sebaran.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const rataRata = nilaiAkhir.length
      ? Math.round((nilaiAkhir.reduce((total, value) => total + value, 0) / nilaiAkhir.length) * 100) / 100
      : null;

    const buffer = buatRaporPdf({
      pondok: {
        nama: profil?.nama_tampilan ?? 'Pondok Pesantren',
        alamat: profil?.alamat_publik ?? '-',
      },
      santri: {
        nis: santri.nis,
        nama: santri.nama_lengkap,
      },
      tahunAjaran: {
        nama: tahun.name,
      },
      rows: rows.map((row) => ({
        mata_pelajaran: row.mata_pelajaran,
        nilai_akhir: row.nilai_akhir,
        huruf_mutu: row.huruf_mutu,
      })),
      ringkasan: {
        jumlahMapel: rows.length,
        rataRata,
        predikatDominan,
      },
      tanggalCetak: new Date().toISOString().slice(0, 10),
    });

    return {
      filename: `rapor-${santri.nis || santriId}-${tahun.code}.pdf`,
      buffer,
    };
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
