/**
 * Aturan ekstrakurikuler dan organisasi siswa (EP-S4) — bagian yang dapat
 * dibuktikan tanpa basis data.
 */

export const JENIS_EKSTRAKURIKULER = ['KLUB', 'ORGANISASI'] as const;
export type JenisEkstrakurikuler = (typeof JENIS_EKSTRAKURIKULER)[number];

export const JABATAN_EKSTRAKURIKULER = ['KETUA', 'WAKIL_KETUA', 'SEKRETARIS', 'BENDAHARA', 'ANGGOTA'] as const;
export type JabatanEkstrakurikuler = (typeof JABATAN_EKSTRAKURIKULER)[number];

export const STATUS_ANGGOTA_EKSKUL = ['AKTIF', 'KELUAR'] as const;
export type StatusAnggotaEkskul = (typeof STATUS_ANGGOTA_EKSKUL)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanEkstrakurikuler {
  code?: string;
  nama?: string;
  jenis?: string;
  pembinaGuruId?: string | null;
  deskripsi?: string | null;
}

export function validasiEkstrakurikuler(masukan: MasukanEkstrakurikuler): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.code ?? '').trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode ekstrakurikuler wajib diisi.' });
  }
  if (!(masukan.nama ?? '').trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama ekstrakurikuler wajib diisi.' });
  }
  if (!JENIS_EKSTRAKURIKULER.includes(masukan.jenis as JenisEkstrakurikuler)) {
    galat.push({ field: 'jenis', code: 'TIDAK_DIKENALI', message: 'Jenis wajib KLUB atau ORGANISASI.' });
  }

  return galat;
}

export interface MasukanAnggotaEkskul {
  ekstrakurikulerId?: string;
  santriId?: string;
  tahunAjaranId?: string;
  jabatan?: string;
  tanggalBergabung?: string | null;
}

export function validasiAnggotaEkskul(masukan: MasukanAnggotaEkskul): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.ekstrakurikulerId ?? '').trim()) {
    galat.push({ field: 'ekstrakurikulerId', code: 'WAJIB', message: 'Ekstrakurikuler wajib dipilih.' });
  }
  if (!(masukan.santriId ?? '').trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'Santri wajib dipilih.' });
  }
  if (!(masukan.tahunAjaranId ?? '').trim()) {
    galat.push({ field: 'tahunAjaranId', code: 'WAJIB', message: 'Tahun ajaran wajib dipilih.' });
  }
  if (masukan.jabatan && !JABATAN_EKSTRAKURIKULER.includes(masukan.jabatan as JabatanEkstrakurikuler)) {
    galat.push({ field: 'jabatan', code: 'TIDAK_DIKENALI', message: 'Jabatan tidak dikenali.' });
  }

  return galat;
}

export interface MasukanNilaiPartisipasi {
  nilaiPartisipasi?: number | null;
  catatan?: string | null;
}

export function validasiNilaiPartisipasi(masukan: MasukanNilaiPartisipasi): Galat[] {
  const galat: Galat[] = [];
  if (masukan.nilaiPartisipasi != null && (masukan.nilaiPartisipasi < 0 || masukan.nilaiPartisipasi > 100)) {
    galat.push({ field: 'nilaiPartisipasi', code: 'TIDAK_SAH', message: 'Nilai partisipasi harus antara 0 dan 100.' });
  }
  return galat;
}
