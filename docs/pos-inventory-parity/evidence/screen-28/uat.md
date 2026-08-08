# UAT — Layar 28 (Mencetak Faktur Pembelian Barang)

**Tenant uji:** `uat_purchase_ap_19222`. **Endpoint:** `GET /purchase-orders/:id`,
`POST /reports/purchase-invoice/preview`. **Alur data:** 4 PO dari `screen-20/uat.md`.

## Skenario

1. **Detail satu PO** (representasi "faktur" satu dokumen): `GET /purchase-orders/{PO-000001}`
   → header lengkap (`purchase_order_number`, `status="RECEIVED"`, `grand_total="600000.0000"`)
   plus `lines[]` (produk AYAM, `ordered_qty=50`, `unit_price=12000`, `line_total=600000`). Bukti:
   `api-po1-detail.json`.

2. **Laporan `purchase-invoice`**: `POST /reports/purchase-invoice/preview {"asOfDate":"2026-08-09"}`
   → `rowCount=4`, `totals.line_total="1460000"`, satu baris per baris-PO lintas SEMUA 4 PO
   (PO-000001..PO-000004) yang `order_date <= asOfDate`. Bukti: `api-purchase-invoice-preview.json`.

3. **Rekonsiliasi**: SQL manual (`reconciliation.sql`) — `SELECT ... FROM purchase_order po JOIN
   purchase_order_line pol ... WHERE po.deleted_at IS NULL AND po.order_date <= asOfDate` — hasil
   4 baris, total **1460000**, cocok 100% dengan respons API (`reconciliation-result.txt`).

## Catatan perilaku (bukan bug): laporan ini bukan "faktur per PO", tapi daftar baris lintas-PO

Nama layar legacy "Mencetak Faktur Pembelian Barang" secara wajar terdengar seperti "cetak faktur
untuk SATU pembelian yang saya pilih" — tapi `reportSql('purchase-invoice')`
(`sales-inventory-operations.controller.ts:2174-2186`) tidak menerima parameter `poId` sama sekali;
`filters` yang dikirim di body diterima dan digemakan balik di respons tapi **tidak pernah dipakai**
pada klausa `WHERE` (`buildReport()` tidak meneruskannya ke `reportSql()`). Jadi memanggil laporan
ini SELALU mengembalikan baris dari SEMUA PO sampai `asOfDate`, bukan satu PO. Untuk "mencetak
faktur pembelian [tertentu]" secara praktis, jalur yang benar adalah `GET /purchase-orders/:id`
langsung (poin 1 di atas) dan format tampilannya di sisi klien — bukan endpoint laporan ini.
Dicatat sebagai gap kontrak API/nama layar, bukan cacat data (datanya sendiri akurat, sudah
direkonsiliasi di atas).

## Hasil

**PASS** untuk akurasi data (baik `GET /purchase-orders/:id` maupun laporan `purchase-invoice`
cocok dengan sumber data via rekonsiliasi SQL independen). Catatan kontrak di atas
(laporan lintas-PO, bukan per-PO, dan `filters` tidak berfungsi) didokumentasikan sebagai
observasi, bukan kegagalan.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil.
