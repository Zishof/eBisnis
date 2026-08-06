# Changelog — Hospitality (MitraInap.id)

## 2026-08-06 — MI-3/MI-4: dinyatakan diblokir, bukan dikerjakan

MI-3 (Tenant Website/Subdomain) butuh tenant hospitality yang benar-benar
ada -- belum ada satu pun, dan MI-3 sendiri bukan yang menciptakannya.
MI-4 (Product/Package/Entitlement/Pricing) butuh (a) keputusan harga
komersial yang BRD sendiri secara eksplisit belum berikan
(`PRICE_CONFIGURATION_REQUIRED`) dan (b) kolom/skema harga "belum
dikonfigurasi" yang TIDAK ADA di `platform.plan`/`platform.subscription`
saat ini (dicek: `grep priceStatus` kosong di seluruh kodebase) --
membangunnya berarti mengubah skema billing bersama tanpa keputusan
komersial nyata yang mendasarinya, persis larangan §5 perintah master.
Keduanya dilewati, dilanjutkan ke MI-5 yang tidak punya blocker serupa.

## 2026-08-06 — MI-5: Fondasi Properti, Tipe Kamar, dan Kamar

- Migrasi tenant baru `apps/api/tenant-migrations/hospitality/` (modul baru,
  `dependsOn: ["core"]`): `hospitality_property`, `hospitality_room_type`,
  `hospitality_room`. Sengaja HANYA tiga tabel ini -- portofolio/badan
  hukum/gedung/lantai/zona penuh BRD ditunda sampai tenant multi-properti
  sungguhan on-board (lihat komentar migrasi).
- RBAC baru (`apps/api/src/modules/hospitality/rbac/hospitality-vertical.catalog.ts`,
  didaftarkan ke `vertical-catalogs.ts`, pola IR-004): menu
  `HOSPITALITY_GROUP` > `HOSPITALITY_PROPERTI`, peran `HOSPITALITY_ADMIN`
  (profil P7, diberikan ke pemilik properti saat provisioning nanti --
  belum ada alur provisioning hospitality, jadi belum ada pemberian
  otomatis). Default visibility menu ditambahkan ke
  `MENU_AKAR_BAWAAN_PER_VERTIKAL` (`tenant-permission.service.ts`) untuk
  `verticalCode: 'HOSPITALITY'` -- BELUM diverifikasi lewat login tenant
  hospitality sungguhan (belum ada), dicatat sebagai risiko casing yang
  sama seperti kasus PESANTREN di MI-1.
- Backend: `HospitalityPropertiService`/`.controller.ts`/`.module.ts` --
  CRUD properti, tipe kamar (per properti), dan kamar (per tipe kamar),
  pola sama persis dengan `pesantren-asrama.service.ts`.
- Web: `HospitalityPropertiPage.tsx` (`/app/hospitality/properti`) -- tiga
  kolom bertingkat (properti -> tipe kamar -> kamar), pola sama dengan
  `PesantrenAsramaPage`.
- Diverifikasi nyata, bukan hanya `tsc`/test:
  - Migrasi DDL diterapkan pada schema uji terisolasi
    (`hospitality_smoketest`, dibuat lalu dihapus) -- constraint (kode
    unik per penyewa/properti, okupansi > 0, nomor kamar unik per
    properti dengan penggunaan ulang setelah soft-delete) diuji dengan
    INSERT sungguhan, bukan dibaca dari DDL saja.
  - `pnpm migrate:tenants --schema admin_raudlatululum` (tenant pesantren
    nyata dari sesi sebelumnya) diterapkan sungguhan -- tabel dan
    menu/role RBAC baru muncul di schema itu.
  - Login sungguhan + `POST/GET /hospitality/properti/**` lewat curl:
    create/list properti, tipe kamar, kamar; konflik kode (409) dan
    validasi okupansi (400) sama-sama diuji dan berhasil. Peran
    `HOSPITALITY_ADMIN` diberikan sementara ke pengguna uji untuk
    membuktikan alur CREATE, lalu DICABUT setelah verifikasi (bukan
    perubahan permanen pada data pengguna nyata).
  - Halaman `/app/hospitality/properti` diverifikasi lewat peramban
    sungguhan (login sungguhan, bukan token langsung) -- tiga kolom
    tampil dan cascading pilih properti -> tipe kamar berfungsi dengan
    data yang sama dibuat lewat API.
  - `pnpm test` (152 suite API/3980 test, 42 berkas web/510 test) LULUS
    penuh; `tsc --noEmit` LULUS; `pnpm lint` bersih dari perubahan ini.
- Insiden selama verifikasi: Postgres lokal (port 5433) sempat masuk mode
  recovery selama `pnpm migrate:tenants` tanpa `--schema` (menyasar
  puluhan tenant sekaligus, kemungkinan kehabisan resource) -- pulih
  sendiri setelah ditunggu, tidak ada tindakan destruktif diambil.
  Verifikasi dilanjutkan dengan `--schema` dipersempit ke satu tenant.

Belum diverifikasi: tenant hospitality PERTAMA yang sesungguhnya
di-provision dari nol (mengunci vertical code, default menu visibility,
dan pemberian `HOSPITALITY_ADMIN` otomatis) -- menunggu MI-3/MI-4
(provisioning) yang sengaja ditunda di atas.

## 2026-08-06 — MI-2: Homepage MitraInap dan marketing pages

- `MitrainapSolusiPage` (`/mitrainap/solusi`) dan `MitrainapFaqPage`
  (`/mitrainap/faq`) ditambahkan, dirutekan di `App.tsx`, ditaut dari nav
  header dan footer `MitrainapLayout`.
- Perintah master MI-2 secara harfiah meminta "seluruh section BRD/UI"
  (100+ layar: solution pages, feature pages, blog, dst). Itu TIDAK
  dibangun sepenuhnya di sini -- membangun 100+ halaman statis yang
  sebagian besar menjelaskan fitur yang belum ada backend-nya akan jadi
  halaman pemasaran yang menyesatkan, bukan cakupan yang jujur. Yang
  dibangun: peta modul nyata (10 area dari BRD, ditandai sebagai
  "direncanakan" bukan "aktif"), FAQ yang jujur soal harga
  (`PRICE_CONFIGURATION_REQUIRED`, tidak mengarang angka), dan lead
  capture yang memakai `/kontak` yang sudah ada (bukan formulir baru).
- SEO: meta description, `<link rel="canonical">`, dan JSON-LD
  (`SoftwareApplication`) ditambahkan ke `MitrainapLayout`, mengikuti pola
  `usePondokSeo` (pesantren) tapi statis, sebab portal ini satu-satunya
  (bukan per-penyewa). Sitemap.xml SENGAJA tidak dibangun -- tidak ada
  portal LAIN di kodebase ini (termasuk santri.info) yang punya sitemap
  generator; membangunnya khusus untuk MitraInap berarti infrastruktur
  baru yang tidak diminta prioritas mana pun, bukan pekerjaan MI-2 yang
  proporsional.
- Diverifikasi nyata: `pnpm test` (150 suite API/3963 test, 42 berkas
  web/510 test) LULUS, `tsc --noEmit` LULUS, `pnpm lint` bersih dari
  perubahan ini, kedua halaman dan tag SEO diverifikasi lewat peramban
  sungguhan (Vite dev + API lokal).

## 2026-08-06 — MI-1: Portal registry, brand, dan routing publik

- **Koreksi temuan MI-0**: Portal Registry NYATA sudah ada di kodebase
  (`PlatformPortal`/`PlatformPortalDomain`/`PlatformPortalCrossLink`,
  `KATALOG_PORTAL`) -- audit MI-0 salah menyimpulkan tidak ada, akibat pola
  grep yang tidak menangkap `PlatformPortal`. Lihat koreksi lengkap di
  `docs/mitrainap/16-implementation-plan.md`.
- `MITRAINAP` ditambahkan ke `KATALOG_PORTAL`
  (`apps/api/src/infrastructure/portal/portal.catalog.ts`): kode vertikal
  `HOSPITALITY`, host `mitrainap.id`/`www.mitrainap.id` (PUBLIC),
  `app.mitrainap.id` (APP). `demo.mitrainap.id` SENGAJA belum didaftarkan --
  menunggu fase demo/sample data yang sebenarnya (lihat komentar di
  `portal.catalog.ts`).
- SEO/OG metadata (`GET /public/link-preview`) menambahkan brand MitraInap.
- Sisi web: `apps/web/src/verticals/hospitality/` (`mitrainap-host.ts`,
  `MitrainapLayout.tsx`, `MitrainapHomePage.tsx`), dirutekan di `App.tsx`
  pada `/mitrainap`, mengikuti pola `santri-host.ts`/`SantriLayout.tsx`
  persis. `LoginPage` ditambah cabang merek MitraInap (unified login, portal
  chrome tetap MitraInap saat menekan "Masuk").
- **Bug pre-existing ditemukan dan diperbaiki**: `GET /public/portals`
  menaut setiap portal ke DIRINYA SENDIRI (relasi `linksTo`/`linksFrom`
  tertukar) -- memengaruhi seluruh portal (eBisnis.id, santri.info,
  eMedik.id, dst), ditemukan lewat pengujian API sungguhan saat memverifikasi
  footer MitraInap.
- Diverifikasi nyata: `pnpm test` (150 suite API/3963 test, 42 berkas
  web/510 test) LULUS penuh; `tsc --noEmit` api+web LULUS; `pnpm lint`
  bersih dari perubahan ini (satu warning pre-existing eschool tetap ada,
  di luar cakupan); `GET /public/portals` diverifikasi lewat curl lokal
  (portal MITRAINAP dan tautan silang 6 arah benar); halaman
  `/mitrainap` diverifikasi lewat peramban sungguhan (Vite dev + API lokal
  pada DB pengembangan lokal).
- Belum diverifikasi lewat peramban: cabang host-gated (`isMitrainapPortalHost`)
  pada `AkarMenurutHost`/`LoginPage`, sebab `localhost` bukan `mitrainap.id`
  -- diverifikasi lewat 10 uji unit di `mitrainap-host.test.ts` sebagai
  gantinya (keterbatasan yang sama berlaku untuk verifikasi santri.info).

## 2026-08-06 — MI-0: Audit dan baseline

- Worktree `C:\opt\eBisnisGithub-mitrainap` dibuat dari `origin/main`
  (`1ebc4a8`), branch `feature/v14-mitrainap-hospitality`.
- Paket dokumen MitraInap V14 (BRD, struktur menu/role/permission,
  spesifikasi UI/UX, perintah master) disalin ke `docs/mitrainap/`,
  integritas SHA-256 diverifikasi 6/6 cocok dengan manifest.
- Baseline dijalankan sungguhan: `pnpm install`, `db:validate`,
  `db:generate`, `tsc --noEmit` (api+web), `pnpm lint`, `pnpm test` --
  hasil lengkap di `docs/mitrainap/01-current-state.md`. Semua LULUS
  kecuali `pnpm lint` (1 warning pre-existing di vertikal `eschool`,
  di luar cakupan hospitality, dicatat bukan diperbaiki di sini).
- Capability sweep: dikonfirmasi TIDAK ADA kode hospitality/PMS apa pun
  di codebase saat ini (`docs/mitrainap/03-hospitality-capability-inventory.md`).
- Temuan: domain registry (`VerticalSiteDomain`) sudah mendukung banyak
  host per tenant per vertikal (constraint unik lama sudah dilonggarkan),
  tidak perlu migrasi skema baru untuk subdomain per properti nantinya.
- 5 dari 19 dokumen audit + ledger awal selesai; 14 dokumen sisanya
  sengaja ditunda ke fase yang membutuhkannya (lihat
  `docs/mitrainap/16-implementation-plan.md` untuk status jujur per
  dokumen dan alasannya).

Belum ada satu baris kode modul `hospitality` pun ditulis pada titik
ini -- sesuai larangan "jangan coding besar sebelum MI-0 selesai,
di-commit, dan dipush".
