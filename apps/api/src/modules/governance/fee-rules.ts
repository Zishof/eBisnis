/**
 * Aturan biaya marketplace dan pelanggaran.
 *
 * ## Biaya diakrualkan, bukan dipotong dari setelmen
 *
 * Memotong biaya dari setelmen menuntut penyedia pembayaran membagi dana ke
 * beberapa rekening. eSmartlink belum terbukti mendukungnya, dan membuat
 * pembagian sendiri berarti platform menampung uang penjual — kegiatan yang
 * menuntut izin yang tidak dimiliki.
 *
 * Biaya karena itu dicatat sebagai kewajiban penjual lalu ditagihkan lewat
 * faktur platform yang sudah ada. Penjual menerima uang penuh dari pembeli,
 * dan membayar biaya secara terpisah.
 *
 * Bentuk ini juga lebih jujur secara akuntansi: pendapatan penjual dan biaya
 * platform adalah dua peristiwa berbeda, bukan satu angka bersih.
 */

export interface FeeSchedule {
  feeType: 'PERCENT' | 'FIXED_PER_ORDER';
  feeValue: number;
  maxFeePerOrder: number | null;
  minFeePerOrder: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: string;
  sellerId: string | null;
  categoryId: string | null;
}

export interface FeeContext {
  now: Date;
  sellerId: string;
  categoryId: string | null;
  /** Nilai barang, tanpa ongkos kirim. */
  baseAmount: number;
}

/**
 * Menghitung biaya atas satu pesanan.
 *
 * Ongkos kirim **tidak** termasuk dasar perhitungan. Biaya atas ongkos kirim
 * berarti platform menarik bagian dari uang yang diteruskan penjual kepada
 * ekspedisi.
 */
export function computeFee(schedule: FeeSchedule, baseAmount: number): number {
  if (baseAmount <= 0) return 0;

  let fee: number;
  if (schedule.feeType === 'PERCENT') {
    const percent = Math.min(Math.max(schedule.feeValue, 0), 100);
    fee = Math.round((baseAmount * percent) / 100);
  } else {
    fee = Math.round(Math.max(schedule.feeValue, 0));
  }

  // Batas atas mencegah biaya persen pada pesanan besar menjadi angka yang
  // tidak sebanding dengan layanan yang diberikan.
  if (schedule.maxFeePerOrder !== null) {
    fee = Math.min(fee, Math.round(schedule.maxFeePerOrder));
  }
  fee = Math.max(fee, Math.round(schedule.minFeePerOrder));

  // Biaya tidak pernah melebihi nilai barang. Penjual tidak boleh menerima
  // pesanan lalu berutang lebih besar daripada nilai yang dijualnya.
  return Math.min(fee, Math.round(baseAmount));
}

/**
 * Memilih kebijakan biaya yang berlaku.
 *
 * Yang lebih khusus menang: kebijakan untuk penjual tertentu mengalahkan
 * kebijakan kategori, dan kebijakan kategori mengalahkan kebijakan umum.
 * Tanpa urutan ini, kesepakatan khusus dengan satu penjual akan tertimpa
 * kebijakan umum yang diperbarui belakangan.
 */
export function selectSchedule(
  schedules: FeeSchedule[],
  context: FeeContext,
): FeeSchedule | null {
  const berlaku = schedules.filter(
    (s) =>
      s.status === 'ACTIVE' &&
      s.effectiveFrom <= context.now &&
      (s.effectiveTo === null || s.effectiveTo >= context.now) &&
      (s.sellerId === null || s.sellerId === context.sellerId) &&
      (s.categoryId === null || s.categoryId === context.categoryId),
  );
  if (berlaku.length === 0) return null;

  const kekhususan = (s: FeeSchedule) => (s.sellerId ? 2 : 0) + (s.categoryId ? 1 : 0);
  return berlaku.sort((a, b) => {
    const beda = kekhususan(b) - kekhususan(a);
    if (beda !== 0) return beda;
    // Pada kekhususan yang sama, yang paling baru berlaku.
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  })[0];
}

/** Biaya nol adalah hasil yang sah, bukan kegagalan. */
export function isZeroFee(fee: number): boolean {
  return fee === 0;
}

// ---------------------------------------------------------------------------
// Pelanggaran
// ---------------------------------------------------------------------------

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Penalty =
  | 'NONE'
  | 'WARNING'
  | 'LISTING_REMOVED'
  | 'LISTING_SUSPENDED'
  | 'SELLER_SUSPENDED';

/** Poin yang diberikan menurut tingkat pelanggaran. */
const SEVERITY_POINTS: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 3,
  HIGH: 6,
  CRITICAL: 12,
};

/** Ambang poin terakumulasi yang memicu penangguhan penjual. */
export const SUSPENSION_THRESHOLD = 12;

export function pointsFor(severity: Severity): number {
  return SEVERITY_POINTS[severity] ?? 0;
}

/**
 * Menentukan hukuman.
 *
 * Penangguhan penjual terjadi pada **poin terakumulasi**, bukan pada satu
 * pelanggaran — kecuali yang tingkatnya kritis. Menangguhkan penjual karena
 * satu kesalahan kecil menghentikan penghidupannya atas hal yang mungkin
 * kekeliruan.
 */
export function determinePenalty(
  severity: Severity,
  accumulatedPoints: number,
): { penalty: Penalty; reason: string } {
  const totalSetelahIni = accumulatedPoints + pointsFor(severity);

  if (severity === 'CRITICAL') {
    return {
      penalty: 'SELLER_SUSPENDED',
      reason: 'Pelanggaran berat menangguhkan penjual seketika.',
    };
  }

  if (totalSetelahIni >= SUSPENSION_THRESHOLD) {
    return {
      penalty: 'SELLER_SUSPENDED',
      reason: `Poin pelanggaran mencapai ${totalSetelahIni} dari ambang ${SUSPENSION_THRESHOLD}.`,
    };
  }

  if (severity === 'HIGH') {
    return { penalty: 'LISTING_SUSPENDED', reason: 'Produk ditangguhkan sampai diperbaiki.' };
  }
  if (severity === 'MEDIUM') {
    return { penalty: 'LISTING_REMOVED', reason: 'Produk ditarik dari katalog.' };
  }
  return { penalty: 'WARNING', reason: 'Peringatan dicatat.' };
}

/**
 * Apakah banding masih dapat diajukan.
 *
 * Pelanggaran tanpa jalan banding membuat kesalahan moderator menjadi permanen.
 */
export const APPEAL_WINDOW_DAYS = 14;

export function canAppeal(
  status: string,
  recordedAt: Date,
  now: Date,
): { ok: boolean; reason?: string } {
  if (['APPEALED', 'UPHELD', 'OVERTURNED'].includes(status)) {
    return { ok: false, reason: 'Banding sudah pernah diajukan.' };
  }
  if (status === 'CLOSED') {
    return { ok: false, reason: 'Pelanggaran sudah ditutup.' };
  }

  const hari = Math.floor((now.getTime() - recordedAt.getTime()) / (24 * 60 * 60 * 1000));
  if (hari > APPEAL_WINDOW_DAYS) {
    return {
      ok: false,
      reason: `Batas banding ${APPEAL_WINDOW_DAYS} hari sudah lewat (${hari} hari).`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Penyaring kebijakan produk
// ---------------------------------------------------------------------------

export interface PolicyMatch {
  policyCode: string;
  policyType: 'PROHIBITED' | 'RESTRICTED';
  matchedKeyword: string;
}

/**
 * Mencari kata kunci kebijakan pada teks listing.
 *
 * Hasilnya **memicu peninjauan, bukan penolakan**. Kata "pisau" muncul pada
 * pisau dapur maupun pada barang terlarang, dan menolak otomatis akan
 * menghalangi penjualan yang sah.
 */
export function screenAgainstPolicies(
  text: string,
  policies: { code: string; policyType: 'PROHIBITED' | 'RESTRICTED'; keywordPatterns: string[] }[],
): PolicyMatch[] {
  const haystack = text.toLowerCase();
  const matches: PolicyMatch[] = [];

  for (const policy of policies) {
    for (const keyword of policy.keywordPatterns) {
      const needle = keyword.toLowerCase().trim();
      if (!needle) continue;
      // Pencocokan kata utuh, bukan sebagian. Tanpa batas kata, "sabu" akan
      // cocok pada "sabun".
      const pattern = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(haystack)) {
        matches.push({
          policyCode: policy.code,
          policyType: policy.policyType,
          matchedKeyword: keyword,
        });
        break;
      }
    }
  }

  return matches;
}

/** Prioritas antrean moderasi. Angka lebih kecil ditinjau lebih dulu. */
export function moderationPriority(
  triggerType: 'AUTOMATIC' | 'REPORTED' | 'ROUTINE',
  policyType: 'PROHIBITED' | 'RESTRICTED' | null,
): number {
  if (policyType === 'PROHIBITED') return 1;
  // Laporan dari orang didahulukan daripada penyaring otomatis: seseorang
  // meluangkan waktu melaporkannya, dan penyaring lebih sering keliru.
  if (triggerType === 'REPORTED') return 10;
  if (policyType === 'RESTRICTED') return 20;
  if (triggerType === 'AUTOMATIC') return 50;
  return 100;
}
