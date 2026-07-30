# Changelog

Seluruh perubahan penting pada eBisnis.id dicatat di berkas ini.

Format mengikuti prinsip [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Security

- **Endpoint yang tidak menyatakan hak aksesnya kini ditolak, bukan diloloskan.**
  Sebelumnya pemeriksaan hak dilewati begitu saja bila sebuah endpoint lupa
  diberi keterangan hak akses — dan 32 dari 157 endpoint memang belum
  memilikinya, termasuk **seluruh tambah, ubah, dan hapus data master**.
  Ketiga puluh dua endpoint itu kini menyatakan haknya, dan aplikasi menolak
  menyala bila ada endpoint baru yang lupa. (Temuan V6-0-F03.)
- **Batas data mulai benar-benar menyaring.** Sejak Versi 8 sistem menyimpan
  bahwa seorang kepala gudang hanya berhak atas gudangnya, tetapi tidak
  menegakkannya. Kini pemegang batas gudang, outlet, brand, atau departemen
  hanya melihat baris milik penugasannya. Yang belum ditugaskan melihat **nol
  baris**, bukan seluruhnya.
- Penugasan batas data kini per orang, bukan per role, sehingga dua kepala
  gudang dapat memegang gudang yang berbeda.
- **Kredensial penyedia pembayaran tidak pernah melewati catatan tiket.**
  Formulir khusus yang menuntut verifikasi ulang identitas adalah satu-satunya
  jalan masuk; tiket hanya mencatat bahwa kredensial sudah diisi. Balasan tiket
  dibaca banyak orang dan tersimpan selamanya.
- Setiap pembukaan kredensial tercatat beserta alasannya, termasuk yang gagal.
- Hak mengelola credential pembayaran dipisahkan dari administrator toko dan
  menuntut verifikasi tambahan. Petugas layanan pelanggan tidak dapat melihat
  credential maupun menyetujui refund; packer dan picker tidak dapat mengubah
  pesanan.

### Added

- **Aktivasi pembayaran online.** Tenant dapat meminta aktivasi akun eSmartlink
  langsung dari Pusat Aktivasi; sistem membuka tiket dukungan dan menautkannya.
  Menekan tombol dua kali tidak membuat tiket kembar.
- Kredensial pembayaran disimpan terenkripsi dan berversi. Rotasi tidak menimpa
  nilai lama, sehingga kredensial yang keliru dapat dikembalikan tanpa meminta
  ulang ke penyedia. Setelah tersimpan, yang terlihat hanya empat karakter
  terakhir.
- Uji kesiapan akun pembayaran beserta riwayatnya.

- **Fondasi marketplace: tenant dapat mendaftar sebagai penjual.** Pusat
  Aktivasi Marketplace menampilkan pemeriksaan kesiapan beserta alasan yang
  dapat ditindaklanjuti — bukan sekadar "belum siap". Pendaftaran berjalan
  melalui 14 tahap yang dapat maju dan mundur sebagaimana kenyataannya, dan
  platform yang memutuskan kapan sebuah toko boleh berjualan.
  Halamannya tersedia di **Pusat Aktivasi Marketplace** pada portal tenant,
  lengkap dalam empat bahasa. Syarat yang belum tersedia pada versi ini
  ditandai berbeda dari syarat yang gagal — yang pertama menunggu fitur
  berikutnya, yang kedua menunggu tindakan Anda.
- 15 kelompok menu marketplace baru: aktivasi, toko online, katalog online,
  penjualan online, pembayaran, reservasi, fulfillment, retur, promosi,
  pelanggan, performa toko, operasi platform, tiket, dan bantuan. Menu
  pengiriman yang sudah ada diperluas, bukan digandakan.
- 33 role marketplace: dari Pengelola Katalog Online, Picker, dan Packer sampai
  Penyetuju Refund dan Moderator Produk Marketplace.
- 14 hak baru termasuk Terbitkan, Ambil Barang, Kemas, Kirim, Setujui Retur,
  Setujui Refund, dan Kelola Credential.
- Perintah `pnpm route:audit` yang memeriksa seluruh endpoint menyatakan hak
  aksesnya, dapat dipakai sebagai gerbang sebelum rilis.
- Audit Versi 9 fase V9-0 pada `docs/upgrade-v9/`: kondisi source, status
  penerapan Versi 8, matriks gap 67 requirement, peta model marketplace,
  inventaris kapabilitas eSmartlink, kendala pembayaran dan settlement, peta
  order/fulfillment/pengiriman, delta menu-role-permission, register 30 risiko
  keamanan, rencana implementasi 16 fase, baseline pengujian, peta pemakaian
  ulang tabel, serta inventaris route API dan UI.

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
