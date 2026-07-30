# 05 — Inventaris Route UI

> Fase V6-0. Sumber: `apps/web/src/app/App.tsx` (deklarasi React Router) dibandingkan
> terhadap `demo.menu` pada database (menu tree hasil seed).

## Ringkasan

| Metrik | Jumlah | Sumber |
| --- | --- | --- |
| Route React dideklarasikan | 51 | `apps/web/src/app/App.tsx:54-134` |
| Node menu tenant (aktif) | 73 | `demo.menu` |
| Node menu punya `route` | 54 | `demo.menu.route IS NOT NULL` |
| Node menu ditandai `is_coming_soon` | 26 | `demo.menu.is_coming_soon` |
| Route menu tanpa komponen khusus | 18 | jatuh ke `ComingSoonPage` |
| Halaman React (`.tsx`) | 28 | `apps/web/src/pages/**` |
| Komponen + layout + context | 18 | `apps/web/src/{components,app,lib,i18n}` |

## Route publik (tanpa autentikasi)

| Path | Komponen | Sumber |
| --- | --- | --- |
| `/` | `HomePage` | `App.tsx:55` |
| `/harga` | `PricingPage` | `App.tsx:56` |
| `/berita` | `NewsListPage` | `App.tsx:57` |
| `/berita/:slug` | `NewsDetailPage` | `App.tsx:58` |
| `/kontak` | `ContactPage` | `App.tsx:59` |
| `/tentang` | `CmsPage slug="tentang"` | `App.tsx:60` |
| `/syarat` | `CmsPage slug="syarat"` | `App.tsx:61` |
| `/privasi` | `CmsPage slug="privasi"` | `App.tsx:62` |
| `/masuk` | `LoginPage` | `App.tsx:63` |
| `/daftar` | `RegisterPage` | `App.tsx:64` |
| `/daftar/berhasil` | `RegisterSuccessPage` | `App.tsx:65` |
| `/demo` | `DemoEntryPage` | `App.tsx:66` |
| `/ganti-kata-sandi` | `ChangePasswordPage` | `App.tsx:67` |

Route `/` menampilkan website publik, bukan redirect ke login — sesuai prioritas V5 nomor 7.
Diverifikasi Playwright `e2e/public-website.spec.ts:8`.

## Route portal tenant (`/app`, memerlukan sesi)

| Path | Komponen | Catatan |
| --- | --- | --- |
| `/app` | `DashboardPage` | index route |
| `/app/products` … `/app/roles` | `MasterListPage resource=...` | 23 resource master memakai satu komponen generik |
| `/app/request-orders` | `RequestOrderPage` | di atas `DocumentListPage` |
| `/app/purchase-orders` | `PurchaseOrderPage` | di atas `DocumentListPage` |
| `/app/goods-receipts` | `GoodsReceiptPage` | di atas `DocumentListPage` |
| `/app/backorders` | `BackorderPage` | di atas `DocumentListPage` |
| `/app/internal-transfers` | `InternalTransferPage` | di atas `DocumentListPage` |
| `/app/stock-tree` | `StockTreePage` | tree Wilayah → Gudang |
| `/app/sample-data` | `SampleDataPage` | verify/repair/cleanup/restore |
| `/app/devices` | `SubscriptionPage tab="devices"` | |
| `/app/subscription/checkout` | `SubscriptionPage tab="checkout"` | |
| `/app/subscription/invoices` | `SubscriptionPage tab="invoices"` | |
| `/app/*` | `ComingSoonPage` | catch-all; tidak ada rute mati |

## Route portal platform (`/platform`, memerlukan platform staff)

| Path | Komponen |
| --- | --- |
| `/platform` | `PlatformDashboardPage` |
| `/platform/tenants` | `PlatformTenantsPage` |
| `/platform/registrations` | `PlatformTenantsPage tab="registrations"` |
| `/platform/packages` | `PlatformPackagesPage` |
| `/platform/cms` | `PlatformCmsPage` |
| `/platform/audit` | `PlatformAuditPage` |

Portal platform belum pernah dibuka melalui UI karena akun `admin` masih berstatus
wajib ganti kata sandi. Alur paksa-ganti-sandi sendiri sudah diuji
(`scripts/smoke-test.mjs` bagian 19).

## Menu yang punya route tetapi belum punya halaman khusus

Ke-18 route berikut ada pada menu tree dan hak aksesnya sudah dapat diatur, tetapi
komponennya belum dibuat sehingga jatuh ke `ComingSoonPage`. Ini status **PARTIAL**,
bukan rute mati.

```text
/app/approvals          /app/pos                /app/sales/orders
/app/boms               /app/pos/shifts         /app/sales/reports
/app/carriers           /app/pos/terminals      /app/settings
/app/employees          /app/price-books        /app/stock-alerts
/app/journal-entries    /app/role-permissions   /app/stock-counts
/app/notifications      /app/stock-movements    /app/users
```

## Route UI yang BELUM ada dan dibutuhkan Versi 6

| Area | Route UI target | Fase |
| --- | --- | --- |
| Referral (tenant) | `/app/referral/dashboard`, `/link`, `/pendaftar`, `/komisi`, `/statement`, `/pembayaran`, `/sengketa` | V6-1 |
| Referral (platform) | `/platform/referral/partners`, `/plans`, `/runs`, `/payouts`, `/fraud`, `/reconciliation` | V6-1 |
| Investor | `/app/investor/ownership-groups`, `/investors`, `/ownership-classes`, `/ownership`, `/capital-account`, `/transfers`, `/voting`, `/contracts`, `/settlements`, `/statements` | V6-2 |
| Investor portal | `/investor-portal/*` | V6-2 |
| Tenant website | `/app/settings/website`, `/app/settings/domains`, `/app/website/pages`, `/navigation`, `/catalog`, `/news`, `/seo`, `/analytics` | V6-3 |
| Workflow | `/app/workflow/definitions`, `/policies`, `/submissions/new`, `/tasks/my`, `/instances/:id` | V6-4 |
| Purchase Requisition | `/app/purchase-requisitions` (direct) + `/app/workflow/submissions/new?type=PR` | V6-4 |
| Accounting | `/app/accounting/books`, `/ledgers`, `/journals`, `/close`, `/reconciliation`, `/reports` | V6-5, V6-6 |

## Catatan design system

Komponen reusable yang sudah ada dan **wajib dipakai ulang** oleh UI V6, bukan dibuat ulang:

| Komponen | Path | Kegunaan V6 |
| --- | --- | --- |
| `DataGrid` | `src/components/ui.tsx:299` | tabel + fallback kartu pada layar kecil |
| `DocumentListPage` | `src/pages/app/DocumentListPage.tsx:33` | dokumen header-line dengan aksi per status |
| `MasterListPage` | `src/pages/app/MasterListPage.tsx:45` | CRUD master generik + lifecycle |
| `ConfirmDialog` | `src/components/ui.tsx:168` | konfirmasi dengan alasan wajib |
| `StepUpDialog` | `src/components/ui.tsx:243` | verifikasi ulang kata sandi |
| `StatusBadge` | `src/components/ui.tsx:68` | badge status dengan inferensi tone |
| `PageHeader` | `src/components/ui.tsx:318` | judul + breadcrumb + aksi |
| `useCmsText` | `src/pages/public/HomePage.tsx:516` | teks CMS menang atas katalog terjemahan |
