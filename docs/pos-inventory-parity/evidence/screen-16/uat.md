# UAT — Layar 16 (Hasil Cetak Stok)

**Tenant uji:** `uat_stock_price_18662`. **Klaim katalog:** `GET
/report-snapshots/:id` (+`/print-log`) — hasil cetak yang bisa diambil ulang, dengan
jejak audit siapa mencetak kapan dalam format apa.

## Skenario

1. Snapshot `stock-list` (dari layar 14/15, setelah Bug C diperbaiki) diambil ulang:
   `GET /report-snapshots/:id` → payload lengkap identik dengan saat dibuat
   (`report-snapshot-retrieve.json`), termasuk `result_payload.rows` (12 baris
   produk), `title`, `totals`, `generatedAt`, `templateVersion`.
2. **Validasi format cetak**: percobaan `POST /report-snapshots/:id/print-log` dengan
   `format:"XLSX"` (nilai tidak valid) → **400 VALIDATION_FAILED**, pesan jelas
   menyebutkan nilai yang sah (`PDF, EXCEL, PRINT, CSV`) —
   `print-log-invalid-format-400.json`.
3. Ulangi dengan `format:"EXCEL"` → sukses, `id, report_code, output_format:"EXCEL",
   printed_at` tercatat (`print-log-excel.json`).
4. Ulangi lagi dengan `format:"PDF"` pada snapshot yang SAMA → sukses juga
   (`screen-15/print-log-pdf.json`) — satu snapshot dapat dicetak berkali-kali dalam
   format berbeda, masing-masing tercatat sebagai baris terpisah di
   `inventory_print_log` (bukan menimpa baris sebelumnya).

## Hasil

**PASS.** "Hasil cetak" (retrieval snapshot + log cetak per format) bekerja persis
sesuai klaim: snapshot dapat diambil ulang dengan isi identik, tiap aksi cetak
tercatat sebagai baris audit terpisah dengan format dan waktu, dan validasi input
format bekerja dengan pesan yang jelas. Mekanisme ini SAMA dengan yang sudah
dibuktikan berhasil untuk laporan finance (`screen-46`, `screen-47` pada pass
sebelumnya) — konsisten lintas domain.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Rendering biner PDF/XLSX sungguhan
(bukan hanya baris log metadata) tidak diverifikasi — di luar cakupan backend API
murni yang diuji pass ini.
