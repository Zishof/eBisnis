# UAT — Layar 35 (Melihat Pembayaran Piutang)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** ledger order 2 (CUST-002 Budi Santoso, 600000)
dilunasi lewat `POST /ar/receipts` (alokasi 600000, metode TRANSFER, referensi `TRF-UAT-001`) →
`POST /ar/receipts/:id/post`. Lihat `receipt-full-create.json` (respons `DRAFT`, id
`2fc9b5bb-739e-4252-92ca-e1f4bb8f1f47`, nomor `AR-20260808-MSKSMLQI`) dan `receipt-full-post.json`
(status berubah `POSTED`).

## Skenario

`GET /ar/receipts` (mewakili layar "Melihat Pembayaran Piutang" — riwayat penerimaan piutang)
dipanggil setelah penerimaan diposting. Lihat `receipts-list.json`.

Hasil: **1 baris**, seluruh kolom yang dibutuhkan layar riwayat legacy terisi benar dari join ke
`customer`: `receipt_number:"AR-20260808-MSKSMLQI"`, `receipt_date`, `method:"TRANSFER"`,
`total_amount:"600000.0000"`, `status:"POSTED"`, `reference_number:"TRF-UAT-001"`,
`customer_code:"CUST-002"`, `customer_name:"Budi Santoso"`.

## Hasil

**PASS.** Riwayat pembayaran piutang menampilkan dokumen yang baru diposting dengan seluruh
kolom identitas transaksi (metode, referensi, pihak, nilai, status) yang benar — mekanisme
idempotency/posting-nya sendiri sudah dibuktikan mendalam di layar 34 (`../screen-34/uat.md`).

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Paginasi (`LIMIT 500` pada query) tidak diuji
karena volume data uji jauh di bawah ambang itu.
