/**
 * Portal wali (EP-K) — sisi basis datanya.
 *
 * Satu aturan menentukan seluruh berkas ini: **wali hanya melihat anaknya
 * sendiri.** Pola sama dengan `cooperative-portal.service.ts` — `santriId`
 * TIDAK PERNAH dipercaya begitu saja dari permintaan; setiap metode
 * memverifikasi kepemilikan lewat `pesantren_santri_wali` sebelum membaca
 * apa pun, dan santri yang bukan miliknya dijawab NOT_FOUND, bukan
 * FORBIDDEN — wali lain tidak berhak tahu bahwa santri itu ADA, apalagi
 * datanya.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PesantrenNilaiService } from './pesantren-nilai.service';
import { PesantrenPrestasiService } from './pesantren-prestasi.service';

export interface ProfilWali {
  wali_id: string;
  nama: string;
  hubungan: string;
}

export interface AnakSaya {
  santri_id: string;
  nama_lengkap: string;
  nis: string;
  status: string;
  adalah_wali_utama: boolean;
}

@Injectable()
export class PesantrenPortalWaliService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly nilaiService: PesantrenNilaiService,
    private readonly prestasiService: PesantrenPrestasiService,
  ) {}

  /**
   * Menemukan baris wali milik pengguna yang sedang masuk.
   *
   * `pesantren_wali.user_subject_id` adalah id `user_subject` TENANT — bukan
   * `platform_user_id` dari klaim JWT `sub` (`AuthenticatedUser.userId`).
   * Keduanya ruang id yang berbeda; langkah pertama WAJIB menerjemahkan satu
   * ke yang lain, persis seperti `TenantBootstrapService.assignAdditionalRole()`.
   * Salah menyamakan keduanya adalah cacat yang sama yang tertangkap EP-J
   * pada `disetujui_oleh` — di sini dicegah sebelum terjadi, bukan diperbaiki
   * sesudah live test.
   */
  async waliDiriSendiri(schemaName: string, platformUserId: string): Promise<ProfilWali> {
    const S = `"${schemaName}"`;
    const subject = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id FROM ${S}.user_subject WHERE platform_user_id = $1`,
      [platformUserId],
    );
    if (!subject) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Akun Anda tidak dikenali pada ruang kerja ini.');
    }

    const wali = await this.tenantDb.queryOne<ProfilWali>(
      schemaName,
      `SELECT id AS wali_id, nama, hubungan
         FROM ${S}.pesantren_wali
        WHERE user_subject_id = $1 AND deleted_at IS NULL`,
      [subject.id],
    );
    if (!wali) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun Anda tidak terhubung ke data wali santri mana pun.',
      );
    }
    return wali;
  }

  async anakSaya(schemaName: string, waliId: string): Promise<AnakSaya[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<AnakSaya>(
      schemaName,
      `SELECT s.id AS santri_id, s.nama_lengkap, s.nis, s.status, sw.adalah_wali_utama
         FROM ${S}.pesantren_santri_wali sw
         JOIN ${S}.pesantren_santri s ON s.id = sw.santri_id
        WHERE sw.wali_id = $1 AND sw.deleted_at IS NULL AND s.deleted_at IS NULL
        ORDER BY s.nama_lengkap ASC`,
      [waliId],
    );
  }

  /** Memverifikasi santri ini benar anak dari wali ini. Melempar NOT_FOUND bila bukan. */
  private async verifikasiKepemilikan(schemaName: string, waliId: string, santriId: string): Promise<void> {
    const S = `"${schemaName}"`;
    const relasi = await this.tenantDb.queryOne(
      schemaName,
      `SELECT 1 FROM ${S}.pesantren_santri_wali
        WHERE wali_id = $1 AND santri_id = $2 AND deleted_at IS NULL`,
      [waliId, santriId],
    );
    if (!relasi) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }
  }

  async detailAnak(schemaName: string, waliId: string, santriId: string) {
    await this.verifikasiKepemilikan(schemaName, waliId, santriId);
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne(
      schemaName,
      `SELECT id::text, nis, nama_lengkap, nama_panggilan, jenis_kelamin,
              tempat_lahir, tanggal_lahir::text, status, status_tinggal,
              tanggal_masuk::text, golongan_darah, catatan_alergi
         FROM ${S}.pesantren_santri
        WHERE id = $1 AND deleted_at IS NULL`,
      [santriId],
    );
  }

  async presensiAnak(schemaName: string, waliId: string, santriId: string, opsi: { halaman: number; ukuranHalaman: number }) {
    await this.verifikasiKepemilikan(schemaName, waliId, santriId);
    const S = `"${schemaName}"`;
    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    const items = await this.tenantDb.query(
      schemaName,
      `SELECT tanggal::text, jenis, status, keterangan
         FROM ${S}.pesantren_presensi
        WHERE santri_id = $1 AND deleted_at IS NULL
        ORDER BY tanggal DESC
        LIMIT $2 OFFSET $3`,
      [santriId, opsi.ukuranHalaman, offset],
    );
    return { items };
  }

  async tahfizAnak(schemaName: string, waliId: string, santriId: string) {
    await this.verifikasiKepemilikan(schemaName, waliId, santriId);
    const S = `"${schemaName}"`;
    const capaian = await this.tenantDb.queryOne<{ juz_tertinggi: number | null; total_setoran: string }>(
      schemaName,
      `SELECT
         (SELECT MAX(juz) FROM ${S}.pesantren_tahfiz_setoran
           WHERE santri_id = $1 AND jenis = 'SETORAN' AND predikat = 'LANCAR' AND deleted_at IS NULL) AS juz_tertinggi,
         (SELECT COUNT(*) FROM ${S}.pesantren_tahfiz_setoran WHERE santri_id = $1 AND deleted_at IS NULL)::text AS total_setoran`,
      [santriId],
    );
    const riwayat = await this.tenantDb.query(
      schemaName,
      `SELECT tanggal::text, jenis, juz, predikat
         FROM ${S}.pesantren_tahfiz_setoran
        WHERE santri_id = $1 AND deleted_at IS NULL
        ORDER BY tanggal DESC
        LIMIT 25`,
      [santriId],
    );
    return {
      juzTertinggi: capaian?.juz_tertinggi ?? null,
      totalSetoran: Number(capaian?.total_setoran ?? 0),
      riwayat,
    };
  }

  async izinAnak(schemaName: string, waliId: string, santriId: string) {
    await this.verifikasiKepemilikan(schemaName, waliId, santriId);
    const S = `"${schemaName}"`;
    return this.tenantDb.query(
      schemaName,
      `SELECT id::text, jenis, alasan, tanggal_mulai::text, tanggal_selesai_rencana::text,
              status, catatan_penyetuju
         FROM ${S}.pesantren_izin
        WHERE santri_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      [santriId],
    );
  }

  /**
   * Saldo dan riwayat dompet satu anak (EP-L) — baca saja. Top-up dan
   * belanja tetap hanya lewat layar pengurus (`PesantrenDompetController`);
   * portal ini sengaja tidak punya satu pun endpoint tulis, sebab wali
   * membayarkan sesuatu lewat portal berarti payment gateway sungguhan --
   * belum ada, dan §6 melarang mengklaim yang belum ada.
   */
  async dompetAnak(schemaName: string, waliId: string, santriId: string) {
    await this.verifikasiKepemilikan(schemaName, waliId, santriId);
    const S = `"${schemaName}"`;
    const dompet = await this.tenantDb.queryOne<{ id: string; saldo: string; batas_harian: string | null }>(
      schemaName,
      `SELECT id::text, saldo::text, batas_harian::text
         FROM ${S}.pesantren_dompet
        WHERE santri_id = $1 AND deleted_at IS NULL`,
      [santriId],
    );
    if (!dompet) {
      return { adaDompet: false, saldo: null, batasHarian: null, riwayat: [] };
    }
    const riwayat = await this.tenantDb.query(
      schemaName,
      `SELECT jenis, jumlah::text, saldo_sesudah::text, keterangan, created_at::text
         FROM ${S}.pesantren_dompet_transaksi
        WHERE dompet_id = $1
        ORDER BY created_at DESC
        LIMIT 25`,
      [dompet.id],
    );
    return { adaDompet: true, saldo: dompet.saldo, batasHarian: dompet.batas_harian, riwayat };
  }

  /**
   * Rapor satu anak (EP-O) — memanggil `PesantrenNilaiService.rapor()`
   * langsung, bukan menuliskan ulang perhitungan nilai berbobot di sini.
   * Menjawab permintaan eksplisit: wali yang beranak lebih dari satu dapat
   * memanggil ini untuk SETIAP anaknya satu per satu (lewat `anakSaya()`
   * lebih dulu untuk tahu daftar anaknya) — bukan satu panggilan yang
   * mengembalikan rapor seluruh anak sekaligus, supaya kepemilikan tetap
   * diverifikasi per anak, bukan diasumsikan dari daftar.
   */
  async raporAnak(schemaName: string, waliId: string, santriId: string, tahunAjaranId: string) {
    await this.verifikasiKepemilikan(schemaName, waliId, santriId);
    return this.nilaiService.rapor(schemaName, santriId, tahunAjaranId);
  }

  /**
   * Riwayat pelanggaran satu anak (EP-S1) -- baca saja, menjawab
   * permintaan eksplisit wali mendapat kabar bila anaknya "melanggar
   * sesuatu". Hukuman disertakan per baris lewat sub-kueri, bukan
   * endpoint terpisah, sebab wali membacanya sebagai satu riwayat --
   * ia tidak mengelola hukuman seperti pengurus.
   */
  async pelanggaranAnak(schemaName: string, waliId: string, santriId: string) {
    await this.verifikasiKepemilikan(schemaName, waliId, santriId);
    const S = `"${schemaName}"`;
    return this.tenantDb.query(
      schemaName,
      `SELECT p.id::text, p.tanggal::text, p.keterangan, p.poin, p.status,
              jp.nama AS jenis_pelanggaran, jp.kategori
         FROM ${S}.pesantren_pelanggaran p
         JOIN ${S}.pesantren_jenis_pelanggaran jp ON jp.id = p.jenis_pelanggaran_id
        WHERE p.santri_id = $1 AND p.deleted_at IS NULL
        ORDER BY p.tanggal DESC`,
      [santriId],
    );
  }

  /**
   * Rekap prestasi dan penghargaan satu anak (EP-S5) -- baca saja,
   * memanggil `PesantrenPrestasiService.rekapSantri()` langsung, bukan
   * menuliskan ulang kuerinya di sini.
   */
  async prestasiAnak(schemaName: string, waliId: string, santriId: string) {
    await this.verifikasiKepemilikan(schemaName, waliId, santriId);
    return this.prestasiService.rekapSantri(schemaName, santriId);
  }
}
