-- =========================================================================
-- V045 - Vault impor legacy inventory CMN
-- Menjamin setiap informasi dari DBF lama punya tempat audit yang utuh.
-- Projection operasional boleh bertahap, tetapi raw source tidak boleh hilang.
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".legacy_import_file (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system   VARCHAR(64) NOT NULL DEFAULT 'CMN_INVENTORY_DBF',
  file_name       VARCHAR(160) NOT NULL,
  file_path       TEXT,
  file_hash       VARCHAR(96),
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  total_records   INTEGER NOT NULL DEFAULT 0,
  active_records  INTEGER NOT NULL DEFAULT 0,
  deleted_records INTEGER NOT NULL DEFAULT 0,
  imported_records INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(24) NOT NULL DEFAULT 'IMPORTED',
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legacy_import_file
  ON "{{TENANT_SCHEMA}}".legacy_import_file (source_system, file_name);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".legacy_import_record (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_file_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".legacy_import_file (id) ON DELETE CASCADE,
  file_name       VARCHAR(160) NOT NULL,
  row_number      INTEGER NOT NULL,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  legacy_key      VARCHAR(256),
  row_data        JSONB NOT NULL,
  row_hash        VARCHAR(96) NOT NULL,
  projected_table VARCHAR(96),
  projected_id    UUID,
  projection_status VARCHAR(32) NOT NULL DEFAULT 'RAW_ONLY',
  projection_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legacy_import_record
  ON "{{TENANT_SCHEMA}}".legacy_import_record (file_name, row_number);
CREATE INDEX IF NOT EXISTS ix_legacy_import_record_key
  ON "{{TENANT_SCHEMA}}".legacy_import_record (file_name, legacy_key);
CREATE INDEX IF NOT EXISTS ix_legacy_import_record_status
  ON "{{TENANT_SCHEMA}}".legacy_import_record (projection_status, file_name);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".legacy_salesperson_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_code     VARCHAR(64) NOT NULL,
  legacy_name     VARCHAR(160) NOT NULL,
  user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  mapped_username VARCHAR(96),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legacy_salesperson_map_code
  ON "{{TENANT_SCHEMA}}".legacy_salesperson_map (legacy_code) WHERE is_active;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".legacy_receivable_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file     VARCHAR(160) NOT NULL,
  legacy_row_number INTEGER NOT NULL,
  legacy_invoice_number VARCHAR(96) NOT NULL,
  customer_id     UUID REFERENCES "{{TENANT_SCHEMA}}".customer (id) ON DELETE SET NULL,
  salesperson_id  UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  transaction_date DATE,
  due_date        DATE,
  paid_at         DATE,
  amount          NUMERIC(19,4) NOT NULL DEFAULT 0,
  payment_note    TEXT,
  giro_number     VARCHAR(96),
  bank_name       VARCHAR(160),
  giro_date       DATE,
  return_number   VARCHAR(96),
  status          VARCHAR(24) NOT NULL DEFAULT 'IMPORTED',
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legacy_receivable_ledger
  ON "{{TENANT_SCHEMA}}".legacy_receivable_ledger (source_file, legacy_row_number);
CREATE INDEX IF NOT EXISTS ix_legacy_receivable_customer
  ON "{{TENANT_SCHEMA}}".legacy_receivable_ledger (customer_id, due_date);
CREATE INDEX IF NOT EXISTS ix_legacy_receivable_sales
  ON "{{TENANT_SCHEMA}}".legacy_receivable_ledger (salesperson_id, transaction_date);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".legacy_payable_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file     VARCHAR(160) NOT NULL,
  legacy_row_number INTEGER NOT NULL,
  legacy_invoice_number VARCHAR(96) NOT NULL,
  supplier_id     UUID REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE SET NULL,
  transaction_date DATE,
  due_date        DATE,
  paid_at         DATE,
  amount          NUMERIC(19,4) NOT NULL DEFAULT 0,
  payment_note    TEXT,
  giro_number     VARCHAR(96),
  bank_name       VARCHAR(160),
  giro_date       DATE,
  status          VARCHAR(24) NOT NULL DEFAULT 'IMPORTED',
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legacy_payable_ledger
  ON "{{TENANT_SCHEMA}}".legacy_payable_ledger (source_file, legacy_row_number);
CREATE INDEX IF NOT EXISTS ix_legacy_payable_supplier
  ON "{{TENANT_SCHEMA}}".legacy_payable_ledger (supplier_id, due_date);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".legacy_price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file     VARCHAR(160) NOT NULL,
  legacy_row_number INTEGER NOT NULL,
  party_type      VARCHAR(16) NOT NULL,
  customer_id     UUID REFERENCES "{{TENANT_SCHEMA}}".customer (id) ON DELETE SET NULL,
  supplier_id     UUID REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE SET NULL,
  product_id      UUID REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE SET NULL,
  effective_date  DATE,
  price           NUMERIC(19,4) NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_legacy_price_party CHECK (party_type IN ('CUSTOMER', 'SUPPLIER'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legacy_price_history
  ON "{{TENANT_SCHEMA}}".legacy_price_history (source_file, legacy_row_number);
CREATE INDEX IF NOT EXISTS ix_legacy_price_product
  ON "{{TENANT_SCHEMA}}".legacy_price_history (product_id, effective_date);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".legacy_stock_opname (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file     VARCHAR(160) NOT NULL,
  legacy_row_number INTEGER NOT NULL,
  product_id      UUID REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE SET NULL,
  opname_date     DATE,
  system_qty      NUMERIC(19,6) NOT NULL DEFAULT 0,
  physical_qty    NUMERIC(19,6) NOT NULL DEFAULT 0,
  unit_cost       NUMERIC(19,4) NOT NULL DEFAULT 0,
  variance_qty    NUMERIC(19,6) NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legacy_stock_opname
  ON "{{TENANT_SCHEMA}}".legacy_stock_opname (source_file, legacy_row_number);

CREATE OR REPLACE VIEW "{{TENANT_SCHEMA}}".legacy_import_reconciliation AS
SELECT
  f.file_name,
  f.total_records,
  f.active_records,
  f.deleted_records,
  f.imported_records,
  COUNT(r.id)::integer AS raw_records,
  COUNT(r.id) FILTER (WHERE r.projection_status <> 'RAW_ONLY')::integer AS projected_records,
  COUNT(r.id) FILTER (WHERE r.projection_status = 'RAW_ONLY')::integer AS raw_only_records,
  f.imported_at
FROM "{{TENANT_SCHEMA}}".legacy_import_file f
LEFT JOIN "{{TENANT_SCHEMA}}".legacy_import_record r ON r.import_file_id = f.id
GROUP BY f.id, f.file_name, f.total_records, f.active_records, f.deleted_records, f.imported_records, f.imported_at;
