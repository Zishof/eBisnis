# Changelog — Vertical Kesehatan (eMedik)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` global.

---

## H-7 — Gawat darurat, kamar operasi, dan perawatan intensif

### Ditambahkan

- **`H012__health__acute_care.sql`** — `ed_visit`, `ed_triage_change`,
  `ot_theatre`, `ot_case`, `ot_checklist`, `ot_count`, `icu_stay`,
  `icu_assessment`.
- **`H013__health__acute_permissions.sql`** — aksi `TRIAGE`, `CHECKLIST`,
  `INCISE`; dua menu baru; empat peran baru; dua aturan pemisahan wewenang.
- **`health-acute.ts`** — aturan sebagai fungsi murni: penentuan triase, batas
  tunggu, urutan antrean, daftar periksa keselamatan bedah, izin memulai
  sayatan, hitungan kasa, penjadwalan kamar operasi, skor perawatan intensif,
  dan disposisi. **60 pengujian.**
- **`health-acute.service.ts`** dan **`health-acute.controller.ts`** — tiga
  belas jalan pada `/api/v1/health/acute/**`.
- **`EmergencyPage.tsx`** — papan gawat darurat pada web.
- **`prove-health-acute.mjs`** — naskah bukti, 55 pemeriksaan, seluruhnya lulus
  pada percobaan pertama. Dijalankan dengan lima pengguna.

Uji: API 1360 → **1420**. Web 64 → **69**.

### Invarian yang ditegakkan basis data

- **Jeda sebelum sayatan tidak dapat dicentang belakangan** — constraint
  `ot_case_timeout_before_incision`. Daftar periksa yang diisi setelah
  operasinya selesai tidak menahan apa pun; ia hanya membuat berkasnya tampak
  rapi, padahal ia satu-satunya penahan yang tersisa untuk operasi salah sisi
  dan salah pasien.
- **Satu kamar operasi, satu operasi pada satu waktu** — constraint pengecualian
  `EXCLUDE USING gist` atas rentang waktu terjadwal. Dua penjadwalan bersamaan
  sama-sama melihat kamarnya kosong; yang kedua baru ketahuan ketika tim datang
  menemukan kamarnya terpakai, lalu pasien yang sudah berpuasa sejak tengah
  malam ditunda. Rentangnya setengah terbuka sehingga operasi berikutnya boleh
  dimulai tepat saat yang sebelumnya berakhir.
- **Tingkat triase akhir tidak pernah lebih ringan daripada yang diusulkan.**
- **"Pergi tanpa dilihat" hanya untuk pasien yang belum pernah dilihat dokter.**

Naskah bukti menembus dua yang pertama lewat `INSERT`/`UPDATE` langsung.
Keduanya ditolak.

### Keputusan yang perlu dicatat

- **Tanda bahaya MENAIKKAN tingkat triase, tidak pernah menurunkannya.** Triase
  yang terlalu rendah lebih berbahaya daripada yang terlalu tinggi: yang pertama
  membuat pasien menunggu berjam-jam sementara penyakitnya berjalan terus; yang
  kedua hanya membuang waktu petugas. Petugas boleh menilai lebih gawat daripada
  tanda vitalnya — ia melihat pasiennya, sistem tidak.

- **Tingkat yang diusulkan dan tingkat akhir disimpan keduanya**, dan selisihnya
  ditampilkan di layar. Petugas yang melihat penilaiannya dinaikkan sistem akan
  menilai lebih cermat lain kali; yang tidak pernah melihatnya tidak akan.

- **Menurunkan tingkat menuntut alasan; menaikkan tidak.** Penurunan tingkatlah
  yang membuat pasien menunggu lebih lama, dan di sanalah tekanan antrean paling
  mudah menyusup. Riwayatnya tidak dapat diubah.

- **Lima tingkat triase, bukan tiga.** Tiga tingkat memaksa "kuning" menampung
  pasien yang harus dilihat dalam sepuluh menit bersama pasien yang dapat
  menunggu satu jam — dan yang pertama akan menunggu selama yang kedua.

- **Yang mengisi daftar periksa bukan yang menyayat.** Jeda sebelum sayatan
  adalah percakapan tim, bukan centang satu orang. Bila yang mengisi juga yang
  menyayat, ia hanya mengonfirmasi kepada dirinya sendiri apa yang sudah
  diyakininya.

- **Sisi yang ditandai dibandingkan dengan persetujuan tindakan.** Bila berbeda,
  jawabannya bukan peringatan melainkan penolakan dengan kata "HENTIKAN".

- **Butir daftar periksa yang terlewat dilaporkan NAMANYA.** "Enam dari tujuh"
  tidak memberi tahu siapa pun butir mana yang terlewat.

- **Hitungan kasa yang tidak cocok menahan, tetapi ada jalan keluarnya.**
  Menahannya tanpa jalan keluar sama sekali akan membuat orang mematikan
  sistemnya, dan sistem yang dimatikan tidak menahan apa pun. Penghitung kedua
  tidak boleh sama dengan penghitung pertama — hitungan oleh satu orang bukan
  hitungan ganda.

- **Dukungan organ ganda selalu kritis apa pun skornya.** Pasien dengan
  ventilator dan vasopresor sekaligus adalah pasien yang tanda vitalnya tampak
  baik justru karena mesin yang menahannya.

- **Pada layar, tingkat triase menjadi blok warna besar**, dan hanya tingkat 1
  dan 2 berwarna pekat. Perawat yang berdiri di tengah IGD ramai tidak membaca
  tabel; ia memindai warna.

### Belum dikerjakan

Rekam anestesi berkelanjutan, ruang pemulihan beserta skor Aldrete, dialisis,
onkologi, rehabilitasi, gigi, kesehatan jiwa, serta kebidanan dan neonatal.
Kelima yang terakhir menuntut model datanya sendiri dan lebih tepat menjadi fase
tersendiri daripada disisipkan di sini.

---

## H-6 — Rawat inap: penerimaan, tempat tidur, keperawatan, dan pemulangan

### Ditambahkan

- **`H010__health__inpatient.sql`** — `health_admission`,
  `health_bed_assignment`, `health_nursing_observation`,
  `health_discharge_summary`; `health_room` dan `health_bed` diperluas.
- **`H011__health__inpatient_permissions.sql`** — dua menu, satu peran baru
  (Petugas Bangsal), dan aksi `UPDATE` pada `HEALTH_BED`.
- **`health-inpatient.ts`** — aturan sebagai fungsi murni: penempatan tempat
  tidur, isolasi, jenis kelamin kamar bersama, peta status tempat tidur,
  perpindahan, pemulangan, lama rawat, skor peringatan dini, dan keterlambatan
  pengamatan. **53 pengujian.**
- **`health-inpatient.service.ts`** dan **`health-inpatient.controller.ts`** —
  delapan jalan pada `/api/v1/health/inpatient/**`.
- **`WardPage.tsx`** — papan bangsal dan pembersihan tempat tidur pada web.
- **`prove-health-inpatient.mjs`** — naskah bukti, 41 pemeriksaan, seluruhnya
  lulus.

Uji: API 1307 → **1360**. Web 59 → **64**.

### Invarian yang ditegakkan basis data

- **Satu tempat tidur, satu pasien** — indeks unik parsial pada
  `health_bed_assignment (bed_id) WHERE released_at IS NULL`. Naskah bukti
  menembusnya dari dua arah: lewat API, dan lewat `INSERT` langsung. Keduanya
  ditolak. Itulah maksud menegakkannya di basis data — aturan yang hanya ada di
  layanan berhenti berlaku begitu ada jalan kedua menuju tabelnya, dan pada
  tabel penempatan selalu ada jalan kedua.
- **Satu perawatan, satu tempat tidur.**
- **Satu pasien, satu perawatan inap aktif** — pasien yang tercatat dirawat di
  dua tempat akan memperoleh dua jadwal obat, dua daftar pemeriksaan, dan dua
  tagihan tanpa ada bagian sistem yang dapat memutuskan mana yang benar.

### Keputusan yang perlu dicatat

- **Tempat tidur yang baru ditinggalkan bukan tempat tidur yang kosong.**
  Perpindahan `OCCUPIED → AVAILABLE` sengaja tidak ada pada peta status; ia
  wajib melewati `CLEANING`. Menempatkan pasien baru di tempat tidur yang belum
  dibersihkan adalah cara paling langsung memindahkan infeksi dari pasien yang
  sudah pulang kepada pasien yang baru masuk — dan yang kedua tidak akan pernah
  tahu dari mana ia mendapatkannya. Pada layar, statusnya disebut "menunggu
  pembersihan", bukan "kosong".

- **Nilai kritis yang belum diterima menahan pemulangan** — kecuali pada
  kematian. Sambungan nyata pertama antara H-5 dan H-6: pasien yang pulang
  membawa kalium 7,2 yang belum pernah dibaca adalah kejadian yang berakhir di
  ruang gawat darurat pada malam yang sama.

- **Pulang paksa TIDAK ditolak.** Menolaknya berarti menahan orang di rumah
  sakit di luar kehendaknya, dan itu bukan wewenang sistem. Yang dituntut adalah
  alasannya tercatat, ditegakkan constraint, supaya kelak dapat dibedakan dari
  pasien yang pulang karena sudah sembuh.

- **Isolasi diperiksa sebelum jenis kelamin.** Bila keduanya bermasalah, yang
  disebut haruslah yang membahayakan pasien lain, bukan yang membuat tidak
  nyaman. Isolasi udara menuntut kamar tanpa penghuni lain.

- **Pasien biasa mengisi kamar berpenghuni; pasien isolasi diberi kamar
  kosong.** Menyebar pasien ke kamar-kamar kosong terdengar ramah, tetapi
  menghabiskan kamar yang esok hari dibutuhkan pasien isolasi.

- **Skor peringatan dini disimpan, bukan dihitung ulang saat dibaca.** Tanda
  vital yang tidak diukur dilaporkan sebagai tidak diukur — menganggapnya normal
  menghasilkan skor rendah pada pasien yang justru belum diperiksa. Pada layar,
  labelnya menyebut tindakan yang dituntut ("Amati tiap 30 menit"), bukan
  sekadar tingkatnya.

- **Lama rawat dihitung per hari kalender yang DILEWATI**, bukan per 24 jam.
  Pasien yang masuk pukul 23.00 dan pulang pukul 08.00 memakai tempat tidur pada
  dua hari, dan dua hari itulah yang tidak dapat dijual kepada orang lain.

- **`health_room` dan `health_bed` diperluas, bukan dibuat ulang.** H001 sudah
  membuat keduanya; nama kolomnya diikuti apa adanya (`bed_status`, bukan
  `status`) karena mengganti nama kolom yang sudah applied berarti mengubah
  migrasi yang sudah berjalan.

- **Pengamatan keperawatan tidak dapat diubah maupun dihapus.** Ia catatan
  keadaan pasien pada satu saat, dan menjadi dasar keputusan berikutnya.

### Cacat yang ditemukan naskah bukti

Satu parameter dipakai sebagai nilai kolom sekaligus pembanding di dalam `CASE`,
sehingga Postgres menolak dengan "inconsistent types deduced for parameter $2"
dan tempat tidur tidak pernah dapat dinyatakan bersih — yang berarti tidak ada
tempat tidur yang pernah dapat dipakai kedua kalinya. Seluruh pengujian unitnya
lulus; aturannya memang benar, yang salah SQL-nya.

### Belum dikerjakan

Permintaan tempat tidur berantre, ronde terjadwal, rencana asuhan keperawatan
berbasis diagnosis keperawatan, dan rekonsiliasi obat saat masuk dan pulang.

---

## H-5 — Laboratorium dan radiologi: pesanan, spesimen, hasil, dan nilai kritis

### Ditambahkan

- **`H008__health__laboratory.sql`** — delapan tabel: `lab_test_catalog`,
  `lab_reference_range`, `lab_order`, `lab_order_item`, `lab_specimen`,
  `lab_result`, `lab_result_amendment`, `lab_critical_notification`.
- **`H009__health__laboratory_permissions.sql`** — aksi `RECEIVE` dan `AMEND`,
  lima menu laboratorium, tiga peran baru (Analis Laboratorium, Penanggung
  Jawab Laboratorium, Radiografer), dan dua aturan pemisahan wewenang.
- **`health-lab.ts`** — aturan sebagai fungsi murni: pemilihan rentang rujukan
  menurut umur dan jenis kelamin, penilaian hasil, pemeriksaan delta,
  penerimaan spesimen, verifikasi otomatis, pelepasan, penyampaian nilai
  kritis, amandemen, dan pengurutan daftar kerja. **64 pengujian.**
- **`health-lab.service.ts`** dan **`health-lab.controller.ts`** — dua belas
  jalan pada `/api/v1/health/lab/**`.
- **`LabPage.tsx`** — daftar kerja dan nilai kritis pada web.
- **`prove-health-lab.mjs`** — naskah bukti, 44 pemeriksaan, seluruhnya lulus.
  Dijalankan dengan empat pengguna: dokter, perawat, analis, penyelia.

Uji: API 1243 → **1307**. Web 54 → **59**.

### Keputusan yang perlu dicatat

- **Nilai kritis punya tabelnya sendiri, bukan kolom pada hasil.** Satu nilai
  kritis dapat disampaikan berkali-kali sebelum ada yang menerimanya, dan
  setiap percobaan itu berharga ketika kelak ditanya mengapa hasilnya terlambat
  sampai. Catatannya terbuka **sendiri** begitu hasilnya dinilai kritis;
  menunggu seseorang menekan tombol berarti nilai kritis yang terlupa tidak
  meninggalkan jejak bahwa ia pernah ada.

- **Penerimaan menuntut bacaan ulang, dan dicocokkan di peladen.** Penerima
  mengulang angkanya kepada penyampai — satu-satunya cara mengetahui bahwa yang
  terdengar sama dengan yang diucapkan. Ditegakkan constraint basis data pula,
  supaya tidak dapat dilewati lewat jalan lain menuju tabelnya.

- **Rentang rujukan bergantung umur DAN jenis kelamin**, dan yang dipakai
  **disalin** ke baris hasilnya. Rentang berubah ketika alat diganti; hasil
  tahun lalu harus tetap dapat dijelaskan dengan rentang tahun lalu.

- **Batas kritis wajib berada di luar rentang normal**, ditegakkan constraint.
  Penandaan kritis yang sering keliru adalah penandaan yang akan diabaikan.

- **Hasil tanpa rentang yang berlaku dinyatakan belum dapat dinilai, bukan
  normal** — di layanan maupun di layar, di mana ia sengaja tidak berwarna
  hijau.

- **Verifikasi otomatis tidak pernah untuk nilai kritis**, tidak pernah ketika
  delta mencurigakan, dan tidak pernah untuk pemeriksaan yang tidak ditandai.

- **Spesimen tanpa label tidak pernah diterima**, dan pesanannya ikut ditolak
  supaya tidak duduk selamanya di daftar kerja tanpa ada yang tahu pasiennya
  harus diambil ulang.

- **Verifikator bukan pemasuk hasil, dan penerima nilai kritis bukan
  penyampainya.** Keduanya menjadi aturan pemisahan wewenang, dan yang pertama
  ditegakkan constraint pula — dengan pengecualian verifikasi otomatis, di mana
  yang memasukkan hasilnya adalah alat, bukan orang.

- **Nilai kritis ditempatkan di atas daftar kerja, bukan di tab tersendiri.**
  Tab tersendiri berarti seseorang harus memilih untuk melihatnya, dan
  laboratorium yang sibuk tidak memilih — ia mengerjakan apa yang ada di depan
  mata.

### Cacat yang ditemukan naskah bukti, bukan pengujian unit

Basis data menyimpan hasil sebagai `NUMERIC(18,6)` dan mengembalikannya sebagai
`"7.200000"`; dokter yang mengulang angkanya di telepon mengetik `"7,2"`.
Perbandingan teks menolak keduanya sebagai tidak cocok — sehingga **setiap**
penerimaan nilai kritis yang sah akan gagal. Pengujian unitnya lolos karena
membandingkan `"6.2"` dengan `"6.2"`, nilai yang tidak pernah melewati basis
data. Penolakan yang selalu terjadi adalah penolakan yang akan dicarikan jalan
memutar, tepat pada langkah yang paling tidak boleh dilewati. Perbandingannya
kini dilakukan sebagai angka bila keduanya angka, sebagai teks bila bukan, dan
pesan galatnya menyebut angka seperti yang diucapkan — bukan seperti disimpan.

### Belum dikerjakan

Laboratorium rujukan luar, antarmuka alat (HL7/ASTM), pemesanan berpaket, dan
PACS/DICOM. Yang terakhir tetap **terhalang**: yang disimpan baru rujukan citra,
sebab menyimpan berkas utuh di basis data relasional akan membengkakkan cadangan
sampai tidak dapat dipulihkan pada saat dibutuhkan. Arsitektur penyimpanannya
menunggu keputusan Core.

---

## H-4 — Farmasi: resep, telaah apoteker, penyerahan, dan pemberian obat

### Ditambahkan

- **`H006__health__pharmacy.sql`** — tujuh tabel: `rx_drug_master`,
  `rx_interaction`, `rx_prescription`, `rx_prescription_line`, `rx_dispensing`,
  `rx_administration`, `rx_incident`.
- **`H007__health__pharmacy_permissions.sql`** — aksi `ADMINISTER`, empat menu
  farmasi, dua peran baru (Apoteker, Tenaga Teknis Kefarmasian), serta dua
  aturan pemisahan wewenang beserta sisi perannya.
- **`health-medication.ts`** — aturan keselamatan obat sebagai fungsi murni:
  pencocokan alergi terhadap zat aktif, interaksi, kewajaran dosis, terapi
  ganda, penandaan obat, kelayakan penyerahan, dan enam benar. **60 pengujian.**
- **`health-pharmacy.service.ts`** dan **`health-pharmacy.controller.ts`** —
  delapan jalan pada `/api/v1/health/pharmacy/**`.
- **`adapters/inventory.adapter.ts`** — satu-satunya tempat modul kesehatan
  menyentuh persediaan.
- **`PharmacyPage.tsx`** — antrian farmasi dan telaah apoteker pada web.
- **`prove-health-pharmacy.mjs`** — naskah bukti, 44 pemeriksaan, seluruhnya
  lulus. Dijalankan dengan tiga pengguna berbeda: dokter, apoteker, perawat.

Uji: API 1183 → **1243**. Web 50 → **54**.

### Keputusan yang perlu dicatat

- **Alergi dan interaksi dicocokkan terhadap ZAT AKTIF, bukan nama dagang.**
  Pasien yang alergi amoksisilin alergi terhadap seluruh merek yang
  mengandungnya. Mencocokkan nama dagang akan melewatkan hampir semuanya.

- **Hanya yang benar-benar berbahaya yang memblokir.** Alergi berat dan fatal,
  kontraindikasi, dan dosis dua kali lipat batas — yang terakhir karena hampir
  selalu salah ketik. Alergi ringan, interaksi mayor, obat berisiko tinggi, dan
  LASA memperingatkan tanpa menahan. Sistem yang memperingatkan segalanya sama
  tidak amannya dengan yang tidak memperingatkan apa pun; bedanya, yang pertama
  merasa aman sampai orang berhenti membaca peringatannya.

- **Peringatan pemblokir boleh dilewati dengan alasan tertulis**, dan alasannya
  tersimpan bersama peringatannya pada `override_alerts`. Menolak seluruhnya
  akan memindahkan peresepan ke kertas — di luar sistem, tanpa jejak sama
  sekali. Bila kelak ada kejadian tidak diharapkan, pertanyaan "apakah sistem
  memperingatkan?" harus terjawab dari catatan, bukan disimpulkan.

- **Adapter memakai ulang `applyBalanceDelta` milik Core, tetapi TIDAK memakai
  ulang `consumeAvailable`.** Yang terakhir mengurutkan lot dengan FEFO tanpa
  menyaring lebih dahulu, sehingga lot yang *sudah* kedaluwarsa berada di urutan
  paling depan. Untuk barang dagangan itu benar — habiskan yang paling cepat
  basi. Untuk obat itu berarti obat kedaluwarsa akan menjadi yang pertama
  diserahkan kepada pasien.

- **Empat menu, bukan satu "Farmasi".** Meresepkan, menelaah, menyerahkan, dan
  memberikan adalah empat wewenang yang berbeda. Menyatukannya akan menghapus
  seluruh pemisahan pada hari pertama seseorang memberikan peran kepada stafnya.
  Menu penampung lama ditutup; tidak ada peran yang pernah diberi hak atasnya,
  sehingga penutupannya tidak mencabut wewenang siapa pun.

- **Tiga aturan pemisahan wewenang ditegakkan basis data, bukan hanya layanan.**
  Penelaah ≠ peresep, pemeriksa kedua ≠ penyerah, saksi ≠ pemberi. Aturan yang
  hanya ada di satu lapisan berhenti berlaku begitu ada jalan kedua menuju
  tabelnya.

- **Obat biasa yang belum ditelaah TETAP dapat diserahkan; obat terkendali
  tidak.** Menahan seluruhnya akan menghentikan apotek kecil yang apotekernya
  merangkap penyerah — dan aturan yang menghentikan pekerjaan akan dilanggar,
  bukan dipatuhi.

- **Penyerahan idempoten terhadap `idempotencyKey`.** Stok obat yang berkurang
  ganda menampakkan kekurangan yang tidak nyata, dan kekurangan yang tidak nyata
  memicu pengadaan yang tidak perlu sekaligus menyembunyikan kehilangan yang
  nyata.

### Dua cacat yang ditemukan naskah bukti, bukan pengujian unit

1. **Pemilihan lot pada layanan memakai FEFO polos**, sehingga penyerahan yang
   sah pun ditolak dengan alasan kedaluwarsa. Kini: lot yang disebut pemanggil
   dikembalikan apa adanya agar penolakannya menyebut tanggal kedaluwarsanya;
   lot yang tidak disebut dipilih di antara yang layak saja.

2. **Catatan nyaris cedera ikut terhapus saat penolakan.** Pencatatannya berada
   di dalam transaksi yang kemudian dibatalkan oleh galat penolakannya sendiri —
   kejadiannya terjadi, ditolak dengan benar di layar perawat, tetapi tidak
   meninggalkan jejak sama sekali. Pemeriksaan enam benar kini dilakukan di luar
   transaksi penulisan, dan transaksinya membaca ulang status dengan penguncian
   supaya dua perawat yang menekan bersamaan tidak saling menimpa.

### Belum dikerjakan

Substitusi otomatis menurut formularium, rekonsiliasi obat saat masuk dan pulang
(menunggu H-6), penarikan sediaan, dan pelaporan narkotika ke SIPNAP. Kode
peristiwa akuntansi `HEALTH_*` masih menunggu keputusan Core, sehingga penyerahan
obat belum memicu pencatatan harga pokok.

---

## Web vertical kesehatan — layar pertama yang dapat diklik

### Ditambahkan
- **`apps/web/src/verticals/health/`** — direktori vertical pertama pada
  antarmuka web. Sebelumnya `apps/web/src/verticals/` belum ada sama sekali.
- **`health-api.ts`** — klien API kesehatan beserta bentuk datanya.
- **`PurposeGate.tsx`** — gerbang tujuan penggunaan dan dialog akses darurat.
- **Empat layar**: Fasilitas, Pasien, Pendaftaran dan Antrean, serta ruang
  kerja Kunjungan.
- **15 pengujian** (35 → 50 pada web).

### Keputusan yang perlu dicatat

- **Tujuan penggunaan dibungkus di klien, bukan diserahkan ke setiap halaman.**
  Tajuk yang harus diingat di dua puluh tempat adalah tajuk yang akan terlupa
  di salah satunya — dan yang terlupa menjadi lubang pada jejak audit. Sebuah
  pengujian memeriksa **seluruh** jalan yang menyentuh rekam medis sekaligus,
  sehingga jalan baru yang lupa membawanya akan gagal di sini, bukan di hadapan
  petugas yang sedang melayani pasien.

- **Daftar fasilitas sengaja TIDAK menuntut tujuan penggunaan.** Menuntutnya
  pada hal yang tidak menyentuh pasien akan membuat pengguna memilih apa pun
  demi lewat, dan pilihan yang asal justru merusak nilai jejaknya pada tempat
  yang penting.

- **Cakupan pencarian dikatakan di layar.** Hasil pencarian selalu disertai
  keterangan bahwa ia hanya mencakup fasilitas ini. Petugas yang mengira sudah
  melihat seluruh riwayat pasien akan menyimpulkan hal yang salah tentang
  alerginya.

- **Dugaan rekam medis ganda ditampilkan sebagai halangan**, lengkap dengan
  calon rekam medisnya, skor kemiripan, dan alasannya — bukan sebagai
  peringatan yang dapat dilewati tanpa dibaca. Tombol melanjutkannya berbunyi
  "Saya sudah memeriksa — ini orang yang berbeda", bukan "Lanjutkan".

- **Alergi berat ditampilkan sebelum apa pun yang lain** pada kartu pasien,
  dengan bingkai mencolok.

- **Tanda tangan diperingatkan SEBELUM ditekan.** Dialog menyebutkan bahwa
  isinya terkunci permanen dan perubahan hanya lewat amandemen yang catatan
  aslinya tetap terbaca.

- **Catatan ditampilkan sebagai rantai**: yang asli lebih dahulu, amandemennya
  menyusul dengan garis tepi berbeda dan alasannya terlihat. Pembaca melihat
  apa yang semula ditulis dan apa yang kemudian dikoreksi, bukan hanya versi
  terakhirnya.

- **Rekap penagihan harian ada di layar antrean.** Petugas yang melihat
  "12 dari 14 tertagih" akan bertanya soal dua sisanya hari itu juga, bukan
  pada akhir bulan ketika tagihannya sudah terbit.

### Diverifikasi di peramban
Masuk sebagai pengguna dengan peran kesehatan, lalu:
- layar Pasien memuat, pencarian sungguhan mengembalikan tujuh rekam medis
  beserta nomor rekam medis, umur, dan tingkat keyakinan identitasnya;
- keterangan cakupan pencarian tampil sebagaimana dimaksud;
- layar Antrean memuat beserta rekap penagihan harian.

Pengguna demo dan datanya dibersihkan sesudahnya.

## H-2/H-3 lanjutan — Endpoint, penyemaian menu, dan bukti alur

Melengkapi H-2 dan H-3 agar benar-benar dapat dipakai, bukan hanya berupa skema.

### Ditambahkan
- **`HealthPatientService`** dan **`HealthVisitService`** — identitas pasien,
  pendaftaran, antrean, kunjungan, dan dokumentasi klinis.
- **Dua puluh endpoint baru** (10 → 30 seluruhnya di bawah `/api/v1/health/**`).
- **Migrasi `H005`** — menyemai 19 menu, 8 aksi hak akses klinis, 7 peran
  bawaan, dan 2 aturan pemisahan wewenang.
- **Naskah bukti alur** `prove-health-flow-e2e.mjs` — **42 pemeriksaan** lewat
  HTTP dengan hak akses sungguhan, seluruhnya lulus.

### Tiga cacat yang ditemukan naskah bukti, bukan pengujian unit

- **Menu kesehatan tidak pernah disemai.** Katalognya ada sebagai berkas
  TypeScript, layanannya benar, penjaganya benar — tetapi tidak ada apa pun
  yang memasukkan barisnya ke tabel `menu`, sehingga **seluruh endpoint
  menjawab 403** dan tidak satu pun hak akses kesehatan dapat diberikan.
  Diperbaiki oleh H005.

- **Akses darurat tidak memeriksa hak akses, hanya alasan.** Memberi alasan
  sudah cukup untuk menembus batas hubungan perawatan — sehingga siapa pun yang
  boleh membaca satu rekam medis dapat membaca **semua** rekam medis hanya
  dengan mengetik kalimat. Alasan membuat perbuatannya dapat ditelaah; ia tidak
  membuat perbuatannya boleh. Kini `HEALTH_PATIENT.BREAK_GLASS` diperiksa
  tersendiri.

- **Nomor kunjungan bertabrakan antar fasilitas.**
  `ux_health_encounter_number` unik se-tenant, tetapi penomorannya urut per
  fasilitas — sehingga fasilitas kedua gagal memulai kunjungan pertamanya pada
  hari yang sama. Satu fasilitas saja tidak pernah menunjukkannya. Kelas cacat
  yang sama dengan `ux_pos_shift_number` pada sesi Core.

### Catatan tentang naskah bukti

Percobaan pertama gagal dengan 409 pada pendaftaran pertama, dan itu **bukan**
cacat: pasien bukti dari jalannya yang terdahulu masih ada dengan nama, tanggal
lahir, dan nama ibu yang sama, sehingga deteksi penggandaan menahannya persis
sebagaimana mestinya. Yang keliru adalah naskah buktinya, yang mengandaikan
basis data selalu bersih. Nama dan NIK kini dibuat unik per jalannya.

Hal serupa terjadi pada penggabungan yang sempat terbaca 403: perannya memang
belum diberi `MERGE_PATIENT`. Penjaganya bekerja; naskahnya yang kurang.

### Perbaikan lain
- `ON CONFLICT (code)` diganti penjaga `NOT EXISTS` pada H005: indeks unik pada
  `menu.code`, `permission_action.code`, dan `role.code` bersifat **parsial**
  (`WHERE deleted_at IS NULL`), dan indeks parsial tidak dapat dipakai Postgres
  untuk menyimpulkan sasaran `ON CONFLICT`.

## H-3 — Kunjungan, dokumentasi klinis, dan order

### Ditambahkan
- **Migrasi `H004__health__clinical.sql`** — `patient_allergy`,
  `health_encounter`, `clinical_note`, `vital_sign`, `encounter_diagnosis`,
  `clinical_order`, `clinical_alert`.
- **Naskah bukti** `prove-health-clinical.mjs` — 27 pemeriksaan pada basis data
  sungguhan, seluruhnya lulus.

### Yang ditegakkan basis data, bukan layanan

Layanan dapat dilewati — lewat jalan kedua, naskah pemeliharaan, atau konsol
basis data. Pemicu tidak.

- **Catatan klinis bertanda tangan tidak dapat diubah maupun dihapus.**
  Dibuktikan lima arah: mengubah bagian subjektif, mengubah penilaian,
  memindahkan ke pasien lain, memundurkan waktu tanda tangan, dan menghapusnya.
- **Amandemen wajib beralasan** sekurang-kurangnya sepuluh huruf. Perubahan
  catatan medis tanpa alasan tidak dapat dibedakan dari penyembunyian.
- **Satu kunjungan, satu diagnosis utama.** Dua diagnosis utama membuat
  pengodean casemix tidak dapat memutuskan mana yang menentukan tarif.
- **Jejak pembacaan tidak dapat diubah maupun dihapus**; break-glass tanpa
  alasan ditolak.

### Keputusan yang perlu dicatat

- **`patient_allergy` pada tingkat pasien, bukan kunjungan.** Alergi yang
  tercatat pada kunjungan tidak akan terlihat pada kunjungan berikutnya, dan
  obat yang mematikan akan diresepkan oleh dokter yang tidak pernah melihat
  catatannya. Naskah bukti memeriksa persis itu.
- **Alergi tidak dihapus**, hanya dinyatakan tidak berlaku beserta alasannya.
- **Batas tanda vital adalah batas KEWAJARAN, bukan batas normal.** Tekanan
  70/40 dengan nadi 140 dan saturasi 88 **diterima** — itulah pasien yang sedang
  syok, dan sistem yang menolaknya akan menghalangi perawatan pada saat yang
  paling menentukan. Yang ditolak hanya yang mustahil.
- **SOAP dipisah empat kolom**: pemeriksaan mutu rekam medis menghitung
  kelengkapan per bagian, dan teks bebas tidak dapat dinilai.
- **Diagnosis boleh berupa teks sebelum dikodekan.** Menuntut kode sejak awal
  memaksa dokter memilih kode yang kurang tepat demi menyimpan catatannya.
- **Peringatan yang dilewati dicatat beserta alasannya.** Bila hampir seluruhnya
  dilewati, yang salah adalah peringatannya.

## H-2 — Persetujuan, wali, janji temu, pendaftaran, dan antrean

### Ditambahkan
- **Migrasi `H003__health__front_office.sql`** — `patient_consent`,
  `patient_proxy`, `health_schedule`, `health_schedule_exception`,
  `health_appointment`, `health_registration`, `health_queue`,
  `health_referral`.
- Aturan front office beserta **37 pengujian** (98 → 135 pada modul kesehatan).
- **`docs/emedik/09-isolasi-per-fasilitas.md`** dan **integration request 003**.

### Keputusan pemilik sistem: satu fasilitas, satu skema

Arsitektur inti sudah melakukannya — `tenant_schema_registry.tenantId` unik,
sehingga satu pendaftaran menghasilkan satu skema dan rumah sakit A tidak dapat
membaca data rumah sakit B karena tabelnya memang tidak ada di sana. Tidak ada
perubahan yang diperlukan.

Yang dipisahkan adalah **pendaftar**, bukan setiap titik layanan: puskesmas
dengan tiga Poskesdes jejaring tetap satu skema, sebab Poskesdes bukan pendaftar
mandiri melainkan unit kerja puskesmas itu, dan memisahkannya akan memecah
laporan program yang justru harus terkonsolidasi.

Akibatnya pada Enterprise MPI dicatat pada IR 003. Sampai diputuskan,
`enterprise_patient_id` **hanya berlaku dalam satu skema**, dan API pencarian
menyatakannya pada jawabannya sendiri alih-alih tampak sudah lintas fasilitas.
Kolom bernama "enterprise" yang ternyata lokal adalah kekeliruan yang paling
mahal ditemukan belakangan — seseorang akan mengandalkannya untuk menyimpulkan
bahwa pasien tidak punya alergi.

### Keputusan lain

- **`health_registration` adalah satu-satunya sumber tagihan langganan.** Kelima
  pengecualian spesifikasi §4 disimpan sebagai kolom pada barisnya sendiri, bukan
  disimpulkan dari gabungan beberapa tabel — tagihan yang harus disimpulkan akan
  salah begitu satu tabel sumbernya berubah bentuk, dan yang menanggungnya
  penyewa. `is_billable` dihitung sekali lalu disimpan, supaya tagihan bulan lalu
  tetap dapat dijelaskan dengan aturan bulan lalu.
- **`business_date` memakai zona waktu fasilitas, bukan peladen.** Pukul 23.30
  WIT masih tanggal yang sama di Jayapura tetapi sudah berganti menurut UTC;
  memakai waktu peladen membuat jumlah pendaftaran harian salah pada dua hari
  sekaligus, dan jenjang tarifnya ikut salah.
- **Antrean: prioritas menang atas nomor, tetapi tidak menghapus urutan di dalam
  prioritas yang sama.** Lansia yang datang belakangan tetap menunggu lansia yang
  datang lebih dahulu. Yang sudah dipanggil didahulukan atas yang belum — pasien
  yang sudah bangkit dari kursinya tidak boleh disalip.
- **Nomor antrean dijaga indeks unik** per unit per hari per awalan: dua petugas
  yang mendaftarkan bersamaan akan menghasilkan nomor sama bila hanya layanan
  yang menjaganya.
- **Akses wali adalah hubungan tercatat yang dapat dicabut**, bukan penyamaan
  identitas — orang tua yang membuka rekam medis anaknya tetap dirinya sendiri
  pada jejak akses.

## H-1 — Fasilitas, profil tenant, penagihan, dan identitas pasien inti

### Ditambahkan
- **Migrasi `H001__health__facility.sql`** — `health_tenant_profile`,
  `health_facility_type`, `health_facility`, `health_service_unit`,
  `health_room`, `health_bed`, `health_provider`,
  `health_clinical_privilege`.
- **Migrasi `H002__health__patient_identity.sql`** — `patient`,
  `patient_identifier`, `patient_name_history`,
  `patient_potential_duplicate`, `patient_merge`, `health_access_log`.
- **Delapan port** di `modules/emedik/ports/` beserta tiga adapter pertama
  (identitas, audit, notifikasi).
- **Katalog modular** menu, peran, dan aturan pemisahan wewenang kesehatan,
  terpisah dari registri global sesuai panduan koordinasi §9.
- **Sepuluh endpoint** `/api/v1/health/**`.
- **98 pengujian baru** (1048 → 1146).

### Keputusan yang perlu dicatat

- **`modules/emedik/`, bukan `modules/health/`.** Rute tetap
  `/api/v1/health/**` sesuai perintah §6; yang berbeda hanya nama direktori.
  Diverifikasi saat API dijalankan: sepuluh rute terpasang di bawah
  `/api/v1/health/**` sementara pemeriksa ketersediaan di `/health` tetap
  menjawab 200.

- **`health_facility.outlet_id` nullable.** Apotek dengan kasir menautkan diri
  ke outlet agar POS dan gudangnya berjalan di atas mesin yang sudah ada;
  Posyandu tidak punya outlet sama sekali. Mewajibkannya akan memaksa
  pembuatan outlet palsu yang muncul di laporan penjualan sebagai toko yang
  tidak pernah menjual apa pun.

- **`health_provider.user_subject_id` dan `employee_id` keduanya nullable.**
  Dokter tamu punya kewenangan klinis tanpa menjadi pegawai; kader Posyandu
  memberi layanan tanpa akun sistem.

- **Kewenangan klinis dipisahkan dari peran.** Peran menentukan menu apa yang
  terbuka; kewenangan klinis menentukan tindakan apa yang boleh dilakukan.
  Dokter umum dan dokter bedah memakai peran yang sama.

- **Administrator eMedik tidak diberi hak membaca rekam medis.** Mengelola
  sistem tidak menuntut membaca diagnosis siapa pun, dan hak yang tidak
  dibutuhkan adalah hak yang akan disalahgunakan.

- **Petugas pendaftaran tidak dapat menggabungkan rekam medis.** Menandai
  dugaan ganda dan menggabungkannya adalah dua wewenang berbeda; yang kedua
  menempelkan riwayat medis dan tidak boleh dilakukan sendirian.

- **`health_access_log` tidak dapat diubah maupun dihapus**, ditegakkan pemicu
  basis data. Break-glass diizinkan tetapi constraint menuntut alasan
  sekurang-kurangnya sepuluh huruf — yang tidak dapat ditelaah sama saja
  dengan tidak dicatat.

- **Jenjang tertinggi tarif bernilai `null`, bukan angka.** Spesifikasi §4
  menyebutnya dinegosiasikan; menaruh angka apa pun berarti menagihkan tarif
  yang tidak pernah disepakati. Perhitungannya menandai tagihan sebagai belum
  lengkap alih-alih mengarang nominal.

### Yang diuji

Aritmetika jenjang dihitung tangan lebih dahulu, bukan disalin dari keluaran
program. Yang paling mudah salah — dan diuji khusus — adalah bedanya marginal
bertingkat dari jenjang biasa: 50 pendaftaran berbiaya Rp497.500
(49×10.000 + 1×7.500), bukan Rp375.000 (50×7.500).

Penilaian penggandaan diuji setangkup, dan NIK yang sama memutuskan mutlak
tanpa pertimbangan lain — satu NIK memang hanya milik satu orang, sehingga nama
yang berbeda berarti salah satu berkas salah tulis, bukan dua orang.

Penggabungan ditolak bila NIK berbeda: menggabungkannya akan menempelkan
riwayat medis satu orang kepada orang lain.

## H-0 — Audit dan bounded context

### Ditambahkan
- Sembilan dokumen audit di `docs/emedik/`: keadaan sekarang, peta domain,
  matriks pakai-ulang, peta model data, kontrak integrasi, model ancaman,
  rencana implementasi, garis dasar pengujian, dan daftar integration request.
- Dua integration request di `docs/integration-requests/health/`.
- Changelog modular ini.

### Temuan yang menuntut keputusan
- **`modules/health` sudah dipakai** oleh pemeriksa ketersediaan aplikasi
  (`liveness`), bukan oleh vertical kesehatan. Rutenya tidak bertabrakan —
  `main.ts` mengecualikan `health` dari awalan global — tetapi nama direktorinya
  bertabrakan, dan CODEOWNERS pada panduan §14 akan memberikan kepemilikan
  pemeriksa platform kepada tim kesehatan. Lihat IR 001.
- **`TenantModuleMigrationCatalog` tidak ada.** Panduan §7 memerintahkan
  mendaftarkan migrasi padanya dan melarang nomor urut global manual, tetapi
  nomor urut global manual adalah satu-satunya mekanisme yang tersedia. Tiga
  vertical yang bekerja paralel akan sama-sama menyunting satu `manifest.json`.
  Lihat IR 002.

### Keadaan yang ditemukan
- **Tidak ada kode kesehatan sama sekali** di repositori. Tidak ada SIRS lama
  untuk diaudit maupun dimigrasikan; pekerjaan eMedik adalah membangun vertical
  baru di atas fondasi bersama yang sudah berjalan.
- Fondasi yang dapat dipakai: 153 tabel tenant, 133 menu, 40 aksi hak akses,
  jejak audit hanya-bertambah, hub notifikasi dengan SLA, gerbang AI dengan
  bukti dan redaksi, cakupan data per pengguna, dan pemisahan wewenang.
- **Tidak ada** `apps/web/src/verticals/`, `packages/`, kerangka Pusat Bantuan,
  ekspor Excel, maupun cetak PDF. Tiga yang terakhir menghalangi sebagian H-11
  sejak sekarang.

### Keputusan yang dicatat
- **Pasien bukan pelanggan.** `patient` dibangun tersendiri, tidak memakai
  `customer`. Identitas ganda pada pelanggan merepotkan; identitas ganda pada
  pasien berarti alergi yang tercatat di satu berkas tidak terlihat saat obat
  diresepkan dari berkas lain.
- **Identitas pasien inti dinaikkan ke H-1.** `Patient`, nomor rekam medis, dan
  deteksi ganda dikerjakan bersama fasilitas, karena setiap konteks sesudahnya
  menunjuk pasien. Menumpuk janji temu di atas rekam medis ganda jauh lebih
  mahal diperbaiki daripada dicegah.
- **Empat hal harus benar sejak H-1**, bukan H-12: pencatatan pembacaan rekam
  medis, tujuan penggunaan pada setiap akses, catatan bertanda tangan yang tidak
  dapat diubah, dan penandaan data berkategori sensitif tinggi. Keempatnya tidak
  dapat ditambahkan belakangan tanpa membongkar apa yang sudah dibangun.

### Garis dasar
- `tsc`, `eslint`, `jest` (45 suite / 1048 tes), `vitest` (35 tes) — seluruhnya
  bersih pada `main` @ `4f7ab88`.
- Angka ini lebih rendah daripada worktree Core hari ini (1209 tes) karena POS
  Web belum masuk `main`. Dicatat supaya kenaikannya kelak dikenali sebagai
  pekerjaan Core, bukan sebagai tes kesehatan yang tiba-tiba muncul.
