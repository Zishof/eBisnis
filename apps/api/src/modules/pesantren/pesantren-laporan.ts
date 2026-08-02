/**
 * Aturan laporan ePesantren (EP-P) — fungsi murni, tanpa basis data.
 *
 * Pola disalin dari `pos-report.ts` (satu-satunya modul laporan yang sudah
 * ada di monorepo ini): batas rentang tanggal ditegakkan sekali di sini,
 * bukan diulang di setiap kueri, dan katalog laporan sebagai daftar
 * bertipe yang sekaligus menjadi whitelist runtime.
 */

/** Rentang laporan yang paling jauh boleh diminta sekaligus. */
export const MAKS_HARI_LAPORAN = 92;

export interface RentangLaporan {
  from: string;
  to: string;
  days: number;
}

export type AlasanRentangTolak = 'INVALID_DATE' | 'REVERSED' | 'TOO_WIDE';

export interface HasilRentang {
  ok: boolean;
  reason?: AlasanRentangTolak;
  message?: string;
  range?: RentangLaporan;
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Memvalidasi rentang tanggal laporan. Bila `from`/`to` tidak diisi,
 * bawaannya 30 hari terakhir berakhir hari ini -- laporan presensi/dompet
 * yang dibuka tanpa filter tidak boleh diam-diam memindai seluruh riwayat.
 */
export function periksaRentang(from?: string, to?: string, hariIni?: string): HasilRentang {
  const hari = hariIni || new Date().toISOString().slice(0, 10);
  const akhir = to?.trim() || hari;
  const awal = from?.trim() || tigaPuluhHariSebelum(akhir);

  if (!POLA_TANGGAL.test(awal) || !POLA_TANGGAL.test(akhir)) {
    return { ok: false, reason: 'INVALID_DATE', message: 'Tanggal harus berbentuk YYYY-MM-DD.' };
  }
  if (awal > akhir) {
    return {
      ok: false,
      reason: 'REVERSED',
      message: `Tanggal mulai (${awal}) melewati tanggal akhir (${akhir}).`,
    };
  }

  const jumlahHari = selisihHari(awal, akhir) + 1;
  if (jumlahHari > MAKS_HARI_LAPORAN) {
    return {
      ok: false,
      reason: 'TOO_WIDE',
      message:
        `Rentang ${jumlahHari} hari melampaui batas ${MAKS_HARI_LAPORAN} hari. ` +
        'Pecah menjadi beberapa permintaan.',
    };
  }

  return { ok: true, range: { from: awal, to: akhir, days: jumlahHari } };
}

function tigaPuluhHariSebelum(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 29);
  return d.toISOString().slice(0, 10);
}

function selisihHari(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Berapa persen sebuah bagian dari keseluruhan, aman terhadap pembagi nol. */
export function persen(bagian: number, keseluruhan: number): number {
  if (!keseluruhan) return 0;
  return Math.round((bagian / keseluruhan) * 10_000) / 100;
}

/** Daftar laporan yang tersedia, dipakai antarmuka untuk menyusun menunya. */
export const LAPORAN_PESANTREN = [
  { code: 'SANTRI_RINGKASAN', name: 'Ringkasan Santri' },
  { code: 'PRESENSI_REKAP', name: 'Rekap Presensi' },
  { code: 'TAGIHAN_REKAP', name: 'Rekap Tagihan SPP' },
  { code: 'DOMPET_ARUS', name: 'Arus Dompet Santri' },
  { code: 'NILAI_RATA', name: 'Rata-rata Nilai per Mata Pelajaran' },
  { code: 'PSB_FUNNEL', name: 'Corong Penerimaan Santri Baru' },
  { code: 'ASRAMA_HUNIAN', name: 'Hunian Asrama' },
  { code: 'ROMBONGAN_HUNIAN', name: 'Hunian Rombongan Belajar' },
] as const;

export type KodeLaporan = (typeof LAPORAN_PESANTREN)[number]['code'];

export function laporanDikenal(code: string): code is KodeLaporan {
  return LAPORAN_PESANTREN.some((l) => l.code === code);
}
