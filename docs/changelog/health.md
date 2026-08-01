# Changelog — Vertical Kesehatan (eMedik)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` global.

---

## W-5 — Layar alat medis

Tiga layar untuk tujuh menu. Alat medis menyentuh pasien, dan itu yang
menentukan seluruh bentuknya.

### Ditambahkan

- **`DevicePage`** (`/app/emedik/alat`, `/gateway`) — **kendali jarak jauh mati
  secara bawaan, dan berapa yang menyala DIHITUNG**. Angka yang seharusnya nol
  pada sebagian besar fasilitas; bila bukan, ia pertanyaan — dan pertanyaan itu
  tidak muncul bila angkanya tidak ada. Perintah yang diizinkan disebut satu per
  satu: "kendali jarak jauh menyala" tanpa daftar perintahnya tidak memberi tahu
  apakah yang menyala sekadar pembacaan status atau penyetelan alarm.
- **`DeviceMaintenancePage`** (`/pemeliharaan-alat`, `/keamanan-alat`) — **gagal
  uji keselamatan dihitung TERPISAH dari pemeliharaan yang lewat**. Keduanya
  sering disamakan dan berbeda sama sekali: gagal uji berarti *sudah diperiksa
  dan hasilnya buruk*; pemeliharaan lewat berarti *belum diperiksa*.
  Menggabungkannya membuat yang mendesak tenggelam. Penilaian risiko siber yang
  lewat tenggat **tanpa keputusan** ditandai — penilaian tanpa keputusan bukan
  penilaian, melainkan catatan bahwa seseorang pernah melihat masalahnya dan
  tidak melakukan apa pun.
- **`DeviceAdapterPage`** (`/pesan-alat`, `/pemetaan-kode`, `/hasil-alat`) —
  **"siap" tidak sama dengan "dapat dibaca"**. Protokol yang siap tanpa pengurai
  menerima pesan dan menyimpannya, tetapi belum membacanya; petugas yang melihat
  "siap" akan mengira hasilnya sudah masuk ke rekam medis. Dihitung tersendiri.
- **`H065__health__menu_truth_w5.sql`** — 44 menu berlayar, 29 masih segera
  hadir.
- **`device-pages.spec.tsx`** — 11 uji komponen.

### Yang ditegaskan ulang di layar

Alat berbicara kepada gateway; gateway berbicara kepada sistem. **Alat tidak
pernah menulis langsung ke basis data** — sambungan langsung berarti alat yang
salah kirim merusak rekam medis tanpa satu pun lapisan yang dapat menolaknya.

Kalibrasi dan pemeliharaan yang lewat **menandai, tidak menghentikan**.
Ventilator yang mati sendiri karena jadwalnya lewat lebih berbahaya daripada
ventilator yang jadwalnya lewat: yang pertama berhenti pada saat yang dipilih
kalender, bukan pada saat yang dipilih orang yang tahu ada pasien memakainya.

### Dua ketidakcocokan katalog yang ditemukan penjaga, bukan uji

**H064 hangus.** Ia berkas H065 dengan satu utas keliru — `/app/emedik/gateway-alat`,
padahal H034 menyemainya sebagai `/app/emedik/gateway`. Yang menemukannya
**penjaga migrasi itu sendiri**, dan itu justru maksudnya: utas yang salah ketik
akan menandai menu yang layarnya ADA sebagai "segera hadir", lalu penggunanya
berhenti mengkliknya. Nomornya hangus sesuai cacat Core pada
[005](../integration-requests/health/005-riwayat-migrasi-gagal-mengunci-versi.md).

Sumbernya `health-catalog.ts`, yang merupakan **cerminan** dari migrasi, bukan
penyemainya — dan cerminan yang berbeda dari aslinya lebih buruk daripada tidak
ada cerminan, sebab ia dipercaya.

Karena itu naskah bukti kontrak diberi penjaga baru: **setiap utas pada
`health-catalog.ts` harus ada sebagai menu pada basis data.** Penjaga itu
langsung menemukan yang **kedua**, dan itu kelalaian dari W-1 sendiri:
`HEALTH_HOME_VISIT` sudah dipindahkan ke `/app/emedik/kunjungan-rumah` oleh
H059, tetapi katalognya tidak pernah ikut dibetulkan. Tidak satu pun dari 73 uji
katalog menangkapnya, sebab seluruhnya membandingkan katalog dengan dirinya
sendiri.

Naskah bukti kontrak: **40 pemeriksaan**, lulus dua kali.

Uji web 140 -> 151.

---

## W-4 — Layar tarif, jasa, settlement, dan kontrak fee

Empat layar untuk tujuh menu. Yang menyatukan keempatnya: **gabungan keadaan
yang berbahaya dan tidak menimbulkan galat apa pun**.

### Ditambahkan

- **`TariffPage`** (`/app/emedik/tarif`) — tiga keadaan versi ditampilkan
  terpisah: terimpor, disetujui, aktif. Versi yang terimpor tetapi belum
  disetujui berisi angka yang belum diperiksa siapa pun; meringkasnya menjadi
  satu lencana membuatnya tampak sama dengan versi yang sudah dipakai menagih.
  **Peraturan yang dicabut tetap ditampilkan** — "tarif mana yang berlaku bulan
  Maret" adalah pertanyaan yang muncul setiap kali klaim lama ditolak.
- **`FeePolicyPage`** (`/app/emedik/kebijakan-jasa`, `/kontributor`) — `active`,
  `is_sample_data`, dan `production_approved` adalah **tiga hal yang berbeda**,
  dan gabungan yang berbahaya adalah *aktif tetapi belum disetujui untuk
  produksi*: ia menghitung uang sungguhan memakai persentase yang belum
  disepakati siapa pun. Dihitung sebagai angka tersendiri. Kebijakan yang
  `total_percent`-nya bukan 100 ditandai pula — berarti ada uang yang tidak
  diberikan kepada siapa pun, atau diberikan dua kali.
- **`SettlementPage`** (`/app/emedik/settlement`, `/distribusi`, `/pernyataan`)
  — **simulasi ditandai sebelum statusnya**. Simulasi berstatus `PAID` tidak
  pernah membayar siapa pun, dan lencana status sendirian membacanya seperti
  pembayaran sungguhan — dokter yang ditunjukkan angka simulasi akan
  mengingatnya sebagai janji.
- **`FeeContractPage`** (`/app/emedik/kontrak-fee`) — **fee sistem dan fee
  investor bernilai NONE sampai ada kontraknya**, dan layar mengatakannya
  ketika memang begitu. Tiga tahap ditampilkan terpisah: telaah hukum,
  persetujuan, berlaku. Kontrak yang **disetujui tanpa telaah hukum** dihitung
  tersendiri — ia lebih berbahaya daripada kontrak yang belum disetujui sama
  sekali, sebab yang kedua tidak berlaku sedangkan yang pertama berlaku tanpa
  ada yang membaca pasalnya.
- **`H063__health__menu_truth_w4.sql`** — 37 menu berlayar, 36 masih segera
  hadir.
- **`fee-pages.spec.tsx`** — 13 uji komponen.

### Penyaringan yang ditampilkan, bukan disembunyikan

Ringkasan investor mengembalikan `_filtered`: berapa medan yang **dibuang**
karena tidak ada pada daftar putih. Angka itu ditampilkan di layar. Pemegang
kontrak berhak tahu bahwa ia melihat pandangan yang disaring, dan rumah sakit
berhak menunjukkan bahwa penyaringannya bekerja.

Naskah bukti kontrak diperluas: **31 pemeriksaan**, lulus dua kali. Tabelnya
bernama `fee_policy`, `fee_settlement`, `fee_contract` — tanpa awalan
`health_`, berbeda dari sebagian besar tabel kesehatan lain, dan itu diperiksa
alih-alih ditebak.

Uji web 127 -> 140.

---

## W-3 — Layar klaim dan BPJS

### Ditambahkan

- **`ClaimPage`** (`/app/emedik/klaim`, `/telaah-klaim`) — **selisih ditampilkan
  sebagai uang, bukan sebagai status.** Klaim sepuluh juta berstatus
  `RECONCILED` tampak beres; yang tidak tampak adalah tiga juta yang tidak
  disetujui dan setengah juta yang belum dibayar. Rumah sakit yang tidak
  melihatnya baru menyadari kekurangannya ketika arus kasnya tidak cocok —
  biasanya sesudah alasannya tidak lagi dapat ditelusuri.
- **`BpjsPage`** (`/app/emedik/bpjs`, `/sep`, `/kepesertaan`) — layar yang tugas
  utamanya **mengatakan apa yang belum ada**. Penghalang tiap adapter
  ditampilkan apa adanya, bukan diringkas jadi lencana merah: petugas yang tahu
  "kredensial belum ada" berhenti mencoba; petugas yang hanya melihat merah akan
  mencoba lagi besok, dan besoknya lagi. Disertai daftar apa yang **tetap dapat
  dikerjakan** tanpa kredensial.
- **`H062__health__menu_truth_w3.sql`** — 30 menu berlayar, 43 masih segera
  hadir.
- **`claim-pages.spec.tsx`** — 12 uji komponen.

### Yang ditandai alih-alih didiamkan

**Naik kelas.** `billedClass` yang berbeda dari `entitledClass` — dan pada SEP,
`benefit_class` yang berbeda dari `occupied_class` — berarti pasien menempati
kelas di atas haknya. Itu sah dan lazim, tetapi ia mengubah siapa yang membayar
selisihnya. Layar yang hanya menampilkan satu kolom kelas menyembunyikannya
sampai klaimnya ditolak berbulan-bulan kemudian.

**Sebab penolakan diurut menurut UANG, bukan jumlah klaim** — mengikuti
`ORDER BY sum(submitted - approved) DESC` milik peladen, yang diperiksa sebelum
kalimatnya ditulis di layar. Mengatakan sesuatu di layar tentang urutan yang
tidak diperiksa akan menjadi kebohongan yang tampak seperti bantuan.

### Konvensi yang berbeda pada satu domain

Daftar kerja klaim memakai `snake_case`; satu klaim memakai `camelCase`.
Keduanya diperiksa langsung ke peladen sebelum satu baris layar ditulis — dan
itu persis jenis hal yang akan salah bila ditebak, sebab salah tebak di sini
tidak menghasilkan galat kompilasi melainkan halaman kosong.

Naskah bukti kontrak diperluas ke seluruh jalan W-3: **23 pemeriksaan**, lulus
dua kali.

Uji web 115 -> 127.

---

## W-2 — Layar rekam medis dan telaah darurat

### Ditambahkan

- **`BreakGlassPage`** (`/app/emedik/telaah-darurat`) — layar yang seharusnya
  ada sebelas fase lalu. Break-glass punya dua sifat yang harus ada bersama:
  tidak pernah ditolak, dan **selalu ditelaah**. Yang pertama berdiri sejak H-2;
  yang kedua baru dibangun H-12 dan belum pernah punya layar. Angka **belum
  ditelaah** diletakkan paling atas: bila ia terus naik, sifat kedua sudah
  berhenti berlaku dan yang tersisa hanya pintu yang tidak pernah menolak siapa
  pun.
- **`CodingPage`** (`/app/emedik/koding`) — dua daftar untuk dua orang berbeda:
  daftar kerja pengkodean bagi petugas koding, kekurangan berkas bagi dokter
  atau perawat. Yang **menghalangi** dibedakan dari yang tidak — menyamakannya
  membuat petugas mengejar yang mudah lebih dahulu, dan yang menahan tagihan
  justru mengendap.
- **`LegalHoldPage`** (`/app/emedik/penahanan` dan `/app/emedik/jejak-akses`) —
  satu layar, dua menu. Petugas rekam medis yang menerima surat pengadilan
  menanyakan "siapa yang tidak boleh mengubah berkas ini" dan "siapa yang sudah
  membacanya" dalam satu napas.
- **`InfoReleasePage`** (`/app/emedik/pelepasan`) — dua dasar pelepasan
  (persetujuan pasien atau dasar hukum), dan **rujukannya disimpan, bukan
  sekadar dicentang**. Cakupan dipilih per bagian: penjamin yang menanyakan satu
  tindakan tidak berhak atas seluruh riwayat pasiennya.
- **`H060__health__menu_truth_w2.sql`** — 23 menu berlayar, 50 masih segera
  hadir.
- **`him-pages.spec.tsx`** — 14 uji komponen.

### Ditambahkan kemudian, menuntaskan W-2

- **`SafetyPage`** (`/app/emedik/keselamatan`) — papan insiden yang diurutkan
  menurut **yang terlupa**, bukan menurut yang paling berat. Urutan itu akan
  terasa keliru bagi yang pertama melihatnya, jadi sebabnya ditulis di layar:
  kejadian merah yang sudah ditelaah sudah dikerjakan; kejadian hijau yang
  terlupa dua pekan adalah pekerjaan yang menumpuk diam-diam. Papan yang diurut
  menurut derajat menampilkan yang merah terus-menerus sampai orang berhenti
  melihatnya.
- **`QualityPage`** (`/app/emedik/mutu`) — warna datang dari `meets_target` yang
  **dihitung peladen**, bukan dari perbandingan yang dilakukan layar. Layar yang
  membandingkan sendiri akan menghijaukan yang buruk pada setiap indikator yang
  makin rendah makin baik — dan tidak seorang pun akan menyadarinya, sebab warna
  hijau tidak pernah ditanyakan. Indikator yang **belum diukur** ditampilkan,
  tidak disembunyikan: papan yang seluruhnya hijau karena separuh indikatornya
  tidak diukur adalah keadaan paling menyesatkan yang dapat ditampilkan dasbor
  mutu.
- **`H061__health__menu_truth_w2b.sql`** — 25 menu berlayar, 48 masih segera
  hadir.

Dua penjaga peladen dijelaskan **di layar sebelum tombolnya ditekan**: insiden
tidak dapat ditutup tanpa tindakan perbaikan, dan pelapor tidak menutup
laporannya sendiri pada kejadian merah atau kuning. Penjaga yang baru
menjelaskan dirinya sesudah menolak terasa sebagai penghalang; yang menjelaskan
lebih dahulu terasa sebagai aturan.

### Naskah bukti baru: kontrak klien-peladen

**`prove-web-contract.mjs`** — 17 pemeriksaan, lulus dua kali.

Ia memanggil setiap jalan yang dipakai klien web pada peladen sungguhan, lalu
membandingkan medan jawabannya dengan **medan wajib yang dideklarasikan
`health-api.ts`** — dibaca dari berkasnya, bukan disalin.

Naskah ini ada karena W-1: uji komponen tidak dapat menutup celah antara klien
dan peladen, dan tidak akan pernah dapat, sebab ia menguji komponen terhadap
data yang bentuknya ditentukan penulisnya sendiri.

Naskah ini **membuat sendiri baris yang diperlukannya** lewat jalan API
sungguhan. Alasannya sama: bukti yang melewatkan jalan tanpa data akan berkata
seluruh kontrak cocok sekalipun jalan paling rawan tidak pernah dilihat — dan
pada W-1 jalan yang rusak justru `coverage`, yang pada mulanya kosong. Jalan
yang tetap tidak ada barisnya **dilaporkan sebagai belum terbukti**, bukan
dihitung lulus.

### Diperbaiki

**Menimbang pasien dewasa menjawab 500 INTERNAL_ERROR.** `growth_measurement`
membatasi umur 0–300 bulan lewat constraint, dan pelanggarannya keluar sebagai
galat peladen — pesan yang tidak memberi tahu apa pun kepada petugas yang
memilih pasien dewasa dari hasil pencarian.

Ini terjangkau langsung dari layar Pertumbuhan yang dibangun W-1, sebab
pencariannya sengaja **tidak** menyaring umur: pencarian yang menyaring umur
akan menyembunyikan anak yang tanggal lahirnya keliru tercatat, dan anak itu
justru yang paling perlu ditemukan. Jadi yang dibetulkan bukan pencariannya,
melainkan penolakannya — kini 422 beserta umurnya dan jalan keluarnya.
Constraint-nya tetap berdiri sebagai penjaga terakhir.

Ditemukan oleh naskah bukti kontrak, bukan oleh uji mana pun.

Uji web 91 -> 115.

---

## W-1 — Layar Puskesmas dan Posyandu

Fase layar pertama. Sampai fase ini, satu kategori fasilitas penuh — Puskesmas —
tidak punya satu pun layar untuk kerja hariannya, sekalipun API-nya lengkap
sejak H-8.

### Ditambahkan

- **`FamilyPage`** (`/app/emedik/keluarga`) — folder keluarga beserta status
  gizi SELURUH anggotanya sekaligus. Anak yang gizinya buruk hampir selalu punya
  saudara yang gizinya juga buruk; yang perlu terlihat polanya, bukan satu
  anaknya.
- **`GrowthPage`** (`/app/emedik/pertumbuhan`) — penimbangan Posyandu.
  Penilaiannya muncul di layar **sebelum kader beranjak**, bukan pada laporan
  bulan depan; anak yang bergizi buruk pagi ini kalau tidak begitu pulang tanpa
  ada yang tahu.
- **`ImmunizationPage`** (`/app/emedik/imunisasi`) — tiga daftar terpisah:
  tertunggak, boleh hari ini, dan **belum boleh — tanpa tombol**. Vaksin sebelum
  umur minimum akan tercatat sebagai diberikan, lalu anaknya tampak lengkap pada
  laporan cakupan dan tidak dikejar siapa pun.
- **`HomeVisitPage`** (`/app/emedik/kunjungan-rumah`) — daftar kerja kader,
  **urutannya tidak dapat diubah**. Peladen sudah mengurutkannya menurut
  kemendesakan; tajuk kolom yang dapat diklik akan diklik, dan diurut menurut
  nama anak bergizi buruk berpindah ke tengah daftar tanpa satu pun galat.
- **`CoveragePage`** (`/app/emedik/cakupan`) — penyebutnya SASARAN, bukan yang
  datang, dan yang ditonjolkan **berapa yang belum tersentuh**. Persentase 82%
  terbaca lumayan; "134 anak belum diimunisasi" tidak.
- **`H059__health__menu_truth_fix.sql`** — dua koreksi; lihat di bawah.
- **`puskesmas-pages.spec.tsx`** — 16 uji komponen. Klien API: 40 uji (dari 34).

### Diperbaiki

- **Menu "Kunjungan Rumah" menyorot dirinya pada layar yang bukan miliknya.**
  H015 memberinya utas `/app/emedik/kunjungan`, kunjungan klinis berada pada
  `/app/emedik/kunjungan/:id`, dan `NavLink` mencocokkan **awalan** — sehingga
  sejak H-3 setiap dokter yang membuka rekam medis melihat menu Posyandu
  tersorot di bilah sampingnya. Tidak ada galat, tidak ada catatan, dan setiap
  orang yang melihatnya menganggap dirinya salah membaca.
- **Menu berkata "siap" dan layarnya berkata "segera hadir".** Seluruh menu
  kesehatan terdaftar `is_coming_soon = FALSE` padahal hanya sebagian punya
  layar. Kini 18 berlayar, 55 bertanda segera hadir — dan penandanya sudah
  didukung bilah samping sejak awal; yang tidak ada hanyalah datanya.

### Cacat yang HANYA ditemukan dengan membuka halamannya

**`CoveragePage` melempar TypeError dan kosong sama sekali.** Kliennya membaca
`percentage` dan `shortfall`; peladen mengirim `coverage`, `gap`, dan `message`.

Seluruh uji komponennya **lulus** — sebab perlengkapan datanya ditulis tangan
dengan andaian yang sama kelirunya. Perlengkapan yang keliru dan kode yang
keliru saling menyetujui, dan keduanya tidak sesuai kenyataan.

Kekeliruan kedua ditemukan pada pemeriksaan yang sama: `verdict.reason` pada
imunisasi berisi **kode** (`TOO_YOUNG`, `OUT_OF_ORDER`), sedangkan kalimatnya
ada pada `verdict.message` — dan `verdict.earliestDate` yang menjawab "kapan
giliran anak saya" disediakan peladen sejak awal dan tidak pernah dipakai.

Keduanya kini diperbaiki, seluruh bentuk jawaban H-8 diperiksa langsung ke
peladen sungguhan, dan perlengkapan ujinya disalin dari jawaban itu. Peringatan
tertulis di kepala berkas ujinya: perlengkapan yang ditulis tangan tidak dapat
membuktikan bentuk jawaban peladen, dan tidak pernah akan dapat.

### Cacat pada Core yang ditemukan sepanjang jalan

**Pemulihan sesi melewati dedupe refresh yang justru dibuat untuknya.**
`auth-context.tsx` memanggil `/auth/refresh` langsung dengan `skipRefresh`,
bukan lewat `refreshAccessToken()` yang sudah ter-dedupe. Di bawah `StrictMode`
efeknya berjalan dua kali, pemakaian ulang token memicu pencabutan family, dan
pemulihan sesi **tidak pernah berhasil pada mode pengembangan**.

Diajukan lewat
[006](../integration-requests/health/006-pemulihan-sesi-melewati-dedupe-refresh.md).
Berkas Core tidak disentuh.

Uji web 75 -> 91.

---

## H-12 — Keamanan, zona data, telaah break-glass, dan penjaga AI

Fase terakhir. Ia tidak menambah kemampuan; ia memeriksa bahwa penjaga sebelas
fase sebelumnya berdiri — dan menambahkan yang terlewat.

### Ditambahkan

- **`H057__health__security_zone.sql`** — `health_data_zone`,
  `health_field_classification`, `health_break_glass_review`,
  `health_ai_guard_log`. Lima zona digolongkan menurut **akibat kebocorannya**,
  bukan menurut tingkat rendah/sedang/tinggi; 31 medan tergolong sebagai baris
  basis data. Trigger `forbid_review_mutation` membuat telaah tambah-saja, dan
  `check_break_glass_review` melarang seseorang menelaah aksesnya sendiri.
- **`H058__health__security_permissions.sql`** — tiga menu dan satu aturan
  pemisahan wewenang HIGH: yang menggolongkan medan bukan yang menelaah
  aksesnya.
- **`health-security.ts`** — zona, tujuan penggunaan, break-glass, antrean
  telaah, penyamaran medan, isolasi antar-tenant dan antar-vertical, pola
  redaksi kesehatan, dan daftar tindakan terlarang bagi AI. **75 pengujian.**
- **`health-security.service.ts`** dan **`health-security.controller.ts`** —
  14 jalan pada `/api/v1/health/security/**`.
- **`prove-health-security.mjs`** — naskah bukti, **92 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan. Isolasi antar-tenant dibuktikan dengan
  pengguna sungguhan pada tenant kedua yang menembak kesembilan jalan keamanan
  milik tenant pertama — dan yang diperiksa adalah **isi jawabannya**, bukan
  status kodenya.

### Yang TIDAK diubah, dan sebabnya

- **AI Gateway bersama tidak disentuh.** `POLA_KESEHATAN` (nomor rekam medis,
  SEP, ICD-10, kepesertaan JKN) dipasang sebagai lapisan **di atas**
  `redactText`, bukan sebagai perubahan padanya. Dua penyamar yang saling
  menggantikan akan berbeda dalam waktu enam bulan dan tidak ada yang tahu yang
  mana yang berjalan; dua penyamar yang bertumpuk keduanya berjalan.
- **`health_access_log` tidak diduplikasi.** Ia sudah memuat `purpose_of_use`,
  `break_glass`, dan `break_glass_reason` sejak H002. Yang ditambahkan adalah
  **telaahnya**.

### Diperbaiki sebelum sempat terpasang

- **Kosakata tujuan penggunaan disusun dari ingatan.** Memuat `PUBLIC_HEALTH`
  yang tidak ada pada skema, menghilangkan `QUALITY` yang ada. Sebuah jalan yang
  menerima tajuk itu akan membiarkan aksesnya berjalan lalu gagal ketika
  mencatatnya: **aksesnya terjadi, catatannya tidak.** Kemunculan kedua cacat
  yang sama — yang pertama H-9J. Naskah buktinya kini membaca
  `health_access_purpose_valid` langsung dari `pg_constraint` dan menuliskan
  setiap tujuan ke jejak akses.
- **"Break-glass tidak pernah ditolak" tidak benar pada sistem ini.** H002
  menuntut alasan sekurang-kurangnya sepuluh huruf. Tuntutan itu dipertahankan
  dan modulnya yang diperbaiki: penolakan hanya atas dasar alasan yang terlalu
  pendek untuk ditelaah, tidak pernah atas dasar penilaian tentang keadaan
  daruratnya. Angka sepuluh disalin dari constraint, tidak dipilih sendiri.
- **Dua belas dari dua puluh nama kolom penggolongan keliru.** Rancangan
  pertamanya melewati yang tidak ditemukan secara diam-diam, menghasilkan daftar
  yang **tampak penuh** — tanpa NIK, nomor rekam medis, isi catatan klinis, dan
  kode diagnosis. Migrasinya kini gagal bila satu kolom pun tidak ada.

### Cacat pada Core yang ditemukan sepanjang jalan

**`tenant-migration.service.ts` tidak membedakan migrasi yang GAGAL dari yang
BERHASIL.** `applyAll()` membaca riwayat tanpa menyaring `status`, sedangkan
cabang penanganan galat menuliskan checksum-nya juga. Migrasi yang gagal lalu
dijalankan ulang **tanpa diubah** dilaporkan sebagai *sudah diterapkan* padahal
tabelnya tidak pernah dibuat.

Diajukan lewat
[005](../integration-requests/health/005-riwayat-migrasi-gagal-mengunci-versi.md).
Berkas Core tidak disentuh. Nomor H055 dan H056 dihanguskan dan isinya
dipindahkan ke H057 dan H058, persis seperti yang diperintahkan pesan galatnya.

### Yang terhalang, dicatat apa adanya

**Uji E2E, uji kinerja, dan UAT menuntut layar.** Tiga puluh satu modul API kini
berdiri di belakang empat layar web. Uji penerimaan pengguna atas API tanpa
layar bukan uji penerimaan pengguna — ia uji API dengan nama yang lain.

Uji API 2427 -> 2506.

---

## H-11 — Peran, data contoh, dan laporan

### Ditambahkan

- **`H052__health__sample_and_report.sql`** — `health_sample_run`,
  `health_sample_table`, `health_sample_row_count`. Daftar izin tabel dipasang
  sebagai BARIS basis data, bukan tetapan pada kode; constraint
  `sample_count_real_unchanged` menegakkan jumlah baris sungguhan sebelum dan
  sesudah pembersihan sama persis.
- **`H053__health__sample_permissions.sql`** — dua menu dan satu aturan
  pemisahan wewenang CRITICAL: yang menyemai bukan yang membersihkan.
- **`health-sample.ts`** — profil data contoh, benih, pembersihan, pemeriksaan
  hasilnya, laporan, rentang, dan penghalang. **35 pengujian.**
- **`health-sample.service.ts`** dan **`health-sample.controller.ts`** — 8 jalan
  pada `/api/v1/health/sample/**`.
- **`prove-health-sample.mjs`** — naskah bukti, **55 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

### Diperbaiki

- **`H054__health__sample_hideable_fix.sql`** — daftar izin H052 memuat setiap
  tabel bertanda contoh (34), padahal menyembunyikan menuntut `deleted_at` yang
  hanya dimiliki 10 di antaranya. Pembersihan pada 24 sisanya akan berjalan,
  melaporkan keberhasilan, dan tidak menyembunyikan apa pun. Dipersempit, dan
  sisanya dicatat sebagai keterbatasan yang dinyatakan.
- Urutan pembersihan dibalik: **putuskan dahulu, hitung kemudian** — nama tabel
  yang belum disahkan tidak lagi disisipkan ke dalam SQL.

### Yang terhalang, dicatat apa adanya

Pusat Bantuan (V8-1/V8-2), ekspor Excel (V8-5/V8-6), dan cetak PDF (V8-7).
`POST /reports/:kode/export` selalu menolak, dan penolakannya menyebutkan sebab
DAN jalan keluarnya — termasuk pengakuan jujur bahwa cetak dari peramban bukan
pengganti yang setara.

Uji: API 2390 → **2427**.

---
## H-10 — Portal pasien dan website fasilitas

### Ditambahkan

- **`H050__health__patient_portal.sql`** — `patient_portal_account`,
  `patient_portal_access_log`, `portal_result_release`, `facility_web_content`.
  Dua indeks unik menegakkan satu akun satu pasien dan sebaliknya; constraint
  `portal_account_active_verified` menuntut verifikasi tatap muka; 
  `portal_release_critical_contacted` menolak pelepasan hasil kritis tanpa
  menghubungi pasiennya.
- **`H051__health__portal_permissions.sql`** — tiga menu PETUGAS, satu peran
  baru (Pengelola Website Fasilitas), dan satu aturan pemisahan wewenang.
- **`health-portal.ts`** — keputusan akses, akses wali berjenjang, pelepasan
  hasil, janji temu, konten publik, dan ringkasan antrean. **54 pengujian.**
- **`health-portal.service.ts`** dan **`health-portal.controller.ts`** — 15
  jalan pada tiga pengendali terpisah: portal pasien, pengelolaan portal, dan
  website publik.
- **`prove-health-portal.mjs`** — naskah bukti, **63 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

### Catatan bagi Core

Tidak ada permintaan perubahan shared Core. Rute portal ditandai
`@AuthenticatedOnly` alih-alih `@Permissions`: pasien tidak punya peran pada
mesin hak akses menu, dan yang menjaganya adalah `patient_portal_account` —
penjaga yang lebih sempit, sebab ia menentukan pasien MANA yang dibaca.

Uji: API 2334 → **2390**.

---
## H-9M — Kerangka impor KFA dan terminologi resmi

### Ditambahkan

- **`H048__health__kfa_import.sql`** — `terminology_catalog`,
  `terminology_import`, `kfa_mapping`. Constraint
  `terminology_official_has_edition`, `terminology_import_applied_clean`,
  `terminology_import_apply_not_self`, `kfa_mapping_method_valid`.
- **`H049__health__kfa_permissions.sql`** — satu menu baru, aksi `VERIFY` pada
  menu terminologi yang sudah ada sejak H-9, satu peran baru (Penanggung Jawab
  Farmasi), dan satu aturan pemisahan wewenang.
- **`health-kfa.ts`** — sumber data, klaim resmi, terminologi, penilaian tanpa
  katalog, pemetaan KFA, berkas impor, dan penerapannya. **41 pengujian.**
- **`health-kfa.service.ts`** dan **`health-kfa.controller.ts`** — 8 jalan pada
  `/api/v1/health/terminology/**`.
- **`prove-health-kfa.mjs`** — naskah bukti, **52 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

### Catatan bagi Core

Tidak ada permintaan perubahan shared Core. Katalog terminologi bersifat
tenant-wide — ICD-10 tidak berbeda antar fasilitas — dan penanda sumbernya
memastikan katalog yang kosong tidak pernah menyamar sebagai yang terisi.

Uji: API 2290 → **2334**.

---
## H-9B — Kerangka BPJS/JKN dan gerbang adapternya

### Ditambahkan

- **`H046__health__bpjs_skeleton.sql`** — `bpjs_provider_account`,
  `bpjs_adapter_capability`, `bpjs_participant_eligibility`, `bpjs_sep`,
  `bpjs_claim`, `bpjs_claim_item`, `jkn_entitlement_policy`. Constraint
  `bpjs_account_secret_is_ref`, `bpjs_cap_verified_complete`,
  `bpjs_elig_checked_expires`, `bpjs_sep_number_not_placeholder`,
  `bpjs_claim_group_from_adapter`, `jkn_policy_has_regulation`.
- **`H047__health__bpjs_permissions.sql`** — tiga menu terpisah dari SATUSEHAT,
  dan satu aturan pemisahan wewenang.
- **`health-bpjs.ts`** — gerbang adapter, aturan paket kasus, masa berlaku
  kepesertaan, status penjaminan, nomor SEP, kebijakan berversi, dan selisih
  kelas. **51 pengujian.**
- **`health-bpjs.service.ts`** dan **`health-bpjs.controller.ts`** — 11 jalan
  pada `/api/v1/health/bpjs/**`.
- **`prove-health-bpjs.mjs`** — naskah bukti, **62 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

### Yang sengaja tidak dibangun

Panggilan HTTP ke BPJS, pengelompokan INA-CBG, dan nilai tarif resmi. Grouper
adalah perangkat lunak berlisensi; menirunya menghasilkan tarif karangan yang
tidak menimbulkan galat — ia menghasilkan angka yang tampak masuk akal, dipakai
menyusun anggaran, lalu dipakai membagi jasa medis, sampai klaim pertamanya
kembali dengan angka yang berbeda. `kelompokkanInacbg()` melempar beserta
penjelasannya.

### Catatan bagi Core

Tidak ada permintaan perubahan shared Core. Siklus klaim internal sudah
dibangun H-9C; yang ditambahkan di sini adalah catatan sisi BPJS-nya beserta
gerbangnya.

Uji: API 2237 → **2290**.

---
## H-9A — Kerangka SATUSEHAT dan gerbang kemampuannya

### Ditambahkan

- **`H044__health__satusehat_skeleton.sql`** — `satusehat_environment`,
  `satusehat_capability`, `satusehat_resource_mapping`, `satusehat_transaction`,
  `satusehat_attempt`. Constraint `satusehat_env_secret_is_ref`,
  `satusehat_cap_verified_complete`, `satusehat_txn_success_has_id`, dan
  trigger `forbid_capability_status_skip`. Matriks kemampuan disemai seluruhnya
  BLOCKED bagi setiap fasilitas, termasuk yang lahir kemudian.
- **`H045__health__satusehat_permissions.sql`** — dua menu, satu peran baru
  (Petugas Interoperabilitas), dan satu aturan pemisahan wewenang CRITICAL.
- **`health-satusehat.ts`** — matriks kemampuan, syarat verifikasi, gerbang
  pengiriman, kenaikan status, kredensial, idempotensi, pengulangan percobaan,
  dan rekonsiliasi. **48 pengujian.**
- **`health-satusehat.service.ts`** dan **`health-satusehat.controller.ts`** —
  8 jalan pada `/api/v1/health/satusehat/**`.
- **`prove-health-satusehat.mjs`** — naskah bukti, **56 pemeriksaan**,
  seluruhnya lulus pada jalan pertama dan lulus pula pada pengulangan.

### Yang sengaja tidak dibangun

Payload FHIR, alur OAuth, dan jalur pengiriman otomatis. Ketiganya menuntut
dokumentasi profil berversi dan akses sandbox yang belum ada; mengarangnya akan
menghasilkan adapter yang diterima sandbox, ditolak produksi, dan di antara
keduanya membuat seseorang menyimpulkan bahwa integrasinya berfungsi.
`susunPayload()` ada sebagai fungsi yang melempar beserta penjelasannya.

### Catatan bagi Core

Tidak ada permintaan perubahan shared Core. Ketika kredensial tersedia, yang
perlu dibangun adalah pemetaan dan pengiriman — bukan pengumpulan datanya:
delapan belas dari dua puluh sumber daya sudah punya tabelnya sendiri sejak H-1
sampai H-8.

Uji: API 2186 → **2237**.

---
## H-9I — Adapter protokol alat HL7 v2 dan ASTM

### Ditambahkan

- **`H042__health__device_adapter.sql`** — `device_inbound_message`,
  `device_code_map`, `device_code_pending`, beserta empat kolom tambahan pada
  `device_observation`. Trigger `forbid_inbound_message_tamper` mengunci pesan
  aslinya, sidik jarinya, protokolnya, dan waktu terimanya — yang boleh berubah
  hanyalah penanda pemrosesannya. Constraint `device_msg_failure_explained`
  menuntut pesan yang gagal diurai menyebutkan sebabnya.
- **`H043__health__device_adapter_permissions.sql`** — dua menu dan satu aturan
  pemisahan wewenang: yang menerima pesan alat tidak memetakan kodenya.
- **`health-device-adapter.ts`** — pengurai HL7 v2 dan ASTM E1394 sebagai fungsi
  murni, pembacaan karakter pemisah, pembukaan urutan escape, penguraian waktu,
  checksum ASTM, pemetaan istilah, katalog protokol, dan penyusunan ACK.
  **88 pengujian** — terbanyak di antara seluruh fase.
- **`health-device-adapter.service.ts`** dan
  **`health-device-adapter.controller.ts`** — 8 jalan pada
  `/api/v1/health/device-adapter/**`.
- **`prove-health-device-adapter.mjs`** — naskah bukti, **58 pemeriksaan**,
  seluruhnya lulus pada jalan pertama dan lulus pula pada pengulangan.

### Catatan bagi Core

Tidak ada permintaan perubahan shared Core. Pengurai ditulis sendiri alih-alih
memakai pustaka HL7 pihak ketiga: yang dibutuhkan hanyalah lima segmen, dan
pustaka yang menangani seluruh standar membawa serta perilaku yang tidak dapat
diperiksa — termasuk melempar galat pada pesan cacat, yang persis dilarang di
sini.

Uji: API 2097 → **2186**.

---
## H-9K — Dasbor investor agregat, waterfall, dan distribusi

### Ditambahkan

- **`H039__health__investor_dashboard.sql`** — `investor_disclosure_policy`,
  `investor_projection`, `investor_projection_cell`, `investor_waterfall_policy`,
  `investor_waterfall_tier`, `investor_distribution`. Constraint
  `investor_policy_cohort_not_zero`, `investor_cell_suppressed_empty`,
  `investor_dist_approve_not_self`, `investor_dist_pay_not_approver`,
  `investor_dist_within_pool`, serta trigger `forbid_paid_distribution_change`.
  **Tabel selnya tidak punya satu pun kolom pasien**, dan tidak satu pun kunci
  asing ke tabel klinis.
- **`H040__health__investor_permissions.sql`** — tiga menu, satu peran baru
  (Analis Investasi Rumah Sakit), tiga aturan pemisahan wewenang, dan **tepat
  satu hak baru** bagi peran investor: membaca proyeksi agregat.
- **`health-investor.ts`** — aturan sebagai fungsi murni: daftar medan tertutup,
  medan terlarang, ambang kohort, penyamaran beserta penyamaran pelengkapnya,
  waterfall, bagian investor, kelayakan pembayaran, dan akun contoh. **56
  pengujian.**
- **`health-investor.service.ts`** dan **`health-investor.controller.ts`** — 10
  jalan pada `/api/v1/health/investor/**`.
- **`prove-health-investor.mjs`** — naskah bukti, **62 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

### Diperbaiki

- **`H041__health__investor_policy_autoseed.sql`** — penyemaian kebijakan pada
  H040 hanya menjangkau fasilitas yang ada pada saat migrasinya dijalankan,
  sehingga fasilitas yang dibuat kemudian berjalan tanpa baris kebijakan dan
  **penjaga basis datanya diam**: `investor_policy_cohort_not_zero` menjaga
  baris yang ada, dan yang tidak punya baris tidak dijaganya sama sekali.
  Diperbaiki dengan meniadakan keadaan itu, bukan memperbaiki nilai bawaannya.
- `HEALTH_SOD_INVESTOR_VIEW_COMPUTE` dimodelkan ulang sebagai aturan **per
  peran**, bukan pasangan hak akses — analis investasi memegang READ maupun
  CREATE dengan sah. Ditangkap pengujian katalog sendiri.

### Catatan bagi Core

Tidak ada permintaan perubahan shared Core pada fase ini. Mesin investor
bersama tidak disentuh; yang dibangun adalah proyeksi agregat khusus kesehatan
yang berdiri di atas `fee_contract` milik H-9G.

Uji: API 2036 → **2097**.

---
## H-9J — Pemeliharaan biomedis, kalibrasi, keamanan siber alat

### Ditambahkan

- **`H035__health__device_maintenance.sql`** — `device_work_order`,
  `device_calibration_record`, `device_risk_assessment`, `device_risk_control`,
  `device_security_incident`, beserta enam kolom tambahan pada
  `medical_device`. Constraint `device_risk_residual_floor` (risiko sisa tidak
  pernah nol selama ada faktor bawaan), `device_risk_accept_needs_review`,
  `device_risk_decide_not_self`, `device_wo_patient_needs_incident`,
  `device_sec_patient_needs_safety`, `device_cal_standard_required`, serta
  trigger `forbid_completed_work_order_delete`.
- **`H036__health__device_maintenance_permissions.sql`** — dua menu, satu peran
  baru (Analis Keamanan Alat Medis), dan dua aturan pemisahan wewenang;
  `HEALTH_SOD_DEVICE_SECURITY_CONTROL` bersifat CRITICAL.
- **`health-device-maintenance.ts`** — aturan sebagai fungsi murni: jadwal
  pemeliharaan, kelayakan kembali melayani, catatan kalibrasi, penilaian risiko
  siber beserta penahan penggantinya, keputusan yang dituntut, masa berlaku
  penerimaan, insiden siber, langkah penahanan, dan urutan papan perhatian.
  **76 pengujian.**
- **`health-device-maintenance.service.ts`** dan
  **`health-device-maintenance.controller.ts`** — 12 jalan pada
  `/api/v1/health/device-maintenance/**`.
- **`prove-health-device-maintenance.mjs`** — naskah bukti, **81 pemeriksaan**,
  seluruhnya lulus dan lulus pula pada pengulangan.

### Diperbaiki

- **`H037__health__device_maintenance_release_fix.sql`** — aksi `CLOSE` yang
  diberikan H036 tidak ada pada kosakata hak akses bersama, dan penyisipannya
  dilewati diam-diam oleh penjaga `IF a_id IS NOT NULL`. Digantikan `RELEASE`.
  Migrasi baru ini sengaja **menggagalkan dirinya** bila aksinya tidak ada.
- **`H038__health__device_safety_transition_fix.sql`** — constraint
  `medical_device_failed_safety_not_active` memeriksa **keadaan** padahal yang
  dijaga adalah **peralihan**, sehingga teknisi yang menemukan arus bocor pada
  alat yang sedang menyala tidak dapat mencatat temuannya sama sekali.
  Digantikan trigger `forbid_unsafe_device_activation` yang menjaga peralihan
  MASUK ke pelayanan.
- Kolom DATE dicor ke teks oleh PostgreSQL, bukan oleh JavaScript. Driver `pg`
  mengembalikannya sebagai objek `Date` pada tengah malam waktu lokal;
  `String(date).slice(0, 10)` menghasilkan teks yang tidak dapat dibandingkan,
  dan `toISOString()` menggeser tanggalnya sehari mundur pada zona waktu
  Indonesia.

### Catatan bagi Core

Tidak ada permintaan perubahan shared Core pada fase ini. Kosakata hak akses
bersama tidak ditambah — `RELEASE` yang sudah ada dipakai apa adanya.

Uji: API 1956 → **2036**.

---
## H-9H — Registri alat kesehatan dan gateway

### Ditambahkan

- **`H033__health__device_registry.sql`** — `device_gateway`, `medical_device`,
  `device_command_log`, `device_observation`. Beserta constraint
  `device_gateway_secret_is_ref` (kredensial hanya berupa rujukan brankas),
  `medical_device_remote_complete` (enam syarat kendali jarak jauh sekaligus),
  `device_obs_patient_needs_method`, indeks unik parsial `ux_device_obs_message`
  bagi sidik jari pesan, trigger `flag_device_software_change`, serta
  `forbid_ledger_mutation` pada jejak perintah dan hasil alat.
- **`H034__health__device_permissions.sql`** — tiga menu, dua peran, dan dua
  aturan pemisahan wewenang; `HEALTH_SOD_DEVICE_REMOTE` bersifat CRITICAL.
- **`health-device.ts`** — aturan sebagai fungsi murni: kelayakan protokol,
  penerimaan pesanan menurut status alat, cara pengaitan pasien, selisih jam
  alat, provenance hasil, syarat kendali jarak jauh, kelayakan perintah,
  penyimpanan kredensial, dan deteksi duplikat. **49 pengujian.**
- **`health-device.service.ts`** dan **`health-device.controller.ts`** — 13 jalan
  pada `/api/v1/health/devices/**`.
- **`prove-health-device.mjs`** — naskah bukti, **60 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

### Catatan bagi Core

Tidak ada permintaan perubahan shared Core pada fase ini. Alat kesehatan tidak
pernah menyentuh basis data secara langsung; seluruh lalu lintasnya lewat
gateway yang tercatat, dan kredensialnya hanya berupa rujukan brankas.

Uji: API 1903 → **1956**.

---
## H-9C — Siklus klaim internal

### Ditambahkan

- **`H031__health__claim.sql`** — `health_claim`, `health_claim_finding`,
  `health_claim_flag`, `health_claim_reconciliation`. Beserta constraint
  `health_claim_gap_needs_reason`, `health_claim_verify_not_self`,
  `claim_recon_gap_needs_explanation`, trigger `forbid_submitted_claim_delete`
  dan `forbid_submitted_amount_change`, serta indeks unik satu klaim per
  kunjungan yang masih hidup.
- **`H032__health__claim_permissions.sql`** — membuka kembali menu
  `HEALTH_CLAIM` yang ditutup H017, menambah dua menu, dua peran baru, dan dua
  aturan pemisahan wewenang.
- **`health-claim.ts`** — aturan sebagai fungsi murni: daur hidup klaim,
  verifikasi internal, kelayakan pengajuan, perbandingan tiga angka, pencatatan
  keputusan, rekonsiliasi tiga sisi, dan penanda untuk telaah. **58 pengujian.**
- **`health-claim.service.ts`** dan **`health-claim.controller.ts`** — sepuluh
  jalan pada `/api/v1/health/claims/**`.
- **`prove-health-claim.mjs`** — naskah bukti, **56 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

Uji: API 1843 → **1903**.

### Keputusan yang perlu dicatat

- **Tiga angka, tiga kolom**, dan tidak ada kolom penyatu. Naskah bukti
  memeriksa ketiadaannya secara harfiah pada `information_schema`.

- **Nilai yang sudah diajukan tidak dapat diubah.** Yang sudah dikirim ke
  penjamin adalah angka itu.

- **Verifikasi internal menemukan kekurangan sebelum penjamin menemukannya**,
  dan setiap temuan dilaporkan namanya beserta peran yang memperbaikinya.

- **Kelas yang melebihi hak peserta dilaporkan tetapi tidak menahan.**
  Menahannya akan membuat verifikasi internal dimatikan oleh orang pertama yang
  klaimnya tertahan karena hal yang memang sah.

- **Sebab penolakan adalah kode tertutup**, dan `OTHER` wajib berketerangan.

- **PENANDA ANTI-FRAUD TIDAK PERNAH MENGHENTIKAN PENGAJUAN.** Tabelnya tidak
  punya satu pun kolom penahan, dan kata "fraud" tidak muncul pada satu pun
  pesannya — penanda yang berbunyi seperti tuduhan akan dibantah alih-alih
  ditelaah.

- **Yang mengode tidak memverifikasi klaimnya sendiri**, diperiksa pada tingkat
  baris — bukan sebagai pasangan hak akses, sebab rumah sakit kecil yang koder
  dan verifikatornya bergantian tetap harus dapat bekerja.

- **Rekonsiliasi tiga sisi**, dan selisih yang tidak terjelaskan tidak boleh
  ditutup. Ia tetap boleh dicatat tanpa ditutup.

### Masih terhalang

Enam dari lima belas tahap milik BPJS: kepesertaan, rujukan, SEP, grouping,
pengajuan daring, dan keputusan langsung. Ditambah penjurnalan klaimnya yang
menunggu kode peristiwa `HEALTH_*` dari Core.

---

## H-9G — Kontrak fee sistem dan fee investor

### Ditambahkan

- **`H028__health__fee_contract.sql`** — `fee_contract`,
  `fee_contract_exclusion`, `fee_contract_application`. Beserta tiga constraint
  berpasangan yang menegakkan rantai tiga orang, `fee_contract_not_backdated`,
  `fee_contract_active_complete`, trigger `forbid_active_contract_change`, dan
  indeks unik satu kontrak aktif per jenis.
- **`H029__health__fee_contract_permissions.sql`** — satu menu, tiga peran baru,
  tiga aturan pemisahan wewenang (satu di antaranya bertingkat `CRITICAL`).
- **`H030__health__fee_application_capped_fix.sql`** — pembetulan constraint,
  lihat di bawah.
- **`health-fee-contract.ts`** — aturan sebagai fungsi murni: daur hidup
  kontrak, rantai tiga orang, kelayakan aktivasi, perhitungan berbatas, dan
  daftar putih medan investor. **42 pengujian.**
- **`health-fee-contract.service.ts`** dan
  **`health-fee-contract.controller.ts`** — sembilan jalan pada
  `/api/v1/health/fee-contract/**`.
- **`prove-health-fee-contract.mjs`** — naskah bukti, **52 pemeriksaan**,
  seluruhnya lulus dan lulus pula pada pengulangan.

Uji: API 1799 → **1843**.

### Diperbaiki

- **`fee_application_capped_consistent` menyamakan dua hal yang berbeda.**
  Constraint itu berbunyi `was_capped = (applied_percent < requested_percent)`,
  padahal persentase terpakai yang lebih kecil punya empat sebab — tidak ada
  kontraknya, kontraknya belum atau sudah lewat, layanannya dikecualikan, dan
  melampaui batas — dan hanya yang terakhir merupakan pembatasan. Akibatnya
  setiap perhitungan **tanpa kontrak**, yaitu keadaan bawaan seluruh fasilitas,
  ditolak basis data: fee yang bawaannya NONE justru tidak dapat dicatat sebagai
  nol.

  Pembetulannya dibawa **migrasi baru**, bukan dengan menyunting H028: yang
  sudah diterapkan tidak diubah diam-diam di belakang punggung lingkungan lain.

### Keputusan yang perlu dicatat

- **BAWAANNYA NONE**, dan perhitungan bernilai nol tetap dicatat — pertanyaan
  "mengapa bulan ini tidak ada fee" dijawab dengan barisnya sendiri, bukan
  dengan ketiadaan baris.

- **Tiga orang berbeda**, ditegakkan tiga constraint berpasangan. Naskah
  buktinya sengaja memberi penyusun hak menelaah, supaya penolakannya datang
  dari pemeriksaan baris — bukan dari ketiadaan hak akses.

- **Batas maksimum ditegakkan saat menghitung**, dan yang melampaui dibatasi
  serta dinyatakan, bukan ditolak diam-diam.

- **Syarat kontrak yang sudah aktif tidak dapat diubah.** Menaikkan batas pada
  kontrak berjalan adalah cara paling sunyi untuk mengambil lebih banyak.

- **Kontrak yang habis masa berlakunya menghentikan fee-nya sendiri**, tanpa
  menunggu seseorang ingat.

- **Investor tidak pernah memperoleh akses data pasien**, dijaga dari dua arah:
  peran bawaannya hanya dua hak, dan ringkasannya disaring lewat **daftar
  putih** — daftar hitam melewatkan setiap medan yang ditambahkan kelak.

---

## H-9F — Settlement jasa, koreksi, dan pernyataan

### Ditambahkan

- **`H026__health__fee_settlement.sql`** — `fee_settlement`,
  `fee_settlement_line`, `fee_settlement_correction`, `fee_statement`. Beserta
  trigger `forbid_settlement_identity_change`, `forbid_locked_settlement_line`,
  constraint trigger `check_correction_total`, dan penjaga anti-hapus pada
  ketiga tabel yang menyangkut uang.
- **`H027__health__settlement_permissions.sql`** — dua menu, dua peran baru,
  tiga aturan pemisahan wewenang.
- **`health-settlement.ts`** — aturan sebagai fungsi murni: pemeriksaan jumlah
  baris, kelayakan pembayaran, penyesuaian dan pembalikan, penyusunan dan
  penerbitan pernyataan, serta potongan pajak. **42 pengujian.**
- **`health-settlement.service.ts`** dan **`health-settlement.controller.ts`** —
  sembilan jalan pada `/api/v1/health/settlement/**`.
- **`prove-health-settlement.mjs`** — naskah bukti, **56 pemeriksaan**,
  seluruhnya lulus dan lulus pula pada pengulangan.

Uji: API 1755 → **1799**.

### Keputusan yang perlu dicatat

- **TIDAK ADA SATU PUN JALAN YANG MENGHAPUS.** Settlement, koreksi, dan
  pernyataan seluruhnya kekal.

- **Empat wewenang, empat pemegang berbeda:** menghitung, menyetujui, mengunci
  dan membayar, lalu mengoreksi.

- **Simulasi tidak pernah menjadi utang**, tandanya tidak dapat diubah, dan
  nomornya berawalan berbeda — nomor yang tidak dapat dibedakan akan tertukar
  pada percakapan lisan.

- **Pembalikan wajib sama besar dengan yang tersisa.** Penyesuaian boleh
  sebagian, tetapi tidak boleh membuat nilai akhirnya negatif.

- **Nilai bersih dihitung, bukan diketik.** Pajak hanya dipotong dari jasa
  perorangan.

- **Pernyataan hanya memuat yang benar-benar dibayarkan**, dan bila angkanya
  berubah, penerimanya memegang dua kertas — bukan satu kertas yang diam-diam
  berganti isi.

### Catatan bagi naskah bukti berikutnya

Uji "membayar simulasi lewat basis data ditolak constraint" semula gagal bukan
karena constraint-nya tidak ada, melainkan karena constraint **lain** menolaknya
lebih dahulu. Pada H-9 pelajarannya *periksa bunyi penolakannya*; sejak H-9F
satu langkah lebih jauh: **susun keadaannya sehingga hanya satu penjaga yang
mungkin berbunyi.** Pada tabel yang dijaga tujuh constraint, uji yang tidak
melakukannya hanya membuktikan bahwa salah satu dari ketujuhnya bekerja.

---

## H-9E — Kebijakan pembagian jasa dan kontributor

### Ditambahkan

- **`H024__health__fee_policy.sql`** — `fee_policy`, `fee_policy_line`,
  `fee_contributor`. Beserta constraint trigger `check_fee_policy_total`,
  trigger `forbid_active_fee_policy_mutation`, dan constraint
  `fee_policy_approval_not_self` serta `fee_policy_sample_not_production`.
  **Tidak menyemai satu pun persentase.**
- **`H025__health__fee_permissions.sql`** — dua menu, dua peran baru, dua aturan
  pemisahan wewenang.
- **`health-fee.ts`** — aturan sebagai fungsi murni: pemeriksaan bentuk
  kebijakan, persetujuan, penyaringan kontributor, kelayakan dasar perhitungan,
  pembagian jasa, pembagian kepada kontributor, gerbang kontrak, dan mesin
  status settlement. **56 pengujian.**
- **`health-fee.service.ts`** dan **`health-fee.controller.ts`** — tujuh jalan
  pada `/api/v1/health/fee/**`.
- **`prove-health-fee.mjs`** — naskah bukti, **50 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

Uji: API 1697 → **1755**.

### Keputusan yang perlu dicatat

- **TIDAK ADA SATU PUN PERSENTASE DI DALAM KODE MAUPUN MIGRASI.** Persentase
  pembagian jasa adalah kesepakatan antara rumah sakit dan tenaga medisnya.
  Naskah bukti memeriksanya secara harfiah: kebijakan yang lahir tanpa pembuat —
  yaitu yang datang dari migrasi — harus nol.

- **Jasa BPJS dihitung dari klaim yang DIBAYAR.** Taksiran boleh untuk akrual
  dan simulasi, tidak pernah untuk yang dibayarkan.

- **Jasa dibayarkan kepada yang benar-benar hadir**, dan buktinya menunjuk ke
  sumbernya dari H-7. Yang tersaring dikembalikan, bukan dihapus diam-diam.

- **Penerima jasa tidak menyetujui aturan yang membayar dirinya**, dan itu
  **tidak dapat ditegakkan hak akses saja** — diperiksa pada tingkat baris.

- **Fee sistem dan fee investor bawaannya NONE**, dan aktivasinya menuntut
  keenam syaratnya. Yang kurang disebutkan satu per satu.

- **Templat contoh bukan standar nasional dan bukan saran hukum.**

- **Sisa pembulatan diberikan kepada bobot terbesar**, bukan kepada yang pertama
  pada daftar.

---

## H-9D — Tarif JKN berversi dan cakupan penjamin

### Ditambahkan

- **`H022__health__tariff.sql`** — `jkn_regulation`, `jkn_tariff_version`,
  `jkn_tariff`, `health_payer_coverage`. Beserta constraint pengecualian
  `jkn_tariff_no_overlap` (`EXCLUDE USING gist`), trigger
  `forbid_active_tariff_mutation`, dan constraint
  `jkn_version_approval_not_self`.
- **`H023__health__tariff_permissions.sql`** — dua menu, satu peran baru
  (Petugas Tarif), satu aturan pemisahan wewenang.
- **`health-tariff.ts`** — aturan sebagai fungsi murni: pemilihan tarif menurut
  kunci enam bagian dan tanggal layanan, pemeriksaan tumpang tindih, kelayakan
  aktivasi versi, dan pembagian tanggungan penjamin. **46 pengujian.**
- **`health-tariff.service.ts`** dan **`health-tariff.controller.ts`** —
  sepuluh jalan pada `/api/v1/health/tariff/**`.
- **`prove-health-tariff.mjs`** — naskah bukti, **43 pemeriksaan**, seluruhnya
  lulus dan lulus pula pada pengulangan.

Uji: API 1649 → **1697**.

### Diperbaiki

- **`effectiveTo` disimpan sebagai batas atas `daterange` yang terbuka**,
  sehingga hari terakhir setiap masa berlaku tidak tertutupi tarif mana pun.
  Pengujian satuannya lulus — aturan murninya memakai batas tertutup dan
  menjawab benar; yang salah adalah penerjemahannya ke tipe basis data. Hari
  terakhir justru hari yang paling sering dipersoalkan: ia hari terakhir sebelum
  tarif baru berlaku.

### Keputusan yang perlu dicatat

- **Tarif dipilih menurut TANGGAL LAYANAN, bukan tanggal klaim.** Memakai
  tanggal klaim berarti menunda pengajuan menjadi cara menaikkan tagihan.

- **Tarif tidak pernah ditimpa**, dan baris pada versi yang sudah aktif tidak
  dapat diubah maupun dihapus. Klaim yang sudah dihitung memakainya harus tetap
  dapat dijelaskan.

- **Tumpang tindih ditolak `EXCLUDE USING gist`**, dengan `COALESCE` pada bagian
  yang boleh kosong — tanpa itu dua tarif **umum** yang bertumpang tindih akan
  lolos, sebab NULL tidak pernah sama dengan NULL.

- **Tarif yang belum ada TIDAK ditaksir**, dan dua tarif yang sama-sama berlaku
  menghentikan perhitungan alih-alih memilih salah satunya.

- **Aktivasi menuntut dasar peraturan, berkas sumber, sidik jarinya, dan isi.**
  Yang mengimpor tidak menyetujui.

- **Pembulatan tanggungan memihak pasien.** Sisa satu rupiah menjadi tanggungan
  penjamin.

- **Rujukan yang belum ada menahan tanggungan SEMENTARA**, dan pesannya
  mengatakan begitu.

### Masih terhalang

Isi tarif resmi menunggu terbitan resmi; grouper INA-CBG menunggu perangkat
lunak berlisensi. Inventaris peraturannya sengaja **kosong** — inventaris yang
kosong lebih baik daripada inventaris yang berisi nomor peraturan hasil ingatan,
sebab nomor yang keliru akan disalin ke dokumen klaim.

---

## H-9N — Pemetaan akuntansi kesehatan

### Ditambahkan

- **`H020__health__accounting_map.sql`** — `health_accounting_profile`,
  `health_account_link`, `health_accounting_rule`, `health_coa_template`.
  Beserta trigger `check_health_account_link` dan constraint
  `health_rule_amount_key_plain`, `health_rule_sides_differ`. Templat bagan akun
  kesehatan disemai sebagai **data**: 36 akun beserta peran dan saldo normalnya.
- **`H021__health__accounting_permissions.sql`** — satu menu, satu peran baru
  (Petugas Keuangan Rumah Sakit), satu aturan pemisahan wewenang.
- **`health-accounting.ts`** — aturan sebagai fungsi murni: golongan dan saldo
  normal peran, katalog tiga belas peristiwa kesehatan, kelengkapan profil,
  kelayakan penautan akun, kelayakan aturan, kesiapan menjurnal, dan selisih
  klaim. **45 pengujian.**
- **`health-accounting.service.ts`** dan **`health-accounting.controller.ts`** —
  sepuluh jalan pada `/api/v1/health/accounting/**`.
- **`prove-health-accounting.mjs`** — naskah bukti, **56 pemeriksaan**,
  seluruhnya lulus dan lulus pula pada pengulangan.

Uji: API 1602 → **1649**.

### Keputusan yang perlu dicatat

- **Aturan pertama: jangan membuat buku besar kedua.** Tidak ada tabel jurnal,
  saldo, maupun neraca di sini. Naskah buktinya memeriksa hal itu secara
  harfiah — ia menghitung tabel `health*journal*`, `health*ledger*`,
  `health*balance*` dan menuntut nol, lalu memakai seluruh modul dan menuntut
  `journal_entry` serta `accounting_event` tidak bertambah satu baris pun.

- **Peran akun, bukan nomor akun.** Rumah sakit yang memakai bagan akun berbeda
  mengubah tautannya, bukan kodenya.

- **Saldo normal akun harus cocok dengan golongan perannya**, ditegakkan
  trigger. Menautkan pendapatan ke akun bersaldo normal debit akan menghasilkan
  pendapatan bernilai negatif pada setiap laporan. Akun induk pun ditolak.

- **Medan nilai adalah nama medan, bukan rumus.** Larangan `eval` berlaku pada
  data pula.

- **Selisih klaim adalah BEBAN**, bukan pendapatan yang hilang begitu saja — ia
  ukuran mutu pengkodean dan kelengkapan berkas. Disetujui lebih besar daripada
  yang diajukan bukan keuntungan melainkan tanda pengajuannya keliru: ditelaah,
  tidak dijurnal.

- **Laporan kesiapan memisahkan pekerjaan kami dari yang menunggu Core.**

- **Petugas keuangan tidak membaca rekam medis.** Menggabungkan keduanya adalah
  cara paling sunyi untuk membocorkan seluruh riwayat pasien.

### Masih terhalang

Kode peristiwa `HEALTH_*` menunggu keputusan Core — diajukan sejak H-4. Sampai
ia ada, penyerahan obat belum memicu pencatatan harga pokok, pendapatan layanan
belum masuk jurnal, dan pembagian jasa belum menghasilkan utang. Konstanta
`PERISTIWA_DITERIMA_CORE` sengaja **kosong**; mengisinya dengan tebakan akan
membuat laporan kesiapan berkata siap sementara jurnalnya tidak akan pernah
terbentuk.

---

## H-9L — Katalog layanan, pemetaan unit, dan sumber master data

### Ditambahkan

- **`H018__health__master_data.sql`** — `master_data_batch`, `health_service`,
  `health_service_mapping`, `health_service_mapping_gap`, `local_code_mapping`.
  Beserta trigger `forbid_activation_without_mapping` dan constraint
  `health_service_issuer_only_official`.
- **`H019__health__master_data_permissions.sql`** — aksi `ACTIVATE`, tiga menu,
  satu peran baru, satu aturan pemisahan wewenang.
- **`health-master-data.ts`** — aturan sebagai fungsi murni: kelayakan sumber
  master data, penghapusan data contoh, sifat layanan, kelengkapan pemetaan,
  aktivasi, pemetaan kode lokal, dan pembangkitan deterministik.
  **53 pengujian.**
- **`health-master-data.service.ts`** dan **`health-master-data.controller.ts`**
  — dua belas jalan pada `/api/v1/health/master-data/**`.
- **`prove-health-master-data.mjs`** — naskah bukti, **61 pemeriksaan**,
  seluruhnya lulus dan lulus pula pada pengulangan.

Uji: API 1547 → **1602**.

### Diperbaiki

- **Kode kumpulan data contoh dihitung dari benih saja**, sedangkan uniknya per
  tenant. Fasilitas kedua yang disemai dengan benih yang sama gagal seluruhnya —
  persis kebalikan dari maksud "deterministik". Kode fasilitas kini disertakan.
  Sekelas dengan cacat nomor insiden pada H-9: pengenal yang dihitung per
  lingkup sempit, di bawah batasan unik yang lebih luas.
- **Penyemaian ulang berkata "berhasil" sambil membuat nol baris.** Kini ia
  ditolak dengan alasannya, dan penyemaian yang sebagian terlewat menyebutkan
  berapa baris yang dilewati serta mengapa.

### Keputusan yang perlu dicatat

- **Layanan tidak dapat diaktifkan sebelum pemetaannya lengkap**, ditegakkan
  trigger — bukan hanya oleh layanan. Katalog layanan paling sering disunting
  lewat jalan lain: impor massal, perbaikan data, naskah penyemaian.

- **"Bila berlaku" ditentukan sifat layanannya, bukan pilihan pengguna.**
  Pemeriksaan laboratorium selalu menuntut spesimen. Ditetapkan satu fungsi,
  supaya tidak ada tempat kedua yang memutuskannya.

- **Enam dari empat belas slot menunggu fase berikutnya**, dan kekurangannya
  menyebut fase itu. Menyamarkannya sebagai kekurangan biasa akan membuat
  penggunanya mencari kolom yang tidak ada.

- **Papan kekurangan dikelompokkan menurut SLOT, bukan menurut layanan.** Satu
  penyebab biasanya menjelaskan puluhan layanan sekaligus.

- **Harga sintetis tidak dapat menyamar sebagai harga resmi.** Penandanya
  melekat pada barisnya dan tidak dapat dilepas.

- **Data contoh disembunyikan, tidak dihapus**, dan penyembunyiannya menolak
  bila ada data nyata yang merujuknya — menyebutkan apa yang merujuknya, lalu
  menyerahkan keputusannya kepada manusia.

- **Pemetaan kode dipensiunkan, bukan dihapus.** Rekam lama yang sudah dikirim
  memakai pemetaan lama harus tetap dapat dijelaskan.

---

## H-9 — Rekam medis, pengkodean, penahanan hukum, mutu, dan keselamatan pasien

### Ditambahkan

- **`H016__health__him_quality.sql`** — `terminology_snapshot`,
  `terminology_code`, `him_coding`, `him_coded_item`, `him_deficiency`,
  `him_legal_hold`, `him_information_release`, `safety_incident`,
  `safety_corrective_action`, `quality_indicator`, `quality_measurement`.
  Beserta trigger `forbid_change_under_legal_hold` pada `clinical_note` dan
  `encounter_diagnosis`, larangan hapus pada catatan pelepasan dan laporan
  insiden, serta indeks unik parsial "satu diagnosis utama".
- **`H017__health__him_permissions.sql`** — aksi `VERIFY`, enam menu, empat
  peran baru, dua aturan pemisahan wewenang. Pelaporan insiden diberikan kepada
  enam belas peran klinis dengan sengaja.
- **`health-him.ts`** — aturan sebagai fungsi murni: kelengkapan berkas, skor
  kelengkapan, kelayakan kode terhadap tanggal layanan, kelayakan pengkodean,
  pemisahan koder–verifikator, penahanan hukum, pelepasan informasi,
  klasifikasi insiden, penutupan insiden, urutan papan, dan indikator mutu.
  **67 pengujian.**
- **`health-him.service.ts`** dan **`health-him.controller.ts`** — tiga belas
  jalan pada `/api/v1/health/him/**`.
- **`health-catalog.ts`** — enam menu H-9, empat peran, satu aturan SoD, dan
  sembilan aksi hak akses yang selama ini ada di migrasi tetapi belum
  terdaftar di katalog (`ADMINISTER`, `RECEIVE`, `AMEND`, `TRIAGE`,
  `CHECKLIST`, `INCISE`, `IMMUNIZE`, `VERIFY`).
- **`prove-health-him.mjs`** — naskah bukti, **74 pemeriksaan**, tujuh pengguna
  berbeda, seluruhnya lulus dan lulus pula pada pengulangan.

Uji: API 1474 → **1547**.

### Diperbaiki

Empat cacat yang ditemukan naskah bukti dan tidak tertangkap satu pun pengujian
unit — seluruhnya pada jalur yang dipakai setiap hari:

- **`ON CONFLICT` pada indeks unik parsial tanpa menyebut predikatnya.**
  `ux_him_coding_encounter` parsial (`WHERE encounter_id IS NOT NULL`), dan
  PostgreSQL menolak seluruh pernyataan bila predikatnya tidak disebutkan.
  Pemeriksaan kelengkapan — langkah pertama seluruh H-9 — gagal 500 pada setiap
  panggilan.
- **Parameter dipakai dua kali dengan tipe yang disimpulkan berbeda.** `$1` dan
  `$2` muncul di daftar `SELECT` sekaligus di klausa `WHERE`; Postgres menolak
  dengan "inconsistent types deduced". Kekurangan berkas tidak pernah tersimpan.
- **Nomor insiden dihitung per fasilitas tetapi unik per tenant.** Fasilitas
  kedua yang melapor pada hari yang sama gagal melapor sama sekali. Kode
  fasilitas kini disertakan, mengikuti pola yang sudah dipakai H-5 sampai H-7.
- **Kunci mati "diagnosis belum berkode".** Kekurangan itu semula menahan
  pengkodean, sehingga berkas terkunci selamanya: pengkodean ditolak karena
  belum berkode, dan ia tidak akan pernah berkode karena pengkodeannya ditolak.

### Keputusan yang perlu dicatat

- **Kekurangan berkas disimpan sebagai BARIS, bukan sebagai angka.** Satu baris
  per kekurangan, bernama, beserta peran yang dapat memperbaikinya. Dokter yang
  membaca "resume medis belum ditandatangani" akan menandatanganinya; dokter
  yang membaca "82%" akan menutup layarnya. Skornya tetap dihitung — oleh fungsi
  yang berbeda, untuk pembaca yang berbeda.

- **Kode yang dicabut tetap terbaca, tetapi tidak dapat dipilih**, dan
  dibandingkan dengan **tanggal layanan**. Berkas Maret yang dikode Juni tetap
  memakai terminologi Maret. Versinya disalin ke tiap baris kode — tanpa itu,
  kode lama tidak dapat ditafsirkan setelah terminologinya berganti dua kali.

- **Penahanan hukum menahan perubahan, bukan pembacaan.** Menahan pembacaan akan
  menghentikan perawatan pasien yang rekamnya kebetulan diperkarakan, dan pasien
  itu tetap sakit.

- **Yang menentukan pelepasan informasi adalah dasar hukumnya, bukan
  pemintanya.** Kepolisian tanpa nomor surat berkedudukan sama dengan orang
  asing. Yang memutuskan pelepasan bukan yang menyerahkan berkasnya.

- **Pelaporan insiden sengaja longgar, penutupannya sengaja ketat**, dan pelapor
  boleh anonim — bila anonim, `reported_by` benar-benar kosong.

- **Penyebut nol menghasilkan "belum ada datanya", bukan nol.** Nol akan
  terbaca sebagai mutu terburuk.

### Catatan bagi naskah bukti berikutnya

Uji penahanan hukum semula memakai catatan klinis yang **sudah
ditandatangani** — yang sudah dikunci trigger H-3, dan trigger itu berjalan
lebih dahulu menurut urutan abjad namanya. Naskah itu lulus tanpa penahanan
hukum pernah diuji sama sekali.

Sejak H-9, setiap pemeriksaan yang menembus invarian lewat SQL langsung
memeriksa **bunyi penolakannya** — nama constraint atau kalimat triggernya —
bukan sekadar bahwa pernyataannya gagal. Satu tabel dapat memiliki beberapa
penjaga; "gagal" saja tidak membuktikan penjaga yang mana yang bekerja, dan
naskah bukti yang lulus karena penjaga yang keliru lebih berbahaya daripada
tidak ada naskah bukti sama sekali.

---

## H-8 — Puskesmas dan Posyandu: pertumbuhan anak, imunisasi, dan cakupan

### Ditambahkan

- **`H014__health__community.sql`** — `family_folder`, `family_member`,
  `growth_reference`, `growth_measurement`, `immunization_schedule`,
  `immunization_record`, `community_program_target`, `home_visit`.
- **`H015__health__community_permissions.sql`** — aksi `IMMUNIZE`, lima menu,
  tiga peran baru, dan **jadwal imunisasi nasional sebagai data**.
- **`health-community.ts`** — aturan sebagai fungsi murni: z-score LMS,
  pemilihan baris rujukan, penilaian gizi, cara pengukuran tinggi, berat tidak
  naik, kelayakan imunisasi, tunggakan, cakupan, dan urutan kunjungan rumah.
  **54 pengujian.**
- **`health-community.service.ts`** dan **`health-community.controller.ts`** —
  sembilan jalan pada `/api/v1/health/community/**`.
- **`prove-health-community.mjs`** — naskah bukti, 45 pemeriksaan, seluruhnya
  lulus.

Uji: API 1420 → **1474**.

### Keputusan yang perlu dicatat

- **Tabel rujukan pertumbuhan WHO adalah DATA, bukan kode.** Disimpan sebagai
  LMS dan dimuat saat menghitung. Menanam angka hasil taksiran di dalam kode
  akan menghasilkan klasifikasi stunting yang tampak resmi dan sebenarnya
  karangan — dan klasifikasi itu dipakai menentukan siapa menerima bantuan
  pangan. Tanpa baris yang berlaku, jawabannya "belum dapat dinilai", bukan
  "normal".

- **Stunting menahun, wasting akut**, dan pesannya menyebutkan perbedaan itu
  dengan tegas. Anak pendek karena kurang gizi bertahun-tahun menuntut
  perbaikan pangan keluarga; anak kurus karena sakit pekan lalu menuntut
  pengobatan sekarang.

- **Cara pengukuran tinggi wajib disebutkan.** Berbaring dan berdiri berselisih
  sekitar 0,7 cm — cukup untuk memindahkan anak melintasi ambang stunting.
  Pengukuran yang tidak sesuai umur **dibetulkan, bukan ditolak**: menolaknya
  akan membuat kader mengulang pengukuran pada bayi yang sudah menangis, dan
  yang lebih sering terjadi, membuat kader mengubah umurnya supaya lewat.

- **Vaksin yang terlalu cepat DITOLAK, bukan diperingatkan**, dengan tanggal
  paling awalnya disebutkan. Ia tidak membentuk kekebalan yang cukup — dan yang
  lebih berbahaya, ia akan tercatat sebagai diberikan; anak itu lalu tampak
  lengkap di laporan cakupan dan tidak akan dikejar siapa pun.

- **Kader bukan petugas Puskesmas.** `HEALTH_CADRE` sengaja tanpa
  `HEALTH_PATIENT.READ` dan tanpa `IMMUNIZE`. Ia melihat anak-anak lewat folder
  keluarganya — empat puluh anak di desanya, bukan seluruh rekam medis
  kabupaten.

- **"Berat tidak naik dua kali berturut-turut" dipertahankan** di samping
  z-score. Ia tidak menuntut tabel rujukan, tidak menuntut umur yang tepat, dan
  dapat dilihat kader dari buku KMS di tangannya.

- **Penyebut cakupan adalah SASARAN, bukan yang datang.**

- **Satu orang hanya menjadi anggota aktif pada satu folder keluarga.** Anak yang
  pindah rumah dan terhitung dua kali membuat cakupan tampak lebih baik. Anggota
  yang sudah terdaftar di tempat lain dilaporkan namanya, tanpa menggagalkan
  pembuatan folder barunya.

- **Catatan pertumbuhan dan imunisasi tidak dapat diubah maupun dihapus.**
  Grafik pertumbuhan yang dapat disunting bukan grafik pertumbuhan; ia gambar.
  Catatan imunisasi adalah dasar keputusan memberikan dosis berikutnya.

### Yang ditemukan naskah bukti

Naskah ini lulus pada percobaan pertama tetapi **gagal pada percobaan kedua**:
langkah "tanpa tabel rujukan" menyemai barisnya sendiri, sehingga jalannya kedua
kali tidak lagi menemui keadaan yang hendak diujinya. Naskah bukti yang hanya
lulus sekali bukan naskah bukti — ia kebetulan. Kini langkah itu memakai anak
berumur 36 bulan pada tabel yang hanya memuat umur 24 bulan.

### Belum dikerjakan

Layar web Posyandu, penyakit menular dan tidak menular, KIA, kesehatan
lingkungan dan sekolah, jadwal Posyandu beserta meja layanannya, serta **tabel
rujukan WHO yang lengkap** — strukturnya ada, isinya menunggu penyemaian resmi.

Layar webnya sengaja belum dibuat: Posyandu dijalankan kader, sering tanpa
internet, dan sasarannya populasi bukan pasien yang datang. Membuatnya sebagai
salinan layar rumah sakit akan lebih buruk daripada belum membuatnya sama
sekali.

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
- **`docs/emedik/21-isolasi-per-fasilitas.md`** dan **integration request 003**.

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
