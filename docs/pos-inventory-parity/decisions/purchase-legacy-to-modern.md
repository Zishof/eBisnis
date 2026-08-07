# Keputusan: Jembatan Pembelian (PO/GR) → Hutang Dagang Legacy

**Status:** Diimplementasikan 2026-08-08. **Diverifikasi:** lint, build, test (source-only — belum
diuji terhadap PostgreSQL sungguhan, lihat blocker lingkungan pada `00-repository-baseline.md`).

## Masalah

`08-purchase-sales-bridge-findings.md` membuktikan: PO → Goods Receipt → potong stok bekerja penuh
dan benar, tetapi validasi penerimaan **tidak pernah** menghasilkan dokumen hutang dagang (AP),
riwayat harga beli, atau peristiwa akuntansi. Layar 21-29 secara teknis "berfungsi" tetapi hanya
menampilkan data hasil impor CLI legacy (`onboard-cmn-inventory.cli.ts`), bukan transaksi baru.

## Keputusan

### 1. Kapan AP tercipta

**Saat `validateGoodsReceipt` berhasil**, bukan saat PO dibuat, bukan saat invoice supplier
diterima terpisah. Alasan: `validateGoodsReceipt` adalah "satu-satunya titik stok bertambah"
(komentar sumber sendiri) — inilah titik di mana kewajiban membayar sungguh-sungguh mulai berlaku
(barang sudah diterima dan divalidasi), sejalan dengan cara kerja hutang dagang riil: Anda berutang
untuk apa yang benar-benar diterima, bukan untuk apa yang baru dipesan.

Nilai AP dihitung dari yang **diterima (accepted)**, bukan yang ditolak/dikarantina — barang yang
ditolak bukan kewajiban membayar.

Setiap Goods Receipt yang divalidasi menghasilkan SATU baris AP sendiri. PO dengan beberapa
penerimaan parsial menghasilkan beberapa baris AP terpisah — pola ini alami mengikuti apa yang
benar-benar diterima kapan, tanpa perlu merekonsiliasi "AP tunggal per PO" yang mengasumsikan
pengiriman tunggal.

### 2. Tabel yang dipakai: `legacy_payable_ledger`, BUKAN `supplier_invoice`

`supplier_invoice` (V005) punya skema lengkap (FK ke `purchase_order`, `due_date`, `match_status`)
tetapi **tidak pernah dibaca satu pun endpoint yang benar-benar dipakai** — hanya diisi CLI import
dan satu hitungan dashboard. Seluruh mesin yang benar-benar bekerja (`/ap/payments`,
`inventory_ap_payment`/`inventory_ap_payment_allocation`, laporan aging, daftar hutang) mengacu ke
`legacy_payable_ledger` lewat **FK NOT NULL** (`inventory_ap_payment_allocation.payable_ledger_id
REFERENCES legacy_payable_ledger(id)`, V047). Memakai `supplier_invoice` berarti membangun ulang
seluruh mesin pelunasan itu dari nol; memakai `legacy_payable_ledger` berarti menyambung ke mesin
yang sudah teruji tanpa mengubahnya sedikit pun.

`legacy_payable_ledger` secara struktural adalah vault impor DBF (`source_file`/`legacy_row_number
NOT NULL` sebagai kunci unik, bukan kolom biasa). Baris hidup dibedakan lewat:
- `source_file = 'LIVE:PURCHASING'` — tidak mungkin bertabrakan dengan nama berkas DBF sungguhan.
- `legacy_row_number` dari sequence khusus (`live_payable_ledger_seq`, migration V053) — dijamin
  unik tanpa mengganggu penomoran baris impor DBF yang punya `LegacyRow.rowNumber` sendiri.
- `metadata->>'origin' = 'goods_receipt'` plus `goodsReceiptId`/`purchaseOrderId` — jejak audit ke
  sumber sungguhan, dapat ditelusuri kembali.
- `status = 'OPEN'` — meniru konvensi NYATA yang dipakai `importPayableLedger()` (`'OPEN'` /
  `'SETTLED'`), BUKAN nilai default kolom (`'IMPORTED'`) yang ternyata tidak dipakai jalur impor
  yang sesungguhnya.

Alasan yang sama berlaku untuk riwayat harga beli — dipakai ulang `legacy_price_history`.

### 3. Jatuh tempo

`due_date = tanggal_penerimaan + supplier.payment_term_id → payment_term.due_days`. Bila supplier
tidak punya termin, `due_days` dianggap 0 (jatuh tempo saat diterima) — bawaan yang aman, tidak
diam-diam memberi tempo kredit yang tidak disepakati.

### 4. Peristiwa akuntansi, BUKAN jurnal langsung

Kode TIDAK menulis baris `journal_entry`/`journal_entry_line` secara langsung — itu justru yang
dilarang tegas komentar sumber `posting-engine.ts` ("Blueprint melarang menulis debit/kredit di
controller"). Sebagai gantinya, mengikuti pola `AccountingEventCatalogRegistry` (IR-003) yang
sudah dipakai modul koperasi: `TenantModule` mendaftarkan katalog `PURCHASE_GOODS_RECEIPT_VALUED`
(satu peristiwa, nilai `inventoryValue`, dipakai KEDUA sisi jurnal lewat dua baris
`accounting_posting_rule` yang menunjuk medan yang sama), dan `validateGoodsReceipt` menerbitkan
baris `accounting_event` berstatus `PENDING`, idempoten pada
`PURCHASE_GOODS_RECEIPT_VALUED:GOODS_RECEIPT:<id>`.

**Ditemukan dan didokumentasikan apa adanya, bukan disembunyikan:** saluran peristiwa-ke-jurnal
(`buildJournalLines()` di `posting-engine.ts`) adalah fungsi murni yang **tidak dipanggil siapa pun**
di seluruh codebase ini. Tidak ada pekerja/scheduler yang memproses antrean `PENDING` menjadi
`journal_entry` sungguhan, dan tidak ada satu pun `accounting_posting_rule` tersemai untuk peristiwa
apa pun — termasuk 12 peristiwa `POS_*` inti yang sudah lama diterbitkan `pos-sale.service.ts`.
Ini adalah **keadaan yang sudah ada sebelumnya, berlaku sama bagi seluruh modul** (POS, marketplace,
koperasi), bukan celah yang dibuka pekerjaan ini. Peristiwa pembelian sekarang **sejajar** dengan
tingkat kelengkapan POS — sudah diterbitkan dengan benar, siap dijurnal begitu saluran
peristiwa-ke-jurnal (di luar cakupan pekerjaan ini) dibangun.

## Yang SENGAJA tidak dikerjakan pada slice ini

- **Saluran peristiwa-ke-jurnal (scheduler/worker) itu sendiri.** Ini bukan pekerjaan khusus
  purchasing — memperbaikinya sekaligus memperbaiki POS, marketplace, dan koperasi. Layak menjadi
  slice tersendiri, bukan tambahan diam-diam di sini.
- **Penyemaian `accounting_posting_rule` untuk `PURCHASE_GOODS_RECEIPT_VALUED`.** Keputusan akun
  mana (kode COA mana untuk Persediaan, kode COA mana untuk Hutang Dagang) adalah keputusan bisnis
  per tenant, bukan sesuatu yang dapat ditebak kode.
- **Sisi Sales Order → AR.** Menyusul sebagai slice terpisah per arahan pengguna.
- **Pajak pembelian (PPN Masukan) sebagai baris jurnal terpisah.** Nilai yang diterbitkan hanya
  `inventoryValue`; skenario pajak pembelian yang lebih rumit di luar cakupan penerimaan barang
  dasar.

## Verifikasi

```text
apps/api lint   → 0 error/warning
apps/api build  → lulus
apps/api test   → lihat commit terkait untuk jumlah lulus
```

Tidak diuji terhadap PostgreSQL sungguhan (tidak tersedia di lingkungan audit ini). Sebelum
dianggap selesai sungguhan: jalankan migration V053 pada database pengembangan, validasi
`validateGoodsReceipt` sungguhan menghasilkan baris `legacy_payable_ledger`/`legacy_price_history`/
`accounting_event` yang benar, dan uji `/ap/payments` benar-benar dapat melunasi baris yang
dihasilkan alur ini (bukan hanya baris hasil impor).
