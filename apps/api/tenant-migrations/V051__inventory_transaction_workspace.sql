-- Transaction workspace parity for Sales Order and Purchase Order.
-- Existing monetary columns remain the source of truth; these two fields
-- preserve the commercial context entered by field sales.

ALTER TABLE "{{TENANT_SCHEMA}}".sales_order
  ADD COLUMN IF NOT EXISTS payment_term_label VARCHAR(80),
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE "{{TENANT_SCHEMA}}".purchase_order_line
  ADD COLUMN IF NOT EXISTS planned_batch_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS planned_expiry_date DATE;
