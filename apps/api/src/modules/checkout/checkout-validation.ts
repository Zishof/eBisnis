/**
 * Pemeriksaan kelayakan checkout.
 *
 * Ditulis sebagai fungsi murni tanpa akses basis data, mengikuti pola gerbang
 * publikasi pada V9-4. Alasannya sama: seluruh kombinasinya dapat diuji, dan
 * aturan yang sama dipakai UI untuk menunjukkan apa yang bermasalah **sebelum**
 * pembeli menekan bayar.
 *
 * ## Seluruh syarat diperiksa, bukan berhenti pada yang pertama
 *
 * Pembeli yang memperbaiki satu hal lalu ditolak karena hal berikutnya akan
 * meninggalkan keranjangnya. Daftar lengkap membuatnya dapat menyelesaikan
 * semuanya sekaligus.
 *
 * ## Harga diperiksa, bukan dipercaya
 *
 * Harga yang tersimpan di keranjang adalah harga saat barang dimasukkan.
 * Membiarkan pembeli membayar harga itu berarti penjual menanggung selisih
 * setiap kenaikan harga. Yang benar: beri tahu bahwa harganya berubah, dan
 * minta pembeli menyetujui harga baru.
 */

export type CheckoutIssueCode =
  | 'LISTING_UNAVAILABLE'
  | 'SELLER_INACTIVE'
  | 'STORE_INACTIVE'
  | 'OUT_OF_STOCK'
  | 'PRICE_CHANGED'
  | 'QUANTITY_INVALID'
  | 'QUANTITY_EXCEEDS_STOCK'
  | 'PAYMENT_ACCOUNT_INACTIVE'
  | 'ADDRESS_MISSING'
  | 'ADDRESS_INCOMPLETE'
  | 'SHIPPING_METHOD_MISSING'
  | 'WEIGHT_MISSING'
  | 'CART_EMPTY'
  | 'TOTAL_INVALID';

export type IssueSeverity = 'BLOCKING' | 'NEEDS_CONFIRMATION';

export interface CheckoutIssue {
  code: CheckoutIssueCode;
  severity: IssueSeverity;
  /** Baris yang bermasalah; kosong bila menyangkut seluruh checkout. */
  lineRef?: string;
  sellerRef?: string;
  detail: string;
}

export interface CheckoutLineInput {
  ref: string;
  sellerId: string;
  title: string;
  /** Harga saat barang dimasukkan ke keranjang. */
  priceAtAdd: number;
  /** Harga yang berlaku sekarang. */
  currentPrice: number;
  quantity: number;
  availability: string;
  /** `null` berarti stok tidak diketahui pasti; hanya ketersediaan yang tahu. */
  stockQty: number | null;
  weightGram: number;
  listingVisible: boolean;
}

export interface CheckoutSellerInput {
  sellerId: string;
  sellerStatus: string;
  storeStatus: string;
  paymentAccountActive: boolean;
  shippingMethodCode: string | null;
}

export interface CheckoutAddressInput {
  recipientName?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
}

export interface CheckoutSnapshot {
  lines: CheckoutLineInput[];
  sellers: CheckoutSellerInput[];
  address: CheckoutAddressInput | null;
}

export interface CheckoutValidationResult {
  canConfirm: boolean;
  /** Menghalangi sepenuhnya. */
  blocking: CheckoutIssue[];
  /** Dapat dilanjutkan setelah pembeli menyetujui, mis. harga berubah. */
  needsConfirmation: CheckoutIssue[];
  checks: CheckoutIssue[];
}

/** Jumlah maksimum satu barang dalam satu pesanan. */
export const MAX_QUANTITY_PER_LINE = 999;

export function validateCheckout(snapshot: CheckoutSnapshot): CheckoutValidationResult {
  const issues: CheckoutIssue[] = [];

  if (snapshot.lines.length === 0) {
    issues.push({
      code: 'CART_EMPTY',
      severity: 'BLOCKING',
      detail: 'Keranjang kosong.',
    });
  }

  const sellerById = new Map(snapshot.sellers.map((s) => [s.sellerId, s]));

  for (const line of snapshot.lines) {
    if (!line.listingVisible) {
      issues.push({
        code: 'LISTING_UNAVAILABLE',
        severity: 'BLOCKING',
        lineRef: line.ref,
        detail: `"${line.title}" sudah tidak dijual.`,
      });
      // Barang yang sudah tidak dijual tidak perlu diperiksa lebih jauh;
      // harga dan stoknya tidak lagi berarti.
      continue;
    }

    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      issues.push({
        code: 'QUANTITY_INVALID',
        severity: 'BLOCKING',
        lineRef: line.ref,
        detail: `Jumlah "${line.title}" tidak sah.`,
      });
    } else if (line.quantity > MAX_QUANTITY_PER_LINE) {
      issues.push({
        code: 'QUANTITY_INVALID',
        severity: 'BLOCKING',
        lineRef: line.ref,
        detail: `Jumlah "${line.title}" melebihi batas ${MAX_QUANTITY_PER_LINE} per pesanan.`,
      });
    }

    if (line.availability === 'OUT_OF_STOCK') {
      issues.push({
        code: 'OUT_OF_STOCK',
        severity: 'BLOCKING',
        lineRef: line.ref,
        detail: `"${line.title}" kehabisan stok.`,
      });
    }

    // Stok diperiksa hanya bila jumlahnya benar-benar diketahui. Katalog
    // menyimpan ketersediaan, bukan jumlah pasti; menolak berdasarkan angka
    // yang tidak diketahui akan menolak pesanan yang sebenarnya sah.
    if (
      line.stockQty !== null &&
      line.availability !== 'PREORDER' &&
      line.quantity > line.stockQty
    ) {
      issues.push({
        code: 'QUANTITY_EXCEEDS_STOCK',
        severity: 'BLOCKING',
        lineRef: line.ref,
        detail: `Stok "${line.title}" tinggal ${line.stockQty}.`,
      });
    }

    if (line.currentPrice !== line.priceAtAdd) {
      const naik = line.currentPrice > line.priceAtAdd;
      issues.push({
        code: 'PRICE_CHANGED',
        // Bukan penghalang: pembeli boleh melanjutkan setelah menyetujui harga
        // baru. Menolaknya sama sekali akan membuang keranjang karena satu
        // barang berubah seratus rupiah.
        severity: 'NEEDS_CONFIRMATION',
        lineRef: line.ref,
        detail:
          `Harga "${line.title}" ${naik ? 'naik' : 'turun'} dari ` +
          `${line.priceAtAdd} menjadi ${line.currentPrice}.`,
      });
    }

    if (line.weightGram <= 0) {
      issues.push({
        code: 'WEIGHT_MISSING',
        severity: 'BLOCKING',
        lineRef: line.ref,
        detail: `Berat "${line.title}" belum diisi sehingga ongkos kirim tidak dapat dihitung.`,
      });
    }

    const seller = sellerById.get(line.sellerId);
    if (!seller) {
      issues.push({
        code: 'SELLER_INACTIVE',
        severity: 'BLOCKING',
        lineRef: line.ref,
        detail: `Penjual "${line.title}" tidak ditemukan.`,
      });
    }
  }

  for (const seller of snapshot.sellers) {
    if (seller.sellerStatus !== 'ACTIVE') {
      issues.push({
        code: 'SELLER_INACTIVE',
        severity: 'BLOCKING',
        sellerRef: seller.sellerId,
        detail: 'Penjual sedang tidak dapat menerima pesanan.',
      });
    }

    if (seller.storeStatus !== 'PUBLISHED') {
      issues.push({
        code: 'STORE_INACTIVE',
        severity: 'BLOCKING',
        sellerRef: seller.sellerId,
        detail: 'Toko sedang tidak melayani pesanan.',
      });
    }

    // Inilah gerbang yang menutup V9-2: tanpa rekening pembayaran yang aktif,
    // pembeli akan membayar ke tempat yang tidak ada.
    if (!seller.paymentAccountActive) {
      issues.push({
        code: 'PAYMENT_ACCOUNT_INACTIVE',
        severity: 'BLOCKING',
        sellerRef: seller.sellerId,
        detail: 'Penjual belum dapat menerima pembayaran.',
      });
    }

    if (!seller.shippingMethodCode) {
      issues.push({
        code: 'SHIPPING_METHOD_MISSING',
        severity: 'BLOCKING',
        sellerRef: seller.sellerId,
        detail: 'Layanan pengiriman belum dipilih.',
      });
    }
  }

  const address = snapshot.address;
  if (!address) {
    issues.push({
      code: 'ADDRESS_MISSING',
      severity: 'BLOCKING',
      detail: 'Alamat pengiriman belum dipilih.',
    });
  } else {
    const missing = (['recipientName', 'phone', 'addressLine', 'city', 'province', 'postalCode'] as const)
      .filter((field) => !address[field] || String(address[field]).trim() === '');
    if (missing.length > 0) {
      issues.push({
        code: 'ADDRESS_INCOMPLETE',
        severity: 'BLOCKING',
        detail: `Alamat belum lengkap: ${missing.join(', ')}.`,
      });
    }
  }

  const blocking = issues.filter((i) => i.severity === 'BLOCKING');
  const needsConfirmation = issues.filter((i) => i.severity === 'NEEDS_CONFIRMATION');

  return {
    canConfirm: blocking.length === 0,
    blocking,
    needsConfirmation,
    checks: issues,
  };
}

/**
 * Menghitung total dari baris yang sudah lolos pemeriksaan.
 *
 * Memakai bilangan bulat rupiah. Perhitungan uang dengan bilangan pecahan
 * menghasilkan selisih satu rupiah yang tidak dapat dijelaskan kepada pembeli
 * maupun kepada akuntan.
 */
export function computeTotals(
  lines: { currentPrice: number; quantity: number }[],
  shippingPerSeller: number[] = [],
  discount = 0,
): { subtotal: number; shippingTotal: number; discountTotal: number; grandTotal: number } {
  const subtotal = lines.reduce((sum, l) => sum + Math.round(l.currentPrice) * l.quantity, 0);
  const shippingTotal = shippingPerSeller.reduce((sum, v) => sum + Math.round(v), 0);
  const discountTotal = Math.min(Math.round(discount), subtotal);
  return {
    subtotal,
    shippingTotal,
    discountTotal,
    // Total tidak pernah negatif meski diskon melebihi subtotal; pembeli tidak
    // menerima uang dari pesanan.
    grandTotal: Math.max(0, subtotal + shippingTotal - discountTotal),
  };
}
