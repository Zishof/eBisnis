/**
 * Validasi blokir kamar dan permintaan ketersediaan (MI-6).
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export const STATUS_BLOKIR = ['BLOCKED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'] as const;
export type StatusBlokir = (typeof STATUS_BLOKIR)[number];

export interface MasukanBlokir {
  checkin?: string;
  checkout?: string;
  status?: string;
  alasan?: string;
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
    galat.push({ field: 'checkin', code: 'TIDAK_SAH', message: 'Tanggal check-in wajib diisi, format YYYY-MM-DD.' });
  }
  if (!tanggalSah(masukan.checkout)) {
    galat.push({ field: 'checkout', code: 'TIDAK_SAH', message: 'Tanggal check-out wajib diisi, format YYYY-MM-DD.' });
  }
  if (tanggalSah(masukan.checkin) && tanggalSah(masukan.checkout)) {
    if (Date.parse(masukan.checkout!) <= Date.parse(masukan.checkin!)) {
      galat.push({
        field: 'checkout',
        code: 'TIDAK_SAH',
        message: 'Tanggal check-out harus setelah tanggal check-in.',
      });
    }
  }
  return galat;
}

export function validasiBlokir(masukan: MasukanBlokir): Galat[] {
  const galat = validasiRentangTanggal(masukan);
  if (!masukan.status || !STATUS_BLOKIR.includes(masukan.status as StatusBlokir)) {
    galat.push({
      field: 'status',
      code: 'TIDAK_DIKENALI',
      message: `Status harus salah satu dari: ${STATUS_BLOKIR.join(', ')}.`,
    });
  }
  return galat;
}

/** Daftar tanggal [checkin, checkout) -- checkout sendiri TIDAK termasuk malam yang diblokir. */
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
