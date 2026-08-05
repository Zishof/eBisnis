# Repository Map

| Area | Source utama | Fungsi |
| --- | --- | --- |
| Migrasi tenant | `apps/api/tenant-migrations/V045..V049` | Vault legacy, tabel command, snapshot laporan, sync, media produk |
| Kontrak 48 layar | `apps/api/src/modules/tenant/sales-inventory-parity.catalog.ts` | Status per permukaan dan rute bukti |
| API operasional | `apps/api/src/modules/tenant/sales-inventory-operations.controller.ts` | Opname, buku harga, AP/AR, nota, jurnal, periode, laporan, sync |
| API data legacy | `apps/api/src/modules/tenant/tenant.module.ts` | Dasbor, master, saldo, harga, opname, rekonsiliasi |
| Web workspace | `apps/web/src/pages/app/InventoryControlPage.tsx` | Permukaan operasional Inventory Control |
| Web route | `apps/web/src/app/App.tsx` | Route aplikasi tenant |
| Flutter | `apps/pos-flutter/lib/inventory/` | Windows/Android, cache Drift, order, AP/AR, nota, sync |
| Export Web | `apps/web/src/lib/export-table.ts` | PDF/Excel tabel |
| Manual publik | `apps/web/src/pages/inventory/InventoryManualPage.tsx` | Panduan transisi publik |
| Evidence lama | `docs/inventory-sales/` dan `docs/user-manual/` | Audit baseline dan manual |

## Prinsip Reuse

Implementasi memperluas tabel ERP yang sudah ada. Tidak dibuat buku stok,
subledger hutang/piutang, jurnal, produk, customer, atau supplier kedua. Envelope
command khusus inventory menyimpan lifecycle dan audit sementara saldo tetap
direkonsiliasi terhadap ledger kanonik.
