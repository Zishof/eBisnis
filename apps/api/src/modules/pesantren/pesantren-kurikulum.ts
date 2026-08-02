/**
 * Aturan kurikulum dan jadwal pelajaran (EP-O4) — bagian yang dapat
 * dibuktikan tanpa basis data.
 */

export const HARI = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'] as const;
export type Hari = (typeof HARI)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanKurikulum {
  unitPendidikanId?: string;
  tahunAjaranId?: string;
  tingkat?: string;
  mataPelajaranId?: string;
  jamPerMinggu?: number;
}

export function validasiKurikulum(masukan: MasukanKurikulum): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.unitPendidikanId ?? '').trim()) {
    galat.push({ field: 'unitPendidikanId', code: 'WAJIB', message: 'Unit pendidikan wajib dipilih.' });
  }
  if (!(masukan.tahunAjaranId ?? '').trim()) {
    galat.push({ field: 'tahunAjaranId', code: 'WAJIB', message: 'Tahun ajaran wajib dipilih.' });
  }
  if (!(masukan.tingkat ?? '').trim()) {
    galat.push({ field: 'tingkat', code: 'WAJIB', message: 'Tingkat wajib diisi.' });
  }
  if (!(masukan.mataPelajaranId ?? '').trim()) {
    galat.push({ field: 'mataPelajaranId', code: 'WAJIB', message: 'Mata pelajaran wajib dipilih.' });
  }
  if (!masukan.jamPerMinggu || masukan.jamPerMinggu <= 0) {
    galat.push({ field: 'jamPerMinggu', code: 'TIDAK_SAH', message: 'Jam per minggu harus lebih besar dari nol.' });
  }

  return galat;
}

export interface MasukanJadwal {
  rombonganId?: string;
  mataPelajaranId?: string;
  hari?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  pengajarUserId?: string | null;
  ruangan?: string | null;
}

export function validasiJadwalPelajaran(masukan: MasukanJadwal): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.rombonganId ?? '').trim()) {
    galat.push({ field: 'rombonganId', code: 'WAJIB', message: 'Rombongan belajar wajib dipilih.' });
  }
  if (!(masukan.mataPelajaranId ?? '').trim()) {
    galat.push({ field: 'mataPelajaranId', code: 'WAJIB', message: 'Mata pelajaran wajib dipilih.' });
  }
  if (!HARI.includes(masukan.hari as Hari)) {
    galat.push({ field: 'hari', code: 'TIDAK_DIKENALI', message: 'Hari tidak dikenali.' });
  }
  if (!masukan.waktuMulai) {
    galat.push({ field: 'waktuMulai', code: 'WAJIB', message: 'Waktu mulai wajib diisi.' });
  }
  if (!masukan.waktuSelesai) {
    galat.push({ field: 'waktuSelesai', code: 'WAJIB', message: 'Waktu selesai wajib diisi.' });
  }
  if (masukan.waktuMulai && masukan.waktuSelesai && masukan.waktuSelesai <= masukan.waktuMulai) {
    galat.push({
      field: 'waktuSelesai',
      code: 'SEBELUM_MULAI',
      message: 'Waktu selesai harus setelah waktu mulai.',
    });
  }

  return galat;
}
