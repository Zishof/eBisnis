-- =========================================================================
-- V046 - Paritas Sales / Inventory legacy pada ERP modern
-- Menambah bukti yang belum dapat diwakili tabel ERP generik tanpa membuat
-- buku stok, piutang, hutang, atau jurnal kedua.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".sales_order_line
  ADD COLUMN IF NOT EXISTS legacy_unit_cost NUMERIC(19,4);

ALTER TABLE "{{TENANT_SCHEMA}}".sales_order
  ADD COLUMN IF NOT EXISTS source_event_id VARCHAR(160);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_order_source_event
  ON "{{TENANT_SCHEMA}}".sales_order (source_event_id) WHERE source_event_id IS NOT NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".legacy_receivable_ledger
  ADD COLUMN IF NOT EXISTS source_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "{{TENANT_SCHEMA}}".legacy_payable_ledger
  ADD COLUMN IF NOT EXISTS source_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_legacy_receivable_settlement
  ON "{{TENANT_SCHEMA}}".legacy_receivable_ledger (is_settled, due_date, customer_id);
CREATE INDEX IF NOT EXISTS ix_legacy_payable_settlement
  ON "{{TENANT_SCHEMA}}".legacy_payable_ledger (is_settled, due_date, supplier_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".sales_note_handover (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_number     VARCHAR(64) NOT NULL,
  salesperson_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  handover_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status              VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  note                TEXT,
  created_by          UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_sales_note_handover_status CHECK (status IN ('DRAFT', 'HANDED_OVER', 'ACKNOWLEDGED', 'CANCELLED')),
  CONSTRAINT ck_sales_note_handover_ack CHECK (
    (status <> 'ACKNOWLEDGED') OR (acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_note_handover_number
  ON "{{TENANT_SCHEMA}}".sales_note_handover (handover_number);
CREATE INDEX IF NOT EXISTS ix_sales_note_handover_sales_date
  ON "{{TENANT_SCHEMA}}".sales_note_handover (salesperson_id, handover_date DESC);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".sales_note_handover_line (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".sales_note_handover (id) ON DELETE CASCADE,
  receivable_ledger_id  UUID REFERENCES "{{TENANT_SCHEMA}}".legacy_receivable_ledger (id),
  sales_order_id        UUID REFERENCES "{{TENANT_SCHEMA}}".sales_order (id),
  invoice_number        VARCHAR(96) NOT NULL,
  customer_name         VARCHAR(200) NOT NULL,
  invoice_date          DATE,
  due_date              DATE,
  outstanding_amount    NUMERIC(19,4) NOT NULL DEFAULT 0,
  territory_code        VARCHAR(64),
  collection_note       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_sales_note_handover_line_source CHECK (
    receivable_ledger_id IS NOT NULL OR sales_order_id IS NOT NULL
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_note_handover_line
  ON "{{TENANT_SCHEMA}}".sales_note_handover_line (handover_id, invoice_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_report_snapshot (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code       VARCHAR(64) NOT NULL,
  as_of_date        DATE NOT NULL,
  filter_payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload    JSONB NOT NULL,
  row_count         INTEGER NOT NULL DEFAULT 0,
  generated_by      UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_revision   VARCHAR(96),
  CONSTRAINT ck_inventory_report_snapshot_rows CHECK (row_count >= 0)
);
CREATE INDEX IF NOT EXISTS ix_inventory_report_snapshot_lookup
  ON "{{TENANT_SCHEMA}}".inventory_report_snapshot (report_code, as_of_date DESC, generated_at DESC);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_print_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code       VARCHAR(64) NOT NULL,
  snapshot_id       UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_report_snapshot (id),
  output_format     VARCHAR(16) NOT NULL,
  document_number   VARCHAR(96),
  copy_number       INTEGER NOT NULL DEFAULT 1,
  printed_by        UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  printed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_inventory_print_format CHECK (output_format IN ('PDF', 'EXCEL', 'PRINT', 'CSV')),
  CONSTRAINT ck_inventory_print_copy CHECK (copy_number > 0)
);
CREATE INDEX IF NOT EXISTS ix_inventory_print_log_document
  ON "{{TENANT_SCHEMA}}".inventory_print_log (report_code, document_number, printed_at DESC);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_sync_conflict (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         VARCHAR(160) NOT NULL,
  entity_type       VARCHAR(96) NOT NULL,
  entity_id         UUID,
  client_version    INTEGER,
  server_version    INTEGER,
  client_payload    JSONB NOT NULL,
  server_payload    JSONB,
  status            VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  resolution        VARCHAR(32),
  resolved_by       UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_inventory_sync_conflict_status CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
  CONSTRAINT ck_inventory_sync_conflict_resolution CHECK (
    resolution IS NULL OR resolution IN ('CLIENT_WINS', 'SERVER_WINS', 'MERGED', 'DUPLICATE')
  )
);
CREATE INDEX IF NOT EXISTS ix_inventory_sync_conflict_open
  ON "{{TENANT_SCHEMA}}".inventory_sync_conflict (status, created_at DESC);
