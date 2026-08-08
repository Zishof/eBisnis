# Bukti Immutability Snapshot — Layar 47 (Laporan Laba/Rugi)

**Snapshot:** `2619ee6d-64cf-491c-97b8-263f1b6ff885` (`report_code=profit-loss`, `as_of_date=2026-08-09`, `source_revision=V047`)
**Tenant uji:** `uat_finance_15643` (didaftarkan lewat `/public/registrations` khusus untuk UAT ini)

## Langkah

1. `POST /reports/profit-loss/snapshot` `{"asOfDate":"2026-08-09"}` selagi baru ada 1 sales order (REVENUE 180000, EXPENSE/COGS 120000).
2. `GET /report-snapshots/2619ee6d-...` → hasil sama persis dengan langkah 1 (lihat `api-retrieve.json`).
3. Buat sales order KEDUA (qty 5, unit price 18000 → subtotal 90000), invoice, proses event akuntansi (`POST /accounting-events/process-pending`).
4. `POST /reports/profit-loss/preview` (data hidup) → REVENUE **270000**, EXPENSE **180000** — angka berubah, membuktikan transaksi kedua benar-benar tercatat.
5. `GET /report-snapshots/2619ee6d-...` (snapshot LAMA yang sama, sekali lagi) → REVENUE **180000**, EXPENSE **120000** — **identik dengan langkah 2, TIDAK berubah** walau data hidup sudah berubah.

## Hasil

**PASS.** Diff antara `api-retrieve.json` (langkah 2) dan `api-retrieve-after-change.json` (langkah 5): kosong. `result_payload` snapshot benar-benar beku pada saat `POST .../snapshot` dipanggil, tidak dihitung ulang saat diambil kembali.
