/**
 * Mesin transisi status penjualan kasir.
 *
 * Ditulis sebagai tabel, bukan sebagai rangkaian pemeriksaan `if` yang tersebar.
 * Alasannya bukan kerapian: aturan "kasir tidak boleh membatalkan transaksi yang
 * sudah dibayar tanpa persetujuan" harus benar di **setiap** jalan menuju status
 * itu, dan pemeriksaan yang tersebar selalu punya satu jalan yang terlewat.
 *
 * Polanya mengikuti `modules/order/order-state.ts` yang sudah terbukti pada
 * marketplace. Statusnya berbeda — kasir tidak mengenal pengiriman — tetapi
 * bentuknya sama.
 */

export const POS_SALE_STATUSES = [
  'DRAFT',
  'HELD',
  'PAYMENT_PENDING',
  'PAID',
  'COMPLETED',
  'VOID_REQUESTED',
  'VOIDED',
  'RETURNED_PARTIAL',
  'RETURNED_FULL',
  'REFUND_PENDING',
  'REFUNDED_PARTIAL',
  'REFUNDED_FULL',
  'CANCELLED',
] as const;

export type PosSaleStatus = (typeof POS_SALE_STATUSES)[number];

/**
 * Transisi yang sah.
 *
 * Status akhir memiliki daftar kosong. `VOIDED`, `CANCELLED`, dan
 * `REFUNDED_FULL` tidak dapat berubah lagi — transaksi yang sudah dibatalkan
 * tidak dapat "dibatalkan kembali" menjadi selesai.
 */
export const POS_SALE_TRANSITIONS: Record<PosSaleStatus, PosSaleStatus[]> = {
  DRAFT: ['HELD', 'PAYMENT_PENDING', 'CANCELLED'],
  HELD: ['DRAFT', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'DRAFT', 'CANCELLED'],
  // PAID adalah keadaan sesaat: uang sudah diterima tetapi stok dan jurnal
  // belum terbentuk. Ia hanya boleh maju ke COMPLETED.
  PAID: ['COMPLETED'],
  COMPLETED: ['VOID_REQUESTED', 'RETURNED_PARTIAL', 'RETURNED_FULL'],
  VOID_REQUESTED: ['VOIDED', 'COMPLETED'],
  VOIDED: [],
  RETURNED_PARTIAL: ['REFUND_PENDING', 'RETURNED_FULL', 'RETURNED_PARTIAL'],
  RETURNED_FULL: ['REFUND_PENDING'],
  REFUND_PENDING: ['REFUNDED_PARTIAL', 'REFUNDED_FULL'],
  REFUNDED_PARTIAL: ['REFUND_PENDING', 'REFUNDED_FULL'],
  REFUNDED_FULL: [],
  CANCELLED: [],
};

/** Status yang tidak dapat berubah lagi. */
export function isTerminal(status: PosSaleStatus): boolean {
  return POS_SALE_TRANSITIONS[status].length === 0;
}

/** Status yang berarti uang sudah diterima. */
export function sudahDibayar(status: PosSaleStatus): boolean {
  return [
    'PAID',
    'COMPLETED',
    'VOID_REQUESTED',
    'RETURNED_PARTIAL',
    'RETURNED_FULL',
    'REFUND_PENDING',
    'REFUNDED_PARTIAL',
    'REFUNDED_FULL',
  ].includes(status);
}

/** Status yang barisnya masih boleh disunting. */
export function bolehDisunting(status: PosSaleStatus): boolean {
  return status === 'DRAFT' || status === 'HELD';
}

export interface Verdict {
  allowed: boolean;
  message?: string;
  /** Hak akses yang dituntut transisi ini, bila ada. */
  requiresPermission?: string;
  /** Benar bila transisi ini menuntut persetujuan pihak lain. */
  requiresApproval?: boolean;
}

/**
 * Hak akses dan persetujuan yang dituntut tiap transisi.
 *
 * Dinyatakan di sini — bersama tabel transisinya — dan bukan pada setiap
 * endpoint, supaya tidak ada jalan menuju sebuah status yang lupa memeriksanya.
 */
const SYARAT: Partial<Record<`${PosSaleStatus}->${PosSaleStatus}`, Omit<Verdict, 'allowed'>>> = {
  'DRAFT->PAYMENT_PENDING': { requiresPermission: 'POS_SALE.SELL' },
  'PAYMENT_PENDING->PAID': { requiresPermission: 'POS_SALE.SELL' },
  'PAID->COMPLETED': { requiresPermission: 'POS_SALE.SELL' },
  'DRAFT->HELD': { requiresPermission: 'POS_SALE.HOLD' },
  'HELD->DRAFT': { requiresPermission: 'POS_SALE.RESUME' },
  // Membatalkan transaksi yang sudah selesai selalu melewati permintaan lebih
  // dahulu, dan permintaannya tidak boleh disetujui pemohonnya sendiri.
  'COMPLETED->VOID_REQUESTED': { requiresPermission: 'POS_SALE.CANCEL' },
  'VOID_REQUESTED->VOIDED': { requiresPermission: 'POS_SALE.APPROVE', requiresApproval: true },
  // Menolak permintaan pembatalan adalah keputusan supervisor yang sama
  // beratnya dengan menyetujuinya -- pemohon tidak boleh menutup
  // permintaannya sendiri dengan berpura-pura "ditolak" begitu saja.
  'VOID_REQUESTED->COMPLETED': { requiresPermission: 'POS_SALE.APPROVE', requiresApproval: true },
  'COMPLETED->RETURNED_PARTIAL': { requiresPermission: 'POS_RETURN.RETURN' },
  'COMPLETED->RETURNED_FULL': { requiresPermission: 'POS_RETURN.RETURN' },
  'RETURNED_PARTIAL->REFUND_PENDING': { requiresPermission: 'POS_RETURN.RETURN_APPROVE' },
  'RETURNED_FULL->REFUND_PENDING': { requiresPermission: 'POS_RETURN.RETURN_APPROVE' },
  'REFUND_PENDING->REFUNDED_PARTIAL': {
    requiresPermission: 'POS_RETURN.REFUND_APPROVE',
    requiresApproval: true,
  },
  'REFUND_PENDING->REFUNDED_FULL': {
    requiresPermission: 'POS_RETURN.REFUND_APPROVE',
    requiresApproval: true,
  },
};

/**
 * Bolehkah berpindah dari satu status ke status lain?
 *
 * Mengembalikan alasan penolakannya, bukan hanya benar/salah. Kasir yang
 * ditolak perlu tahu sebabnya, dan pesan seperti "transisi tidak sah" tidak
 * memberitahunya apa pun.
 */
export function bolehPindah(dari: PosSaleStatus, ke: PosSaleStatus): Verdict {
  if (dari === ke) {
    return { allowed: false, message: `Transaksi sudah berstatus ${ke}.` };
  }
  if (isTerminal(dari)) {
    return {
      allowed: false,
      message: `Transaksi berstatus ${dari} sudah final dan tidak dapat diubah lagi.`,
    };
  }
  if (!POS_SALE_TRANSITIONS[dari].includes(ke)) {
    return {
      allowed: false,
      message: `Transaksi berstatus ${dari} tidak dapat langsung menjadi ${ke}.`,
    };
  }
  return { allowed: true, ...(SYARAT[`${dari}->${ke}`] ?? {}) };
}

/**
 * Bolehkah menyunting baris keranjang?
 *
 * Dipisahkan dari transisi status karena ia bukan perpindahan status —
 * menambah baris pada keranjang yang sudah dibayar bukan "transisi yang tidak
 * sah", melainkan hal yang tidak boleh terjadi sama sekali.
 */
export function bolehSuntingBaris(status: PosSaleStatus): Verdict {
  if (bolehDisunting(status)) return { allowed: true };
  if (sudahDibayar(status)) {
    return {
      allowed: false,
      message:
        'Transaksi ini sudah dibayar dan tidak dapat diubah. Gunakan retur bila barang dikembalikan.',
    };
  }
  return { allowed: false, message: `Transaksi berstatus ${status} tidak dapat diubah.` };
}

/**
 * Bolehkah pengguna ini menyetujui permintaan yang diajukan orang lain?
 *
 * Aturan pemisahan wewenang dinyatakan di sini pula, bukan hanya sebagai baris
 * pada `segregation_of_duty_rule`. Aturan yang hanya tersimpan sebagai data akan
 * berhenti berlaku begitu seseorang menonaktifkan barisnya; aturan yang juga ada
 * pada kode akan tetap menolak.
 */
export function bolehMenyetujui(pemohonId: string | null, penyetujuId: string): Verdict {
  if (pemohonId && pemohonId === penyetujuId) {
    return {
      allowed: false,
      message:
        'Anda tidak dapat menyetujui permintaan yang Anda ajukan sendiri. Mintakan kepada supervisor lain.',
    };
  }
  return { allowed: true };
}

/**
 * Status retur berikutnya menurut berapa banyak barang yang sudah dikembalikan.
 *
 * Dihitung dari jumlah, bukan ditentukan pemanggil. Retur yang menyatakan
 * dirinya "penuh" padahal sebagian barang masih di tangan pembeli akan menutup
 * transaksi terlalu cepat, dan sisa barangnya tidak dapat diretur lagi.
 */
export function statusRetur(totalBaris: number, totalDikembalikan: number): PosSaleStatus {
  if (totalDikembalikan <= 0) return 'COMPLETED';
  return totalDikembalikan >= totalBaris ? 'RETURNED_FULL' : 'RETURNED_PARTIAL';
}

/** Status refund berikutnya menurut nilai yang sudah dikembalikan. */
export function statusRefund(totalDibayar: number, totalDirefund: number): PosSaleStatus {
  if (totalDirefund <= 0) return 'REFUND_PENDING';
  return totalDirefund >= totalDibayar ? 'REFUNDED_FULL' : 'REFUNDED_PARTIAL';
}
