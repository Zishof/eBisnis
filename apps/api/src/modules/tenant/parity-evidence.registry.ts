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
 */
export const PARITY_EVIDENCE: ParityProof[] = [];

/**
 * Layar yang dideklarasikan OPERATIONAL (wired) tetapi BELUM PROVEN.
 * Daftar ini WAJIB menyusut seiring waktu, tidak boleh bertambah.
 * Awal: seluruh 48 layar.
 */
export const PENDING_PROOF: number[] = Array.from({ length: 48 }, (_, i) => i + 1);

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
