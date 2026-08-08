# UAT — Layar 38 (Analisis Piutang per Sales)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** sama seperti layar 37.

## Skenario

`POST /reports/ar-aging-sales/preview` `{"asOfDate":"2026-08-09"}` → lihat `preview.json`.

Hasil: `rowCount:2`, `totals.amount:"1800000"`, kedua baris (order 1 & order 3) muncul dengan
`party_name:"UAT Tester"` — satu-satunya `user_subject` di tenant ini, karena kedua sales order
dibuat lewat `/inventory/mobile-orders` oleh actor yang sama.

## Verifikasi klaim atribusi sales (dari konteks sesi sebelumnya)

Diverifikasi ULANG langsung ke source pada pass ini (bukan diasumsikan dari sesi lalu):
`information_schema.columns` untuk `sales_order` (`sales-order-columns.txt`) mengonfirmasi tabel
ini **TIDAK PUNYA kolom `salesperson_id`** sama sekali (20 kolom: `id, order_number, customer_id,
outlet_id, ..., created_by, ...` — tidak ada `salesperson_id`).

Membaca `invoiceSalesOrder` (`tenant.module.ts` sekitar baris 1700-1716) mengonfirmasi
`legacy_receivable_ledger.salesperson_id` diisi dari `so.created_by` (pembuat pesanan), dengan
komentar eksplisit di source: *"Bukan snapshot penugasan sejati (sales_order tidak punya kolom
itu)... tetapi lebih baik daripada tidak mengalir sama sekali ke layar analisis piutang per sales
(37-38)."* Klaim sesi sebelumnya (`08-purchase-sales-bridge-findings.md #5`) **MASIH BENAR** di
source saat ini — bukan sudah diperbaiki dan bukan regresi baru, hanya keterbatasan yang sudah
diketahui dan didokumentasikan oleh tim sebelumnya.

## Rekonsiliasi SQL

`reconciliation.txt`: `SUM(amount) WHERE NOT is_settled AND amount>0 GROUP BY salesperson (via
user_subject)` = "UAT Tester", 1800000, 2 invoice — **cocok persis** dengan `totals.amount` API.

## Hasil

**PASS** untuk korektnes perhitungan (total & filter lunas cocok rekonsiliasi SQL independen).
Atribusi per-sales bekerja sesuai desain yang didokumentasikan (via `created_by`, bukan penugasan
sales sejati) — ini keterbatasan produk yang sudah diketahui, dilaporkan lagi di sini sebagai
konfirmasi bahwa laporan TIDAK BISA memisahkan piutang per sales-lapangan sungguhan bila satu
akun/device dipakai oleh banyak sales, atau bila order diinput ulang oleh admin/kasir alih-alih
sales aslinya — hanya mencerminkan siapa yang menekan tombol submit di sistem.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Skenario multi-sales (>1 `user_subject` membuat
order berbeda) tidak diuji karena tenant baru ini hanya punya 1 user; perilaku per-baris (bukan
agregasi) sudah cukup untuk membuktikan mekanismenya benar.
