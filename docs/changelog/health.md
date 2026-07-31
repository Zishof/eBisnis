# Changelog — Vertical Kesehatan (eMedik)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` global.

---

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
