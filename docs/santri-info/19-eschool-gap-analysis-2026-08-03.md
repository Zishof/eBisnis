# Gap Analysis eSchool AIS vs ePesantren santri.info

Tanggal: 2026-08-04
Referensi lama: `C:\opt\AIS\ais\src\main\src\ais\action\master\sekolah\*`
Repo baru: `C:\opt\eBisnisGithub-ecosystem`

## Ringkasan

AIS lama berisi modul sekolah yang sangat luas: master siswa/guru/sekolah, asrama, absensi, jadwal, nilai, PSB, tagihan, pembayaran, deposit, pelanggaran, penghargaan, catatan guru/orang tua, kegiatan kesiswaan, dan kunjungan/pengajuan siswa. ePesantren baru sudah memecah sebagian besar domain inti ke modul NestJS/React, tetapi beberapa area AIS masih berupa daftar baca sederhana atau belum punya workflow penuh.

Prioritas yang sudah langsung dilengkapi pada sesi ini adalah Gerbang Keluar-Masuk: petugas dapat melihat daftar izin aktif hari ini, memindai kartu, sistem mencari santri dan izin yang sudah DISETUJUI untuk hari berjalan, lalu mencatat lintasan KELUAR/MASUK tanpa memberi hak mengubah status izin.

## Cakupan Referensi AIS

Audit dilakukan terhadap 240 file Java di folder sekolah AIS. Satu file bisa masuk lebih dari satu kelompok karena nama/fiturnya beririsan.

| Kelompok | Jumlah file AIS terdeteksi | Contoh file |
| --- | ---: | --- |
| Santri/siswa/wali/asrama | 129 | `SiswaAction.java`, `BiodataSiswaAction.java`, `SiswaWaliAction.java`, `AsramaSiswaAction.java` |
| PSB/PPDB | 52 | `CalonSiswaAction.java`, `GelombangPendaftaranPsbAction.java`, `PPDB*.java`, `VerifikasiPSBHelper.java` |
| Tagihan/pembayaran/deposit | 35 | `TagihanAction.java`, `PembayaranSiswaAction.java`, `DepositSiswaAction.java`, `PostingPiutangSiswaAction.java` |
| Jadwal/kurikulum | 31 | `JadwalPelajaranAction.java`, `KurikulumSekolahAction.java`, `TimetableJadwalPelajaranWindow.java` |
| Nilai/rapor/penilaian | 19 | `PenilaianSiswaAction.java`, `JenisNilaiSiswaAction.java`, `NilaiHurufSekolahAction.java` |
| Pelanggaran/prestasi/penghargaan | 12 | `PelanggaranSiswaAction.java`, `PrestasiSiswaAction.java`, `PenghargaanSiswaAction.java` |
| Absensi/piket | 7 | `AbsensiAction.java`, `AbsenPiketAction.java`, `AbsenGuruPiketAction.java` |
| Pengajuan/kunjungan/gerbang | 2 | `PengajuanSiswaAction.java`, `KunjunganSiswaAction.java` |

## Matriks Gap

| Area AIS | Contoh file AIS | Status ePesantren | Implementasi baru / gap |
| --- | --- | --- | --- |
| Master sekolah/yayasan/unit | `SekolahAction.java`, `YayasanAction.java`, `JenisSekolahAction.java` | Ada | `pesantren_unit_pendidikan`, profil pondok, subdomain unit, Cloudflare-ready setting. Gap: validasi domain eksternal `*.sch.id` masih perlu DNS ownership check saat go-live. |
| Master santri/siswa | `SiswaAction.java`, `BiodataSiswaAction.java`, `SiswaWaliAction.java` | Ada | CRUD santri dan portal wali tersedia. Gap: biodata sangat detail dari AIS belum semua menjadi field typed; sebagian masuk metadata. |
| Asrama dan kamar | `AsramaSiswaAction.java`, `DetailAsramaSiswaHelper.java` | Ada | Halaman asrama/kamar/penempatan sudah ada. Gap: laporan asrama legacy belum semua direplikasi. |
| Absensi santri | `AbsensiAction.java`, `AbsensiSiswaHelper.java`, `AbsenPiketAction.java` | Dilengkapi | Presensi santri tersedia sebagai daftar/API dan endpoint massal `POST /pesantren/presensi/massal`. UI `/app/pesantren/presensi` sudah mendukung input massal manual per tanggal/jenis serta mode Jadwal Pelajaran: tanggal menentukan hari, petugas memilih jadwal, daftar santri diambil dari anggota rombongan, dan keterangan awal membawa konteks mapel/jam/ruang. Gap lanjutan: kolom foreign key `jadwal_id`/`piket_id` di tabel presensi bila ingin audit relasi fisik. |
| Absensi guru | `AbsenGuruPiketAction.java`, `GuruAction.java` | Dilengkapi | Guru/ustadz, absensi guru, dan piket guru tersedia di UI `/app/pesantren/guru` dan `/app/pesantren/absensi-guru`; petugas dapat mencatat hadir/izin/sakit/alpa, menjadwalkan piket, dan menandai kehadiran piket. Gap lanjutan: jadwal mengajar AIS yang sangat rinci dan rekap honor/insentif piket. |
| Diniyah/tahfiz | AIS tersebar di jadwal, nilai, kegiatan | Dilengkapi | UI `/app/pesantren/diniyah` mengelola kitab, halaqah, dan anggota; UI `/app/pesantren/tahfiz` mencatat setoran hafalan. Gap: rapor diniyah lengkap belum final. |
| Rombongan/kurikulum/jadwal | `KelasSiswaAction.java`, `KurikulumSekolahAction.java`, `JadwalPelajaranAction.java`, `JamPelajaranAction.java`, `TimetableJadwalPelajaranWindow.java` | Dilengkapi | Rombongan belajar, kurikulum, dan jadwal jam nyata tersedia. UI `/app/pesantren/rombongan`, `/app/pesantren/kurikulum`, dan `/app/pesantren/jadwal` sudah bisa membuat kelas, menambah struktur mapel, tambah/filter/batalkan jadwal, serta tetap mencegah bentrok rombongan/pengajar. Gap lanjutan: promosi kelas massal dan timetable drag-drop. |
| Nilai/rapor | `PenilaianSiswaAction.java`, `JenisNilaiSiswaAction.java`, `NilaiHurufSekolahAction.java`, `JenisRaporSiswaAction.java` | Dilengkapi | Mata pelajaran, komponen nilai berbobot, skala huruf, entry nilai upsert, endpoint rapor berbobot, UI `/app/pesantren/nilai`, dan UI `/app/pesantren/nilai/skala-huruf` sudah tersedia. Gap lanjutan: entry nilai berbasis kelas dan cetak rapor PDF. |
| PSB/PPDB | `CalonSiswaAction.java`, `GelombangPendaftaranPsbAction.java`, `PPDB*.java`, `VerifikasiPSBHelper.java` | Dilengkapi | Portal PSB, gelombang, pendaftar, jadwal seleksi, `form_schema` per gelombang, `jawaban_tambahan` pendaftar, dan field JSON schema di UI gelombang tersedia. Gap lanjutan: builder drag-drop field PSB. |
| Tagihan/pembayaran/deposit | `TagihanAction.java`, `PembayaranSiswaAction.java`, `DepositSiswaAction.java`, `PostingPiutangSiswaAction.java` | Dilengkapi dasar | Tagihan, dompet santri, POS/dompet handler, pembuatan dompet, top-up, belanja, saldo, batas harian, dan riwayat transaksi tersedia di UI `/app/pesantren/dompet`. Gap lanjutan: semua skenario posting akuntansi legacy belum seluruhnya dipetakan. |
| Pelanggaran/hukuman | `PelanggaranSiswaAction.java`, `PelanggaranDanHukumanAction.java`, `HukumanAction.java` | Ada sebagian | Pencatatan pelanggaran tersedia. Gap: katalog hukuman dan workflow tindak lanjut bertingkat masih perlu halaman operasional. |
| Prestasi/penghargaan | `PrestasiSiswaAction.java`, `PenghargaanSiswaAction.java`, `ApresiasiSiswaAction.java` | Ada sebagian | Prestasi tersedia. Gap: penghargaan/apresiasi terpisah belum seluruhnya menjadi modul. |
| Pengajuan/izin siswa | `PengajuanSiswaAction.java` | Dilengkapi | Perizinan santri kini membawa lampiran, kontak penjemput, metadata, disposisi, riwayat keputusan, pembatalan, penyelesaian, dan UI `/app/pesantren/perizinan` untuk ajukan/setujui/tolak/disposisi/batal/selesai. UI juga punya SOP Disposisi per jenis izin agar tujuan disposisi tidak lagi hard-coded ke pengasuh. Gap lanjutan: menyimpan template SOP permanen di backend setting tenant bila pondok ingin dipakai lintas perangkat. |
| Kunjungan/gerbang | `KunjunganSiswaAction.java`, `PengajuanSiswaAction.java` | Dilengkapi | Endpoint daftar izin aktif, scan kartu, dan halaman Gerbang Keluar-Masuk ditambahkan. Petugas hanya mencatat lintasan terhadap izin DISETUJUI. |
| Catatan guru/orang tua | `CatatanGuruAction.java`, `CatatanSiswaAction.java`, `BukuPenghubungSiswa.java` | Dilengkapi | Modul `pesantren_buku_penghubung` dan UI `/app/pesantren/buku-penghubung` tersedia untuk catatan guru/pengurus/wali per santri, visibilitas INTERNAL/WALI, status, dan penutupan tindak lanjut. Gap lanjutan: notifikasi otomatis ke wali dan komentar balasan bertingkat. |
| Kegiatan kesiswaan/organisasi | `KegiatanKesiswaanAction.java`, `OrganisasiSiswaAction.java` | Dilengkapi dasar | UI `/app/pesantren/ekstrakurikuler` kini dapat membuat ekstrakurikuler/organisasi/kepanitiaan. Gap: anggota ekskul, jabatan, dan penilaian partisipasi detail belum dibuat sebagai layar penuh. |
| Katering/dapur/asrama | AIS terkait operasional asrama dan konsumsi | Dilengkapi dasar | UI `/app/pesantren/katering` tersedia untuk jadwal menu makan, status persiapan, realisasi konsumsi per asrama, bahan, stok minimum, dan transaksi stok. Gap lanjutan: perencanaan belanja otomatis dari jumlah santri dan laporan biaya makan per periode. |
| Dashboard/laporan | `Dashboard*.java`, `LaporanRekapitulasi*.java` | Dilengkapi dasar | Dashboard pondok, katalog laporan, dan UI `/app/pesantren/laporan` tersedia untuk memilih kode laporan, rentang tanggal, tahun ajaran, gelombang PSB, lalu menampilkan ringkasan/tabel. Gap lanjutan: ekspor PDF/XLS dan replika seluruh laporan legacy detail. |

## Catatan AIS untuk Gerbang

`KunjunganSiswaAction.java` memperlihatkan pola operasional lama: petugas mencari/memindai siswa, melihat daftar kunjungan dengan tanggal/jam, lalu mencatat keterangan. `PengajuanSiswaAction.java` memegang workflow izin/pengajuan dan laporan rekap berdasarkan izin siswa. ePesantren mengikuti pemisahan ini:

- `pesantren_izin`: proses pengajuan dan persetujuan izin.
- `pesantren_gerbang_log`: bukti lintasan keluar/masuk di pos keamanan.
- `PesantrenGerbangService`: hanya membaca izin DISETUJUI dan menulis log lintasan, tidak mengubah status izin.

## Yang Ditambahkan

- API `GET /api/v1/pesantren/gerbang/kartu/:nomorKartu`
  - mencari kartu aktif;
  - mengembalikan santri, kartu, izin DISETUJUI yang berlaku hari ini, dan lintasan terakhir.
- API `GET /api/v1/pesantren/gerbang/izin-aktif`
  - mengembalikan daftar santri yang punya izin DISETUJUI untuk tanggal hari ini;
  - ikut membawa NIS, nama, nomor kartu aktif bila ada, dan lintasan terakhir.
- API `POST /api/v1/pesantren/gerbang`
  - tetap memakai izin yang disetujui;
  - response sekarang ikut membawa NIS/nama santri agar tabel riwayat mudah dibaca.
- UI `/app/pesantren/gerbang`
  - input scan kartu/RFID;
  - pilih izin aktif;
  - pilih arah KELUAR/MASUK;
  - catat lintasan;
  - tampilkan riwayat gerbang.
- API dan UI `/app/pesantren/buku-penghubung`
  - menutup rujukan AIS `BukuPenghubungSiswa.java`, `CatatanGuruAction.java`, dan `CatatanSiswaAction.java`;
  - menyimpan catatan naratif per santri;
  - membedakan catatan internal pondok dan catatan yang boleh dibuka ke wali;
  - menyediakan status TERBUKA/SELESAI untuk tindak lanjut pengurus.
- Flutter `apps/pesantren-security-gate-flutter`
  - tab Daftar, Scan, Riwayat, Pengaturan;
  - daftar izin aktif hari ini untuk petugas security;
  - scan nomor kartu dengan scanner keyboard-wedge/RFID;
  - catat keluar/masuk ke API;
  - fingerprint sengaja ditunda sampai SDK/perangkat vendor dipastikan.
- UI operasional pesantren:
  - `/app/pesantren/presensi` untuk input massal presensi santri;
  - `/app/pesantren/perizinan` untuk workflow izin keluar-masuk;
  - `/app/pesantren/rombongan` dan `/app/pesantren/kurikulum` untuk kelas dan struktur mata pelajaran;
  - `/app/pesantren/jadwal` untuk tambah/filter/batalkan jadwal pelajaran;
  - `/app/pesantren/nilai` untuk mapel, komponen, dan input nilai;
  - `/app/pesantren/nilai/skala-huruf` untuk rentang konversi nilai ke huruf mutu;
  - `/app/pesantren/diniyah` dan `/app/pesantren/tahfiz` untuk kitab, halaqah, anggota, dan setoran;
  - `/app/pesantren/guru` dan `/app/pesantren/kartu` untuk master guru/ustadz dan kartu RFID/QR;
  - `/app/pesantren/absensi-guru` untuk absensi guru, jadwal piket, dan tanda hadir/tidak hadir piket;
  - `/app/pesantren/dompet` untuk pembuatan dompet, batas harian, top-up, belanja, saldo, dan riwayat transaksi;
  - `/app/pesantren/katering` untuk menu makan, status persiapan, realisasi konsumsi, bahan, dan transaksi stok dapur;
  - `/app/pesantren/laporan` untuk menjalankan katalog laporan pesantren;
  - `/app/pesantren/portal-wali` untuk akses baca anak, presensi, tahfiz, izin, dan dompet bagi akun wali;
  - `/app/pesantren/pelanggaran`, `/app/pesantren/prestasi`, dan `/app/pesantren/ekstrakurikuler` untuk pembinaan kesiswaan;
  - `/app/pesantren/buku-penghubung` untuk catatan guru/wali dan penutupan tindak lanjut;
  - form schema tambahan PSB dapat disimpan dari modal gelombang.

## Status Implementasi Singkat

Sudah operasional dasar:

- master santri, unit pendidikan, asrama/kamar/penempatan, kartu, tagihan, dompet, PSB, profil/berita pondok, perizinan, gerbang, guru, absensi guru, presensi, diniyah/tahfiz, nilai dasar, pelanggaran, prestasi, ekstrakurikuler, katering, laporan, dan portal wali.
- website pondok/unit pendidikan dengan subdomain dinamis di sisi aplikasi; DNS wildcard Cloudflare cukup untuk subdomain `*.santri.info`, sedangkan custom domain `*.sch.id` tetap perlu proses ownership/DNS.
- gerbang keluar-masuk berbasis izin disetujui, kartu aktif, dan log audit terpisah dari approval.
- UI kerja presensi massal, perizinan, rombongan, kurikulum, jadwal, nilai, skala huruf, dakwah/diniyah/tahfiz, guru, kartu, absensi guru, dompet, katering, laporan, portal wali, pembinaan kesiswaan, buku penghubung, dan PSB schema sudah menggantikan layar generic/Coming Soon utama.

Belum penuh dibanding AIS:

- UI builder drag-drop untuk `form_schema` PSB;
- UI SOP disposisi per jenis izin sudah tersedia di halaman perizinan; persistensi tenant/backend masih backlog bila perlu lintas perangkat;
- detail relasi presensi ke jadwal/piket;
- timetable visual drag-drop;
- UI entry nilai per kelas dan cetak rapor PDF;
- workflow akuntansi legacy untuk seluruh variasi posting piutang/diskon/deposit;
- notifikasi dan balasan bertingkat pada buku penghubung;
- integrasi fingerprint nyata sebelum SDK perangkat dipastikan.

## Gap Berikutnya yang Disarankan

1. Balasan/notifikasi buku penghubung ke wali.
2. Persistensi backend untuk template SOP disposisi bila harus lintas perangkat.
3. Jadwal visual drag-drop dan rapor PDF.
4. Relasi fisik `jadwal_id`/`piket_id` di tabel presensi bila diperlukan audit granular.
5. Integrasi fingerprint nyata setelah merek/perangkat SDK dipastikan.
