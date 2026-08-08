# UAT — Layar 46 (Cetak Laba Rugi Kotor)

**Tenant uji:** `uat_finance_15643`. **Prasyarat:** sama seperti layar 45 (lihat `../screen-45/uat.md`).

## Skenario

1. `POST /reports/gross-profit/snapshot` `{"asOfDate":"2026-08-09"}` → snapshot `ef6835b4-1a5f-4ddc-8201-582ced4419b1` terbentuk, `row_count=1`, `source_revision=V047` (lihat `api-snapshot.json`).
2. `POST /report-snapshots/ef6835b4.../print-log` `{"format":"PDF","documentNumber":"LK-2026-0001"}` → baris print-log tercatat (lihat `print-log.json`).
3. Verifikasi lewat SQL (lihat `../screen-48/audit-chain.sql.txt`, mencakup baris layar 46 dan 48 sekaligus): `inventory_print_log` merujuk `snapshot_id` yang benar.

## Hasil

**PASS.** Snapshot beku + print-log tercatat, sesuai DoD.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android dan berkas PDF fisik tidak dihasilkan pada pass ini — endpoint hanya mencatat metadata cetak (`output_format`, `document_number`, `printed_at`), rendering PDF sungguhan adalah tanggung jawab lapisan lain yang tidak diuji di sini.
