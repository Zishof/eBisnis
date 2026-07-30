# 13 — Inventaris Route UI

Commit `7399fb8`. **55 route** pada `apps/web/src/app/App.tsx`, **28 halaman**.

## Route yang ada

### Publik (8)

```text
/           /harga       /berita      /berita/:slug
/kontak     /tentang     /syarat      /privasi
```

Situs pemasaran platform. Bukan storefront tenant.

### Autentikasi (5)

```text
/masuk   /daftar   /daftar/berhasil   /demo   /ganti-kata-sandi
```

### Aplikasi tenant `/app` (35)

Master data lewat satu halaman generik `MasterListPage`:

```text
products  product-categories  uoms  suppliers  product-suppliers
customers  customer-groups  supplier-groups  warehouses  warehouse-types
outlets  outlet-types  regions  stock-policies  payment-methods
payment-terms  tax-categories  departments  job-positions  leave-types
vehicle-types  chart-of-accounts  roles
```

Halaman transaksi tersendiri:

```text
request-orders  purchase-orders  goods-receipts  backorders
internal-transfers  stock-tree  sample-data  devices
subscription/checkout  subscription/invoices
```

### Platform `/platform` (5)

```text
tenants  registrations  packages  cms  audit
```

## Pola yang dipakai ulang Versi 9

**`MasterListPage` generik.** Satu halaman melayani 23 sumber daya master lewat
registry. Listing, kategori marketplace, dan atribut dapat memakainya, sehingga
tidak perlu 23 halaman baru.

**`DocumentListPage`.** Pola daftar dokumen dengan status dan aksi. Order,
fulfillment, dan pengiriman mengikutinya.

**Struktur halaman transaksi.** `GoodsReceiptPage` adalah contoh terlengkap:
daftar, detail, aksi bertahap, dan validasi. Halaman penerimaan retur mengikuti
bentuk yang sama.

## Yang harus dibangun

### Storefront publik — aplikasi dengan sifat berbeda

```text
belanja.ebisnis.id/                     beranda marketplace
belanja.ebisnis.id/kategori/:slug       kategori
belanja.ebisnis.id/cari                 pencarian
belanja.ebisnis.id/toko/:slug           halaman toko
belanja.ebisnis.id/produk/:slug         detail produk
belanja.ebisnis.id/keranjang            keranjang
belanja.ebisnis.id/checkout             checkout
belanja.ebisnis.id/pesanan/:id          status pesanan
belanja.ebisnis.id/akun/*               akun pembeli
```

Ditambah custom domain tenant yang menyajikan rute yang sama, tetapi hanya
katalog tenant tersebut.

**Ini berbeda sifatnya dari `/app`.** Halaman `/app` melayani pengguna yang sudah
masuk dengan konteks tenant dari sesi. Storefront melayani pengunjung anonim, dan
konteksnya berasal dari **host**.

Konsekuensi teknis yang harus diputuskan pada V9-3 dan V9-5:

| Pertimbangan | Alasan |
| --- | --- |
| Bundle terpisah | pengunjung marketplace tidak perlu mengunduh seluruh ERP |
| Render sisi server atau prerender | SEO menuntut HTML berisi konten, bukan halaman kosong yang diisi JavaScript |
| Cache agresif | katalog publik dibaca jauh lebih sering daripada diubah |
| Tanpa token tenant di klien | pengunjung tidak boleh memegang konteks tenant apa pun |

Aplikasi yang ada adalah Vite SPA tanpa render sisi server. Untuk halaman produk
yang harus terindeks mesin pencari, SPA murni berarti mesin pencari menerima
halaman kosong. Keputusan antara prerender saat build, render sisi server, atau
snapshot HTML ditulis sebagai ADR pada V9-5 setelah diukur, bukan diputuskan
sekarang tanpa data.

### Seller center — mengikuti pola `/app`

```text
/app/marketplace/aktivasi          /app/marketplace/toko
/app/marketplace/listing           /app/marketplace/media
/app/marketplace/pesanan           /app/marketplace/pembayaran
/app/marketplace/fulfillment       /app/marketplace/picking
/app/marketplace/packing           /app/marketplace/pengiriman
/app/marketplace/retur             /app/marketplace/promo
/app/marketplace/chat              /app/marketplace/ulasan
/app/marketplace/performa
```

Semuanya di dalam `/app` yang sudah ada, memakai layout, i18n, dan permission
yang sama.

### Platform marketplace

```text
/platform/marketplace/sellers      /platform/marketplace/aktivasi
/platform/marketplace/moderasi     /platform/marketplace/kategori
/platform/marketplace/kebijakan    /platform/marketplace/fee
/platform/marketplace/rekonsiliasi /platform/marketplace/sengketa
```

## Yang perlu diperhatikan

**Menu tersembunyi bukan otorisasi.** Sudah dinyatakan sejak Versi 8 dan berlaku
penuh di sini. Setiap halaman marketplace wajib punya pemeriksaan permission di
server; menyembunyikan tautan hanya kenyamanan.

**i18n.** Sistem sudah memakai react-i18next dengan id, en, ar (RTL), dan zh-CN.
Halaman marketplace publik menambah beban terjemahan yang tidak kecil — nama
kategori, atribut, dan kebijakan toko semuanya perlu terjemahan. Model
`MarketplaceCategoryTranslation` dan `MarketplaceStoreTranslation` sudah
mengantisipasinya.

**Aksesibilitas.** Sudah ada spec Playwright `accessibility-responsive.spec.ts`.
Halaman publik menuntut standar yang lebih tinggi daripada halaman internal,
karena penggunanya tidak dapat dilatih.
