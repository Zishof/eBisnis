# Changelog

Seluruh perubahan penting pada eBisnis.id dicatat di berkas ini.

Format mengikuti prinsip [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added

- **Role default Indonesia disemai otomatis saat tenant mendaftar.** Setiap
  tenant baru kini memperoleh 124 role siap pakai — dari Kasir POS, Kepala
  Gudang, dan Akuntan Buku Besar sampai Penyetuju Payroll dan Auditor Internal —
  lengkap dengan hak per menu, batas data, dan aturan pemisahan tugas. Tidak
  perlu lagi menyusun hak akses satu per satu sebelum sistem dapat dipakai.
- Batas data per role: pemegang role bergudang hanya melihat gudang yang
  ditugaskan kepadanya, kasir hanya terminalnya sendiri, dan karyawan hanya
  datanya sendiri.
- Pemisahan tugas ditegakkan saat role ditetapkan, bukan sekadar dicatat.
  Penyiap jurnal tidak dapat sekaligus menjadi penyetujunya; pemesan barang,
  penerima barang, dan pembayar tagihan tidak dapat dirangkap satu orang.
  Pengecualian tetap dimungkinkan, tetapi wajib beralasan, ada penyetujunya,
  dan ada tanggal berakhirnya.
- Empat aksi hak baru: Kembalikan, Delegasikan, Jurnal Balik, dan Baca Audit.
- Perintah `pnpm migrate:tenants` untuk menyusulkan migration dan role baru pada
  tenant yang sudah berjalan, dengan mode `--dry-run` untuk melihat lebih dulu.
- Audit Versi 8 fase V8-0 pada `docs/upgrade-v8/`: kondisi saat ini, inventaris
  menu, matriks gap konten bantuan, matriks gap impor/ekspor, inventaris
  role/duty/privilege, rancangan login Google, dan rencana implementasi.

- Audit Versi 6 fase V6-0 pada `docs/upgrade-v6/`: inventaris kondisi saat ini,
  status regression Versi 5, matriks gap V5→V6, inventaris database dan
  migration, inventaris route API dan UI, baseline pengujian, risk register,
  rencana upgrade additive, dan rencana perubahan version control.
- Karakterisasi SOP legacy pada `docs/upgrade-v6/workflow/`: inventaris class,
  peta state runtime, aturan resolusi aktor, dan keputusan reuse/redesign.
- ADR-007 sampai ADR-011 untuk Versi 6: referral pada control plane, kepemilikan
  effective-dated, routing tenant berbasis host, workflow yang mengorkestrasi
  service yang sama, dan accounting event engine.
- Laporan migrasi Git pada `docs/git-migration/`.
- Berkas `.gitignore` dan `CHANGELOG.md`.

- Berkas deployment untuk Ubuntu 22.04: konfigurasi Apache, unit systemd,
  skrip `install.sh` dan `update.sh` dengan backup dan rollback otomatis,
  contoh environment produksi, serta skrip pembuatan akun pedagang.
- Panduan instalasi dan pembaruan pada `docs/deployment/ubuntu.md`.

- Build frontend memakai `@rollup/wasm-node`, sehingga tidak lagi bergantung
  pada binary native rollup yang menuntut GLIBC 2.32.

### Changed

- **Workspace resmi berpindah ke `C:\opt\eBisnisGithub`.**
- **Source of truth berpindah dari SVN ke GitHub** (`Zishof/eBisnis`, private).
  `C:\opt\eBisnis` menjadi legacy read-only dan tidak lagi dipakai untuk
  pengembangan. SVN tidak lagi dipakai untuk commit, update, maupun deployment.
- Identitas versi memakai Git commit SHA dan tag, bukan revisi SVN.
- Enam role lama (`OWNER`, `MANAGER`, `CASHIER`, `PURCHASING_STAFF`,
  `WAREHOUSE_STAFF`, `DEMO_USER`) **tidak dihapus**, hanya ditandai sebagai role
  lama dan dipetakan ke padanan barunya. Pengguna yang sudah memegangnya tetap
  bekerja seperti biasa.
- Penyemaian izin role kini dikelompokkan per 500 baris, sehingga pendaftaran
  tenant tetap cepat meski jumlah role bertambah dari 6 menjadi 130.

### Security

- Kredensial dalam bentuk teks biasa diredaksi dari dokumentasi sebelum masuk
  repository: connection string pada ADR-005, kredensial pada
  `MASTER_PROMPT_EBISNIS_V5.md`, dan contoh Swagger pada endpoint login.
- Kata sandi super admin pada smoke test tidak lagi di-hardcode; nilainya berasal
  dari `SMOKE_ADMIN_PASSWORD` atau `BOOTSTRAP_SUPER_ADMIN_PASSWORD`.
- `.gitignore` menutup `.env`, private key, sertifikat, dump database, log, dan
  data runtime agar tidak pernah ikut ter-commit.
- Menaikkan `glob` transitif ke `^10.5.0` untuk menutup GHSA-5j98-mcp5-4vw2
  (command injection pada CLI `glob`).
- CI memindai secret pada seluruh riwayat commit dan mengaudit dependency setiap
  push serta setiap pekan.
- Kredensial integrasi bank dan payment pada source legacy `docs/input/`
  diredaksi: API key Bank Kaltimtara, application id, kata sandi VA Esmartlink,
  serta secret key QRIS dan VA JARING. Temuan ini berasal dari gitleaks, bukan
  dari scan manual, dan tercatat pada
  `docs/development/security-incident-2026-07-30-legacy-credentials.md`.

### Fixed

- Sesi demo memakai `platform_user_id` yang valid sehingga `/auth/me` tidak lagi
  gagal; schema demo kini memiliki `user_subject` beserta role `DEMO_USER`.
- Sidebar portal tenant merender menu sampai tingkat ketiga; sebelumnya modul
  pada tingkat tersebut tidak pernah tampil.
- Simulasi diskon menyaring evaluasi berdasarkan kode program yang benar;
  sebelumnya filter selalu bernilai benar sehingga hasilnya tidak tersaring.
- Batas rate limit dapat dikonfigurasi lewat environment sehingga pengujian
  otomatis tidak tertolak oleh limit produksi.

### Known issues

- Kredensial integrasi bank pada source legacy masih ada di riwayat commit
  `a463093`. Rotasi kredensial oleh pemilik integrasi bersifat wajib;
  pembersihan riwayat memerlukan keputusan tersendiri.
- Proteksi branch GitHub tidak aktif karena memerlukan GitHub Pro untuk
  repository privat. Mitigasi lokal berupa hook `pre-push` tersedia; lihat
  `docs/development/branch-protection.md`.
- Endpoint CRUD master, termasuk purge, belum memverifikasi permission
  (`PermissionGuard` keluar lebih awal bila handler tanpa metadata permission).
  Rencana perbaikan ada pada `docs/upgrade-v6/08-upgrade-plan.md` fase V6-0.x.
- Dua schema tenant artefak uji tercatat `V000/FAILED` pada registry padahal
  migration V008 sudah diterapkan. Orkestrator migration berikutnya harus
  menghitung versi dari riwayat, bukan dari registry.
- Client Orval belum pernah digenerate; frontend masih memakai tipe manual.
- Enam advisory `high` masih terbuka pada dependency produksi (`multer`,
  `lodash`, `js-yaml`), seluruhnya transitif dari NestJS 10 dan memerlukan
  upgrade mayor framework. Terdaftar beserta rencananya pada
  `docs/development/security-debt.md`. Tidak ada temuan `critical`.

[Unreleased]: https://github.com/Zishof/eBisnis/commits/main
