# ECO-0 — Inventaris harga

## Yang sudah benar

`SubscriptionPlanPrice` sudah **berversi dan berlaku menurut tanggal**:

```
planVersionId
currencyCode    (bawaan IDR)
effectiveFrom
effectiveUntil
```

Ada pula `SubscriptionPlanPriceTier`, `SubscriptionPlanVersion`,
`SubscriptionAddOnPrice`/`Version`, `TenantPriceOverride`, `TenantPlanContract`,
`TenantPlanFeatureOverride`, `PricingQuote`/`QuoteLine`, `PricingAdjustment`,
`BillingInvoice`, `BillingInvoiceLine`, `BillingCreditNote`,
`BillingPaymentAllocation`, `BillingReceipt`.

Tuntutan §14.2 (harga berversi, *effective-dated*, snapshot pada quote) dan §942
(harga lama tidak berubah setelah dipakai) **sudah punya tempatnya**.

## Yang belum ada

| Kebutuhan | Status |
| --- | --- |
| Metric selain langganan paket | **MISSING** — tidak ada `PricingMetricDefinition` |
| `UsageMeter`, `UsageEvent`, `UsageAggregation` | **MISSING** |
| Harga default lima portal (§15–§19) | **MISSING** dari seed |
| `CrossVerticalBundle*` | **MISSING** |
| Konsolidasi invoice §21.1 | **MISSING** |
| `PlatformPriceCatalog` / `PriceBook` | MISSING — perannya sebagian dipegang `SubscriptionPlan*` |

## Yang mengubah urutan pekerjaan

Seluruh harga yang §15–§19 minta berdiri di atas metric yang belum ada:

| Portal | Metric | Ada? |
| --- | --- | --- |
| eBisnis POS | per perangkat POS per bulan | tidak |
| eCampus / eSchool / ePesantren | pelajar aktif per bulan | tidak |
| eMedik | registrasi pasien per hari, tier marginal | tidak |
| eKoperasi | per koperasi per bulan | mendekati — langganan datar |
| info-desa | per desa/kelurahan per bulan | mendekati — langganan datar |

Dua yang terakhir dapat diseed hampir apa adanya. Tiga yang pertama menuntut
metering lebih dahulu; menyeed harganya tanpa metering hanya menghasilkan angka
yang tidak pernah dikalikan apa pun, dan angka seperti itu terlihat seperti
fitur yang sudah jadi.

**Karena itu ECO-7 tidak dapat didahulukan sebelum metering ada.** Ini
menyesuaikan urutan §46 dalam praktiknya, dan dicatat sebagai usul, bukan
keputusan sepihak.

## Harga default yang harus diseed kelak (§15–§19)

Dicatat di sini supaya tidak hilang, **belum diseed**:

| Kode | Harga | Dasar |
| --- | ---: | --- |
| `POS_STARTER` | Rp250.000 | per POS/perangkat/bulan |
| `POS_BUSINESS` | Rp400.000 | per POS/perangkat/bulan |
| `POS_PROFESSIONAL` | Rp600.000 | per POS/perangkat/bulan |
| `POS_COMPLETE` | Rp750.000 | per POS/perangkat/bulan |
| eCampus | Rp3.500 | mahasiswa aktif/bulan |
| eSchool | Rp2.000 | siswa aktif/bulan |
| ePesantren | Rp2.000 | santri aktif/bulan |
| eMedik | 10.000 / 7.500 / 5.000 / 3.500 | tier marginal harian per registrasi (1–49, 50–99, 100–199, 200–499); 500+ negosiasi |
| eKoperasi | Rp500.000 | per koperasi/bulan |
| info-desa | Rp500.000 | per desa atau kelurahan/bulan |

§972 melarang mengarang nilai bawaan baru di luar daftar ini.
