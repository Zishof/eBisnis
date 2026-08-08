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

**PASS** untuk allocation cap dan reversal — keduanya bekerja persis seperti diklaim source: kelebihan alokasi ditolak sebelum menyentuh database, dan pembalikan mengembalikan saldo tanpa menghapus dokumen asli. Jejak audit (temuan di bawah) DIPERBAIKI dan diverifikasi ulang, sekarang juga PASS.

## Temuan DIPERBAIKI: TIDAK ADA jejak audit untuk aksi AP payment/AR receipt

**GAP nyata ditemukan DAN DIPERBAIKI dalam pass ini.** `createSettlement`/`transitionSettlement`
(sales-inventory-operations.controller.ts) membungkus transaksinya dengan
`auditOf(user, meta, 'AP_PAYMENT', 'CREATE'/'POST'/'REVERSE')` — sama seperti pola yang dipakai
`validateGoodsReceipt`/`createPurchaseOrder` yang TERBUKTI bekerja. Untuk pembayaran AP (create,
post, reverse) pada percobaan yang sama persis: nol baris `audit_event`.

**Akar masalah ditemukan:** jejak audit di codebase ini bukan ditulis langsung oleh kode aplikasi,
melainkan lewat trigger DB generik (`audit_row_trigger()`, dari V008) yang membaca konteks
`SET LOCAL app.module_code/app.action_code` yang disetel `tenantDb.transaction(...)`. V008 memasang
trigger itu ke SETIAP tabel tenant SAAT ITU JUGA lewat satu `DO` block sekali jalan — tabel yang
dibuat migrasi SESUDAH V008 (termasuk `inventory_ap_payment`/`inventory_ar_receipt` dari V047) tidak
pernah tertangkap, dan tidak ada mekanisme yang menyusulinya. `purchase_order`/`goods_receipt`
bekerja karena keduanya sudah ada sebelum V008.

**Perbaikan:** migrasi baru V063 mengulang blok instalasi V008 apa adanya (aman dijalankan berulang)
sehingga SEMUA tabel yang selama ini terlewat — bukan cuma `inventory_ap_payment`/`inventory_ar_receipt`
— ikut mendapat `trg_audit_<table>`.

**Verifikasi ulang setelah perbaikan:** `migrate:tenants` dijalankan ulang, lalu pembayaran AP baru
dibuat (`98b92e8b-...`). Query `audit_row_change` JOIN `audit_event` untuk baris ini:
`action_code=CREATE, module_code=AP_PAYMENT, table_name=inventory_ap_payment, operation=INSERT` —
**tercatat dengan benar.**

**Dampak sebelum perbaikan:** siapa membuat/memposting/membalik pembayaran hutang/piutang, kapan,
dan mengapa — tidak tercatat di jejak audit sama sekali, domain uang yang paling butuh jejak itu.
Cakupan perbaikan lebih luas dari sekadar layar ini: setiap tabel lain yang dibuat migrasi V009+
tanpa trigger audit eksplisit sendiri kini ikut tertangkap.

Catatan: template pembuktian (`05-template-bukti-proven-purchase-ap-sales-ar.md`) mengasumsikan
tabel `audit_log` untuk rekonsiliasi ini — tabel itu tidak ada di skema nyata (yang ada
`audit_event`/`audit_row_change` di schema `__audit`); kemungkinan penulisnya salah nama tabel atau
merujuk rancangan lama.

## Yang TIDAK dicakup pass ini

Layar 20-23, 25-29 (sisanya domain Purchase/AP: hutang lunas, riwayat pembayaran, cetak
voucher, analisis hutang, faktur pembelian, laporan periode) belum diuji. Screenshot
Web/Windows/Android tidak diambil.
