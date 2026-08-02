/**
 * Aturan absensi guru dan piket (EP-S3) — bagian yang dapat dibuktikan
 * tanpa basis data.
 */

export const STATUS_ABSENSI_GURU = ['HADIR', 'IZIN', 'SAKIT', 'ALPA'] as const;
export type StatusAbsensiGuru = (typeof STATUS_ABSENSI_GURU)[number];

export const JENIS_PIKET = ['PIKET_HARIAN', 'PIKET_MALAM', 'PIKET_GERBANG', 'PIKET_ASRAMA', 'LAINNYA'] as const;
export type JenisPiket = (typeof JENIS_PIKET)[number];

export const STATUS_PIKET = ['DIJADWALKAN', 'HADIR', 'TIDAK_HADIR'] as const;
export type StatusPiket = (typeof STATUS_PIKET)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanAbsensiGuru {
  guruId?: string;
  tanggal?: string | null;
  status?: string;
  jamMasuk?: string | null;
  jamPulang?: string | null;
  keterangan?: string | null;
}

export function validasiAbsensiGuru(masukan: MasukanAbsensiGuru): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.guruId ?? '').trim()) {
    galat.push({ field: 'guruId', code: 'WAJIB', message: 'Guru wajib dipilih.' });
  }
  if (!STATUS_ABSENSI_GURU.includes(masukan.status as StatusAbsensiGuru)) {
    galat.push({ field: 'status', code: 'TIDAK_DIKENALI', message: 'Status absensi tidak dikenali.' });
  }
  if (masukan.jamMasuk && masukan.jamPulang && masukan.jamPulang <= masukan.jamMasuk) {
    galat.push({ field: 'jamPulang', code: 'SEBELUM_MASUK', message: 'Jam pulang harus setelah jam masuk.' });
  }

  return galat;
}

export interface MasukanPiket {
  guruId?: string;
  tanggal?: string | null;
  jenisPiket?: string;
  keterangan?: string | null;
}

export function validasiPiket(masukan: MasukanPiket): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.guruId ?? '').trim()) {
    galat.push({ field: 'guruId', code: 'WAJIB', message: 'Guru wajib dipilih.' });
  }
  if (!JENIS_PIKET.includes(masukan.jenisPiket as JenisPiket)) {
    galat.push({ field: 'jenisPiket', code: 'TIDAK_DIKENALI', message: 'Jenis piket tidak dikenali.' });
  }

  return galat;
}
