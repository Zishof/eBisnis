/**
 * Aturan retur, pengembalian dana, dan sengketa.
 *
 * ## Pengembalian dana tidak dikarang
 *
 * eSmartlink belum terbukti punya API pengembalian dana. `MANUAL_REQUIRED` ada
 * dan dipakai sungguhan: sistem mencatat bahwa dana harus dikembalikan, siapa
 * yang harus melakukannya, dan buktinya — tetapi tidak berpura-pura mengirim
 * perintah yang tidak ada.
 *
 * Metode `PROVIDER` disediakan agar tidak perlu membongkar apa pun ketika
 * kemampuan itu terbukti tersedia.
 */

export type ReturnStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'AWAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'REFUND_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'DISPUTED'],
  APPROVED: ['AWAITING_SHIPMENT', 'CANCELLED'],
  AWAITING_SHIPMENT: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED', 'DISPUTED'],
  RECEIVED: ['INSPECTED', 'DISPUTED'],
  INSPECTED: ['REFUND_PENDING', 'REJECTED', 'DISPUTED'],
  REFUND_PENDING: ['COMPLETED', 'DISPUTED'],
  // Penolakan masih dapat disengketakan; itulah gunanya sengketa.
  REJECTED: ['DISPUTED'],
  DISPUTED: ['APPROVED', 'REJECTED', 'COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export interface RuleVerdict {
  ok: boolean;
  reason?: string;
}

export function canAdvanceReturn(from: ReturnStatus, to: ReturnStatus): RuleVerdict {
  if (from === to) return { ok: false, reason: `Sudah berstatus ${to}.` };
  const allowed = RETURN_TRANSITIONS[from];
  if (!allowed) return { ok: false, reason: `Status "${from}" tidak dikenal.` };
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Dari ${from} tidak dapat menjadi ${to}. Yang mungkin: ${allowed.join(', ') || 'tidak ada'}.`,
    };
  }
  return { ok: true };
}

export const ALL_RETURN_STATUSES = Object.keys(RETURN_TRANSITIONS) as ReturnStatus[];

export function isReturnTerminal(status: ReturnStatus): boolean {
  return RETURN_TRANSITIONS[status]?.length === 0;
}

// ---------------------------------------------------------------------------
// Kelayakan retur
// ---------------------------------------------------------------------------

/** Berapa hari setelah barang diterima retur masih dapat diajukan. */
export const RETURN_WINDOW_DAYS = 7;

/**
 * Alasan yang tidak menuntut kesalahan penjual.
 *
 * Untuk alasan ini ongkos kirim balik ditanggung pembeli, dan penjual berhak
 * menolak bila barangnya sudah dipakai.
 */
const BUYER_FAULT_REASONS = ['CHANGED_MIND'];

export interface EligibilityInput {
  orderStatus: string;
  deliveredAt: Date | null;
  now: Date;
  reasonCode: string;
  /** Retur yang masih berjalan untuk pesanan yang sama. */
  hasOpenReturn: boolean;
  requestedQty: number;
  orderedQty: number;
  alreadyReturnedQty: number;
}

export interface EligibilityIssue {
  code:
    | 'ORDER_NOT_ELIGIBLE'
    | 'WINDOW_EXPIRED'
    | 'NOT_DELIVERED'
    | 'DUPLICATE_OPEN_RETURN'
    | 'QUANTITY_EXCEEDS_ORDER'
    | 'QUANTITY_INVALID'
    | 'UNKNOWN_REASON';
  detail: string;
}

const KNOWN_REASONS = [
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'MISSING_PART',
  'CHANGED_MIND',
  'LATE',
];

/**
 * Memeriksa apakah retur boleh diajukan.
 *
 * Seluruh syarat diperiksa, bukan berhenti pada yang pertama — pembeli yang
 * sudah kecewa tidak perlu ditolak berulang kali karena alasan yang berbeda.
 */
export function checkReturnEligibility(input: EligibilityInput): {
  eligible: boolean;
  issues: EligibilityIssue[];
} {
  const issues: EligibilityIssue[] = [];

  // Hanya pesanan yang sudah sampai. Barang yang belum diterima bukan retur,
  // melainkan pembatalan — dan keduanya menghasilkan akibat yang berbeda.
  if (!['DELIVERED', 'COMPLETED'].includes(input.orderStatus)) {
    issues.push({
      code: 'ORDER_NOT_ELIGIBLE',
      detail: `Pesanan berstatus ${input.orderStatus} belum dapat diretur.`,
    });
  }

  if (!input.deliveredAt) {
    issues.push({
      code: 'NOT_DELIVERED',
      detail: 'Waktu penerimaan barang belum tercatat.',
    });
  } else {
    const days = Math.floor(
      (input.now.getTime() - input.deliveredAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (days > RETURN_WINDOW_DAYS) {
      issues.push({
        code: 'WINDOW_EXPIRED',
        detail: `Batas retur ${RETURN_WINDOW_DAYS} hari sudah lewat (${days} hari).`,
      });
    }
  }

  if (input.hasOpenReturn) {
    issues.push({
      code: 'DUPLICATE_OPEN_RETURN',
      detail: 'Masih ada permintaan retur berjalan untuk pesanan ini.',
    });
  }

  if (!Number.isFinite(input.requestedQty) || input.requestedQty <= 0) {
    issues.push({ code: 'QUANTITY_INVALID', detail: 'Jumlah retur tidak sah.' });
  } else if (input.requestedQty + input.alreadyReturnedQty > input.orderedQty) {
    // Yang sudah diretur ikut dihitung; tanpanya pembeli dapat meretur lebih
    // banyak daripada yang dibelinya lewat beberapa pengajuan.
    const sisa = input.orderedQty - input.alreadyReturnedQty;
    issues.push({
      code: 'QUANTITY_EXCEEDS_ORDER',
      detail: `Sisa yang dapat diretur ${sisa}, diminta ${input.requestedQty}.`,
    });
  }

  if (!KNOWN_REASONS.includes(input.reasonCode)) {
    issues.push({
      code: 'UNKNOWN_REASON',
      detail: `Alasan "${input.reasonCode}" tidak dikenal.`,
    });
  }

  return { eligible: issues.length === 0, issues };
}

/** Apakah ongkos kirim balik ditanggung pembeli. */
export function returnShippingBorneByBuyer(reasonCode: string): boolean {
  return BUYER_FAULT_REASONS.includes(reasonCode);
}

// ---------------------------------------------------------------------------
// Perhitungan pengembalian dana
// ---------------------------------------------------------------------------

export interface RefundInput {
  /** Baris yang diretur beserta hasil pemeriksaannya. */
  lines: {
    unitPrice: number;
    receivedQuantity: number;
    inspectionResult: 'GOOD' | 'DAMAGED' | 'MISSING' | 'NOT_RECEIVED' | null;
  }[];
  /** Ongkos kirim awal. Dikembalikan hanya bila kesalahan ada pada penjual. */
  originalShipping: number;
  reasonCode: string;
}

/**
 * Menghitung nilai pengembalian dana.
 *
 * Yang dikembalikan adalah nilai barang yang **benar-benar diterima kembali
 * dalam keadaan baik**, bukan nilai yang diajukan. Barang yang tidak sampai
 * atau sampai dalam keadaan rusak tidak menghasilkan pengembalian — kalau
 * tidak, retur menjadi cara mendapat barang gratis.
 *
 * Ongkos kirim awal dikembalikan hanya bila kesalahan ada pada penjual.
 */
export function computeRefundAmount(input: RefundInput): {
  itemsAmount: number;
  shippingAmount: number;
  total: number;
  excluded: number;
} {
  let itemsAmount = 0;
  let excluded = 0;

  for (const line of input.lines) {
    const value = Math.round(line.unitPrice) * line.receivedQuantity;
    if (line.inspectionResult === 'GOOD') {
      itemsAmount += value;
    } else {
      excluded += value;
    }
  }

  const sellerFault = !returnShippingBorneByBuyer(input.reasonCode);
  const shippingAmount = sellerFault && itemsAmount > 0 ? Math.round(input.originalShipping) : 0;

  return {
    itemsAmount,
    shippingAmount,
    total: itemsAmount + shippingAmount,
    excluded,
  };
}

// ---------------------------------------------------------------------------
// Pengembalian dana
// ---------------------------------------------------------------------------

export type RefundMethod = 'PROVIDER' | 'MANUAL';

export interface RefundCapability {
  providerSupportsRefund: boolean;
}

/**
 * Menentukan cara pengembalian dana.
 *
 * Selama penyedia belum terbukti mendukung, jawabannya `MANUAL` — dan itu
 * bukan kegagalan, melainkan kenyataan yang dinyatakan.
 */
export function resolveRefundMethod(capability: RefundCapability): {
  method: RefundMethod;
  initialStatus: string;
  note: string;
} {
  if (capability.providerSupportsRefund) {
    return {
      method: 'PROVIDER',
      initialStatus: 'PROCESSING',
      note: 'Pengembalian dana dikirim ke penyedia pembayaran.',
    };
  }
  return {
    method: 'MANUAL',
    initialStatus: 'MANUAL_REQUIRED',
    note:
      'Penyedia pembayaran belum mendukung pengembalian dana otomatis. ' +
      'Dana harus ditransfer secara manual dan buktinya dicatat.',
  };
}

/**
 * Apakah pengembalian dana boleh dinyatakan selesai.
 *
 * Metode manual menuntut bukti. Tanpa bukti, "sudah dikembalikan" hanya klaim —
 * dan klaim tanpa bukti tidak dapat dipertanggungjawabkan bila pembeli
 * mempersoalkannya.
 */
export function canCompleteRefund(
  method: RefundMethod,
  proofReference: string | null | undefined,
): RuleVerdict {
  if (method === 'MANUAL' && (!proofReference || proofReference.trim().length < 3)) {
    return {
      ok: false,
      reason: 'Pengembalian dana manual menuntut bukti transfer sebelum dinyatakan selesai.',
    };
  }
  return { ok: true };
}
