# Penjelasan Lengkap Website dan Aplikasi Web eBisnis

Tanggal inventarisasi: **15 Agustus 2026 (Asia/Jakarta)**  
Sumber: repository `Zishof/eBisnis`, branch `main`, baseline `dfdf5979`  
Tujuan dokumen: menjadi kontrak informasi sebelum fungsi Web eBisnis dipindahkan
ke AIS Java/JSP.

## 1. Ringkasan Produk

eBisnis bukan satu website sederhana. Repository ini merupakan platform SaaS
multi-tenant yang memuat:

- website publik dan CMS;
- autentikasi, pendaftaran tenant, demo, serta pemulihan akun;
- portal operasional tenant ERP/POS;
- Sales dan Inventory 48 layar;
- POS umum dan POS Apotik;
- eMedik untuk fasilitas kesehatan;
- ePesantren, eSchool, dan fondasi eCampus;
- eKoperasi dan portal anggota;
- marketplace, katalog, toko, checkout, order, dan fulfillment;
- portal Platform Super Admin;
- langganan, billing, pembayaran, notifikasi, audit, observability, dan AI;
- Flutter Windows/Android yang memakai kontrak API yang sama.

Saat ini Web dibuat dengan React 18, Vite 6, dan TypeScript strict. Backend dibuat
dengan NestJS 10, Prisma 6, dan PostgreSQL. Flutter bukan bagian website, tetapi
harus diperlakukan sebagai konsumen API yang tidak boleh rusak ketika website
dipindahkan ke AIS.

## 2. Arsitektur Repository eBisnis

| Lokasi | Tanggung jawab |
| --- | --- |
| `apps/web` | Website publik, portal tenant, portal platform, seluruh halaman React |
| `apps/api` | API NestJS, autentikasi, tenant resolver, service bisnis dan integration |
| `apps/pos-flutter` | POS/Inventory Windows dan Android |
| `apps/pesantren-security-gate-flutter` | Klien gerbang/security pesantren |
| `packages` | Paket bersama dalam monorepo |
| `docs` | ADR, handover, mapping, data dictionary, UAT dan evidence |
| `deploy` | Apache, systemd, onboarding, import legacy, install dan update server |
| `.github/workflows` | CI, E2E, migration check, security, golden, rilis Flutter |

API default berjalan di port `3000` dengan prefix `/api/v1`; Web development di
port `5173` dan mem-proxy `/api` ke API. Produksi menggunakan Apache di depan Web
dan API. Swagger tersedia di `/docs`, OpenAPI di `/api-json`, dan health check di
`/health`.

## 3. Model Multi-Tenant dan Data

eBisnis memakai PostgreSQL dengan **schema-per-tenant**:

- `platform`: control plane tenant, akun platform, paket, pendaftaran, billing,
  dan konfigurasi bersama;
- `platform__audit`: audit control plane;
- `<tenant>`: data operasional masing-masing tenant;
- `<tenant>__audit`: audit append-only tenant.

Nama schema tidak boleh berasal langsung dari URL, form, header buatan pengguna,
atau parameter servlet. Nama schema hanya boleh diambil dari registry tenant yang
terverifikasi. Pola ini merupakan batas keamanan utama dan harus dipertahankan
di AIS.

Aturan data penting:

- password menggunakan hash, tidak disimpan sebagai teks biasa;
- stock movement bersifat immutable; koreksi memakai reversal;
- audit bersifat append-only;
- lifecycle master memakai aktif/nonaktif dan guard referensi;
- transaksi penting memakai idempotency agar retry tidak menggandakan posting;
- harga, HPP, salesperson, pajak, dan kondisi transaksi disnapshot ketika posting;
- migration tenant bersifat berurutan dan aditif; migration applied tidak diedit.

## 4. Kelompok Website dan Route Saat Ini

### 4.1 Website publik eBisnis

Fungsi publik utama:

- `/`: landing sesuai host;
- `/harga`: paket dan harga;
- `/presentasi`, `/proposal`, `/pks`, `/penawaran`: dokumen komersial;
- `/berita` dan `/berita/:slug`: berita/CMS;
- `/kontak`, `/tentang`, `/syarat`, `/privasi`;
- `/masuk`, `/daftar`, `/daftar/berhasil`, `/ganti-kata-sandi`;
- `/demo`: masuk ke sandbox demo;
- `/contoh-usaha/:vertical`: contoh usaha;
- `/inventory` dan `/panduan/inventory-sales`.

Isi dan identitas halaman dapat berubah berdasarkan host. Karena itu hasil akhir
tidak boleh hanya memindahkan satu landing page generik.

### 4.2 Portal tenant umum

Ruang kerja tenant berada di `/app/*` dan dilindungi autentikasi serta RBAC.
Kelompok fungsinya:

- dashboard, notifikasi, approval, support/tiket;
- produk, kategori, satuan, supplier, customer, grup, gudang, outlet, region;
- kebijakan stok, metode/termin pembayaran, pajak;
- department, jabatan, cuti, kendaraan;
- chart of accounts dan journal entries;
- request order, purchase order, goods receipt, backorder;
- transfer internal, stock tree, stock movement, stock alert;
- sales order dan sales report;
- role, user, permission, audit, setting;
- subscription, invoice, perangkat, marketplace activation, serta sample data.

### 4.3 Sales dan Inventory 48 layar

Vertical ini mencakup proses dari master sampai laporan:

1. Supplier, daftar/detail supplier, customer, daftar/detail customer, dan sales.
2. Stok barang, opname, harga beli/jual, harga supplier/customer, print/export.
3. Pembelian supplier, hutang, pembayaran, histori, aging, faktur, dan laporan.
4. Penjualan sales, piutang, pembayaran/collection, nota dibawa sales, dan laporan.
5. Kas/jurnal, chart of accounts, laba kotor, serta laba/rugi.

Vertical slice yang sudah tersedia mencakup FEFO, credit guard, harga khusus,
dua diskon pembelian, PO sampai goods receipt/AP, order sampai invoice/AR,
partial payment, reversal, custody nota, report snapshot, print log, offline sales,
dan conflict registry. Paritas 100% belum boleh diklaim sebelum seluruh evidence
per surface, rekonsiliasi legacy, peripheral, dan UAT selesai.

Referensi rinci:

- [`../implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md`](../implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md)
- [`../implementation/inventory-sales-48/parity-48.json`](../implementation/inventory-sales-48/parity-48.json)
- [`../session-notes/2026-08-11-handover-pos-inventory-48-layar.md`](../session-notes/2026-08-11-handover-pos-inventory-48-layar.md)

### 4.4 POS dan POS Apotik

POS umum mencakup kasir, transaksi ditahan, diskon/promosi, laporan, perangkat,
shift, pembayaran, retur, dan void. POS Apotik menambahkan kebutuhan farmasi:

- pencarian obat/batch/expiry;
- penjualan dan pembelian farmasi;
- racikan;
- riwayat, retur, void, perangkat, dan shift;
- keterhubungan ke resep dan penyerahan obat eMedik.

Flutter Windows/Android dan auto-update release merupakan bagian penting dari
ekosistem ini. Migrasi Web ke JSP tidak berarti menghapus API yang dipakai klien
Flutter.

### 4.5 eMedik

Host utama mencakup `emedik.id`, tenant `*.emedik.id`, `apotik.emedik.id`, dan
host demo/tenant apotik. Modul yang telah dibuat mencakup:

- fasilitas, unit, dan pemberi layanan;
- pasien dan deteksi duplikasi;
- pendaftaran, antrean, rawat jalan, kunjungan, rawat inap, dan layanan akut;
- resep, penyerahan, formularium, dan pemberian obat;
- lab: pesanan, spesimen, dan hasil;
- HIM/rekam medis, keselamatan, mutu, dan komunitas;
- klaim, telaah klaim, BPJS, SEP, dan kepesertaan;
- tarif, penjamin, layanan, terminologi, KFA, dan SATUSEHAT;
- fee policy, contributor, contract, settlement, dan distribusi;
- alat, gateway, maintenance, device adapter, serta pemetaan kode;
- portal pasien, pelepasan hasil, data contoh, laporan, accounting,
  reconciliation, investor dashboard, zona data, dan penjaga AI.

Sebagian integrasi eksternal tetap membutuhkan credential, sandbox/production
endpoint, dan UAT bersama mitra.

### 4.6 ePesantren, eSchool, dan eCampus

Area publik memakai portal `santri.info`, situs pondok berbasis host, PSB, berita,
unit, status pendaftaran, dan verifikasi rapor. Area tenant mencakup:

- profil dan unit pendidikan;
- santri, asrama, penempatan, dan tagihan;
- PSB, rombongan, kurikulum, jadwal, guru;
- kajian, diniyah/halaqah, tahfiz;
- kartu, presensi, nilai, akademik, skala huruf, absensi guru;
- ekstrakurikuler, prestasi, buku penghubung, izin, pelanggaran;
- dompet, katering, laporan, DAPODIK, gerbang, portal wali, dan kiosk.

eSchool mempunyai dashboard, DAPODIK, dan route modul operasional. eCampus masih
memiliki gap dan tidak boleh dianggap selesai hanya karena route-nya tersedia.

### 4.7 eKoperasi

Fungsi koperasi mencakup situs publik berbasis host, portal anggota, ringkasan,
simpanan, pinjaman, SHU, RAT, pengaduan, pemberitahuan, serta pemasangan/pembersihan
data contoh. Operasi data contoh wajib tetap di balik autentikasi.

### 4.8 Marketplace dan storefront

Marketplace publik memakai route `/belanja`, pencarian, detail produk per toko,
dan halaman pelanggan. Backend mencakup katalog, listing, store, cart, checkout,
order, seller order, platform order, fulfillment, marketplace activation, dan
domain toko. Pemilihan toko/tenant berasal dari host serta registry, bukan slug
yang dipercaya begitu saja.

### 4.9 Portal Platform Super Admin

Portal `/platform/*` terpisah dari tenant biasa dan hanya untuk platform staff.
Fungsi utamanya meliputi dashboard, tenant/registration, package/pricing, CMS,
sample data, marketplace/domain, observability, security, AI, billing, dan
operasi platform lainnya. Pemisahan platform dan tenant wajib dipertahankan.

## 5. Autentikasi, Otorisasi, dan Audit

eBisnis saat ini memakai access token berumur pendek dan refresh token berotasi.
Route API wajib menyatakan kebijakan aksesnya; startup gagal bila ditemukan route
tanpa deklarasi otorisasi. Web juga memakai tenant gate dan role/permission.

Saat dipindahkan ke AIS:

- jangan menganggap `JSESSIONID` otomatis setara dengan JWT eBisnis;
- buat adapter identitas yang memetakan user AIS ke tenant dan role eBisnis;
- server tetap memvalidasi permission pada setiap command, bukan hanya
  menyembunyikan tombol JSP;
- semua POST/PUT/DELETE native JSP/servlet wajib CSRF-protected;
- escape semua keluaran JSP dan whitelist parameter sort/filter;
- audit harus mencatat actor, tenant, request ID, aksi, entity, before/after yang
  sudah dimask, hasil, serta alasan reversal/reprint;
- platform staff dan tenant user tidak boleh bercampur.

## 6. Perilaku yang Tidak Boleh Hilang Saat Migrasi

- isolasi schema tenant;
- idempotency dan retry aman;
- transaksi database atomik;
- immutable stock/accounting movement dan reversal;
- offline outbox Flutter;
- RBAC per aksi;
- audit append-only;
- print/export, snapshot, watermark, approval, reprint log;
- host-based branding/routing;
- pagination, filter, search, dan validasi;
- API kompatibel untuk Windows dan Android;
- health check, migration gate, rollback, CI, dan evidence UAT.

Memindahkan tampilan tanpa mempertahankan aturan di atas bukan migrasi lengkap.
