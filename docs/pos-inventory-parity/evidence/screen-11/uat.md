# UAT — Layar 11 (Harga Beli dan Harga Jual)

**Tenant uji:** `uat_stock_price_18662`. **Klaim:** `GET /inventory/legacy/price-history`
menampilkan riwayat harga beli (SUPPLIER) dan jual (CUSTOMER), dan baris hidup dari
perbaikan Purchase→AP/Sales→AR sesi sebelumnya (jembatan `validateGoodsReceipt` dan
`invoiceSalesOrder` yang menulis `legacy_price_history`) muncul di sini.

## Skenario

1. **Sisi beli (SUPPLIER)**: setelah goods receipt `GR-000001` divalidasi (50kg AYAM
   @ Rp12.000 dari SUP-C, layar 8) → `GET /inventory/legacy/price-history` →
   1 baris: `party_type:"SUPPLIER", price:"12000.0000", source_file:"LIVE:PURCHASING",
   product_code:"AYAM", party_name:"CV Bahan Segar Nusantara"`
   (`price-history-supplier-live.json`). SQL langsung ke `legacy_price_history`
   mengonfirmasi baris yang identik.
2. **Sisi jual (CUSTOMER)**: setelah sales order dibuat (`/inventory/mobile-orders`,
   CUST-007, AYAM 5 @ Rp40.000) dan diinvoice (`/sales/orders/:id/invoice`) →
   baris baru: `party_type:"CUSTOMER", price:"40000.0000", source_file:"LIVE:SALES",
   party_name:"Andi Pratama"` (`price-history-both-supplier-and-customer.json`).
3. Kedua baris muncul BERSAMAAN di respons yang sama (list gabungan, bukan dua
   endpoint terpisah) — sesuai nama layar "Harga Beli DAN Harga Jual".

## Temuan (dikonfirmasi ulang, bukan baru): harga historis TIDAK PERNAH dipakai untuk memberi harga transaksi baru

`09-master-stock-pricing-findings.md` #7 mengklaim `legacy_price_history` murni
tulis-dan-laporkan, tidak pernah dikonsultasikan untuk kuotasi harga. Diverifikasi
ulang dengan `grep -rln "legacy_price_history" apps/api/src` (kode saat ini, bukan
saat temuan lama ditulis): SETIAP kemunculan adalah salah satu dari (a) `INSERT`
(dari `erp-purchasing.service.ts` dan `tenant.module.ts` — jembatan Purchase/Sales
yang sudah terbukti bekerja), (b) `SELECT count(*)` untuk metrik dashboard, atau
(c) `SELECT` untuk endpoint baca (`/inventory/legacy/price-history`) dan laporan
`price-sale`/`price-purchase`. **Tidak ada satu pun** yang membaca tabel ini untuk
menentukan `unitPrice` default pada baris PO/SO baru — dikonfirmasi langsung di kode
`createMobileInventoryOrder` (`tenant.module.ts:2081-2089`): `unitPrice = line.unitPrice
?? Number(product.default_sale_price)`, jatuh ke `product.default_sale_price` (master
produk), BUKAN ke `legacy_price_history`. Purchase order line memakai `unitPrice`
sebagai field wajib dari pemanggil, tanpa fallback ke riwayat harga sama sekali.
**Temuan lama tetap berlaku pada kode saat ini** — dilaporkan sebagai konfirmasi,
bukan asumsi.

## Hasil

**PASS** untuk klaim baca layar 11: kedua sisi (beli & jual) tampil dengan benar dan
baris hidup dari transaksi Purchase/Sales sungguhan terbukti muncul. **GAP terkonfirmasi
(bukan bug baru)**: harga historis di layar ini murni informatif, tidak pernah
memengaruhi harga transaksi baru mana pun.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil.
