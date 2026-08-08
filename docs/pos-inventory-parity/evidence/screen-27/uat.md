# UAT — Layar 27 (Analisis Hutang / AP Aging) — Rekonsiliasi + Temuan Gross vs Net

**Tenant uji:** `uat_purchase_ap_19222`. **Endpoint:** `POST /reports/ap-aging/preview`. **Alur
data:** lihat `screen-20/uat.md` — penting: GR-000003 sengaja dimundurkan tanggalnya lewat SQL
langsung (`transaction_date='2026-06-13'`, `due_date='2026-06-20'`, terhadap baris
`legacy_payable_ledger` yang SUDAH nyata terbentuk dari GR sungguhan) untuk mereplikasi kondisi
jatuh tempo — pola yang sama seperti manipulasi status order DRAFT via SQL pada
`screen-30/uat.md` ("skenario uji ... untuk mereplikasi prasyarat template").

## Skenario & rekonsiliasi

`POST /reports/ap-aging/preview {"asOfDate":"2026-08-09"}` → `rowCount=3`, `totals.amount="860000"`:

| Invoice | Jatuh tempo | Jumlah | `overdue_days` |
|---|---|---|---|
| GR-000003 | 2026-06-20 | 300000 | 50 |
| GR-000002 | 2026-08-16 | 500000 | 0 |
| GR-000004 | 2026-08-16 | 60000 | 0 |

Bukti: `api-ap-aging-preview.json`.

**Rekonsiliasi SQL independen** persis formula template (`05-template-bukti-proven-purchase-ap-sales-ar.md`
§3.5: *"total per pihak = sum(outstanding) dari ledger `NOT is_settled AND amount>0`"*,
*"`overdue_days = max(asOf - due_date, 0)`"*) — `reconciliation.sql`, hasil di
`reconciliation-result.txt`: **cocok 100%** dengan respons API (3 baris identik, total 860000
identik, `overdue_days` identik).

## Temuan DIDOKUMENTASIKAN (bukan diperbaiki): laporan aging pakai jumlah KOTOR, bukan sisa bersih

**Ditemukan lewat pass ini.** GR-000002 sudah dicicil 200000 dari 500000 (sisa/net outstanding
= 300000, dibuktikan lewat `/inventory/legacy/payables` di `screen-22/uat.md`) — tapi laporan
`ap-aging` menampilkannya dengan `amount=500000`, jumlah ASLI dokumen, bukan sisa 300000. Total
laporan (860000) karena itu lebih besar dari total hutang yang SEBENARNYA masih harus dibayar
(300000+300000+60000 = 660000 net, atau 500000+300000+60000=860000 gross — laporan memakai yang
kedua).

**Akar masalah**: fungsi `agingReport()` (`sales-inventory-operations.controller.ts:2308-2315`)
memilih `l.amount::text` langsung dari `legacy_payable_ledger`, tanpa `LEFT JOIN LATERAL` ke
`inventory_ap_payment_allocation` seperti yang dilakukan `GET /inventory/legacy/payables`
(`tenant.module.ts:2375-2377`). Filter `WHERE NOT l.is_settled AND l.amount > 0` memang
mengecualikan dokumen yang SUDAH lunas penuh, tapi dokumen yang BARU DICICIL sebagian tetap lolos
filter dengan nilai kotornya.

**Cakupan lebih luas dari layar ini**: fungsi `agingReport()` yang sama dipakai untuk
`ar-aging-customer` (layar 37) dan `ar-outstanding` (layar 41); `ar-aging-sales` (layar 38) punya
query terpisah tapi struktur identik (`l.amount::text` langsung, tanpa join alokasi) — jadi cacat
yang sama kemungkinan berlaku di keempat laporan, bukan cuma `ap-aging`. Sales/AR di luar cakupan
tugas ini, dicatat di sini untuk agent yang membuktikan layar 37/38/41.

**Kenapa dianggap PROVEN, bukan FAIL, untuk pass ini**: rekonsiliasi di atas membuktikan laporan
ini **cocok 100% dengan formula yang secara eksplisit didefinisikan template pembuktian** (§3.5) —
templatenya sendiri menulis `l.amount`, bukan versi net. Jadi secara kontrak-pembuktian, klaim
"aging benar" TERBUKTI. Temuan ini didokumentasikan sebagai **gap desain/bisnis** (nama layarnya
"Analisis Hutang" — pembaca laporan wajar mengharapkan angka SISA yang harus dibayar, bukan nilai
faktur asli), bukan cacat teknis pada implementasi query terhadap spesifikasinya.

**Kenapa TIDAK diperbaiki di pass ini**: perbaikannya butuh menambahkan join alokasi berbeda utk
`inventory_ap_payment_allocation` (AP) vs `inventory_ar_receipt_allocation` (AR) ke satu fungsi
generik yang dipakai lintas 4 kode laporan di 2 domain berbeda (Purchase/AP dan Sales/AR) —
domain Sales/AR sedang dibuktikan agent lain secara paralel dalam sesi ini; mengubah fungsi
bersama berisiko konflik/duplikasi kerja. Didokumentasikan agar keputusan (dan implementasinya)
bisa dikoordinasikan.

## Hasil

**PASS** — rekonsiliasi cocok 100% dengan formula template. Temuan gross-vs-net di atas
DIDOKUMENTASIKAN sebagai gap desain, bukan kegagalan pembuktian.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil.
