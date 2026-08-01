# ECO-0 — Inventaris produk dan modul

## Yang ada

`ModuleCatalog` memuat `code`, `name`, `nameKey`, `description`, `category`,
`status`, `icon`, **`dependsOn` (Json)**, `sortOrder`, penanda sample, metadata.

Terhubung dengan `SubscriptionPlanModule`, `SubscriptionAddOnModule`,
`TenantPlanModuleOverride`, dan `EntitlementSnapshot.modules`.

## Selisih terhadap §6.2

| Model | Status |
| --- | --- |
| `PlatformVertical` | MISSING |
| `PlatformProduct`, `PlatformProductVersion` | MISSING |
| `PlatformModuleVersion` | MISSING |
| `PlatformCapability` | MISSING |
| `PlatformModuleDependency` | **PARTIAL** — hidup sebagai kolom Json `dependsOn`, bukan tabel |
| `PlatformModuleConflict` | MISSING |
| `PlatformModuleEligibility` | MISSING |
| `PlatformModuleManifest` | MISSING |
| `PlatformModuleRoute` / `MenuCatalog` / `RoleCatalog` / `HelpCatalog` | **PARTIAL** — ada sebagai seed TypeScript, bukan katalog data |
| `PlatformModuleMigrationCatalog` | **PARTIAL** — `tenant-migrations/manifest.json` |

## Dua temuan yang menentukan

**Katalog menu, peran, dan izin adalah berkas TypeScript.**
`apps/api/src/infrastructure/provisioning/tenant-menu.seed.ts` memuat pohon menu
seluruh produk beserta hak akses peran bawaan. Ia bukan data berversi. ECO-3
memang meminta pemindahannya ke manifest — dan berkas itu juga salah satu titik
konflik tertinggi antar cabang.

**`dependsOn` sebagai Json membuat graf dependensi tidak dapat ditanyai.**
Pertanyaan §12.4 seperti *"modul apa yang rusak bila Inventory dicabut"* tidak
dapat dijawab dengan query; ia menuntut pemindaian seluruh baris di kode.
Sedangkan §37 menjadikan validasi dependensi sebagai langkah wajib provisioning.
