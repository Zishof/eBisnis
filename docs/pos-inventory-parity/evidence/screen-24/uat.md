# UAT — Layar 24 (Pembayaran Hutang — Allocation Cap + Reversal)

**Tenant uji:** `uat_finance_15643`. **Alur data:** PO (`PO-000001`, AYAM 50kg @12000 = 600000) →
submit → approve → send → goods receipt (`GR-000001`) → inspect (accepted 50) → validate
(`STOCK_POSTED`) → `legacy_payable_ledger` `e0da8d28-...` senilai 600000 terbentuk otomatis lewat
jembatan Purchase→AP (fitur sesi sebelumnya).

## Skenario

1. **Allocation cap**: `POST /ap/payments` dengan alokasi 999999999 (jauh melebihi outstanding 600000). → **HTTP 400**, `VALIDATION_FAILED: "Alokasi tidak boleh melebihi nilai dokumen."` Verifikasi DB: **0 baris** `inventory_ap_payment` dengan idempotency key percobaan ini — tidak ada dokumen setengah-jadi.
2. **Pembayaran sah**: alokasi 250000 (di bawah outstanding) → `DRAFT` → `POST /ap/payments/:id/post` → `POSTED`. Saldo: `total_settled = 250000`.
3. **Reversal**: `POST /ap/payments/:id/reverse` → status dokumen `REVERSED` (**bukan terhapus** — baris tetap ada, hanya statusnya berubah). Saldo ledger setelah reverse: `total_settled = 0` — **kembali penuh**.

## Hasil

**PASS** untuk allocation cap dan reversal — keduanya bekerja persis seperti diklaim source: kelebihan alokasi ditolak sebelum menyentuh database, dan pembalikan mengembalikan saldo tanpa menghapus dokumen asli.

## Temuan: TIDAK ADA jejak audit untuk aksi AP payment/AR receipt

**GAP nyata ditemukan lewat UAT ini, BELUM diperbaiki (dilaporkan, menunggu keputusan):**
`createSettlement`/`transitionSettlement` (sales-inventory-operations.controller.ts) membungkus
transaksinya dengan `auditOf(user, meta, 'AP_PAYMENT', 'CREATE'/'POST'/'REVERSE')` — sama seperti
pola yang dipakai `validateGoodsReceipt`/`createPurchaseOrder` yang TERBUKTI bekerja (baris
`GOODS_RECEIPT_VALIDATED`, `PURCHASE_ORDER_CREATED` dst. ADA di `audit_event` untuk transaksi PO/GR
yang sama pada sesi UAT ini). Untuk pembayaran AP (create, post, reverse) pada percobaan yang
SAMA PERSIS: **nol baris** `audit_event` dengan `module_code = 'AP_PAYMENT'`, dan tabel
`inventory_ap_payment` **tidak punya trigger audit** sama sekali (beda dari tabel lain seperti
`role_menu_permission` yang punya `trg_audit_role_menu_permission`). Dicek lewat dua jalur
(`audit_event` dan `audit_row_change`) — keduanya kosong.

Template pembuktian (`05-template-bukti-proven-purchase-ap-sales-ar.md`) mengasumsikan tabel
`audit_log` untuk rekonsiliasi ini — tabel itu **tidak ada** di skema nyata (hanya
`audit_event`/`audit_row_change`/dst di schema `__audit`); kemungkinan penulisnya salah nama tabel
atau merujuk rancangan lama. Terlepas dari nama tabelnya, hasil pemeriksaan tetap sama: TIDAK ADA
baris audit untuk aksi ini di jalur manapun yang benar-benar ada di skema.

**Dampak:** siapa membuat/memposting/membalik pembayaran hutang/piutang, kapan, dan mengapa —
tidak tercatat di jejak audit sama sekali saat ini, padahal dokumentasi kode (`auditOf` call)
menyiratkan seharusnya tercatat. Ini domain uang; kekosongan ini pantas diperbaiki, tetapi
sengaja TIDAK diperbaiki dalam pass ini (di luar cakupan yang diminta pengguna) — dilaporkan untuk
keputusan lanjutan.

## Yang TIDAK dicakup pass ini

Layar 20-23, 25-29 (sisanya domain Purchase/AP: hutang lunas, riwayat pembayaran, cetak
voucher, analisis hutang, faktur pembelian, laporan periode) belum diuji. Screenshot
Web/Windows/Android tidak diambil.
