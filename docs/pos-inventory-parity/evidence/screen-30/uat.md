# UAT — Layar 30 (Menu Penjualan — Invoice Atomicity + State Guard)

**Tenant uji:** `uat_finance_15643`.

## Skenario

1. **State guard, order sudah INVOICED**: `POST /sales/orders/:id/invoice` pada order 1
   (`81d5a5c7-...`, sudah berstatus `INVOICED` dari FINANCE UAT sebelumnya). → **HTTP 409 CONFLICT**:
   `"Pesanan berstatus INVOICED tidak dapat dijadikan faktur. Hanya pesanan berstatus CONFIRMED yang
   dapat diproses."`
2. **State guard, order DRAFT**: order baru (`5bb3c812-...`) dibuat via `/inventory/mobile-orders`
   (otomatis `CONFIRMED`), lalu status diubah paksa ke `DRAFT` lewat SQL langsung (skenario uji —
   tidak ada jalur produk yang membuat order DRAFT lewat mobile order; dilakukan untuk mereplikasi
   prasyarat template) → `POST .../invoice` → **HTTP 409 CONFLICT**, pesan sama.
3. **Efek gabungan (atomicity) untuk invoice yang BERHASIL** (order 1, diinvoice pada FINANCE UAT):
   - `stock_movement`: 1 baris `SALES_ORDER_ISSUE`, 10 unit, `reference_id` = order 1.
   - `legacy_receivable_ledger`: 1 baris, 180000, `source_file='LIVE:SALES'`, `metadata.salesOrderId` = order 1.
   - `accounting_event`: 2 baris (`SALES_ORDER_INVOICED`, `SALES_ORDER_COGS`), keduanya `POSTED`.

   Ketiganya konsisten dan berasal dari SATU pemanggilan `invoiceSalesOrder`, yang seluruhnya
   dibungkus `tenantDb.transaction` — sesuai klaim source (properti "Atomicity" pada template).

## Temuan DIPERBAIKI: stok tidak diperiksa sebelum dipotong

**GAP nyata ditemukan DAN DIPERBAIKI dalam pass ini:** `invoiceSalesOrder` memotong stok tanpa
memeriksa ketersediaannya lebih dulu. Dibuktikan langsung: setelah dua invoice pada tenant uji ini
(order 1: -10, order 2: -5 — tenant baru, tidak pernah menerima barang sama sekali), saldo stok
FRIED-CHICKEN pada `stock_balance` sempat menjadi **-15** (negatif), padahal produk ini punya
`allow_negative_stock: false` pada masternya.

**Perbaikan:** menambahkan pemeriksaan `stock_balance.available_qty` (dijumlah lintas lot pada
gudang tujuan) terhadap sisa kuantitas sebelum baris `stock_movement` ditulis, dilewati hanya bila
`product.allow_negative_stock = true`. Melempar `422 INSUFFICIENT_STOCK` dengan kode produk pada
pesan bila tidak cukup.

**Verifikasi ulang setelah perbaikan** (order baru `aaa04a96-...`, produk yang sama, sudah di
saldo negatif dari sebelumnya): `POST .../invoice` → **HTTP 422 INSUFFICIENT_STOCK**, `"Stok
FRIED-CHICKEN tidak mencukupi untuk faktur ini."` — dan status order TETAP `CONFIRMED` (bukan
`INVOICED`), TIDAK ADA baris `stock_movement` tercipta (`count = 0`). Penolakan bersih, tanpa efek
parsial.

**Catatan implementasi:** percobaan pertama query pemeriksaan memakai `FOR UPDATE` bersama
`sum()` — Postgres menolak (`FOR UPDATE tidak diperbolehkan dengan fungsi agregat`), tertangkap
langsung oleh percobaan HTTP nyata (bukan lolos diam-diam). Query diperbaiki tanpa `FOR UPDATE`,
mengikuti pola pemeriksaan stok yang sudah ada di `erp-inventory.service.ts` (percobaan
transfer/dispatch) — celah balapan kecil pada window pemeriksaan-lalu-tulis yang sama seperti
kode lain di codebase ini, bukan regresi baru.

## Hasil

**PASS** untuk state guard (dua skenario), konsistensi efek gabungan (atomicity struktural: satu
transaksi DB, semua efek konsisten), DAN pemeriksaan kecukupan stok (setelah perbaikan, diverifikasi
ulang lewat percobaan HTTP nyata).

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Uji "kegagalan tengah transaksi lalu rollback bersih"
tidak dapat direplikasi nyata karena tidak ditemukan pemicu kegagalan realistis di tengah alur
`invoiceSalesOrder` pada kode saat ini (lihat temuan di atas) — kepercayaan pada atomicity
struktural (`tenantDb.transaction`) didukung code review, bukan uji injeksi kegagalan langsung.
