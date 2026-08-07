# Keputusan: Pesanan Penjualan (Sales Order) → Piutang Dagang Legacy

**Status:** Diimplementasikan 2026-08-08. **Diverifikasi:** lint, build, test (source-only — belum
diuji terhadap PostgreSQL sungguhan, lihat blocker lingkungan pada `00-repository-baseline.md`).

## Masalah

`08-purchase-sales-bridge-findings.md` membuktikan: `sales_order` tercipta dengan benar dan
idempoten lewat `POST /inventory/mobile-orders`, tetapi tidak pernah "menjadi faktur" — statusnya
tidak pernah berubah dari `CONFIRMED`, tidak ada stok terpotong, tidak ada snapshot batch, tidak
ada kolom penugasan sales, dan tidak pernah menghasilkan piutang dagang. Layar 31-42 hanya
menampilkan data hasil impor CLI legacy.

## Perbedaan dari sisi pembelian (V053)

Sisi pembelian punya dua dokumen terpisah (`purchase_order` dan `goods_receipt`) dengan
`validateGoodsReceipt` sebagai titik konversi yang **sudah ada**. Sisi penjualan hanya punya SATU
dokumen (`sales_order`) — tidak ada tabel `sales_delivery`/`sales_invoice` terpisah, dan tidak ada
operasi konversi apa pun sebelumnya. Ini bukan kelalaian yang sama; keduanya masalah yang berbeda:

- **Pembelian:** dokumen kedua (GR) ada dan bekerja, tinggal disambungkan ke AP.
- **Penjualan:** dokumen kedua tidak pernah ada. Perlu dibuat operasi konversinya sendiri.

## Keputusan

### 1. Tidak membuat tabel dokumen kedua (`sales_delivery`)

Skema `sales_order_line` sudah punya `delivered_qty` (dari V006, tidak pernah ditulis) — sinyal
kuat kolom ini memang dirancang untuk pengiriman parsial suatu hari, tetapi membangun tabel
pengiriman terpisah lengkap dengan siklus hidupnya sendiri adalah pekerjaan yang jauh lebih besar
daripada menutup celah yang dibuktikan audit. Endpoint baru
(`POST /sales/orders/:id/invoice`) memotong SISA `ordered_qty - delivered_qty` dan langsung mengisi
`delivered_qty = ordered_qty` — kodenya benar untuk pengiriman parsial di masa depan (memakai
selisih, bukan `ordered_qty` mentah, dan idempoten per baris lewat `stock_movement.idempotency_key`),
tetapi pada keadaan sekarang efeknya selalu "seluruh pesanan sekaligus" karena tidak ada jalan lain
mengisi `delivered_qty` sebagian.

### 2. Kapan AR tercipta: satu langkah "Jadikan Faktur"

Bukan otomatis saat order dibuat (barang belum tentu terkirim), bukan menunggu proses pengiriman
terpisah (belum ada). Satu endpoint eksplisit, `SALES_ORDER.INVOICE` — sejalan dengan permintaan
katalog hak akses dokumen perintah (`SALES_ORDER.READ/CREATE/APPROVE/ALLOCATE/SHIP/INVOICE`) yang
memang menyebut `INVOICE` sebagai aksi tersendiri.

### 3. Tabel yang dipakai: `legacy_receivable_ledger`, alasan identik V053

Mesin pelunasan AR (`inventory_ar_receipt`/`inventory_ar_receipt_allocation`, V047) menunjuk
`legacy_receivable_ledger` lewat FK NOT NULL — sama seperti sisi hutang. Baris hidup dibedakan
lewat `source_file = 'LIVE:SALES'` + sequence khusus (`live_receivable_ledger_seq`, V054) +
`metadata->>'origin'`.

### 4. Penugasan sales (celah #5) — perbaikan sebagian, bukan penuh

`sales_order` tidak punya kolom `salesperson_id` sama sekali. Menambahkannya adalah keputusan
skema yang lebih besar (apakah field-sales boleh berbeda dari kasir yang login? bagaimana bila
akun penjual berganti?) — di luar cakupan slice ini. Yang dikerjakan: `legacy_receivable_ledger`
(yang MEMANG punya kolom `salesperson_id`) diisi dari `sales_order.created_by` — derivasi yang
SAMA PERSIS dengan yang sudah dipakai `listSalesOrders` untuk menampilkan "sales_name". Ini
membuat data mengalir ke layar analisis piutang per sales (37-38) untuk pertama kalinya, tetapi
tetap BUKAN snapshot penugasan sejati — bila field-sales dan pembuat order berbeda orang, atribusi
akan salah. Dicatat apa adanya, bukan diklaim selesai.

### 5. Batch/expiry (celah #3) — tidak dikerjakan

Tidak ada tabel lot untuk sales_order sama sekali, dan `sales-inventory-operations.controller.ts`
tidak mewariskan `lot_id` dari mana pun untuk baris sales order. Memotong stok memakai `lotId: null`
pada `applyBalanceDelta` — benar secara stok agregat, tetapi tidak melacak batch/kedaluwarsa
tertentu mana yang keluar. Menutup ini memerlukan FEFO/pemilihan lot pada sisi penjualan yang
belum ada sama sekali — pekerjaan tersendiri, bukan tambahan diam-diam di sini.

### 6. Peristiwa akuntansi: kosakata SAMA dengan POS

`SALES_ORDER_INVOICED` (gross/net/tax), `SALES_ORDER_DISCOUNT`, `SALES_ORDER_COGS`,
`SALES_ORDER_INVENTORY_RELEASE` — nama field nilai persis sama dengan `POS_SALE`/`POS_DISCOUNT`/
`POS_COGS`/`POS_INVENTORY_RELEASE`. `gross` = subtotal SEBELUM diskon, `net` = grand_total dikurangi
pajak — semantik yang sama persis dengan `pos-sale.service.ts`, diambil langsung dari cara
`peristiwaAkuntansi()` dipanggil di sana, bukan ditebak.

Sama seperti V053: mendaftarkan katalog TIDAK membuat peristiwanya dijurnal. Saluran
peristiwa-ke-jurnal tidak ada untuk modul mana pun di codebase ini, termasuk POS.

## Yang SENGAJA tidak dikerjakan pada slice ini

- Tabel pengiriman terpisah (`sales_delivery`) untuk pengiriman parsial sejati.
- Kolom `salesperson_id` pada `sales_order` (snapshot penugasan sejati).
- Batch/lot/FEFO untuk sisi penjualan.
- Saluran peristiwa-ke-jurnal (sama seperti V053 — perbaikan sistem-lebar, bukan khusus sini).
- Penyemaian `accounting_posting_rule` (keputusan bisnis per tenant).
- Nota sales (layar 39-40) tetap terputus dari `sales_order` — di luar cakupan slice ini, sumber
  datanya masih `legacy_receivable_ledger` hasil import ATAU baris hidup baru dari perbaikan ini
  (belum diverifikasi mana yang sebenarnya dibaca handover, perlu pass tersendiri).

## Verifikasi

```text
apps/api lint   → 0 error/warning
apps/api build  → lulus
apps/api test   → lihat commit terkait untuk jumlah lulus
```

Tidak diuji terhadap PostgreSQL sungguhan. Sebelum dianggap selesai sungguhan: jalankan migration
V054, buat sales order lewat `/inventory/mobile-orders`, panggil `POST /sales/orders/:id/invoice`,
dan pastikan stok terpotong benar, baris `legacy_receivable_ledger` muncul dan dapat dilunasi lewat
`/ar/receipts`, serta laporan aging piutang menampilkannya.
