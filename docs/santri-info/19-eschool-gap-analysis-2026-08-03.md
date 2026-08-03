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
| Absensi santri | `AbsensiAction.java`, `AbsensiSiswaHelper.java`, `AbsenPiketAction.java` | Ada sebagian | Presensi santri tersedia sebagai daftar dan API. Gap: mode input massal piket/detail per jadwal belum lengkap. |
| Absensi guru | `AbsenGuruPiketAction.java`, `GuruAction.java` | Ada sebagian | Guru dan absensi guru tersedia. Gap: penugasan piket dan detail jadwal mengajar AIS belum penuh. |
| Diniyah/tahfiz | AIS tersebar di jadwal, nilai, kegiatan | Ada | Halaqah, kitab, dan tahfiz tersedia. Gap: rapor diniyah lengkap belum final. |
| Jadwal pelajaran | `JadwalPelajaranAction.java`, `JamPelajaranAction.java`, `TimetableJadwalPelajaranWindow.java` | Ada sebagian | Kurikulum/mata pelajaran tersedia. Gap: timetable visual dan pertemuan jadwal belum dibuat penuh. |
| Nilai/rapor | `PenilaianSiswaAction.java`, `JenisNilaiSiswaAction.java`, `NilaiHurufSekolahAction.java`, `JenisRaporSiswaAction.java` | Ada sebagian | Mata pelajaran dan struktur nilai tersedia. Gap: entry nilai per kelas, formula rapor, cetak rapor belum lengkap. |
| PSB/PPDB | `CalonSiswaAction.java`, `GelombangPendaftaranPsbAction.java`, `PPDB*.java`, `VerifikasiPSBHelper.java` | Ada | Portal PSB, gelombang, pendaftar tersedia. Gap: variasi form AIS yang banyak belum semua dijadikan konfigurasi UI. |
| Tagihan/pembayaran/deposit | `TagihanAction.java`, `PembayaranSiswaAction.java`, `DepositSiswaAction.java`, `PostingPiutangSiswaAction.java` | Ada sebagian | Tagihan, dompet santri, POS/dompet handler tersedia. Gap: semua skenario posting akuntansi legacy belum seluruhnya dipetakan. |
| Pelanggaran/hukuman | `PelanggaranSiswaAction.java`, `PelanggaranDanHukumanAction.java`, `HukumanAction.java` | Ada sebagian | Pencatatan pelanggaran tersedia. Gap: katalog hukuman dan workflow tindak lanjut bertingkat masih perlu halaman operasional. |
| Prestasi/penghargaan | `PrestasiSiswaAction.java`, `PenghargaanSiswaAction.java`, `ApresiasiSiswaAction.java` | Ada sebagian | Prestasi tersedia. Gap: penghargaan/apresiasi terpisah belum seluruhnya menjadi modul. |
| Pengajuan/izin siswa | `PengajuanSiswaAction.java` | Ada | Perizinan santri dengan status MENUNGGU/DISETUJUI/DITOLAK/SELESAI/DIBATALKAN sudah ada. Gap: lampiran, parameter tambahan, SOP disposisi legacy belum semua ada. |
| Kunjungan/gerbang | `KunjunganSiswaAction.java`, `PengajuanSiswaAction.java` | Dilengkapi | Endpoint daftar izin aktif, scan kartu, dan halaman Gerbang Keluar-Masuk ditambahkan. Petugas hanya mencatat lintasan terhadap izin DISETUJUI. |
| Catatan guru/orang tua | `CatatanGuruAction.java`, `CatatanSiswaAction.java`, `BukuPenghubungSiswa.java` | Belum penuh | Belum menjadi modul workflow tersendiri. Kandidat berikutnya: buku penghubung wali. |
| Kegiatan kesiswaan/organisasi | `KegiatanKesiswaanAction.java`, `OrganisasiSiswaAction.java` | Ada sebagian | Ekstrakurikuler tersedia. Gap: organisasi, jabatan, penilaian kegiatan, dan detail anggota belum lengkap. |
| Dashboard/laporan | `Dashboard*.java`, `LaporanRekapitulasi*.java` | Ada sebagian | Dashboard pondok dan katalog laporan tersedia. Gap: laporan legacy detail masih perlu prioritas per kebutuhan operasional. |

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
- Skeleton Flutter `apps/pesantren-security-gate-flutter`
  - tab Daftar, Scan, Riwayat, Pengaturan;
  - daftar izin aktif hari ini untuk petugas security;
  - scan nomor kartu dengan scanner keyboard-wedge/RFID;
  - catat keluar/masuk ke API;
  - field `fingerprintId` disiapkan sebagai adapter vendor fingerprint.

## Status Implementasi Singkat

Sudah operasional dasar:

- master santri, unit pendidikan, asrama/kamar, kartu, tagihan, dompet, PSB, profil/berita pondok, perizinan, gerbang, guru, absensi guru, presensi, diniyah/tahfiz, nilai dasar, pelanggaran, prestasi, ekstrakurikuler, katering, laporan, dan portal wali.
- website pondok/unit pendidikan dengan subdomain dinamis di sisi aplikasi; DNS wildcard Cloudflare cukup untuk subdomain `*.santri.info`, sedangkan custom domain `*.sch.id` tetap perlu proses ownership/DNS.
- gerbang keluar-masuk berbasis izin disetujui, kartu aktif, dan log audit terpisah dari approval.

Belum penuh dibanding AIS:

- form dinamis PSB sebanyak variasi `PPDB*.java`;
- parameter tambahan/lampiran/SOP disposisi pada `PengajuanSiswaAction.java`;
- input massal presensi piket dan detail jadwal;
- timetable visual serta kalender pertemuan pelajaran;
- formula rapor, cetak rapor, nilai huruf lengkap;
- workflow akuntansi legacy untuk seluruh variasi posting piutang/diskon/deposit;
- buku penghubung dan catatan guru/orang tua;
- integrasi fingerprint nyata sebelum SDK perangkat dipastikan.

## Gap Berikutnya yang Disarankan

1. Modul input massal presensi/piket seperti AIS `AbsenPiketAction.java`.
2. Perizinan lengkap dengan lampiran dan SOP disposisi seperti `PengajuanSiswaAction.java`.
3. Buku penghubung/catatan orang tua.
4. Jadwal visual dan rapor lengkap.
5. Integrasi fingerprint nyata setelah merek/perangkat SDK dipastikan.
