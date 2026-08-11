-- =========================================================================
-- V066 — ATRIBUSI SALES DAN SNAPSHOT HARGA/HPP SALES ORDER
-- Aditif: histori order lama dipertahankan dan dibackfill bila aktornya valid.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".sales_order
  ADD COLUMN IF NOT EXISTS salesperson_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  ADD COLUMN IF NOT EXISTS pricing_snapshot_at TIMESTAMPTZ;

UPDATE "{{TENANT_SCHEMA}}".sales_order so
   SET salesperson_id = so.created_by,
       pricing_snapshot_at = COALESCE(so.pricing_snapshot_at, so.created_at)
 WHERE so.salesperson_id IS NULL
   AND so.created_by IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".user_subject us
      WHERE us.id = so.created_by
   );

CREATE INDEX IF NOT EXISTS ix_sales_order_salesperson_date
  ON "{{TENANT_SCHEMA}}".sales_order(salesperson_id, order_date DESC);

ALTER TABLE "{{TENANT_SCHEMA}}".sales_order_line
  ADD COLUMN IF NOT EXISTS price_book_item_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".price_book_item(id),
  ADD COLUMN IF NOT EXISTS price_source VARCHAR(32) NOT NULL DEFAULT 'LEGACY_OR_DEFAULT',
  ADD COLUMN IF NOT EXISTS price_rule_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_source VARCHAR(32) NOT NULL DEFAULT 'LEGACY_OR_STANDARD',
  ADD COLUMN IF NOT EXISTS cost_snapshot_at TIMESTAMPTZ;

UPDATE "{{TENANT_SCHEMA}}".sales_order_line
   SET cost_snapshot_at = COALESCE(cost_snapshot_at, created_at),
       price_rule_snapshot = CASE
         WHEN price_rule_snapshot = '{}'::jsonb THEN
           jsonb_build_object('migrated', true, 'unitPrice', unit_price)
         ELSE price_rule_snapshot
       END;

ALTER TABLE "{{TENANT_SCHEMA}}".sales_order_line
  ADD CONSTRAINT ck_sales_order_line_price_source CHECK (
    price_source IN ('CUSTOMER_PRICE_BOOK', 'TENANT_PRICE_BOOK', 'LEGACY_HISTORY', 'PRODUCT_DEFAULT', 'LEGACY_OR_DEFAULT')
  ),
  ADD CONSTRAINT ck_sales_order_line_cost_source CHECK (
    cost_source IN ('STOCK_WEIGHTED_AVERAGE', 'PRODUCT_STANDARD', 'LEGACY_OR_STANDARD')
  );

CREATE INDEX IF NOT EXISTS ix_sales_order_line_price_book_item
  ON "{{TENANT_SCHEMA}}".sales_order_line(price_book_item_id)
  WHERE price_book_item_id IS NOT NULL;

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".sales_order.salesperson_id IS
  'Pemilik penjualan eksplisit; tidak lagi disimpulkan dari created_by pada laporan.';
COMMENT ON COLUMN "{{TENANT_SCHEMA}}".sales_order_line.price_rule_snapshot IS
  'Bukti aturan harga server yang dipakai saat order dibuat, termasuk harga perangkat bila dikoreksi.';
COMMENT ON COLUMN "{{TENANT_SCHEMA}}".sales_order_line.legacy_unit_cost IS
  'Snapshot HPP pada waktu order. Nama dipertahankan untuk kompatibilitas laporan existing.';
