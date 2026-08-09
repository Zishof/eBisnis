-- MI-11 Channel Manager: canonical provider-neutral queue and reconciliation.
-- Tidak ada endpoint/credential provider live di migration ini.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_channel_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL,
  provider_key VARCHAR(80) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  channel_type VARCHAR(32) NOT NULL,
  adapter_version VARCHAR(40) NOT NULL DEFAULT 'canonical-v1',
  status VARCHAR(32) NOT NULL DEFAULT 'BLOCKED_PROVIDER_INPUT',
  provider_account_id UUID,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_channel_type CHECK (channel_type IN ('OTA','WHOLESALER','GDS','METASEARCH','TRAVEL_AGENT','AFFILIATE')),
  CONSTRAINT ck_hospitality_channel_status CHECK (status IN ('BLOCKED_PROVIDER_INPUT','TEST_READY','ACTIVE','DEGRADED','DISABLED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_channel_account_code
  ON "{{TENANT_SCHEMA}}".hospitality_channel_account(property_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_channel_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_account_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_channel_account(id) ON DELETE CASCADE,
  resource_type VARCHAR(24) NOT NULL,
  local_id UUID NOT NULL,
  provider_code VARCHAR(160) NOT NULL,
  provider_parent_code VARCHAR(160),
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_channel_mapping_type CHECK (resource_type IN ('PROPERTY','ROOM_TYPE','RATE_PLAN')),
  CONSTRAINT ck_hospitality_channel_mapping_status CHECK (status IN ('ACTIVE','INACTIVE')),
  UNIQUE(channel_account_id, resource_type, local_id),
  UNIQUE(channel_account_id, resource_type, provider_code)
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_distribution_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  channel_account_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_channel_account(id) ON DELETE RESTRICT,
  job_type VARCHAR(32) NOT NULL,
  source_version VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  correlation_id VARCHAR(120) NOT NULL,
  payload_sanitized JSONB NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retry INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ,
  provider_message_id VARCHAR(200),
  acknowledged_at TIMESTAMPTZ,
  error_code VARCHAR(80),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_hospitality_distribution_job_type CHECK (job_type IN ('ARI_PUSH','ARI_PULL','RESERVATION_CREATE','RESERVATION_MODIFY','RESERVATION_CANCEL')),
  CONSTRAINT ck_hospitality_distribution_job_status CHECK (status IN ('PENDING','PROCESSING','ACKNOWLEDGED','RETRY','DEAD_LETTER')),
  CONSTRAINT ck_hospitality_distribution_retry CHECK (retry_count >= 0 AND max_retry >= 0),
  UNIQUE(channel_account_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS ix_hospitality_distribution_job_queue
  ON "{{TENANT_SCHEMA}}".hospitality_distribution_job(status, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_channel_reconciliation_exception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  channel_account_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_channel_account(id) ON DELETE RESTRICT,
  distribution_job_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_distribution_job(id) ON DELETE SET NULL,
  exception_type VARCHAR(48) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'ERROR',
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  summary TEXT NOT NULL,
  canonical_snapshot JSONB,
  provider_snapshot_sanitized JSONB,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_hospitality_channel_exception_type CHECK (exception_type IN ('UNMAPPED_ROOM_RATE','INVALID_OCCUPANCY','RATE_MISMATCH','UNKNOWN_TAX_FEE','PAYMENT_ISSUE','MODIFICATION_OUT_OF_ORDER','DUPLICATE_RESERVATION','CANCEL_CONFLICT','NEGATIVE_AVAILABILITY','PROVIDER_TIMEOUT','WEBHOOK_SIGNATURE_FAILURE','DELIVERY_FAILED')),
  CONSTRAINT ck_hospitality_channel_exception_status CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED','IGNORED')),
  CONSTRAINT ck_hospitality_channel_exception_severity CHECK (severity IN ('WARNING','ERROR','CRITICAL'))
);
CREATE INDEX IF NOT EXISTS ix_hospitality_channel_exception_open
  ON "{{TENANT_SCHEMA}}".hospitality_channel_reconciliation_exception(property_id, status, created_at DESC);
