# UAT — Layar 25 (Melihat Pembayaran Hutang)

**Tenant uji:** `uat_purchase_ap_19222`. **Endpoint:** `GET /ap/payments` (`@Permissions('SALES.READ')`
— endpoint ini TIDAK terkena bug permission layar 22, karena sudah memakai kode domain yang valid).

## Skenario

1. **Buat 2 pembayaran nyata** (dipakai juga oleh layar 22/23/26/27):
   - `AP-20260808-MSKT8MOO`: TRANSFER 600000 ke GR-000001 (lunas penuh), bank BCA, ref `TF-UAT-001`.
   - `AP-20260808-MSKT94MF`: CASH 200000 ke GR-000002 (cicilan sebagian dari 500000).

   Keduanya dibuat `DRAFT` lewat `POST /ap/payments` (dengan `Idempotency-Key`, wajib — sudah
   dibuktikan di `screen-24/uat.md`), lalu diposting lewat `POST /ap/payments/:id/post` →
   `POSTED`. Bukti: `api-appay1-create.json`, `api-appay1-post.json`, `api-appay2-create.json`,
   `api-appay2-post.json`.

2. **Lihat riwayat**: `GET /ap/payments` (tanpa query param — endpoint ini memang tidak punya
   filter/paginasi, langsung top-500 diurutkan `payment_date DESC, created_at DESC`) → **2 baris**,
   keduanya `status="POSTED"`, dengan `supplier_code`/`supplier_name` ter-join benar (`SUP-C`/
   `CV Bahan Segar Nusantara`), `method` (`TRANSFER`/`CASH`), `bank_name`/`reference_number` sesuai
   yang dikirim saat create. Bukti: `api-ap-payments-list.json`.

## Hasil

**PASS**. Kedua pembayaran yang dibuat lewat alur create→post muncul benar di listing, dengan
semua field (metode, jumlah, status, referensi bank) sesuai yang diinput — tidak ada field yang
hilang atau salah join.

## Yang TIDAK dicakup pass ini

Endpoint ini tidak punya paginasi/filter (limit 500 baris tetap, tidak ada `page`/`pageSize` yang
dihormati) — untuk tenant dengan >500 pembayaran, baris terlama tidak akan terlihat lewat endpoint
ini; di luar cakupan uji karena data uji jauh di bawah batas itu. Screenshot Web/Windows/Android
tidak diambil.
