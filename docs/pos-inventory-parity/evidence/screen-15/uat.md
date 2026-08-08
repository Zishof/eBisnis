# UAT — Layar 15 (Mencetak Daftar Stok)

**Tenant uji:** `uat_stock_price_18662`. **Klaim katalog:** sama dengan layar 14 —
`POST /reports/stock-list/snapshot` (katalog memetakan layar 14 "ekspor Excel" dan
layar 15 "cetak daftar stok" ke endpoint snapshot yang SAMA; keduanya format output
berbeda dari satu mekanisme). Lihat `screen-14/uat.md` untuk detail bug (Bug C) yang
ditemukan dan diperbaiki pada endpoint dasarnya.

## Skenario

1. Setelah Bug C (lihat layar 14) diperbaiki, snapshot `stock-list` berhasil dibuat
   (`id` sama dipakai lagi di sini untuk membuktikan satu snapshot bisa dicetak
   dalam format berbeda).
2. `POST /report-snapshots/:id/print-log` dengan `format:"PDF",
   documentNumber:"STK-PRINT-2026-0001"` (mensimulasikan aksi "cetak" alih-alih
   "ekspor Excel") → sukses, `output_format:"PDF"`, `printed_at` tercatat
   (`print-log-pdf.json`).
3. Format yang divalidasi DTO (`PrintLogDto`): `PDF, EXCEL, PRINT, CSV` — percobaan
   awal dengan `"XLSX"` (bukan `"EXCEL"`) ditolak `400 VALIDATION_FAILED` dengan
   pesan jelas menyebutkan nilai yang sah — validasi input bekerja sebagaimana
   mestinya (lihat `screen-16/uat.md` untuk bukti percobaan itu).

## Hasil

**PASS** setelah Bug C (layar 14) diperbaiki: snapshot yang sama dapat dicetak dalam
format PDF (untuk "cetak") dan EXCEL (untuk "ekspor") dari satu mekanisme snapshot
yang sama, masing-masing tercatat di `inventory_print_log` sebagai baris audit
terpisah. Sebelum perbaikan Bug C, layar ini sama sekali tidak bisa diuji karena
endpoint dasarnya gagal 500.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Gap `stock_value=0` yang sama seperti
layar 14 berlaku di sini juga (kolom nilai stok pada hasil cetak tidak bisa
dipercaya) — lihat detail di `screen-08/uat.md` dan `screen-14/uat.md`, tidak
diulang di sini.
