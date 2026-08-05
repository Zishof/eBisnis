# Gap Analysis Modul ePesantren, eSchool, dan eCampus

Tanggal analisis: 2026-08-05

## Sumber Analisis

- `C:\Users\USER\Desktop\ePESANTREN_Profil_Lengkap.pdf`
- `C:\Users\USER\Desktop\eSCHOOL_Profil_Lengkap.pdf`
- `C:\Users\USER\Desktop\eCAMPUS_Profil_Lengkap.pdf`
- Kode backend: `apps/api/src/modules`
- Kode frontend admin: `apps/web/src/pages/app/pesantren`
- Kode frontend publik: `apps/web/src/verticals/pesantren`, `apps/web/src/verticals/education`, `apps/web/src/app/App.tsx`

## Ringkasan Eksekutif

ePesantren sudah menjadi vertical operasional yang nyata di kode. Modul backend dan frontend pesantren sudah mencakup santri, wali, unit pendidikan, asrama, PSB/PPDB, kurikulum, rombongan belajar, guru, presensi, nilai, tahfiz, diniyah, perizinan, gerbang keluar-masuk, tagihan, dompet santri, kartu, portal wali, situs pondok, situs unit, berita, media, DAPODIK, katering, dakwah, buku penghubung, prestasi, pelanggaran, laporan, dan kiosk.

eSchool belum menjadi vertical operasional tersendiri. Sebagian besar kebutuhan eSchool dapat memakai ulang fondasi ePesantren dan modul platform umum, tetapi belum ada namespace/domain khusus eSchool untuk siswa, guru, kurikulum sekolah, DAPODIK sekolah, BK sekolah, PPDB sekolah, perpustakaan, sarpras, akreditasi, alumni, dan layanan orang tua.

eCampus paling besar gap-nya. Di kode saat ini belum terlihat vertical kampus operasional untuk mahasiswa, dosen, prodi, fakultas, PMB, KRS, KHS, transkrip, kurikulum OBE/MBKM, penelitian, pengabdian, SPMI, SPI, akreditasi, Feeder/PD-Dikti, tugas akhir, wisuda, alumni, dan kemahasiswaan. Yang tersedia baru platform umum seperti auth, tenant, accounting, billing, payment, CMS, AI, surat, governance, observability, dan modul education landing/document.

## Status Implementasi Batch 2026-08-05

Batch pertama setelah gap analysis menutup celah navigasi dan kontrol kerja education yang sebelumnya membuat eSchool/eCampus hanya tampak sebagai dokumen/landing page.

Yang sudah ditambahkan:

- Halaman admin `Pusat Implementasi Education` pada `apps/web/src/pages/app/education/EducationGapImplementationPage.tsx`.
- Route `/app/education/implementasi`, `/app/eschool`, dan `/app/ecampus`.
- Menu ePesantren `Roadmap eSchool/eCampus` pada katalog RBAC ePesantren dengan route `/app/education/implementasi`.
- Entry point dataset nasional pada halaman baru, mengarah ke modul DAPODIK yang sudah memiliki template, export CSV, upload CSV/Excel/JSON, dry-run, validasi, dan import final.

Yang belum bisa dianggap selesai hanya dengan batch ini:

- Domain backend eSchool penuh.
- Domain backend eCampus penuh.
- Rapor PDF resmi, leger, ranking, dan kenaikan kelas.
- Feeder/PD-Dikti, SPMI/SPI, akreditasi kampus, dan modul akademik kampus.
- Flutter/tablet security dan fingerprint.

## Status Implementasi Batch 2026-08-06

Batch kedua memindahkan peta gap education dari data statis frontend menjadi katalog API resmi.

Yang sudah ditambahkan:

- Module backend `EducationModule` pada `apps/api/src/modules/education`.
- Endpoint `GET /education/modules` untuk katalog modul dan status gap ePesantren/eSchool/eCampus.
- Endpoint `GET /education/datasets` untuk dataset nasional DAPODIK, EMIS, dan Feeder/PD-Dikti.
- Endpoint `GET /education/roadmap` untuk prioritas P0-P3.
- Facade namespace `GET /eschool/modules`, `GET /eschool/datasets`, `GET /ecampus/modules`, dan `GET /ecampus/datasets` sebagai pintu awal vertical domain eSchool/eCampus.
- Halaman admin `Pusat Implementasi Education` kini membaca endpoint tersebut dan tetap punya fallback lokal saat API lama belum ikut ter-deploy.
- Test `education.service.spec.ts` untuk menjaga filter produk, keberadaan DAPODIK/Feeder, dan immutability hasil katalog.

Yang masih menjadi pekerjaan domain besar:

- Database dan service CRUD eSchool penuh.
- Database dan service CRUD eCampus penuh.
- Export PDF rapor resmi, leger, dan kenaikan kelas.
- Integrasi Feeder/PD-Dikti sungguhan.
- Modul mobile/tablet security.

## Status Implementasi Batch 2026-08-06 P0 Nilai

Batch lanjutan menutup sebagian gap nilai/rapor yang paling operasional untuk wali kelas dan kepala madrasah.

Yang sudah ditambahkan:

- Endpoint `GET /pesantren/nilai/leger` untuk leger per rombongan dan tahun ajaran.
- Perhitungan nilai akhir per mata pelajaran dari komponen berbobot yang sudah dipakai rapor.
- Rata-rata santri, ranking padat kelas, huruf mutu, dan rekomendasi kenaikan awal.
- Tab `Leger` pada halaman admin `Nilai dan Rapor` dengan filter tahun ajaran/rombongan, ringkasan kelas, tabel responsif, dan export CSV.
- Unit test `hitungRankingPadat` agar ranking seri dan nilai kosong tetap konsisten.

Yang masih tersisa setelah batch ini:

- Workflow validasi/finalisasi kenaikan kelas oleh wali kelas/kepala madrasah.
- Leger khusus format DAPODIK/EMIS bila format resmi tenant membutuhkan kolom tambahan.

## Status Implementasi Batch 2026-08-06 Rapor PDF

Batch lanjutan menutup gap cetak rapor yang sebelumnya masih bergantung pada `window.print()` browser.

Yang sudah ditambahkan:

- Generator PDF backend `pesantren-rapor-pdf.ts` tanpa dependency besar tambahan.
- Endpoint `GET /pesantren/nilai/rapor/:santriId/:tahunAjaranId/pdf` dengan response `application/pdf`.
- PDF berisi identitas pondok, santri, tahun ajaran, daftar nilai akhir, huruf mutu, ringkasan, dan area tanda tangan.
- Tombol `PDF Resmi` pada tab Rapor halaman `Nilai dan Rapor` kini mengunduh PDF dari backend.
- Test `pesantren-rapor-pdf.spec.ts` untuk memastikan buffer PDF valid secara struktur dasar.

Yang masih tersisa setelah batch ini:

- Template visual PDF perlu dipoles lebih lanjut bila ingin memakai kop grafis/logo, format madrasah tertentu, QR verifikasi, dan tanda tangan digital.
- Workflow validasi/finalisasi rapor oleh wali kelas/kepala madrasah belum penuh.

## Status Implementasi Batch 2026-08-06 eSchool DAPODIK

Batch lanjutan menutup gap menu DAPODIK eSchool yang sebelumnya masih harus dibuka dari menu ePesantren.

Yang sudah ditambahkan:

- Facade backend `EschoolDapodikController` dengan endpoint `GET /eschool/dapodik/datasets`, `GET /eschool/dapodik/:dataset/template`, `GET /eschool/dapodik/:dataset/export`, dan `POST /eschool/dapodik/:dataset/import`.
- Endpoint eSchool memakai mesin `PesantrenDapodikService` yang sama agar fondasi `education-core` tidak terduplikasi.
- Route admin `/app/eschool/dapodik` dengan halaman DAPODIK mode eSchool.
- Katalog `GET /eschool/datasets` sekarang menyesuaikan endpoint import/export/template ke namespace `/eschool/dapodik/...`.
- Halaman `Pusat Implementasi Education` mengarahkan tombol DAPODIK ke route eSchool saat tab eSchool aktif.

Yang masih tersisa setelah batch ini:

- Entity/domain siswa eSchool murni masih perlu diekstrak dari santri agar label, validasi, filter unit formal, dan hak akses tidak bercampur.
- Template resmi DAPODIK per jenjang sekolah masih perlu diverifikasi terhadap format operasional terakhir yang dipakai tenant.
- Log batch import, preview diff, dan rollback batch belum penuh.

## Skala Status

- `Selesai`: alur utama sudah ada di backend dan frontend.
- `Sebagian`: fitur inti ada, tetapi belum lengkap sesuai profil produk.
- `Platform`: ada modul generik yang dapat dipakai, tetapi belum terikat khusus ke vertical.
- `Belum`: belum ada implementasi domain yang memadai di repo saat ini.

## Inventaris Kode Saat Ini

### ePesantren

Backend ePesantren berada di `apps/api/src/modules/pesantren` dan mencakup controller/service untuk:

- Absensi guru
- Asrama dan kamar
- Berita pondok
- Buku penghubung
- Dakwah/kajian
- DAPODIK import/export/referensi
- Diniyah dan halaqah
- Dompet santri
- Ekstrakurikuler dan organisasi
- Gerbang keluar-masuk
- Guru dan penugasan
- Kartu santri
- Katering
- Kiosk/antrian perangkat
- Kurikulum dan jadwal
- Laporan
- Media situs
- Nilai, rapor, skala huruf
- Pelanggaran, hukuman, pembinaan
- Perizinan santri
- Portal wali
- Presensi santri
- Prestasi
- Profil situs pondok
- PSB/PPDB dan portal pendaftar
- Public site pondok/unit
- Rombongan belajar
- Santri
- Tagihan
- Tahfiz
- Unit pendidikan

Frontend admin ePesantren berada di `apps/web/src/pages/app/pesantren` dan sudah memiliki halaman untuk modul-modul utama di atas.

Frontend publik ePesantren berada di `apps/web/src/verticals/pesantren` dan sudah mencakup situs pondok, situs unit pendidikan, PSB publik, daftar pesantren, berita, dan dokumen komersial pesantren.

### eSchool dan eCampus

Kode yang eksplisit mengarah ke eSchool/eCampus saat ini terutama berada di `apps/web/src/verticals/education`, yaitu landing page dan dokumen education. Belum ditemukan module backend domain khusus `eschool` atau `ecampus`.

Modul platform umum yang dapat menjadi pondasi eSchool/eCampus:

- `auth`
- `tenant`
- `accounting`
- `billing`
- `payment`
- `cms`
- `surat`
- `notification`
- `ai`
- `governance`
- `observability`
- `pos`
- `cooperative`
- `health` / `emedik`

## Gap Analysis ePesantren

| Area dari profil ePesantren | Status | Bukti kode | Gap utama | Prioritas |
|---|---:|---|---|---:|
| Dashboard pengasuh, yayasan, pimpinan | Sebagian | `PesantrenDashboardPage`, `pesantren-laporan` | Drilldown KPI, tren, cohort santri, alarm operasional harian belum penuh | P1 |
| Master data pondok dan identitas lembaga | Sebagian | `pesantren-profil`, `pesantren-unit-pendidikan`, `pesantren-media` | Struktur yayasan/cabang/izin operasional formal belum lengkap | P2 |
| Data santri, wali, biodata DAPODIK | Selesai/Sebagian | `pesantren-santri`, `pesantren-dapodik`, portal wali | Riwayat alumni, mutasi lintas unit, dokumen legal per santri perlu diperdalam | P1 |
| PSB/PPDB online | Sebagian kuat | `pesantren-psb`, `pesantren-psb-portal` | Form builder, kartu peserta, verifikasi dokumen matriks, seleksi/ujian online belum lengkap | P1 |
| Unit pendidikan dan website unit | Sebagian kuat | `pesantren-unit-pendidikan`, `SitusUnitPage`, public host | Website unit sudah ada, tetapi belum menjadi eSchool operasional penuh per unit | P1 |
| Kelas, rombel, kurikulum, jadwal | Sebagian | `pesantren-rombongan`, `pesantren-kurikulum`, `PesantrenJadwalPage` | Editor jadwal drag-drop, bentrok guru/ruang, substitusi, ekspor kalender belum lengkap | P1 |
| Guru, ustadz, penugasan, absensi pendidik | Sebagian | `pesantren-guru`, `pesantren-absensi-guru` | SK tugas, beban mengajar, payroll/honor, evaluasi guru belum lengkap | P2 |
| Diniyah, halaqah, tahfiz, mutabaah | Sebagian kuat | `pesantren-diniyah`, `pesantren-tahfiz` | Rapor tahfiz/diniyah resmi, target hafalan personal, monitoring musyrif lebih lanjut | P1 |
| Nilai, rapor, gradebook | Sebagian kuat | `pesantren-nilai`, `PesantrenNilaiPage`, `pesantren-rapor-pdf` | Leger/ranking, rekomendasi kenaikan awal, dan PDF server-side dasar sudah ada; finalisasi kenaikan kelas, validasi wali kelas, template kop/logo/QR, dan tanda tangan digital belum penuh | P1 |
| Presensi santri dan kehadiran pembelajaran | Sebagian | `pesantren-presensi` | Integrasi fingerprint/device, offline mode, rekap izin sakit/alpa lintas kegiatan | P2 |
| Asrama, kamar, musyrif, kehidupan mukim | Sebagian | `pesantren-asrama` | Mutasi kamar historis, inspeksi kamar, checklist kebersihan, aset kamar | P2 |
| Perizinan keluar-masuk dan gerbang keamanan | Sebagian kuat | `pesantren-perizinan`, `pesantren-gerbang`, `pesantren-kiosk` | Scanner mobile/tablet, mode offline, integrasi fingerprint menyusul | P1 |
| Kunjungan wali, paket, penjemputan | Sebagian | `pesantren-gerbang`, portal wali | Pra-registrasi kunjungan, bukti foto/QR, paket kiriman, otorisasi penjemput | P2 |
| Pembinaan, BK, pelanggaran, hukuman, apresiasi | Sebagian | `pesantren-pelanggaran`, `pesantren-prestasi`, `PesantrenPembinaanPage` | Workflow BK lengkap, konseling, rencana tindak lanjut, eskalasi wali | P1 |
| Prestasi, ekstrakurikuler, organisasi | Sebagian | `pesantren-ekstrakurikuler`, `pesantren-prestasi` | Kalender kegiatan, pembina, daftar anggota, presensi kegiatan, sertifikat | P2 |
| Tagihan, pembayaran, piutang | Sebagian | `pesantren-tagihan`, `billing`, `payment`, `accounting` | Payment gateway production, rekonsiliasi, posting jurnal otomatis, aging piutang | P1 |
| Uang saku nontunai, kantin, POS, koperasi | Sebagian | `pesantren-dompet`, `pos`, `cooperative` | Settlement dompet-POS, limit harian wali, kontrol item kantin, refund | P1 |
| Dapur, katering, logistik konsumsi | Sebagian | `pesantren-katering` | Menu siklus, stok bahan, biaya porsi, absensi makan, integrasi pembelian | P2 |
| Surat, arsip digital, administrasi umum | Platform | `surat`, `cms` | Template surat pesantren, nomor otomatis, disposisi khusus pondok belum terikat | P2 |
| Website pondok, website unit, CMS, subdomain | Sebagian kuat | `pesantren-profil`, `pesantren-media`, `pesantren-public`, `SitusPondokPage`, `SitusUnitPage` | Admin gambar sudah ada sebagian; perlu konsistensi semua section dan automasi DNS/Cloudflare production | P1 |
| Integrasi DAPODIK dan EMIS | Sebagian | `pesantren-dapodik` | DAPODIK sudah masuk; mapping EMIS belum terlihat lengkap | P1 |
| Portal wali santri | Sebagian | `pesantren-portal-wali`, `PesantrenPortalWaliPage` | Notifikasi realtime, pembayaran wali, izin dari wali, pesan dua arah | P1 |
| Aplikasi mobile, kiosk, kartu, QR, perangkat | Sebagian | `pesantren-kiosk`, `pesantren-kartu` | Flutter/Android khusus security, fingerprint, sinkronisasi offline | P2 |
| Keamanan data, hak akses, audit | Sebagian | `rbac`, `auth`, `tenant`, `audit` | Audit per aksi pesantren, data masking, export audit, kebijakan retensi | P2 |
| Implementasi, migrasi, pelatihan | Dokumentasi | docs dan seed | Wizard migrasi dan checklist onboarding tenant belum lengkap | P3 |
| Paket langganan Rp 2.000/santri | Platform | `pricing`, `billing` | Skema paket ePesantren spesifik perlu dipastikan terhubung ke billing | P2 |

## Gap Analysis eSchool

| Area dari profil eSchool | Status di kode saat ini | Modul yang bisa dipakai ulang | Gap utama |
|---|---:|---|---|
| Dashboard sekolah/yayasan | Belum sebagai eSchool | `pesantren-laporan`, `observability` | Dashboard khusus sekolah belum ada |
| Master sekolah, tahun ajaran, kelas, rombel | Sebagian lewat ePesantren | `pesantren-unit-pendidikan`, `pesantren-rombongan` | Belum ada model `sekolah`/`siswa` sebagai domain eSchool murni |
| Siswa dan orang tua | Sebagian lewat santri/wali | `pesantren-santri`, `portal-wali` | Perlu entity siswa sekolah dan portal orang tua non-pesantren |
| Guru, pegawai, penugasan | Sebagian | `pesantren-guru`, `master-data departments/job-positions` | Kepegawaian sekolah, SK, payroll, beban kerja belum lengkap |
| Akademik, kurikulum, jadwal | Sebagian | `pesantren-kurikulum`, `pesantren-rombongan` | Kalender akademik sekolah, jadwal ruang, bentrok, substitusi belum penuh |
| Mata pelajaran, nilai, rapor | Sebagian | `pesantren-nilai` | Rapor sekolah/DAPODIK, leger, kenaikan kelas, kelulusan belum khusus eSchool |
| DAPODIK import/export | Sebagian kuat | `pesantren-dapodik`, `eschool/dapodik` facade, `/app/eschool/dapodik` | Facade/menu eSchool sudah ada; domain siswa eSchool murni, filter unit formal, preview diff, rollback batch, dan template resmi per jenjang masih perlu diperdalam |
| PPDB sekolah | Sebagian lewat PSB | `pesantren-psb` | PPDB sekolah dengan jalur, zonasi, kartu pendaftar, verifikasi dokumen |
| Kesiswaan dan BK | Sebagian | `pesantren-pelanggaran`, `pesantren-prestasi` | Konseling, kasus BK, tindak lanjut, komunikasi orang tua |
| Presensi dan kedisiplinan | Sebagian | `pesantren-presensi` | Presensi siswa/guru sekolah, device, rekap wali kelas |
| Keuangan sekolah | Platform/Sebagian | `billing`, `payment`, `accounting`, `pesantren-tagihan` | SPP sekolah, subsidi, beasiswa, BOS, posting akuntansi sekolah |
| Kepegawaian dan penggajian | Belum | `master-data`, `accounting` | Payroll/honorarium guru dan pegawai sekolah |
| Akreditasi dan mutu | Belum | `governance` | Dokumen akreditasi, instrumen, evidence, monitoring mutu |
| Alumni | Sebagian kecil | status santri/alumni | Tracer alumni, ijazah, legalisir, database alumni |
| Perpustakaan dan literasi | Belum | belum ada | Sirkulasi buku, anggota, denda, inventaris buku |
| Sarpras dan aset | Belum | sebagian inventori umum | Aset sekolah, ruang, pemeliharaan, peminjaman |
| Kesehatan sekolah | Platform | `health`/`emedik` | UKS sekolah belum terikat dengan siswa |
| Koperasi/kantin/unit usaha | Platform/Sebagian | `pos`, `cooperative` | Integrasi siswa, dompet, kontrol wali, laporan kantin |
| LMS/pembelajaran daring | Belum | belum ada | Materi, tugas, kelas online, bank soal |
| Layanan mandiri siswa/orang tua | Sebagian lewat portal wali | `portal-wali` | Portal eSchool untuk siswa/orang tua perlu namespace sendiri |
| AI pendidikan | Platform | `ai` | Asisten akademik sekolah belum terimplementasi |
| Laporan dan analitik | Sebagian | `pesantren-laporan` | Laporan sekolah lengkap dan export resmi belum ada |

Kesimpulan eSchool: eSchool perlu dibuat sebagai vertical domain tersendiri atau sebagai mode konfigurasi dari `education-core`. Menyalin semua modul ePesantren apa adanya akan cepat, tetapi rawan duplikasi. Pendekatan terbaik adalah mengekstrak konsep bersama: peserta didik, pendidik, rombel, kurikulum, jadwal, presensi, nilai, tagihan, orang tua, dokumen, dan website.

## Gap Analysis eCampus

| Area dari profil eCampus | Status di kode saat ini | Modul yang bisa dipakai ulang | Gap utama |
|---|---:|---|---|
| Dashboard perguruan tinggi | Belum | `observability`, `accounting` | KPI kampus, akademik, keuangan, mutu, PMB |
| Master PT, fakultas, prodi | Belum | `tenant`, `master-data` | Entity PT/fakultas/prodi/jenjang/akreditasi |
| Mahasiswa dan wali | Belum | pola `pesantren-santri` | Biodata mahasiswa, NIM, status akademik, histori |
| Dosen dan pegawai | Belum | pola `pesantren-guru` | NIDN/NUPTK, homebase, jabatan fungsional, BKD |
| PMB | Belum | pola `pesantren-psb` | Jalur PMB, seleksi, pembayaran pendaftaran, kartu ujian |
| Kurikulum OBE dan MBKM | Belum | pola `pesantren-kurikulum` | CPL, CPMK, RPS, struktur kurikulum, konversi MBKM |
| KRS, KHS, transkrip | Belum | pola nilai/rombongan | Kontrak kuliah, kelas kuliah, nilai semester, IP/IPK |
| Jadwal kuliah dan ruang | Belum | pola jadwal | Jadwal kelas kuliah, bentrok dosen/ruang, presensi kuliah |
| Keuangan UKT/BKT | Platform | `billing`, `payment`, `accounting` | Tagihan mahasiswa, cicilan, beasiswa, rekonsiliasi bank |
| Kepegawaian, BKD, payroll | Belum | `master-data`, `accounting` | Beban kerja dosen, honor mengajar, payroll pegawai |
| Penelitian, pengabdian, karya ilmiah | Belum | `surat`, `cms` | Proposal, hibah, luaran, repository karya |
| SPMI dan audit mutu internal | Belum | `governance` | PPEPP, AMI, indikator mutu, tindak lanjut |
| SPI dan pengawasan internal | Belum | `governance` | Audit internal, temuan, rekomendasi, tindak lanjut |
| Akreditasi dan pelaporan nasional | Belum | `surat`, `cms` | Borang, evidence, SAPTO/BAN-PT, dashboard status |
| Integrasi Feeder/PD-Dikti | Belum | belum ada | Mapping mahasiswa, dosen, kelas, KRS, nilai, aktivitas |
| Alumni dan tracer study | Belum | pola alumni | Tracer, legalisir, karier, jejaring alumni |
| Perpustakaan dan repository | Belum | belum ada | Koleksi, sirkulasi, repository skripsi/jurnal |
| Kemahasiswaan dan layanan bimbingan | Belum | pola BK | Kegiatan, organisasi, prestasi, konseling |
| Tugas akhir/skripsi | Belum | belum ada | Proposal, pembimbing, seminar, sidang, revisi |
| Wisuda dan kelulusan | Belum | belum ada | Yudisium, wisuda, SKL, ijazah, transkrip |
| Beasiswa dan keringanan | Belum | `billing` | Seleksi beasiswa, keringanan UKT, monitoring penerima |
| Kerja sama dan kemitraan | Belum | `cms`, `surat` | MoU/MoA, mitra, kegiatan, masa berlaku |
| AI kampus | Platform | `ai` | Asisten akademik, ringkasan mutu, rekomendasi layanan |
| Keamanan data dan hak akses | Platform | `auth`, `tenant`, `rbac` | Role kampus spesifik dan audit akademik |

Kesimpulan eCampus: eCampus perlu project vertical besar terpisah. Modul platform dapat dipakai sebagai fondasi, tetapi domain inti kampus belum tersedia.

## DAPODIK, EMIS, dan Format Nasional

Kode ePesantren sudah memiliki modul DAPODIK dan menu `Impor Data Dapodik`. Dataset yang sudah tampak didukung dari pekerjaan sebelumnya mencakup:

- Unit pendidikan
- Tahun ajaran
- Santri/siswa
- PSB/pendaftar
- Guru
- Mata pelajaran
- Rombongan belajar
- Anggota rombel
- Kurikulum
- Jadwal
- Komponen nilai
- Nilai
- Referensi pekerjaan
- Referensi pendidikan
- Referensi penghasilan
- Referensi transportasi
- Referensi jenis tinggal
- Referensi kebutuhan khusus

Gap DAPODIK yang masih perlu dipastikan untuk parity penuh eSchool setelah facade `/eschool/dapodik` tersedia:

- Template resmi per entitas eSchool dengan validasi kolom wajib per jenjang/unit formal.
- Export balik ke format DAPODIK untuk siswa, guru, mapel, rombel, anggota rombel, nilai, dan referensi.
- Preview diff sebelum import.
- Mode dry-run dan rollback batch.
- Log import per batch.
- Mapping kode referensi nasional yang dapat diperbarui admin.
- Resolusi data ganda berbasis NISN, NIK, NUPTK, dan kode sekolah.

Untuk eCampus, DAPODIK bukan standar utama. Yang harus dibuat adalah integrasi Feeder/PD-Dikti serta kebutuhan pendukung SAPTO/BAN-PT.

## Modul yang Belum Ada Paling Penting

1. eSchool operational vertical: master sekolah, siswa, guru, rombel, mapel, jadwal, nilai, PPDB, DAPODIK, BK, sarpras, perpustakaan, akreditasi, alumni, dan portal orang tua.
2. eCampus operational vertical: PT/fakultas/prodi, mahasiswa, dosen, PMB, KRS/KHS, kurikulum OBE/MBKM, Feeder, SPMI/SPI, akreditasi, penelitian, pengabdian, skripsi, wisuda, alumni, dan kemahasiswaan.
3. Rapor dan dokumen resmi: PDF rapor, leger, kartu ujian/PSB, SK, surat izin, dan bukti keluar-masuk.
4. Integrasi pembayaran production: payment gateway, rekonsiliasi, jurnal otomatis, aging piutang, settlement dompet-POS.
5. Mobile/tablet security: QR scan, kartu santri, mode offline. Fingerprint dapat menyusul sesuai arahan.
6. CMS visual lebih lengkap: semua gambar hero, galeri, unit sekolah, berita, PPDB, dan landing pondok/sekolah bisa diganti admin.
7. Dashboard mutu: drilldown akademik, kehadiran, keuangan, pembinaan, PSB, dan operasional asrama.

## Prioritas Implementasi Disarankan

### P0 - Rapikan dan lengkapi ePesantren yang sudah paling dekat produksi

- Rapor PDF, leger nilai, ranking, dan kenaikan kelas.
- PSB/PPDB: form dinamis, kartu peserta, verifikasi dokumen, hasil seleksi, ekspor.
- Gerbang: QR scanner tablet/PC, log kunjungan, penjemput, paket, mode offline ringan.
- Keuangan: rekonsiliasi pembayaran, export tagihan/piutang, posting jurnal.
- DAPODIK: export/import lengkap dengan dry-run, diff, dan rollback batch.
- Situs pondok/unit: konsolidasi UI, gambar bisa diubah admin, tidak ada header/CTA double, responsif mobile/desktop.

### P1 - Jadikan eSchool vertical nyata

- Buat namespace backend `eschool` atau `education-school`.
- Reuse model dari ePesantren melalui abstraction `education-core`.
- Tambah menu eSchool: Dashboard, Sekolah, Siswa, Guru, Kelas/Rombel, Mapel, Jadwal, Nilai/Rapor, PPDB, DAPODIK, BK, Presensi, Keuangan, Perpustakaan, Sarpras, Akreditasi, Alumni, Laporan.
- Buat public school site dengan domain/subdomain dinamis seperti pola unit pendidikan pesantren.
- Pastikan import/export DAPODIK tersedia sebagai menu utama eSchool.

### P2 - Buat eCampus MVP

- Master PT/fakultas/prodi/program studi.
- Mahasiswa, dosen, kurikulum, kelas kuliah, jadwal.
- PMB, KRS, KHS, nilai, transkrip.
- UKT/tagihan/payment.
- Feeder/PD-Dikti mapping awal.
- Dashboard pimpinan kampus.

### P3 - Modul diferensiasi

- AI assistant untuk pengasuh/kepala sekolah/rektor.
- Akreditasi evidence center.
- SPMI/SPI.
- Alumni/tracer.
- Mobile apps.
- Advanced analytics.

## Rekomendasi Arsitektur

Gunakan pendekatan `education-core` agar ePesantren, eSchool, dan eCampus tidak berkembang menjadi tiga kode yang saling duplikatif.

Komponen yang sebaiknya menjadi shared core:

- Person profile: santri/siswa/mahasiswa, wali/orang tua.
- Educator profile: guru/ustadz/dosen.
- Institution structure: pondok/sekolah/PT/unit/prodi.
- Academic period: tahun ajaran/semester.
- Class/group: rombel, halaqah, kelas kuliah.
- Subject/course: mapel/mata kuliah.
- Schedule and attendance.
- Assessment and report.
- Admission: PSB/PPDB/PMB.
- Billing/payment.
- Document and archive.
- Public website/CMS.
- Import/export framework.

Adapter vertical:

- ePesantren: asrama, tahfiz, diniyah, perizinan, gerbang, dompet santri, katering.
- eSchool: DAPODIK sekolah, BK sekolah, perpustakaan, sarpras, akreditasi sekolah.
- eCampus: Feeder/PD-Dikti, KRS/KHS, OBE/MBKM, SPMI/SPI, penelitian, pengabdian, skripsi, wisuda.

## Kesimpulan

ePesantren sudah menjadi produk operasional yang paling matang dan siap dipoles menuju production parity. eSchool dan eCampus masih membutuhkan vertical/domain implementation khusus, tetapi banyak pondasi bisa dipakai ulang dari ePesantren dan platform umum. Fokus terbaik berikutnya adalah menyelesaikan gap ePesantren yang langsung terlihat oleh pengguna, lalu mengekstrak `education-core` supaya eSchool dan eCampus bisa dibangun cepat tanpa mengulang pekerjaan yang sama.
