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
- `deploy/apache/ekosistem.conf` — satu vhost untuk kelima domain.
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
