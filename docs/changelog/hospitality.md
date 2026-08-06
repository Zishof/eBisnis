# Changelog — Hospitality (MitraInap.id)

## 2026-08-06 — MI-7: Guest Identity, CRM, Consent, Privacy

- Migrasi tenant baru `20260806T120000__hospitality__guest_crm.sql`:
  - `hospitality_guest` -- profil tunggal tamu (identitas, kontak, alamat,
    preferensi bebas teks, consent pemasaran, do-not-rent, `merged_into_id`
    untuk penggabungan). Kode `GST-000001` dst dibuat otomatis lewat
    `SEQUENCE` per skema tenant.
  - `hospitality_guest_privacy_request` -- catatan permintaan ekspor/
    penghapusan data dan status penyelesaiannya.
  - Deteksi duplikat KERAS: indeks unik parsial pada
    `(identifier_type, identifier_number)` -- satu nomor identitas hanya
    satu profil aktif. Kemiripan nama/telepon tanpa nomor identitas yang
    sama TIDAK ditegakkan basis data (tidak bisa) -- ditangani
    `cariKemiripan()` di sisi layanan sebagai anjuran, bukan penolakan.
  - Sengaja BELUM ADA: companion/relationship dan tautan perusahaan/travel
    agent -- baru berguna begitu reservasi grup/korporat (MI-18) ada
    tempat memakainya.
- Backend: `HospitalityGuestService`/`.controller.ts` -- CRUD tamu,
  `cariKemiripan()`, `aturConsent()`, `aturDoNotRent()` (alasan wajib saat
  diaktifkan, ditegakkan CHECK constraint DAN validasi layanan),
  `gabungkan()` (soft-delete sumber + `merged_into_id`, status do-not-rent
  digabung dengan OR supaya larangan keamanan tidak hilang lewat
  penggabungan administratif), `ajukanPermintaanPrivasi()` +
  `prosesPermintaanPrivasi()` (ERASURE+COMPLETED benar-benar
  menganonimkan nama/kontak/identitas, TAPI mempertahankan status dan
  alasan do-not-rent -- tamu tidak boleh "menghapus jalan keluar" dari
  larangan menginap lewat hak penghapusan data; alasan didokumentasikan
  di komentar kode).
- Web: `HospitalityTamuPage` (baru, `/app/hospitality/tamu`) -- daftar +
  pencarian, formulir tambah dengan peringatan kemiripan real-time,
  panel detail (toggle consent, toggle do-not-rent, penggabungan,
  riwayat + aksi permintaan privasi).
- RBAC: menu `HOSPITALITY_TAMU` ditambahkan sebagai anak
  `HOSPITALITY_GROUP` -- otomatis terwarisi peran `HOSPITALITY_ADMIN`
  yang sudah ada (P7 pada grup), tidak perlu menyunting definisi peran.
- Diverifikasi NYATA (bukan hanya `tsc`/test) terhadap Postgres lokal dan
  tenant nyata (`admin_raudlatululum` via `migrate:tenants --schema`):
  - Duplikat nomor identitas ditolak (409); `do_not_rent` tanpa alasan
    ditolak (400 di API, CHECK constraint di basis data); nomor identitas
    kosong TIDAK ikut diperiksa unik (anak tanpa identitas boleh
    berulang).
  - Alur lengkap consent -> do-not-rent -> ajukan ERASURE -> proses
    COMPLETED -> detail tamu, membuktikan anonimisasi benar-benar terjadi
    (nama jadi "Tamu Dihapus", kontak/identitas NULL) SEKALIGUS do-not-rent
    dan alasannya tetap ada.
  - Penggabungan dua profil: profil sumber menjadi 404 (soft-deleted),
    tidak lagi muncul di daftar/pencarian, `merged_into_id` terisi.
  - Halaman `/app/hospitality/tamu` diverifikasi peramban sungguhan
    dengan login nyata -- daftar, badge Do-Not-Rent, dan panel detail
    (identitas teranonimkan, riwayat permintaan privasi) menampilkan data
    API yang sama persis dengan hasil curl di atas.
- `pnpm test` (154 suite API/4008 test, 42 berkas web/510 test) LULUS;
  satu kegagalan flaky tak terkait (`him-pages.spec.tsx`, timeout 5000ms
  di bawah beban paralel penuh, vertikal eMedik) dikonfirmasi BUKAN
  regresi -- lulus 24/24 saat dijalankan sendiri, dan lulus lagi saat
  suite penuh diulang. `tsc --noEmit` LULUS, `pnpm lint` bersih dari
  perubahan ini.

## 2026-08-06 — MI-6: Room Inventory dan Availability

- Migrasi tenant baru `20260806T090000__hospitality__inventory_availability.sql`:
  - `hospitality_room_block` -- ledger PENGECUALIAN ketersediaan per kamar
    per malam (BLOCKED/OUT_OF_ORDER/OUT_OF_SERVICE). Hanya malam yang TIDAK
    tersedia disimpan sebagai baris -- ketiadaan baris berarti tersedia.
    `UNIQUE (room_id, stay_date) WHERE deleted_at IS NULL` adalah penjaga
    kondisi pacu.
  - `overbooking_limit` pada `hospitality_room_type` -- kebijakan alotmen;
    penegakannya sendiri (menolak reservasi melebihi limit) menyusul MI-8.
  - `features` (TEXT[]) pada `hospitality_room` -- tag bebas
    aksesibilitas/merokok/pemandangan, bukan tabel katalog (BRD belum
    menetapkan daftar baku).
- Backend: `HospitalityRoomBlockService`/`.controller.ts` --
  `POST .../kamar/:id/blok` (upsert per malam dalam satu transaksi lewat
  `INSERT ... ON CONFLICT ... DO UPDATE`), `POST .../buka-blokir`,
  `GET .../tipe-kamar/:id/ketersediaan` (dihitung langsung dari baris
  blokir yang ada, bukan penghitung tersimpan -- tidak perlu rekonsiliasi
  terpisah). `hospitality-properti.service.ts` diperluas menerima
  `features` saat mencatat kamar.
- Web: `HospitalityPropertiPage` diperluas -- kolom Fitur pada tabel
  kamar, tombol "Blokir" per kamar (modal rentang tanggal + status +
  alasan), dan panel "Ketersediaan" (pemilih tanggal + tabel per malam)
  untuk tipe kamar yang dipilih.
- **Kondisi pacu dan rekonsiliasi diverifikasi NYATA** (perintah master
  §MI-6 mewajibkan ini) -- bukan uji Jest tiruan, sebab `pnpm test` di
  kodebase ini TIDAK PERNAH menyentuh basis data sesungguhnya (diperiksa:
  seluruh spec lain memakai `TenantConnectionService` tiruan). Verifikasi
  dilakukan lewat skrip nyata terhadap Postgres lokal:
  - 10 permintaan blokir BERSAMAAN (`Promise.all`, masing-masing koneksi
    dan transaksi terpisah, meniru 10 permintaan HTTP paralel) untuk
    kamar+tanggal yang SAMA menghasilkan TEPAT SATU baris ledger (bukan
    10, bukan gagal) -- constraint unik + `ON CONFLICT DO UPDATE`
    terbukti benar di bawah beban konkuren sungguhan.
  - Ketersediaan dihitung ulang dari status LIVE, bukan penghitung
    tersimpan: memblokir 1 kamar menurunkan `tersedia` seketika,
    menghapus 1 kamar (soft-delete) menurunkan `total_kamar` seketika --
    tanpa langkah rekonsiliasi terpisah, sebab tidak ada nilai yang
    di-cache untuk basi.
  - Migrasi diterapkan ke tenant nyata (`admin_raudlatululum`) via
    `migrate:tenants --schema`; endpoint blok/buka-blokir/ketersediaan
    diuji lewat login sungguhan + curl (ketersediaan turun dari 1 ke 0
    setelah blokir, kembali ke 1 setelah dibuka; validasi checkout<=checkin
    ditolak 400).
  - Halaman `/app/hospitality/properti` diverifikasi peramban sungguhan:
    kolom Fitur, tombol Blokir, dan panel Ketersediaan menampilkan data
    nyata dari API (2 kamar, ketersediaan 2 pada rentang netral).
- Diverifikasi: `pnpm test` (153 suite API/3991 test, 42 berkas web/510
  test) LULUS, `tsc --noEmit` LULUS, `pnpm lint` bersih dari perubahan ini.

Belum dikerjakan dan sengaja ditunda: penegakan `overbooking_limit`
(baru konfigurasi, belum ada reservasi yang bisa ditolak/diterima
olehnya -- menyusul MI-8); status `SOLD` pada `hospitality_room_block`
(hanya MANUAL hari ini; `source: 'RESERVATION'` sudah disiapkan di
CHECK constraint supaya MI-8 tidak perlu migrasi lagi).

## 2026-08-06 — Kesesuaian merek dengan mockup UI yang diberikan pengguna

Pengguna melampirkan 10 mockup UI MitraInap (portal publik, dashboard,
reservasi, front office, housekeeping, POS, channel manager, CRM,
pengaturan multi-property) dan meminta seluruh tampilan mengikutinya, serta
menanyakan apakah seluruh MI-* sudah selesai.

**Koreksi diberikan langsung**: belum. Hanya MI-1, MI-2, MI-5 nyata; MI-3
dan MI-4 diblokir (lihat entri di bawah); MI-6..MI-24 -- yaitu HAMPIR
SELURUH layar pada mockup (reservasi, front office, housekeeping, POS,
channel manager, CRM, pengaturan multi-property) -- belum dibangun sama
sekali. Membuat tampilan visualnya tanpa data/backend sungguhan di
baliknya akan jadi UI palsu, melanggar kebiasaan sesi ini.

Yang DIKERJAKAN dari permintaan ini: menyelaraskan identitas merek pada
bagian yang SUDAH nyata dengan mockup --
- Lambang portal diganti dari kotak "MI" menjadi lambang huruf kecil "in"
  (persis mockup) pada `MitrainapLayout`.
- Palet warna digeser dari violet (`#7C3AED`) ke indigo (`#4F46E5`),
  sesuai warna tombol utama pada mockup, di seluruh halaman portal
  (`MitrainapLayout`, `MitrainapHomePage`, `MitrainapSolusiPage`,
  `MitrainapFaqPage`) dan pada `KATALOG_PORTAL`/metadata SEO backend.
- `AppLayout` (cangkang aplikasi terautentikasi BERSAMA seluruh vertikal)
  ditambah deteksi host `app.mitrainap.id` yang menukar lambang/nama
  merek jadi "in"/"MitraInap.id" -- mengikuti pola yang SUDAH ada untuk
  eMedik (`emedikPublicBrandFor`), bukan infrastruktur baru.

Yang TIDAK dikerjakan, dan alasannya: mockup menunjukkan sidebar gelap
navy bercabang penuh (Dashboard/Reservasi/Kalender/Tamu/Front
Office/Housekeeping/POS/Laporan/CRM/Channel Manager/Booking
Engine/Pengaturan) khusus untuk hospitality -- TIDAK ADA vertikal lain di
kodebase ini (termasuk eMedik) yang punya sidebar ter-reskin penuh
semacam itu; seluruhnya memakai SATU `AppLayout` bersama dengan menu yang
berbeda per hak akses, bukan cangkang visual terpisah per vertikal.
Membangun sidebar bespoke hanya untuk MitraInap berarti pola arsitektur
baru yang belum disepakati (dan berlawanan dengan prinsip "satu aplikasi
melayani seluruh merek", §54, yang mendasari MI-1). Layar-layar
fungsional pada mockup (reservasi, front office, dst) akan mengikuti
kerangka visual yang sama (warna indigo, lambang "in") saat masing-masing
benar-benar dibangun di MI-6 dan seterusnya -- bukan dibuatkan tampilan
kosongnya lebih dulu.

Diverifikasi nyata: `pnpm test` (152 suite API/3980 test, 42 berkas
web/510 test) LULUS, `tsc --noEmit` LULUS, `pnpm lint` bersih dari
perubahan ini, lambang dan warna baru diverifikasi lewat peramban
sungguhan pada `/mitrainap`.

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
