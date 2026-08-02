/**
 * Validasi kitab, halaqah, dan keanggotaan santri (EP-H). Pola sama dengan
 * `pesantren-santri.ts`.
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanKitab {
  code?: string;
  judul?: string;
  pengarang?: string;
  keterangan?: string;
}

export function validasiKitab(masukan: MasukanKitab): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.code?.trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode kitab wajib diisi.' });
  }
  if (!masukan.judul?.trim()) {
    galat.push({ field: 'judul', code: 'WAJIB', message: 'Judul kitab wajib diisi.' });
  }
  return galat;
}

export interface MasukanHalaqah {
  code?: string;
  nama?: string;
  kitabId?: string;
  ustadzId?: string;
}

export function validasiHalaqah(masukan: MasukanHalaqah): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.code?.trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode halaqah wajib diisi.' });
  }
  if (!masukan.nama?.trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama halaqah wajib diisi.' });
  }
  return galat;
}

export interface MasukanKeanggotaan {
  santriId?: string;
}

export function validasiKeanggotaan(masukan: MasukanKeanggotaan): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.santriId?.trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }
  return galat;
}
