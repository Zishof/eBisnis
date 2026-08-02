/**
 * Aturan rombongan belajar/kelas (EP-O3) — bagian yang dapat dibuktikan
 * tanpa basis data.
 */

export const STATUS_ANGGOTA = ['AKTIF', 'PINDAH', 'KELUAR'] as const;
export type StatusAnggota = (typeof STATUS_ANGGOTA)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanRombongan {
  unitPendidikanId?: string;
  tahunAjaranId?: string;
  tingkat?: string;
  nama?: string;
  waliKelasUserId?: string | null;
  kapasitas?: number | null;
}

export function validasiRombongan(masukan: MasukanRombongan): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.unitPendidikanId ?? '').trim()) {
    galat.push({ field: 'unitPendidikanId', code: 'WAJIB', message: 'Unit pendidikan wajib dipilih.' });
  }
  if (!(masukan.tahunAjaranId ?? '').trim()) {
    galat.push({ field: 'tahunAjaranId', code: 'WAJIB', message: 'Tahun ajaran wajib dipilih.' });
  }
  if (!(masukan.tingkat ?? '').trim()) {
    galat.push({ field: 'tingkat', code: 'WAJIB', message: 'Tingkat kelas wajib diisi.' });
  }
  if (!(masukan.nama ?? '').trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama rombongan belajar wajib diisi.' });
  }
  if (masukan.kapasitas != null && masukan.kapasitas <= 0) {
    galat.push({ field: 'kapasitas', code: 'TIDAK_SAH', message: 'Kapasitas harus lebih besar dari nol bila diisi.' });
  }

  return galat;
}

export interface MasukanAnggota {
  rombonganId?: string;
  santriId?: string;
  tahunAjaranId?: string;
  tanggalMasuk?: string | null;
}

export function validasiAnggota(masukan: MasukanAnggota): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.rombonganId ?? '').trim()) {
    galat.push({ field: 'rombonganId', code: 'WAJIB', message: 'Rombongan belajar wajib dipilih.' });
  }
  if (!(masukan.santriId ?? '').trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'Santri wajib dipilih.' });
  }
  if (!(masukan.tahunAjaranId ?? '').trim()) {
    galat.push({ field: 'tahunAjaranId', code: 'WAJIB', message: 'Tahun ajaran wajib dipilih.' });
  }

  return galat;
}
