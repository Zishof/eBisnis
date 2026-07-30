# 12 — Inventaris Route API

Commit `7399fb8`. Total **157 endpoint** pada 10 berkas controller.

## Sebaran

| Berkas | Prefix | Endpoint |
| --- | --- | ---: |
| `modules/tenant/tenant.module.ts` | *(root)* | 49 |
| `modules/platform-admin/platform-admin.module.ts` | `platform` | 23 |
| `modules/public/public.controller.ts` | `public` | 22 |
| `modules/payment/payment.module.ts` | *(root)* | 14 |
| `modules/cms/cms.module.ts` | `platform/cms` | 11 |
| `modules/billing/billing.module.ts` | *(root)* | 10 |
| `modules/seed-admin/seed-admin.module.ts` | *(root)* | 9 |
| `modules/auth/auth.controller.ts` | `auth` | 9 |
| `modules/pricing/pricing.module.ts` | *(root)* | 8 |
| `modules/health/health.module.ts` | *(root)* | 2 |

## Endpoint tenant (49)

Hampir seluruhnya melayani rantai purchasing dan inventory.

```text
GET  master-resources

GET  request-orders                          POST request-orders
GET  request-orders/:id                      POST request-orders/generate-min-stock
POST request-orders/:id/submit               POST request-orders/:id/approve
POST request-orders/:id/reject

GET  products/:id/suppliers

GET  purchase-orders                         POST purchase-orders
GET  purchase-orders/:id                     POST purchase-orders/:id/submit
POST purchase-orders/:id/approve             POST purchase-orders/:id/send

GET  goods-receipts                          POST goods-receipts
GET  goods-receipts/:id                      POST goods-receipts/:id/inspect
POST goods-receipts/:id/validate             POST goods-receipts/:id/reverse-validation
POST goods-receipts/:id/create-backorder

GET  backorders                              GET  backorders/:id
POST backorders/:id/assign-supplier          POST backorders/:id/create-purchase-order

GET  inventory/stock-tree                    GET  inventory/balances
GET  inventory/movements                     GET  stock-alerts

GET  internal-transfers                      POST internal-transfers
GET  internal-transfers/:id                  POST internal-transfers/:id/approve
POST internal-transfers/:id/allocate         POST internal-transfers/:id/dispatch
POST internal-transfers/:id/arrive           POST internal-transfers/:id/validate-receipt
```

Sisanya melayani master data lewat registry generik.

## Yang belum ada untuk Versi 9

Dokumen Versi 9 mencantumkan 33 endpoint. Tidak satu pun ada.

### Publik (13)

```text
GET  /api/v1/marketplace/home
GET  /api/v1/marketplace/categories
GET  /api/v1/marketplace/search
GET  /api/v1/marketplace/stores/:slug
GET  /api/v1/marketplace/products/:slug
GET  /api/v1/marketplace/products/:id/reviews
POST /api/v1/marketplace/cart/items
POST /api/v1/marketplace/checkout/validate
POST /api/v1/marketplace/checkout
GET  /api/v1/marketplace/orders/:id
POST /api/v1/marketplace/orders/:id/cancel
POST /api/v1/marketplace/orders/:id/returns
POST /api/v1/marketplace/reviews
```

Ini yang paling berbeda sifatnya dari seluruh API yang ada: **anonim, tanpa
tenant context dari sesi**. Setiap endpoint di atas harus menentukan tenant dari
data yang sudah terverifikasi, tidak pernah dari parameter permintaan.

### Seller (13)

```text
GET/POST/PATCH /api/v1/seller/marketplace/enrollment
POST           /api/v1/seller/marketplace/esmartlink/activation-ticket
POST           /api/v1/seller/marketplace/esmartlink/test
GET/POST/PATCH /api/v1/seller/store
GET/POST/PATCH /api/v1/seller/listings
POST           /api/v1/seller/listings/:id/submit
POST           /api/v1/seller/listings/:id/publish
GET            /api/v1/seller/orders
POST           /api/v1/seller/orders/:id/confirm
POST           /api/v1/seller/orders/:id/fulfill
POST           /api/v1/seller/shipments
POST           /api/v1/seller/returns/:id/decision
GET            /api/v1/seller/analytics
```

### Platform (10)

```text
GET  /api/v1/platform/marketplace/sellers
POST /api/v1/platform/marketplace/sellers/:id/approve
POST /api/v1/platform/marketplace/sellers/:id/suspend
GET  /api/v1/platform/marketplace/activation-tickets
GET  /api/v1/platform/marketplace/moderation
POST /api/v1/platform/marketplace/moderation/:id/decision
GET/POST/PATCH /api/v1/platform/marketplace/categories
GET/POST/PATCH /api/v1/platform/marketplace/policies
GET/POST/PATCH /api/v1/platform/marketplace/fees
GET  /api/v1/platform/marketplace/reconciliation
```

### Webhook

Tidak disebut eksplisit tetapi diperlukan:

```text
POST /api/v1/webhooks/payment/:providerCode
POST /api/v1/webhooks/shipping/:providerCode
```

Keduanya menerima permintaan dari luar tanpa sesi. Aturannya: catat mentah lebih
dulu, verifikasi, idempoten, dan balas ack yang diharapkan provider.

## Temuan yang perlu diperbaiki

**Controller inline di dalam `*.module.ts`.** Enam dari sepuluh controller
didefinisikan di dalam berkas module, bukan berkas `*.controller.ts` tersendiri.
`tenant.module.ts` memuat 49 endpoint dalam satu berkas.

Ini berjalan, tetapi Versi 9 akan menambah puluhan endpoint. Menambahkannya ke
berkas yang sama membuat berkas yang sudah besar menjadi tidak terkelola.

**Keputusan:** modul Versi 9 memakai berkas `*.controller.ts` tersendiri.
Controller yang ada tidak dipindahkan pada V9 — memindahkannya adalah perubahan
besar tanpa manfaat fungsional, dan dicatat sebagai utang terpisah.

**`@Controller()` tanpa prefix.** Enam controller memakai root, sehingga
prefiksnya tersebar pada masing-masing dekorator metode. Modul Versi 9 memakai
prefix eksplisit pada `@Controller()`.

## Aturan untuk endpoint Versi 9

Setiap endpoint baru wajib:

```text
DTO dengan class-validator
metadata permission -- tanpa ini guard tidak memeriksa apa pun (V6-0-F03)
batas data ditegakkan pada repository
skema OpenAPI
kode error terdaftar
audit untuk aksi yang mengubah
test yang gagal bila permission dicabut
Orval diregenerasi
```

Butir kedua adalah yang paling mudah terlupa dan paling berbahaya. Perbaikan
V6-0-F03 pada V9-1 mengubahnya dari "mudah terlupa" menjadi "tidak mungkin
terlupa": handler tanpa metadata permission akan **ditolak**, bukan diloloskan.
