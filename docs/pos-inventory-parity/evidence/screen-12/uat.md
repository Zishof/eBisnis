# UAT — Layar 12 (Mencari Nama/Kode pada Harga Beli/Jual)

**Tenant uji:** `uat_stock_price_18662`. **Klaim:** `GET
/inventory/legacy/price-history?search=...` mendukung pencarian nama/kode produk
maupun nama mitra (customer/supplier), bukan hanya lookup ID persis.

## Skenario

1. `GET /inventory/legacy/price-history?search=AYAM` (kode produk parsial) → 1 baris
   cocok (`search-ayam.json`) — mengonfirmasi pencarian bekerja pada `product_code`
   ILIKE, bukan hanya exact match ID.
2. `GET /inventory/legacy/price-history?search=XYZ999` (tidak ada yang cocok) →
   `{"data":[]}`, bukan error (`search-no-match.json`) — penanganan hasil kosong
   yang benar.
3. Query SQL yang mendasari (`tenant.module.ts:2429-2433`) mengonfirmasi pencarian
   memakai `ILIKE '%...%'` pada EMPAT kolom sekaligus: `p.code`, `p.name`, `c.name`
   (nama customer), `s.name` (nama supplier) — jadi pencarian "Andi" (nama customer
   CUST-007) atau "CV Bahan Segar" (nama supplier SUP-C) juga akan menemukan baris
   yang relevan, bukan cuma pencarian kode produk.

## Hasil

**PASS.** Pencarian bekerja pada kode/nama produk DAN nama mitra, dengan penanganan
hasil kosong yang bersih (array kosong, bukan error).

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Pencarian berdasar nama mitra
(customer/supplier, bukan produk) tidak diuji langsung dengan query HTTP terpisah —
diverifikasi lewat pembacaan SQL yang menunjukkan keempat kolom disertakan dalam
kondisi `OR ... ILIKE`.
