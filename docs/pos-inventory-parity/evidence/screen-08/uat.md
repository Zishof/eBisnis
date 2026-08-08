# UAT — Layar 8 (Data Stok Barang)

**Tenant uji:** `uat_stock_price_18662`. **Klaim katalog:** `GET /inventory/balances`
(sudah diperbaiki sesi sebelumnya dari path salah `/stock/balances` yang tidak ada —
diverifikasi ulang di sini masih benar: `sales-inventory-parity.catalog.ts:63` dan
`sales-inventory-parity.catalog.spec.ts:34-35` memang mengacu `/inventory/balances`).

## Skenario

1. Tenant baru, stok kosong: `GET /inventory/balances?warehouseId=<GDG-OUTLET-UTAMA>` →
   `{"data":[]}`. SQL `stock_balance` untuk gudang itu: **0 baris**. Cocok.
2. PO nyata (`PO-000001`, AYAM 50kg @12000) → submit → approve → send → goods receipt
   (`GR-000001`) → inspect (accepted 50) → validate (`STOCK_POSTED`). Stok bertambah di
   sini, bukan sebelumnya (sesuai deskripsi endpoint validate).
3. Setelah validate: `GET /inventory/balances?warehouseId=...&productId=AYAM` →
   `on_hand_qty: "50.000000"`, `available_qty: "50.000000"`. Query SQL langsung ke
   `stock_balance` untuk baris yang sama: `on_hand_qty=50.000000, available_qty=50.000000`.
   **Identik, byte-for-byte** (lihat `balances-api.json` vs `balance-sql.txt`).
4. `stock_movement` untuk goods receipt ini: 1 baris `GOODS_RECEIPT`, qty 50, tujuan =
   gudang, sesuai — balance = movement pada titik ini.

## Hasil

**PASS.** `/inventory/balances` mengembalikan angka live yang identik dengan
`stock_balance` langsung, dan sesuai definisi "balance = Σ movement" untuk goods
receipt (satu-satunya jenis mutasi pada titik pengujian ini). Pengujian invarian
"balance = Σ movement" secara penuh — termasuk arah source/destination pada mutasi
ADJUSTMENT — didalami lebih lanjut di layar 9 (`screen-09/uat.md`), di mana
**ditemukan dan diperbaiki bug nyata** yang sempat merusak invarian ini untuk mutasi
opname (lihat bagian "Temuan DIPERBAIKI" di sana).

## Temuan tambahan (didokumentasikan, TIDAK diperbaiki — di luar cakupan aman)

`stock_balance.average_cost` **tidak pernah ditulis oleh jalur transaksi live mana
pun**. Dibuktikan langsung: setelah GR-000001 memvalidasi 50kg AYAM @ Rp12.000 (nilai
ekonomi riil Rp600.000), `stock_balance.average_cost` untuk baris itu tetap
`0.0000`. Ditelusuri ke kode: `applyBalanceDelta()`
(`apps/api/src/infrastructure/provisioning/tenant-bootstrap.service.ts:1176-1220`,
dipakai goods receipt, POS, transfer, eMedik) hanya meng-update
`on_hand/available/reserved/in_transit/quarantine/damaged_qty` — kolom `average_cost`
sama sekali tidak ada di daftar kolom yang di-`INSERT`/`UPDATE`. Pencarian
`grep -rn "average_cost" apps/api/src` menunjukkan kolom ini HANYA ditulis oleh
`cli/onboard-cmn-inventory.cli.ts` (impor CLI sekali-jalan) dan
`pos-sample.service.ts` (seed data demo) — pola "mekanisme benar, sumber data
legacy-only" yang sama yang ditemukan berulang di audit sebelumnya (AP/AR, laporan
opname). Dampak: `stock_value` pada laporan/ekspor stok (layar 14/15,
`sum(on_hand_qty * average_cost)`) dan KPI `inventory_value` dashboard SELALU salah
(cenderung 0) untuk tenant mana pun yang hanya memakai transaksi live tanpa impor CLI.
Tidak diperbaiki pada pass ini: perbaikan yang benar butuh logika moving-average-cost
lintas banyak modul (goods receipt, POS sale/return, transfer, posting opname) —
terlalu luas dan berisiko untuk pass kecil-terukur ini. Lihat detail lanjut di
`screen-14/uat.md`.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Pengujian `lot_id`/`bin_id` granular
(balance per lot/bin, bukan hanya per produk/gudang) tidak dieksplisitasi karena data
uji tidak memakai lot/bin tracking.
