/**
 * Aturan voucher marketplace.
 *
 * Ditulis sebagai fungsi murni, mengikuti pola gerbang publikasi V9-4 dan
 * pemeriksaan checkout V9-6. Pembeli melihat alasan penolakan yang sama dengan
 * yang dilihat sistem, dan UI dapat menunjukkannya sebelum tombol ditekan.
 *
 * ## Mengapa bukan `DiscountProgram`
 *
 * `DiscountProgram` yang sudah ada melayani diskon langganan: didanai platform,
 * ditukar per tenant. Voucher marketplace didanai penjual dan ditukar per
 * pembeli. Berbeda pendana, penukar, dan sumber anggaran — memaksakan satu
 * tabel akan menghasilkan kolom yang tidak berarti bagi separuh pemakainya.
 */

export type VoucherIssueCode =
  | 'NOT_FOUND'
  | 'NOT_ACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'BUDGET_EXHAUSTED'
  | 'REDEMPTION_LIMIT_REACHED'
  | 'BUYER_LIMIT_REACHED'
  | 'MINIMUM_SPEND_NOT_MET'
  | 'SELLER_MISMATCH'
  | 'NOT_STACKABLE'
  | 'NO_DISCOUNT';

export interface VoucherIssue {
  code: VoucherIssueCode;
  detail: string;
}

export interface VoucherSnapshot {
  code: string;
  status: string;
  fundedBy: 'SELLER' | 'PLATFORM';
  sellerId: string | null;
  benefitType: 'PERCENT' | 'FIXED';
  benefitValue: number;
  maxDiscountAmount: number | null;
  minimumSpend: number;
  budgetAmount: number | null;
  budgetUsed: number;
  maxRedemptions: number | null;
  maxPerBuyer: number;
  redemptionCount: number;
  validFrom: Date;
  validUntil: Date | null;
  stackable: boolean;
}

export interface VoucherContext {
  now: Date;
  /** Subtotal kelompok penjual yang hendak didiskon. */
  subtotal: number;
  /** Penjual yang barangnya dibeli; menentukan kecocokan voucher penjual. */
  sellerId: string;
  /** Berapa kali pembeli ini sudah memakai voucher yang sama. */
  buyerRedemptionCount: number;
  /** Voucher lain yang sudah dipasang pada checkout ini. */
  otherVoucherApplied: boolean;
}

export interface VoucherVerdict {
  valid: boolean;
  issues: VoucherIssue[];
  /** Nilai potongan; nol bila tidak sah. */
  discountAmount: number;
}

/**
 * Memeriksa apakah voucher boleh dipakai, sekaligus menghitung potongannya.
 *
 * Keduanya digabung dengan sengaja: potongan yang dihitung terpisah dari
 * pemeriksaan pada akhirnya akan dihitung dengan aturan yang sedikit berbeda.
 */
export function evaluateVoucher(
  voucher: VoucherSnapshot | null,
  context: VoucherContext,
): VoucherVerdict {
  const issues: VoucherIssue[] = [];

  if (!voucher) {
    return {
      valid: false,
      // Kode yang tidak ada dan kode yang sudah kedaluwarsa dijawab sama agar
      // seseorang tidak dapat menebak kode yang berlaku dengan mencoba satu
      // per satu dan membedakan jawabannya.
      issues: [{ code: 'NOT_FOUND', detail: 'Kode voucher tidak berlaku.' }],
      discountAmount: 0,
    };
  }

  if (voucher.status !== 'ACTIVE') {
    issues.push({ code: 'NOT_ACTIVE', detail: 'Voucher sedang tidak berlaku.' });
  }

  if (context.now < voucher.validFrom) {
    issues.push({
      code: 'NOT_STARTED',
      detail: `Voucher berlaku mulai ${voucher.validFrom.toISOString().slice(0, 10)}.`,
    });
  }

  if (voucher.validUntil && context.now > voucher.validUntil) {
    issues.push({ code: 'EXPIRED', detail: 'Masa berlaku voucher sudah lewat.' });
  }

  // Voucher penjual hanya berlaku pada barang penjual itu. Tanpa pemeriksaan
  // ini, voucher yang didanai satu penjual memotong pendapatan penjual lain.
  if (voucher.fundedBy === 'SELLER' && voucher.sellerId !== context.sellerId) {
    issues.push({
      code: 'SELLER_MISMATCH',
      detail: 'Voucher ini hanya berlaku untuk produk dari toko penerbitnya.',
    });
  }

  if (context.subtotal < voucher.minimumSpend) {
    issues.push({
      code: 'MINIMUM_SPEND_NOT_MET',
      detail: `Belanja minimum ${voucher.minimumSpend} belum terpenuhi.`,
    });
  }

  if (voucher.maxRedemptions !== null && voucher.redemptionCount >= voucher.maxRedemptions) {
    issues.push({ code: 'REDEMPTION_LIMIT_REACHED', detail: 'Kuota voucher sudah habis.' });
  }

  if (context.buyerRedemptionCount >= voucher.maxPerBuyer) {
    issues.push({
      code: 'BUYER_LIMIT_REACHED',
      detail: `Voucher ini hanya dapat dipakai ${voucher.maxPerBuyer} kali per pembeli.`,
    });
  }

  if (!voucher.stackable && context.otherVoucherApplied) {
    issues.push({
      code: 'NOT_STACKABLE',
      detail: 'Voucher ini tidak dapat digabung dengan voucher lain.',
    });
  }

  // Potongan dihitung lebih dulu karena anggaran diperiksa terhadap nilainya.
  const discountAmount = computeDiscount(voucher, context.subtotal);

  if (voucher.budgetAmount !== null) {
    const sisa = voucher.budgetAmount - voucher.budgetUsed;
    if (sisa <= 0) {
      issues.push({ code: 'BUDGET_EXHAUSTED', detail: 'Anggaran voucher sudah habis.' });
    } else if (discountAmount > sisa) {
      // Anggaran tersisa lebih kecil daripada potongan. Memotong sebagian akan
      // memberi pembeli diskon yang tidak dijanjikan; menolaknya lebih jujur.
      issues.push({
        code: 'BUDGET_EXHAUSTED',
        detail: 'Sisa anggaran voucher tidak mencukupi untuk pesanan ini.',
      });
    }
  }

  if (discountAmount <= 0) {
    issues.push({ code: 'NO_DISCOUNT', detail: 'Voucher tidak menghasilkan potongan.' });
  }

  return {
    valid: issues.length === 0,
    issues,
    discountAmount: issues.length === 0 ? discountAmount : 0,
  };
}

/**
 * Menghitung nilai potongan.
 *
 * Potongan tidak pernah melebihi subtotal — pembeli tidak menerima uang dari
 * voucher.
 */
export function computeDiscount(
  voucher: Pick<VoucherSnapshot, 'benefitType' | 'benefitValue' | 'maxDiscountAmount'>,
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;

  let discount: number;
  if (voucher.benefitType === 'PERCENT') {
    const percent = Math.min(Math.max(voucher.benefitValue, 0), 100);
    discount = Math.floor((subtotal * percent) / 100);
    // Batas ini yang mencegah diskon 50% pada pesanan sepuluh juta memotong
    // lima juta dari kantong penjual.
    if (voucher.maxDiscountAmount !== null && voucher.maxDiscountAmount !== undefined) {
      discount = Math.min(discount, Math.round(voucher.maxDiscountAmount));
    }
  } else {
    discount = Math.round(Math.max(voucher.benefitValue, 0));
  }

  return Math.min(discount, Math.round(subtotal));
}

/** Apakah voucher sudah habis dan harus ditandai `EXHAUSTED`. */
export function isExhausted(voucher: VoucherSnapshot): boolean {
  const kuotaHabis =
    voucher.maxRedemptions !== null && voucher.redemptionCount >= voucher.maxRedemptions;
  const anggaranHabis =
    voucher.budgetAmount !== null && voucher.budgetUsed >= voucher.budgetAmount;
  return kuotaHabis || anggaranHabis;
}

/** Membersihkan kode voucher yang diketik pembeli. */
export function normalizeVoucherCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '').slice(0, 32);
}
