/**
 * Validasi reservasi dan siklus hidupnya (MI-8).
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export const STATUS_RESERVASI = ['HOLD', 'CONFIRMED', 'CANCELLED', 'NO_SHOW'] as const;
export type StatusReservasi = (typeof STATUS_RESERVASI)[number];

export const SUMBER_RESERVASI = ['DIRECT', 'WALK_IN', 'PHONE', 'OTA', 'WEBSITE', 'OTHER'] as const;

/**
 * Transisi status yang diizinkan. Diperiksa SEBELUM setiap perubahan
 * status -- reservasi yang sudah CANCELLED tidak dapat langsung menjadi
 * NO_SHOW tanpa dipulihkan (`CONFIRMED`) lebih dulu, misalnya.
 */
export const TRANSISI_DIIZINKAN: Record<StatusReservasi, StatusReservasi[]> = {
  HOLD: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'NO_SHOW'],
  CANCELLED: ['CONFIRMED'],
  NO_SHOW: ['CONFIRMED'],
};

export interface MasukanRoomStay {
  roomTypeId?: string;
  checkinDate?: string;
  checkoutDate?: string;
  adults?: number;
  children?: number;
  rateAmount?: number;
  guestId?: string;
  /**
   * Kode rate plan (MI-10) yang menjadi sumber `rateAmount`, bila ada --
   * murni untuk jejak pada `rate_snapshot`, bukan kolom relasi (tidak ada
   * migrasi tambahan). Kosong berarti tarif dimasukkan manual staf,
   * seperti sebelum MI-10 ada.
   */
  ratePlanCode?: string;
}

export interface MasukanReservasi {
  propertyId?: string;
  guestId?: string;
  source?: string;
  marketSegment?: string;
  specialRequests?: string;
  idempotencyKey?: string;
  statusAwal?: string;
  roomStays?: MasukanRoomStay[];
}

export interface MasukanBatalkan {
  alasan?: string;
}

function tanggalSah(nilai?: string): boolean {
  if (!nilai) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(nilai) && !Number.isNaN(Date.parse(nilai));
}

export function validasiRoomStay(masukan: MasukanRoomStay, indeks: number): Galat[] {
  const galat: Galat[] = [];
  const p = `roomStays[${indeks}]`;
  if (!masukan.roomTypeId?.trim()) {
    galat.push({ field: `${p}.roomTypeId`, code: 'WAJIB', message: 'Tipe kamar wajib dipilih.' });
  }
  if (!tanggalSah(masukan.checkinDate)) {
    galat.push({ field: `${p}.checkinDate`, code: 'TIDAK_SAH', message: 'Tanggal check-in wajib diisi, format YYYY-MM-DD.' });
  }
  if (!tanggalSah(masukan.checkoutDate)) {
    galat.push({ field: `${p}.checkoutDate`, code: 'TIDAK_SAH', message: 'Tanggal check-out wajib diisi, format YYYY-MM-DD.' });
  }
  if (tanggalSah(masukan.checkinDate) && tanggalSah(masukan.checkoutDate)) {
    if (Date.parse(masukan.checkoutDate!) <= Date.parse(masukan.checkinDate!)) {
      galat.push({ field: `${p}.checkoutDate`, code: 'TIDAK_SAH', message: 'Tanggal check-out harus setelah check-in.' });
    }
  }
  if (masukan.adults !== undefined && (!Number.isInteger(masukan.adults) || masukan.adults <= 0)) {
    galat.push({ field: `${p}.adults`, code: 'TIDAK_SAH', message: 'Jumlah dewasa harus bilangan bulat lebih dari nol.' });
  }
  if (masukan.children !== undefined && (!Number.isInteger(masukan.children) || masukan.children < 0)) {
    galat.push({ field: `${p}.children`, code: 'TIDAK_SAH', message: 'Jumlah anak harus bilangan bulat, boleh nol.' });
  }
  if (
    masukan.rateAmount === undefined ||
    masukan.rateAmount === null ||
    typeof masukan.rateAmount !== 'number' ||
    Number.isNaN(masukan.rateAmount) ||
    masukan.rateAmount < 0
  ) {
    galat.push({ field: `${p}.rateAmount`, code: 'TIDAK_SAH', message: 'Tarif wajib diisi, tidak boleh negatif.' });
  }
  return galat;
}

export function validasiReservasi(masukan: MasukanReservasi): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.propertyId?.trim()) {
    galat.push({ field: 'propertyId', code: 'WAJIB', message: 'Properti wajib dipilih.' });
  }
  if (!masukan.guestId?.trim()) {
    galat.push({ field: 'guestId', code: 'WAJIB', message: 'Tamu utama wajib dipilih.' });
  }
  if (masukan.source && !SUMBER_RESERVASI.includes(masukan.source as (typeof SUMBER_RESERVASI)[number])) {
    galat.push({
      field: 'source',
      code: 'TIDAK_DIKENALI',
      message: `Sumber reservasi harus salah satu dari: ${SUMBER_RESERVASI.join(', ')}.`,
    });
  }
  if (masukan.statusAwal && masukan.statusAwal !== 'HOLD' && masukan.statusAwal !== 'CONFIRMED') {
    galat.push({
      field: 'statusAwal',
      code: 'TIDAK_DIKENALI',
      message: 'Status awal reservasi hanya boleh HOLD atau CONFIRMED.',
    });
  }
  if (!masukan.roomStays || masukan.roomStays.length === 0) {
    galat.push({ field: 'roomStays', code: 'WAJIB', message: 'Reservasi wajib punya sekurang-kurangnya satu kamar.' });
  } else {
    masukan.roomStays.forEach((rs, i) => galat.push(...validasiRoomStay(rs, i)));
  }
  return galat;
}

export function validasiBatalkan(masukan: MasukanBatalkan): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.alasan?.trim()) {
    galat.push({ field: 'alasan', code: 'WAJIB', message: 'Alasan pembatalan wajib diisi.' });
  }
  return galat;
}

export function transisiDiizinkan(dari: string, ke: string): boolean {
  const daftar = TRANSISI_DIIZINKAN[dari as StatusReservasi];
  return !!daftar && daftar.includes(ke as StatusReservasi);
}
