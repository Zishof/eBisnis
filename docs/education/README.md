# README Modul Education: ePesantren, eSchool, dan eCampus

Dokumen ini merangkum seluruh modul yang dijelaskan pada profil ePesantren, eSchool, dan eCampus, sekaligus menjelaskan posisi masing-masing modul terhadap kode eBisnis saat ini. Detail gap teknis per modul tersedia di `docs/gap-analysis-epesantren-eschool-ecampus-2026-08-05.md`.

## Gambaran Umum

Platform education di eBisnis diarahkan menjadi ekosistem multi-portal untuk lembaga pendidikan dari pesantren, sekolah, sampai perguruan tinggi. Ketiganya berbagi fondasi yang sama: tenant, pengguna, role, hak akses, audit, pembayaran, akuntansi, dokumen, CMS, notifikasi, dan website publik. Perbedaannya ada pada domain operasional.

- ePesantren fokus pada santri mukim, asrama, diniyah, tahfiz, izin keluar-masuk, gerbang keamanan, wali santri, dompet santri, PSB, dan website pondok/unit.
- eSchool fokus pada siswa, guru, rombongan belajar, kurikulum sekolah, DAPODIK, PPDB, BK, rapor, sarpras, perpustakaan, akreditasi, dan portal orang tua.
- eCampus fokus pada mahasiswa, dosen, prodi, fakultas, PMB, KRS/KHS, transkrip, OBE/MBKM, Feeder/PD-Dikti, SPMI, SPI, penelitian, pengabdian, skripsi, wisuda, dan tracer alumni.

## Status Implementasi Saat Ini

| Produk | Status umum | Ringkasan |
|---|---:|---|
| ePesantren | Paling matang | Sudah memiliki backend dan frontend operasional untuk sebagian besar modul inti. |
| eSchool | Fondasi aktif | Sudah memiliki katalog education dan facade DAPODIK eSchool, tetapi domain siswa/guru/akademik sekolah murni masih perlu diekstrak. |
| eCampus | Belum menjadi vertical penuh | Modul kampus inti belum tersedia, tetapi bisa memakai fondasi platform umum. |

## Katalog API Education

Peta implementasi education sekarang tersedia sebagai API agar UI admin, dokumentasi, dan pekerjaan berikutnya memakai sumber yang sama.

- `GET /education/modules`: daftar modul ePesantren, eSchool, dan eCampus beserta status gap, prioritas, bukti/fondasi, dan pekerjaan berikutnya.
- `GET /education/datasets`: daftar dataset nasional DAPODIK, EMIS, dan Feeder/PD-Dikti beserta kolom kunci dan endpoint import/export jika sudah tersedia.
- `GET /education/roadmap`: prioritas P0-P3 untuk batch implementasi berikutnya.
- `GET /eschool/dapodik/datasets`: dataset DAPODIK yang dapat dipakai dari menu eSchool.
- `GET /eschool/dapodik/:dataset/template`: template CSV DAPODIK eSchool.
- `GET /eschool/dapodik/:dataset/export`: export CSV DAPODIK eSchool.
- `POST /eschool/dapodik/:dataset/import`: validasi dry-run atau import final DAPODIK eSchool.

Halaman admin yang memakai katalog ini:

- `/app/education/implementasi`
- `/app/eschool`
- `/app/eschool/dapodik`
- `/app/ecampus`

## Fondasi Platform Bersama

Modul platform ini dapat dipakai oleh ePesantren, eSchool, dan eCampus:

- Autentikasi dan user management.
- Tenant multi-lembaga.
- Role, permission, dan menu dinamis.
- Audit dan observability.
- Billing dan subscription.
- Payment.
- Accounting.
- CMS dan halaman publik.
- Surat dan arsip digital.
- Notifikasi.
- AI assistant.
- POS dan koperasi.
- eMedik/health untuk layanan kesehatan.

## Modul ePesantren

### 1. Dashboard Pengasuh, Yayasan, dan Pimpinan

Dashboard menampilkan gambaran operasional pondok: jumlah santri, tren PSB, tagihan, kehadiran, pelanggaran, prestasi, kegiatan asrama, dan indikator layanan wali. Modul ini penting untuk pimpinan yang membutuhkan kontrol cepat tanpa membuka setiap menu.

Status saat ini: sebagian. Dashboard dan laporan sudah ada, tetapi drilldown KPI, analitik tren, dan alarm operasional masih perlu diperkuat.

### 2. Master Data Pondok

Master data mencakup profil pondok, identitas lembaga, alamat, kontak, logo, visi, misi, struktur unit, dan informasi publik. Data ini menjadi sumber utama untuk website pondok, dokumen resmi, dan konfigurasi tenant.

Status saat ini: sebagian kuat. Profil, media, berita, dan unit pendidikan sudah tersedia.

### 3. Unit Pendidikan

Unit pendidikan mencakup MI, MTs, MA, Madrasah Diniyah, Tahfiz, BLK, atau unit lain di bawah pesantren. Setiap unit dapat memiliki halaman welcome, subdomain, domain custom, gambar hero, dan link PSB sendiri.

Status saat ini: sebagian kuat. CRUD unit, situs unit, dan pengaturan subdomain sudah tersedia. Penguatan berikutnya adalah menjadikan unit sekolah sebagai eSchool operasional penuh.

### 4. Website Pondok dan Website Unit

Website publik menampilkan profil, sejarah, visi misi, unit pendidikan, berita, galeri, dan PSB. Gambar-gambar pendidikan/pesantren sebaiknya dapat diganti admin agar setiap pondok punya identitas visual sendiri.

Status saat ini: sebagian kuat. CMS profil, media, berita, halaman pondok, dan halaman unit sudah tersedia.

### 5. Data Santri dan Wali

Modul santri mencakup biodata, NIS/NISN, NIK, tempat tanggal lahir, keluarga, wali, alamat, status aktif/alumni/mutasi, serta kolom referensi DAPODIK. Data santri menjadi pusat integrasi untuk presensi, tagihan, dompet, asrama, tahfiz, nilai, dan portal wali.

Status saat ini: sebagian kuat. CRUD santri dan referensi DAPODIK sudah ada. Riwayat alumni, mutasi, dan dokumen legal per santri masih bisa ditambah.

### 6. PSB/PPDB Online

PSB/PPDB mencakup gelombang penerimaan, jalur pendaftaran, formulir calon santri, verifikasi berkas, jadwal seleksi, hasil seleksi, daftar ulang, dan portal pendaftar.

Status saat ini: sebagian kuat. Gelombang, pendaftar, jadwal, portal pendaftar, dan proses status sudah tersedia. Gap tersisa: form builder, kartu peserta, matriks verifikasi dokumen, dan seleksi online.

### 7. Kelas, Rombongan Belajar, Kurikulum, dan Jadwal

Modul ini mengatur tahun ajaran, rombel, anggota rombel, mata pelajaran, kurikulum, jadwal, guru pengampu, dan kalender pembelajaran.

Status saat ini: sebagian. Rombongan, kurikulum, jadwal, dan nilai sudah tersedia. Perlu editor jadwal lebih ergonomis, validasi bentrok, substitusi, dan ekspor kalender.

### 8. Guru, Ustadz, dan Penugasan

Data pendidik mencakup guru formal, ustadz diniyah, musyrif, pembina, tugas mengajar, jadwal, absensi, dan beban kerja.

Status saat ini: sebagian. Guru dan absensi guru sudah tersedia. Payroll, SK tugas, evaluasi, dan beban kerja formal belum lengkap.

### 9. Diniyah, Halaqah, Tahfiz, dan Mutabaah

Modul diniyah dan tahfiz mencatat kelas diniyah, halaqah, setoran hafalan, capaian juz/surat, mutabaah harian, catatan pembimbing, dan perkembangan santri.

Status saat ini: sebagian kuat. Diniyah dan tahfiz sudah tersedia. Gap berikutnya adalah rapor diniyah/tahfiz, target personal, dan monitoring musyrif lebih rinci.

### 10. Nilai, Rapor, Gradebook, dan Evaluasi

Modul nilai mencakup komponen nilai, input nilai, skala huruf, rekap nilai, rapor, leger, ranking, dan keputusan kenaikan kelas.

Status saat ini: sebagian kuat. Input nilai, skala huruf, rapor, leger, ranking, export CSV, dan PDF rapor server-side dasar sudah ada. Validasi wali kelas, promosi kelas/finalisasi kenaikan, template kop/logo/QR, dan tanda tangan digital masih perlu dilengkapi.

### 11. Presensi Santri

Presensi mencakup kehadiran kelas formal, diniyah, halaqah, kegiatan pondok, sakit, izin, alpa, dan rekap kehadiran per periode.

Status saat ini: sebagian. Presensi santri sudah tersedia. Integrasi device/fingerprint dan offline mode menyusul.

### 12. Asrama dan Kamar

Modul asrama mencakup gedung, kamar, kapasitas, penempatan santri, musyrif, perpindahan kamar, dan monitoring kehidupan mukim.

Status saat ini: sebagian. Asrama dan kamar sudah tersedia. Mutasi historis, inspeksi kamar, kebersihan, dan aset kamar masih perlu ditambah.

### 13. Perizinan Keluar-Masuk

Perizinan mengatur pengajuan izin, persetujuan berjenjang, catatan keamanan, disposisi, waktu keluar, waktu kembali, dan notifikasi wali.

Status saat ini: sebagian kuat. Perizinan dan SOP disposisi sudah tersedia. Gap tersisa: notifikasi realtime, scan tablet, dan offline mode.

### 14. Gerbang Keamanan

Gerbang keluar-masuk mencatat santri yang keluar, kembali, terlambat, dijemput, atau menerima kunjungan. Modul ini ideal dipakai di pos security dengan PC/tablet.

Status saat ini: sebagian kuat. Modul gerbang dan kiosk tersedia. Fingerprint bisa menyusul sesuai prioritas.

### 15. Kunjungan Wali, Paket, dan Penjemputan

Modul ini mengelola tamu, wali, jadwal kunjungan, paket kiriman, validasi identitas, dan penjemputan santri.

Status saat ini: sebagian. Pondasinya bisa memakai gerbang dan portal wali, tetapi workflow kunjungan/paket khusus belum lengkap.

### 16. Pembinaan, BK, Pelanggaran, Hukuman, dan Apresiasi

Modul pembinaan mencatat pelanggaran, sanksi, poin, konseling, tindak lanjut, apresiasi, prestasi, dan komunikasi dengan wali.

Status saat ini: sebagian. Pelanggaran dan prestasi sudah ada. Workflow BK/konseling penuh masih perlu dibuat.

### 17. Ekstrakurikuler, Organisasi, dan Kegiatan

Modul ini mencakup ekskul, organisasi santri, pembina, anggota, jadwal kegiatan, prestasi, presensi kegiatan, dan sertifikat.

Status saat ini: sebagian. Ekstrakurikuler dan prestasi sudah tersedia.

### 18. Tagihan, Pembayaran, dan Piutang

Modul keuangan santri mencakup SPP, daftar tagihan, penerbitan tagihan, pembayaran, status lunas, piutang, dan laporan pembayaran.

Status saat ini: sebagian. Tagihan sudah tersedia, dan platform billing/payment/accounting bisa dipakai. Gap penting: rekonsiliasi payment gateway dan jurnal otomatis.

### 19. Dompet Santri, Kantin, POS, dan Koperasi

Dompet santri memungkinkan wali menitipkan uang saku nontunai. Integrasi dengan POS/kantin/koperasi memungkinkan kontrol belanja, limit harian, laporan transaksi, dan monitoring wali.

Status saat ini: sebagian. Dompet, POS, dan koperasi tersedia sebagai modul. Integrasi settlement dompet-POS perlu diperkuat.

### 20. Dapur, Katering, dan Konsumsi

Modul dapur mengatur menu harian, jadwal makan, porsi, bahan, logistik, biaya konsumsi, dan evaluasi layanan makan.

Status saat ini: sebagian. Katering sudah tersedia. Integrasi stok bahan dan pembelian belum lengkap.

### 21. Surat dan Arsip Digital

Surat meliputi surat izin, surat keterangan, surat tugas, SK, arsip dokumen santri, dokumen pondok, dan disposisi.

Status saat ini: platform. Modul surat ada, tetapi template pesantren dan integrasi spesifik per workflow perlu ditambah.

### 22. Portal Wali Santri

Portal wali menampilkan data anak, presensi, izin, tahfiz, dompet, tagihan, berita, dan komunikasi pondok.

Status saat ini: sebagian. Portal wali sudah tersedia. Gap berikutnya adalah notifikasi realtime, pembayaran dari wali, dan pesan dua arah.

### 23. Kartu Santri, QR, Kiosk, dan Perangkat

Kartu santri dapat dipakai untuk presensi, gerbang, dompet, kantin, perpustakaan, dan identifikasi cepat. Kiosk membantu layanan mandiri.

Status saat ini: sebagian. Kartu dan kiosk sudah ada. Flutter/tablet security dan fingerprint dapat menjadi tahap lanjutan.

### 24. DAPODIK dan EMIS

Modul ini mengelola import/export data pendidikan nasional: santri/siswa, guru, mata pelajaran, rombel, nilai, referensi nasional, dan data pendukung lain.

Status saat ini: DAPODIK sebagian kuat. EMIS belum terlihat lengkap.

## Modul eSchool

### 1. Dashboard Sekolah

Dashboard sekolah menampilkan siswa aktif, guru, kelas, presensi, nilai, tagihan, PPDB, disiplin, agenda, dan indikator mutu sekolah.

Status saat ini: belum ada sebagai eSchool khusus.

### 2. Master Sekolah dan Identitas Lembaga

Mencakup profil sekolah, NPSN, jenjang, alamat, kepala sekolah, yayasan, izin operasional, logo, kop surat, dan konfigurasi akademik.

Status saat ini: belum ada sebagai eSchool khusus. Bisa memakai pola profil/unit pendidikan ePesantren.

### 3. Data Siswa dan Orang Tua

Mencakup biodata siswa, NIS, NISN, NIK, keluarga, wali, alamat, kebutuhan khusus, transportasi, status aktif, mutasi, alumni, dan data DAPODIK.

Status saat ini: sebagian lewat santri/wali, perlu domain siswa eSchool.

### 4. Guru, Pegawai, dan Kepegawaian

Mencakup guru, tenaga kependidikan, penugasan, absensi, SK, beban kerja, honor, payroll, dan evaluasi.

Status saat ini: sebagian lewat modul guru pesantren dan master data umum.

### 5. Akademik, Kurikulum, Kelas, dan Jadwal

Mencakup tahun ajaran, semester, tingkat, kelas, rombel, mapel, guru pengampu, jadwal pelajaran, kalender akademik, dan pengganti jam.

Status saat ini: sebagian lewat kurikulum/rombongan pesantren.

### 6. Penilaian, Rapor, Ujian, dan Kelulusan

Mencakup komponen nilai, ujian, tugas, rapor, leger, ranking, kenaikan kelas, kelulusan, dan export data nilai.

Status saat ini: sebagian lewat nilai pesantren. Rapor sekolah resmi belum tersedia sebagai vertical.

### 7. DAPODIK Import/Export

Mencakup import dan export siswa, guru, mapel, rombel, anggota rombel, nilai, referensi, serta validasi data nasional.

Status saat ini: sebagian kuat. ePesantren memiliki menu DAPODIK utama, dan eSchool sudah memiliki route `/app/eschool/dapodik` serta endpoint `/eschool/dapodik/...` yang memakai mesin import/export yang sama. Import dry-run sudah menampilkan preview aksi `CREATE`, `UPDATE`, atau `SKIP` per baris sebelum data disimpan. Import final sudah memiliki log batch permanen dan rollback aman untuk baris baru yang dibuat batch. Domain siswa eSchool murni, filter unit formal, template resmi per jenjang, diff per field, dan rollback perubahan UPDATE masih perlu diperdalam.

### 8. PPDB Sekolah

Mencakup jalur pendaftaran, zonasi, afirmasi, prestasi, formulir online, verifikasi dokumen, kartu pendaftar, seleksi, pengumuman, dan daftar ulang.

Status saat ini: sebagian lewat PSB pesantren.

### 9. Kesiswaan dan BK

Mencakup tata tertib, pelanggaran, poin, konseling, home visit, tindak lanjut, prestasi, dan komunikasi dengan orang tua.

Status saat ini: sebagian lewat pembinaan pesantren. Perlu BK sekolah khusus.

### 10. Presensi dan Kedisiplinan

Mencakup presensi siswa, guru, kelas, kegiatan, rekap harian, rekap wali kelas, dan notifikasi orang tua.

Status saat ini: sebagian lewat presensi pesantren.

### 11. Keuangan Sekolah

Mencakup SPP, iuran, pembayaran, piutang, beasiswa, keringanan, BOS, jurnal, laporan kas, dan rekonsiliasi.

Status saat ini: platform/sebagian. Perlu domain keuangan sekolah.

### 12. Perpustakaan dan Literasi

Mencakup katalog buku, anggota, peminjaman, pengembalian, denda, literasi, dan laporan koleksi.

Status saat ini: belum ada.

### 13. Sarpras dan Aset

Mencakup ruang kelas, laboratorium, inventaris, aset, peminjaman, pemeliharaan, dan kondisi barang.

Status saat ini: belum ada sebagai modul sekolah.

### 14. Akreditasi dan Mutu

Mencakup instrumen akreditasi, evidence, dokumen pendukung, capaian standar, dan tindak lanjut mutu.

Status saat ini: belum ada.

### 15. Alumni dan Tracer

Mencakup data alumni, kelulusan, legalisir, tracer study, komunitas alumni, dan riwayat pendidikan lanjutan.

Status saat ini: sebagian kecil melalui status alumni santri, belum sebagai eSchool.

### 16. Kesehatan Sekolah

Mencakup UKS, riwayat kesehatan siswa, imunisasi, kunjungan kesehatan, rujukan, dan integrasi eMedik.

Status saat ini: platform tersedia lewat health/eMedik, belum diikat ke eSchool.

### 17. Koperasi, Kantin, dan Unit Usaha

Mencakup POS kantin, koperasi siswa, pembayaran nontunai, kontrol belanja, dan laporan unit usaha.

Status saat ini: platform/sebagian lewat POS dan koperasi.

### 18. LMS dan Pembelajaran Daring

Mencakup materi, tugas, forum, bank soal, ujian online, pengumpulan tugas, dan rekam aktivitas belajar.

Status saat ini: belum ada.

### 19. Portal Siswa dan Orang Tua

Mencakup data akademik, presensi, nilai, tagihan, pengumuman, agenda, dan komunikasi sekolah-rumah.

Status saat ini: sebagian lewat portal wali pesantren. Perlu portal eSchool sendiri.

### 20. Laporan dan Analitik Sekolah

Mencakup laporan akademik, kesiswaan, keuangan, PPDB, presensi, mutu, dan export Excel/PDF.

Status saat ini: sebagian lewat laporan pesantren/platform.

## Modul eCampus

### 1. Dashboard Perguruan Tinggi

Dashboard kampus menampilkan PMB, mahasiswa aktif, dosen, kelas kuliah, KRS, nilai, keuangan, mutu, penelitian, pengabdian, dan akreditasi.

Status saat ini: belum ada sebagai eCampus.

### 2. Master Perguruan Tinggi, Fakultas, dan Program Studi

Mencakup identitas PT, fakultas, jurusan, prodi, jenjang, akreditasi, kaprodi, kurikulum, dan struktur organisasi.

Status saat ini: belum ada.

### 3. Mahasiswa

Mencakup biodata mahasiswa, NIM, status akademik, wali, alamat, dokumen, riwayat pendidikan, angkatan, prodi, dan histori perubahan status.

Status saat ini: belum ada.

### 4. Dosen dan Pegawai

Mencakup dosen tetap/tidak tetap, NIDN, NUPTK, homebase, jabatan akademik, penugasan, BKD, dan kepegawaian.

Status saat ini: belum ada.

### 5. PMB

Mencakup pendaftaran mahasiswa baru, jalur seleksi, formulir, berkas, pembayaran pendaftaran, kartu ujian, seleksi, pengumuman, dan daftar ulang.

Status saat ini: belum ada. Bisa memakai pola PSB pesantren.

### 6. Akademik, KRS, KHS, dan Transkrip

Mencakup registrasi semester, KRS, kelas kuliah, presensi kuliah, input nilai, KHS, transkrip, yudisium, dan kelulusan.

Status saat ini: belum ada.

### 7. Kurikulum OBE dan MBKM

Mencakup CPL, CPMK, RPS, mata kuliah, struktur kurikulum, pemetaan capaian, konversi MBKM, dan evaluasi outcome.

Status saat ini: belum ada.

### 8. Jadwal Kuliah dan Ruang

Mencakup jadwal mata kuliah, dosen, ruang, kapasitas, bentrok jadwal, kelas paralel, dan perubahan jadwal.

Status saat ini: belum ada.

### 9. Keuangan Mahasiswa

Mencakup UKT/BKT, tagihan semester, pembayaran, cicilan, beasiswa, keringanan, piutang, rekonsiliasi bank, dan jurnal.

Status saat ini: platform ada, domain kampus belum ada.

### 10. BKD, Kepegawaian, dan Payroll

Mencakup beban kerja dosen, tridharma, honor mengajar, payroll, cuti, jabatan, dan evaluasi pegawai.

Status saat ini: belum ada.

### 11. Penelitian, Pengabdian, dan Karya Ilmiah

Mencakup proposal, hibah, luaran, publikasi, pengabdian masyarakat, laporan kegiatan, dan repository karya.

Status saat ini: belum ada.

### 12. SPMI dan Mutu Internal

Mencakup siklus PPEPP, standar mutu, indikator, audit mutu internal, temuan, rencana tindak lanjut, dan monitoring mutu.

Status saat ini: belum ada.

### 13. SPI dan Pengawasan Internal

Mencakup audit internal, temuan, rekomendasi, tindak lanjut, risiko, dan pelaporan kepada pimpinan.

Status saat ini: belum ada.

### 14. Akreditasi dan Pelaporan Nasional

Mencakup evidence akreditasi, LED/LKPS, SAPTO, BAN-PT/LAM, laporan nasional, dan monitoring masa berlaku akreditasi.

Status saat ini: belum ada.

### 15. Feeder/PD-Dikti

Mencakup sinkronisasi data mahasiswa, dosen, kelas kuliah, KRS, nilai, aktivitas mahasiswa, kurikulum, dan pelaporan nasional.

Status saat ini: belum ada.

### 16. Alumni dan Tracer Study

Mencakup data alumni, tracer karier, masa tunggu kerja, kepuasan pengguna lulusan, legalisir, dan jejaring alumni.

Status saat ini: belum ada.

### 17. Perpustakaan dan Repository

Mencakup koleksi, sirkulasi, repository skripsi/jurnal, akses digital, dan laporan literasi akademik.

Status saat ini: belum ada.

### 18. Kemahasiswaan dan Layanan Bimbingan

Mencakup organisasi mahasiswa, kegiatan, prestasi, konseling, beasiswa, layanan akademik, dan pengaduan.

Status saat ini: belum ada.

### 19. Tugas Akhir, Skripsi, dan Bimbingan

Mencakup pengajuan judul, pembimbing, seminar proposal, bimbingan, sidang, revisi, dan arsip naskah.

Status saat ini: belum ada.

### 20. Wisuda dan Kelulusan

Mencakup yudisium, pendaftaran wisuda, validasi bebas administrasi, SKL, ijazah, transkrip, dan alumni.

Status saat ini: belum ada.

### 21. Kerja Sama dan Kemitraan

Mencakup MoU, MoA, IA, mitra, kegiatan kerja sama, masa berlaku, dan laporan dampak.

Status saat ini: belum ada.

### 22. AI Kampus

Mencakup asisten akademik, ringkasan dashboard, pencarian dokumen, rekomendasi layanan mahasiswa, dan insight mutu.

Status saat ini: platform AI ada, integrasi eCampus belum ada.

## Import dan Export Data Nasional

### DAPODIK untuk ePesantren dan eSchool

DAPODIK perlu menjadi menu utama untuk pengelola sekolah/pesantren yang memiliki satuan pendidikan formal. Data yang perlu didukung:

- Siswa/santri.
- Orang tua/wali.
- Guru/tenaga pendidik.
- Mata pelajaran.
- Tahun ajaran dan semester.
- Rombongan belajar.
- Anggota rombel.
- Jadwal.
- Komponen nilai.
- Nilai dan rapor.
- Referensi pekerjaan.
- Referensi pendidikan.
- Referensi penghasilan.
- Referensi transportasi.
- Referensi jenis tinggal.
- Referensi kebutuhan khusus.
- Unit pendidikan/sekolah.

Fitur minimal import/export:

- Download template.
- Upload file Excel/CSV.
- Validasi kolom wajib.
- Preview sebelum import, termasuk rencana `CREATE`, `UPDATE`, atau `SKIP` per baris.
- Dry-run.
- Deteksi data ganda.
- Mapping referensi nasional.
- Simpan batch import.
- Rollback batch untuk data baru yang dibuat import final.
- Export ulang per entitas.
- Log error per baris.

### Feeder/PD-Dikti untuk eCampus

Untuk eCampus, standar utama bukan DAPODIK, melainkan Feeder/PD-Dikti dan pelaporan akreditasi. Data yang perlu disiapkan:

- Perguruan tinggi.
- Fakultas/prodi.
- Kurikulum.
- Mata kuliah.
- Mahasiswa.
- Dosen.
- Kelas kuliah.
- KRS.
- Nilai.
- Aktivitas mahasiswa.
- Kelulusan.
- Riwayat status mahasiswa.
- Penugasan dosen.

## Rekomendasi UI/UX

UI/UX education sebaiknya mengikuti prinsip dashboard operasional modern: cepat dipindai, bersih, mobile-friendly, dan tidak terlalu ramai. Visual pendidikan/pesantren tetap penting, tetapi dipakai untuk memperkuat konteks, bukan mengganggu tugas admin.

Prinsip yang disarankan:

- Dashboard ringkas di atas, data operasional di bawah.
- Tabel padat dengan filter jelas.
- Form bertahap untuk data panjang seperti santri, siswa, mahasiswa, PSB, PPDB, dan PMB.
- Status memakai badge yang mudah dibaca.
- Aksi utama terlihat jelas.
- Halaman publik lebih visual dengan foto nyata pesantren/sekolah/kampus.
- Semua gambar hero, galeri, berita, dan unit dapat diganti admin.
- Layout responsif untuk HP, tablet security, laptop admin, dan layar desktop.
- Hindari halaman `Coming Soon`; jika modul belum penuh, tampilkan versi MVP yang tetap berguna.

## Prioritas Roadmap

### Prioritas 1: Sempurnakan ePesantren

- Rapor PDF server-side lanjutan, leger, dan finalisasi kenaikan kelas.
- PSB/PPDB lengkap.
- DAPODIK import/export penuh.
- Gerbang tablet QR.
- Portal wali dengan pembayaran dan notifikasi.
- Payment reconciliation.
- CMS gambar publik.

### Prioritas 2: Bangun eSchool dari education-core

- Master sekolah.
- Siswa dan orang tua.
- Guru dan pegawai.
- Kelas/rombongan.
- Mapel, kurikulum, jadwal.
- Nilai dan rapor.
- PPDB.
- DAPODIK.
- BK, presensi, keuangan.
- Perpustakaan, sarpras, akreditasi, alumni.

### Prioritas 3: Bangun eCampus MVP

- Master PT/fakultas/prodi.
- Mahasiswa.
- Dosen.
- PMB.
- KRS/KHS/transkrip.
- Kurikulum OBE/MBKM.
- Tagihan UKT.
- Feeder/PD-Dikti.
- Dashboard pimpinan.

### Prioritas 4: Modul Lanjutan

- AI education assistant.
- Akreditasi evidence center.
- SPMI/SPI.
- Alumni/tracer.
- Flutter mobile app.
- Offline device mode.
- Advanced analytics.

## Catatan Arsitektur

Pendekatan terbaik adalah membuat fondasi `education-core`, lalu membangun adapter khusus untuk ePesantren, eSchool, dan eCampus.

Shared core:

- Institusi.
- Peserta didik.
- Pendidik.
- Wali/orang tua.
- Periode akademik.
- Kelas/rombongan.
- Mata pelajaran/mata kuliah.
- Jadwal.
- Presensi.
- Nilai.
- Penerimaan peserta didik/mahasiswa baru.
- Tagihan dan pembayaran.
- Dokumen.
- Website publik.
- Import/export data.

Adapter ePesantren:

- Asrama.
- Diniyah.
- Tahfiz.
- Perizinan.
- Gerbang.
- Dompet santri.
- Katering.
- Portal wali santri.

Adapter eSchool:

- DAPODIK sekolah.
- BK sekolah.
- PPDB sekolah.
- Perpustakaan.
- Sarpras.
- Akreditasi sekolah.
- Portal orang tua/siswa.

Adapter eCampus:

- Feeder/PD-Dikti.
- KRS/KHS.
- OBE/MBKM.
- SPMI/SPI.
- Penelitian/pengabdian.
- Skripsi/tugas akhir.
- Wisuda.
- Tracer study.

## Kesimpulan

ePesantren sudah berada pada jalur implementasi yang paling siap. eSchool dan eCampus membutuhkan vertical domain khusus, tetapi tidak perlu dimulai dari nol karena banyak fondasi dapat dipakai ulang dari ePesantren dan platform eBisnis. Roadmap terbaik adalah menyelesaikan ePesantren sampai rapi dan production-ready, lalu mengekstrak `education-core` agar eSchool dan eCampus dapat berkembang cepat, konsisten, dan mudah dirawat.
