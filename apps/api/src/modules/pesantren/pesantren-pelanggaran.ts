/**
 * Aturan pelanggaran dan hukuman santri (EP-S1) — bagian yang dapat
 * dibuktikan tanpa basis data.
 */

export const KATEGORI_PELANGGARAN = ['RINGAN', 'SEDANG', 'BERAT'] as const;
export type KategoriPelanggaran = (typeof KATEGORI_PELANGGARAN)[number];

export const JENIS_HUKUMAN = [
  'TEGURAN_LISAN',
  'TEGURAN_TERTULIS',
  'PEMANGGILAN_ORANG_TUA',
  'SKORSING',
  'PEMBINAAN_KHUSUS',
  'LAINNYA',
] as const;
export type JenisHukuman = (typeof JENIS_HUKUMAN)[number];

export const STATUS_HUKUMAN = ['DIJATUHKAN', 'SELESAI', 'DIBATALKAN'] as const;
export type StatusHukuman = (typeof STATUS_HUKUMAN)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanJenisPelanggaran {
  code?: string;
  nama?: string;
  kategori?: string;
  poin?: number;
}

export function validasiJenisPelanggaran(masukan: MasukanJenisPelanggaran): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.code ?? '').trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode jenis pelanggaran wajib diisi.' });
  }
  if (!(masukan.nama ?? '').trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama jenis pelanggaran wajib diisi.' });
  }
  if (!KATEGORI_PELANGGARAN.includes(masukan.kategori as KategoriPelanggaran)) {
    galat.push({ field: 'kategori', code: 'TIDAK_DIKENALI', message: 'Kategori wajib salah satu dari RINGAN, SEDANG, BERAT.' });
  }
  if (!masukan.poin || masukan.poin <= 0) {
    galat.push({ field: 'poin', code: 'TIDAK_SAH', message: 'Poin harus lebih besar dari nol.' });
  }

  return galat;
}

export interface MasukanPelanggaran {
  santriId?: string;
  jenisPelanggaranId?: string;
  tanggal?: string | null;
  keterangan?: string | null;
}

export function validasiPelanggaran(masukan: MasukanPelanggaran): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.santriId ?? '').trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'Santri wajib dipilih.' });
  }
  if (!(masukan.jenisPelanggaranId ?? '').trim()) {
    galat.push({ field: 'jenisPelanggaranId', code: 'WAJIB', message: 'Jenis pelanggaran wajib dipilih.' });
  }
  if (masukan.tanggal) {
    const d = new Date(masukan.tanggal);
    if (Number.isNaN(d.getTime())) {
      galat.push({ field: 'tanggal', code: 'TIDAK_SAH', message: 'Tanggal tidak sah.' });
    } else if (d.getTime() > Date.now()) {
      galat.push({ field: 'tanggal', code: 'DI_MASA_DEPAN', message: 'Tanggal tidak boleh di masa depan.' });
    }
  }

  return galat;
}

export interface MasukanHukuman {
  pelanggaranId?: string;
  jenisHukuman?: string;
  keterangan?: string | null;
  tanggalMulai?: string | null;
  tanggalSelesai?: string | null;
}

export function validasiHukuman(masukan: MasukanHukuman): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.pelanggaranId ?? '').trim()) {
    galat.push({ field: 'pelanggaranId', code: 'WAJIB', message: 'Pelanggaran wajib dipilih.' });
  }
  if (!JENIS_HUKUMAN.includes(masukan.jenisHukuman as JenisHukuman)) {
    galat.push({ field: 'jenisHukuman', code: 'TIDAK_DIKENALI', message: 'Jenis hukuman tidak dikenali.' });
  }
  if (masukan.tanggalMulai && masukan.tanggalSelesai && masukan.tanggalSelesai < masukan.tanggalMulai) {
    galat.push({
      field: 'tanggalSelesai',
      code: 'SEBELUM_MULAI',
      message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.',
    });
  }

  return galat;
}
