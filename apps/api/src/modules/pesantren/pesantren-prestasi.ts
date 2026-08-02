/**
 * Aturan prestasi dan penghargaan santri (EP-S5) — bagian yang dapat
 * dibuktikan tanpa basis data.
 */

export const TINGKAT_PRESTASI = ['SEKOLAH', 'KECAMATAN', 'KABUPATEN', 'PROVINSI', 'NASIONAL', 'INTERNASIONAL'] as const;
export type TingkatPrestasi = (typeof TINGKAT_PRESTASI)[number];

export const PERINGKAT_PRESTASI = [
  'JUARA_1',
  'JUARA_2',
  'JUARA_3',
  'HARAPAN_1',
  'HARAPAN_2',
  'HARAPAN_3',
  'PARTISIPASI',
] as const;
export type PeringkatPrestasi = (typeof PERINGKAT_PRESTASI)[number];

export const JENIS_PENGHARGAAN = [
  'APRESIASI',
  'PENGHARGAAN_BULANAN',
  'PENGHARGAAN_TAHUNAN',
  'SERTIFIKAT',
  'LAINNYA',
] as const;
export type JenisPenghargaan = (typeof JENIS_PENGHARGAAN)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanPrestasi {
  santriId?: string;
  cabang?: string;
  namaKompetisi?: string;
  tingkat?: string;
  peringkat?: string;
  tanggal?: string | null;
  penyelenggara?: string | null;
  keterangan?: string | null;
  dokumenUrl?: string | null;
}

export function validasiPrestasi(masukan: MasukanPrestasi): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.santriId ?? '').trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'Santri wajib dipilih.' });
  }
  if (!(masukan.cabang ?? '').trim()) {
    galat.push({ field: 'cabang', code: 'WAJIB', message: 'Cabang prestasi wajib diisi.' });
  }
  if (!(masukan.namaKompetisi ?? '').trim()) {
    galat.push({ field: 'namaKompetisi', code: 'WAJIB', message: 'Nama kompetisi wajib diisi.' });
  }
  if (!TINGKAT_PRESTASI.includes(masukan.tingkat as TingkatPrestasi)) {
    galat.push({ field: 'tingkat', code: 'TIDAK_DIKENALI', message: 'Tingkat kompetisi tidak dikenali.' });
  }
  if (!PERINGKAT_PRESTASI.includes(masukan.peringkat as PeringkatPrestasi)) {
    galat.push({ field: 'peringkat', code: 'TIDAK_DIKENALI', message: 'Peringkat tidak dikenali.' });
  }

  return galat;
}

export interface MasukanPenghargaan {
  santriId?: string;
  judul?: string;
  jenis?: string;
  tanggal?: string | null;
  diberikanOleh?: string | null;
  keterangan?: string | null;
}

export function validasiPenghargaan(masukan: MasukanPenghargaan): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.santriId ?? '').trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'Santri wajib dipilih.' });
  }
  if (!(masukan.judul ?? '').trim()) {
    galat.push({ field: 'judul', code: 'WAJIB', message: 'Judul penghargaan wajib diisi.' });
  }
  if (!JENIS_PENGHARGAAN.includes(masukan.jenis as JenisPenghargaan)) {
    galat.push({ field: 'jenis', code: 'TIDAK_DIKENALI', message: 'Jenis penghargaan tidak dikenali.' });
  }

  return galat;
}
