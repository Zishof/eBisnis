/**
 * Aturan data induk guru dan penugasan mengajar (EP-S2) — bagian yang
 * dapat dibuktikan tanpa basis data.
 */

export const JENIS_GURU = ['TETAP', 'HONORER', 'DPK'] as const;
export type JenisGuru = (typeof JENIS_GURU)[number];

export const STATUS_GURU = ['AKTIF', 'NONAKTIF'] as const;
export type StatusGuru = (typeof STATUS_GURU)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanGuru {
  nip?: string | null;
  nama?: string;
  jenis?: string;
  noHp?: string | null;
  email?: string | null;
  alamat?: string | null;
  userSubjectId?: string | null;
}

const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validasiGuru(masukan: MasukanGuru): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.nama ?? '').trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama guru wajib diisi.' });
  }
  if (!JENIS_GURU.includes(masukan.jenis as JenisGuru)) {
    galat.push({ field: 'jenis', code: 'TIDAK_DIKENALI', message: 'Jenis guru wajib salah satu dari TETAP, HONORER, DPK.' });
  }
  const email = (masukan.email ?? '').trim();
  if (email && !POLA_EMAIL.test(email)) {
    galat.push({ field: 'email', code: 'TIDAK_SAH', message: 'Format email tidak sah.' });
  }

  return galat;
}

export interface MasukanPenugasan {
  guruId?: string;
  mataPelajaranId?: string;
  rombonganId?: string;
  tahunAjaranId?: string;
  jamPerMinggu?: number;
}

export function validasiPenugasan(masukan: MasukanPenugasan): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.guruId ?? '').trim()) {
    galat.push({ field: 'guruId', code: 'WAJIB', message: 'Guru wajib dipilih.' });
  }
  if (!(masukan.mataPelajaranId ?? '').trim()) {
    galat.push({ field: 'mataPelajaranId', code: 'WAJIB', message: 'Mata pelajaran wajib dipilih.' });
  }
  if (!(masukan.rombonganId ?? '').trim()) {
    galat.push({ field: 'rombonganId', code: 'WAJIB', message: 'Rombongan belajar wajib dipilih.' });
  }
  if (!(masukan.tahunAjaranId ?? '').trim()) {
    galat.push({ field: 'tahunAjaranId', code: 'WAJIB', message: 'Tahun ajaran wajib dipilih.' });
  }
  if (!masukan.jamPerMinggu || masukan.jamPerMinggu <= 0) {
    galat.push({ field: 'jamPerMinggu', code: 'TIDAK_SAH', message: 'Jam per minggu harus lebih besar dari nol.' });
  }

  return galat;
}
