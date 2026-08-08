# Peta Controller → Endpoint (Penutup Celah Audit)

**Tanggal:** 2026-08-08
**Tujuan:** menutup "titik lemah D.4" pada ledger — memastikan endpoint `/inventory/legacy/*` dan seluruh route inti 48 layar benar-benar dilayani handler nyata, bukan hanya terdaftar di katalog.

## Kesimpulan

**Seluruh permukaan API 48 layar terbukti dilayani handler nyata.** Route tersebar di 4 controller yang diregistrasi bersama di `tenant.module.ts` baris 2633:
`controllers: [SalesInventoryOperationsController, ErpController, AccountingDocumentController, MasterController, TenantAdminController]`.

## 1. MasterController — `tenant.module.ts:579` (layar 1–7)

CRUD generik berbasis pola `:resource(MASTER_RESOURCE_PATTERN)` + registry `master-resource.registry.ts`. Satu set handler melayani semua master:

| Route | Baris | Fungsi |
|---|---|---|
| `GET master-resources` | 582 | Daftar resource |
| `GET :resource` / `:resource/:id` | 598 / 610 | List / detail |
| `POST :resource` | 622 | Create |
| `PATCH :resource/:id` | 636 | Update |
| `POST :resource/:id/deactivate\|activate` | 651 / 666 | Status |
| `DELETE :resource/:id` + `/restore` | 680 / 694 | Soft-delete/restore |
| `GET :resource/:id/references` | 708 | **Referential guard** |
| `POST :resource/:id/purge` | 720 | Hard-delete terkontrol |
| `GET :resource/:id/audit` | 739 | Jejak audit |

Registry memuat entri nyata: `suppliers` (tabel `supplier`, FK `supplier_group`/`payment_term`, referensi transaksional ke `purchase_order`/`goods_receipt`), `customers` (dengan `credit_limit`, `legacy_payment_days`, referensi ke `pos_sale`/`sales_order`), `salespeople` (`inventory_salesperson_profile`), plus `supplier-groups`, `customer-groups`, `uom`, `product_category`, `product_brand`, `product`, `warehouse`, `outlet`. Referential guard memastikan master tak bisa dihapus bila masih dipakai transaksi.

## 2. ErpController — `tenant.module.ts:894` (layar 8, 11–12, 20–23, 30–33)

| Route | Baris | Layar |
|---|---|---|
| `GET purchase-orders` (+`/:id`, submit, approve, send) | 1040–1132 | 20 |
| `POST purchase-orders` | 1093 | 20 |
| `GET goods-receipts` (+inspect/validate/reverse-validation/create-backorder) | 1147–1261 | 20 |
| `GET inventory/balances` | 1379 | 8 |
| `GET sales/orders` (+`/:id`) | 1419–1458 | 30 |
| `POST sales/orders/:id/invoice` | 1511 | **30 → jembatan AR** |
| `GET inventory/mobile-catalog` | 1913 | 8/30 (Android) |
| `POST inventory/mobile-orders` | 1986 | 30 (offline) |
| `GET inventory/master-data` | 1948 | 8 |
| `GET inventory/legacy-import-reconciliation` | 2211 | rekonsiliasi impor |
| `GET inventory/legacy/receivables` | 2292 | 31–33 |
| `GET inventory/legacy/payables` | 2342 | 21–23 |
| `GET inventory/legacy/price-history` | 2389 | 11–12 |
| `GET inventory/legacy/stock-opname` | 2420 | 9 |

## 3. AccountingDocumentController — `tenant.module.ts:826` (layar 43)

`GET journal-entries` (829), `GET journal-entries/:id` (851) — daftar & detail jurnal.

## 4. SalesInventoryOperationsController — `sales-inventory-operations.controller.ts` (layar 9–10, 13–19, 24–29, 34–48)

Sudah dipetakan di ledger `01-*`: price-books, finance-workspace, chart-accounts, journals (post/reverse), fiscal-periods (close/reopen), stock-opnames (freeze/approve/post), ap/payments & ar/receipts (post/reverse), sales-note-handovers (handover/return/close/cancel), reports (preview/snapshot, 14 kode `reportSql`), report-snapshots (+print-log), sync (bootstrap/pull/register/status/conflicts).

## Dampak pada status ledger

Titik lemah D.4 (**closed**): endpoint legacy bukan contract-only — semuanya `@Get` nyata dengan query ke `legacy_payable_ledger`/`legacy_receivable_ledger`/`legacy_price_history`/`legacy_stock_opname`. Dengan ini seluruh 48 layar terkonfirmasi **WIRED pada API** di 4 controller. Yang tersisa untuk naik ke **PROVEN** tetap: baseline build/test, e2e per layar, print/reconciliation/UAT, dan perbaikan self-test paritas (temuan A.2).
