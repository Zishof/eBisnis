# Rilis dan pembaruan klien kasir

Bagaimana `.exe` dan `.apk` dibangun, diterbitkan, dan ditemukan kembali oleh
mesin kasir yang sudah memasangnya.

---

## 1. Satu hal yang belum dapat diselesaikan sendiri

**Repo `Zishof/eBisnis` bersifat privat.** Rilis GitHub pada repo privat **tidak
dapat diunduh publik** — pengunduhnya harus punya akses repo. Alur rilis di sini
tetap berjalan dan tetap menghasilkan berkasnya, tetapi tautan unduhannya belum
dapat dibagikan kepada gerai.

Tiga jalan keluar, dan ketiganya keputusan pemilik:

| Jalan | Akibatnya |
| --- | --- |
| Repo dibuka menjadi publik | Seluruh kode ikut terbuka, termasuk riwayatnya. Perlu pemeriksaan rahasia menyeluruh lebih dahulu |
| Repo publik terpisah khusus rilis | Kode tetap privat; alur ini mengunggah aset ke repo lain. Perlu satu token dengan hak tulis pada repo itu |
| Berkasnya ditaruh di peladen eBisnis | Tidak bergantung GitHub sama sekali. Sisi aplikasi sudah siap: `PEMBARUAN_URL` menerima alamat mana pun yang menjawab dengan bentuk yang sama |

Sisi aplikasi **tidak perlu berubah** apa pun yang dipilih. Yang berubah hanya
satu argumen saat dibangun.

---

## 2. Menerbitkan

```bash
git tag pos-v1.2.0
git push origin pos-v1.2.0
```

Tagnya berlingkup (`pos-v…`) karena repo ini memuat banyak aplikasi; klien kasir
tidak boleh ikut terbit setiap kali ada tag lain. Awalannya dikupas kembali oleh
`bersihkanTag` di sisi aplikasi.

Alurnya — [`.github/workflows/rilis-pos.yml`](../../.github/workflows/rilis-pos.yml):

1. **Uji** — `flutter analyze` dan `flutter test`, termasuk vektor konformansi
   yang mengikat aturan uang klien ini dengan klien web. Rilis yang lolos di
   sini tidak mungkin menghitung uang berbeda dari kasir web.
2. **Windows** — `flutter build windows`, lalu Inno Setup merakitnya menjadi satu
   pemasang `.exe`.
3. **Android** — `flutter build apk`.
4. **Terbitkan** — melampirkan berkasnya ke rilis GitHub.

`workflow_dispatch` menjalankan tahap 1–3 tanpa menerbitkan apa pun, untuk
memastikan pemasangnya benar-benar jadi sebelum sebuah tag dibuat.

### Menandai pembaruan wajib

Tulis `[WAJIB]` pada catatan rilis. Aplikasi membacanya dan mengatakan kepada
kasir bahwa versi yang berjalan memuat cacat yang tidak boleh dibiarkan.

Dipakai dengan sangat hemat: pembaruan wajib menghentikan kasir di tengah hari
kerja, dan itu hanya sebanding bila yang ditutupnya menyangkut uang atau data.

---

## 3. Penandatanganan

### Windows

Pemasangnya **belum ditandatangani kode**. Windows SmartScreen akan
memperingatkan pada pemasangan pertama sampai sertifikat penandatangan dibeli dan
dipasang pada alur rilis. Itu mengganggu, tetapi tidak menghalangi.

### Android — permanen, dan tidak dapat diperbaiki belakangan

Android menolak memasang pembaruan yang ditandatangani kunci berbeda dari yang
terpasang. Satu-satunya jalan keluarnya adalah kasir **mencopot** aplikasinya
lebih dahulu — dan mencopot aplikasi kasir berarti menghapus buku transaksi
luring yang belum terkirim.

Karena itu:

- Keystore **dicadangkan di tempat yang bertahan lebih lama daripada laptop
  siapa pun**, dan tidak pernah masuk Git.
- APK berkunci debug **tidak pernah** dilampirkan ke rilis. Tanpa rahasia
  penandatanganan, alurnya tetap membangun APK tetapi hanya sebagai artefak
  workflow, dan rilisnya mengatakan mengapa APK-nya tidak ada.

Empat rahasia yang perlu disetel pada repo:

| Rahasia | Isi |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Berkas `.jks` yang dikodekan base64 |
| `ANDROID_STORE_PASSWORD` | Kata sandi keystore |
| `ANDROID_KEY_PASSWORD` | Kata sandi kunci |
| `ANDROID_KEY_ALIAS` | Nama alias kunci |

Membuat keystore-nya:

```bash
keytool -genkey -v -keystore rilis.jks -keyalg RSA -keysize 2048 -validity 10000 -alias ebisnis-pos
```

---

## 4. Pemeriksaan pembaruan di sisi aplikasi

### Apa yang dilakukannya

Ia memeriksa, lalu **memberi tahu**. Ia tidak mengunduh, tidak memasang, dan
tidak menjalankan apa pun.

Mengganti berkas aplikasi kasir di tengah hari kerja adalah tindakan yang harus
dipilih manusia, pada saat yang ia pilih sendiri — dan gerai umumnya memperbarui
sesudah tutup.

### Kapan ia memeriksa

Sekali saat aplikasi dibuka, lalu setiap enam jam. Cukup untuk mesin yang
dibiarkan menyala berhari-hari, cukup jarang untuk tidak membebani jaringan
gerai.

**Pemeriksaan otomatis tidak pernah membuka dialog.** Ia hanya menyalakan tanda
pada tombol *Cek pembaruan* di bilah atas. Dialognya hanya terbuka ketika kasir
menekannya sendiri — jendela yang muncul sendiri di atas layar kasir akan ditutup
dengan tekanan tombol yang sedang dituju jari.

### Aturan yang dijaga uji

| Aturan | Bila dilanggar |
| --- | --- |
| Versi dibandingkan sebagai **angka**, bukan teks | `1.10.0` dianggap lebih lama daripada `1.2.0`, dan pembaruan tidak pernah ditawarkan — tanpa satu pun galat |
| Turun versi **tidak pernah** ditawarkan | Versi lama membaca buku transaksi yang ditulis versi baru |
| Alamat unduhan wajib **https** | Siapa pun di jaringan gerai dapat menukar pemasangnya, dan layar kasir tetap menulis "pembaruan tersedia" |
| Aset dipilih menurut platform | Mesin Windows menerima `.apk` yang tidak melakukan apa-apa ketika dibuka |
| Gagal memeriksa **bukan** "sudah terbaru" | Mesin kasir tertinggal berbulan-bulan tanpa ada yang curiga |
| Rilis draf dan pratayang dilewati | Berkas yang tidak dapat diunduh siapa pun di gerai |
| Pratayang lebih **tua** daripada rilis dengan angka sama | Mesin yang menjalankan beta tidak pernah ditawari rilis resminya |

Seluruhnya di `apps/pos-flutter/test/versi_test.dart` (17 uji) dan
`test/sumber_pembaruan_test.dart` (21 uji).

### Menyetel sumbernya

```bash
# Bawaan: rilis terakhir repo GitHub
flutter build windows --dart-define=PEMBARUAN_REPO=Zishof/eBisnis

# Diperantarai peladen eBisnis — bentuk jawabannya sama
flutter build windows --dart-define=PEMBARUAN_URL=https://api.ebisnis.id/pos/rilis-terakhir
```

Versi yang berjalan disuntikkan alur rilis lewat `--dart-define=VERSI=…`. Nilai
bawaannya wajib sama dengan `version:` pada `pubspec.yaml`, dan itu **dijaga
uji** — bukan kebiasaan.

---

## 5. Memasang di gerai

### Windows

Pemasangnya berjalan **tanpa hak administrator** dan menempatkan aplikasinya di
folder pengguna. Mesin kasir di gerai umumnya memakai akun terbatas, dan meminta
kata sandi administrator setiap kali memperbarui berarti pembaruannya tidak
pernah dijalankan.

Pemasangan berikutnya menimpa yang lama di tempat yang sama. `AppId` pada
`pemasang.iss` **permanen**; bila diubah, pemasang berikutnya memasang aplikasi
kedua berdampingan — dua ikon, dua penyimpanan lokal, dan kasir yang membuka yang
salah lalu tidak menemukan transaksinya.

Mencopot aplikasi **tidak** menghapus data. Pencopotan yang paling sering terjadi
adalah pencopotan untuk memasang ulang.

### Android

APK dipasang langsung dari berkas; perangkat perlu mengizinkan pemasangan dari
sumber selain Play Store. Nomor bangunnya diambil dari nomor jalannya alur rilis,
sehingga selalu naik — Android menolak memasang APK dengan nomor bangun yang sama
atau lebih kecil daripada yang terpasang.
