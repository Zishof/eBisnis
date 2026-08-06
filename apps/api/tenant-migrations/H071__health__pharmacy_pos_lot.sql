-- Batch yang dipilih kasir harus mengikuti baris sampai stok benar-benar keluar.
ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale_line
  ADD COLUMN IF NOT EXISTS lot_id UUID
  REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_pos_sale_line_lot
  ON "{{TENANT_SCHEMA}}".pos_sale_line (lot_id)
  WHERE lot_id IS NOT NULL;
