# Aplikasi Warga Desa

Kanal warga untuk vertikal **info-desa**, sesuai slide *KANAL WARGA* pada
presentasi Sistem Informasi Desa: *"Android, iOS, dan web responsif. Ajukan
surat, lapor, lihat pengumuman, dan pantau layanan dari genggaman."*

Flutter 3.27 · Dart 3.6

---

## Menjalankan

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3100/api/v1
```

`10.0.2.2` adalah alamat host dari emulator Android. Untuk perangkat sungguhan,
isi dengan alamat peladen yang dapat dijangkau ponsel.

```bash
flutter test        # 31 pengujian aturan, tanpa perangkat maupun peladen
flutter analyze
flutter build apk --dart-define=API_BASE_URL=https://desa.contoh.id/api/v1
```

---

## Bentuknya

```
lib/
  domain/rules.dart      aturan murni — diuji tanpa perangkat dan tanpa peladen
  data/api_client.dart   token, envelope, dan pembedaan galat jaringan
  data/village_api.dart  endpoint yang dipakai; tidak satu pun mencari warga
  ui/                    layar
```

Aturan diletakkan terpisah dari widget dengan sengaja: aturan yang hanya hidup
di dalam widget hanya dapat diuji dengan menjalankan aplikasinya, dan yang hanya
dapat diuji begitu jarang diuji.

---

## Empat keputusan yang menentukan bentuknya

### 1. Refresh token pada penyimpanan aman sistem, bukan SharedPreferences

Web menyimpannya pada `sessionStorage` (ADR-006); ponsel tidak punya
padanannya — aplikasi ditutup dan dibuka berkali-kali sehari.

`SharedPreferences` bukan jawabannya: di sana ia berkas biasa di dalam sandbox
aplikasi, dan sandbox itu terbuka pada perangkat yang di-root — yang di desa
jauh lebih banyak daripada yang diperkirakan. Dipakai `flutter_secure_storage`:
Keystore pada Android, Keychain pada iOS.

Access token tetap **hanya di memori**, sama seperti web.

### 2. "Tanpa nama" tidak pernah disebut anonim

Aplikasi ini memakai akun, sehingga peladen **selalu** tahu siapa yang mengirim.
Menyebut pilihan itu "anonim" adalah janji yang tidak dapat ditepati aplikasi
mana pun yang memakai akun — dan warga yang mengadukan perangkat desanya sendiri
mempercayai janji itu.

Karena itu pilihannya bernama *"Jangan tampilkan nama saya"*, uraiannya
menyatakan terus terang bahwa petugas desa tetap dapat melihatnya, dan warga
yang memerlukan anonim sungguhan diarahkan ke **anjungan** di kantor desa —
satu-satunya jalur yang benar-benar tidak menyimpan identitas.

Dijaga pengujian: tidak ada nilai enum yang mengandung kata "anonim".

### 3. Lokasi yang dikirim adalah lokasi kejadian, bukan lokasi ponsel

Melampirkan GPS otomatis berarti aplikasi melacak di mana warganya berada setiap
kali ia melapor. Lebih buruk lagi, ia salah: orang yang melaporkan jalan rusak
biasanya melaporkannya sesudah sampai rumah, bukan sambil berdiri di lubangnya.

Yang dikirim adalah keterangan tempat yang **ditunjuk warga**. Posisi ponsel
hanya dipakai bila warga menekannya sendiri.

### 4. Draf tidak dibuang ketika pengiriman gagal

Sinyal di desa putus-putus. Warga yang kehilangan tulisannya karena sinyal
hilang tidak akan mengetiknya lagi — ia akan berhenti memakai aplikasinya.

Galat jaringan juga dibedakan dari penolakan peladen: yang pertama dapat
diperbaiki warga sendiri dengan pindah tempat, yang kedua tidak.

---

## Yang sudah jalan

| Menu | Keadaan |
|---|---|
| Lapor / Aduan | **Jalan** — kirim, pilih mode nama, keterangan tempat |
| Masuk & pulihkan sesi | **Jalan** — token aman, rotasi refresh, perpanjang otomatis |
| Beranda & tautan akun | **Jalan** — menu terkunci menjelaskan syaratnya |
| Ajukan Surat | Endpoint siap (`POST /village/portal/requests`); layar menyusul |
| Jadwal Posyandu | Endpoint siap; **menunggu eMedik** — sampai tersambung ia menyatakan "belum tersambung", bukan jadwal karangan |
| Info Bantuan | Endpoint siap; layar menyusul |
| Pengumuman | Endpoint siap; layar menyusul |

Menu yang layarnya belum ada **tidak disembunyikan** dan tidak diam ketika
ditekan — ia mengatakan sedang disiapkan. Tombol yang tidak bereaksi membuat
orang mengira aplikasinya rusak.

---

## Yang belum

- **Foto pada pengaduan.** Presentasi menjanjikannya. Perlu unggah berkas, yang
  di Core masih `BLOCKED` (V8-7 tidak pernah dibangun).
- **Notifikasi.** Presentasi menyebut "notifikasi status surat & aduan".
  Menunggu kredensial penyedia — sama dengan siaran WhatsApp pada D-10, yang
  berstatus `TERHALANG` dan tidak berpura-pura terkirim.
- **iOS belum diuji di perangkat.** Hanya Android yang sudah dibangun sampai APK.
