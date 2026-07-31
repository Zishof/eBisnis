/**
 * Perpindahan status pesanan marketplace.
 *
 * Ditulis sebagai tabel perpindahan, bukan rangkaian `if`. Bentuk ini membuat
 * satu hal dapat dipastikan dengan membacanya: tidak ada jalan dari `CANCELLED`
 * kembali ke `PAID`. Dengan rangkaian `if` tersebar di beberapa layanan, hal
 * itu hanya dapat dipastikan dengan membaca seluruhnya.
 */

export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'DISPUTED';

export type ActorType = 'BUYER' | 'SELLER' | 'PLATFORM' | 'SYSTEM';

/**
 * Perpindahan yang diizinkan, beserta siapa yang boleh melakukannya.
 *
 * Pembeli tidak dapat menyatakan pesanannya sudah dikirim, dan penjual tidak
 * dapat menyatakan pembayaran sudah masuk. Keduanya tampak sepele sampai ada
 * yang mencobanya.
 */
const TRANSITIONS: Record<OrderStatus, { to: OrderStatus; actors: ActorType[] }[]> = {
  AWAITING_PAYMENT: [
    // Hanya sistem: pembayaran masuk lewat callback penyedia, bukan lewat
    // pernyataan penjual maupun pembeli.
    { to: 'PAID', actors: ['SYSTEM'] },
    { to: 'CANCELLED', actors: ['BUYER', 'SELLER', 'PLATFORM'] },
    { to: 'EXPIRED', actors: ['SYSTEM'] },
  ],
  PAID: [
    { to: 'PROCESSING', actors: ['SELLER', 'SYSTEM'] },
    // Pembatalan setelah lunas menuntut pengembalian dana; karena itu hanya
    // penjual dan platform, bukan pembeli sendiri.
    { to: 'CANCELLED', actors: ['SELLER', 'PLATFORM'] },
    { to: 'DISPUTED', actors: ['BUYER', 'PLATFORM'] },
  ],
  PROCESSING: [
    { to: 'READY_TO_SHIP', actors: ['SELLER'] },
    { to: 'CANCELLED', actors: ['SELLER', 'PLATFORM'] },
    { to: 'DISPUTED', actors: ['BUYER', 'PLATFORM'] },
  ],
  READY_TO_SHIP: [
    { to: 'SHIPPED', actors: ['SELLER', 'SYSTEM'] },
    { to: 'CANCELLED', actors: ['SELLER', 'PLATFORM'] },
    { to: 'DISPUTED', actors: ['BUYER', 'PLATFORM'] },
  ],
  SHIPPED: [
    { to: 'DELIVERED', actors: ['SYSTEM', 'BUYER'] },
    { to: 'DISPUTED', actors: ['BUYER', 'PLATFORM'] },
  ],
  DELIVERED: [
    { to: 'COMPLETED', actors: ['BUYER', 'SYSTEM'] },
    { to: 'DISPUTED', actors: ['BUYER', 'PLATFORM'] },
  ],
  // Pesanan selesai masih dapat disengketakan dalam masa garansi, tetapi tidak
  // dapat kembali berjalan.
  COMPLETED: [{ to: 'DISPUTED', actors: ['BUYER', 'PLATFORM'] }],
  DISPUTED: [
    { to: 'REFUNDED', actors: ['PLATFORM'] },
    { to: 'COMPLETED', actors: ['PLATFORM'] },
  ],
  // Tiga keadaan akhir. Tidak ada jalan keluar dari sini.
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: ActorType,
): TransitionCheck {
  if (from === to) {
    // Bukan kesalahan, tetapi juga bukan perpindahan. Peristiwa yang sampai dua
    // kali sering menghasilkan ini.
    return { allowed: false, reason: `Pesanan sudah berstatus ${to}.` };
  }

  const options = TRANSITIONS[from];
  if (!options) {
    return { allowed: false, reason: `Status "${from}" tidak dikenal.` };
  }

  const match = options.find((option) => option.to === to);
  if (!match) {
    const possible = options.map((o) => o.to).join(', ') || 'tidak ada';
    return {
      allowed: false,
      reason: `Pesanan berstatus ${from} tidak dapat menjadi ${to}. Yang mungkin: ${possible}.`,
    };
  }

  if (!match.actors.includes(actor)) {
    return {
      allowed: false,
      reason: `${actor} tidak berhak mengubah ${from} menjadi ${to}.`,
    };
  }

  return { allowed: true };
}

/** Status akhir yang tidak dapat berubah lagi. */
export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

/** Status yang stoknya masih tertahan dan belum dipotong. */
export function holdsStock(status: OrderStatus): boolean {
  return status === 'AWAITING_PAYMENT';
}

/** Seluruh status yang dikenal. Dipakai memeriksa kelengkapan tabel. */
export const ALL_ORDER_STATUSES = Object.keys(TRANSITIONS) as OrderStatus[];
