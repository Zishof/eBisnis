# UAT — Layar 31 (Membuka Piutang dari Menu Penjualan)

**Tenant uji:** `uat_sales_ar_18620` (tenant baru, didaftarkan khusus untuk pass ini agar tidak
bentrok dengan tenant UAT lain yang berjalan paralel). **Alur data:** PO AYAM 300kg @32000 dari
SUP-C → submit → approve → send → goods receipt → inspect (accepted 300) → validate
(`STOCK_POSTED`), lalu 3 sales order dibuat lewat `POST /inventory/mobile-orders` (masing-masing
otomatis `CONFIRMED`) dan diinvoice lewat `POST /sales/orders/:id/invoice`:

| Order | Customer | Qty | Nilai | Ledger piutang |
|---|---|---|---|---|
| MOB-...order1 | CUST-007 Andi Pratama | 20 kg | 800000 | `718e16e0-...` |
| MOB-...order2 | CUST-002 Budi Santoso | 15 kg | 600000 | `360aa624-...` |
| MOB-...order3 | CUST-005 CV Warung Berkah | 25 kg | 1000000 | `22574103-...` |

## Skenario

`GET /inventory/legacy/receivables?pageSize=50` (tanpa `includeSettled`, mewakili tombol "Piutang"
dari menu Penjualan legacy — daftar piutang yang masih terbuka) dipanggil segera setelah ketiga
invoice terbentuk, sebelum ada pelunasan apa pun. Lihat `receivables-open.json`.

Hasil: **3 baris**, persis 3 ledger di atas, masing-masing `is_settled:false`,
`status:"OPEN"`, `aging_bucket:"BELUM JATUH TEMPO"`, `amount` (outstanding senetto) sama dengan
nilai faktur asli karena belum ada pelunasan sama sekali. `customer_name`/`sales_name` terisi
benar lewat join ke `customer`/`user_subject`.

## Hasil

**PASS.** Endpoint yang sama dipakai UI legacy screen 31 (tombol "Piutang" dari menu Penjualan)
mengembalikan seluruh piutang terbuka milik tenant dengan benar, termasuk kolom turunan
(`amount` ternetto, `aging_bucket`) yang dipakai layar 32/33/37/38/41/42 berikutnya.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Lihat `screen-32/uat.md` dan `screen-33/uat.md`
untuk skenario lanjutan (filter default vs `includeSettled=true`) memakai ledger yang sama.
