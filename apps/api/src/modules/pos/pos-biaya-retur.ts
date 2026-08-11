/**
 * Biaya persediaan saat barang kembali dari retur atau pembatalan kasir.
 *
 * ## Mengapa berkas ini ada
 *
 * `stock_balance.average_cost` menentukan dua angka yang dibaca orang: nilai
 * persediaan pada laporan stok, dan HPP penjualan yang dijurnal sebagai COGS.
 * Saat barang keluar terjual, rata-rata itu sengaja tidak berubah — itu memang
 * aturan moving-average. Tetapi saat barang KEMBALI, rata-ratanya harus ikut
 * dihitung ulang, kalau tidak persediaan bertambah kuantitasnya tanpa bertambah
 * nilainya, dan setiap retur diam-diam mengencerkan nilai stok.
 *
 * ## Mengapa aturannya di sini, bukan di SQL
 *
 * Yang diputuskan berkas ini adalah **kapan boleh menyentuh rata-rata sama
 * sekali**. Keputusan itu menyangkut uang, dan basis data tidak terjangkau dari
 * setiap mesin yang mengerjakan repo ini — jadi ia dibuat dapat dibuktikan tanpa
 * basis data. SQL-nya hanya menjalankan keputusan yang sudah diambil di sini.
 *
 * ## Bahaya utamanya: biaya nol
 *
 * `pos_sale_line.cost_snapshot` bertipe `NUMERIC NOT NULL DEFAULT 0`, dan
 * diisi dari `COALESCE(average_cost, 0)` saat baris penjualan dibuat. Sampai
 * 10 Agustus 2026 `average_cost` TIDAK PERNAH ditulis jalur transaksi mana pun,
 * sehingga seluruh penjualan sebelum tanggal itu — dan setiap produk yang
 * stoknya tidak pernah lewat penerimaan barang — menyimpan `cost_snapshot`
 * bernilai nol.
 *
 * Mencampurkan nol ke dalam rata-rata bukan sekadar tidak akurat: ia menarik
 * nilai persediaan ke bawah secara permanen, diam-diam, dan justru pada produk
 * yang datanya paling lemah. Satu retur lama sudah cukup untuk merusak valuasi
 * produk itu selamanya, tanpa galat apa pun yang muncul.
 *
 * Karena itu biaya yang tidak diketahui **menolak menyentuh rata-rata**, bukan
 * dianggap nol. Kuantitasnya tetap kembali — barangnya memang ada di rak; yang
 * ditahan hanya klaim tentang nilainya.
 */

import type { EmberStok } from './pos-stock';

/** Mengapa sebuah retur tidak boleh mengubah rata-rata biaya. */
export type AlasanTanpaBiaya =
  /** Barang tidak kembali ke stok jual (rusak atau dimusnahkan). */
  | 'TIDAK_MASUK_STOK_JUAL'
  /** `cost_snapshot` nol atau kosong — nilainya tidak diketahui, bukan nol. */
  | 'BIAYA_TIDAK_DIKETAHUI'
  /** Biaya negatif; tidak ada tafsir yang benar untuk ini. */
  | 'BIAYA_TIDAK_SAH'
  /** Kuantitas nol atau negatif. */
  | 'JUMLAH_TIDAK_SAH'
  /** Retur tanpa gudang tujuan tidak menyentuh saldo mana pun. */
  | 'TANPA_GUDANG';

export interface MasukanBiayaRetur {
  /**
   * Ember tujuan barang, hasil `emberTujuanRetur()` untuk retur, atau
   * `'AVAILABLE'` untuk pembatalan penjualan yang selalu mengembalikan barang
   * utuh. Pemetaan disposisi → ember tetap satu tempat di `pos-stock.ts`;
   * berkas ini hanya menjawab soal biayanya.
   */
  ember: EmberStok | string | null | undefined;
  quantity: number;
  /** `pos_sale_line.cost_snapshot` sebagaimana adanya, termasuk nol dan null. */
  costSnapshot: number | null | undefined;
  warehouseId: string | null | undefined;
}

export interface KeputusanBiayaRetur {
  /**
   * Nilai yang dikirim ke SQL sebagai biaya masuk. `null` berarti **jangan
   * sentuh `average_cost`** — bukan berarti nol.
   */
  inboundCost: number | null;
  /** Terisi persis ketika `inboundCost` null. Untuk log dan pengujian. */
  alasan: AlasanTanpaBiaya | null;
}

/**
 * Memutuskan apakah retur ini boleh mengubah rata-rata biaya, dan dengan biaya
 * berapa.
 *
 * Biaya yang dipakai adalah HPP saat barang itu DIJUAL, bukan rata-rata hari
 * ini. Dengan begitu nilai persediaan yang bertambah persis sebesar COGS yang
 * dibalik — debit dan kreditnya cocok, dan retur tidak pernah menciptakan atau
 * memusnahkan nilai.
 */
export function biayaMasukRetur(input: MasukanBiayaRetur): KeputusanBiayaRetur {
  const tolak = (alasan: AlasanTanpaBiaya): KeputusanBiayaRetur => ({
    inboundCost: null,
    alasan,
  });

  /*
   * Hanya barang yang kembali ke stok jual yang mengubah rata-rata.
   *
   * Barang rusak masuk `damaged_qty`, bukan `on_hand_qty`. Ia tidak dapat
   * dijual, jadi memasukkan biayanya ke rata-rata stok jual akan menilai barang
   * yang tidak ada di sana. Barang yang dimusnahkan tidak kembali ke mana pun.
   */
  if (input.ember !== 'AVAILABLE') return tolak('TIDAK_MASUK_STOK_JUAL');

  if (!input.warehouseId) return tolak('TANPA_GUDANG');

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return tolak('JUMLAH_TIDAK_SAH');
  }

  const biaya = input.costSnapshot;
  if (biaya === null || biaya === undefined || !Number.isFinite(biaya)) {
    return tolak('BIAYA_TIDAK_DIKETAHUI');
  }
  if (biaya < 0) return tolak('BIAYA_TIDAK_SAH');
  // Nol berarti "tidak pernah diketahui", bukan "gratis" — lihat catatan berkas.
  if (biaya === 0) return tolak('BIAYA_TIDAK_DIKETAHUI');

  return { inboundCost: biaya, alasan: null };
}

export interface SaldoBiaya {
  /** `on_hand_qty` SEBELUM retur ini diterapkan. */
  onHand: number;
  /** `average_cost` sebelum retur ini diterapkan. */
  averageCost: number;
}

/**
 * Rata-rata biaya sesudah barang retur masuk kembali.
 *
 * Cerminan persis dari ekspresi `average_cost` pada `kembalikanStok()`. Ada di
 * sini supaya aritmetikanya dapat dibuktikan tanpa PostgreSQL; bila salah satu
 * berubah, yang lain harus ikut berubah.
 *
 * Saldo nol atau negatif tidak punya rata-rata yang bermakna untuk ditimbang —
 * di posisi itu biaya barang yang masuk menjadi rata-rata yang baru, sama
 * seperti perilaku baris pertama pada `applyBalanceDelta()`.
 */
export function rataRataSesudahRetur(
  saldo: SaldoBiaya,
  masuk: { quantity: number; unitCost: number },
): number {
  if (saldo.onHand <= 0) return Math.max(masuk.unitCost, 0);

  const nilaiLama = saldo.onHand * saldo.averageCost;
  const nilaiMasuk = masuk.quantity * masuk.unitCost;
  const kuantitas = saldo.onHand + masuk.quantity;

  return Math.max((nilaiLama + nilaiMasuk) / kuantitas, 0);
}
