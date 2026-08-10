import { SALES_INVENTORY_PARITY } from './sales-inventory-parity.catalog';

export type ProofSurface = 'api' | 'web' | 'windows' | 'android';
export type ProofCapability =
  | 'view'
  | 'create'
  | 'update'
  | 'post'
  | 'reverse'
  | 'print'
  | 'export'
  | 'offline'
  | 'reconciliation'
  | 'hardware';
export type ProofKind = 'unit' | 'integration' | 'e2e' | 'golden' | 'uat';
export type ProofStatus =
  | 'NOT_STARTED'
  | 'SOURCE_IMPLEMENTED'
  | 'AUTOMATED_PROVEN'
  | 'DEVICE_UAT_PROVEN'
  | 'PRODUCTION_VERIFIED'
  | 'BLOCKED'
  | 'NOT_REQUIRED';

export interface ParityProof {
  screen: number;
  surface: ProofSurface;
  capability: ProofCapability;
  kind: ProofKind;
  status: ProofStatus;
  /** Path test, id UAT, atau commit SHA yang membuktikan operasi nyata. */
  reference: string;
  /** Wajib bila status BLOCKED atau NOT_REQUIRED. */
  reason?: string;
}

export interface ParityRequirement {
  screen: number;
  surface: ProofSurface;
  capability: ProofCapability;
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
const API_UAT_EVIDENCE = [
  { screen: 45, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-45/uat.md' },
  { screen: 46, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-46/uat.md' },
  { screen: 47, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-47/uat.md' },
  { screen: 48, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-48/uat.md' },
  /*
   * Layar 30 (invoice atomicity + state guard), 34 (AR receipt idempotency),
   * dan 24 (AP payment allocation cap + reversal) naik ke PROVEN 2026-08-09,
   * prioritas tertinggi domain Purchase/AP & Sales/AR per
   * 05-template-bukti-proven-purchase-ap-sales-ar.md. Dua gap nyata
   * ditemukan lewat pass ini: invoiceSalesOrder tidak memeriksa kecukupan stok
   * (screen-30/uat.md) dan aksi AP_PAYMENT/AR_RECEIPT tidak tercatat di jejak
   * audit (screen-24/uat.md). Keduanya SUDAH DIPERBAIKI kemudian -- komentar
   * ini pernah tertinggal menulis "dilaporkan, bukan diperbaiki" lama sesudah
   * keduanya ditutup, dan catatan basi di tempat seperti ini menyesatkan orang
   * berikutnya persis ketika ia sedang mencari apa yang masih terbuka.
   */
  { screen: 24, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-24/uat.md' },
  { screen: 30, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-30/uat.md' },
  { screen: 34, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-34/uat.md' },
  /*
   * Layar 1-7 (Master) dan 31-42 (sisa Sales/AR) naik ke PROVEN 2026-08-09,
   * dikerjakan agen latar belakang paralel terhadap PostgreSQL lokal yang
   * sama. Master: CRUD/guard/audit/masking bank dibuktikan; filter saldo
   * open/settled dikonfirmasi client-side saja (bukan gagal, memang begitu
   * arsitekturnya -- dicatat di uat.md masing-masing, bukan disembunyikan).
   * Salesperson aktif/tidak aktif dibuktikan DITEGAKKAN pada mobile order --
   * membalik temuan sesi audit sebelumnya (09-master-stock-pricing-findings.md)
   * yang menyimpulkan sebaliknya tanpa mencobanya langsung. Dua gap baru
   * ditemukan pass ini, KEDUANYA SUDAH DIPERBAIKI menyusul (2026-08-10):
   * purge salesperson tidak memeriksa referensi tak-langsung (sudah
   * menghapus satu salesperson uji yang punya riwayat transaksi hidup) --
   * diperbaiki lewat `viaColumn`/`resolveReferenceMatchValue` pada
   * `master-lifecycle.service.ts` (lihat screen-07/uat.md §5; verifikasi HTTP
   * live ulang belum dilakukan karena profil uji lama sudah terlanjur
   * terhapus permanen oleh gap tsb); dan endpoint audit-trail melewati
   * penyamaran data bank -- diperbaiki lewat `maskAuditRows()` pada berkas
   * yang sama, diuji unit (`master-lifecycle.spec.ts`). Sales/AR 31-42:
   * rantai stok->jual->faktur->piutang
   * hidup dibuktikan penuh, termasuk custody nota (39/40) yang sebelumnya
   * sama sekali belum diuji. Tiga bug nyata ditemukan DAN DIPERBAIKI:
   * netting titipan nota terhadap pelunasan langsung, dua endpoint custody
   * yang 500 di setiap panggilan (inferensi tipe parameter Postgres), plus
   * dua bug tambahan ditemukan di sepanjang jalan: arah stock_movement salah
   * untuk ADJUSTMENT_OUT pada posting opname (memakai nilai varians yang
   * sudah di-abs() untuk menentukan arah -- cabang source tidak pernah
   * terpilih), dan reportSql mengirim parameter ke laporan yang tidak
   * memakainya sama sekali. Lihat docs/pos-inventory-parity/evidence/
   * screen-{01..07,31..42}/uat.md untuk rincian penuh per layar.
   */
  { screen: 1, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-01/uat.md' },
  { screen: 2, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-02/uat.md' },
  { screen: 3, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-03/uat.md' },
  { screen: 4, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-04/uat.md' },
  { screen: 5, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-05/uat.md' },
  { screen: 6, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-06/uat.md' },
  { screen: 7, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-07/uat.md' },
  { screen: 31, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-31/uat.md' },
  { screen: 32, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-32/uat.md' },
  { screen: 33, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-33/uat.md' },
  { screen: 35, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-35/uat.md' },
  { screen: 36, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-36/uat.md' },
  { screen: 37, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-37/uat.md' },
  { screen: 38, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-38/uat.md' },
  { screen: 39, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-39/uat.md' },
  { screen: 40, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-40/uat.md' },
  { screen: 41, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-41/uat.md' },
  { screen: 42, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-42/uat.md' },
  /*
   * Layar 8-19 (Stock/Harga) dan 20-23,25-29 (sisa Purchase/AP) naik ke
   * PROVEN 2026-08-09, agen latar belakang paralel terhadap PostgreSQL
   * lokal yang sama (bersamaan dengan Master dan sisa Sales/AR di atas).
   *
   * Stock/Harga: 4 bug Postgres param-binding nyata ditemukan DAN
   * DIPERBAIKI -- dua di antaranya (arah stock_movement pada posting
   * opname, dan buildReport() mengirim parameter ke laporan yang tidak
   * memakainya) ditemukan SECARA INDEPENDEN oleh agen Sales/AR juga,
   * konvergen pada perbaikan yang sama persis (dikonfirmasi lewat tinjauan
   * diff akhir -- bukan penulisan ganda yang bentrok). Didokumentasikan
   * tidak diperbaiki saat itu, KEMUDIAN DIPERBAIKI SEBAGIAN (2026-08-10):
   * stock_balance.average_cost tidak pernah ditulis jalur transaksi hidup
   * manapun (hanya impor CLI/seed demo), membuat nilai stok pada layar
   * 14/15 DAN HPP penjualan POS (dijurnal sebagai COGS) selalu nol --
   * ditambahkan rumus moving-average-cost ke `applyBalanceDelta()`
   * (`tenant-bootstrap.service.ts`), opt-in lewat parameter `inboundCost`
   * baru, diwire HANYA ke titik goods-receipt-diterima (satu-satunya titik
   * dari 13 pemanggil yang punya data biaya nyata siap pakai tanpa
   * plumbing baru). Transfer antar-gudang, un-blending saat reversal GR,
   * dan retur/void POS masih belum ikut menghitung ulang rata-rata --
   * tetap terlalu lintas-modul untuk pass ini, lihat screen-08/uat.md.
   *
   * Purchase/AP 20-23,25-29: rantai PO->GR->AP hidup dibuktikan penuh
   * termasuk idempotency PO create. Satu bug DIPERBAIKI: `PURCHASE_ORDER.READ`
   * (kode permission yang tidak pernah ada di katalog manapun, sama seperti
   * gap SALES_ORDER.INVOICE yang ditemukan pass sebelumnya) mengunci
   * `/inventory/legacy/payables` dan `/inventory/supplier-workspace` untuk
   * SEMUA peran termasuk Pemilik Usaha -- diganti `PURCHASING.READ`. Dua gap
   * DILAPORKAN, KEMUDIAN KEDUANYA DIPERBAIKI (2026-08-10): goods-receipt
   * reversal tidak membalik legacy_payable_ledger (payable jadi piutang
   * hantu setelah barang diretur ke supplier) -- diperbaiki lewat
   * `reverseGoodsReceiptValidation()` (`erp-purchasing.service.ts`): blokir
   * HTTP 409 `PAYABLE_ALREADY_PAID` bila sudah ada pembayaran POSTED
   * teralokasi, jika belum maka payable disetel `is_settled=TRUE` +
   * dicatat metadata reversal (lihat screen-20/uat.md); dan agingReport()
   * memakai nilai kotor bukan neto -- agingReport() dan query
   * 'ar-aging-sales' sekarang menetokan terhadap alokasi pembayaran/
   * penerimaan yang sudah POSTED, mengikuti pola yang sama dengan
   * /inventory/legacy/payables|receivables. Gap terpisah juga DIPERBAIKI
   * di domain Stock/Harga (layar 08, lihat blok komentar di atas):
   * `stock_balance.average_cost` tidak pernah ditulis.
   *
   * Lihat docs/pos-inventory-parity/evidence/screen-{08..23,25..29}/uat.md.
   */
  { screen: 8, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-08/uat.md' },
  { screen: 9, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-09/uat.md' },
  { screen: 10, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-10/uat.md' },
  { screen: 11, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-11/uat.md' },
  { screen: 12, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-12/uat.md' },
  { screen: 13, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-13/uat.md' },
  { screen: 14, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-14/uat.md' },
  { screen: 15, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-15/uat.md' },
  { screen: 16, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-16/uat.md' },
  { screen: 17, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-17/uat.md' },
  { screen: 18, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-18/uat.md' },
  { screen: 19, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-19/uat.md' },
  { screen: 20, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-20/uat.md' },
  { screen: 21, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-21/uat.md' },
  { screen: 22, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-22/uat.md' },
  { screen: 23, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-23/uat.md' },
  { screen: 25, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-25/uat.md' },
  { screen: 26, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-26/uat.md' },
  { screen: 27, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-27/uat.md' },
  { screen: 28, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-28/uat.md' },
  { screen: 29, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-29/uat.md' },
  // Kas/jurnal dan chart of accounts dibuktikan pada tenant PostgreSQL lokal
  // khusus UAT: create COA -> create jurnal seimbang -> post -> reverse -> read-back.
  { screen: 43, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-43/uat.md' },
  { screen: 44, surface: 'api', kind: 'uat', reference: 'docs/pos-inventory-parity/evidence/screen-44/uat.md' },
] as const;

const WEB_ROUTE_EVIDENCE: ParityProof[] = Array.from(
  { length: 48 },
  (_, index): ParityProof => ({
    screen: index + 1,
    surface: 'web',
    capability: 'view',
    kind: 'e2e',
    status: 'AUTOMATED_PROVEN',
    reference:
      'docs/implementation/inventory-sales-48/evidence/uat/2026-08-10-surface-release-readiness.md',
  }),
);

const WINDOWS_NAVIGATION_EVIDENCE: ParityProof[] = Array.from(
  { length: 48 },
  (_, index): ParityProof => ({
    screen: index + 1,
    surface: 'windows',
    capability: 'view',
    kind: 'uat',
    status: 'AUTOMATED_PROVEN',
    reference:
      'docs/implementation/inventory-sales-48/evidence/uat/2026-08-10-surface-release-readiness.md',
  }),
);

const ANDROID_NAVIGATION_EVIDENCE: ParityProof[] = Array.from(
  { length: 48 },
  (_, index): ParityProof => ({
    screen: index + 1,
    surface: 'android',
    capability: 'view',
    kind: 'integration',
    status: 'AUTOMATED_PROVEN',
    reference:
      'docs/implementation/inventory-sales-48/evidence/uat/2026-08-10-surface-release-readiness.md',
  }),
);

/**
 * Evidence API lama dinormalisasi secara eksplisit sebagai bukti capability
 * `view` pada surface API. Dokumen UAT-nya dapat berisi capability lain, tetapi
 * registry tidak menaikkan capability itu sebelum setiap klaim dimigrasikan
 * dan diperiksa satu per satu.
 */
export const PARITY_EVIDENCE: ParityProof[] = [
  ...API_UAT_EVIDENCE.map((proof): ParityProof => ({
    ...proof,
    capability: 'view',
    status: 'AUTOMATED_PROVEN',
  })),
  ...WEB_ROUTE_EVIDENCE,
  ...WINDOWS_NAVIGATION_EVIDENCE,
  ...ANDROID_NAVIGATION_EVIDENCE,
  {
    screen: 30,
    surface: 'web',
    capability: 'create',
    kind: 'unit',
    status: 'SOURCE_IMPLEMENTED',
    reference: 'apps/web/src/pages/app/inventory-transaction-draft.test.ts',
  },
  {
    screen: 30,
    surface: 'web',
    capability: 'offline',
    kind: 'unit',
    status: 'SOURCE_IMPLEMENTED',
    reference: 'apps/web/src/pages/app/inventory-transaction-draft.test.ts',
  },
];

export const PROOF_SURFACES: ProofSurface[] = ['api', 'web', 'windows', 'android'];

/**
 * Kontrak minimum P0: setiap layar harus memiliki bukti terpisah pada setiap
 * surface. Capability tambahan (print/export/offline/hardware dan operasi
 * mutasi) ditambahkan per vertical slice; tidak boleh disimpulkan dari `view`.
 */
export const PARITY_REQUIREMENTS: ParityRequirement[] = [
  ...Array.from({ length: 48 }, (_, index) => index + 1).flatMap<ParityRequirement>(
    (screen) => [
      ...PROOF_SURFACES.map((surface): ParityRequirement => ({
        screen,
        surface,
        capability: 'view',
      })),
      { screen, surface: 'api', capability: 'reconciliation' },
    ],
  ),
  { screen: 30, surface: 'web', capability: 'create' },
  { screen: 30, surface: 'web', capability: 'offline' },
];

const PROVEN_STATUSES = new Set<ProofStatus>([
  'AUTOMATED_PROVEN',
  'DEVICE_UAT_PROVEN',
  'PRODUCTION_VERIFIED',
  'NOT_REQUIRED',
]);

export function hasProof(requirement: ParityRequirement): boolean {
  return PARITY_EVIDENCE.some(
    (proof) =>
      proof.screen === requirement.screen &&
      proof.surface === requirement.surface &&
      proof.capability === requirement.capability &&
      PROVEN_STATUSES.has(proof.status),
  );
}

/**
 * Layar yang dideklarasikan OPERATIONAL (wired) tetapi BELUM PROVEN.
 * Daftar ini WAJIB menyusut seiring waktu, tidak boleh bertambah. Diturunkan
 * langsung dari PARITY_EVIDENCE (bukan daftar terpisah yang bisa lupa
 * disinkronkan) -- awalnya seluruh 48 layar, menyusut otomatis begitu sebuah
 * layar mendapat entri bukti di atas.
 */
export const PENDING_PROOF: ParityRequirement[] = PARITY_REQUIREMENTS.filter(
  (requirement) => !hasProof(requirement),
);

export function provenScreens(surface?: ProofSurface, capability?: ProofCapability): Set<number> {
  return new Set(
    Array.from({ length: 48 }, (_, index) => index + 1).filter((screen) => {
      const requirements = PARITY_REQUIREMENTS.filter(
        (requirement) =>
          requirement.screen === screen &&
          (!surface || requirement.surface === surface) &&
          (!capability || requirement.capability === capability),
      );
      return requirements.length > 0 && requirements.every(hasProof);
    }),
  );
}

export function ensureCatalogWired(): void {
  // Setiap layar OPERATIONAL harus tercatat sebagai PROVEN atau PENDING_PROOF.
  const proven = provenScreens();
  const pending = new Set(PENDING_PROOF.map((requirement) => requirement.screen));
  for (const item of SALES_INVENTORY_PARITY) {
    const claimsOperational =
      item.web === 'OPERATIONAL' ||
      item.windows === 'OPERATIONAL' ||
      item.android === 'OPERATIONAL';
    if (claimsOperational && !proven.has(item.screen) && !pending.has(item.screen)) {
      throw new Error(`Layar ${item.screen} klaim OPERATIONAL tanpa bukti/PENDING_PROOF`);
    }
  }
}
