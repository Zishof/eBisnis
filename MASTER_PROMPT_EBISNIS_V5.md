# MASTER PROMPT CODEX / CLAUDE CODE
# PEMBANGUNAN EBISNIS.ID FULL-STACK DARI NOL — VERSI 5
# FULL ERP DATA DICTIONARY A-Z, MASTER SEED MINIMAL 10 RECORD,
# ACTIVE/SOFT DELETE/HARD PURGE, PUBLIC WEBSITE & CMS,
# FLEXIBLE PACKAGE PRICING, SUPER ADMIN, MULTI-BAHASA,
# SUBSCRIPTION PER POS, ESMARTLINK CREATE-ORDER/CALLBACK/INQUIRY,
# SELF-SERVICE REGISTRATION, MULTI-SCHEMA TENANT, AUDIT, DEMO, DAN SVN

**Status:** Versi 5 — siap ditempatkan di root workspace dan dibaca oleh Codex CLI atau Claude Code.  
**Target awal:** Aplikasi web responsif yang langsung dapat dijalankan dan diuji di localhost.  
**Bahasa dokumentasi dan UI:** Bahasa Indonesia.  
**Bahasa kode dan nama teknis:** Bahasa Inggris yang konsisten.  
**Database lokal:** PostgreSQL di `localhost:5432`, database `ebisnis`, username `root`, password `<PASSWORD>`.

**Workspace resmi:** `C:\opt\eBisnis\`  
**SVN repository:** `svn://38.47.178.34/pos/eBisnis`  
**Pemisahan data:** schema PostgreSQL terpisah untuk setiap pendaftar dan schema audit terpisah.  
**Schema sandbox:** `demo` dan `demo__audit`.

> **Aturan prioritas versi 5:** apabila terdapat bagian lama yang bertentangan, ketentuan Versi 5 berlaku.
> Control plane tetap terpusat, data ERP tetap schema-per-tenant, sedangkan super admin, katalog harga
> langganan, diskon, perangkat POS, invoice, pembayaran Esmartlink, locale, dan translation catalog
> dikelola melalui control plane `platform`. Akses super admin ke schema tenant harus eksplisit, terbatas,
> menggunakan step-up authentication, alasan akses, dan audit ganda.


---

# 0. CARA MENGGUNAKAN PROMPT INI

## 0.1. Workspace dan SVN

Workspace resmi berada di:

```text
C:\opt\eBisnis\
```

Repository SVN:

```text
svn://38.47.178.34/pos/eBisnis
```

Agen wajib memeriksa apakah workspace sudah merupakan working copy SVN:

```powershell
Set-Location C:\opt\eBisnis
svn info
svn status
```

Apabila folder belum merupakan working copy dan aman untuk checkout:

```powershell
Set-Location C:\opt
svn checkout svn://38.47.178.34/pos/eBisnis eBisnis
Set-Location C:\opt\eBisnis
svn info
```

Jangan menghapus isi `C:\opt\eBisnis` secara otomatis. Jangan menjalankan `git init`.
Jangan mengubah URL repository tanpa instruksi pemilik proyek.

## 0.2. File instruksi

Letakkan file ini di root working copy dengan nama:

```text
MASTER_PROMPT_EBISNIS_V5.md
```

Salin pula file kebutuhan berikut ke folder `docs/input/` apabila tersedia:

```text
docs/input/ebisnis.jsp
docs/input/STRUKTUR_MENU_LENGKAP_EBISNIS_ID_ENHANCED_V2.md
docs/input/MASTER_PROMPT_CODEX_CLAUDE_EBISNIS_ID.md
docs/input/stock and Request Order.pdf
docs/input/Penerimaan Barang dari pemasok dan Manufaktur.pdf
docs/input/Esmartlink.java
docs/input/DownloadTagihanSiswaBankOnline.java
docs/input/SmartlinkChannelWindow.java
docs/input/VirtualAccountBankAction.java
```

## 0.3. Instruksi pertama untuk agen

```text
Baca MASTER_PROMPT_EBISNIS_V5.md sampai selesai.
Baca seluruh file pada docs/input/.
Kerjakan fase secara berurutan dan jangan melewati quality gate.
Gunakan workspace C:\opt\eBisnis sebagai working copy SVN.
Bangun aplikasi, migration, schema provisioner, seed, test, dan UI sampai
pendaftaran, login, demo, onboarding, dan vertical slice ERP dapat diuji di localhost.
```

## 0.4. Aturan commit SVN

Pada akhir setiap fase yang lulus quality gate:

```powershell
svn status
svn diff
svn update
svn commit -m "fase-X: deskripsi perubahan"
```

Jangan commit:

```text
node_modules
dist
coverage
.env
.env.local
.env.production
playwright-report
test-results
*.log
.tmp
.cache
```

Buat file `.svnignore` dan terapkan properti ignore secara rekursif pada folder yang relevan.
Jangan memasukkan credential SVN, credential database production, JWT secret production,
atau token pihak ketiga ke repository.

---

## 0.5. Perubahan wajib Versi 3

Versi ini menambahkan kebutuhan yang mempunyai prioritas lebih tinggi daripada bagian lama:

1. Buat akun **Platform Super Admin** untuk development:

   ```text
   Username : admin
   Password : <BOOTSTRAP_PASSWORD>
   Role     : PLATFORM_SUPER_ADMIN
   ```

   Ketentuan:

   - user berada pada schema `platform`, bukan schema tenant;
   - `admin` adalah reserved username dan tidak boleh dipakai pendaftar;
   - seed hanya membuat akun bila belum ada;
   - seed idempotent tidak boleh mengembalikan password ke `<BOOTSTRAP_PASSWORD>` setelah password diubah;
   - simpan hash Argon2, bukan plaintext;
   - set `mustChangePassword=true` pada pembuatan pertama;
   - setelah berhasil mengganti password, user dapat menggunakan password baru;
   - production tidak boleh memakai password default ini; baca bootstrap password dari secret/environment;
   - seluruh aktivitas super admin harus dicatat pada `platform__audit`;
   - perubahan data tenant oleh super admin juga dicatat pada schema audit tenant target.

2. Platform Super Admin dapat:

   - melihat dan mengelola pendaftar;
   - melihat status provisioning seluruh schema;
   - mengaktifkan, menonaktifkan, menangguhkan, atau memigrasikan tenant;
   - membuka **tenant support context** untuk membaca data master seluruh schema;
   - mengubah data master tenant hanya setelah step-up authentication dan mengisi alasan;
   - melihat health, migration version, subscription, perangkat, invoice, dan pembayaran;
   - mengatur biaya langganan per mesin POS;
   - memberi harga khusus kepada tenant tertentu;
   - membuat aturan diskon dan promo fleksibel;
   - mengelola channel, biaya admin, dan konfigurasi Esmartlink;
   - mengelola katalog bahasa dan terjemahan global.

3. Dukungan bahasa awal:

   ```text
   id      Bahasa Indonesia — default
   en      English
   ar      العربية — RTL
   zh-CN   简体中文
   ```

   Arsitektur harus memungkinkan locale tambahan tanpa mengubah kode inti.

4. Langganan POS dapat dibayar:

   - per perangkat/mesin POS;
   - beberapa perangkat terpilih;
   - seluruh perangkat dalam satu invoice gabungan.

5. Integrasi pembayaran menggunakan **Esmartlink** dengan menjadikan:

   ```text
   docs/input/Esmartlink.java
   docs/input/SmartlinkChannelWindow.java
   ```

   sebagai sumber karakterisasi perilaku. Jangan menyalin ketergantungan servlet, Hibernate, ZK,
   atau entity pendidikan. Implementasikan adapter NestJS yang bersih dan teruji.

---


## 0.6. Perubahan wajib Versi 4

Versi 4 memperluas Versi 3 dengan **Package & Module Pricing Engine**. Harga tidak boleh
ditulis permanen pada source code dan tidak boleh dibatasi hanya pada satu harga per POS.

### Contoh paket awal yang wajib dibuat sebagai seed

Nilai berikut adalah contoh penawaran awal dan dapat diubah oleh Platform Super Admin:

| Kode | Nama paket | Harga per POS per bulan | Modul yang termasuk |
|---|---|---:|---|
| `POS_STARTER` | POS Starter | Rp250.000 | POS |
| `POS_BUSINESS` | POS Business | Rp400.000 | POS, Keuangan, Akuntansi, Gudang/Persediaan |
| `POS_PROFESSIONAL` | POS Professional | Rp600.000 | POS, Keuangan, Akuntansi, Gudang/Persediaan, SDM |
| `POS_COMPLETE` | POS Complete | Rp750.000 | Seluruh modul pada snapshot versi paket |

Ketentuan:

1. Paket di atas hanya **seed development/default offering**.
2. Harga dan isi paket dapat diubah melalui versi baru, bukan mengubah histori paket lama.
3. Super admin dapat membuat paket baru, menduplikasi paket, menambah atau mengurangi modul,
   menambah add-on, mengubah harga, membuat harga khusus tenant, dan menentukan masa berlaku.
4. Sistem mendukung paket seragam untuk satu tenant maupun paket berbeda per outlet/perangkat.
5. Sistem harus membedakan:
   - modul yang ditagihkan per perangkat POS;
   - modul yang hak aksesnya berlaku tenant-wide;
   - fitur yang berlaku hanya pada outlet/perangkat tertentu.
6. “Seluruh modul” secara default berarti **seluruh modul pada saat versi paket dipublikasikan**.
   Modul baru di masa depan tidak otomatis gratis kecuali policy paket secara eksplisit
   `INCLUDE_FUTURE_MODULES`.
7. Semua quote dan invoice menyimpan snapshot paket, modul, fitur, harga, diskon, pajak,
   biaya admin, dan perangkat.
8. Tidak boleh menggunakan `eval`, script bebas, SQL bebas, atau formula bebas dari pengguna.

### Referensi Esmartlink tambahan

Agen wajib membaca dan mengkarakterisasi:

```text
Esmartlink.java
DownloadTagihanSiswaBankOnline.java
SmartlinkChannelWindow.java
VirtualAccountBankAction.java
```

Referensi tersebut digunakan untuk memahami:

- pembuatan order/payment page Esmartlink;
- struktur payload create-order;
- channel dan biaya admin;
- expiry pembayaran;
- penyimpanan request/response dan payment URL;
- callback;
- duplicate callback;
- cek pembayaran/inquiry berdasarkan `transaction_id`;
- cek pembayaran per transaksi dan massal;
- pemrosesan hasil inquiry melalui processor yang sama dengan callback.

Jangan menyalin servlet, Hibernate, ZK, entity pendidikan, credential hard-coded, atau command
eksternal legacy. Bangun adapter NestJS yang terisolasi, aman, idempotent, dan dapat diuji.

---


## 0.7. Perubahan wajib Versi 5

### A. Seed data master minimal 10 record

1. Setiap tabel master yang dapat dikelola pengguna wajib mempunyai minimal **10 record contoh**
   pada schema `demo` dan pada setiap tenant baru.
2. Seed harus deterministik, idempotent, aman, realistis, tidak memuat data pribadi nyata,
   mempunyai `isSample=true`, `sampleBatchId`, dan kode stabil.
3. Tabel transaksi, ledger, audit, junction teknis, migration history, outbox/inbox, session,
   refresh token, sequence, dan singleton configuration tidak dipaksa mempunyai 10 record.
4. Pengecualian master yang secara alamiah tidak masuk akal memiliki 10 record wajib dicatat pada
   `docs/database/master-seed-exceptions.md`.
5. Sediakan:
   - `Hapus Data Contoh`;
   - `Pulihkan Data Contoh`;
   - `Tambahkan Data Contoh yang Kurang`;
   - `Verifikasi Seed`.
6. Data contoh tidak boleh dihapus bila telah direferensikan transaksi nyata.

### B. Kolom aktif, soft delete, restore, dan hard purge

Setiap tabel master wajib memiliki:

```text
isActive      BOOLEAN NOT NULL DEFAULT TRUE
deactivatedAt TIMESTAMPTZ NULL
deactivatedBy UUID NULL
deletedAt     TIMESTAMPTZ NULL
deletedBy     UUID NULL
deleteReason  TEXT NULL
```

Aturan:

1. `isActive=false` adalah mekanisme nonaktif utama.
2. `deletedAt` adalah soft delete yang tetap mempertahankan audit dan referensi.
3. Query normal hanya menampilkan `isActive=true AND deletedAt IS NULL`.
4. Hard delete disebut `purge`.
5. Purge membutuhkan permission `HARD_DELETE`, step-up authentication, alasan, reference check,
   dan audit.
6. Purge dilarang untuk transaksi, stock ledger, jurnal posted, invoice issued, payment event,
   callback, entitlement history, dan audit.
7. Foreign key master pada umumnya menggunakan `onDelete: Restrict`.

### C. Data dictionary ERP end-to-end

Agen wajib membuat dan menjaga:

```text
docs/database/full-data-dictionary.md
docs/database/entity-relationship-overview.md
docs/database/master-seed-catalog.md
docs/database/table-lifecycle-policy.md
docs/database/hard-delete-reference-matrix.md
docs/database/index-catalog.md
```

Setiap tabel harus mempunyai dokumentasi schema, nama tabel, tujuan, PK, kolom, tipe,
nullability, default, FK, unique constraint, index, lifecycle, audit, seed, retention, dan purge.

### D. Public Website dan CMS

Route `/` wajib menampilkan website publik eBisnis.id yang konsepnya mengikuti `ebisnis.jsp`.

Konten minimum:

```text
Header/navigation
Hero
Ringkasan fitur
Daftar modul
Keunggulan
Cara kerja
Paket harga dinamis
Demo
Berita terbaru
Pengumuman
Testimoni
Mitra
FAQ
Pendaftaran
Kontak
Footer
```

Seluruh konten dapat diedit Platform Super Admin melalui CMS tanpa mengubah source.

---

# 1. PERAN DAN MISI AGEN

Anda bertindak sebagai satu tim yang terdiri atas:

- Principal Software Architect;
- Senior NestJS Engineer;
- Senior React Engineer;
- PostgreSQL dan Prisma Database Architect;
- ERP Business Analyst;
- Security Engineer;
- UI/UX Engineer;
- QA Automation Engineer;
- DevOps Engineer;
- Technical Writer.

Misi Anda adalah membangun **eBisnis.id** sebagai platform ERP, retail, POS, distribusi, manufaktur, keuangan, SDM, payroll, investor, dan SaaS multi-tenant dari nol.

Hasil tahap pertama wajib berupa aplikasi web yang:

1. dapat dijalankan pada localhost;
2. dapat login;
3. memiliki tenant, perusahaan, wilayah, outlet, dan gudang;
4. memiliki pengguna, role, menu tree, permission, dan scope data;
5. memiliki CRUD generik yang reusable;
6. memiliki master produk, UOM, pemasok, dan kebijakan stok;
7. memiliki Request Order otomatis karena stok minimum;
8. memiliki Purchase Order;
9. memiliki penerimaan barang dengan validasi;
10. memiliki Backorder yang dapat memakai pemasok yang sama atau pemasok lain;
11. memiliki Internal Transfer dan monitoring penerimaan;
12. memiliki monitoring stok berbentuk tree;
13. mempunyai Swagger/OpenAPI;
14. menghasilkan API client frontend melalui Orval;
15. mempunyai migration dan seed yang dapat dijalankan ulang pada database development;
16. mempunyai test backend, frontend, dan end-to-end dasar.
17. memiliki landing page publik, pendaftaran online, pengecekan username/schema,
    halaman login, dan tombol `Coba Demo`;
18. membuat schema tenant dan schema audit secara otomatis setelah pendaftaran;
19. memberikan username dan password sementara satu kali bila pengguna memilih
    pembuatan password otomatis;
20. menjalankan onboarding untuk membuat perusahaan/manajemen, brand, outlet,
    gudang, pemilik/investor, dan anggota manajemen;
21. menjamin pendaftar yang berbeda tidak membaca atau menulis schema tenant lain;
22. mendukung schema `demo` dan `demo__audit` untuk uji coba tanpa pendaftaran;
23. mencatat setiap CREATE, UPDATE, DELETE, login, permission change, export,
    posting, reversal, dan provisioning pada audit append-only.
24. memiliki akun `admin` sebagai Platform Super Admin development dengan forced password change;
25. memiliki portal Platform Administration untuk mengelola seluruh pendaftar dan schema;
26. memiliki pricing engine langganan POS dengan global price, tenant override, dan rule-based discount;
27. mendukung pembayaran per perangkat maupun invoice gabungan;
28. memiliki billing quote, invoice, payment order, callback, reconciliation, dan entitlement;
29. mengintegrasikan Esmartlink melalui adapter berdasarkan perilaku source Java terlampir;
30. mendukung `id`, `en`, `ar`, dan `zh-CN`, termasuk RTL untuk Bahasa Arab;
31. tidak memiliki label UI hard-coded yang menghalangi penambahan bahasa baru.


Jangan berhenti setelah membuat kerangka kosong. Selesaikan minimal vertical slice yang disebutkan di atas sampai dapat diuji melalui UI.

---

# 2. SUMBER KEBUTUHAN YANG WAJIB DIGABUNGKAN

Jika file berikut tersedia di workspace, baca seluruhnya sebelum mengubah kode:

```text
STRUKTUR_MENU_LENGKAP_EBISNIS_ID_ENHANCED_V2.md
MASTER_PROMPT_CODEX_CLAUDE_EBISNIS_ID.md
stock and Request Order.pdf
Penerimaan Barang dari pemasok dan Manufaktur.pdf
```

Gunakan kebutuhan berikut sebagai keputusan final:

1. Menu menggunakan struktur tree.
2. Menu **Kasir / POS** berada langsung pada root menu.
3. Hak akses minimal mendukung: `READ`, `CREATE`, `UPDATE`, `DELETE`, `SUBMIT`, `REVIEW`, `APPROVE`, `REJECT`, `CANCEL`, `PRINT`, `EXPORT`, `IMPORT`, `POST`, `CLOSE_PERIOD`, `REOPEN`, `VIEW_AMOUNT`, `VIEW_COST`, `VIEW_PROFIT`, dan `MANAGE_DEVICE`.
4. Request Order otomatis dipicu oleh stok minimum dan berlaku untuk toko, gudang utama, gudang toko/cabang, atau lokasi.
5. Hilangkan menu dan tipe khusus bernama **“Request Order karena Kekurangan Bahan Produksi”**.
6. Kekurangan bahan produksi menggunakan mekanisme umum: cek stok, rekomendasi transfer, Request Order umum, atau Purchase Request.
7. Request Order dikirim dari toko/gudang/lokasi kepada gudang parent/utama.
8. Gudang utama mengonsolidasikan Request Order dan membuat PO.
9. Saat memilih item PO, sistem menampilkan pemasok yang dapat memasok item tersebut.
10. Penerimaan barang tidak menambah stok sebelum divalidasi.
11. Penerimaan parsial dapat menghasilkan Backorder.
12. Backorder dapat ditujukan kepada pemasok awal atau pemasok pengganti.
13. Backorder menghasilkan PO baru yang tetap terlacak ke PO dan penerimaan sumber.
14. Barang yang telah divalidasi dialokasikan dan didistribusikan melalui Internal Transfer.
15. Gudang sumber dan tujuan dapat memonitor transfer.
16. Tujuan wajib memvalidasi penerimaan.
17. Monitoring stok dapat ditampilkan berbentuk tree, misalnya:

    ```text
    Wilayah A: 250 unit
    ├── Gudang Parent: 100 unit
    ├── Toko A: 50 unit
    └── Toko B: 100 unit
    ```

---



## 2.1. Konsep pendaftaran dari `ebisnis.jsp`

Gunakan `ebisnis.jsp` sebagai sumber perilaku dan field pendaftaran awal, tetapi bangun ulang
menggunakan React, React Hook Form, Zod, NestJS, dan API JSON.

Field pendaftaran minimum:

```text
namaBisnis
jenisBisnis
negara
provinsi
kotaKabupaten
kecamatan
alamat
kontakPerson
telpKontakPerson
telp
email
username yang diinginkan
password atau opsi generate password otomatis
konfirmasiPassword
persetujuanSyarat
persetujuanPrivasi
```

Halaman publik minimum:

```text
/
├── Landing Page
├── Daftar
├── Masuk
├── Cek Username
├── Coba Demo
├── Tentang
├── Harga/Paket
├── Privasi
└── Syarat Penggunaan
```

Pendaftaran harus dapat dilakukan tanpa login. Setelah provisioning sukses, pengguna menerima:

```text
registrationId
tenantId
username
schemaName
auditSchemaName
loginUrl
temporaryPassword hanya bila dibuat server dan hanya pada response pertama
mustChangePassword
```

Untuk MVP saat ini, opsi `generatePassword=true` harus menjadi default agar setelah pendaftaran
pengguna langsung memperoleh username dan temporary password. Tetap sediakan pilihan
`Saya ingin menentukan password sendiri` untuk mempertahankan perilaku yang ada pada
`ebisnis.jsp`.

Password yang dimasukkan sendiri tidak boleh dikembalikan oleh API. Password sementara yang
dibuat server hanya boleh ditampilkan satu kali, tidak disimpan dalam bentuk plaintext, dan
pengguna wajib menggantinya saat login pertama.

---

# 3. STACK TEKNOLOGI WAJIB

## 3.1. Backend

```text
Node.js
TypeScript strict mode
NestJS
Prisma ORM
PostgreSQL
JWT access token + refresh token rotation
Argon2 untuk password hashing
class-validator dan class-transformer
Swagger / OpenAPI
Pino structured logging
Helmet
CORS allowlist
Rate limiting
Jest
Supertest
Testcontainers atau database test terpisah
@nestjs/schedule
decimal.js
undici/native fetch untuk adapter Esmartlink
```

## 3.2. Frontend

```text
React
TypeScript strict mode
Vite
Refine Core
shadcn/ui
Tailwind CSS
TanStack Query
TanStack Table
React Hook Form
Zod
React Router
Orval
Lucide Icons
date-fns
Recharts atau Apache ECharts
Vitest
React Testing Library
Playwright
MSW
i18next
react-i18next
i18next-browser-languagedetector
```

## 3.3. Package manager dan workspace

Gunakan `pnpm workspaces`. Jangan menambahkan framework komersial atau komponen yang membutuhkan lisensi berbayar.

---

# 4. ARSITEKTUR TARGET

Gunakan **modular monolith** untuk API, tetapi gunakan arsitektur data **control plane +
schema-per-tenant**.

```mermaid
flowchart LR
    B[Browser] --> W[React + Vite]
    W --> A[NestJS API]
    A --> CP[Platform Prisma Client]
    A --> TF[Tenant Prisma Client Factory]
    A --> PR[Schema Provisioner]
    A --> AUD[Audit Context & Trigger Manager]

    CP --> PS[(platform)]
    CP --> PA[(platform__audit)]

    TF --> TS1[(joni_utama)]
    TF --> TA1[(joni_utama__audit)]
    TF --> TS2[(tenant_lain)]
    TF --> TA2[(tenant_lain__audit)]

    PR --> TS1
    PR --> TA1
    PR --> TS2
    PR --> TA2
```

## 4.1. Control plane global

Buat schema:

```text
platform
platform__audit
```

Schema `platform` menyimpan:

```text
registrations
users
credentials
tenant_registry
tenant_schema_registry
tenant_memberships
provisioning_jobs
schema_migration_catalog
tenant_schema_migration_history
global_menu_templates
global_permission_actions
subscription_plans
billing_control
app_releases
global_reference_data
```

Schema `platform__audit` menyimpan audit untuk:

```text
registration
login
logout
password change
tenant provisioning
schema creation
schema migration
schema failure
user membership
platform role
subscription
payment callback
demo access
security event
```

## 4.2. Data plane per pendaftar

Setiap pendaftar yang berhasil diprovision mempunyai tepat dua schema:

```text
<tenant_schema>
<tenant_schema>__audit
```

Contoh:

```text
Pendaftar : Joni Utama
Username  : joni_utama
ERP schema: joni_utama
Audit     : joni_utama__audit
```

Schema ERP tenant berisi seluruh tabel operasional:

```text
organization
brand
outlet
warehouse
catalog
customer
supplier
sales
purchasing
inventory
manufacturing
accounting
hr
payroll
asset
workflow
report settings
```

Schema audit tenant berisi audit append-only untuk seluruh perubahan pada schema ERP tersebut.

## 4.3. Control plane adalah sumber kebenaran

Username tidak boleh langsung dijadikan satu-satunya cara menemukan schema. Simpan pemetaan
immutable pada `platform.tenant_schema_registry`:

```text
tenantId
registrationId
username
schemaName
auditSchemaName
schemaVersion
status
provisionedAt
lastMigratedAt
```

Setelah login:

```mermaid
sequenceDiagram
    participant U as User
    participant API as NestJS API
    participant P as platform
    participant F as TenantClientFactory
    participant T as Tenant Schema

    U->>API: username/email + password
    API->>P: validasi user dan membership
    P-->>API: tenantId + schemaName
    API->>F: getClient(schemaName)
    F->>F: validasi schema dari registry
    F-->>API: tenant-scoped client
    API->>T: query hanya pada schema terpilih
    T-->>API: data tenant
    API-->>U: token + context
```

## 4.4. Keputusan implementasi Prisma

Prisma multi-schema deklaratif cocok untuk schema yang namanya telah diketahui saat generate.
Karena schema tenant dibuat dinamis setelah pendaftaran, jangan mendaftarkan setiap nama tenant
ke `schemas = [...]` pada satu Prisma schema.

Gunakan dua model/client:

```text
PlatformPrismaClient
└── schema tetap: platform dan platform__audit

TenantPrismaClient
└── model tenant generik tanpa nama tenant hard-coded
```

Buat `TenantPrismaClientFactory` yang:

1. hanya menerima `schemaName` dari `platform.tenant_schema_registry`;
2. tidak menerima nama schema langsung dari body/query/header pengguna;
3. memvalidasi identifier menggunakan regex ketat;
4. membuat connection string/search path tenant secara aman;
5. menyimpan cache client terbatas dengan LRU dan idle eviction;
6. tidak membuat PrismaClient baru untuk setiap request tanpa cache;
7. melakukan disconnect ketika client dikeluarkan dari cache;
8. menguji bahwa query tidak pernah jatuh ke `public`.

Bila Prisma/driver versi aktual tidak mendukung penggantian schema pada runtime secara aman,
gunakan repository tenant berbasis `pg` untuk bagian dinamis, tetapi Prisma tetap digunakan
untuk model, migration platform, DTO, dan modul yang kompatibel. Dokumentasikan ADR dan jangan
memalsukan dukungan yang tidak ada.

## 4.5. Migration tenant

Prisma Migrate digunakan untuk control plane. Schema tenant menggunakan **canonical tenant
migration catalog** yang dijalankan Schema Provisioner.

```text
apps/api/prisma/platform/
├── schema.prisma
└── migrations/

apps/api/prisma/tenant/
├── schema.prisma
└── generated/

apps/api/tenant-migrations/
├── V001__tenant_core.sql
├── V002__organization_access.sql
├── V003__catalog_crm.sql
├── V004__sales_purchasing.sql
├── V005__inventory_manufacturing.sql
├── V006__accounting_hr_payroll.sql
├── V007__asset_workflow_integration.sql
├── V008__audit_triggers.sql
└── manifest.json
```

Migration SQL boleh memakai placeholder internal:

```text
{{TENANT_SCHEMA}}
{{AUDIT_SCHEMA}}
```

Placeholder hanya diganti setelah identifier tervalidasi. Gunakan quoting identifier yang aman.
Jangan menerima SQL atau identifier bebas dari client.

Setiap tenant menyimpan riwayat di `platform.tenant_schema_migration_history`.

## 4.6. Sandbox demo

Buat schema:

```text
demo
demo__audit
```

Tombol `Coba Demo` membuat sesi role `DEMO_USER` tanpa pendaftaran.

Aturan demo:

- tidak boleh memasukkan data pribadi atau rahasia;
- data dianggap sementara;
- ekspor, integrasi, pembayaran nyata, pengaturan user, dan aksi sensitif dinonaktifkan;
- data demo di-reset terjadwal;
- reset dicatat pada `platform__audit`;
- UI menampilkan banner bahwa sandbox dipakai bersama;
- akun demo tidak boleh memperoleh akses ke schema tenant nyata.

Seed demo wajib lengkap dan dapat diulang secara idempotent.

---
# 5. ATURAN KERJA AGEN YANG TIDAK BOLEH DILANGGAR

1. Jangan hanya menulis rencana. Buat dan jalankan project.
2. Jangan mengklaim berhasil jika command, migration, atau test tidak dijalankan.
3. Setiap kegagalan command harus dianalisis dan diperbaiki.
4. Jangan menyimpan password database di SVN. Buat `.env`, lalu masukkan `.env` ke properti `svn:ignore` melalui `.svnignore`.
5. Nilai koneksi lokal yang diminta tetap digunakan pada `.env` development.
6. Jangan menggunakan `prisma db push` sebagai workflow utama. Gunakan migration berversi.
7. Jangan menjalankan `migrate reset` tanpa memastikan environment development.
8. Jangan menggunakan `number` JavaScript untuk perhitungan uang final.
9. Gunakan `Prisma.Decimal`, string decimal pada kontrak API, atau utility decimal yang aman.
10. Tabel control plane memakai `tenantId`; tabel ERP tenant berada di schema tenant dan tidak wajib menduplikasi `tenantId`. Schema registry adalah sumber kebenaran pemetaan tenant.
11. Semua query bisnis wajib terscope tenant.
12. Semua unique constraint bisnis harus mempertimbangkan tenant/perusahaan.
13. Semua endpoint terlindungi secara default, kecuali endpoint yang ditandai public.
14. Jangan mengembalikan password hash, refresh token, secret, atau data sensitif.
15. Gunakan soft delete untuk master data yang telah dipakai transaksi.
16. Dokumen transaksi yang telah diposting tidak boleh dihapus; gunakan cancel, reverse, atau adjustment.
17. Mutasi persediaan bersifat immutable.
18. Jurnal yang telah diposting bersifat immutable.
19. Semua operasi finansial, stok, pembayaran, dan sync harus idempotent.
20. Gunakan transaksi database untuk proses yang mengubah beberapa tabel.
21. Hindari giant service dan giant controller.
22. Gunakan DTO eksplisit, validation pipe, exception filter, interceptor, guard, dan policy.
23. Semua halaman harus responsif.
24. Semua list utama mendukung pencarian, filter, sorting, pagination, column visibility, dan saved view.
25. Semua perubahan penting harus masuk audit log.
26. Gunakan Bahasa Indonesia pada label UI; gunakan Bahasa Inggris untuk nama class, model, field, endpoint, dan file.
27. Jangan membangun seluruh ERP sebagai satu generic CRUD. Bedakan master CRUD, document transaction, dan custom business screen.

---

# 6. STRUKTUR REPOSITORY YANG WAJIB DIBUAT

```text
ebisnis/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── shared/
│   ├── ui/
│   ├── crud-engine/
│   ├── document-engine/
│   ├── permission-engine/
│   └── api-client/
├── docs/
│   ├── architecture/
│   ├── database/
│   ├── modules/
│   ├── api/
│   ├── diagrams/
│   └── runbooks/
├── scripts/
├── pnpm-workspace.yaml
├── package.json
├── .svnignore
├── .editorconfig
├── README.md
└── MASTER_PROMPT_EBISNIS.md
```

Backend dan frontend wajib mengikuti struktur feature/module yang konsisten. Prisma schema dipisahkan per domain menggunakan multi-file schema dalam `apps/api/prisma/schema/`.

---

# 7. PEMERIKSAAN ENVIRONMENT

Sebelum membuat project, jalankan dan catat hasil:

```bash
node --version
npm --version
pnpm --version || true
psql --version
svn --version
```

Jika pnpm belum tersedia:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Uji koneksi PostgreSQL:

```bash
PGPASSWORD="$PGPASSWORD" psql \
  -h localhost \
  -p 5432 \
  -U root \
  -d ebisnis \
  -c 'select current_database(), current_user, version();'
```

Jika role atau database belum tersedia dan agen mempunyai akses superuser lokal, buat secara aman. Jangan menjalankan `sudo` jika environment tidak mengizinkan; laporkan blocker dan berikan command manual.

---

# 8. KONFIGURASI ENVIRONMENT

Buat `apps/api/.env`:

```dotenv
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/ebisnis?schema=public
DIRECT_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/ebisnis?schema=public
JWT_ACCESS_SECRET=change-this-local-access-secret-minimum-32-characters
JWT_REFRESH_SECRET=change-this-local-refresh-secret-minimum-32-characters
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=debug
APP_NAME=eBisnis.id
APP_URL=http://localhost:3000
WEB_URL=http://localhost:5173

PLATFORM_SCHEMA=platform
PLATFORM_AUDIT_SCHEMA=platform__audit
DEMO_SCHEMA=demo
DEMO_AUDIT_SCHEMA=demo__audit
TENANT_SCHEMA_SUFFIX_AUDIT=__audit
TENANT_SCHEMA_BASE_MAX_LENGTH=48
TENANT_CLIENT_CACHE_MAX=50
TENANT_CLIENT_IDLE_TTL_SECONDS=900
DEMO_RESET_CRON=0 */6 * * *

BOOTSTRAP_SUPER_ADMIN_USERNAME=admin
BOOTSTRAP_SUPER_ADMIN_PASSWORD=<BOOTSTRAP_PASSWORD>
BOOTSTRAP_SUPER_ADMIN_FORCE_PASSWORD_CHANGE=true

DEFAULT_LOCALE=id
SUPPORTED_LOCALES=id,en,ar,zh-CN

DEFAULT_POS_MONTHLY_PRICE_IDR=250000
DEFAULT_POS_TRIAL_DAYS=30

ESMARTLINK_ENABLED=false
ESMARTLINK_BASE_URL=
ESMARTLINK_MERCHANT_ID=
ESMARTLINK_CLIENT_ID=
ESMARTLINK_CLIENT_SECRET=
ESMARTLINK_CALLBACK_URL=http://localhost:3000/api/v1/payments/esmartlink/callback
ESMARTLINK_ALLOWED_IPS=
ESMARTLINK_TRUST_PROXY=false
ESMARTLINK_CALLBACK_ACK_SUCCESS=OK
ESMARTLINK_CALLBACK_ACK_ERROR=ERROR
ESMARTLINK_RAW_PAYLOAD_RETENTION_DAYS=90
```

Buat `apps/web/.env`:

```dotenv
VITE_APP_NAME=eBisnis.id
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_OPENAPI_URL=http://localhost:3000/api-json
VITE_ENABLE_MOCKS=false
VITE_DEFAULT_LOCALE=id
VITE_SUPPORTED_LOCALES=id,en,ar,zh-CN
```

Buat `.env.example` tanpa secret sebenarnya. Pastikan `.env` tidak masuk SVN.

---

# 9. BOOTSTRAP PROJECT

Gunakan Nest CLI, Vite, Prisma, dan shadcn CLI yang kompatibel dengan versi terpasang. Gunakan TypeScript strict mode.

Workflow migration development wajib:

```bash
pnpm prisma format
pnpm prisma validate
pnpm prisma migrate dev --name init_ebisnis
pnpm prisma generate
pnpm prisma db seed
```

Jangan berasumsi bahwa `migrate dev` otomatis menjalankan `generate` atau seed. Jalankan keduanya secara eksplisit.

NestJS wajib menyediakan:

- global validation pipe;
- global exception filter;
- response envelope interceptor;
- request/correlation ID;
- Swagger pada `/docs`;
- OpenAPI JSON pada `/api-json`;
- Helmet;
- CORS allowlist;
- API prefix `/api/v1`;
- structured logger;
- graceful shutdown.

Frontend wajib menyediakan:

- Refine Core;
- React Router;
- TanStack Query dan Devtools hanya untuk development;
- shadcn/ui;
- Tailwind CSS;
- TanStack Table;
- React Hook Form + Zod;
- Orval generated client;
- responsive desktop/tablet/mobile layout;
- dark mode;
- command palette;
- breadcrumb;
- notification center.

---

# 10. KONTRAK API DAN ORVAL

NestJS menjadi sumber kebenaran OpenAPI. Orval menghasilkan TypeScript model dan TanStack Query hooks dari `http://localhost:3000/api-json`.

Jangan menulis ulang DTO frontend secara manual jika model sudah tersedia dari OpenAPI.

---

# 11. KONVENSI DATABASE DAN PRISMA

## 11.1. ID

Gunakan UUID:

```prisma
id String @id @default(uuid()) @db.Uuid
```

## 11.2. Audit field

Model master dan transaksi pada umumnya memiliki:

```prisma
createdAt DateTime  @default(now()) @db.Timestamptz(6)
createdBy String?   @db.Uuid
updatedAt DateTime  @updatedAt @db.Timestamptz(6)
updatedBy String?   @db.Uuid
deletedAt DateTime? @db.Timestamptz(6)
deletedBy String?   @db.Uuid
version   Int       @default(1)
```

## 11.3. Uang dan kuantitas

```prisma
amount   Decimal @db.Decimal(19, 4)
quantity Decimal @db.Decimal(19, 6)
rate     Decimal @db.Decimal(19, 8)
```

Serialisasikan decimal sebagai string pada API.

## 11.4. Tenant isolation dan schema naming

### Control plane

Model pada schema `platform` menggunakan `tenantId` saat berhubungan dengan tenant.

### Tenant ERP schema

Model pada schema ERP tenant tidak wajib mempunyai `tenantId`, karena namespace schema adalah
batas isolasi. Model tetap mempunyai scope internal seperti:

```text
legalEntityId
brandId
regionId
outletId
warehouseId
departmentId
```

### Schema name

Nama schema dasar berasal dari username yang telah dinormalisasi, lalu disimpan secara immutable.

Algoritma:

1. trim;
2. transliterasi karakter Latin yang wajar;
3. lowercase;
4. spasi dan tanda hubung menjadi `_`;
5. hapus karakter selain `a-z`, `0-9`, `_`;
6. gabungkan underscore berulang;
7. harus diawali huruf;
8. panjang 3–48 karakter;
9. schema audit adalah `<base>__audit`;
10. tolak reserved name.

Regex final:

```regex
^[a-z][a-z0-9_]{2,47}$
```

Reserved name minimal:

```text
public
platform
platform__audit
demo
demo__audit
postgres
information_schema
pg_catalog
pg_toast
pg_temp
root
admin
system
tenant_template
```

Nama yang diawali `pg_` wajib ditolak.

`admin` tetap berada pada daftar reserved name karena digunakan oleh Platform Super Admin.
Pendaftar tidak boleh menghasilkan schema `admin` atau `admin__audit`.

### Uniqueness

Sebelum provisioning, cek atomik:

```text
platform.users.username
platform.tenant_schema_registry.schema_name
pg_namespace.nspname
```

Gunakan PostgreSQL advisory lock atau lock row registry agar dua pendaftaran bersamaan tidak
membuat schema yang sama.

Jika nama sudah ada:

- jangan membuat schema baru;
- jangan menambahkan suffix secara diam-diam;
- kembalikan error `USERNAME_OR_SCHEMA_ALREADY_EXISTS`;
- berikan saran nama alternatif, tetapi pengguna harus memilih dan mengirim ulang.

### Security

- runtime tidak boleh percaya schema dari JWT saja; cocokkan dengan registry;
- schema harus selalu schema-qualified atau melalui tenant client yang terikat;
- `public` tidak boleh menjadi fallback;
- revoke `CREATE ON SCHEMA public FROM PUBLIC`;
- jangan memasukkan schema yang writable oleh user tidak tepercaya ke `search_path`.
## 11.5. Naming

- Model Prisma: `PascalCase`.
- Field: `camelCase`.
- Tabel PostgreSQL: `snake_case` melalui `@@map`.
- Gunakan explicit relation model untuk many-to-many yang mempunyai metadata.
- Gunakan `onDelete: Restrict` pada relasi master yang telah dipakai transaksi.


## 11.6. Audit model seperti Envers

Gunakan audit hybrid yang scalable.

### Tabel audit generik pada setiap `<tenant>__audit`

```text
audit_event
audit_row_change
audit_security_event
audit_export_event
audit_permission_change
audit_posting_event
audit_schema_migration
```

`audit_event` minimal:

```text
id UUID
occurred_at TIMESTAMPTZ
tenant_id UUID
tenant_schema VARCHAR
request_id VARCHAR
correlation_id VARCHAR
actor_user_id UUID
actor_username VARCHAR
actor_role_codes JSONB
session_id UUID
device_id UUID
ip_address INET
user_agent TEXT
module_code VARCHAR
action_code VARCHAR
entity_type VARCHAR
entity_id VARCHAR
document_number VARCHAR
result VARCHAR
reason TEXT
metadata JSONB
```

`audit_row_change` minimal:

```text
id UUID
audit_event_id UUID
table_schema VARCHAR
table_name VARCHAR
row_pk JSONB
operation INSERT|UPDATE|DELETE
old_data JSONB
new_data JSONB
changed_columns JSONB
transaction_id BIGINT
statement_timestamp TIMESTAMPTZ
```

Buat trigger DML untuk seluruh tabel tenant yang perlu diaudit. Trigger membaca context yang
disetel aplikasi pada transaksi:

```sql
SELECT set_config('app.request_id', :requestId, true);
SELECT set_config('app.user_id', :userId, true);
SELECT set_config('app.username', :username, true);
SELECT set_config('app.ip_address', :ipAddress, true);
SELECT set_config('app.action_code', :actionCode, true);
```

Audit bersifat append-only:

- role runtime tidak memiliki UPDATE/DELETE pada audit schema;
- perubahan audit hanya melalui retention job terotorisasi;
- payload sensitif harus dimask;
- password, token, PIN, secret, dan data kartu tidak boleh masuk old/new JSON;
- DELETE tetap tercatat meskipun master memakai soft delete;
- posting dan reversal mempunyai event bisnis terpisah.

Pada provisioning tenant `joni_utama`, buat:

```text
joni_utama
joni_utama__audit
```

Lalu pasang trigger audit setelah tabel tenant selesai dibuat.

## 11.7. Schema provisioning state machine

```mermaid
stateDiagram-v2
    [*] --> REQUESTED
    REQUESTED --> VALIDATING
    VALIDATING --> RESERVED
    RESERVED --> CREATING_SCHEMAS
    CREATING_SCHEMAS --> APPLYING_MIGRATIONS
    APPLYING_MIGRATIONS --> INSTALLING_AUDIT
    INSTALLING_AUDIT --> SEEDING
    SEEDING --> CREATING_OWNER
    CREATING_OWNER --> READY
    VALIDATING --> FAILED
    CREATING_SCHEMAS --> FAILED
    APPLYING_MIGRATIONS --> FAILED
    INSTALLING_AUDIT --> FAILED
    SEEDING --> FAILED
    CREATING_OWNER --> FAILED
    FAILED --> RETRYING
    RETRYING --> VALIDATING
```

Urutan wajib:

1. validasi field pendaftaran;
2. reserve username dan schema pada platform;
3. buat tenant registry status `PROVISIONING`;
4. create schema ERP;
5. create schema audit;
6. apply seluruh tenant migration;
7. install audit functions/triggers;
8. seed default tenant;
9. buat owner user dan membership;
10. verifikasi tabel, migration version, seed, dan login;
11. set status `READY`;
12. baru kembalikan credential.

Jika gagal:

- status menjadi `FAILED`;
- simpan stage dan error aman;
- jangan mengembalikan credential aktif;
- retry melanjutkan dari state/checksum yang benar;
- cleanup hanya melalui command admin terkontrol.

---


## 11.7A. Kontrak kolom standar tabel master

```prisma
id              String    @id @default(uuid()) @db.Uuid
code            String
name            String
description     String?
isActive        Boolean   @default(true)
isSystem        Boolean   @default(false)
isSample        Boolean   @default(false)
sampleBatchId   String?   @db.Uuid
sortOrder       Int       @default(0)
metadata        Json?
createdAt       DateTime  @default(now()) @db.Timestamptz(6)
createdBy       String?   @db.Uuid
updatedAt       DateTime  @updatedAt @db.Timestamptz(6)
updatedBy       String?   @db.Uuid
deactivatedAt   DateTime? @db.Timestamptz(6)
deactivatedBy   String?   @db.Uuid
deletedAt       DateTime? @db.Timestamptz(6)
deletedBy       String?   @db.Uuid
deleteReason    String?
version         Int       @default(1)
```

Master yang tidak mempunyai `code`/`name` literal wajib mempunyai business key setara.

Index minimum:

```text
UNIQUE(scope..., code) WHERE deleted_at IS NULL
INDEX(is_active, deleted_at)
INDEX(created_at)
INDEX(updated_at)
INDEX(is_sample, sample_batch_id)
```

## 11.7B. Endpoint lifecycle master

```text
GET    /resource
GET    /resource/:id
POST   /resource
PATCH  /resource/:id
POST   /resource/:id/deactivate
POST   /resource/:id/activate
DELETE /resource/:id
POST   /resource/:id/restore
POST   /resource/:id/purge
GET    /resource/:id/references
GET    /resource/:id/audit
```

`DELETE` melakukan soft delete. `purge` hanya tersedia bila resource definition mengizinkan.

## 11.7C. Master Seed Registry

```typescript
defineMasterSeed({
  resourceCode: "PRODUCT_CATEGORY",
  minimumRecords: 10,
  strategy: "UPSERT_BY_CODE",
  tenantScoped: true,
  supportsSampleCleanup: true,
  records: []
});
```

Command:

```bash
pnpm seed:platform
pnpm seed:tenant --schema demo
pnpm seed:tenant --schema <tenant>
pnpm seed:verify --schema <tenant>
pnpm seed:repair --schema <tenant>
```

Quality gate gagal bila master wajib mempunyai kurang dari 10 record aktif.

---

# 12. STRUKTUR MODEL ERP YANG WAJIB DIBUAT

Agen wajib membuat model Prisma lengkap, relasi, constraint, index, migration, dan seed untuk katalog pada bagian berikut. Jangan membuat semua model dalam satu file besar.


## 12.0A. Public Website dan Content Management System

Model CMS berada pada schema `platform`.

| Model | Kolom khusus dan relasi |
|---|---|
| `Website` | `code`, `name`, `primaryDomain`, `defaultLocaleCode`, `themeCode`, `isActive`; relasi page/navigation/footer. |
| `WebsiteDomain` | `websiteId`, `domain`, `isPrimary`, `sslRequired`, `redirectToPrimary`. |
| `CmsPage` | `websiteId`, `parentId`, `slug`, `pageType`, `templateCode`, `status`, `publishedVersionId`, `showInNavigation`, `isActive`. |
| `CmsPageVersion` | `pageId`, `versionNumber`, `title`, `summary`, SEO fields, `status`, `publishedAt`, `publishedBy`. |
| `CmsPageTranslation` | `pageVersionId`, `localeCode`, title/summary/SEO terlokalisasi. |
| `CmsBlock` | `pageVersionId`, `parentBlockId`, `blockType`, `blockKey`, `layout`, `settings Json`, `sortOrder`, `isActive`. |
| `CmsBlockTranslation` | `blockId`, `localeCode`, heading/subheading/body/button/content. |
| `CmsNavigation` | `websiteId`, `code`, `name`, `location`, `isActive`. |
| `CmsNavigationItem` | `navigationId`, `parentId`, `labelKey`, `pageId`, `externalUrl`, `icon`, `target`, `sortOrder`. |
| `CmsFooterSection` | `websiteId`, `code`, `titleKey`, `sortOrder`, `isActive`. |
| `CmsFooterItem` | `footerSectionId`, `labelKey`, `url`, `icon`, `sortOrder`, `isActive`. |
| `NewsCategory` | `parentId`, `code`, `nameKey`, `slug`, `isActive`. |
| `NewsArticle` | `categoryId`, `authorUserId`, `slug`, `status`, `featuredImageId`, `publishedAt`, `expiredAt`, `isFeatured`, `isPinned`. |
| `NewsArticleVersion` | `articleId`, `versionNumber`, `title`, `summary`, `content`, `status`. |
| `NewsArticleTranslation` | `articleVersionId`, `localeCode`, title/summary/content/SEO. |
| `NewsTag` | `code`, `nameKey`, `slug`, `isActive`. |
| `NewsArticleTag` | `articleId`, `tagId`; unique. |
| `Announcement` | `titleKey`, `bodyKey`, `severity`, `audienceType`, `startsAt`, `endsAt`, `isDismissible`, `isActive`. |
| `HeroSlide` | `websiteId`, title/subtitle keys, media, CTA, sort order. |
| `MarketingFeature` | `moduleCode`, title/description keys, icon, image, sort order. |
| `FaqCategory` | `code`, `nameKey`, `sortOrder`, `isActive`. |
| `FaqItem` | `categoryId`, `questionKey`, `answerKey`, `sortOrder`, `isActive`. |
| `Testimonial` | person, organization, role, quote key, avatar, rating, sort order. |
| `PartnerLogo` | name, URL, media, sort order, active. |
| `PricingDisplaySection` | website, title/description, display mode; membaca package published. |
| `CallToAction` | code, title/body/button keys, URL, style, active. |
| `ContactOffice` | name, address, phone, email, map URL, hours, active. |
| `ContactMessage` | name, email, phone, subject, message, status, assignedTo, respondedAt. |
| `NewsletterSubscriber` | email, locale, status, subscribed/unsubscribed timestamps. |
| `MediaFolder` | parent, code, name, active. |
| `MediaAsset` | folder, storage key, filename, MIME, size, checksum, dimensions, alt key, public, active. |
| `RedirectRule` | website, source path, target URL, HTTP status, validity, active. |
| `CmsPublicationWorkflow` | entity type/id, status, submit/review/publish actor and timestamps. |
| `CmsPreviewToken` | entity type/id, token hash, expiry, creator. |
| `SeoStructuredData` | page, schema type, JSON data, active. |

CMS status:

```text
DRAFT
IN_REVIEW
APPROVED
SCHEDULED
PUBLISHED
ARCHIVED
REJECTED
```

Public API:

```text
GET  /api/v1/public/site
GET  /api/v1/public/pages/:slug
GET  /api/v1/public/navigation
GET  /api/v1/public/news
GET  /api/v1/public/news/:slug
GET  /api/v1/public/announcements
GET  /api/v1/public/faqs
GET  /api/v1/public/packages
POST /api/v1/public/contact
POST /api/v1/public/newsletter/subscribe
```

CMS admin wajib menyediakan page builder berbasis blok, media library, berita, pengumuman,
FAQ, navigation, SEO, preview, approval, scheduling, dan publication history.

Rich text harus disanitasi. Database tidak boleh menyimpan JavaScript executable dari editor.

---

## 12.1. Control Plane, Registration, Schema Registry, dan Provisioning

Buat model control plane pada `apps/api/prisma/platform/`.

| Model | Fungsi dan kolom penting |
|---|---|
| `Registration` | Pendaftaran publik. `businessName`, `businessType`, alamat/wilayah, PIC, telepon, email, desiredUsername, status, source, termsAcceptedAt, privacyAcceptedAt`. |
| `RegistrationCredentialDelivery` | Catatan bahwa credential sementara ditampilkan/dikirim satu kali; tidak menyimpan password plaintext. |
| `PlatformUser` | Identitas login global. `username`, `email`, `phone`, `displayName`, `passwordHash`, `status`, `mustChangePassword`, `lastLoginAt`. |
| `PlatformUserProfile` | Profil pengguna global. |
| `Tenant` | Registry pelanggan SaaS. `code`, `name`, `slug`, `status`, trial, locale, timezone. |
| `TenantSchemaRegistry` | Pemetaan immutable. `tenantId`, `username`, `schemaName`, `auditSchemaName`, `schemaVersion`, status dan timestamp. |
| `TenantMembership` | Hubungan global user dengan tenant dan tenant-local subject. |
| `ProvisioningJob` | State machine provisioning, attempt, currentStage, errorCode, retryAt. |
| `ProvisioningStep` | Detail hasil setiap step dan checksum. |
| `SchemaMigrationCatalog` | Daftar versi canonical migration tenant. |
| `TenantSchemaMigrationHistory` | Migration yang telah diterapkan pada setiap schema. |
| `SchemaNameReservation` | Reservasi username/schema untuk mencegah race condition. |
| `PlatformRefreshToken` | Refresh token hash-only dan rotation family. |
| `PlatformLoginAttempt` | Audit/rate limit login. |
| `PlatformSession` | Sesi user. |
| `DemoSession` | Sesi anonymous sandbox, expiry, rate limit, reset generation. |
| `DemoResetRun` | Riwayat reset schema demo. |
| `GlobalPermissionAction` | Template action global. |
| `GlobalMenuTemplate` | Template tree menu untuk disalin/di-seed ke tenant. |
| `GlobalRoleTemplate` | Template role dan permission awal. |
| `SubscriptionPlan` | Paket SaaS global. |
| `PlatformSetting` | Konfigurasi platform. |
| `PlatformRole` | Role super admin/support/billing/auditor. |
| `PlatformPermission` | Permission global. |
| `PlatformRolePermission` | Matrix permission global. |
| `PlatformUserRole` | Role assignment global. |
| `PlatformSupportSession` | Context akses schema tenant dengan alasan dan expiry. |
| `Locale` | Locale global, direction, fallback, status. |
| `TranslationNamespace` | Kelompok translation key. |
| `TranslationKey` | Key stabil lintas bahasa. |
| `TranslationValue` | Nilai translation per locale. |
| `TenantTranslationOverride` | Override locale tenant. |
| `SubscriptionProduct` | Produk SaaS seperti lisensi perangkat POS. |
| `ModuleCatalog` | Katalog modul ERP global. |
| `FeatureCatalog` | Katalog fitur granular per modul. |
| `SubscriptionPlanModule` | Modul dalam versi paket. |
| `SubscriptionPlanFeature` | Feature dan limit dalam paket. |
| `SubscriptionPlanPriceTier` | Harga bertingkat berdasarkan quantity. |
| `SubscriptionPlanConstraint` | Constraint perangkat/outlet/user/storage. |
| `SubscriptionAddOn` | Add-on opsional. |
| `SubscriptionAddOnVersion` | Versi immutable add-on. |
| `SubscriptionAddOnModule` | Modul/feature add-on. |
| `SubscriptionAddOnPrice` | Harga add-on. |
| `TenantPlanContract` | Kontrak paket khusus tenant. |
| `TenantPlanModuleOverride` | Include/exclude module khusus tenant. |
| `PackageAssignment` | Paket per tenant/outlet/device. |
| `EntitlementSnapshot` | Hak efektif hasil kalkulasi. |
| `SubscriptionPlanVersion` | Versi immutable paket. |
| `SubscriptionPrice` | Harga per device/periode. |
| `TenantPriceOverride` | Harga khusus tenant. |
| `DiscountProgram` | Program diskon/promo. |
| `DiscountRule` | Rule diskon tervalidasi. |
| `DiscountConditionGroup` | Grup kondisi AND/OR. |
| `DiscountCondition` | Kondisi whitelist. |
| `DiscountBenefit` | Benefit diskon. |
| `PricingQuote` | Quote hasil kalkulasi. |
| `PricingQuoteLine` | Detail perangkat/kuantitas. |
| `PricingAdjustment` | Snapshot diskon/override. |
| `PosDevice` | Registry perangkat POS global. |
| `DeviceEntitlement` | Hak fitur/masa aktif per perangkat. |
| `Subscription` | Kontrak langganan tenant. |
| `SubscriptionItem` | Subscription line per perangkat. |
| `BillingInvoice` | Invoice immutable. |
| `BillingInvoiceLine` | Snapshot harga/diskon/device. |
| `BillingPaymentAllocation` | Alokasi pembayaran. |
| `PaymentProvider` | Provider pembayaran. |
| `PaymentChannel` | Channel dan biaya admin. |
| `PaymentOrder` | Order/VA Esmartlink. |
| `PaymentAttempt` | Percobaan create/inquiry/retry. |
| `PaymentCallbackEvent` | Callback immutable dan idempotent. |
| `HostToHostLog` | Log semua inbound request provider. |
| `PaymentReconciliationRun` | Rekonsiliasi pembayaran. |

Constraint wajib:

```text
PlatformUser.username UNIQUE
PlatformUser.email normalized UNIQUE sesuai kebijakan
Tenant.slug UNIQUE
TenantSchemaRegistry.schemaName UNIQUE
TenantSchemaRegistry.auditSchemaName UNIQUE
SchemaNameReservation.normalizedName UNIQUE
Registration.desiredUsername INDEX
```

Jangan menyimpan password plaintext pada tabel apa pun.

## 12.1A. Organisasi dan wilayah pada schema tenant

| Model | Fungsi dan kolom penting |
|---|---|
| `BusinessGroup` | Grup usaha. `code`, `name`, `parentId`, `status`. |
| `LegalEntity` | Perusahaan/manajemen/badan hukum. `businessGroupId`, `code`, `legalName`, `tradeName`, `legalForm`, `taxNumber`, `addressId`, `fiscalYearStartMonth`. |
| `Brand` | Merek/judul komersial. `legalEntityId`, `code`, `name`, `logoFileId`, `status`. |
| `Region` | Tree wilayah internal. `parentId`, `type`, `code`, `name`, `path`, `level`. |
| `Branch` | Cabang. |
| `Outlet` | Toko, outlet, kafe, restoran, gerai, kantor, atau lokasi operasional. |
| `OutletType` | `STORE`, `OUTLET`, `CAFE`, `RESTAURANT`, `KIOSK`, `CANTEEN`, `OFFICE`, `FACTORY`, `CENTRAL_KITCHEN`, `OTHER`. |
| `Department` | Departemen perusahaan. |
| `OperatingUnit` | Pabrik, dapur pusat, kantor, atau unit lain. |
| `Address` | Alamat reusable tenant. |
| `FiscalPeriod` | Periode akuntansi perusahaan. |
| `BusinessCalendar` | Kalender kerja. |
| `BusinessCalendarDay` | Hari kerja/libur. |
| `NumberSequence` | Penomoran dokumen tenant. |
| `FileObject` | Metadata attachment. |
| `EntityAttachment` | Relasi file dengan entity. |
| `AppSetting` | Setting tenant/perusahaan/outlet. |

Referensi global negara, mata uang, dan timezone dapat berada di platform lalu disalin menjadi
snapshot/reference tenant bila diperlukan.
## 12.2. Pengguna, Role, Menu, Hak Akses, dan Membership

Autentikasi utama berada di schema `platform`, sedangkan otorisasi ERP berada di schema tenant.

Pada tenant schema buat:

| Model | Fungsi dan kolom penting |
|---|---|
| `UserSubject` | Proyeksi user global pada tenant. `platformUserId`, `usernameSnapshot`, `displayName`, `status`. |
| `Role` | Role tenant. `code`, `name`, `description`, `roleType`, `isSystem`, `status`. |
| `PermissionAction` | Copy/template action yang berlaku pada tenant. |
| `Menu` | Tree menu tenant. |
| `MenuAction` | Aksi yang tersedia pada menu. |
| `RoleMenuPermission` | `ALLOW`, `DENY`, atau `INHERIT`. |
| `RoleScope` | Scope company/brand/region/outlet/warehouse/department/self/subordinate. |
| `UserRoleAssignment` | Penugasan role tenant kepada `UserSubject`. |
| `UserDirectPermission` | Pengecualian terkontrol. |
| `Delegation` | Delegasi sementara. |
| `RoleAccessLimit` | Batas nominal/kuantitas. |
| `UserFavoriteMenu` | Favorit. |
| `UserRecentMenu` | Riwayat menu. |
| `DataExportLog` | Audit ekspor. |
| `StepUpChallenge` | Challenge aksi sensitif. |

User tenant dibuat melalui:

1. owner mengundang email/username;
2. platform membuat atau menggunakan `PlatformUser`;
3. platform membuat `TenantMembership`;
4. tenant schema membuat `UserSubject`;
5. role/scope diset pada tenant schema.

Seed permission dan role mengikuti katalog versi sebelumnya.
## 12.3. Self-Service Registration, Onboarding, Subscription, dan Perangkat

### Registration API model

Field harus mengikuti kebutuhan `ebisnis.jsp`:

```text
businessName
businessType
country
province
cityRegency
district
address
contactPerson
contactPhone
businessPhone
email
desiredUsername
password atau generatePassword=true
passwordConfirmation
acceptTerms
acceptPrivacy
```

### Status registration

```text
DRAFT
VALIDATING
USERNAME_RESERVED
PROVISIONING
READY
FAILED
CANCELLED
```

### Onboarding setelah login pertama

```text
Langkah 1 — Profil bisnis
Langkah 2 — Perusahaan/Manajemen
Langkah 3 — Brand
Langkah 4 — Toko/Outlet/Cafe/Restoran
Langkah 5 — Gudang Parent dan Gudang Outlet
Langkah 6 — Pemilik/Investor
Langkah 7 — Anggota Manajemen
Langkah 8 — Pengaturan awal ERP
Langkah 9 — Review dan Selesai
```

Model tenant tambahan:

| Model | Fungsi |
|---|---|
| `Party` | Master pihak: person atau organization. |
| `Person` | Individu, termasuk pemilik, investor, staf, dan kontak. |
| `OrganizationParty` | Organisasi pihak eksternal/internal. |
| `OwnerProfile` | Profil pemilik bisnis. |
| `InvestorProfile` | Profil investor. |
| `ManagementProfile` | Profil anggota manajemen. |
| `OwnershipInterest` | Kepemilikan terhadap perusahaan/brand/outlet. |
| `ManagementAssignment` | Penugasan manajemen. |
| `OnboardingProgress` | Status wizard dan step yang selesai. |
| `StarterDataMarker` | Menandai data contoh agar dapat dibersihkan dengan aman. |

### Default provisioning data

Setelah tenant schema dibuat, seed otomatis:

1. seluruh menu tree;
2. seluruh permission action;
3. role template;
4. company/legal entity dari `businessName`;
5. brand default dari `businessName`;
6. outlet utama dengan tipe dari `businessType`;
7. gudang parent/utama;
8. gudang outlet;
9. region default;
10. owner/investor profile dari PIC;
11. tenant admin/owner role;
12. UOM, metode pembayaran, pajak dasar, chart of accounts, document sequence;
13. kategori dan produk contoh dengan `isSample=true`;
14. supplier contoh;
15. dashboard setting;
16. stock policy contoh;
17. data transaksi contoh hanya bila `includeStarterTransactions=true`.

Sediakan tombol **Hapus Data Contoh**. Data contoh hanya dapat dibersihkan bila belum direferensikan
transaksi nyata.

### Subscription, perangkat, harga khusus, diskon, dan Esmartlink

Seluruh billing SaaS berada pada schema `platform`. Tenant schema hanya menyimpan proyeksi
operasional apabila dibutuhkan untuk POS/offline entitlement.

#### A. Model Platform Super Admin

Gunakan `PlatformUser`, `PlatformRole`, dan `PlatformUserRole`, bukan tabel password khusus.

Tambahkan model:

| Model | Fungsi dan kolom penting |
|---|---|
| `PlatformRole` | Role global: `PLATFORM_SUPER_ADMIN`, `PLATFORM_SUPPORT`, `PLATFORM_BILLING_ADMIN`, `PLATFORM_AUDITOR`. |
| `PlatformPermission` | Permission global. |
| `PlatformRolePermission` | Relasi role-permission. |
| `PlatformUserRole` | Penugasan role global dan masa berlaku. |
| `PlatformSupportSession` | Akses terkontrol ke tenant: `tenantId`, `schemaNameSnapshot`, `requestedBy`, `reason`, `accessMode`, `expiresAt`, `stepUpVerifiedAt`. |
| `PlatformTenantAction` | Perintah lintas tenant: migrate, suspend, activate, seed repair, reindex, master-data support. |
| `PlatformStepUpChallenge` | Verifikasi ulang untuk perubahan sensitif. |
| `PlatformAdminSavedView` | Filter/saved view portal admin. |

Permission global minimum:

```text
PLATFORM.REGISTRATION.READ
PLATFORM.REGISTRATION.UPDATE
PLATFORM.TENANT.READ
PLATFORM.TENANT.ACTIVATE
PLATFORM.TENANT.SUSPEND
PLATFORM.TENANT.MIGRATE
PLATFORM.TENANT.SUPPORT_READ
PLATFORM.TENANT.SUPPORT_WRITE
PLATFORM.TENANT.SCHEMA_STATUS
PLATFORM.PRICING.READ
PLATFORM.PRICING.MANAGE
PLATFORM.DISCOUNT.READ
PLATFORM.DISCOUNT.MANAGE
PLATFORM.SUBSCRIPTION.READ
PLATFORM.SUBSCRIPTION.MANAGE
PLATFORM.DEVICE.READ
PLATFORM.DEVICE.MANAGE
PLATFORM.INVOICE.READ
PLATFORM.INVOICE.MANAGE
PLATFORM.PAYMENT.READ
PLATFORM.PAYMENT.RECONCILE
PLATFORM.ESMARTLINK.MANAGE
PLATFORM.I18N.MANAGE
PLATFORM.AUDIT.READ
PLATFORM.SECURITY.MANAGE
```

Aturan akses lintas schema:

1. UI tidak pernah mengirim nama schema bebas.
2. Super admin memilih tenant berdasarkan `tenantId`.
3. API mengambil schema hanya dari `TenantSchemaRegistry`.
4. Akses baca dibuat melalui `PlatformSupportSession` berumur pendek.
5. Akses tulis memerlukan password/step-up verification, permission khusus, dan alasan.
6. Gunakan banner jelas saat berada di tenant support context.
7. Semua response support context menyertakan `supportSessionId`.
8. Setiap query/perubahan dicatat pada `platform__audit`.
9. Perubahan row tenant juga dicatat oleh trigger pada `<tenant>__audit`.
10. Tidak tersedia tombol untuk menghapus audit.

#### B. Model internationalization

Tambahkan pada schema `platform`:

| Model | Fungsi |
|---|---|
| `Locale` | `code`, `name`, `nativeName`, `direction`, `enabled`, `fallbackLocaleCode`, `sortOrder`. |
| `TranslationNamespace` | Namespace seperti `common`, `auth`, `menu`, `billing`, `inventory`. |
| `TranslationKey` | Key stabil, deskripsi, source/default text. |
| `TranslationValue` | Nilai per locale, status review, version. |
| `TenantTranslationOverride` | Override terjemahan tertentu untuk tenant. |
| `LocalizedContent` | Konten CMS/landing page yang dilokalkan bila diperlukan. |
| `TranslationImportRun` | Riwayat import/export translation catalog. |

Seed locale:

```text
id     | Bahasa Indonesia | ltr | default
en     | English          | ltr
ar     | العربية          | rtl
zh-CN  | 简体中文         | ltr
```

Aturan i18n:

1. Bahasa efektif: preferensi user → default tenant → browser → `id`.
2. Backend mengembalikan stable `errorCode` dan parameter; frontend menerjemahkan.
3. Jangan memakai pesan error sebagai identifier logika.
4. Menu menggunakan `translationKey`, bukan label tunggal sebagai sumber kebenaran.
5. React menggunakan `i18next` dan `react-i18next`.
6. Saat locale `ar`, set `document.documentElement.dir = "rtl"`.
7. Layout sidebar, breadcrumb, dialog, ikon arah, dan tabel harus diuji RTL.
8. Gunakan `Intl.NumberFormat`, `Intl.DateTimeFormat`, dan locale-aware input/output.
9. Kode, SKU, barcode, UUID, nomor invoice, dan identifier teknis tetap LTR.
10. Semua source dan database menggunakan UTF-8.
11. Translation catalog dapat diekspor/impor JSON.
12. Tambah locale baru tidak memerlukan perubahan struktur tabel.


#### C0. Package & Module Catalog sebagai sumber kebenaran

Jangan menganggap `SubscriptionPlan` hanya mempunyai satu nama dan satu harga. Buat katalog
modul dan fitur yang independen dari paket.

Tambahkan model control plane:

| Model | Fungsi dan kolom penting |
|---|---|
| `ModuleCatalog` | Modul ERP global. `code`, `nameKey`, `descriptionKey`, `category`, `status`, `sortOrder`. |
| `FeatureCatalog` | Fitur granular. `moduleId`, `code`, `nameKey`, `featureType`, `status`. |
| `SubscriptionPlan` | Identitas paket/penawaran. `code`, `nameKey`, `status`, `marketSegment`. |
| `SubscriptionPlanVersion` | Snapshot immutable. `version`, `effectiveFrom`, `effectiveUntil`, `futureModulePolicy`, `status`. |
| `SubscriptionPlanModule` | Modul yang termasuk, entitlement scope, usage policy, enabled. |
| `SubscriptionPlanFeature` | Feature-level include/exclude/limit. |
| `SubscriptionPlanPrice` | Harga berdasarkan currency, metric, interval, unit, minimum quantity. |
| `SubscriptionPlanPriceTier` | Volume tier, misalnya 1–10, 11–50, dan seterusnya. |
| `SubscriptionPlanConstraint` | Minimum/maksimum perangkat, outlet, pengguna, storage, transaksi. |
| `SubscriptionAddOn` | Add-on yang dapat dibeli terpisah. |
| `SubscriptionAddOnVersion` | Versi add-on. |
| `SubscriptionAddOnModule` | Modul/fitur yang dibuka add-on. |
| `SubscriptionAddOnPrice` | Harga add-on. |
| `TenantPlanContract` | Paket kontrak khusus tenant. |
| `TenantPlanModuleOverride` | Include/exclude module khusus tenant. |
| `TenantPlanFeatureOverride` | Override limit/feature tenant. |
| `TenantPriceOverride` | Harga khusus tenant. |
| `PackageAssignment` | Penetapan paket ke tenant, legal entity, outlet, atau device. |
| `EntitlementSnapshot` | Hak efektif yang dihitung dari paket, add-on, pembayaran, dan override. |

Kode modul minimum:

```text
POS
SALES
PRODUCT_PRICING
CRM
PURCHASING
WAREHOUSE
INVENTORY
MANUFACTURING
QUALITY_CONTROL
SHIPPING
FINANCE
ACCOUNTING
INVESTOR_REVENUE_SHARE
HUMAN_RESOURCES
ATTENDANCE
PAYROLL
ASSET
WORKFLOW
REPORTING_ANALYTICS
INTEGRATION_API
```

Jangan menggunakan nama modul yang hanya menjadi label UI sebagai foreign key. Gunakan kode
stabil dan `translationKey`.

#### C0.1. Billing metric dan entitlement scope

Billing metric minimum:

```text
PER_POS_DEVICE
PER_ACTIVE_DEVICE
PER_OUTLET
PER_LEGAL_ENTITY
PER_USER
PER_TRANSACTION
PER_STORAGE_GB
FLAT_TENANT
ONE_TIME
USAGE_BASED
```

Assignment scope:

```text
TENANT
LEGAL_ENTITY
BRAND
OUTLET
DEVICE
```

Entitlement scope:

```text
TENANT_WIDE
LEGAL_ENTITY
BRAND
OUTLET
DEVICE
USER
```

Contoh default:

- harga paket ditagihkan menggunakan `PER_POS_DEVICE`;
- POS entitlement berlaku per device;
- Keuangan/Akuntansi/SDM dapat berlaku `TENANT_WIDE`;
- Gudang/Persediaan dapat dibatasi tenant, legal entity, atau outlet;
- add-on dapat berlaku tenant-wide atau hanya outlet tertentu.

#### C0.2. Mode paket tenant

Dukung:

```text
UNIFORM_TENANT_PACKAGE
PACKAGE_PER_OUTLET
PACKAGE_PER_DEVICE
MIXED_PACKAGE
CUSTOM_CONTRACT
```

`UNIFORM_TENANT_PACKAGE` adalah default termudah: satu paket dipilih, lalu harga dikalikan
jumlah perangkat POS billable.

`MIXED_PACKAGE` memungkinkan perangkat atau outlet berbeda memakai paket berbeda. Engine
harus mencegah entitlement tenant-wide menjadi ambigu. Gunakan policy eksplisit:

```text
ANY_ACTIVE_ITEM
MINIMUM_PAID_QUANTITY
ALL_DEVICES_REQUIRED
EXPLICIT_CONTRACT
```

#### C0.3. Seed empat paket awal

```text
POS_STARTER
├── price: Rp250.000 / POS / bulan
└── modules
    └── POS

POS_BUSINESS
├── price: Rp400.000 / POS / bulan
└── modules
    ├── POS
    ├── FINANCE
    ├── ACCOUNTING
    ├── WAREHOUSE
    └── INVENTORY

POS_PROFESSIONAL
├── price: Rp600.000 / POS / bulan
└── modules
    ├── seluruh POS_BUSINESS
    ├── HUMAN_RESOURCES
    └── ATTENDANCE

POS_COMPLETE
├── price: Rp750.000 / POS / bulan
└── modules
    └── seluruh modul yang aktif pada snapshot plan version
```

Payroll tidak boleh otomatis diasumsikan termasuk dalam istilah “SDM” tanpa konfigurasi.
Pada seed awal, tentukan dengan field eksplisit. Rekomendasi:

```text
POS_PROFESSIONAL:
HUMAN_RESOURCES = included
ATTENDANCE       = included
PAYROLL          = optional add-on

POS_COMPLETE:
PAYROLL          = included
```

Super admin dapat mengubah komposisi melalui versi paket baru.

#### C0.4. Price waterfall

Urutan kalkulasi wajib deterministik:

```text
1. Resolve package assignment
2. Resolve package version berdasarkan tanggal layanan
3. Resolve billing metric dan quantity
4. Ambil base package price
5. Terapkan volume tier
6. Terapkan tenant contract/price override
7. Tambahkan add-on
8. Evaluasi promotion/discount rule
9. Terapkan coupon/promo code
10. Terapkan price floor/maximum discount
11. Hitung subtotal
12. Hitung pajak
13. Tambahkan biaya admin channel pembayaran
14. Hitung grand total
15. Simpan calculation trace dan snapshot
```

Tentukan secara eksplisit apakah tenant price override:

```text
REPLACE_BASE_PRICE
DISCOUNT_FROM_BASE
FIXED_PACKAGE_TOTAL
CUSTOM_FORMULA_STRUCTURED
```

`CUSTOM_FORMULA_STRUCTURED` hanya memakai field/operator whitelist.

#### C0.5. Package Builder UI

Super admin harus dapat:

- membuat paket;
- menduplikasi paket;
- membuat draft version;
- memilih modul menggunakan tree checkbox;
- memilih fitur dan limit;
- menentukan scope entitlement;
- menentukan billing metric;
- menentukan harga dan volume tier;
- menambahkan add-on;
- menentukan trial dan grace period;
- menentukan minimum/maksimum perangkat;
- membuat tenant-specific offer;
- melakukan simulasi;
- melihat perbandingan paket;
- menjadwalkan publikasi;
- menghentikan versi lama tanpa mengubah invoice lama;
- melihat audit dan pengguna paket.

Buat validasi:

- versi published tidak dapat diedit;
- paket tanpa price tidak dapat dipublikasikan;
- modul wajib POS untuk package bertipe POS;
- interval dan price harus positif;
- effective date tidak overlap untuk key harga yang sama;
- package code unik;
- feature harus berasal dari module yang valid;
- module dependency wajib dipenuhi;
- circular dependency ditolak.


#### C. Model katalog biaya POS dan pricing

Bedakan **harga barang pada POS** dari **biaya langganan perangkat POS**.

Tambahkan model control plane:

| Model | Fungsi dan kolom penting |
|---|---|
| `SubscriptionProduct` | Produk SaaS, misalnya `POS_DEVICE_LICENSE`. |
| `SubscriptionPlan` | Paket fitur/trial/grace period. |
| `SubscriptionPlanVersion` | Versi immutable dengan effective date. |
| `SubscriptionPrice` | Harga per unit/periode/currency; `unitType=DEVICE`, `billingInterval`, `intervalCount`, `unitPrice`. |
| `TenantPriceOverride` | Harga khusus tenant, priority, effective period, approval, reason. |
| `PricingQuote` | Hasil kalkulasi yang immutable setelah accepted. |
| `PricingQuoteLine` | Perangkat/kuantitas, base price, effective unit price. |
| `PricingAdjustment` | Diskon/promo/override yang diaplikasikan beserta snapshot rule. |
| `PriceChangeApproval` | Approval perubahan harga global atau tenant. |
| `PriceCatalogAudit` | Snapshot perubahan harga selain audit generik. |

Default seed development:

```text
Product        : POS_DEVICE_LICENSE
Currency       : IDR
Billing metric : PER_POS_DEVICE
Trial          : 30 hari

Package prices:
POS_STARTER      : Rp250.000 / POS / bulan
POS_BUSINESS     : Rp400.000 / POS / bulan
POS_PROFESSIONAL : Rp600.000 / POS / bulan
POS_COMPLETE     : Rp750.000 / POS / bulan
```

Harga tidak boleh disimpan sebagai floating point. Gunakan `Decimal(19,4)` dan kirim sebagai string.

Perubahan harga:

- selalu versioned;
- memiliki `effectiveFrom` dan optional `effectiveUntil`;
- tidak mengubah invoice atau subscription period yang sudah diterbitkan;
- berlaku pada quote baru;
- dapat ditetapkan global, plan, tenant, atau kontrak tertentu;
- memerlukan reason;
- perubahan oleh super admin wajib diaudit.

#### D. Flexible discount and promotion engine

Tambahkan model:

| Model | Fungsi |
|---|---|
| `DiscountProgram` | Header promo, code, name, status, validity, priority, stack policy. |
| `DiscountRule` | Satu aturan evaluasi. |
| `DiscountConditionGroup` | Kelompok AND/OR. |
| `DiscountCondition` | Field/operator/value yang di-whitelist. |
| `DiscountBenefit` | Persentase, nominal tetap, free device/month, price override, waived fee. |
| `DiscountTenantEligibility` | Include/exclude tenant. |
| `DiscountPlanEligibility` | Plan yang memenuhi. |
| `DiscountRedemption` | Pemakaian promo dan idempotency. |
| `DiscountApproval` | Persetujuan aturan sensitif. |
| `PromoCode` | Kode promosi, usage limit, tenant/user restriction. |

Field kondisi yang diperbolehkan minimal:

```text
selectedDeviceCount
activeDeviceCount
billingInterval
billingIntervalCount
tenantId
tenantAgeDays
planCode
currencyCode
registrationSource
firstSubscription
renewal
paymentMode
quoteSubtotal
promotionCode
currentDate
```

Operator whitelist:

```text
EQ
NE
GT
GTE
LT
LTE
IN
NOT_IN
BETWEEN
IS_TRUE
IS_FALSE
```

Benefit:

```text
PERCENT_DISCOUNT
FIXED_DISCOUNT
UNIT_PRICE_OVERRIDE
FREE_DEVICE_COUNT
FREE_BILLING_PERIOD
WAIVE_ADMIN_FEE
```

Contoh seed aturan:

```text
Nama      : Diskon POS di atas 10 perangkat
Kondisi   : selectedDeviceCount > 10
Benefit   : PERCENT_DISCOUNT 10%
Priority  : 100
Stacking  : EXCLUSIVE
```

Aturan engine:

1. Evaluasi hanya field/operator whitelist, bukan JavaScript `eval`.
2. Quote menyimpan snapshot rule dan input evaluasi.
3. Tentukan policy `EXCLUSIVE`, `BEST_PRICE`, atau `STACKABLE`.
4. Terapkan batas maksimum diskon per program/tenant.
5. Rounding dilakukan satu kali menggunakan aturan currency.
6. Harga khusus tenant dievaluasi sebelum atau sesudah promo sesuai policy eksplisit.
7. Hasil kalkulasi harus deterministik dan mempunyai explanation trace.
8. Test wajib mencakup boundary 10 dan 11 perangkat.
9. Perubahan rule tidak mengubah quote yang sudah diterima.
10. Super admin dapat melakukan simulasi harga sebelum publikasi.

#### E. Model perangkat, subscription, invoice, dan entitlement

Tambahkan model:

| Model | Fungsi |
|---|---|
| `PosDevice` | Perangkat fisik/logis: tenant, outlet, label, fingerprint, status. |
| `DeviceActivation` | Pairing/aktivasi/revocation. |
| `Subscription` | Kontrak tenant, plan version, status, dates, renewal policy. |
| `SubscriptionItem` | Line per perangkat atau kuantitas perangkat. |
| `DeviceEntitlement` | Hak per perangkat, active/grace/expired/revoked. |
| `SubscriptionChange` | Add/remove/replace device, upgrade/downgrade. |
| `BillingInvoice` | Invoice immutable. |
| `BillingInvoiceLine` | Snapshot perangkat, price, discount, tax, total. |
| `BillingPaymentAllocation` | Alokasi payment ke invoice/line/device. |
| `BillingCreditNote` | Koreksi invoice tanpa edit invoice posted. |
| `BillingReceipt` | Kuitansi pembayaran. |
| `RenewalSchedule` | Jadwal renewal. |

Mode pembayaran:

```text
PER_DEVICE
SELECTED_DEVICES
CONSOLIDATED_ALL_DEVICES
```

Perilaku:

- `PER_DEVICE`: satu invoice/payment order dapat dibuat untuk satu perangkat;
- `SELECTED_DEVICES`: satu invoice mencakup perangkat yang dipilih;
- `CONSOLIDATED_ALL_DEVICES`: satu invoice mencakup seluruh perangkat billable;
- invoice line selalu menyimpan `deviceId` atau kuantitas dan snapshot harga;
- pembayaran per-device hanya mengaktifkan entitlement perangkat yang lunas;
- invoice gabungan default aktif setelah total final terbayar penuh;
- partial payment hanya diperbolehkan jika plan/policy mengizinkan;
- penggantian perangkat tidak boleh mengulang trial;
- reinstall tidak membuat trial baru;
- device entitlement dapat diverifikasi oleh POS;
- invoice, line, quote, dan adjustment immutable setelah issued/accepted.

#### F. Model Esmartlink

Tambahkan pada `platform`:

| Model | Fungsi |
|---|---|
| `PaymentProvider` | Provider `ESMARTLINK`, status, environment, endpoint, secret reference. |
| `PaymentChannel` | Code, localized label key, admin fee, active, sort order. |
| `PaymentChannelLegacyConfig` | Import string `KODE:BIAYA:LABEL`. |
| `PaymentOrder` | Order/VA reference, invoice, amount, expiry, channel, status. |
| `PaymentAttempt` | Setiap create/inquiry/retry. |
| `PaymentCallbackEvent` | Callback immutable, provider transaction ID, status, checksum. |
| `PaymentProviderRequestLog` | Request keluar dengan payload termask. |
| `HostToHostLog` | Semua inbound callback/inquiry termasuk unknown IP dan error. |
| `PaymentReconciliationRun` | Rekonsiliasi periodik. |
| `PaymentReconciliationItem` | Hasil per order/event. |
| `PaymentDeadLetter` | Callback yang gagal diproses dan dapat direplay. |

Unique/idempotency minimum:

```text
UNIQUE(providerId, providerTransactionId)
UNIQUE(providerId, providerOrderId)
UNIQUE(idempotencyKey)
```

Gunakan order number/VA yang tidak membocorkan schema name atau username.


#### G0. Karakterisasi pembuatan order Esmartlink dari `DownloadTagihanSiswaBankOnline.java`

Buat dokumen:

```text
docs/modules/billing/esmartlink-create-order-characterization.md
```

Perilaku legacy yang harus dipetakan:

1. Sistem menghitung invoice item, potongan, biaya admin, dan total.
2. Order yang belum dibayar, belum kedaluwarsa, dan mempunyai konteks sama dapat digunakan
   kembali. Pada implementasi baru, reuse harus berdasarkan idempotency key dan state yang jelas,
   bukan query longgar.
3. Credential Esmartlink dapat berasal dari konfigurasi default atau konfigurasi channel.
4. Bila channel belum dipilih dan tersedia beberapa pilihan, pengguna diarahkan ke pemilihan
   channel.
5. `order_id` dibuat unik.
6. Payload create-order legacy:

```json
{
  "order_id": "UNIQUE_ORDER_ID",
  "amount": 400000,
  "description": "billing-description",
  "customer": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "08123456789"
  },
  "item": [
    {
      "name": "POS Business - Device 1",
      "amount": 400000,
      "qty": 1
    }
  ],
  "channel": ["VA_CIMB", "VA_BRI"],
  "type": "payment-page",
  "payment_mode": "CLOSE",
  "expired_time": "ISO-8601 timestamp",
  "callback_url": "https://host/api/v1/payments/esmartlink/callback",
  "success_redirect_url": "https://host/payment/success",
  "failed_redirect_url": "https://host/payment/failed"
}
```

7. Endpoint legacy default mengarah ke path `api/payment/create-order`.
8. Legacy memanggil helper menggunakan username, password, URL, dan payload JSON. Agen harus
   mencari implementasi helper/authentication aktual bila source tersedia. Jangan mengarang
   signature atau header.
9. Response sukses legacy mempunyai `code == 0`.
10. `data.payment_url` disimpan dan ditampilkan kepada pengguna.
11. Simpan request/response provider secara termask dan aman.
12. Simpan `transaction_id` dari response untuk inquiry berikutnya.
13. Error provider tidak boleh membuat invoice hilang; status payment attempt menjadi failed.
14. Jumlah item harus sama dengan total invoice + fee sesuai kontrak provider.
15. Nama item maksimum mengikuti batas provider; truncation harus deterministic.
16. Jangan memfilter nama pelanggan dengan cara yang merusak Unicode. Lakukan normalisasi sesuai
    kontrak provider dan simpan nama asli secara terpisah.
17. Payment URL tidak menjadi bukti pembayaran.
18. Redirect sukses tidak menjadi bukti pembayaran.
19. Aktivasi hanya melalui callback tervalidasi atau inquiry tervalidasi.

Model tambahan:

```text
PaymentOrder.requestSnapshot
PaymentOrder.providerOrderId
PaymentOrder.providerTransactionId
PaymentOrder.paymentUrl
PaymentOrder.expiresAt
PaymentOrder.selectedChannelId
PaymentOrder.status
PaymentAttempt.requestPayloadMasked
PaymentAttempt.responsePayloadMasked
PaymentAttempt.httpStatus
PaymentAttempt.durationMs
```

State payment order:

```text
DRAFT
CREATING
WAITING_PAYMENT
PAID
EXPIRED
FAILED
CANCELLED
REPLACED
```


#### G. Karakterisasi wajib source Java Esmartlink

Baca file Java terlampir dan buat
`docs/modules/billing/esmartlink-legacy-characterization.md`.

Perilaku yang harus dipertahankan atau dimigrasikan secara eksplisit:

1. Callback menerima JSON dengan objek `data`.
2. Field legacy:
   - `data.order_id`;
   - `data.amount`;
   - `data.transaction_time`;
   - `data.transaction_id`;
   - `data.status`.
3. Status `success` diperlakukan sebagai pembayaran berhasil; status lain tidak boleh langsung
   mengaktifkan subscription.
4. Duplicate callback dikenali melalui `transaction_id` dan status order yang sudah terbayar.
5. Lookup legacy menghubungkan order/VA, nominal, host/provider, dan duplicate criterion.
6. Callback yang sudah pernah diproses harus menghasilkan ACK yang sama tanpa membayar dua kali.
7. Log host-to-host selalu dicatat, termasuk bila:
   - IP tidak dikenali;
   - payload invalid;
   - order tidak ditemukan;
   - terjadi exception.
8. Legacy ACK berupa string `OK` atau `ERROR`. Buat compatibility response yang configurable
   berdasarkan kontrak Esmartlink aktual.
9. Jangan menandai invoice paid hanya karena endpoint mengembalikan ACK.
10. Validasi provider harus mencakup allowlist IP dan signature/credential bila dokumentasi
    Esmartlink menyediakannya. Jangan mengarang algoritma signature.
11. Jika berada di belakang reverse proxy, hanya percaya forwarded IP dari trusted proxy.
12. Raw payload sensitif harus dimask/encrypt dan memiliki retention policy.
13. Proses payment event, invoice paid, allocation, dan entitlement harus atomik.
14. Gunakan Decimal, bukan `double`.

Karakterisasi `SmartlinkChannelWindow.java`:

1. Legacy channel config memakai format:

   ```text
   KODE:BIAYA_ADMIN:LABEL;KODE_LAIN:BIAYA_ADMIN:LABEL
   ```

2. Entri invalid dilewati, bukan menggagalkan seluruh pilihan channel.
3. Label kosong fallback ke code.
4. Biaya admin ditambahkan ke total bayar.
5. Item dalam satu transaksi tidak boleh menggunakan konfigurasi channel yang bertentangan.
6. Pengguna memilih channel dan batas waktu pembayaran.
7. Pilihan legacy expiry:

   ```text
   15 menit
   30 menit
   1 jam
   3 jam
   6 jam
   24 jam
   3 hari
   1 minggu
   1 bulan
   ```

8. Pada implementasi baru, simpan channel dan expiry sebagai data terstruktur; importer legacy
   hanya untuk kompatibilitas.
9. Label channel dan deskripsi waktu harus memakai translation key.


#### G1. Karakterisasi “Cek Pembayaran” dari `VirtualAccountBankAction.java`

Buat:

```text
docs/modules/billing/esmartlink-inquiry-characterization.md
```

Alur legacy:

1. Ambil response create-order yang tersimpan.
2. Baca `data.transaction_id`.
3. Bentuk URL:

   ```text
   <url_status_va_smartlink>/<transaction_id>
   ```

   Default legacy mengarah ke path `api/payment/inquiry-order/`.

4. Credential dapat berasal dari:
   - provider/default configuration;
   - tenant/institution configuration;
   - payment channel configuration.

   Untuk eBisnis, gunakan precedence eksplisit:

   ```text
   PaymentChannel credential
   → TenantPaymentProvider credential
   → Platform provider credential
   ```

5. Lakukan HTTP GET inquiry.
6. Parse:

   ```text
   response.data.status
   ```

7. Status `success` berarti gateway melaporkan pembayaran ditemukan.
8. Hasil sukses diproses melalui **payment callback processor yang sama**, bukan menulis status
   invoice dari controller inquiry.
9. Processor tetap melakukan:
   - validasi order;
   - validasi nominal;
   - validasi provider transaction;
   - idempotency;
   - allowed state transition;
   - allocation;
   - entitlement;
   - audit.
10. Bila belum sukses, status lokal tetap menunggu pembayaran dan response inquiry disimpan.
11. UI memuat ulang status setelah pemeriksaan.
12. Legacy mempunyai cek satu transaksi dan cek massal dengan batas 300 baris per klik.
13. Implementasi baru mendukung:
   - cek manual satu payment order;
   - cek massal terkontrol;
   - reconciliation job otomatis;
   - retry dengan backoff;
   - rate limit provider;
   - progress dan hasil per item.

Tambahkan model:

| Model | Fungsi |
|---|---|
| `PaymentInquiryAttempt` | Request/response inquiry, status, duration, actor, source. |
| `PaymentCheckBatch` | Header cek massal. |
| `PaymentCheckBatchItem` | Hasil per payment order. |
| `PaymentStatusTransition` | Histori state transition. |
| `ProviderRateLimitState` | Throttling/adaptive retry. |

Source inquiry:

```text
MANUAL_SINGLE
MANUAL_BATCH
SCHEDULED_RECONCILIATION
CALLBACK_RECOVERY
SUPPORT_REPLAY
```

Endpoint:

```text
POST /api/v1/billing/payment-orders/:id/check-payment
POST /api/v1/platform/payments/check-batches
GET  /api/v1/platform/payments/check-batches/:id
GET  /api/v1/platform/payments/check-batches/:id/items
POST /api/v1/platform/payments/reconciliation-runs
GET  /api/v1/platform/payments/reconciliation-runs/:id
```

Batch rule:

- default maksimum 300 item;
- configurable tetapi mempunyai hard upper bound;
- tidak menjalankan request paralel tanpa batas;
- gunakan concurrency limit;
- progress persisten;
- dapat dilanjutkan setelah worker restart;
- satu item gagal tidak menggagalkan seluruh batch;
- tidak mengaktifkan entitlement dua kali.

Status inquiry provider harus dipetakan melalui konfigurasi/adapter. Jangan menganggap hanya
`success` sebagai satu-satunya status provider selamanya; simpan raw status dan normalized status.


#### H. Arsitektur adapter Esmartlink

```mermaid
sequenceDiagram
    participant U as Tenant Owner
    participant Q as Pricing Engine
    participant B as Billing Service
    participant E as Esmartlink Adapter
    participant P as Esmartlink Provider
    participant C as Callback Controller
    participant D as Platform DB

    U->>Q: Pilih perangkat dan periode
    Q-->>U: Quote + discount explanation
    U->>B: Accept quote dan buat invoice
    B->>E: Create payment order + idempotency key
    E->>P: Provider request
    P-->>E: Order/VA/channel/expiry
    E->>D: Simpan attempt dan order
    E-->>U: Instruksi pembayaran
    P->>C: Callback
    C->>D: Simpan H2H log lebih dahulu
    C->>C: Validate host/signature/payload
    C->>D: Deduplicate transaction_id
    C->>D: Payment event + allocation + entitlement atomik
    C-->>P: Compatibility ACK
```

Pisahkan class/service:

```text
EsmartlinkConfigService
EsmartlinkChannelService
EsmartlinkLegacyChannelParser
EsmartlinkClient
EsmartlinkPaymentOrderService
EsmartlinkCallbackController
EsmartlinkCallbackValidator
EsmartlinkCallbackProcessor
EsmartlinkReconciliationService
EsmartlinkH2hLogService
PaymentEntitlementService
EsmartlinkCreateOrderMapper
EsmartlinkInquiryService
PaymentCheckBatchService
PaymentReconciliationWorker
```

Jangan menaruh logika provider pada controller.


## 12.4. Produk, UOM, Harga, Pajak, dan Promosi

Buat pada `catalog.prisma`:

| Model | Fungsi dan kolom penting |
|---|---|
| `ProductCategory` | Tree kategori. `parentId`, `code`, `name`, `path`, `level`. |
| `ProductBrand` | Brand produk, berbeda dari brand bisnis bila diperlukan. |
| `Product` | Master produk. `sku`, `barcode`, `gtin`, `name`, `productType`, `trackingType`, `baseUomId`, `taxCategoryId`, `active`. |
| `ProductVariant` | Varian produk. |
| `ProductAttribute` | Master atribut. |
| `ProductAttributeValue` | Nilai atribut. |
| `ProductVariantValue` | Atribut pada varian. |
| `ProductBarcode` | Banyak barcode per produk/UOM. |
| `ProductImage` | Gambar produk. |
| `ProductListing` | Aktivasi produk per brand/outlet/channel. |
| `Uom` | Satuan. `code`, `name`, `dimension`, `precision`. |
| `UomConversion` | Konversi satuan per produk atau global. `fromUomId`, `toUomId`, `factor`. |
| `TaxCategory` | Kelompok pajak produk. |
| `TaxRate` | Tarif pajak bertanggal efektif. |
| `PriceBook` | Buku harga. `scopeType`, `scopeId`, `currencyId`, `validFrom`, `validUntil`. |
| `PriceBookItem` | Harga produk/UOM. `price`, `minimumQty`, `validFrom`, `validUntil`. |
| `Promotion` | Program promosi. |
| `PromotionCondition` | Kondisi promosi dalam struktur eksplisit/JSON tervalidasi. |
| `PromotionBenefit` | Diskon, free item, cashback, voucher. |
| `Voucher` | Voucher/kode. |
| `VoucherRedemption` | Penggunaan voucher. |
| `ProductBundle` | Paket produk. |
| `ProductBundleItem` | Detail paket. |
| `ProductSupplier` | Relasi produk-pemasok. `supplierId`, `supplierSku`, `purchaseUomId`, `leadTimeDays`, `minimumOrderQty`, `isPreferred`, `priority`. |
| `ProductOutletSetting` | Setting produk per outlet, termasuk allow sale, reorder. |
| `ProductWarehouseSetting` | Setting per gudang, termasuk lokasi default dan kebijakan stock. |
| `ProductCostSnapshot` | Snapshot HPP per waktu/lokasi. |

## 12.5. Supplier, Customer, CRM, Loyalty

Buat pada `crm.prisma` dan bagian supplier di `purchasing.prisma`:

| Model | Fungsi dan kolom penting |
|---|---|
| `BusinessPartner` | Base party untuk customer/supplier/investor bila dipilih. |
| `Supplier` | Pemasok. `code`, `name`, `taxNumber`, `paymentTermId`, `currencyId`, `status`, `rating`. |
| `SupplierContact` | Kontak pemasok. |
| `SupplierAddress` | Alamat pemasok. |
| `SupplierProductPrice` | Harga pemasok bertanggal efektif. |
| `SupplierContract` | Kontrak dan SLA. |
| `SupplierEvaluation` | Evaluasi ketepatan, kualitas, harga. |
| `SupplierBlacklist` | Status blacklist dan alasan. |
| `Customer` | Pelanggan individu/perusahaan. |
| `CustomerContact` | Kontak. |
| `CustomerAddress` | Alamat. |
| `CustomerGroup` | Grup pelanggan. |
| `CustomerSegment` | Segmentasi. |
| `MembershipTier` | Tingkat anggota. |
| `LoyaltyAccount` | Akun poin. |
| `LoyaltyTransaction` | Ledger poin immutable. |
| `Lead` | Prospek. |
| `Opportunity` | Peluang penjualan. |
| `CustomerActivity` | Aktivitas tindak lanjut. |
| `Campaign` | Kampanye. |
| `CampaignAudience` | Target kampanye. |
| `CustomerTicket` | Tiket/keluhan. |
| `CustomerTicketMessage` | Percakapan tiket. |
| `CustomerSurvey` | Survei. |
| `CustomerSurveyResponse` | Jawaban survei. |

## 12.6. Penjualan dan POS

Buat pada `sales.prisma`:

| Model | Fungsi dan kolom penting |
|---|---|
| `PosTerminal` | Terminal POS per outlet. |
| `CashShift` | Shift kasir. `terminalId`, `cashierId`, `openedAt`, `openingCash`, `closedAt`, `expectedCash`, `actualCash`, `difference`, `status`. |
| `CashMovement` | Kas masuk/keluar pada shift. |
| `SalesQuotation` | Penawaran penjualan. |
| `SalesQuotationLine` | Detail penawaran. |
| `SalesOrder` | Pesanan penjualan. |
| `SalesOrderLine` | Detail pesanan. |
| `Sale` | Transaksi POS/penjualan. `saleNumber`, `channel`, `businessDate`, `customerId`, `shiftId`, totals, status, `idempotencyKey`. |
| `SaleLine` | Produk, UOM, qty, price, discount, tax, cost snapshot. |
| `SaleLineDiscount` | Rincian diskon line. |
| `SaleDiscount` | Diskon header. |
| `SalePayment` | Pembayaran transaksi. |
| `PaymentMethod` | Tunai, transfer, QR, kartu, deposit. |
| `PaymentMethodOutlet` | Metode aktif per outlet. |
| `HeldOrder` | Pesanan ditahan. |
| `SalesReturn` | Retur penjualan. |
| `SalesReturnLine` | Detail retur. |
| `RefundTransaction` | Pengembalian uang. |
| `SalesInvoice` | Invoice penjualan B2B/kredit. |
| `SalesInvoiceLine` | Detail invoice. |
| `CustomerReceipt` | Penerimaan pembayaran pelanggan. |
| `CustomerReceiptAllocation` | Alokasi ke invoice. |
| `SalesCommissionRule` | Aturan komisi. |
| `SalesCommissionSettlement` | Perhitungan komisi. |
| `ReceiptPrintLog` | Cetak/kirim ulang struk. |
| `CustomerDisplaySession` | Data layar pelanggan opsional. |

Aturan POS:

- `Sale` dan `SalePayment` idempotent.
- Sale yang completed tidak dihapus.
- Retur menghasilkan stock movement dan journal event terpisah.
- Nomor struk unik per tenant/outlet/business date sesuai kebijakan.

## 12.7. Purchasing, Request Order, PO, Penerimaan, dan Backorder

Buat pada `purchasing.prisma`:

| Model | Fungsi dan kolom penting |
|---|---|
| `RequestOrder` | Permintaan stok dari toko/gudang/lokasi ke gudang parent. `requestNumber`, `requestingWarehouseId`, `parentWarehouseId`, `requestType` (`MANUAL`, `MIN_STOCK_AUTO`), `priority`, `neededAt`, `status`, `generatedByPolicy`. |
| `RequestOrderLine` | `productId`, `uomId`, `requestedQty`, `approvedQty`, `fulfilledQty`, `remainingQty`, `sourceStockPolicyId`. |
| `RequestOrderNotification` | Notifikasi kepada staf terkait. |
| `RequestOrderConsolidation` | Header konsolidasi beberapa Request Order. |
| `RequestOrderConsolidationLine` | Hubungan kebutuhan produk dengan banyak line sumber. |
| `PurchaseRequisition` | Permintaan pembelian internal setelah konsolidasi. |
| `PurchaseRequisitionLine` | Detail kebutuhan. |
| `RequestForQuotation` | RFQ. |
| `RequestForQuotationLine` | Detail RFQ. |
| `SupplierQuotation` | Penawaran pemasok. |
| `SupplierQuotationLine` | Harga, lead time, MOQ. |
| `SupplierQuotationComparison` | Snapshot perbandingan dan keputusan. |
| `PurchaseOrder` | PO. `purchaseOrderNumber`, `supplierId`, `warehouseId`, `currencyId`, `orderDate`, `expectedDate`, totals, `status`, `sourceType`, `sourceId`, `parentPurchaseOrderId`. |
| `PurchaseOrderLine` | `productId`, `uomId`, `orderedQty`, `receivedQty`, `cancelledQty`, `backorderedQty`, `unitPrice`, discounts, tax. |
| `PurchaseOrderRequestAllocation` | Relasi PO line ke Request Order line. |
| `PurchaseOrderApproval` | Riwayat approval. |
| `PurchaseOrderDispatch` | Waktu dan kanal pengiriman PO ke vendor. |
| `GoodsArrival` | Registrasi kedatangan sebelum receipt. |
| `GoodsReceipt` | Penerimaan. `receiptNumber`, `purchaseOrderId`, `warehouseId`, `arrivalId`, `receiptDate`, `status`, `validationStatus`, `validatedBy`, `validatedAt`. |
| `GoodsReceiptLine` | `purchaseOrderLineId`, `productId`, `orderedQty`, `previouslyReceivedQty`, `receivedQty`, `acceptedQty`, `rejectedQty`, `backorderQty`, batch/expiry/serial, `qualityStatus`, `locationId`. |
| `GoodsReceiptInspection` | Pemeriksaan fisik, jumlah, kualitas, dokumen. |
| `GoodsReceiptInspectionResult` | Hasil per parameter. |
| `GoodsReceiptDiscrepancy` | Kurang, lebih, rusak, salah barang, expiry tidak sesuai. |
| `GoodsReceiptAllocation` | Alokasi accepted qty ke Request Order line. |
| `GoodsReceiptValidation` | Audit validasi, approval, reversal. |
| `PurchaseBackorder` | Backorder kekurangan. `sourcePurchaseOrderId`, `sourceGoodsReceiptId`, `originalSupplierId`, `replacementSupplierId`, `backorderNumber`, `status`, `dueDate`, `redirectReason`. |
| `PurchaseBackorderLine` | `sourcePurchaseOrderLineId`, `productId`, `shortageQty`, `fulfilledQty`, `remainingQty`. |
| `BackorderSupplierDecision` | Pilihan tetap/beralih pemasok dan approval. |
| `BackorderPurchaseOrderLink` | Hubungan backorder dengan PO baru. |
| `PurchaseReturn` | Retur ke pemasok. |
| `PurchaseReturnLine` | Detail retur. |
| `SupplierInvoice` | Invoice pemasok. |
| `SupplierInvoiceLine` | Detail invoice. |
| `SupplierInvoiceMatch` | Three-way match PO–receipt–invoice. |
| `SupplierPayment` | Pembayaran pemasok. |
| `SupplierPaymentAllocation` | Alokasi pembayaran ke invoice. |

### Aturan Request Order final

- Hanya gunakan tipe `MANUAL` dan `MIN_STOCK_AUTO` pada MVP.
- Jangan membuat tipe/menu khusus `PRODUCTION_SHORTAGE`.
- Auto Request Order dibuat per lokasi ketika projected available stock <= minimum/reorder point.
- Draft auto-generated harus muncul pada notifikasi pengguna dan tetap membutuhkan submit/approval sesuai konfigurasi.
- Sistem memeriksa stok parent atau lokasi lain sebelum merekomendasikan pembelian.
- Request Order dapat dikonversi menjadi Internal Transfer atau menjadi kebutuhan Purchase Order.

### Alur wajib

```mermaid
flowchart TD
    A[Stok lokasi mencapai minimum] --> B[Generate Request Order otomatis]
    B --> C[Notifikasi staf lokasi]
    C --> D[Submit Request Order]
    D --> E[Gudang parent menerima]
    E --> F[Cek stok parent/lokasi lain]
    F --> G{Cukup untuk transfer?}
    G -->|Ya| H[Buat Internal Transfer]
    G -->|Tidak| I[Konsolidasi kebutuhan]
    I --> J[Pilih item PO]
    J --> K[Tampilkan pemasok yang memasok item]
    K --> L[Buat dan kirim PO]
    L --> M[Barang datang]
    M --> N[Cek fisik]
    N --> O[Validasi penerimaan]
    O --> P{Jumlah kurang?}
    P -->|Ya| Q[Buat Backorder]
    P -->|Tidak| R[Alokasi barang]
    Q --> S[PO baru ke pemasok sama/berbeda]
    R --> H
```

### Status minimum

```text
RequestOrder:
DRAFT, AUTO_GENERATED, SUBMITTED, WAITING_APPROVAL, APPROVED,
CONSOLIDATED, CONVERTED_TO_TRANSFER, CONVERTED_TO_PURCHASE,
PARTIALLY_FULFILLED, FULFILLED, REJECTED, CANCELLED, CLOSED

PurchaseOrder:
DRAFT, WAITING_APPROVAL, APPROVED, SENT, SUPPLIER_CONFIRMED,
PARTIALLY_RECEIVED, RECEIVED, BACKORDERED, CANCELLED, CLOSED

GoodsReceipt:
DRAFT, ARRIVED, INSPECTED, WAITING_VALIDATION, CORRECTION_REQUIRED,
VALIDATED, STOCK_POSTED, PUT_AWAY, PARTIALLY_ACCEPTED,
QUARANTINED, REJECTED, CANCELLED, CLOSED

PurchaseBackorder:
DRAFT, WAITING_APPROVAL, APPROVED, WAITING_SUPPLIER_CONFIRMATION,
CONFIRMED, PARTIALLY_FULFILLED, FULFILLED,
REDIRECTED_TO_OTHER_SUPPLIER, CANCELLED, CLOSED
```

## 12.8. Gudang, Lokasi, Stock Ledger, Stock Policy, dan Internal Transfer

Buat pada `inventory.prisma`:

| Model | Fungsi dan kolom penting |
|---|---|
| `Warehouse` | Gudang. `legalEntityId`, `outletId`, `regionId`, `parentWarehouseId`, `code`, `name`, `warehouseType`, `status`. |
| `WarehouseArea` | Area gudang. |
| `WarehouseZone` | Zona. |
| `WarehouseAisle` | Lorong. |
| `WarehouseRack` | Rak. |
| `WarehouseBin` | Bin/lokasi paling detail. |
| `InventoryLot` | Lot/batch produk. `productId`, `lotNumber`, `productionDate`, `expiryDate`, `supplierId`, `status`. |
| `InventorySerial` | Serial number. |
| `InventoryMovement` | Ledger immutable. `movementNumber`, `movementType`, `productId`, `uomId`, `quantity`, `sourceWarehouseId`, `sourceLocationId`, `destinationWarehouseId`, `destinationLocationId`, `lotId`, `serialId`, `referenceType`, `referenceId`, `occurredAt`, `idempotencyKey`. |
| `InventoryMovementLine` | Jika header movement dipilih; jangan menduplikasi desain tanpa alasan. |
| `InventoryBalance` | Projection/cache saldo per warehouse/location/product/lot. `onHandQty`, `availableQty`, `reservedQty`, `inTransitQty`, `quarantineQty`, `damagedQty`. |
| `InventoryReservation` | Reservasi stok untuk sale, transfer, atau produksi. |
| `StockPolicy` | `productId`, `warehouseId`, `locationId`, `minimumStock`, `maximumStock`, `reorderPoint`, `safetyStock`, `leadTimeDays`, `recommendedOrderQty`, `autoRequestEnabled`. |
| `StockAlert` | Notifikasi stok minimum; deduplicate alert aktif. |
| `StockReplenishmentRecommendation` | Rekomendasi transfer/purchase. |
| `InternalTransfer` | Transfer antar gudang/lokasi. `transferNumber`, `sourceWarehouseId`, `destinationWarehouseId`, `requestOrderId`, `status`, `dispatchDate`, `arrivalDate`, `receivedDate`. |
| `InternalTransferLine` | Produk, requested/allocated/dispatched/received/rejected qty. |
| `InternalTransferShipment` | Pengiriman fisik. |
| `InternalTransferReceipt` | Penerimaan tujuan. |
| `InternalTransferReceiptLine` | Jumlah terima dan selisih. |
| `InternalTransferDiscrepancy` | Kurang, lebih, rusak, salah barang, ditolak. |
| `StockCount` | Stock opname. |
| `StockCountLine` | System qty, counted qty, variance qty. |
| `StockAdjustment` | Penyesuaian setelah approval. |
| `StockAdjustmentLine` | Detail penyesuaian. |
| `InventoryCostLayer` | Layer biaya FIFO/average bila diterapkan. |
| `InventoryValuationSnapshot` | Snapshot nilai persediaan. |
| `InventoryOwnership` | Kepemilikan untuk konsinyasi/investor bila diperlukan. |

### Sumber kebenaran stok

- Sumber kebenaran adalah `InventoryMovement`.
- `InventoryBalance` adalah projection yang diperbarui atomik dan dapat dihitung ulang.
- Jangan menyimpan satu field `product.stock` sebagai sumber kebenaran.

### Semantik Internal Transfer

```text
Saat dispatch:
- available stok sumber berkurang;
- in-transit bertambah;
- stok tujuan belum bertambah.

Saat penerimaan tujuan divalidasi:
- in-transit berkurang;
- on-hand/available tujuan bertambah;
- selisih masuk discrepancy/claim.
```

Pada UI bisnis, transfer dianggap selesai hanya setelah validasi tujuan.

### Status Internal Transfer

```text
DRAFT, WAITING_APPROVAL, APPROVED, ALLOCATED, PICKING, PACKED,
DISPATCHED, IN_TRANSIT, ARRIVED_WAITING_VALIDATION,
PARTIALLY_RECEIVED, RECEIVED, DISCREPANCY, REJECTED,
CANCELLED, CLOSED
```

### Monitoring stok tree

Buat endpoint agregasi:

```text
GET /api/v1/inventory/stock-tree
```

Parameter whitelist:

```text
regionId
productId
uomId
includeZero
includeInTransit
asOf
```

Response nested wajib menampilkan region, warehouse/outlet/location, on-hand, available, reserved, in-transit, quarantine, dan total children.

## 12.9. Manufacturing, BOM, MRP, Produksi, dan Costing

Buat pada `manufacturing.prisma`:

| Model | Fungsi dan kolom penting |
|---|---|
| `ManufacturedProductSetting` | Setting produk manufaktur. |
| `BillOfMaterial` | BOM/resep header. `productId`, `version`, `outputQty`, `outputUomId`, `effectiveFrom`, `effectiveUntil`, `status`. |
| `BillOfMaterialItem` | Bahan, qty, UOM, waste tolerance, mandatory, sequence. |
| `BomSubstituteGroup` | Kelompok bahan substitusi. |
| `BomSubstituteItem` | Bahan substitusi dan conversion. |
| `Routing` | Routing produksi. |
| `RoutingOperation` | Tahap operasi. |
| `WorkCenter` | Pusat kerja. |
| `Machine` | Mesin. |
| `MachineCapacity` | Kapasitas. |
| `ProductionCalendar` | Kalender produksi. |
| `DemandForecast` | Forecast. |
| `MasterProductionSchedule` | Jadwal induk. |
| `MaterialRequirementPlan` | Header MRP. |
| `MaterialRequirementPlanLine` | Kebutuhan, available, shortage, planned supply. |
| `ProductionPlan` | Rencana produksi. |
| `ProductionOrder` | Work Order. `workOrderNumber`, `productId`, `bomId`, `plannedQty`, `warehouseId`, `status`. |
| `ProductionOrderMaterial` | Material standar, reserved, issued, returned, actual. |
| `ProductionMaterialIssue` | Pengeluaran bahan. |
| `ProductionMaterialIssueLine` | Detail lot/batch. |
| `ProductionMaterialReturn` | Pengembalian bahan. |
| `ProductionOperationExecution` | Pencatatan proses/mesin/operator. |
| `WorkInProcessMovement` | Mutasi WIP. |
| `ProductionResult` | Hasil produksi menunggu validasi. |
| `ProductionResultLine` | Good qty, rejected qty, byproduct, batch. |
| `ProductionWaste` | Waste/scrap. |
| `ProductionRework` | Rework. |
| `ProductionCost` | Standard dan actual cost. |
| `ProductionCostComponent` | Material, labor, overhead. |
| `ProductionVariance` | Varians. |
| `ProductionTraceability` | Hubungan batch bahan ke batch hasil. |

Aturan:

- BOM yang telah dipakai tidak diubah; buat version baru.
- Work Order tidak boleh dimulai jika bahan wajib kurang, kecuali hak override khusus dan audit.
- Jangan membuat menu Request Order khusus kekurangan bahan produksi.
- Kekurangan bahan memakai rekomendasi transfer dan Request Order umum.
- Hasil produksi tidak menambah stok barang jadi sebelum divalidasi.

## 12.10. Quality Control

Buat pada `quality.prisma`:

| Model | Fungsi |
|---|---|
| `QualityParameter` | Parameter mutu. |
| `QualitySpecification` | Standar mutu produk/bahan. |
| `QualitySpecificationParameter` | Limit dan metode uji. |
| `QualityInspection` | Pemeriksaan incoming, process, finished goods. |
| `QualityInspectionSample` | Sampel. |
| `QualityInspectionResult` | Hasil per parameter. |
| `QualityDisposition` | Accept, reject, quarantine, rework. |
| `NonConformance` | Ketidaksesuaian. |
| `CorrectiveAction` | CAPA korektif. |
| `PreventiveAction` | CAPA preventif. |
| `QualityCertificate` | Certificate of analysis. |
| `ProductRecall` | Penarikan produk. |
| `ProductRecallItem` | Batch/serial terdampak. |

## 12.11. Shipping, Delivery, Ekspedisi, dan Armada

Buat pada `shipping.prisma`:

| Model | Fungsi |
|---|---|
| `DeliveryOrder` | Perintah pengiriman. |
| `DeliveryOrderLine` | Detail barang. |
| `PickingList` | Picking. |
| `PickingListLine` | Detail picking lot/location. |
| `PackingList` | Packing. |
| `PackingListLine` | Detail packing. |
| `Shipment` | Pengiriman. |
| `ShipmentPackage` | Paket/koli. |
| `ShipmentTrackingEvent` | Tracking. |
| `Carrier` | Ekspedisi. |
| `CarrierRate` | Tarif. |
| `Vehicle` | Armada. |
| `Driver` | Pengemudi. |
| `RoutePlan` | Rute. |
| `Manifest` | Manifest. |
| `ProofOfDelivery` | Foto, tanda tangan, waktu, geolocation. |
| `DeliveryDiscrepancy` | Selisih/gagal kirim. |
| `DeliveryReturn` | Retur distribusi. |

## 12.12. Keuangan, Akuntansi, Pajak, Kas, Bank, Piutang, dan Utang

Buat pada `accounting.prisma`:

| Model | Fungsi dan kolom penting |
|---|---|
| `AccountType` | Tipe akun. |
| `ChartOfAccount` | COA tree. `parentId`, `code`, `name`, `normalBalance`, `accountTypeId`, `allowPosting`. |
| `AccountingDimension` | Dimensi seperti cost center, project, outlet. |
| `AccountingDimensionValue` | Nilai dimensi. |
| `JournalEntry` | Header jurnal. `journalNumber`, `journalDate`, `sourceType`, `sourceId`, `postingKey`, `status`, `description`. |
| `JournalEntryLine` | Account, debit, credit, currency, exchange rate, dimensions. |
| `JournalPostingRule` | Mapping event bisnis ke akun. |
| `JournalPostingRuleLine` | Formula debit/kredit. |
| `JournalReversal` | Hubungan reversal. |
| `CashAccount` | Kas. |
| `BankAccount` | Rekening bank. |
| `BankStatement` | Statement. |
| `BankStatementLine` | Detail statement. |
| `BankReconciliation` | Rekonsiliasi. |
| `BankReconciliationLine` | Match transaksi. |
| `CashReceipt` | Penerimaan kas umum. |
| `CashDisbursement` | Pengeluaran kas. |
| `CashTransfer` | Transfer kas/bank. |
| `AccountsReceivable` | Subledger piutang. |
| `AccountsReceivableMovement` | Mutasi piutang immutable. |
| `AccountsPayable` | Subledger utang. |
| `AccountsPayableMovement` | Mutasi utang immutable. |
| `PaymentTerm` | Termin. |
| `Budget` | Header anggaran. |
| `BudgetLine` | Anggaran per akun/dimensi/periode. |
| `BudgetRevision` | Revisi. |
| `BudgetCommitment` | Komitmen PR/PO. |
| `TaxCode` | Kode pajak. |
| `TaxTransaction` | Pajak transaksi. |
| `TaxSettlement` | Penyelesaian pajak. |
| `FinancialStatementDefinition` | Definisi laporan keuangan. |
| `FinancialStatementLine` | Mapping akun/formula. |
| `PeriodClose` | Tutup periode. |
| `PeriodReopen` | Controlled reopen. |
| `ConsolidationGroup` | Grup konsolidasi. |
| `ConsolidationEntry` | Eliminasi/konsolidasi. |

Aturan:

- `postingKey` unik per tenant dan source transaction.
- Total debit harus sama dengan total credit.
- Journal posted tidak diedit; gunakan reversal.
- Periode closed menolak posting kecuali controlled reopen.
- Jangan menggunakan floating point untuk uang.

## 12.13. SDM, Kehadiran, dan Payroll

Buat pada `hr-payroll.prisma`:

| Model | Fungsi |
|---|---|
| `Employee` | Pegawai. `employeeNumber`, `userId`, `legalEntityId`, `departmentId`, `positionId`, `employmentStatus`. |
| `EmployeePersonalData` | Data personal sensitif dengan kontrol akses. |
| `EmployeeAddress` | Alamat. |
| `EmployeeEmergencyContact` | Kontak darurat. |
| `EmploymentContract` | Kontrak. |
| `EmployeeAssignment` | Penempatan perusahaan/outlet/departemen. |
| `Position` | Posisi. |
| `JobTitle` | Jabatan. |
| `RecruitmentRequest` | Kebutuhan pegawai. |
| `JobVacancy` | Lowongan. |
| `Applicant` | Pelamar. |
| `ApplicantStage` | Tahap seleksi. |
| `Interview` | Wawancara. |
| `OnboardingTask` | Onboarding. |
| `WorkSchedule` | Jadwal kerja. |
| `WorkShift` | Shift. |
| `EmployeeShiftAssignment` | Penugasan shift. |
| `AttendanceRecord` | Presensi. |
| `AttendanceCorrection` | Koreksi. |
| `LeaveType` | Jenis cuti/izin. |
| `LeaveBalance` | Saldo cuti. |
| `LeaveRequest` | Pengajuan. |
| `OvertimeRequest` | Lembur. |
| `PerformanceGoal` | Sasaran. |
| `PerformanceReview` | Penilaian. |
| `EmployeeCompetency` | Kompetensi. |
| `TrainingProgram` | Pelatihan. |
| `TrainingEnrollment` | Peserta. |
| `DisciplinaryAction` | Tindakan disiplin. |
| `PayrollPeriod` | Periode payroll. |
| `PayrollComponent` | Komponen pendapatan/potongan. |
| `EmployeePayrollComponent` | Komponen per pegawai. |
| `PayrollRun` | Proses payroll. |
| `PayrollResult` | Hasil per pegawai. |
| `PayrollResultLine` | Detail komponen. |
| `PayrollApproval` | Approval. |
| `Payslip` | Slip gaji. |
| `EmployeeLoan` | Pinjaman. |
| `EmployeeLoanInstallment` | Angsuran. |
| `PayrollBankTransfer` | Transfer bank. |
| `PayrollJournalLink` | Hubungan payroll ke jurnal. |

## 12.14. Aset dan Pemeliharaan

Buat pada `asset.prisma`:

| Model | Fungsi |
|---|---|
| `AssetCategory` | Kategori aset. |
| `Asset` | Master aset. `assetNumber`, `name`, `categoryId`, `acquisitionDate`, `acquisitionCost`, `usefulLifeMonths`, `residualValue`, `locationId`, `status`. |
| `AssetLocationHistory` | Riwayat lokasi. |
| `AssetAssignment` | Penempatan/peminjaman. |
| `AssetDepreciationMethod` | Metode. |
| `AssetDepreciationSchedule` | Jadwal penyusutan. |
| `AssetDepreciationPosting` | Posting. |
| `AssetRevaluation` | Revaluasi. |
| `AssetMaintenancePlan` | Preventive plan. |
| `MaintenanceWorkOrder` | Work order. |
| `MaintenanceWorkOrderPart` | Spare part. |
| `MaintenanceWorkLog` | Pelaksanaan. |
| `AssetDamageReport` | Kerusakan. |
| `AssetDisposal` | Penghapusan/penjualan. |
| `AssetStockCount` | Opname aset. |

## 12.15. Investor dan Bagi Hasil

Buat pada `revenue-sharing.prisma`:

| Model | Fungsi |
|---|---|
| `Investor` | Investor, dapat terhubung ke business partner/user. |
| `InvestmentProject` | Objek investasi: perusahaan/brand/outlet/project. |
| `InvestmentContribution` | Setoran modal. |
| `InvestmentUse` | Penggunaan modal. |
| `OwnershipShare` | Kepemilikan bertanggal efektif. |
| `RevenueShareContract` | Kontrak berversi. `basisType`, `effectiveFrom`, `effectiveUntil`, `status`. |
| `RevenueShareContractParty` | Para pihak dan role. |
| `RevenueShareTier` | Persentase bertingkat/BEP. |
| `RevenueShareDeductionRule` | Biaya yang boleh dikurangi. |
| `RevenueShareWaterfallStep` | Urutan distribusi. |
| `RevenueShareCalculation` | Header perhitungan. |
| `RevenueShareCalculationInput` | Snapshot input. |
| `RevenueShareCalculationResult` | Hak per pihak. |
| `RevenueShareApproval` | Approval. |
| `RevenueSharePayable` | Utang bagi hasil. |
| `RevenueSharePayment` | Pembayaran. |
| `CapitalReturn` | Pengembalian modal. |
| `BreakEvenMilestone` | BEP dan threshold. |

Semua perhitungan menyimpan snapshot formula/version dan tidak boleh berubah setelah approved.

## 12.16. Workflow, Approval, Notification, dan Task

Buat pada `workflow.prisma`:

| Model | Fungsi |
|---|---|
| `WorkflowDefinition` | Definisi workflow per document type. |
| `WorkflowVersion` | Versioning. |
| `WorkflowStep` | Step serial/paralel. |
| `WorkflowStepApproverRule` | Role/user/scope/limit. |
| `WorkflowInstance` | Instance dokumen. |
| `WorkflowInstanceStep` | Status step. |
| `WorkflowActionLog` | Submit/review/approve/reject/return/delegate. |
| `ApprovalInbox` | Projection inbox pengguna. |
| `ApprovalDelegation` | Delegasi. |
| `Task` | Tugas umum. |
| `TaskAssignment` | Penugasan. |
| `Notification` | Notifikasi in-app. |
| `NotificationRecipient` | Penerima/read status. |
| `NotificationTemplate` | Template. |
| `NotificationDelivery` | Email/SMS/WhatsApp/push result. |
| `EscalationRule` | SLA dan eskalasi. |

## 12.17. Integrasi, API Client, Webhook, Offline Sync, dan Audit

Buat pada `integration-audit.prisma`:

| Model | Fungsi |
|---|---|
| `ApiClient` | Client machine-to-machine. |
| `ApiCredential` | Hash/metadata credential. |
| `ApiScope` | Scope API. |
| `WebhookEndpoint` | Endpoint pelanggan. |
| `WebhookSubscription` | Event yang diikuti. |
| `WebhookDelivery` | Delivery/retry. |
| `IntegrationConnection` | Koneksi Smartlink, marketplace, eCampus/eSchool, ekspedisi. |
| `IntegrationCredential` | Secret reference, bukan plaintext biasa. |
| `IntegrationEvent` | Event integrasi. |
| `IntegrationError` | Error dan retry. |
| `SyncDeviceCursor` | Cursor per device/entity. |
| `SyncInbox` | Deduplikasi push dari client. |
| `SyncOutbox` | Event keluar server. |
| `SyncConflict` | Konflik. |
| `IdempotencyRecord` | Hasil request idempotent. |
| `AuditEvent` | Audit immutable. `actorId`, `action`, `entityType`, `entityId`, `beforeJson`, `afterJson`, `requestId`, `ipAddress`, `occurredAt`. |
| `SecurityEvent` | Login gagal, token replay, permission denied. |
| `JobExecution` | Riwayat background job. |
| `ImportJob` | Import file. |
| `ImportJobRow` | Validasi per row. |
| `ExportJob` | Export asynchronous. |

## 12.18. Reporting dan Analitik

Buat model ringan:

| Model | Fungsi |
|---|---|
| `SavedView` | Filter/sort/column setting per user/resource. |
| `ReportDefinition` | Definisi laporan. |
| `ReportParameterDefinition` | Parameter. |
| `ScheduledReport` | Jadwal. |
| `ReportExecution` | Eksekusi dan file hasil. |
| `DashboardDefinition` | Dashboard per role. |
| `DashboardWidget` | Widget. |
| `KpiDefinition` | KPI. |
| `KpiSnapshot` | Snapshot nilai KPI. |

---

# 13. MODEL BASENYA HARUS BENAR-BENAR DIIMPLEMENTASIKAN

Untuk setiap model di atas, agen wajib menentukan:

1. tujuan;
2. primary key;
3. tenant scope;
4. field dan tipe;
5. nullability;
6. default;
7. relation;
8. foreign key action;
9. unique constraint;
10. index berdasarkan query nyata;
11. status lifecycle;
12. audit field;
13. soft-delete/immutability policy;
14. money/quantity precision;
15. migration order;
16. seed bila diperlukan.

Jangan membuat tabel tanpa relasi hanya untuk mengejar jumlah. Jangan membuat model duplikat yang mempunyai tanggung jawab sama.

Buat `docs/database/model-catalog.md` yang memetakan semua model ke domain dan menu.

---

# 14. SEED DATA DAN PROVISIONING DEFAULT WAJIB

Semua seed harus idempotent.

## 14.1. Platform seed

- schema `platform` dan `platform__audit`;
- Indonesia;
- mata uang IDR;
- timezone Asia/Jakarta;
- global permission actions;
- global menu templates;
- global role templates;
- subscription plans;
- system settings;
- schema migration catalog;
- platform super admin development `admin` dengan password bootstrap `<BOOTSTRAP_PASSWORD>`, `mustChangePassword=true`, hash Argon2, dan role `PLATFORM_SUPER_ADMIN`;
- locale `id`, `en`, `ar`, `zh-CN` beserta translation catalog minimum;
- subscription product `POS_DEVICE_LICENSE`;
- empat package offering default: Rp250.000, Rp400.000, Rp600.000, dan Rp750.000 per POS per bulan;
- contoh diskon 10% untuk jumlah perangkat di atas 10;
- payment provider `ESMARTLINK` dalam keadaan disabled sampai konfigurasi tersedia;
- channel demo Esmartlink tanpa credential nyata.


## 14.1A. Aturan seed Platform Super Admin

Seed wajib membuat:

```text
Username           : admin
Initial password   : <BOOTSTRAP_PASSWORD>
Role               : PLATFORM_SUPER_ADMIN
mustChangePassword : true
Status             : ACTIVE
```

Implementasi seed:

1. normalisasi username menjadi `admin`;
2. cari user existing;
3. jika belum ada, hash `<BOOTSTRAP_PASSWORD>` dengan Argon2 dan buat user;
4. jika sudah ada, jangan mengubah hash, password, atau `mustChangePassword`;
5. upsert role dan role assignment;
6. audit bootstrap creation tanpa mencatat password;
7. production menggunakan `BOOTSTRAP_SUPER_ADMIN_PASSWORD` dari secret;
8. endpoint change password wajib mencabut refresh-token family lama;
9. UI memaksa halaman ganti password sebelum admin membuka portal utama.

## 14.2. Demo sandbox

Buat schema:

```text
demo
demo__audit
```

Seed demo:

```text
Tenant/Schema : demo
Perusahaan    : PT Demo eBisnis Indonesia
Brand         : Demo Cafe & Retail
Region        : Wilayah A
Gudang Parent : GDG-PARENT
Toko A        : TOKO-A
Toko B        : TOKO-B
Cafe A        : CAFE-A
```

Akun demo:

```text
Username : demo
Password : Demo123!
Role     : DEMO_USER
```

Sediakan tombol `Coba Demo` yang dapat membuat sesi tanpa meminta password. Endpoint internal
tetap menerbitkan token demo berumur pendek dan hanya mengarah ke schema `demo`.

Data demo:

- user dan role terbatas;
- menu tree lengkap;
- produk `ROKOK-DEMO`, `AYAM`, `MINYAK`, `BUMBU`, `FRIED-CHICKEN`;
- supplier A dan B;
- UOM;
- opening balance melalui ledger;
- stok tree Wilayah A = 250 unit;
- minimum stock;
- Request Order;
- PO 100;
- receipt draft 60;
- skenario Backorder;
- Internal Transfer;
- BOM;
- data dashboard.

Buat reset job idempotent:

```text
drop/recreate atau truncate terkontrol
apply tenant migration versi terbaru
install audit
seed demo
record demo reset
```

## 14.3. Seed setiap pendaftar baru

Setelah schema tenant dan audit dibuat, seed data awal sesuai bagian onboarding. Gunakan
`StarterDataMarker.isSample=true`.

Contoh tenant hasil pendaftaran:

```text
Pendaftar        : Joni Utama
Username         : joni_utama
Schema ERP       : joni_utama
Schema Audit     : joni_utama__audit
Legal Entity     : Joni Utama
Brand Default    : Joni Utama
Outlet Utama     : OUTLET-UTAMA
Gudang Parent    : GDG-PARENT
Owner            : PIC pendaftaran
```

Credential:

- jika user memilih password sendiri, simpan hash Argon2 dan jangan echo password;
- jika `generatePassword=true`, buat password acak kuat, tampilkan satu kali, lalu
  `mustChangePassword=true`.
# 15. BACKEND APPLICATION FRAMEWORK REUSABLE

Buat komponen backend reusable:

```text
BaseQueryDto
PaginationDto
SortDto
FilterParser dengan whitelist
ApiResponse<T>
PagedResponse<T>
RequestContext
TenantContext
CurrentUser decorator
CurrentTenant decorator
Public decorator
Permissions decorator
Scopes decorator
JwtAuthGuard global
PermissionGuard
TenantScopeGuard
StepUpGuard
PrismaService
Transactional helper
IdempotencyService
AuditService
NumberSequenceService
Money utility
Decimal serialization interceptor
```

Generic CRUD hanya untuk master sederhana. Buat reusable service yang tetap memerlukan resource config dan whitelist.

Contoh resource config:

```typescript
export const supplierCrudConfig = defineCrudResource({
  resource: 'supplier',
  tenantScoped: true,
  softDelete: true,
  searchableFields: ['code', 'name', 'taxNumber'],
  sortableFields: ['code', 'name', 'createdAt'],
  permissions: {
    read: 'SUPPLIER.READ',
    create: 'SUPPLIER.CREATE',
    update: 'SUPPLIER.UPDATE',
    delete: 'SUPPLIER.DELETE',
    export: 'SUPPLIER.EXPORT'
  }
});
```

Jangan menggunakan generic CRUD untuk posting stok, penerimaan, backorder, transfer, sale, journal, payroll, atau production.

---

# 16. FRONTEND DESIGN SYSTEM DAN REUSE ENGINE

Buat design system dengan komponen:

```text
AppShell
DesktopSidebar
MobileNavigation
TopBar
TenantSwitcher
CompanySwitcher
OutletSwitcher
WarehouseSwitcher
CommandMenu
PageHeader
Breadcrumbs
PermissionGuard
FeatureGuard
StatusBadge
EmptyState
ErrorState
LoadingState
ConfirmDialog
StepUpDialog
MoneyDisplay
QuantityDisplay
DateTimeDisplay
AuditTimeline
ApprovalTimeline
AttachmentPanel
NotificationCenter
```

## 16.1. Data grid reusable

Buat `EbDataGrid` berdasarkan TanStack Table:

- server-side pagination;
- search;
- filter;
- sorting;
- row selection;
- bulk action;
- column visibility;
- column ordering;
- sticky columns;
- saved view;
- export button sesuai permission;
- responsive card fallback pada layar kecil;
- loading skeleton;
- error retry;
- empty state.

## 16.2. Form reusable

Buat komponen:

```text
EbForm
EbTextField
EbTextAreaField
EbNumberField
EbMoneyField
EbQuantityField
EbDateField
EbDateTimeField
EbSelectField
EbLookupField
EbTreeSelectField
EbCheckboxField
EbSwitchField
EbFileField
EbUomField
EbProductLookup
EbSupplierLookup
EbWarehouseLookup
```

Gunakan React Hook Form + Zod.

## 16.3. Metadata-driven CRUD engine

Buat `defineResource()` dan `CrudPage` yang dapat membentuk list, create, edit, detail, delete/disable, audit, import/export dari metadata.

Implementasikan minimal untuk:

- Country;
- Province;
- UOM;
- Product Category;
- Product;
- Supplier;
- Region;
- Warehouse;
- Stock Policy;
- User;
- Role.

## 16.4. Document engine

Buat reusable `DocumentPage` untuk header-line workflow:

- header form;
- line editor;
- totals;
- related documents;
- attachments;
- approval timeline;
- audit trail;
- actions berdasarkan status dan permission.

Implementasikan minimal untuk:

- Request Order;
- Purchase Order;
- Goods Receipt;
- Purchase Backorder;
- Internal Transfer.

## 16.5. Custom pages

Buat khusus:

- Login;
- Dashboard;
- User Management;
- Role Permission Tree;
- Stock Tree Monitoring;
- Receiving validation;
- Internal Transfer monitoring.

---

# 17. STRUKTUR MENU DAN ROUTE MVP

Root sidebar:

```text
Beranda
Kasir / POS
Penjualan
Produk dan Harga
Pelanggan dan CRM
Pembelian
Gudang dan Persediaan
Produksi
Quality Control
Distribusi dan Pengiriman
Keuangan dan Akuntansi
Investor dan Bagi Hasil
SDM dan Payroll
Aset dan Pemeliharaan
Workflow dan Persetujuan
Laporan dan Analitik
Langganan dan Perangkat
Master Data
Integrasi dan API
Administrasi Sistem
Bantuan dan Dukungan
```

Untuk MVP, menu yang belum diimplementasikan penuh tetap boleh tampil sebagai `COMING_SOON` hanya jika:

- seed menu lengkap tersedia;
- permission dapat diatur;
- route menampilkan halaman status yang informatif;
- tidak mengklaim fitur sudah selesai.

Menu aktif penuh MVP:

```text
Beranda
Produk dan Harga > Produk
Produk dan Harga > Kategori
Produk dan Harga > UOM
Pembelian > Request Order
Pembelian > Purchase Order
Pembelian > Penerimaan Barang
Pembelian > Backorder
Pembelian > Pemasok
Gudang dan Persediaan > Gudang
Gudang dan Persediaan > Minimum Stok
Gudang dan Persediaan > Internal Transfer
Gudang dan Persediaan > Monitoring Stok Tree
Administrasi Sistem > Pengguna
Administrasi Sistem > Role
Administrasi Sistem > Hak Akses Menu
Administrasi Sistem > Audit
Platform Administration > Dashboard
Platform Administration > Pendaftar
Platform Administration > Tenant dan Schema
Platform Administration > Harga Langganan POS
Platform Administration > Harga Khusus Tenant
Platform Administration > Program Diskon dan Promo
Platform Administration > Perangkat POS
Platform Administration > Subscription
Platform Administration > Invoice
Platform Administration > Pembayaran Esmartlink
Platform Administration > Rekonsiliasi
Platform Administration > Bahasa dan Terjemahan
```

---

# 18. ENDPOINT API MVP WAJIB

## Public registration dan demo

```text
GET  /api/v1/public/registration-config
POST /api/v1/public/usernames/check
POST /api/v1/public/registrations
GET  /api/v1/public/registrations/:id/status
POST /api/v1/public/registrations/:id/retry
POST /api/v1/public/demo/session
GET  /api/v1/public/demo/status
```

Contoh response sukses registration:

```json
{
  "status": "READY",
  "registrationId": "uuid",
  "tenantId": "uuid",
  "username": "joni_utama",
  "schemaName": "joni_utama",
  "auditSchemaName": "joni_utama__audit",
  "loginUrl": "http://localhost:5173/login",
  "temporaryPassword": "hanya-jika-digenerate-server",
  "mustChangePassword": true
}
```

## Onboarding

```text
GET  /api/v1/onboarding
PUT  /api/v1/onboarding/business-profile
POST /api/v1/onboarding/legal-entities
POST /api/v1/onboarding/brands
POST /api/v1/onboarding/outlets
POST /api/v1/onboarding/warehouses
POST /api/v1/onboarding/owners
POST /api/v1/onboarding/investors
POST /api/v1/onboarding/management-users
POST /api/v1/onboarding/complete
POST /api/v1/onboarding/remove-starter-data
```

## Tenant provisioning admin

```text
GET  /api/v1/platform/provisioning-jobs
GET  /api/v1/platform/provisioning-jobs/:id
POST /api/v1/platform/provisioning-jobs/:id/retry
POST /api/v1/platform/tenants/:id/migrate
GET  /api/v1/platform/tenants/:id/schema-status
POST /api/v1/platform/demo/reset
```

## Platform Super Admin

```text
GET    /api/v1/platform/dashboard
GET    /api/v1/platform/registrations
GET    /api/v1/platform/registrations/:id
PATCH  /api/v1/platform/registrations/:id
GET    /api/v1/platform/tenants
GET    /api/v1/platform/tenants/:id
POST   /api/v1/platform/tenants/:id/activate
POST   /api/v1/platform/tenants/:id/suspend
POST   /api/v1/platform/tenants/:id/support-sessions
DELETE /api/v1/platform/support-sessions/:id
GET    /api/v1/platform/support-sessions/:id/master-data/:resource
PATCH  /api/v1/platform/support-sessions/:id/master-data/:resource/:recordId
POST   /api/v1/platform/auth/step-up
GET    /api/v1/platform/audit
```

Support write endpoint harus memakai resource whitelist, schema registry, permission, step-up,
alasan, optimistic version, dan audit. Jangan membuat endpoint SQL generik.

## Locale dan translation

```text
GET    /api/v1/public/locales
GET    /api/v1/public/translations/:locale
GET    /api/v1/platform/locales
POST   /api/v1/platform/locales
PATCH  /api/v1/platform/locales/:id
GET    /api/v1/platform/translations
PUT    /api/v1/platform/translations/:locale/:key
POST   /api/v1/platform/translations/import
GET    /api/v1/platform/translations/export
PATCH  /api/v1/me/locale
```

## Pricing, discount, dan subscription

```text
GET    /api/v1/platform/modules
POST   /api/v1/platform/modules
PATCH  /api/v1/platform/modules/:id
GET    /api/v1/platform/features
POST   /api/v1/platform/features
PATCH  /api/v1/platform/features/:id
GET    /api/v1/platform/subscription-products
GET    /api/v1/platform/subscription-plans
POST   /api/v1/platform/subscription-plans
PATCH  /api/v1/platform/subscription-plans/:id
POST   /api/v1/platform/subscription-plans/:id/versions
POST   /api/v1/platform/subscription-plan-versions/:id/clone
PUT    /api/v1/platform/subscription-plan-versions/:id/modules
PUT    /api/v1/platform/subscription-plan-versions/:id/features
PUT    /api/v1/platform/subscription-plan-versions/:id/prices
POST   /api/v1/platform/subscription-plan-versions/:id/publish
POST   /api/v1/platform/subscription-plan-versions/:id/retire
GET    /api/v1/public/subscription-packages
GET    /api/v1/public/subscription-packages/compare
GET    /api/v1/platform/subscription-prices
POST   /api/v1/platform/subscription-prices
GET    /api/v1/platform/subscription-addons
POST   /api/v1/platform/subscription-addons
PATCH  /api/v1/platform/subscription-addons/:id
POST   /api/v1/platform/tenant-plan-contracts
PATCH  /api/v1/platform/tenant-plan-contracts/:id
POST   /api/v1/platform/tenant-price-overrides
PATCH  /api/v1/platform/tenant-price-overrides/:id
GET    /api/v1/platform/discount-programs
POST   /api/v1/platform/discount-programs
PATCH  /api/v1/platform/discount-programs/:id
POST   /api/v1/platform/discount-programs/:id/simulate
POST   /api/v1/subscriptions/quotes
POST   /api/v1/subscriptions/quotes/:id/accept
GET    /api/v1/subscriptions
POST   /api/v1/subscriptions
POST   /api/v1/subscriptions/:id/devices
DELETE /api/v1/subscriptions/:id/devices/:deviceId
GET    /api/v1/devices
POST   /api/v1/devices
POST   /api/v1/devices/:id/revoke
GET    /api/v1/billing/invoices
POST   /api/v1/billing/invoices
GET    /api/v1/billing/invoices/:id
POST   /api/v1/billing/invoices/:id/payment-orders
```

Quote request wajib mendukung:

```text
paymentMode = PER_DEVICE | SELECTED_DEVICES | CONSOLIDATED_ALL_DEVICES
deviceIds
billingInterval
billingIntervalCount
promoCode
```

## Esmartlink

Create-order tests:

- payload order_id;
- amount decimal conversion;
- customer;
- item list;
- selected channel;
- default channels;
- expiry;
- callback/success/failure URL;
- provider response `code=0`;
- payment URL;
- provider error;
- idempotent create;
- reuse valid waiting payment order;
- replace expired order;
- request/response masking.

Inquiry tests:

- transaction_id dari stored provider response;
- URL inquiry;
- credential precedence;
- provider status success;
- provider status belum bayar;
- invalid JSON;
- timeout;
- retry/backoff;
- manual single check;
- batch 300;
- concurrency limit;
- progress persisten;
- worker restart;
- result diproses callback processor;
- duplicate inquiry tidak menggandakan payment/allocation/entitlement;


```text
GET    /api/v1/platform/payment-providers/esmartlink
PATCH  /api/v1/platform/payment-providers/esmartlink
GET    /api/v1/platform/payment-channels
POST   /api/v1/platform/payment-channels
PATCH  /api/v1/platform/payment-channels/:id
POST   /api/v1/platform/payment-channels/import-legacy-config
POST   /api/v1/payments/esmartlink/orders
POST   /api/v1/billing/payment-orders/:id/check-payment
POST   /api/v1/platform/payments/check-batches
GET    /api/v1/platform/payments/check-batches/:id
POST   /api/v1/payments/esmartlink/inquiry
POST   /api/v1/payments/esmartlink/callback
GET    /api/v1/payments/orders/:id
POST   /api/v1/platform/payments/:id/reconcile
POST   /api/v1/platform/payment-callbacks/:id/replay
GET    /api/v1/platform/payment-h2h-logs
```

Callback endpoint tidak menggunakan auth user, tetapi wajib provider validation, rate limit,
body-size limit, idempotency, H2H logging, dan payload validation.



## Authentication

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/change-password
POST /api/v1/auth/step-up
```

## Context dan menu

```text
GET /api/v1/me/context
GET /api/v1/me/menus
GET /api/v1/me/permissions
```

## User dan access control

```text
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id
GET    /api/v1/roles
POST   /api/v1/roles
GET    /api/v1/roles/:id
PATCH  /api/v1/roles/:id
DELETE /api/v1/roles/:id
GET    /api/v1/roles/:id/permissions
PUT    /api/v1/roles/:id/permissions
POST   /api/v1/roles/:id/clone
GET    /api/v1/roles/:id/menu-preview
```

## Master

```text
/api/v1/regions
/api/v1/outlets
/api/v1/warehouses
/api/v1/uoms
/api/v1/product-categories
/api/v1/products
/api/v1/suppliers
/api/v1/stock-policies
```

## Request Order

```text
GET  /api/v1/request-orders
POST /api/v1/request-orders
GET  /api/v1/request-orders/:id
PATCH /api/v1/request-orders/:id
POST /api/v1/request-orders/:id/submit
POST /api/v1/request-orders/:id/approve
POST /api/v1/request-orders/:id/reject
POST /api/v1/request-orders/generate-min-stock
POST /api/v1/request-orders/consolidate
```

## Purchase Order

```text
GET  /api/v1/purchase-orders
POST /api/v1/purchase-orders
GET  /api/v1/purchase-orders/:id
PATCH /api/v1/purchase-orders/:id
POST /api/v1/purchase-orders/:id/submit
POST /api/v1/purchase-orders/:id/approve
POST /api/v1/purchase-orders/:id/send
GET  /api/v1/products/:id/suppliers
```

## Receipt dan Backorder

```text
GET  /api/v1/goods-receipts
POST /api/v1/goods-receipts
GET  /api/v1/goods-receipts/:id
PATCH /api/v1/goods-receipts/:id
POST /api/v1/goods-receipts/:id/inspect
POST /api/v1/goods-receipts/:id/validate
POST /api/v1/goods-receipts/:id/reverse-validation
POST /api/v1/goods-receipts/:id/create-backorder
GET  /api/v1/backorders
GET  /api/v1/backorders/:id
POST /api/v1/backorders/:id/assign-supplier
POST /api/v1/backorders/:id/create-purchase-order
POST /api/v1/backorders/:id/cancel-remaining
```

## Inventory dan transfer

```text
GET  /api/v1/inventory/balances
GET  /api/v1/inventory/movements
GET  /api/v1/inventory/stock-tree
GET  /api/v1/internal-transfers
POST /api/v1/internal-transfers
GET  /api/v1/internal-transfers/:id
POST /api/v1/internal-transfers/:id/approve
POST /api/v1/internal-transfers/:id/allocate
POST /api/v1/internal-transfers/:id/dispatch
POST /api/v1/internal-transfers/:id/arrive
POST /api/v1/internal-transfers/:id/validate-receipt
```

Semua create/action yang berisiko harus menerima `Idempotency-Key`.

---

# 19. VALIDASI BISNIS WAJIB

1. `acceptedQty + rejectedQty <= receivedQty`.
2. Received qty tidak boleh melampaui sisa PO tanpa permission override.
3. Backorder qty berasal dari shortage yang belum mempunyai backorder aktif atau split allocation yang jelas.
4. Goods Receipt draft/inspected tidak menambah stok.
5. Validasi receipt membuat movement dan balance dalam transaksi database yang sama.
6. Reversal receipt membuat movement lawan; tidak menghapus movement lama.
7. Pemasok pengganti harus mempunyai product-supplier mapping aktif atau melalui override berizin.
8. PO Backorder baru menyimpan parent/source link.
9. Internal transfer tidak boleh melebihi available qty sumber.
10. Dispatch memindahkan available ke in-transit.
11. Receipt validation memindahkan in-transit ke destination available.
12. Stock policy alert tidak diduplikasi selama alert aktif untuk produk-lokasi yang sama.
13. Auto Request Order tidak boleh membuat kebutuhan ganda terhadap alert yang sama.
14. Semua mutasi menghasilkan stock card/reference.
15. Cross-tenant ID harus menghasilkan 404 atau 403 tanpa membocorkan keberadaan data.
16. User tidak boleh meningkatkan role sendiri tanpa hak khusus.
17. Role `PLATFORM_SUPER_ADMIN` tidak boleh dibuat tenant biasa.
18. Menu tanpa `READ` tidak tampil pada `/me/menus`.
19. Permission action sensitif dapat memerlukan step-up.

---


13. Username normalisasi harus memenuhi regex schema.
14. Username/schema reserved harus ditolak.
15. Username/schema yang sudah ada tidak boleh diprovision ulang.
16. Provisioning tidak boleh menyatakan READY bila migration/seed/audit trigger gagal.
17. Login tenant harus memakai schema dari registry, bukan dari input pengguna.
18. User tenant A tidak boleh memperoleh client/schema tenant B.
19. Audit INSERT/UPDATE/DELETE harus ada dalam transaksi atau mekanisme konsisten.
20. Temporary password hanya boleh dilihat sekali.
21. Demo user tidak boleh menulis ke platform control plane atau schema tenant nyata.
22. Hapus data contoh tidak boleh menghapus data yang telah dipakai transaksi nyata.

# 20. TRANSAKSI DATABASE DAN CONCURRENCY

Gunakan `prisma.$transaction()` untuk:

- validate goods receipt;
- create backorder and links;
- dispatch internal transfer;
- validate transfer receipt;
- sale completion;
- journal posting;
- payroll posting;
- revenue share settlement.

Gunakan optimistic versioning atau PostgreSQL row locking/raw SQL terbatas untuk resource kritis. Raw SQL harus parameterized dan terdokumentasi.

Idempotency record menyimpan:

```text
tenantId
idempotencyKey
operation
requestHash
responseStatus
responseBody
resourceType
resourceId
expiresAt
```

Retry dengan key sama dan payload sama mengembalikan hasil sama. Payload berbeda dengan key sama menghasilkan conflict.

---

# 21. SECURITY WAJIB

- Argon2 password hashing;
- JWT access pendek;
- refresh token hash-only dan rotation;
- global auth guard;
- route public memakai decorator eksplisit;
- permission guard;
- tenant guard;
- rate limit login/refresh;
- validation whitelist dan forbid non-whitelisted;
- Helmet;
- CORS hanya localhost frontend pada development;
- secret dari env;
- masking log;
- tidak ada stack trace production;
- audit login, logout, permission denied, CRUD sensitif, receipt validation, stock movement;
- endpoint list mempunyai maximum page size;
- sort/filter field whitelist;
- upload mempunyai limit MIME dan size;
- export diaudit;
- CSRF dipertimbangkan sesuai strategi token storage.

Untuk web MVP, pilih salah satu strategi dan dokumentasikan:

1. access token memory + refresh token HttpOnly SameSite cookie; atau
2. seluruh token HttpOnly cookie dengan CSRF protection.

Jangan menyimpan refresh token plaintext di localStorage.

---

# 22. UI/UX WAJIB

Desain harus terlihat seperti produk SaaS modern, bukan admin template generik mentah.

Wajib:

- desktop sidebar collapsible;
- top bar dengan tenant/company/outlet selector;
- command palette;
- breadcrumb;
- dark/light mode;
- dashboard cards;
- list/table profesional;
- status badge konsisten;
- form section/card;
- sticky action bar pada document form;
- approval timeline;
- responsive mobile drawer;
- accessible keyboard navigation;
- empty/loading/error state;
- toast yang jelas;
- confirmation pada destructive action;
- Bahasa Indonesia yang formal dan mudah dipahami.

Halaman role permission harus menyerupai kebutuhan tree access:

```mermaid
flowchart LR
    ROLE[Pilih Role] --> TREE[Menu Tree]
    TREE --> ACTION[Checkbox Aksi]
    ACTION --> SCOPE[Scope Data]
    SCOPE --> PREVIEW[Preview Menu]
    PREVIEW --> SAVE[Simpan + Audit]
```

---


## 22.1. Landing, registration, login, dan demo

Bangun ulang konsep `ebisnis.jsp` dengan desain modern:

```text
PublicLayout
├── LandingPage
├── RegistrationPage
├── RegistrationSuccessPage
├── RegistrationStatusPage
├── LoginPage
├── DemoEntryPage
├── PricingPage
├── PrivacyPage
└── TermsPage
```

RegistrationPage wajib mempunyai:

- stepper responsif;
- validasi Zod;
- pengecekan username/schema secara debounce;
- preview nama schema;
- indikator available/not available;
- password strength;
- opsi generate password otomatis;
- persetujuan syarat dan privasi;
- loading provisioning;
- error recovery;
- tombol copy username/password;
- peringatan password hanya tampil sekali.

Registration success menampilkan:

```text
Nama bisnis
Username
Schema ERP
Schema Audit
Status provisioning
Tombol Masuk
Tombol Unduh Ringkasan Akun
```

Jangan menampilkan detail schema pada user biasa setelah onboarding bila tidak diperlukan, tetapi
tetap tersedia pada administrator dan support diagnostics.

## 22.2. First-run onboarding

Gunakan wizard yang dapat dilanjutkan:

- autosave;
- progress;
- skip hanya untuk step opsional;
- validasi;
- preview struktur perusahaan/brand/outlet;
- undang investor/manajemen;
- create default warehouse;
- selesai menuju dashboard.

## 22.3. Demo UX

Tombol `Coba Demo`:

- langsung membuat sesi demo;
- menampilkan banner sandbox;
- menunjukkan countdown expiry/reset;
- menonaktifkan aksi sensitif;
- menyediakan tombol `Daftar Bisnis Saya`;
- tidak membawa data demo saat registrasi kecuali fitur clone eksplisit dibuat kelak.


# 23. TEST WAJIB


## Registration dan multi-schema

- username normalization;
- reserved schema rejection;
- duplicate username;
- duplicate schema race condition;
- provisioning success;
- failure at each provisioning stage;
- retry idempotency;
- schema migration checksum;
- owner credential creation;
- password generated once;
- cross-schema query negative test;
- audit trigger INSERT/UPDATE/DELETE;
- audit masking;
- demo isolation;
- demo reset;
- schema client cache eviction;
- no fallback to public.

## Playwright registration flow

```text
Buka landing page
→ Daftar bisnis Joni Utama
→ Cek username joni_utama tersedia
→ Submit pendaftaran
→ Tunggu provisioning READY
→ Salin credential
→ Login
→ Ganti password bila temporary
→ Jalankan onboarding
→ Buat/cek perusahaan
→ Buat brand
→ Buat outlet/cafe/restoran
→ Buat investor
→ Undang manajemen
→ Masuk dashboard
→ Verifikasi schema registry melalui API admin
```

## Playwright demo flow

```text
Buka landing page
→ Klik Coba Demo
→ Masuk dashboard demo
→ Coba master/Request Order/PO
→ Pastikan aksi sensitif ditolak
→ Pastikan banner sandbox tampil
```


## Backend unit

- password/auth;
- permission resolution;
- menu tree filtering;
- decimal calculation;
- stock minimum calculation;
- Request Order generation dedupe;
- goods receipt validation;
- backorder shortage calculation;
- supplier redirect;
- internal transfer state transition;
- stock tree aggregation;
- idempotency.

## Backend integration

- Prisma repository tenant isolation;
- database constraints;
- transaction rollback;
- receipt posting movement and balance;
- transfer dispatch/receipt;
- cross-tenant negative tests;
- login and refresh rotation.

## Frontend

- login form;
- navigation permission;
- CRUD resource form;
- DataGrid filter/sort;
- role permission tree;
- Goods Receipt validation UI;
- stock tree rendering.

## Playwright E2E

Buat skenario:

```text
Login admin
→ Buka pengguna dan role
→ Buat role baru dan atur permission
→ Buka produk/pemasok
→ Setup minimum stok
→ Generate Request Order otomatis
→ Submit dan approve
→ Buat PO dan pilih pemasok
→ Buat receipt 60 dari PO 100
→ Inspect dan validate
→ Buat backorder 40
→ Pilih pemasok yang sama/berbeda
→ Buat PO backorder
→ Alokasikan stok receipt ke toko
→ Buat internal transfer
→ Dispatch
→ Login/berperan sebagai staf toko
→ Validate receipt
→ Periksa stock tree
```

---



# 23B. TESTING WAJIB VERSI 3

## Super admin

- login dengan password bootstrap;
- forced change password;
- seed ulang tidak mereset password;
- username `admin` ditolak pada registration;
- non-super-admin mendapat 403 pada `/platform/**`;
- support session kedaluwarsa;
- support write tanpa step-up ditolak;
- schema name dari request body diabaikan/ditolak;
- perubahan tenant menghasilkan audit di platform dan tenant.


## Package & Module Pricing

- seed empat paket dengan harga yang benar;
- paket published immutable;
- versi baru tidak mengubah quote/invoice lama;
- module dependency;
- module tree tri-state;
- `ALL_MODULES_AT_VERSION`;
- `INCLUDE_FUTURE_MODULES`;
- uniform tenant package;
- package per outlet;
- package per device;
- mixed package;
- entitlement tenant-wide;
- entitlement device;
- volume tier;
- add-on;
- tenant contract;
- module override;
- effective date overlap ditolak;
- package comparison API;
- quote calculation trace.

Test harga:

```text
1 POS POS_STARTER       = Rp250.000 sebelum pajak/fee/promo
1 POS POS_BUSINESS      = Rp400.000 sebelum pajak/fee/promo
1 POS POS_PROFESSIONAL  = Rp600.000 sebelum pajak/fee/promo
1 POS POS_COMPLETE      = Rp750.000 sebelum pajak/fee/promo
```

Jangan mengasumsikan hasil untuk lebih dari satu perangkat apabila volume tier atau promo aktif;
gunakan pricing engine dan snapshot explanation.


## Pricing dan discount

- 10 perangkat tidak mendapat rule `> 10`;
- 11 perangkat mendapat diskon 10%;
- tenant override sesuai effective date;
- expired override tidak dipakai;
- exclusive/best-price/stackable;
- rounding;
- promo usage limit;
- quote snapshot tidak berubah setelah rule diedit;
- amount menggunakan Decimal.

## Subscription

- satu device dibayar sendiri;
- selected devices;
- all devices consolidated;
- partial payment policy;
- device replacement;
- trial tidak berulang;
- revoked device tidak entitled;
- invoice immutable setelah issued.

## Esmartlink

Buat fixture JSON berdasarkan contract legacy:

```json
{
  "data": {
    "order_id": "EBI-ORDER-001",
    "amount": "200000.00",
    "transaction_time": "2026-07-30T10:00:00+07:00",
    "transaction_id": "ESM-TXN-001",
    "status": "success"
  }
}
```

Test:

- success callback;
- non-success/inquiry;
- duplicate `transaction_id`;
- duplicate callback setelah invoice paid;
- order tidak ditemukan;
- nominal salah;
- invalid date;
- missing field;
- invalid JSON;
- unknown IP tetap masuk H2H log tetapi tidak diproses sebagai pembayaran;
- exception tetap masuk H2H log;
- callback replay;
- ACK configurable;
- atomic rollback;
- entitlement hanya aktif satu kali;
- legacy channel parser valid, invalid, missing label, nonnumeric fee;
- expiry mapping seluruh pilihan legacy.

## Internationalization

- default `id`;
- user preference;
- tenant fallback;
- browser fallback;
- missing translation fallback;
- `ar` RTL;
- `zh-CN` Unicode;
- formatted IDR;
- backend error code diterjemahkan frontend;
- menu tree seluruh bahasa;
- Playwright screenshot/layout check untuk LTR dan RTL.

---

# 23A. UI/UX WAJIB UNTUK VERSI 5


## 23A.0. Public Website `/`

Route `/` langsung menampilkan website eBisnis.id, bukan redirect login.

```text
Top bar
Header/navigation
Hero
Partner logos
Ringkasan platform
Module showcase
Cara kerja
Demo CTA
Published package cards
Berita terbaru
Pengumuman
Testimoni
FAQ
Registration CTA
Kontak
Footer
```

Semua data berasal dari public CMS API. Paket berasal dari pricing engine published.
Mendukung SEO, Open Graph, sitemap, structured data, responsive images, accessibility,
Bahasa Indonesia, English, Arabic RTL, dan Mandarin.

---


## 23A.1. Platform Super Admin Portal

Route minimum:

```text
/platform
/platform/registrations
/platform/tenants
/platform/tenants/:id
/platform/provisioning
/platform/modules
/platform/features
/platform/packages
/platform/packages/new
/platform/packages/:id
/platform/packages/:id/versions/:versionId
/platform/packages/compare
/platform/addons
/platform/pricing
/platform/tenant-pricing
/platform/tenant-contracts
/platform/discounts
/platform/discounts/:id/simulator
/platform/devices
/platform/subscriptions
/platform/invoices
/platform/payments
/platform/payment-checks
/platform/payment-checks/:batchId
/platform/reconciliation
/platform/esmartlink
/platform/locales
/platform/translations
/platform/audit
```

App shell admin harus berbeda secara visual dari tenant ERP untuk mencegah salah konteks.

Saat membuka tenant support context tampilkan:

- nama tenant;
- tenant ID;
- schema target;
- mode read-only/read-write;
- waktu kedaluwarsa;
- alasan;
- tombol keluar context;
- banner peringatan permanen.


## 23A.2A. Package & Module Builder

Buat halaman package builder modern:

```text
Informasi Paket
├── Kode
├── Nama per bahasa
├── Segmen
├── Status
└── Periode berlaku

Modul dan Fitur
├── Tree modul
├── Tri-state checkbox
├── Feature detail
├── Limit
├── Dependency
└── Entitlement scope

Harga
├── Billing metric
├── Harga per interval
├── Volume tier
├── Minimum quantity
├── Currency
├── Tax policy
└── Effective date

Add-on
├── Modul tambahan
├── Feature tambahan
├── Harga
└── Scope

Kebijakan
├── Trial
├── Grace period
├── Future module policy
├── Mixed package policy
├── Device assignment
└── Upgrade/downgrade policy

Preview
├── Perbandingan paket
├── Simulasi 1, 10, 11, 50 perangkat
├── Tenant override
├── Promo
└── Invoice preview
```

Sediakan kartu package publik dengan perbandingan modul dan harga. Data berasal dari API,
bukan hard-coded React.


## 23A.2. Pricing and Discount Builder

Buat rule builder tanpa kode/eval:

```text
IF
├── selectedDeviceCount
├── operator: GT
└── value: 10

THEN
├── benefit: PERCENT_DISCOUNT
└── value: 10
```

Fitur:

- nested AND/OR;
- drag/reorder condition;
- effective date;
- priority;
- stacking policy;
- include/exclude tenant;
- live simulation;
- explanation hasil;
- preview invoice;
- audit history;
- duplicate program;
- publish/unpublish.

## 23A.3. Subscription Checkout

Alur:

```text
Pilih perangkat
→ Pilih pembayaran per perangkat / pilihan / semua perangkat
→ Pilih periode
→ Masukkan promo
→ Tampilkan base price
→ Tampilkan harga khusus tenant
→ Tampilkan setiap diskon
→ Tampilkan biaya admin channel
→ Tampilkan total
→ Accept quote
→ Buat invoice
→ Pilih channel Esmartlink
→ Pilih batas waktu
→ Tampilkan instruksi/VA
→ Monitoring pembayaran
→ Kuitansi dan entitlement
```

## 23A.4. Multi-language UI

Sediakan language switcher pada:

- landing page;
- registration;
- login;
- demo;
- tenant app shell;
- platform admin shell;
- user preferences.

Syarat:

- default Bahasa Indonesia;
- pilihan English, العربية, 简体中文;
- Bahasa Arab mengubah direction menjadi RTL;
- pilihan disimpan pada profil user dan local storage;
- fallback key terlihat hanya pada development;
- tidak ada label menu hard-coded;
- zod validation message menggunakan translation key;
- kolom dan filter tabel diterjemahkan;
- dokumen/invoice memiliki locale snapshot.

---


# 23C. TESTING WAJIB VERSI 5

## Master lifecycle

- `isActive=true` default;
- deactivate/activate;
- soft delete/restore;
- purge tanpa permission/step-up ditolak;
- purge record referenced ditolak;
- purge sample unreferenced berhasil;
- semua aksi diaudit.

## Seed

- setiap master relevan minimal 10 aktif;
- seed dua kali tidak duplikat;
- seed repair;
- cleanup tidak menghapus data nyata;
- tenant baru dan demo lulus verification.

## CMS

- admin mengubah hero tanpa rebuild;
- draft tidak publik;
- publish/schedule/archive;
- multi-language dan RTL;
- sanitasi rich text;
- package cards mengikuti pricing published;
- berita terbaru dan SEO;
- unauthorized write ditolak.

## Data dictionary

- seluruh Prisma model tercatat;
- seluruh FK dan index terdokumentasi;
- schema, migration, ERD, dan docs tidak drift.

---

# 24. QUALITY GATE

Sebelum menyatakan selesai, semua command berikut harus berhasil:

```bash
pnpm install
pnpm db:format
pnpm db:validate
pnpm db:migrate
pnpm db:generate
pnpm db:seed
pnpm api:generate
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Jalankan aplikasi:

```bash
pnpm dev
```

Verifikasi:

```text
Frontend       : http://localhost:5173
API            : http://localhost:3000/api/v1
Swagger UI     : http://localhost:3000/docs
OpenAPI JSON   : http://localhost:3000/api-json
Health endpoint: http://localhost:3000/api/v1/health
Platform Admin : http://localhost:5173/platform
```

Login demo:

```text
admin
<BOOTSTRAP_PASSWORD>
```

Jika script `pnpm dev` tidak dapat menjalankan dua app paralel, gunakan `concurrently` atau script pnpm recursive yang benar.

---

# 25. FASE IMPLEMENTASI WAJIB

## Fase 0 — SVN, environment, dan input

- buka `C:\opt\eBisnis`;
- verifikasi working copy SVN;
- baca seluruh input termasuk `ebisnis.jsp`;
- cek Node, pnpm, PostgreSQL;
- cek koneksi database;
- buat decision log;
- commit dokumentasi awal.

## Fase 1 — Monorepo dan foundation

- scaffold NestJS dan React/Vite;
- strict TypeScript;
- logger, validation, Swagger, error handling;
- shadcn/Tailwind/AppShell/PublicLayout;
- health check;
- `.svnignore`.

## Fase 2 — Platform schema dan authentication

- buat Prisma platform client;
- migration `platform` dan `platform__audit`;
- PlatformUser, Registration, Tenant, SchemaRegistry, Membership, Session;
- login/refresh/logout;
- global audit;
- seed global.

## Fase 3 — Canonical tenant schema dan migration catalog

- buat tenant Prisma schema/model catalog seluruh ERP;
- buat SQL tenant migrations berversi;
- buat checksum/manifest;
- buat schema audit dan trigger;
- test pada schema sementara;
- jangan langsung membuat semua tenant manual.

## Fase 4 — Schema Provisioner

- username normalization;
- availability;
- reservation lock;
- create ERP schema;
- create audit schema;
- migration runner;
- audit installer;
- seed tenant;
- create owner;
- verification;
- retry/cleanup/runbook.

## Fase 5 — Demo sandbox

- provision `demo` dan `demo__audit`;
- seed data demo;
- demo session;
- permission terbatas;
- reset job;
- UI banner.

## Fase 6 — Public registration dan login UI

- landing modern berdasarkan konsep `ebisnis.jsp`;
- registration form lengkap;
- username/schema availability;
- password mode;
- provisioning progress;
- success credential;
- login.

## Fase 7 — Onboarding

- legal entity/manajemen;
- brand;
- outlet/store/cafe/restaurant;
- warehouse;
- owner/investor;
- management membership;
- starter data;
- onboarding completion.

## Fase 8 — Menu, role, permission, dan CRUD engine

- seed tree menu;
- CRUD user;
- CRUD role;
- matrix permission tree;
- scope;
- generic grid/form;
- audit.


## Fase 8A — Multi-language foundation

- seed locale `id`, `en`, `ar`, `zh-CN`;
- i18next/react-i18next;
- translation catalog API;
- language switcher;
- RTL Arabic;
- locale preference;
- number/date/currency formatting;
- tests translation completeness dan RTL.

## Fase 8B — Platform Super Admin

- seed `admin` / `<BOOTSTRAP_PASSWORD>`;
- forced password change;
- platform role/permission;
- admin dashboard;
- registration/tenant/schema management;
- support session read-only dan read-write;
- step-up authentication;
- dual audit;
- cross-schema negative tests.

## Fase 8C — Package, module catalog, dynamic pricing, dan promotions

- module dan feature catalog;
- empat package seed Rp250.000/Rp400.000/Rp600.000/Rp750.000;
- package/version/module/feature/price/tier/add-on;
- package builder dan package comparison;
- uniform/per-outlet/per-device/mixed package;
- tenant contract dan tenant price override;
- discount program/rule/condition/benefit;
- rule builder;
- simulation;
- quote explanation;
- boundary test perangkat 10 dan 11;
- version/effective date/audit.

## Fase 8D — Subscription, device billing, dan Esmartlink

- device registry;
- per-device/selected/consolidated billing;
- subscription dan entitlement;
- invoice/line/allocation;
- karakterisasi source Java;
- Esmartlink channel parser;
- create-order mapper berdasarkan DownloadTagihanSiswaBankOnline;
- create payment order dan payment URL;
- callback dan duplicate handling;
- inquiry/check payment berdasarkan VirtualAccountBankAction;
- single check, batch check, dan reconciliation worker;
- H2H log always;
- reconciliation dan replay;
- subscription checkout UI;
- provider stub/fixture tests.


## Fase 8E — Public Website dan CMS

- website `/` mengikuti konsep `ebisnis.jsp`;
- page/block/news/announcement/FAQ/media;
- CMS admin;
- draft/review/publish/schedule/archive;
- multi-language;
- package cards dari pricing engine;
- preview token;
- SEO/sitemap;
- sanitization;
- E2E.

## Fase 8F — Master Seed dan Lifecycle Engine

- lifecycle columns;
- deactivate/activate;
- soft delete/restore;
- reference check;
- hard purge terkontrol;
- MasterSeedRegistry;
- minimal 10 record per master relevan;
- verify/repair/cleanup;
- seed exception document;
- test FK dan audit.

## Fase 9 — Master ERP MVP

- product;
- category;
- UOM;
- supplier;
- region/outlet/warehouse;
- stock policy;
- stock tree.

## Fase 10 — Request Order dan PO

- minimum stock;
- auto Request Order;
- notification;
- approval;
- consolidation;
- supplier selection;
- PO.

## Fase 11 — Receipt, Backorder, dan Internal Transfer

- receipt inspection/validation;
- stock posting;
- partial receipt;
- Backorder supplier same/other;
- PO backorder;
- allocation;
- transfer;
- destination validation.

## Fase 12 — Quality, security, E2E, dan SVN release

- cross-schema tests;
- audit tests;
- registration E2E;
- demo E2E;
- business flow E2E;
- super admin forced-password-change E2E;
- platform support context E2E;
- pricing override dan discount simulation E2E;
- per-device dan consolidated invoice E2E;
- Esmartlink success, duplicate, invalid host, invalid payload, wrong amount, dan replay E2E;
- locale id/en/ar/zh-CN dan RTL E2E;
- lint/test/build;
- README/runbook;
- final SVN diff dan atomic commit.

---
# 26. DEFINITION OF DONE

Pekerjaan dianggap selesai hanya jika:

Untuk Versi 4, daftar lama tetap berlaku dan ditambah syarat berikut:

1. repository terbentuk;
2. database migration berhasil;
3. tabel ERP terbentuk sesuai model catalog;
4. seed berhasil;
5. login berhasil;
6. menu tree berdasarkan permission tampil;
7. CRUD user dan role berfungsi;
8. CRUD master MVP berfungsi;
9. Request Order minimum stock berfungsi;
10. PO berfungsi;
11. receipt tidak menambah stok sebelum validasi;
12. partial receipt dapat membuat backorder;
13. backorder dapat membuat PO pemasok sama/berbeda;
14. internal transfer berfungsi sampai receipt validation;
15. stock tree menampilkan agregasi yang benar;
16. Swagger dapat dibuka;
17. Orval client tergenerate;
18. lint/test/build berhasil;
19. aplikasi dapat diuji di localhost;
20. README berisi command yang benar;
21. known limitations dicatat jujur.
22. landing page publik tersedia;
23. pendaftaran online berhasil;
24. username/schema availability berfungsi;
25. `joni_utama` dan `joni_utama__audit` dapat diprovision;
26. duplicate schema ditolak;
27. schema `demo` dan `demo__audit` tersedia;
28. Coba Demo dapat digunakan tanpa pendaftaran;
29. onboarding perusahaan, brand, outlet, investor, dan manajemen berfungsi;
30. seluruh perubahan CRUD masuk audit schema;
31. cross-schema isolation test lulus;
32. migration tenant dapat diterapkan ke tenant baru dan tenant existing;
33. SVN working copy bersih setelah commit yang disetujui;
34. credential dan `.env` tidak masuk SVN.


---

# 27. OUTPUT LAPORAN AKHIR AGEN

Setelah selesai, tampilkan:

1. ringkasan yang dibangun;
2. struktur folder;
3. jumlah model/tabel;
4. migration yang dibuat;
5. seed user dan data demo;
6. command menjalankan;
7. URL localhost;
8. hasil lint/test/build;
9. daftar fitur yang aktif;
10. daftar menu coming soon;
11. known limitations;
12. langkah selanjutnya.

Jangan hanya memberi instruksi. Tinggalkan workspace dalam kondisi runnable.

---

# 28. PERINTAH PERTAMA YANG HARUS DIKERJAKAN SEKARANG

Agen harus menjalankan urutan ini:

```text
1. Buka C:\opt\eBisnis.
2. Jalankan svn info dan svn status.
3. Baca MASTER_PROMPT_EBISNIS_V5.md dan seluruh docs/input.
4. Buat docs/architecture/ADR-001-multi-schema-tenancy.md.
5. Buat docs/architecture/ADR-002-prisma-dynamic-schema.md.
6. Buat docs/architecture/ADR-003-audit-trigger.md.
7. Buat docs/architecture/ADR-004-demo-sandbox.md.
8. Periksa PostgreSQL localhost:5432 database ebisnis.
9. Scaffold monorepo.
10. Bangun platform schema terlebih dahulu.
11. Bangun schema provisioner dan uji schema temporary.
12. Provision demo dan demo__audit.
13. Bangun public registration dan login.
14. Jalankan migration, seed, test, build.
15. Laporkan command dan hasil nyata.
```

Target localhost:

```text
Frontend : http://localhost:5173
API      : http://localhost:3000/api/v1
Swagger  : http://localhost:3000/docs
OpenAPI  : http://localhost:3000/api-json
Health   : http://localhost:3000/health
```

Akun demo:

```text
Username : demo
Password : Demo123!
```

Jangan melanjutkan ke seluruh modul ERP sebelum:

- platform migration lulus;
- tenant schema temporary lulus;
- audit trigger lulus;
- demo lulus;
- registration `joni_utama` lulus;
- cross-schema negative test lulus.

---
# AKHIR MASTER PROMPT

---

# 26A. DEFINITION OF DONE TAMBAHAN VERSI 4

1. Super admin, i18n, dynamic pricing, billing per-device/consolidated, dan Esmartlink telah diuji.
2. Tidak ada callback ganda, cross-schema leak, secret di SVN, atau label UI yang tidak dapat diterjemahkan.

---

# LAMPIRAN A — COMMAND BOOTSTRAP REFERENSI

Agen harus menyesuaikan command terhadap versi tool yang terpasang, tetapi hasil akhirnya wajib sama.

## A.1. Root workspace

```powershell
Set-Location C:\opt\eBisnis
New-Item -ItemType Directory -Force apps, packages, docs, scripts | Out-Null
corepack enable
corepack prepare pnpm@latest --activate
svn info
svn status
```

## A.2. Backend NestJS

```bash
pnpm dlx @nestjs/cli new apps/api \
  --package-manager pnpm \
  --strict \
  --skip-git

cd apps/api
pnpm add @nestjs/config @nestjs/swagger @nestjs/jwt \
  @nestjs/passport passport passport-jwt \
  class-validator class-transformer helmet argon2 \
  nestjs-pino pino-http @nestjs/throttler cookie-parser \
  decimal.js pg @prisma/client @prisma/adapter-pg

pnpm add -D prisma tsx @types/pg @types/passport-jwt \
  @types/cookie-parser supertest @types/supertest
```

## A.3. Prisma

```bash
pnpm dlx prisma init \
  --datasource-provider postgresql \
  --output ./src/generated/prisma
```

Contoh `prisma.config.ts` untuk Prisma yang menggunakannya:

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

Contoh file root `prisma/schema/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

Gunakan Prisma adapter PostgreSQL jika diwajibkan versi Prisma yang terpasang. Pastikan runtime dan seed menggunakan konfigurasi client yang sama.

## A.4. Frontend React/Vite

Dari root:

```bash
pnpm create vite apps/web --template react-ts
cd apps/web
pnpm add @refinedev/core @refinedev/react-router react-router \
  @tanstack/react-query @tanstack/react-query-devtools \
  @tanstack/react-table react-hook-form @hookform/resolvers zod \
  lucide-react date-fns recharts sonner clsx tailwind-merge \
  class-variance-authority

pnpm add -D orval vitest jsdom @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event \
  @playwright/test msw
```

Gunakan dokumentasi CLI shadcn yang sesuai versi terpasang untuk Vite. Setelah inisialisasi, tambahkan komponen yang tercantum pada prompt.

## A.5. Orval

Contoh `apps/web/orval.config.ts`:

```typescript
import { defineConfig } from 'orval';

export default defineConfig({
  ebisnis: {
    input: {
      target: process.env.VITE_OPENAPI_URL ?? 'http://localhost:3000/api-json',
    },
    output: {
      mode: 'tags-split',
      target: './src/generated/api',
      schemas: './src/generated/models',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      prettier: true,
    },
  },
});
```

Jika Orval versi terpasang memiliki opsi berbeda, baca dokumentasi versi tersebut dan sesuaikan tanpa mengubah tujuan.

## A.6. PostgreSQL check

```bash
PGPASSWORD="$PGPASSWORD" psql \
  -h localhost -p 5432 -U root -d ebisnis \
  -c 'select now(), current_database(), current_user;'
```

## A.7. Migration, seed, dan generated client

```bash
cd apps/api
pnpm prisma format
pnpm prisma validate
pnpm prisma migrate dev --name init_ebisnis
pnpm prisma generate
pnpm prisma db seed
```

## A.8. Menjalankan API dan frontend

Terminal 1:

```bash
pnpm --filter @ebisnis/api dev
```

Terminal 2, setelah API dan OpenAPI tersedia:

```bash
pnpm --filter @ebisnis/web api:generate
pnpm --filter @ebisnis/web dev
```

## A.9. Smoke test

```bash
curl -sS http://localhost:3000/api/v1/health
curl -sS http://localhost:3000/api-json | head
```

Login:

```bash
curl -sS -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<BOOTSTRAP_PASSWORD>"}'
```

---

# LAMPIRAN B — PRINSIP MIGRATION DAN DDL OTOMATIS

1. Prisma schema adalah sumber definisi model.
2. `prisma migrate dev` membuat dan menerapkan migration development.
3. `prisma generate` dijalankan eksplisit setelah schema/migration.
4. `prisma db seed` dijalankan eksplisit.
5. Migration SQL masuk SVN dan tidak diubah setelah dipakai environment bersama.
6. Production memakai `prisma migrate deploy`, bukan `migrate dev`.
7. Perubahan destructive harus mempunyai data migration dan verification query.
8. Tambah kolom wajib pada tabel berisi data menggunakan tahapan:

   ```text
   nullable column
   → backfill
   → verification
   → constraint/not null
   ```

9. Buat index berdasarkan pola query nyata, bukan semua field.
10. Gunakan partial index/custom SQL migration jika Prisma tidak cukup mengekspresikan kebutuhan PostgreSQL.

---

# LAMPIRAN C — CHECKLIST REVIEW MODEL

Untuk setiap model/tabel, periksa:

- [ ] nama domain jelas;
- [ ] tenant scope benar;
- [ ] primary key UUID;
- [ ] natural/business key mempunyai unique constraint yang tepat;
- [ ] relation dan on-delete aman;
- [ ] decimal precision benar;
- [ ] timestamp memakai timezone;
- [ ] status lifecycle terdokumentasi;
- [ ] audit field tersedia;
- [ ] soft delete hanya pada entity yang tepat;
- [ ] ledger tidak dapat diubah/dihapus;
- [ ] index mendukung list/filter/join;
- [ ] tidak ada cross-tenant relation;
- [ ] DTO tidak membocorkan field sensitif;
- [ ] seed idempotent;
- [ ] test constraint tersedia.



---


# LAMPIRAN D — DETAIL PSEUDOCODE SCHEMA PROVISIONER

```typescript
type ProvisionTenantCommand = {
  registrationId: string;
  desiredUsername: string;
  generatePassword: boolean;
};

async function provisionTenant(command: ProvisionTenantCommand) {
  const normalized = normalizeAndValidateSchemaName(command.desiredUsername);

  await acquireSchemaReservationLock(normalized);
  await assertUsernameAvailable(normalized);
  await assertSchemaUnavailableInRegistry(normalized);
  await assertSchemaUnavailableInPgNamespace(normalized);
  await assertSchemaUnavailableInPgNamespace(`${normalized}__audit`);

  const tenant = await createProvisioningRegistry(command.registrationId, normalized);

  try {
    await schemaProvisioner.createSchemas(tenant);
    await schemaProvisioner.applyMigrations(tenant);
    await schemaProvisioner.installAudit(tenant);
    await schemaProvisioner.seedTenant(tenant);
    const credential = await identityService.createOwnerCredential(tenant, command);
    await schemaProvisioner.verifyTenant(tenant);
    await markTenantReady(tenant);
    return credential;
  } catch (error) {
    await markProvisioningFailed(tenant, safeError(error));
    throw error;
  }
}
```

Jangan menahan satu transaksi platform terbuka selama seluruh DDL jika menyebabkan lock terlalu
lama. Gunakan state machine dengan transaksi kecil per tahap, reservation yang kuat, dan operasi
idempotent.

# LAMPIRAN E — SQL KEAMANAN SCHEMA

Contoh dasar, sesuaikan role aktual:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS platform__audit;
CREATE SCHEMA IF NOT EXISTS demo;
CREATE SCHEMA IF NOT EXISTS demo__audit;
```

Schema identifier dinamis harus dipasang dengan utility identifier quoting, bukan string
concatenation biasa.

Audit schema:

```sql
REVOKE ALL ON SCHEMA joni_utama__audit FROM PUBLIC;
GRANT USAGE ON SCHEMA joni_utama__audit TO ebisnis_runtime;
GRANT INSERT ON ALL TABLES IN SCHEMA joni_utama__audit TO ebisnis_audit_writer;
REVOKE UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA joni_utama__audit
FROM ebisnis_runtime, ebisnis_audit_writer;
```

# LAMPIRAN F — SVN WORKFLOW WINDOWS

```powershell
Set-Location C:\opt\eBisnis
svn update
svn status
pnpm install
pnpm check
svn diff
svn add apps packages docs scripts package.json pnpm-workspace.yaml
svn status
svn commit -m "foundation: add ebisnis multi-schema full-stack platform"
```

Jangan gunakan `svn add --force .` sebelum memeriksa ignore dan secret.

# LAMPIRAN G — CHECKLIST PENDAFTARAN

- [ ] Field sesuai ebisnis.jsp.
- [ ] Username tersedia.
- [ ] Username normalized.
- [ ] Schema name preview.
- [ ] Reserved name ditolak.
- [ ] Duplicate race ditangani.
- [ ] Password Argon2.
- [ ] Temporary password one-time.
- [ ] Tenant registry dibuat.
- [ ] ERP schema dibuat.
- [ ] Audit schema dibuat.
- [ ] Tenant migrations lengkap.
- [ ] Audit trigger terpasang.
- [ ] Seed default lengkap.
- [ ] Owner role lengkap.
- [ ] Login berhasil.
- [ ] Onboarding dapat dilanjutkan.
- [ ] Audit registration/provisioning lengkap.
- [ ] Cross-schema test lulus.
- [ ] Demo tidak bocor ke tenant.
- [ ] Failure/retry idempotent.


# LAMPIRAN H — STRUKTUR MENU LENGKAP YANG WAJIB DI-SEED

Bagian berikut adalah sumber menu lengkap. Agen wajib mengubahnya menjadi seed `Menu`, `MenuAction`, template role, route frontend, dan placeholder `COMING_SOON` untuk modul yang belum aktif.

# STRUKTUR MENU EBISNIS.ID — VERSI ENHANCED V2

> Penyempurnaan khusus proses penerimaan barang dari pemasok, backorder, internal transfer, minimum stok, dan manufaktur.

## 1. Tujuan

Dokumen ini merupakan versi enhanced dari struktur menu **eBisnis.id** untuk:

- Desktop / Web
- Android
- iOS
- Aplikasi Kasir / POS
- Aplikasi Pemilik / Investor
- Aplikasi Manajemen
- Aplikasi Karyawan / Operasional

Dokumen ini disusun agar:

1. mudah dipetakan ke **master menu tree**;
2. mudah dipetakan ke **hak akses role**;
3. mudah diterapkan ke **struktur database menu**;
4. mudah dipakai pada **UI desktop** maupun **mobile**;
5. mudah diturunkan menjadi **seed data menu** dan **otorisasi API**.

---

# 2. Prinsip Penyusunan Menu

## 2.1. Prinsip umum

- Menu disusun dalam bentuk **tree / hierarchy**.
- **Kasir / POS** wajib berada di **root menu**.
- Parent menu yang hanya berfungsi sebagai pengelompokan **tidak harus memiliki CRUD**.
- Menu harus bisa diberi:
  - kode menu,
  - ikon,
  - urutan,
  - route / URL,
  - platform target,
  - modul pemilik,
  - status aktif / nonaktif,
  - kebutuhan subscription,
  - kebutuhan approval,
  - sensitivitas data.

## 2.2. Struktur level menu

```text
ROOT
└── MODUL
    └── SUBMODUL / KELOMPOK PROSES
        └── MENU
            └── SUBMENU / AKSI / LAPORAN
```

## 2.3. Prinsip hak akses

Minimal hak akses yang perlu dipertimbangkan:

```text
READ
CREATE
UPDATE
DELETE
SUBMIT
REVIEW
APPROVE
REJECT
CANCEL
PRINT
EXPORT
IMPORT
POST
CLOSE_PERIOD
REOPEN
VIEW_AMOUNT
VIEW_COST
VIEW_PROFIT
MANAGE_DEVICE
CHECK_ALL
```

---

# 3. Root Menu Utama

```text
01. Beranda
02. Kasir / POS
03. Penjualan
04. Produk dan Harga
05. Pelanggan dan CRM
06. Pembelian
07. Gudang dan Persediaan
08. Produksi
09. Quality Control
10. Distribusi dan Pengiriman
11. Keuangan dan Akuntansi
12. Investor dan Bagi Hasil
13. SDM dan Payroll
14. Aset dan Pemeliharaan
15. Workflow dan Persetujuan
16. Laporan dan Analitik
17. Langganan dan Perangkat
18. Master Data
19. Integrasi dan API
20. Administrasi Sistem
21. Bantuan dan Dukungan
```

---

# 4. Struktur Menu Lengkap

## 4.1. Beranda

```text
Beranda
├── Dashboard Saya
├── Dashboard Pemilik
├── Dashboard Investor
├── Dashboard Manajemen
├── Dashboard Operasional
├── Dashboard Penjualan
├── Dashboard Persediaan
├── Dashboard Produksi
├── Dashboard Keuangan
├── Dashboard SDM
├── Kotak Masuk Persetujuan
├── Tugas Saya
├── Notifikasi
├── Aktivitas Terakhir
├── Favorit
└── Pintasan
```

---

## 4.2. Kasir / POS

> Menu ini **langsung di root**.

```text
Kasir / POS
├── Buka Aplikasi Kasir
├── Pilih Outlet
├── Pilih Terminal POS
├── Buka Shift
├── Transaksi Baru
├── Pesanan Ditahan
├── Pesanan Aktif
├── Daftar Pesanan
├── Pembayaran
├── Retur Penjualan
├── Pembatalan Transaksi
├── Cetak Ulang Struk
├── Kirim Struk Digital
├── Kas Masuk
├── Kas Keluar
├── Mutasi Kas Kasir
├── Riwayat Transaksi Hari Ini
├── Ringkasan Shift
├── Tutup Shift
├── Sinkronisasi POS
├── Status Offline
├── Perangkat dan Printer
└── Pengaturan POS Lokal
```

### Struktur tampilan POS

```text
Header POS
├── Nama Outlet
├── Nama Terminal
├── Nama Kasir
├── Nomor Shift
├── Status Koneksi
├── Status Sinkronisasi
└── Tombol Keluar

Area Transaksi
├── Pencarian Produk
├── Pemindai Barcode
├── Kategori Produk
├── Daftar Produk
├── Keranjang
├── Pelanggan
├── Diskon
├── Pajak
└── Total

Area Tindakan
├── Tahan Pesanan
├── Bayar
├── Batalkan
├── Cetak
└── Otorisasi Supervisor
```

---

## 4.3. Penjualan

```text
Penjualan
├── Dashboard Penjualan
├── Transaksi
│   ├── Penawaran Penjualan
│   ├── Pesanan Penjualan
│   ├── Konfirmasi Pesanan
│   ├── Penjualan Langsung
│   ├── Penjualan Kredit
│   ├── Penjualan Konsinyasi
│   ├── Penjualan Grosir
│   ├── Penjualan Antarperusahaan
│   └── Penjualan Marketplace
├── Pemenuhan Pesanan
│   ├── Reservasi Stok
│   ├── Picking List
│   ├── Packing List
│   ├── Delivery Order
│   ├── Barang Siap Diambil
│   └── Bukti Serah Terima
├── Retur dan Pembatalan
│   ├── Permintaan Retur
│   ├── Retur Penjualan
│   ├── Penggantian Barang
│   ├── Pengembalian Dana
│   └── Pembatalan Pesanan
├── Invoice dan Piutang
│   ├── Invoice Penjualan
│   ├── Pembayaran Pelanggan
│   ├── Alokasi Pembayaran
│   ├── Uang Muka Pelanggan
│   ├── Piutang Pelanggan
│   └── Penagihan
├── Komisi Penjualan
│   ├── Pengaturan Komisi
│   ├── Perhitungan Komisi
│   ├── Persetujuan Komisi
│   └── Pembayaran Komisi
└── Laporan Penjualan
    ├── Penjualan Harian
    ├── Penjualan per Outlet
    ├── Penjualan per Produk
    ├── Penjualan per Pelanggan
    ├── Penjualan per Kasir
    ├── Penjualan per Kanal
    ├── Penjualan per Jam
    ├── Margin Penjualan
    ├── Retur Penjualan
    └── Target dan Realisasi
```

---

## 4.4. Produk dan Harga

```text
Produk dan Harga
├── Dashboard Produk
├── Master Produk
│   ├── Produk
│   ├── Produk Jasa
│   ├── Produk Paket
│   ├── Produk Komposit
│   ├── Produk Konsinyasi
│   ├── Bahan Baku
│   ├── Barang Setengah Jadi
│   └── Barang Jadi
├── Klasifikasi Produk
│   ├── Brand
│   ├── Kategori
│   ├── Subkategori
│   ├── Departemen Produk
│   ├── Tag Produk
│   └── Atribut Produk
├── Varian dan Barcode
│   ├── Varian Produk
│   ├── SKU
│   ├── Barcode
│   ├── GTIN
│   ├── Nomor Seri
│   └── Cetak Label
├── Satuan dan Konversi
│   ├── Satuan Dasar
│   ├── Satuan Pembelian
│   ├── Satuan Penjualan
│   ├── Konversi UOM
│   └── Pembulatan Satuan
├── Harga
│   ├── Harga Dasar
│   ├── Harga per Brand
│   ├── Harga per Outlet
│   ├── Harga per Wilayah
│   ├── Harga Grosir
│   ├── Harga Pelanggan
│   ├── Harga Anggota
│   ├── Harga Karyawan
│   ├── Harga Bertingkat
│   └── Riwayat Harga
├── Promosi
│   ├── Program Promosi
│   ├── Diskon Produk
│   ├── Diskon Transaksi
│   ├── Bundling
│   ├── Beli dan Gratis
│   ├── Cashback
│   ├── Voucher
│   ├── Kupon
│   ├── Promo Berdasarkan Waktu
│   └── Persetujuan Promosi
├── Pajak dan Biaya
│   ├── Kelompok Pajak
│   ├── Tarif Pajak
│   ├── Biaya Layanan
│   ├── Harga Termasuk Pajak
│   └── Pembulatan Harga
└── Laporan Produk
    ├── Daftar Produk
    ├── Produk Aktif
    ├── Produk Tidak Aktif
    ├── Produk Terlaris
    ├── Produk Tidak Bergerak
    ├── Analisis Harga
    └── Analisis Margin
```

---

## 4.5. Pelanggan dan CRM

```text
Pelanggan dan CRM
├── Dashboard CRM
├── Master Pelanggan
│   ├── Pelanggan Individu
│   ├── Pelanggan Perusahaan
│   ├── Pelanggan Grosir
│   ├── Anggota
│   ├── Grup Pelanggan
│   └── Segmentasi Pelanggan
├── Loyalitas
│   ├── Program Loyalitas
│   ├── Poin Pelanggan
│   ├── Tingkat Keanggotaan
│   ├── Penukaran Poin
│   ├── Voucher Loyalitas
│   └── Kedaluwarsa Poin
├── Prospek dan Penjualan
│   ├── Prospek
│   ├── Peluang Penjualan
│   ├── Aktivitas Tindak Lanjut
│   ├── Penawaran
│   └── Pipeline Penjualan
├── Kampanye
│   ├── Kampanye Pemasaran
│   ├── Daftar Penerima
│   ├── WhatsApp
│   ├── Surat Elektronik
│   ├── SMS
│   └── Hasil Kampanye
├── Layanan Pelanggan
│   ├── Keluhan Pelanggan
│   ├── Tiket Layanan
│   ├── Permintaan Pengembalian
│   ├── SLA Pelayanan
│   └── Survei Kepuasan
└── Analitik Pelanggan
    ├── Riwayat Pembelian
    ├── Pelanggan Aktif
    ├── Pelanggan Tidak Aktif
    ├── Retensi Pelanggan
    ├── Frekuensi Pembelian
    ├── Nilai Pelanggan
    └── Analisis RFM
```

---

## 4.6. Pembelian

```text
Pembelian
├── Dashboard Pembelian
│   ├── Ringkasan Permintaan Pembelian
│   ├── PO Aktif
│   ├── PO Terlambat
│   ├── Penerimaan Hari Ini
│   ├── Backorder Aktif
│   ├── Nilai Pembelian
│   └── Kinerja Pemasok
├── Perencanaan Pembelian
│   ├── Rekomendasi Pembelian
│   ├── Kebutuhan Berdasarkan Minimum Stok
│   ├── Kebutuhan Berdasarkan Reorder Point
│   ├── Kebutuhan Berdasarkan Pesanan Toko
│   ├── Kebutuhan Berdasarkan Produksi
│   ├── Konsolidasi Kebutuhan
│   └── Rencana Pembelian
├── Request Order
│   ├── Request Order dari Toko
│   ├── Request Order dari Gudang
│   ├── Request Order dari Lokasi
│   ├── Request Order Otomatis
│   ├── Request Order karena Stok Minimum
│   ├── Request Order karena Kekurangan Bahan Produksi
│   ├── Konsolidasi Request Order
│   ├── Persetujuan Request Order
│   └── Monitoring Pemenuhan Request Order
├── Permintaan Pembelian
│   ├── Pengajuan Permintaan
│   ├── Konversi dari Request Order
│   ├── Pemeriksaan Anggaran
│   ├── Persetujuan Permintaan
│   └── Daftar Permintaan
├── Penawaran Pemasok
│   ├── Request for Quotation
│   ├── Penawaran Pemasok
│   ├── Perbandingan Penawaran
│   ├── Negosiasi
│   ├── Penetapan Pemasok
│   └── Persetujuan Pemilihan Pemasok
├── Pesanan Pembelian
│   ├── Purchase Order
│   ├── PO dari Request Order
│   ├── PO dari Rekomendasi Minimum Stok
│   ├── PO dari Kekurangan Bahan Produksi
│   ├── Kontrak Pembelian
│   ├── Perubahan PO
│   ├── Persetujuan PO
│   ├── Pengiriman PO ke Pemasok
│   ├── Konfirmasi Pemasok
│   └── Pemantauan PO
├── Backorder
│   ├── Dashboard Backorder
│   ├── Daftar Backorder
│   ├── Buat Backorder dari Penerimaan Parsial
│   ├── Backorder ke Pemasok Awal
│   ├── Pengalihan Backorder ke Pemasok Lain
│   ├── Permintaan Penawaran untuk Kekurangan
│   ├── Pemilihan Pemasok Pengganti
│   ├── Persetujuan Pengalihan Pemasok
│   ├── PO Lanjutan Backorder
│   ├── Konfirmasi Jadwal Pemenuhan
│   ├── Penerimaan Backorder
│   ├── Pembatalan Sisa Backorder
│   ├── Penutupan Backorder
│   ├── Riwayat Perubahan Backorder
│   └── Monitoring Umur Backorder
├── Penerimaan
│   ├── Jadwal Kedatangan
│   ├── Registrasi Kedatangan Barang
│   ├── Penerimaan Barang
│   │   ├── Penerimaan Pembelian
│   │   ├── Penerimaan Backorder
│   │   ├── Penerimaan Transfer Masuk
│   │   ├── Penerimaan Hasil Produksi
│   │   ├── Penerimaan Retur Penjualan
│   │   ├── Penerimaan Barang Konsinyasi
│   │   └── Penerimaan Barang Bonus / Free Goods
│   ├── Pemeriksaan Fisik
│   │   ├── Pemeriksaan Jumlah
│   │   ├── Pemeriksaan Kondisi
│   │   ├── Pemeriksaan Kualitas
│   │   ├── Pemeriksaan Batch / Lot
│   │   ├── Pemeriksaan Tanggal Kedaluwarsa
│   │   ├── Pemeriksaan Nomor Seri
│   │   └── Pemeriksaan Dokumen
│   ├── Pencatatan Hasil Penerimaan
│   │   ├── Diterima Penuh
│   │   ├── Diterima Sebagian
│   │   ├── Ditolak Sebagian
│   │   ├── Ditolak Seluruhnya
│   │   ├── Ditempatkan di Karantina
│   │   └── Kekurangan untuk Backorder
│   ├── Validasi Penerimaan
│   │   ├── Menunggu Validasi
│   │   ├── Validasi Staf Gudang
│   │   ├── Persetujuan Supervisor
│   │   ├── Posting Stok Gudang Utama
│   │   └── Pembatalan Validasi
│   ├── Alokasi Pesanan Internal
│   │   ├── Alokasi ke Request Order Toko
│   │   ├── Alokasi ke Request Order Gudang
│   │   ├── Alokasi ke Request Order Lokasi
│   │   ├── Alokasi Berdasarkan Prioritas
│   │   └── Sisa Stok Bebas
│   ├── Put-away
│   │   ├── Penempatan ke Gudang
│   │   ├── Penempatan ke Area
│   │   ├── Penempatan ke Rak / Bin
│   │   ├── Penempatan ke Karantina
│   │   └── Penempatan ke Area Transit
│   ├── Selisih Penerimaan
│   │   ├── Kurang Kirim
│   │   ├── Lebih Kirim
│   │   ├── Barang Rusak
│   │   ├── Barang Salah
│   │   ├── Batch / Kedaluwarsa Tidak Sesuai
│   │   └── Backorder
│   └── Dokumen Penerimaan
│       ├── Goods Receipt Note
│       ├── Berita Acara Penerimaan
│       ├── Berita Acara Selisih
│       ├── Berita Acara Penolakan
│       └── Lampiran Foto / Dokumen
├── Retur Pembelian
│   ├── Permintaan Retur
│   ├── Retur ke Pemasok
│   ├── Penggantian Barang
│   ├── Nota Kredit Pemasok
│   └── Penyesuaian Utang
├── Invoice Pemasok
│   ├── Invoice Pembelian
│   ├── Pencocokan PO-GR-Invoice
│   ├── Uang Muka Pemasok
│   ├── Utang Pemasok
│   └── Jadwal Pembayaran
├── Pemasok
│   ├── Master Pemasok
│   ├── Produk Pemasok
│   ├── Harga Pemasok
│   ├── Kontrak Pemasok
│   ├── SLA Pemenuhan
│   ├── Evaluasi Pemasok
│   ├── Riwayat Backorder
│   └── Blacklist Pemasok
└── Laporan Pembelian
    ├── Pembelian per Pemasok
    ├── Pembelian per Produk
    ├── Pembelian per Outlet
    ├── PO Belum Selesai
    ├── PO Diterima Parsial
    ├── Keterlambatan Pemasok
    ├── Backorder Aktif
    ├── Umur Backorder
    ├── Pemenuhan Request Order
    ├── Selisih Penerimaan
    └── Analisis Harga Beli
```

### Aturan proses Backorder

1. Backorder hanya dibuat apabila kuantitas yang diterima lebih kecil daripada kuantitas PO.
2. Sistem harus menampilkan:
   - kuantitas PO;
   - kuantitas yang diterima;
   - kuantitas ditolak;
   - kuantitas kekurangan;
   - kuantitas yang akan dibuat sebagai backorder.
3. Kekurangan dapat:
   - tetap dipenuhi oleh pemasok awal;
   - dialihkan sebagian kepada pemasok lain;
   - dialihkan seluruhnya kepada pemasok lain;
   - dibatalkan dengan alasan dan persetujuan.
4. Pengalihan ke pemasok lain harus menghasilkan hubungan dokumen yang dapat ditelusuri dari PO awal.
5. Backorder tidak boleh menambah stok.
6. Stok hanya bertambah setelah penerimaan backorder divalidasi.
7. Backorder ditutup otomatis apabila seluruh kekurangan telah dipenuhi atau sisa kebutuhan dibatalkan secara resmi.

### Status Backorder

```text
DRAFT
WAITING_APPROVAL
APPROVED
WAITING_SUPPLIER_CONFIRMATION
CONFIRMED
PARTIALLY_FULFILLED
FULFILLED
REDIRECTED_TO_OTHER_SUPPLIER
CANCELLED
CLOSED
```

---
## 4.7. Gudang dan Persediaan

```text
Gudang dan Persediaan
├── Dashboard Persediaan
│   ├── Stok Gudang Utama
│   ├── Stok Toko / Outlet
│   ├── Stok dalam Perjalanan
│   ├── Penerimaan Belum Divalidasi
│   ├── Transfer Belum Diterima
│   ├── Stok di Bawah Minimum
│   ├── Backorder Aktif
│   └── Selisih Persediaan
├── Struktur Gudang
│   ├── Gudang
│   ├── Area
│   ├── Zona
│   ├── Lorong
│   ├── Rak
│   ├── Bin
│   └── Lokasi Penyimpanan
├── Penerimaan Barang
│   ├── Dashboard Penerimaan
│   ├── Daftar Kedatangan
│   ├── Penerimaan Pembelian
│   ├── Penerimaan Backorder
│   ├── Penerimaan Transfer Masuk
│   ├── Penerimaan Hasil Produksi
│   ├── Penerimaan Retur Penjualan
│   ├── Pemeriksaan Fisik
│   ├── Pemeriksaan Kualitas
│   ├── Pemeriksaan Batch / Kedaluwarsa
│   ├── Menunggu Validasi
│   ├── Validasi Penerimaan
│   ├── Posting Stok Gudang
│   ├── Put-away
│   ├── Barang Karantina
│   ├── Selisih Penerimaan
│   └── Berita Acara Penerimaan
├── Alokasi dan Distribusi Kebutuhan
│   ├── Daftar Pesanan Toko
│   ├── Daftar Pesanan Gudang
│   ├── Daftar Pesanan Lokasi
│   ├── Alokasi Barang Diterima
│   ├── Prioritas Alokasi
│   ├── Alokasi Parsial
│   ├── Sisa Kebutuhan
│   └── Konversi ke Internal Transfer
├── Pengeluaran Barang
│   ├── Pengeluaran Penjualan
│   ├── Pengeluaran Produksi
│   ├── Pengeluaran Operasional
│   ├── Picking
│   ├── Packing
│   ├── Delivery Staging
│   └── Pengeluaran Khusus
├── Internal Transfer
│   ├── Dashboard Internal Transfer
│   ├── Request Transfer dari Toko
│   ├── Request Transfer dari Gudang
│   ├── Request Transfer dari Lokasi
│   ├── Rekomendasi Transfer Otomatis
│   ├── Persetujuan Transfer
│   ├── Alokasi Stok Sumber
│   ├── Picking Transfer
│   ├── Packing Transfer
│   ├── Pengiriman Transfer
│   ├── Barang dalam Perjalanan
│   ├── Monitoring Status Pengiriman
│   ├── Penerimaan di Toko / Lokasi
│   ├── Validasi Penerimaan Tujuan
│   ├── Selisih Transfer
│   │   ├── Kurang Terima
│   │   ├── Lebih Terima
│   │   ├── Rusak di Perjalanan
│   │   ├── Salah Barang
│   │   └── Ditolak Tujuan
│   ├── Transfer Balik
│   ├── Pembatalan Transfer
│   ├── Penutupan Transfer
│   └── Riwayat Transfer
├── Monitoring Internal Transfer
│   ├── Menunggu Persetujuan
│   ├── Menunggu Picking
│   ├── Menunggu Pengiriman
│   ├── Dalam Perjalanan
│   ├── Tiba Belum Divalidasi
│   ├── Diterima Sebagian
│   ├── Diterima Penuh
│   ├── Bermasalah
│   ├── Terlambat
│   └── Selesai
├── Kontrol Persediaan
│   ├── Saldo Stok
│   ├── Kartu Stok
│   ├── Stok Tersedia
│   ├── Stok Dicadangkan
│   ├── Stok dalam Perjalanan
│   ├── Stok Karantina
│   ├── Stok Rusak
│   ├── Stok Kedaluwarsa
│   ├── Stok Konsinyasi
│   └── Stok Negatif
├── Minimum Stok dan Replenishment
│   ├── Pengaturan Minimum Stok
│   ├── Pengaturan Maximum Stok
│   ├── Reorder Point
│   ├── Safety Stock
│   ├── Lead Time Pemenuhan
│   ├── Monitoring Stok Minimum
│   ├── Notifikasi Stok Minimum
│   ├── Draft Request Order Otomatis
│   ├── Persetujuan Request Order
│   ├── Rekomendasi Internal Transfer
│   ├── Rekomendasi Pembelian
│   └── Eskalasi Kekurangan Stok
├── Stock Opname
│   ├── Jadwal Stock Opname
│   ├── Stock Opname Penuh
│   ├── Cycle Count
│   ├── Input Hasil Hitung
│   ├── Selisih Persediaan
│   └── Persetujuan Penyesuaian
├── Batch dan Kedaluwarsa
│   ├── Batch
│   ├── Lot
│   ├── Tanggal Produksi
│   ├── Tanggal Kedaluwarsa
│   ├── FIFO
│   └── FEFO
└── Laporan Persediaan
    ├── Posisi Stok
    ├── Mutasi Stok
    ├── Kartu Stok
    ├── Stok dalam Perjalanan
    ├── Transfer Belum Diterima
    ├── Umur Persediaan
    ├── Stok Mati
    ├── Fast Moving
    ├── Slow Moving
    ├── Stok di Bawah Minimum
    ├── Selisih Stock Opname
    ├── Nilai Persediaan
    ├── Backorder Persediaan
    └── Perputaran Persediaan
```

### Aturan validasi penerimaan stok

1. Registrasi kedatangan dan pemeriksaan fisik **belum menambah stok**.
2. Sebelum validasi, penerimaan berstatus `WAITING_VALIDATION`.
3. Stok gudang utama hanya bertambah setelah pengguna berwenang melakukan `VALIDATE`.
4. Validasi harus menyimpan:
   - pengguna;
   - waktu;
   - gudang;
   - lokasi penyimpanan;
   - jumlah diterima;
   - batch/lot;
   - tanggal kedaluwarsa;
   - hasil pemeriksaan;
   - dokumen pendukung.
5. Pembatalan validasi harus menggunakan reversal, bukan menghapus transaksi.
6. Barang yang gagal pemeriksaan tidak masuk stok tersedia; barang diarahkan ke karantina atau ditolak.

### Aturan perpindahan stok Internal Transfer

Model pencatatan yang direkomendasikan:

```text
Saat transfer dikirim:
Stok Tersedia Gudang Sumber berkurang
Stok Dalam Perjalanan bertambah

Saat tujuan memvalidasi penerimaan:
Stok Dalam Perjalanan berkurang
Stok Tersedia Gudang Tujuan bertambah
```

Model ini memastikan barang tidak tercatat tersedia secara bersamaan di gudang sumber dan gudang tujuan.

### Status Internal Transfer

```text
DRAFT
WAITING_APPROVAL
APPROVED
ALLOCATED
PICKING
PACKED
DISPATCHED
IN_TRANSIT
ARRIVED_WAITING_VALIDATION
PARTIALLY_RECEIVED
RECEIVED
DISCREPANCY
REJECTED
CANCELLED
CLOSED
```

### Aturan notifikasi minimum stok

1. Minimum stok ditentukan per:
   - produk;
   - outlet;
   - gudang;
   - lokasi;
   - satuan;
   - periode atau musim.
2. Ketika stok proyeksi mencapai atau di bawah minimum, sistem:
   - membuat notifikasi;
   - menghitung jumlah rekomendasi;
   - memeriksa stok di gudang lain;
   - merekomendasikan internal transfer jika tersedia;
   - membuat draft Request Order jika tidak tersedia.
3. Notifikasi tidak boleh dibuat berulang tanpa kontrol; sistem harus menggabungkan notifikasi yang masih aktif.
4. Notifikasi ditutup ketika kebutuhan telah dipenuhi atau dibatalkan dengan alasan.

---
## 4.8. Produksi

```text
Produksi
├── Dashboard Produksi
│   ├── Rencana Produksi
│   ├── Produksi Berjalan
│   ├── Produksi Tertunda
│   ├── Kekurangan Bahan
│   ├── Hasil Produksi Hari Ini
│   ├── Waste
│   └── Utilisasi Kapasitas
├── Master Produksi
│   ├── Produk Manufaktur
│   ├── Bill of Materials
│   ├── Resep
│   ├── Versi BOM / Resep
│   ├── Bahan Baku
│   ├── Bahan Penolong
│   ├── Bahan Kemasan
│   ├── Produk Sampingan
│   ├── Routing
│   ├── Work Center
│   ├── Mesin
│   ├── Kapasitas Produksi
│   └── Kalender Produksi
├── Perencanaan
│   ├── Forecast Produksi
│   ├── Master Production Schedule
│   ├── Material Requirement Planning
│   ├── Rencana Produksi
│   ├── Rencana Kapasitas
│   ├── Perhitungan Kebutuhan Bahan
│   └── Proyeksi Kekurangan Bahan
├── Ketersediaan Bahan
│   ├── Cek Ketersediaan Bahan
│   ├── Stok Bahan per Gudang
│   ├── Kebutuhan Berdasarkan BOM
│   ├── Kekurangan Bahan
│   ├── Reservasi Bahan
│   ├── Rekomendasi Internal Transfer
│   ├── Draft Request Order Otomatis
│   ├── Draft Permintaan Pembelian
│   └── Notifikasi Kekurangan Bahan
├── Perintah Produksi
│   ├── Work Order
│   ├── Batch Produksi
│   ├── Penjadwalan
│   ├── Penugasan Operator
│   ├── Pemilihan BOM / Resep
│   ├── Pemeriksaan Ketersediaan Bahan
│   ├── Persetujuan Work Order
│   └── Dokumen Produksi
├── Pelaksanaan Produksi
│   ├── Persiapan Produksi
│   ├── Permintaan Bahan
│   ├── Pengeluaran Bahan
│   ├── Penimbangan / Takar Bahan
│   ├── Mulai Produksi
│   ├── Work in Process
│   ├── Pencatatan Pemakaian Aktual
│   ├── Pengembalian Bahan
│   ├── Input Hasil Produksi
│   ├── Produk Sampingan
│   ├── Sisa Bahan
│   ├── Waste
│   ├── Rework
│   └── Penyelesaian Produksi
├── Penerimaan Hasil Produksi
│   ├── Hasil Menunggu Pemeriksaan
│   ├── Pemeriksaan Hasil
│   ├── Validasi Hasil Produksi
│   ├── Posting Stok Barang Jadi
│   ├── Put-away Barang Jadi
│   └── Penolakan / Karantina Hasil
├── Biaya Produksi
│   ├── Standard Cost
│   ├── Actual Cost
│   ├── Biaya Bahan
│   ├── Biaya Tenaga Kerja
│   ├── Overhead
│   └── Varians Produksi
├── Ketertelusuran
│   ├── Asal Bahan Baku
│   ├── Batch Bahan
│   ├── Batch Produksi
│   ├── Operator
│   ├── Mesin
│   ├── Hasil Produksi
│   └── Distribusi Batch
└── Laporan Produksi
    ├── Rencana dan Realisasi
    ├── Hasil Produksi
    ├── Pemakaian Bahan
    ├── Kekurangan Bahan
    ├── Request Order Produksi
    ├── Yield
    ├── Waste
    ├── WIP
    ├── Produktivitas Mesin
    └── Biaya Produksi
```

### Aturan BOM / Resep

1. Setiap produk manufaktur wajib memiliki satu atau lebih versi BOM/resep.
2. Setiap versi memuat:
   - produk hasil;
   - kuantitas hasil standar;
   - bahan baku;
   - jumlah kebutuhan;
   - satuan;
   - toleransi;
   - bahan substitusi;
   - tanggal mulai berlaku;
   - tanggal akhir berlaku.
3. Sistem harus menghitung kebutuhan bahan sesuai jumlah produksi.
4. Konversi satuan wajib dilakukan sebelum pemeriksaan ketersediaan.
5. BOM/resep yang sudah digunakan pada transaksi produksi tidak boleh diubah secara langsung; perubahan dilakukan melalui versi baru.

### Aturan pemeriksaan bahan sebelum produksi

```text
Kebutuhan Bahan = Jumlah Rencana Produksi × Kebutuhan Bahan per Unit
```

Sebelum Work Order dapat dimulai, sistem harus:

1. menampilkan seluruh bahan dan stoknya;
2. memeriksa stok tersedia setelah reservasi;
3. memperhitungkan batch, kedaluwarsa, dan lokasi;
4. menandai bahan yang mencukupi dan tidak mencukupi;
5. memblokir proses produksi apabila bahan wajib tidak mencukupi;
6. memberikan pilihan:
   - buat Request Order;
   - buat internal transfer;
   - buat permintaan pembelian;
   - gunakan bahan substitusi yang disetujui;
   - kurangi jumlah produksi.

### Status Work Order

```text
DRAFT
MATERIAL_CHECK
MATERIAL_SHORTAGE
WAITING_MATERIAL
READY
WAITING_APPROVAL
APPROVED
IN_PROGRESS
PAUSED
COMPLETED_WAITING_VALIDATION
COMPLETED
CANCELLED
CLOSED
```

---
## 4.9. Quality Control

```text
Quality Control
├── Dashboard Mutu
├── Master Parameter Mutu
├── Standar Mutu Produk
├── Pemeriksaan Bahan Masuk
├── Pemeriksaan Proses
├── Pemeriksaan Barang Jadi
├── Sampling
├── Hasil Pengujian
├── Karantina
├── Produk Tidak Sesuai
├── Tindakan Koreksi
├── Tindakan Pencegahan
├── Retur karena Mutu
├── Penarikan Produk
├── Sertifikat Analisis
└── Laporan Quality Control
```

---

## 4.10. Distribusi dan Pengiriman

```text
Distribusi dan Pengiriman
├── Dashboard Distribusi
├── Perencanaan Pengiriman
│   ├── Jadwal Pengiriman
│   ├── Rute Pengiriman
│   ├── Muatan Kendaraan
│   └── Penugasan Pengemudi
├── Dokumen Pengiriman
│   ├── Delivery Order
│   ├── Surat Jalan
│   ├── Packing List
│   ├── Manifest
│   └── Label Pengiriman
├── Ekspedisi
│   ├── Master Ekspedisi
│   ├── Tarif Ekspedisi
│   ├── Pemesanan Ekspedisi
│   ├── Nomor Resi
│   └── Pelacakan Pengiriman
├── Armada
│   ├── Kendaraan
│   ├── Pengemudi
│   ├── Jadwal Armada
│   ├── Biaya Perjalanan
│   └── Pemeliharaan Armada
├── Serah Terima
│   ├── Bukti Pengiriman
│   ├── Foto Penerimaan
│   ├── Tanda Tangan Digital
│   ├── Selisih Pengiriman
│   └── Pengiriman Gagal
├── Retur Distribusi
└── Laporan Pengiriman
```

---

## 4.11. Keuangan dan Akuntansi

```text
Keuangan dan Akuntansi
├── Dashboard Keuangan
├── Kas dan Bank
│   ├── Master Kas
│   ├── Master Rekening Bank
│   ├── Penerimaan Kas
│   ├── Pengeluaran Kas
│   ├── Transfer Antarbank
│   ├── Rekonsiliasi Bank
│   └── Proyeksi Kas
├── Piutang
│   ├── Daftar Piutang
│   ├── Umur Piutang
│   ├── Penerimaan Pelanggan
│   ├── Penagihan
│   ├── Penghapusan Piutang
│   └── Limit Kredit
├── Utang
│   ├── Daftar Utang
│   ├── Umur Utang
│   ├── Jadwal Pembayaran
│   ├── Pembayaran Pemasok
│   └── Potongan Pembayaran
├── Akuntansi
│   ├── Chart of Accounts
│   ├── Jurnal Umum
│   ├── Jurnal Otomatis
│   ├── Buku Besar
│   ├── Neraca Saldo
│   ├── Penyesuaian
│   ├── Jurnal Penutup
│   └── Tutup Periode
├── Anggaran
│   ├── Penyusunan Anggaran
│   ├── Persetujuan Anggaran
│   ├── Perubahan Anggaran
│   ├── Realisasi Anggaran
│   └── Kontrol Anggaran
├── Aset Tetap
│   ├── Perolehan Aset
│   ├── Kapitalisasi
│   ├── Penyusutan
│   ├── Revaluasi
│   ├── Pemindahan
│   └── Penghapusan
├── Pajak
│   ├── Konfigurasi Pajak
│   ├── Pajak Penjualan
│   ├── Pajak Pembelian
│   ├── Pajak Penghasilan
│   └── Rekonsiliasi Pajak
└── Laporan Keuangan
    ├── Laba Rugi
    ├── Neraca
    ├── Arus Kas
    ├── Perubahan Modal
    ├── Buku Besar
    ├── Laporan per Outlet
    ├── Laporan per Brand
    ├── Laporan per Perusahaan
    └── Konsolidasi
```

---

## 4.12. Investor dan Bagi Hasil

```text
Investor dan Bagi Hasil
├── Dashboard Investor
├── Master Investor
├── Kelompok Investor
├── Kepemilikan Usaha
├── Kontrak Kerja Sama
├── Penyertaan Modal
├── Penggunaan Modal
├── Skema Bagi Hasil
│   ├── Persentase Tetap
│   ├── Persentase Bertingkat
│   ├── Pembagian per Investor
│   ├── Prioritas Distribusi
│   └── Ketentuan Setelah BEP
├── Perhitungan Bagi Hasil
├── Simulasi Bagi Hasil
├── Persetujuan Bagi Hasil
├── Pembayaran Bagi Hasil
├── Pengembalian Modal
├── Riwayat Perubahan Kontrak
├── Portal Investor
└── Laporan Investor
```

---

## 4.13. SDM dan Payroll

```text
SDM dan Payroll
├── Dashboard SDM
├── Organisasi
│   ├── Struktur Organisasi
│   ├── Departemen
│   ├── Unit Kerja
│   ├── Jabatan
│   └── Posisi
├── Pegawai
│   ├── Data Pegawai
│   ├── Kontrak Kerja
│   ├── Penempatan
│   ├── Riwayat Jabatan
│   ├── Dokumen Pegawai
│   └── Status Kepegawaian
├── Rekrutmen
│   ├── Kebutuhan Pegawai
│   ├── Lowongan
│   ├── Pelamar
│   ├── Seleksi
│   ├── Wawancara
│   └── Onboarding
├── Kehadiran
│   ├── Jadwal Kerja
│   ├── Shift
│   ├── Presensi
│   ├── Keterlambatan
│   ├── Izin
│   ├── Cuti
│   └── Lembur
├── Kinerja
│   ├── Sasaran Kinerja
│   ├── Penilaian Kinerja
│   ├── KPI
│   ├── Kompetensi
│   └── Tindakan Disiplin
├── Pelatihan
│   ├── Program Pelatihan
│   ├── Peserta
│   ├── Sertifikasi
│   └── Riwayat Pelatihan
├── Payroll
│   ├── Periode Payroll
│   ├── Komponen Gaji
│   ├── Gaji Pokok
│   ├── Tunjangan
│   ├── Insentif
│   ├── Komisi
│   ├── Lembur
│   ├── Potongan
│   ├── BPJS
│   ├── Pajak
│   ├── Proses Payroll
│   ├── Persetujuan Payroll
│   ├── Slip Gaji
│   └── Transfer Bank
└── Laporan SDM dan Payroll
```

---

## 4.14. Aset dan Pemeliharaan

```text
Aset dan Pemeliharaan
├── Dashboard Aset
├── Master Aset
├── Kategori Aset
├── Lokasi Aset
├── Registrasi dan QR Aset
├── Penempatan Aset
├── Pemindahan Aset
├── Peminjaman Aset
├── Pengembalian Aset
├── Stock Opname Aset
├── Pemeliharaan
│   ├── Preventive Maintenance
│   ├── Corrective Maintenance
│   ├── Jadwal Pemeliharaan
│   ├── Work Order
│   ├── Teknisi
│   ├── Suku Cadang
│   └── Riwayat Perbaikan
├── Kerusakan Aset
├── Penghapusan Aset
└── Laporan Aset
```

---

## 4.15. Workflow dan Persetujuan

```text
Workflow dan Persetujuan
├── Kotak Masuk Persetujuan
├── Menunggu Persetujuan Saya
├── Pengajuan Saya
├── Sudah Disetujui
├── Ditolak
├── Dikembalikan untuk Revisi
├── Didelegasikan
├── Persetujuan Kedaluwarsa
├── Pengaturan Workflow
│   ├── Jenis Dokumen
│   ├── Tingkat Persetujuan
│   ├── Batas Nominal
│   ├── Persetujuan Paralel
│   ├── Persetujuan Berurutan
│   ├── Pengganti Pejabat
│   └── Eskalasi
└── Riwayat dan Audit Persetujuan
```

---

## 4.16. Laporan dan Analitik

```text
Laporan dan Analitik
├── Dashboard Eksekutif
├── Dashboard Operasional
├── Dashboard Keuangan
├── Dashboard Investor
├── Laporan Favorit
├── Laporan Terjadwal
├── Report Builder
├── Pivot dan Analitik
├── KPI
├── Target dan Realisasi
├── Perbandingan Outlet
├── Perbandingan Brand
├── Analisis Tren
├── Prediksi Penjualan
├── Prediksi Persediaan
├── Deteksi Anomali
├── Ekspor Data
└── Riwayat Ekspor
```

---

## 4.17. Langganan dan Perangkat

```text
Langganan dan Perangkat
├── Ringkasan Langganan
├── Paket Langganan
├── Perangkat POS
│   ├── Daftar Perangkat
│   ├── Aktivasi Perangkat
│   ├── QR Code Instalasi
│   ├── Kode Instalasi
│   ├── Pemindahan Perangkat
│   ├── Penggantian Perangkat
│   ├── Pencabutan Perangkat
│   └── Riwayat Perangkat
├── Masa Uji Coba
├── Perpanjangan
├── Tambah Perangkat
├── Invoice Langganan
├── Pembayaran Smartlink
├── Riwayat Pembayaran
├── Masa Tenggang
├── Promo dan Voucher
├── Penggunaan Penyimpanan
└── Log Aktivasi
```

---

## 4.18. Master Data

```text
Master Data
├── Organisasi
│   ├── Grup Usaha
│   ├── Perusahaan
│   ├── Brand
│   ├── Cabang
│   ├── Outlet
│   ├── Gudang
│   └── Departemen
├── Wilayah
│   ├── Negara
│   ├── Provinsi
│   ├── Kota / Kabupaten
│   ├── Kecamatan
│   ├── Kelurahan / Desa
│   └── Kode Pos
├── Kalender
│   ├── Kalender Kerja
│   ├── Hari Libur
│   ├── Periode Akuntansi
│   └── Zona Waktu
├── Keuangan
│   ├── Mata Uang
│   ├── Kurs
│   ├── Pajak
│   ├── Bank
│   └── Metode Pembayaran
├── Dokumen
│   ├── Jenis Dokumen
│   ├── Penomoran Dokumen
│   ├── Template Dokumen
│   └── Tanda Tangan
└── Referensi Umum
```

---

## 4.19. Integrasi dan API

```text
Integrasi dan API
├── Dashboard Integrasi
├── API Client
├── API Key
├── OAuth Client
├── Token Perangkat
├── Webhook
├── Log API
├── Log Webhook
├── Pembatasan API
├── Dokumentasi API
├── Sandbox API
├── Smartlink
├── Marketplace
├── Ekspedisi
├── Bank
├── Mesin Produksi
├── Timbangan
├── Printer
├── Barcode Scanner
├── Sistem Akuntansi Eksternal
├── Impor Data
├── Ekspor Data
└── Pemantauan Integrasi
```

---

## 4.20. Administrasi Sistem

```text
Administrasi Sistem
├── Pengguna
│   ├── Daftar Pengguna
│   ├── Undangan Pengguna
│   ├── Pengguna Aktif
│   ├── Pengguna Diblokir
│   ├── Perangkat Pengguna
│   └── Sesi Login
├── Peran dan Hak Akses
│   ├── Role
│   ├── Hak Akses Menu
│   ├── Hak Akses Data
│   ├── Batas Nilai Transaksi
│   ├── Delegasi
│   └── Simulasi Hak Akses
├── Keamanan
│   ├── Kebijakan Login
│   ├── OTP
│   ├── PIN
│   ├── Biometrik
│   ├── Autentikasi Dua Faktor
│   ├── Perangkat Terpercaya
│   ├── Daftar IP
│   └── Pencabutan Sesi
├── Audit
│   ├── Audit Login
│   ├── Audit Perubahan Data
│   ├── Audit Transaksi
│   ├── Audit Persetujuan
│   ├── Audit Ekspor
│   └── Audit API
├── Konfigurasi
│   ├── Identitas Perusahaan
│   ├── Bahasa
│   ├── Zona Waktu
│   ├── Mata Uang
│   ├── Format Tanggal
│   ├── Format Angka
│   ├── Logo
│   ├── Tema
│   └── Notifikasi
├── Data dan Penyimpanan
│   ├── Backup
│   ├── Restore
│   ├── Retensi Data
│   ├── Arsip
│   └── Penghapusan Data
└── Status Sistem
    ├── Versi Aplikasi
    ├── Status Layanan
    ├── Status Sinkronisasi
    ├── Penggunaan Sistem
    └── Informasi Lisensi
```

---

## 4.21. Bantuan dan Dukungan

```text
Bantuan dan Dukungan
├── Pusat Bantuan
├── Panduan Pengguna
├── Video Tutorial
├── Basis Pengetahuan
├── Tiket Dukungan
├── Riwayat Tiket
├── Status Layanan
├── Permintaan Fitur
├── Laporkan Gangguan
├── Hubungi Dukungan
└── Tentang eBisnis.id
```

---


# 5. Diagram Proses Bisnis Utama

## 5.1. Penerimaan Barang dan Backorder

```mermaid
flowchart TD
    A[Purchase Order aktif] --> B[Barang tiba di gudang]
    B --> C[Registrasi kedatangan]
    C --> D[Pemeriksaan fisik dan dokumen]
    D --> E{Jumlah dan kondisi sesuai?}
    E -->|Sesuai penuh| F[Catat diterima penuh]
    E -->|Diterima sebagian| G[Catat kuantitas diterima]
    E -->|Rusak/tidak sesuai| H[Karantina atau tolak]
    G --> I[Hitung kekurangan]
    I --> J{Buat backorder?}
    J -->|Pemasok awal| K[Backorder ke pemasok awal]
    J -->|Pemasok lain| L[Persetujuan pengalihan pemasok]
    J -->|Tidak| M[Batalkan sisa dengan alasan]
    F --> N[Menunggu validasi]
    G --> N
    H --> N
    N --> O{Validasi disetujui?}
    O -->|Ya| P[Posting stok gudang utama]
    O -->|Tidak| Q[Koreksi data penerimaan]
    P --> R[Alokasi kebutuhan toko/gudang/lokasi]
    R --> S[Buat internal transfer]
```

## 5.2. Status Stok pada Penerimaan

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Arrived: Barang tiba
    Arrived --> Inspected: Pemeriksaan selesai
    Inspected --> WaitingValidation: Data disimpan
    WaitingValidation --> Validated: Validasi pengguna berwenang
    WaitingValidation --> CorrectionRequired: Ditolak validator
    CorrectionRequired --> WaitingValidation: Dikoreksi
    Validated --> StockPosted: Posting stok
    StockPosted --> PutAway: Penempatan lokasi
    PutAway --> Closed
    Inspected --> Quarantine: Barang bermasalah
    Quarantine --> Rejected
    Quarantine --> WaitingValidation: Dinyatakan layak
```

## 5.3. Internal Transfer Gudang Utama ke Toko

```mermaid
sequenceDiagram
    participant T as Toko/Lokasi
    participant S as Sistem
    participant G as Gudang Utama
    T->>S: Membuat Request Order / Request Transfer
    S->>G: Menampilkan kebutuhan toko
    G->>S: Alokasi stok
    G->>S: Validasi picking dan packing
    S->>S: Kurangi stok tersedia sumber
    S->>S: Tambah stok dalam perjalanan
    G->>T: Kirim barang
    T->>S: Catat barang tiba
    T->>S: Pemeriksaan dan validasi penerimaan
    S->>S: Kurangi stok dalam perjalanan
    S->>S: Tambah stok tersedia tujuan
    S-->>G: Status transfer diterima
```

## 5.4. Notifikasi Minimum Stok

```mermaid
flowchart TD
    A[Perubahan stok atau proses terjadwal] --> B[Hitung stok proyeksi]
    B --> C{Stok <= minimum?}
    C -->|Tidak| D[Selesai]
    C -->|Ya| E[Cek stok gudang lain]
    E --> F{Stok tersedia di lokasi lain?}
    F -->|Ya| G[Rekomendasi internal transfer]
    F -->|Tidak| H[Buat draft Request Order]
    G --> I[Notifikasi staf toko dan gudang]
    H --> I
    I --> J[Persetujuan]
    J --> K[Pemenuhan kebutuhan]
    K --> L[Tutup notifikasi]
```

## 5.5. Produksi Berbasis BOM / Resep

```mermaid
flowchart TD
    A[Pilih produk manufaktur] --> B[Masukkan jumlah produksi]
    B --> C[Sistem membaca BOM/resep aktif]
    C --> D[Hitung kebutuhan setiap bahan]
    D --> E[Cek stok tersedia dan batch]
    E --> F{Semua bahan mencukupi?}
    F -->|Ya| G[Reservasi bahan]
    G --> H[Persetujuan work order]
    H --> I[Mulai produksi]
    I --> J[Catat pemakaian aktual]
    J --> K[Catat hasil, waste, dan sisa]
    K --> L[Validasi hasil produksi]
    L --> M[Posting stok barang jadi]
    F -->|Tidak| N[Tampilkan kekurangan]
    N --> O{Pilih tindak lanjut}
    O -->|Internal transfer| P[Buat request transfer]
    O -->|Pembelian| Q[Buat request order/purchase request]
    O -->|Substitusi| R[Persetujuan bahan substitusi]
    O -->|Kurangi produksi| B
    P --> S[Tunggu bahan tersedia]
    Q --> S
    R --> E
    S --> E
```

---

# 6. Matriks Perubahan Stok

| Proses | Stok tersedia sumber | Stok dalam perjalanan | Stok tersedia tujuan | Stok karantina |
|---|---:|---:|---:|---:|
| Registrasi kedatangan pemasok | Tidak berubah | Tidak berubah | Tidak berubah | Tidak berubah |
| Pemeriksaan sebelum validasi | Tidak berubah | Tidak berubah | Tidak berubah | Dapat dicatat secara administratif |
| Validasi penerimaan pemasok | Bertambah di gudang penerima | Tidak berubah | Tidak berubah | Bertambah jika hasil karantina |
| Pengiriman internal transfer | Berkurang | Bertambah | Tidak berubah | Tidak berubah |
| Validasi penerimaan transfer | Tidak berubah | Berkurang | Bertambah | Dapat bertambah bila bermasalah |
| Pengeluaran bahan produksi | Berkurang | Tidak berubah | Menjadi WIP/pemakaian produksi | Tidak berubah |
| Validasi hasil produksi | Tidak berubah | Tidak berubah | Stok barang jadi bertambah | Dapat bertambah bila tidak lulus QC |

---

# 7. Status Dokumen yang Wajib Disiapkan

## 7.1. Penerimaan Barang

```text
DRAFT
ARRIVED
INSPECTED
WAITING_VALIDATION
CORRECTION_REQUIRED
VALIDATED
STOCK_POSTED
PUT_AWAY
PARTIALLY_ACCEPTED
QUARANTINED
REJECTED
CANCELLED
CLOSED
```

## 7.2. Request Order

```text
DRAFT
AUTO_GENERATED
SUBMITTED
WAITING_APPROVAL
APPROVED
CONSOLIDATED
CONVERTED_TO_TRANSFER
CONVERTED_TO_PURCHASE_REQUEST
PARTIALLY_FULFILLED
FULFILLED
REJECTED
CANCELLED
CLOSED
```

## 7.3. Notifikasi Minimum Stok

```text
OPEN
ACKNOWLEDGED
TRANSFER_RECOMMENDED
REQUEST_ORDER_CREATED
PURCHASE_REQUEST_CREATED
IN_FULFILLMENT
RESOLVED
DISMISSED
CLOSED
```

---

# 8. Kebutuhan Hak Akses Tambahan

```text
RECEIVE_GOODS
INSPECT_GOODS
VALIDATE_RECEIPT
POST_RECEIPT_STOCK
CREATE_BACKORDER
REDIRECT_BACKORDER_SUPPLIER
APPROVE_BACKORDER
CANCEL_BACKORDER
ALLOCATE_RECEIVED_STOCK
CREATE_INTERNAL_TRANSFER
APPROVE_INTERNAL_TRANSFER
DISPATCH_INTERNAL_TRANSFER
RECEIVE_INTERNAL_TRANSFER
VALIDATE_INTERNAL_TRANSFER
CONFIGURE_MIN_STOCK
GENERATE_REQUEST_ORDER
APPROVE_REQUEST_ORDER
VIEW_BOM
MANAGE_BOM
CHECK_MATERIAL_AVAILABILITY
OVERRIDE_MATERIAL_SHORTAGE
START_PRODUCTION
VALIDATE_PRODUCTION_RESULT
POST_FINISHED_GOODS
```

---

# 9. Data Teknis Minimum yang Perlu Disiapkan

## 9.1. Header penerimaan barang

```text
receipt_id
tenant_id
company_id
warehouse_id
supplier_id
purchase_order_id
backorder_id
receipt_number
receipt_date
arrival_date
receipt_type
status
validation_status
validated_by
validated_at
notes
version
```

## 9.2. Detail penerimaan barang

```text
receipt_detail_id
receipt_id
purchase_order_detail_id
product_id
uom_id
ordered_qty
previously_received_qty
received_qty
accepted_qty
rejected_qty
backorder_qty
batch_number
serial_number
production_date
expiry_date
quality_status
warehouse_location_id
```

## 9.3. Backorder

```text
backorder_id
tenant_id
source_purchase_order_id
source_receipt_id
supplier_id
replacement_supplier_id
backorder_number
status
total_shortage_qty
fulfillment_due_date
redirect_reason
approval_status
created_by
approved_by
closed_at
```

## 9.4. Internal transfer

```text
transfer_id
tenant_id
source_warehouse_id
destination_warehouse_id
request_order_id
transfer_number
status
dispatch_date
arrival_date
received_date
validated_by
validated_at
```

## 9.5. Minimum stok

```text
stock_policy_id
tenant_id
product_id
warehouse_id
location_id
minimum_stock
maximum_stock
reorder_point
safety_stock
lead_time_days
recommended_order_qty
is_auto_request_enabled
```

## 9.6. BOM / Resep

```text
bom_id
tenant_id
product_id
bom_version
output_qty
output_uom_id
effective_from
effective_until
status
approved_by
approved_at
```

```text
bom_detail_id
bom_id
material_product_id
required_qty
uom_id
waste_tolerance
is_mandatory
substitute_group
sequence
```

---

# 10. Validasi Bisnis Wajib

1. Jumlah diterima tidak boleh melebihi sisa PO tanpa otorisasi.
2. `accepted_qty + rejected_qty` tidak boleh melebihi `received_qty`.
3. `backorder_qty` dihitung dari sisa PO yang belum dipenuhi.
4. Stok tidak boleh bertambah sebelum penerimaan berstatus `VALIDATED`.
5. Transfer tujuan tidak boleh menambah stok sebelum validasi penerimaan tujuan.
6. Sistem tidak boleh membuat dua backorder aktif untuk kekurangan PO yang sama tanpa hubungan split yang jelas.
7. Pengalihan pemasok harus memiliki persetujuan dan alasan.
8. Produk dengan batch atau kedaluwarsa wajib mengisi batch dan expiry.
9. Work Order tidak dapat dimulai bila bahan wajib kurang, kecuali ada hak override khusus.
10. Override kekurangan bahan wajib dicatat pada audit log.
11. Hasil produksi tidak menambah stok barang jadi sebelum divalidasi.
12. Semua posting stok harus menghasilkan kartu stok dan referensi dokumen sumber.

---


# 11. Struktur Navigasi per Platform

## 5.1. Desktop / Web

```text
Header
├── Logo eBisnis.id
├── Pemilih Perusahaan
├── Pemilih Brand
├── Pemilih Outlet
├── Pencarian Menu
├── Notifikasi
├── Persetujuan
└── Profil

Sidebar
├── Favorit
├── Kasir / POS
├── Beranda
├── Penjualan
├── Produk dan Harga
├── Pelanggan dan CRM
├── Pembelian
├── Gudang dan Persediaan
├── Produksi
├── Quality Control
├── Distribusi dan Pengiriman
├── Keuangan dan Akuntansi
├── Investor dan Bagi Hasil
├── SDM dan Payroll
├── Aset dan Pemeliharaan
├── Workflow dan Persetujuan
├── Laporan dan Analitik
├── Langganan dan Perangkat
├── Master Data
├── Integrasi dan API
├── Administrasi Sistem
└── Bantuan dan Dukungan
```

## 5.2. Android / iOS — Kasir

```text
Beranda
Kasir
Pesanan
Notifikasi
Lainnya
```

## 5.3. Android / iOS — Manajemen

```text
Beranda
Tugas
Persetujuan
Laporan
Lainnya
```

---

# 12. Struktur Menu Berdasarkan Jenis Pengguna

## 6.1. Pemilik / Investor

```text
Beranda
Dashboard Pemilik
Dashboard Investor
Penjualan
Persediaan
Keuangan
Investor dan Bagi Hasil
Laporan
Persetujuan
Langganan
```

## 6.2. Manajemen

```text
Beranda
Kasir / POS
Penjualan
Produk dan Harga
Pelanggan dan CRM
Pembelian
Gudang dan Persediaan
Produksi
Quality Control
Distribusi dan Pengiriman
Keuangan dan Akuntansi
Investor dan Bagi Hasil
SDM dan Payroll
Aset dan Pemeliharaan
Workflow dan Persetujuan
Laporan dan Analitik
```

## 6.3. Kasir

```text
Kasir / POS
Buka Shift
Transaksi Baru
Pesanan Aktif
Pembayaran
Retur dengan Otorisasi
Riwayat Transaksi Hari Ini
Ringkasan Shift
Tutup Shift
Notifikasi
Profil
```

## 6.4. Petugas Gudang

```text
Beranda
Penerimaan Barang
Put-away
Picking
Packing
Transfer Persediaan
Stock Opname
Kartu Stok
Notifikasi
```

## 6.5. Karyawan

```text
Beranda
Profil Saya
Presensi
Jadwal
Cuti dan Izin
Lembur
Slip Gaji
Tugas
Notifikasi
```

---

# 13. Catatan Enhancement Versi Ini

Perbaikan utama pada versi enhanced ini:

1. Struktur **Penerimaan Barang** dibuat lebih rinci.
2. **Backorder** ditempatkan lebih tepat sebagai bagian dari:
   - selisih penerimaan,
   - monitoring pembelian,
   - laporan backorder.
3. Pemisahan lebih jelas antara:
   - penerimaan,
   - pemeriksaan,
   - put-away,
   - selisih,
   - berita acara.
4. Struktur tree lebih konsisten agar lebih mudah dipetakan ke:
   - menu database,
   - permission matrix,
   - seed menu,
   - UI tree control seperti pada screenshot role access.
5. Dokumen lebih siap dijadikan dasar untuk:
   - tabel `menu`,
   - tabel `role_menu`,
   - tabel `menu_action`,
   - generator sidebar,
   - mobile navigation.

---

# 14. Rekomendasi File Turunan Berikutnya

Dari dokumen ini, tahap berikut yang disarankan:

1. **Seed data menu SQL**
2. **Template tabel menu dan role**
3. **File JSON master menu**
4. **Matrix hak akses per role**
5. **Struktur icon dan route**
6. **Versi khusus mobile**
7. **Versi khusus POS**


# LAMPIRAN I — CATATAN ARSITEKTUR MULTI-SCHEMA

PostgreSQL schema adalah namespace dalam satu database. Object dengan nama sama dapat berada
pada schema yang berbeda. Aplikasi harus mengamankan `search_path`, privilege, dan identifier.

Prisma mendukung penggunaan beberapa schema yang nama-namanya dideklarasikan. Untuk schema
tenant yang dibuat saat runtime, implementasi wajib dibuktikan melalui integration test dan ADR.
Jangan menganggap seluruh dynamic schema dapat dikelola hanya dengan satu deklarasi
`schemas = [...]`.

Multi-schema per tenant memberikan isolasi namespace yang kuat, tetapi menambah biaya:

- migration ke banyak tenant;
- connection/client cache;
- backup/restore per tenant;
- observability;
- lintas-tenant analytics;
- jumlah object database.

Buat metrik jumlah schema, waktu migration, client cache, dan provisioning failure. Siapkan ADR
untuk beralih ke database-per-tenant atau shared-schema/RLS bila skala kelak menuntutnya.

# LAMPIRAN V3-A — COMMAND PERTAMA UNTUK CODEX / CLAUDE

```text
Baca MASTER_PROMPT_CODEX_CLAUDE_EBISNIS_FULLSTACK_V5_FULL_ERP_DATA_DICTIONARY_CMS_SEED.md
sampai selesai serta baca seluruh docs/input, khususnya ESmartlink.java dan
SmartlinkChannelWindow.java.

Gunakan C:\opt\eBisnis sebagai working copy SVN.
Jangan membuat repository Git.

Kerjakan berurutan:
1. audit input dan environment;
2. platform schema;
3. akun super admin admin/<BOOTSTRAP_PASSWORD> dengan forced password change;
4. locale id/en/ar/zh-CN;
5. tenant provisioning dan demo;
6. platform admin portal;
7. module catalog, package builder, pricing dan discount engine;
8. seed paket Rp250.000/Rp400.000/Rp600.000/Rp750.000;
9. device subscription dan invoice;
10. Esmartlink create-order, callback, inquiry/check payment, dan reconciliation;
10. vertical slice ERP;
11. lint, test, E2E, build, run localhost.

Jangan hanya membuat rencana. Buat file dan jalankan command.
Jangan mengklaim selesai jika migration, seed, test, build, dan smoke test belum berhasil.
```

# LAMPIRAN V3-B — AKUN LOCAL DEVELOPMENT

```text
Platform Super Admin
Username : admin
Password : <BOOTSTRAP_PASSWORD>
Catatan  : wajib diganti setelah login pertama

Demo tenant
Username : demo
Password : Demo123!
Schema   : demo
Audit    : demo__audit
```

# LAMPIRAN V3-C — KEPUTUSAN KEAMANAN PENTING

1. Credential development hanya untuk localhost.
2. Production bootstrap super admin harus memakai secret manager/environment.
3. Admin tenant support context tidak sama dengan impersonasi diam-diam.
4. UI selalu menampilkan bahwa super admin sedang mengakses tenant.
5. Audit ganda wajib.
6. Esmartlink callback tidak boleh dipercaya hanya karena `status=success`.
7. Callback harus lolos provider validation, order match, amount match, idempotency, dan state transition.
8. ACK provider dan commit bisnis adalah dua hal yang berbeda.
9. Raw payment payload tidak boleh muncul pada log aplikasi umum.
10. Discount expression tidak boleh dieksekusi dengan `eval`, Function constructor, atau SQL dari pengguna.

# LAMPIRAN V4-A — SOURCE-TO-NEW-SERVICE MAPPING ESMARTLINK

| Source legacy | Perilaku yang dipelajari | Implementasi baru |
|---|---|---|
| `DownloadTagihanSiswaBankOnline.java` | Hitung item/total, pilih channel, create-order, expiry, payment URL | `EsmartlinkCreateOrderMapper`, `EsmartlinkPaymentOrderService` |
| `SmartlinkChannelWindow.java` | Parse channel, admin fee, pilihan expiry | `EsmartlinkLegacyChannelParser`, `PaymentChannelService` |
| `Esmartlink.java` | Callback, dedupe, payment processing, always-log H2H | `EsmartlinkCallbackController`, validator, processor, H2H logger |
| `VirtualAccountBankAction.java` | Inquiry/check payment berdasarkan transaction ID, single dan batch | `EsmartlinkInquiryService`, `PaymentCheckBatchService`, reconciliation worker |

# LAMPIRAN V4-B — ATURAN PAKET TIDAK BOLEH HARD-CODED

Contoh yang dilarang:

```typescript
if (planCode === "POS_BUSINESS") {
  enableAccounting = true;
  enableInventory = true;
}
```

Contoh yang diwajibkan:

```text
SubscriptionPlan
→ SubscriptionPlanVersion
→ SubscriptionPlanModule
→ SubscriptionPlanFeature
→ SubscriptionPlanPrice
→ EntitlementResolver
```

Route guard, menu visibility, API permission, dan feature availability membaca entitlement efektif,
bukan nama paket.

# LAMPIRAN V4-C — PERINTAH AWAL CODEX / CLAUDE

```text
Baca MASTER_PROMPT_CODEX_CLAUDE_EBISNIS_FULLSTACK_V5_FULL_ERP_DATA_DICTIONARY_CMS_SEED.md
sampai selesai.

Baca:
- ESmartlink.java
- DownloadTagihanSiswaBankOnline.java
- SmartlinkChannelWindow.java
- VirtualAccountBankAction.java

Gunakan C:\opt\eBisnis sebagai working copy SVN.
Jangan membuat Git repository.

Prioritas:
1. platform, admin, tenant, demo, audit;
2. locale dan translation;
3. module/feature catalog;
4. flexible package builder;
5. seed paket 250/400/600/750 ribu;
6. pricing, tier, add-on, tenant override, discount;
7. subscription per device/selected/all;
8. Esmartlink create-order;
9. callback;
10. check payment/inquiry single dan batch;
11. reconciliation;
12. vertical slice ERP;
13. migration, seed, lint, test, E2E, build, localhost smoke test.

Jangan berhenti pada dokumentasi atau skeleton.
```



# LAMPIRAN V5-A — KAMUS DATA ERP END-TO-END

> Lampiran ini adalah baseline minimum. Agen wajib mengubahnya menjadi Prisma model,
> migration, ERD, index catalog, dan dokumentasi yang tervalidasi otomatis.
>
> Seluruh tabel master mewarisi kolom lifecycle Versi 5. Kolom yang ditulis di bawah adalah
> kolom khusus domain. Seluruh transaksi memiliki audit actor/timestamp, status, source,
> idempotency key bila relevan, dan version.

## A. Platform, Registration, Security, Subscription, Payment, dan CMS

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `platform_user` | Login global | `username`, `normalizedUsername`, `email`, `phone`, `displayName`, `passwordHash`, `status`, `mustChangePassword`, `preferredLocaleCode`, `lastLoginAt` | locale, role, membership, session |
| `platform_user_profile` | Profil global | `platformUserId`, nama, avatar, timezone, format tanggal | user 1:1 |
| `platform_role` | Role global | `code`, `nameKey`, `roleType`, `isSystem` | role permission, user role |
| `platform_permission` | Permission global | `code`, `moduleCode`, `actionCode`, `descriptionKey` | role permission |
| `platform_role_permission` | Matrix global | `roleId`, `permissionId`, `effect` | role + permission |
| `platform_user_role` | Assignment role | `userId`, `roleId`, `validFrom`, `validUntil` | user + role |
| `platform_session` | Sesi | `userId`, `tokenFamilyId`, `issuedAt`, `expiresAt`, `revokedAt`, IP, user-agent | user |
| `platform_refresh_token` | Refresh token hash | `sessionId`, `tokenHash`, `parentTokenId`, `expiresAt`, `revokedAt` | session |
| `platform_login_attempt` | Percobaan login | username, success, failure code, IP, user-agent, occurredAt | user optional |
| `platform_step_up_challenge` | Step-up auth | user, purpose, challenge hash, expiry, verifiedAt | user |
| `registration` | Pendaftaran publik | business profile, lokasi, PIC, email, desired username, terms/privacy, status | tenant, provisioning |
| `registration_credential_delivery` | Bukti credential tampil sekali | registration, delivery channel, deliveredAt, acknowledgedAt | registration |
| `tenant` | Pelanggan SaaS | code, name, slug, status, trial, locale, timezone | schema registry, membership, subscription |
| `tenant_schema_registry` | Pemetaan schema | tenant, username, schemaName, auditSchemaName, schemaVersion, status, timestamps | tenant |
| `tenant_membership` | User pada tenant | tenant, platform user, tenant subject, status, isOwner | tenant + user |
| `provisioning_job` | Provisioning tenant | registration, tenant, status, currentStage, attempt, errorCode, retryAt | steps |
| `provisioning_step` | Detail provisioning | job, stepCode, status, timestamps, checksum, error | job |
| `schema_migration_catalog` | Migration canonical | version, name, checksum, script path, release date | tenant history |
| `tenant_schema_migration_history` | Migration per schema | tenant, schema, migration version, checksum, appliedAt, duration, status | tenant + catalog |
| `schema_name_reservation` | Reservasi username/schema | normalizedName, registration, reservedAt, expiresAt, consumedAt | registration |
| `platform_support_session` | Support context tenant | tenant, requestedBy, reason, accessMode, expiresAt, stepUpVerifiedAt | tenant + admin |
| `locale` | Bahasa | code, name, nativeName, direction, fallback, enabled | translation |
| `translation_namespace` | Namespace i18n | code, name | translation key |
| `translation_key` | Kunci i18n | namespace, key, default text, description | namespace + values |
| `translation_value` | Nilai i18n | key, locale, value, reviewStatus, version | key + locale |
| `tenant_translation_override` | Override tenant | tenant, key, locale, value, effective dates | tenant + key |
| `module_catalog` | Modul ERP global | code, nameKey, descriptionKey, category, dependencyPolicy | features, package modules |
| `feature_catalog` | Fitur granular | module, code, nameKey, featureType, defaultLimit | module |
| `subscription_product` | Produk SaaS | code, nameKey, type, defaultTrialDays | plan |
| `subscription_plan` | Identitas paket | product, code, nameKey, segment, status | versions |
| `subscription_plan_version` | Versi immutable | plan, version, effective dates, future module policy, status | modules, features, prices |
| `subscription_plan_module` | Modul paket | plan version, module, entitlement scope, enabled, policy | version + module |
| `subscription_plan_feature` | Fitur paket | plan version, feature, included, limit, unit | version + feature |
| `subscription_plan_price` | Harga paket | version, currency, billing metric, interval, unit price, minimum qty | price tier |
| `subscription_plan_price_tier` | Tier volume | price, quantity range, unitPrice, flatAmount | price |
| `subscription_plan_constraint` | Batas paket | version, constraintType, min/max/value | version |
| `subscription_add_on` | Add-on | code, nameKey, status | versions |
| `subscription_add_on_version` | Versi add-on | add-on, version, effective dates, status | modules/prices |
| `subscription_add_on_module` | Modul add-on | add-on version, module, entitlement scope | add-on + module |
| `subscription_add_on_price` | Harga add-on | add-on version, currency, metric, interval, price | add-on |
| `tenant_plan_contract` | Kontrak khusus tenant | tenant, plan version, mode, start/end, status | tenant + plan |
| `tenant_price_override` | Harga khusus | tenant, plan version, type, amount/percent, effective dates, reason | tenant + plan |
| `discount_program` | Program diskon | code, nameKey, priority, stackPolicy, validity, status | rule, eligibility, redemption |
| `discount_rule` | Rule diskon | program, conditionTree JSON, benefit type/value, cap | program |
| `discount_redemption` | Pemakaian promo | program, tenant, quote/invoice, amount, occurredAt | program + tenant |
| `pricing_quote` | Quote immutable | tenant, plan version, payment mode, currency, totals, expiry, calculationTrace | lines, adjustments |
| `pricing_quote_line` | Line quote | quote, device/outlet, package assignment, qty, base/effective price, total | quote |
| `pricing_adjustment` | Diskon/override snapshot | quote, source type/id, label, amount, calculation snapshot | quote |
| `subscription` | Kontrak langganan | tenant, plan version, status, startsAt, endsAt, renewal policy | item, invoice |
| `subscription_item` | Item subscription | subscription, item type, device, add-on version, qty, entitlement scope | subscription |
| `package_assignment` | Penempatan paket | tenant, scope type/id, plan version, startsAt, endsAt, status | tenant + plan |
| `entitlement_snapshot` | Hak efektif | tenant, source, modules/features JSON, generatedAt, validUntil | subscription/package |
| `pos_device` | Mesin POS | tenant, outlet, code, label, fingerprintHash, status, activation/revocation | tenant, outlet |
| `device_entitlement` | Hak per mesin | device, module/feature, startsAt, endsAt, status, source snapshot | device |
| `billing_invoice` | Invoice SaaS | tenant, number, subscription, issue/due dates, currency, totals, paidTotal, status | lines, allocation |
| `billing_invoice_line` | Line invoice | invoice, lineType, device/module/feature, snapshot, qty, unitPrice, discounts/tax/total | invoice |
| `billing_payment_allocation` | Alokasi pembayaran | payment event/order, invoice/line, amount, allocatedAt | invoice + payment |
| `billing_credit_note` | Koreksi invoice | invoice, number, issueDate, reason, amount, status | invoice |
| `billing_receipt` | Kuitansi | tenant, invoice, receiptNumber, paidAt, amount, file | invoice |
| `payment_provider` | Provider | code, name, environment, endpoint, secretReference, status | channels/orders |
| `payment_channel` | Channel | provider, code, labelKey, admin fee type/value, expiry options, credential scope | provider |
| `payment_order` | Order/VA | provider, invoice, provider order/transaction IDs, URL, amount, channel, expiry, status, snapshots | invoice/provider |
| `payment_attempt` | Attempt provider | order, type, idempotency key, masked request/response, HTTP status, duration, status | order |
| `payment_callback_event` | Callback immutable | provider, order, provider transaction ID, raw/normalized status, amount, checksum, processing status | order |
| `payment_inquiry_attempt` | Cek pembayaran | order, source, request/response, raw/normalized status, duration | order |
| `payment_check_batch` | Cek massal | requester, source, total/progress/success/failure, status | items |
| `payment_check_batch_item` | Item cek massal | batch, order, status, result code/message, timestamps | batch + order |
| `host_to_host_log` | Semua inbound provider | provider, remote IP, masked headers/payload, result, encrypted stack trace, occurredAt | provider optional |
| `payment_reconciliation_run` | Rekonsiliasi | provider, period, totals, status, started/finished | items |
| `payment_reconciliation_item` | Item rekonsiliasi | run, order, provider status, local status, discrepancy, action | run + order |
| `website` | Website platform | code, name, primary domain, default locale, theme | CMS |
| `website_domain` | Domain | website, domain, primary, SSL, redirect policy | website |
| `cms_page` | Halaman | website, parent, slug, type, template, status, published version, navigation flag | versions |
| `cms_page_version` | Versi halaman | page, version, title, summary, SEO, status, publish metadata | page |
| `cms_page_translation` | Terjemahan halaman | version, locale, title/summary/SEO | page version + locale |
| `cms_block` | Blok halaman | page version, parent block, type, key, layout, settings JSON, order | page version |
| `cms_block_translation` | Konten blok | block, locale, heading/subheading/body/button/content JSON | block + locale |
| `cms_navigation` | Navigasi | website, code, name, location | items |
| `cms_navigation_item` | Item navigasi | navigation, parent, labelKey, page/external URL, icon, target, order | navigation/page |
| `cms_footer_section` | Bagian footer | website, code, titleKey, order | items |
| `cms_footer_item` | Item footer | section, labelKey, URL, icon, order | section |
| `news_category` | Kategori berita | parent, code, nameKey, slug | article |
| `news_article` | Berita | category, author, slug, status, image, publish/expiry, featured/pinned | versions/tags |
| `news_article_version` | Versi berita | article, version, title, summary, content, status | article |
| `news_article_translation` | Terjemahan berita | version, locale, content/SEO | article version |
| `news_tag` | Tag berita | code, nameKey, slug | article tags |
| `announcement` | Pengumuman | title/body keys, severity, audience, start/end, dismissible | none |
| `hero_slide` | Hero | website, title/subtitle keys, background media, CTA, order | website/media |
| `marketing_feature` | Fitur pemasaran | module code, title/description keys, icon/image, order | module/media |
| `faq_category` | Kategori FAQ | code, nameKey, order | FAQ |
| `faq_item` | FAQ | category, questionKey, answerKey, order | category |
| `testimonial` | Testimoni | person, organization, role, quoteKey, avatar, rating | media optional |
| `partner_logo` | Logo mitra | name, URL, media, order | media |
| `media_folder` | Folder media | parent, code, name | self |
| `media_asset` | File media | folder, storageKey, filename, MIME, size, checksum, dimensions, alt key, public | folder |
| `redirect_rule` | Redirect | website, source path, target URL, HTTP status, validity | website |
| `cms_publication_workflow` | Workflow publish | entity type/id, status, actors, timestamps | CMS entity |

## B. Organisasi, Scope, Menu, dan Konfigurasi Tenant

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `business_group` | Grup usaha tree | parent, code, name, path, level | self, legal entity |
| `legal_entity` | Perusahaan/manajemen | group, code, legal/trade name, legal form, tax/registration no., address, fiscal month, currency | group, brand, outlet |
| `brand` | Brand usaha | legal entity, code, name, logo | legal entity, outlet |
| `region` | Wilayah internal tree | parent, type, code, name, path, level | self, outlet/warehouse |
| `branch` | Cabang | legal entity, region, code, name, address | entity/region |
| `outlet_type` | Jenis outlet | code, nameKey, category | outlet |
| `outlet` | Toko/cafe/restoran | entity, brand, branch, region, type, code, name, address, timezone, openingDate | org masters |
| `department` | Departemen tree | entity, parent, code, name, cost center | entity/self |
| `operating_unit` | Unit operasi | entity, region, type, code, name, address | entity |
| `address` | Alamat | label, address lines, district, city, province, postal, country, latitude/longitude | reusable |
| `business_calendar` | Kalender | entity, code, name, timezone | calendar day |
| `business_calendar_day` | Hari kerja/libur | calendar, date, type, working flag, note | calendar |
| `fiscal_period` | Periode fiskal | entity, year, period no., dates, status, close metadata | entity/journal |
| `number_sequence` | Nomor dokumen | scope, document type, prefix/suffix, next number, reset policy | documents |
| `app_setting` | Setting tenant | scope, key, value type, JSON value, encrypted flag | scope |
| `file_object` | Metadata file tenant | storage key, filename, MIME, size, checksum, owner | attachments |
| `entity_attachment` | File pada entity | entity type/id, file, category, order | file |
| `user_subject` | Proyeksi user tenant | platform user, username snapshot, display name, status | membership, roles |
| `role` | Role tenant | code, name, type, system flag | permissions/assignment |
| `permission_action` | Aksi | code, nameKey, action type | menu action |
| `menu` | Tree menu | parent, code, translationKey, route, icon, module, platform, entitlement | self |
| `menu_action` | Aksi menu | menu, permission action | menu + action |
| `role_menu_permission` | Permission role | role, menu, action, effect | role/menu/action |
| `role_scope` | Scope data | role, scope type, entity/brand/region/outlet/warehouse/department | role + org |
| `user_role_assignment` | Assignment role | user subject, role, validity | user + role |
| `user_direct_permission` | Override user | user, menu/action, effect, reason | user/menu/action |
| `delegation` | Delegasi | from/to user, validity, scope JSON, status | users |
| `user_favorite_menu` | Favorit | user, menu, order | user/menu |
| `user_recent_menu` | Menu terbaru | user, menu, accessedAt | user/menu |
| `data_export_log` | Audit ekspor | user, resource, filter snapshot, row count, file, exportedAt | user/file |

## C. Catalog, Product, Price, Party, Customer, Supplier, dan CRM

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `product_category` | Kategori tree | parent, code, name, path, level | product |
| `product_brand` | Merek produk | code, name, owner party | product |
| `uom` | Satuan | code, name, symbol, dimension, precision, allowFraction | product/conversion |
| `uom_conversion` | Konversi | product optional, from/to UOM, factor, rounding | product/UOM |
| `tax_category` | Kategori pajak | code, name, tax type | product/rate |
| `tax_rate` | Tarif | category, jurisdiction, rate, effective dates, inclusive | category |
| `product` | Master produk | category, brand, SKU, name, type, tracking, base UOM, tax, shelf life, negative stock policy | catalog |
| `product_variant` | Varian | product, SKU, name, attribute signature | product |
| `product_attribute` | Atribut | code, name, data type | values |
| `product_attribute_value` | Nilai atribut | attribute, code, value, order | attribute |
| `product_variant_value` | Nilai varian | variant, attribute value | both |
| `product_barcode` | Barcode | product/variant/UOM, barcode, type, primary | catalog |
| `product_image` | Gambar | product/variant, media, order, primary | catalog/media |
| `product_listing` | Aktivasi per outlet/channel | product, brand, outlet, channel, sale/purchase enabled | product/org |
| `price_book` | Buku harga | code, name, scope, currency, validity | items |
| `price_book_item` | Harga produk | book, product/variant/UOM, minimum qty, price, validity | catalog |
| `promotion` | Promo ERP | code, name, type, validity, priority, stack policy | conditions/benefits |
| `promotion_condition` | Kondisi | promotion, group, field, operator, JSON value | promotion |
| `promotion_benefit` | Benefit | promotion, type, value, product, maximum | promotion/product |
| `voucher` | Voucher | promotion, code, usage limits, validity | promotion |
| `voucher_redemption` | Penukaran | voucher, customer, source sale, amount, occurredAt | voucher/customer |
| `product_bundle` | Paket produk | code, name, output product, pricing method | items |
| `product_bundle_item` | Item bundle | bundle, product/variant, qty, UOM | bundle/catalog |
| `party` | Pihak | type, code, display name, tax no., email, phone, address | person/org/customer/supplier |
| `person` | Individu | party, names, birth date, gender, masked ID | party |
| `organization_party` | Organisasi pihak | party, legal name, registration no., industry | party |
| `customer_group` | Grup pelanggan | code, name, price book, credit policy | customer |
| `customer` | Pelanggan | party, group, customer number, limit, payment term, loyalty | party/group |
| `supplier_group` | Grup pemasok | code, name, payment term | supplier |
| `supplier` | Pemasok | party, group, supplier number, rating, lead time, payment term | party/group |
| `product_supplier` | Produk pemasok | supplier, product, supplier SKU, purchase UOM, lead time, MOQ, last price, priority, preferred | supplier/product |
| `payment_term` | Termin | code, name, due days, discount days/percent | customer/supplier |
| `sales_person` | Sales | user subject, employee, code, commission plan | user/employee |
| `lead` | Prospek | party, source, owner, status, estimated value | party/user |
| `opportunity` | Peluang | lead/customer, stage, probability, expected close, value | CRM |
| `crm_activity` | Aktivitas | party/opportunity, type, due/completed, owner, notes | CRM/user |
| `loyalty_program` | Program loyalitas | code, name, earn/redeem JSON, validity | account |
| `loyalty_account` | Akun loyalitas | customer, program, member no., tier, balance | customer/program |
| `loyalty_transaction` | Mutasi poin | account, type, points, source, occurredAt | account |
| `customer_ticket` | Tiket | customer, category, priority, subject, description, status, assignee, dueAt | customer/user |



## D. POS, Sales, Payment, Return, dan Commission

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `payment_method` | Metode pembayaran | code, nameKey, methodType, requiresReference, allowsChange, settlementAccount | POS/sales payment |
| `pos_terminal` | Terminal kasir | outlet, device, code, name, printer config JSON, status | outlet/device |
| `pos_shift` | Shift kasir | terminal, cashier, openedAt, openingCash, closedAt, closingCash, expectedCash, variance, status | terminal/user |
| `cash_drawer_movement` | Mutasi laci | shift, type, amount, reason, source type/id, occurredAt | shift |
| `sales_quotation` | Penawaran | customer, outlet, number, date, validUntil, currency, totals, status | customer/outlet |
| `sales_quotation_line` | Detail penawaran | quotation, product/variant/UOM, qty, unit price, discount, tax, total | quotation/catalog |
| `sales_order` | Pesanan | customer, outlet, number, dates, channel, currency, totals, status | customer/outlet |
| `sales_order_line` | Detail order | order, product/variant/UOM, ordered/reserved/delivered/invoiced qty, pricing | order/catalog |
| `sales_invoice` | Invoice penjualan | customer, order, number, dates, currency, totals, paidTotal, status | customer/order |
| `sales_invoice_line` | Detail invoice | invoice, product, description, qty, UOM, prices, tax, total | invoice/product |
| `sales_payment` | Pembayaran pelanggan | customer, number, date, method, amount, currency, reference, status | customer/method |
| `sales_payment_allocation` | Alokasi | payment, invoice, amount | payment/invoice |
| `sales_return` | Retur | customer, outlet, number, date, source invoice, reason, status | customer/invoice |
| `sales_return_line` | Detail retur | return, invoice line, product, qty, condition, refund, stock disposition | return/product |
| `pos_sale` | Transaksi POS | shift, outlet, terminal, receipt no., customer, business/sale dates, currency, totals, status, offlineId, syncStatus | shift/outlet |
| `pos_sale_line` | Item POS | sale, product/variant/UOM, qty, unit price, discount, tax, total, cost snapshot | sale/catalog |
| `pos_payment` | Pembayaran POS | sale, method, amount, tendered, change, provider ref., status | sale/method |
| `held_order` | Pesanan ditahan | shift, holdCode, customer, cart snapshot, heldAt, expiresAt | shift/customer |
| `sales_commission_plan` | Skema komisi | code, name, basis, rate type, validity | rules |
| `sales_commission_rule` | Aturan komisi | plan, condition JSON, rate, fixed amount, maximum | plan |
| `sales_commission_result` | Hasil komisi | salesperson, source, basis amount, commission, status | salesperson/source |
| `refund_request` | Permintaan refund | source sale/invoice, customer, reason, requested amount, status | sale/invoice/customer |
| `refund_transaction` | Refund | request, method, amount, provider reference, processedAt, status | request/method |

## E. Request Order, Purchasing, Receiving, Backorder, dan AP

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `request_order` | Request internal | number, requester outlet/warehouse, parent warehouse, dates, source type, status | warehouses/outlet |
| `request_order_line` | Detail request | request, product/UOM, requested/approved/fulfilled qty, priority, stock snapshot | request/catalog |
| `purchase_requisition` | Permintaan pembelian | number, entity, department, dates, budget, status | org/budget |
| `purchase_requisition_line` | Detail PR | requisition, product/description, UOM, qty, estimated price, preferred supplier | PR/catalog |
| `request_for_quotation` | RFQ | number, requisition, issue/due dates, currency, status | PR |
| `rfq_supplier` | Undangan pemasok | RFQ, supplier, invited/responded timestamps, status | RFQ/supplier |
| `supplier_quotation` | Penawaran pemasok | RFQ, supplier, number, date, validUntil, currency, totals, status | RFQ/supplier |
| `supplier_quotation_line` | Detail penawaran | quotation, product/UOM, qty, unit price, lead time, tax, total | quotation/catalog |
| `purchase_order` | PO | supplier, entity, warehouse, number, dates, currency, totals, source backorder, status | supplier/warehouse |
| `purchase_order_line` | Detail PO | PO, product/UOM, ordered/received/cancelled qty, unit price, discount, tax, total | PO/catalog |
| `backorder` | Backorder | source PO/receipt, original/replacement supplier, number, shortage, due date, redirect reason, status | PO/receipt/suppliers |
| `backorder_line` | Detail backorder | backorder, source PO line, product, shortage/fulfilled qty, target supplier | backorder/catalog |
| `goods_receipt` | Penerimaan | supplier, PO, backorder, warehouse, number, arrival/receipt dates, validation, status | supplier/PO/warehouse |
| `goods_receipt_line` | Detail penerimaan | receipt, PO line, product/UOM, ordered/received/accepted/rejected/backorder qty, batch, expiry, quality, bin | receipt/catalog |
| `goods_receipt_inspection` | Pemeriksaan fisik | receipt, inspector, inspectedAt, result, notes, attachment | receipt/user |
| `goods_receipt_validation` | Validasi stok | receipt, validator, validatedAt, posting key, status | receipt/user |
| `supplier_return` | Retur pemasok | supplier, source receipt, number, date, reason, status | supplier/receipt |
| `supplier_return_line` | Detail retur | return, receipt line, product/UOM, qty, disposition | return/catalog |
| `supplier_invoice` | Invoice pemasok | supplier, PO, number, dates, currency, totals, paidTotal, matchStatus, status | supplier/PO |
| `supplier_invoice_line` | Detail invoice | invoice, PO/receipt lines, product, qty, unit price, tax, total | invoice/PO/receipt |
| `supplier_payment` | Pembayaran pemasok | supplier, number, date, method, amount, currency, status | supplier |
| `supplier_payment_allocation` | Alokasi AP | payment, supplier invoice, amount | payment/invoice |
| `supplier_performance` | Evaluasi pemasok | supplier, period, onTimeRate, fillRate, defectRate, score, status | supplier |
| `supplier_contract` | Kontrak pemasok | supplier, number, validity, terms, status | supplier |

## F. Warehouse, Inventory, Internal Transfer, Stock Opname

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `warehouse_type` | Jenis gudang | code, nameKey, sale/production/transit flags | warehouse |
| `warehouse` | Gudang | entity, outlet, region, parent, type, code, name, address, parent flag | org/self |
| `warehouse_zone` | Zona | warehouse, code, name, zoneType, temperature range | warehouse |
| `warehouse_aisle` | Lorong | zone, code, name | zone |
| `warehouse_rack` | Rak | aisle, code, name, capacity | aisle |
| `warehouse_bin` | Bin | rack, code, name, capacity, pick priority | rack |
| `inventory_item` | Dimensi stok produk | product, variant, base UOM, tracking type | catalog |
| `inventory_lot` | Lot/batch | item, batch no., production/expiry, supplier, quality | item/supplier |
| `inventory_serial` | Serial | item, serial no., lot, status | item/lot |
| `stock_balance` | Proyeksi saldo | warehouse/bin/item/lot, onHand/reserved/inTransit/quarantine/damaged qty, version | dimensions |
| `stock_movement` | Ledger immutable | number, type, occurredAt, warehouse/bin/item/lot/serial, qty, UOM, source, posting key | dimensions/source |
| `stock_reservation` | Reservasi | warehouse/item/lot, source, qty, expiry, status | inventory/source |
| `stock_policy` | Kebijakan minimum | warehouse/outlet/product, min/max/reorder/safety, lead time, recommended qty, auto request | org/product |
| `stock_alert` | Alert minimum | policy, product, warehouse, projected/threshold qty, status, detected/resolved | policy |
| `internal_transfer` | Transfer | number, source/destination warehouse, request order, dispatch/arrival, status | warehouses/request |
| `internal_transfer_line` | Detail transfer | transfer, product/UOM, requested/allocated/dispatched/received/rejected qty, lot | transfer/catalog |
| `transfer_shipment` | Pengiriman transfer | transfer, shipment no., dispatch, carrier, vehicle, status | transfer/logistics |
| `transfer_receipt` | Penerimaan transfer | transfer, number, arrivedAt, validatedAt/by, status | transfer/user |
| `transfer_receipt_line` | Detail terima | receipt, transfer line, received/accepted/rejected qty, discrepancy | receipt/line |
| `stock_count` | Stock opname | warehouse, number, type, schedule/start/complete, status | warehouse |
| `stock_count_line` | Detail opname | count, bin/item/lot, system/count/variance qty, reason | count/dimensions |
| `inventory_adjustment` | Adjustment | warehouse, number, date, reason, source count, status | warehouse/count |
| `inventory_adjustment_line` | Detail adjustment | adjustment, item/lot/bin, qty, direction, unit cost | adjustment |
| `putaway_task` | Tugas put-away | receipt, warehouse, status, assignee, timestamps | receipt/warehouse |
| `putaway_task_line` | Detail put-away | task, receipt line, destination bin, qty, lot | task/receipt/bin |
| `picking_task` | Picking | source type/id, warehouse, assignee, priority, status | source/warehouse |
| `picking_task_line` | Detail picking | task, product/lot/source bin, requested/picked qty | task/catalog |
| `packing_task` | Packing | source type/id, warehouse, package count, status | source/warehouse |
| `inventory_cost_layer` | Layer biaya | item, warehouse, lot, receipt/source, qtyRemaining, unitCost, method | inventory/source |
| `inventory_valuation_snapshot` | Valuasi | warehouse, item, period, qty, unitCost, totalCost, method | inventory/period |

## G. Manufacturing, BOM, MRP, Quality, Maintenance

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `bom` | BOM/resep | product, code, name, type, status | versions |
| `bom_version` | Versi BOM | BOM, version, output qty/UOM, validity, status | BOM/UOM |
| `bom_component` | Komponen | version, material product, required qty/UOM, waste tolerance, mandatory, substitute group | BOM/catalog |
| `routing` | Routing | product, code, name, status | operations |
| `routing_operation` | Operasi | routing, sequence, work center, code, setup/run minutes | routing/work center |
| `work_center` | Pusat kerja | operating unit, code, name, capacity/hour, cost rate, calendar | org/calendar |
| `machine` | Mesin | work center, asset, code, name, capacity, status | work center/asset |
| `production_plan` | Rencana produksi | unit, number, dates, status | lines |
| `production_plan_line` | Detail rencana | plan, product, planned qty/UOM, required date, priority | plan/catalog |
| `material_requirement_plan` | Run MRP | scope, horizon, started/finished, status, parameters JSON | recommendations |
| `mrp_recommendation` | Rekomendasi | run, product, warehouse, recommendation type, required/suggested qty/date, source | MRP |
| `work_order` | WO produksi | number, product, BOM version, routing, warehouse, planned/completed qty, dates, status | catalog/BOM |
| `work_order_material` | Kebutuhan bahan | WO, product, required/reserved/issued/returned qty, UOM, substitute | WO/catalog |
| `material_issue` | Pengeluaran bahan | WO, number, date, warehouse, status | WO/warehouse |
| `material_issue_line` | Detail issue | issue, WO material, lot/bin, qty, unit cost | issue/inventory |
| `material_return` | Pengembalian bahan | WO, number, date, warehouse, status | WO/warehouse |
| `production_output` | Hasil produksi | WO, number, product, qty/UOM, batch, quality, validation | WO/catalog |
| `production_waste` | Waste | WO, product, qty/UOM, reason, unit cost | WO/catalog |
| `production_cost_snapshot` | Biaya batch | WO, material/labor/overhead cost, total/unit cost, method | WO |
| `quality_parameter` | Parameter mutu | code, name, data type, unit, limits, allowed values | specification |
| `quality_specification` | Spesifikasi | product/supplier, inspection type, code, name, validity | items |
| `quality_specification_item` | Item spesifikasi | specification, parameter, target/min/max, mandatory | spec/parameter |
| `quality_inspection` | Pemeriksaan | number, type, source, product/lot, inspector, result, status | source/catalog/user |
| `quality_inspection_result` | Hasil parameter | inspection, spec item, actual value, result, note | inspection/spec |
| `quality_nonconformance` | Ketidaksesuaian | inspection, code, severity, description, disposition, status | inspection |
| `corrective_action` | Tindakan koreksi | nonconformance, number, root cause, plan, owner, due, status | nonconformance/user |
| `preventive_action` | Tindakan pencegahan | source, number, risk, action plan, owner, due, status | source/user |
| `maintenance_plan` | Rencana perawatan | asset/machine, type, frequency, nextDueAt | asset/machine |
| `maintenance_work_order` | WO maintenance | plan, asset, number, priority, scheduled/start/complete, status | plan/asset |
| `maintenance_work_order_part` | Spare part | WO, product, planned/used qty, warehouse | WO/catalog |
| `maintenance_meter_reading` | Meter | asset/machine, meter type, value, readAt | asset/machine |



## H. Shipping, Delivery, Fleet, dan Logistics

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `carrier` | Ekspedisi | party, code, name, service area, tracking URL template | party |
| `shipping_service` | Layanan kirim | carrier, code, name, service level, estimated days | carrier |
| `shipping_rate` | Tarif | service, origin/destination region, weight range, rate, currency, validity | service/region |
| `delivery_order` | Perintah kirim | sales order, outlet, warehouse, number, date, customer, address, status | sales/org/customer |
| `delivery_order_line` | Detail DO | delivery order, sales order line, product, qty/UOM, lot | DO/catalog |
| `shipment` | Pengiriman | delivery order, carrier/service, number, tracking, dispatch/delivery, status | DO/carrier |
| `shipment_package` | Paket | shipment, package number, weight/dimensions, label file | shipment |
| `proof_of_delivery` | Bukti terima | shipment, receiver, receivedAt, signature/photo, note, result | shipment/media |
| `delivery_exception` | Masalah kirim | shipment, type, occurredAt, description, resolution status | shipment |
| `vehicle_type` | Jenis kendaraan | code, name, default capacity weight/volume | vehicle |
| `vehicle` | Armada | code, plate, type, brand/model/year, capacities, asset, status | type/asset |
| `driver` | Pengemudi | employee, license no/type/validity, status | employee |
| `route` | Rute | code, name, origin/destination, distance, duration | location |
| `trip` | Perjalanan | route, vehicle, driver, number, planned/actual timestamps, status | route/vehicle/driver |
| `trip_cost` | Biaya perjalanan | trip, cost type, amount, currency, receipt file | trip |
| `manifest` | Manifest | trip/shipment group, number, createdAt, status | trip/shipments |
| `manifest_item` | Item manifest | manifest, shipment, package, load sequence | manifest/shipment |

## I. Finance, Accounting, Budget, Tax, Asset

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `currency` | Mata uang | code, name, symbol, decimal places | exchange/document |
| `exchange_rate` | Kurs | from/to currency, date, rate, source | currency |
| `chart_of_account` | COA tree | entity, parent, accountCode, accountName, type, normal balance, posting flag, path, level | entity/self |
| `accounting_dimension` | Dimensi | code, name, type | values |
| `accounting_dimension_value` | Nilai dimensi | dimension, code, name, parent | dimension/self |
| `journal_source` | Sumber jurnal | code, name, module, auto-post policy | journal |
| `journal_entry` | Jurnal | entity, number, date, source, source doc, currency/rate, description, status, posting key, postedAt | source/entity |
| `journal_entry_line` | Baris jurnal | journal, account, debit, credit, currency amount, dimension JSON, description | journal/COA |
| `accounting_period_lock` | Kunci periode | entity, fiscal period, module, lockedAt/by, status | entity/period |
| `bank_account` | Rekening | entity, bank name, masked number, account name, currency, GL account | entity/COA |
| `cash_account` | Kas | entity, outlet, code, name, currency, GL account | entity/outlet/COA |
| `cash_transaction` | Mutasi kas | cash account, number, date, type, amount, source, status | cash/source |
| `bank_transaction` | Mutasi bank | bank account, date, reference, description, debit/credit/balance, external ID | bank |
| `bank_reconciliation` | Rekonsiliasi | bank account, period, opening/closing balance, status | bank |
| `bank_reconciliation_item` | Item rekonsiliasi | reconciliation, bank transaction, source, matched amount/status | reconciliation |
| `budget` | Anggaran | entity, code, name, fiscal year, status | lines |
| `budget_line` | Detail anggaran | budget, account, department, period, original/revised/committed/actual amount | budget/org/COA |
| `cost_center` | Pusat biaya | entity, code, name, department, manager | org |
| `tax_code` | Kode pajak | code, name, type, payable/receivable accounts | COA |
| `tax_transaction` | Transaksi pajak | tax code, source, tax base, tax amount, date, status | tax/source |
| `accounts_receivable` | Subledger piutang | customer, invoice, original/outstanding amount, due date, status | customer/invoice |
| `accounts_payable` | Subledger utang | supplier, supplier invoice, original/outstanding amount, due date, status | supplier/invoice |
| `fixed_asset_class` | Kelas aset | code, name, useful life, depreciation method, asset/accumulated/expense accounts | COA |
| `fixed_asset` | Aset | class, entity, number, name, acquisition date/cost, residual value, useful life, location, custodian, status | class/org/employee |
| `asset_depreciation_schedule` | Jadwal penyusutan | asset, period, opening value, depreciation, closing value, status | asset/period |
| `asset_transfer` | Mutasi aset | asset, from/to location/custodian, date, reason, status | asset/org |
| `asset_disposal` | Penghapusan aset | asset, disposal date, method, proceeds, gain/loss, status | asset |
| `financial_statement_layout` | Format laporan | code, name, statement type, status | lines |
| `financial_statement_line` | Baris format | layout, parent, code, labelKey, formula/COA mapping, order | layout |
| `closing_run` | Tutup buku | entity, period, started/finished, status, actor | entity/period |
| `closing_run_step` | Step tutup | run, step code, status, result, timestamps | run |

## J. Investor, Ownership, Revenue Sharing

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `owner_profile` | Pemilik | party, tax number, bank account, status | party/bank |
| `investor_profile` | Investor | party, investor number, accreditation, bank account, status | party/bank |
| `ownership_interest` | Kepemilikan | party, target type/id, percentage, effective dates | party/target |
| `investment_contract` | Kontrak investasi | investor, entity, number, dates, principal, currency, status | investor/entity |
| `investment_contribution` | Setoran modal | contract, date, amount, payment reference, status | contract |
| `investment_withdrawal` | Penarikan modal | contract, request date, approved date, amount, reason, status | contract |
| `revenue_share_scheme` | Skema bagi hasil | code, name, basis type, validity, status | tiers |
| `revenue_share_tier` | Tier | scheme, sequence, threshold type/value, owner/investor percentages | scheme |
| `revenue_share_contract` | Kontrak bagi hasil | investment contract, scheme snapshot, target, validity, status | contract |
| `revenue_share_period` | Periode | entity, start/end, status | entity |
| `revenue_share_calculation` | Perhitungan | contract, period, revenue, allowable cost, distributable, owner/investor amounts, formula snapshot, status | contract/period |
| `revenue_share_settlement` | Settlement | calculation, number, approval, payable/paid, status | calculation |
| `revenue_share_payment` | Pembayaran | settlement, date, amount, bank reference, status | settlement |
| `break_even_snapshot` | Snapshot BEP | contract, period, invested amount, recovered amount, remaining, reachedAt | contract/period |

## K. Human Resources, Attendance, Payroll, Performance, Training

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `employee_status` | Status pegawai | code, name, employment category | employee |
| `job_grade` | Grade | code, name, level, min/max salary | position/employee |
| `job_position` | Jabatan | entity, department, code, name, grade, reportsTo position | org/self |
| `employee` | Pegawai | party, number, entity, department, position, grade, status, hire/termination dates, manager | party/org |
| `employment_contract` | Kontrak kerja | employee, number, dates, type, base salary, status | employee |
| `employee_assignment` | Penempatan | employee, entity, outlet, department, position, dates, primary flag | employee/org |
| `employee_document_type` | Jenis dokumen | code, name, expiry required, sensitive flag | employee document |
| `employee_document` | Dokumen | employee, type, masked number, issue/expiry, file | employee/file |
| `work_schedule` | Jadwal kerja | code, name, timezone, weekly pattern JSON | employee schedule |
| `work_shift` | Shift | code, name, start/end, break, crossesMidnight | schedule |
| `employee_schedule` | Jadwal pegawai | employee, date, shift, outlet, status | employee/shift/outlet |
| `attendance_device` | Mesin presensi | code, name, device type, location, status | event |
| `attendance_event` | Event presensi | employee, type, occurredAt, device, geo, source, verification | employee/device |
| `attendance_daily` | Rekap harian | employee, date, schedule, check-in/out, worked/late/overtime minutes, status | employee/schedule |
| `leave_type` | Jenis cuti | code, name, quota, paid, attachment required | leave |
| `leave_balance` | Saldo cuti | employee, type, year, opening/earned/used/remaining | employee/type |
| `leave_request` | Pengajuan cuti | employee, type, dates, days, reason, status | employee/type |
| `overtime_request` | Lembur | employee, date/times, requested/approved minutes, reason, status | employee |
| `payroll_component` | Komponen gaji | code, name, type, taxable, calculation type, structured formula, GL account | payroll/COA |
| `payroll_group` | Kelompok payroll | code, name, frequency, payment day | employee setting/period |
| `employee_payroll_setting` | Setting payroll | employee, group, masked bank, tax status, base salary | employee/group |
| `payroll_period` | Periode payroll | group, dates, payment date, status | group/run |
| `payroll_run` | Proses payroll | period, number, timestamps, status, gross/deduction/net totals | period/results |
| `payroll_result` | Hasil pegawai | run, employee, gross, deduction, tax, net, status | run/employee |
| `payroll_result_line` | Detail komponen | result, component, qty, rate, amount, formula snapshot | result/component |
| `payslip` | Slip gaji | result, number, file, published/acknowledged | result/file |
| `performance_cycle` | Siklus kinerja | code, name, dates, status | goals/reviews |
| `performance_goal` | Sasaran | cycle, employee, title, weight, target/actual, status | cycle/employee |
| `performance_review` | Penilaian | cycle, employee, reviewer, score, comments, status | cycle/employees |
| `competency` | Kompetensi | code, name, category, level model | position/employee |
| `employee_competency` | Kompetensi pegawai | employee, competency, level, assessedAt, assessor | employee/competency |
| `training_course` | Pelatihan | code, name, provider, duration, certification | session |
| `training_session` | Sesi pelatihan | course, dates, location, capacity, status | course |
| `training_participant` | Peserta | session, employee, attendance, score, certificate file | session/employee |
| `recruitment_requisition` | Kebutuhan pegawai | entity, department, position, requested count, reason, status | org/position |
| `job_vacancy` | Lowongan | requisition, title, description, open/close dates, status | requisition |
| `applicant` | Pelamar | party, vacancy, application date, source, status | party/vacancy |
| `recruitment_stage` | Tahap seleksi | code, name, order | application |
| `applicant_stage_history` | Riwayat seleksi | applicant, stage, enteredAt, exitedAt, result | applicant/stage |

## L. Workflow, Notification, Integration, Offline Sync, Reporting

| Tabel | Tujuan | Kolom khusus | Relasi utama |
|---|---|---|---|
| `workflow_definition` | Definisi workflow | code, name, module, entity type, version, status | steps/transitions |
| `workflow_step` | Langkah | workflow, code, nameKey, sequence, type, assignee rule, SLA | workflow |
| `workflow_transition` | Transisi | workflow, from/to step, action, condition JSON | workflow/steps |
| `workflow_instance` | Instance | workflow, entity type/id, current step, status, timestamps | definition/step |
| `workflow_task` | Tugas approval | instance, step, assigned user/role, dueAt, status, actedAt | workflow/user |
| `workflow_action_log` | Aksi workflow | instance, task, action, actor, comment, occurredAt | instance/task |
| `notification_template` | Template | code, channel, locale, subject/body template, status | notification |
| `notification` | Notifikasi | template, recipient type/id, channel, payload, schedule/send, status | template |
| `notification_delivery` | Attempt delivery | notification, attempt, provider message ID, response, status | notification |
| `integration_endpoint` | Endpoint | code, name, base URL, auth type, secret reference, timeout, status | mapping/job |
| `integration_mapping` | Mapping | endpoint, entity type, local/remote field, transform rule | endpoint |
| `integration_job` | Job | endpoint, type, schedule, last/next run, status | endpoint/runs |
| `integration_run` | Eksekusi | job, timestamps, processed/success/failure counts, status | job |
| `webhook_subscription` | Webhook keluar | tenant, event type, URL, secret hash, status | delivery |
| `webhook_delivery` | Delivery | subscription, event, attempt, masked request/response, status | subscription |
| `api_client` | Client API | tenant, code, name, clientId, secret hash, scopes, expiry, status | tenant |
| `api_request_log` | Log API | client, requestId, method, path, HTTP status, duration, occurredAt | client |
| `sync_device` | Perangkat sync | POS device, schema version, last seen, status | device |
| `sync_outbox` | Outbox | event ID, entity type, operation, payload, sequence, status, createdAt | technical |
| `sync_inbox` | Inbox/dedupe | event ID, device, sequence, checksum, processing status, result | device |
| `sync_cursor` | Cursor delta | device, entity type, cursor, updatedAt | device |
| `sync_conflict` | Konflik | device, entity, local/server IDs/versions, type, status | device |
| `audit_event` | Audit event | request, actor, module/action, entity, result, metadata | row changes |
| `audit_row_change` | Audit row | event, schema/table, PK JSON, operation, old/new, changed columns | event |
| `report_definition` | Definisi laporan | code, nameKey, module, data source type, query definition JSON, status | columns/filters |
| `report_column` | Kolom laporan | report, field, labelKey, type, format, order | report |
| `report_filter` | Filter | report, field, labelKey, input type, operator whitelist | report |
| `report_schedule` | Jadwal | report, owner, cron, format, recipients, status | report/user |
| `dashboard_definition` | Dashboard | code, nameKey, module, layout JSON, status | widgets |
| `dashboard_widget` | Widget | dashboard, type, titleKey, data definition, position | dashboard |
| `saved_view` | Saved view | user, resource, name, filter/columns/sort JSON, default flag | user |

# LAMPIRAN V5-B — KATALOG SEED MASTER MINIMAL 10 RECORD

Contoh minimum:

| Master | Contoh 10 record |
|---|---|
| `Locale` | id, en, ar, zh-CN, ms, th, vi, ja, ko, fr; hanya locale yang diset aktif muncul di UI |
| `OutletType` | Store, Outlet, Cafe, Restaurant, Kiosk, Canteen, Office, Factory, Central Kitchen, Other |
| `Uom` | pcs, box, pack, kg, gram, litre, ml, meter, set, service |
| `ProductCategory` | Food, Beverage, Raw Material, Packaging, Finished Goods, Service, Merchandise, Spare Part, Office Supply, Other |
| `PaymentMethod` | Cash, Bank Transfer, Debit Card, Credit Card, QRIS, Virtual Account, E-Wallet, Deposit, Credit, Other |
| `Department` | Management, Finance, Accounting, Sales, Purchasing, Warehouse, Production, Quality, HR, IT |
| `JobPosition` | Director, Manager, Supervisor, Staff, Cashier, Warehouse Staff, Buyer, Accountant, HR Staff, System Admin |
| `WarehouseType` | Central, Outlet, Transit, Raw Material, Finished Goods, Quarantine, Damaged, Consignment, Production, Other |
| `VehicleType` | Motorcycle, Car, Van, Pickup, Light Truck, Medium Truck, Heavy Truck, Refrigerated Truck, Forklift, Other |
| `LeaveType` | Annual, Sick, Maternity, Paternity, Marriage, Bereavement, Unpaid, Study, Religious, Other |
| `NewsCategory` | Product, Company, Update, Promotion, Education, Technology, Event, Partnership, Security, Other |
| `FaqCategory` | Registration, Demo, Package, Payment, POS, Inventory, Accounting, HR, Security, Support |

Ketentuan:

1. Buat 10 produk, 10 pemasok, 10 pelanggan, 10 kategori, 10 departemen, 10 jabatan,
   10 UOM, 10 metode pembayaran, dan master lain yang relevan.
2. Semua sample memakai `isSample=true`.
3. Seed transaksi contoh terpisah melalui `includeStarterTransactions`.
4. Jangan membuat jurnal posted, invoice resmi, atau saldo stok nyata hanya untuk memenuhi angka 10.
5. Buat laporan verifikasi:

```text
resourceCode
requiredMinimum
activeCount
sampleCount
status
missingCodes
```

# LAMPIRAN V5-C — HARD DELETE REFERENCE POLICY

```text
NEVER_PURGE
PURGE_IF_UNREFERENCED
PURGE_SAMPLE_ONLY
PURGE_AFTER_RETENTION
PLATFORM_SUPER_ADMIN_ONLY
```

| Tabel | Policy |
|---|---|
| `stock_movement` | NEVER_PURGE |
| `journal_entry` posted | NEVER_PURGE |
| `payment_callback_event` | NEVER_PURGE |
| `audit_event` | PURGE_AFTER_RETENTION melalui archive |
| `product` | PURGE_IF_UNREFERENCED |
| `product_category` | PURGE_IF_UNREFERENCED |
| sample supplier/customer | PURGE_SAMPLE_ONLY |
| `platform_user` | PLATFORM_SUPER_ADMIN_ONLY; anonymize lebih diutamakan |
| CMS draft version | PURGE_IF_UNREFERENCED |
| media asset | PURGE_IF_UNREFERENCED dan object-storage check |

# LAMPIRAN V5-D — PERINTAH AWAL CODEX / CLAUDE

```text
Baca MASTER_PROMPT_CODEX_CLAUDE_EBISNIS_FULLSTACK_V5_FULL_ERP_DATA_DICTIONARY_CMS_SEED.md
sampai selesai.

Gunakan C:\opt\eBisnis sebagai working copy SVN.
Baca seluruh docs/input, khususnya ebisnis.jsp dan source Esmartlink.

Prioritas Versi 5:
1. implementasikan lifecycle master;
2. buat MasterSeedRegistry;
3. seed minimal 10 record per master relevan;
4. buat seed verify/repair/cleanup;
5. implementasikan Prisma model dan migration berdasarkan kamus data;
6. generate data dictionary, ERD, dan index catalog;
7. bangun website publik `/`;
8. bangun CMS page/news/announcement/FAQ/media;
9. pastikan konten homepage dapat diubah tanpa perubahan source;
10. lanjutkan package pricing, subscription, Esmartlink, dan vertical slice ERP;
11. jalankan migration, seed verification, lint, tests, Playwright E2E, build,
    dan localhost smoke test.

Jangan berhenti pada dokumentasi atau skeleton.
```
