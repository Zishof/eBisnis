# Serah Terima ke Claude - eBisnis Ecosystem

Tanggal: 10 Agustus 2026

Workspace utama saat dokumen dibuat: `C:\opt\eBisnisGithub-ecosystem`

Tujuan: memberi Claude konteks kerja yang utuh, terstruktur, dan aman dari seluruh percakapan panjang mengenai eBisnis, POS, Sales/Inventory, Flutter, tenant vertikal, dan pelanggan pertama Caruban Medika Nusantara.

> Dokumen ini adalah ringkasan serah-terima, bukan transkrip verbatim. Permintaan pengguna, fakta yang pernah dilaporkan, dan hal yang sudah benar-benar diverifikasi harus dibedakan. Jangan menganggap sebuah fitur selesai hanya karena pernah diminta atau dibahas.

## 1. Cara Membaca Status

- **TERKONFIRMASI**: pernah diperlihatkan melalui log, tangkapan layar, commit, atau hasil kerja yang disebutkan dalam percakapan.
- **PERMINTAAN**: hasil akhir yang diminta pengguna; belum tentu sudah selesai di source aktif.
- **PERLU VERIFIKASI**: pernah disebut selesai oleh sesi lain, tetapi harus diperiksa lagi pada branch/worktree yang akan dipakai.
- **BUG/BLOKER**: masalah nyata yang pernah muncul dalam build, migration, deploy, routing, permission, atau aplikasi.
- **RAHASIA**: kata sandi/token sengaja tidak ditulis di berkas terlacak Git. Ambil dari pengguna atau secret store, lalu rotasi bila pernah dipakai untuk demo publik.

## 2. Prinsip Kerja Pengguna

1. Pengguna ingin pekerjaan diterapkan langsung, tidak berhenti pada analisis, wireframe, skeleton, mockup, atau dokumentasi.
2. Implementasi harus incremental, mengikuti pola source existing, diuji, dibangun, dan disiapkan untuk deploy.
3. Web React, Flutter Windows, dan Flutter Android harus mempunyai paritas fungsi untuk modul Sales/Inventory yang relevan.
4. UI harus modern, responsif, nyaman pada desktop dan mobile, tetap padat dan efisien untuk aplikasi operasional.
5. Data tenant harus terisolasi dalam schema masing-masing.
6. Jangan mengarang status selesai. Untuk setiap klaim, periksa source, migration, permission, test, artifact, dan perilaku aplikasi.
7. Jangan merusak worktree lain atau membuang perubahan lokal pengguna. Hindari reset/rebase paksa.

## 3. Repo dan Worktree

Repo yang sama dipakai banyak sesi melalui beberapa worktree. Folder yang pernah dipilih dan disinkronkan:

- `C:\opt\eBisnisGithub`
- `C:\opt\eBisnisGithub-cmn-async-import`
- `C:\opt\eBisnisGithub-core`
- `C:\opt\eBisnisGithub-crud-tools`
- `C:\opt\eBisnisGithub-customer48`
- `C:\opt\eBisnisGithub-deploy-cmn`
- `C:\opt\eBisnisGithub-ecosystem`
- `C:\opt\eBisnisGithub-ekoperasi`
- `C:\opt\eBisnisGithub-emedik`
- `C:\opt\eBisnisGithub-info-desa`
- `C:\opt\eBisnisGithub-inventory48`
- `C:\opt\eBisnisGithub-mitrainap`
- `C:\opt\eBisnisGithub-pos`

Status sinkronisasi terakhir yang dilaporkan:

- Seluruh worktree di atas sudah menjalani `fetch --prune` dan fast-forward bila aman.
- Worktree dirty, ahead, atau diverged tidak di-reset, tidak di-rebase, dan tidak ditimpa.
- Laporan lokal tersedia di:
  - `C:\opt\ebisnis-git-sync-report.json`
  - `C:\opt\ebisnis-git-sync-summary.txt`
- Sebelum mulai, jalankan ulang audit branch/status karena commit dari komputer lain dapat terus berubah.

Aturan penting:

- Baca `git status --short --branch` pada worktree target.
- Pastikan branch yang dikerjakan memang branch integrasi/produksi yang benar.
- Jangan menyentuh checkout lain yang sedang dipakai sesi lain tanpa memeriksa statusnya.
- `node_modules` per worktree dapat memakan waktu lama. Gunakan dependency yang sudah tersedia bila cocok.
- Pada API, `pnpm db:generate` pernah diwajibkan sebelum `tsc`.
- Postgres lokal/remote tidak selalu dapat dijangkau dari semua sesi.

## 4. Visi Produk

eBisnis adalah platform SaaS POS dan ERP multi-tenant yang melayani banyak jenis usaha. Produk tidak boleh berhenti pada kasir, tetapi mencakup penjualan, pembelian, persediaan, batch/expiry, piutang, hutang, kas/bank, akuntansi, laporan, sales lapangan, pelanggan, supplier, workflow, audit, integrasi, dan aplikasi offline/semi-online.

Model domain yang diminta:

- Domain induk vertikal menjelaskan produk untuk jenis usaha, misalnya `inventory.ebisnis.id` atau `salon.ebisnis.id`.
- Domain tenant menampilkan profil usaha tenant, bukan promosi generik eBisnis, misalnya `cmnmedika-inventory.ebisnis.id`.
- Aplikasi internal tenant tersedia pada host tenant yang sama, biasanya melalui `/masuk` dan `/app`.
- Navigasi, login, metadata, favicon, judul, Open Graph, dan link unduhan harus mempertahankan host dan brand tenant/modul.
- Header tidak boleh ganda ketika halaman tenant dirender di dalam layout publik lain.

## 5. Kontrak Routing dan Branding

### 5.1 Pola domain

Pola yang diinginkan:

- Produk vertikal: `{vertical}.ebisnis.id`
- Tenant vertikal: `{username-tenant}-{vertical}.ebisnis.id`
- Contoh: `inventory.ebisnis.id` dan `cmnmedika-inventory.ebisnis.id`
- Contoh: `salon.ebisnis.id` dan `{tenant}-salon.ebisnis.id`

### 5.2 Perilaku host

- Link kartu jenis usaha pada `ebisnis.id` harus menuju domain vertikal masing-masing, bukan sekadar anchor/path di parent domain.
- Semua link dalam domain tenant harus tetap pada domain tenant kecuali benar-benar menuju layanan eksternal.
- Tombol login/demo dari tenant harus kembali ke tenant/modul yang sama.
- `salon.ebisnis.id/app` dan `/masuk` tidak boleh mengarah ke `ebisnis.id` atau eCampus.
- Host tenant harus menampilkan nama perusahaan lengkap. Singkatan hanya untuk subdomain/schema bila diperlukan.
- Metadata WhatsApp/social preview harus dinamis per tenant dan per modul.

### 5.3 Alias dan ejaan

Pengguna pernah menulis `fasion` dan `laundy`. Rekomendasi implementasi:

- Canonical: `fashion.ebisnis.id` dan `laundry.ebisnis.id`.
- Sediakan alias/redirect permanen dari `fasion` dan `laundy` agar link lama tidak mati.
- Jangan membuat dua tenant/schema hanya karena alias ejaan.

## 6. Daftar Vertikal yang Diminta

Domain induk dan pola tenant perlu tersedia untuk:

- `inventory`
- `salon`
- `barbershop`
- `bengkelmotor`
- `bengkelmobil`
- `bengkelsepeda`
- `restoran`
- `cafe`
- `kuliner`
- `fashion`
- `toko` (toko kelontong)
- `warteg`
- `jasa`
- `tokopertanian`
- `olahanpertanian`
- `fitnes`
- `spa`
- `katering`
- `minimarket`
- `kosmetik`
- `kerajinan`
- `agribisnis`
- `laundry`
- `cucimobil`
- `cucimotor`
- `rentalkendaraan`
- `rentalsepeda`
- `apotik`, terhubung dengan ekosistem eMedik

Ide tambahan yang diminta untuk turut dipertimbangkan:

- toko bangunan
- elektronik dan servis elektronik
- bakery dan toko kue
- depot air minum
- agen LPG
- pet shop dan grooming
- optik
- percetakan
- fotografi
- event organizer
- coworking
- kursus dan bimbingan belajar
- daycare
- homestay dan penginapan
- travel dan ekspedisi
- furniture
- florist
- peternakan
- perikanan
- klinik kecantikan
- toko alat kesehatan

Setiap domain induk vertikal harus mempunyai landing page yang relevan dengan industrinya. Setiap domain tenant harus menampilkan profil, katalog/layanan, pengumuman, kontak, dan akses aplikasi tenant.

## 7. Landing Page dan Konten Publik

### 7.1 Landing page induk

**PERMINTAAN**:

- Menjelaskan manfaat produk secara umum untuk vertikal tersebut.
- Menggunakan gambar nyata/relevan yang dapat diganti admin/CMS.
- Responsif pada desktop dan mobile.
- Menyediakan CTA demo, login, dokumentasi, dan download bila ada aplikasi.
- `inventory.ebisnis.id` harus bersifat general untuk sales lapangan ke toko-toko, bukan khusus obat.

### 7.2 Landing page tenant

**PERMINTAAN**:

- Menampilkan company profile tenant.
- Katalog publik dapat dilihat tanpa login.
- Pemesanan web untuk CMN tidak dibuka bagi pengunjung anonim; transaksi dilakukan setelah login melalui aplikasi yang berhak.
- Admin tenant dapat mengubah hero image, profil, pengumuman, promo, katalog unggulan, dan informasi kontak.
- Jangan menampilkan data demo, kredensial demo, atau tombol pengisian akun otomatis pada tenant produksi.

### 7.3 Dokumen komersial

Untuk setiap demo/jenis usaha, pengguna pernah meminta link:

- Proposal Penawaran
- Surat Penawaran
- Presentasi
- Draft PKS

Verifikasi bahwa file benar-benar ada, dapat dibuka, dan sesuai brand vertikal.

## 8. Prioritas Utama: Sales dan Inventory

Sales/Inventory adalah produk khusus untuk penjualan lapangan dan distribusi. Domain induk `inventory.ebisnis.id` harus general, sementara tenant dapat memilih industri, termasuk obat.

Target platform:

- Web React
- Flutter Windows/Desktop
- Flutter Android
- Offline/semi-online dengan antrean sinkronisasi yang dapat diaudit

Fokus fungsi:

- Sales order lapangan
- Invoice penjualan
- Pembelian supplier
- Master produk, customer, supplier, sales, gudang, area, kategori, merek, satuan
- Persediaan, kartu stok, mutasi, transfer, stock opname, adjustment
- Batch dan expiry
- Harga umum, tunai/kredit, harga per pelanggan, harga dari supplier
- Piutang, penerimaan, aging, penagihan, nota dibawa sales
- Hutang supplier, pembayaran, aging
- Kas/bank, jurnal umum, chart of accounts, buku besar
- Laba rugi, laba kotor, laporan per sales/customer/supplier/produk
- PDF/Excel, audit trail, permission, dan bukti visual/UAT

## 9. Pelanggan Pertama: Caruban Medika Nusantara

### 9.1 Identitas

- Nama perusahaan wajib ditampilkan lengkap: **Caruban Medika Nusantara**.
- Domain: `cmnmedika-inventory.ebisnis.id`.
- Schema tenant: `cmnmedika_inventory`.
- Profil usaha: sales/distributor obat yang beroperasi di wilayah Cirebon dan sekitarnya.
- Landing page tenant adalah company profile dan katalog produk CMN, bukan landing page generik software inventory.

### 9.2 Akun

Akun yang diminta:

- Pemilik: Muklis, username `muklis`
- Sales: Masrukin, username `masrukin`
- Sales: Tohirin, username `tohirin`
- Sales: Nofal, username `nofal`
- Sales: Agung, username `agung`
- Admin: username `cmnmedika`

**RAHASIA**: kata sandi pernah diberikan di chat tetapi sengaja tidak disalin ke dokumen Git ini. Ambil dari kanal aman dan rotasi sebelum produksi.

### 9.3 Hak akses yang diharapkan

- Pemilik melihat dashboard usaha, omzet, laba, persediaan, piutang, hutang, kas/bank, dan performa semua sales.
- Menu pemilik harus ringkas dan relevan; jangan tampilkan seluruh menu platform tanpa kebutuhan.
- Sales melihat customer yang ditangani, produk/harga/stok, order baru, draft, sinkronisasi, aktivitas, penagihan, nota yang dibawa, dan laporan pribadi.
- Admin mengelola master, import, rekonsiliasi legacy, pengguna, permission, konfigurasi, dan audit.
- Pelanggan dapat masuk melalui aplikasi pelanggan untuk melihat katalog/harga yang berhak dan melakukan pemesanan.

**BUG yang pernah terlihat**: login sebagai Sales Agung menampilkan `Hak akses tidak mencukupi` pada dashboard, walaupun menu tersedia. Periksa permission API dan route guard, bukan hanya visibilitas menu.

### 9.4 Data legacy

Sumber data utama:

- `C:\Users\USER\Documents\5-Inventory--\5-Inventory\*`

Tujuan import:

- Tidak ada produk, customer, supplier, sales, pembelian, penjualan, harga, stok, batch/expiry, piutang, hutang, jurnal, atau histori penting yang tertinggal.
- Bootstrap harus idempotent: masukkan data hanya jika belum ada, lanjutkan/reconcile bila sebagian sudah masuk.
- Simpan data mentah legacy untuk audit dan rekonsiliasi.
- Petakan identitas lama ke entitas ERP modern tanpa menggandakan transaksi.

Data yang pernah disebut dari legacy:

- Sekitar 626 master barang
- Sekitar 334 customer
- Sekitar 101 supplier
- Sekitar 94.072 baris penjualan
- Sekitar 60.269 baris pembelian
- Sekitar 2.875 batch/expiry

Angka tersebut harus dihitung ulang dari file dan dibandingkan dengan schema tenant. Jangan memakai angka landing page sebagai bukti keberhasilan migrasi.

## 10. Sumber Analisis Legacy dan Paritas 48 Layar

Sumber lokal yang wajib dibaca penuh sebelum mengklaim paritas:

- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\DBF_Legacy_Schema_Inventory.csv`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\ERD_DAN_MAPPING_DBF_SALES_INVENTORY.md`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\ERD_Legacy_DBF_Inventory.mmd`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\ERD_Target_Modern_Sales_Inventory.dbml`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\ERD_Target_Modern_Sales_Inventory.mmd`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\LAPORAN_ANALISIS_APLIKASI_LEGACY_SALES_INVENTORY.md`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\MASTER_PROMPT_CLAUDE_CODEX_REDEVELOPMENT_SALES_INVENTORY.md`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\Matriks_Paritas_48_Layar.csv`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\README_PAKET_DOKUMENTASI_SALES_INVENTORY.txt`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\User_Manual_Sales_Inventory_Komprehensif.docx`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\User_Manual_Sales_Inventory_Komprehensif.pdf`
- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\Verifikasi_Jumlah_Kata_Per_Screenshot.csv`
- `C:\Users\USER\Downloads\PERINTAH_MASTER_CODEX_CLAUDE_IMPLEMENTASI_UI_EBISNIS_INVENTORY_48_LAYAR.md`
- `C:\Users\USER\Downloads\TRACKER_IMPLEMENTASI_UI_EBISNIS_INVENTORY_48_LAYAR.csv`
- `C:\Users\USER\Downloads\README_CARA_MENJALANKAN_PERINTAH_IMPLEMENTASI_UI_EBISNIS.txt`
- `C:\Users\USER\Downloads\Paket-Panduan-Transisi-48-Layar-v2-Paritas-Fungsional\Panduan-Transisi-48-Layar-eBisnis-Inventory-Sales-v2-Paritas-Fungsional.pdf`
- `C:\Users\USER\Downloads\Paket-Panduan-Transisi-48-Layar-v2-Paritas-Fungsional\Matriks-Paritas-Komponen-48-Layar-v2.csv`

Matriks paritas adalah sumber kebenaran. Setiap baris perlu mempunyai:

- route Web
- screen Flutter
- service/API
- tabel/migration
- permission
- audit event
- dukungan offline bila relevan
- test otomatis
- bukti visual desktop/mobile
- bukti UAT
- status implementasi yang jujur

Jangan menandai 100% hanya karena layar tersedia. Aksi simpan, posting, reversal, filter, ekspor, cetak, dan sinkronisasi harus bekerja.

## 11. Kelompok Fitur 48 Layar yang Harus Ditutup

### 11.1 Master data

- Supplier: daftar, detail, dokumen, kontak/alamat, payment term, rating, verifikasi, riwayat, audit.
- Customer: daftar, detail, limit kredit, payment term, harga khusus, dokumen, riwayat, audit.
- Sales: daftar, detail, area/rute, target/komisi, jadwal kunjungan, dokumen, audit.
- Produk: daftar, detail, gambar, harga/satuan, batch/expiry, gudang/stok, riwayat mutasi, audit.
- Gudang, rak, kategori, merek, satuan, chart of accounts.

### 11.2 Persediaan

- Ringkasan dan analitik inventory.
- Kartu stok per produk/gudang/batch.
- Mutasi masuk/keluar.
- Transfer gudang.
- Stock opname dengan sesi, scan, selisih, approval, posting adjustment, berita acara.
- Penyesuaian stok.
- Batch dan expiry, termasuk peringatan dan tindakan transfer/diskon/write-off.
- Reorder point, fast/slow/dead moving.

### 11.3 Pembelian dan hutang

- Transaksi pembelian supplier, item, batch, expiry, diskon, pajak, ongkir, lampiran.
- Draft, posting, reversal, audit.
- Riwayat pembelian supplier.
- Retur pembelian.
- Hutang supplier, aging, pembayaran sebagian/penuh, voucher, ledger.
- Analitik dan kinerja supplier.

### 11.4 Penjualan, customer, dan piutang

- Sales order lapangan dengan pemilihan customer, pencarian produk, stok, harga, diskon, pajak, termin, catatan, draft, kirim, sinkronisasi.
- Sales invoice, retur/koreksi, cetak/bagi PDF.
- Riwayat penjualan customer.
- Ledger dan aging piutang.
- Penerimaan pembayaran customer.
- Nota dibawa sales, serah-terima, pengembalian, dan setoran.
- Analitik dan kinerja customer.

### 11.5 Sales lapangan

- Master dan detail sales.
- Aktivitas/kunjungan customer.
- Target, pencapaian, conversion rate, collection success, area, tim, supervisor.
- Customer yang ditangani dan produk yang sering dijual.
- Penagihan lapangan dan setoran.
- Laporan per sales dan dashboard pemilik.

### 11.6 Keuangan dan laporan

- Kas/bank.
- Jurnal umum berimbang.
- Chart of accounts dan buku besar.
- Piutang/hutang.
- Laba kotor dan laba rugi.
- Laporan stok, kartu stok, pembelian, penjualan, customer, supplier, sales, aging, kas.
- PDF, Excel, cetak, template laporan, audit trail.
- Tutup periode dilakukan dengan workflow modern, backup, approval, dan audit; jangan meniru penghapusan transaksi legacy.

## 12. Rujukan UI yang Diberikan Pengguna

Pengguna memberikan banyak mockup modern pada 6 Agustus 2026. File utama berada di `C:\Users\USER\Downloads` dengan pola nama berikut:

- `ChatGPT Image Aug 6, 2026, 06_27_*.png`
- `ChatGPT Image Aug 6, 2026, 07_48_*.png`
- `ChatGPT Image Aug 6, 2026, 02_37_*.png`
- `ChatGPT Image Aug 6, 2026, 02_45_*.png`
- `ChatGPT Image Aug 6, 2026, 02_55_*.png`
- `ChatGPT Image Aug 6, 2026, 03_03_*.png`
- `ChatGPT Image Aug 6, 2026, 05_48_*.png`

Mockup mencakup:

- Dashboard inventory
- Sales order
- Transaksi pembelian
- Master/detail/riwayat/ledger/analitik supplier
- Master/detail/riwayat/ledger/analitik customer
- Master/detail/aktivitas/analitik sales
- Master/detail produk
- Kartu stok, batch/expiry, stock opname, dan analitik inventory
- Piutang, hutang, kas/bank, jurnal umum, dan reports & analytics

Pedoman implementasi:

- Ambil struktur informasi dan ergonomi dari mockup, bukan menyalin data contoh secara literal.
- Gunakan data tenant dan permission nyata.
- Desktop: sidebar stabil, toolbar ringkas, tabel padat, panel detail, filter, metrik, dan aksi utama jelas.
- Mobile: navigasi ringkas, daftar menjadi kartu atau tabel responsif, aksi utama tetap mudah dijangkau.
- Hindari header, judul, dan deskripsi ganda. Bug ini pernah terlihat pada Sales Order Flutter.
- Search box produk harus benar-benar memfilter data dan mendukung SKU/barcode/nama.
- Jangan menampilkan panel demo/kredensial pada tenant produksi.
- Uji overflow, resolusi kecil, dan densitas Windows.

## 13. Produk dan Gambar Katalog

**PERMINTAAN** untuk CMN:

- Katalog produk jauh lebih banyak dan dapat dicari.
- Produk yang umum di pasar dapat menggunakan gambar yang sah dan relevan.
- Gambar tampil di web, EXE, dan APK.
- Admin dapat mengganti gambar manual.
- Produk sejenis lintas tenant dapat memakai aset gambar bersama berdasarkan identitas produk, tetapi tenant tetap dapat override.

Rekomendasi arsitektur:

- Jangan menyimpan BLOB duplikat di setiap schema tenant.
- Sediakan katalog aset produk global dengan checksum/content hash dan metadata lisensi/sumber.
- Cocokkan berdasarkan barcode yang tervalidasi; fallback SKU/nama ternormalisasi memerlukan review karena berisiko salah.
- Tenant product menyimpan referensi aset global serta optional override.
- Sajikan file melalui endpoint/CDN dengan cache headers; BLOB database tetap dapat menjadi source of truth bila memang diwajibkan.
- Jangan mengambil gambar internet secara massal tanpa memeriksa hak penggunaan dan akurasi kemasan.

## 14. Flutter Windows dan Android

### 14.1 Harapan produk

- Satu codebase Flutter dengan perilaku adaptif desktop/mobile bila memungkinkan.
- Role Pemilik, Admin, Sales, dan Pelanggan harus masuk ke pengalaman yang sesuai.
- Windows dan Android menggunakan API tenant yang sama dan menjaga host tenant.
- Sales dapat bekerja semi-online/offline dan melakukan sinkronisasi dengan antrean, retry, idempotency, dan conflict handling.
- Login produksi tidak menampilkan shortcut persona atau kata sandi contoh.

### 14.2 Build dan release

Artifact yang diminta:

- Installer Windows `.exe`
- Android `.apk`
- Manifest update/version/checksum
- Unduhan dari server seperti `https://ebisnis.id/update/*` atau host tenant
- Auto-update aplikasi tanpa membuka source private

**BUG yang pernah terjadi**:

- Endpoint update mengembalikan `NOT_FOUND` karena file belum ada.
- Asset inventory pada GitHub Release pernah berisi build Salon, walaupun nama file inventory.
- Download pertama pernah menampilkan response error lama, lalu refresh baru mengunduh file; periksa cache/proxy dan atomic deployment.

Solusi yang perlu dipastikan:

- Pipeline build harus menerima product flavor eksplisit dan melakukan smoke test isi aplikasi sebelum upload.
- Nama file, package id, app title, flavor, endpoint, dan checksum harus saling konsisten.
- Upload ke staging filename, verifikasi checksum, lalu rename/move atomik ke nama publik.
- Endpoint update harus memberi cache-control yang benar dan tidak menyimpan 404 lama.
- Repo boleh tetap private; binary dapat disimpan di server update atau private release yang disalin ke server oleh deploy token.
- Jangan membundel GitHub token ke aplikasi klien.

## 15. User Manual

Pengguna meminta user manual baru dalam Word dan PDF untuk Web, Flutter Windows, dan Android:

- End-to-end, bahasa formal tetapi mudah dipahami pengguna non-IT.
- Membandingkan setiap layar lama dengan layar baru yang sepadan.
- Dilengkapi screenshot/ilustrasi layar baru.
- Pengguna meminta minimal sekitar 1.500 kata penjelasan per screenshot/ilustrasi.
- Manual harus dapat dibaca publik dari landing page/modul inventory.
- Dokumen harus menjelaskan peran Pemilik, Admin, Sales, dan Pelanggan.

**PERLU VERIFIKASI**: periksa apakah DOCX/PDF baru benar-benar sudah dibuat, dirender, diuji link-nya, dan dipublikasikan. Jangan menganggap manual lama sebagai manual sistem baru.

## 16. POS Web dan POS Flutter

Permintaan sebelumnya yang masih relevan:

- Semua menu aktif; halaman `Coming Soon` harus diganti implementasi nyata.
- Riwayat pembayaran/summary mengikuti praktik baik dari `C:\opt\AIS\ais\desktop-pos-electron`.
- Setelah transaksi selesai, jangan auto-print. Tampilkan layar sukses dengan aksi Cetak Struk, Buka Laci, dan Transaksi Baru.
- Struk dapat dicetak kemudian dan dapat masuk ke akun/aplikasi pelanggan.
- Produk mendukung upload/download, termasuk format Accurate berdasarkan contoh spreadsheet yang pernah diberikan.
- Demo memiliki data cukup realistis, umumnya 50-1.000 baris per area; jangan memalsukan transaksi produksi.
- Dashboard POS dan inventory harus kaya informasi tetapi tetap terbaca.

## 17. Portal Pelanggan

Konsep yang diminta:

- Portal pelanggan tenant, misalnya pola `pelanggan-{tenant}.ebisnis.id` pada fase awal, atau pengalaman pelanggan terintegrasi ke domain tenant vertikal.
- Pelanggan mendaftar sebagai anggota, menerima struk digital, melihat riwayat, promo, dan pengumuman.
- Admin toko mengelola pengumuman/promo dan konten website.
- APK pelanggan Android tersedia; iOS dapat menyusul.
- Inspirasi fitur pernah diminta dari Ponta/loyalty retail, tetapi implementasi harus mematuhi privasi dan tidak meniru merek/desain secara ilegal.

## 18. Data Demo

Permintaan umum:

- Setiap modul demo mempunyai minimal 50 dan maksimal 1.000 contoh data yang relevan.
- Untuk salon pernah diminta minimal 100 produk/layanan dan 1.000 transaksi yang selalu up-to-date saat deploy.
- Dashboard demo menampilkan omzet, laba, transaksi, tren, radar/spider chart, produk, inventori, pelanggan, promo, dan operasional.
- Data demo harus jelas terpisah dari tenant produksi dan tidak mengotori CMN.
- Seed harus deterministik/idempotent agar tidak menambah duplikasi setiap deploy.

## 19. Masalah Deploy dan Migration yang Pernah Terjadi

### 19.1 BOM pada manifest JSON

Error:

```text
SyntaxError: Unexpected token '﻿', "﻿{ ..." is not valid JSON
```

Lokasi yang disebut:

`apps/api/tenant-migrations/manifest.json`

Pelajaran:

- Simpan JSON UTF-8 tanpa BOM.
- Parser migration sebaiknya defensif terhadap BOM, tetapi source tetap dibersihkan.
- Tambahkan test pembacaan manifest.

### 19.2 Constraint vertical code

Error Postgres `23514` pada `ck_tenant_vertical_code` ketika membuat tenant dengan `vertical_code = inventory`.

Pelajaran:

- Migration platform untuk kosakata vertical harus diterapkan sebelum onboarding tenant.
- Seed/onboarding tidak boleh lebih dulu daripada constraint update.

### 19.3 Urutan migration V043

Error:

```text
Menu POS belum ada; V043 menuntut seed POS lebih dahulu.
```

Pelajaran:

- Migration tenant harus mandiri atau memiliki dependency eksplisit.
- Inventory tenant tidak boleh dipaksa mempunyai seed POS yang tidak relevan tanpa bootstrap yang tepat.

### 19.4 Kosakata permission H037 dan H040

Error yang pernah muncul:

```text
Aksi RELEASE tidak ada pada kosakata hak akses tenant ini.
```

dan:

```text
HEALTH_INVESTOR_DISTRIBUTION.POST
HEALTH_INVESTOR_DISTRIBUTION.CANCEL
```

Pelajaran:

- Permission action vocabulary harus disemai sebelum migration yang mereferensikannya.
- Tambahkan preflight yang melaporkan seluruh action hilang sekaligus.
- Uji migration pada schema lama, schema baru, dan tenant vertikal non-POS.

### 19.5 Import DBF dan Unicode

Error:

```text
unsupported Unicode escape sequence
```

Lokasi yang disebut:

`apps/api/src/cli/onboard-cmn-inventory.cli.ts`

Pelajaran:

- Jangan memasukkan raw control character/invalid backslash escape ke PostgreSQL JSON/text literal.
- Gunakan parameterized query dan buffer/encoding conversion yang benar.
- Simpan raw payload sebagai bytea atau representasi aman dengan checksum bila perlu.
- Test dengan data DBF nyata yang memicu error.

### 19.6 Apache dan deploy update

Peringatan yang pernah terlihat:

- `POS_RELEASE_GITHUB_TOKEN` belum ada.
- `DocumentRoot [/var/www/html/ospos] does not exist`.
- `DocumentRoot [/opt/website/ebisnis] does not exist`.
- `ServerName` global belum ditetapkan.
- `MaxRequestWorkers` melebihi `ServerLimit`.

Perintah deploy yang diharapkan:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Pengguna ingin perubahan eMedik dan eBisnis terintegrasi ke branch produksi sehingga deploy normal tidak perlu argumen branch.

Commit merge yang pernah disebut oleh sesi lain:

```text
f7411c1 merge: integrate eMedik V12 into main
```

**PERLU VERIFIKASI**: commit/branch produksi sudah bergerak jauh setelah itu. Jangan berasumsi SHA tersebut masih HEAD.

## 20. Routing Salon dan eMedik

Masalah yang pernah terjadi:

- `salon.ebisnis.id` masuk ke eCampus.
- `/app` atau `/masuk` kembali ke `ebisnis.id`.
- Brand login/footer tetap eBisnis, bukan Salon.
- Tombol demo/login tidak mempertahankan host.

Hal yang harus diuji:

- Apache wildcard vhost dan urutan vhost.
- Cloudflare wildcard DNS/proxy.
- Host parsing di frontend dan API.
- Base URL/auth redirect/cookie domain.
- SPA fallback untuk seluruh route tenant.
- Branding dan metadata setelah navigasi client-side.

Domain eMedik yang pernah disebut:

- `emedik.id`
- `{tenant}.emedik.id`
- `apotik.emedik.id`
- `{tenant}-apotik.emedik.id`

Jaga agar domain eMedik tidak tertimpa aturan wildcard eBisnis.

## 21. Jebakan Teknis dari Sesi Sebelumnya

Beberapa cacat pernah lolos `tsc`, ESLint, dan unit test:

1. Dua request `/auth/refresh` serentak dapat mencabut seluruh sesi.
2. Import yang diletakkan di bawah kelas controller membuat server gagal menyala.
3. Karakter kontrol literal di source test menyebabkan perilaku parser/build bermasalah.
4. Kesimpulan dari `grep` tanpa membaca alur lengkap menghasilkan peta fitur yang keliru.
5. Asset release dapat bernama benar tetapi berisi flavor aplikasi yang salah.
6. Menu yang terlihat tidak membuktikan API permission benar.
7. Landing page yang menampilkan angka legacy tidak membuktikan import berhasil.

Lakukan smoke test runtime, bukan hanya static check.

## 22. Hal yang Jangan Dilakukan

- Jangan mengklaim seluruh 48 layar selesai tanpa bukti per baris matriks.
- Jangan memasukkan kata sandi/token ke source, dokumentasi Git, binary, atau frontend.
- Jangan menampilkan akun demo di tenant produksi.
- Jangan menghapus transaksi lama pada proses tutup periode.
- Jangan menaruh seluruh menu ERP pada role Pemilik/Sales tanpa relevansi.
- Jangan membuat routing tenant kembali ke parent domain.
- Jangan menyimpan duplikat gambar produk per tenant tanpa deduplikasi.
- Jangan memakai scraping gambar produk tanpa lisensi/provenance.
- Jangan mengubah schema produksi tanpa migration additive, backup, dan rollback plan.
- Jangan menghapus atau menimpa perubahan worktree lain.

## 23. Prioritas Kerja Berikutnya untuk Claude

### P0 - Kebenaran source dan deploy

1. Audit seluruh worktree, branch, status, upstream, dan commit terbaru.
2. Tentukan branch integrasi yang benar dan bandingkan perubahan `inventory48`, `customer48`, `cmn-async-import`, `deploy-cmn`, `pos`, dan `ecosystem`.
3. Buat matriks fitur source aktual terhadap matriks 48 layar.
4. Jalankan build/test minimum untuk API, Web, dan Flutter sebelum mengedit.
5. Jangan merge otomatis worktree diverged tanpa memahami commit unik.

### P0 - Caruban Medika Nusantara

1. Pastikan tenant platform tercatat sebagai pendaftar dan tenant READY.
2. Pastikan schema `cmnmedika_inventory` sehat dan migration mutakhir.
3. Perbaiki import DBF Unicode dengan parameterized query dan test fixture.
4. Jalankan import idempotent dan hasilkan laporan rekonsiliasi per tabel/file.
5. Pastikan keenam akun ada, role benar, dan login Web/Windows/Android berhasil.
6. Perbaiki akses Sales Agung dan uji semua sales.
7. Pastikan dashboard pemilik memakai data nyata, termasuk laporan per sales.

### P0 - Artifact aplikasi

1. Pisahkan flavor Salon, POS, Inventory Sales, dan Pelanggan.
2. Rebuild `.exe` dan `.apk` Inventory dari source/branch yang benar.
3. Jalankan smoke test yang memastikan judul, brand, endpoint, dan layar login adalah Inventory.
4. Publikasikan artifact secara atomik beserta version, checksum, dan manifest.
5. Uji download pertama tanpa refresh dan uji auto-update dari versi sebelumnya.

### P1 - Paritas operasional

1. Selesaikan Sales Order, Purchase, Product/Inventory, Supplier, Customer, dan Sales sesuai mockup.
2. Hubungkan semua form ke API nyata, permission, audit, dan offline queue.
3. Selesaikan piutang/hutang, nota sales, kas/bank, jurnal, dan laporan.
4. Uji PDF/Excel dan cetak.
5. Ambil screenshot desktop/mobile dan isi tracker UAT.

### P1 - Routing dan landing page

1. Buat registry vertikal tunggal untuk hostname, label, gambar, CTA, metadata, dan feature flags.
2. Pastikan kartu jenis usaha menuju domain vertikal.
3. Pastikan tenant host menampilkan profil tenant dan satu header.
4. Uji alias `fashion/fasion` dan `laundry/laundy`.
5. Uji salon, inventory, dan eMedik sebagai sampel sebelum memperluas semua host.

### P2 - Konten dan dokumentasi

1. Lengkapi katalog CMN dengan pencarian dan aset produk terdeduplikasi.
2. Publikasikan manual baru DOCX/PDF dan versi web.
3. Lengkapi proposal, surat, presentasi, dan PKS per vertikal.
4. Tambahkan data demo realistis secara idempotent dan terisolasi.

## 24. Definition of Done

Sebuah area hanya boleh disebut selesai bila:

- Migration additive berhasil pada schema baru dan schema lama.
- Seed/bootstrap idempotent.
- API tervalidasi dan permission sesuai role.
- Web desktop/mobile bekerja.
- Flutter Windows/Android bekerja untuk fitur yang dijanjikan.
- Offline/sync diuji untuk alur lapangan.
- Audit event tercatat.
- PDF/Excel/cetak diuji bila relevan.
- Unit/integration/widget/e2e test lulus sesuai risiko.
- Screenshot visual diverifikasi tanpa overflow, duplikasi header, atau blank state salah.
- Artifact memiliki flavor, versi, checksum, dan isi yang benar.
- Deploy dari `update.sh` berhasil pada branch produksi.
- CMN tidak kehilangan satu pun data legacy yang berada dalam cakupan mapping.
- Tracker 48 layar mempunyai bukti dan status yang dapat diaudit.

## 25. Pemeriksaan Awal yang Disarankan

Mulai dari perintah read-only:

```powershell
git -C C:\opt\eBisnisGithub-ecosystem status --short --branch
git -C C:\opt\eBisnisGithub-ecosystem log -10 --oneline --decorate
git -C C:\opt\eBisnisGithub-inventory48 status --short --branch
git -C C:\opt\eBisnisGithub-customer48 status --short --branch
git -C C:\opt\eBisnisGithub-cmn-async-import status --short --branch
git -C C:\opt\eBisnisGithub-deploy-cmn status --short --branch
git -C C:\opt\eBisnisGithub-pos status --short --branch
```

Kemudian baca dokumen dan tracker secara penuh, cari implementasi yang sudah ada, dan baru buat rencana merge/implementasi berdasarkan bukti aktual.

## 26. Pertanyaan yang Harus Dijawab dari Source, Bukan Ditanyakan Ulang

Claude diharapkan mencari jawabannya langsung:

- Branch mana yang paling mutakhir untuk tiap area?
- Berapa baris matriks 48 layar yang benar-benar lengkap?
- Tabel legacy mana yang belum terimpor?
- Permission apa yang kurang untuk role Sales dan Pemilik?
- Flavor apa yang menghasilkan release inventory saat ini?
- Endpoint update mana yang aktif dan apakah cache/proxy benar?
- Apakah landing page vertikal/tenant memakai registry atau hard-code?
- Apakah gambar produk sudah mempunyai model global + override tenant?
- Apakah manual baru sudah ada dan dipublikasikan?

Jika jawaban tidak dapat dibuktikan dari source/test/log, tandai sebagai belum selesai.

## 27. Referensi Handoff Sebelumnya

Handoff sebelumnya yang menjadi pola:

- `docs/pos-web-priority/17-serah-terima-codex-2026-08-03.md`

Dokumen ini melanjutkan pola tersebut, tetapi cakupannya lebih luas: seluruh ekosistem eBisnis, dengan prioritas Sales/Inventory dan tenant produksi Caruban Medika Nusantara.
