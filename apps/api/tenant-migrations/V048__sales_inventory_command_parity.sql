-- =========================================================================
-- V048 - Command parity Sales / Inventory
-- Menambah kendali persetujuan dan sinkronisasi tanpa membuat buku harga,
-- jurnal, stok, atau periode kedua. Semua FK menunjuk tabel ERP yang sudah ada.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".price_book
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

UPDATE "{{TENANT_SCHEMA}}".price_book
   SET approval_status = 'APPROVED', approved_at = COALESCE(approved_at, created_at)
 WHERE is_system = TRUE AND approval_status = 'DRAFT';

ALTER TABLE "{{TENANT_SCHEMA}}".price_book
  DROP CONSTRAINT IF EXISTS ck_price_book_approval_status;
ALTER TABLE "{{TENANT_SCHEMA}}".price_book
  ADD CONSTRAINT ck_price_book_approval_status
    CHECK (approval_status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INACTIVE'));

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_period_close_run (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_period_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".fiscal_period (id) ON DELETE RESTRICT,
  run_number        VARCHAR(64) NOT NULL,
  status            VARCHAR(24) NOT NULL DEFAULT 'VALIDATING',
  checklist         JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
  note              TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  CONSTRAINT ck_inventory_period_close_status
    CHECK (status IN ('VALIDATING', 'BLOCKED', 'CLOSED', 'REOPENED', 'FAILED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_period_close_run_number
  ON "{{TENANT_SCHEMA}}".inventory_period_close_run (run_number);
CREATE INDEX IF NOT EXISTS ix_inventory_period_close_period
  ON "{{TENANT_SCHEMA}}".inventory_period_close_run (fiscal_period_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_journal_single_reversal
  ON "{{TENANT_SCHEMA}}".journal_entry (reversal_of_id)
  WHERE reversal_of_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_sync_cursor_seq;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_sync_event (
  cursor_id       BIGINT PRIMARY KEY DEFAULT nextval('"{{TENANT_SCHEMA}}".inventory_sync_cursor_seq'),
  aggregate_type  VARCHAR(48) NOT NULL,
  aggregate_id    VARCHAR(160) NOT NULL,
  event_type      VARCHAR(64) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id        UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id)
);
CREATE INDEX IF NOT EXISTS ix_inventory_sync_event_cursor
  ON "{{TENANT_SCHEMA}}".inventory_sync_event (cursor_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_mobile_command (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        VARCHAR(160) NOT NULL,
  device_event_id  VARCHAR(160) NOT NULL,
  command_type     VARCHAR(64) NOT NULL,
  payload          JSONB NOT NULL,
  status           VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  result_payload   JSONB,
  error_payload    JSONB,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ,
  user_subject_id  UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  CONSTRAINT ck_inventory_mobile_command_status
    CHECK (status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'REJECTED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_mobile_command_event
  ON "{{TENANT_SCHEMA}}".inventory_mobile_command (device_id, device_event_id);
