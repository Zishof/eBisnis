# UAT — Layar 14 (Mengekspor Data Harga/Stok ke Excel) — Bug Nyata Ditemukan & Diperbaiki

**Tenant uji:** `uat_stock_price_18662`. **Klaim katalog:** `POST
/reports/stock-list/snapshot`. **Klaim temuan lama** (#4): "kode XLSX nyata ada, tapi
endpoint snapshot yang didokumentasikan tidak pernah dipanggil frontend". Pass ini
memanggil endpoint itu langsung dan menemukan ia **gagal total (500) pada percobaan
pertama** — bug yang lebih dalam dari sekadar "tidak terhubung ke frontend".

## Skenario

1. `POST /reports/stock-list/snapshot` dengan `asOfDate=2026-08-09` →
   **HTTP 500 INTERNAL_ERROR**: *"pesan terikat menyediakan 1 parameter, tapi
   'prepared statement' «  » butuh 0"* (Postgres: *"bind message supplies 1
   parameters, but prepared statement requires 0"*) — lihat
   `BUG-C-pre-fix-500-error.json`. Endpoint gagal SEBELUM sempat menyusun laporan
   apa pun.

## Temuan DIPERBAIKI (Bug C): buildReport() mengirim parameter ke query yang tidak memintanya

Akar masalah: method privat `buildReport()` (dipakai bersama oleh SEMUA laporan lewat
`POST /reports/:code/preview` dan `/snapshot`, termasuk layar 10, 13, 14, 15) SELALU
mengikat `[asOfDate]` ke query, tanpa memeriksa apakah SQL laporan itu benar-benar
memakai `$1`. Dari ~17 kode laporan di `reportSql()`, TIGA di antaranya —
`stock-list` (laporan inti layar 14/15 ini), `supplier-list`, `customer-list` — sama
sekali tidak punya placeholder `$1` di SQL-nya. Postgres menolak keras percobaan
mengikat parameter ke prepared statement yang tidak memintanya.

**Perbaikan:** `buildReport()` sekarang hanya menyertakan `[asOfDate]` bila
`report.sql.includes('$1')` bernilai benar; selain itu kirim array kosong. Lihat
`docs/pos-inventory-parity/evidence/bugs-found/fix-code-changes.txt` untuk
before/after kode lengkap.

**Verifikasi ulang setelah perbaikan** (API hot-reload, ~8 detik):
```
POST /reports/stock-list/snapshot → HTTP 201, row_count: 12
```
(`snapshot-after-fix.json`). Regresi diperiksa: `supplier-list` dan `customer-list`
(bug yang sama, di luar cakupan layar ini tapi diperbaiki oleh fix yang sama) juga
diuji ulang → keduanya sukses. Laporan yang SEBELUMNYA sudah bekerja dan memang
memakai `$1` (`stock-opname`, dipakai layar 10) diuji ulang untuk memastikan tidak
ada regresi → tetap sukses.

## Temuan tambahan (dikonfirmasi via data ekspor nyata): stock_value selalu 0 untuk stok live

Isi snapshot setelah perbaikan (`snapshot-retrieve-showing-avgcost-bug.json`)
menunjukkan baris AYAM: `on_hand:"45.000000"` (stok riil, benar) tapi
`stock_value:"0.0000000000"` (SALAH — nilai ekonomi riilnya lebih dari Rp1.500.000
pada titik ini). Ini konfirmasi langsung, dalam data ekspor sungguhan, dari gap
`stock_balance.average_cost` yang didokumentasikan penuh di `screen-08/uat.md` — kolom
itu tidak pernah ditulis oleh jalur transaksi live mana pun, jadi `stock_value =
sum(on_hand_qty * average_cost)` pada laporan/ekspor ini SELALU nol untuk tenant yang
hanya memakai transaksi live. **Tidak diperbaiki** pada pass ini (butuh logika
moving-average-cost lintas modul, terlalu luas/berisiko untuk pass kecil-terukur ini)
— didokumentasikan sebagai gap nyata dan terverifikasi live.

## Hasil

**Bug nyata ditemukan DAN DIPERBAIKI**: endpoint ekspor stok/harga layar ini gagal
total sebelum perbaikan, bukan cuma "belum terhubung ke frontend" seperti temuan
sebelumnya menduga — ia bahkan gagal saat dipanggil langsung via API. Setelah
diperbaiki: mekanisme snapshot bekerja dan menghasilkan data ekspor nyata, TAPI kolom
`stock_value` (nilai stok dalam Rupiah, bagian inti dari "ekspor data HARGA/stok")
tidak bisa dipercaya karena gap `average_cost` yang terpisah. `pnpm --filter
@ebisnis/api lint` dan test suite penuh (157/4015) tetap hijau setelah perbaikan.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Format XLSX/EXCEL sungguhan (file
biner) tidak diverifikasi byte-per-byte — hanya payload JSON di balik
`print-log` (format `EXCEL`) yang diverifikasi tercatat (lihat `screen-16/uat.md`).
Verifikasi frontend memanggil endpoint ini tidak diulang (lihat catatan di
`screen-13/uat.md`, berlaku sama di sini).
