# UAT — Layar 26 (Mencetak Pembayaran Hutang)

**Tenant uji:** `uat_purchase_ap_19222`. **Endpoint:** `POST /reports/ap-payment-register/preview`
+ `/snapshot`, `GET /report-snapshots/:id`, `POST /report-snapshots/:id/print-log`. **Alur data:**
2 pembayaran dari `screen-25/uat.md` (600000 TRANSFER lunas GR-000001, 200000 CASH cicilan
GR-000002).

## Skenario

1. **Preview** (tidak persisten): `POST /reports/ap-payment-register/preview`
   `{"asOfDate":"2026-08-09"}` → `rowCount=2`, `totals.total_amount="800000"`, kedua baris
   pembayaran lengkap dengan `payment_number`, `supplier_code`, `method`, `reference_number`,
   `status`. Bukti: `api-ap-payment-register-preview.json`.

2. **Snapshot** (persisten, untuk "cetak"): `POST /reports/ap-payment-register/snapshot` body sama
   → **HTTP 201**, `{id, report_code, row_count:2, source_revision:"V047"}`. Bukti:
   `api-ap-payment-register-snapshot.json`. `GET /report-snapshots/:id` mengembalikan baris
   tersimpan lengkap. Bukti: `api-report-snapshot-get.json`.

3. **Log cetak**: `POST /report-snapshots/:id/print-log` body `{"format":"PRINT"}` (format wajib
   diisi salah satu `PDF|EXCEL|PRINT|CSV`, dibuktikan lewat percobaan pertama tanpa body →
   **HTTP 400** `VALIDATION_FAILED`) → **HTTP 201**, `{id, report_code, output_format:"PRINT",
   printed_at}`. Bukti: `api-report-snapshot-print-log.json`.

4. **Rekonsiliasi**: `reportSql('ap-payment-register')` menjumlahkan **SEMUA status**
   (`DRAFT`/`POSTED`/`REVERSED`), bukan hanya `POSTED`. Query manual (`reconciliation.sql`)
   membuktikan pada data uji ini kebetulan sama (`800000`, keduanya `POSTED`) — tapi ini catatan
   penting utk pembaca laporan: laporan register pembayaran **tidak** membedakan pembayaran yang
   sudah benar-benar diposting dari yang masih draft/sudah dibalik. Hasil: `reconciliation-result.txt`.

## Hasil

**PASS** untuk mekanisme preview → snapshot → print-log, dan angka cocok rekonsiliasi SQL manual
pada data uji ini (kebetulan seluruhnya `POSTED`). **Catatan (bukan bug, perilaku laporan)**:
laporan ini menjumlahkan semua status pembayaran termasuk `DRAFT`/`REVERSED` — pengguna yang
membaca "total pembayaran hutang periode ini" bisa salah kira jika ada pembayaran yang di-reverse
atau masih draft (tidak diuji di sini karena di luar cakupan data yang dibuat, tapi terlihat jelas
dari `reportSql` sumbernya: `WHERE p.payment_date <= $1::date` — tidak ada filter `status`).

## Yang TIDAK dicakup pass ini

Tidak diuji dengan pembayaran berstatus `DRAFT`/`REVERSED` campur untuk memverifikasi langsung
bahwa keduanya ikut terhitung di total (disimpulkan dari pembacaan `reportSql`, bukan uji HTTP
langsung — lihat catatan Hasil). Screenshot Web/Windows/Android tidak diambil.
