# Handoff Sesi ePesantren, eSchool, dan Education Core - 2026-08-10

Dokumen ini adalah titik lanjut resmi untuk memindahkan pekerjaan ke komputer
lain. Bacalah dokumen ini bersama `git log origin/main` dan dokumen gap analysis
yang dirujuk di bagian akhir. Jangan mengandalkan riwayat percakapan lama
sebagai satu-satunya sumber kebenaran.

## 1. Ringkasan Eksekutif

Sesi panjang ini dimulai dari onboarding Pondok Pesantren Raudlatul Ulum dan
berkembang menjadi fondasi operasional ePesantren/eSchool yang jauh lebih luas.
Pekerjaan penting sampai PR #105 sudah masuk ke `main`, termasuk:

- situs pondok dan situs masing-masing unit pendidikan;
- subdomain unit dinamis di bawah `*.santri.info`;
- CRUD unit pendidikan beserta pengaturan situs dan media;
- modul operasional pesantren, sekolah, gerbang, dakwah, dan pembinaan;
- DAPODIK dengan template, preview diff per field, log batch, dan rollback;
- shell vertikal eSchool dan katalog/menu khusus sekolah;
- finalisasi rapor, kenaikan/kelulusan, PDF ber-QR, verifikasi publik, leger,
  ranking, serta ekspor leger DAPODIK/EMIS;
- perkakas ekspor/impor/cetak/dashboard yang dapat dipakai ulang pada data grid;
- pemindahan import legacy CMN ke proses asinkron saat deploy.

Fingerprint sengaja ditunda sampai vendor/perangkat tersedia. eCampus masih
merupakan gap terbesar dan belum dapat dianggap selesai.

## 2. Repository dan Worktree

Repository GitHub:

- `https://github.com/Zishof/eBisnis.git`
- branch produksi: `main`
- folder repository utama yang disebut pengguna:
  `C:\opt\eBisnisGithub-ecosystem`

Worktree yang dipakai untuk PR penutup sesi ini:

- `C:\opt\eBisnisGithub-crud-tools`

Alasan memakai worktree tersebut: worktree utama masih berisi pekerjaan lain
yang tidak boleh disentuh. Pada pemeriksaan terakhir, kondisi worktree utama
adalah:

```text
branch: codex/pesantren-unit-pendidikan-crud
status: ahead 1
modified: apps/api/src/modules/tenant/tenant.module.ts
untracked: apps/pos-flutter/lib/inventory/
```

Perubahan tersebut dianggap milik pengguna/pekerjaan paralel. Jangan di-reset,
di-checkout ulang, dihapus, atau dimasukkan ke commit handoff ini.

Pada saat dokumen ini dibuat, `origin/main` berada pada commit `ea03c91` dan
sudah memuat catatan sesi umum lain di:

- `docs/session-notes/2026-08-10-ringkasan-sesi.md`

Catatan umum itu berfokus pada POS/Inventory, CI/CD, auto-update, dan perbaikan
integritas data. Dokumen ini khusus education core, ePesantren, dan eSchool.

## 3. Yang Sudah Selesai

### 3.1 Onboarding Raudlatul Ulum dan Situs Pondok

- Tenant Raudlatul Ulum aktif dengan host
  `https://raudlatul-ulum.santri.info`.
- Profil, sejarah, visi-misi, muqodimah, logo, hero, berita, PSB, dan unit
  pendidikan tersedia.
- Branding pondok tidak lagi bocor menjadi branding generik eBisnis pada
  chrome situs publik.
- Favicon, SEO metadata, Open Graph, Twitter Card, dan JSON-LD mengikuti
  profil pondok.
- Berita mempunyai halaman detail.
- PSB publik mempunyai landing gelombang, filter, formulir, portal pendaftar,
  biodata mandiri, bukti pembayaran, serta jadwal ujian/wawancara.
- Media biner penting menggunakan penyimpanan BLOB tenant melalui
  `TenantFileBlobService`, bukan file acak di filesystem server.

Catatan: metadata situs masih berasal dari SPA client-rendered. Bot berbagi
tautan yang tidak menjalankan JavaScript dapat tetap membaca metadata generik.
SSR atau injeksi metadata di edge belum dibangun.

### 3.2 Unit Pendidikan dan Domain

- CRUD unit pendidikan sudah tersedia di admin.
- Setiap unit dapat memiliki halaman welcome sendiri.
- Kartu unit pada situs pondok mengarah ke situs unit masing-masing.
- Pengaturan unit mencakup slug, subdomain `santri.info`, domain kustom,
  status domain, logo, hero, galeri, program, kegiatan, dan prestasi.
- Halaman unit dibuat cerah dan responsif; header/CTA ganda yang pernah muncul
  sudah dibersihkan.
- Subdomain unit didaftarkan otomatis di sisi aplikasi saat data unit disimpan.

Untuk host seperti `mi-raudlatul-ulum.santri.info`, Cloudflare API tidak wajib
dipanggil per unit karena DNS wildcard `*.santri.info` sudah mengarah ke server.
Yang menentukan host tersebut aktif adalah registrasi domain di aplikasi.

Domain kustom seperti `sekolah.sch.id` belum dapat dianggap otomatis penuh.
Fitur produksi masih memerlukan verifikasi kepemilikan DNS, provisioning TLS,
audit, retry, dan kredensial operasional. Jangan menaruh Cloudflare API token di
source code atau dokumen.

### 3.3 Modul Operasional ePesantren

Frontend admin dan API telah tersedia untuk area utama berikut:

- dashboard dan setup pondok;
- unit pendidikan;
- santri, wali, guru/ustadz, kartu santri;
- asrama, kamar, penempatan, dan tagihan;
- rombongan, kurikulum, mata pelajaran, jadwal, presensi;
- diniyah, kitab, halaqah, tahfiz, dan setoran;
- nilai, rapor, serta keputusan akademik;
- perizinan, disposisi, dan buku penghubung;
- dompet santri, batas harian, top-up, dan transaksi;
- katering/dapur dasar;
- pembinaan, pelanggaran, hukuman, prestasi, ekstrakurikuler, dan organisasi;
- PSB/PPDB serta laporan;
- CMS profil, berita, media pondok, dan media unit;
- kajian/dakwah dengan publikasi materi, rekaman, gambar, dan status terbit;
- portal wali dan notifikasi dasar.

Beberapa workflow masih perlu diperdalam, tetapi item di atas bukan lagi layar
`Coming Soon` kosong.

### 3.4 Gerbang Keluar-Masuk Asrama

- Petugas dapat melihat izin aktif yang sudah disetujui.
- Scan kartu/RFID keyboard-wedge mencari santri dan izin yang berlaku.
- Lintasan KELUAR/MASUK dicatat tanpa memberi petugas gerbang hak untuk
  menyetujui izin.
- UI dasar untuk tablet/PC security tersedia.
- Data tamu, paket kiriman, dan penjemput dipisahkan dari lintasan santri.
- Daftar izin, riwayat lintasan, dan ringkasan operasional tersedia.

Yang belum penuh: antrean offline yang benar-benar tahan putus jaringan,
integrasi kamera/QR native yang lebih matang, bukti perjalanan/transport rinci,
dan fingerprint. Fingerprint ditunda secara eksplisit oleh pengguna.

### 3.5 Gap AIS/eSchool yang Sudah Ditutup

Perbandingan dilakukan terhadap class legacy di:

`C:\opt\AIS\ais\src\main\src\ais\action\master\sekolah\*`

Hasil implementasi mencakup master sekolah/unit, guru, siswa/santri, wali,
rombongan, kurikulum, mapel, jadwal, presensi, nilai, PSB, pembinaan, buku
penghubung, perizinan, dan gerbang. Detail audit tersedia di:

- `docs/santri-info/19-eschool-gap-analysis-2026-08-03.md`
- `docs/santri-info/20-gap-analysis-refresh-2026-08-04.md`

eSchool juga sudah mempunyai namespace/facade backend, shell frontend, katalog
fitur, navigasi, RBAC, dan menu khusus sekolah formal. Namun beberapa halaman
masih memakai education core/ePesantren sebagai fondasi bersama. Karena itu,
status eSchool adalah fondasi operasional kuat, belum sepenuhnya produk vertikal
independen.

### 3.6 DAPODIK Lanjutan

PR #97 menutup empat permintaan prioritas DAPODIK:

- log batch import permanen;
- metadata sumber dan pengguna pengunggah;
- hasil, error, serta detail baris per batch;
- preview `CREATE`, `UPDATE`, dan `SKIP` dengan diff per field;
- import final yang idempoten;
- rollback batch yang aman;
- template CSV yang dapat diberi konteks unit dan jenjang formal;
- facade endpoint eSchool untuk dataset siswa/santri, guru, rombongan, dan
  nilai.

UI eSchool menyediakan menu DAPODIK untuk template, ekspor, validasi/dry-run,
import final, riwayat batch, detail diff, dan rollback.

Catatan jujur: implementasi ini adalah format integrasi DAPODIK yang disediakan
platform, bukan klaim sertifikasi resmi pemerintah atau koneksi langsung ke
layanan DAPODIK nasional. Perubahan format pemerintah harus diperlakukan
sebagai pekerjaan integrasi/versioning tersendiri.

### 3.7 Rapor dan Akademik

PR #99 sampai #105 menyelesaikan rangkaian berikut:

- workflow finalisasi rapor oleh wali kelas dan kepala sekolah/madrasah;
- snapshot nilai final agar rapor yang telah disahkan tidak berubah diam-diam;
- pembatalan/finalisasi ulang dengan kontrol status;
- keputusan naik kelas, tinggal kelas, lulus, atau keputusan akademik lain;
- histori keputusan dan proses promosi ke rombongan berikutnya;
- PDF rapor resmi dengan logo, area tanda tangan, kode verifikasi, checksum,
  dan QR;
- halaman verifikasi rapor publik;
- leger dan ranking per tahun ajaran/rombongan;
- ekspor CSV dan PDF leger;
- ekspor leger nasional dalam format DAPODIK dan EMIS.

Yang masih perlu pendalaman adalah template rapor spesifik per jenjang/yayasan,
tanda tangan elektronik tersertifikasi, kalender ujian, serta validasi bentrok
jadwal lanjutan.

### 3.8 Perkakas CRUD yang Dapat Dipakai Ulang

PR #96 menambahkan pola perkakas data grid agar modul CRUD dapat memperoleh:

- unduh Excel/CSV;
- unggah/import Excel;
- cetak/simpan PDF;
- ringkasan/dashboard;
- pemetaan kolom dari definisi kolom data grid;
- perilaku responsif untuk desktop dan mobile.

Fondasi ini mengurangi duplikasi, tetapi belum berarti setiap tabel lama di
seluruh monorepo otomatis sudah diberi empat tombol tersebut. Modul baru wajib
memakai komponen bersama ini; modul lama tetap perlu audit adopsi per halaman.

### 3.9 Deploy dan Import Legacy

PR #95 memindahkan import DBF legacy CMN yang berat ke proses asinkron pada
deploy. Tujuannya agar build/restart aplikasi tidak tertahan oleh projection
data ratusan ribu baris. Import tetap idempoten dan memiliki marker/progress.

Hal ini khusus import legacy CMN. Migrasi database yang menentukan kompatibilitas
schema tetap harus selesai sebelum aplikasi baru menerima trafik dan tidak boleh
dibuat fire-and-forget.

## 4. Riwayat PR Penting

| PR | Ringkasan | Status |
| --- | --- | --- |
| #78 | Data Santri dan kelengkapan biodata setara kebutuhan DAPODIK | merged |
| #79-#84 | Branding situs pondok, hero/logo, favicon, dan SEO | merged |
| #85-#90 | Portal dan workflow PSB/PPDB publik | merged |
| #91 | Penyaringan menu bawaan per vertikal/RBAC | merged |
| #92 | Halaman admin asrama dan tagihan | merged |
| #93 | Handoff awal sesi Raudlatul Ulum | merged |
| #94 | CRUD unit pendidikan dan fondasi situs/domain unit | merged |
| #95 | Import legacy CMN asinkron saat deploy | merged |
| #96 | Perkakas CRUD/data-grid reusable | merged |
| #97 | Audit, diff, log batch, dan rollback DAPODIK | merged |
| #98 | Shell vertikal eSchool | merged |
| #99 | Finalisasi rapor | merged |
| #100 | Kenaikan kelas dan kelulusan | merged |
| #101 | PDF rapor dan verifikasi QR | merged |
| #103 | Leger dan ranking | merged |
| #105 | Ekspor leger DAPODIK/EMIS | merged |

PR #102 dan #104 adalah pekerjaan Inventory/Sales paralel dan bukan bagian
utama handoff education ini.

## 5. Verifikasi yang Sudah Dilakukan

Perubahan rapor/education terakhir telah melewati:

```powershell
pnpm --filter @ebisnis/api test -- pesantren-nilai.spec.ts pesantren-akademik.spec.ts pesantren-vertical.catalog.spec.ts education.service.spec.ts
pnpm --filter @ebisnis/api build
pnpm --filter @ebisnis/web build
git diff --check
```

Hasil terakhir: 40 test terkait lulus, build API lulus, build web lulus. Build
web hanya memberi peringatan ukuran chunk dan penggunaan `jspdf` secara dinamis
dan statis; tidak ada error build.

Dokumen ini tidak menyatakan seluruh monorepo telah diuji end-to-end terhadap
semua perangkat fisik. Pengujian produksi oleh pengguna tetap diperlukan.

## 6. Cara Deploy dari Server

Setelah commit/PR terbaru sudah ada di `main`, pengguna menjalankan:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Jika skrip menyatakan commit yang sama sudah terpasang dan pengguna memang perlu
membangun ulang artefak dari commit itu:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh --force
```

Jangan memakai `--force` untuk menutupi kegagalan migrasi/import. Periksa log
langkah yang gagal terlebih dahulu.

## 7. Gap Berikutnya, Urut Prioritas

### P0 - Menstabilkan eSchool sebagai Vertikal Murni

1. Kurangi ketergantungan route/page eSchool pada nama dan permission
   ePesantren tanpa menduplikasi business rules.
2. Lengkapi halaman khusus sekolah untuk dashboard, siswa, guru, kelas,
   rombel, mapel, jadwal, nilai/rapor, PPDB, BK, presensi, perpustakaan,
   sarpras, akreditasi, alumni, dan laporan.
3. Buat kontrak DTO/service education core yang dipakai eSchool dan ePesantren
   secara eksplisit.
4. Tambahkan test isolasi tenant, role operator DAPODIK, wali kelas, guru BK,
   kepala sekolah, dan admin sekolah.

### P0 - Penyempurnaan Akademik

1. Template rapor per jenjang/yayasan.
2. Validasi bentrok jadwal guru, ruang, rombongan, dan periode yang lebih rinci.
3. Kalender ujian, substitusi guru, copy jadwal mingguan, dan drag-resize jam.
4. Kartu PPDB/cetak rekap seleksi serta dashboard panitia.
5. Tanda tangan elektronik tersertifikasi bila penyedia dan dasar hukum sudah
   dipilih.

### P1 - Gerbang dan Asrama

1. Offline queue dengan idempotency key dan rekonsiliasi setelah koneksi pulih.
2. Scan QR berbasis kamera untuk tablet/Android.
3. Bukti izin dan detail penjemput/perjalanan/transport.
4. Dashboard keamanan dan laporan pergantian shift.
5. Fingerprint setelah vendor, SDK, model alat, serta lisensi dipastikan.

### P1 - EMIS dan Referensi Nasional

1. Mapping EMIS yang versioned untuk madrasah/pesantren.
2. Referensi nasional yang dapat diperbarui admin dan memiliki histori versi.
3. Validasi NISN, NIK, NUPTK, dan kode referensi dengan aturan yang dapat
   diperbarui.
4. Rekonsiliasi dan laporan error untuk pertukaran data nasional.

### P1 - UI/UX dan CMS

1. Audit semua halaman agar header/CTA tidak ganda.
2. Crop/editor gambar, bulk upload, drag ordering, dan optimasi gambar.
3. Page/menu builder dengan draft, preview, publish, dan histori revisi.
4. Dashboard berbeda untuk pengasuh, admin, wali kelas, keamanan, dan wali.
5. Audit responsif berbasis screenshot pada viewport mobile, tablet, dan
   desktop.

### P2 - eCampus

eCampus masih gap terbesar: mahasiswa, dosen, fakultas/prodi, PMB, KRS/KHS,
transkrip, Feeder/PD-Dikti, SPMI/SPI, penelitian, pengabdian, tugas akhir,
wisuda, dan alumni belum setara target dokumen profil.

Masalah `new.ecampus.id` yang pernah terlihat sebagai `ChunkLoadError`/HTTP 400
pada asset Next.js juga belum ditutup di repository ini. Diagnosis/fix harus
dilakukan di repository dan pipeline deploy `new-ecampus` secara terpisah,
termasuk pemeriksaan konsistensi build ID, cache proxy/CDN, dan asset `_next`.

## 8. Langkah Memulai di Komputer Baru

```powershell
git clone https://github.com/Zishof/eBisnis.git
cd eBisnis
git fetch origin
git checkout main
git pull --ff-only origin main
pnpm install --frozen-lockfile
```

Kemudian baca berurutan:

1. `docs/santri-info/21-session-handoff-2026-08-10.md`
2. `docs/santri-info/20-gap-analysis-refresh-2026-08-04.md`
3. `docs/santri-info/19-eschool-gap-analysis-2026-08-03.md`
4. `docs/session-notes/2026-08-10-ringkasan-sesi.md`
5. `git log --oneline --decorate -50`

Sebelum mengubah kode:

```powershell
git status -sb
git checkout -b codex/<topik-kecil> origin/main
```

Gunakan satu PR untuk satu perhatian, buat migrasi tenant baru yang aditif,
daftarkan migrasi pesantren di manifest, jalankan test/build terkait, lalu
deploy hanya setelah PR masuk ke `main`.

## 9. Berkas Orientasi Cepat

| Area | Lokasi |
| --- | --- |
| API ePesantren | `apps/api/src/modules/pesantren/` |
| API/facade eSchool | `apps/api/src/modules/education/` |
| Katalog/RBAC eSchool | `apps/api/src/modules/education/rbac/` |
| UI admin ePesantren | `apps/web/src/pages/app/pesantren/` |
| UI education/eSchool | `apps/web/src/pages/app/education/` |
| Rute frontend | `apps/web/src/app/App.tsx` |
| Migrasi tenant pesantren | `apps/api/tenant-migrations/pesantren/` |
| Manifest migrasi | `apps/api/tenant-migrations/pesantren/manifest.json` |
| Penyimpanan BLOB tenant | `apps/api/src/infrastructure/files/tenant-file-blob.service.ts` |
| Resolver host publik | `apps/api/src/infrastructure/tenant/public-tenant-resolver.service.ts` |
| Seed Raudlatul Ulum | `scripts/onboard-raudlatul-ulum/seed.js` |
| Deploy produksi | `deploy/update.sh` |

## 10. Aturan yang Tidak Boleh Hilang Saat Handoff

- Jangan mengubah migrasi yang sudah pernah diterapkan; buat migrasi baru.
- Jangan lupa mendaftarkan migrasi modular ke manifest yang sesuai.
- Jangan commit token Cloudflare, password, `.env`, atau data produksi.
- Jangan menghapus perubahan worktree yang tidak dibuat sendiri.
- Jangan menganggap menu/katalog berarti workflow backend sudah lengkap.
- Jangan menyatakan format DAPODIK/EMIS resmi tanpa verifikasi versi pemerintah.
- Jangan memberi petugas gerbang kewenangan menyetujui izin.
- Jangan menghubungkan fingerprint sebelum vendor/SDK dan model perangkat jelas.
- Verifikasi dengan test, build, dan bila memungkinkan alur pengguna nyata.
