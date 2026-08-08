# UAT — Layar 36 (Mencetak Pembayaran Piutang)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** sama seperti layar 35 — 1 penerimaan piutang
`POSTED` (AR-20260808-MSKSMLQI, 600000, CUST-002).

## Skenario

1. `POST /reports/ar-receipt-register/preview` `{"asOfDate":"2026-08-09"}` → 1 baris,
   `totals.total_amount:"600000"`, cocok dengan penerimaan yang diposting. Lihat `preview.json`.
2. `POST /reports/ar-receipt-register/snapshot` (payload sama) → snapshot beku terbentuk,
   id `69565263-a228-44e2-978f-8da90c474041`, `row_count:1`, `source_revision:"V047"`. Lihat
   `snapshot.json`.
3. `POST /report-snapshots/69565263.../print-log` `{"format":"PDF","documentNumber":"BKM-2026-0001"}`
   → print-log #1 (`fc3a4e53-...`). Lihat `print-log-1.json`.
4. Cetak ulang (reprint) SNAPSHOT YANG SAMA:
   `POST /report-snapshots/69565263.../print-log` `{"format":"PDF","documentNumber":"BKM-2026-0002-REPRINT"}`
   → print-log #2 (`d6d5fc36-...`), `snapshot_id` sama dengan #1. Lihat `print-log-2.json`.
5. `GET /report-snapshots/69565263...` → `snapshot-get.json`, hasil (`result_payload`) identik
   dengan preview langkah 1.

## Rekonsiliasi SQL

`audit-chain.sql.txt`: kedua baris `inventory_print_log` merujuk `snapshot_id` yang identik,
`document_number` berbeda (`BKM-2026-0001` vs `BKM-2026-0002-REPRINT`), `printed_at` berurutan —
pola rantai audit cetak sama persis dengan yang sudah dibuktikan di layar 46/48 (lihat
`../screen-48/uat.md`).

## Hasil

**PASS.** Cetak voucher pembayaran piutang memakai pola snapshot beku + print-log yang sama
dengan domain FINANCE yang sudah terbukti sebelumnya: data yang dicetak adalah salinan beku, dan
setiap cetak/cetak-ulang menambah baris audit baru tanpa mengubah snapshot atau print-log
sebelumnya.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android dan berkas PDF fisik tidak dihasilkan — endpoint hanya mencatat
metadata cetak (`output_format`, `document_number`, `printed_at`), sama seperti pola yang sudah
dicatat di layar 46/48.
