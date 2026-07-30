-- =========================================================================
-- V006 — POS/PENJUALAN, KEUANGAN DASAR, SDM DASAR, LOGISTIK DASAR
-- =========================================================================

-- ---------------------------------------------------------------------------
-- POS & SALES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_terminal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".outlet (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  platform_device_id UUID,
  printer_config  JSONB,
  status          VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_terminal_code ON "{{TENANT_SCHEMA}}".pos_terminal (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_pos_terminal_outlet ON "{{TENANT_SCHEMA}}".pos_terminal (outlet_id, is_active);
CREATE INDEX IF NOT EXISTS ix_pos_terminal_sample ON "{{TENANT_SCHEMA}}".pos_terminal (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_shift (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_terminal (id) ON DELETE RESTRICT,
  cashier_id      UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE RESTRICT,
  shift_number    VARCHAR(48) NOT NULL,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_cash    NUMERIC(19,4) NOT NULL DEFAULT 0,
  closed_at       TIMESTAMPTZ,
  closing_cash    NUMERIC(19,4),
  expected_cash   NUMERIC(19,4),
  variance        NUMERIC(19,4),
  status          VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_shift_number ON "{{TENANT_SCHEMA}}".pos_shift (shift_number);
CREATE INDEX IF NOT EXISTS ix_pos_shift_terminal ON "{{TENANT_SCHEMA}}".pos_shift (terminal_id, status);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cash_drawer_movement (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_shift (id) ON DELETE RESTRICT,
  movement_type VARCHAR(24) NOT NULL,
  amount        NUMERIC(19,4) NOT NULL,
  reason        TEXT,
  source_type   VARCHAR(48),
  source_id     UUID,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID
);
CREATE INDEX IF NOT EXISTS ix_cash_drawer_shift ON "{{TENANT_SCHEMA}}".cash_drawer_movement (shift_id, occurred_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_sale (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        UUID REFERENCES "{{TENANT_SCHEMA}}".pos_shift (id) ON DELETE RESTRICT,
  outlet_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".outlet (id) ON DELETE RESTRICT,
  terminal_id     UUID REFERENCES "{{TENANT_SCHEMA}}".pos_terminal (id) ON DELETE RESTRICT,
  customer_id     UUID REFERENCES "{{TENANT_SCHEMA}}".customer (id) ON DELETE RESTRICT,
  warehouse_id    UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  receipt_number  VARCHAR(64) NOT NULL,
  business_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  currency_code   VARCHAR(8) NOT NULL DEFAULT 'IDR',
  subtotal        NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(19,4) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(19,4) NOT NULL DEFAULT 0,
  paid_total      NUMERIC(19,4) NOT NULL DEFAULT 0,
  change_total    NUMERIC(19,4) NOT NULL DEFAULT 0,
  status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  offline_id      VARCHAR(96),
  sync_status     VARCHAR(24) NOT NULL DEFAULT 'SYNCED',
  posting_key     VARCHAR(96),
  idempotency_key VARCHAR(96),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_sale_receipt ON "{{TENANT_SCHEMA}}".pos_sale (outlet_id, business_date, receipt_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_sale_idem ON "{{TENANT_SCHEMA}}".pos_sale (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_sale_offline ON "{{TENANT_SCHEMA}}".pos_sale (offline_id) WHERE offline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pos_sale_date ON "{{TENANT_SCHEMA}}".pos_sale (business_date, outlet_id);
CREATE INDEX IF NOT EXISTS ix_pos_sale_status ON "{{TENANT_SCHEMA}}".pos_sale (status, sale_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_sale_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale (id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id          UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  line_no         INTEGER NOT NULL DEFAULT 1,
  quantity        NUMERIC(19,6) NOT NULL,
  unit_price      NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(19,4) NOT NULL DEFAULT 0,
  line_total      NUMERIC(19,4) NOT NULL DEFAULT 0,
  cost_snapshot   NUMERIC(19,4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_sale_line ON "{{TENANT_SCHEMA}}".pos_sale_line (pos_sale_id, line_no);
CREATE INDEX IF NOT EXISTS ix_pos_sale_line_product ON "{{TENANT_SCHEMA}}".pos_sale_line (product_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_payment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale (id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".payment_method (id) ON DELETE RESTRICT,
  amount            NUMERIC(19,4) NOT NULL,
  tendered_amount   NUMERIC(19,4),
  change_amount     NUMERIC(19,4) NOT NULL DEFAULT 0,
  reference         VARCHAR(96),
  status            VARCHAR(24) NOT NULL DEFAULT 'PAID',
  idempotency_key   VARCHAR(96),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_payment_idem ON "{{TENANT_SCHEMA}}".pos_payment (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pos_payment_sale ON "{{TENANT_SCHEMA}}".pos_payment (pos_sale_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".sales_order (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES "{{TENANT_SCHEMA}}".customer (id) ON DELETE RESTRICT,
  outlet_id       UUID REFERENCES "{{TENANT_SCHEMA}}".outlet (id) ON DELETE RESTRICT,
  order_number    VARCHAR(48) NOT NULL,
  order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE,
  channel         VARCHAR(32) NOT NULL DEFAULT 'DIRECT',
  currency_code   VARCHAR(8) NOT NULL DEFAULT 'IDR',
  subtotal        NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(19,4) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(19,4) NOT NULL DEFAULT 0,
  status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_order_number ON "{{TENANT_SCHEMA}}".sales_order (order_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".sales_order_line (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".sales_order (id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  line_no        INTEGER NOT NULL DEFAULT 1,
  ordered_qty    NUMERIC(19,6) NOT NULL,
  delivered_qty  NUMERIC(19,6) NOT NULL DEFAULT 0,
  unit_price     NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(19,4) NOT NULL DEFAULT 0,
  line_total     NUMERIC(19,4) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_order_line ON "{{TENANT_SCHEMA}}".sales_order_line (sales_order_id, line_no);

-- ---------------------------------------------------------------------------
-- KEUANGAN DASAR
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".account_type (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  normal_balance  VARCHAR(8) NOT NULL DEFAULT 'DEBIT',
  category        VARCHAR(32) NOT NULL DEFAULT 'ASSET',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_account_type_code ON "{{TENANT_SCHEMA}}".account_type (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_account_type_sample ON "{{TENANT_SCHEMA}}".account_type (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".chart_of_account (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  parent_id       UUID REFERENCES "{{TENANT_SCHEMA}}".chart_of_account (id) ON DELETE RESTRICT,
  account_type_id UUID REFERENCES "{{TENANT_SCHEMA}}".account_type (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  normal_balance  VARCHAR(8) NOT NULL DEFAULT 'DEBIT',
  allow_posting   BOOLEAN NOT NULL DEFAULT TRUE,
  path            VARCHAR(512) NOT NULL DEFAULT '',
  level           INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_coa_code ON "{{TENANT_SCHEMA}}".chart_of_account (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_coa_parent ON "{{TENANT_SCHEMA}}".chart_of_account (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_coa_active ON "{{TENANT_SCHEMA}}".chart_of_account (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_coa_sample ON "{{TENANT_SCHEMA}}".chart_of_account (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fiscal_period (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  fiscal_year     INTEGER NOT NULL,
  period_no       INTEGER NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  closed_at       TIMESTAMPTZ,
  closed_by       UUID,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at  TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_period_code ON "{{TENANT_SCHEMA}}".fiscal_period (code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".journal_entry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  fiscal_period_id UUID REFERENCES "{{TENANT_SCHEMA}}".fiscal_period (id) ON DELETE RESTRICT,
  journal_number  VARCHAR(48) NOT NULL,
  journal_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type     VARCHAR(48) NOT NULL,
  source_id       UUID,
  posting_key     VARCHAR(96) NOT NULL,
  description     TEXT,
  currency_code   VARCHAR(8) NOT NULL DEFAULT 'IDR',
  exchange_rate   NUMERIC(19,8) NOT NULL DEFAULT 1,
  total_debit     NUMERIC(19,4) NOT NULL DEFAULT 0,
  total_credit    NUMERIC(19,4) NOT NULL DEFAULT 0,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  posted_at       TIMESTAMPTZ,
  posted_by       UUID,
  reversal_of_id  UUID REFERENCES "{{TENANT_SCHEMA}}".journal_entry (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_journal_balanced CHECK (status <> 'POSTED' OR total_debit = total_credit)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_journal_number ON "{{TENANT_SCHEMA}}".journal_entry (journal_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_journal_posting_key ON "{{TENANT_SCHEMA}}".journal_entry (posting_key);
CREATE INDEX IF NOT EXISTS ix_journal_date ON "{{TENANT_SCHEMA}}".journal_entry (journal_date, status);
CREATE INDEX IF NOT EXISTS ix_journal_source ON "{{TENANT_SCHEMA}}".journal_entry (source_type, source_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".journal_entry_line (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".journal_entry (id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".chart_of_account (id) ON DELETE RESTRICT,
  line_no          INTEGER NOT NULL DEFAULT 1,
  debit            NUMERIC(19,4) NOT NULL DEFAULT 0,
  credit           NUMERIC(19,4) NOT NULL DEFAULT 0,
  description      TEXT,
  dimensions       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_journal_line ON "{{TENANT_SCHEMA}}".journal_entry_line (journal_entry_id, line_no);
CREATE INDEX IF NOT EXISTS ix_journal_line_account ON "{{TENANT_SCHEMA}}".journal_entry_line (account_id);

-- ---------------------------------------------------------------------------
-- SDM DASAR
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".leave_type (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               VARCHAR(48) NOT NULL,
  name               VARCHAR(120) NOT NULL,
  description        TEXT,
  name_key           VARCHAR(160) NOT NULL DEFAULT '',
  default_quota_days INTEGER NOT NULL DEFAULT 0,
  is_paid            BOOLEAN NOT NULL DEFAULT TRUE,
  requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  is_system          BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  metadata           JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID,
  deactivated_at     TIMESTAMPTZ,
  deactivated_by     UUID,
  deleted_at         TIMESTAMPTZ,
  deleted_by         UUID,
  delete_reason      TEXT,
  version            INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_leave_type_code ON "{{TENANT_SCHEMA}}".leave_type (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_leave_type_sample ON "{{TENANT_SCHEMA}}".leave_type (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".employee (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        UUID REFERENCES "{{TENANT_SCHEMA}}".party (id) ON DELETE RESTRICT,
  legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  department_id   UUID REFERENCES "{{TENANT_SCHEMA}}".department (id) ON DELETE RESTRICT,
  job_position_id UUID REFERENCES "{{TENANT_SCHEMA}}".job_position (id) ON DELETE RESTRICT,
  user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  employee_number VARCHAR(48) NOT NULL,
  employment_status VARCHAR(32) NOT NULL DEFAULT 'PERMANENT',
  hire_date       DATE,
  termination_date DATE,
  email           VARCHAR(160),
  phone           VARCHAR(50),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_employee_code ON "{{TENANT_SCHEMA}}".employee (code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_employee_number ON "{{TENANT_SCHEMA}}".employee (employee_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_employee_active ON "{{TENANT_SCHEMA}}".employee (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_employee_sample ON "{{TENANT_SCHEMA}}".employee (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- LOGISTIK DASAR
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".vehicle_type (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   VARCHAR(48) NOT NULL,
  name                   VARCHAR(120) NOT NULL,
  description            TEXT,
  name_key               VARCHAR(160) NOT NULL DEFAULT '',
  default_capacity_kg    NUMERIC(19,4) NOT NULL DEFAULT 0,
  default_capacity_m3    NUMERIC(19,4) NOT NULL DEFAULT 0,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  is_system              BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample              BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id        UUID,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  metadata               JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by             UUID,
  deactivated_at         TIMESTAMPTZ,
  deactivated_by         UUID,
  deleted_at             TIMESTAMPTZ,
  deleted_by             UUID,
  delete_reason          TEXT,
  version                INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vehicle_type_code ON "{{TENANT_SCHEMA}}".vehicle_type (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_vehicle_type_sample ON "{{TENANT_SCHEMA}}".vehicle_type (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".carrier (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        UUID REFERENCES "{{TENANT_SCHEMA}}".party (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  service_area    VARCHAR(160),
  tracking_url_template VARCHAR(500),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_carrier_code ON "{{TENANT_SCHEMA}}".carrier (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_carrier_sample ON "{{TENANT_SCHEMA}}".carrier (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- MANUFAKTUR DASAR (BOM)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".bill_of_material (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  output_uom_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  bom_version     INTEGER NOT NULL DEFAULT 1,
  output_qty      NUMERIC(19,6) NOT NULL DEFAULT 1,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bom_code ON "{{TENANT_SCHEMA}}".bill_of_material (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_bom_product ON "{{TENANT_SCHEMA}}".bill_of_material (product_id, status);
CREATE INDEX IF NOT EXISTS ix_bom_sample ON "{{TENANT_SCHEMA}}".bill_of_material (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".bill_of_material_item (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_of_material_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".bill_of_material (id) ON DELETE CASCADE,
  material_product_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  line_no             INTEGER NOT NULL DEFAULT 1,
  required_qty        NUMERIC(19,6) NOT NULL,
  waste_tolerance_pct NUMERIC(9,4) NOT NULL DEFAULT 0,
  is_mandatory        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bom_item ON "{{TENANT_SCHEMA}}".bill_of_material_item (bill_of_material_id, line_no);
CREATE INDEX IF NOT EXISTS ix_bom_item_material ON "{{TENANT_SCHEMA}}".bill_of_material_item (material_product_id);
