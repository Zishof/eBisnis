# Handover Migrasi eBisnis ke AIS Java/JSP di `/ebisnis/*`

Tanggal: **15 Agustus 2026 (Asia/Jakarta)**  
Target workspace AIS: `C:\opt\AIS\ais\src\main`  
Target URL: seluruh pengalaman eBisnis berada di belakang servlet `/ebisnis/*`

## 1. Keputusan Arsitektur yang Direkomendasikan

Gunakan pola **front controller + route registry + JSP di bawah `WEB-INF`**.
Satu servlet menerima `/ebisnis/*`, tetapi logika bisnis tidak ditumpuk di satu
kelas. Servlet hanya menangani normalisasi path, autentikasi, tenant context,
otorisasi, request ID, dan dispatch ke controller/service yang tepat.

Struktur target yang direkomendasikan:

```text
src/ais/action/servlet/EBisnisFrontController.java
src/ais/action/servlet/ebisnis/*Controller.java
src/ais/common/ebisnis/EBisnisRouteRegistry.java
src/ais/common/ebisnis/EBisnisTenantResolver.java
src/ais/common/ebisnis/EBisnisIdentityAdapter.java
src/ais/common/ebisnis/EBisnisPermissionService.java
src/ais/common/ebisnis/EBisnisAuditService.java
src/ais/common/ebisnis/EBisnisCsrf.java
src/ais/service/ebisnis/*Service.java
webapp/WEB-INF/ebisnis/layout/*
webapp/WEB-INF/ebisnis/public/*
webapp/WEB-INF/ebisnis/app/*
webapp/WEB-INF/ebisnis/platform/*
webapp/ebisnis-assets/*
```

Contoh mapping konseptual di `web.xml`:

```xml
<servlet>
  <servlet-name>EBisnisFrontController</servlet-name>
  <servlet-class>ais.action.servlet.EBisnisFrontController</servlet-class>
</servlet>
<servlet-mapping>
  <servlet-name>EBisnisFrontController</servlet-name>
  <url-pattern>/ebisnis/*</url-pattern>
</servlet-mapping>
```

Servlet membaca `request.getPathInfo()`, melakukan canonicalization, menolak
path traversal/encoded separator, mencocokkan route exact/parameterized dari
registry, lalu forward ke JSP di `WEB-INF`. Path yang tidak dikenal harus 404,
bukan jatuh ke dashboard generik.

## 2. Kontrak Namespace Target

| Target AIS | Fungsi |
| --- | --- |
| `/ebisnis/` | landing publik sesuai host |
| `/ebisnis/harga`, `/berita/*`, `/kontak`, `/tentang` | website/CMS publik |
| `/ebisnis/dokumen/*` | presentasi, proposal, PKS, penawaran |
| `/ebisnis/auth/*` | masuk, daftar, keluar, refresh/pemulihan akun |
| `/ebisnis/demo/*` | provisioning dan masuk sandbox demo |
| `/ebisnis/app/*` | portal tenant umum |
| `/ebisnis/inventory/*` | Sales dan Inventory 48 layar |
| `/ebisnis/pos/*` | POS umum |
| `/ebisnis/apotik/*` | POS Apotik/farmasi |
| `/ebisnis/emedik/*` | modul fasilitas kesehatan |
| `/ebisnis/pesantren/*` | portal dan operasional pesantren |
| `/ebisnis/eschool/*` | modul sekolah |
| `/ebisnis/ecampus/*` | modul kampus setelah gap diselesaikan |
| `/ebisnis/ekoperasi/*` | situs dan portal koperasi |
| `/ebisnis/belanja/*` | marketplace/storefront |
| `/ebisnis/platform/*` | Platform Super Admin |
| `/ebisnis/api/v1/*` | JSON API untuk Web dan klien Flutter |
| `/ebisnis/assets/*` | CSS, JavaScript, font, icon dan image versioned |
| `/ebisnis/downloads/*` | APK/installer/manual yang memang publik |

Gunakan `request.getContextPath()` saat membangun URL. Jangan hard-code `/ais`
atau root `/`, karena nama context Tomcat dapat berubah.

## 3. Kondisi AIS yang Sudah Ada

Audit read-only pada 15 Agustus 2026 menemukan fondasi berikut:

- Tomcat 9, descriptor Servlet 2.5, Java 8, JSP, Spring Security, ZK, Axis,
  Jersey, Hibernate, dan PostgreSQL;
- filter `ErrorAuditFilter`, `springSecurityFilterChain`, dan `FilterJSP`
  terpasang pada `/*`;
- servlet `ApiEBisnis` pada `/Api_eBisnis`;
- servlet `EbisnisPublicServlet` pada `/EbisnisPublic`;
- `PendaftaranTenantServlet` pada `/pendaftaran`;
- `ApiEBisnis extends PosApi` dan meneruskan aksi `si_*` ke
  `SalesInventoryApiDispatcher`;
- helper Sales/Inventory untuk master, stok, harga, purchasing, payable,
  receivable, trip/custody, finance, reversal, serta import DBF;
- `EbisnisMenuKatalog` dan JSON menu/CRUD per role;
- `WEB-INF/baru/modul/inventory` berisi 51 file, termasuk index, CSS/JS, dan
  padanan 48 layar JSP;
- model Hibernate inventory/koperasi/apotik sudah cukup banyak.

Artinya migrasi bukan greenfield dan tidak boleh membuat implementasi kedua yang
tidak mengenali pekerjaan AIS tersebut. Fase pertama adalah menginventarisasi,
menguji, dan mengonsolidasikan fondasi yang ada.

## 4. Peringatan Kondisi Worktree AIS

Pada waktu audit, Git root AIS terdeteksi di:

```text
C:\opt\AIS\ais\src\main
```

Branch `feat/new-ui-rbac-role-user` tertinggal tiga commit dari remote dan
worktree memiliki sangat banyak file modified/deleted/untracked. Terlihat juga
duplikasi path:

- tracked source: `src/ais` dan `webapp` relatif terhadap Git root;
- direktori `java/` dan `AIS/` muncul untracked;
- Eclipse `.classpath` di level proyek menunjuk `src/main/java`.

Jangan melakukan reset, checkout paksa, clean, mass-copy, atau commit campuran.
Sebelum migrasi:

1. identifikasi pemilik seluruh perubahan AIS;
2. backup/worktree terpisah atau commit perubahan yang memang valid;
3. tentukan satu source root dan satu web root yang benar-benar dipakai build;
4. pastikan branch disinkronkan tanpa membuang perubahan;
5. verifikasi hasil deploy menggunakan bytecode/JSP dari root yang dipilih.

Dokumen ini sengaja disimpan di repository eBisnis, bukan ditulis ke worktree AIS
yang sedang kotor.

## 5. Strategi Migrasi: Strangler, Bukan Big-Bang Copy

### Fase A — Bekukan kontrak

- Simpan daftar route Web, OpenAPI, permission, tabel, migration, output
  print/export, dan evidence UAT.
- Tetapkan response JSON, error code, idempotency key, pagination, tanggal,
  timezone, mata uang, dan status enum.
- Buat matriks `route lama -> /ebisnis/* -> JSP/controller/service -> test`.

### Fase B — Pasang shell `/ebisnis/*`

- Tambahkan front controller dan route registry.
- Buat layout publik, tenant, dan platform yang terpisah.
- Pastikan semua request melewati error audit dan Spring Security yang benar.
- Tambahkan CSP, CSRF, cache policy, request ID, dan halaman 403/404/500.
- Pertahankan endpoint lama sebagai redirect/adapter sementara, bukan duplikasi
  logika bisnis.

### Fase C — Identity dan tenant bridge

- Petakan user/session AIS ke identity eBisnis secara eksplisit.
- Resolve tenant dari host/session dan registry server-side.
- Jangan menerima schema name dari request.
- Buat role/permission mapping dan deny-by-default untuk route/aksi baru.
- Pisahkan platform staff, tenant operator, customer/member, dan user publik.

### Fase D — Pindahkan website publik

Urutan risiko rendah:

1. landing, CMS, berita, kontak, legal;
2. harga dan dokumen komersial;
3. host-based branding;
4. login/daftar/demo;
5. situs tenant, koperasi, pondok, dan storefront.

Setiap halaman harus mempertahankan title/meta, canonical URL, asset, mobile
layout, accessibility, form validation, dan analytics/observability yang relevan.

### Fase E — Pindahkan portal dan vertical slice

Urutan yang disarankan:

1. shell tenant, dashboard, user, role, permission, audit;
2. master data bersama;
3. Sales/Inventory 48 layar;
4. POS/POS Apotik;
5. marketplace/storefront;
6. eKoperasi;
7. ePesantren/eSchool;
8. eMedik dan integrasi eksternal;
9. Platform Super Admin.

Pindahkan satu vertical slice sampai database, API, JSP, permission, audit,
print/export, test, dan UAT selesai. Jangan membuat 100 JSP skeleton sekaligus.

### Fase F — Cutover dan decommission

- Jalankan old/new berdampingan pada data/snapshot yang sama.
- Rekonsiliasi hasil transaksi dan laporan.
- Gunakan feature flag per tenant/module.
- Siapkan rollback route dan database-compatible rollback.
- Alihkan traffic bertahap.
- Hapus React/NestJS hanya setelah tidak ada consumer, callback, Flutter, job,
  atau tenant yang masih membutuhkannya.

## 6. Database dan Service Boundary

Jangan langsung melebur semua tabel eBisnis ke tabel AIS. Pilihan paling aman
untuk fase awal:

- AIS menggunakan DataSource PostgreSQL khusus eBisnis;
- schema `platform`, `platform__audit`, `<tenant>`, dan `<tenant>__audit` tetap;
- Java service membungkus query/transaksi dengan tenant context terverifikasi;
- migration eBisnis tetap dijalankan berurutan sebelum startup/cutover;
- setelah parity terbukti, baru putuskan konsolidasi model secara terkontrol.

Jika Hibernate dipakai, jangan memakai global mutable `search_path` lintas
request pada connection pool. Set schema dalam transaksi/connection yang
terisolasi, reset sebelum dikembalikan ke pool, dan selalu validasi terhadap
tenant registry.

## 7. Kontrak API untuk Flutter

Windows dan Android tidak dapat memakai halaman JSP sebagai pengganti JSON API.
Sediakan `/ebisnis/api/v1/*` dengan kontrak yang kompatibel atau pertahankan
NestJS di belakang adapter sampai port Java lengkap.

Wajib dipertahankan:

- response envelope dan HTTP status;
- access/refresh lifecycle atau mekanisme compatibility token;
- idempotency key;
- cursor/outbox/retry/conflict semantics;
- version/update endpoints;
- file download dan checksum;
- pagination/filter/sort;
- error code yang dapat diproses klien, bukan HTML error page.

Servlet API harus mengirim `application/json`, `Cache-Control` yang benar, dan
tidak melakukan redirect login HTML untuk request API.

## 8. Compatibility Route AIS yang Ada

Route lama dapat dijaga sementara:

| Lama | Target baru sementara |
| --- | --- |
| `/Api_eBisnis` | adapter ke `/ebisnis/api/v1/*` atau dispatcher lama |
| `/EbisnisPublic` | redirect 302/308 sesuai method ke `/ebisnis/*` |
| `/pendaftaran` | `/ebisnis/auth/daftar` |
| JSP Inventory lama | registry `/ebisnis/inventory/{screen}` |

Jangan mengubah POST menjadi redirect yang kehilangan body. Untuk command lama,
gunakan server-side adapter sampai semua client berpindah.

## 9. Definition of Done per Route

Satu route hanya boleh dinyatakan selesai bila:

- tampilan desktop/mobile dan semua tombol/field/filter/kolom tersedia;
- data berasal dari service nyata, bukan mock/placeholder;
- autentikasi, tenant isolation, RBAC, CSRF, validasi, dan audit lulus;
- transaksi atomik, idempotency, reversal, serta concurrency guard lulus;
- print/PDF/Excel/reprint sesuai kontrak bila relevan;
- offline/retry/conflict lulus untuk consumer yang relevan;
- test unit, integration DB, servlet, browser, dan regression lulus;
- hasil direkonsiliasi dengan eBisnis lama;
- evidence dan keputusan UAT dicatat per surface.

## 10. Quality Gate AIS yang Harus Ditambahkan

- compile Java 8/Tomcat 9 dari source root resmi;
- test route registry: exact match, parameter, slash, encoding, traversal;
- test filter chain dan role matrix;
- test CSRF dan session fixation;
- test tenant escape/schema injection;
- test JSON contract untuk Flutter;
- test transaksi/database dan rollback;
- browser test seluruh route publik dan tenant;
- print/export snapshot test;
- migration checksum dan repeatability check;
- smoke test WAR hasil build, bukan hanya source di Eclipse.

## 11. Checklist Mulai Sesi Berikutnya

```powershell
# eBisnis — sumber kontrak
git -C C:\opt\Codex-Worspace\eBisnis fetch origin
git -C C:\opt\Codex-Worspace\eBisnis status -sb
git -C C:\opt\Codex-Worspace\eBisnis log -10 --oneline

# AIS — hanya inspeksi sampai worktree dipastikan aman
git -C C:\opt\AIS\ais\src\main status -sb
git -C C:\opt\AIS\ais\src\main remote -v
git -C C:\opt\AIS\ais\src\main log -10 --oneline --decorate
```

Kemudian:

1. tentukan commit/branch AIS yang menjadi baseline resmi;
2. selamatkan perubahan AIS yang belum dikomit;
3. audit existing `ApiEBisnis`, dispatcher `si_*`, 48 JSP Inventory, dan RBAC;
4. buat route matrix `/ebisnis/*`;
5. implementasikan shell/front controller beserta test;
6. pindahkan vertical slice pertama sampai UAT sebelum melanjutkan.

## 12. Larangan

- jangan rewrite/big-bang copy React menjadi JSP tanpa kontrak;
- jangan reset/clean worktree AIS yang kotor;
- jangan drop/reset database atau edit migration applied;
- jangan menyalin `.env`, password, token, keystore, atau certificate ke Git;
- jangan mengambil schema tenant dari request;
- jangan menaruh SQL dan mutasi bisnis langsung di JSP;
- jangan menjadikan hide/show tombol sebagai satu-satunya otorisasi;
- jangan memutus API Flutter sebelum compatibility test lulus;
- jangan menyatakan selesai berdasarkan jumlah halaman yang dapat dibuka.

## 13. Sumber Kebenaran

Urutan sumber kebenaran selama migrasi:

1. transaksi/data dan aturan bisnis terverifikasi;
2. source serta migration eBisnis `origin/main`;
3. OpenAPI, test, parity registry, evidence, dan handover aktif;
4. source AIS pada branch baseline yang sudah disepakati;
5. hasil UAT dan rekonsiliasi;
6. screenshot/mockup hanya sebagai referensi visual.

Dokumen penjelasan ekosistem yang mendampingi handover ini:
[`2026-08-15-penjelasan-lengkap-website-ebisnis.md`](2026-08-15-penjelasan-lengkap-website-ebisnis.md).
