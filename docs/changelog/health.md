# Changelog — Vertical Kesehatan (eMedik)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` global.

---

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
