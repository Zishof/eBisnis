# UAT — Layar 20 (Proses Pembelian Barang dari Supplier — PO → GR → AP Bridge)

**Tenant uji:** `uat_purchase_ap_19222` (didaftarkan sendiri untuk pass ini, terpisah dari
`uat_finance_15643` yang dipakai pass FINANCE/24/30/34 agar tidak bentrok dengan agent lain yang
berjalan paralel). **Endpoint:** `POST /purchase-orders` (+`/submit`/`/approve`/`/send`),
`POST /goods-receipts` (+`/inspect`/`/validate`/`/reverse-validation`).

## Alur data yang dibangun (dipakai juga oleh layar 21-23, 25-29)

| PO | Produk | Qty×Harga | Total | GR | Payable (`legacy_payable_ledger`) |
|---|---|---|---|---|---|
| PO-000001 | AYAM | 50×12000 | 600000 | GR-000001 | `c4ab94cb-...` 600000, lunas (dibayar penuh, lihat layar 25) |
| PO-000002 | MINYAK | 20×25000 | 500000 | GR-000002 | `eb9c32da-...` 500000, dicicil 200000 (sisa 300000) |
| PO-000003 | BUMBU | 10×30000 | 300000 | GR-000003 | `24100cd9-...` 300000, terbuka, tanggal dimundurkan via SQL utk uji aging (lihat layar 27) |
| PO-000004 | AYAM | 5×12000 | 60000 | GR-000004 | `0a87b781-...` 60000 — **GR ini SENGAJA di-reverse-validation untuk uji temuan di bawah** |

Semua PO memakai supplier SUP-C (CV Bahan Segar Nusantara) dan gudang GDG-OUTLET-UTAMA.

## Skenario

1. **Alur normal penuh**: `POST /purchase-orders` (`DRAFT`) → `/submit` (`WAITING_APPROVAL`) →
   `/approve` (`APPROVED`) → `/send` (`SENT`) → `POST /goods-receipts` (`ARRIVED`) → `/inspect`
   (`WAITING_VALIDATION`, `acceptedQty=50`) → `/validate` (`STOCK_POSTED`). **BUKTI**: setiap
   response HTTP mengembalikan status baru yang sesuai (lihat `api-po1-*.json`, `api-gr1-*.json`).
   Setelah validate, `legacy_payable_ledger` baris baru terbentuk otomatis lewat jembatan
   Purchase→AP (fitur sesi sebelumnya) — 600000, `due_date = transaction_date + 7 hari` (payment
   term SUP-C = Net 7 Hari), verifikasi lewat `GET /inventory/legacy/payables` (lihat layar 22).

2. **State guard**: `POST /purchase-orders/:id/submit` pada PO yang sudah `SENT` (PO-000001) →
   **HTTP 409** `INVALID_STATE_TRANSITION`, `"Aksi \"submit\" tidak diizinkan pada status SENT."`,
   `params.allowedFrom=["DRAFT"]`. Bukti: `api-po1-invalid-transition-409.json`.

3. **Idempotency pembuatan PO**: `POST /purchase-orders` dikirim dua kali dengan
   `Idempotency-Key` sama (`1d034c23-...`) → response kedua mengembalikan `id`/`purchase_order_number`
   **identik** dengan yang pertama (`c28c0715-...` / `PO-000001`). Verifikasi SQL independen:
   `SELECT count(*) FROM purchase_order WHERE idempotency_key='1d034c23-...'` → **1 baris**, bukan 2.
   Bukti: `api-po1-idempotent-retry.json`.

4. **Guard supplier-produk**: `POST /purchase-orders` dengan supplier SUP-C dan produk
   `ROKOK-DEMO` (SUP-C tidak terdaftar sebagai pemasok produk ini — hanya SUP-A/SUP-E) →
   **HTTP 422** `SUPPLIER_CANNOT_SUPPLY_PRODUCT`. Verifikasi SQL: jumlah baris `purchase_order`
   tetap 3 (tidak bertambah) setelah percobaan ini — tidak ada dokumen setengah-jadi. Bukti:
   `api-po-supplier-cannot-supply-product-422.json`.

## Hasil

**PASS** untuk alur PO→GR→validate end-to-end, state guard, idempotency pembuatan PO, dan guard
supplier-produk — keempatnya bekerja persis seperti diklaim source, dibuktikan lewat panggilan
HTTP nyata + verifikasi SQL independen terhadap PostgreSQL lokal (bukan mock).

## Temuan (DIPERBAIKI, 2026-08-10): `reverse-validation` GR tidak membalik payable AP yang sudah dibuat

**GAP nyata ditemukan lewat pass ini** — awalnya didokumentasikan tanpa diperbaiki karena lebih
besar/berisiko dari sekadar perbaikan string permission (lihat layar 22); diperbaiki menyusul
setelah keputusan desain di bawah diambil.

**Reproduksi langsung** (PO-000004/GR-000004, alur sama seperti di atas sampai `STOCK_POSTED`):

- Sebelum reverse: `stock_balance` AYAM di GDG-OUTLET-UTAMA = 55 (50 dari GR-000001 + 5 dari
  GR-000004). `legacy_payable_ledger` untuk GR-000004 = 60000, `is_settled=false`, `status=OPEN`.
- `POST /goods-receipts/:id/reverse-validation` dengan alasan uji → **HTTP 200**, GR berubah
  `status=CORRECTION_REQUIRED`, `validation_status=REVERSED`. `stock_movement` menunjukkan baris
  offset `GOODS_RECEIPT_REVERSAL` (5 unit) melawan baris asli `GOODS_RECEIPT` (5 unit) — **efek
  stok BENAR dibalik**: `stock_balance` AYAM kembali ke 50.
- **TAPI** `legacy_payable_ledger` untuk GR-000004 **TIDAK BERUBAH SAMA SEKALI**: masih
  `amount=60000`, `is_settled=false`, `status=OPEN`, `source_deleted=false` — persis seperti
  sebelum reverse. Baris ini lantas muncul sebagai hutang terbuka yang sah di layar 22 (Data Hutang
  Supplier, lihat `api-payables-ghost-after-gr-reversal.json`) dan ikut terhitung di layar 27
  (Analisis Hutang, total naik dari 800000 jadi 860000 karena baris hantu ini — lihat
  `screen-27/api-ap-aging-preview.json`).

**Dampak**: supplier SUP-C sekarang "berhutang" 60000 di sistem untuk barang yang sudah
dikembalikan/dibatalkan penerimaannya — kasir/finance yang membuka layar Hutang Supplier tidak
tahu bahwa 60000 ini adalah hantu, dan bisa saja benar-benar membayarnya ke supplier padahal
barangnya sudah tidak diterima. Ini masalah integritas keuangan langsung di domain Purchase/AP.

**Catatan tambahan (sekunder)**: status `purchase_order` PO-000004 juga tetap `RECEIVED` setelah
GR-nya dibatalkan validasinya — tidak ikut turun ke `PARTIALLY_RECEIVED`/status lain yang
mencerminkan bahwa penerimaannya sudah tidak sah lagi.

**Akar masalah**: `reverseGoodsReceiptValidation()` (`erp-purchasing.service.ts:1295-1410`) hanya
menyentuh `goods_receipt`, `goods_receipt_validation`, `stock_movement`, `stock_balance` — tidak
ada satu baris kode pun yang menyentuh `legacy_payable_ledger`.

**Keputusan desain yang diambil**: perbaikan yang benar perlu menangani kasus di mana payable itu
**sudah mulai dibayar** sebelum GR-nya dibalik (ada baris `inventory_ap_payment_allocation`
berstatus `POSTED` mengarah ke ledger ini) — kasus itu tidak boleh serta-merta
membatalkan/menghapus payable begitu saja (uangnya sudah keluar). Dipilih pendekatan **blokir**
(bukan dokumen penyesuaian/kredit nota otomatis, yang butuh desain akuntansi lebih dalam dan
di luar cakupan pass ini): bila ada pembayaran POSTED teralokasi ke payable dari GR ini,
`reverse-validation` ditolak **HTTP 409 `PAYABLE_ALREADY_PAID`** sebelum menyentuh stok sama
sekali (dicek sebelum loop pembalikan `stock_movement`) — konsisten dengan pola "blokir dulu,
biarkan operator melakukan koreksi manual" yang sudah dipakai di tempat lain (mis. purge
salesperson yang masih punya riwayat transaksi, lihat `screen-07/uat.md`).

Bila TIDAK ada pembayaran POSTED (kasus GR-000004 di atas): `reverseGoodsReceiptValidation()`
kini juga menyetel `legacy_payable_ledger.is_settled = TRUE` untuk baris payable dari GR
tsb (dicari lewat `metadata->>'goodsReceiptId'`, satu-satunya tautan yang ada — tidak ada
kolom FK khusus) plus mencatat `reversedAt`/`reversedBy`/`reversalReason` ke `metadata`
(bukan menghapus/mengosongkan `amount`, agar riwayat nilai asli tetap terlihat untuk audit).
Dipilih menulis `is_settled` (bukan mengarang nilai `status` baru) karena SEMUA query
saldo-terhutang/aging/dashboard yang ada (`sales-inventory-operations.controller.ts`, baris
1363, 1744, 1848, 1986-1987, 2058-2076, 2277, 2351) memfilter lewat `is_settled`, tidak
pernah lewat `status` — jadi baris yang dibalik otomatis berhenti muncul di semua laporan
tsb tanpa perlu mengubah query manapun. `accounting_event` `PURCHASE_GOODS_RECEIPT_VALUED`
terkait juga di-set `status='SKIPPED'` bila masih `PENDING` (belum sempat dijurnal) agar
tidak terjurnal belakangan untuk nilai yang sudah dibalik; bila SUDAH `POSTED` (sudah
terjurnal), sengaja dibiarkan apa adanya — butuh jurnal pembalik terpisah mengikuti pola
`reversal_of_id` yang sudah ada di `journal_entry`
(`sales-inventory-operations.controller.ts:734-775`), di luar cakupan pass ini.

**Masih di luar cakupan pass ini** (dicatat, bukan diperbaiki): status `purchase_order` PO-000004
tetap `RECEIVED` setelah GR-nya dibatalkan (catatan sekunder di atas) — tidak ikut diperbaiki
karena gap terpisah dari payable AP yang jadi fokus pass ini; dan reversal untuk GR yang
`accounting_event`-nya sudah `POSTED` (jarang terjadi karena aturan posting tidak disemai
default per tenant, lihat komentar di `erp-purchasing.service.ts:1249-1256`) belum menghasilkan
jurnal pembalik otomatis.

Verifikasi: type-check bersih (`tsc --noEmit`) dan suite test API penuh (186 suite/4184 test)
tetap hijau setelah perubahan. Reproduksi HTTP live ulang terhadap skenario PO-000004/GR-000004
di atas TIDAK dilakukan pada pass perbaikan ini (tenant uji `uat_purchase_ap_19222` tidak
diakses ulang) — perbaikan diverifikasi lewat pembacaan kode + type-check + suite test yang ada,
bukan siklus HTTP baru.

## Yang TIDAK dicakup pass ini

Uji kegagalan tengah-transaksi (rollback bersih) tidak direplikasi nyata untuk PO/GR — sama
seperti catatan di `screen-30/uat.md`, kepercayaan pada atomicity struktural (`tenantDb.transaction`)
didukung code review, bukan uji injeksi kegagalan langsung. Screenshot Web/Windows/Android tidak
diambil. Backorder (`create-backorder`) tidak diuji — di luar daftar endpoint layar 20-29 pada
template.
