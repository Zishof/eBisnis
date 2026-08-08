import { SALES_INVENTORY_PARITY } from './sales-inventory-parity.catalog';

export type ProofKind = 'unit' | 'integration' | 'e2e' | 'uat';

export interface ParityProof {
  screen: number;
  surface: 'web' | 'flutter' | 'api';
  kind: ProofKind;
  /** Path test, id UAT, atau commit SHA yang membuktikan operasi nyata. */
  reference: string;
}

/**
 * Bukti PROVEN. KOSONG di awal. Tambah entri hanya bila bukti benar-benar ada
 * (mis. test e2e hijau, hasil UAT ber-evidence). Jangan mengisi tanpa bukti.
 *
 * Layar 45-48 (FINANCE) naik ke PROVEN 2026-08-09 lewat UAT nyata terhadap
 * PostgreSQL lokal (bukan mock): sales order -> invoice -> event akuntansi
 * -> AccountingPostingService -> journal_entry sungguhan, direkonsiliasi
 * SQL independen (selisih 0), plus uji immutability snapshot yang sungguh
 * memverifikasi angka tidak berubah setelah data sumber berubah. Lihat
 * docs/pos-inventory-parity/evidence/screen-45..48/uat.md.
 */
export const PARITY_EVIDENCE: ParityProof[] = [
  { screen: 45, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-45/uat.md' },
  { screen: 46, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-46/uat.md' },
  { screen: 47, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-47/uat.md' },
  { screen: 48, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-48/uat.md' },
  /*
   * Layar 30 (invoice atomicity + state guard), 34 (AR receipt idempotency),
   * dan 24 (AP payment allocation cap + reversal) naik ke PROVEN 2026-08-09,
   * prioritas tertinggi domain Purchase/AP & Sales/AR per
   * 05-template-bukti-proven-purchase-ap-sales-ar.md. Dua gap nyata
   * ditemukan dan DILAPORKAN (bukan diperbaiki diam-diam) lewat pass ini:
   * invoiceSalesOrder tidak memeriksa kecukupan stok (lihat screen-30/uat.md),
   * dan aksi AP_PAYMENT/AR_RECEIPT sama sekali tidak tercatat di jejak audit
   * (lihat screen-24/uat.md).
   */
  { screen: 24, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-24/uat.md' },
  { screen: 30, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-30/uat.md' },
  { screen: 34, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-34/uat.md' },
];

/**
 * Layar yang dideklarasikan OPERATIONAL (wired) tetapi BELUM PROVEN.
 * Daftar ini WAJIB menyusut seiring waktu, tidak boleh bertambah.
 * Awal: seluruh 48 layar; 45-48 dikeluarkan 2026-08-09, lalu 24/30/34
 * (lihat PARITY_EVIDENCE).
 */
export const PENDING_PROOF: number[] = Array.from({ length: 48 }, (_, i) => i + 1).filter(
  (screen) => ![45, 46, 47, 48, 24, 30, 34].includes(screen),
);

export function provenScreens(): Set<number> {
  return new Set(PARITY_EVIDENCE.map((p) => p.screen));
}

export function ensureCatalogWired(): void {
  // Setiap layar OPERATIONAL harus tercatat sebagai PROVEN atau PENDING_PROOF.
  const proven = provenScreens();
  const pending = new Set(PENDING_PROOF);
  for (const item of SALES_INVENTORY_PARITY) {
    const claimsOperational = item.web === 'OPERATIONAL' || item.flutter === 'OPERATIONAL';
    if (claimsOperational && !proven.has(item.screen) && !pending.has(item.screen)) {
      throw new Error(`Layar ${item.screen} klaim OPERATIONAL tanpa bukti/PENDING_PROOF`);
    }
  }
}
