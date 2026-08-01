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
| Ajukan Surat | **Jalan** — dua tab: ajukan baru, dan pantau statusnya |
| Lapor / Aduan | **Jalan** — kirim, pilih mode nama, keterangan tempat |
| Pengumuman | **Jalan** — berita, agenda, dan program bantuan |
| Info Bantuan | **Jalan** — status milik sendiri beserta riwayat penyaluran |
| Jadwal Posyandu | **Jalan** — menampilkan "belum tersambung" dengan jujur sampai eMedik siap |
| Masuk & pulihkan sesi | **Jalan** — token aman, rotasi refresh, perpanjang otomatis |
| Beranda & tautan akun | **Jalan** — menu terkunci menjelaskan syaratnya |

Kelima menu presentasi sudah berfungsi.

### Ajukan Surat

Dua tab, sebab presentasi menjanjikan dua hal sekaligus: *"Ajukan surat &
pantau statusnya."*

Pengajuan langsung menerbitkan **kode ambil**. Inilah yang menyambungkan
"ajukan dari rumah" dengan "cetak sendiri di anjungan" — warga yang mengajukan
lewat aplikasi tidak perlu mengantre dua kali. Kodenya ditampilkan sebesar
mungkin dan dapat disalin: yang kehilangannya harus mengantre, persis yang
hendak dihindari aplikasi ini.

Daftar permohonan menampilkan **label yang dapat dibaca**, bukan kode dalam
huruf besar, dan status yang menuntut warga bertindak menyebutkan tindakannya.
"Berkas belum lengkap" tanpa keterangan membuat warga menunggu sesuatu yang
tidak akan datang.

### Pengumuman

Berita, agenda, dan program bantuan dalam **satu pemanggilan**, bukan tiga:
sinyal desa putus-putus, dan tiga pemanggilan berarti tiga kesempatan gagal pada
satu layar.

Memakai jalur portal yang menentukan desanya dari **sesi**, bukan slug pada
alamat. Aplikasi yang membawa slug akan menampilkan desa lain begitu slugnya
salah sekali — dan warga tidak akan menyadarinya, sebab pengumuman desa tetangga
terlihat sama masuk akalnya.

**Program bantuan ditampilkan; penerimanya tidak.** Daftar penerima pada
aplikasi yang dipegang seluruh warga adalah pengumuman siapa yang miskin di desa
ini — dan pada aplikasi, ia dapat difoto layar lalu disebarkan. Layar menyatakan
hal itu terus terang alih-alih membiarkan warga menebak mengapa namanya tidak
ada di mana pun.

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

### Jadwal Posyandu — keadaan ketiga

Layar ini punya tiga keadaan, bukan dua. Selain "ada isi" dan "gagal", ada
**"belum tersambung"** — dan itu keadaan yang paling sering terjadi sekarang,
sebab eMedik adalah vertikal tersendiri.

| Ditampilkan sebagai | Yang disimpulkan warga | Yang ia lakukan |
|---|---|---|
| Galat | Aplikasinya rusak | Menutup, mencoba besok, lalu menyerah |
| Kosong | Posyandu memang tidak ada jadwal | **Tidak datang** |
| Belum tersambung | Fiturnya belum siap | Bertanya ke kader — yang benar |

Yang kedua paling berbahaya: ibu-ibu menyimpulkan Posyandu bulan ini
ditiadakan, lalu tidak membawa balitanya.

Karena itu layarnya memakai ikon dan warna netral — bukan merah — menjelaskan
apa yang akan tampil nanti, lalu menyebutkan jalan yang sudah ada sekarang
(tanya kader Posyandu atau bidan desa).

Galat jaringan tetap ditampilkan sebagai galat: itu memang dapat diperbaiki
warga dengan pindah tempat, dan berbeda dari kanal yang belum tersambung.

### Info Bantuan — hanya keadaan diri sendiri

Pengumuman menampilkan **program apa saja yang dibuka**. Layar ini menjawab
pertanyaan yang sebenarnya ditanyakan warga: *"apakah saya termasuk?"*

Tiga keadaan: penerima, sedang dinilai, atau belum terdaftar. Yang penerima
melihat **riwayat penyalurannya** — sudah cair atau belum, itu yang paling
ingin diketahui.

Tidak ada daftar penerima lain, dan tidak akan pernah ada.

**Alasan penolakan tidak muncul di layar ini**, meskipun tersimpan pada
`village_aid_candidate.rejection_reason`. D-7 menetapkan bahwa warga yang tidak
menerima bantuan berhak mendapat jawaban **dari seseorang** — dan layar ponsel
bukan seseorang. Kalimat "penghasilan Anda terlalu tinggi" yang muncul sendirian
di layar, tanpa ada yang dapat ditanyai balik, lebih melukai daripada
menjelaskan.

Layar menyampaikan keputusannya, lalu mengarahkan ke kantor desa — tempat ada
orang yang dapat menjelaskan dan mencatat keberatan. Warnanya pun sengaja bukan
merah: "belum terdaftar" bukan kesalahan warga.
