-- =========================================================================
-- V007 — WORKFLOW, NOTIFIKASI, INTEGRASI, SYNC, REPORTING
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".workflow_definition (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  module_code     VARCHAR(48),
  entity_type     VARCHAR(96) NOT NULL,
  definition_version INTEGER NOT NULL DEFAULT 1,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_workflow_definition_code ON "{{TENANT_SCHEMA}}".workflow_definition (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_workflow_definition_sample ON "{{TENANT_SCHEMA}}".workflow_definition (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".workflow_step (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".workflow_definition (id) ON DELETE CASCADE,
  code          VARCHAR(64) NOT NULL,
  name_key      VARCHAR(160) NOT NULL,
  sequence      INTEGER NOT NULL DEFAULT 1,
  step_type     VARCHAR(24) NOT NULL DEFAULT 'APPROVAL',
  assignee_rule JSONB,
  sla_hours     INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_workflow_step ON "{{TENANT_SCHEMA}}".workflow_step (workflow_id, code);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".workflow_instance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".workflow_definition (id) ON DELETE RESTRICT,
  entity_type    VARCHAR(96) NOT NULL,
  entity_id      UUID NOT NULL,
  current_step_id UUID REFERENCES "{{TENANT_SCHEMA}}".workflow_step (id) ON DELETE SET NULL,
  status         VARCHAR(24) NOT NULL DEFAULT 'RUNNING',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,
  version        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_workflow_instance_entity ON "{{TENANT_SCHEMA}}".workflow_instance (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_workflow_instance_status ON "{{TENANT_SCHEMA}}".workflow_instance (status, started_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".workflow_action_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".workflow_instance (id) ON DELETE CASCADE,
  step_id     UUID REFERENCES "{{TENANT_SCHEMA}}".workflow_step (id) ON DELETE SET NULL,
  action      VARCHAR(32) NOT NULL,
  actor_id    UUID,
  comment     TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_workflow_action_instance ON "{{TENANT_SCHEMA}}".workflow_action_log (instance_id, occurred_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".notification_template (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  channel         VARCHAR(24) NOT NULL DEFAULT 'IN_APP',
  subject_template TEXT,
  body_template   TEXT NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_notification_template_code ON "{{TENANT_SCHEMA}}".notification_template (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_notification_template_sample ON "{{TENANT_SCHEMA}}".notification_template (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".notification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID REFERENCES "{{TENANT_SCHEMA}}".notification_template (id) ON DELETE SET NULL,
  recipient_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  channel         VARCHAR(24) NOT NULL DEFAULT 'IN_APP',
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  payload         JSONB,
  entity_type     VARCHAR(96),
  entity_id       UUID,
  severity        VARCHAR(16) NOT NULL DEFAULT 'INFO',
  read_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  status          VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notification_recipient ON "{{TENANT_SCHEMA}}".notification (recipient_subject_id, read_at, created_at);
CREATE INDEX IF NOT EXISTS ix_notification_entity ON "{{TENANT_SCHEMA}}".notification (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".saved_view (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  resource_code   VARCHAR(64) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  definition      JSONB NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_saved_view ON "{{TENANT_SCHEMA}}".saved_view (user_subject_id, resource_code, name);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".sync_outbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      VARCHAR(96) NOT NULL,
  entity_type   VARCHAR(96) NOT NULL,
  entity_id     UUID,
  operation     VARCHAR(16) NOT NULL,
  payload       JSONB NOT NULL,
  sequence_no   BIGSERIAL,
  status        VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sync_outbox_event ON "{{TENANT_SCHEMA}}".sync_outbox (event_id);
CREATE INDEX IF NOT EXISTS ix_sync_outbox_status ON "{{TENANT_SCHEMA}}".sync_outbox (status, sequence_no);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".sync_inbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      VARCHAR(96) NOT NULL,
  device_id     UUID,
  sequence_no   BIGINT,
  checksum      VARCHAR(64),
  status        VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  result        JSONB,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sync_inbox_event ON "{{TENANT_SCHEMA}}".sync_inbox (event_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".job_execution (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_code     VARCHAR(64) NOT NULL,
  status       VARCHAR(24) NOT NULL DEFAULT 'RUNNING',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  result       JSONB,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS ix_job_execution ON "{{TENANT_SCHEMA}}".job_execution (job_code, started_at);
