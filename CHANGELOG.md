# Changelog

Seluruh perubahan penting pada eBisnis.id dicatat di berkas ini.

Format mengikuti prinsip [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

## Layar kasir dapat dipasang dan katalognya tersalin ke mesin kasir

Fase 1 dan 2 dari rencana kasir luring: aplikasi dapat dipasang seperti aplikasi
biasa, dan katalog produk disalin ke mesin kasir supaya pencarian serta
pemindaian tetap bekerja ketika peladen tidak menjawab.

### Ditambahkan
- **Layar kasir dapat dipasang** (`vite-plugin-pwa`, mode `generateSW`). Manifest
  membuka langsung pada `/app/pos`, berorientasi mendatar, dengan cangkang
  aplikasi tercache — 35 berkas, 817 KiB. Mesin kasir yang kehilangan internet
  kini tetap membuka layar kasir, bukan halaman galat peramban.
- **`GET /pos/catalog/snapshot`** — produk beserta **seluruh** barcode (utama dan
  alternatif dalam satu larik), tarif pajak, dan metode pembayaran dalam satu
  jawaban. `catalog/search` yang sudah ada hanya mengembalikan barcode utama;
  salinan yang dibangun darinya akan menolak barang yang di peladen dikenali,
  dan kasir tidak akan pernah tahu bahwa penyebabnya salinan, bukan barangnya.
- **Indikator sambungan yang membedakan empat keadaan**, bukan dua. `TERBATAS` —
  jaringan tersambung tetapi peladen tidak menjawab — dipisahkan dari `LURING`
  karena keduanya menuntut tindakan berbeda dari kasir, dan `navigator.onLine`
  tidak dapat membedakannya.
- **Salinan katalog di IndexedDB**, pada basis data tersendiri
  (`ebisnis-pos-katalog`), terpisah dari buku transaksi lokal. Katalog boleh
  hilang dan tinggal disalin ulang; buku transaksi tidak. Menyatukannya berarti
  setiap pembersihan cache mengancam yang tidak tergantikan demi membereskan
  yang tergantikan. Salinan membawa `tenantId` dan dibuang bila mesin yang sama
  dipakai masuk ke tenant lain.
- **Batas umur per jenis data**, dipilih menurut akibat bila salah, bukan menurut
  seberapa sering datanya berubah: harga dan pajak 12 jam, produk dan barcode 7
  hari. Salinan yang melewati batasnya **tidak dipakai sama sekali**.
- **34 uji baru** pada aturan sambungan, kesegaran katalog, dan penerapan
  pembaruan (web: 35 → 69).
- **`apps/web/scripts/buat-ikon-pwa.mjs`** — ikon dibuat dari kode, bukan berkas
  biner yang dilempar ke repositori, supaya perubahannya terbaca pada permintaan
  tarik dan mudah diganti ketika logo resmi tersedia.

### Keputusan
- **Permintaan API tidak pernah di-cache service worker** (`runtimeCaching: []`,
  `navigateFallbackDenylist` untuk `/api` dan `/health`). Harga atau stok yang
  dilayani dari cache membuat kasir menjual dengan angka yang sudah tidak
  berlaku, dan tidak ada satu pun galat yang muncul saat itu terjadi.
- **Pembaruan aplikasi ditunda selama keranjang terbuka.** Memuat ulang di tengah
  transaksi menghapus keranjang yang barangnya sudah dipindai satu per satu, di
  depan pembeli yang sedang menunggu. Juga ditunda selama masih ada transaksi
  yang belum terkirim ke peladen: yang tahu cara membaca antrean itu adalah versi
  yang menulisnya.
- **Katalog yang terpotong disebutkan dengan angkanya** — "4.999 dari 12.480",
  bukan "sebagian produk tidak tersalin". Katalog yang dipotong diam-diam membuat
  barang tampak tidak ada tanpa satu pun keterangan di layar.
- **Salinan lokal hanya dipakai saat peladen tidak menjawab.** Selama daring,
  peladen tetap satu-satunya sumber harga.
- **Ikon maskable memakai berkas tersendiri** yang penuh sampai ke tepi. Peluncur
  Android memotong sendiri ikon maskable; ikon yang sudah membulat akan dipotong
  dua kali dan mengambang di dalam bentuk potongan peluncur.

### Belum termasuk
- **Menjual saat luring belum aktif.** Salinan katalog dipakai untuk memeriksa
  harga dan nama barang; memasukkannya ke keranjang masih memerlukan peladen, dan
  layar mengatakannya apa adanya. Tiga keputusan usaha masih menunggu jawaban
  sebelum penjualan luring dapat dibuka: kebijakan stok saat luring, pembagian
  blok nomor struk per register, dan pembekuan harga.
## Provisioning penyewa baru gagal pada migrasi modul pertama

### Diperbaiki
- **Kolom ketiga yang menyimpan versi migrasi terlewat dari pelebaran V033.**
  `audit_schema_migration.migration_version` masih `VARCHAR(16)`, baik pada
  skema audit tiap penyewa maupun pada `platform__audit`. Setiap migrasi yang
  berhasil menuliskan jejaknya ke sana, sehingga begitu migrasi modul pertama
  dijalankan pada penyewa **baru**, penerapannya berhasil, pembukuannya
  berhasil, lalu jejak auditnya gagal — dan seluruh provisioning batal.

  Tidak tertangkap V033 karena buktinya memeriksa penyimpanan id panjang pada
  `schema_migration` saja, dan penerapan ke penyewa yang sudah ada hanya
  menjalankan V033 sendiri, yang idnya pendek. Jalur yang gagal hanya dilalui
  penyewa baru yang menjalankan migrasi modul dari nol — dan tidak ada penyewa
  baru yang dibuat sampai E2E melakukannya.

  `V034` melebarkannya pada skema audit penyewa; satu migrasi platform
  melebarkannya pada `platform__audit`.

### Keputusan yang perlu dicatat
- **Melebarkan satu kolom kunci berarti mencari SELURUH kolom yang menyimpan
  nilai yang sama.** Yang paling mudah terlupakan adalah jejak audit, sebab ia
  tidak pernah dibaca aplikasi — hanya ditulis. `prove-core-ir.mjs` kini
  memeriksa lebar setiap kolom penyimpan versi migrasi dengan **mencarinya
  sendiri** lewat `information_schema`, bukan dari daftar yang ditulis tangan.
  Daftar yang ditulis tangan persis yang gagal.

## Registri modular: migrasi, akuntansi, menu, pembayaran, dan situs publik

Menjawab lima permintaan integrasi dari sesi eKoperasi (IR-001 sampai IR-005).
Kelimanya menyangkut hal yang sama: berkas bersama yang harus disunting setiap
vertikal baru, dan yang kini diperebutkan tiga sesi paralel.

Seluruhnya bersifat menambah. Tidak ada perilaku lama yang berubah.

### Ditambahkan
- **Katalog migrasi modular.** `tenant-migrations/<modul>/manifest.json`
  ditemukan otomatis dan digabungkan dengan manifest inti. Migrasi inti selalu
  lebih dahulu; antarmodul menurut `dependsOn` lalu menurut nama, deterministik.
- **`V033`** melebarkan `schema_migration.version` ke `VARCHAR(128)`, `name` ke
  `VARCHAR(255)`, dan menambah kolom `module`. Sudah diterapkan ke 17 skema.
- **`AccountingEventCatalogRegistry`** — modul vertikal dapat mendaftarkan
  peristiwa akuntansinya sendiri. Katalog inti kini terdaftar lewat pintu yang
  sama, tanpa perlakuan istimewa.
- **`VerticalCatalogRegistry`** — menu, peran, dan aksi hak akses per vertikal.
- **`ExternalPaymentRegistry`** pada POS — kontrak pembayaran bersaldo
  eksternal: `authorize` menahan, `capture` mewujudkan, `reverse` melepaskan.
- **`PublicTenantResolver`** dan `platform.vertical_site_domain` — situs publik
  vertikal memperoleh penyewanya dari host permintaan.
- **`scripts/prove-core-ir.mjs`** — 40 pemeriksaan pada basis data sungguhan.

### Diperbaiki
- **Pemeriksa migrasi CI melewatkan subdirektori tanpa berkata apa-apa.**
  `verify-migrations.mjs` hanya melihat berkas `.sql` di tingkat teratas, jadi
  migrasi modul akan lolos tanpa satu pun pemeriksaan penamaan, sinkronisasi
  manifest, maupun SQL destruktif. Itu lebih buruk daripada gagal: pemeriksa
  yang melewatkan berkas secara diam-diam memberi keyakinan yang tidak
  berdasar. Kini memeriksa migrasi modul pula, dan sudah dibuktikan menangkap
  id yang tidak cocok, berkas hantu pada manifest, serta id kembar antarmodul.

### Keputusan yang perlu dicatat
- **Nama skema tidak pernah boleh datang dari alamat.** Itulah sebabnya IR-005
  ada: sesi koperasi menolak membuat `/public/:schema/:slug` dan menunda
  kemampuannya alih-alih melonggarkan aturannya. Penolakan itu benar — alamat
  semacam itu dapat dicoba nama demi nama sampai menemukan skema yang ada.
- **Tabrakan id migrasi ditolak saat pemuatan, bukan saat penerapan.** Bila
  dibiarkan, penyewa yang sudah menerapkan `V024` milik satu modul akan
  MELEWATI `V024` milik modul lain — tanpa galat, dan tabelnya tidak pernah
  terbentuk. Cacatnya baru terlihat berbulan-bulan kemudian, pada sebagian
  penyewa saja.
- **`latestVersion()` tetap berarti versi inti.** Bila ia ikut berubah setiap
  kali ada vertikal baru, artinya bergeser tanpa ada yang memutuskannya.
- **Peran vertikal memakai `RoleCatalogEntry`, bukan `RoleTemplateSeed`** —
  satu-satunya penyimpangan dari bentuk yang diusulkan IR-004. Bentuk yang
  sudah diperluas melewati mesin profil sepenuhnya, dan izin yang tidak
  melewati mesin profil tidak tunduk pada aturan pemisahan tugas yang dibangun
  di atasnya.
- **Peristiwa akuntansi tanpa daftar nilai wajib ditolak.** Peristiwa keuangan
  yang tidak diperiksa kelengkapannya menghasilkan jurnal yang tidak seimbang,
  dan ketidakseimbangan baru terlihat saat neraca disusun.

## Halaman CMS tetap berjudul meski isinya gagal dimuat

### Diperbaiki
- **`/tentang`, `/syarat`, dan `/privasi` tidak memiliki `<h1>` sama sekali saat
  isinya sedang dimuat atau gagal dimuat.** Keduanya menampilkan pesan tanpa
  judul apa pun, sehingga pembaca layar yang melompat antar heading tidak
  menemukan apa-apa dan tidak dapat tahu halaman apa yang sedang dibukanya —
  justru pada saat pengguna paling membutuhkan keterangan tentang di mana ia
  berada.

  `CmsPage` kini menerima `fallbackTitle` yang wajib. Judul dari CMS dipakai
  bila sudah tiba; bila belum, judul cadangan yang dipakai. Keduanya tetap satu
  `<h1>`.

### Ditambahkan
- **Uji regresi** yang memalsukan galat API lalu menegaskan judulnya tetap ada.
  Diverifikasi gagal tanpa perbaikannya dan lulus dengannya — uji regresi yang
  tidak pernah merah tidak membuktikan apa pun.
- Uji "tepat satu heading tingkat 1" kini mencakup `/syarat` dan `/privasi`,
  yang sebelumnya tidak pernah diperiksa sama sekali.

### Catatan
- Cacat ini ditemukan oleh alur CI E2E yang baru, dan **tidak pernah tampak
  pada basis data yang sudah lama dipakai** — isinya selalu ada di sana.
  Ia hanya menampakkan diri pada basis data yang baru disemai. Inilah gunanya
  menjalankan uji peramban terhadap lingkungan yang bersih.

## Uji Playwright layar kasir

### Ditambahkan
- **`e2e/pos-cashier.spec.ts`** — **9 uji** yang benar-benar menekan tombol:
  pindai barcode, ubah jumlah, tahan keranjang, bayar tunai, struk terbit,
  barcode tak dikenal, tombol yang seharusnya mati, dan halaman laporan.
- **`apps/api/scripts/e2e-pos-fixture.mjs`** — menyiapkan kasir beserta
  penugasan register, produk berbarcode, dan stok; membersihkannya lagi
  sesudahnya. Kata sandi dibangkitkan acak setiap kali dan ditulis ke berkas di
  luar repositori.
- **`API_PROXY_TARGET`** pada `vite.config.ts` — sasaran proxy API dapat diatur,
  karena port 3000 tidak selalu bebas dan suntingan lokal pada berkas ini mudah
  ikut ter-commit.

### Diperbaiki — ketiganya ditemukan justru oleh uji peramban
- **Layar kasir tidak dapat membuka keranjang sama sekali.** Antarmuka membaca
  `outlets[0].outletId`, sedangkan peladen mengirim `outlets[0].id`. Medan yang
  tidak ada menghasilkan `undefined`, tombolnya mati, dan **tidak ada pesan
  galat apa pun** — tidak ada yang gagal, hanya tidak terjadi. Jenis cacat yang
  tidak akan pernah tertangkap uji API.
- **Batang konteks berbunyi "Shift undefined · kas awal -".** `openShift` tidak
  membawa nomor shift, kas awal, maupun tanggal usaha; pemilih register tidak
  membawa nama. Ditambahkan pada jawaban peladen.
- **Barcode tak dikenal menampilkan "Data tidak ditemukan."** Terjemahan umum
  `error.NOT_FOUND` menggantikan pesan peladen yang jauh lebih berguna —
  "Barcode 899… tidak dikenali. Cari produk menurut namanya, atau daftarkan
  barcode ini pada master produk." Pesan peladen kini ditampilkan apa adanya
  pada jalur pindai.

### Diperbaiki — naskah bukti
- **Naskah bukti POS-10 merusak data schema bersama.** Pembersihan data contoh
  menghapus SELURUH data contoh pada schema — perilaku yang benar bagi penyewa,
  tetapi `demo` dipakai uji lain, dan produk contoh bawaannya ikut terhapus
  sampai uji "daftar produk memuat master dari schema tenant" merah. Naskah kini
  mencatat keadaan sebelum pembersihan dan memulihkannya sesudahnya.
- **Rentang laporan pada naskah bukti memakai tanggal UTC.** Menjelang tengah
  malam WIB, tanggal UTC sudah mundur satu hari dan penjualan yang baru dibangun
  jatuh di luar rentang. Rentang kini dihitung dari `CURRENT_DATE` basis data.

### Keputusan yang perlu dicatat
- **Satu sesi untuk seluruh berkas uji.** Semula setiap uji masuk
  sendiri-sendiri, dan uji ketujuh mulai gagal: pembatas laju masuk menolak
  percobaan kesebelas dalam satu menit. Pembatasnya benar; ujinya yang keliru.
  Sesi tunggal juga lebih menyerupai kenyataan — kasir masuk sekali pada awal
  shift.
- **Uji dilewati pada ponsel dengan keterangan.** Perintah prioritas §20
  menyasar desktop dan tablet lanskap. Dilewati apa adanya, bukan dipaksa lulus
  dengan tata letak yang tidak pernah dipakai siapa pun.
- **Tanpa fixture, berkasnya dilewati — bukan gagal.** Uji yang merah karena
  datanya belum disiapkan tidak memberitahu apa pun tentang mutu kodenya, dan
  lama-lama membuat orang mengabaikan warna merah.

## POS-9 dan POS-10 — Laporan operasional dan data contoh kasir

### Ditambahkan
- **`pos-report.ts`** — aturan laporan sebagai fungsi murni, **32 pengujian**:
  batas rentang, penyembunyian biaya, persentase, dan sorotan kasir.
- **`PosReportService`** — **lima belas laporan** (ringkasan, rincian, per
  produk/kategori/kasir/register/shift, komposisi pembayaran, pajak, diskon,
  void, retur, refund, pergerakan kas, selisih kas) plus dasbor satu tanggal.
- **`PosSampleService`** — pabrik data contoh POS: merek, outlet, gudang,
  register, produk berbarcode, pelanggan, stok, shift tertutup, dan penjualan
  yang sudah selesai. Deterministik terhadap seed.
- **Enam endpoint**: `reports`, `reports/dashboard`, `reports/:code`,
  `sample-data` (baca dan bangun), `sample-data/cleanup`.
- **`V032__pos_transaction_sample_flags.sql`** — `is_sample` dan
  `sample_batch_id` pada `pos_sale`, `pos_shift`, `pos_return`, `pos_refund`.
- **`prove-pos-report-sample.mjs`** — **40 pemeriksaan, seluruhnya lulus**.
- **Halaman `/app/pos/laporan`** — satu halaman untuk seluruh laporan, dengan
  pemilih laporan dan rentang tanggal. Kolomnya dirakit dari jawaban peladen
  alih-alih dipetakan satu per satu; lima belas laporan berarti ratusan kolom,
  dan peta sebesar itu akan tertinggal lebih dahulu daripada dipakai.

### Keputusan yang perlu dicatat
- **Kolom biaya DIHAPUS, bukan ditolkan.** Menolkan membuat laporan tampak
  seolah untungnya nol — angka yang salah lebih buruk daripada angka yang tidak
  ada. Jawaban juga menyertakan `costHidden` supaya pembaca tahu ada yang
  disembunyikan, dan tidak menyimpulkan margin usahanya memang tidak tercatat.
- **Kasir yang meminta laporan kasir lain tetap disaring ke dirinya sendiri**,
  dan jawabannya menyatakan `scopedToSelf` alih-alih diam-diam memotong.
- **Rentang laporan dibatasi 92 hari.** Laporan tanpa batas akan memindai
  seluruh riwayat penjualan begitu sebuah outlet berjalan setahun, dan yang
  menanggungnya adalah kasir yang sedang melayani antrean pada basis data yang
  sama. Penolakannya menyebutkan batasnya, bukan hanya menolak.
- **Laporan membaca `business_date`, bukan cap waktu.** Kasir yang bekerja
  melewati tengah malam tetap berada pada tanggal usaha yang sama; laporan yang
  memotong pada pukul 00.00 akan membelah satu shift menjadi dua hari, lalu kas
  kedua hari itu tidak akan pernah cocok.
- **Sorotan mengajak memeriksa, bukan menuduh.** Angka yang menonjol hampir
  selalu punya penjelasan biasa. Alat yang dipakai memarahi orang akan dihindari
  orang.
- **Pengacak deterministik, bukan `Math.random()`.** Dua kali membangun data
  contoh dengan seed yang sama menghasilkan angka yang sama, supaya laporan yang
  dibandingkan sebelum dan sesudah sebuah perubahan benar-benar membandingkan
  perubahannya.
- **Outlet contoh yang telanjur menaungi penjualan sungguhan tidak dihapus**,
  dan dilaporkan sebagai tertahan. Penyewa yang mencoba data contoh lalu mulai
  berjualan sungguhan pada outlet yang sama bukan keadaan yang mustahil.

## POS-4 dan POS-5 UI — Layar kasir, shift, dan rekonsiliasi kas

### Ditambahkan
- **Layar kasir `/app/pos`** — batang konteks (outlet, register, shift, kas),
  kotak pindai barcode, pencarian produk, keranjang, dan dialog pembayaran.
  Pintasan F2 (fokus pindai), F6 (tahan), F9 (bayar).
- **`PosShiftService`** — ringkasan kas, pergerakan kas, penutupan shift dengan
  rekonsiliasi, dan persetujuan selisih.
- **Lima endpoint baru**: `payment-methods`, `shifts/:id/cash-summary`,
  `shifts/:id/cash-movement`, `shifts/:id/close`, `shifts/:id/approve`.
- **`V031__pos_shift_closing.sql`** — `opened_by`, `closed_by`, `approved_by/at`,
  `variance_reason`, `approval_note`, constraint
  `pos_shift_no_self_variance_approval`, dan status `PENDING_APPROVAL`.

### Keputusan yang perlu dicatat
- **Kas yang diharapkan dihitung peladen, bukan dilaporkan kasir.** Kasir
  melaporkan berapa uang yang ada di laci; berapa yang seharusnya ada dihitung
  dari kas awal, penjualan tunai, dan pergerakan kas. Membiarkan kasir
  melaporkan keduanya berarti membiarkannya melaporkan bahwa tidak ada selisih.
- **Ambang selisih Rp 50.000.** Menuntut persetujuan supervisor untuk setiap
  rupiah akan membuat persetujuan itu diberikan tanpa dibaca, dan persetujuan
  yang diberikan tanpa dibaca tidak menjaga apa pun.
- **`PENDING_APPROVAL` ada supaya kasir tidak tertahan.** Selisih di atas ambang
  tidak langsung menutup shift, tetapi juga tidak menahan kasir pulang: shift
  ditutup, kasnya terkunci, persetujuannya menyusul.
- **Shift tidak dapat ditutup di atas transaksi yang belum selesai.** Transaksi
  tertunda menahan stok dan belum menghasilkan uang; kas yang diharapkan tidak
  dapat dihitung benar di atasnya.
- **Fokus layar kasir selalu kembali ke kotak pindai.** Pemindai barcode
  mengetik lalu menekan Enter; bila fokus berpindah, pindaian berikutnya masuk
  ke tempat yang salah dan kasir baru menyadarinya beberapa barang kemudian.
- **`Idempotency-Key` dibuat sekali per dialog pembayaran**, bukan per klik.
  Klik ganda pada layar yang lambat mengirim kunci yang sama, dan peladen
  mengenalinya sebagai satu pembayaran.

## POS-7 dan POS-8 — Struk, pembatalan, retur, dan refund

### Ditambahkan
- **`PosReturnService`** — pengajuan dan persetujuan pembatalan, retur sebagian
  dan penuh dengan disposisi barang, serta pembayaran refund.
- **Sepuluh endpoint**: struk, cetak ulang, void-request, void-approve, returns,
  approve, refund.
- **`V030__pos_void_columns.sql`** — `void_requested_by/at`, `void_approved_by/at`,
  `void_reason`, dan constraint `pos_sale_no_self_void_approval`.
- **`prove-pos-return-e2e.mjs`** — **34 pemeriksaan, seluruhnya lulus**
  (`docs/pos-web-priority/bukti-pos-return-e2e.txt`).

### Diperbaiki
- **Retur lanjutan tidak lagi tertolak karena refund sebelumnya masih tertunda.**
  Sesudah retur pertama disetujui, status penjualan menjadi `REFUND_PENDING`,
  dan retur kedua atas barang yang masih di tangan pembeli ikut tertolak.
  Pembeli yang mengembalikan dua barang pada dua hari berbeda adalah keadaan
  biasa, bukan keadaan yang perlu dilarang. Yang menentukan boleh-tidaknya retur
  adalah sisa unit yang belum dikembalikan — dijaga constraint.
- **Idempotensi refund diperiksa sebelum status.** Sebelumnya percobaan ulang
  atas refund yang sudah berhasil dijawab "retur belum disetujui", karena
  statusnya sudah berubah menjadi `REFUNDED`. Kasir yang membaca itu akan
  mengira refundnya gagal lalu membayar tunai dari laci — **uangnya keluar dua
  kali.** Pelajaran yang sama pernah diambil pada penomoran surat V10-6.

### Keputusan yang perlu dicatat
- **Pembatalan membalik, bukan menghapus.** Peristiwa akuntansi pembalik
  bernilai negatif dan stoknya dikembalikan; barisnya tetap ada. Transaksi yang
  lenyap dari riwayat adalah cara termudah menghilangkan uang tanpa jejak.
- **Larangan menyetujui permintaan sendiri berlaku di tiga lapisan** — mesin
  transisi status, layanan, dan constraint basis data. Naskah bukti menguji
  ketiganya, termasuk dengan melewati layanan sama sekali.
- **Nilai retur dihitung proporsional** terhadap baris aslinya, termasuk
  diskonnya. Memakai harga satuan penuh akan mengembalikan lebih banyak uang
  daripada yang pernah diterima atas barang itu.

## POS-5 dan POS-6 — Keranjang, pembayaran, dan batas penyelesaian

### Ditambahkan
- **`PosSaleService`** — keranjang kasir dari buka sampai selesai: tambah/ubah/
  hapus baris, tahan/lanjutkan, batal, terima pembayaran, dan **batas
  penyelesaian sepuluh langkah dalam satu transaksi basis data**: validasi
  penjualan, shift, persetujuan, dan total pembayaran; nomor struk; potong
  persediaan; peristiwa akuntansi; terbitkan struk; tandai selesai; titipkan ke
  outbox.
- **Empat belas endpoint** `/pos/sales/*`, `/pos/stock/check`.
- **`V029__pos_payment_received_by.sql`** — `pos_payment` bertambah
  `received_by` dan `received_at`.
- **`prove-pos-sale-e2e.mjs`** — bukti satu transaksi dari ujung ke ujung,
  **39 pemeriksaan, seluruhnya lulus** (`docs/pos-web-priority/bukti-pos-sale-e2e.txt`).

### Diperbaiki
- **`V028`** melonggarkan `pos_sale.receipt_number` dari NOT NULL. Keranjang
  disimpan sebagai baris `pos_sale` berstatus DRAFT jauh sebelum ada struk;
  menerbitkan nomor saat keranjang dibuka akan membuat setiap keranjang yang
  ditinggalkan memakan satu nomor, dan **deret nomor struk pun berlubang** —
  hal pertama yang ditanyakan pemeriksa pajak.
- **Penomoran shift** memakai `SH-YYYYMMDD-<register>-NN`. `ux_pos_shift_number`
  unik pada `shift_number` saja — bukan per terminal — sehingga penomoran
  "1, 2, 3" bertabrakan pada register kedua yang membuka shift pertamanya.
- **Gudang outlet** tidak lagi memakai kolom `is_default` yang tidak ada;
  gudang anak didahulukan atas gudang induk.
- **Parameter `$2` pada perpindahan status** diberi tipe tegas. Dipakai dua kali
  dengan tipe yang disimpulkan berbeda, dan PostgreSQL menolak menyimpulkannya.

### Keputusan yang perlu dicatat
- **`received_by` sengaja menduplikasi identitas yang mirip `cashier_id`.**
  Keduanya menjawab pertanyaan berbeda: `cashier_id` siapa yang membuka
  keranjangnya, `received_by` siapa yang memegang uangnya. Supervisor yang
  mengambil alih di tengah transaksi membuat keduanya berbeda — dan ketika kas
  akhir shift selisih, yang ditanyakan adalah yang kedua.
- **Metode non-tunai menolak lebih bayar.** Kelebihan pada kartu berarti
  kesalahan ketik, dan menerimanya diam-diam menghasilkan selisih yang baru
  ketahuan saat rekonsiliasi bank berminggu-minggu kemudian.
- **Naskah bukti tunduk pada penjaga immutability V008** dan tidak menghapus
  buku besar pergerakan stok. Memaksanya lewat berarti menguji sistem yang
  berbeda dari yang dijalankan penyewa.

## POS-3, POS-5a, POS-6a — Stok, mesin status, dan peristiwa akuntansi kasir

### Ditambahkan
- **`modules/pos/pos-stock.ts`** — aturan ketersediaan stok sebagai fungsi
  murni, dengan **20 pengujian** termasuk aritmetika kelima ember stok.
- **`modules/pos/pos-stock.service.ts`** — reservasi, pelepasan, dan
  pengeluaran stok dengan kunci baris dan idempotensi.
- **`modules/pos/pos-sale-state.ts`** — mesin transisi tiga belas status
  penjualan, dengan **28 pengujian**.
- **Dua belas kode peristiwa akuntansi `POS_*`** pada mesin posting yang sudah
  ada, beserta daftar nilai wajibnya dan **7 pengujian** kelengkapan.
- **Migrasi `V027__pos_sale_detail.sql`**: `pos_sale_line_tax`,
  `pos_sale_line_discount`, `pos_sale_discount`, `pos_sale_status_history`,
  `pos_sale_snapshot`, `pos_sale_receipt`, `pos_cash_count`, `pos_return`,
  `pos_return_line`, `pos_refund`, plus kolom pelengkap pada `pos_sale_line`.

### Koreksi audit POS-0
- **`StockReservationService` TIDAK dapat dipakai untuk POS.** Audit POS-0
  mencantumkannya sebagai dapat dipakai apa adanya; itu keliru. Kekeliruannya
  berasal dari membaca nama metodenya — `hold`, `commit`, `release` — dan
  komentar dokumennya, bukan kuerinya. Layanan itu bekerja seluruhnya pada
  `online_listing_variant`, yaitu stok etalase marketplace, sementara kasir
  bekerja pada `stock_balance` per gudang. Memakainya untuk POS akan membuat
  penjualan kasir mengurangi stok etalase daring, dan sebaliknya.
  Dokumen 02 dan 03 sudah dikoreksi.

### Keputusan yang perlu dicatat
- **Tarif pajak disimpan sebagai cuplikan pada baris penjualan**, bukan hanya
  sebagai rujukan. Tarif berubah, dan struk yang dicetak ulang tahun depan
  harus menunjukkan tarif yang berlaku saat transaksi terjadi.
- **`PAID` hanya boleh maju ke `COMPLETED`.** Ia keadaan sesaat: uang sudah
  diterima tetapi stok dan jurnal belum terbentuk. Membiarkannya kembali ke
  `DRAFT` berarti uang yang sudah masuk tidak punya transaksi yang menaunginya.
- **Pemisahan wewenang retur ditegakkan basis data pula**, lewat constraint
  `approved_by <> requested_by`. Aturan yang hanya ada di satu lapisan berhenti
  berlaku begitu ada jalan kedua menuju tabelnya.
- **Jumlah yang diretur dibatasi constraint**, bukan dihitung layanan. Retur
  yang menghitung sendiri sisanya akan salah begitu dua retur atas transaksi
  yang sama diproses bersamaan.
- **Disposisi retur** membedakan `RESTOCK`, `DAMAGED`, dan `DISPOSED`.
  Mengembalikan seluruh barang retur ke stok jual adalah cara tercepat membuat
  catatan stok berbeda dari kenyataan di rak.

### Bukti
- Migrasi V027 diterapkan ke 17 skema tenant.
- `jest` 1209 tes lulus (bertambah 55).

## POS-2 — Katalog, barcode, harga, dan pajak

### Ditambahkan
- **Migrasi `V026__pos_catalog_pricing.sql`**: `pos_price_book_assignment`,
  `pos_promotion`, `pos_promotion_product`, dan indeks pencarian barcode/SKU.
- **`modules/pos/pos-pricing.ts`** — mesin kuotasi harga kasir sebagai fungsi
  murni, beserta **40 pengujian**. Angkanya dihitung tangan lebih dahulu, bukan
  disalin dari keluaran program.
- **`modules/pos/pos-catalog.service.ts`** — pencarian produk, pemindaian
  barcode, dan kuotasi harga di atas basis data.
- **Enam endpoint**: `GET /pos/context`, `GET /pos/catalog/search`,
  `GET /pos/products/by-barcode`, `POST /pos/price/quote`,
  `POST /pos/shifts/open`, `GET /pos/shifts/current`, ditambah pengelolaan
  penugasan register.
- `scripts/prove-pos-1-2.mjs` beserta buktinya di
  `docs/pos-web-priority/bukti-pos-1-2.txt` — menyiapkan sendiri pengguna,
  terminal, dan penugasannya, lalu membersihkannya, sehingga dapat dijalankan
  berulang kali.

### Keputusan yang perlu dicatat
- **Mesin harga dibangun baru, bukan memakai `PricingEngineService`.** Mesin
  yang ada menghitung tagihan langganan SaaS (`planCode`, `billingInterval`,
  `deviceIds`) — berapa yang dibayar penyewa kepada kita, bukan berapa yang
  dibayar pembeli kepada penyewa. Yang dipakai ulang hanyalah evaluator diskon
  berbasis pohon kondisi.
- **Pajak dihitung pada nilai sesudah diskon.** Menghitungnya atas bruto
  membuat penyewa membayar pajak atas uang yang tidak pernah diterimanya.
- **Pajak inklusif dikeluarkan dari dalam harga** (`harga ÷ (1 + tarif)`),
  bukan dikalikan di atasnya. Kekeliruan ini tidak pernah terlihat pada satu
  struk, tetapi menggerus angka penjualan bersih setiap hari.
- **Kekhususan buku harga menang lebih dahulu daripada jumlah minimum.**
  Membalik urutannya membuat harga grosir tingkat tenant mengalahkan harga
  eceran khusus outlet — dan outlet kehilangan kendali atas harganya sendiri.
- **Baris tidak pernah bernilai negatif.** Diskon yang melebihi harga dipotong;
  menyerahkan uang kepada pembeli adalah pengeluaran kas, yang punya alur dan
  hak aksesnya sendiri.
- `condition_tree` promosi dievaluasi kode, **tidak pernah** dengan `eval`,
  `Function`, maupun SQL bebas.

### Diperbaiki — ditemukan oleh naskah bukti, bukan oleh pengujian unit
- **Konteks kasir memakai id pengguna control plane pada tabel tenant.**
  `AuthenticatedUser.userId` menunjuk `platform.platform_user`, sedangkan
  penugasan register dan shift menunjuk `user_subject.id`. Keduanya berbeda,
  dan memakai yang satu di tempat yang menuntut yang lain **tidak menghasilkan
  galat**: kuerinya berhasil dan mengembalikan nol baris. Kasir yang sudah
  ditugaskan tampak tidak punya register sama sekali, tanpa satu pun pesan yang
  menjelaskan sebabnya.
- **Produk berharga nol lolos tanpa peringatan.** `default_sale_price`
  dikembalikan sebagai teks, dan teks `"0"` bernilai benar dalam JavaScript —
  sehingga produk berharga nol terbaca sebagai produk yang berharga, peringatan
  `NO_PRICE` tidak muncul, dan barang akan terjual gratis tanpa satu pun tanda
  pada layar kasir.
- Penomoran shift memakai `MAX(shift_number)` pada kolom bertipe teks;
  dikonversi lebih dahulu supaya nomor 10 tidak mendahului nomor 9.

### Bukti
- 26 pemeriksaan ujung-ke-ujung terhadap API yang berjalan, seluruhnya lulus.
- `jest` 1154 tes lulus (bertambah 40).

## POS-1 — Konteks kasir, hak akses, dan peran

### Ditambahkan
- **Migrasi `V024__pos_context.sql`** (aditif): tabel `pos_register_assignment`
  beserta kolom pelengkap pada `pos_terminal`, `pos_shift`, `pos_sale`,
  `pos_payment`, dan `cash_drawer_movement`.
- **Migrasi `V025__pos_profiles.sql`**: memperluas `ck_role_module_profile_code`
  agar menerima profil kasir K1–K5, menyusul V012 yang melakukan hal sama untuk
  marketplace.
- **Sembilan aksi hak akses kasir**: `SELL`, `HOLD`, `RESUME`, `DISCOUNT_LINE`,
  `DISCOUNT_CART`, `PRICE_OVERRIDE`, `OPEN_SHIFT`, `CLOSE_SHIFT`, `CASH_MOVE`.
- **Enam menu POS baru** — katalog tumbuh dari 133 menjadi 139. Seluruh menu POS
  kehilangan penanda "segera hadir".
- **Lima profil kasir K1–K5** dan **tiga peran baru**: `ADMIN_TOKO`,
  `PETUGAS_GUDANG_OUTLET`, `AUDITOR_POS`.
- **Aturan pemisahan wewenang `POS_CASH`** — penyiap mesin kasir bukan pemeriksa
  kasnya.
- **Lima ambang kasir** pada `app_setting`, dapat diatur tiap tenant.
- `modules/pos/pos-context.ts` — aturan konteks transaksi sebagai fungsi murni,
  beserta 30 pengujiannya. Termasuk penentuan tanggal usaha menurut zona waktu
  outlet dan jam pergantian harinya.
- `modules/pos/pos-rbac.spec.ts` — 36 pengujian yang mengikat matriks hak akses
  pada dokumen agar tidak dapat menyimpang diam-diam.

### Ditegakkan basis data, bukan layanan
- **Satu shift terbuka per terminal.** Indeks unik parsial pada `status='OPEN'`.
- **Nomor struk tidak dapat kembar.** Indeks unik parsial.

Keduanya tidak dapat dijamin pemeriksaan di lapisan aplikasi ketika dua kasir
bertransaksi pada milidetik yang sama.

### Keputusan yang perlu dicatat
- **Profil kasir dibuat tersendiri (K1–K5), bukan dengan memperluas P1–P12.**
  Profil berlaku lintas modul: menambahkan `REFUND_APPROVE` atau `CASH_MOVE` ke
  profil manajer modul umum akan memberikannya pula pada marketplace. Hak
  menyetujui refund tidak boleh merembes karena seseorang manajer modul di
  tempat lain.
- **`VOID_LINE`, `VOID_SALE`, dan `VIEW_OTHER_CASHIER` sengaja tidak dibuat**
  meskipun perintah prioritas menyebutkannya. Pembatalan baris adalah `UPDATE`,
  pembatalan transaksi selesai adalah `CANCEL`, dan melihat kasir lain adalah
  persoalan cakupan data yang sudah punya mekanismenya sendiri. Aksi yang
  artinya sama dengan aksi lain membuat matriks hak akses lebih sulit dibaca,
  dan matriks yang sulit dibaca adalah matriks yang salah dikonfigurasi.
- **`pos_terminal` memperoleh `register_status` tersendiri.** Kolom `status`
  yang ada dipakai untuk siklus hidup master; menumpangkan status operasional
  harian di atasnya membuat penonaktifan terminal dan penutupan register saling
  tertukar.

### Diperbaiki
- Profil `K2` kehilangan `DELETE` setelah pengujian menyingkap akibat yang tidak
  langsung terlihat: syarat munculnya tombol Unggah adalah memiliki `UPDATE` dan
  `DELETE` sekaligus, sehingga supervisor kasir akan terhitung berhak mengunggah
  data massal di tengah shift.
- Kelompok pemisahan wewenang tanpa keterangan dilewati diam-diam saat
  penyemaian. `POS_CASH` sempat terkena; keterangannya ditambahkan dan
  aturannya kini benar-benar tersemai pada ketujuh belas skema.

### Bukti
- Migrasi diterapkan ke **17 skema tenant**, seluruhnya berhasil.
- Diperiksa langsung pada basis data: 9 menu POS, 9 aksi baru, 6 peran, 2 aturan
  SoD, 5 setelan, profil K1–K5 terpakai, dan `pos_register_assignment` ada.
- Izin `KASIR_POS` pada `POS_SALE`: `CREATE, DISCOUNT_LINE, HOLD, PRINT, READ,
  RESUME, SELL, UPDATE` — tanpa `APPROVE`, `CANCEL`, `PRICE_OVERRIDE`,
  `DISCOUNT_CART`, maupun `VIEW_COST`.
- `jest` 1114 tes lulus (bertambah 66).

## POS-0 — Audit jalur kritis POS Web

### Ditambahkan
- `docs/pos-web-priority/` — tiga belas dokumen audit: keadaan saat ini, peta
  dependensi kritis, peta pemakaian ulang modul, matriks celah, matriks peran
  dan hak akses, peta model data, peta rute API dan UI, peta kemampuan
  pembayaran, peta posting stok dan akuntansi, garis dasar pengujian, dan
  rencana peluncuran.

### Temuan utama
- **Fondasi data POS sudah ada.** Sembilan belas tabel pada `V006`, termasuk
  `pos_sale` yang sudah memiliki `idempotency_key`, `posting_key`, `offline_id`,
  `sync_status`, dan `version`. Pekerjaan POS adalah membangun layanan dan
  antarmuka di atasnya, bukan merancang ulang basis data.
- **Tidak ada satu pun endpoint `/pos/*` maupun halaman `/app/pos`.** Menu POS
  sudah terdaftar dan menunjuk ke `/app/pos`, tetapi rute itu jatuh ke
  `ComingSoonPage`.
- **`PricingEngineService` bukan untuk POS.** Namanya menyesatkan: mesin itu
  menghitung tagihan langganan SaaS (`planCode`, `billingInterval`,
  `deviceIds`), bukan harga produk di kasir. Mesin kuotasi harga POS harus
  dibangun baru — hanya `DiscountEvaluatorService` yang dapat dipakai ulang.
  Menyimpulkan sebaliknya akan membuat POS-2 diperkirakan jauh lebih ringan
  daripada kenyataannya.
- **Mesin posting akuntansi hanya mengenal dua belas kode `MARKETPLACE_*`.**
  Dua belas kode `POS_*` beserta aturan postingnya perlu ditambahkan, dan akan
  tunduk pada uji kelengkapan yang sama.
- Matriks celah: 66 kemampuan diperiksa — 14 `DONE`, 21 `PARTIAL`, 28 `MISSING`,
  3 `BLOCKED`. Tidak ada `BROKEN` maupun `CONFLICTING`.
- Tiga penghalang berasal dari V8 yang belum pernah dibangun: Pusat Bantuan
  menahan POS-11, ekspor Excel menahan laporan POS-9, dan job cetak PDF menahan
  struk PDF POS-7. Ketiganya menurunkan mutu, bukan menghentikan kasir.

### Garis dasar
- `jest` 1048 tes lulus · `vitest` 35 tes lulus · lint dan `tsc` bersih ·
  `vite build` berhasil.
- **Cakupan pengujian POS saat ini: nol.** Sasaran minimum sepanjang POS-1
  sampai POS-8 adalah 100 pengujian baru; sepanjang seluruh fase, 140.

## Beranda rinci dan empat dokumen penawaran

### Ditambahkan
- **Beranda** kini menjelaskan produknya, bukan hanya menyapa. Sepuluh bagian
  baru: empat masalah yang hendak diselesaikan, kemampuan per modul dengan
  penanda tahap, tiga aplikasi pendamping yang sudah dirilis, tabel perbandingan
  dengan pendekatan lain, skema harga lengkap beserta simulasinya, dua pola
  pemanfaatan, peta jalan, metodologi, dan indikator keberhasilan.
- **`/presentasi`** — presentasi daring 23 slide yang dapat dijalankan langsung di
  layar rapat. Panah kiri-kanan berpindah slide, F membuka layar penuh, titik
  penunjuk dapat diklik untuk melompat.
- **`/proposal`** — proposal delapan bab, siap cetak.
- **`/pks`** — draf Perjanjian Kerja Sama sebelas pasal, siap dibahas tim legal.
  Bagian yang perlu diisi ditampilkan sebagai isian kosong, bukan diisi otomatis
  dengan data penyewa — perjanjian yang terisi otomatis mudah ditandatangani
  tanpa dibaca.
- **`/penawaran`** — surat penawaran resmi satu halaman, siap cetak.
- `content/solusi.ts` sebagai sumber tunggal bagi kelima halaman itu, dan
  `content/solusi.spec.ts` (13 pengujian) yang menjaganya.

### Catatan
- Setiap kemampuan menyatakan tahapnya: **sudah berjalan**, **sedang dibangun**,
  atau **rencana**. POS Web disebut sebagai sedang dibangun, bukan sebagai yang
  sudah tersedia. Sebuah pengujian gagal bila suatu saat seluruh butir berubah
  menjadi "sudah berjalan" sekaligus, supaya perubahan seperti itu harus
  dilakukan secara sadar.
- Angka simulasi biaya diuji terhadap tarif berjenjangnya (`s.pos === outlet ×
  (POS pertama + POS tambahan)`), sehingga harga yang disunting tanpa
  memperbarui simulasinya akan tertangkap sebelum sampai ke calon penyewa.

### Diperbaiki
- Beranda tidak lagi menjadi halaman galat kosong ketika API CMS bermasalah.
  Galatnya disebutkan di atas, dan keterangan produk di bawahnya tetap terbaca.

## Pilihan data contoh saat mendaftar dan pengelolaannya

### Ditambahkan
- Pilihan **"Sertakan data contoh"** pada langkah Profil Bisnis saat pendaftaran.
  Menyala secara bawaan; yang sudah punya data sendiri dapat mematikannya dan
  tetap dapat memasukkannya kemudian dari dalam aplikasi.
- Golongan seed `REFERENCE` / `EXAMPLE` (`SeedKind`). Bawaannya `REFERENCE`,
  sehingga master baru yang lupa ditandai berakhir sebagai data acuan yang aman —
  bukan sebagai data yang dapat terhapus.
- Halaman **Data Contoh** kini menerangkan lebih dahulu apa yang termasuk contoh
  dan apa yang tidak pernah ikut terhapus, beserta kolom golongan pada tabelnya.
- Status verifikasi `SAMPLE_EMPTY`. Ruang kerja tanpa data contoh tidak lagi
  dilaporkan GAGAL — keadaan itu sah, bukan cacat.
- `apps/api/scripts/prove-sample-data-choice.mjs` beserta buktinya di
  `docs/upgrade-v10-v11/bukti-data-contoh.txt` (40 pemeriksaan, seluruhnya lulus).

### Diperbaiki
- **Pembersihan data contoh tidak lagi dapat melumpuhkan penyewa.** Sebelumnya
  pembersihan menghapus setiap baris bertanda `is_sample = TRUE`, dan tiga belas
  data acuan ikut bertanda demikian — di antaranya satuan, bagan akun, metode
  pembayaran, dan templat pemberitahuan. Menekan "Hapus Data Contoh" akan membuat
  penyewa tidak dapat membuat transaksi maupun memposting jurnal, tanpa cara
  memperbaikinya sendiri. Pembersihan kini menyaring pada `seedKind`, dan sebuah
  pengujian menjaga agar penandaannya tetap cocok.
- `verifyTenant` tidak lagi gagal total ketika dependensi sebuah master contoh
  tidak ada. `PRODUCT` menuntut `product_category.MERCHANDISE`, dan kategori itu
  sendiri data contoh yang boleh tidak pernah dibuat; sejak pendaftaran boleh
  menolak data contoh, keadaan itu wajar. Untuk data acuan, dependensi yang hilang
  tetap dilempar sebagai galat.

### Catatan
- Peran, hak akses, dan menu **bukan** data contoh dan tidak pernah tersentuh
  pembersihan — dipastikan oleh `seed-kind.spec.ts` dan oleh naskah bukti.

## [Unreleased]

### Added

- **Keperluan AI untuk sebelas modul (V11-5).** 18 keperluan mencakup
  Eksekutif/BI, Penjualan, CRM, Pembelian, Persediaan, Mutu, Marketplace,
  Keuangan, SDM, Ticketing, Surat, dan Observability. Yang berisiko tinggi
  menyatakan batasnya terang-terangan: ringkasan kehadiran TIDAK dipakai menilai
  orang maupun mengusulkan sanksi, dan penjelasan selisih keuangan adalah dugaan
  yang wajib diperiksa terhadap buku besar.
- **Registri AI diuji terhadap katalog menu yang sebenarnya.** Uji itu langsung
  menangkap dua keperluan yang menunjuk menu root beraksi READ saja — izinnya
  tidak akan pernah dapat diberikan kepada siapa pun, sehingga keduanya menjadi
  tombol yang selalu ditolak.
- **Panel Copilot pada bilah atas (V11-4).** Tersedia di setiap halaman portal
  tenant, dengan aksi yang menyesuaikan halaman yang sedang dibuka. Jawaban AI
  tidak pernah disajikan seperti kebenaran: peringatan tampil SEBELUM jawaban,
  bukti selalu ada dan dapat dibuka, jenis pencarian disebutkan beserta cara
  gagalnya, penyamaran data dilaporkan, dan penilaian diminta.
- **Peringatan kunci environment baru pada update.sh.** Rilis yang menambah
  kunci env tidak gagal saat dijalankan — ia berjalan dengan fitur barunya mati,
  dan itu tidak terlihat sampai ada yang mencoba memakainya lalu bingung.
- **Pencarian semantik dan hibrida (V11-3b).** Penyimpanan vektor memakai
  float8[] beserta fungsi kesamaan kosinus, karena pgvector TIDAK TERSEDIA pada
  server basis data ini — bukan sekadar belum dipasang. Penggabungan hasil
  leksikal dan semantik memakai Reciprocal Rank Fusion yang hanya melihat
  URUTAN: skor ts_rank dan kosinus berada pada skala yang tidak sebanding, dan
  menjumlahkannya membuat hasilnya didominasi skala yang kebetulan lebih besar.
  Cara pencarian ditentukan oleh kenyataan, bukan konfigurasi — ia berpindah ke
  hibrida sendiri begitu model embedding tersedia.
- **Koreksi diagnosis embedding (V11-3b).** Catatan sebelumnya menyimpulkan
  penghalangnya adalah bendera --embeddings pada server. Itu KELIRU. Ollama
  melaporkan capabilities tiap model sebagai ["completion","tools"] — yang
  kurang adalah MODEL embedding, bukan bendera. Pesan galat llama.cpp
  menyesatkan, dan diagnosis yang salah membuat operator menyalakan bendera yang
  tidak berpengaruh lalu menyimpulkan sistemnya rusak.
- **AI Gateway (V11-1).** Satu-satunya pintu menuju model bahasa, seluruhnya di
  sisi server — peramban tidak pernah memanggil penyedia AI langsung. Nama model
  TIDAK PERNAH dikarang: katalog diisi dengan bertanya kepada penyedianya, dan
  kemampuannya ditetapkan dengan MENCOBANYA. Model yang hilang ditandai, bukan
  dihapus. Pemutus arus terbuka setelah tiga kegagalan berturut-turut.
- **AI tidak pernah bertindak (V11-2).** Ditegakkan oleh bentuk, bukan oleh
  peringatan: satu-satunya bentuk keluaran yang ada adalah DRAFT, ANALYSIS, dan
  RECOMMENDATION. Tidak ada nilai yang berarti "kerjakan", sehingga keperluan
  yang membuat AI melakukan pembayaran, posting, persetujuan, penghapusan, atau
  perubahan hak akses tidak dapat dinyatakan sama sekali.
- **AI tidak memberi akses yang tidak dimiliki penggunanya (V11-2).** Izin
  diperiksa terhadap menu keperluannya — tanpa itu, yang tidak berhak membaca
  laporan cukup meminta AI meringkasnya. Data sensitif disamarkan sebelum
  meninggalkan server, dan apa yang disamarkan dilaporkan pada jawabannya.
- **Basis pengetahuan dan pencarian bukti (V11-3).** Pencarian LEKSIKAL memakai
  pencarian teks penuh PostgreSQL, dinyatakan terus terang pada setiap jawaban.
  Pencarian semantik terhalang bendera --embeddings pada server Ollama; bukan
  model yang kurang. Surat RAHASIA tidak diindeks sama sekali, dan izin disaring
  di DALAM kueri supaya potongan terlarang tidak pernah terambil.
- **Copilot sadar-rute (V11-4).** Mencari sendiri bukti tambahan sesuai izin
  penggunanya. Rute menentukan konteks, BUKAN izin — rute datang dari peramban
  dan dapat ditulis apa saja.
- **Empat peran surat dengan pemisahan tugas (V10-8).** Sekretaris, Penyetuju
  Surat, Arsiparis, dan Administrator Tata Kelola Surat — bukan satu peran
  "Administrator Surat". Tata kelola surat memisahkan yang MENYUSUN dari yang
  MENYETUJUI; satu peran yang dapat melakukan keduanya membuat seluruh alur
  persetujuan menjadi hiasan. Sekretaris dan Penyetuju berada pada kelompok
  pemisahan tugas SURAT_APPROVAL sehingga tidak dapat dipegang orang yang sama.
- **Enam templat pemberitahuan surat (V10-8)**, menaikkan katalog templat dari
  10 menjadi 16.
- **Notification Hub (V10-7).** Tabel notifikasi sudah ada sejak V004 dan berisi
  NOL baris — tidak ada satu pun kode yang menulisinya. Kini ia berisi: disposisi
  surat, giliran persetujuan, dan eskalasi batas waktu semuanya menerbitkan
  pemberitahuan bertautan langsung menuju halamannya. Lonceng mendahulukan yang
  MENUNTUT TINDAKAN, bukan yang terbaru — lonceng yang mengurutkan menurut waktu
  akan mengubur permintaan persetujuan kemarin di bawah sepuluh kabar hari ini.
  Ditandai sudah dibaca tidak menghilangkannya dari daftar tindakan: melihat
  permintaan persetujuan tidak sama dengan menyetujuinya.
- **Kanal yang belum berkredensial melaporkan apa adanya (V10-7).** Surel, web
  push, WhatsApp, dan pemberitahuan seluler menuntut kredensial yang belum ada.
  Adapternya melaporkan status UNCONFIGURED beserta APA yang kurang, bukan
  mengarang keberhasilan — melaporkan berhasil padahal tidak terkirim membuat
  orang mengira sudah diberi tahu, dan pekerjaan berhenti menunggu seseorang
  yang tidak pernah tahu ia ditunggu.
- **Eskalasi batas waktu persetujuan surat (V10-7).** V10-6 mencatat batas waktu
  tetapi tidak ada yang membacanya. Kini diperiksa tiap jam, dan keterlambatan
  lebih dari sehari naik menjadi kritis. Eskalasi yang berulang dikelompokkan
  menjadi satu baris berpenghitung — tanpa itu, surat yang terlambat tiga hari
  akan menghasilkan 72 baris lonceng dan membuat lonceng itu diabaikan.
- **Tata kelola surat (V10-6).** Surat masuk beserta disposisi berantai, surat
  keluar dengan persetujuan berjenjang, klasifikasi, loker arsip, masa simpan,
  kop surat, dan penomoran resmi. Dipetakan dari sistem lama dengan tiga
  perubahan sengaja: pola penomoran kini DITEGAKKAN (sistem lama hanya menyimpan
  contoh, dan contoh tidak dapat dieksekusi), penghitung nomor menjadi baris
  tersendiri sehingga nomor kembar menjadi mustahil (dibuktikan dengan 20 surat
  yang diterbitkan serentak), dan alur persetujuan menjadi daftar berurut bukan
  pohon (pohon membolehkan bentuk yang tidak punya arti).
  Nomor resmi baru diambil SETELAH surat disetujui — nomor yang sudah keluar
  tidak dapat ditarik kembali, dan konsep yang batal akan meninggalkan lubang
  penomoran yang tidak dapat dijelaskan saat diaudit.
- **Sembilan menu surat** pada katalog, sebagai root tersendiri bukan cabang di
  bawah Administrasi Sistem — menyetujui surat adalah wewenang jabatan, bukan
  wewenang teknis.
- **Kapasitas pelaku pada jejak audit (V10-5).** `audit_event` sudah mencatat
  SIAPA sejak awal; kini ia menjawab DALAM KAPASITAS APA. Kolomnya terisi
  sendiri dari konteks permintaan — bukan dari 76 pemanggilan audit yang
  masing-masing harus ingat mengisinya. Kolom `actor_role_codes` yang lama
  kosong pada seluruh 258 barisnya justru karena bergantung pada ingatan itu.
- **Dashboard TableAudit (V10-5).** Jejak perubahan baris sudah ditulis trigger
  basis data sejak V003 dan sudah terkumpul belasan ribu baris, tetapi belum
  ada cara membacanya. Kini tersedia ringkasan per tabel, per pelaku, dan
  riwayat lengkap satu baris yang menyebut perbedaan per kolom — bukan dua
  keadaan utuh yang harus dibandingkan sendiri.
- **Jejak pemakaian antarmuka (V10-5).** Menu yang dibuka, halaman yang dilihat,
  dan kendali yang ditekan, beserta laporan menu yang TIDAK PERNAH dibuka
  siapa pun. Disimpan TERPISAH dari jejak audit karena isinya dilaporkan
  peramban dan tidak dapat diverifikasi server; mencampurkannya akan merusak
  nilai jejak audit sebagai bukti. Kueri string dibuang supaya kata kunci
  pencarian tidak ikut tersimpan.
- **Telemetri tersanitasi (V10-1).** Penyamar bersama yang membuang kata sandi,
  token, dan nomor kartu sebelum apa pun masuk ke log — beserta pembersih jejak
  tumpukan yang membuang jalur absolut sehingga struktur direktori server tidak
  ikut tersimpan. Hanya header pada daftar putih yang disimpan; alamat IP
  disamarkan pada oktet terakhir.
- **ErrorLog terpusat (V10-2).** Galat dikelompokkan menurut sidik jari yang
  dihitung saat penulisan, bukan saat pembacaan: galat yang sama dari seribu
  permintaan menjadi satu kelompok dengan penghitung, bukan seribu baris.
  Kelompok yang sudah `RESOLVED` lalu muncul kembali ditandai `REGRESSED`
  otomatis. Ekspor konteks menuntut alasan tertulis.
- **PerformanceLog (V10-3).** Kinerja per rute diagregasi di memori lalu ditulis
  sekali per jendela lima menit — bukan satu baris per permintaan, yang akan
  membuat pengukurnya menjadi bagian dari masalah yang diukurnya. Rute
  dinormalkan sehingga id berbeda tidak menjadi rute berbeda, dan daftarnya
  diurutkan menurut p95 karena rata-rata menyembunyikan ekor yang justru
  dirasakan pengguna. Analisis kebocoran memori menjawab `INSUFFICIENT_EVIDENCE`
  bila sampelnya belum cukup, dan statistik kueri melaporkan `EXTENSION_MISSING`
  apa adanya alih-alih mengarang angka.
- **Peran aktif per sesi (V10-4).** Pengguna yang memegang beberapa peran dapat
  memilih satu peran untuk dipakai, dan izinnya menyempit mengikuti pilihan itu.
  Aturan yang menjaganya: memilih peran hanya MENGURANGI izin, tidak pernah
  menambah — larangan dari peran lain tetap berlaku, sehingga memilih peran
  tidak dapat diam-diam menjadi peningkatan hak. Sesi baru selalu dimulai tanpa
  peran aktif, jadi pengguna yang ada tidak merasakan perubahan apa pun sampai
  ia sendiri memilih. Pergantian berlaku seketika tanpa token baru karena peran
  aktif dibaca dari baris sesi, bukan dari klaim token.
- **Daftar sesi dan pencabutan (V10-4).** "Di mana saja saya sedang masuk",
  lengkap dengan perangkat, alamat IP, dan waktu terakhir dipakai. Sesi dapat
  dicabut satu per satu atau seluruhnya kecuali yang sedang berjalan. Sesi milik
  orang lain dijawab sama seperti sesi yang tidak ada.
- **Pengenalan perangkat (V10-4).** Sesi ditandai "Chrome di Windows" atau
  "Safari di iOS" supaya pemiliknya dapat mengenali mana yang miliknya. Sidiknya
  hash, bukan user agent mentah, dan sengaja TIDAK dipakai sebagai penjaga:
  peramban mengubah user agent setiap kali memperbarui diri.
- **Marketplace publik `belanja.ebisnis.id`.** Katalog yang dapat dibuka siapa
  pun tanpa masuk: penelusuran kategori, pencarian, penyaringan harga dan
  ketersediaan, serta halaman produk. Pemesanan belum dibuka — tombol beli
  sengaja belum ada agar tidak ada tombol yang ditekan tanpa hasil.
- **59 kategori marketplace** dalam sebelas kelompok. Hanya kategori paling
  dalam yang boleh dipilih penjual, sehingga produk selalu dapat ditemukan
  lewat penelusuran. Suplemen, alat kesehatan, dan susu bayi ditandai sebagai
  kategori yang menuntut pemeriksaan tambahan.
- **Pencarian produk** dengan peringkat kesesuaian: judul dinilai lebih tinggi
  daripada nama toko, dan nama toko lebih tinggi daripada deskripsi.
- **25 produk contoh** pada sepuluh kategori, dengan harga dari puluhan ribu
  sampai jutaan. Termasuk barang pesan-dahulu, barang rekondisi, dan produk
  berharga bertingkat, sehingga penyaringan dan pengurutan katalog dapat dicoba
  sungguhan. Produk contoh melewati gerbang penerbitan yang sama dengan produk
  penjual sungguhan — tidak ada yang diistimewakan.
- **Keranjang belanja dan checkout marketplace.** Pengunjung dapat memilih
  barang tanpa mendaftar lebih dahulu, dan keranjangnya terbawa saat ia masuk.
  Barang dari beberapa penjual dikelompokkan menjadi pesanan terpisah per
  penjual, karena penyedia pembayaran belum dapat membagi setoran ke beberapa
  rekening.
- **Peringatan perubahan harga di keranjang.** Bila harga berubah setelah barang
  dimasukkan, pembeli diberi tahu di keranjang dan diminta menyetujuinya —
  bukan baru mengetahuinya di layar pembayaran.
- **Halaman Produk contoh pada Platform Admin.** Administrator dapat
  menyembunyikan seluruh produk contoh dari katalog publik dengan satu tombol,
  atau menyembunyikan satu per satu. Menyembunyikan tidak menghapus datanya,
  sehingga dapat ditampilkan kembali kapan saja.

### Security


- **Endpoint yang tidak menyatakan hak aksesnya kini ditolak, bukan diloloskan.**
  Sebelumnya pemeriksaan hak dilewati begitu saja bila sebuah endpoint lupa
  diberi keterangan hak akses — dan 32 dari 157 endpoint memang belum
  memilikinya, termasuk **seluruh tambah, ubah, dan hapus data master**.
  Ketiga puluh dua endpoint itu kini menyatakan haknya, dan aplikasi menolak
  menyala bila ada endpoint baru yang lupa. (Temuan V6-0-F03.)
- **Batas data mulai benar-benar menyaring.** Sejak Versi 8 sistem menyimpan
  bahwa seorang kepala gudang hanya berhak atas gudangnya, tetapi tidak
  menegakkannya. Kini pemegang batas gudang, outlet, brand, atau departemen
  hanya melihat baris milik penugasannya. Yang belum ditugaskan melihat **nol
  baris**, bukan seluruhnya.
- Penugasan batas data kini per orang, bukan per role, sehingga dua kepala
  gudang dapat memegang gudang yang berbeda.
- **Gambar produk diperiksa dari isinya, bukan dari nama berkasnya.** Berkas
  yang menyamar sebagai gambar lewat ekstensi ditolak, begitu pula gambar yang
  menyatakan ukuran raksasa untuk menghabiskan memori server. Pemeriksaan
  dilakukan tanpa membuka gambarnya.
- **Alamat yang tidak terdaftar ditolak, bukan diarahkan ke toko bawaan.**
  Setiap kesalahan DNS yang mengarah ke platform akan menampilkan halaman tidak
  ditemukan, bukan katalog milik tenant lain. Alasan penolakan dicatat untuk
  penyelidikan tetapi tidak dikembalikan kepada pengunjung.
- **Kredensial penyedia pembayaran tidak pernah melewati catatan tiket.**
  Formulir khusus yang menuntut verifikasi ulang identitas adalah satu-satunya
  jalan masuk; tiket hanya mencatat bahwa kredensial sudah diisi. Balasan tiket
  dibaca banyak orang dan tersimpan selamanya.
- Setiap pembukaan kredensial tercatat beserta alasannya, termasuk yang gagal.
- Hak mengelola credential pembayaran dipisahkan dari administrator toko dan
  menuntut verifikasi tambahan. Petugas layanan pelanggan tidak dapat melihat
  credential maupun menyetujui refund; packer dan picker tidak dapat mengubah
  pesanan.

### Added

- **Produk online dengan gerbang publikasi.** Penjual dapat menyiapkan listing
  dan melihat daftar lengkap syarat yang belum terpenuhi — bukan ditolak satu
  per satu setiap kali menekan terbit. Minimal tiga gambar aktif, satu gambar
  utama, harga, stok, berat, dimensi, kebijakan retur, dan pemeriksaan kepatuhan
  semuanya diperiksa sekaligus.
- Video YouTube opsional pada produk. Yang disimpan hanya id videonya; alamat
  pemutar dibangun sistem, sehingga tautan yang dimasukkan penjual tidak pernah
  menjadi bagian dari halaman.

- **Toko online dengan alamat sendiri.** Tenant dapat membuat toko pada
  marketplace dan menghubungkannya ke domain miliknya. Domain baru dilayani
  setelah kepemilikannya terbukti lewat TXT record atau berkas verifikasi —
  mendaftarkan domain orang lain tidak cukup untuk menerima lalu lintasnya.
- Alamat kanonik otomatis menunjuk domain utama, sehingga mesin pencari tidak
  melihat katalog yang sama pada beberapa alamat.

- **Aktivasi pembayaran online.** Tenant dapat meminta aktivasi akun eSmartlink
  langsung dari Pusat Aktivasi; sistem membuka tiket dukungan dan menautkannya.
  Menekan tombol dua kali tidak membuat tiket kembar.
- Kredensial pembayaran disimpan terenkripsi dan berversi. Rotasi tidak menimpa
  nilai lama, sehingga kredensial yang keliru dapat dikembalikan tanpa meminta
  ulang ke penyedia. Setelah tersimpan, yang terlihat hanya empat karakter
  terakhir.
- Uji kesiapan akun pembayaran beserta riwayatnya.

- **Fondasi marketplace: tenant dapat mendaftar sebagai penjual.** Pusat
  Aktivasi Marketplace menampilkan pemeriksaan kesiapan beserta alasan yang
  dapat ditindaklanjuti — bukan sekadar "belum siap". Pendaftaran berjalan
  melalui 14 tahap yang dapat maju dan mundur sebagaimana kenyataannya, dan
  platform yang memutuskan kapan sebuah toko boleh berjualan.
  Halamannya tersedia di **Pusat Aktivasi Marketplace** pada portal tenant,
  lengkap dalam empat bahasa. Syarat yang belum tersedia pada versi ini
  ditandai berbeda dari syarat yang gagal — yang pertama menunggu fitur
  berikutnya, yang kedua menunggu tindakan Anda.
- 15 kelompok menu marketplace baru: aktivasi, toko online, katalog online,
  penjualan online, pembayaran, reservasi, fulfillment, retur, promosi,
  pelanggan, performa toko, operasi platform, tiket, dan bantuan. Menu
  pengiriman yang sudah ada diperluas, bukan digandakan.
- 33 role marketplace: dari Pengelola Katalog Online, Picker, dan Packer sampai
  Penyetuju Refund dan Moderator Produk Marketplace.
- 14 hak baru termasuk Terbitkan, Ambil Barang, Kemas, Kirim, Setujui Retur,
  Setujui Refund, dan Kelola Credential.
- Perintah `pnpm route:audit` yang memeriksa seluruh endpoint menyatakan hak
  aksesnya, dapat dipakai sebagai gerbang sebelum rilis.
- Audit Versi 9 fase V9-0 pada `docs/upgrade-v9/`: kondisi source, status
  penerapan Versi 8, matriks gap 67 requirement, peta model marketplace,
  inventaris kapabilitas eSmartlink, kendala pembayaran dan settlement, peta
  order/fulfillment/pengiriman, delta menu-role-permission, register 30 risiko
  keamanan, rencana implementasi 16 fase, baseline pengujian, peta pemakaian
  ulang tabel, serta inventaris route API dan UI.

- **Role default Indonesia disemai otomatis saat tenant mendaftar.** Setiap
  tenant baru kini memperoleh 124 role siap pakai — dari Kasir POS, Kepala
  Gudang, dan Akuntan Buku Besar sampai Penyetuju Payroll dan Auditor Internal —
  lengkap dengan hak per menu, batas data, dan aturan pemisahan tugas. Tidak
  perlu lagi menyusun hak akses satu per satu sebelum sistem dapat dipakai.
- Batas data per role: pemegang role bergudang hanya melihat gudang yang
  ditugaskan kepadanya, kasir hanya terminalnya sendiri, dan karyawan hanya
  datanya sendiri.
- Pemisahan tugas ditegakkan saat role ditetapkan, bukan sekadar dicatat.
  Penyiap jurnal tidak dapat sekaligus menjadi penyetujunya; pemesan barang,
  penerima barang, dan pembayar tagihan tidak dapat dirangkap satu orang.
  Pengecualian tetap dimungkinkan, tetapi wajib beralasan, ada penyetujunya,
  dan ada tanggal berakhirnya.
- Empat aksi hak baru: Kembalikan, Delegasikan, Jurnal Balik, dan Baca Audit.
- Perintah `pnpm migrate:tenants` untuk menyusulkan migration dan role baru pada
  tenant yang sudah berjalan, dengan mode `--dry-run` untuk melihat lebih dulu.
- Audit Versi 8 fase V8-0 pada `docs/upgrade-v8/`: kondisi saat ini, inventaris
  menu, matriks gap konten bantuan, matriks gap impor/ekspor, inventaris
  role/duty/privilege, rancangan login Google, dan rencana implementasi.

- Audit Versi 6 fase V6-0 pada `docs/upgrade-v6/`: inventaris kondisi saat ini,
  status regression Versi 5, matriks gap V5→V6, inventaris database dan
  migration, inventaris route API dan UI, baseline pengujian, risk register,
  rencana upgrade additive, dan rencana perubahan version control.
- Karakterisasi SOP legacy pada `docs/upgrade-v6/workflow/`: inventaris class,
  peta state runtime, aturan resolusi aktor, dan keputusan reuse/redesign.
- ADR-007 sampai ADR-011 untuk Versi 6: referral pada control plane, kepemilikan
  effective-dated, routing tenant berbasis host, workflow yang mengorkestrasi
  service yang sama, dan accounting event engine.
- Laporan migrasi Git pada `docs/git-migration/`.
- Berkas `.gitignore` dan `CHANGELOG.md`.

- Berkas deployment untuk Ubuntu 22.04: konfigurasi Apache, unit systemd,
  skrip `install.sh` dan `update.sh` dengan backup dan rollback otomatis,
  contoh environment produksi, serta skrip pembuatan akun pedagang.
- Panduan instalasi dan pembaruan pada `docs/deployment/ubuntu.md`.

- Build frontend memakai `@rollup/wasm-node`, sehingga tidak lagi bergantung
  pada binary native rollup yang menuntut GLIBC 2.32.

### Changed

- **Workspace resmi berpindah ke `C:\opt\eBisnisGithub`.**
- **Source of truth berpindah dari SVN ke GitHub** (`Zishof/eBisnis`, private).
  `C:\opt\eBisnis` menjadi legacy read-only dan tidak lagi dipakai untuk
  pengembangan. SVN tidak lagi dipakai untuk commit, update, maupun deployment.
- Identitas versi memakai Git commit SHA dan tag, bukan revisi SVN.
- Enam role lama (`OWNER`, `MANAGER`, `CASHIER`, `PURCHASING_STAFF`,
  `WAREHOUSE_STAFF`, `DEMO_USER`) **tidak dihapus**, hanya ditandai sebagai role
  lama dan dipetakan ke padanan barunya. Pengguna yang sudah memegangnya tetap
  bekerja seperti biasa.
- Penyemaian izin role kini dikelompokkan per 500 baris, sehingga pendaftaran
  tenant tetap cepat meski jumlah role bertambah dari 6 menjadi 130.

### Security

- Kredensial dalam bentuk teks biasa diredaksi dari dokumentasi sebelum masuk
  repository: connection string pada ADR-005, kredensial pada
  `MASTER_PROMPT_EBISNIS_V5.md`, dan contoh Swagger pada endpoint login.
- Kata sandi super admin pada smoke test tidak lagi di-hardcode; nilainya berasal
  dari `SMOKE_ADMIN_PASSWORD` atau `BOOTSTRAP_SUPER_ADMIN_PASSWORD`.
- `.gitignore` menutup `.env`, private key, sertifikat, dump database, log, dan
  data runtime agar tidak pernah ikut ter-commit.
- Menaikkan `glob` transitif ke `^10.5.0` untuk menutup GHSA-5j98-mcp5-4vw2
  (command injection pada CLI `glob`).
- CI memindai secret pada seluruh riwayat commit dan mengaudit dependency setiap
  push serta setiap pekan.
- Kredensial integrasi bank dan payment pada source legacy `docs/input/`
  diredaksi: API key Bank Kaltimtara, application id, kata sandi VA Esmartlink,
  serta secret key QRIS dan VA JARING. Temuan ini berasal dari gitleaks, bukan
  dari scan manual, dan tercatat pada
  `docs/development/security-incident-2026-07-30-legacy-credentials.md`.

### Fixed

- **Perubahan produk yang tersangkut kini diproses ulang.** Bila proses
  penyegaran katalog mati di tengah jalan, perubahan yang sedang ditanganinya
  tertinggal selamanya dan produk yang sudah diterbitkan tidak pernah muncul —
  tanpa ada pemberitahuan apa pun. Perubahan yang tertinggal lebih dari lima
  menit kini diambil kembali pada putaran berikutnya.
- Sesi demo memakai `platform_user_id` yang valid sehingga `/auth/me` tidak lagi
  gagal; schema demo kini memiliki `user_subject` beserta role `DEMO_USER`.
- Sidebar portal tenant merender menu sampai tingkat ketiga; sebelumnya modul
  pada tingkat tersebut tidak pernah tampil.
- Simulasi diskon menyaring evaluasi berdasarkan kode program yang benar;
  sebelumnya filter selalu bernilai benar sehingga hasilnya tidak tersaring.
- Batas rate limit dapat dikonfigurasi lewat environment sehingga pengujian
  otomatis tidak tertolak oleh limit produksi.

### Known issues

- Kredensial integrasi bank pada source legacy masih ada di riwayat commit
  `a463093`. Rotasi kredensial oleh pemilik integrasi bersifat wajib;
  pembersihan riwayat memerlukan keputusan tersendiri.
- Proteksi branch GitHub tidak aktif karena memerlukan GitHub Pro untuk
  repository privat. Mitigasi lokal berupa hook `pre-push` tersedia; lihat
  `docs/development/branch-protection.md`.
- Endpoint CRUD master, termasuk purge, belum memverifikasi permission
  (`PermissionGuard` keluar lebih awal bila handler tanpa metadata permission).
  Rencana perbaikan ada pada `docs/upgrade-v6/08-upgrade-plan.md` fase V6-0.x.
- Dua schema tenant artefak uji tercatat `V000/FAILED` pada registry padahal
  migration V008 sudah diterapkan. Orkestrator migration berikutnya harus
  menghitung versi dari riwayat, bukan dari registry.
- Client Orval belum pernah digenerate; frontend masih memakai tipe manual.
- Enam advisory `high` masih terbuka pada dependency produksi (`multer`,
  `lodash`, `js-yaml`), seluruhnya transitif dari NestJS 10 dan memerlukan
  upgrade mayor framework. Terdaftar beserta rencananya pada
  `docs/development/security-debt.md`. Tidak ada temuan `critical`.

[Unreleased]: https://github.com/Zishof/eBisnis/commits/main
