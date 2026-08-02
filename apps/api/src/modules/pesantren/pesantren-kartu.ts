/**
 * Validasi kartu RFID/QR santri (EP-M). Pola sama dengan `pesantren-santri.ts`.
 */

export const JENIS_KARTU = ['RFID', 'QR'] as const;
export type JenisKartu = (typeof JENIS_KARTU)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanKartu {
  santriId?: string;
  nomorKartu?: string;
  jenis?: string;
}

export function validasiKartu(masukan: MasukanKartu): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.santriId?.trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }
  if (!masukan.nomorKartu?.trim()) {
    galat.push({ field: 'nomorKartu', code: 'WAJIB', message: 'Nomor kartu wajib diisi.' });
  }
  if (!masukan.jenis || !JENIS_KARTU.includes(masukan.jenis as JenisKartu)) {
    galat.push({
      field: 'jenis',
      code: 'TIDAK_DIKENALI',
      message: `Jenis kartu harus salah satu dari: ${JENIS_KARTU.join(', ')}.`,
    });
  }
  return galat;
}
