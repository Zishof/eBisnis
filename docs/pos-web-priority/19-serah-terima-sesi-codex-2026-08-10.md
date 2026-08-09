# Serah Terima Sesi Codex - Ekosistem eBisnis dan Inventory/Sales

Tanggal: 10 Agustus 2026

Repo kerja sesi ini: `C:\opt\eBisnisGithub-ecosystem`

## 1. Tujuan dokumen

Dokumen ini merangkum konteks, keputusan, permintaan, masalah deploy, dan pekerjaan yang masih harus diverifikasi dari rangkaian sesi pengembangan eBisnis. Dokumen ini sengaja membedakan:

- kebutuhan yang diminta pengguna;
- hasil yang pernah dilaporkan atau terlihat pada tangkapan layar;
- cacat yang sudah ditemukan;
- pekerjaan yang masih terbuka atau belum terbukti selesai.

Jangan menganggap daftar permintaan sebagai bukti implementasi. Penerus harus memeriksa source, migration, test, artefak rilis, dan kondisi produksi sebelum menyatakan suatu fitur selesai.

## 2. Repo dan worktree

Beberapa worktree berbagi satu repository Git. Jangan menghapus, mereset, atau menimpa perubahan dari worktree lain.

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

Serah-terima POS terdahulu ada di:

- `docs/pos-web-priority/17-serah-terima-codex-2026-08-03.md`

Sebelum bekerja di komputer baru:

1. Jalankan `git worktree list` dari clone utama.
2. Periksa `git status --short --branch` pada worktree yang akan dipakai.
3. Jangan menjalankan `git reset --hard` atau `git checkout --` pada perubahan yang bukan milik sesi sendiri.
4. Gunakan branch/worktree yang sesuai dengan modul, kemudian rebase atau merge hanya setelah memahami perubahan paralel.

## 3. Produk dan arsitektur yang diminta

eBisnis diarahkan menjadi platform multi-tenant dan multi-vertical dengan satu core ERP/POS, tetapi pengalaman publik, menu, hak akses, metadata, data, dan aplikasi harus mengikuti tenant serta jenis usahanya.

Pola domain yang dikehendaki:

- domain induk vertical: `{vertical}.ebisnis.id`;
- domain tenant vertical: `{username-tenant}-{vertical}.ebisnis.id`;
- domain induk menampilkan produk/platform untuk vertical tersebut;
- domain tenant menampilkan profil dan katalog usaha tenant, bukan landing page penjualan software;
- seluruh tautan internal, login, metadata, favicon, Open Graph, dan brand harus tetap pada domain tenant/vertical yang sedang dibuka.

Vertical yang berulang kali diminta mencakup:

- inventory dan sales lapangan;
- salon;
- barbershop;
- bengkel motor, mobil, dan sepeda;
- restoran, cafe, kuliner, warteg, katering;
- fashion/fasion, kosmetik, spa, fitness/fitnes;
- toko kelontong dan minimarket;
- jasa umum;
- toko pertanian, olahan pertanian, agribisnis;
- kerajinan;
- laundry/laundy;
- cuci mobil dan cuci motor;
- rental kendaraan dan rental sepeda;
- apotek dan integrasi eMedik;
- vertical umum lain yang relevan dengan UMKM.

Alias salah eja yang sudah terlanjur disebut seperti `fasion`, `laundy`, dan `fitnes` perlu diputuskan secara eksplisit: dukung sebagai redirect ke ejaan baku atau pertahankan sebagai alias DNS, tetapi jangan menghasilkan pengalaman yang berbeda.

## 4. Prinsip UI/UX lintas platform

Permintaan utama UI/UX:

- tenang, modern, padat, mudah dipindai, dan cocok untuk pekerjaan operasional berulang;
- responsif pada desktop, tablet, dan telepon;
- parity perilaku antara Web React, Flutter Windows, dan Flutter Android;
- navigasi dan hak akses mengikuti persona;
- gambar relevan untuk setiap vertical dan dapat diganti admin tenant;
- tidak ada header ganda, judul ganda, tautan bocor ke parent domain, atau tampilan demo pada tenant produksi;
- tabel desktop memiliki filter, pencarian, pagination, ekspor, aksi baris, status, dan detail;
- mobile menggunakan list/card yang ringkas, bottom navigation, aksi utama yang mudah dijangkau, dan alur offline yang jelas;
- semua operasi penting memiliki loading, empty, error, retry, offline, conflict, dan success state.

Referensi mockup yang diberikan pengguna meliputi dashboard, Sales Order, pembelian, supplier, customer, sales, produk, kartu stok, stock opname, piutang, hutang, jurnal, laporan, dan analytics. Mockup adalah target pengalaman, bukan bukti bahwa seluruhnya sudah diimplementasikan.

## 5. Caruban Medika Nusantara

Klien pertama yang harus diprioritaskan:

- nama lengkap: **Caruban Medika Nusantara**;
- domain: `https://cmnmedika-inventory.ebisnis.id`;
- schema tenant yang diminta: `cmnmedika_inventory`;
- domain hanya boleh menyingkat nama, sedangkan UI harus memakai nama lengkap perusahaan;
- landing page tenant harus berupa profil distributor/sales yang melayani Cirebon dan sekitarnya;
- katalog web bersifat display publik; pemesanan dilakukan setelah login melalui aplikasi yang diizinkan;
- tenant harus muncul pada daftar Tenant dan Pendaftar platform.

Persona dan username yang diminta:

- Pemilik: Muklis, username `muklis`;
- Sales: Masrukin, username `masrukin`;
- Sales: Tohirin, username `tohirin`;
- Sales: Nofal, username `nofal`;
- Sales: Agung, username `agung`;
- Admin: username `cmnmedika`.

Kata sandi sengaja tidak disalin ke dokumen Git. Ambil credential dari secret manager, deployment secret, atau lakukan reset terkontrol. Jangan menaruh password produksi pada source, seed yang dapat dibaca publik, halaman login, manual, atau tangkapan layar.

Hak akses yang diharapkan:

- pemilik melihat dashboard ringkas tetapi komprehensif, laba, arus kas, piutang, hutang, stok, peringkat dan laporan per sales;
- sales melihat customer/area yang ditugaskan, katalog dan stok yang boleh dijual, Sales Order, kunjungan, penagihan, nota dibawa, target, komisi, dan laporan pribadi;
- admin mengelola master, import/reconciliation, pengguna, mapping legacy, konfigurasi, dan audit;
- pelanggan dapat melihat katalog dan melakukan order melalui kanal aplikasi yang diizinkan;
- menu dihasilkan dari permission, bukan hanya disembunyikan secara visual.

## 6. Sumber dan target migrasi data CMN

Sumber legacy utama:

- `C:\Users\USER\Documents\5-Inventory--\5-Inventory\*`

Paket dokumentasi analisis:

- `C:\Users\USER\Downloads\Paket_Dokumentasi_Sales_Inventory\`

Dokumen penting di dalam paket tersebut:

- `DBF_Legacy_Schema_Inventory.csv`
- `ERD_DAN_MAPPING_DBF_SALES_INVENTORY.md`
- `ERD_Legacy_DBF_Inventory.mmd`
- `ERD_Target_Modern_Sales_Inventory.dbml`
- `ERD_Target_Modern_Sales_Inventory.mmd`
- `LAPORAN_ANALISIS_APLIKASI_LEGACY_SALES_INVENTORY.md`
- `MASTER_PROMPT_CLAUDE_CODEX_REDEVELOPMENT_SALES_INVENTORY.md`
- `Matriks_Paritas_48_Layar.csv`
- `User_Manual_Sales_Inventory_Komprehensif.docx`
- `User_Manual_Sales_Inventory_Komprehensif.pdf`
- `Verifikasi_Jumlah_Kata_Per_Screenshot.csv`

Jumlah legacy yang pernah ditampilkan sebagai target rekonsiliasi:

- 626 master barang;
- 334 customer;
- 101 supplier;
- 94.072 baris penjualan;
- 60.269 baris pembelian;
- 2.875 batch/expiry.

Angka tersebut harus diverifikasi terhadap DBF mentah dan hasil import di schema tenant. Jangan menyatakan migrasi lengkap hanya karena landing page menampilkan angka tersebut.

Aturan bootstrap:

- idempotent: data yang sudah masuk tidak diduplikasi;
- raw vault mempertahankan sumber dan checksum;
- mapping menyimpan asal file, record, field, transform, dan status;
- transaksi, pembayaran, retur, batch, stok, harga, piutang, hutang, dan jurnal harus dapat direkonsiliasi;
- data invalid masuk exception queue, bukan dibuang diam-diam;
- hasil import menyajikan count sumber, count target, duplikat, ditolak, dan selisih nilai uang.

## 7. Paritas aplikasi legacy 48 layar

Instruksi implementasi 48 layar ada di:

- `C:\Users\USER\Downloads\PERINTAH_MASTER_CODEX_CLAUDE_IMPLEMENTASI_UI_EBISNIS_INVENTORY_48_LAYAR.md`
- `C:\Users\USER\Downloads\TRACKER_IMPLEMENTASI_UI_EBISNIS_INVENTORY_48_LAYAR.csv`
- `C:\Users\USER\Downloads\Paket-Panduan-Transisi-48-Layar-v2-Paritas-Fungsional\Panduan-Transisi-48-Layar-eBisnis-Inventory-Sales-v2-Paritas-Fungsional.pdf`
- `C:\Users\USER\Downloads\Paket-Panduan-Transisi-48-Layar-v2-Paritas-Fungsional\Matriks-Paritas-Komponen-48-Layar-v2.csv`

Paritas tidak cukup berupa route, mockup, atau tabel statis. Setiap layar harus ditelusuri end-to-end melalui:

- migration additive;
- model dan constraint database;
- service/domain rule;
- API dan validasi;
- permission dan segregasi tugas;
- audit trail;
- Web React;
- Flutter Windows dan Android;
- mode offline, antrean, retry, conflict resolution, dan sinkronisasi;
- PDF/Excel/print;
- automated test;
- visual evidence;
- UAT evidence;
- changelog.

Kelompok fungsi legacy yang wajib dicocokkan:

- supplier dan ledger supplier;
- customer dan ledger customer;
- sales, area, route, kunjungan, target, komisi, dan performa;
- master produk, satuan, kategori, merek, barcode, harga beli/jual, dan harga khusus;
- pembelian, penerimaan, retur, hutang, dan pembayaran hutang;
- Sales Order, invoice, pengiriman, retur, piutang, penerimaan, serta nota dibawa sales;
- stok per gudang, kartu stok, mutasi, transfer, stock opname, adjustment, batch, dan expiry;
- kas, bank, chart of accounts, jurnal umum, buku besar, laba rugi, dan tutup periode;
- laporan detail/ringkas, filter periode, PDF, Excel, print, dan audit.

Status 100 persen belum boleh dinyatakan tanpa evidence per baris matriks.

## 8. Masalah aplikasi Flutter Inventory/Sales yang terakhir terlihat

Masalah konkret dari tangkapan layar terakhir:

1. Login sebagai sales `agung` membuka Dashboard tetapi API menampilkan `Hak akses tidak mencukupi`.
2. Halaman Sales Order menampilkan judul dan subjudul dua kali.
3. Pencarian customer/produk perlu dipastikan jelas, konsisten, dan benar-benar memfilter data server/lokal.
4. Release bernama inventory pernah berisi build Salon Cantik Demo. Pipeline flavour/entrypoint/artefak tidak terisolasi dengan benar.
5. Menu sales terlihat, tetapi permission backend tidak konsisten dengan akses menu.

Perbaikan yang harus diverifikasi:

- satu sumber konfigurasi flavour untuk app name, tenant mode, API base URL, update channel, ikon, dan entrypoint;
- build inventory tidak boleh mengimpor entrypoint, credential demo, atau asset khusus salon;
- smoke test artefak hasil build wajib membaca metadata produk dan membuka layar login inventory;
- role Sales mendapat API minimal yang dibutuhkan dashboard dan Sales Order, tetap dibatasi pada data miliknya;
- route guard, menu permission, dan authorization backend menggunakan permission contract yang sama;
- halaman Sales Order hanya memiliki satu page header;
- pencarian memiliki debounce, empty state, scanner/barcode, dan hasil yang dapat dipilih dengan keyboard/touch.

## 9. Target UI Inventory/Sales

Mockup terbaru menunjukkan target berikut.

### Dashboard

- KPI penjualan, pembelian, piutang, hutang, nilai persediaan, stok menipis, laba kotor, dan kas/bank;
- tren penjualan dan pembelian;
- produk terlaris;
- aging piutang;
- peringatan stok;
- transaksi terbaru;
- aktivitas audit;
- filter dashboard dan quick create;
- versi mobile berisi KPI utama dan navigasi ringkas.

### Sales Order dan pembelian

- wizard empat tahap;
- pemilihan customer/supplier dengan profil dan limit/saldo;
- pencarian produk, barcode, filter kategori, favorite, promo, dan rekomendasi;
- item editable, qty, satuan, batch, expiry, harga, diskon, pajak, stok, dan subtotal;
- ringkasan sticky;
- draft, sync, submit/post, reversal, attachment, print, PDF, dan audit;
- layout mobile menggunakan tahapan yang sama dengan kontrol yang sesuai layar sempit.

### Supplier, customer, sales

- master list dengan KPI, filter, import/export, audit, status, pagination, dan bulk action;
- detail dengan informasi umum, dokumen, alamat/kontak, aturan transaksi, verification, recent activity, dan audit;
- riwayat transaksi, ledger, aging, pembayaran, retur, produk dominan, dan analytics;
- sales mencakup area/rute, target/komisi, jadwal kunjungan, aktivitas, collection, nota dibawa, dan ranking.

### Produk dan persediaan

- master produk lengkap dengan gambar, barcode, SKU, kategori, merek, satuan, gudang, HPP, harga, pajak, status, minimum/reorder, batch/expiry;
- detail produk dan dokumen;
- stock card lintas gudang dan batch;
- stock opname dengan scan dan workflow draft-count-submit-approve-post;
- analytics nilai stok, turnover, fast/slow/dead stock, expiry, reorder, dan nilai per gudang.

### Keuangan dan laporan

- jurnal umum debit/kredit seimbang;
- chart of accounts dan buku besar;
- penerimaan/pembayaran terhubung invoice;
- laporan laba rugi, arus kas, pembelian, penjualan, stok, hutang, piutang, supplier, customer, dan sales;
- drill-down, template, schedule, print, PDF, dan Excel.

## 10. Produk, gambar, dan katalog

Permintaan katalog CMN:

- menampilkan lebih banyak produk nyata dari hasil import;
- memiliki pencarian dan filter;
- menampilkan foto yang relevan;
- Web publik hanya katalog, sedangkan order mengikuti login/kanal yang diizinkan;
- foto dapat diganti admin tenant;
- Flutter Windows/Android langsung menampilkan foto saat tersedia.

Desain penyimpanan yang diinginkan:

- media canonical dapat digunakan lintas tenant untuk produk identik;
- pencocokan utama melalui barcode valid, kemudian kode/identitas produk terkurasi;
- tenant dapat memiliki override sendiri;
- simpan hash, MIME type, ukuran, sumber/lisensi, attribution bila perlu, dan audit;
- jangan mengunduh atau menyalin gambar internet tanpa memastikan hak penggunaan;
- pertimbangkan object storage dan referensi immutable dibanding BLOB besar di setiap schema tenant;
- jika BLOB dipilih, deduplikasi tetap dilakukan pada media registry platform, bukan menyalin bytes ke setiap tenant.

## 11. POS umum dan Flutter POS

Permintaan POS yang masih relevan:

- layar aturan diskon;
- riwayat pembayaran/summary;
- dashboard operasional lengkap;
- import/export produk termasuk format Accurate;
- demo dengan minimal 500 produk dan transaksi realistis;
- setelah transaksi selesai tidak langsung mencetak;
- tampilkan layar sukses dengan opsi Cetak Struk, Buka Laci, dan Transaksi Baru;
- struk dapat dicetak kemudian dari riwayat;
- struk digital dapat masuk ke akun pelanggan;
- portal pelanggan tenant dapat berisi profil toko, katalog, pengumuman, promo, membership, riwayat transaksi, struk, dan APK pelanggan.

Preseden fitur ada pada `C:\opt\AIS\ais\desktop-pos-electron`, tetapi setiap fitur harus dipetakan ke arsitektur, hak akses, dan API eBisnis, bukan disalin mentah.

## 12. Landing page dan metadata tenant

Masalah yang pernah terlihat:

- domain salon pernah diarahkan ke eCampus;
- login dari domain tenant pernah kembali ke `ebisnis.id`;
- tombol pada katalog vertical pernah tetap menuju parent domain;
- header ganda pernah muncul pada halaman tenant;
- metadata share/preview masih memakai eBisnis generik;
- root inventory pernah terlalu khusus membahas obat.

Perilaku yang diharapkan:

- `inventory.ebisnis.id` menjelaskan sales lapangan dan inventory secara umum, tidak khusus obat;
- `cmnmedika-inventory.ebisnis.id` menampilkan profil Caruban Medika Nusantara;
- root setiap vertical memiliki landing page sendiri;
- tenant vertical menampilkan profil tenant dan katalog tenant;
- semua CTA memakai origin aktif atau URL tenant yang dihitung secara aman;
- header hanya satu;
- metadata title, description, icon, manifest, Open Graph, canonical URL, theme, dan download channel dinamis per tenant dan modul;
- konten dan gambar dapat dikelola admin melalui CMS/media tenant.

## 13. Build, release, update otomatis, dan deploy

Artefak yang diminta:

- Flutter Windows `.exe`;
- Flutter Android `.apk`;
- channel terpisah untuk POS, Inventory/Sales, Salon, dan aplikasi pelanggan bila produknya berbeda;
- artefak tersedia dari endpoint update server dan/atau GitHub Release privat;
- aplikasi dapat memeriksa update otomatis tanpa mengekspos repository/token GitHub.

Pilihan yang paling aman untuk repo privat:

- CI mengambil source privat dan menerbitkan artefak ke storage/update server;
- aplikasi hanya membaca manifest publik bertanda tangan, misalnya `/update/<channel>/manifest.json`;
- download dilakukan dari server/CDN dengan checksum dan signature;
- token GitHub hanya ada di CI/server, tidak ditanam dalam aplikasi.

Perintah deploy produksi yang digunakan:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Masalah deploy yang pernah muncul:

- manifest JSON mengandung BOM sehingga `JSON.parse` gagal;
- constraint `ck_tenant_vertical_code` menolak vertical `inventory`;
- migration V043 menuntut seed POS yang belum ada;
- migration H037 gagal karena action `RELEASE` belum ada pada vocabulary permission;
- migration H040 gagal karena `POST` dan `CANCEL` belum ada untuk `HEALTH_INVESTOR_DISTRIBUTION`;
- import DBF gagal dengan `unsupported Unicode escape sequence`;
- `POS_RELEASE_GITHUB_TOKEN` belum tersedia;
- Apache memperingatkan DocumentRoot yang hilang, ServerName, dan MaxRequestWorkers;
- update pernah rollback ke commit sebelumnya setelah tenant migration gagal.

Deployment harus fail closed untuk migration kritis, tetapi log harus jelas dan rollback tidak boleh menyembunyikan schema yang sudah terlanjur berubah. Uji migration pada clone database dan semua variasi schema tenant sebelum produksi.

## 14. Catatan teknis import DBF

Error `unsupported Unicode escape sequence` biasanya terjadi ketika string legacy yang mengandung backslash atau byte rusak dimasukkan ke PostgreSQL sebagai JSON/JSONB atau literal yang tidak dinormalisasi.

Yang perlu diperiksa:

- decoder DBF dan code page;
- karakter NUL dan control character;
- backslash sebelum sequence yang tidak valid;
- pembuatan JSON harus melalui serializer, bukan interpolasi string;
- parameterized query untuk seluruh payload;
- raw bytes/hash tetap disimpan untuk audit bila text tidak dapat didecode sempurna;
- satu record rusak masuk exception queue dan tidak menggagalkan seluruh batch tanpa laporan lokasi record.

Tambahkan test fixture untuk byte/control character yang benar-benar pernah ditemukan pada DBF CMN.

## 15. User manual

Manual baru diminta dalam Word dan PDF untuk Web, Flutter Windows, dan Android, lalu ditampilkan juga pada landing page/modul Inventory/Sales agar dapat dibaca publik.

Manual harus:

- menjelaskan end-to-end dengan bahasa nonteknis;
- membandingkan layar lama dengan layar baru secara berpasangan;
- menggunakan ilustrasi/screenshot yang sesuai build aktual;
- menjelaskan persona, persiapan, master, transaksi, stok, keuangan, laporan, offline/sync, error recovery, audit, dan tutup periode;
- tidak mengandung password produksi;
- memiliki versi, tanggal, channel aplikasi, dan matriks fitur platform;
- diverifikasi visual setelah render DOCX/PDF.

Permintaan 1.500 kata per screenshot sangat besar. Pecah menjadi bab per workflow agar dokumen tetap dapat dipakai, tetapi jangan mengurangi cakupan tanpa mencatat keputusan editorial.

## 16. Data demo

Untuk vertical demo, pengguna meminta data yang terlihat realistis:

- minimal 50 dan maksimal 1.000 contoh per kelompok data yang relevan;
- salon setidaknya 100 produk/layanan dan 1.000 transaksi;
- transaksi demo diperbarui relatif terhadap tanggal deploy agar dashboard tidak tampak usang;
- data demo diberi penanda dan tidak boleh bercampur dengan data tenant produksi;
- reset demo harus idempotent dan aman;
- data pribadi, credential, rekening, dan identitas resmi harus fiktif.

## 17. Keamanan dan isolasi tenant

Wajib dipertahankan:

- schema tenant terisolasi;
- tenant context tidak boleh diambil hanya dari input klien;
- role dan permission diterapkan di backend;
- field sensitif, harga khusus, margin, dan laporan keuangan dibatasi per persona;
- audit untuk login, export, perubahan master, posting, reversal, payment, dan permission;
- idempotency key pada transaksi/sinkronisasi;
- optimistic concurrency atau versioning pada data offline;
- token disimpan menggunakan secure storage pada Flutter;
- release ditandatangani dan checksum diverifikasi;
- tidak ada akun demo atau password yang ditampilkan pada tenant produksi.

## 18. Urutan pekerjaan yang disarankan di komputer baru

1. Sinkronkan semua worktree dengan `git fetch --all --prune`, lalu dokumentasikan branch dan dirty state masing-masing.
2. Baca dokumen ini, serah-terima nomor 17, tracker 48 layar, mapping DBF, dan manual legacy.
3. Audit branch yang memuat implementasi Inventory/Sales terbaru; jangan berasumsi worktree ini memuat seluruh perubahan paralel.
4. Perbaiki pipeline build flavour agar release inventory tidak pernah menghasilkan aplikasi salon.
5. Selaraskan menu, route guard, dan permission backend untuk role Sales; reproduksi dengan user sales dan automated integration test.
6. Perbaiki duplikasi header dan pencarian Sales Order pada Web dan Flutter.
7. Jalankan bootstrap CMN pada database uji, selesaikan sanitasi DBF, lalu buat laporan rekonsiliasi terhadap count dan nilai sumber.
8. Audit matriks 48 layar baris demi baris dan lampirkan bukti aktual.
9. Bangun artefak Windows dan Android, lakukan smoke test binary, lalu terbitkan pada channel Inventory/Sales yang benar.
10. Jalankan migration rehearsal seluruh tenant sebelum deploy produksi.
11. Deploy dengan `update.sh`, periksa health/API/domain/update endpoint, lalu lakukan UAT sebagai pemilik, sales, admin, dan pelanggan.
12. Perbarui manual Word/PDF berdasarkan build yang benar-benar dirilis.

## 19. Perintah verifikasi dasar

Sesuaikan dengan package scripts aktual repository:

```powershell
git fetch --all --prune
git status --short --branch
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm test
git diff --check
```

Untuk Flutter, jalankan dari aplikasi yang benar dan pastikan entrypoint/flavour Inventory/Sales:

```powershell
flutter pub get
flutter analyze
flutter test
flutter build windows --release
flutter build apk --release
```

Jangan menyalin nama artefak saja. Validasi isi binary, app title, package/application ID, API base URL, update channel, ikon, login screen, dan versi dari hasil build.

## 20. Definisi selesai

Pekerjaan baru boleh disebut selesai apabila:

- requirement terhubung ke issue/tracker dan implementation evidence;
- migration additive lulus pada platform dan semua tipe schema tenant;
- unit, integration, contract, authorization, sync, dan UI tests lulus;
- Web, Windows, dan Android diuji sesuai persona;
- import CMN memiliki laporan rekonsiliasi tanpa data produk/penjualan yang hilang diam-diam;
- artefak release benar, dapat diunduh pada percobaan pertama, dan dapat update otomatis;
- domain induk dan tenant mengarah ke landing page yang benar;
- metadata dan brand sesuai tenant/vertical;
- manual publik sesuai build rilis;
- UAT dan visual evidence tersedia;
- tidak ada credential, data pribadi, atau secret di source dan artefak publik.

## 21. Kesimpulan faktual

Rangkaian sesi telah menghasilkan banyak permintaan, mockup, pemetaan, dan beberapa laporan perbaikan, tetapi percakapan juga menunjukkan defect produksi, kegagalan migration, salah paket release, permission Sales yang tidak sinkron, serta UI yang belum konsisten. Karena pekerjaan tersebar di banyak worktree dan branch, penerus harus melakukan audit Git dan evidence terlebih dahulu.

Prioritas tertinggi adalah membuat Caruban Medika Nusantara benar-benar dapat dipakai: schema terisolasi, data legacy terimport dan terekap, role bekerja, Sales Order berjalan, aplikasi Inventory/Sales yang benar terbit, lalu dashboard dan 48 layar diselesaikan dengan bukti lintas Web/Windows/Android.
