/**
 * Validasi presensi santri (EP-E). Pola sama dengan `pesantren-santri.ts`.
 */

export const JENIS_PRESENSI = ['SEKOLAH', 'DINIYAH', 'IBADAH', 'KEGIATAN'] as const;
export type JenisPresensi = (typeof JENIS_PRESENSI)[number];

export const STATUS_PRESENSI = ['HADIR', 'IZIN', 'SAKIT', 'ALPA'] as const;
export type StatusPresensi = (typeof STATUS_PRESENSI)[number];

export interface MasukanPresensi {
  santriId?: string;
  tanggal?: string;
  jenis?: string;
  status?: string;
  keterangan?: string;
}

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

export function validasiPresensi(masukan: MasukanPresensi): Galat[] {
  const galat: Galat[] = [];

  if (!masukan.santriId || typeof masukan.santriId !== 'string') {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'ID santri wajib diisi.' });
  }

  if (!masukan.tanggal || typeof masukan.tanggal !== 'string') {
    galat.push({ field: 'tanggal', code: 'WAJIB', message: 'Tanggal wajib diisi.' });
  } else if (!tanggalSah(masukan.tanggal)) {
    galat.push({ field: 'tanggal', code: 'TIDAK_SAH', message: 'Format tanggal tidak dikenali. Pakai YYYY-MM-DD.' });
  } else {
    const hariIni = new Date().toISOString().slice(0, 10);
    if (masukan.tanggal > hariIni) {
      galat.push({ field: 'tanggal', code: 'DI_MASA_DEPAN', message: 'Tanggal presensi tidak boleh di masa depan.' });
    }
  }

  if (!masukan.jenis || !JENIS_PRESENSI.includes(masukan.jenis as JenisPresensi)) {
    galat.push({
      field: 'jenis',
      code: 'TIDAK_DIKENALI',
      message: `Jenis presensi harus salah satu dari: ${JENIS_PRESENSI.join(', ')}.`,
    });
  }

  if (!masukan.status || !STATUS_PRESENSI.includes(masukan.status as StatusPresensi)) {
    galat.push({
      field: 'status',
      code: 'TIDAK_DIKENALI',
      message: `Status kehadiran harus salah satu dari: ${STATUS_PRESENSI.join(', ')}.`,
    });
  }

  if (masukan.status && masukan.status !== 'HADIR' && !masukan.keterangan?.trim()) {
    galat.push({
      field: 'keterangan',
      code: 'WAJIB',
      message: 'Keterangan wajib diisi untuk status selain hadir (izin, sakit, atau alpa harus punya alasan).',
    });
  }

  return galat;
}
