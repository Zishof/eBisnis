-- =========================================================================
-- V004 — GUDANG, STRUKTUR LOKASI, LEDGER STOK, KEBIJAKAN MINIMUM STOK
-- Sumber kebenaran stok = stock_movement (immutable).
-- stock_balance adalah projection yang diperbarui atomik.
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".warehouse_type (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  name_key        VARCHAR(160) NOT NULL DEFAULT '',
  allows_sale     BOOLEAN NOT NULL DEFAULT TRUE,
  allows_production BOOLEAN NOT NULL DEFAULT FALSE,
  is_transit      BOOLEAN NOT NULL DEFAULT FALSE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_type_code ON "{{TENANT_SCHEMA}}".warehouse_type (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_warehouse_type_sample ON "{{TENANT_SCHEMA}}".warehouse_type (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".warehouse (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id     UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  outlet_id           UUID REFERENCES "{{TENANT_SCHEMA}}".outlet (id) ON DELETE RESTRICT,
  region_id           UUID REFERENCES "{{TENANT_SCHEMA}}".region (id) ON DELETE RESTRICT,
  parent_warehouse_id UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  warehouse_type_id   UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_type (id) ON DELETE RESTRICT,
  address_id          UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE RESTRICT,
  code                VARCHAR(64) NOT NULL,
  name                VARCHAR(160) NOT NULL,
  description         TEXT,
  is_parent           BOOLEAN NOT NULL DEFAULT FALSE,
  path                VARCHAR(512) NOT NULL DEFAULT '',
  level               INTEGER NOT NULL DEFAULT 0,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_code ON "{{TENANT_SCHEMA}}".warehouse (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_warehouse_parent ON "{{TENANT_SCHEMA}}".warehouse (parent_warehouse_id);
CREATE INDEX IF NOT EXISTS ix_warehouse_region ON "{{TENANT_SCHEMA}}".warehouse (region_id);
CREATE INDEX IF NOT EXISTS ix_warehouse_outlet ON "{{TENANT_SCHEMA}}".warehouse (outlet_id);
CREATE INDEX IF NOT EXISTS ix_warehouse_active ON "{{TENANT_SCHEMA}}".warehouse (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_warehouse_sample ON "{{TENANT_SCHEMA}}".warehouse (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".warehouse_zone (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  zone_type       VARCHAR(32) NOT NULL DEFAULT 'STORAGE',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_zone ON "{{TENANT_SCHEMA}}".warehouse_zone (warehouse_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".warehouse_bin (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  zone_id         UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_zone (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  aisle           VARCHAR(32),
  rack            VARCHAR(32),
  capacity        NUMERIC(19,6),
  pick_priority   INTEGER NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_bin ON "{{TENANT_SCHEMA}}".warehouse_bin (warehouse_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_lot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  supplier_id     UUID REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  lot_number      VARCHAR(64) NOT NULL,
  production_date DATE,
  expiry_date     DATE,
  quality_status  VARCHAR(24) NOT NULL DEFAULT 'GOOD',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_lot ON "{{TENANT_SCHEMA}}".inventory_lot (product_id, lot_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_inventory_lot_expiry ON "{{TENANT_SCHEMA}}".inventory_lot (expiry_date);

-- ---------------------------------------------------------------------------
-- stock_movement — LEDGER IMMUTABLE. Tidak pernah di-UPDATE atau DELETE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".stock_movement (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number        VARCHAR(48) NOT NULL,
  movement_type          VARCHAR(48) NOT NULL,
  product_id             UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id                 UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  lot_id                 UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE RESTRICT,
  quantity               NUMERIC(19,6) NOT NULL,
  unit_cost              NUMERIC(19,4) NOT NULL DEFAULT 0,
  source_warehouse_id    UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  source_bin_id          UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_bin (id) ON DELETE RESTRICT,
  destination_warehouse_id UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  destination_bin_id     UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_bin (id) ON DELETE RESTRICT,
  bucket_from            VARCHAR(24),
  bucket_to              VARCHAR(24),
  reference_type         VARCHAR(64) NOT NULL,
  reference_id           UUID,
  reference_number       VARCHAR(64),
  posting_key            VARCHAR(96) NOT NULL,
  idempotency_key        VARCHAR(96),
  occurred_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID,
  note                   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_movement_number ON "{{TENANT_SCHEMA}}".stock_movement (movement_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_movement_posting ON "{{TENANT_SCHEMA}}".stock_movement (posting_key);
CREATE INDEX IF NOT EXISTS ix_stock_movement_product ON "{{TENANT_SCHEMA}}".stock_movement (product_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_stock_movement_src ON "{{TENANT_SCHEMA}}".stock_movement (source_warehouse_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_stock_movement_dst ON "{{TENANT_SCHEMA}}".stock_movement (destination_warehouse_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_stock_movement_ref ON "{{TENANT_SCHEMA}}".stock_movement (reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- stock_balance — projection saldo per warehouse/product/lot
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".stock_balance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  product_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  lot_id         UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE RESTRICT,
  bin_id         UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_bin (id) ON DELETE RESTRICT,
  on_hand_qty    NUMERIC(19,6) NOT NULL DEFAULT 0,
  reserved_qty   NUMERIC(19,6) NOT NULL DEFAULT 0,
  available_qty  NUMERIC(19,6) NOT NULL DEFAULT 0,
  in_transit_qty NUMERIC(19,6) NOT NULL DEFAULT 0,
  quarantine_qty NUMERIC(19,6) NOT NULL DEFAULT 0,
  damaged_qty    NUMERIC(19,6) NOT NULL DEFAULT 0,
  average_cost   NUMERIC(19,4) NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_balance
  ON "{{TENANT_SCHEMA}}".stock_balance (
    warehouse_id, product_id,
    COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
CREATE INDEX IF NOT EXISTS ix_stock_balance_product ON "{{TENANT_SCHEMA}}".stock_balance (product_id);
CREATE INDEX IF NOT EXISTS ix_stock_balance_warehouse ON "{{TENANT_SCHEMA}}".stock_balance (warehouse_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".stock_reservation (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  product_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  lot_id         UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE RESTRICT,
  source_type    VARCHAR(64) NOT NULL,
  source_id      UUID,
  quantity       NUMERIC(19,6) NOT NULL,
  status         VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID,
  released_at    TIMESTAMPTZ,
  version        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_stock_reservation_src ON "{{TENANT_SCHEMA}}".stock_reservation (source_type, source_id);
CREATE INDEX IF NOT EXISTS ix_stock_reservation_active ON "{{TENANT_SCHEMA}}".stock_reservation (warehouse_id, product_id, status);

-- ---------------------------------------------------------------------------
-- stock_policy — minimum stok, reorder point, auto request order
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".stock_policy (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  product_id             UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id                 UUID REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  code                   VARCHAR(96) NOT NULL,
  name                   VARCHAR(255) NOT NULL,
  description            TEXT,
  minimum_stock          NUMERIC(19,6) NOT NULL DEFAULT 0,
  maximum_stock          NUMERIC(19,6),
  reorder_point          NUMERIC(19,6) NOT NULL DEFAULT 0,
  safety_stock           NUMERIC(19,6) NOT NULL DEFAULT 0,
  lead_time_days         INTEGER NOT NULL DEFAULT 3,
  recommended_order_qty  NUMERIC(19,6) NOT NULL DEFAULT 0,
  auto_request_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_policy
  ON "{{TENANT_SCHEMA}}".stock_policy (warehouse_id, product_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_policy_code
  ON "{{TENANT_SCHEMA}}".stock_policy (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_stock_policy_active ON "{{TENANT_SCHEMA}}".stock_policy (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_stock_policy_auto ON "{{TENANT_SCHEMA}}".stock_policy (auto_request_enabled, is_active);
CREATE INDEX IF NOT EXISTS ix_stock_policy_sample ON "{{TENANT_SCHEMA}}".stock_policy (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- stock_alert — dedupe alert aktif per produk-lokasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".stock_alert (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_policy_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".stock_policy (id) ON DELETE RESTRICT,
  warehouse_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  product_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  alert_type      VARCHAR(32) NOT NULL DEFAULT 'MIN_STOCK',
  projected_qty   NUMERIC(19,6) NOT NULL DEFAULT 0,
  threshold_qty   NUMERIC(19,6) NOT NULL DEFAULT 0,
  recommended_qty NUMERIC(19,6) NOT NULL DEFAULT 0,
  status          VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  request_order_id UUID,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_reason TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
-- Dedupe: hanya satu alert OPEN per (warehouse, product, alert_type)
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_alert_open
  ON "{{TENANT_SCHEMA}}".stock_alert (warehouse_id, product_id, alert_type)
  WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS ix_stock_alert_status ON "{{TENANT_SCHEMA}}".stock_alert (status, detected_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".stock_count (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  count_number  VARCHAR(48) NOT NULL,
  count_type    VARCHAR(24) NOT NULL DEFAULT 'FULL',
  scheduled_at  TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  status        VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_count_number ON "{{TENANT_SCHEMA}}".stock_count (count_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".stock_count_line (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".stock_count (id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  lot_id         UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE RESTRICT,
  bin_id         UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_bin (id) ON DELETE RESTRICT,
  system_qty     NUMERIC(19,6) NOT NULL DEFAULT 0,
  counted_qty    NUMERIC(19,6) NOT NULL DEFAULT 0,
  variance_qty   NUMERIC(19,6) NOT NULL DEFAULT 0,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_stock_count_line_count ON "{{TENANT_SCHEMA}}".stock_count_line (stock_count_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_adjustment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  stock_count_id    UUID REFERENCES "{{TENANT_SCHEMA}}".stock_count (id) ON DELETE RESTRICT,
  adjustment_number VARCHAR(48) NOT NULL,
  adjustment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  reason            TEXT NOT NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  posted_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_adjustment_number ON "{{TENANT_SCHEMA}}".inventory_adjustment (adjustment_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_adjustment_line (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".inventory_adjustment (id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  lot_id        UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE RESTRICT,
  bin_id        UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_bin (id) ON DELETE RESTRICT,
  quantity      NUMERIC(19,6) NOT NULL,
  direction     VARCHAR(8) NOT NULL DEFAULT 'IN',
  unit_cost     NUMERIC(19,4) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_inventory_adjustment_line_adj ON "{{TENANT_SCHEMA}}".inventory_adjustment_line (adjustment_id);
