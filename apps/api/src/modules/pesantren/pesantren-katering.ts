/**
 * Aturan dapur dan katering (EP-S6) — bagian yang dapat dibuktikan tanpa
 * basis data.
 */

export const WAKTU_MAKAN = ['SARAPAN', 'MAKAN_SIANG', 'MAKAN_MALAM', 'SNACK'] as const;
export type WaktuMakan = (typeof WAKTU_MAKAN)[number];

export const STATUS_MENU = ['DIRENCANAKAN', 'DISIAPKAN', 'SELESAI', 'DIBATALKAN'] as const;
export type StatusMenu = (typeof STATUS_MENU)[number];

export const JENIS_TRANSAKSI_STOK = ['MASUK', 'KELUAR', 'PENYESUAIAN'] as const;
export type JenisTransaksiStok = (typeof JENIS_TRANSAKSI_STOK)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanMenu {
  tanggal?: string | null;
  waktuMakan?: string;
  namaMenu?: string;
  deskripsi?: string | null;
  jumlahPorsiDisiapkan?: number | null;
}

export function validasiMenu(masukan: MasukanMenu): Galat[] {
  const galat: Galat[] = [];

  if (!WAKTU_MAKAN.includes(masukan.waktuMakan as WaktuMakan)) {
    galat.push({ field: 'waktuMakan', code: 'TIDAK_DIKENALI', message: 'Waktu makan tidak dikenali.' });
  }
  if (!(masukan.namaMenu ?? '').trim()) {
    galat.push({ field: 'namaMenu', code: 'WAJIB', message: 'Nama menu wajib diisi.' });
  }
  if (masukan.jumlahPorsiDisiapkan != null && masukan.jumlahPorsiDisiapkan <= 0) {
    galat.push({ field: 'jumlahPorsiDisiapkan', code: 'TIDAK_SAH', message: 'Jumlah porsi harus lebih besar dari nol.' });
  }

  return galat;
}

export interface MasukanKonsumsi {
  menuId?: string;
  asramaId?: string | null;
  jumlahPorsi?: number;
  catatan?: string | null;
}

export function validasiKonsumsi(masukan: MasukanKonsumsi): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.menuId ?? '').trim()) {
    galat.push({ field: 'menuId', code: 'WAJIB', message: 'Menu wajib dipilih.' });
  }
  if (!masukan.jumlahPorsi || masukan.jumlahPorsi <= 0) {
    galat.push({ field: 'jumlahPorsi', code: 'TIDAK_SAH', message: 'Jumlah porsi harus lebih besar dari nol.' });
  }

  return galat;
}

export interface MasukanBahan {
  namaBahan?: string;
  satuan?: string;
  stokMinimum?: number | null;
}

export function validasiBahan(masukan: MasukanBahan): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.namaBahan ?? '').trim()) {
    galat.push({ field: 'namaBahan', code: 'WAJIB', message: 'Nama bahan wajib diisi.' });
  }
  if (!(masukan.satuan ?? '').trim()) {
    galat.push({ field: 'satuan', code: 'WAJIB', message: 'Satuan wajib diisi.' });
  }
  if (masukan.stokMinimum != null && masukan.stokMinimum < 0) {
    galat.push({ field: 'stokMinimum', code: 'TIDAK_SAH', message: 'Stok minimum tidak boleh negatif.' });
  }

  return galat;
}

export interface MasukanTransaksiStok {
  bahanId?: string;
  jenis?: string;
  jumlah?: number;
  keterangan?: string | null;
}

export function validasiTransaksiStok(masukan: MasukanTransaksiStok): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.bahanId ?? '').trim()) {
    galat.push({ field: 'bahanId', code: 'WAJIB', message: 'Bahan wajib dipilih.' });
  }
  if (!JENIS_TRANSAKSI_STOK.includes(masukan.jenis as JenisTransaksiStok)) {
    galat.push({ field: 'jenis', code: 'TIDAK_DIKENALI', message: 'Jenis transaksi tidak dikenali.' });
  }
  if (!masukan.jumlah || masukan.jumlah <= 0) {
    galat.push({ field: 'jumlah', code: 'TIDAK_SAH', message: 'Jumlah harus lebih besar dari nol.' });
  }

  return galat;
}
