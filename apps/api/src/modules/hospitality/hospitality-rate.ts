/**
 * Validasi rate plan dan kalender harga/restriksi (MI-10).
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export const STATUS_RATE_PLAN = ['ACTIVE', 'INACTIVE'] as const;
export const STATUS_KALENDER = ['DRAFT', 'PUBLISHED'] as const;

export interface MasukanRatePlan {
  code?: string;
  nama?: string;
  deskripsi?: string;
  isRefundable?: boolean;
  extraPersonAmount?: number;
  defaultMinLos?: number;
  defaultMaxLos?: number;
}

export interface MasukanHargaKalender {
  checkin?: string;
  checkout?: string;
  amount?: number;
  minLos?: number;
  maxLos?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  stopSell?: boolean;
}

export interface MasukanRentangTanggal {
  checkin?: string;
  checkout?: string;
}

function tanggalSah(nilai?: string): boolean {
  if (!nilai) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(nilai) && !Number.isNaN(Date.parse(nilai));
}

export function validasiRentangTanggal(masukan: MasukanRentangTanggal): Galat[] {
  const galat: Galat[] = [];
  if (!tanggalSah(masukan.checkin)) {
    galat.push({ field: 'checkin', code: 'TIDAK_SAH', message: 'Tanggal mulai wajib diisi, format YYYY-MM-DD.' });
  }
  if (!tanggalSah(masukan.checkout)) {
    galat.push({ field: 'checkout', code: 'TIDAK_SAH', message: 'Tanggal selesai wajib diisi, format YYYY-MM-DD.' });
  }
  if (tanggalSah(masukan.checkin) && tanggalSah(masukan.checkout)) {
    if (Date.parse(masukan.checkout!) <= Date.parse(masukan.checkin!)) {
      galat.push({ field: 'checkout', code: 'TIDAK_SAH', message: 'Tanggal selesai harus setelah tanggal mulai.' });
    }
  }
  return galat;
}

export function validasiRatePlan(masukan: MasukanRatePlan): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.code?.trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode rate plan wajib diisi.' });
  } else if (masukan.code.trim().length > 32) {
    galat.push({ field: 'code', code: 'TERLALU_PANJANG', message: 'Kode rate plan maksimal 32 karakter.' });
  }
  if (!masukan.nama?.trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama rate plan wajib diisi.' });
  }
  if (masukan.extraPersonAmount !== undefined && masukan.extraPersonAmount < 0) {
    galat.push({ field: 'extraPersonAmount', code: 'TIDAK_SAH', message: 'Biaya tamu tambahan tidak boleh negatif.' });
  }
  const minLos = masukan.defaultMinLos ?? 1;
  if (minLos <= 0) {
    galat.push({ field: 'defaultMinLos', code: 'TIDAK_SAH', message: 'MinLOS bawaan harus lebih dari nol.' });
  }
  if (masukan.defaultMaxLos !== undefined && masukan.defaultMaxLos !== null && masukan.defaultMaxLos < minLos) {
    galat.push({ field: 'defaultMaxLos', code: 'TIDAK_SAH', message: 'MaxLOS bawaan tidak boleh kurang dari MinLOS bawaan.' });
  }
  return galat;
}

export function validasiHargaKalender(masukan: MasukanHargaKalender): Galat[] {
  const galat = validasiRentangTanggal(masukan);
  if (
    masukan.amount === undefined ||
    masukan.amount === null ||
    typeof masukan.amount !== 'number' ||
    Number.isNaN(masukan.amount) ||
    masukan.amount < 0
  ) {
    galat.push({ field: 'amount', code: 'TIDAK_SAH', message: 'Harga wajib diisi, tidak boleh negatif.' });
  }
  if (masukan.minLos !== undefined && masukan.minLos !== null && masukan.minLos <= 0) {
    galat.push({ field: 'minLos', code: 'TIDAK_SAH', message: 'MinLOS harus lebih dari nol.' });
  }
  if (
    masukan.maxLos !== undefined &&
    masukan.maxLos !== null &&
    masukan.minLos !== undefined &&
    masukan.minLos !== null &&
    masukan.maxLos < masukan.minLos
  ) {
    galat.push({ field: 'maxLos', code: 'TIDAK_SAH', message: 'MaxLOS tidak boleh kurang dari MinLOS.' });
  }
  return galat;
}

/** Daftar tanggal [checkin, checkout) -- pola sama dengan `daftarMalam` MI-6. */
export function daftarMalam(checkin: string, checkout: string): string[] {
  const hasil: string[] = [];
  let cursor = new Date(`${checkin}T00:00:00Z`);
  const akhir = new Date(`${checkout}T00:00:00Z`);
  while (cursor < akhir) {
    hasil.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return hasil;
}
