








# Hospitality / MitraInap changelog

## 2026-08-09 — MI-0 audit

- Memverifikasi seluruh checksum paket dokumen V14 terhadap manifest.
- Membuat worktree/branch khusus Hospitality dari baseline `e45abbd`.
- Mengaudit source, PostgreSQL `ebisnis`, platform/tenant migration, API, Web, dua aplikasi Flutter, offline foundation, test, CI, dan `deploy/update.sh`.
- Menetapkan keputusan REUSE/EXTEND/ADAPTER/CREATE dan requirement ledger awal.
- Belum menambah model, migration, endpoint, route, UI, seed, atau konfigurasi deployment Hospitality pada fase audit ini.

## 2026-08-09 — Integrasi MI-1 sampai MI-10 (parsial)

- Mengintegrasikan portal, public site, pendaftaran/provisioning, property dan room inventory, guest CRM, reservation, direct booking, serta rate management ke baseline `main` terbaru tanpa menimpa perbaikan POS/Inventory yang lebih baru.
- Menambahkan enam tenant migration Hospitality yang additive dan satu platform migration untuk kode vertical `HOSPITALITY`.
- Mengubah public booking agar tenant selalu diselesaikan dari trusted host oleh `PublicTenantResolver`; schema tenant tidak lagi diterima dari URL atau diekspos ke browser.
- Menambahkan regression test isolasi trusted-host untuk public booking.
- Menerapkan platform migration dan keenam tenant migration secara lokal ke 13 schema terdaftar; dry-run awal dan eksekusi akhir lulus tanpa schema gagal.
- Menambahkan `ensure-demo-mitrainap.sh`, Apache alias MitraInap, dan integrasi paralel yang ditunggu oleh `deploy/update.sh` sebelum deploy stamp.
- Verifikasi: API lint/build dan 167 suite/4.122 test lulus; Web lint/typecheck/build dan Vitest lulus; migration verifier dan syntax check Bash lulus.
- MI-2, MI-3, dan MI-5..MI-10 tetap dicatat parsial sampai seluruh acceptance BRD masing-masing fase terpenuhi; MI-4 dan MI-12..MI-24 belum diklaim selesai.

## 2026-08-09 — MI-11 Channel Manager (parsial)

- Menambahkan account dan mapping property/room/rate yang provider-neutral.
- Menambahkan canonical ARI/reservation delivery queue dengan idempotency key, correlation ID, stable payload hash, retry limit, acknowledgement, dan dead-letter status.
- Menambahkan reconciliation exception queue untuk seluruh kategori exception minimum BRD §18.4.
- Menyamarkan credential dan data kartu sebelum payload disimpan; contract test membuktikan sanitasi, hash deterministik, retry/DLQ, test double, dan status `BLOCKED_PROVIDER_INPUT`.
- Menambahkan API tenant-scoped untuk account, mapping, enqueue, queue health, dan reconciliation list; seluruhnya dilindungi permission server-side.
- Migration diterapkan tanpa kegagalan ke 13 schema lokal. Live OTA/GDS/metasearch adapter tidak dibuat sebelum dokumentasi dan credential provider tersedia; worker pengiriman dan UI dashboard masih gap MI-11.

## 2026-08-09 — MI-4 Product, Entitlement, dan Provisioning

- Menambahkan produk `MITRAINAP`, tujuh modul capability yang sudah nyata, empat feature entitlement, dan dependency graph tervalidasi pada shared platform catalog.
- Menambahkan paket published `MITRAINAP_CONSULTATION` dengan `PRICE_CONFIGURATION_REQUIRED`, CTA `REQUEST_QUOTE`, dan tanpa satu pun baris harga; seed tidak menghapus atau menimpa harga resmi bila kelak dikonfigurasi.
- Pendaftaran Hospitality sekarang menuntut katalog siap dan membuat package assignment tenant dalam transaksi yang sama dengan aktivasi vertical/domain. Seed membackfill tenant Hospitality lama secara idempotent.
- Menambahkan sepuluh usage-meter contract dari dokumen master. Event SAMPLE/DEMO/TEST/TRAINING/REVERSED valid tetapi tidak billable.
- Menambahkan endpoint health tenant untuk katalog, entitlement assignment, tabel schema wajib, dan usage contract. Shared role/menu/support seed tetap dipakai; tidak ada engine kedua.
- Memperbaiki resequence `schema_migration_catalog` secara atomik: sequence lama diparkir sementara di ruang negatif dalam transaksi sebelum urutan canonical ditulis ulang. Riwayat/version/checksum migration tenant tidak disentuh.
- Master seed lokal lulus dua kali berturut-turut. Bukti database: produk/paket MitraInap memiliki 7 modul, 4 fitur, dan 0 harga.
