# Katalog MasterSeedRegistry

> Berkas ini dihasilkan otomatis oleh `pnpm docs:generate` dari hasil introspeksi
> PostgreSQL. Jangan diedit manual — perubahan akan hilang pada generate berikutnya.

- Dihasilkan: `2026-07-30T10:47:45.433Z`
- Schema control plane: `platform`, `platform__audit`
- Schema tenant contoh: `demo`, `demo__audit`

Registry menetapkan minimum record per master relevan. `pnpm seed:verify` memakai daftar ini sebagai sumber tunggal kebenaran dan gagal bila ada master di bawah minimum.

## Seed tenant

| Urutan | Resource | Tabel | Minimum | Record terdefinisi | Tabel di database | Strategi | Cleanup contoh | Kebijakan purge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | `NUMBER_SEQUENCE` | `number_sequence` | 10 | 12 | ada | UPSERT_BY_CODE | tidak | NEVER_PURGE |
| 10 | `OUTLET_TYPE` | `outlet_type` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 11 | `WAREHOUSE_TYPE` | `warehouse_type` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 12 | `UOM` | `uom` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 13 | `TAX_CATEGORY` | `tax_category` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 14 | `PAYMENT_TERM` | `payment_term` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 15 | `PAYMENT_METHOD` | `payment_method` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 16 | `PRODUCT_CATEGORY` | `product_category` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 17 | `PRODUCT_BRAND` | `product_brand` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 18 | `DEPARTMENT` | `department` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 19 | `JOB_POSITION` | `job_position` | 10 | dinamis | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 20 | `LEAVE_TYPE` | `leave_type` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 21 | `VEHICLE_TYPE` | `vehicle_type` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 22 | `ACCOUNT_TYPE` | `account_type` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 23 | `CHART_OF_ACCOUNT` | `chart_of_account` | 10 | dinamis | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 24 | `SUPPLIER_GROUP` | `supplier_group` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 25 | `CUSTOMER_GROUP` | `customer_group` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 30 | `PRODUCT` | `product` | 10 | dinamis | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |
| 31 | `SUPPLIER` | `supplier` | 10 | dinamis | ada | UPSERT_BY_CODE | ya | PURGE_SAMPLE_ONLY |
| 32 | `CUSTOMER` | `customer` | 10 | dinamis | ada | UPSERT_BY_CODE | ya | PURGE_SAMPLE_ONLY |
| 33 | `PRODUCT_SUPPLIER` | `product_supplier` | 10 | dinamis | ada | INSERT_IF_MISSING | ya | PURGE_IF_UNREFERENCED |
| 40 | `NOTIFICATION_TEMPLATE` | `notification_template` | 10 | 10 | ada | UPSERT_BY_CODE | ya | PURGE_IF_UNREFERENCED |

## Seed control plane

Minimum record control plane diverifikasi langsung terhadap database. Angka berikut adalah
hasil verifikasi saat generate dijalankan (status keseluruhan: LULUS).

| Resource | Label | Minimum | Aktif | Status |
| --- | --- | --- | --- | --- |
| `LOCALE` | Bahasa | 10 | 10 | OK |
| `TRANSLATION_NAMESPACE` | Namespace Terjemahan | 10 | 12 | OK |
| `PLATFORM_PERMISSION` | Permission Platform | 10 | 30 | OK |
| `PLATFORM_ROLE` | Role Platform | 4 | 5 | OK |
| `GLOBAL_PERMISSION_ACTION` | Aksi Permission Global | 10 | 22 | OK |
| `GLOBAL_MENU_TEMPLATE` | Template Menu Global | 10 | 73 | OK |
| `GLOBAL_ROLE_TEMPLATE` | Template Role Global | 5 | 6 | OK |
| `MODULE_CATALOG` | Katalog Modul | 10 | 20 | OK |
| `FEATURE_CATALOG` | Katalog Fitur | 10 | 20 | OK |
| `SUBSCRIPTION_PLAN` | Paket Langganan | 4 | 4 | OK |
| `PAYMENT_CHANNEL` | Channel Pembayaran | 10 | 12 | OK |
| `NEWS_CATEGORY` | Kategori Berita | 10 | 10 | OK |
| `NEWS_TAG` | Tag Berita | 10 | 10 | OK |
| `NEWS_ARTICLE` | Artikel Berita | 10 | 12 | OK |
| `FAQ_CATEGORY` | Kategori FAQ | 10 | 10 | OK |
| `FAQ_ITEM` | Item FAQ | 10 | 16 | OK |
| `ANNOUNCEMENT` | Pengumuman | 10 | 10 | OK |
| `TESTIMONIAL` | Testimoni | 10 | 10 | OK |
| `PARTNER_LOGO` | Logo Mitra | 10 | 10 | OK |
| `MARKETING_FEATURE` | Fitur Pemasaran | 10 | 32 | OK |
| `MEDIA_FOLDER` | Folder Media | 10 | 10 | OK |
| `PLATFORM_SETTING` | Pengaturan Platform | 10 | 10 | OK |
| `CMS_PAGE` | Halaman CMS | 5 | 7 | OK |
| `CALL_TO_ACTION` | Call to Action | 4 | 4 | OK |
| `SCHEMA_MIGRATION_CATALOG` | Katalog Migration Tenant | 5 | 9 | OK |

## Konsistensi registry

Seluruh definisi seed tenant memiliki jumlah record minimal sama dengan `minimumRecords`.

