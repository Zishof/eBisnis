/**
 * Mesin posting akuntansi.
 *
 * ## Debit dan kredit tinggal di data, bukan di kode
 *
 * Blueprint melarang menulis debit/kredit di controller. Larangan itu tidak
 * dapat ditegakkan hanya dengan disiplin: satu endpoint baru yang lupa akan
 * membuat jurnal dengan akun yang berbeda dari endpoint lain untuk peristiwa
 * yang sama.
 *
 * Karena itu kode hanya menyatakan "peristiwa ini terjadi dengan nilai sekian".
 * Akun mana yang didebit dan dikredit ditentukan baris `accounting_posting_rule`
 * yang dapat diubah tanpa rilis.
 *
 * ## Tanpa rumus bebas
 *
 * Aturan menunjuk **nama medan** pada nilai peristiwa, bukan rumus. Rumus bebas
 * pada data adalah pintu masuk eksekusi kode yang tidak diinginkan, dan
 * larangan `eval` maupun `Function` berlaku di sini sebagaimana pada mesin
 * diskon.
 */

export type PostingSide = 'DEBIT' | 'CREDIT';

export interface PostingRule {
  code: string;
  eventCode: string;
  sortOrder: number;
  accountId: string;
  side: PostingSide;
  /** Nama medan pada `amounts`; bukan rumus. */
  amountKey: string;
  skipWhenZero: boolean;
  descriptionTemplate: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}

export interface AccountingEvent {
  eventCode: string;
  sourceType: string;
  sourceId: string;
  sourceNumber: string | null;
  occurredAt: Date;
  amounts: Record<string, number>;
  currencyCode: string;
}

export interface JournalLine {
  accountId: string;
  side: PostingSide;
  amount: number;
  description: string;
  sortOrder: number;
}

export interface PostingResult {
  ok: boolean;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  issues: PostingIssue[];
}

export interface PostingIssue {
  code:
    | 'NO_RULE'
    | 'UNBALANCED'
    | 'AMOUNT_MISSING'
    | 'AMOUNT_NEGATIVE'
    | 'NO_LINES'
    | 'RULE_NOT_EFFECTIVE';
  detail: string;
}

/**
 * Menyusun baris jurnal dari peristiwa dan aturan.
 *
 * Tidak menulis apa pun — hasilnya diperiksa pemanggil sebelum disimpan.
 * Memisahkan penyusunan dari penyimpanan membuat seluruh kombinasi aturan
 * dapat diuji tanpa basis data.
 */
export function buildJournalLines(
  event: AccountingEvent,
  rules: PostingRule[],
): PostingResult {
  const issues: PostingIssue[] = [];

  const berlaku = rules.filter(
    (rule) =>
      rule.isActive &&
      rule.eventCode === event.eventCode &&
      rule.effectiveFrom <= event.occurredAt &&
      (rule.effectiveTo === null || rule.effectiveTo >= event.occurredAt),
  );

  if (rules.length > 0 && berlaku.length === 0) {
    // Ada aturan untuk peristiwa ini, tetapi tidak satu pun berlaku pada
    // tanggalnya. Ini berbeda dari tidak ada aturan sama sekali, dan
    // membedakannya membantu menemukan kebijakan yang lupa diperpanjang.
    const punyaKode = rules.some((r) => r.eventCode === event.eventCode);
    issues.push({
      code: punyaKode ? 'RULE_NOT_EFFECTIVE' : 'NO_RULE',
      detail: punyaKode
        ? `Aturan untuk "${event.eventCode}" ada tetapi tidak berlaku pada ${event.occurredAt.toISOString().slice(0, 10)}.`
        : `Tidak ada aturan posting untuk peristiwa "${event.eventCode}".`,
    });
    return { ok: false, lines: [], totalDebit: 0, totalCredit: 0, issues };
  }

  if (berlaku.length === 0) {
    issues.push({
      code: 'NO_RULE',
      detail: `Tidak ada aturan posting untuk peristiwa "${event.eventCode}".`,
    });
    return { ok: false, lines: [], totalDebit: 0, totalCredit: 0, issues };
  }

  const lines: JournalLine[] = [];

  for (const rule of [...berlaku].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const raw = event.amounts[rule.amountKey];

    if (raw === undefined || raw === null) {
      issues.push({
        code: 'AMOUNT_MISSING',
        detail: `Peristiwa tidak memuat nilai "${rule.amountKey}" yang diminta aturan ${rule.code}.`,
      });
      continue;
    }

    if (raw < 0) {
      // Nilai negatif tidak pernah sah. Pembalikan jurnal dilakukan dengan
      // menukar sisi debit dan kredit, bukan dengan nilai negatif — jurnal
      // bernilai negatif membuat laporan sulit dibaca dan mudah salah jumlah.
      issues.push({
        code: 'AMOUNT_NEGATIVE',
        detail: `Nilai "${rule.amountKey}" negatif (${raw}); pembalikan harus menukar sisi, bukan memakai nilai negatif.`,
      });
      continue;
    }

    const amount = Math.round(raw);
    if (amount === 0 && rule.skipWhenZero) continue;

    lines.push({
      accountId: rule.accountId,
      side: rule.side,
      amount,
      description: renderDescription(rule.descriptionTemplate, event),
      sortOrder: rule.sortOrder,
    });
  }

  if (lines.length === 0) {
    issues.push({
      code: 'NO_LINES',
      detail: 'Aturan tidak menghasilkan satu pun baris jurnal.',
    });
    return { ok: false, lines: [], totalDebit: 0, totalCredit: 0, issues };
  }

  const totalDebit = lines.filter((l) => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
  const totalCredit = lines.filter((l) => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);

  if (totalDebit !== totalCredit) {
    // Jurnal tidak seimbang tidak pernah disimpan. Menyimpannya berarti
    // neraca tidak akan pernah seimbang lagi, dan menemukan penyebabnya
    // kemudian jauh lebih mahal daripada menolaknya sekarang.
    issues.push({
      code: 'UNBALANCED',
      detail: `Debit ${totalDebit} tidak sama dengan kredit ${totalCredit}; selisih ${Math.abs(totalDebit - totalCredit)}.`,
    });
  }

  return {
    ok: issues.length === 0,
    lines,
    totalDebit,
    totalCredit,
    issues,
  };
}

/**
 * Mengisi keterangan baris.
 *
 * Hanya mengganti penanda yang dikenal. Tidak ada evaluasi ekspresi — templat
 * yang dapat mengevaluasi apa pun adalah rumus bebas dengan nama lain.
 */
function renderDescription(template: string | null, event: AccountingEvent): string {
  if (!template) return `${event.eventCode} ${event.sourceNumber ?? event.sourceId}`;

  return template
    .replace(/\{sourceNumber\}/g, event.sourceNumber ?? '')
    .replace(/\{sourceType\}/g, event.sourceType)
    .replace(/\{eventCode\}/g, event.eventCode)
    .trim();
}

/**
 * Kunci idempotensi peristiwa.
 *
 * Dibentuk dari kode peristiwa dan dokumen sumbernya. Peristiwa pembayaran
 * yang sampai dua kali menghasilkan kunci yang sama, dan batasan unik pada
 * basis data menolak yang kedua.
 */
export function eventIdempotencyKey(
  eventCode: string,
  sourceType: string,
  sourceId: string,
): string {
  return `${eventCode}:${sourceType}:${sourceId}`;
}

/**
 * Peristiwa marketplace yang dikenal.
 *
 * Daftar ini menentukan `event_code` yang boleh dipakai. Peristiwa di luar
 * daftar ditolak agar salah ketik tidak menghasilkan peristiwa yang tidak
 * pernah punya aturan dan diam-diam tidak pernah dijurnal.
 */
export const MARKETPLACE_EVENTS = [
  'MARKETPLACE_SALE_RECOGNIZED',
  'MARKETPLACE_PAYMENT_RECEIVED',
  'MARKETPLACE_PLATFORM_FEE_ACCRUED',
  'MARKETPLACE_PLATFORM_FEE_BILLED',
  'MARKETPLACE_SHIPPING_COST',
  'MARKETPLACE_PACKAGING_COST',
  'MARKETPLACE_DISCOUNT_SELLER',
  'MARKETPLACE_DISCOUNT_PLATFORM',
  'MARKETPLACE_RETURN_RECEIVED',
  'MARKETPLACE_REFUND',
  'MARKETPLACE_COGS',
  'MARKETPLACE_INVENTORY_RELEASE',
] as const;

export type MarketplaceEventCode = (typeof MARKETPLACE_EVENTS)[number];

export function isKnownEvent(code: string): code is MarketplaceEventCode {
  return (MARKETPLACE_EVENTS as readonly string[]).includes(code);
}

/**
 * Nilai yang dibawa setiap jenis peristiwa.
 *
 * Dipakai memeriksa kelengkapan sebelum peristiwa dicatat — peristiwa yang
 * kurang nilainya akan gagal saat dijurnal, dan lebih baik ditolak saat dibuat
 * ketika konteksnya masih ada.
 */
export const REQUIRED_AMOUNTS: Record<MarketplaceEventCode, string[]> = {
  MARKETPLACE_SALE_RECOGNIZED: ['netSales', 'tax', 'gross'],
  MARKETPLACE_PAYMENT_RECEIVED: ['amount'],
  MARKETPLACE_PLATFORM_FEE_ACCRUED: ['feeAmount'],
  MARKETPLACE_PLATFORM_FEE_BILLED: ['feeAmount'],
  MARKETPLACE_SHIPPING_COST: ['shippingCost'],
  MARKETPLACE_PACKAGING_COST: ['packagingCost'],
  MARKETPLACE_DISCOUNT_SELLER: ['discountAmount'],
  MARKETPLACE_DISCOUNT_PLATFORM: ['discountAmount'],
  MARKETPLACE_RETURN_RECEIVED: ['returnValue'],
  MARKETPLACE_REFUND: ['refundAmount'],
  MARKETPLACE_COGS: ['cogsAmount'],
  MARKETPLACE_INVENTORY_RELEASE: ['inventoryValue'],
};

export function checkRequiredAmounts(
  eventCode: string,
  amounts: Record<string, number>,
): { ok: boolean; missing: string[] } {
  if (!isKnownEvent(eventCode)) {
    return { ok: false, missing: [`(peristiwa "${eventCode}" tidak dikenal)`] };
  }
  const missing = REQUIRED_AMOUNTS[eventCode].filter(
    (key) => amounts[key] === undefined || amounts[key] === null,
  );
  return { ok: missing.length === 0, missing };
}
