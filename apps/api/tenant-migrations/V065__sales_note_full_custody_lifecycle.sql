-- =========================================================================
-- V065 — LIFECYCLE CUSTODY NOTA SALES LENGKAP
-- Migrasi aditif. Histori event tetap append-only dan tidak dihapus.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover
  DROP CONSTRAINT IF EXISTS ck_sales_note_handover_status;

UPDATE "{{TENANT_SCHEMA}}".sales_note_handover
   SET status = CASE status
     WHEN 'DRAFT' THEN 'READY'
     WHEN 'ACKNOWLEDGED' THEN 'RECONCILED'
     ELSE status
   END;

ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover
  ADD COLUMN IF NOT EXISTS carried_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS carried_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  ADD COLUMN IF NOT EXISTS reconciliation_note TEXT,
  ADD COLUMN IF NOT EXISTS handover_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS exception_note TEXT;

ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover
  ADD CONSTRAINT ck_sales_note_handover_status CHECK (
    status IN (
      'READY', 'HANDED_OVER', 'CARRIED', 'PARTIAL_COLLECTED',
      'RETURNED', 'RECONCILED', 'CLOSED', 'LOST', 'DISPUTED', 'CANCELLED'
    )
  );
ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover
  ALTER COLUMN status SET DEFAULT 'READY';

ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover_line
  DROP CONSTRAINT IF EXISTS ck_sales_note_handover_line_status;

UPDATE "{{TENANT_SCHEMA}}".sales_note_handover_line line
   SET status = CASE
     WHEN header.status = 'READY' THEN 'READY'
     WHEN header.status = 'CLOSED' THEN 'RECONCILED'
     WHEN line.status = 'COLLECTED' AND line.collected_amount < line.outstanding_amount
       THEN 'PARTIAL_COLLECTED'
     ELSE line.status
   END
  FROM "{{TENANT_SCHEMA}}".sales_note_handover header
 WHERE header.id = line.handover_id;

ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover_line
  ADD COLUMN IF NOT EXISTS reconciled_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exception_reason TEXT,
  ADD CONSTRAINT ck_sales_note_handover_line_status CHECK (
    status IN (
      'READY', 'CARRIED', 'PARTIAL_COLLECTED', 'RETURNED',
      'COLLECTED', 'RECONCILED', 'LOST', 'DISPUTED'
    )
  ),
  ADD CONSTRAINT ck_sales_note_handover_line_amounts CHECK (
    returned_amount >= 0 AND collected_amount >= 0 AND reconciled_amount >= 0
    AND returned_amount + collected_amount <= outstanding_amount
  );
ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_handover_line
  ALTER COLUMN status SET DEFAULT 'READY';

DROP INDEX IF EXISTS "{{TENANT_SCHEMA}}".ix_sales_note_active_receivable;
CREATE INDEX ix_sales_note_active_receivable
  ON "{{TENANT_SCHEMA}}".sales_note_handover_line(receivable_ledger_id)
  WHERE receivable_ledger_id IS NOT NULL
    AND status IN ('READY', 'CARRIED', 'PARTIAL_COLLECTED', 'RETURNED', 'LOST', 'DISPUTED');

ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_custody_event
  DROP CONSTRAINT IF EXISTS ck_sales_note_custody_event_type;
ALTER TABLE "{{TENANT_SCHEMA}}".sales_note_custody_event
  ADD CONSTRAINT ck_sales_note_custody_event_type CHECK (
    event_type IN (
      'CREATED', 'HANDED_OVER', 'CARRIED', 'PARTIAL_COLLECTED',
      'RETURNED', 'RECONCILED', 'CLOSED', 'LOST', 'DISPUTED',
      'EXCEPTION_RESOLVED', 'CANCELLED'
    )
  );
