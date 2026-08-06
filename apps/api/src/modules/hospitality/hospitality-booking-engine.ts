/**
 * Validasi booking engine publik (MI-9).
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export const METODE_PEMBAYARAN = ['PAY_AT_PROPERTY'] as const;

export interface MasukanPencarian {
  checkin?: string;
  checkout?: string;
  dewasa?: number;
  anak?: number;
}

export interface MasukanPemesananPublik {
  propertyId?: string;
  roomTypeId?: string;
  checkin?: string;
  checkout?: string;
  dewasa?: number;
  anak?: number;
  namaLengkap?: string;
  email?: string;
  telepon?: string;
  permintaanKhusus?: string;
  metodePembayaran?: string;
}

function tanggalSah(nilai?: string): boolean {
  if (!nilai) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(nilai) && !Number.isNaN(Date.parse(nilai));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validasiPencarian(masukan: MasukanPencarian): Galat[] {
  const galat: Galat[] = [];
  if (!tanggalSah(masukan.checkin)) {
    galat.push({ field: 'checkin', code: 'TIDAK_SAH', message: 'Tanggal check-in wajib diisi, format YYYY-MM-DD.' });
  }
  if (!tanggalSah(masukan.checkout)) {
    galat.push({ field: 'checkout', code: 'TIDAK_SAH', message: 'Tanggal check-out wajib diisi, format YYYY-MM-DD.' });
  }
  if (tanggalSah(masukan.checkin) && tanggalSah(masukan.checkout)) {
    if (Date.parse(masukan.checkout!) <= Date.parse(masukan.checkin!)) {
      galat.push({ field: 'checkout', code: 'TIDAK_SAH', message: 'Tanggal check-out harus setelah check-in.' });
    }
    // Booking engine publik tidak melayani tanggal yang sudah lewat --
    // beda dari layar staf (bisa mencatat reservasi masa lalu untuk
    // walk-in yang sudah terjadi), pengunjung publik hanya boleh
    // memesan untuk masa depan.
    const hariIni = new Date().toISOString().slice(0, 10);
    if (masukan.checkin! < hariIni) {
      galat.push({ field: 'checkin', code: 'SUDAH_LEWAT', message: 'Tanggal check-in tidak boleh di masa lalu.' });
    }
  }
  return galat;
}

export function validasiPemesananPublik(masukan: MasukanPemesananPublik): Galat[] {
  const galat = validasiPencarian(masukan);
  if (!masukan.propertyId?.trim()) {
    galat.push({ field: 'propertyId', code: 'WAJIB', message: 'Properti wajib dipilih.' });
  }
  if (!masukan.roomTypeId?.trim()) {
    galat.push({ field: 'roomTypeId', code: 'WAJIB', message: 'Tipe kamar wajib dipilih.' });
  }
  if (!masukan.namaLengkap?.trim()) {
    galat.push({ field: 'namaLengkap', code: 'WAJIB', message: 'Nama lengkap wajib diisi.' });
  }
  if (!masukan.email?.trim() && !masukan.telepon?.trim()) {
    galat.push({
      field: 'email',
      code: 'WAJIB',
      message: 'Email atau nomor telepon wajib diisi -- dipakai memverifikasi Anda saat mengelola pemesanan.',
    });
  }
  if (masukan.email && !EMAIL_RE.test(masukan.email)) {
    galat.push({ field: 'email', code: 'TIDAK_SAH', message: 'Format email tidak sah.' });
  }
  if (
    masukan.metodePembayaran &&
    !METODE_PEMBAYARAN.includes(masukan.metodePembayaran as (typeof METODE_PEMBAYARAN)[number])
  ) {
    galat.push({
      field: 'metodePembayaran',
      code: 'TIDAK_DIKENALI',
      message: `Metode pembayaran harus salah satu dari: ${METODE_PEMBAYARAN.join(', ')}.`,
    });
  }
  return galat;
}

export function jumlahMalam(checkin: string, checkout: string): number {
  const satuHari = 86_400_000;
  return Math.round((Date.parse(checkout) - Date.parse(checkin)) / satuHari);
}
