# 06 — Peta Order, Fulfillment, dan Pengiriman

Menelusuri satu pesanan dari keranjang sampai terkirim, menandai di setiap
langkah apa yang sudah ada dan apa yang harus dibangun.

## Alur lengkap

```text
keranjang
  └─ checkout divalidasi
       └─ reservasi stok              stock_reservation ADA
            └─ payment order          PaymentOrder ADA (perlu dilonggarkan)
                 └─ callback lunas    PaymentCallbackEvent ADA
                      └─ commit reservasi
                           └─ order marketplace    BARU
                                └─ sales_order      ADA (dibuat sebagai hilir)
                                     └─ fulfillment order   BARU
                                          └─ pick wave      BARU
                                               └─ pick task + scan   BARU
                                                    └─ pack task     BARU
                                                         └─ package  BARU
                                                              └─ label     BARU
                                                                   └─ booking   BARU
                                                                        └─ manifest  BARU
                                                                             └─ tracking  BARU
                                                                                  └─ POD    BARU
                                                                                       └─ selesai
```

## Yang sudah ada dan dipakai ulang

### `stock_reservation`

Ada sejak V004. Ini temuan yang menguntungkan: bagian tersulit dari checkout —
menahan stok tanpa mengurangi ledger — sudah punya tabelnya.

Yang perlu ditambahkan hanyalah layanannya: reservasi dengan penguncian baris,
kedaluwarsa, komit, dan pelepasan idempoten.

### `stock_movement`

Ledger tak dapat diubah dengan trigger penjaga sejak V008. Marketplace **tidak
membuat ledger kedua**; pergerakan stok dari pesanan online masuk ke ledger yang
sama dengan sumber `ONLINE_ORDER`.

### `warehouse`, `warehouse_zone`, `warehouse_bin`

Struktur lokasi lengkap. Picking memakai `warehouse_bin` sebagai lokasi ambil,
bukan membuat struktur lokasi baru.

### `goods_receipt` sebagai pola

Rantai penerimaan barang yang sudah ada — dengan inspeksi, selisih, validasi, dan
pembalikan validasi — adalah pola terdekat untuk retur. Retur marketplace
mengikuti bentuk yang sama: terima, periksa, putuskan, catat selisih.

### `carrier`

Master ekspedisi ada. Yang tidak ada adalah abstraksi provider: quote, booking,
label, tracking, webhook.

### `sales_order`

Ada dengan `sales_order_line`. Order marketplace **tidak menggantikannya** dan
**tidak dipaksakan ke dalamnya**.

Alasannya, order marketplace punya yang tidak dimiliki `sales_order`:

```text
24 status siklus hidup           kelompok seller
snapshot alamat dan harga        tautan pembayaran per seller
tautan retur dan sengketa        garis waktu peristiwa
```

Memaksakan semuanya ke `sales_order` membuat satu tabel menanggung dua makna dan
merusak laporan penjualan yang sudah ada.

Yang dilakukan: ketika pesanan marketplace lunas, ia **membuat** `sales_order`
sebagai dokumen penjualan untuk akuntansi dan stok, dengan tautan eksplisit
`online_order.sales_order_id`. Satu arah, satu sumber.

Pola ini sama persis dengan `purchase_backorder` yang membuat `purchase_order`,
sehingga tidak memperkenalkan konsep baru.

## Yang harus dibangun

| Lapisan | Model | Kompleksitas | Catatan |
| --- | --- | --- | --- |
| Order | `online_order`, `online_order_line`, snapshot, riwayat status, garis waktu | sedang | 24 status; transisi wajib tervalidasi |
| Reservasi | layanan saja | sedang | tabel sudah ada |
| Routing | `order_routing_rule`, `fulfillment_location`, `allocation` | sedang | stok, jarak, SLA, kapasitas |
| Fulfillment | `fulfillment_order` + baris | rendah | menunjuk order |
| Picking | `pick_wave`, `pick_task`, `pick_confirmation` | sedang | pemindaian SKU, batch, serial |
| Packing | `packing_station`, `pack_task`, `package`, `package_line` | sedang | berat dan dimensi |
| Kemasan | `packaging_material`, `packaging_rule` | rendah | mengurangi stok bahan habis pakai |
| Pengiriman | `shipping_provider`, `service`, `quote`, `booking`, `label`, `manifest` | **tinggi** | abstraksi provider |
| Pelacakan | `shipment`, `shipment_event`, `tracking_event` | sedang | webhook idempoten |
| Armada internal | `expedition_order`, `expedition_trip`, `trip_stop`, `tracking_session`, `location_ping`, `proof_of_delivery` | **tinggi** | **tidak ada yang dapat dipakai ulang** |

## Armada internal

Dokumen Versi 9 meminta memakai ulang enam model Versi 7 dan melarang membuat
model armada kedua. Pemeriksaan menunjukkan **tidak satu pun ada** — yang ada
hanya `carrier` dan `vehicle_type` sebagai master data.

Maka keenamnya dibangun pada V9-9, dengan **nama yang sama seperti yang diminta
Versi 7**. Dengan begitu, bila modul ekspedisi Versi 7 kelak dikerjakan, ia
memakai model yang sama dan larangan "jangan membuat yang kedua" tetap terpenuhi.

Tautannya:

```text
online_shipment (metode INTERNAL_FLEET)
  └─ expedition_order
       └─ expedition_trip
            └─ trip_stop
                 └─ location_ping         posisi kendaraan
                 └─ proof_of_delivery     tanda tangan atau foto
                      └─ shipment_event   status pengiriman diperbarui
```

## Titik yang mudah salah

| Kesalahan | Akibat | Penanganan |
| --- | --- | --- |
| Mengurangi stok saat checkout | stok hilang untuk pesanan yang tidak pernah dibayar | reservasi, bukan pengurangan; ledger berubah saat lunas |
| Melepas reservasi dua kali | stok bertambah dari ketiadaan | idempotensi pada peristiwa, bukan pada pemanggil |
| Reservasi tanpa kedaluwarsa | stok tertahan selamanya oleh checkout terbengkalai | kedaluwarsa + penyapu berkala |
| Membuat ledger stok kedua untuk online | dua kebenaran tentang jumlah barang | satu `stock_movement`, sumber `ONLINE_ORDER` |
| Membuat model armada kedua | dua tempat mencatat perjalanan yang sama | dibangun sekali dengan nama Versi 7 |
| Webhook pengiriman diproses dua kali | status mundur atau ganda | idempotensi per id peristiwa provider |
| Picking tanpa pemindaian | barang salah terkirim | konfirmasi wajib memindai SKU |
| Berat diisi manual tanpa validasi | ongkos kirim salah dan klaim ditolak | timbang saat packing; bandingkan dengan berat teoretis |

## Urutan yang dapat diuji lebih awal

Rantai ini panjang, tetapi dapat diuji bertahap:

1. **V9-8**: order lunas menghasilkan fulfillment order. Diuji tanpa picking.
2. **V9-9a**: picking dan packing menghasilkan paket. Diuji tanpa provider.
3. **V9-9b**: booking ke provider tiruan, label, manifest.
4. **V9-9c**: pelacakan dan armada internal.

Setiap langkah menghasilkan sesuatu yang benar-benar dapat dipakai gudang, bukan
menunggu seluruh rantai selesai.
