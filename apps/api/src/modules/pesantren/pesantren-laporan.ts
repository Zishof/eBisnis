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
  { code: 'SANTRI_RINGKASAN', name: 'Ringkasan Santri', description: 'Jumlah santri menurut status, gender, dan mukim/nonmukim.' },
  { code: 'SANTRI_PER_TAHUN_MASUK', name: 'Santri per Tahun Masuk', description: 'Tren penerimaan santri dari tanggal masuk.' },
  { code: 'SANTRI_PER_TAHUN_LULUS', name: 'Santri per Tahun Lulus', description: 'Tren kelulusan berdasarkan tanggal keluar berstatus lulus.' },
  { code: 'SANTRI_STATUS_DETAIL', name: 'Status Aktif, Keluar, Pindah, dan Lulus', description: 'Dashboard status santri setara AIS DashboardStatusSiswa.' },
  { code: 'SANTRI_ASAL_ALAMAT', name: 'Sebaran Alamat Asal Santri', description: 'Ringkasan alamat asal untuk membaca sebaran daerah santri.' },
  { code: 'PRESENSI_REKAP', name: 'Rekap Presensi', description: 'Rekap kehadiran santri per jenis kegiatan pada rentang tanggal.' },
  { code: 'TAGIHAN_REKAP', name: 'Rekap Tagihan SPP', description: 'Ringkasan status dan nominal tagihan per periode.' },
  { code: 'TAGIHAN_SANTRI', name: 'Piutang dan Pembayaran per Santri', description: 'Total tagihan, pembayaran, dan sisa per santri.' },
  { code: 'DOMPET_ARUS', name: 'Arus Dompet Santri', description: 'Total transaksi dompet santri pada rentang tanggal.' },
  { code: 'NILAI_RATA', name: 'Rata-rata Nilai per Mata Pelajaran', description: 'Rata-rata komponen nilai per mata pelajaran.' },
  { code: 'PSB_FUNNEL', name: 'Corong Penerimaan Santri Baru', description: 'Jumlah pendaftar PSB menurut gelombang dan status.' },
  { code: 'PSB_REGISTRASI_BULANAN', name: 'Registrasi PSB per Bulan', description: 'Tren pendaftaran PSB bulanan setara dashboard registrasi AIS.' },
  { code: 'PSB_ASAL_SEKOLAH', name: 'Asal Sekolah Pendaftar PSB', description: 'Sekolah asal pendaftar dan hasil seleksinya.' },
  { code: 'PSB_JALUR_MASUK_MULTI_TAHUN', name: 'Jalur Masuk PSB Multi-Tahun', description: 'Rekap jalur masuk per tahun ajaran setara RekapJalurMasukMultiTahunPsb AIS.' },
  { code: 'ASRAMA_HUNIAN', name: 'Hunian Asrama', description: 'Kapasitas dan keterisian kamar asrama.' },
  { code: 'ROMBONGAN_HUNIAN', name: 'Hunian Rombongan Belajar', description: 'Kapasitas dan jumlah anggota aktif per rombongan belajar.' },
] as const;

export type KodeLaporan = (typeof LAPORAN_PESANTREN)[number]['code'];

export function laporanDikenal(code: string): code is KodeLaporan {
  return LAPORAN_PESANTREN.some((l) => l.code === code);
}
