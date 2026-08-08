# UAT — Layar 48 (Cetak Laporan Laba/Rugi — Reprint)

**Tenant uji:** `uat_finance_15643`. **Prasyarat:** snapshot layar 47 (`2619ee6d-64cf-491c-97b8-263f1b6ff885`) sudah ada.

## Skenario

1. `POST /report-snapshots/2619ee6d.../print-log` `{"format":"PDF","documentNumber":"LR-2026-0001"}` → print-log #1.
2. Cetak ulang (reprint) SNAPSHOT YANG SAMA: `POST /report-snapshots/2619ee6d.../print-log` `{"format":"PDF","documentNumber":"LR-2026-0002-REPRINT"}` → print-log #2, `snapshot_id` sama dengan #1.
3. Verifikasi rantai audit lewat SQL (`audit-chain.sql.txt`): kedua baris `inventory_print_log` merujuk `snapshot_id` yang identik, `document_number` berbeda, `printed_at` berurutan.

## Hasil

**PASS.** Reprint memakai snapshot yang sama persis (bukan menghitung ulang), dan setiap cetak menambah baris audit baru tanpa mengubah snapshot maupun baris print-log sebelumnya.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android dan berkas PDF fisik tidak dihasilkan pada pass ini.
