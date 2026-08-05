-- =========================================================================
-- V047 - Operasional Sales / Inventory lintas Web dan Flutter
-- Menutup gap workflow legacy tanpa membuat subledger kedua. Tabel pembayaran
-- di bawah adalah command/audit envelope; saldo tetap direkonsiliasi terhadap
-- legacy_*_ledger sampai cut-over ke accounting_event selesai.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover
  DROP CONSTRAINT IF EXISTS ck_sales_note_handover_status;
ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover
  ADD COLUMN IF NOT EXISTS handed_over_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handed_over_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  ADD CONSTRAINT ck_sales_note_handover_status
    CHECK (status IN ('DRAFT', 'HANDED_OVER', 'RETURNED', 'ACKNOWLEDGED', 'CLOSED', 'CANCELLED'));

ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover_line
  ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'CARRIED',
  ADD COLUMN IF NOT EXISTS returned_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collected_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  ADD CONSTRAINT ck_sales_note_handover_line_status
    CHECK (status IN ('CARRIED', 'RETURNED', 'COLLECTED', 'LOST'));

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_ap_payment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number    VARCHAR(64) NOT NULL,
  supplier_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".supplier (id),
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  method            VARCHAR(24) NOT NULL,
  bank_name         VARCHAR(160),
  reference_number  VARCHAR(96),
  giro_due_date     DATE,
  total_amount      NUMERIC(19,4) NOT NULL,
  status            VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  idempotency_key   VARCHAR(160) NOT NULL,
  note              TEXT,
  posted_at         TIMESTAMPTZ,
  posted_by         UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  reversed_at       TIMESTAMPTZ,
  reversed_by       UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_inventory_ap_payment_method CHECK (method IN ('CASH', 'TRANSFER', 'GIRO', 'RETURN', 'OTHER')),
  CONSTRAINT ck_inventory_ap_payment_status CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
  CONSTRAINT ck_inventory_ap_payment_amount CHECK (total_amount > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_ap_payment_number ON "{{TENANT_SCHEMA}}".inventory_ap_payment (payment_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_ap_payment_idempotency ON "{{TENANT_SCHEMA}}".inventory_ap_payment (idempotency_key);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_ap_payment_allocation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id            UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".inventory_ap_payment (id) ON DELETE CASCADE,
  payable_ledger_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".legacy_payable_ledger (id),
  allocated_amount      NUMERIC(19,4) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_inventory_ap_allocation_amount CHECK (allocated_amount > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_ap_payment_allocation
  ON "{{TENANT_SCHEMA}}".inventory_ap_payment_allocation (payment_id, payable_ledger_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_ar_receipt (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number    VARCHAR(64) NOT NULL,
  customer_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".customer (id),
  receipt_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  method            VARCHAR(24) NOT NULL,
  bank_name         VARCHAR(160),
  reference_number  VARCHAR(96),
  giro_due_date     DATE,
  total_amount      NUMERIC(19,4) NOT NULL,
  status            VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  idempotency_key   VARCHAR(160) NOT NULL,
  note              TEXT,
  posted_at         TIMESTAMPTZ,
  posted_by         UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  reversed_at       TIMESTAMPTZ,
  reversed_by       UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_inventory_ar_receipt_method CHECK (method IN ('CASH', 'TRANSFER', 'GIRO', 'RETURN', 'OTHER')),
  CONSTRAINT ck_inventory_ar_receipt_status CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
  CONSTRAINT ck_inventory_ar_receipt_amount CHECK (total_amount > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_ar_receipt_number ON "{{TENANT_SCHEMA}}".inventory_ar_receipt (receipt_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_ar_receipt_idempotency ON "{{TENANT_SCHEMA}}".inventory_ar_receipt (idempotency_key);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_ar_receipt_allocation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id            UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".inventory_ar_receipt (id) ON DELETE CASCADE,
  receivable_ledger_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".legacy_receivable_ledger (id),
  allocated_amount      NUMERIC(19,4) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_inventory_ar_allocation_amount CHECK (allocated_amount > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_ar_receipt_allocation
  ON "{{TENANT_SCHEMA}}".inventory_ar_receipt_allocation (receipt_id, receivable_ledger_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_stock_opname_session (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_number     VARCHAR(64) NOT NULL,
  warehouse_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id),
  opname_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status            VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  note              TEXT,
  frozen_at         TIMESTAMPTZ,
  frozen_by         UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  approved_at       TIMESTAMPTZ,
  approved_by       UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  posted_at         TIMESTAMPTZ,
  posted_by         UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_inventory_stock_opname_status CHECK (status IN ('DRAFT', 'FROZEN', 'COUNTED', 'APPROVED', 'POSTED', 'CANCELLED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_stock_opname_number
  ON "{{TENANT_SCHEMA}}".inventory_stock_opname_session (opname_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_stock_opname_line (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".inventory_stock_opname_session (id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id),
  uom_id            UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id),
  lot_id            UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id),
  bin_id            UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_bin (id),
  system_qty        NUMERIC(19,6) NOT NULL DEFAULT 0,
  physical_qty      NUMERIC(19,6),
  variance_qty      NUMERIC(19,6) GENERATED ALWAYS AS (COALESCE(physical_qty, system_qty) - system_qty) STORED,
  unit_cost         NUMERIC(19,4) NOT NULL DEFAULT 0,
  counted_at        TIMESTAMPTZ,
  counted_by        UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_stock_opname_line
  ON "{{TENANT_SCHEMA}}".inventory_stock_opname_line
    (opname_id, product_id,
     COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
     COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_sync_device_state (
  device_id         VARCHAR(160) PRIMARY KEY,
  platform          VARCHAR(24) NOT NULL,
  app_version       VARCHAR(48),
  last_pull_cursor  BIGINT NOT NULL DEFAULT 0,
  pending_outbox    INTEGER NOT NULL DEFAULT 0,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at      TIMESTAMPTZ,
  user_subject_id   UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_inventory_sync_platform CHECK (platform IN ('ANDROID', 'WINDOWS', 'WEB')),
  CONSTRAINT ck_inventory_sync_pending CHECK (pending_outbox >= 0)
);
