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

## Temuan BELUM DIPERBAIKI: `reverse-validation` GR tidak membalik payable AP yang sudah dibuat

**GAP nyata ditemukan lewat pass ini, DIDOKUMENTASIKAN (tidak diperbaiki)** — lebih besar/berisiko
dari sekadar perbaikan string permission (lihat layar 22), jadi mengikuti arahan sesi untuk
didokumentasikan saja, bukan diperbaiki tergesa.

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

**Kenapa TIDAK diperbaiki di pass ini**: perbaikan yang benar perlu menangani kasus di mana
payable itu **sudah mulai dibayar** sebelum GR-nya dibalik (ada baris
`inventory_ap_payment_allocation` berstatus `POSTED` mengarah ke ledger ini) — kasus itu tidak
boleh serta-merta membatalkan/menghapus payable begitu saja (uangnya sudah keluar). Ini butuh
keputusan desain (blokir reverse jika sudah ada pembayaran POSTED? Atau buat dokumen
penyesuaian/kredit nota baru?) yang di luar cakupan "perbaikan kecil, berisiko rendah" yang
diizinkan sesi ini. Didokumentasikan agar tim yang berwenang bisa memutuskan pendekatan yang
tepat.

## Yang TIDAK dicakup pass ini

Uji kegagalan tengah-transaksi (rollback bersih) tidak direplikasi nyata untuk PO/GR — sama
seperti catatan di `screen-30/uat.md`, kepercayaan pada atomicity struktural (`tenantDb.transaction`)
didukung code review, bukan uji injeksi kegagalan langsung. Screenshot Web/Windows/Android tidak
diambil. Backorder (`create-backorder`) tidak diuji — di luar daftar endpoint layar 20-29 pada
template.
