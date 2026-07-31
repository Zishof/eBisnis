# Changelog — Vertical Kesehatan (eMedik)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` global.

---

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
