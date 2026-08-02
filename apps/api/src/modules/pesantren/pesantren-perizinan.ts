/**
 * Validasi izin dan lintasan gerbang (EP-J). Pola sama dengan
 * `pesantren-santri.ts`.
 */

export const JENIS_IZIN = ['PULANG', 'SAKIT', 'KEPERLUAN_KELUARGA', 'LAINNYA'] as const;
export type JenisIzin = (typeof JENIS_IZIN)[number];

export const ARAH_GERBANG = ['KELUAR', 'MASUK'] as const;
export type ArahGerbang = (typeof ARAH_GERBANG)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

function tanggalSah(nilai: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return false;
  const d = new Date(`${nilai}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

export interface MasukanIzin {
  santriId?: string;
  jenis?: string;
  alasan?: string;
  tanggalMulai?: string;
  tanggalSelesaiRencana?: string;
}

export function validasiIzin(masukan: MasukanIzin): Galat[] {
  const galat: Galat[] = [];

  if (!masukan.santriId?.trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }
  if (!masukan.jenis || !JENIS_IZIN.includes(masukan.jenis as JenisIzin)) {
    galat.push({
      field: 'jenis',
      code: 'TIDAK_DIKENALI',
      message: `Jenis izin harus salah satu dari: ${JENIS_IZIN.join(', ')}.`,
    });
  }
  if (!masukan.alasan?.trim()) {
    galat.push({ field: 'alasan', code: 'WAJIB', message: 'Alasan izin wajib diisi.' });
  }
  if (!masukan.tanggalMulai) {
    galat.push({ field: 'tanggalMulai', code: 'WAJIB', message: 'Tanggal mulai wajib diisi.' });
  } else if (!tanggalSah(masukan.tanggalMulai)) {
    galat.push({ field: 'tanggalMulai', code: 'TIDAK_SAH', message: 'Format tanggal mulai tidak dikenali.' });
  }
  if (!masukan.tanggalSelesaiRencana) {
    galat.push({ field: 'tanggalSelesaiRencana', code: 'WAJIB', message: 'Tanggal rencana selesai wajib diisi.' });
  } else if (!tanggalSah(masukan.tanggalSelesaiRencana)) {
    galat.push({
      field: 'tanggalSelesaiRencana',
      code: 'TIDAK_SAH',
      message: 'Format tanggal rencana selesai tidak dikenali.',
    });
  } else if (
    masukan.tanggalMulai &&
    tanggalSah(masukan.tanggalMulai) &&
    masukan.tanggalSelesaiRencana < masukan.tanggalMulai
  ) {
    galat.push({
      field: 'tanggalSelesaiRencana',
      code: 'SEBELUM_MULAI',
      message: 'Tanggal rencana selesai tidak boleh sebelum tanggal mulai.',
    });
  }

  return galat;
}

export interface MasukanKeputusan {
  catatan?: string;
}

export interface MasukanLintasan {
  izinId?: string;
  arah?: string;
  catatan?: string;
}

export function validasiLintasan(masukan: MasukanLintasan): Galat[] {
  const galat: Galat[] = [];
  if (!masukan.izinId?.trim()) {
    galat.push({ field: 'izinId', code: 'WAJIB', message: 'ID izin wajib diisi.' });
  }
  if (!masukan.arah || !ARAH_GERBANG.includes(masukan.arah as ArahGerbang)) {
    galat.push({
      field: 'arah',
      code: 'TIDAK_DIKENALI',
      message: `Arah harus salah satu dari: ${ARAH_GERBANG.join(', ')}.`,
    });
  }
  return galat;
}
