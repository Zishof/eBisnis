/**
 * Validasi buku penghubung santri. Modul ini menampung pola AIS lama:
 * buku penghubung, catatan guru, catatan siswa, dan catatan orang tua.
 */

export const JENIS_BUKU_PENGHUBUNG = [
  'AKADEMIK',
  'KESEHATAN',
  'KEDISIPLINAN',
  'IBADAH',
  'ASRAMA',
  'WALI',
  'LAINNYA',
] as const;
export type JenisBukuPenghubung = (typeof JENIS_BUKU_PENGHUBUNG)[number];

export const VISIBILITAS_BUKU_PENGHUBUNG = ['INTERNAL', 'WALI'] as const;
export type VisibilitasBukuPenghubung = (typeof VISIBILITAS_BUKU_PENGHUBUNG)[number];

export const STATUS_BUKU_PENGHUBUNG = ['TERBUKA', 'SELESAI'] as const;
export type StatusBukuPenghubung = (typeof STATUS_BUKU_PENGHUBUNG)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanBukuPenghubung {
  santriId?: string;
  tanggal?: string | null;
  jenis?: string;
  visibilitas?: string;
  judul?: string;
  isi?: string;
  tindakLanjut?: string | null;
  ditulisOlehGuruId?: string | null;
}

export interface MasukanTindakLanjutBukuPenghubung {
  tindakLanjut?: string | null;
}

export function validasiBukuPenghubung(masukan: MasukanBukuPenghubung): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.santriId ?? '').trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'Santri wajib dipilih.' });
  }
  if (!masukan.jenis || !JENIS_BUKU_PENGHUBUNG.includes(masukan.jenis as JenisBukuPenghubung)) {
    galat.push({ field: 'jenis', code: 'TIDAK_DIKENALI', message: 'Jenis catatan tidak dikenali.' });
  }
  if (!masukan.visibilitas || !VISIBILITAS_BUKU_PENGHUBUNG.includes(masukan.visibilitas as VisibilitasBukuPenghubung)) {
    galat.push({ field: 'visibilitas', code: 'TIDAK_DIKENALI', message: 'Visibilitas catatan tidak dikenali.' });
  }
  if (!(masukan.judul ?? '').trim()) {
    galat.push({ field: 'judul', code: 'WAJIB', message: 'Judul catatan wajib diisi.' });
  }
  if (!(masukan.isi ?? '').trim()) {
    galat.push({ field: 'isi', code: 'WAJIB', message: 'Isi catatan wajib diisi.' });
  }

  return galat;
}
