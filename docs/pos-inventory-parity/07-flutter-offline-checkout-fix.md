# 07. Flutter POS Offline Checkout — Fix (UNVERIFIED, needs Flutter SDK)

**Status: kode ditulis, TIDAK TERVERIFIKASI.** Tidak ada Flutter SDK pada mesin audit ini (lihat
`00-repository-baseline.md`), sehingga `flutter analyze`, `flutter test`, `flutter build windows`,
dan `flutter build apk` **belum bisa dijalankan sama sekali**. Menurut kriteria DONE dokumen
perintah (POS-14), perbaikan ini **BUKAN DONE** sampai keempat perintah itu benar-benar lulus.
Wajib dijalankan sebelum commit/release.

## Masalah yang diperbaiki

Temuan `06-p1-pos-core-findings.md`: checkout kasir Flutter (`PosApiClient.bukukan()`, dipakai
langsung sebagai `pembukuan` di `main.dart`) membuat idempotency key baru dari jam saat itu pada
SETIAP percobaan, tanpa penyimpanan lokal. Retry setelah gagal jaringan menjadi transaksi baru di
mata peladen, bukan pengiriman ulang yang aman — padahal peladen sudah punya jalur luring yang
benar (`PosOfflineService.terima`, idempoten pada `offlineId`, karantina untuk kasus yang perlu
diperiksa manusia) yang sama sekali tidak dipakai klien Flutter.

## Perubahan

- **`apps/pos-flutter/lib/mesin/kasir_luring.dart`** (baru) — `KasirLuringEngine`: mesin
  orkestrasi yang (1) memesan/memuat jatah nomor struk selagi daring, (2) mencoba jalur daring
  biasa lebih dahulu, (3) jatuh ke pembangunan transaksi lokal + antrean idempoten HANYA ketika
  sudah diketahui luring dari percobaan sebelumnya, atau reaktif hanya pada `SocketException`
  (sinyal terkuat request sama sekali tidak tersambung — `TimeoutException`/`HttpException` TETAP
  dilempar apa adanya, sebab request itu mungkin sudah diproses peladen dan mengantre ulang
  berisiko membukukan dua kali). `offlineId` dibuat SEKALI dan disimpan SEBELUM percobaan kirim
  apa pun.
- **`apps/pos-flutter/lib/api/pos_api.dart`** — 3 method publik baru (murni aditif, tidak ada
  method lama yang diubah): `pesanJatahStruk`, `jatahStrukAktif`, `kirimTransaksiLuring`,
  membungkus endpoint `/pos/offline/receipt-blocks` dan `/pos/offline/sales` yang sudah ada di
  peladen.
- **`apps/pos-flutter/lib/main.dart`** — mengganti `koneksi: KeadaanKoneksi.daring` yang
  di-hardcode dan `pembukuan: (t) => client.bukukan(...)` pada KEDUA titik masuk (`_aktifkanApotik`,
  `_pilihSumberKasir`) dengan mesin baru. `layar_kasir.dart` (1.909 baris, UI kasir) **tidak
  disentuh sama sekali** — pemisahan lewat `typedef PembukuanKasir` yang sudah ada di
  `layar/sumber.dart` membuat ini murni soal mengganti implementasi yang di-wire, bukan mengubah UI.

Antrean lokal memakai kembali tabel `InventoryOutboxItems` (Drift, sudah ter-generate dan
terbukti kompilasi lewat `inventory_local_database.g.dart`) — TIDAK menambah tabel/skema Drift
baru, sebab itu memerlukan `dart run build_runner build` yang tidak dapat dijalankan di mesin ini;
menghasilkan kode generated secara manual tanpa compiler untuk memverifikasinya dinilai terlalu
berisiko. Basis datanya sendiri terpisah dari milik fitur Inventory
(`ebisnis_pos_luring.sqlite`, bukan `ebisnis_inventory_sales.sqlite`) supaya antrean POS tidak
pernah terputar ulang lewat sesi masuk fitur Inventory bila keduanya terpasang pada perangkat yang
sama. **Tidak ada dependency baru ditambahkan ke `pubspec.yaml`.**

## Bug yang ditemukan dan diperbaiki SEBELUM sempat terkirim

`HasilBaris.toJson()` (dipakai di tempat lain untuk keperluan lain) menyertakan field `name`, yang
TIDAK ada pada `BarisLuringDto` peladen. Dengan `forbidNonWhitelisted: true` global (`main.ts`),
mengirim field itu akan membuat SETIAP transaksi luring ditolak validasi. Payload dibangun manual
field-per-field di `kasir_luring.dart`, bukan memakai `toJson()` mentah.

## Batasan yang disengaja (bukan lupa)

1. **Mode farmasi (resep/racikan/produksi) tidak mendapat jalur luring.** Kontrak
   `TransaksiLuringDto` pada peladen belum membawa field lot/resep/formula. Menambahkannya adalah
   perubahan kontrak API terpisah yang lebih besar, di luar cakupan perbaikan ini.
2. **Lencana status sambungan belum reaktif langsung (live).** `koneksi:` diisi dari status mesin
   SAAT LOGIN, bukan dari stream yang diperbarui berkelanjutan — mengubah ini butuh mengubah
   `layar_kasir.dart` (`widget.koneksi` dari `KeadaanKoneksi?` statis menjadi `ValueListenable`),
   yang sengaja tidak disentuh pada gelombang ini untuk menjaga cakupan perubahan tetap kecil dan
   dapat ditinjau. Perilaku KESELAMATAN DATA (tidak ada transaksi ganda) tidak bergantung pada
   lencana ini — itu bekerja dari pelacakan sambungan riil di dalam `KasirLuringEngine` sendiri.
3. **Kasir tidak (belum) melihat pembeda "terkirim langsung" vs "diantre".** `PembukuanKasir`
   hanya mengembalikan `String? nomorStruk`; nomor struknya SAH pada kedua kasus (dari jatah nyata,
   bukan placeholder), tetapi tidak ada sinyal terpisah yang sampai ke layar. `sinkronkan()` dan
   `jumlahTertunda()` sudah tersedia di mesin untuk fase berikut yang ingin menambah indikator ini.
4. **Belum ada pemanggil `sinkronkan()` otomatis** (listener sambungan / timer berkala). Antrean
   akan terkirim pada percobaan `bukukan()` berikutnya yang berhasil menembus jaringan, tetapi
   tidak ada dorongan aktif saat sambungan pulih tanpa transaksi baru.
5. **Tidak ada test Dart baru ditulis** untuk `kasir_luring.dart`. `_JatahLokal` privat terhadap
   library (per-file) sehingga tidak dapat diuji langsung dari luar tanpa direstrukturisasi;
   pengujian jalur `bukukan()`/`sinkronkan()` memerlukan mock `HttpClient` seperti pola yang sudah
   dipakai `test/pos_api_apotik_test.dart`. Direkomendasikan sebagai langkah berikut, bukan
   ditambahkan blind di sini.

## Wajib dijalankan sebelum menganggap ini selesai

```powershell
cd apps/pos-flutter
flutter pub get
dart format --output=none --set-exit-if-changed .
flutter analyze
flutter test
flutter build windows --release
flutter build apk --release
```

Serta uji manual: buka shift → putus jaringan (matikan Wi-Fi/data) → transaksi → nyalakan kembali
→ pastikan tidak ada transaksi ganda pada `/pos/offline/quarantine` maupun `pos_sale`, dan struk
yang tercetak saat luring memakai nomor dari jatah yang benar (bukan tabrakan dengan transaksi
daring lain pada register yang sama).
