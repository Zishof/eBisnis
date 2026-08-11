-- =========================================================================
-- V068 — HUBUNGKAN FAKTUR SUPPLIER KE PENERIMAAN DAN HUTANG
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".supplier_invoice
  ADD COLUMN IF NOT EXISTS goods_receipt_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".goods_receipt(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID
    REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_supplier_invoice_goods_receipt
  ON "{{TENANT_SCHEMA}}".supplier_invoice(goods_receipt_id)
  WHERE goods_receipt_id IS NOT NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".legacy_payable_ledger
  ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".supplier_invoice(id);

CREATE INDEX IF NOT EXISTS ix_legacy_payable_supplier_invoice
  ON "{{TENANT_SCHEMA}}".legacy_payable_ledger(supplier_invoice_id)
  WHERE supplier_invoice_id IS NOT NULL;
