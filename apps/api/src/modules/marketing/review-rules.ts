/**
 * Aturan ulasan dan percakapan marketplace.
 *
 * ## Ulasan hanya dari pembelian yang sungguh terjadi
 *
 * Tanpa syarat itu, penjual dapat membeli ulasan bagus dan pesaing dapat
 * menjatuhkan tanpa pernah membeli. Syaratnya bukan sekadar "pernah memesan",
 * melainkan "pesanannya sudah sampai" — barang yang belum diterima belum dapat
 * dinilai.
 */

export type ReviewIssueCode =
  | 'ORDER_NOT_DELIVERED'
  | 'NOT_ORDER_OWNER'
  | 'ITEM_NOT_IN_ORDER'
  | 'ALREADY_REVIEWED'
  | 'WINDOW_EXPIRED'
  | 'RATING_INVALID'
  | 'BODY_TOO_SHORT'
  | 'BODY_TOO_LONG';

export interface ReviewIssue {
  code: ReviewIssueCode;
  detail: string;
}

/** Berapa hari setelah barang sampai ulasan masih dapat ditulis. */
export const REVIEW_WINDOW_DAYS = 60;
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 2000;

export interface ReviewEligibilityInput {
  orderStatus: string;
  orderBuyerId: string;
  requesterBuyerId: string;
  deliveredAt: Date | null;
  now: Date;
  itemBelongsToOrder: boolean;
  alreadyReviewed: boolean;
  rating: number;
  body: string | null;
}

/**
 * Memeriksa apakah ulasan boleh ditulis.
 *
 * Seluruh syarat diperiksa sekaligus; pembeli yang ingin menulis ulasan tidak
 * perlu ditolak berkali-kali karena alasan yang berbeda.
 */
export function checkReviewEligibility(input: ReviewEligibilityInput): {
  eligible: boolean;
  issues: ReviewIssue[];
} {
  const issues: ReviewIssue[] = [];

  // Kepemilikan diperiksa lebih dulu. Tanpa ini, id pesanan yang ditebak
  // memungkinkan siapa pun menulis ulasan atas pembelian orang lain.
  if (input.orderBuyerId !== input.requesterBuyerId) {
    issues.push({
      code: 'NOT_ORDER_OWNER',
      detail: 'Ulasan hanya dapat ditulis oleh pembeli pesanan ini.',
    });
  }

  if (!['DELIVERED', 'COMPLETED'].includes(input.orderStatus)) {
    issues.push({
      code: 'ORDER_NOT_DELIVERED',
      detail: 'Barang belum sampai sehingga belum dapat dinilai.',
    });
  }

  if (!input.itemBelongsToOrder) {
    issues.push({
      code: 'ITEM_NOT_IN_ORDER',
      detail: 'Produk ini tidak ada pada pesanan tersebut.',
    });
  }

  if (input.alreadyReviewed) {
    issues.push({
      code: 'ALREADY_REVIEWED',
      detail: 'Produk ini sudah pernah diulas pada pesanan tersebut.',
    });
  }

  if (input.deliveredAt) {
    const hari = Math.floor(
      (input.now.getTime() - input.deliveredAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (hari > REVIEW_WINDOW_DAYS) {
      issues.push({
        code: 'WINDOW_EXPIRED',
        detail: `Batas menulis ulasan ${REVIEW_WINDOW_DAYS} hari sudah lewat (${hari} hari).`,
      });
    }
  }

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    issues.push({ code: 'RATING_INVALID', detail: 'Nilai harus bilangan bulat 1 sampai 5.' });
  }

  // Isi ulasan boleh kosong — nilai bintang saja sudah bermakna. Yang tidak
  // boleh adalah isi yang terlalu pendek untuk dipahami tetapi bukan kosong.
  if (input.body !== null && input.body.trim().length > 0) {
    const panjang = input.body.trim().length;
    if (panjang < REVIEW_BODY_MIN) {
      issues.push({
        code: 'BODY_TOO_SHORT',
        detail: `Isi ulasan minimal ${REVIEW_BODY_MIN} karakter, atau kosongkan sama sekali.`,
      });
    } else if (panjang > REVIEW_BODY_MAX) {
      issues.push({
        code: 'BODY_TOO_LONG',
        detail: `Isi ulasan maksimal ${REVIEW_BODY_MAX} karakter.`,
      });
    }
  }

  return { eligible: issues.length === 0, issues };
}

/**
 * Menghitung ringkasan nilai.
 *
 * Hanya ulasan yang sudah terbit yang dihitung. Ulasan yang menunggu moderasi
 * belum boleh memengaruhi angka yang dilihat pembeli.
 */
export function summarizeRatings(
  reviews: { rating: number; moderationStatus: string }[],
): { average: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> } {
  const published = reviews.filter((r) => r.moderationStatus === 'PUBLISHED');
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;

  for (const review of published) {
    const bintang = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[bintang] += 1;
  }

  const total = published.reduce((sum, r) => sum + r.rating, 0);
  return {
    // Dibulatkan satu angka di belakang koma. Ketelitian lebih dari itu
    // menyiratkan kepastian yang tidak dimiliki rata-rata dari sedikit ulasan.
    average: published.length ? Math.round((total / published.length) * 10) / 10 : 0,
    count: published.length,
    distribution,
  };
}

// ---------------------------------------------------------------------------
// Percakapan
// ---------------------------------------------------------------------------

/**
 * Pola yang menandakan ajakan bertransaksi di luar marketplace.
 *
 * Ditandai, **bukan diblokir**. Memblokir otomatis akan menghalangi percakapan
 * sah — nomor rekening juga muncul saat penjual menjawab pertanyaan pengembalian
 * dana yang memang harus manual. Yang ditandai ditinjau manusia.
 */
const SUSPICIOUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b\d{10,16}\b/, reason: 'Menyerupai nomor rekening.' },
  { pattern: /\b(wa|whatsapp|telegram|line)\b[\s:.]*[+0-9]/i, reason: 'Menyertakan kontak luar.' },
  { pattern: /\b08\d{8,11}\b/, reason: 'Menyerupai nomor telepon.' },
  { pattern: /\b(transfer|tf)\s+(langsung|diluar|di luar)\b/i, reason: 'Mengajak transaksi di luar marketplace.' },
];

export interface MessageCheck {
  flagged: boolean;
  reason: string | null;
}

/** Memeriksa isi pesan tanpa memblokirnya. */
export function screenMessage(body: string): MessageCheck {
  for (const rule of SUSPICIOUS_PATTERNS) {
    if (rule.pattern.test(body)) {
      return { flagged: true, reason: rule.reason };
    }
  }
  return { flagged: false, reason: null };
}

export const MESSAGE_MAX_LENGTH = 4000;

/** Memeriksa bentuk pesan sebelum disimpan. */
export function validateMessage(body: string): { ok: boolean; reason?: string } {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'Pesan kosong.' };
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: `Pesan maksimal ${MESSAGE_MAX_LENGTH} karakter.` };
  }
  return { ok: true };
}

/** Cuplikan untuk daftar percakapan. */
export function previewOf(body: string, max = 200): string {
  return body.trim().replace(/\s+/g, ' ').slice(0, max);
}
