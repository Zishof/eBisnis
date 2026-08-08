# UAT — Layar 29 (Mencetak Laporan Pembelian per Periode) — Rekonsiliasi + Immutability Snapshot

**Tenant uji:** `uat_purchase_ap_19222`. **Endpoint:** `POST /reports/purchase-register/preview`
+ `/snapshot`, `GET /report-snapshots/:id`. **Alur data:** 4 PO dari `screen-20/uat.md`.

## Skenario

1. **Snapshot diambil SEBELUM PO-000004 dibuat** (`id=3edb7ad5-...`): `row_count=3`,
   `totals.grand_total="1400000"` (hanya PO-000001..003). Bukti:
   `api-purchase-register-snapshot.json`.

2. **PO-000004 dibuat** (60000, lihat `screen-20/uat.md`) — total sumber data sekarang 1460000/4 PO.

3. **Immutability**: `GET /report-snapshots/3edb7ad5-...` dipanggil ULANG **setelah** PO-000004
   ada → snapshot **TETAP** melaporkan `row_count=3`, `result_payload.totals.grand_total="1400000"`
   — **TIDAK berubah** walau data sumber (`purchase_order`) sudah berubah setelah snapshot diambil.
   Bukti: `api-snapshot-immutability-check.json`. Properti ini sama seperti yang dibuktikan pada
   `screen-45..48/uat.md` untuk domain FINANCE — di sini dibuktikan ulang utk domain Purchase/AP.

4. **Snapshot baru diambil SETELAH PO-000004 ada** (`id=19f405c6-...`): `row_count=4`. Bukti:
   `api-purchase-register-snapshot-current.json`. Konfirmasi laporan LIVE (preview) memang berubah
   mengikuti data terbaru — hanya snapshot yang membeku, sesuai desainnya.

5. **Rekonsiliasi** (state akhir, 4 PO): `POST /reports/purchase-register/preview
   {"asOfDate":"2026-08-09"}` → `rowCount=4`, `totals.grand_total="1460000"`. Bukti:
   `api-purchase-register-preview.json`. SQL manual (`reconciliation.sql`) —
   `SELECT sum(grand_total) FROM purchase_order WHERE deleted_at IS NULL AND order_date <= asOfDate`
   → **1460000**, `po_count=4` — cocok 100% (`reconciliation-result.txt`).

## Catatan perilaku (bukan bug): "per Periode" sebenarnya cuma satu batas atas tanggal

Nama layar legacy "Laporan Pembelian **per Periode**" mengimplikasikan rentang tanggal (awal-akhir),
tapi `ReportDto` cuma menerima `asOfDate` tunggal — SQL-nya `WHERE po.order_date <= $1::date`,
**tidak ada batas bawah**. Untuk laporan "bulan Juli saja" misalnya, tidak ada cara memfilternya
lewat endpoint ini — klien harus mengambil semua baris sampai `asOfDate` lalu memfilter sendiri di
sisi klien/UI. `filters` yang diterima di body juga tidak dipakai (sama seperti dicatat di
`screen-28/uat.md`). Dicatat sebagai gap kontrak API vs ekspektasi nama layar, bukan cacat data.

## Hasil

**PASS** untuk akurasi data (cocok rekonsiliasi SQL independen di dua titik waktu berbeda) DAN
immutability snapshot (angka historis tidak berubah walau data sumber berubah setelahnya) —
properti kritis yang sama seperti dibuktikan untuk domain FINANCE. Catatan kontrak "per Periode
tanpa batas bawah" didokumentasikan sebagai observasi.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil.
