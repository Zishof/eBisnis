# Keputusan: `KasirLuringEngine` Tahan Terhadap Kegagalan `path_provider`

**Status:** Diimplementasikan 2026-08-08. **Diverifikasi:** kode ditinjau manual baris demi
baris (tidak ada Flutter SDK di sandbox ini). **Bukti nyata:** memicu langsung kegagalan
`flutter test` sungguhan pada GitHub Actions (run #19, commit 562b666) — 173 lulus, 13 gagal —
sebelum perbaikan ini dibuat.

## Masalah

`07-flutter-offline-checkout-fix.md` sudah mengungkapkan eksplisit bahwa perbaikan checkout
luring (`kasir_luring.dart`, `main.dart`) TIDAK PERNAH diverifikasi lewat `flutter analyze`/`flutter
test` sungguhan, karena sandbox audit ini tidak memiliki Flutter SDK. Tag rilis `pos-v0.1.16`
adalah verifikasi PERTAMA yang sungguhan — dan `flutter test` gagal.

Log gagal tidak dapat diambil dari sandbox ini (unduh log API butuh hak admin repo; tampilan
peramban tanpa masuk akun menolak menampilkannya) — hanya jumlah lulus/gagal yang berhasil
diambil lewat Checks API. Peninjauan kode manual menemukan **cacat nyata, independen dari log**:
`main.dart:388` (sebelum perbaikan ini) memanggil `getApplicationSupportDirectory()`
(`path_provider`) LANGSUNG dari `_aktifkanApotik` (jalur masuk apotik eMedik yang sungguhan
dijalankan, bukan di balik gerbang dart-define seperti jalur demo), TANPA try/catch. Kanal
platform `path_provider` tidak tersedia dalam lingkungan `flutter test` kecuali dimock secara
eksplisit — dan tidak ada satu pun test di repo ini yang memock kanal itu (`test/
inventory_local_database_test.dart` justru MENGHINDARINYA dengan menyuntik
`NativeDatabase.memory()` langsung, bukan memanggil path_provider). Ini melanggar dokumentasi
fungsi itu sendiri ("Tidak pernah melempar").

## Keputusan

### 1. `KasirLuringEngine.buat()` — satu titik masuk yang benar-benar tidak melempar

Logika `getApplicationSupportDirectory()` + `IdentitasBerkas(...).muat()` + `siapkan()` dipindah
dari `main.dart` ke `kasir_luring.dart` sebagai `static Future<KasirLuringEngine> buat(...)`,
dibungkus try/catch. `main.dart` sekarang hanya mendelegasikan.

Alasan pemindahan (bukan sekadar membungkus try/catch di tempat semula): logika ini adalah
tanggung jawab domain mesin luring, bukan widget — dan memindahkannya membuatnya dapat diuji
langsung lewat `import 'package:ebisnis_pos/mesin/kasir_luring.dart'`, tanpa perlu menembus
pohon widget `AplikasiKasir` yang tidak dapat diarahkan ke server palsu pada waktu jalan (base
URL-nya `String.fromEnvironment`, ditentukan saat kompilasi).

### 2. `KasirLuringEngine.takTersedia()` — degradasi eksplisit, bukan implisit

Saat `buat()` gagal, ia TIDAK mengembalikan `null` (yang akan memaksa setiap pemanggil menangani
nullability) melainkan `KasirLuringEngine.takTersedia(...)`: mesin sungguhan dengan identitas
sementara (`buatIdMesin()`, tidak disimpan ke disk) dan basis data in-memory. `luringTersedia`
otomatis `false` karena `siapkan()` tidak pernah dipanggil padanya (`_jatah` tetap null) — kasir
tetap dapat berjualan daring seperti biasa, hanya opsi luring yang tidak ditawarkan, persis
kontrak yang didokumentasikan `07-flutter-offline-checkout-fix.md`.

Basis data in-memory disetel eksplisit (bukan dibiarkan `_bukaDatabase()` default yang JUGA
memanggil `path_provider` secara lazy) supaya pemanggil `sinkronkan()`/`jumlahTertunda()` di masa
depan pada mesin degradasi ini tidak mewarisi kegagalan yang sama.

### 3. `siapkan()`: jalur cadangan sendiri dibungkus terpisah

`siapkan()` sudah punya try/catch untuk kegagalan jaringan, dengan jalur cadangan
`_muatJatahTersimpan()` (baca jatah tersimpan dari sesi sebelumnya). Jalur cadangan itu sendiri
bisa gagal (mis. basis data lokal juga tak terjangkau) — sebelumnya TIDAK dibungkus, sehingga
kegagalan ganda lolos ke pemanggil. Sekarang dibungkus try/catch terpisah, jatuh ke `_jatah =
null` (luring tidak tersedia) alih-alih melempar.

## Test baru: `test/kasir_luring_test.dart`

Sengaja TIDAK memock `path_provider` pada test pertama — lingkungan `flutter test` default sudah
persis kondisi yang harus ditangani, dan itulah yang diuji. Tiga skenario:

1. `KasirLuringEngine.buat()` tidak melempar dan `luringTersedia == false` ketika kanal
   `path_provider` tak terjangkau (kondisi asli `flutter test`, tanpa mock apa pun).
2. Siklus nyata: `siapkan()` selagi server loopback palsu hidup (jatah berhasil dipesan) →
   server ditutup (jaringan putus) → `bukukan()` tidak melempar, transaksi masuk antrean lokal
   dengan nomor struk yang benar.
3. Transaksi mode farmasi TIDAK pernah lewat jalur luring walau jatah tersedia (menegakkan
   batasan yang didokumentasikan `kasir_luring.dart`) — kegagalan jaringan tetap dilempar apa
   adanya untuk transaksi ini.
4. `sinkronkan()` mengirim ulang transaksi tertunda begitu peladen (server palsu baru) menjawab,
   dan antreannya kosong sesudahnya.

Pola server palsu (loopback `HttpServer` sungguhan, `PosApiClient` diarahkan ke portnya) mengikuti
persis yang sudah dipakai `test/pos_api_apotik_test.dart` — bukan pola baru.

## Yang TIDAK diketahui setelah perbaikan ini

Perbaikan ini menutup SATU cacat nyata yang ditemukan lewat peninjauan kode, dipicu oleh
kegagalan CI sungguhan. Tidak ada cara memastikan dari sandbox ini apakah ini SATU-SATUNYA
penyebab 13 test yang gagal pada run #19 — log mentahnya tidak terjangkau. Sebelum tag rilis
berikutnya: perhatikan jumlah lulus/gagal pada `flutter test` di CI; bila masih ada yang gagal,
log harus diambil oleh seseorang dengan akses repo (bukan dari sandbox audit ini) sebelum
menebak lebih jauh.
