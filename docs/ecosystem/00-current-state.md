# ECO-0 — Keadaan saat ini

Audit dibuat pada worktree integrator `C:\opt\eBisnisGithub-ecosystem`, cabang
`feature/collaborative-multi-portal-platform`, dari `main` pada `98cd52c`.

Dokumen ini menyatakan **apa yang benar-benar ada di source**, bukan apa yang
seharusnya ada menurut BRD. §168 perintah master memerintahkannya begitu:
*"Jangan mengasumsikan seluruh Versi 10–13 sudah diterapkan."*

---

## 1. Hal pertama yang harus dikatakan: dokumen rujukan tidak lengkap

§2 perintah master mendaftar 17 dokumen sebagai **wajib dibaca sebelum coding**.
Yang benar-benar dapat dibaca hari ini:

| Dokumen | Keadaan |
| --- | --- |
| `PERINTAH_MASTER_...MULTI_PORTAL...md` | **ada** (dilampirkan pada perintah) |
| `PANDUAN_KOORDINASI_PARALEL_CORE_EMEDIK_EKOPERASI_INFO_DESA.md` | ada di `Downloads` |
| `PERINTAH_PRIORITAS_..._POS_WEB_..._SETELAH_V11.md` | ada di `Downloads` |
| `MASTER_PROMPT_..._V6_REFERRAL_MULTIINVESTOR_...md` | ada di `Downloads` |
| BRD V13 Enterprise Education | **tidak ditemukan** |
| Prompt upgrade V12→V13 | **tidak ditemukan** |
| Perintah master eksekusi V13 | **tidak ditemukan** |
| `RangkumanENterpiseEducationUntukBahanBrd.md` | **tidak ditemukan** |
| BRD V12 (`.md`) | **tidak ditemukan** (ada `.docx` berbeda nama) |
| Prompt upgrade V11→V12 | **tidak ditemukan** |
| `STRUKTUR_MENU_ROLE_PERMISSION_EBISNIS_V12.md` | **tidak ditemukan** |
| Spesifikasi V12 R2 eMedik + dua addendumnya | **tidak ditemukan** |
| Spesifikasi V12 eKoperasi | **tidak ditemukan** |
| Spesifikasi V12 info-desa | **tidak ditemukan** |
| BRD V11 (`.md`), BRD V9 (`.md`) | **tidak ditemukan** (ada `.pdf`) |

Empat belas dari tujuh belas tidak dapat dibaca. Tak satu pun ada di dalam repo;
`docs/input/` hanya memuat delapan berkas warisan yang tidak berhubungan.

**Akibatnya, dan batasnya.** ECO-0 adalah audit *source*, jadi ia tetap dapat
diselesaikan penuh — sumber kebenaran untuk keadaan implementasi memang source,
bukan BRD (§3 baris 183). Yang **tidak** dapat dikerjakan tanpa dokumen itu
adalah keputusan rancangan pada ECO-1 ke atas yang §3 nyatakan bersumber pada
BRD tiap vertical.

Ini dicatat sebagai risiko, bukan alasan berhenti — §65 tidak menyebutkannya
sebagai kondisi berhenti.

---

## 2. Ringkasan status

Memakai kosakata status §3.

| Bidang | Status | Catatan singkat |
| --- | --- | --- |
| Repository tunggal, satu core | **DONE** | Satu repo, satu API NestJS, satu web Vite, schema-per-tenant |
| Control plane `platform` + audit terpisah | **DONE** | 197 model Prisma, audit append-only, trigger otomatis |
| Registry portal brand (5 portal) | **MISSING** | Tidak ada `PlatformPortal*` sama sekali |
| Lima public website | **PARTIAL** | Satu situs publik eBisnis + situs koperasi per-host; belum lima brand |
| CMS multi-situs | **PARTIAL** | `CmsPage.websiteId` ada — mesinnya multi-situs; situsnya belum lima |
| Identity terpusat | **PARTIAL** | Satu `PlatformUser`/`PlatformSession`, tetapi **bukan OIDC** |
| SSO lintas domain (OIDC + PKCE) | **MISSING** | Tidak ada satu pun jejak `oidc`/`pkce`/`authorization_code` |
| Product/module catalog | **PARTIAL** | `ModuleCatalog` ada; versi, manifest, conflict, eligibility belum |
| Entitlement engine | **PARTIAL** | `EntitlementSnapshot`, `SubscriptionPlanModule`, override tenant ada |
| Pricing engine | **PARTIAL→DONE** | Berversi dan *effective-dated*; belum multi-metric |
| Usage metering | **MISSING** | Tidak ada `UsageMeter`/`UsageEvent` |
| Billing/invoice | **PARTIAL** | `BillingInvoice`, `CreditNote`, alokasi pembayaran ada |
| Schema registry | **PARTIAL** | Ada, tetapi **satu schema per tenant**, bukan per modul |
| Provisioning orchestrator | **PARTIAL** | Provisioner + riwayat migrasi ada; state machine §37 belum |
| Cross-vertical port | **PARTIAL** | Pola sudah berjalan di koperasi dan pembayaran eksternal |
| Event bus lintas vertical | **PARTIAL** | Outbox/event ada; namespace §28 belum |
| App shell + vertical switcher | **MISSING** | Tidak ada pemilih vertical/product |
| Data sharing agreement | **MISSING** | Tidak ada model persetujuan berbagi data |

Tidak ada satu pun bidang berstatus **BROKEN** atau **CONFLICTING**.

---

## 3. Tiga temuan yang mengubah rencana

### 3.1 Schema registry memodelkan satu schema per tenant

`TenantSchemaRegistry` memakai `tenantId @unique` dengan satu `schemaName` dan
satu `auditSchemaName`. §11 perintah master menuntut pola
`{USERNAME_TENANT}_{NAMA_MODUL}` — banyak schema per tenant, satu per modul.

Ini bukan sekadar tabel yang kurang kolom: seluruh `TenantConnectionService`,
migrasi tenant, dan penyelesai schema mengasumsikan satu schema per tenant.
Perubahannya menyentuh jalur terpanas di seluruh sistem.

### 3.2 Identity ada, tetapi bukan identity *provider*

Ada `PlatformUser`, `PlatformSession`, `PlatformRefreshToken` dengan rotasi dan
deteksi pemakaian ulang. Yang tidak ada adalah OIDC — tidak ada authorization
code, PKCE, client registration, maupun issuer.

§9 menuntut satu authoritative issuer dan BFF per portal. Yang sekarang berjalan
adalah login berbasis JWT langsung ke API. Untuk satu domain itu benar; untuk
lima registrable domain ia tidak dapat dipakai tanpa melanggar §5 (*"shared
cookie lintas registrable domain"*).

### 3.3 Pola port lintas vertical sudah terbukti, dan sudah dipakai

`apps/api/src/modules/cooperative/ports/index.ts` sudah mendefinisikan
`IdentityPort`, `AccountingEventPort`, `NumberingPort`, `NotificationPort`,
`FileStoragePort`, `SubscriptionPort`. `ExternalPaymentRegistry` pada POS sudah
melayani `COOPERATIVE_MEMBER_BALANCE` dan `HEALTH_CLAIM_BALANCE` sebagai
penangan terdaftar.

Artinya §27 tidak dimulai dari nol — ia **diperluas**, bukan dibangun ulang. Ini
temuan yang menghemat pekerjaan, dan sekaligus memperingatkan agar tidak
membuat kerangka kedua di sampingnya (§186: *"Jangan membuat framework baru jika
capability yang sama sudah tersedia."*).

---

## 4. Yang tidak diaudit di sini

- Isi basis data sungguhan. Tidak ada PostgreSQL yang terjangkau dari mesin ini
  (5432/5433/5434 tidak menjawab). Seluruh pernyataan di atas berasal dari
  source dan migrasi, bukan dari `information_schema`.
- Perilaku runtime kelima domain. Hanya `ebisnis.id` yang menjawab (200).
- Cabang vertical yang belum digabung. Dipetakan pada
  [01-branch-and-worktree-status.md](01-branch-and-worktree-status.md), tetapi
  isinya tidak dibaca baris demi baris.
