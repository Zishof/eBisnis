# UAT — Layar 37 (Analisis Piutang per Customer)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** 2 piutang terbuka tersisa — order 1
(`718e16e0-...`, Andi Pratama, 800000) dan order 3 (`22574103-...`, CV Warung Berkah, 1000000);
order 2 sudah lunas (lihat layar 32/33) sehingga TIDAK boleh masuk hitungan aging.

## Skenario

`POST /reports/ar-aging-customer/preview` `{"asOfDate":"2026-08-09"}` → lihat `preview.json`.

Hasil: `rowCount:2`, `totals.amount:"1800000"`, baris:
- Andi Pratama — MOB-...order1 — 800000 — `overdue_days:0`
- CV Warung Berkah — MOB-...order3 — 1000000 — `overdue_days:0`

(`overdue_days:0` karena `due_date` = tanggal transaksi = `asOfDate`, tidak ada `payment_term_id`
pada kedua customer sample ini sehingga `due_days` default 0 — lihat catatan implementasi di
`invoiceSalesOrder`.)

## Rekonsiliasi SQL

`reconciliation.txt`: `SUM(amount) WHERE NOT is_settled AND amount>0 GROUP BY customer` = Andi
Pratama 800000, CV Warung Berkah 1000000 — **cocok persis** dengan hasil laporan API, dan piutang
order 2 yang sudah lunas **benar-benar tidak ikut terhitung** (dikeluarkan oleh `NOT is_settled`).

## Hasil

**PASS.** Aging piutang per customer cocok dengan perhitungan manual SQL independen persis
sesuai definisi template (`05-template-bukti-proven-purchase-ap-sales-ar.md` §3.5): total per
pihak = `sum(outstanding)` dari ledger `NOT is_settled AND amount>0`.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Karena semua piutang uji dibuat pada tanggal yang
sama dan tanpa termin, bucket aging >0 hari (1-30/31-60/61-90/>90) tidak sempat teruji secara
langsung di pass ini — logikanya (`GREATEST($1::date - due_date, 0)`) identik dengan yang sudah
dipakai & diverifikasi pada `ap-aging` (layar 27, domain Purchase/AP, formula sama).

**Catatan tambahan (bukan gap):** `ar-aging-customer` (layar 37) dan `ar-outstanding` (layar 41)
memanggil SQL `agingReport(...)` yang PERSIS SAMA (grouping customer, kolom sama) — hanya
`reportCode`/judul yang berbeda. Lihat `../screen-41/uat.md` untuk detail; ini konsisten dengan
kedua layar legacy tersebut memang menampilkan data yang sama dari sudut pandang berbeda
(analisis vs laporan), bukan duplikasi keliru.
