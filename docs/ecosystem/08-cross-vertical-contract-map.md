# ECO-0 — Peta kontrak lintas vertical

## Temuan utama: polanya sudah ada dan sudah dipakai

`apps/api/src/modules/cooperative/ports/index.ts` mendefinisikan:

```
PartyRef
IdentityPort
AccountingEventInput / AccountingEventPort
NumberingPort
NotificationPort
FileStoragePort
SubscriptionPort
OutletRef / SaleSummary
```

`apps/api/src/modules/pos/external-payment.registry.ts` menjalankan registry
penangan pembayaran lintas vertical:

```
ExternalPaymentContext
ExternalPaymentAuthorization
ExternalPaymentHandler
ExternalPaymentRegistry
```

dengan penangan nyata terdaftar **`COOPERATIVE_MEMBER_BALANCE`**
(`cooperative/payment/member-balance-payment.handler.ts`) dan penangan dompet
santri ePesantren (`pesantren/pesantren-dompet-payment.handler.ts`, EP-N).
**`HEALTH_CLAIM_BALANCE`** BUKAN penangan nyata — itu hanya string fixture di
`pos/external-payment.spec.ts`; tidak ada modul klinik/eMedik di repo ini yang
mengimplementasikan `ExternalPaymentHandler`, dan worktree terpisah
`eBisnisGithub-emedik` (`modules/emedik/`, branch `feature/v12-emedik`) juga
belum memiliki penangan ini. Diverifikasi ulang saat riset EP-N2
(2026-08-02) — klaim sebelumnya bahwa penangan ini "sudah berjalan" keliru.

Artinya POS sudah dapat menerima pembayaran dari saldo anggota koperasi dan
dari dompet santri **tanpa membaca tabel vertical itu** — persis yang §27
minta, dan sudah berjalan untuk dua dari tiga vertical yang direncanakan.
Klaim kesehatan (eMedik) masih perlu penangan nyata begitu modul itu
digabung — lihat catatan EP-N2 di
`docs/santri-info/16-implementation-plan.md`.

§186 karena itu berlaku tegas di sini: ECO-9 **memperluas** pola ini, tidak
membangun kerangka kedua di sampingnya.

## Pemetaan terhadap §27

| Port §27 | Status |
| --- | --- |
| `IdentityPort` | ada (di dalam modul koperasi) |
| `AccountingEventPort` | ada |
| `NotificationPort` | ada |
| `FileStoragePort` | ada |
| `SubscriptionPort` | ada |
| `PaymentPort` | ada, sebagai registry pembayaran eksternal |
| `PosPort` | PARTIAL (`SaleSummary`, `OutletRef`) |
| `EntitlementPort`, `PricingPort`, `BillingPort` | MISSING |
| `OrganizationPort`, `WorkflowPort`, `AiGatewayPort`, `AuditPort`, `SearchPort` | MISSING |
| `InvestorPort` | MISSING |
| `EducationPort`, `HealthPort`, `CooperativePort`, `VillagePort` | MISSING |

## Yang harus dijaga

Port hari ini hidup **di dalam** modul koperasi. Ketika eMedik dan info-desa
digabung, godaan termudahnya adalah menyalinnya — dan itu melanggar §1394.

ECO-9 karena itu dimulai dengan **memindahkan** kontrak port ke tempat bersama,
bukan menambah kontrak baru di sampingnya. Pemindahan itu murni perpindahan
berkas dan impor; tidak ada perubahan perilaku, sehingga dapat dilakukan lebih
dahulu dan aman terhadap penggabungan cabang vertical.

## Berbagi data

Seluruh model §29.3 — `DataSharingAgreement`, `Purpose`, `Scope`, `Consent`,
`LegalBasis`, `Projection`, `Revocation`, `Audit` — **MISSING**.

Sampai itu ada, kolaborasi §30 (eSchool + klinik, eCampus + rumah sakit,
info-desa + posyandu) tidak boleh dijalankan. §2321 menyatakannya sebagai
penghalang rilis: *tidak boleh release jika satu module dapat membaca data
vertical lain tanpa izin.*
