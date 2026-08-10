# Bukti kesiapan surface dan rilis Inventory POS — 2026-08-10

## Ruang lingkup

Dokumen ini mencatat bukti terpisah untuk Web, Flutter Windows, dan Flutter
Android. Bukti navigasi tidak dianggap sebagai bukti transaksi, offline,
cetak/ekspor, rekonsiliasi, UAT perangkat fisik, atau verifikasi produksi.

Commit kandidat Android/Windows: `8f6684ae0292baa0da9558cd64f71369793996c1`.

## Baseline bersama

- CI: lulus pada [run 31388633657](https://github.com/Zishof/eBisnis/actions/runs/31388633657).
- Security: lulus pada [run 31388633723](https://github.com/Zishof/eBisnis/actions/runs/31388633723).
- E2E Web: lulus pada [run 31388633678](https://github.com/Zishof/eBisnis/actions/runs/31388633678).
- Flutter analyze dan 192 test: lulus pada job `Uji Inventory` di
  [run 31388645890](https://github.com/Zishof/eBisnis/actions/runs/31388645890).

## Web

- `inventoryRouteForLegacyScreen()` memetakan layar 1–48 ke 15 workspace
  operasional dan menolak nomor di luar kontrak.
- `InventoryControlPage` menampilkan daftar 48 layar dengan tautan `Buka`.
- Unit proof: `apps/web/src/pages/app/inventory-route-context.test.ts`.
- E2E screen 20 dan 30: `apps/web/e2e/auth-and-erp.spec.ts` pada run
  31388633678.
- E2E 15 route unik yang mewakili seluruh rentang 1–48 lulus pada
  [run 31389487478](https://github.com/Zishof/eBisnis/actions/runs/31389487478).
  Karena mapping 1–48 juga dijaga unit test dan kontrol daftar 48 berasal dari
  kontrak API yang sama, capability `view` Web dinaikkan ke
  `AUTOMATED_PROVEN`. Ini tetap bukan bukti visual final atau transaksi.

## Flutter Windows

- Pemetaan layar 1–48 diuji oleh
  `apps/pos-flutter/test/inventory_parity_navigation_test.dart`.
- Widget workspace utama, supplier, pembelian, dan penjualan diuji pada runner
  Windows sebelum build.
- Job `Bangun installer Windows Inventory` lulus pada run 31388645890,
  termasuk UAT navigasi, build release, perakitan Inno Setup, dan upload
  artifact `inventory-windows`.
- Kandidat `workflow_dispatch` tidak ditandatangani. Workflow menolak publikasi
  tag produksi bila `WINDOWS_CODE_SIGNING_PFX_BASE64` dan
  `WINDOWS_CODE_SIGNING_PASSWORD` belum berisi sertifikat Authenticode CA yang
  valid. Karena sertifikat tersebut belum tersedia, status distribusi Windows
  publik masih **BLOCKED oleh kredensial eksternal**, bukan oleh source/build.

## Flutter Android

- `inventory_android_uat_test.dart` membuka aplikasi flavor Inventory pada
  emulator, memastikan kontrol navigasi seluruh layar tersedia/aktif, dan
  membuka workspace lintas kelompok.
- Keystore produksi permanen dibuat di luar repository dan GitHub Actions
  secrets sudah diperbarui. Private key dan password tidak dicatat di evidence.
- Certificate SHA-256:
  `C4:2B:84:9F:58:8E:D1:F8:BF:12:56:DF:59:E7:50:91:41:01:E1:5C:1E:9E:B7:68:5A:BB:F1:D1:0E:58:62:D0`.
- Instalasi lama memakai debug certificate yang tidak konsisten. Rilis pertama
  dengan identity permanen membutuhkan satu kali uninstall/reinstall setelah
  outbox lokal tersinkron; rilis berikutnya dapat update in-place.
- Android instrumentation `connectedInventoryDebugAndroidTest` lulus pada
  [run 31399086263](https://github.com/Zishof/eBisnis/actions/runs/31399086263).
  Test membuka workspace lintas kelompok dan memastikan tombol layar 1–48
  tersedia serta aktif. Capability `view` Android karenanya dinaikkan menjadi
  `AUTOMATED_PROVEN`; ini bukan klaim UAT perangkat fisik atau transaksi.
- APK kandidat `0.1.26-uji` diverifikasi ulang setelah diunduh dari artifact:
  SHA-256 `c6d1ff40d9ca3a20747540300d03d7801fa272b4f3578c9e5e84ce4fa35d7428`,
  checksum sidecar cocok, dan certificate SHA-256 cocok dengan identitas
  permanen di atas.

## Kandidat Windows final

- Installer `0.1.26-uji` dari run 31399086263 memiliki SHA-256
  `4291640a371fcc2f077b91e8611c0a571b69ad62810694c6f47533ce24e63409`;
  checksum sidecar cocok.
- Pemeriksaan Authenticode lokal menghasilkan `NotSigned`. Kandidat dapat
  dipasang untuk UAT, tetapi publikasi stabil tetap diblokir sampai sertifikat
  code-signing CA dan password tersedia sebagai secret workflow.

## Batas klaim

Run otomatis bukan UAT perangkat Android fisik, uji printer/laci/barcode nyata,
sertifikasi Authenticode, maupun persetujuan bisnis. Item tersebut tidak boleh
ditandai `DEVICE_UAT_PROVEN` atau `PRODUCTION_VERIFIED` tanpa bukti operator.
