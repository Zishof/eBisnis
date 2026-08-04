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

Yang belum penuh bukan lagi "belum ada modul sama sekali", tetapi lebih banyak berupa penyempurnaan workflow legacy AIS, ekspor/cetak, visual builder, media management, dan integrasi perangkat.

## Matriks Status Terkini

| Area | Status | Sudah tersedia | Gap yang masih tersisa |
| --- | --- | --- | --- |
| Website pondok publik | Sebagian besar selesai | Profil pondok, berita, logo, hero image, muqodimah, subdomain tenant, halaman publik santri.info | CMS generik lengkap belum ada: page builder, gallery, menu editor, draft/publish multi-section, crop/alt text gambar |
| Website unit sekolah | Sebagian besar selesai | Unit pendidikan punya website sendiri, subdomain/custom domain field, logo/hero URL, upload logo/hero langsung dari admin, halaman unit cerah, kartu unit dari halaman pondok bisa menuju alamat unit | Gallery/program/kegiatan per unit belum jadi modul penuh; custom domain `*.sch.id` masih perlu verifikasi DNS/ownership dan automation ops |
| Cloudflare/subdomain | Sebagian selesai | Wildcard DNS `*.santri.info` cukup untuk subdomain dinamis di aplikasi; setting subdomain unit ada di CRUD unit pendidikan | Cloudflare API automation untuk membuat/mengubah record custom belum diaktifkan; perlu token, zone id, audit log, retry, dan validasi konflik |
| Master eSchool | Sebagian besar selesai | Unit pendidikan, guru/ustadz, santri, wali, kartu, rombongan, kurikulum, mapel, jadwal | Field biodata AIS yang sangat rinci belum semua menjadi kolom typed; beberapa masih perlu metadata/ekstensi |
| PSB/PPDB | Operasional dasar | Gelombang, unit tujuan, portal pendaftar, login/status, schema tambahan berbasis JSON, pilihan tahun ajaran/unit dari data sistem, dan tabel gelombang tanpa ID mentah | Builder drag-drop form lanjutan, verifikasi multi-step AIS, jadwal ujian/interview detail, dan cetak/rekap lanjutan belum penuh |
| Asrama | Operasional dasar | Asrama, kamar, penempatan santri | Locking kapasitas dan laporan asrama legacy belum lengkap; mutasi kamar historis perlu diperdalam |
| Keluar-masuk santri | Operasional dasar | Perizinan, lampiran, disposisi, izin aktif, gerbang, scan kartu/RFID keyboard-wedge, log keluar/masuk, app Flutter security gate dasar | Fingerprint ditunda; kunjungan tamu, paket kiriman, transport/penjemput, dan dashboard security detail belum penuh |
| Presensi santri | Operasional dasar | Presensi massal, presensi per tanggal/jenis, integrasi pilihan jadwal | Relasi fisik `jadwal_id`/`piket_id`, rekap absensi formal lengkap, dan perangkat absensi belum penuh |
| Diniyah/tahfiz/dakwah | Operasional dasar | Kitab, halaqah, anggota, setoran tahfiz, modul diniyah/tahfiz | Kalender kajian/dakwah publik, materi/arsip kajian, sanad/ustadz pengampu, sertifikat/syahadah belum penuh |
| Nilai/rapor | Sebagian selesai | Komponen nilai, skala huruf, entry nilai, endpoint rapor berbobot | Entry nilai per kelas lebih cepat, rapor PDF, template rapor, leger, ranking, kenaikan kelas/promosi belum penuh |
| Jadwal | Sebagian selesai | Jadwal pelajaran dengan validasi bentrok dasar | Timetable drag-drop, copy jadwal mingguan, substitusi guru, kalender ujian, dan ekspor belum penuh |
| Buku penghubung | Sebagian selesai | Catatan santri, visibilitas wali/internal, status tindak lanjut, notifikasi wali | Thread balasan dua arah, lampiran, template komunikasi, dan SLA tindak lanjut belum penuh |
| Pembinaan santri | Sebagian selesai | Pelanggaran, prestasi, ekstrakurikuler | Katalog hukuman/poin, workflow pembinaan berjenjang, penghargaan/apresiasi terpisah, anggota/jabatan/partisipasi ekskul belum penuh |
| Keuangan santri | Operasional dasar | Tagihan, dompet santri, top-up, transaksi kantin/POS, saldo, batas harian | Payment gateway, rekonsiliasi, posting akuntansi legacy piutang/diskon/deposit lengkap, invoice wali, dan settlement belum penuh |
| Katering/dapur | Sebagian selesai | Menu, status persiapan, realisasi konsumsi, bahan, stok minimum, transaksi stok | Perencanaan belanja otomatis, recipe/BOM, biaya makan per periode, notifikasi stok dan procurement belum penuh |
| Laporan | Sebagian selesai | Katalog laporan, tabel ringkasan, filter tanggal, pilihan tahun ajaran/gelombang dari data sistem, cetak/PDF browser, dan unduh CSV Excel | Replika seluruh laporan AIS, layout cetak resmi lanjutan, dan scheduler laporan belum penuh |
| Administrasi sistem | Operasional | Pengguna, role, hak akses menu, audit, pengaturan sudah memiliki halaman kerja | Data-scope granular per anak/wali dan audit template per modul masih perlu diperluas lewat test coverage |
| Help/Excel/AI/Observability | Sebagian/missing | Support/tiket, knowledge base, beberapa endpoint audit sudah ada di platform | Help center per modul, import/export Excel massal, AI assistant khusus pesantren, metric dashboard dan alert domain belum penuh |

## Gap Prioritas Berikutnya

### P0 - UI/UX dan Media Website

1. Buat media manager pesantren yang rapi untuk gambar pondok, unit sekolah, berita, dan gallery.
2. Tambahkan upload gambar berita dari admin; saat ini berita masih mengisi `gambarUrl` manual.
3. Tambahkan gallery/program unggulan per unit sekolah agar halaman unit tidak hanya hero + ringkasan.
4. Tambahkan metadata gambar: judul, alt text, sumber/atribusi, urutan tampil, status publish.
5. Terapkan pola UI/UX modern: hierarki bersih, banyak whitespace, navigasi jelas, kartu informatif tanpa bertumpuk, state hover/focus yang nyata, dan aksesibilitas keyboard.

### P1 - eSchool Inti dari AIS

1. Rapor PDF dan template cetak resmi.
2. Timetable visual drag-drop untuk jadwal pelajaran.
3. Builder drag-drop PSB agar admin tidak perlu menulis JSON schema.
4. Entry nilai per kelas/rombongan yang lebih cepat.
5. Promosi/kenaikan kelas dan histori akademik.

### P1 - Pesantren Operasional

1. Perluas modul gerbang: tamu, paket kiriman, transport, dan penjemput.
2. Tambahkan relasi fisik presensi ke jadwal/piket bila diperlukan audit granular.
3. Lengkapi pembinaan: hukuman/poin, tindak lanjut, apresiasi, penghargaan.
4. Lengkapi ekstrakurikuler: anggota, jabatan, kehadiran, nilai partisipasi.
5. Lengkapi dakwah: jadwal kajian, materi, arsip video/audio, publikasi ke website.

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

Yang paling perlu dikerjakan berikutnya adalah media manager + upload gambar berita/gallery, lalu rapor PDF, timetable drag-drop, dan PSB form builder. Ini memberi dampak paling besar ke tampilan publik pesantren/sekolah sekaligus menutup gap AIS yang masih paling terasa oleh pengguna harian.

## Update Implementasi 2026-08-04

Batch berikut sudah diterapkan di repo aktif:

- Portal publik `enterprise-education.id` tidak lagi jatuh ke landing eBisnis. Frontend kini punya landing Enterprise Education sendiri dengan gambar pendidikan/pesantren, empat dokumen publik, dan brand-aware header/footer untuk domain pendidikan.
- Dokumen `proposal`, `penawaran`, `presentasi`, dan `pks` pada domain pendidikan memakai narasi Enterprise Education, bukan narasi POS/retail.
- Laporan pesantren menutup sebagian gap ekspor: tabel laporan bisa dicetak/disimpan PDF lewat browser dan diunduh sebagai CSV yang bisa dibuka Excel.
- Gerbang pesantren menutup sebagian gap security: pos keamanan kini punya API dan UI untuk mencatat tamu, paket kiriman, dan penjemput tanpa mencampur alur izin keluar-masuk santri.
- Vault impor legacy CMN ditambahkan agar seluruh DBF inventory lama tersimpan sebagai raw audit terlebih dahulu sebelum projection operasional dilengkapi bertahap.
- PSB dan laporan dipoles: pembuatan gelombang memakai pilihan tahun ajaran/unit dari data sistem, tabel gelombang menampilkan nama tahun ajaran dan unit, serta filter laporan tidak lagi meminta ID teknis.

Yang masih belum penuh setelah batch ini:

- Media manager generik portal masih berupa pola slot stabil di UI; backend CMS media lintas portal belum dibuat.
- Gallery/program unggulan per unit sekolah belum menjadi modul CRUD penuh.
- Timetable visual drag-drop, template rapor resmi per jenjang, dan builder PSB drag-drop tingkat lanjut masih perlu fase berikutnya.
