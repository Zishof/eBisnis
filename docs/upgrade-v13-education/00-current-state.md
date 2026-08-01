# E13-0 · Keadaan Saat Ini

Diaudit pada commit `main` yang berlaku saat dokumen ini ditulis. Setiap pernyataan
di sini berasal dari pemeriksaan berkas, bukan dari BRD.

---

## 1. Baseline yang terukur

| Ukuran | Nilai | Cara memperolehnya |
| --- | --- | --- |
| Uji API | **2.069 lulus / 77 suite** | `pnpm --filter @ebisnis/api test` |
| Uji web | **193 lulus / 13 berkas** | `pnpm --filter @ebisnis/web test` |
| E2E peramban | **73 lulus, 0 gagal, 0 flaky** | Jalan CI pada `main` |
| Migration tenant inti | **37** (`V001`–`V037`) | `apps/api/tenant-migrations/*.sql` |
| Migration modul | 1 modul (`cooperative`) | `apps/api/tenant-migrations/cooperative/` |
| Modul NestJS | 29 | `apps/api/src/modules/` |

Seluruh uji hijau pada saat audit. Angka-angka ini menjadi **garis dasar**: setiap
fase E13 tidak boleh menurunkannya.

---

## 2. Yang sudah ada dan dapat dipakai ulang

### 2.1 Registry vertical — pola yang sudah terbukti

`apps/api/src/infrastructure/provisioning/vertical-catalog.registry.ts` menyediakan
`VerticalCatalog` berisi `code`, `prefix`, `menus`, `roles`, `permissionActions`.
Daftarnya tetap di `vertical-catalogs.ts`, bukan hasil pendaftaran daur hidup modul.

Komentar pada berkas itu mencatat sebabnya, dan sebab itu penting bagi E13: pendaftaran
lewat `onModuleInit()` membuat CLI penyemai menghasilkan 139 menu sedangkan jalur API
menghasilkan 162 — dua jalur, dua hasil, tanpa satu pun galat. Vertical pendidikan
**wajib** mengikuti pola daftar tetap ini.

Preseden yang dapat ditiru: `COOPERATIVE_VERTICAL_CATALOG`.

### 2.2 Migration per modul

`migration-catalog.ts` sudah mendukung manifest per modul
(`tenant-migrations/<modul>/manifest.json`) yang digabung dengan manifest inti.
Penamaan migration V13 (`<timestamp>__ecampus__<deskripsi>`) dapat ditampung tanpa
mengubah mesinnya.

### 2.3 Layanan bersama yang benar-benar ada

| Layanan | Status | Catatan |
| --- | --- | --- |
| Identity, RBAC, data scope, SoD | DONE | `auth`, `governance`, `segregation-of-duty.service.ts` |
| Tenant, provisioning, schema registry | PARTIAL | Lihat §3.1 — satu schema per tenant |
| Accounting / GL | DONE | `modules/accounting`, event catalog registry |
| Billing dan subscription | PARTIAL | Tidak mengenal vertical maupun usage metering |
| Payment | DONE | `modules/payment` |
| POS | DONE | `modules/pos` + klien PWA dan Flutter |
| Koperasi | DONE | `modules/cooperative` — preseden vertical V12 |
| Surat / naskah dinas | DONE | `modules/surat` (V10) |
| Notification Hub | DONE | `modules/notification` |
| AI Gateway | DONE | `modules/ai` (V11) |
| Observability | DONE | `modules/observability` |
| Inventory, purchasing, workflow | PARTIAL | Tabel ada (`V004`, `V005`, `V007`); modul API belum |

### 2.4 Layanan bersama yang V13 asumsikan tetapi **belum ada**

| Diasumsikan BRD §184.2 | Status | Akibat bagi E13 |
| --- | --- | --- |
| HR / kepegawaian | **MISSING** | `EducationStaffProfile`, `TeachingLoadPlan`, `EducatorPerformance` tidak punya induk |
| Payroll | **MISSING** | `HonorRule` tidak dapat mengalir ke komponen gaji |
| Procurement | **MISSING** | Ada tabel `purchasing` di `V005`, tanpa modul API |
| Asset | **MISSING** | Sarana/prasarana sekolah dan Dapodik memerlukannya |
| DMS | **MISSING** | Ada `file_object`/`entity_attachment` di `V001`, belum DMS penuh |

Ini bukan alasan menunda E13, tetapi **wajib** tercatat: BRD berulang kali menulis
"gunakan Finance/HR/POS Core; jangan membuat engine kedua". Untuk HR dan payroll,
saat ini **tidak ada engine pertama** yang dapat dipakai. Keputusan yang diperlukan
ada di [09-implementation-plan.md](09-implementation-plan.md) §4.

---

## 3. Jurang arsitektur terhadap V13

### 3.1 Satu schema per tenant — jurang terbesar

`apps/api/prisma/platform/tenancy.prisma:148`:

```prisma
model TenantSchemaRegistry {
  tenantId        String  @unique @map("tenant_id") @db.Uuid
  schemaName      String  @map("schema_name") @db.VarChar(64)
  auditSchemaName String  @map("audit_schema_name") @db.VarChar(72)
  ...
  @@unique([schemaName])
}
```

`tenantId` **unik** berarti satu tenant hanya boleh punya satu schema.

V13 §185.1 menuntut `{username}_ecampus`, `{username}_eschool`, `{username}_epesantren`
untuk tenant yang sama. Bentuk sekarang tidak dapat menampungnya, dan tidak ada cara
menambahkannya tanpa mengubah kunci tabel ini.

Rinciannya beserta pilihan yang tersedia ada di
[03-schema-and-module-registry.md](03-schema-and-module-registry.md).

### 3.2 Panjang nama schema

`apps/api/src/infrastructure/database/schema-name.util.ts:7`:

```ts
export const SCHEMA_NAME_REGEX = /^[a-z][a-z0-9_]{2,47}$/;
```

Batas 48 karakter berlaku pada **seluruh nama schema**, bukan pada username. Akhiran
terpanjang V13 adalah `_epesantren` (11 karakter) dan akhiran audit `__audit` (7).
Username 48 karakter yang sah hari ini menghasilkan
`<48>_epesantren__audit` = 66 karakter — melewati batas, dan `quoteIdentifier` menolaknya
pada 72 karakter.

V13 §185.2 memang membatasi username 3–30 karakter. Batas itu **belum ada** di kode;
yang ada hanya batas 48 pada nama schema akhir. Tanpa batas username yang terpisah,
kegagalannya muncul saat provisioning vertical ketiga — bukan saat username dibuat.

### 3.3 Subscription tidak mengenal vertical maupun usage

`apps/api/prisma/platform/subscription.prisma` memuat 20 model
(`SubscriptionProduct`, `SubscriptionPlan`, `TenantPlanContract`, `TenantPriceOverride`,
`EntitlementSnapshot`, dan lain-lain). Tidak satu pun menyebut vertical, learner, atau
usage. Pencarian `vertical` pada berkas itu **nihil**.

V13 §187.5 menuntut 13 entitas baru mulai `EducationProduct` sampai `EducationBillingAudit`,
dengan snapshot harian dan agregasi bulanan per peserta didik. Pemetaan apa yang dapat
diperluas dan apa yang harus baru ada di
[06-billing-and-metering.md](06-billing-and-metering.md).

### 3.4 Belum ada Person canonical

Yang paling mendekati adalah `party` (`V002__organization_access.sql:539`):

```sql
party (id, party_type DEFAULT 'PERSON', code, name, tax_number, email, phone, address_id, ...)
```

`party` adalah pihak bisnis — pelanggan, pemasok, pemilik, investor. Ia tidak punya
tanggal lahir, jenis kelamin, identifier nasional, relasi wali, consent, maupun riwayat
merge. V13 §188 menuntut semuanya.

Pemetaannya ada di [04-identity-and-person-map.md](04-identity-and-person-map.md).

---

## 4. Ringkasan status

| Area | Status |
| --- | --- |
| Registry vertical (menu/role/permission) | DONE — tinggal menambah katalog |
| Migration per modul | DONE — mesinnya siap |
| Schema per modul | **BROKEN untuk V13** — kunci `tenantId` unik |
| Batas panjang username | **MISSING** |
| Subscription per vertical | **MISSING** |
| Usage metering per peserta didik | **MISSING** |
| Person canonical | **MISSING** — `party` bukan penggantinya |
| HR / payroll / procurement / asset | **MISSING** |
| Common education kernel | **MISSING** |
| eCampus / eSchool / ePesantren | **MISSING** |
| Adapter PDDikti/Dapodik/EMIS | **MISSING** |
| Sumber legacy untuk referensi | DONE — tersedia, lihat dokumen 01 |

Tidak ada satu pun yang berstatus `CONFLICTING`: V13 memperluas, tidak membatalkan,
requirement V5–V12.
