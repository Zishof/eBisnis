# Gap Analysis AIS Sekolah ke ePesantren/eSchool

Tanggal: 2026-08-05

Rujukan legacy: `C:\opt\AIS\ais\src\main\src\ais\action\master\sekolah\*`

Audit ini membaca 142 file Java utama di folder AIS `master\sekolah` dan mengelompokkan class ke modul ePesantren/eSchool modern. Status di bawah memakai keadaan repo `C:\opt\eBisnisGithub-ecosystem` setelah batch implementasi terbaru.

## Ringkasan Cepat

| Klaster AIS | Contoh class AIS | Status ePesantren/eSchool | Gap berikutnya |
| --- | --- | --- | --- |
| Yayasan, sekolah, unit, jenis sekolah | `YayasanAction`, `SekolahAction`, `JenisSekolahAction`, `PenjurusanSekolahAction` | Sebagian besar selesai melalui profil pondok, unit pendidikan, domain/subdomain unit, website unit | Detail penjurusan/major formal per jenjang belum menjadi master typed penuh |
| Santri, wali, biodata, alumni, BK | `SiswaAction`, `BiodataSiswaAction`, `SiswaWaliAction`, `AlumniSiswaAction`, `SiswaBkAction` | Sebagian besar selesai: santri, wali, Dapodik, portal wali, status aktif/keluar | Riwayat alumni/BK sebagai workflow khusus masih perlu pendalaman |
| Referensi biodata keluarga | `PekerjaanOrtuSiswaAction`, `PendidikanOrangTuaSiswaAction`, `PenghasilanOrangTuaSiswaAction`, `KebutuhanKhususSiswaAction`, `AlatTransportasiSiswaAction`, `JenisTinggalSiswaAction` | Sebagian selesai: kolom Dapodik sudah tersedia, agama sudah referensi | Master referensi formal untuk pilihan Dapodik belum seluruhnya menjadi tabel CRUD |
| PSB/PPDB | `CalonSiswaAction`, `GelombangPendaftaranPsbAction`, `PaketPsbAction`, `KelompokPendaftaranPsbAction`, `KelasSiswaPSBAction`, `RuangPSBAction`, `JadwalUjianPSBAction`, `JadwalPertemuanPSBAction`, `InterviewCalonSiswaAction`, `UjianPSBAction`, `VerifikasiKelengkapanCalonSiswaAction`, `PPDB*.java` | Operasional dasar: gelombang, portal daftar/login, schema tambahan JSON, unit tujuan, daftar ulang | Builder PSB drag-drop, jadwal ujian/interview detail, ruang ujian, skor ujian, dan verifikasi multi-parameter belum penuh |
| Kelas, kurikulum, mapel, jadwal | `KelasSiswaAction`, `KurikulumSekolahAction`, `MatapelajaranAction`, `SubMatapelajaranAction`, `KelompokMatapelajaranAction`, `JadwalPelajaranAction`, `JamPelajaranAction`, `PertemuanJadwalPelajaranAction`, `MasaJadwalPelajaranAction`, `TimetableJadwalPelajaranWindow` | Sebagian selesai: rombongan, kurikulum, mapel, jadwal dengan validasi bentrok | Timetable visual drag-drop, copy jadwal, substitusi guru, pertemuan belajar detail, dan ekspor jadwal belum penuh |
| Guru dan penugasan | `GuruAction`, `JenisGuruAction`, `JenisSKGuruAction`, `GuruMengajarAction`, `PenugasanGuruMengajarAction`, `AbsenGuruPiketAction` | Sebagian besar selesai: master guru, penugasan, absensi guru, piket | SK guru, jenis guru typed, evaluasi guru, dan dokumen penugasan cetak belum penuh |
| Presensi santri | `AbsensiAction`, `AbsenPiketAction`, `AbsensiSiswaHelper` | Operasional dasar: presensi massal, jenis presensi, integrasi jadwal | FK fisik jadwal/piket dan rekap presensi formal belum penuh |
| Aktivitas harian dan buku penghubung | `AktiftasHarianSiswaAction`, `DaftarAktifitasHarianSiswaAction`, `DashboardAktifitasHarianSiswaAction`, `JenisAktiftasHarianDefaultAction`, `JenisMateriHarianDefaultAction`, `CatatanOrangTuaAktiftasHarianAction`, `BukuPenghubungSiswa` | Dilengkapi batch ini: buku penghubung kini punya jenis `AKTIVITAS_HARIAN` dan `MATERI_HARIAN`, notifikasi wali, status tindak lanjut | Template aktivitas/materi default dan dashboard tren harian per asrama/kelas belum penuh |
| Catatan guru, kelas, siswa | `CatatanGuruAction`, `CatatanKelasSiswaAction`, `CatatanSiswaAction`, `JenisCatatan*`, `ParameterTambahanCatatan*` | Sebagian selesai: buku penghubung naratif dengan jenis dan visibilitas | Parameter tambahan dinamis per jenis catatan belum penuh |
| Nilai, rapor, checklist | `PenilaianSiswaAction`, `JenisNilaiSiswaAction`, `JenisNilaiHurufAction`, `NilaiHurufSekolahAction`, `JenisRaporSiswaAction`, `AngketPenilaianGuruAction`, `ChecklistPenilaianGuruAction`, `ChecklistPenilaianOlehDosenAction`, `GrupPenilaianAction` | Sebagian selesai: komponen nilai, skala huruf, entry nilai, endpoint rapor berbobot | Rapor PDF resmi, checklist/angket evaluasi guru, leger, ranking, dan kenaikan kelas belum penuh |
| Pembinaan, pelanggaran, hukuman | `PelanggaranAction`, `PelanggaranSiswaAction`, `HukumanAction`, `PelanggaranDanHukumanAction`, `ApresiasiAction`, `ApresiasiSiswaAction`, `PenghargaanAction`, `PenghargaanSiswaAction` | Sebagian selesai: katalog pelanggaran, hukuman, prestasi, penghargaan | Workflow poin, eskalasi BK, apresiasi terstruktur, dan surat pembinaan belum penuh |
| Prestasi, kegiatan, organisasi | `PrestasiSiswaAction`, `CabangPrestasiSiswaAction`, `KegiatanSiswaAction`, `KegiatanKesiswaanAction`, `OrganisasiSiswaAction`, `JabatanOrganisasiSiswaAction`, `PembinaSiswaAction`, `PklSiswaAction`, `SkalaKegiatanKesiswaanAction` | Sebagian selesai: ekstrakurikuler/organisasi, anggota, jabatan, prestasi/penghargaan | PKL, skala kegiatan, cabang prestasi typed, dan dashboard partisipasi belum penuh |
| Asrama, kunjungan, keluar-masuk | `AsramaSiswaAction`, `KunjunganSiswaAction`, `PengajuanSiswaAction`, `KelompokStatusKeluarSiswaAction`, `StatusKeluarSiswaAction` | Sebagian besar selesai: asrama/kamar, perizinan, gerbang, tamu/paket/penjemput | Mutasi kamar historis detail, laporan asrama legacy, dan kunjungan wali detail belum penuh |
| Keuangan siswa | `TagihanAction`, `PembayaranSiswaAction`, `PembayaranCalonSiswaAction`, `DepositSiswaAction`, `DiskonSiswaAction`, `ItemBiayaSekolahAction`, `JenisBiayaSekolahAction`, `KanalPembayaranAction`, `AkunPembayaranSiswaAction`, `PengaturanBiayaAction` | Operasional dasar: tagihan, item, pembayaran, dompet, top-up/belanja, POS adapter | Diskon/deposit legacy, kanal pembayaran detail, invoice wali, rekonsiliasi, dan payment gateway belum penuh |
| Posting akuntansi legacy | `PostingPiutangSiswaAction`, `PostingCicilanSiswaAction`, `PostingDepositSiswaAction`, `PostingDibayarDimukaSiswaAction`, `PostingPiutangDendaSiswaAction`, `PostingUtangDiskonSiswaAction` | Belum penuh: baru ada dasar tagihan/pembayaran dan dompet | Mapping jurnal akuntansi legacy per skenario masih menjadi gap besar |
| Dashboard dan rekap | `DashboardRegistrasiSiswa`, `DashboardStatusSiswa`, `DashboardStatistikSiswa`, `DashboardAsalSekolahSiswa`, `DashboardHarianSiswa`, `DasborKeuanganSiswaAction`, `RekapJalurMasukMultiTahunPsb` | Sebagian selesai: dashboard pesantren, laporan, CSV/PDF browser | Dashboard khusus PSB multi-tahun, asal sekolah, status santri, dan keuangan siswa legacy belum penuh |

## Modul yang Paling Belum Ada

1. **PSB lanjutan:** interview, ruang/jadwal ujian, skor ujian, verifikasi parameter, dan builder formulir visual.
2. **Timetable visual:** drag-drop jadwal, copy minggu, substitusi pengajar, ekspor jadwal.
3. **Rapor resmi:** template PDF per jenjang, leger, ranking, kenaikan kelas/promosi.
4. **Posting akuntansi sekolah:** piutang, cicilan, deposit, denda, dibayar di muka, diskon.
5. **Master referensi Dapodik/AIS:** pekerjaan, pendidikan, penghasilan, transportasi, tinggal, kebutuhan khusus sebagai CRUD referensi.
6. **Dashboard AIS spesifik:** registrasi multi-tahun, asal sekolah, status santri, aktivitas harian, dan keuangan siswa.
7. **Workflow BK/pembinaan:** poin, eskalasi, surat panggilan, apresiasi, penghargaan, dan tindak lanjut berjenjang.

## Batch Implementasi 2026-08-05

- Buku penghubung diperluas dengan jenis `AKTIVITAS_HARIAN` dan `MATERI_HARIAN`.
- UI buku penghubung menjadi `Buku Penghubung dan Aktivitas Harian`, dengan metrik aktivitas/materi, header form yang lebih jelas, dan default input untuk catatan harian.
- Migrasi tenant baru disiapkan agar constraint database menerima jenis baru.

## Prinsip UI/UX yang Dipakai

- Alur harian harus satu layar dan cepat: pilih santri, pilih jenis, isi catatan, simpan.
- Informasi penting tampil sebagai metrik singkat sebelum tabel.
- Form besar diberi konteks visual dan teks bantuan pendek.
- Mobile harus tetap satu kolom yang nyaman, desktop memakai grid ringkas.
- Gambar dan konten publik tetap admin-editable, tidak hardcoded.
