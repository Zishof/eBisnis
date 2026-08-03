# Handoff — Onboarding Raudlatul Ulum & modul ePesantren (2026-08-03)

Ditulis untuk pindah alat bantu (Codex) di tengah sesi kerja. Tujuannya
supaya siapa pun/apa pun yang melanjutkan tidak perlu membaca ulang seluruh
riwayat percakapan — cukup berkas ini, plus `git log` untuk detail per PR.

## Konteks

**Pelanggan**: Pondok Pesantren Raudlatul Ulum, Bojonegoro — pelanggan
SUNGGUHAN pertama platform (bukan demo/sample), diakses di
`https://raudlatul-ulum.santri.info`. Tiga unit pendidikan: Madrasah
Ibtidaiyah (MI-RU), Madrasah Diniyah Takmiliyah (MADIN-RU), BLK Komunitas
(BLKK-RU).

**Platform**: eBisnis.id/santri.info, monorepo NestJS (`apps/api`) + React
(`apps/web`), multi-tenant, modul `pesantren` sebagai salah satu vertikal.

**Repo**: `C:\opt\eBisnisGithub-ecosystem`, GitHub `Zishof/eBisnis`. Semua
kerja lewat PR — branch baru dari `origin/main`, squash-merge, hapus branch
remote setelahnya.

## Aturan kerja yang WAJIB diikuti (dipelajari/ditegaskan sepanjang sesi)

1. **Git**: `git fetch origin --quiet && git checkout -b <branch> origin/main --quiet`
   sebelum mulai kerja apa pun. Satu PR = satu perhatian (jangan gabung PSB
   + SEO + bug-fix tidak terkait dalam satu PR). Tidak pernah force-push,
   tidak pernah `--no-verify`.
2. **Migrasi tenant** (`apps/api/tenant-migrations/pesantren/*.sql`):
   - TIDAK PERNAH menyunting migrasi yang SUDAH diterapkan/di-commit —
     selalu buat berkas migrasi BARU, walau perubahannya kecil (contoh:
     `hero_image_attribution` dan `agama` masing-masing migrasi terpisah
     dari migrasi `situs_publik` yang sudah lebih dulu ada).
   - Kolom baru SELALU nullable/aditif, tidak pernah breaking change.
   - **WAJIB didaftarkan di `apps/api/tenant-migrations/pesantren/manifest.json`**
     (array `migrations`, `id` dan `file` harus cocok) — migrasi yang ada
     berkasnya tapi tidak terdaftar di manifest TIDAK PERNAH dijalankan.
   - Uji lokal dengan `pnpm migrate:tenants` (menjalankan ke SEMUA tenant
     lokal, bukan cuma satu) sebelum PR.
3. **Kredensial**: TIDAK PERNAH menulis kredensial database asli ke berkas
   apa pun di repo, log, atau commit. `.env` lokal untuk pengujian SELALU
   dibuat lalu DIHAPUS lagi setelah selesai — lihat pola di bawah.
4. **Verifikasi nyata sebelum lapor selesai**: setiap perubahan diuji lewat
   API/peramban SUNGGUHAN terhadap basis data lokal, bukan cuma
   `tsc`/`eslint`. Data uji coba dibersihkan lagi setelahnya. §6 disiplin:
   tidak pernah mengklaim fitur selesai kalau kemampuannya belum sungguh
   ada; tidak pernah mengarang data "asli" tentang pelanggan sungguhan.
5. **Tidak ada akses SSH ke server produksi.** Deploy hanya lewat PR
   merge + pengguna menjalankan sendiri:
   ```bash
   sudo bash /opt/ebisnis/app/deploy/update.sh
   ```
   Selalu ingatkan pengguna untuk menjalankan ini setiap kali PR baru
   merge — perubahan tidak live sampai itu dijalankan.

### Pola pengujian lokal (dipakai berulang kali sesi ini)

```bash
# 1. Buat .env sementara di apps/api (kredensial lokal: root/root123, db ebisnis, port 5433)
# 2. npm run dev di apps/api DAN apps/web (apps/web perlu API_PROXY_TARGET=http://localhost:3100)
# 3. Untuk menguji halaman PUBLIK pondok (host-based tenant resolution),
#    apps/web/vite.config.ts proxy SEMENTARA diubah:
#    '/api': { target: API_TARGET, changeOrigin: false, headers: { host: 'raudlatul-ulum.santri.info' } }
#    -- SELALU dikembalikan (git checkout --) setelah selesai, jangan sampai ter-commit.
# 4. Untuk menguji halaman ADMIN (/app/...), TIDAK perlu proxy host-override
#    di atas -- auth berbasis JWT, bukan host.
# 5. Setelah selesai: hapus .env, matikan kedua server (taskkill by port 3100/5173),
#    hapus data uji coba dari DB, git checkout -- vite.config.ts.
```

Login admin pondok untuk pengujian lokal: `admin_raudlatululum`. Password
sungguhan tidak diketahui (sudah pernah diganti pemilik). Untuk pengujian
LOKAL SAJA boleh reset hash password langsung di DB lokal pakai `argon2`
(TIDAK PERNAH dilakukan ke database produksi, tidak ada aksesnya pula).

## Yang sudah selesai sesi ini (PR #78–#92, semua sudah merge ke `main`)

Kronologis, dikelompokkan per topik:

### A. Onboarding awal Raudlatul Ulum
- Profil situs publik (sejarah, visi-misi, muqodimah NU, tema warna per
  pondok), berita (≥16 item riset nyata, bukan karangan), unit pendidikan,
  mata pelajaran Dapodik-aligned, akun staf per peran.
- Logo & foto hero disimpan sebagai **PostgreSQL Large Object (BLOB)** di
  skema tenant sendiri — lihat `TenantFileBlobService`
  (`apps/api/src/infrastructure/files/tenant-file-blob.service.ts`), pola
  yang HARUS dipakai untuk gambar apa pun ke depannya (diminta eksplisit
  pengguna): `simpanTunggal()` untuk unggah/ganti, `ambilByCode()` untuk
  baca, disajikan lewat endpoint yang memakai `rawResponse()` (lihat
  `apps/api/src/common/interceptors/response-envelope.interceptor.ts`)
  supaya `StreamableFile` tidak ikut ter-JSON-kan oleh interceptor global.
- `PondokChrome.tsx` — bingkai halaman khusus subdomain pondok, TIDAK
  pernah menampilkan merek eBisnis/santri.info (diminta eksplisit).
- Favicon dinamis ikut logo pondok di subdomainnya
  (`use-pondok-favicon.ts`), bawaan eBisnis di tempat lain.

### B. SEO metadata (PR #84)
- `use-pondok-seo.ts` — deskripsi, Open Graph, Twitter Card, JSON-LD
  `EducationalOrganization` per pondok.
- **Keterbatasan jujur yang perlu diingat**: SPA ini client-rendered, BUKAN
  SSR. Bot pratinjau tautan yang tidak menjalankan JS (WhatsApp, Facebook)
  MASIH menampilkan branding eBisnis generik saat tautan pondok dibagikan
  — perbaikannya butuh SSR/suntikan meta di edge, belum dikerjakan.

### C. Portal pendaftar PSB (PR #85–#89)
- Login pendaftar (nomor pendaftaran + tanggal lahir sebagai kata sandi),
  token JWT BERBEDA dari staf (`psb_applicant`, TTL 45 menit,
  `PsbApplicantAuthGuard` — lihat
  `apps/api/src/modules/pesantren/psb-applicant-auth.guard.ts`), TIDAK
  PERNAH lewat `JwtAuthGuard`/`PermissionGuard` global staf.
- Dashboard pendaftar: status, ubah biodata sendiri, unggah bukti bayar
  (BLOB lagi), lihat jadwal ujian/wawancara.
- Landing PSB (`PsbGelombangPage.tsx`): daftar gelombang dikelompokkan
  PER UNIT PENDIDIKAN (migrasi `20260803T070000`, kolom
  `unit_pendidikan_id` NULLABLE di `pesantren_psb_gelombang`), filter
  pencarian nama + status (bawaan "Sedang Dibuka"), gelombang
  tutup/selesai TETAP bisa diklik (mengarah ke formulir yang menjelaskan
  kenapa tidak bisa daftar, bukan tombol mati).
- **Ujian online (CBT) SENGAJA belum dibangun** — subsistem besar sendiri
  di sistem lama (bank soal, timer, penilaian otomatis), disepakati
  ditunda sebagai epik terpisah lewat pertanyaan eksplisit ke pengguna.
- Bug nyata ditemukan+diperbaiki sambil mengerjakan ini: combobox "Unit
  Pendidikan yang Dituju" pada formulir publik dulu mengirim KODE unit
  (string), padahal kolomnya FK UUID ke `id` — selalu gagal 404 kalau
  benar-benar dipilih. `GET /pesantren/public/site` sekarang menyertakan
  `id` unit, combobox memakainya.
- 9 gelombang contoh (3 per unit × 3 unit) di-seed untuk Raudlatul Ulum,
  `is_sample = TRUE`, lihat `scripts/onboard-raudlatul-ulum/seed.js`.
- `BeritaDetailPage.tsx` — halaman detail berita publik (dulu tautan
  berita cuma kembali ke beranda, sekarang menampilkan isi lengkap).

### D. RBAC — menu bawaan per vertikal (PR #91)
- **Masalah**: SEMUA tenant (apa pun vertikalnya) melihat SELURUH menu ERP
  generik (Kasir/POS, Penjualan, Produksi, dst.) karena peran `OWNER`
  punya `allModules: true` yang dipakai BERSAMA semua vertikal.
- **Perbaikan**: filter TAMPILAN SAJA di
  `TenantPermissionService.menuTree()`
  (`apps/api/src/modules/auth/tenant-permission.service.ts`) — TIDAK
  menyentuh hak akses `OWNER`/`allModules` itu sendiri (aman untuk
  koperasi/klinik/vertikal lain). Bawaan pesantren: menu vertikalnya
  sendiri + 6 menu inti (Beranda, Keuangan, Langganan, Master Data,
  Administrasi, Bantuan).
- **Jebakan yang tertangkap lewat pengujian nyata, bukan baca kode**: kode
  registrasi katalog RBAC pesantren adalah `'pesantren'` (huruf kecil),
  TAPI nilai `Tenant.verticalCode` sesungguhnya adalah `'PESANTREN'`
  (huruf besar, lihat `VERTIKAL_PESANTREN` di
  `apps/web/src/app/beranda-sesudah-masuk.ts`). Percobaan pertama pakai
  kunci huruf kecil → silently no-op. SELALU uji lewat login sungguhan +
  `GET /me/menus`, jangan percaya pembacaan kode saja untuk hal seperti
  ini.

### E. Halaman admin Asrama & Tagihan SPP (PR #92)
- Backend KEDUANYA sudah lengkap sejak awal
  (`pesantren-asrama.controller.ts`, `pesantren-tagihan.controller.ts`) —
  yang belum ada cuma halaman admin-nya. Dashboard pondok
  (`PesantrenDashboardPage.tsx`) sudah lama punya tombol "Buka Asrama"/
  "Buka Tagihan SPP" yang jadi dead-link ke `ComingSoonPage`.
- `PesantrenAsramaPage.tsx` — tab Asrama&Kamar + tab Penempatan Santri.
- `PesantrenTagihanPage.tsx` — daftar+filter, buat tagihan (item dinamis),
  modal detail dengan aksi Terbitkan/Catat Pembayaran kontekstual. Status
  tagihan TIDAK PERNAH dipilih manual — server menghitung ulang dari
  total pembayaran tiap kali `bayar()` dipanggil.
- Pola halaman admin BARU mengikuti `PesantrenSantriPage.tsx` (satu-
  satunya halaman admin pesantren yang sudah ada sebelumnya):
  `DataGrid`/`PageHeader`/`Pagination`/`StatusBadge` dari
  `apps/web/src/components/ui.tsx`, `useToast`+`useErrorMessage` untuk
  galat, modal overlay polos (TANPA pustaka dialog), TANPA
  `react-hook-form` (plain `useState`).

## Modul yang MASIH "Sedang dibangun" (belum ada halaman admin)

Dari `BerandaPondokPage.tsx` (`apps/web/src/verticals/pesantren/`, array
`BELUM`) — backend LENGKAP untuk semuanya, cuma frontend admin yang belum
ada:

1. **Diniyah dan Tahfiz** — Halaqah, setoran hafalan, rapor diniyah.
   Backend: `pesantren-diniyah.controller.ts`, `pesantren-tahfiz.controller.ts`.
2. **Perizinan keluar-masuk** — Pengajuan, persetujuan berjenjang,
   pemberitahuan wali. Backend: `pesantren-perizinan.controller.ts` (+
   `pesantren-gerbang.controller.ts` untuk petugas gerbang).
3. **Uang saku nontunai** — Dompet santri untuk kantin/koperasi. Backend:
   `pesantren-dompet.controller.ts`, `pesantren-kartu.controller.ts`,
   `pesantren-kiosk.controller.ts`.
4. **Situs dan berita pondok (EDITOR ADMIN)** — pengurus BELUM bisa
   menyunting profil/muqodimah/berita lewat UI sama sekali (cuma lewat
   skrip seed langsung ke DB sekarang). Backend sudah ada:
   `pesantren-profil.controller.ts`, `pesantren-berita.controller.ts`.

Catatan: `BerandaPondokPage.tsx` juga masih mendaftar "Santri dan asrama"
sebagai "belum dibangun" — itu SUDAH TIDAK BENAR lagi (Santri sudah ada
sejak lama, Asrama baru selesai PR #92 sesi ini). Berkas itu perlu
diperbarui (pindahkan keduanya ke daftar `SIAP`) sebagai bagian dari
modul mana pun yang dikerjakan berikutnya — jangan lupa, gampang
terlewat karena bukan bagian dari "modul" itu sendiri.

## Pertanyaan terbuka dari pengguna — BELUM dikerjakan, baru riset

**Pertanyaan**: bisakah tiap unit pendidikan (MI/Madin/BLK) punya website
sendiri dengan subdomain sendiri (`mi-raudlatul-ulum.santri.info`), dan
bisakah subdomain itu dibuat OTOMATIS lewat Cloudflare API saat unit
dibuat lewat CRUD? Juga tanya soal dukungan domain kustom
(`*.sch.id`) per unit ke depannya.

**Temuan riset (sudah disampaikan ke pengguna, BELUM ada kode)**:

- **Kabar baik**: subdomain di bawah `santri.info` TIDAK BUTUH Cloudflare
  API sama sekali. `*.santri.info` dirancang sebagai SATU record DNS
  wildcard + SATU sertifikat TLS wildcard (lihat
  `docs/deployment/santri-info.md`) — label apa pun di bawahnya sudah
  otomatis resolve ke server yang sama, sebelum baris apa pun dibuat di
  mana pun. Satu-satunya yang membuat subdomain "nyata" adalah baris di
  tabel domain platform yang dibaca `PublicTenantResolver`
  (`apps/api/src/infrastructure/tenant/public-tenant-resolver.service.ts`).
- **Yang benar-benar belum ada, urut prioritas**:
  1. **CRUD unit pendidikan TIDAK ADA SAMA SEKALI** — unit sekarang cuma
     dibuat lewat skrip seed sekali jalan (`scripts/onboard-raudlatul-ulum/seed.js`,
     `scripts/seed-ponpes-demo/01-fondasi.js`). Tidak ada
     controller/service/halaman admin untuk CRUD unit. **Ini prasyarat
     mutlak** — tidak ada "atur subdomain saat CRUD unit" tanpa CRUD-nya
     dulu.
  2. Tabel domain platform (`VerticalSiteDomain`, di
     `apps/api/prisma/platform/tenancy.prisma`) punya
     `@@unique([tenantId, vertical])` — SATU tenant cuma boleh SATU host
     aktif per vertikal saat ini. Perlu migrasi skema untuk mengizinkan
     banyak subdomain per tenant (per unit).
  3. `PublicTenantResolver` baru resolve di level TENANT (pondok), belum
     level UNIT — perlu diperluas.
- **Domain kustom (`*.sch.id`) milik sekolah sendiri** — masalah yang
  jauh lebih besar (verifikasi kepemilikan DNS sungguhan + TLS
  per-domain, bukan wildcard). Ada POLA verifikasi TXT/HTTP-file yang
  sudah dibangun BAIK di `apps/api/src/modules/storefront/store-domain.service.ts`
  (untuk fitur BEDA: domain kustom toko marketplace) — tapi backend-only,
  TIDAK ADA endpoint/halaman yang memakainya, dan belum pernah
  diadaptasi untuk pesantren. Alur verifikasi domain pondok di
  `docs/deployment/santri-info.md` §5 baru DOKUMEN RENCANA, belum ada
  implementasinya sama sekali (diakui eksplisit di dokumen itu sendiri,
  bagian "Yang belum terbukti").

**Rekomendasi urutan kerja yang sudah disampaikan ke pengguna** (belum
disetujui/dimulai): (1) CRUD unit pendidikan dulu, (2) subdomain per unit
di bawah `santri.info` (murah, DNS sudah gratis/otomatis), (3) domain
kustom sekolah sungguhan belakangan, kalau memang ada yang minta.

## Berkas kunci untuk orientasi cepat

| Kebutuhan | Berkas |
|---|---|
| Pola BLOB gambar | `apps/api/src/infrastructure/files/tenant-file-blob.service.ts` |
| Resolusi tenant dari host (publik) | `apps/api/src/infrastructure/tenant/public-tenant-resolver.service.ts` |
| Katalog menu/peran pesantren | `apps/api/src/modules/pesantren/rbac/pesantren-vertical.catalog.ts` |
| Filter menu bawaan per vertikal (BARU) | `apps/api/src/modules/auth/tenant-permission.service.ts` (fungsi `akarMenuTampilBawaan`) |
| Auth portal pendaftar PSB | `apps/api/src/modules/pesantren/psb-applicant-auth.guard.ts` |
| Pola halaman admin pesantren | `apps/web/src/pages/app/pesantren/PesantrenSantriPage.tsx` (contoh lama), `PesantrenAsramaPage.tsx`/`PesantrenTagihanPage.tsx` (contoh baru) |
| Dashboard pondok (menu "sedang dibangun") | `apps/web/src/verticals/pesantren/BerandaPondokPage.tsx` |
| Dashboard admin (kartu ke modul) | `apps/web/src/pages/app/pesantren/PesantrenDashboardPage.tsx` |
| Rute admin (`/app/...`) | `apps/web/src/app/App.tsx` — cari `pesantren/santri` sebagai jangkar |
| Seed data Raudlatul Ulum | `scripts/onboard-raudlatul-ulum/seed.js` (idempoten, aman dijalankan ulang) |
| Skrip deploy produksi | `deploy/onboard-raudlatul-ulum.sh` (dijalankan via `deploy/update.sh`, TIDAK BISA dijalankan asisten — tidak ada akses SSH) |
| Manifest migrasi pesantren | `apps/api/tenant-migrations/pesantren/manifest.json` |

## Riwayat commit untuk detail lengkap

Semua PR di atas ada di `git log --oneline` cabang `main`, urut nomor PR
#78 sampai #92. Setiap pesan commit ditulis panjang & rinci (alasan,
bukan cuma apa) — baca `git show <hash>` untuk detail sebuah perubahan
spesifik alih-alih menebak dari nama berkas saja.
