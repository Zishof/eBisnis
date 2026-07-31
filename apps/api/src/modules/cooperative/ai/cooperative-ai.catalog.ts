/**
 * Keperluan AI koperasi.
 *
 * Ditulis dalam bentuk `AiUseCase` milik Core, **belum didaftarkan** — daftar
 * keperluan Core adalah berkas bersama yang dilarang disunting sesi ini
 * (panduan koordinasi §3). Saat digabungkan, yang diperlukan hanya menambahkan
 * `...COOPERATIVE_AI_USE_CASES` ke `AI_USE_CASES`.
 *
 * ## Larangan yang berlaku, dan mengapa bentuknya begini
 *
 * AI tidak boleh melakukan pembayaran, posting jurnal, persetujuan,
 * penghapusan, maupun perubahan hak akses. Larangan itu tidak ditegakkan
 * dengan mengingatkan penulis kode melainkan dengan bentuk: `outputKind` hanya
 * mengenal `DRAFT`, `ANALYSIS`, dan `RECOMMENDATION`. Tidak ada nilai yang
 * berarti "kerjakan".
 *
 * ## Yang khas pada koperasi
 *
 * Dua keperluan yang tampak menggoda sengaja **tidak** dibuat, dan alasannya
 * dicatat pada `KEPERLUAN_YANG_DITOLAK` di bawah supaya tidak diusulkan lagi
 * setiap beberapa bulan:
 *
 *   · **Keputusan kelayakan pinjaman.** AI boleh merangkum berkas dan menandai
 *     hal yang perlu diperiksa; ia tidak boleh menyimpulkan layak atau tidak.
 *     Penolakan pinjaman menyangkut penghidupan seseorang, dan alasannya harus
 *     dapat dijelaskan pengurus kepada anggota yang menanyakannya — jawaban
 *     "menurut sistem" bukan penjelasan.
 *
 *   · **Penilaian karakter anggota.** Menyimpulkan sifat seseorang dari
 *     riwayat pembayarannya adalah penilaian tentang orang, bukan tentang
 *     angka, dan koperasi dibangun di atas kepercayaan antaranggota.
 */

import type { AiUseCase } from '../../ai/ai-use-case.registry';

const SKEMA_NOTULEN = {
  type: 'object',
  properties: {
    ringkasan: { type: 'string', description: 'Satu paragraf, bahasa Indonesia.' },
    agenda: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: {
          judul: { type: 'string' },
          pembahasan: { type: 'string' },
          kesimpulan: { type: 'string' },
        },
        required: ['judul', 'pembahasan', 'kesimpulan'],
      },
    },
    halYangPerluDiperiksa: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string' },
      description: 'Bagian yang tidak jelas dari rekaman dan harus dipastikan manusia.',
    },
  },
  required: ['ringkasan', 'agenda', 'halYangPerluDiperiksa'],
} as const;

const SKEMA_BERKAS_PINJAMAN = {
  type: 'object',
  properties: {
    ringkasanBerkas: { type: 'string' },
    kelengkapan: {
      type: 'array',
      maxItems: 15,
      items: {
        type: 'object',
        properties: {
          dokumen: { type: 'string' },
          ada: { type: 'boolean' },
          catatan: { type: 'string' },
        },
        required: ['dokumen', 'ada', 'catatan'],
      },
    },
    halYangPerluDiperiksa: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          hal: { type: 'string' },
          alasan: { type: 'string' },
          buktiRujukan: { type: 'string' },
        },
        required: ['hal', 'alasan', 'buktiRujukan'],
      },
    },
  },
  required: ['ringkasanBerkas', 'kelengkapan', 'halYangPerluDiperiksa'],
} as const;

const SKEMA_TEMUAN = {
  type: 'object',
  properties: {
    temuan: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          judul: { type: 'string' },
          keterangan: { type: 'string' },
          tingkat: { type: 'string', enum: ['RENDAH', 'SEDANG', 'TINGGI'] },
          buktiRujukan: { type: 'string' },
        },
        required: ['judul', 'keterangan', 'tingkat', 'buktiRujukan'],
      },
    },
    tidakAdaTemuan: { type: 'boolean' },
  },
  required: ['temuan', 'tidakAdaTemuan'],
} as const;

const SKEMA_TEKS = {
  type: 'object',
  properties: {
    teks: { type: 'string' },
    catatanPenyusun: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
  required: ['teks', 'catatanPenyusun'],
} as const;

export const COOPERATIVE_AI_USE_CASES: AiUseCase[] = [
  {
    code: 'COOPERATIVE_MEETING_MINUTES_DRAFT',
    name: 'Draf notulen rapat anggota',
    description:
      'Menyusun draf notulen dari catatan rapat. Draf WAJIB diperiksa dan disahkan manusia sebelum menjadi notulen — ditegakkan constraint basis data pada K-5, bukan hanya kebiasaan.',
    menuCode: 'COOPERATIVE_MEETING',
    action: 'READ',
    outputKind: 'DRAFT',
    riskClass: 'MEDIUM',
    requiresEvidence: false,
    outputSchema: SKEMA_NOTULEN,
    hourlyQuotaPerUser: 10,
    storeContent: false,
  },
  {
    code: 'COOPERATIVE_LOAN_FILE_SUMMARY',
    name: 'Ringkasan berkas permohonan pinjaman',
    description:
      'Merangkum berkas dan menandai dokumen yang belum lengkap serta hal yang perlu diperiksa petugas. TIDAK menyimpulkan layak atau tidak layak.',
    menuCode: 'COOPERATIVE_CREDIT_ANALYSIS',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'HIGH',
    requiresEvidence: true,
    outputSchema: SKEMA_BERKAS_PINJAMAN,
    hourlyQuotaPerUser: 20,
    storeContent: false,
  },
  {
    code: 'COOPERATIVE_SAVING_ANOMALY',
    name: 'Temuan pada mutasi simpanan',
    description:
      'Menandai mutasi yang tidak lazim — setoran jauh di atas kebiasaan, penarikan beruntun, pola yang berulang pada satu petugas. Setiap temuan wajib menyebut baris yang mendasarinya.',
    menuCode: 'COOPERATIVE_SAVING',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'HIGH',
    requiresEvidence: true,
    outputSchema: SKEMA_TEMUAN,
    hourlyQuotaPerUser: 10,
    storeContent: false,
  },
  {
    code: 'COOPERATIVE_COLLECTION_ANOMALY',
    name: 'Temuan pada penagihan',
    description:
      'Menandai tunggakan yang penanganannya menyimpang: janji bayar yang berulang tanpa realisasi, kunjungan yang tidak pernah tercatat, penagihan yang berhenti tanpa keterangan.',
    menuCode: 'COOPERATIVE_COLLECTION',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'MEDIUM',
    requiresEvidence: true,
    outputSchema: SKEMA_TEMUAN,
    hourlyQuotaPerUser: 10,
    storeContent: false,
  },
  {
    code: 'COOPERATIVE_ANNUAL_REPORT_DRAFT',
    name: 'Draf laporan pertanggungjawaban pengurus',
    description:
      'Menyusun draf narasi laporan tahunan dari angka yang sudah ditutup. Angkanya diambil dari laporan, tidak pernah dihitung ulang oleh AI.',
    menuCode: 'COOPERATIVE_REPORT',
    action: 'READ',
    outputKind: 'DRAFT',
    riskClass: 'MEDIUM',
    requiresEvidence: true,
    outputSchema: SKEMA_TEKS,
    hourlyQuotaPerUser: 5,
    storeContent: false,
  },
  {
    code: 'COOPERATIVE_COMPLAINT_TRIAGE',
    name: 'Usulan penggolongan pengaduan',
    description:
      'Mengusulkan kategori dan tingkat kegentingan sebuah pengaduan. Usulan saja — pengurus yang menetapkan, dan pengaduan tidak pernah berpindah status karenanya.',
    menuCode: 'COOPERATIVE_COMPLAINT',
    action: 'READ',
    outputKind: 'RECOMMENDATION',
    riskClass: 'MEDIUM',
    requiresEvidence: false,
    outputSchema: {
      type: 'object',
      properties: {
        kategoriUsulan: {
          type: 'string',
          enum: ['SERVICE', 'SAVING', 'LOAN', 'SHU', 'GOVERNANCE', 'STAFF', 'UNIT_BUSINESS', 'OTHER'],
        },
        tingkatUsulan: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] },
        alasan: { type: 'string' },
      },
      required: ['kategoriUsulan', 'tingkatUsulan', 'alasan'],
    },
    hourlyQuotaPerUser: 30,
    storeContent: false,
  },
  {
    code: 'COOPERATIVE_MEMBER_EDUCATION',
    name: 'Penjelasan istilah koperasi untuk anggota',
    description:
      'Menjelaskan simpanan pokok, jasa modal, patronage, kuorum, dan istilah lain dengan bahasa sehari-hari. Tidak menyentuh data anggota sama sekali.',
    menuCode: 'COOPERATIVE_PORTAL',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'LOW',
    requiresEvidence: false,
    outputSchema: SKEMA_TEKS,
    hourlyQuotaPerUser: 30,
    storeContent: false,
  },
  {
    code: 'COOPERATIVE_WEBSITE_CONTENT_DRAFT',
    name: 'Draf isi halaman situs koperasi',
    description:
      'Menyusun draf halaman profil, sejarah, dan syarat keanggotaan dari keterangan yang diberikan pengurus. Tidak diterbitkan sampai pengurus menerbitkannya.',
    menuCode: 'COOPERATIVE_WEBSITE',
    action: 'READ',
    outputKind: 'DRAFT',
    riskClass: 'LOW',
    requiresEvidence: false,
    outputSchema: SKEMA_TEKS,
    hourlyQuotaPerUser: 20,
    storeContent: false,
  },
];

export interface KeperluanDitolak {
  usulan: string;
  alasan: string;
}

/**
 * Keperluan yang sengaja TIDAK dibuat.
 *
 * Dicatat supaya tidak diusulkan lagi setiap beberapa bulan oleh orang yang
 * tidak mengetahui pertimbangannya — dan supaya bila kelak memang hendak
 * dibuat, keputusannya diambil dengan mengetahui apa yang dulu ditolak dan
 * mengapa.
 */
export const KEPERLUAN_YANG_DITOLAK: KeperluanDitolak[] = [
  {
    usulan: 'Keputusan kelayakan pinjaman (layak / tidak layak)',
    alasan:
      'Penolakan pinjaman menyangkut penghidupan seseorang, dan alasannya harus dapat dijelaskan pengurus kepada anggota yang menanyakannya. "Menurut sistem" bukan penjelasan, dan anggota koperasi berhak atas penjelasan dari sesama anggota yang menjadi pengurus.',
  },
  {
    usulan: 'Penilaian karakter atau kejujuran anggota',
    alasan:
      'Menyimpulkan sifat seseorang dari riwayat pembayarannya adalah penilaian tentang orang, bukan tentang angka. Koperasi dibangun di atas kepercayaan antaranggota; menggantinya dengan skor yang tidak dapat dibantah merusak dasar itu.',
  },
  {
    usulan: 'Menentukan besaran SHU atau alokasinya',
    alasan:
      'SHU dihitung dengan rumus yang disahkan RAT dan wajib dapat diulang persis. Hasil AI tidak dapat diulang persis, sehingga tidak dapat dipertanggungjawabkan pada RAT.',
  },
  {
    usulan: 'Menyusun atau memposting jurnal secara otomatis',
    alasan:
      'Posting jurnal adalah perbuatan, bukan usulan. Larangan pokok: AI tidak pernah bertindak.',
  },
  {
    usulan: 'Menetapkan status pengaduan',
    alasan:
      'Pengaduan yang statusnya ditetapkan mesin adalah pengaduan yang dapat ditutup tanpa ada manusia yang membacanya. Usulan penggolongan boleh; penetapan tidak.',
  },
  {
    usulan: 'Membandingkan data antarkoperasi untuk tolok ukur',
    alasan:
      'Mengirim data satu koperasi ke dalam konteks koperasi lain melanggar larangan cross-tenant, betapa pun ringkas ringkasannya.',
  },
];

export const COOPERATIVE_AI_CATALOG = {
  module: 'cooperative',
  useCases: COOPERATIVE_AI_USE_CASES,
  rejected: KEPERLUAN_YANG_DITOLAK,
} as const;
