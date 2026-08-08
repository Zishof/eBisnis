# UAT — Layar 33 (Menampilkan Piutang yang Sudah Lunas)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** sama seperti layar 32 — ledger order 2
(`360aa624-...`, CUST-002 Budi Santoso, 600000) sudah dilunasi penuh lewat `/ar/receipts` + `/post`.

## Skenario

`GET /inventory/legacy/receivables?includeSettled=true&pageSize=50` dipanggil (mewakili tombol
"Lihat yang Sudah Lunas" pada layar legacy). Lihat `receivables-include-settled.json`.

Hasil: **3 baris** (bukan 2) — sekarang ledger order 2 IKUT MUNCUL, dengan:
- `is_settled: true`
- `status: "OPEN"` (kolom status dokumen legacy, terpisah dari `is_settled` — tetap `OPEN` karena
  bukan `CANCELLED`/`RETURNED`, ini bukan bug, dua kolom berbeda makna)
- `aging_bucket: "LUNAS"`
- `amount: "0.0000"` (outstanding ternetto = 0, karena `original_amount` 600000 dikurangi alokasi
  terposting 600000)
- `original_amount: "600000.0000"` tetap terlihat untuk audit — nilai faktur asli TIDAK
  dihapus/ditimpa, konsisten dengan pola "reversal tidak menghapus dokumen" yang sudah dibuktikan
  di layar 24/34.

Order 1 dan 3 tetap muncul dengan `is_settled:false` seperti pada layar 31/32.

## Hasil

**PASS.** `includeSettled=true` benar-benar mengubah predikat SQL (`$2::boolean OR NOT
lr.is_settled`) sehingga baris lunas muncul kembali dengan penanda yang jelas (`is_settled`,
`aging_bucket:"LUNAS"`, `amount:0`) tanpa kehilangan jejak nilai aslinya.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil.
