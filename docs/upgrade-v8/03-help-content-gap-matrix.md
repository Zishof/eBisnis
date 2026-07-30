# 03 — Matriks Gap Konten Help

Status per blueprint: `HELP_COMPLETE`, `HELP_PARTIAL`, `HELP_MISSING`,
`NOT_APPLICABLE`, `BLOCKED`.

## Hasil ringkas

**Seluruh halaman berstatus `HELP_MISSING`.** Tidak ada satu pun bantuan
kontekstual pada source: pencarian `Help`, `helpTopic`, `HelpDrawer`,
`guidedTour`, `driver.js`, dan `shepherd` pada `apps/api/src` dan
`apps/web/src` menghasilkan **nol** berkas.

| Status | Jumlah halaman |
| --- | ---: |
| HELP_COMPLETE | 0 |
| HELP_PARTIAL | 0 |
| **HELP_MISSING** | **51** |
| NOT_APPLICABLE | 4 (route redirect dan halaman error) |

## Rincian per halaman

Diambil dari 55 route pada `apps/web/src/app/App.tsx`.

### Website publik — 10 halaman

| Route | Berkas | Status | Kebutuhan help |
| --- | --- | --- | --- |
| `/` | `pages/public/HomePage.tsx` | HELP_MISSING | rendah — halaman pemasaran |
| `/harga` | `pages/public/PricingPage.tsx` | HELP_MISSING | sedang — penjelasan skema harga |
| `/berita`, `/berita/:slug` | `NewsListPage`, `NewsDetailPage` | NOT_APPLICABLE | konten CMS |
| `/kontak` | `ContactPage.tsx` | HELP_MISSING | rendah |
| `/tentang`, `/syarat`, `/privasi` | `CmsPage.tsx` | NOT_APPLICABLE | konten CMS |
| `/masuk` | `auth/LoginPage.tsx` | HELP_MISSING | tinggi — masalah masuk paling sering ditanyakan |
| `/daftar` | `auth/RegisterPage.tsx` | **HELP_MISSING kritis** | tinggi — aturan username permanen wajib dijelaskan sebelum dikirim |
| `/demo` | `auth/DemoEntryPage.tsx` | HELP_MISSING | sedang |
| `/ganti-kata-sandi` | `auth/ChangePasswordPage.tsx` | HELP_MISSING | sedang — ketentuan kata sandi |

### Portal tenant — 30 halaman

| Kelompok | Halaman | Status | Prioritas help |
| --- | --- | --- | --- |
| Dashboard | `DashboardPage` | HELP_MISSING | sedang |
| Master (23 resource) | `MasterListPage` generik | HELP_MISSING | **tinggi** — satu halaman melayani 23 resource, masing-masing perlu field dictionary sendiri |
| Request Order | `RequestOrderPage` | HELP_MISSING | tinggi |
| Purchase Order | `PurchaseOrderPage` | HELP_MISSING | tinggi |
| **Penerimaan Barang** | `GoodsReceiptPage` | **HELP_MISSING — pilot V8-8** | **tertinggi** |
| Backorder | `BackorderPage` | HELP_MISSING | tinggi |
| Internal Transfer | `InternalTransferPage` | HELP_MISSING | tinggi |
| Stock Tree | `StockTreePage` | HELP_MISSING | sedang |
| Data Contoh | `SampleDataPage` | HELP_MISSING | tinggi — tindakan hapus/pulihkan berisiko |
| Langganan | `SubscriptionPage` | HELP_MISSING | tinggi — menyangkut biaya |
| Coming Soon | `ComingSoonPage` | NOT_APPLICABLE | — |

### Portal platform — 6 halaman

| Halaman | Status | Prioritas |
| --- | --- | --- |
| `PlatformDashboardPage` | HELP_MISSING | sedang |
| `PlatformTenantsPage` | HELP_MISSING | tinggi |
| `PlatformPackagesPage` | HELP_MISSING | tinggi — harga dan paket |
| `PlatformCmsPage` | HELP_MISSING | sedang |
| `PlatformAuditPage` | HELP_MISSING | sedang |

## Konsekuensi bagi rencana

Karena tidak ada apa pun yang dapat dipakai ulang, Help Center dibangun dari
nol. Namun beberapa fondasi memperpendek jalannya:

| Fondasi existing | Dipakai untuk |
| --- | --- |
| 35 model CMS platform | pola versioning, translation, dan publication sudah terbukti; strukturnya dicontoh, bukan disalin |
| `file_object` + `entity_attachment` | media dan diagram help |
| `i18n` 4 bahasa termasuk RTL | `HelpTopicTranslation` |
| Audit append-only | mencatat penerbitan dan perubahan help |
| `MasterListPage` generik | satu titik pemasangan `PageHelpButton` yang langsung melayani 23 resource |

Poin terakhir penting: karena 23 resource master dilayani **satu komponen**,
memasang tombol bantuan di sana memberi cakupan 23 halaman sekaligus. Yang
berbeda per resource hanyalah `helpTopicCode`, yang datang dari registry.

## Urutan pengisian konten

1. **Penerimaan Barang** — pilot lengkap sesuai blueprint bagian 11.
2. Halaman dengan risiko tertinggi bila salah: Data Contoh, Langganan, Daftar.
3. Alur pembelian: Request Order, PO, Backorder, Internal Transfer.
4. 23 resource master, memakai field dictionary dari kamus data yang sudah ada.
5. Portal platform.
6. Website publik.

Kamus data pada `docs/database/full-data-dictionary.md` sudah memuat deskripsi
kolom untuk 258 tabel. Itu bahan mentah `HelpFieldDictionary`, sehingga field
dictionary tidak perlu ditulis dari nol.
