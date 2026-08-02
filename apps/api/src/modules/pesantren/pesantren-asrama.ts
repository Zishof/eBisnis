/**
 * Validasi asrama, kamar, dan penempatan santri (EP-G). Pola sama dengan
 * `pesantren-santri.ts`.
 */

export const JENIS_ASRAMA = ['PUTRA', 'PUTRI'] as const;
export type JenisAsrama = (typeof JENIS_ASRAMA)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanAsrama {
  code?: string;
  nama?: string;
  jenis?: string;
  alamat?: string;
}

export function validasiAsrama(masukan: MasukanAsrama): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.code?.trim()) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode asrama wajib diisi.' });
  }
  if (!masukan.nama?.trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama asrama wajib diisi.' });
  }
  if (!masukan.jenis || !JENIS_ASRAMA.includes(masukan.jenis as JenisAsrama)) {
    galat.push({
      field: 'jenis',
      code: 'TIDAK_DIKENALI',
      message: `Jenis asrama harus salah satu dari: ${JENIS_ASRAMA.join(', ')}.`,
    });
  }
  return galat;
}

export interface MasukanKamar {
  nomor?: string;
  kapasitas?: number;
}

export function validasiKamar(masukan: MasukanKamar): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.nomor?.trim()) {
    galat.push({ field: 'nomor', code: 'WAJIB', message: 'Nomor kamar wajib diisi.' });
  }
  if (typeof masukan.kapasitas !== 'number' || Number.isNaN(masukan.kapasitas) || masukan.kapasitas <= 0) {
    galat.push({
      field: 'kapasitas',
      code: 'TIDAK_SAH',
      message: 'Kapasitas kamar harus berupa angka lebih besar dari nol.',
    });
  }
  return galat;
}

export interface MasukanPenempatan {
  santriId?: string;
  kamarId?: string;
  catatan?: string;
}

export function validasiPenempatan(masukan: MasukanPenempatan): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.santriId?.trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }
  if (!masukan.kamarId?.trim()) {
    galat.push({ field: 'kamarId', code: 'WAJIB', message: 'ID kamar wajib diisi.' });
  }
  return galat;
}
