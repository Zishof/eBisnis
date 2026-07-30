# 00 — Kondisi Source Saat Ini (V9-0)

Diukur pada commit `7399fb8`, branch `feature/v9-marketplace`, 2026-07-30.
Bukti mentah: [`evidence/baseline-v9-0.txt`](evidence/baseline-v9-0.txt).

## Ukuran

| Objek | Jumlah |
| --- | ---: |
| Tabel schema tenant | 121 |
| Model schema platform | 136 |
| Migration tenant | 10 (V001–V010) |
| Endpoint API | 157 |
| Halaman React | 28 |
| Node menu / root | 73 / 21 |
| Role tenant | 129 |
| Aksi permission | 26 |
| Unit test | 119 (104 API + 15 web) |
| E2E spec | 3 berkas Playwright |

## Baseline

Seluruh gate hijau pada commit ini.

| Perintah | Hasil |
| --- | --- |
| `pnpm db:validate` | valid |
| `pnpm db:generate` | berhasil |
| `tsc --noEmit` (api) | exit 0 |
| `tsc --noEmit` (web) | exit 0 |
| `pnpm lint` | bersih |
| `pnpm test` | 119 lulus |
| `pnpm build` | bersih |

Catatan: **tidak ada script `pnpm typecheck`**. Dokumen Versi 9 menyebutnya; yang
ada adalah `tsc --noEmit` per aplikasi, dan `pnpm check` yang menjalankan
lint + test + build. Baseline di atas memakai perintah yang benar-benar ada.

`pnpm test:e2e` menuntut server berjalan dan browser Playwright terpasang;
tidak dijalankan pada audit ini dan dicatat sebagai belum diukur, bukan lulus.

## Modul API yang ada

```text
auth  billing  cms  health  master-seed  payment
platform-admin  pricing  public  seed-admin  tenant
```

Controller: `auth`, `me`, `platform`, `platform/cms`, `public`, ditambah
controller inline pada modul `billing`, `health`, `payment`, `pricing`,
`seed-admin`, dan `tenant`.

## Domain yang sudah berjalan

**Purchasing dan inventory** adalah bagian paling matang. Rantai
Request Order → Purchase Order → Goods Receipt → Backorder → Internal Transfer
lengkap dengan endpoint, UI, dan lifecycle. 49 endpoint tenant hampir seluruhnya
melayani rantai ini.

**Payment** jauh lebih matang daripada yang diduga. Lihat
[04-esmartlink-capability-inventory.md](04-esmartlink-capability-inventory.md).

**CMS dan website publik** berjalan untuk situs pemasaran platform.

**Master data** lengkap dengan lifecycle dan seed registry.

**Tata kelola role** baru selesai pada V010: profil per modul, batas data, dan
pemisahan tugas.

## Yang tidak ada sama sekali

Pencarian pada seluruh `apps/` dan `packages/` menghasilkan **nol berkas** untuk:

```text
HelpTopic          CrudActionGroup     exceljs          pdfkit
google-auth-library  Expedition        LocationPing     ProofOfDelivery
OnlineStore        storefront          ShippingProvider TrackingEvent
PickTask           PackTask            MarketplaceListing
```

`Ticket` dan `marketplace` masing-masing muncul pada satu berkas, keduanya hanya
sebagai kata di dokumentasi, bukan kode.

## Tabel tenant yang relevan untuk Versi 9

Yang **ada** dan dapat dipakai ulang:

| Tabel | Kegunaan untuk V9 |
| --- | --- |
| `product`, `product_category`, `product_brand`, `product_barcode` | dasar listing |
| `price_book`, `price_book_item` | harga per kanal |
| `stock_balance`, `stock_movement`, `stock_policy` | ketersediaan |
| **`stock_reservation`** | reservasi checkout — sudah ada |
| `sales_order`, `sales_order_line` | order penjualan |
| `warehouse`, `warehouse_zone`, `warehouse_bin` | lokasi fulfillment |
| `carrier` | ekspedisi |
| `file_object`, `entity_attachment` | media |
| `sync_outbox`, `sync_inbox` | projection ke marketplace |
| `job_execution` | antrean latar belakang |
| `notification`, `notification_template` | pemberitahuan |
| `workflow_definition`, `workflow_instance`, `workflow_step` | persetujuan |
| `pos_sale`, `pos_terminal`, `pos_shift` | omnichannel |

Yang **tidak ada**: varian produk, media produk, keranjang, checkout, listing,
toko online, domain toko, picking, packing, paket, pengiriman, pelacakan, retur,
refund, sengketa, ulasan, chat, promosi, dan voucher.

## Temuan yang mengubah rencana

Tiga hal ditemukan saat audit dan mengubah asumsi rencana Versi 9. Ketiganya
diuraikan pada dokumen tersendiri:

1. **`PaymentOrder` terikat ke `BillingInvoice`**, bukan generik. Marketplace
   order tidak dapat memakainya tanpa perubahan.
   → [05-payment-and-settlement-constraints.md](05-payment-and-settlement-constraints.md)

2. **`PaymentProvider` bersifat global, satu baris per provider**, dengan
   `secretReference` menunjuk env var. Tidak ada akun per tenant, dan pola env
   var tidak dapat menampung ratusan seller.
   → [04-esmartlink-capability-inventory.md](04-esmartlink-capability-inventory.md)

3. **`Website`/`WebsiteDomain` bukan storefront tenant.** Keduanya tidak punya
   `tenantId` dan tidak punya verifikasi domain. Yang ada adalah situs pemasaran
   platform, bukan registry domain terverifikasi yang dituntut Versi 9.
   → [03-marketplace-domain-model-map.md](03-marketplace-domain-model-map.md)

## Modul Versi 7 yang ternyata belum ada

Dokumen Versi 9 mengasumsikan modul ekspedisi Versi 7 tersedia dan meminta agar
tidak diduplikasi:

> "Jangan membuat fleet/GPS kedua. Reuse: ExpeditionOrder, ExpeditionTrip,
> TripStop, TrackingSession, LocationPing, ProofOfDelivery."

**Tidak satu pun dari enam model itu ada.** Yang ada hanya tabel `carrier` dan
`vehicle_type` sebagai master data. Ticketing Versi 7 juga tidak ada, padahal
alur aktivasi eSmartlink Versi 9 bergantung pada tiket `PLATFORM_SUPPORT`.

Akibatnya, "reuse" untuk armada internal dan tiket aktivasi bukan pilihan —
keduanya harus dibangun. Ini menggeser ruang lingkup dan dicatat pada
[02-v8-to-v9-gap-matrix.md](02-v8-to-v9-gap-matrix.md) serta
[09-implementation-plan.md](09-implementation-plan.md).
