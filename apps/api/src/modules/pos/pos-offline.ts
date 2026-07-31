/**
 * Aturan penerimaan transaksi luring — murni, tanpa basis data.
 *
 * ## Pertanyaan yang dijawab berkas ini
 *
 * Sebuah transaksi terjadi di mesin kasir yang tidak terhubung. Pembeli sudah
 * membayar, struk sudah tercetak, dan barangnya sudah dibawa pulang. Beberapa
 * menit atau beberapa jam kemudian, catatannya sampai di peladen.
 *
 * Yang harus diputuskan: **apakah ia dibukukan apa adanya, atau ditahan?**
 *
 * ## Mengapa "ditolak" tidak pernah menjadi jawaban
 *
 * Menolak transaksi luring tidak membuatnya tidak pernah terjadi. Uangnya sudah
 * berpindah tangan dan barangnya sudah keluar dari rak. Menolak hanya membuat
 * pembukuan tidak menunjukkan keduanya — yang justru kebalikan dari gunanya
 * pembukuan.
 *
 * Karena itu setiap transaksi luring berakhir di salah satu dari dua tempat:
 * dibukukan, atau ditahan di karantina beserta alasannya. Tidak ada yang hilang.
 *
 * ## Mengapa "diterima diam-diam" juga bukan jawaban
 *
 * Ketika peladen menghitung harga yang berbeda dari yang tercetak pada struk,
 * membukukan angka peladen membuat catatan tidak sesuai dengan kertas yang
 * dipegang pembeli. Tidak ada galat, tidak ada yang tahu, dan selisihnya muncul
 * belakangan sebagai kas yang tidak cocok tanpa sebab yang dapat ditelusuri.
 *
 * Selisih harga pada transaksi yang uangnya sudah berpindah tangan adalah
 * perkara yang diputuskan manusia.
 */

/** Ambang perbedaan yang masih dianggap sama. */
export const TOLERANSI_NOL = 0;

export type AlasanKarantina =
  | 'PRICE_MISMATCH'
  | 'STOCK_SHORT'
  | 'SHIFT_CLOSED'
  | 'PRODUCT_INACTIVE'
  | 'RECEIPT_OUT_OF_BLOCK'
  | 'PAYMENT_MISMATCH'
  | 'REPLAY_FAILED';

export interface BarisLuringMasuk {
  productId: string;
  uomId: string | null;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  taxAmount: string;
  lineTotal: string;
  taxRateId: string | null;
}

export interface PembayaranLuringMasuk {
  paymentMethodId: string;
  amount: string;
  tenderedAmount: string | null;
  reference: string | null;
}

export interface TransaksiLuringMasuk {
  offlineId: string;
  outletId: string;
  terminalId: string;
  shiftId: string;
  businessDate: string;
  receiptNumber: string;
  occurredAt: string;
  currencyCode: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  changeTotal: string;
  catalogSyncedAt: string;
  localHash: string | null;
  lines: BarisLuringMasuk[];
  payments: PembayaranLuringMasuk[];
}

export interface KeadaanServer {
  /** Jatah nomor struk milik register ini; null bila tidak ada. */
  block: { blockId: string; terminalId: string; fromNumber: number; toNumber: number } | null;
  shiftStatus: 'OPEN' | 'CLOSED' | 'MISSING';
  /** Produk yang sudah tidak aktif atau terhapus, dari baris yang dikirim. */
  inactiveProductIds: string[];
  /** Produk yang stoknya tidak mencukupi dan tidak boleh minus. */
  shortProductIds: string[];
  /** Total yang dihitung ulang peladen dari harga yang berlaku sekarang. */
  serverGrandTotal: string;
  /** Sekarang menurut peladen, milidetik epoch. */
  now: number;
  /** Batas umur transaksi luring yang masih boleh dibukukan langsung. */
  maxAgeHours: number;
}

export interface Putusan {
  /** Dibukukan apa adanya, atau ditahan. */
  action: 'BOOK' | 'QUARANTINE';
  reasonCode: AlasanKarantina | null;
  reason: string | null;
  localTotal: string;
  serverTotal: string;
}

/**
 * Mengurai nomor struk menjadi angkanya, mengabaikan awalan.
 *
 * Nomor luring dibuat dari `prefix + angka berpadding`, jadi angkanya adalah
 * digit terakhir yang berurutan. Diurai dengan ekspresi reguler, bukan dengan
 * memotong sepanjang awalan: awalan dapat berubah antara saat jatah dibuat dan
 * saat transaksinya dikirim, dan pemotongan sepanjang tetap akan mengiris digit.
 */
export function angkaStruk(receiptNumber: string): number | null {
  const cocok = /(\d+)\s*$/.exec(receiptNumber ?? '');
  if (!cocok) return null;
  const n = Number(cocok[1]);
  return Number.isSafeInteger(n) ? n : null;
}

/** Membandingkan dua nilai uang sebagai angka, bukan sebagai teks. */
export function samaNilai(a: string, b: string): boolean {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= TOLERANSI_NOL;
}

/**
 * Memutuskan nasib satu transaksi luring.
 *
 * Urutan pemeriksaannya disengaja: yang paling menentukan lebih dahulu, supaya
 * alasan yang dilaporkan adalah alasan yang paling menjelaskan. Transaksi dengan
 * nomor struk di luar jatah **dan** harga yang berbeda dilaporkan sebagai nomor
 * di luar jatah — sebab itulah yang harus diselidiki lebih dahulu, dan harganya
 * belum tentu masalah tersendiri.
 */
export function putuskan(masuk: TransaksiLuringMasuk, server: KeadaanServer): Putusan {
  const dasar = { localTotal: masuk.grandTotal, serverTotal: server.serverGrandTotal };

  // 1. Nomor struk harus berasal dari jatah milik register ini.
  //
  //    Diperiksa paling dahulu karena nomor struk adalah satu-satunya hal pada
  //    transaksi luring yang dapat bertabrakan dengan transaksi lain. Selisih
  //    harga hanya menyangkut satu transaksi; nomor kembar merusak dua.
  const angka = angkaStruk(masuk.receiptNumber);
  if (!server.block) {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'RECEIPT_OUT_OF_BLOCK',
      reason:
        `Nomor struk ${masuk.receiptNumber} dikirim register yang tidak memegang jatah nomor. ` +
        'Perlu dipastikan nomor ini tidak dipakai transaksi lain.',
    };
  }
  if (server.block.terminalId !== masuk.terminalId) {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'RECEIPT_OUT_OF_BLOCK',
      reason:
        `Nomor struk ${masuk.receiptNumber} berasal dari jatah register lain. ` +
        'Satu jatah hanya boleh dipakai satu register.',
    };
  }
  if (angka === null || angka < server.block.fromNumber || angka > server.block.toNumber) {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'RECEIPT_OUT_OF_BLOCK',
      reason:
        `Nomor struk ${masuk.receiptNumber} di luar jatah ${server.block.fromNumber}–${server.block.toNumber} ` +
        'milik register ini. Perlu dipastikan nomor ini tidak dipakai transaksi lain.',
    };
  }

  // 2. Pembayaran harus menutup total yang tercetak.
  //
  //    Diperiksa terhadap total LOKAL, bukan total peladen: yang dibayar pembeli
  //    adalah angka yang tercetak pada struknya.
  const dibayar = masuk.payments.reduce((a, p) => a + Number(p.amount || 0), 0);
  if (!samaNilai(String(dibayar), masuk.grandTotal)) {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'PAYMENT_MISMATCH',
      reason:
        `Pembayaran yang tercatat ${dibayar} tidak sama dengan total pada struk ${masuk.grandTotal}. ` +
        'Catatan mesin kasir tidak konsisten dengan dirinya sendiri.',
    };
  }

  // 3. Shift harus masih terbuka.
  if (server.shiftStatus !== 'OPEN') {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'SHIFT_CLOSED',
      reason:
        server.shiftStatus === 'MISSING'
          ? 'Shift yang disebut transaksi ini tidak ditemukan di peladen.'
          : 'Shift sudah ditutup sebelum transaksi ini sampai. Kas shift itu sudah dihitung tanpa memasukkannya.',
    };
  }

  // 4. Produk harus masih aktif.
  if (server.inactiveProductIds.length) {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'PRODUCT_INACTIVE',
      reason:
        `${server.inactiveProductIds.length} produk pada transaksi ini sudah tidak aktif di master. ` +
        'Kemungkinan dinonaktifkan setelah salinan katalog diambil.',
    };
  }

  // 5. Stok harus mencukupi bila tenant tidak mengizinkan stok minus.
  if (server.shortProductIds.length) {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'STOCK_SHORT',
      reason:
        `Stok tidak mencukupi untuk ${server.shortProductIds.length} produk, dan tenant ini tidak ` +
        'mengizinkan stok minus. Barangnya sudah keluar dari rak, jadi selisihnya perlu diselesaikan manusia.',
    };
  }

  // 6. Harga harus sama dengan hitungan peladen.
  //
  //    Diperiksa PALING AKHIR dan sengaja: seluruh sebab di atas menjelaskan
  //    mengapa harganya bisa berbeda. Melaporkan "harga berbeda" padahal
  //    produknya sudah dinonaktifkan akan mengirim pemeriksa ke arah yang salah.
  if (!samaNilai(masuk.grandTotal, server.serverGrandTotal)) {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'PRICE_MISMATCH',
      reason:
        `Struk menyebut ${masuk.grandTotal}, peladen menghitung ${server.serverGrandTotal}. ` +
        `Harga yang dipakai berasal dari salinan katalog tanggal ${masuk.catalogSyncedAt}. ` +
        'Pembeli sudah membayar angka pada struk.',
    };
  }

  // 7. Transaksi yang sangat terlambat tetap ditahan meski seluruhnya cocok.
  //
  //    Bukan karena datanya meragukan, melainkan karena tanggal usahanya
  //    kemungkinan sudah ditutup dan laporannya sudah dikirim. Menyisipkan baris
  //    ke hari yang sudah dilaporkan mengubah angka yang sudah dibaca orang.
  const umurJam = (server.now - Date.parse(masuk.occurredAt)) / 3_600_000;
  if (Number.isFinite(umurJam) && umurJam > server.maxAgeHours) {
    return {
      ...dasar,
      action: 'QUARANTINE',
      reasonCode: 'REPLAY_FAILED',
      reason:
        `Transaksi berumur ${Math.round(umurJam)} jam, melewati batas ${server.maxAgeHours} jam. ` +
        'Tanggal usahanya kemungkinan sudah ditutup dan laporannya sudah dikirim.',
    };
  }

  return { ...dasar, action: 'BOOK', reasonCode: null, reason: null };
}

/**
 * Menghitung rentang jatah berikutnya dari nomor urut yang berlaku.
 *
 * Dipisah menjadi fungsi murni supaya aritmetikanya dapat diuji tanpa basis
 * data — dan aritmetika inilah yang menentukan apakah dua register dapat
 * menerbitkan nomor yang sama.
 */
export function rentangJatah(
  nextNumber: number,
  ukuran: number,
): { fromNumber: number; toNumber: number; sequenceSesudah: number } {
  const besar = Math.max(1, Math.floor(ukuran));
  const from = Math.floor(nextNumber);
  const to = from + besar - 1;
  // Urutan dimajukan melewati SELURUH rentang, bukan sampai batasnya. Kalau
  // dimajukan ke `to`, nomor terakhir jatah akan diterbitkan lagi oleh
  // penjualan daring berikutnya.
  return { fromNumber: from, toNumber: to, sequenceSesudah: to + 1 };
}
