/**
 * Validasi mata pelajaran, komponen nilai, skala huruf, dan nilai santri
 * (EP-O). Pola sama dengan `pesantren-santri.ts`.
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanMataPelajaran {
  code?: string;
  nama?: string;
  kelompok?: string;
}

export function validasiMataPelajaran(masukan: MasukanMataPelajaran): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.code?.trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode mata pelajaran wajib diisi.' });
  }
  if (!masukan.nama?.trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama mata pelajaran wajib diisi.' });
  }
  return galat;
}

export interface MasukanKomponenNilai {
  kode?: string;
  nama?: string;
  bobotPersen?: number;
}

export function validasiKomponenNilai(masukan: MasukanKomponenNilai): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.kode?.trim()) {
    galat.push({ field: 'kode', code: 'WAJIB', message: 'Kode komponen wajib diisi.' });
  }
  if (!masukan.nama?.trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama komponen wajib diisi.' });
  }
  if (
    typeof masukan.bobotPersen !== 'number' ||
    Number.isNaN(masukan.bobotPersen) ||
    masukan.bobotPersen <= 0 ||
    masukan.bobotPersen > 100
  ) {
    galat.push({
      field: 'bobotPersen',
      code: 'TIDAK_SAH',
      message: 'Bobot harus berupa angka antara 1 dan 100.',
    });
  }
  return galat;
}

export interface MasukanSkalaHuruf {
  huruf?: string;
  nilaiMinimum?: number;
  nilaiMaksimum?: number;
  keterangan?: string;
}

export function validasiSkalaHuruf(masukan: MasukanSkalaHuruf): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.huruf?.trim()) {
    galat.push({ field: 'huruf', code: 'WAJIB', message: 'Huruf mutu wajib diisi.' });
  }
  if (typeof masukan.nilaiMinimum !== 'number' || Number.isNaN(masukan.nilaiMinimum)) {
    galat.push({ field: 'nilaiMinimum', code: 'WAJIB', message: 'Nilai minimum wajib diisi.' });
  }
  if (typeof masukan.nilaiMaksimum !== 'number' || Number.isNaN(masukan.nilaiMaksimum)) {
    galat.push({ field: 'nilaiMaksimum', code: 'WAJIB', message: 'Nilai maksimum wajib diisi.' });
  }
  if (
    typeof masukan.nilaiMinimum === 'number' &&
    typeof masukan.nilaiMaksimum === 'number' &&
    masukan.nilaiMaksimum < masukan.nilaiMinimum
  ) {
    galat.push({
      field: 'nilaiMaksimum',
      code: 'SEBELUM_MINIMUM',
      message: 'Nilai maksimum tidak boleh lebih kecil dari nilai minimum.',
    });
  }
  return galat;
}

export interface MasukanNilai {
  santriId?: string;
  komponenId?: string;
  tahunAjaranId?: string;
  nilaiAngka?: number;
  catatan?: string;
}

export function validasiNilai(masukan: MasukanNilai): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.santriId?.trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }
  if (!masukan.komponenId?.trim()) {
    galat.push({ field: 'komponenId', code: 'WAJIB', message: 'ID komponen nilai wajib diisi.' });
  }
  if (!masukan.tahunAjaranId?.trim()) {
    galat.push({ field: 'tahunAjaranId', code: 'WAJIB', message: 'ID tahun ajaran wajib diisi.' });
  }
  if (
    typeof masukan.nilaiAngka !== 'number' ||
    Number.isNaN(masukan.nilaiAngka) ||
    masukan.nilaiAngka < 0 ||
    masukan.nilaiAngka > 100
  ) {
    galat.push({
      field: 'nilaiAngka',
      code: 'TIDAK_SAH',
      message: 'Nilai harus berupa angka antara 0 dan 100.',
    });
  }
  return galat;
}

/** Huruf mutu untuk satu nilai akhir, dicari dari skala yang diberikan. */
export function cariHurufMutu(
  nilaiAkhir: number,
  skala: { huruf: string; nilai_minimum: string | number; nilai_maksimum: string | number }[],
): string | null {
  const cocok = skala.find(
    (s) => nilaiAkhir >= Number(s.nilai_minimum) && nilaiAkhir <= Number(s.nilai_maksimum),
  );
  return cocok?.huruf ?? null;
}
