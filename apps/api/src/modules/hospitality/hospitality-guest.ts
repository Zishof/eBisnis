/**
 * Validasi profil tamu, consent, do-not-rent, penggabungan, dan permintaan
 * privasi (MI-7).
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export const JENIS_IDENTITAS = ['KTP', 'PASSPORT', 'SIM', 'KITAS', 'OTHER'] as const;
export const JENIS_PERMINTAAN_PRIVASI = ['EXPORT', 'ERASURE'] as const;
export const STATUS_PERMINTAAN_PRIVASI = ['COMPLETED', 'REJECTED'] as const;

export interface MasukanTamu {
  namaLengkap?: string;
  jenisIdentitas?: string;
  nomorIdentitas?: string;
  email?: string;
  telepon?: string;
  alamat?: string;
  kewarganegaraan?: string;
  tanggalLahir?: string;
  preferensi?: string;
}

export interface MasukanDoNotRent {
  doNotRent?: boolean;
  alasan?: string;
}

export interface MasukanGabung {
  intoGuestId?: string;
}

export interface MasukanPermintaanPrivasi {
  jenis?: string;
  catatan?: string;
}

export interface MasukanProsesPermintaanPrivasi {
  status?: string;
  catatan?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validasiTamu(masukan: MasukanTamu): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.namaLengkap?.trim()) {
    galat.push({ field: 'namaLengkap', code: 'WAJIB', message: 'Nama lengkap tamu wajib diisi.' });
  } else if (masukan.namaLengkap.trim().length > 160) {
    galat.push({ field: 'namaLengkap', code: 'TERLALU_PANJANG', message: 'Nama lengkap maksimal 160 karakter.' });
  }

  if (masukan.email && !EMAIL_RE.test(masukan.email)) {
    galat.push({ field: 'email', code: 'TIDAK_SAH', message: 'Format email tidak sah.' });
  }

  // Jenis dan nomor identitas berpasangan -- salah satu terisi tanpa yang
  // lain berarti nomor identitas tidak dapat ditelusuri jenisnya, atau
  // jenis dicatat tanpa nomor yang menyertainya.
  if (masukan.jenisIdentitas && !masukan.nomorIdentitas?.trim()) {
    galat.push({
      field: 'nomorIdentitas',
      code: 'WAJIB',
      message: 'Nomor identitas wajib diisi bila jenis identitas dipilih.',
    });
  }
  if (masukan.nomorIdentitas?.trim() && !masukan.jenisIdentitas) {
    galat.push({
      field: 'jenisIdentitas',
      code: 'WAJIB',
      message: 'Jenis identitas wajib dipilih bila nomor identitas diisi.',
    });
  }
  if (masukan.jenisIdentitas && !JENIS_IDENTITAS.includes(masukan.jenisIdentitas as (typeof JENIS_IDENTITAS)[number])) {
    galat.push({
      field: 'jenisIdentitas',
      code: 'TIDAK_DIKENALI',
      message: `Jenis identitas harus salah satu dari: ${JENIS_IDENTITAS.join(', ')}.`,
    });
  }

  return galat;
}

export function validasiDoNotRent(masukan: MasukanDoNotRent): Galat[] {
  const galat: Galat[] = [];
  if (masukan.doNotRent && !masukan.alasan?.trim()) {
    galat.push({
      field: 'alasan',
      code: 'WAJIB',
      message: 'Alasan wajib diisi saat menandai tamu sebagai do-not-rent.',
    });
  }
  return galat;
}

export function validasiGabung(masukan: MasukanGabung): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.intoGuestId?.trim()) {
    galat.push({ field: 'intoGuestId', code: 'WAJIB', message: 'Profil tujuan penggabungan wajib dipilih.' });
  }
  return galat;
}

export function validasiPermintaanPrivasi(masukan: MasukanPermintaanPrivasi): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.jenis || !JENIS_PERMINTAAN_PRIVASI.includes(masukan.jenis as (typeof JENIS_PERMINTAAN_PRIVASI)[number])) {
    galat.push({
      field: 'jenis',
      code: 'TIDAK_DIKENALI',
      message: `Jenis permintaan harus salah satu dari: ${JENIS_PERMINTAAN_PRIVASI.join(', ')}.`,
    });
  }
  return galat;
}

export function validasiProsesPermintaanPrivasi(masukan: MasukanProsesPermintaanPrivasi): Galat[] {
  const galat: Galat[] = [];
  if (
    !masukan.status ||
    !STATUS_PERMINTAAN_PRIVASI.includes(masukan.status as (typeof STATUS_PERMINTAAN_PRIVASI)[number])
  ) {
    galat.push({
      field: 'status',
      code: 'TIDAK_DIKENALI',
      message: `Status harus salah satu dari: ${STATUS_PERMINTAAN_PRIVASI.join(', ')}.`,
    });
  }
  return galat;
}
