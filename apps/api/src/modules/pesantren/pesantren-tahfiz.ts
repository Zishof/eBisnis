/**
 * Validasi setoran tahfiz (EP-I). Pola sama dengan `pesantren-presensi.ts`.
 */

export const JENIS_SETORAN = ['SETORAN', 'MURAJAAH'] as const;
export type JenisSetoran = (typeof JENIS_SETORAN)[number];

export const PREDIKAT_SETORAN = ['LANCAR', 'KURANG_LANCAR', 'TIDAK_LANCAR'] as const;
export type PredikatSetoran = (typeof PREDIKAT_SETORAN)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanSetoran {
  santriId?: string;
  tanggal?: string;
  jenis?: string;
  juz?: number;
  predikat?: string;
  catatan?: string;
}

function tanggalSah(nilai: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return false;
  const d = new Date(`${nilai}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

export function validasiSetoran(masukan: MasukanSetoran): Galat[] {
  const galat: Galat[] = [];

  if (!masukan.santriId?.trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }

  if (!masukan.tanggal) {
    galat.push({ field: 'tanggal', code: 'WAJIB', message: 'Tanggal wajib diisi.' });
  } else if (!tanggalSah(masukan.tanggal)) {
    galat.push({ field: 'tanggal', code: 'TIDAK_SAH', message: 'Format tanggal tidak dikenali. Pakai YYYY-MM-DD.' });
  } else {
    const hariIni = new Date().toISOString().slice(0, 10);
    if (masukan.tanggal > hariIni) {
      galat.push({ field: 'tanggal', code: 'DI_MASA_DEPAN', message: 'Tanggal setoran tidak boleh di masa depan.' });
    }
  }

  if (!masukan.jenis || !JENIS_SETORAN.includes(masukan.jenis as JenisSetoran)) {
    galat.push({
      field: 'jenis',
      code: 'TIDAK_DIKENALI',
      message: `Jenis setoran harus salah satu dari: ${JENIS_SETORAN.join(', ')}.`,
    });
  }

  if (typeof masukan.juz !== 'number' || Number.isNaN(masukan.juz) || masukan.juz < 1 || masukan.juz > 30) {
    galat.push({ field: 'juz', code: 'TIDAK_SAH', message: 'Juz harus berupa angka antara 1 dan 30.' });
  }

  if (!masukan.predikat || !PREDIKAT_SETORAN.includes(masukan.predikat as PredikatSetoran)) {
    galat.push({
      field: 'predikat',
      code: 'TIDAK_DIKENALI',
      message: `Predikat harus salah satu dari: ${PREDIKAT_SETORAN.join(', ')}.`,
    });
  }

  return galat;
}
