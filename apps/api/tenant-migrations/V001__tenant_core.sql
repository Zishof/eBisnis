-- =========================================================================
-- V001 — TENANT CORE
-- Placeholder {{TENANT_SCHEMA}} dan {{AUDIT_SCHEMA}} diganti oleh
-- SchemaProvisioner SETELAH identifier tervalidasi regex ^[a-z][a-z0-9_]{2,47}$.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- Migration bookkeeping lokal schema (cadangan dari platform registry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".schema_migration (
  version      VARCHAR(16) PRIMARY KEY,
  name         VARCHAR(160) NOT NULL,
  checksum     VARCHAR(64)  NOT NULL,
  applied_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  duration_ms  INTEGER      NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- app_setting — konfigurasi tenant/perusahaan/outlet
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".app_setting (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type      VARCHAR(32) NOT NULL DEFAULT 'TENANT',
  scope_id        UUID,
  code            VARCHAR(96) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  value_type      VARCHAR(24) NOT NULL DEFAULT 'STRING',
  value_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_encrypted    BOOLEAN NOT NULL DEFAULT FALSE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_setting_code
  ON "{{TENANT_SCHEMA}}".app_setting (scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_app_setting_active ON "{{TENANT_SCHEMA}}".app_setting (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_app_setting_sample ON "{{TENANT_SCHEMA}}".app_setting (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- number_sequence — penomoran dokumen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".number_sequence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  document_type   VARCHAR(64) NOT NULL,
  scope_type      VARCHAR(32) NOT NULL DEFAULT 'TENANT',
  scope_id        UUID,
  prefix          VARCHAR(32) NOT NULL DEFAULT '',
  suffix          VARCHAR(32) NOT NULL DEFAULT '',
  padding         INTEGER NOT NULL DEFAULT 5,
  next_number     BIGINT NOT NULL DEFAULT 1,
  reset_policy    VARCHAR(24) NOT NULL DEFAULT 'NEVER',
  last_reset_at   TIMESTAMPTZ,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_number_sequence_code
  ON "{{TENANT_SCHEMA}}".number_sequence (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_number_sequence_active ON "{{TENANT_SCHEMA}}".number_sequence (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_number_sequence_sample ON "{{TENANT_SCHEMA}}".number_sequence (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- file_object + entity_attachment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".file_object (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(96) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  storage_key     VARCHAR(512) NOT NULL,
  filename        VARCHAR(255) NOT NULL,
  mime_type       VARCHAR(128) NOT NULL,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  checksum        VARCHAR(64),
  owner_subject_id UUID,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_file_object_code
  ON "{{TENANT_SCHEMA}}".file_object (code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".entity_attachment (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(96) NOT NULL,
  entity_id     UUID NOT NULL,
  file_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".file_object (id) ON DELETE RESTRICT,
  category      VARCHAR(48) NOT NULL DEFAULT 'GENERAL',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  deleted_at    TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_entity_attachment_entity
  ON "{{TENANT_SCHEMA}}".entity_attachment (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- idempotency_record — operasi kritis tenant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".idempotency_record (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(96) NOT NULL,
  operation       VARCHAR(96) NOT NULL,
  request_hash    VARCHAR(64) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body   JSONB,
  resource_type   VARCHAR(64),
  resource_id     VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_idempotency_key_op
  ON "{{TENANT_SCHEMA}}".idempotency_record (idempotency_key, operation);
CREATE INDEX IF NOT EXISTS ix_idempotency_expires
  ON "{{TENANT_SCHEMA}}".idempotency_record (expires_at);

-- ---------------------------------------------------------------------------
-- starter_data_marker — menandai data contoh agar aman dibersihkan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".starter_data_marker (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_code   VARCHAR(64) NOT NULL,
  table_name      VARCHAR(96) NOT NULL,
  record_id       UUID NOT NULL,
  record_code     VARCHAR(96),
  sample_batch_id UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_starter_marker
  ON "{{TENANT_SCHEMA}}".starter_data_marker (table_name, record_id);
CREATE INDEX IF NOT EXISTS ix_starter_marker_batch
  ON "{{TENANT_SCHEMA}}".starter_data_marker (sample_batch_id, removed_at);

-- ---------------------------------------------------------------------------
-- onboarding_progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".onboarding_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_step   INTEGER NOT NULL DEFAULT 1,
  completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  step_payloads  JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER NOT NULL DEFAULT 1
);
