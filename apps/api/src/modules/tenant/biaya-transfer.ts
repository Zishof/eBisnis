/**
 * Biaya persediaan pada transfer antar-gudang.
 *
 * ## Cacat yang ditutup
 *
 * Barang yang dipindahkan antar-gudang tiba dengan kuantitas tetapi **tanpa
 * nilai**. Jalur transfer tidak pernah mengisi biaya sama sekali: movement
 * `TRANSFER_DISPATCH` dan `TRANSFER_RECEIPT` memakai `unit_cost` bawaan nol,
 * dan `average_cost` gudang tujuan tidak pernah dihitung ulang.
 *
 * Akibatnya gudang tujuan yang stoknya hanya berasal dari transfer memiliki
 * `average_cost` nol — dan setiap penjualan dari gudang itu membukukan COGS nol.
 * Laba terbaca penuh, persediaan terbaca kosong nilainya, dan tidak ada galat
 * yang muncul.
 *
 * ## Keputusan pemilik: rata-rata gudang ASAL
 *
 * Biayanya diambil dari `average_cost` gudang asal, bukan dari biaya lot.
 * Konsisten dengan moving-average yang sudah dipakai seluruh jalur lain.
 *
 * ## Dibekukan saat KIRIM, bukan dibaca saat TERIMA
 *
 * Ini bagian yang paling mudah salah. Antara kirim dan terima barang berada di
 * perjalanan — kadang berhari-hari — dan selama itu gudang asal dapat menerima
 * pembelian baru yang menggeser rata-ratanya.
 *
 * Barang yang berangkat membawa biaya yang dimilikinya SAAT BERANGKAT. Membaca
 * rata-rata gudang asal pada saat terima akan menilai barang itu pada harga
 * yang tidak pernah melekat padanya, dan selisihnya tidak pernah muncul di mana
 * pun. Karena itu biayanya dibekukan pada `stock_movement.unit_cost` milik
 * movement dispatch, lalu dibaca kembali saat penerimaan.
 *
 * Aturan yang sama dipakai retur kasir (`pos-biaya-retur.ts`): biaya saat
 * barang keluar, bukan rata-rata hari ini.
 */

/** Satu pengiriman yang dibekukan biayanya. */
export interface KirimanBerbiaya {
  quantity: number;
  unitCost: number;
}

/**
 * Rata-rata tertimbang biaya beberapa pengiriman untuk satu lot.
 *
 * Satu baris transfer dapat pecah menjadi beberapa movement — alokasi FEFO
 * mengambil dari beberapa bin, dan tiap bin dapat memiliki biaya berbeda.
 * Menimbangnya berdasarkan kuantitas adalah satu-satunya cara agar nilai yang
 * berangkat sama dengan nilai yang tiba.
 *
 * `null` bila tidak ada kuantitas untuk ditimbang.
 */
export function biayaKirimTertimbang(kiriman: readonly KirimanBerbiaya[]): number | null {
  let totalQty = 0;
  let totalNilai = 0;
  for (const k of kiriman) {
    if (!Number.isFinite(k.quantity) || !Number.isFinite(k.unitCost)) continue;
    if (k.quantity <= 0) continue;
    totalQty += k.quantity;
    totalNilai += k.quantity * k.unitCost;
  }
  if (totalQty <= 0) return null;
  return totalNilai / totalQty;
}

/** Mengapa penerimaan transfer tidak mengubah rata-rata gudang tujuan. */
export type AlasanTanpaBiayaTransfer =
  /** Tidak ada barang yang diterima ke stok jual (semuanya ditolak, atau nol). */
  | 'TIDAK_ADA_YANG_DITERIMA'
  /** Biaya kiriman nol atau kosong — tidak diketahui, bukan gratis. */
  | 'BIAYA_TIDAK_DIKETAHUI'
  /** Biaya negatif; tidak ada tafsir yang benar untuk ini. */
  | 'BIAYA_TIDAK_SAH';

export interface KeputusanBiayaTransfer {
  /** Dikirim sebagai `inboundCost`. `null` berarti jangan sentuh rata-rata. */
  inboundCost: number | null;
  alasan: AlasanTanpaBiayaTransfer | null;
}

/**
 * Memutuskan apakah penerimaan transfer boleh mengubah rata-rata gudang tujuan.
 *
 * Barang yang DITOLAK tidak ikut: ia masuk `quarantine_qty`, bukan `on_hand`,
 * jadi menilai stok jual dengan biayanya akan menilai barang yang tidak ada di
 * sana.
 */
export function biayaMasukTransfer(input: {
  acceptedQty: number;
  unitCost: number | null | undefined;
}): KeputusanBiayaTransfer {
  const tolak = (alasan: AlasanTanpaBiayaTransfer): KeputusanBiayaTransfer => ({
    inboundCost: null,
    alasan,
  });

  if (!Number.isFinite(input.acceptedQty) || input.acceptedQty <= 0) {
    return tolak('TIDAK_ADA_YANG_DITERIMA');
  }

  const biaya = input.unitCost;
  if (biaya === null || biaya === undefined || !Number.isFinite(biaya)) {
    return tolak('BIAYA_TIDAK_DIKETAHUI');
  }
  if (biaya < 0) return tolak('BIAYA_TIDAK_SAH');
  /*
   * Nol berarti "tidak pernah diketahui", bukan "gratis".
   *
   * `average_cost` gudang asal masih nol untuk produk yang stoknya tidak pernah
   * lewat penerimaan barang. Mencampurkan nol ke gudang tujuan menyebarkan
   * ketidaktahuan itu ke gudang kedua -- diam-diam, dan makin sulit dilacak
   * setiap kali barangnya dipindahkan lagi.
   */
  if (biaya === 0) return tolak('BIAYA_TIDAK_DIKETAHUI');

  return { inboundCost: biaya, alasan: null };
}
