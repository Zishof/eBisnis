# UAT — Layar 32 (Data Piutang Customer)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** sama seperti layar 31 (lihat `../screen-31/uat.md`).

## Skenario

1. Satu piutang dilunasi PENUH untuk membuktikan endpoint benar-benar per-baris, bukan sekadar
   dump statis: `POST /ar/receipts` alokasi 600000 ke ledger order 2 (`360aa624-...`, CUST-002
   Budi Santoso) → `POST /ar/receipts/:id/post` → `is_settled` berubah jadi `true` (detail lengkap
   idempotency/posting sudah dibuktikan layar 34 sebelumnya; di sini fokusnya efek pada layar Data
   Piutang Customer).
2. `GET /inventory/legacy/receivables?pageSize=50` (default, TANPA `includeSettled`) dipanggil
   ULANG setelah pelunasan. Lihat `receivables-open-after-settle.json`.

Hasil: hanya **2 baris** tersisa — order 1 (`718e16e0-...`, 800000, Andi Pratama) dan order 3
(`22574103-...`, 1000000, CV Warung Berkah). Ledger order 2 yang baru dilunasi **hilang** dari
daftar "Data Piutang Customer" default, persis perilaku legacy CMN (layar ini hanya menampilkan
piutang yang MASIH ada, bukan riwayat).

## Rekonsiliasi SQL

`reconciliation-ledger.txt`: query langsung ke `legacy_receivable_ledger` menunjukkan 3 baris
total (1 `is_settled=t` untuk order 2, 2 `is_settled=f` untuk order 1 & 3), dan
`sum(amount) WHERE NOT is_settled AND amount>0` = **1.800.000** — cocok persis dengan penjumlahan
dua baris yang tersisa di respons API (800000 + 1000000).

## Hasil

**PASS.** Data Piutang Customer secara konsisten menyaring baris yang sudah lunas begitu
`is_settled` berubah, dan totalnya cocok dengan rekonsiliasi SQL independen.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil.
