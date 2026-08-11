/**
 * Hak akses per laporan, bukan satu hak untuk semuanya.
 *
 * ## Cacat yang ditutup
 *
 * Seluruh laporan dijaga `SALES.READ` — termasuk `profit-loss` (laba rugi
 * akuntansi), `gross-profit` (laba kotor, yang memuat HPP), `ap-aging` (umur
 * hutang pemasok), dan `ap-payment-register`. Artinya siapa pun yang boleh
 * membaca penjualan juga membaca margin, hutang dagang, dan laba rugi.
 *
 * Kasir atau staf penjualan wajar diberi `SALES.READ`. Laba rugi perusahaan
 * bukan bagian dari pekerjaan mereka, dan sekali angka itu terbaca ia tidak
 * dapat ditarik kembali.
 *
 * ## Mengapa di modul murni
 *
 * Peta ini menentukan siapa boleh melihat angka apa. Ia dapat dibuktikan tanpa
 * basis data, dan penjaganya di `PermissionGuard` hanya menjalankan
 * keputusannya.
 *
 * ## Aturan yang membentuknya: laporan tak dikenal DITOLAK
 *
 * Bukan diloloskan dengan hak bawaan. Laporan yang ditambahkan nanti tanpa
 * entri di sini akan gagal saat pertama dipanggil — terlihat, dan diperbaiki.
 * Sebaliknya, hak bawaan berarti laporan baru terbuka bagi semua orang tanpa
 * seorang pun menyadarinya; itu cara cacat yang sedang ditutup ini terbentuk
 * sejak awal.
 *
 * Hak yang dipakai seluruhnya SUDAH ADA pada katalog menu (`tenant-menu.seed`),
 * jadi tidak ada migrasi maupun penyemaian baru — yang berubah hanya laporan
 * mana menuntut hak yang mana.
 */

/**
 * Laporan → hak yang dibutuhkan membacanya.
 *
 * Dikelompokkan menurut domain angkanya, bukan menurut layar yang kebetulan
 * menampilkannya.
 */
export const IZIN_LAPORAN: Readonly<Record<string, string>> = Object.freeze({
  // --- Pembelian dan hutang: angka pemasok ---------------------------------
  'supplier-list': 'PURCHASING.READ',
  'purchase-invoice': 'PURCHASING.READ',
  'purchase-register': 'PURCHASING.READ',
  'ap-payment-register': 'PURCHASING.READ',
  'ap-aging': 'PURCHASING.READ',

  // --- Penjualan dan piutang: angka pelanggan ------------------------------
  'customer-list': 'SALES.READ',
  'ar-receipt-register': 'SALES.READ',
  'ar-aging-customer': 'SALES.READ',
  'ar-aging-sales': 'SALES.READ',
  'ar-outstanding': 'SALES.READ',
  'ar-event-register': 'SALES.READ',
  'sales-note-handover': 'SALES.READ',
  'sales-by-product': 'SALES_REPORT.READ',

  // --- Persediaan ----------------------------------------------------------
  'stock-list': 'INVENTORY.READ',
  'stock-opname': 'INVENTORY_STOCK_COUNT.READ',

  // --- Harga ---------------------------------------------------------------
  'price-sale': 'CATALOG_PRICE_BOOK.READ',
  'price-purchase': 'CATALOG_PRICE_BOOK.READ',

  /*
   * --- Yang menyentuh margin dan laba --------------------------------------
   *
   * Dua ini alasan utama berkas ini ada.
   *
   * `gross-profit` memuat HPP per barang: siapa yang membacanya tahu berapa
   * margin setiap produk. `profit-loss` adalah laba rugi perusahaan.
   *
   * `SALES_REPORT.VIEW_PROFIT` memang sudah ada pada katalog menu sejak awal
   * dan belum pernah dipakai menjaga apa pun — hak yang tersedia tetapi tidak
   * ditegakkan sama saja dengan hak yang tidak ada.
   */
  'gross-profit': 'SALES_REPORT.VIEW_PROFIT',
  'profit-loss': 'FINANCE_JOURNAL.READ',
});

/**
 * Hak untuk sebuah kode laporan; `null` bila kodenya tidak dikenal.
 *
 * Dipakai `hasOwnProperty`, bukan sekadar `IZIN_LAPORAN[code]`: pembacaan
 * langsung akan menemukan `toString`, `constructor`, dan `__proto__` pada
 * rantai prototype dan mengembalikan FUNGSI, yang bernilai truthy. Nama-nama
 * itu bukan laporan, dan penjaga yang menerimanya berhenti berkata "tidak
 * dikenal" untuk masukan yang justru paling patut dicurigai.
 */
export function izinUntukLaporan(code: string | null | undefined): string | null {
  if (typeof code !== 'string' || !code) return null;
  if (!Object.prototype.hasOwnProperty.call(IZIN_LAPORAN, code)) return null;
  const izin = IZIN_LAPORAN[code];
  return typeof izin === 'string' ? izin : null;
}

export type AlasanTolakLaporan = 'KODE_TIDAK_DIKENAL' | 'HAK_TIDAK_CUKUP';

export interface KeputusanBacaLaporan {
  allowed: boolean;
  /** Hak yang dibutuhkan; `null` bila kodenya sendiri tidak dikenal. */
  required: string | null;
  reason: AlasanTolakLaporan | null;
}

/**
 * Boleh atau tidak membaca sebuah laporan.
 *
 * Dipakai pada jalur yang kode laporannya baru diketahui SESUDAH datanya
 * dibaca — misalnya membuka snapshot tersimpan lewat idnya, saat kode
 * laporannya ada di dalam baris, bukan di dalam URL.
 */
export function bolehMembacaLaporan(
  code: string | null | undefined,
  hakDimiliki: readonly string[],
): KeputusanBacaLaporan {
  const required = izinUntukLaporan(code);
  if (!required) return { allowed: false, required: null, reason: 'KODE_TIDAK_DIKENAL' };
  if (!hakDimiliki.includes(required)) {
    return { allowed: false, required, reason: 'HAK_TIDAK_CUKUP' };
  }
  return { allowed: true, required, reason: null };
}
