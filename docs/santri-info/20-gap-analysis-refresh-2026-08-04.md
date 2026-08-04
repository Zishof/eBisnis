# Gap Analysis Refresh ePesantren dan eSchool

Tanggal: 2026-08-04
Repo: `C:\opt\eBisnisGithub-ecosystem`
Referensi AIS: `C:\opt\AIS\ais\src\main\src\ais\action\master\sekolah\*`

## Sumber Audit

- Dokumen master eksekusi:
  - `C:\Users\USER\Downloads\PERINTAH_MASTER_CLAUDE_CODE_EKSEKUSI_SANTRI_INFO_EPESANTREN_MODERN_V2.md`
  - `C:\Users\USER\Downloads\PERINTAH_MASTER_CLAUDE_CODE_PLATFORM_KOLABORATIF_MULTI_PORTAL_EBISNIS_EMEDIK_EKOPERASI_ENTERPRISE_EDUCATION_INFO_DESA.md`
- Dokumen repo:
  - `docs/santri-info/04-epesantren-domain-gap-matrix.md`
  - `docs/santri-info/05-eschool-gap-matrix.md`
  - `docs/santri-info/09-cms-and-tenant-website-analysis.md`
  - `docs/santri-info/16-implementation-plan.md`
  - `docs/santri-info/19-eschool-gap-analysis-2026-08-03.md`
- Source baru:
  - `apps/api/src/modules/pesantren/*`
  - `apps/web/src/pages/app/pesantren/*`
  - `apps/api/tenant-migrations/pesantren/*`
  - `apps/api/tenant-migrations/V044__pesantren_unit_visuals.sql`
- Source AIS lama: 142 file Java di folder sekolah.

## Ringkasan Status

Dokumen awal `04`, `05`, dan `09` sudah sebagian stale karena banyak modul yang sebelumnya `MISSING` kini sudah dibuat. Status terkini: ePesantren/eSchool sudah punya fondasi operasional, website pondok, website unit pendidikan, PSB, santri/wali, asrama, presensi, perizinan, gerbang, diniyah/tahfiz, nilai, guru, kartu, dompet, katering, laporan, dan portal wali.

Yang belum penuh bukan lagi "belum ada modul sama sekali", tetapi lebih banyak berupa penyempurnaan workflow legacy AIS, ekspor/cetak, visual builder, CMS lanjutan, dan integrasi perangkat.

## Matriks Status Terkini

| Area | Status | Sudah tersedia | Gap yang masih tersisa |
| --- | --- | --- | --- |
| Website pondok publik | Sebagian besar selesai | Profil pondok, berita, logo, hero image, muqodimah, subdomain tenant, galeri/program/fasilitas terbit, halaman publik santri.info | CMS generik lengkap belum ada: page builder, menu editor, draft/publish multi-section, crop gambar, dan bulk media |
| Website unit sekolah | Sebagian besar selesai | Unit pendidikan punya website sendiri, subdomain/custom domain field, logo/hero URL, upload logo/hero langsung dari admin, galeri/program/kegiatan per unit, kartu unit dari halaman pondok bisa menuju alamat unit | Custom domain `*.sch.id` masih perlu verifikasi DNS/ownership dan automation ops; gallery belum punya drag-drop ordering visual |
| Cloudflare/subdomain | Sebagian selesai | Wildcard DNS `*.santri.info` cukup untuk subdomain dinamis di aplikasi; setting subdomain unit ada di CRUD unit pendidikan | Cloudflare API automation untuk membuat/mengubah record custom belum diaktifkan; perlu token, zone id, audit log, retry, dan validasi konflik |
| Master eSchool | Sebagian besar selesai | Unit pendidikan, guru/ustadz, santri, wali, kartu, rombongan, kurikulum, mapel, jadwal; kelas/kurikulum memakai pilihan tahun ajaran aktif, bukan input ID manual | Field biodata AIS yang sangat rinci belum semua menjadi kolom typed; beberapa masih perlu metadata/ekstensi |
| PSB/PPDB | Operasional dasar | Gelombang, unit tujuan, portal pendaftar, login/status, builder field tambahan dengan drag reorder, tombol naik/turun, preview, schema tambahan berbasis JSON, jadwal ujian/wawancara per pendaftar, dan catat hasil seleksi | Verifikasi multi-step AIS, cetak kartu/rekap seleksi, dan dashboard panitia lanjutan belum penuh |
| Asrama | Operasional dasar | Asrama, kamar, penempatan santri | Locking kapasitas dan laporan asrama legacy belum lengkap; mutasi kamar historis perlu diperdalam |
| Keluar-masuk santri | Operasional dasar | Perizinan, lampiran, disposisi, izin aktif, gerbang, scan kartu/RFID keyboard-wedge, log keluar/masuk, tamu, paket kiriman, penjemput, app Flutter security gate dasar | Fingerprint ditunda; transport/perjalanan detail dan dashboard security detail belum penuh |
| Presensi santri | Operasional dasar | Presensi massal, presensi per tanggal/jenis, integrasi pilihan jadwal | Relasi fisik `jadwal_id`/`piket_id`, rekap absensi formal lengkap, dan perangkat absensi belum penuh |
| Diniyah/tahfiz/dakwah | Operasional dasar | Kitab, halaqah, anggota, setoran tahfiz, modul diniyah/tahfiz, kajian publik, materi URL, rekaman URL, gambar, dan publish ke website | Sanad/ustadz pengampu, sertifikat/syahadah, dan arsip dakwah tingkat lanjut belum penuh |
| Nilai/rapor | Sebagian selesai | Komponen nilai, skala huruf, entry nilai satuan, input nilai massal per rombongan dan komponen, endpoint rapor berbobot, template cetak/PDF browser dasar | Leger, ranking, kenaikan kelas/promosi, impor Excel, dan template rapor spesifik per yayasan/jenjang belum penuh |
| Jadwal | Sebagian selesai | Jadwal pelajaran dengan validasi bentrok dasar, timetable visual per hari, dan drag-to-move antarhari yang tetap melewati validasi bentrok backend | Copy jadwal mingguan, substitusi guru, kalender ujian, ekspor, dan drag-resize jam belum penuh |
| Buku penghubung | Sebagian selesai | Catatan santri, visibilitas wali/internal, status tindak lanjut, notifikasi wali | Thread balasan dua arah, lampiran, template komunikasi, dan SLA tindak lanjut belum penuh |
| Pembinaan santri | Sebagian besar selesai | Katalog pelanggaran berpoin, catatan pelanggaran, hukuman/pembinaan, status selesai hukuman, prestasi kompetisi, penghargaan/apresiasi internal, ekstrakurikuler/organisasi, anggota, jabatan, keluar anggota, dan nilai partisipasi | Workflow pembinaan berjenjang lintas musyrif/wali kelas, surat panggilan resmi, dashboard poin, dan cetak rekap pembinaan belum penuh |
| Keuangan santri | Operasional dasar | Tagihan, dompet santri, top-up, transaksi kantin/POS, saldo, batas harian | Payment gateway, rekonsiliasi, posting akuntansi legacy piutang/diskon/deposit lengkap, invoice wali, dan settlement belum penuh |
| Katering/dapur | Sebagian selesai | Menu, status persiapan, realisasi konsumsi, bahan, stok minimum, transaksi stok | Perencanaan belanja otomatis, recipe/BOM, biaya makan per periode, notifikasi stok dan procurement belum penuh |
| Laporan | Sebagian selesai | Katalog laporan dan tabel ringkasan | Ekspor PDF/XLS, replika seluruh laporan AIS, layout cetak resmi, dan scheduler laporan belum penuh |
| Administrasi sistem | Operasional | Pengguna, role, hak akses menu, audit, pengaturan sudah memiliki halaman kerja | Data-scope granular per anak/wali dan audit template per modul masih perlu diperluas lewat test coverage |
| Help/Excel/AI/Observability | Sebagian/missing | Support/tiket, knowledge base, beberapa endpoint audit sudah ada di platform | Help center per modul, import/export Excel massal, AI assistant khusus pesantren, metric dashboard dan alert domain belum penuh |

## Gap Prioritas Berikutnya

### P0 - UI/UX dan Media Website

1. Media manager pondok/unit sudah tersedia untuk galeri, program, fasilitas, kegiatan, dan prestasi.
2. Admin sudah dapat menambah media, mengisi URL gambar atau upload berkas, alt text, sumber/atribusi, urutan tampil, dan status publish.
3. Gallery/program unggulan sudah tampil di situs pondok dan situs unit sekolah.
4. Upload gambar berita dari admin sudah tersedia; URL manual tetap ada untuk sumber luar.
5. Fase berikutnya: crop/editor gambar, bulk upload, drag-drop ordering visual, dan page/menu builder.

### P1 - eSchool Inti dari AIS

1. Template rapor cetak dasar sudah tersedia; fase berikutnya adalah template resmi spesifik per yayasan/jenjang dan kop digital.
2. Timetable sudah mendukung drag-to-move antarhari; fase berikutnya drag-resize jam, copy mingguan, dan substitusi guru.
3. Builder PSB sudah punya field berurutan, preview, drag reorder, dan tombol naik/turun sebagai alternatif aksesibel; jadwal ujian/wawancara dan hasil seleksi sudah punya panel kerja admin.
4. Input nilai massal sudah tersedia per rombongan dan komponen; fase berikutnya impor Excel dan validasi nilai lintas komponen.
5. Promosi/kenaikan kelas dan histori akademik.

### P1 - Pesantren Operasional

1. Perluas modul gerbang berikutnya ke transport/perjalanan detail; tamu, paket kiriman, dan penjemput sudah tersedia.
2. Tambahkan relasi fisik presensi ke jadwal/piket bila diperlukan audit granular.
3. Lengkapi pembinaan lanjutan: workflow berjenjang lintas musyrif/wali kelas, surat panggilan resmi, dashboard poin, dan cetak rekap pembinaan.
4. Lengkapi ekstrakurikuler lanjutan: kehadiran per kegiatan, kalender latihan, dan sertifikat partisipasi.
5. Lengkapi dakwah lanjutan: sanad, syahadah/sertifikat, kurasi ustadz pengampu, dan arsip tematik.

### P2 - Keuangan, Laporan, dan Integrasi

1. Mapping posting akuntansi legacy untuk piutang, diskon, deposit, denda, dan dibayar di muka.
2. Payment gateway wali dan rekonsiliasi pembayaran.
3. Export PDF/XLS untuk laporan pesantren dan sekolah.
4. Import Excel massal untuk santri, wali, rombongan, jadwal, tagihan, dan nilai.
5. Cloudflare API automation untuk custom domain/subdomain setelah kredensial operasional disiapkan.
6. Fingerprint SDK setelah vendor/perangkat dipastikan.

## Prinsip UI/UX yang Dipakai sebagai Rujukan

- Clarity-first: halaman utama langsung memperlihatkan tugas utama, status, dan tindakan berikutnya.
- Progressive disclosure: form besar dipecah ke section/tab, field lanjutan hanya muncul saat relevan.
- Visual hierarchy: judul, ringkasan, CTA, data penting, dan detail sekunder punya bobot visual berbeda.
- Content-rich but calm: sistem pesantren/sekolah perlu terasa profesional, cerah, dan edukatif, bukan gelap atau terlalu dekoratif.
- Accessible by default: kontras baik, target klik cukup besar, navigasi keyboard, label form jelas, error dekat field.
- Admin-editable media: gambar hero/logo/gallery tidak hard-coded; admin bisa upload, mengganti, dan mempublikasikan.

## Kesimpulan

Yang paling perlu dikerjakan berikutnya adalah penyempurnaan CMS media, template rapor resmi, drag gesture timetable, dan PSB form builder tingkat lanjut. Ini memberi dampak paling besar ke tampilan publik pesantren/sekolah sekaligus menutup gap AIS yang masih paling terasa oleh pengguna harian.

## Update Implementasi 2026-08-04

Batch berikut sudah diterapkan di repo aktif:

- Portal publik `enterprise-education.id` tidak lagi jatuh ke landing eBisnis. Frontend kini punya landing Enterprise Education sendiri dengan gambar pendidikan/pesantren, empat dokumen publik, dan brand-aware header/footer untuk domain pendidikan.
- Dokumen `proposal`, `penawaran`, `presentasi`, dan `pks` pada domain pendidikan memakai narasi Enterprise Education, bukan narasi POS/retail.
- Laporan pesantren menutup sebagian gap ekspor: tabel laporan bisa dicetak/disimpan PDF lewat browser dan diunduh sebagai CSV yang bisa dibuka Excel.
- Gerbang pesantren menutup sebagian gap security: pos keamanan kini punya API dan UI untuk mencatat tamu, paket kiriman, dan penjemput tanpa mencampur alur izin keluar-masuk santri.
- Vault impor legacy CMN ditambahkan agar seluruh DBF inventory lama tersimpan sebagai raw audit terlebih dahulu sebelum projection operasional dilengkapi bertahap.
- Media manager pesantren ditambahkan: admin dapat membuat media pondok/unit, mengunggah gambar manual, mengisi alt text/atribusi/urutan/status publish, dan media tampil di situs pondok maupun situs unit pendidikan.
- Aplikasi Flutter inventory sales terpisah dari POS kasir lewat `APP_PRODUCT=inventory`, dengan login demo CMN, dashboard sales, order terbaru, rekonsiliasi legacy, dan risiko batch/stok.
- Builder field tambahan PSB dipoles dengan pengurutan naik/turun, drag reorder, target sentuh lebih lega, dan preview formulir publik, sehingga admin tidak perlu menebak JSON untuk kebutuhan umum.
- PSB pendaftar dipoles dengan panel jadwal ujian/wawancara dan catat hasil seleksi, sehingga panitia bisa mengatur beberapa sesi per calon tanpa keluar dari daftar pendaftar.
- Input nilai massal per komponen ditambahkan agar guru dapat mengisi banyak santri dalam satu tabel dan menyimpannya sebagai batch.
- Input nilai massal kini bisa difilter per rombongan/kelas, sehingga guru tidak perlu memuat seluruh santri aktif saat mengisi satu kelas.
- Rapor santri dipoles menjadi template cetak/PDF browser dasar dengan header resmi, identitas santri, tabel nilai, dan area tanda tangan wali kelas, orang tua/wali, serta kepala satuan pendidikan.
- Timetable jadwal pelajaran kini mendukung drag-to-move antarhari: kartu jadwal bisa ditarik ke kolom hari lain, sistem membuat sesi baru lalu membatalkan sesi lama, dan validasi bentrok tetap ditangani backend.
- Pembinaan santri diperdalam: UI admin sekarang membuka hukuman/pembinaan per pelanggaran, penyelesaian hukuman, penghargaan/apresiasi internal, anggota ekstrakurikuler/organisasi, jabatan, keluar anggota, dan nilai partisipasi.
- Kelas dan kurikulum eSchool dipoles: tahun ajaran kini dipilih dari daftar aktif/tersedia, tabel menampilkan nama tahun ajaran, dan form tambah rombongan/kurikulum lebih responsif di mobile.

Yang masih belum penuh setelah batch ini:

- Media manager generik lintas portal masih belum dibuat; yang sudah tersedia sekarang khusus pesantren pondok/unit.
- Crop/editor gambar, bulk upload, dan drag-drop ordering visual belum penuh.
- Drag-resize jam timetable, template rapor spesifik per yayasan/jenjang, cetak/rekap PSB, dashboard poin pembinaan, dan builder PSB tingkat lanjut masih perlu fase berikutnya.
