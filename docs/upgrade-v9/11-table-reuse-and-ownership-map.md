# 11 — Peta Pemakaian Ulang dan Kepemilikan Tabel

Larangan Versi 9 yang paling mudah dilanggar tanpa disadari:

> "Jangan mengimplementasikan fitur kedua yang paralel hanya karena nama
> class/model berbeda."

Dokumen ini menetapkan, untuk setiap konsep Versi 9, tabel mana yang menjadi
pemiliknya dan tabel mana yang **tidak boleh** dibuat.

## Aturan kepemilikan

```text
Satu konsep = satu tabel pemilik.
Tabel lain boleh menunjuk, tidak boleh menyalin.
Menyalin nilai hanya untuk snapshot yang memang harus beku
  (harga saat pesan, alamat saat kirim).
```

Snapshot adalah pengecualian yang sah: harga pada pesanan harus tetap walau
harga produk berubah. Yang tidak sah adalah menyalin nama produk ke listing lalu
memeliharanya di dua tempat.

## Tabel yang dipakai ulang tanpa penggantinya dibuat

| Konsep | Pemilik | Marketplace menunjuknya lewat | JANGAN buat |
| --- | --- | --- | --- |
| Produk | `product` | `online_listing.product_id` | `marketplace_product` |
| Kategori internal | `product_category` | pemetaan ke kategori marketplace | kategori internal kedua |
| Satuan | `uom` | `online_listing_variant.uom_id` | `marketplace_uom` |
| Harga | `price_book_item` | price book kanal `ONLINE` | `marketplace_price` kanonik |
| **Ledger stok** | `stock_movement` | sumber `ONLINE_ORDER` | ledger stok kedua |
| Saldo stok | `stock_balance` | dibaca untuk ATP | `marketplace_stock` kanonik |
| **Reservasi** | `stock_reservation` | dipakai langsung | `marketplace_stock_reservation` |
| Gudang dan bin | `warehouse`, `warehouse_bin` | lokasi picking | lokasi gudang kedua |
| Outlet | `outlet` | ambil di tempat | `marketplace_pickup_point` |
| Pelanggan | `customer` | pembeli terdaftar dipetakan | pelanggan kedua di tenant |
| Berkas | `file_object` | media listing | penyimpanan berkas kedua |
| Nomor dokumen | `number_sequence` | nomor pesanan | penomoran kedua |
| Idempotensi | `idempotency_record` | callback dan webhook | tabel idempotensi kedua |
| Outbox | `sync_outbox` | projection | outbox kedua |
| Antrean | `job_execution` | worker | antrean kedua |
| Notifikasi | `notification` | pemberitahuan | notifikasi kedua |
| Persetujuan | `workflow_instance` | moderasi, retur, sengketa | mesin alur kedua |
| Jurnal | `journal_entry` | akuntansi marketplace | buku besar kedua |
| Audit | trigger generik V008 | tabel marketplace | audit kedua |
| Role dan izin | `role`, `role_menu_permission` | role marketplace | RBAC kedua |
| Profil hak | `role-profile.ts` | M1–M8 ditambahkan di sana | berkas profil kedua |
| SoD | `segregation_of_duty_*` | aturan marketplace | mesin SoD kedua |
| **Payment order** | `PaymentOrder` | `marketplace_order_id` | `MarketplacePaymentOrder` |
| Callback | `PaymentCallbackEvent` | dipakai langsung | callback kedua |
| Rekonsiliasi | `PaymentReconciliationRun` | dipakai langsung | rekonsiliasi kedua |
| Log H2H | `HostToHostLog` | dipakai langsung | log kedua |
| Diskon | `DiscountProgram` dkk | promo marketplace | mesin diskon kedua |
| Tagihan | `BillingInvoice` | penagihan fee platform | tagihan kedua |

## Yang benar-benar baru

Konsep berikut tidak punya padanan sama sekali. Membuatnya bukan duplikasi.

### Schema platform

```text
MarketplaceProgram              MarketplaceSeller
MarketplaceSellerEnrollment     MarketplaceStoreProjection
MarketplaceListingProjection    MarketplaceCategory
MarketplaceAttribute            MarketplaceSearchDocument
MarketplaceBuyer                MarketplaceCart
MarketplaceCheckout             MarketplaceOrderGroup
TenantPaymentProviderAccount    PaymentProviderCredentialVersion
PaymentProviderCapability       PaymentProviderHealthCheck
MarketplacePolicy               MarketplaceModerationCase
MarketplaceFeeRule              MarketplaceFeeAccrual
MarketplaceDispute              SupportTicket
```

### Schema tenant

```text
online_store                    online_store_domain
online_listing                  online_listing_variant
online_listing_media            online_order
online_fulfillment_order        pick_wave / pick_task
pack_task / package             shipping_provider / quote / booking / label
online_shipment                 tracking_event
online_return                   online_refund
expedition_order                expedition_trip
location_ping                   proof_of_delivery
```

## Tiga keputusan yang perlu dijelaskan

### `PaymentOrder` diperluas, bukan digandakan

Godaan terbesarnya adalah membuat `MarketplacePaymentOrder` supaya tidak menyentuh
tabel yang sudah dipakai produksi. Yang hilang bila itu dilakukan: idempotensi
transaction id, pemrosesan callback, inquiry, rekonsiliasi, dead letter, rate
limit, dan log H2H — tujuh mekanisme yang sudah benar, harus ditulis ulang.

Saat callback ganda tiba, dua jalur berbeda harus sama-sama benar. Satu tabel
dengan satu kolom tambahan lebih aman.

Rinciannya pada [05-payment-and-settlement-constraints.md](05-payment-and-settlement-constraints.md).

### `online_order` terpisah dari `sales_order`

Ini kelihatannya melanggar aturan "satu konsep satu tabel", tetapi keduanya
memang konsep berbeda:

| | `sales_order` | `online_order` |
| --- | --- | --- |
| Sumber | penjualan internal | marketplace |
| Status | sederhana | 24 tahap |
| Pembeli | `customer` | `MarketplaceBuyer` |
| Pembayaran | tempo atau tunai | payment order per seller |
| Alamat | dari master | snapshot beku |
| Retur | — | alur lengkap |

Tautannya satu arah: pesanan lunas **membuat** `sales_order` sebagai dokumen
penjualan, dengan `online_order.sales_order_id` sebagai penunjuk. Akuntansi dan
stok tetap membaca `sales_order`, sehingga laporan penjualan yang ada tidak perlu
tahu tentang marketplace.

Pola ini identik dengan `purchase_backorder` yang membuat `purchase_order`.

### Armada internal dibangun dengan nama Versi 7

Dokumen Versi 9 melarang membuat model armada kedua dan meminta memakai ulang
enam model Versi 7. Tidak satu pun ada.

Membangunnya dengan nama yang diminta Versi 7 — `expedition_order`,
`expedition_trip`, `trip_stop`, `tracking_session`, `location_ping`,
`proof_of_delivery` — berarti bila modul ekspedisi Versi 7 kelak dikerjakan, ia
memakai model yang sama. Tidak ada yang perlu digabungkan.

## Cara memeriksa aturan ini ditegakkan

Test yang ditambahkan pada V9-1 dan dijalankan seterusnya:

```text
tidak ada tabel marketplace yang menyimpan nama atau harga produk
  di luar kolom snapshot yang ditandai eksplisit
setiap pergerakan stok dari pesanan online masuk ke stock_movement
setiap pembayaran marketplace memakai PaymentOrder
tidak ada tabel dengan akhiran _v2, _new, atau _marketplace
  yang menduplikasi tabel yang sudah ada
```

Butir terakhir dijalankan sebagai pemeriksaan CI atas daftar tabel, bukan
kesepakatan lisan. Aturan yang hanya ditulis di dokumen akan dilanggar; aturan
yang diperiksa mesin tidak.
