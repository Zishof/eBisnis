# Perbaikan Self-Test Paritas (Temuan A.2) — Patch Siap-Terap

**Tanggal:** 2026-08-08
**Status:** PROPOSAL. Belum diterapkan ke source (menghindari bentrok dengan sesi implementasi aktif hari ini). Terapkan lalu jalankan test sebelum commit.

## 1. Masalah

`apps/api/src/modules/tenant/sales-inventory-parity.catalog.spec.ts` baris 42–47 meng-hardcode:

```ts
expect(summary.flutter.operational).toBe(48);
expect(summary.flutter.readOnly).toBe(0);
expect(summary.flutter.contractOnly).toBe(0);
expect(summary.web.operational).toBe(48);
expect(summary.web.readOnly).toBe(0);
expect(summary.web.contractOnly).toBe(0);
```

Efeknya terbalik dari nama test-nya ("without hiding gaps"): jika seorang engineer **jujur** menurunkan satu layar ke `READ_ONLY`/`CONTRACT_ONLY` karena belum tuntas, test ini **gagal**. Jadi test memaksa katalog selalu meng-klaim 48/48 OPERATIONAL, dan tidak pernah memverifikasi bahwa tiap endpoint benar-benar bekerja end-to-end. Ini bertentangan dengan prinsip paket: *"daftar/teks fitur saja bukan bukti."*

## 2. Prinsip perbaikan

Pisahkan dua konsep yang saat ini tercampur:

- **Coverage (`OPERATIONAL`/`READ_ONLY`/`CONTRACT_ONLY`)** = tingkat *wiring* permukaan. Tetap dipakai apa adanya.
- **PROVEN** = bukti nyata (integration/e2e/UAT + print + reconciliation). Konsep baru, dilacak terpisah lewat *evidence registry*.

Registry dimulai dengan seluruh 48 layar berstatus `PENDING_PROOF`. Daftar itu **hanya boleh menyusut** saat bukti nyata masuk. CI tetap hijau, tetapi kebohongan struktural hilang dan gap menjadi terlihat & terukur.

## 3. File baru: `apps/api/src/modules/tenant/parity-evidence.registry.ts`

```ts
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
```

## 4. Ganti blok baris 37–48 pada `sales-inventory-parity.catalog.spec.ts`

Tambah import di atas:

```ts
import { PARITY_EVIDENCE, PENDING_PROOF, provenScreens } from './parity-evidence.registry';
```

Ganti `it('reports surface totals without hiding read-only or contract-only gaps', ...)` menjadi:

```ts
it('totals konsisten tanpa mengunci klaim 48/48', () => {
  const summary = paritySummary();
  expect(summary.screens).toBe(48);
  expect(summary.web.operational + summary.web.readOnly + summary.web.contractOnly).toBe(48);
  expect(summary.flutter.operational + summary.flutter.readOnly + summary.flutter.contractOnly).toBe(48);
  // Sengaja TIDAK ada expect(...operational).toBe(48) / .toBe(0).
});

it('setiap layar OPERATIONAL harus PROVEN atau tercatat PENDING_PROOF', () => {
  const proven = provenScreens();
  const pending = new Set(PENDING_PROOF);
  for (const scr of proven) {
    expect(pending.has(scr)).toBe(false); // PROVEN & PENDING tak boleh tumpang tindih
  }
  for (const item of SALES_INVENTORY_PARITY) {
    const claimsOperational = item.web === 'OPERATIONAL' || item.flutter === 'OPERATIONAL';
    if (claimsOperational) {
      expect(proven.has(item.screen) || pending.has(item.screen)).toBe(true);
    }
  }
});

it('PENDING_PROOF hanya boleh menyusut (regression guard)', () => {
  // Turunkan ambang ini saat evidence bertambah. MENAIKKAN dilarang di review.
  expect(PENDING_PROOF.length).toBeLessThanOrEqual(48);
});
```

Test lain (panjang 48, urutan, API evidence, route eksplisit, stock scoped, SQL profit-loss/gross-profit, account_type) **tetap** — jangan diubah.

## 5. Cara menerapkan & memverifikasi (lokal)

```powershell
cd C:\opt\eBisnis-Github\eBisnis
# 1. buat file parity-evidence.registry.ts (bagian 3)
# 2. edit catalog.spec.ts (bagian 4)
pnpm --filter @ebisnis/api test -- sales-inventory-parity   # sesuaikan nama script/paket aktual
```
Harapan: seluruh test hijau (48 layar masih PENDING_PROOF → CI tetap lulus), tetapi lock 48/48 sudah hilang.

## 6. Dampak

Setelah ini, menaikkan sebuah layar ke PROVEN menuntut menambah entri `ParityProof` ber-referensi nyata dan mengeluarkannya dari `PENDING_PROOF`. Klaim DONE tak bisa lagi lolos hanya karena katalog terisi. Ini prasyarat integritas untuk seluruh pekerjaan menuju paritas 100%.
