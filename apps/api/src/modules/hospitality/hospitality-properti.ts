/**
 * Validasi properti, tipe kamar, dan kamar (MI-5). Pola sama dengan
 * `pesantren-asrama.ts`.
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export const STATUS_PROPERTI = ['ACTIVE', 'INACTIVE'] as const;
export const STATUS_KAMAR = ['AVAILABLE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'BLOCKED'] as const;

export interface MasukanProperti {
  code?: string;
  nama?: string;
  timezone?: string;
  alamat?: string;
}

export interface MasukanTipeKamar {
  code?: string;
  nama?: string;
  okupansiMaks?: number;
  deskripsi?: string;
}

/**
 * Tag bebas (MI-6) -- BRD belum menetapkan daftar baku, jadi ini catatan
 * yang lazim dipakai (aksesibilitas, merokok, pemandangan), bukan daftar
 * tertutup yang ditegakkan server. Ditampilkan sebagai anjuran di
 * formulir, bukan validasi keras -- tag lain tetap diterima.
 */
export const FITUR_KAMAR_SARAN = [
  'ACCESSIBLE',
  'SMOKING',
  'NON_SMOKING',
  'CITY_VIEW',
  'POOL_VIEW',
  'BALCONY',
] as const;

export interface MasukanKamar {
  roomTypeId?: string;
  nomorKamar?: string;
  lantai?: string;
  features?: string[];
}

export function validasiProperti(masukan: MasukanProperti): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.code?.trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode properti wajib diisi.' });
  } else if (masukan.code.trim().length > 32) {
    galat.push({ field: 'code', code: 'TERLALU_PANJANG', message: 'Kode properti maksimal 32 karakter.' });
  }
  if (!masukan.nama?.trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama properti wajib diisi.' });
  } else if (masukan.nama.trim().length > 120) {
    galat.push({ field: 'nama', code: 'TERLALU_PANJANG', message: 'Nama properti maksimal 120 karakter.' });
  }
  return galat;
}

export function validasiTipeKamar(masukan: MasukanTipeKamar): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.code?.trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode tipe kamar wajib diisi.' });
  } else if (masukan.code.trim().length > 32) {
    galat.push({ field: 'code', code: 'TERLALU_PANJANG', message: 'Kode tipe kamar maksimal 32 karakter.' });
  }
  if (!masukan.nama?.trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama tipe kamar wajib diisi.' });
  }
  if (
    masukan.okupansiMaks === undefined ||
    masukan.okupansiMaks === null ||
    !Number.isInteger(masukan.okupansiMaks) ||
    masukan.okupansiMaks <= 0
  ) {
    galat.push({
      field: 'okupansiMaks',
      code: 'TIDAK_SAH',
      message: 'Okupansi maksimum harus bilangan bulat lebih dari nol.',
    });
  }
  return galat;
}

export function validasiKamar(masukan: MasukanKamar): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.roomTypeId?.trim()) {
    galat.push({ field: 'roomTypeId', code: 'WAJIB', message: 'Tipe kamar wajib dipilih.' });
  }
  if (!masukan.nomorKamar?.trim()) {
    galat.push({ field: 'nomorKamar', code: 'WAJIB', message: 'Nomor kamar wajib diisi.' });
  } else if (masukan.nomorKamar.trim().length > 16) {
    galat.push({ field: 'nomorKamar', code: 'TERLALU_PANJANG', message: 'Nomor kamar maksimal 16 karakter.' });
  }
  return galat;
}
