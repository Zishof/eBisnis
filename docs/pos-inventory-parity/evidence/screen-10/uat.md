# UAT — Layar 10 (Mencetak Laporan Opname Stok)

**Tenant uji:** `uat_stock_price_18662`. **Konteks:** commit `562b666` sesi sebelumnya
mengklaim memperbaiki `reportSql('stock-opname', ...)` supaya menggabung
(`UNION ALL`) tabel live `inventory_stock_opname_session`/`_line` (status APPROVED/POSTED)
dengan tabel legacy `legacy_stock_opname` (hanya diisi impor CLI sekali-jalan) — sesuai
temuan `09-master-stock-pricing-findings.md` #6 yang menyatakan laporan SEBELUMNYA
hanya membaca dari tabel legacy. Pass ini membuktikan itu dengan data live sungguhan,
bukan review kode.

## Skenario

1. Setelah 3 siklus opname penuh (freeze→count→approve→post) selesai di layar 9 —
   opname #1 (varians −5), #2 (+5), #3 (−5) — panggil `POST /reports/stock-opname/preview`
   dengan `asOfDate=2026-08-09`.
2. **Hasil: `rowCount: 3`**, ketiga baris live (bukan data impor CLI — tenant ini baru
   dibuat, tidak pernah menjalani impor CLI sama sekali) muncul dengan `variance_qty`
   yang benar (−5, +5, −5) sesuai catatan fisik masing-masing opname. Lihat
   `preview-live-3-sessions.json`. Ini membuktikan UNION ALL benar-benar menyertakan
   `inventory_stock_opname_session`/`_line`, bukan cuma placeholder kode.
3. **Snapshot**: `POST /reports/stock-opname/snapshot` → `id` tersimpan,
   `row_count: 3` dibekukan (`snapshot-create.json`).
4. **Buat opname #4** (varians −5 lagi) untuk mengubah data live SETELAH snapshot
   dibuat.
5. **Immutability**: `GET /report-snapshots/:id` untuk snapshot yang sama →
   **masih `row_count: 3`**, isi `result_payload` identik dengan sebelum opname #4
   (`snapshot-retrieve-still-3-rows-immutable.json`) — snapshot beku, tidak
   dihitung ulang.
6. **Live preview setelah mutasi**: `POST /reports/stock-opname/preview` lagi →
   **`rowCount: 4`** sekarang (`preview-after-4th-opname.json`) — live selalu
   terkini, snapshot selalu beku. Kontras yang jelas antara keduanya.
7. **Print log**: `POST /report-snapshots/:id/print-log` dengan `format:"PDF"` →
   sukses, `printed_at` tercatat (`print-log.json`).

## Hasil

**PASS.** Klaim "mekanisme snapshot benar, sumber data sekarang live" dari commit
sebelumnya terbukti dengan data sungguhan: laporan opname layar 10 menampilkan
opname yang benar-benar dijalankan lewat siklus freeze→count→approve→post nyata,
bukan cuma baris impor CLI. Mekanisme snapshot-beku + print-audit juga terbukti:
snapshot tidak berubah walau data sumber berubah setelahnya, dan live preview selalu
mencerminkan state terkini.

**Catatan:** `variance_value` pada setiap baris laporan ini adalah `0.0000000000`
untuk semua baris — ini KONSISTEN dengan (bukan bug baru, gejala dari) temuan
`average_cost` di `screen-08/uat.md`: `unit_cost` pada baris opname disalin dari
`stock_balance.average_cost` saat baris opname dibuat, yang selalu 0 untuk stok yang
berasal dari transaksi live. Dampaknya di sini: laporan opname menunjukkan **kuantitas
selisih yang benar** tapi **nilai rupiah selisih yang selalu nol** — bagian
"nilai" dari laporan opname tidak bisa dipercaya sampai gap `average_cost` diperbaiki.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Baris `legacy_stock_opname` (jalur
impor CLI) tidak diuji langsung karena tenant uji ini tidak pernah menjalani impor
CLI — union-nya diverifikasi secara kode (query memakai `UNION ALL` eksplisit
antara dua sumber), bukan dengan data legacy sungguhan di tenant ini.
