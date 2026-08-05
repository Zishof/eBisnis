/**
 * Validasi mata pelajaran, komponen nilai, skala huruf, dan nilai santri
 * (EP-O). Pola sama dengan `pesantren-santri.ts`.
 */

export interface Galat {
  field: string;
  code: string;
  message: string;
}

/** Jenjang referensi Dapodik/EMIS Kemenag. Lihat migrasi 20260803T030000. */
export const JENJANG_MAPEL = ['RA', 'MI', 'MTS', 'MA', 'SMK'] as const;
export type JenjangMapel = (typeof JENJANG_MAPEL)[number];

export interface MasukanMataPelajaran {
  code?: string;
  nama?: string;
  kelompok?: string;
  kodeMapelDapodik?: string | null;
  jenjang?: string | null;
}

export function validasiMataPelajaran(masukan: MasukanMataPelajaran): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.code?.trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode mata pelajaran wajib diisi.' });
  }
  if (!masukan.nama?.trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama mata pelajaran wajib diisi.' });
  }
  if (masukan.jenjang && !JENJANG_MAPEL.includes(masukan.jenjang as JenjangMapel)) {
    galat.push({
      field: 'jenjang',
      code: 'TIDAK_DIKENALI',
      message: `Jenjang tidak dikenali. Pilih salah satu: ${JENJANG_MAPEL.join(', ')}.`,
    });
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

export interface MasukanRanking {
  id: string;
  rataRata: number | null;
}

/**
 * Ranking padat untuk leger kelas. Nilai kosong tidak diberi ranking, dan
 * nilai yang sama menempati ranking yang sama.
 */
export function hitungRankingPadat(rows: MasukanRanking[]): Map<string, number | null> {
  const ranking = new Map<string, number | null>();
  for (const row of rows) ranking.set(row.id, null);

  const berNilai = rows
    .filter((row): row is { id: string; rataRata: number } => row.rataRata !== null)
    .sort((a, b) => b.rataRata - a.rataRata || a.id.localeCompare(b.id));

  let posisi = 0;
  let nilaiSebelumnya: number | null = null;
  for (const row of berNilai) {
    if (nilaiSebelumnya === null || row.rataRata !== nilaiSebelumnya) {
      posisi += 1;
      nilaiSebelumnya = row.rataRata;
    }
    ranking.set(row.id, posisi);
  }

  return ranking;
}
