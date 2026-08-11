-- =========================================================================
-- V067 — SNAPSHOT HARGA SUPPLIER DAN DUA TINGKAT DISKON PEMBELIAN
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".purchase_order_line
  ADD COLUMN IF NOT EXISTS discount_percent_1 NUMERIC(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent_2 NUMERIC(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_unit_price NUMERIC(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_book_item_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".price_book_item(id),
  ADD COLUMN IF NOT EXISTS price_source VARCHAR(32) NOT NULL DEFAULT 'CLIENT_OR_LEGACY',
  ADD COLUMN IF NOT EXISTS price_rule_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "{{TENANT_SCHEMA}}".purchase_order_line
   SET net_unit_price = CASE
         WHEN ordered_qty <> 0 THEN (line_total / ordered_qty)
         ELSE unit_price
       END,
       price_rule_snapshot = CASE
         WHEN price_rule_snapshot = '{}'::jsonb THEN
           jsonb_build_object('migrated', true, 'unitPrice', unit_price,
                              'discountAmount', discount_amount)
         ELSE price_rule_snapshot
       END;

ALTER TABLE "{{TENANT_SCHEMA}}".purchase_order_line
  ADD CONSTRAINT ck_purchase_order_line_discount_levels CHECK (
    discount_percent_1 BETWEEN 0 AND 100 AND discount_percent_2 BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT ck_purchase_order_line_price_source CHECK (
    price_source IN ('SUPPLIER_PRICE_BOOK', 'PRODUCT_SUPPLIER_LAST', 'CLIENT_QUOTE', 'CLIENT_OR_LEGACY')
  );

CREATE INDEX IF NOT EXISTS ix_purchase_order_line_price_book_item
  ON "{{TENANT_SCHEMA}}".purchase_order_line(price_book_item_id)
  WHERE price_book_item_id IS NOT NULL;

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".purchase_order_line.net_unit_price IS
  'Harga neto setelah diskon berantai tingkat 1 dan 2; tidak dihitung sebagai penjumlahan persen.';
