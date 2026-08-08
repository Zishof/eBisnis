# UAT — Layar 47 (Laporan Laba/Rugi — Snapshot)

**Tenant uji:** `uat_finance_15643`. **Prasyarat:** sama seperti layar 45.

## Skenario

1. `POST /reports/profit-loss/snapshot` `{"asOfDate":"2026-08-09"}` → snapshot `2619ee6d-64cf-491c-97b8-263f1b6ff885`, `row_count=5` (lihat `api-snapshot.json`).
2. `GET /report-snapshots/2619ee6d...` → `result_payload` identik dengan hasil preview pada waktu snapshot dibuat (lihat `api-retrieve.json`).
3. **Uji immutability nyata** (lihat `snapshot-immutability.md` untuk rincian penuh): buat transaksi KEDUA setelah snapshot terbentuk, proses jurnalnya, buktikan laporan LIVE berubah (REVENUE 180000→270000) — lalu ambil ulang snapshot LAMA yang sama dan buktikan angkanya TETAP 180000, tidak ikut berubah.

## Hasil

**PASS.** `result_payload` snapshot sama persis dengan preview pada tanggal yang sama (langkah 2), dan TETAP tidak berubah setelah data sumber berubah (langkah 3) — bukti immutability nyata, bukan hanya struktural (constraint DB), tetapi diuji lewat percobaan langsung mengubah data lalu membaca ulang.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil pada pass ini.
