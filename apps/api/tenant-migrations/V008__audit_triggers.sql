-- =========================================================================
-- V008 — AUDIT SCHEMA + TRIGGER DML GENERIK (append-only)
--
-- Trigger membaca konteks yang disetel aplikasi pada transaksi:
--   SELECT set_config('app.request_id',  ..., true);
--   SELECT set_config('app.user_id',     ..., true);
--   SELECT set_config('app.username',    ..., true);
--   SELECT set_config('app.ip_address',  ..., true);
--   SELECT set_config('app.action_code', ..., true);
--   SELECT set_config('app.module_code', ..., true);
--   SELECT set_config('app.support_session_id', ..., true);
--
-- Kolom sensitif dimask sebelum masuk old_data/new_data.
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{AUDIT_SCHEMA}}".audit_event (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_schema    VARCHAR(64) NOT NULL DEFAULT '{{TENANT_SCHEMA}}',
  request_id       VARCHAR(64),
  correlation_id   VARCHAR(64),
  actor_user_id    UUID,
  actor_username   VARCHAR(64),
  actor_role_codes JSONB,
  session_id       UUID,
  support_session_id UUID,
  device_id        UUID,
  ip_address       VARCHAR(64),
  user_agent       TEXT,
  module_code      VARCHAR(48) NOT NULL DEFAULT 'SYSTEM',
  action_code      VARCHAR(48) NOT NULL DEFAULT 'UNKNOWN',
  entity_type      VARCHAR(96),
  entity_id        VARCHAR(96),
  document_number  VARCHAR(96),
  result           VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
  reason           TEXT,
  metadata         JSONB
);
CREATE INDEX IF NOT EXISTS ix_audit_event_time ON "{{AUDIT_SCHEMA}}".audit_event (occurred_at);
CREATE INDEX IF NOT EXISTS ix_audit_event_actor ON "{{AUDIT_SCHEMA}}".audit_event (actor_user_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_audit_event_entity ON "{{AUDIT_SCHEMA}}".audit_event (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_event_request ON "{{AUDIT_SCHEMA}}".audit_event (request_id);
CREATE INDEX IF NOT EXISTS ix_audit_event_action ON "{{AUDIT_SCHEMA}}".audit_event (module_code, action_code, occurred_at);

CREATE TABLE IF NOT EXISTS "{{AUDIT_SCHEMA}}".audit_row_change (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_event_id      UUID REFERENCES "{{AUDIT_SCHEMA}}".audit_event (id) ON DELETE RESTRICT,
  table_schema        VARCHAR(64) NOT NULL,
  table_name          VARCHAR(96) NOT NULL,
  row_pk              JSONB NOT NULL,
  operation           VARCHAR(8) NOT NULL,
  old_data            JSONB,
  new_data            JSONB,
  changed_columns     JSONB,
  transaction_id      BIGINT,
  statement_timestamp TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX IF NOT EXISTS ix_audit_row_event ON "{{AUDIT_SCHEMA}}".audit_row_change (audit_event_id);
CREATE INDEX IF NOT EXISTS ix_audit_row_table ON "{{AUDIT_SCHEMA}}".audit_row_change (table_schema, table_name, statement_timestamp);
CREATE INDEX IF NOT EXISTS ix_audit_row_pk ON "{{AUDIT_SCHEMA}}".audit_row_change USING GIN (row_pk);

CREATE TABLE IF NOT EXISTS "{{AUDIT_SCHEMA}}".audit_security_event (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_code     VARCHAR(64) NOT NULL,
  severity       VARCHAR(16) NOT NULL DEFAULT 'INFO',
  actor_user_id  UUID,
  actor_username VARCHAR(64),
  ip_address     VARCHAR(64),
  user_agent     TEXT,
  request_id     VARCHAR(64),
  result         VARCHAR(16) NOT NULL DEFAULT 'FAILURE',
  detail         JSONB
);
CREATE INDEX IF NOT EXISTS ix_audit_security_time ON "{{AUDIT_SCHEMA}}".audit_security_event (occurred_at);

CREATE TABLE IF NOT EXISTS "{{AUDIT_SCHEMA}}".audit_export_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id   UUID,
  resource_code   VARCHAR(64) NOT NULL,
  filter_snapshot JSONB,
  row_count       INTEGER NOT NULL DEFAULT 0,
  format          VARCHAR(16) NOT NULL DEFAULT 'CSV',
  request_id      VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS ix_audit_export_time ON "{{AUDIT_SCHEMA}}".audit_export_event (occurred_at);

CREATE TABLE IF NOT EXISTS "{{AUDIT_SCHEMA}}".audit_permission_change (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id   UUID,
  target_type     VARCHAR(48) NOT NULL,
  target_id       VARCHAR(96) NOT NULL,
  before_snapshot JSONB,
  after_snapshot  JSONB,
  reason          TEXT,
  request_id      VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS ix_audit_permission_time ON "{{AUDIT_SCHEMA}}".audit_permission_change (occurred_at);

CREATE TABLE IF NOT EXISTS "{{AUDIT_SCHEMA}}".audit_posting_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id   UUID,
  posting_type    VARCHAR(48) NOT NULL,
  posting_key     VARCHAR(96) NOT NULL,
  document_type   VARCHAR(64),
  document_id     UUID,
  document_number VARCHAR(96),
  is_reversal     BOOLEAN NOT NULL DEFAULT FALSE,
  detail          JSONB,
  request_id      VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS ix_audit_posting_time ON "{{AUDIT_SCHEMA}}".audit_posting_event (occurred_at);
CREATE INDEX IF NOT EXISTS ix_audit_posting_key ON "{{AUDIT_SCHEMA}}".audit_posting_event (posting_key);

CREATE TABLE IF NOT EXISTS "{{AUDIT_SCHEMA}}".audit_schema_migration (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_name       VARCHAR(64) NOT NULL,
  migration_version VARCHAR(16) NOT NULL,
  checksum          VARCHAR(64) NOT NULL,
  status            VARCHAR(24) NOT NULL,
  duration_ms       INTEGER NOT NULL DEFAULT 0,
  actor_user_id     UUID,
  error_message     TEXT
);
CREATE INDEX IF NOT EXISTS ix_audit_migration_schema ON "{{AUDIT_SCHEMA}}".audit_schema_migration (schema_name, occurred_at);

-- ---------------------------------------------------------------------------
-- Kolom yang TIDAK BOLEH masuk audit payload.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{AUDIT_SCHEMA}}".mask_sensitive(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $mask$
DECLARE
  sensitive TEXT[] := ARRAY[
    'password', 'password_hash', 'passwordhash', 'token', 'token_hash',
    'refresh_token', 'access_token', 'secret', 'client_secret', 'api_key',
    'pin', 'card_number', 'cvv', 'challenge_hash', 'fingerprint_hash',
    'private_key'
  ];
  k TEXT;
  out_payload JSONB := payload;
BEGIN
  IF payload IS NULL THEN
    RETURN NULL;
  END IF;
  FOREACH k IN ARRAY sensitive LOOP
    IF out_payload ? k THEN
      out_payload := jsonb_set(out_payload, ARRAY[k], '"***MASKED***"'::jsonb, false);
    END IF;
  END LOOP;
  RETURN out_payload;
END;
$mask$;

-- ---------------------------------------------------------------------------
-- Ambil/buat audit_event untuk transaksi berjalan.
-- Satu audit_event per (transaksi, request) agar row change dapat dikelompokkan.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{AUDIT_SCHEMA}}".current_audit_event()
RETURNS UUID
LANGUAGE plpgsql
AS $ev$
DECLARE
  existing TEXT;
  new_id   UUID;
BEGIN
  existing := current_setting('app.audit_event_id', true);
  IF existing IS NOT NULL AND existing <> '' THEN
    RETURN existing::uuid;
  END IF;

  INSERT INTO "{{AUDIT_SCHEMA}}".audit_event (
    request_id, correlation_id, actor_user_id, actor_username,
    session_id, support_session_id, ip_address, user_agent,
    module_code, action_code, result
  )
  VALUES (
    NULLIF(current_setting('app.request_id', true), ''),
    NULLIF(current_setting('app.correlation_id', true), ''),
    NULLIF(current_setting('app.user_id', true), '')::uuid,
    NULLIF(current_setting('app.username', true), ''),
    NULLIF(current_setting('app.session_id', true), '')::uuid,
    NULLIF(current_setting('app.support_session_id', true), '')::uuid,
    NULLIF(current_setting('app.ip_address', true), ''),
    NULLIF(current_setting('app.user_agent', true), ''),
    COALESCE(NULLIF(current_setting('app.module_code', true), ''), 'SYSTEM'),
    COALESCE(NULLIF(current_setting('app.action_code', true), ''), 'DB_CHANGE'),
    'SUCCESS'
  )
  RETURNING id INTO new_id;

  PERFORM set_config('app.audit_event_id', new_id::text, true);
  RETURN new_id;
END;
$ev$;

-- ---------------------------------------------------------------------------
-- Trigger DML generik.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{AUDIT_SCHEMA}}".audit_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $trg$
DECLARE
  v_event_id  UUID;
  v_old       JSONB;
  v_new       JSONB;
  v_changed   JSONB;
  v_pk        JSONB;
BEGIN
  v_event_id := "{{AUDIT_SCHEMA}}".current_audit_event();

  IF TG_OP = 'INSERT' THEN
    v_new := "{{AUDIT_SCHEMA}}".mask_sensitive(to_jsonb(NEW));
    v_pk  := jsonb_build_object('id', v_new -> 'id');
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := "{{AUDIT_SCHEMA}}".mask_sensitive(to_jsonb(OLD));
    v_new := "{{AUDIT_SCHEMA}}".mask_sensitive(to_jsonb(NEW));
    v_pk  := jsonb_build_object('id', v_new -> 'id');
    SELECT jsonb_agg(key) INTO v_changed
    FROM jsonb_each(v_new) n
    WHERE n.value IS DISTINCT FROM (v_old -> n.key);
    -- Lewati bila tidak ada perubahan nyata.
    IF v_changed IS NULL THEN
      RETURN NULL;
    END IF;
  ELSE
    v_old := "{{AUDIT_SCHEMA}}".mask_sensitive(to_jsonb(OLD));
    v_pk  := jsonb_build_object('id', v_old -> 'id');
  END IF;

  INSERT INTO "{{AUDIT_SCHEMA}}".audit_row_change (
    audit_event_id, table_schema, table_name, row_pk, operation,
    old_data, new_data, changed_columns, transaction_id
  ) VALUES (
    v_event_id, TG_TABLE_SCHEMA, TG_TABLE_NAME, v_pk, TG_OP,
    v_old, v_new, v_changed, txid_current()
  );

  RETURN NULL;
END;
$trg$;

-- ---------------------------------------------------------------------------
-- Pasang trigger pada seluruh tabel tenant yang memiliki kolom id UUID,
-- kecuali tabel teknis/ledger yang di-exclude.
-- ---------------------------------------------------------------------------
DO $install$
DECLARE
  r RECORD;
  excluded TEXT[] := ARRAY[
    'schema_migration', 'idempotency_record', 'sync_outbox', 'sync_inbox',
    'job_execution', 'data_export_log', 'notification', 'starter_data_marker'
  ];
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '{{TENANT_SCHEMA}}'
      AND c.relkind = 'r'
      AND NOT (c.relname = ANY (excluded))
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped
      )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I',
      r.table_name, '{{TENANT_SCHEMA}}'
    );
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      r.table_name, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END;
$install$;

-- ---------------------------------------------------------------------------
-- stock_movement dan journal_entry (POSTED) bersifat immutable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $imm$
BEGIN
  RAISE EXCEPTION 'LEDGER_IMMUTABLE: % pada %.% tidak diizinkan. Gunakan reversal.',
    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$imm$;

DROP TRIGGER IF EXISTS trg_stock_movement_immutable ON "{{TENANT_SCHEMA}}".stock_movement;
CREATE TRIGGER trg_stock_movement_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".stock_movement
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_posted_journal_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $pj$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'POSTED' THEN
      RAISE EXCEPTION 'JOURNAL_IMMUTABLE: jurnal POSTED tidak dapat dihapus. Gunakan reversal.'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'POSTED' AND NEW.status = 'POSTED' THEN
    IF NEW.total_debit IS DISTINCT FROM OLD.total_debit
       OR NEW.total_credit IS DISTINCT FROM OLD.total_credit
       OR NEW.journal_date IS DISTINCT FROM OLD.journal_date
       OR NEW.posting_key IS DISTINCT FROM OLD.posting_key THEN
      RAISE EXCEPTION 'JOURNAL_IMMUTABLE: jurnal POSTED tidak dapat diubah. Gunakan reversal.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$pj$;

DROP TRIGGER IF EXISTS trg_journal_immutable ON "{{TENANT_SCHEMA}}".journal_entry;
CREATE TRIGGER trg_journal_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".journal_entry
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_posted_journal_mutation();

-- ---------------------------------------------------------------------------
-- Audit schema append-only: cabut UPDATE/DELETE/TRUNCATE dari PUBLIC.
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA "{{AUDIT_SCHEMA}}" FROM PUBLIC;
