-- =========================================================================
-- V005 — REQUEST ORDER, PURCHASE ORDER, PENERIMAAN, BACKORDER, TRANSFER
-- Aturan: penerimaan TIDAK menambah stok sebelum divalidasi.
--         Backorder tidak menambah stok.
--         Transfer memakai bucket in-transit.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- REQUEST ORDER
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".request_order (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number         VARCHAR(48) NOT NULL,
  requesting_warehouse_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  parent_warehouse_id    UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  outlet_id              UUID REFERENCES "{{TENANT_SCHEMA}}".outlet (id) ON DELETE RESTRICT,
  request_type           VARCHAR(24) NOT NULL DEFAULT 'MANUAL',
  priority               VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  needed_at              DATE,
  status                 VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  generated_by_policy_id UUID REFERENCES "{{TENANT_SCHEMA}}".stock_policy (id) ON DELETE SET NULL,
  source_alert_id        UUID REFERENCES "{{TENANT_SCHEMA}}".stock_alert (id) ON DELETE SET NULL,
  note                   TEXT,
  submitted_at           TIMESTAMPTZ,
  submitted_by           UUID,
  approved_at            TIMESTAMPTZ,
  approved_by            UUID,
  rejected_at            TIMESTAMPTZ,
  reject_reason          TEXT,
  closed_at              TIMESTAMPTZ,
  idempotency_key        VARCHAR(96),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by             UUID,
  deleted_at             TIMESTAMPTZ,
  version                INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_request_order_number ON "{{TENANT_SCHEMA}}".request_order (request_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_request_order_idem ON "{{TENANT_SCHEMA}}".request_order (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_request_order_status ON "{{TENANT_SCHEMA}}".request_order (status, created_at);
CREATE INDEX IF NOT EXISTS ix_request_order_wh ON "{{TENANT_SCHEMA}}".request_order (requesting_warehouse_id, status);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".request_order_line (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_order_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".request_order (id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id            UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  requested_qty     NUMERIC(19,6) NOT NULL,
  approved_qty      NUMERIC(19,6) NOT NULL DEFAULT 0,
  fulfilled_qty     NUMERIC(19,6) NOT NULL DEFAULT 0,
  remaining_qty     NUMERIC(19,6) NOT NULL DEFAULT 0,
  stock_snapshot    JSONB,
  source_stock_policy_id UUID REFERENCES "{{TENANT_SCHEMA}}".stock_policy (id) ON DELETE SET NULL,
  line_no           INTEGER NOT NULL DEFAULT 1,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_request_order_line ON "{{TENANT_SCHEMA}}".request_order_line (request_order_id, line_no);
CREATE INDEX IF NOT EXISTS ix_request_order_line_product ON "{{TENANT_SCHEMA}}".request_order_line (product_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".request_order_consolidation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_number  VARCHAR(48) NOT NULL,
  parent_warehouse_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  status                VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  consolidated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  version               INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ro_consolidation_number ON "{{TENANT_SCHEMA}}".request_order_consolidation (consolidation_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".request_order_consolidation_line (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".request_order_consolidation (id) ON DELETE CASCADE,
  request_order_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".request_order_line (id) ON DELETE RESTRICT,
  product_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  quantity          NUMERIC(19,6) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ro_consolidation_line
  ON "{{TENANT_SCHEMA}}".request_order_consolidation_line (consolidation_id, request_order_line_id);

-- ---------------------------------------------------------------------------
-- PURCHASE ORDER
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".purchase_order (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_number    VARCHAR(48) NOT NULL,
  supplier_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  legal_entity_id          UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  warehouse_id             UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  currency_code            VARCHAR(8) NOT NULL DEFAULT 'IDR',
  order_date               DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date            DATE,
  subtotal                 NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_total           NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_total                NUMERIC(19,4) NOT NULL DEFAULT 0,
  grand_total              NUMERIC(19,4) NOT NULL DEFAULT 0,
  status                   VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  source_type              VARCHAR(48),
  source_id                UUID,
  parent_purchase_order_id UUID REFERENCES "{{TENANT_SCHEMA}}".purchase_order (id) ON DELETE RESTRICT,
  source_backorder_id      UUID,
  note                     TEXT,
  submitted_at             TIMESTAMPTZ,
  approved_at              TIMESTAMPTZ,
  approved_by              UUID,
  sent_at                  TIMESTAMPTZ,
  closed_at                TIMESTAMPTZ,
  idempotency_key          VARCHAR(96),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by               UUID,
  deleted_at               TIMESTAMPTZ,
  version                  INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_purchase_order_number ON "{{TENANT_SCHEMA}}".purchase_order (purchase_order_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_purchase_order_idem ON "{{TENANT_SCHEMA}}".purchase_order (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_purchase_order_supplier ON "{{TENANT_SCHEMA}}".purchase_order (supplier_id, status);
CREATE INDEX IF NOT EXISTS ix_purchase_order_status ON "{{TENANT_SCHEMA}}".purchase_order (status, order_date);
CREATE INDEX IF NOT EXISTS ix_purchase_order_parent ON "{{TENANT_SCHEMA}}".purchase_order (parent_purchase_order_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".purchase_order_line (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".purchase_order (id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id            UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  line_no           INTEGER NOT NULL DEFAULT 1,
  ordered_qty       NUMERIC(19,6) NOT NULL,
  received_qty      NUMERIC(19,6) NOT NULL DEFAULT 0,
  cancelled_qty     NUMERIC(19,6) NOT NULL DEFAULT 0,
  backordered_qty   NUMERIC(19,6) NOT NULL DEFAULT 0,
  unit_price        NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(19,4) NOT NULL DEFAULT 0,
  line_total        NUMERIC(19,4) NOT NULL DEFAULT 0,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_purchase_order_line ON "{{TENANT_SCHEMA}}".purchase_order_line (purchase_order_id, line_no);
CREATE INDEX IF NOT EXISTS ix_purchase_order_line_product ON "{{TENANT_SCHEMA}}".purchase_order_line (product_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".purchase_order_request_allocation (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".purchase_order_line (id) ON DELETE CASCADE,
  request_order_line_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".request_order_line (id) ON DELETE RESTRICT,
  allocated_qty          NUMERIC(19,6) NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_po_request_allocation
  ON "{{TENANT_SCHEMA}}".purchase_order_request_allocation (purchase_order_line_id, request_order_line_id);

-- ---------------------------------------------------------------------------
-- GOODS RECEIPT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".goods_receipt (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number    VARCHAR(48) NOT NULL,
  purchase_order_id UUID REFERENCES "{{TENANT_SCHEMA}}".purchase_order (id) ON DELETE RESTRICT,
  supplier_id       UUID REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  warehouse_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  backorder_id      UUID,
  arrival_date      DATE,
  receipt_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_do_number VARCHAR(64),
  status            VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  inspected_at      TIMESTAMPTZ,
  inspected_by      UUID,
  validated_at      TIMESTAMPTZ,
  validated_by      UUID,
  posting_key       VARCHAR(96),
  reversed_at       TIMESTAMPTZ,
  reverse_reason    TEXT,
  note              TEXT,
  idempotency_key   VARCHAR(96),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_goods_receipt_number ON "{{TENANT_SCHEMA}}".goods_receipt (receipt_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_goods_receipt_posting ON "{{TENANT_SCHEMA}}".goods_receipt (posting_key) WHERE posting_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_goods_receipt_idem ON "{{TENANT_SCHEMA}}".goods_receipt (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_goods_receipt_po ON "{{TENANT_SCHEMA}}".goods_receipt (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_goods_receipt_status ON "{{TENANT_SCHEMA}}".goods_receipt (status, receipt_date);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".goods_receipt_line (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".goods_receipt (id) ON DELETE CASCADE,
  purchase_order_line_id   UUID REFERENCES "{{TENANT_SCHEMA}}".purchase_order_line (id) ON DELETE RESTRICT,
  product_id               UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id                   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  lot_id                   UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE RESTRICT,
  bin_id                   UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_bin (id) ON DELETE RESTRICT,
  line_no                  INTEGER NOT NULL DEFAULT 1,
  ordered_qty              NUMERIC(19,6) NOT NULL DEFAULT 0,
  previously_received_qty  NUMERIC(19,6) NOT NULL DEFAULT 0,
  received_qty             NUMERIC(19,6) NOT NULL DEFAULT 0,
  accepted_qty             NUMERIC(19,6) NOT NULL DEFAULT 0,
  rejected_qty             NUMERIC(19,6) NOT NULL DEFAULT 0,
  backorder_qty            NUMERIC(19,6) NOT NULL DEFAULT 0,
  unit_cost                NUMERIC(19,4) NOT NULL DEFAULT 0,
  batch_number             VARCHAR(64),
  expiry_date              DATE,
  quality_status           VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  note                     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  version                  INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_gr_line_qty CHECK (accepted_qty + rejected_qty <= received_qty)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_goods_receipt_line ON "{{TENANT_SCHEMA}}".goods_receipt_line (goods_receipt_id, line_no);
CREATE INDEX IF NOT EXISTS ix_goods_receipt_line_po_line ON "{{TENANT_SCHEMA}}".goods_receipt_line (purchase_order_line_id);
CREATE INDEX IF NOT EXISTS ix_goods_receipt_line_product ON "{{TENANT_SCHEMA}}".goods_receipt_line (product_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".goods_receipt_inspection (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".goods_receipt (id) ON DELETE CASCADE,
  inspector_id     UUID,
  inspected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  result           VARCHAR(24) NOT NULL DEFAULT 'PASS',
  notes            TEXT,
  detail           JSONB,
  version          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_gr_inspection_receipt ON "{{TENANT_SCHEMA}}".goods_receipt_inspection (goods_receipt_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".goods_receipt_validation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".goods_receipt (id) ON DELETE CASCADE,
  validator_id     UUID,
  validated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  posting_key      VARCHAR(96) NOT NULL,
  action           VARCHAR(24) NOT NULL DEFAULT 'VALIDATE',
  reason           TEXT,
  detail           JSONB
);
CREATE INDEX IF NOT EXISTS ix_gr_validation_receipt ON "{{TENANT_SCHEMA}}".goods_receipt_validation (goods_receipt_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".goods_receipt_discrepancy (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".goods_receipt_line (id) ON DELETE CASCADE,
  discrepancy_type      VARCHAR(32) NOT NULL,
  quantity              NUMERIC(19,6) NOT NULL DEFAULT 0,
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_gr_discrepancy_line ON "{{TENANT_SCHEMA}}".goods_receipt_discrepancy (goods_receipt_line_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".goods_receipt_allocation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".goods_receipt_line (id) ON DELETE CASCADE,
  request_order_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".request_order_line (id) ON DELETE RESTRICT,
  allocated_qty         NUMERIC(19,6) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_gr_allocation
  ON "{{TENANT_SCHEMA}}".goods_receipt_allocation (goods_receipt_line_id, request_order_line_id);

-- ---------------------------------------------------------------------------
-- BACKORDER
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".purchase_backorder (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backorder_number         VARCHAR(48) NOT NULL,
  source_purchase_order_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".purchase_order (id) ON DELETE RESTRICT,
  source_goods_receipt_id  UUID REFERENCES "{{TENANT_SCHEMA}}".goods_receipt (id) ON DELETE RESTRICT,
  original_supplier_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  replacement_supplier_id  UUID REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  warehouse_id             UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  status                   VARCHAR(48) NOT NULL DEFAULT 'DRAFT',
  due_date                 DATE,
  redirect_reason          TEXT,
  note                     TEXT,
  approved_at              TIMESTAMPTZ,
  approved_by              UUID,
  closed_at                TIMESTAMPTZ,
  idempotency_key          VARCHAR(96),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by               UUID,
  deleted_at               TIMESTAMPTZ,
  version                  INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_backorder_number ON "{{TENANT_SCHEMA}}".purchase_backorder (backorder_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_backorder_idem ON "{{TENANT_SCHEMA}}".purchase_backorder (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_backorder_po ON "{{TENANT_SCHEMA}}".purchase_backorder (source_purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_backorder_status ON "{{TENANT_SCHEMA}}".purchase_backorder (status, created_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".purchase_backorder_line (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backorder_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".purchase_backorder (id) ON DELETE CASCADE,
  source_purchase_order_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".purchase_order_line (id) ON DELETE RESTRICT,
  product_id                UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id                    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  line_no                   INTEGER NOT NULL DEFAULT 1,
  shortage_qty              NUMERIC(19,6) NOT NULL,
  fulfilled_qty             NUMERIC(19,6) NOT NULL DEFAULT 0,
  remaining_qty             NUMERIC(19,6) NOT NULL DEFAULT 0,
  cancelled_qty             NUMERIC(19,6) NOT NULL DEFAULT 0,
  target_supplier_id        UUID REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  version                   INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_backorder_line ON "{{TENANT_SCHEMA}}".purchase_backorder_line (backorder_id, line_no);
CREATE INDEX IF NOT EXISTS ix_backorder_line_src ON "{{TENANT_SCHEMA}}".purchase_backorder_line (source_purchase_order_line_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".backorder_supplier_decision (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backorder_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".purchase_backorder (id) ON DELETE CASCADE,
  decision       VARCHAR(32) NOT NULL,
  from_supplier_id UUID REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  to_supplier_id UUID REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  reason         TEXT,
  approved_by    UUID,
  decided_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_backorder_decision ON "{{TENANT_SCHEMA}}".backorder_supplier_decision (backorder_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".backorder_purchase_order_link (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backorder_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".purchase_backorder (id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".purchase_order (id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_backorder_po_link
  ON "{{TENANT_SCHEMA}}".backorder_purchase_order_link (backorder_id, purchase_order_id);

ALTER TABLE "{{TENANT_SCHEMA}}".goods_receipt
  DROP CONSTRAINT IF EXISTS fk_goods_receipt_backorder;
ALTER TABLE "{{TENANT_SCHEMA}}".goods_receipt
  ADD CONSTRAINT fk_goods_receipt_backorder
  FOREIGN KEY (backorder_id) REFERENCES "{{TENANT_SCHEMA}}".purchase_backorder (id) ON DELETE RESTRICT;

ALTER TABLE "{{TENANT_SCHEMA}}".purchase_order
  DROP CONSTRAINT IF EXISTS fk_purchase_order_backorder;
ALTER TABLE "{{TENANT_SCHEMA}}".purchase_order
  ADD CONSTRAINT fk_purchase_order_backorder
  FOREIGN KEY (source_backorder_id) REFERENCES "{{TENANT_SCHEMA}}".purchase_backorder (id) ON DELETE RESTRICT;

ALTER TABLE "{{TENANT_SCHEMA}}".stock_alert
  DROP CONSTRAINT IF EXISTS fk_stock_alert_request_order;
ALTER TABLE "{{TENANT_SCHEMA}}".stock_alert
  ADD CONSTRAINT fk_stock_alert_request_order
  FOREIGN KEY (request_order_id) REFERENCES "{{TENANT_SCHEMA}}".request_order (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- INTERNAL TRANSFER
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".internal_transfer (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number          VARCHAR(48) NOT NULL,
  source_warehouse_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  destination_warehouse_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,
  request_order_id         UUID REFERENCES "{{TENANT_SCHEMA}}".request_order (id) ON DELETE RESTRICT,
  status                   VARCHAR(48) NOT NULL DEFAULT 'DRAFT',
  dispatch_date            TIMESTAMPTZ,
  arrival_date             TIMESTAMPTZ,
  received_date            TIMESTAMPTZ,
  approved_at              TIMESTAMPTZ,
  approved_by              UUID,
  dispatch_posting_key     VARCHAR(96),
  receipt_posting_key      VARCHAR(96),
  note                     TEXT,
  idempotency_key          VARCHAR(96),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by               UUID,
  deleted_at               TIMESTAMPTZ,
  version                  INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_transfer_diff_warehouse CHECK (source_warehouse_id <> destination_warehouse_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_transfer_number ON "{{TENANT_SCHEMA}}".internal_transfer (transfer_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_transfer_dispatch_posting ON "{{TENANT_SCHEMA}}".internal_transfer (dispatch_posting_key) WHERE dispatch_posting_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_transfer_receipt_posting ON "{{TENANT_SCHEMA}}".internal_transfer (receipt_posting_key) WHERE receipt_posting_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_internal_transfer_status ON "{{TENANT_SCHEMA}}".internal_transfer (status, created_at);
CREATE INDEX IF NOT EXISTS ix_internal_transfer_src ON "{{TENANT_SCHEMA}}".internal_transfer (source_warehouse_id, status);
CREATE INDEX IF NOT EXISTS ix_internal_transfer_dst ON "{{TENANT_SCHEMA}}".internal_transfer (destination_warehouse_id, status);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".internal_transfer_line (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_transfer_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".internal_transfer (id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  uom_id               UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  lot_id               UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE RESTRICT,
  line_no              INTEGER NOT NULL DEFAULT 1,
  requested_qty        NUMERIC(19,6) NOT NULL,
  allocated_qty        NUMERIC(19,6) NOT NULL DEFAULT 0,
  dispatched_qty       NUMERIC(19,6) NOT NULL DEFAULT 0,
  received_qty         NUMERIC(19,6) NOT NULL DEFAULT 0,
  rejected_qty         NUMERIC(19,6) NOT NULL DEFAULT 0,
  unit_cost            NUMERIC(19,4) NOT NULL DEFAULT 0,
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  version              INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_transfer_line ON "{{TENANT_SCHEMA}}".internal_transfer_line (internal_transfer_id, line_no);
CREATE INDEX IF NOT EXISTS ix_internal_transfer_line_product ON "{{TENANT_SCHEMA}}".internal_transfer_line (product_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".internal_transfer_receipt (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_transfer_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".internal_transfer (id) ON DELETE CASCADE,
  receipt_number       VARCHAR(48) NOT NULL,
  arrived_at           TIMESTAMPTZ,
  validated_at         TIMESTAMPTZ,
  validated_by         UUID,
  status               VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  version              INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_transfer_receipt_number ON "{{TENANT_SCHEMA}}".internal_transfer_receipt (receipt_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".internal_transfer_receipt_line (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_receipt_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".internal_transfer_receipt (id) ON DELETE CASCADE,
  internal_transfer_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".internal_transfer_line (id) ON DELETE RESTRICT,
  received_qty              NUMERIC(19,6) NOT NULL DEFAULT 0,
  accepted_qty              NUMERIC(19,6) NOT NULL DEFAULT 0,
  rejected_qty              NUMERIC(19,6) NOT NULL DEFAULT 0,
  discrepancy_type          VARCHAR(32),
  note                      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_transfer_receipt_line
  ON "{{TENANT_SCHEMA}}".internal_transfer_receipt_line (transfer_receipt_id, internal_transfer_line_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".internal_transfer_discrepancy (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_transfer_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".internal_transfer_line (id) ON DELETE CASCADE,
  discrepancy_type          VARCHAR(32) NOT NULL,
  quantity                  NUMERIC(19,6) NOT NULL DEFAULT 0,
  note                      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_transfer_discrepancy_line ON "{{TENANT_SCHEMA}}".internal_transfer_discrepancy (internal_transfer_line_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".supplier_invoice (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".supplier (id) ON DELETE RESTRICT,
  purchase_order_id UUID REFERENCES "{{TENANT_SCHEMA}}".purchase_order (id) ON DELETE RESTRICT,
  invoice_number    VARCHAR(64) NOT NULL,
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  currency_code     VARCHAR(8) NOT NULL DEFAULT 'IDR',
  subtotal          NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(19,4) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(19,4) NOT NULL DEFAULT 0,
  paid_total        NUMERIC(19,4) NOT NULL DEFAULT 0,
  match_status      VARCHAR(24) NOT NULL DEFAULT 'UNMATCHED',
  status            VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_supplier_invoice ON "{{TENANT_SCHEMA}}".supplier_invoice (supplier_id, invoice_number);
