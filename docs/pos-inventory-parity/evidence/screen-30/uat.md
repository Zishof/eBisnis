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

## Temuan: stok tidak diperiksa sebelum dipotong (bukan bug atomicity, tapi celah validasi)

**GAP nyata ditemukan, BELUM diperbaiki:** `invoiceSalesOrder` memotong stok tanpa memeriksa
ketersediaannya lebih dulu. Dibuktikan langsung: setelah dua invoice pada tenant uji ini
(order 1: -10, order 2: -5 — tenant baru, tidak pernah menerima barang sama sekali), saldo stok
FRIED-CHICKEN pada `stock_balance` menjadi **-15** (negatif). Produk ini punya
`allow_negative_stock: false` pada masternya — nilai itu diabaikan sepenuhnya oleh
`invoiceSalesOrder`. Ini BUKAN kegagalan atomicity (tidak ada rollback parsial; seluruh efek tetap
konsisten satu sama lain seperti dibuktikan di atas) — melainkan tidak adanya pemeriksaan
kecukupan stok SEBELUM transaksi dimulai, sesuatu yang jalur POS (`pos-stock.service.ts`, dengan
`FOR UPDATE` + pemeriksaan) dan goods-receipt punya, tetapi jalur invoice sales order ini tidak.

**Dampak:** bisnis dapat "menjual" barang yang stoknya sudah habis lewat faktur pesanan penjualan,
tanpa penolakan maupun peringatan, menghasilkan saldo stok negatif yang secara diam-diam salah.

## Hasil

**PASS** untuk state guard (dua skenario) dan konsistensi efek gabungan (atomicity struktural: satu
transaksi DB, semua efek konsisten). Kekurangan pemeriksaan stok dilaporkan sebagai temuan
terpisah, sengaja tidak diperbaiki pada pass ini.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Uji "kegagalan tengah transaksi lalu rollback bersih"
tidak dapat direplikasi nyata karena tidak ditemukan pemicu kegagalan realistis di tengah alur
`invoiceSalesOrder` pada kode saat ini (lihat temuan di atas) — kepercayaan pada atomicity
struktural (`tenantDb.transaction`) didukung code review, bukan uji injeksi kegagalan langsung.
