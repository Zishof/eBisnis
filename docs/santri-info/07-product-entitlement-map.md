# EP-0.8 — Peta Produk dan Entitlement

## Mesin yang sudah ada

`subscription.prisma` memuat 20 model, mencakup seluruh yang dibutuhkan §8.2:

```text
ModuleCatalog            SubscriptionPlanPrice        TenantPlanContract
FeatureCatalog           SubscriptionPlanPriceTier    TenantPlanModuleOverride
SubscriptionProduct      SubscriptionPlanConstraint   TenantPlanFeatureOverride
SubscriptionPlan         SubscriptionAddOn            TenantPriceOverride
SubscriptionPlanVersion  SubscriptionAddOnVersion     PackageAssignment
SubscriptionPlanModule   SubscriptionAddOnModule      EntitlementSnapshot
SubscriptionPlanFeature  SubscriptionAddOnPrice
```

Status mesin `DONE`. Tidak perlu entitlement engine kedua; §6 memang
melarangnya.

## Yang belum ada

| Yang diminta | Status |
| --- | --- |
| Produk `EPESANTREN`, `ESCHOOL`, `ECAMPUS` | MISSING — belum diseed |
| Paket `EPESANTREN_SCHOOL_FIRST` | MISSING |
| Paket `_CORE`, `_PLUS_POS`, `_PLUS_KOPERASI`, `_PLUS_CLINIC`, `_COMPLETE` | MISSING |
| 39 kode modul §8.3 pada `ModuleCatalog` | MISSING |
| Manifest modul berversi §8.4 | MISSING |

## Larangan yang harus dijaga

§1 dan §6 menuntut untuk tenant pertama:

```text
eCampus nonaktif secara default
menu eCampus tidak tampil
schema eCampus JANGAN diprovision sebelum entitlement aktif
billing eCampus tidak berjalan
```

Ini harus menjadi **uji**, bukan catatan. Modul yang tidak diminta tetapi
terprovision adalah biaya yang muncul pada tagihan pondok tanpa mereka
memesannya.

## Langkah terkecil yang bermakna

Menyeed tiga produk dan satu paket `EPESANTREN_SCHOOL_FIRST` seharga Rp 2.000
per santri aktif per bulan, memakai mesin yang sudah ada. Itu memindahkan angka
Rp 2.000 dari halaman pemasaran ke katalog harga berversi — tepat seperti §13.1
tuntut.
