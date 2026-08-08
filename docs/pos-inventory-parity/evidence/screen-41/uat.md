# UAT — Layar 41 (Laporan Piutang)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** 2 piutang terbuka — order 1 (Andi Pratama,
800000, belum tersentuh pelunasan pada titik snapshot ini) dan order 3 (CV Warung Berkah,
1000000).

## Skenario

`POST /reports/ar-outstanding/preview` `{"asOfDate":"2026-08-09"}` → `preview.json`:
`rowCount:2`, `totals.amount:"1800000"`, baris Andi Pratama 800000 & CV Warung Berkah 1000000,
identik dengan layar 37 (lihat catatan di bawah).

`POST /reports/ar-outstanding/snapshot` (payload sama) → `snapshot.json`, snapshot beku
`cbcbe4b8-05e1-4421-95c2-9076bcb94237`, `row_count:2`, `source_revision:"V047"`.

## Observasi: `ar-outstanding` dan `ar-aging-customer` adalah SQL yang sama persis

`reportSql()` mendefinisikan `ar-outstanding` sebagai `agingReport(S, 'legacy_receivable_ledger',
'customer', 'customer_id')` — PERSIS panggilan yang sama dengan `ar-aging-customer` (layar 37,
lihat `../screen-37/uat.md`). Hanya `title`/`reportCode` yang berbeda. Dikonfirmasi lewat
percobaan nyata: kedua endpoint menghasilkan baris & total yang identik byte-per-byte pada tenant
ini. Ini bukan bug — kedua layar legacy (37 "Analisis Piutang per Customer" dan 41 "Laporan
Piutang") memang secara historis menampilkan data piutang terbuka yang sama, hanya konteks
penyajian ("analisis" vs "laporan resmi") yang berbeda — tapi dicatat di sini agar tidak dikira
laporan 41 salah alamat/salah query bila diperiksa ulang nanti.

## Hasil

**PASS.** Laporan piutang menghasilkan data yang benar dan cocok dengan aging per customer (layar
37) yang sudah direkonsiliasi SQL independen di sana.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Lihat `../screen-42/uat.md` untuk pembuktian cetak
+ immutability snapshot memakai snapshot yang sama (`cbcbe4b8-...`).
