/**
 * Aturan laporan kasir — fungsi murni, tanpa basis data.
 *
 * Dua hal yang ditaruh di sini alih-alih di dalam kueri:
 *
 * 1. **Batas rentang tanggal.** Laporan tanpa batas akan memindai seluruh
 *    riwayat penjualan begitu sebuah outlet berjalan setahun, dan yang
 *    menanggungnya adalah kasir yang sedang melayani antrean pada basis data
 *    yang sama.
 *
 * 2. **Penyembunyian angka biaya.** Kasir tidak berhak melihat HPP dan margin.
 *    Aturannya ditulis sekali di sini dan dipakai seluruh laporan — bukan
 *    diulang pada empat belas kueri, yang berarti empat belas kesempatan untuk
 *    lupa.
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
 * Memvalidasi rentang tanggal laporan.
 *
 * Menerima tanggal usaha (`business_date`), bukan cap waktu. Kasir yang bekerja
 * melewati tengah malam tetap berada pada tanggal usaha yang sama, dan laporan
 * yang memotong pada pukul 00.00 akan membelah satu shift menjadi dua hari.
 */
export function periksaRentang(from?: string, to?: string, hariIni?: string): HasilRentang {
  const akhir = to?.trim() || hariIni || '';
  const awal = from?.trim() || akhir;

  if (!POLA_TANGGAL.test(awal) || !POLA_TANGGAL.test(akhir)) {
    return {
      ok: false,
      reason: 'INVALID_DATE',
      message: 'Tanggal harus berbentuk YYYY-MM-DD.',
    };
  }
  if (awal > akhir) {
    return {
      ok: false,
      reason: 'REVERSED',
      message: `Tanggal mulai (${awal}) melewati tanggal akhir (${akhir}).`,
    };
  }

  const hari = selisihHari(awal, akhir) + 1;
  if (hari > MAKS_HARI_LAPORAN) {
    return {
      ok: false,
      reason: 'TOO_WIDE',
      // Menyebutkan batasnya, bukan hanya menolak. Yang meminta rentang lebar
      // biasanya sedang mencari sesuatu, dan perlu tahu harus memecahnya
      // menjadi berapa bagian.
      message:
        `Rentang ${hari} hari melampaui batas ${MAKS_HARI_LAPORAN} hari. ` +
        'Pecah menjadi beberapa permintaan, atau pakai laporan bulanan.',
    };
  }

  return { ok: true, range: { from: awal, to: akhir, days: hari } };
}

function selisihHari(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Kolom yang disembunyikan dari yang tidak berhak melihat biaya.
 *
 * Kasir dapat melihat berapa yang terjual; berapa untungnya bukan urusannya,
 * dan pada banyak usaha justru itu yang paling tidak boleh beredar di lantai
 * toko.
 */
export const KOLOM_BIAYA = ['cost', 'cogs', 'margin', 'marginPercent', 'profit'] as const;

export function sembunyikanBiaya<T extends Record<string, unknown>>(
  baris: T[],
  bolehLihatBiaya: boolean,
): T[] {
  if (bolehLihatBiaya) return baris;
  return baris.map((r) => {
    const salinan = { ...r };
    for (const k of KOLOM_BIAYA) delete salinan[k];
    return salinan;
  });
}

/** Berapa persen sebuah bagian dari keseluruhan, aman terhadap pembagi nol. */
export function persen(bagian: number, keseluruhan: number): number {
  if (!keseluruhan) return 0;
  return Math.round((bagian / keseluruhan) * 10_000) / 100;
}

/**
 * Menandai baris yang pantas diperiksa manusia.
 *
 * Bukan tuduhan. Angka yang menonjol pada laporan kasir hampir selalu punya
 * penjelasan biasa — hari besar, pelanggan borongan, promo yang baru mulai.
 * Yang berguna adalah menampilkannya lebih dahulu, bukan menyimpulkannya.
 */
export interface AmbangAnomali {
  /** Nilai void di atas sekian persen total penjualan. */
  voidPersen: number;
  /** Nilai diskon di atas sekian persen total penjualan. */
  diskonPersen: number;
  /** Selisih kas di atas nilai ini. */
  selisihKas: number;
}

export const AMBANG_BAWAAN: AmbangAnomali = {
  voidPersen: 5,
  diskonPersen: 15,
  selisihKas: 50_000,
};

export interface Sorotan {
  kind: 'VOID_TINGGI' | 'DISKON_TINGGI' | 'SELISIH_KAS';
  label: string;
  value: number;
  threshold: number;
  message: string;
}

export function sorotanKasir(
  input: {
    cashierName: string;
    totalSales: number;
    voidValue: number;
    discountValue: number;
    cashVariance: number;
  },
  ambang: AmbangAnomali = AMBANG_BAWAAN,
): Sorotan[] {
  const hasil: Sorotan[] = [];

  const pVoid = persen(input.voidValue, input.totalSales);
  if (pVoid > ambang.voidPersen) {
    hasil.push({
      kind: 'VOID_TINGGI',
      label: input.cashierName,
      value: pVoid,
      threshold: ambang.voidPersen,
      message:
        `Pembatalan ${pVoid}% dari penjualan, di atas ambang ${ambang.voidPersen}%. ` +
        'Perlu ditanyakan, belum tentu bermasalah.',
    });
  }

  const pDiskon = persen(input.discountValue, input.totalSales);
  if (pDiskon > ambang.diskonPersen) {
    hasil.push({
      kind: 'DISKON_TINGGI',
      label: input.cashierName,
      value: pDiskon,
      threshold: ambang.diskonPersen,
      message:
        `Diskon ${pDiskon}% dari penjualan, di atas ambang ${ambang.diskonPersen}%. ` +
        'Periksa apakah promonya memang sedang berjalan.',
    });
  }

  if (Math.abs(input.cashVariance) > ambang.selisihKas) {
    hasil.push({
      kind: 'SELISIH_KAS',
      label: input.cashierName,
      value: input.cashVariance,
      threshold: ambang.selisihKas,
      message:
        `Selisih kas ${input.cashVariance > 0 ? 'lebih' : 'kurang'} ` +
        `${Math.abs(input.cashVariance)}, di atas ambang ${ambang.selisihKas}.`,
    });
  }

  return hasil;
}

/** Daftar laporan yang tersedia, dipakai antarmuka untuk menyusun menunya. */
export const LAPORAN_POS = [
  { code: 'SALES_SUMMARY', name: 'Ringkasan Penjualan', needsCost: false },
  { code: 'SALES_DETAIL', name: 'Rincian Penjualan', needsCost: false },
  { code: 'BY_PRODUCT', name: 'Penjualan per Produk', needsCost: true },
  { code: 'BY_CATEGORY', name: 'Penjualan per Kategori', needsCost: true },
  { code: 'BY_CASHIER', name: 'Penjualan per Kasir', needsCost: false },
  { code: 'BY_REGISTER', name: 'Penjualan per Register', needsCost: false },
  { code: 'BY_SHIFT', name: 'Penjualan per Shift', needsCost: false },
  { code: 'PAYMENT_MIX', name: 'Komposisi Pembayaran', needsCost: false },
  { code: 'TAX', name: 'Rekap Pajak Keluaran', needsCost: false },
  { code: 'DISCOUNT', name: 'Rekap Diskon', needsCost: false },
  { code: 'VOID', name: 'Rekap Pembatalan', needsCost: false },
  { code: 'RETURN', name: 'Rekap Retur', needsCost: false },
  { code: 'REFUND', name: 'Rekap Refund', needsCost: false },
  { code: 'CASH_MOVEMENT', name: 'Pergerakan Kas', needsCost: false },
  { code: 'CASH_VARIANCE', name: 'Selisih Kas', needsCost: false },
] as const;

export type KodeLaporan = (typeof LAPORAN_POS)[number]['code'];

export function laporanDikenal(code: string): code is KodeLaporan {
  return LAPORAN_POS.some((l) => l.code === code);
}
