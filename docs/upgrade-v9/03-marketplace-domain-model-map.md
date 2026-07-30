# 03 — Peta Model Domain Marketplace

Menentukan **di mana** setiap konsep Versi 9 tinggal, dan mana yang memakai ulang
model yang sudah ada. Tujuannya satu: mencegah model kedua untuk hal yang sama.

## Prinsip penempatan

```text
Data kanonik transaksi  -> schema tenant
Data lintas tenant      -> schema platform
Projection untuk publik -> schema platform, hanya yang dipublikasikan
```

Marketplace publik tidak membaca schema tenant pada setiap permintaan. Selain
lambat, ia juga menuntut koneksi ke ratusan schema dari satu permintaan anonim —
yang berarti satu kesalahan penyaringan membocorkan data seller lain.

## Aliran

```text
Tenant: product, price_book, stock_balance
  └─ perubahan
       └─ domain event
            └─ sync_outbox (tabel tenant, sudah ada)
                 └─ projection worker
                      └─ platform: listing projection + indeks cari
                           └─ belanja.ebisnis.id
```

`sync_outbox` sudah ada sebagai tabel sejak V001 tetapi **tidak dipakai satu pun
service**. Versi 9 menjadi pemakai pertamanya. Ini kebetulan yang
menguntungkan — polanya sudah dirancang, tinggal diisi.

## Penempatan per konsep

### Schema platform

| Konsep | Model | Alasan |
| --- | --- | --- |
| Program marketplace | `MarketplaceProgram` | satu untuk seluruh platform |
| Seller dan pendaftaran | `MarketplaceSeller`, `MarketplaceSellerEnrollment` | platform yang menyetujui |
| Projection toko | `MarketplaceStoreProjection` | dibaca publik |
| Projection listing | `MarketplaceListingProjection` + varian + media | dibaca publik |
| Kategori dan atribut | `MarketplaceCategory`, `MarketplaceAttribute` | seragam lintas seller |
| Dokumen pencarian | `MarketplaceSearchDocument` | indeks global |
| Pembeli | `MarketplaceBuyer` + alamat | satu pembeli belanja lintas seller |
| Keranjang dan checkout | `MarketplaceCart`, `MarketplaceCheckout` | lintas seller sebelum dipecah |
| Grup order | `MarketplaceOrderGroup` | menyatukan order lintas seller |
| Akun provider tenant | `TenantPaymentProviderAccount` | pembayaran sudah di platform |
| Kebijakan dan moderasi | `MarketplacePolicy`, `MarketplaceModerationCase` | platform yang menegakkan |
| Fee | `MarketplaceFeeRule`, `MarketplaceFeeAccrual` | platform yang menagih |
| Sengketa | `MarketplaceDispute` | platform sebagai penengah |
| Tiket aktivasi | `SupportTicket` | platform yang melayani |

### Schema tenant

| Konsep | Model | Alasan |
| --- | --- | --- |
| Toko online | `online_store` + setting, kebijakan, halaman | milik tenant |
| Listing kanonik | `online_listing` + versi, varian, media, harga | sumber kebenaran ada di tenant |
| Order seller | `online_order`, `online_order_line` | transaksi milik tenant |
| Reservasi stok | **`stock_reservation` yang sudah ada** | stok milik tenant |
| Fulfillment | `online_fulfillment_order`, pick, pack, package | operasi gudang tenant |
| Pengiriman | `online_shipment`, tracking | milik tenant |
| Retur dan refund | `online_return`, `online_refund` | barang kembali ke gudang tenant |
| Chat dan ulasan | projection di tenant, kanonik di platform | seller membalas dari panelnya |

### Yang dipakai ulang tanpa model baru

| Kebutuhan V9 | Dipakai | Catatan |
| --- | --- | --- |
| Produk | `product` | listing menunjuk produk, tidak menggandakannya |
| Kategori internal | `product_category` | terpisah dari kategori marketplace, dipetakan |
| Harga | `price_book`, `price_book_item` | price book kanal ONLINE |
| Stok | `stock_balance`, `stock_movement` | ledger tetap satu |
| **Reservasi** | `stock_reservation` | sudah ada, tinggal dipakai |
| Gudang | `warehouse`, `warehouse_zone`, `warehouse_bin` | lokasi picking |
| Berkas | `file_object`, `entity_attachment` | media listing |
| Antrean | `job_execution` | worker projection |
| Outbox | `sync_outbox` | projection |
| Nomor dokumen | `number_sequence` | nomor order |
| Idempotensi | `idempotency_record` | callback dan webhook |
| Persetujuan | `workflow_definition`, `workflow_instance` | moderasi, retur, sengketa |
| Jurnal | `journal_entry`, `chart_of_account` | akuntansi marketplace |
| Diskon | `DiscountProgram` dkk | promo marketplace |
| Notifikasi | `notification`, `notification_template` | pemberitahuan pembeli dan seller |
| Audit | trigger generik V008 | tabel marketplace ikut terekam |
| Pembayaran | `PaymentOrder` dkk | setelah `invoiceId` dilonggarkan |

## Kekeliruan yang harus dihindari

### `Website` bukan toko tenant

```prisma
model Website {
  primaryDomain String
  // tidak ada tenantId
}
model WebsiteDomain {
  domain String
  // tidak ada verifiedAt, tidak ada token verifikasi
}
```

Keduanya melayani situs pemasaran platform (ebisnis.id). Memakainya untuk toko
tenant berarti mencampur konten platform dengan konten tenant di satu tabel tanpa
pemisah — persis jenis kesalahan yang membuat satu kekeliruan query menampilkan
halaman tenant lain.

Toko tenant memakai `online_store` di schema tenant, dengan
`MarketplaceStoreDomain` di platform sebagai registry domain terverifikasi.

### Domain harus diverifikasi sebelum dipercaya

`WebsiteDomain` tidak punya verifikasi. Untuk custom domain tenant, verifikasi
bukan formalitas: tanpa itu, tenant A dapat mendaftarkan `tokojoni.com` milik
tenant B dan menerima lalu lintasnya.

```text
tenant mendaftarkan domain
-> sistem menerbitkan token
-> tenant memasang TXT record atau berkas .well-known
-> sistem memeriksa
-> verifiedAt terisi
-> baru domain dilayani
```

Host yang tidak ada pada registry terverifikasi **ditolak**, bukan diarahkan ke
tenant bawaan.

### Listing bukan salinan produk

Listing menunjuk `product_id` dan menambahkan atribut khusus penjualan online:
judul online, deskripsi online, kategori marketplace, media, kebijakan pengiriman.

Menyalin nama dan harga produk ke listing membuat dua sumber kebenaran yang
segera menyimpang.

### Order marketplace dan sales order

`sales_order` sudah ada. Pertanyaannya: apakah order marketplace memakainya?

**Tidak untuk kanonik, ya untuk hilir.** Order marketplace punya siklus hidup 24
status, kelompok seller, snapshot alamat, dan tautan pembayaran yang tidak ada
pada `sales_order`. Memaksakannya membuat `sales_order` menanggung dua makna.

Yang dilakukan: `online_order` sebagai kanonik, dan ketika pesanan lunas ia
**membuat** `sales_order` sebagai dokumen penjualan untuk akuntansi dan stok.
Satu arah, dengan tautan eksplisit. Ini pola yang sama seperti
`purchase_backorder` yang membuat `purchase_order`.

### Armada internal tidak dapat dipakai ulang

Dokumen Versi 9 meminta memakai ulang `ExpeditionOrder`, `ExpeditionTrip`,
`TripStop`, `TrackingSession`, `LocationPing`, `ProofOfDelivery` dari Versi 7.

Tidak satu pun ada. Yang ada hanya `carrier` dan `vehicle_type` sebagai master
data. Maka pengiriman armada internal dibangun pada V9-9, dan larangan "jangan
membuat model armada kedua" tetap dihormati dengan cara membangunnya **sekali**,
dengan nama yang sama seperti yang diminta Versi 7, sehingga bila modul Versi 7
kelak dikerjakan ia memakai model yang sama.

## Kunci lintas schema

Projection menautkan platform ke tenant memakai UUID global:

```text
tenantId          UUID  -> platform.tenant
schemaName        TEXT  -> platform.tenant_schema_registry
tenantListingId   UUID  -> <tenant>.online_listing.id
tenantOrderId     UUID  -> <tenant>.online_order.id
```

Tidak ada foreign key lintas schema — PostgreSQL tidak menjaminnya antar-schema
dinamis. Konsistensi dijaga worker projection dan pemeriksaan berkala.

**Nama schema tidak pernah berasal dari permintaan publik.** Ia selalu dicari
dari `platform.tenant_schema_registry` berdasarkan id yang sudah terverifikasi.
Aturan ini berlaku sejak Versi 5 dan tidak berubah.
