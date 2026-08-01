# Changelog — Platform Ekosistem Multi-Portal

Cabang: `feature/collaborative-multi-portal-platform`

Digabungkan ke `CHANGELOG.md` akar pada integration gate (§63).

## ECO-0 — Audit (belum dirilis)

### Ditambahkan

- `docs/ecosystem/` — 13 dokumen audit keadaan saat ini: portal, layanan inti,
  produk/modul, harga, identitas/SSO, schema registry, kontrak lintas vertical,
  peta berkas rawan konflik, rencana implementasi, baseline uji, dan daftar
  risiko.
- Worktree integrator `C:\opt\eBisnisGithub-ecosystem` pada cabang tersendiri,
  sesuai §4.

### Temuan yang mengubah rencana

- **Pola port lintas vertical sudah ada dan sudah dipakai.** POS menerima
  pembayaran dari saldo anggota koperasi dan klaim kesehatan lewat registry
  penangan, tanpa membaca tabel vertical itu. ECO-9 memperluas, bukan membangun
  ulang.
- **Schema registry memodelkan satu schema per tenant**, sedangkan §11 menuntut
  satu per modul. Perpindahannya wajib aditif dan berdampingan.
- **Tidak ada OIDC.** SSO lintas lima domain menuntut lapisan identity provider
  baru di depan model identitas yang sudah ada.
- **Tidak ada usage metering.** Tiga dari lima harga default tidak dapat
  ditagihkan sebelum metering ada, sehingga metering diusulkan mendahului seed
  harga.
- **14 dari 17 dokumen rujukan §2 tidak tersedia.** Audit tetap selesai karena
  sumber kebenaran keadaan implementasi adalah source; rancangan vertical
  menunggu.

### Baseline

2432 uji lulus (API 2092, web 193, Flutter 147), lint bersih, E2E 73 lulus /
0 flaky pada `main`.

## ECO-1 — Registry portal dan penyebaran lima domain (belum dirilis)

### Ditambahkan

- Migrasi aditif `20260801150000_platform_portal_registry`: `platform_portal`,
  `platform_portal_domain`, `platform_portal_cross_link`.
- Model Prisma `PlatformPortal`, `PlatformPortalDomain`,
  `PlatformPortalCrossLink`.
- `infrastructure/portal/portal-host.ts` — aturan murni: label subdomain
  terpesan (§7.4), kelayakan host, kecocokan peran, dan tautan kanonik.
- `infrastructure/portal/portal.catalog.ts` — katalog lima portal beserta host
  dan keterangan tautan silangnya.
- Seed portal pada `PlatformSeedService`, idempoten, termasuk tautan silang
  penuh dua arah.
- `GET /api/v1/public/portals` (§39.1).
- `deploy/apache/ebisnis.conf` — satu vhost untuk kelima domain.
- `deploy/ekosistem.sh` — satu perintah `pasang | perbarui | periksa`.
- `docs/ecosystem/13-penyebaran-lima-domain.md`.

### Keputusan yang perlu diketahui

- **Penerbit identitas satu untuk seluruh ekosistem** (`auth.ebisnis.id`),
  diikat uji. Lima penerbit berarti lima sumber kebenaran tentang siapa yang
  sedang masuk.
- **Satu vhost, bukan lima.** Lima vhost yang menunjuk root dan proxy yang sama
  hanya menghasilkan lima tempat yang harus diperbarui bersamaan.
- **Host portal diseed terverifikasi**, berbeda dari domain penyewa. Kelima apex
  ini milik platform sendiri; tidak ada yang perlu dibuktikan kepada diri
  sendiri. Domain penyewa tetap wajib melewati verifikasi.
- **Domain yang belum menjawab tidak membatalkan pembaruan.** Penyebabnya ada di
  lapisan DNS/TLS/Apache, dan mengembalikan aplikasi tidak memperbaiki satu pun
  di antaranya.
- **Tombol di aplikasi belum dibuat.** Aplikasi web tidak boleh menjalankan
  skrip shell; bentuk yang diusulkan adalah menulis permintaan yang dibaca agen
  ber-hak istimewa.

### Uji

30 uji baru pada aturan dan katalog portal. API: 2122 lulus, 80 berkas.

---

## santri.info — portal ePesantren

### Yang ditambahkan

- Portal `SANTRI_INFO` pada `infrastructure/portal/portal.catalog.ts`, memakai
  `verticalCode: 'ENTERPRISE_EDUCATION'` — merek tersendiri, vertical yang sama.
  Ikut diseed dan ikut tautan silang tanpa langkah tambahan.
- `apps/web/src/verticals/pesantren/santri-host.ts` — memisahkan apex (portal)
  dari subdomain (pondok), menolak label terpesan dan subdomain bertingkat.
- `SantriInfoHomePage.tsx` — halaman portal: apa itu ePesantren, modul,
  alur pemasangan, biaya, model subdomain dan domain sendiri.
- `SantriLayout.tsx` — kerangkanya sendiri; tautan silang diambil dari
  `/public/portals`, bukan ditulis ulang.
- `SitusPondokPage.tsx` — halaman sementara untuk `<pondok>.santri.info`.
- Apache `*.santri.info`, CORS, `ekosistem.sh`, dan dua dokumen.

### Keputusan yang perlu diketahui

- **Portal dan vertical bukan hal yang sama.** `code` adalah merek,
  `verticalCode` adalah modul dan hak akses. `SANTRI_INFO` berbagi vertical
  dengan `ENTERPRISE_EDUCATION`: harga, entitlement, dan provisioning-nya satu.
  Menjadikannya vertical baru berarti katalog modul dan harga baru untuk hal
  yang sudah ada.
- **Apex adalah portal, subdomain adalah pondok.** Menyamakan keduanya membuat
  setiap pondok yang mendaftar kehilangan situsnya dan hanya melihat halaman
  jualan platform — tanpa satu pun galat.
- **Label terpesan disalin ke sisi peramban**, diikat uji yang membaca
  `portal-host.ts`. Tanpa itu `app.santri.info` dibaca sebagai pondok bernama
  "app".
- **`<pondok>.santri.info` tidak masuk `CORS_ORIGINS`.** Permintaannya
  sameorigin; mendaftarkan pola wildcard justru mempercayai setiap subdomain.
- **Harga Rp 2.000/santri/bulan pada halaman adalah penawaran bawaan**, bukan
  sumber kebenaran penagihan. Yang menagih tetap katalog harga berversi.

### Utang yang halaman pemasarannya sudah janjikan

1. Situs penyewa yang dapat disunting sendiri, termasuk berita. CMS dan berita
   yang ada sekarang milik platform, tidak menerima host sebagai penentu penyewa.
2. Verifikasi domain milik pondok. Tabelnya menolak `ACTIVE` tanpa `verifiedAt`,
   tetapi alur yang mengisinya belum ada.
3. Sertifikat wildcard `*.santri.info` — menuntut tantangan DNS-01.

### Uji

Web: 206 lulus (13 baru). API: 2124 lulus, 80 berkas.

---

## santri.info — pendaftaran pondok yang terpisah

### Yang ditambahkan

**Basis data** — migrasi aditif `20260802100000_registration_pesantren`:
`platform.registration_pesantren` (identitas pondok, 1:1 dengan pendaftaran) dan
`platform.tenant.vertical_code` yang boleh null.

**API**
- `pesantren-registration.ts` — aturan murni: bentuk slug, usulan slug dari nama,
  dan validasi yang melaporkan seluruh galat sekaligus. 24 uji.
- `PesantrenRegistrationService` — memanggil `RegistrationService`, bukan
  menyalinnya; menambah identitas, penanda vertikal, dan situs pondok.
- `PesantrenRegistrationController` — `GET public/pesantren/registration-config`,
  `GET .../site-slug/check`, `GET .../site-slug/suggest`,
  `POST .../registrations`.
- `verticalCode` pada jawaban `POST /auth/login` dan `GET /auth/me`.

**Web**
- `/daftar-pesantren` lima langkah, `/daftar-pesantren/berhasil`, `/pesantren`.
- `beranda-sesudah-masuk.ts` — satu tempat yang memutuskan tujuan sesudah masuk.

### Keputusan yang perlu diketahui

- **Nama pengguna dan alamat situs adalah dua hal.** Yang pertama menjadi nama
  schema dan boleh garis bawah; yang kedua menjadi label DNS dan tidak boleh.
  Menyamakannya menghasilkan host yang tersimpan, aktif, dan tidak pernah dapat
  dibuka. Dijaga pola terpisah di aplikasi dan CHECK terpisah di basis data.
- **`generatePassword` tidak ada pada DTO pesantren.** Bukan dipaksa `true` di
  service — tidak dapat dikirim sama sekali.
- **Host diperiksa sebelum schema dibuat.** Kegagalan paling mungkin adalah
  "alamat sudah dipakai"; menemukannya belakangan meninggalkan schema yatim.
- **Kegagalan sesudah credential dibuat tidak dibatalkan.** Dicatat dan
  diberitahukan; penyewanya sehat dan credential tidak dapat ditarik kembali.
- **Tujuan sesudah masuk dibawa sesi, bukan alamat.** Kata sandi buatan peladen
  wajib diganti saat masuk pertama, dan `?lanjut=` tidak selamat melewati
  belokan itu.
- **`verticalCode` dibaca dari basis data pada `/auth/me`**, bukan dari klaim
  token. Token berumur panjang; vertikal di dalamnya menunjuk beranda lama sampai
  kedaluwarsa.
- **Situs pondok langsung `ACTIVE` + terverifikasi.** `<slug>.santri.info` ada di
  zona kita. Domain milik pondok sendiri tetap wajib melewati verifikasi.

### Uji

Web: 213 lulus (7 baru). API: 2151 lulus, 82 berkas (27 baru).
