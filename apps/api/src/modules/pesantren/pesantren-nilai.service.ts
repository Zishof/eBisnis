/**
 * Nilai dan rapor (EP-O) — sisi basis datanya. Pola sama dengan
 * `pesantren-santri.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanKomponenNilai,
  MasukanMataPelajaran,
  MasukanNilai,
  MasukanSkalaHuruf,
  cariHurufMutu,
  hitungRingkasanRapor,
  validasiAlasanPembatalanRapor,
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

export interface BarisLegerRapor {
  santri_id: string;
  nis: string | null;
  nama_lengkap: string;
  rombongan_id: string | null;
  rombongan: string | null;
  jumlah_mapel: number;
  rata_rata: number | null;
  predikat_dominan: string | null;
  status_rapor: 'FINAL' | 'DRAFT';
  peringkat: number | null;
  verification_code: string | null;
  checksum: string | null;
  finalized_at: string | null;
}

export interface BarisRaporFinalisasi {
  id: string;
  santri_id: string;
  tahun_ajaran_id: string;
  status: 'FINALIZED' | 'VOID';
  snapshot: BarisNilaiRapor[];
  summary: Record<string, unknown>;
  checksum: string;
  verification_code: string;
  qr_payload: string;
  catatan_finalisasi: string | null;
  wali_kelas_user_id: string | null;
  wali_kelas_signed_at: string | null;
  kepala_user_id: string | null;
  kepala_signed_at: string | null;
  finalized_at: string;
  finalized_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export interface BarisNilai {
  id: string;
  santri_id: string;
  komponen_id: string;
  nilai_angka: string;
}

export interface BarisTahunAjaran {
  id: string;
  code: string;
  name: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: string;
}

export interface MasukanFinalisasiRapor {
  catatanFinalisasi?: string | null;
  waliKelasUserId?: string | null;
  kepalaUserId?: string | null;
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
    const final = await this.finalisasiAktif(schemaName, masukan.santriId!, masukan.tahunAjaranId!);
    if (final) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Rapor santri pada tahun ajaran ini sudah difinalisasi. Batalkan finalisasi terlebih dahulu sebelum mengubah nilai.',
        { finalisasiId: final.id, verificationCode: final.verification_code },
      );
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

  async legerRapor(schemaName: string, tahunAjaranId: string, rombonganId?: string | null): Promise<BarisLegerRapor[]> {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<{
      santri_id: string;
      nis: string | null;
      nama_lengkap: string;
      rombongan_id: string | null;
      rombongan: string | null;
    }>(
      schemaName,
      `SELECT DISTINCT s.id::text AS santri_id, s.nis, s.nama_lengkap,
              r.id::text AS rombongan_id,
              CASE WHEN r.id IS NULL THEN NULL ELSE concat_ws(' - ', r.tingkat, r.nama) END AS rombongan
         FROM ${S}.pesantren_santri s
         LEFT JOIN ${S}.pesantren_anggota_rombongan ar
           ON ar.santri_id = s.id
          AND ar.deleted_at IS NULL
          AND ar.status = 'AKTIF'
         LEFT JOIN ${S}.pesantren_rombongan r
           ON r.id = ar.rombongan_id
          AND r.deleted_at IS NULL
        WHERE s.deleted_at IS NULL
          AND s.status = 'AKTIF'
          AND ($1::uuid IS NULL OR r.id = $1::uuid)
        ORDER BY s.nama_lengkap ASC`,
      [rombonganId || null],
    );

    const leger: BarisLegerRapor[] = [];
    for (const row of rows) {
      const final = await this.finalisasiAktif(schemaName, row.santri_id, tahunAjaranId);
      const snapshot = final?.snapshot ?? await this.rapor(schemaName, row.santri_id, tahunAjaranId);
      const summary = hitungRingkasanRapor(snapshot);
      leger.push({
        santri_id: row.santri_id,
        nis: row.nis,
        nama_lengkap: row.nama_lengkap,
        rombongan_id: row.rombongan_id,
        rombongan: row.rombongan,
        jumlah_mapel: summary.jumlahMapel,
        rata_rata: summary.rataRata,
        predikat_dominan: summary.predikatDominan,
        status_rapor: final ? 'FINAL' : 'DRAFT',
        peringkat: null,
        verification_code: final?.verification_code ?? null,
        checksum: final?.checksum ?? null,
        finalized_at: final?.finalized_at ?? null,
      });
    }
    return beriPeringkatLeger(leger);
  }

  async finalisasiAktif(schemaName: string, santriId: string, tahunAjaranId: string): Promise<BarisRaporFinalisasi | null> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<BarisRaporFinalisasi>(
      schemaName,
      `SELECT id::text, santri_id::text, tahun_ajaran_id::text, status,
              snapshot, summary, checksum, verification_code, qr_payload, catatan_finalisasi,
              wali_kelas_user_id::text, wali_kelas_signed_at::text,
              kepala_user_id::text, kepala_signed_at::text,
              finalized_at::text, finalized_by::text, voided_at::text, voided_by::text, void_reason
         FROM ${S}.pesantren_rapor_finalisasi
        WHERE santri_id = $1 AND tahun_ajaran_id = $2 AND status = 'FINALIZED' AND deleted_at IS NULL
        ORDER BY finalized_at DESC
        LIMIT 1`,
      [santriId, tahunAjaranId],
    );
    return row;
  }

  async finalisasiRapor(
    schemaName: string,
    santriId: string,
    tahunAjaranId: string,
    masukan: MasukanFinalisasiRapor,
    finalizedBy: string,
  ): Promise<BarisRaporFinalisasi> {
    const S = `"${schemaName}"`;
    const santri = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [santriId],
    );
    if (!santri) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    const tahun = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_tahun_ajaran WHERE id = $1 AND deleted_at IS NULL`,
      [tahunAjaranId],
    );
    if (!tahun) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tahun ajaran tidak ditemukan.');

    const snapshot = await this.rapor(schemaName, santriId, tahunAjaranId);
    if (snapshot.length === 0) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Rapor belum memiliki nilai. Isi nilai terlebih dahulu sebelum finalisasi.',
      );
    }
    const summary = hitungRingkasanRapor(snapshot);
    const checksum = checksumRapor({ santriId, tahunAjaranId, snapshot, summary });
    const verificationCode = randomBytes(16).toString('hex');
    const qrPayload = `ebisnis://rapor/${verificationCode}?checksum=${checksum.slice(0, 16)}`;

    try {
      const rows = await this.tenantDb.query<BarisRaporFinalisasi>(
        schemaName,
        `INSERT INTO ${S}.pesantren_rapor_finalisasi (
           santri_id, tahun_ajaran_id, snapshot, summary, checksum, verification_code, qr_payload,
           catatan_finalisasi, wali_kelas_user_id, wali_kelas_signed_at, kepala_user_id, kepala_signed_at,
           finalized_by, created_by, updated_by
         )
         VALUES (
           $1, $2, $3::jsonb, $4::jsonb, $5, $6, $7,
           $8, $9, CASE WHEN $9::uuid IS NULL THEN NULL ELSE now() END,
           $10, CASE WHEN $10::uuid IS NULL THEN NULL ELSE now() END,
           $11, $11, $11
         )
         RETURNING id::text, santri_id::text, tahun_ajaran_id::text, status,
                   snapshot, summary, checksum, verification_code, qr_payload, catatan_finalisasi,
                   wali_kelas_user_id::text, wali_kelas_signed_at::text,
                   kepala_user_id::text, kepala_signed_at::text,
                   finalized_at::text, finalized_by::text, voided_at::text, voided_by::text, void_reason`,
        [
          santriId,
          tahunAjaranId,
          JSON.stringify(snapshot),
          JSON.stringify(summary),
          checksum,
          verificationCode,
          qrPayload,
          bersihkan(masukan.catatanFinalisasi),
          bersihkan(masukan.waliKelasUserId),
          bersihkan(masukan.kepalaUserId),
          finalizedBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_rapor_finalisasi_aktif')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Rapor santri pada tahun ajaran ini sudah difinalisasi.');
      }
      throw error;
    }
  }

  async batalkanFinalisasi(schemaName: string, finalisasiId: string, reason: string, voidedBy: string): Promise<BarisRaporFinalisasi> {
    const galat = validasiAlasanPembatalanRapor(reason);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisRaporFinalisasi>(
      schemaName,
      `UPDATE ${S}.pesantren_rapor_finalisasi
          SET status = 'VOID',
              voided_at = now(),
              voided_by = $2,
              void_reason = $3,
              updated_at = now(),
              updated_by = $2,
              version = version + 1
        WHERE id = $1 AND status = 'FINALIZED' AND deleted_at IS NULL
        RETURNING id::text, santri_id::text, tahun_ajaran_id::text, status,
                  snapshot, summary, checksum, verification_code, qr_payload, catatan_finalisasi,
                  wali_kelas_user_id::text, wali_kelas_signed_at::text,
                  kepala_user_id::text, kepala_signed_at::text,
                  finalized_at::text, finalized_by::text, voided_at::text, voided_by::text, void_reason`,
      [finalisasiId, voidedBy, reason.trim()],
    );
    if (!rows[0]) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Finalisasi rapor aktif tidak ditemukan.');
    }
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

function beriPeringkatLeger(rows: BarisLegerRapor[]): BarisLegerRapor[] {
  const terurut = [...rows].sort((a, b) => {
    const nilaiA = a.rata_rata ?? -1;
    const nilaiB = b.rata_rata ?? -1;
    return nilaiB - nilaiA || a.nama_lengkap.localeCompare(b.nama_lengkap) || (a.nis ?? '').localeCompare(b.nis ?? '');
  });
  let peringkat = 0;
  let posisi = 0;
  let nilaiSebelumnya: number | null | undefined;
  for (const row of terurut) {
    posisi += 1;
    if (row.rata_rata === null) {
      row.peringkat = null;
      continue;
    }
    if (row.rata_rata !== nilaiSebelumnya) {
      peringkat = posisi;
      nilaiSebelumnya = row.rata_rata;
    }
    row.peringkat = peringkat;
  }
  return terurut;
}

function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}

function isExclusionViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23P01' && e?.constraint === constraintName;
}

function checksumRapor(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
