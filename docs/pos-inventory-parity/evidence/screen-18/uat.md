# UAT — Layar 18 (Master Harga Beli per Supplier)

**Tenant uji:** `uat_stock_price_18662`. **Klaim katalog:** `POST/GET
/inventory/price-books` dengan `scopeType:"SUPPLIER"`. Dibuktikan SETELAH Bug D
(lihat `screen-17/uat.md`) diperbaiki, karena transisi status apa pun sebelumnya
gagal 500.

## Skenario

1. `POST /inventory/price-books` dengan `scopeType:"SUPPLIER", scopeId:<SUP-C>`,
   1 baris AYAM @ Rp11.500, `minimumQty:20` (harga beli khusus untuk pembelian ≥20kg)
   → sukses, `status:"DRAFT"` (`pb-supplier-scope-create.json`).
2. **Validasi guard**: percobaan `scopeType:"CUSTOMER"` TANPA `scopeId` → **HTTP 400
   VALIDATION_FAILED**: *"Customer atau supplier wajib dipilih untuk harga khusus."*
   (`validation-missing-scope-400.json`) — guard di `createInventoryPriceBook`
   (`sales-inventory-operations.controller.ts:489-491`) bekerja sesuai klaim: harga
   berskala TENANT boleh tanpa scopeId, harga berskala CUSTOMER/SUPPLIER wajib
   menyertakan pihaknya.
3. `minimumQty` per baris (`price_book_item.minimum_qty`) terekam — mendukung
   tiering harga beli bertingkat berdasar kuantitas per supplier, sesuai nama layar.

## Hasil

**PASS.** Master harga beli per-supplier dapat dibuat dengan scope dan tiering
kuantitas yang benar, dan validasi mencegah harga "khusus" tanpa pihak yang jelas.
Bergantung pada perbaikan Bug D (`screen-17/uat.md`) yang sama untuk seluruh siklus
persetujuannya (submit/approve tunduk pada aturan self-approval yang sama, tidak
diulang khusus untuk scope SUPPLIER di sini — dibuktikan sekali di layar 17/19
karena kodenya sama persis, tidak bercabang per scope type).

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Siklus approve penuh untuk buku harga
SUPPLIER-scope ini secara spesifik tidak diulang (sudah dibuktikan untuk CUSTOMER-scope
di layar 17/19 dengan kode transisi yang identik — tidak ada percabangan logika
approval berdasar `scope_type`, jadi pengulangan dinilai berlebihan).
