-- =========================================================================
-- V056 — INDEKS UNTUK PENEGAKAN FREEZE STOCK OPNAME
-- =========================================================================
--
-- Status FROZEN/COUNTED pada `inventory_stock_opname_session` sebelumnya
-- hanya label: tidak ada kode yang memeriksanya sebelum mengizinkan
-- `stock_movement` baru pada gudang yang sama. Kode aplikasi sekarang
-- memeriksa keberadaan sesi FROZEN/COUNTED per gudang sebelum SETIAP
-- penyisipan `stock_movement` (POS, penerimaan barang, transfer, faktur
-- pesanan penjualan, penyerahan obat eMedik) — lihat
-- `assertWarehouseNotFrozen` pada `tenant-bootstrap.service.ts`.
--
-- Pemeriksaan itu berjalan pada jalur penjualan kasir, yang paling sering
-- dieksekusi di seluruh sistem. Tanpa indeks, tiap baris penjualan memicu
-- sequential scan pada `inventory_stock_opname_session`. Indeks parsial ini
-- hanya mencakup baris FROZEN/COUNTED — mayoritas sesi opname yang sudah
-- selesai (APPROVED/POSTED) atau belum dibekukan (DRAFT) tidak pernah
-- relevan bagi pemeriksaan ini.
-- =========================================================================

CREATE INDEX IF NOT EXISTS ix_inventory_stock_opname_session_frozen
  ON "{{TENANT_SCHEMA}}".inventory_stock_opname_session (warehouse_id)
  WHERE status IN ('FROZEN', 'COUNTED');
