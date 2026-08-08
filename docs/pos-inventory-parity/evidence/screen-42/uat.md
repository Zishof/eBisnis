# UAT — Layar 42 (Mencetak Laporan Piutang — Snapshot Beku + Reprint)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** snapshot layar 41
(`cbcbe4b8-05e1-4421-95c2-9076bcb94237`, 2 baris, total 1800000, dibuat pada
`generated_at 2026-08-09 02:57:54`).

## Skenario cetak + reprint

1. `POST /report-snapshots/cbcbe4b8.../print-log` `{"format":"PDF","documentNumber":"LP-2026-0001"}`
   → print-log #1 (`94c4cba3-...`). Lihat `print-log-1.json`.
2. Cetak ulang SNAPSHOT YANG SAMA:
   `POST /report-snapshots/cbcbe4b8.../print-log` `{"format":"PDF","documentNumber":"LP-2026-0002-REPRINT"}`
   → print-log #2 (`b2da0af5-...`), `snapshot_id` sama dengan #1. Lihat `print-log-2.json`.

## Skenario immutability (data sumber berubah SETELAH snapshot diambil)

Ini pembuktian yang lebih kuat dari sekadar membaca ulang snapshot tanpa mengubah apa pun (yang
sudah dilakukan di layar 46-48 sebelumnya): di sini datanya BENAR-BENAR diubah setelah snapshot
terbentuk, lalu snapshot dibaca ulang untuk membuktikan ia tetap beku.

1. **Snapshot `cbcbe4b8-...` diambil** pada `02:57:54` — order 1 (Andi Pratama) tercatat
   `amount:"800000.0000"` di dalam `result_payload`.
2. **SETELAH itu**, ledger order 1 dilunasi SEBAGIAN — `POST /ar/receipts` alokasi 300000 →
   `POST .../post` (`mutate-partial-create.json`, `mutate-partial-post.json`).
3. **Data sumber (live) sekarang berubah**: `GET /inventory/legacy/receivables` menunjukkan order
   1 outstanding tinggal **500000** (`receivables-after-mutation.json`).
4. **Snapshot LAMA dibaca ulang**: `GET /report-snapshots/cbcbe4b8...` →
   `snapshot-after-mutation.json` — `result_payload.rows[0].amount` **TETAP `"800000.0000"`**,
   `totals.amount` **TETAP `"1800000"`**. Snapshot TIDAK IKUT BERUBAH walau data sumber sudah
   berbeda.

## Rekonsiliasi

`inventory_report_snapshot.result_payload` adalah kolom `jsonb` yang ditulis SEKALI saat
`POST .../snapshot` dan tidak pernah di-`UPDATE` oleh proses lain (dikonfirmasi lewat percobaan
mutasi nyata di atas, bukan pembacaan kode semata) — persis klaim "immutable snapshot" yang sudah
dibuktikan untuk domain FINANCE (layar 46-48), sekarang dibuktikan juga untuk domain Sales/AR
dengan skenario yang lebih ketat (mutasi data sumber SETELAH snapshot, bukan sebelum).

## Hasil

**PASS.** Cetak ulang memakai snapshot yang sama persis (bukan menghitung ulang), setiap cetak
menambah baris `inventory_print_log` baru tanpa mengubah snapshot/print-log sebelumnya, DAN
snapshot benar-benar beku terhadap perubahan data sumber setelah snapshot diambil — dibuktikan
lewat mutasi data nyata, bukan asumsi.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android dan berkas PDF fisik tidak dihasilkan.
