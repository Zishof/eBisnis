# Requirement Ledger — 48 Layar Inventory-Sales (Berbukti Source)

**Tanggal audit:** 2026-08-08
**Workspace:** `C:\opt\eBisnis-Github\eBisnis`
**Metode:** verifikasi source aktual (katalog paritas, controller, migrasi tenant, test, UI Web & Flutter). SHA commit diisi lokal via `git rev-parse HEAD`.

> **Konvensi status kolom bukti:**
> `WIRED` = endpoint/handler nyata ada & dipanggil UI. `TESTED` = ada unit/contract test. `PROVEN` = WIRED+TESTED+build/smoke/print/reconciliation/UAT (belum ada di sesi ini). Status default seluruh baris saat ini: **WIRED, sebagian TESTED, belum PROVEN**.

---

## A. Temuan struktural (konteks ledger)

**A.1. Katalog paritas adalah sumber kebenaran di kode.**
`apps/api/src/modules/tenant/sales-inventory-parity.catalog.ts` (baris 55–104) mendefinisikan 48 layar → domain, endpoint API, route Web (`webRouteForScreen`, baris 32–49), modul Flutter. Semua ditandai `OPERATIONAL/OPERATIONAL`.

**A.2. ⚠️ Test mengunci deklarasi, bukan membuktikan operasi.**
`sales-inventory-parity.catalog.spec.ts` baris 42–47 **meng-hardcode** `flutter.operational === 48`, `readOnly === 0`, `contractOnly === 0` (idem Web). Konsekuensi: bila developer jujur menurunkan satu layar ke READ_ONLY/CONTRACT_ONLY, test ini GAGAL. Test hanya memverifikasi katalog terisi penuh & konsisten (`api.length > 0`, path diawali `/`), **bukan** tiap endpoint bekerja end-to-end. Ini persis yang diperingatkan paket: "daftar/teks fitur saja bukan bukti." → **Rekomendasi: ubah test menjadi menerima gap jujur, dan pindahkan bukti operasional ke test integrasi/e2e per layar.**

**A.3. Substansi domain yang benar-benar diuji (kuat).**
Test yang sama (baris 50–67) memverifikasi SQL laporan keuangan: profit-loss memakai `je.status='POSTED'`, `coa.normal_balance='DEBIT'`, kategori dari `account_type` (bukan kolom fiktif); gross-profit memakai `legacy_unit_cost` & `so.status='INVOICED'`. Ini bukti korektnes akuntansi yang nyata.

**A.4. Implementasi additive & aktif berjalan.**
Migrasi tenant `V045`–`V062` adalah pembangunan paritas Inventory-Sales, semuanya additive. `V052`–`V062` ber-timestamp hari ini (posting rules, AP/AR bridge, sales-note custody) → ada sesi implementasi in-progress. `sales-inventory-command-parity.spec.ts` memaksa V048 additive (dilarang membuat ulang tabel `product`/`sales_order`).

**A.5. Report engine riil.**
`reportSql()` di controller (baris 2114–2260+) mendukung 14 kode: `stock-list`, `stock-opname`, `price-sale`, `price-purchase`, `purchase-register`, `purchase-invoice`, `ap-payment-register`, `ap-aging`, `ar-receipt-register`, `ar-aging-customer`, `ar-aging-sales`, `ar-outstanding`, `sales-note-handover`, `gross-profit`, `profit-loss`.

---

## B. Migrasi pendukung paritas (bukti DB additive)

| Versi | File | Peran |
|---|---|---|
| V004 | `V004__inventory.sql` | Skema inventory dasar |
| V005 | `V005__purchasing_transfer.sql` | Pembelian & transfer |
| V006 | `V006__sales_pos_finance_hr.sql` | Sales/POS/finance |
| V015 | `V015__accounting_events.sql` | Accounting event engine |
| V045 | `V045__cmn_legacy_inventory_vault.sql` | Vault data legacy |
| V046 | `V046__sales_inventory_parity.sql` | Fondasi paritas |
| V047 | `V047__sales_inventory_operations.sql` | Operasi (opname, AP/AR, dsb.) |
| V048 | `V048__sales_inventory_command_parity.sql` | Command/approval/sync (offline) |
| V050 | `V050__inventory_party_master_parity.sql` | Master supplier/customer/sales |
| V051 | `V051__inventory_transaction_workspace.sql` | Workspace transaksi |
| V053 | `V053__purchase_ap_bridge.sql` | Jembatan pembelian → hutang |
| V054 | `V054__sales_order_ar_bridge.sql` | Jembatan sales order → piutang |
| V055 | `V055__price_book_no_self_approval.sql` | Pemisahan approval harga |
| V056 | `V056__stock_opname_freeze_index.sql` | Index freeze opname |
| V057 | `V057__inventory_sales_posting_rules.sql` | Aturan posting jurnal *(hari ini)* |
| V058 | `V058__current_fiscal_periods.sql` | Periode fiskal *(hari ini)* |
| V059–V061 | `pos_*_posting_rules.sql` | Posting POS/reversal/kas *(hari ini)* |
| V062 | `V062__sales_note_custody_event.sql` | Event custody nota *(hari ini)* |

---

## C. Ledger per layar (screen → endpoint → controller → UI)

Kolom "Controller" = baris di `sales-inventory-operations.controller.ts`. Web/Flutter = terbukti memanggil endpoint terkait.

| # | Layar legacy | Domain | Endpoint inti | Controller (baris) | Web | Flutter | Test |
|--:|---|---|---|---|:--:|:--:|:--:|
| 1–3 | Data/Daftar Supplier | MASTER | `/suppliers`, `/inventory/party-master-balances/suppliers` | 443 | ✓ | ✓ | party-master.spec |
| 4–6 | Data/Daftar Customer | MASTER | `/customers`, `.../customers` | 443 | ✓ | ✓ | party-master.spec |
| 7 | Data Sales/Penjual Keliling | MASTER | `/salespeople`, `.../salespeople` | 443 | ✓ | ✓ | party-master.spec |
| 8 | Data Stok Barang | STOCK | `/inventory/balances`, `/inventory/mobile-catalog` | (erp-inventory `listBalances`) | ✓ | ✓ | catalog.spec (scoped) |
| 9 | Laporan Opname | STOCK | `/stock-opnames` (+freeze/approve/post) | 796–958 | ✓ | ✓ | V056 index |
| 10 | Cetak Opname | STOCK | `/reports/stock-opname/snapshot` | 1487, reportSql 2133 | ✓ | ✓ | catalog.spec |
| 11–12 | Harga Beli/Jual + cari | STOCK_PRICE | `/inventory/legacy/price-history` | (legacy handler) | ✓ | ✓ | — |
| 13 | Cetak Harga Jual | STOCK_PRICE | `/reports/price-sale/snapshot` | reportSql 2156 | ✓ | ✓ | — |
| 14–15 | Ekspor/Cetak Daftar Stok | STOCK_PRICE | `/reports/stock-list/snapshot` | reportSql 2124 | ✓ | ✓ | — |
| 16 | Hasil Cetak Stok | STOCK_PRICE | `/report-snapshots/:id` | 1508 | ✓ | ✓ | — |
| 17–19 | Master Harga (beli/jual) | STOCK_PRICE | `/inventory/price-books` (+status) | 461–525 | ✓ | ✓ | V055 no-self-approval |
| 20 | Pembelian dari Supplier | PURCHASE_AP | `/purchase-orders`, `/goods-receipts` | (erp-purchasing) | ✓ | ✓ | V053 AP bridge |
| 21–23 | Hutang Supplier (+lunas) | PURCHASE_AP | `/inventory/legacy/payables` | (legacy handler) | ✓ | ✓ | — |
| 24–25 | Pembayaran Hutang (+lihat) | PURCHASE_AP | `/ap/payments` (+post/reverse) | 1018, 1169–1192 | ✓ | ✓ | — |
| 26 | Cetak Pembayaran Hutang | PURCHASE_AP | `/reports/ap-payment-register/snapshot` | reportSql 2198 | ✓ | ✓ | — |
| 27 | Analisis Hutang | PURCHASE_AP | `/reports/ap-aging/snapshot` | reportSql 2212 | ✓ | ✓ | — |
| 28 | Cetak Faktur Pembelian | PURCHASE_AP | `/reports/purchase-invoice/snapshot` | reportSql | ✓ | ✓ | — |
| 29 | Laporan Pembelian/Periode | PURCHASE_AP | `/reports/purchase-register/snapshot` | reportSql 2188 | ✓ | ✓ | — |
| 30 | Menu Penjualan | SALES_AR | `/inventory/mobile-orders`, `/sales/orders` | (order svc) | ✓ | ✓ | V054 AR bridge |
| 31–33 | Piutang Customer (+lunas) | SALES_AR | `/inventory/legacy/receivables` | (legacy handler) | ✓ | ✓ | — |
| 34–35 | Pembayaran Piutang (+lihat) | SALES_AR | `/ar/receipts` (+post/reverse) | 1203–1241 | ✓ | ✓ | — |
| 36 | Cetak Pembayaran Piutang | SALES_AR | `/reports/ar-receipt-register/snapshot` | reportSql 2205 | ✓ | ✓ | — |
| 37–38 | Analisis Piutang (customer/sales) | SALES_AR | `/reports/ar-aging-customer|sales/snapshot` | reportSql 2216–2220 | ✓ | ✓ | — |
| 39–40 | Sales Membawa Nota / Nota Sales | SALES_AR | `/sales-note-handovers` (+handover/return/close/cancel) | 1252–1448 | ✓ | ✓ | V062 custody event |
| 41–42 | Laporan Piutang (+cetak) | SALES_AR | `/reports/ar-outstanding/snapshot`, `/report-snapshots/:id` | reportSql 2229 | ✓ | ✓ | — |
| 43 | Kas dan Jurnal | FINANCE | `/inventory/finance-workspace`, `/inventory/journals` (+post/reverse) | 577, 651–729 | ✓ | ✓ | V057 posting rules |
| 44 | Membuat Perkiraan Baru | FINANCE | `/inventory/chart-accounts` | 613 | ✓ | ✓ | — |
| 45 | Menu Laba/Rugi | FINANCE | `/reports/gross-profit|profit-loss/preview` | reportSql 2241–2253 | ✓ | ✓ | catalog.spec ✓ |
| 46 | Cetak Laba Rugi Kotor | FINANCE | `/reports/gross-profit/snapshot` | reportSql 2241 | ✓ | ✓ | catalog.spec ✓ |
| 47–48 | Laporan Laba/Rugi (+cetak) | FINANCE | `/reports/profit-loss/snapshot`, `/report-snapshots/:id/print-log` | 1523, reportSql 2253 | ✓ | ✓ | catalog.spec ✓ |

---

## D. Prioritas kerja (berdasarkan bukti)

1. **Perbaiki self-test paritas (A.2).** Ubah `catalog.spec` agar tidak memaksa 48/48 OPERATIONAL; izinkan status jujur; tambah e2e per domain sebagai bukti operasional sebenarnya. *Ini prasyarat integritas semua status DONE.*
2. **Baseline (belum dijalankan):** `pnpm lint/test/build` + `flutter analyze/test`. Simpan exit code sebagai evidence.
3. **Bukti PROVEN untuk domain FINANCE (45–48)** paling siap karena SQL sudah ter-test → lengkapi print snapshot + reconciliation + UAT lebih dulu sebagai pola percontohan.
4. **Verifikasi legacy handler (`/inventory/legacy/*`)** untuk layar 11–12, 21–23, 31–33 — endpoint ini belum saya lihat definisinya di controller utama; perlu dilacak file/handler-nya.
5. **Rekonsiliasi dokumentasi** README Flutter dengan source aktual.

## E. Batas audit

Belum diverifikasi sesi ini: eksekusi baseline; isi `/inventory/legacy/*` handler; migrasi vs DB aktual (drift); UAT/print/reconciliation per layar; SHA commit; seluruh 105 hlm PDF & 4.715 baris master contract (Bagian II).
