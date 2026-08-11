# Perintah Awal — POS Apotik & POS eMedik (Flutter)

Salin **seluruh blok di bawah** ke sesi Codex atau Claude Code yang baru.
Berlaku untuk keduanya.

> **Sebelum menyalin: isi dulu blok `PILIHAN JALAN`.** Bila dibiarkan `BELUM
> DIPUTUSKAN`, sesi barunya akan berhenti di langkah 0 dan meminta keputusan —
> itu memang perilaku yang diinginkan, bukan kegagalan.

> **Sesi baru sebaiknya dibuka di `C:\opt\CodeBaseDesktopDanMobile`.** Dokumen
> serah-terima lengkapnya ada di repo eBisnis
> (`docs/session-notes/2026-08-11-handover-pos-apotik-emedik-flutter.md`) dan
> **tidak terlihat dari sana** — karena itu perintah di bawah membawa sendiri
> fakta-fakta yang menentukan.

---

```text
Kerjakan POS Apotik dan POS eMedik sebagai VARIAN BARU pada basis kode Flutter
yang sudah ada. Bahasa kerja: Indonesia. Komentar dan pesan commit: Indonesia.

===============================================================================
PILIHAN JALAN  —  isi salah satu, hapus yang lain
===============================================================================
[ ] JALAN 1 — Semua di AIS/Java. POS Apotik memakai modul SIRS yang sudah ada.
[ ] JALAN 2 — Semua di NestJS. Lanjutkan eBisnis/apps/pos-flutter.
[ ] JALAN 3 — Cangkang zishof-platform, backend NestJS.
[x] BELUM DIPUTUSKAN — berhenti di LANGKAH 0 dan minta keputusan.

===============================================================================
FAKTA YANG SUDAH DIPERIKSA  —  jangan diselidiki ulang, jangan diabaikan
===============================================================================

REPOSITORI
  C:\opt\CodeBaseDesktopDanMobile  = Zishof/zishof-platform (Flutter, monorepo)
       apps/ebisnis         81 berkas Dart
       packages/core_*      9 paket bersama
  Zishof/AIS                       = backend JAVA ("eCampus/eSchool/ePesantren
                                     versi Java"), cabang master
  C:\opt\AIS                       = BUKAN checkout Git. Direktori sumber +
                                     ratusan .zip tambalan.
  C:\opt\eBisnisGithub-emedik      = Zishof/eBisnis (NestJS + React + Flutter
                                     kedua di apps/pos-flutter)

  >> Klon Zishof/AIS yang sebenarnya sebelum menyunting satu baris pun Java.
     Menyunting C:\opt\AIS berarti bekerja tanpa riwayat dan tanpa cara
     membatalkan.

SUDAH ADA DUA APLIKASI POS FLUTTER, KEDUANYA MENYASAR APOTEK
  zishof-platform/apps/ebisnis  -> backend Java Api_eBisnis (servlet
                                   ais.action.servlet.ApiEBisnis)
  eBisnis/apps/pos-flutter      -> backend NestJS, sudah menunjuk
                                   https://apotik.emedik.id/api/v1/
  Keduanya TIDAK berbagi basis data.

SUDAH ADA MODUL RUMAH SAKIT DI AIS
  ais/action/master/sirs/**  = 191 berkas Java: rekam medis, booking
  registrasi, dokter, alat medis, gudang, deposit, asuransi, kartu pasien.
  >> JANGAN membangunnya ulang. Yang diminta POS Apotik, bukan SIRS kedua.

MEKANISME VARIAN FLUTTER (satu basis kode, banyak produk)
  lib/app_variant.dart     konstanta compile-time; juga menggerakkan
                           windows/variant.cmake
  lib/product_profile.dart profil runtime; entrypoint memanggil bootstrap(profil)
  Keduanya WAJIB konsisten — dijaga cocokDenganDartDefine().
  Preseden yang harus ditiru: varian 'inventory_sales'.
    flutter build windows -t lib/main_inventory_sales.dart \
      --dart-define=EBISNIS_VARIANT=inventory_sales

MEKANISME MENU (sisi Java)
  Tbmrole.ebisnisMenu   = SATU kolom JSON {"menu":{"kunci":bool,...},...}
  ais/common/EbisnisMenuKatalog.java = katalog tunggal. JavaDoc-nya menyatakan:
      "Menambah menu baru = tambah baris di sini — TIDAK perlu ALTER TABLE."
  KUNCI_DEFAULT_NONAKTIF = himpunan kunci yang default-nya FALSE (fail-closed).
      Presedennya seluruh kunci MODUL_INVENTORY_SALES.
  PosApi.java (~baris 922)      = menyusun aksesMenu untuk klien Flutter
  TbmroleAction.java (~b. 2226) = layar admin Grup Pengguna, dirender dari DAFTAR
  Tbmrole.emedic                = kolom Boolean yang SUDAH ADA, gerbang tingkat
                                  modul untuk peran medis (sejajar kantin,
                                  tampilPos, akunting)

===============================================================================
LANGKAH 0  —  bila JALAN belum diputuskan
===============================================================================
Baca ulang blok PILIHAN JALAN. Bila masih "BELUM DIPUTUSKAN":
  1. Ringkas ketiga jalan beserta ongkosnya dalam maksimal 10 baris.
  2. Beri SATU rekomendasi beserta alasannya.
  3. BERHENTI. Jangan menulis kode apa pun sampai dijawab.

===============================================================================
LANGKAH 1  —  menu POS baru (sisi Java; berlaku pada JALAN 1 dan 3)
===============================================================================
Dapat dikerjakan lebih dulu — tidak bergantung pada klien mana pun.

1.1  Klon Zishof/AIS. Buat cabang: feature/menu-pos-apotik
1.2  Survei dulu, jangan menebak: untuk tiap menu yang akan ditambahkan,
     periksa apakah layar SIRS-nya SUDAH ADA di ais/action/master/sirs/.
     Bila sudah, kuncinya harus menunjuk layar itu.
1.3  EbisnisMenuKatalog.java:
       (a) tambah konstanta MODUL_APOTIK dan MODUL_EMEDIK
       (b) tambah baris Entri untuk tiap menu
       (c) masukkan SELURUH kunci baru ke KUNCI_DEFAULT_NONAKTIF
1.4  PosApi.java: kirim tiap kunci baru secara EKSPLISIT bernilai false.
       aksesMenu.put("apotik_kasir", menuTersimpan.optBoolean("apotik_kasir", false));
     Perhatikan bedanya dengan kunci lama yang default-nya true.
     Bila sudah ada jalur terpusat yang membaca KUNCI_DEFAULT_NONAKTIF, pakai
     itu — periksa dulu, jangan menulis false satu per satu tanpa melihat.
1.5  Seed idempoten peran, meniru SalesInventoryHelper.java:
       Grup "Apotik"          -> apotik_* NYALA
       Grup ber-emedic = true -> emedik_* NYALA, apotik_* MATI
       Grup POS/kantin lama   -> seluruhnya MATI
     Seed HANYA menyetel kunci yang BELUM pernah tersimpan. Role yang sudah
     disunting admin tidak boleh ditimpa.

1.6  BUKTIKAN, jangan laporkan selesai:
       - buka role POS lama di layar Grup Pengguna -> seluruh menu baru TIDAK
         tercentang;
       - login sebagai role Apotik pada klien Flutter -> menu apotek muncul;
       - jalankan APK versi LAMA terhadap peladen baru -> tetap berjalan.

===============================================================================
LANGKAH 2  —  varian Flutter
===============================================================================
2.1  Tiru pola 'inventory_sales' persis:
       lib/app_variant.dart      isApotik = kode == 'apotik'
       lib/product_profile.dart  AppProductProfile.apotik() + FiturGrup.apotik
       lib/main_apotik.dart      entrypoint -> bootstrap(AppProductProfile.apotik())
       windows/variant.cmake     varian Windows
       assets/images/apotik/     ikon
2.2  Uji kombinasi build yang SALAH (entrypoint dan dart-define tidak cocok).
     cocokDenganDartDefine() harus berteriak. Build yang tidak cocok
     menghasilkan aplikasi yang TAMPAK benar dan berperilaku seperti varian
     lain — itu sebabnya uji ini wajib.

===============================================================================
LANGKAH 3  —  layar, menurut urutan ini
===============================================================================
FASE A — kasir yang dapat dipakai. Salin kasir_screen.dart sebagai dasar.
  Yang membedakan apotek, dan seluruhnya WAJIB:
    - tebus resep: memilih resep, bukan mengetik obat satu per satu;
    - batch & kedaluwarsa: yang paling dekat kedaluwarsa didahulukan, dan
      obat kedaluwarsa TIDAK BOLEH dapat dijual sama sekali. Peringatan saja
      bukan penahan;
    - obat terkendali (narkotika/psikotropika): bila catatannya tidak dapat
      dibuat, transaksinya DITAHAN — bukan dilanjutkan diam-diam;
    - obat mirip (LASA): ditampilkan berbeda, bukan berurutan rapi.
FASE B — persediaan: formularium, batch/expiry, pengadaan PBF, opname, retur.
FASE C — laporan: laporan apotek, obat terkendali, kedaluwarsa.

===============================================================================
YANG TIDAK BOLEH DIKERJAKAN
===============================================================================
- Jangan menyunting C:\opt\AIS (bukan repo Git).
- Jangan membangun ulang modul SIRS.
- Jangan membuat aplikasi Flutter KETIGA. Tambah varian.
- Jangan menyentuh kunci menu lama (kasir, produk, dst.) — default-nya true
  dan role lama bergantung padanya.
- Jangan menyalakan menu baru secara bawaan untuk role mana pun selain yang
  disebut 1.5.
- JANGAN menyamakan hak apoteker dengan tenaga medis. Yang menjual obat bukan
  yang memeriksa pasien. Pembanding yang sudah berjalan: pada eMedik NestJS,
  apoteker memegang PRESCRIPTION READ + REVIEW tanpa CREATE — ia menelaah
  resep, tidak menulisnya.
- Jangan mengandalkan klien untuk menutup menu baru. Sesi.bolehMenu berbawaan
  TRUE, sehingga kunci yang hilang berarti BOLEH.
- Jangan menganggap eMedik NestJS dan SIRS Java berbagi data. Tidak.
- Jangan menyimpan kredensial pada repositori, log, atau prompt.
- Jangan reset/drop basis data. Jangan menimpa .env. Jangan force push.

===============================================================================
CARA BEKERJA
===============================================================================
- Selidiki dulu, tulis kemudian. Nama medan dan kunci yang ditebak tidak
  menghasilkan galat kompilasi — ia menghasilkan layar kosong.
- Tiap perubahan logis: kode + uji + dokumentasi + commit + push + worktree
  bersih. Pesan commit menjelaskan MENGAPA, bukan hanya apa.
- Uji yang tidak dapat gagal tidak membuktikan apa pun. Sebelum melaporkan
  sebuah uji lulus, coba buat ia gagal sekali.
- Bila sebuah aturan membuat langkah yang sah menjadi mustahil, curigai
  aturannya — bukan orang yang mencoba melakukannya.
- Laporkan yang belum selesai sebagai belum selesai. Angka yang tidak dapat
  dibuktikan bukan kelulusan.
```

---

## Bila JALAN 2 yang dipilih

Ganti LANGKAH 1 dan 2 dengan:

```text
Kerjakan pada C:\opt\eBisnisGithub-emedik (Zishof/eBisnis), bukan zishof-platform.
  Klien   : apps/pos-flutter (36 berkas Dart, sudah menunjuk apotik.emedik.id)
  Menu    : demo.menu + demo.role_menu_permission; polanya ada pada migrasi
            apps/api/tenant-migrations/H0NN__health__menu_truth_*.sql
  Backend : vertikal eMedik V12 SUDAH menyediakan resep, eMAR, dispensing,
            formularium, dan klaim. Baca docs/emedik/ sebelum menambah apa pun.
  Peran   : 43 peran kesehatan sudah tersemai beserta pemisahan wewenangnya —
            lihat docs/emedik/25-uat-persona.md. Tiru, jangan buat yang baru.
  Bukti   : apps/api/scripts/prove-health-uat-persona.mjs dan
            prove-health-journey.mjs harus tetap lulus.
```
