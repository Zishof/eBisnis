-- =========================================================================
-- V003 — CATALOG, UOM, PAJAK, HARGA, PEMASOK, PELANGGAN
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".uom (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  symbol          VARCHAR(16),
  dimension       VARCHAR(32) NOT NULL DEFAULT 'UNIT',
  precision       INTEGER NOT NULL DEFAULT 0,
  allow_fraction  BOOLEAN NOT NULL DEFAULT FALSE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_uom_code ON "{{TENANT_SCHEMA}}".uom (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_uom_active ON "{{TENANT_SCHEMA}}".uom (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_uom_sample ON "{{TENANT_SCHEMA}}".uom (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".uom_conversion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID,
  from_uom_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  to_uom_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  factor          NUMERIC(19,8) NOT NULL,
  rounding_mode   VARCHAR(24) NOT NULL DEFAULT 'HALF_UP',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_uom_conversion
  ON "{{TENANT_SCHEMA}}".uom_conversion (COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid), from_uom_id, to_uom_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".tax_category (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  tax_type        VARCHAR(32) NOT NULL DEFAULT 'VAT',
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_tax_category_code ON "{{TENANT_SCHEMA}}".tax_category (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_tax_category_sample ON "{{TENANT_SCHEMA}}".tax_category (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".tax_rate (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_category_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".tax_category (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  rate            NUMERIC(9,4) NOT NULL DEFAULT 0,
  is_inclusive    BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_tax_rate_code ON "{{TENANT_SCHEMA}}".tax_rate (code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".product_category (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID REFERENCES "{{TENANT_SCHEMA}}".product_category (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_category_code ON "{{TENANT_SCHEMA}}".product_category (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_product_category_parent ON "{{TENANT_SCHEMA}}".product_category (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_product_category_active ON "{{TENANT_SCHEMA}}".product_category (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_product_category_sample ON "{{TENANT_SCHEMA}}".product_category (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".product_brand (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_brand_code ON "{{TENANT_SCHEMA}}".product_brand (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_product_brand_sample ON "{{TENANT_SCHEMA}}".product_brand (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".product (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product_category (id) ON DELETE RESTRICT,
  product_brand_id    UUID REFERENCES "{{TENANT_SCHEMA}}".product_brand (id) ON DELETE RESTRICT,
  base_uom_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  tax_category_id     UUID REFERENCES "{{TENANT_SCHEMA}}".tax_category (id) ON DELETE RESTRICT,
  code                VARCHAR(64) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  sku                 VARCHAR(64) NOT NULL,
  barcode             VARCHAR(64),
  gtin                VARCHAR(64),
  product_type        VARCHAR(32) NOT NULL DEFAULT 'GOODS',
  tracking_type       VARCHAR(24) NOT NULL DEFAULT 'NONE',
  shelf_life_days     INTEGER,
  allow_negative_stock BOOLEAN NOT NULL DEFAULT FALSE,
  standard_cost       NUMERIC(19,4) NOT NULL DEFAULT 0,
  default_sale_price  NUMERIC(19,4) NOT NULL DEFAULT 0,
  is_purchasable      BOOLEAN NOT NULL DEFAULT TRUE,
  is_sellable         BOOLEAN NOT NULL DEFAULT TRUE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  deactivated_at      TIMESTAMPTZ,
  deactivated_by      UUID,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID,
  delete_reason       TEXT,
  version             INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_code ON "{{TENANT_SCHEMA}}".product (code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_sku ON "{{TENANT_SCHEMA}}".product (sku) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_product_category ON "{{TENANT_SCHEMA}}".product (category_id);
CREATE INDEX IF NOT EXISTS ix_product_barcode ON "{{TENANT_SCHEMA}}".product (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_product_active ON "{{TENANT_SCHEMA}}".product (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_product_created ON "{{TENANT_SCHEMA}}".product (created_at);
CREATE INDEX IF NOT EXISTS ix_product_updated ON "{{TENANT_SCHEMA}}".product (updated_at);
CREATE INDEX IF NOT EXISTS ix_product_sample ON "{{TENANT_SCHEMA}}".product (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".product_barcode (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id          UUID REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  barcode         VARCHAR(64) NOT NULL,
  barcode_type    VARCHAR(24) NOT NULL DEFAULT 'EAN13',
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_barcode_value ON "{{TENANT_SCHEMA}}".product_barcode (barcode) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".payment_term (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  due_days        INTEGER NOT NULL DEFAULT 0,
  discount_days   INTEGER,
  discount_percent NUMERIC(9,4),
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_term_code ON "{{TENANT_SCHEMA}}".payment_term (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_payment_term_sample ON "{{TENANT_SCHEMA}}".payment_term (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".payment_method (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               VARCHAR(48) NOT NULL,
  name               VARCHAR(120) NOT NULL,
  description        TEXT,
  name_key           VARCHAR(160) NOT NULL DEFAULT '',
  method_type        VARCHAR(32) NOT NULL DEFAULT 'CASH',
  requires_reference BOOLEAN NOT NULL DEFAULT FALSE,
  allows_change      BOOLEAN NOT NULL DEFAULT FALSE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_method_code ON "{{TENANT_SCHEMA}}".payment_method (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_payment_method_active ON "{{TENANT_SCHEMA}}".payment_method (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_payment_method_sample ON "{{TENANT_SCHEMA}}".payment_method (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".supplier_group (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  payment_term_id UUID REFERENCES "{{TENANT_SCHEMA}}".payment_term (id) ON DELETE RESTRICT,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_supplier_group_code ON "{{TENANT_SCHEMA}}".supplier_group (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_supplier_group_sample ON "{{TENANT_SCHEMA}}".supplier_group (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".supplier (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id          UUID REFERENCES "{{TENANT_SCHEMA}}".party (id) ON DELETE RESTRICT,
  supplier_group_id UUID REFERENCES "{{TENANT_SCHEMA}}".supplier_group (id) ON DELETE RESTRICT,
  payment_term_id   UUID REFERENCES "{{TENANT_SCHEMA}}".payment_term (id) ON DELETE RESTRICT,
  address_id        UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE RESTRICT,
  code              VARCHAR(64) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  supplier_number   VARCHAR(48),
  tax_number        VARCHAR(64),
  contact_person    VARCHAR(160),
  phone             VARCHAR(50),
  email             VARCHAR(160),
  currency_code     VARCHAR(8) NOT NULL DEFAULT 'IDR',
  lead_time_days    INTEGER NOT NULL DEFAULT 3,
  rating            NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_blacklisted    BOOLEAN NOT NULL DEFAULT FALSE,
  blacklist_reason  TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_system         BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deactivated_at    TIMESTAMPTZ,
  deactivated_by    UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_supplier_code ON "{{TENANT_SCHEMA}}".supplier (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_supplier_active ON "{{TENANT_SCHEMA}}".supplier (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_supplier_created ON "{{TENANT_SCHEMA}}".supplier (created_at);
CREATE INDEX IF NOT EXISTS ix_supplier_sample ON "{{TENANT_SCHEMA}}".supplier (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".product_supplier (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(160) NOT NULL,
  name              VARCHAR(255) NOT NULL DEFAULT '',
  description       TEXT,
  product_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  supplier_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  purchase_uom_id   UUID REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  supplier_sku      VARCHAR(64),
  lead_time_days    INTEGER NOT NULL DEFAULT 3,
  minimum_order_qty NUMERIC(19,6) NOT NULL DEFAULT 1,
  last_price        NUMERIC(19,4) NOT NULL DEFAULT 0,
  currency_code     VARCHAR(8) NOT NULL DEFAULT 'IDR',
  is_preferred      BOOLEAN NOT NULL DEFAULT FALSE,
  priority          INTEGER NOT NULL DEFAULT 100,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deactivated_at    TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_supplier
  ON "{{TENANT_SCHEMA}}".product_supplier (product_id, supplier_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_supplier_code
  ON "{{TENANT_SCHEMA}}".product_supplier (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_product_supplier_supplier ON "{{TENANT_SCHEMA}}".product_supplier (supplier_id);
CREATE INDEX IF NOT EXISTS ix_product_supplier_sample ON "{{TENANT_SCHEMA}}".product_supplier (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".customer_group (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_group_code ON "{{TENANT_SCHEMA}}".customer_group (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_customer_group_sample ON "{{TENANT_SCHEMA}}".customer_group (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".customer (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id          UUID REFERENCES "{{TENANT_SCHEMA}}".party (id) ON DELETE RESTRICT,
  customer_group_id UUID REFERENCES "{{TENANT_SCHEMA}}".customer_group (id) ON DELETE RESTRICT,
  payment_term_id   UUID REFERENCES "{{TENANT_SCHEMA}}".payment_term (id) ON DELETE RESTRICT,
  address_id        UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE RESTRICT,
  code              VARCHAR(64) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  customer_number   VARCHAR(48),
  customer_type     VARCHAR(24) NOT NULL DEFAULT 'INDIVIDUAL',
  tax_number        VARCHAR(64),
  phone             VARCHAR(50),
  email             VARCHAR(160),
  credit_limit      NUMERIC(19,4) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_system         BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deactivated_at    TIMESTAMPTZ,
  deactivated_by    UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_code ON "{{TENANT_SCHEMA}}".customer (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_customer_active ON "{{TENANT_SCHEMA}}".customer (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_customer_sample ON "{{TENANT_SCHEMA}}".customer (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".price_book (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  scope_type      VARCHAR(32) NOT NULL DEFAULT 'TENANT',
  scope_id        UUID,
  currency_code   VARCHAR(8) NOT NULL DEFAULT 'IDR',
  valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_price_book_code ON "{{TENANT_SCHEMA}}".price_book (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_price_book_sample ON "{{TENANT_SCHEMA}}".price_book (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".price_book_item (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".price_book (id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id        UUID REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  minimum_qty   NUMERIC(19,6) NOT NULL DEFAULT 1,
  price         NUMERIC(19,4) NOT NULL,
  valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until   DATE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample     BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  delete_reason TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_price_book_item
  ON "{{TENANT_SCHEMA}}".price_book_item (price_book_id, product_id, COALESCE(uom_id, '00000000-0000-0000-0000-000000000000'::uuid), minimum_qty, valid_from)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_price_book_item_product ON "{{TENANT_SCHEMA}}".price_book_item (product_id);
