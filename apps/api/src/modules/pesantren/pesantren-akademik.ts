export const JENIS_KEPUTUSAN_AKADEMIK = ['NAIK_KELAS', 'TINGGAL_KELAS', 'LULUS', 'KELUAR'] as const;
export type JenisKeputusanAkademik = (typeof JENIS_KEPUTUSAN_AKADEMIK)[number];

export const STATUS_KEPUTUSAN_AKADEMIK = ['DRAFT', 'FINALIZED', 'EXECUTED', 'CANCELED'] as const;
export type StatusKeputusanAkademik = (typeof STATUS_KEPUTUSAN_AKADEMIK)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanKeputusanAkademik {
  santriId?: string;
  tahunAjaranAsalId?: string;
  jenis?: string;
  rombonganTujuanId?: string | null;
  tanggalKeputusan?: string | null;
  tanggalEfektif?: string | null;
  catatan?: string | null;
}

export function validasiKeputusanAkademik(masukan: MasukanKeputusanAkademik): Galat[] {
  const galat: Galat[] = [];
  const jenis = masukan.jenis?.trim() as JenisKeputusanAkademik | undefined;

  if (!(masukan.santriId ?? '').trim()) {
    galat.push({ field: 'santriId', code: 'WAJIB', message: 'Santri wajib dipilih.' });
  }
  if (!(masukan.tahunAjaranAsalId ?? '').trim()) {
    galat.push({ field: 'tahunAjaranAsalId', code: 'WAJIB', message: 'Tahun ajaran asal wajib dipilih.' });
  }
  if (!jenis) {
    galat.push({ field: 'jenis', code: 'WAJIB', message: 'Jenis keputusan wajib dipilih.' });
  } else if (!JENIS_KEPUTUSAN_AKADEMIK.includes(jenis)) {
    galat.push({ field: 'jenis', code: 'TIDAK_SAH', message: 'Jenis keputusan akademik tidak dikenal.' });
  }

  const target = (masukan.rombonganTujuanId ?? '').trim();
  if ((jenis === 'NAIK_KELAS' || jenis === 'TINGGAL_KELAS') && !target) {
    galat.push({ field: 'rombonganTujuanId', code: 'WAJIB', message: 'Rombongan tujuan wajib dipilih untuk kenaikan/tinggal kelas.' });
  }
  if ((jenis === 'LULUS' || jenis === 'KELUAR') && target) {
    galat.push({ field: 'rombonganTujuanId', code: 'TIDAK_SAH', message: 'Kelulusan/keluar tidak boleh memiliki rombongan tujuan.' });
  }

  if (!tanggalValid(masukan.tanggalKeputusan)) {
    galat.push({ field: 'tanggalKeputusan', code: 'TIDAK_SAH', message: 'Tanggal keputusan tidak sah.' });
  }
  if (!tanggalValid(masukan.tanggalEfektif)) {
    galat.push({ field: 'tanggalEfektif', code: 'TIDAK_SAH', message: 'Tanggal efektif tidak sah.' });
  }

  return galat;
}

export function validasiAlasanPembatalanKeputusan(reason?: string | null): Galat[] {
  const value = (reason ?? '').trim();
  if (!value) {
    return [{ field: 'reason', code: 'WAJIB', message: 'Alasan pembatalan wajib diisi.' }];
  }
  if (value.length < 10) {
    return [{ field: 'reason', code: 'TERLALU_PENDEK', message: 'Alasan pembatalan minimal 10 karakter.' }];
  }
  return [];
}

function tanggalValid(value?: string | null): boolean {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}
