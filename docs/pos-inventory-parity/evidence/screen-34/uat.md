# UAT — Layar 34 (Pembayaran Piutang — Idempotency)

**Tenant uji:** `uat_finance_15643`.

## Skenario

1. `POST /ar/receipts` dikirim **dua kali** dengan header `Idempotency-Key` yang SAMA (`uat-ar-receipt-idem-1786216538`), body sama: customer CUST-007, alokasi 100000 ke ledger piutang order 1 (`b4fb1ae9-...`, nilai 180000).
2. Respons pertama: `idempotent:false`, id `c2cf64a0-...`. Respons kedua: `idempotent:true`, id **SAMA PERSIS**.
3. Verifikasi DB: `SELECT ... WHERE idempotency_key = '...'` → **1 baris**, bukan 2 (lihat `reconciliation.sql`/`reconciliation-result.txt`).
4. `POST /ar/receipts/:id/post` untuk benar-benar memposting satu-satunya baris itu.
5. Verifikasi saldo: `total_settled` pada ledger piutang = **100000**, bukan 200000. `is_settled = false` (benar, karena 100000 < 180000 outstanding).

## Hasil

**PASS.** Permintaan duplikat dengan `Idempotency-Key` sama menghasilkan SATU baris `inventory_ar_receipt`, dan saldo piutang berkurang tepat satu kali senilai alokasinya — retry jaringan/klik ganda tidak akan pernah menggandakan pelunasan.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil.
