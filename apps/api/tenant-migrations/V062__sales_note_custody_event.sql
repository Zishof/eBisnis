-- Histori custody nota sales bersifat append-only. Perubahan status header
-- tetap menjadi proyeksi cepat; tabel ini adalah bukti aktor, waktu, dan
-- transisi yang tidak boleh ditimpa atau dihapus.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".sales_note_custody_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".sales_note_handover (id),
  event_type      VARCHAR(24) NOT NULL,
  from_status     VARCHAR(24),
  to_status       VARCHAR(24) NOT NULL,
  actor_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_sales_note_custody_event_type
    CHECK (event_type IN ('CREATED', 'HANDED_OVER', 'RETURNED', 'CLOSED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS ix_sales_note_custody_event_timeline
  ON "{{TENANT_SCHEMA}}".sales_note_custody_event (handover_id, occurred_at, id);

DROP TRIGGER IF EXISTS trg_sales_note_custody_event_immutable
  ON "{{TENANT_SCHEMA}}".sales_note_custody_event;
CREATE TRIGGER trg_sales_note_custody_event_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".sales_note_custody_event
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();
