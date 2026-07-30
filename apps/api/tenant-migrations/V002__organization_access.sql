-- =========================================================================
-- V002 — ORGANISASI, WILAYAH, DAN HAK AKSES TENANT
-- =========================================================================

-- ---------------------------------------------------------------------------
-- address
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".address (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  address_line1   VARCHAR(255) NOT NULL DEFAULT '',
  address_line2   VARCHAR(255),
  district        VARCHAR(100),
  city_regency    VARCHAR(100),
  province        VARCHAR(100),
  postal_code     VARCHAR(20),
  country         VARCHAR(100) NOT NULL DEFAULT 'Indonesia',
  latitude        NUMERIC(12,8),
  longitude       NUMERIC(12,8),
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_address_code ON "{{TENANT_SCHEMA}}".address (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_address_active ON "{{TENANT_SCHEMA}}".address (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_address_sample ON "{{TENANT_SCHEMA}}".address (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- business_group (tree)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".business_group (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID REFERENCES "{{TENANT_SCHEMA}}".business_group (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  path            VARCHAR(512) NOT NULL DEFAULT '',
  level           INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_business_group_code ON "{{TENANT_SCHEMA}}".business_group (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_business_group_parent ON "{{TENANT_SCHEMA}}".business_group (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_business_group_active ON "{{TENANT_SCHEMA}}".business_group (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_business_group_sample ON "{{TENANT_SCHEMA}}".business_group (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- legal_entity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".legal_entity (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_group_id    UUID REFERENCES "{{TENANT_SCHEMA}}".business_group (id) ON DELETE RESTRICT,
  code                 VARCHAR(64) NOT NULL,
  name                 VARCHAR(160) NOT NULL,
  description          TEXT,
  legal_name           VARCHAR(255) NOT NULL,
  trade_name           VARCHAR(255),
  legal_form           VARCHAR(64),
  tax_number           VARCHAR(64),
  registration_number  VARCHAR(64),
  address_id           UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE RESTRICT,
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
  currency_code        VARCHAR(8) NOT NULL DEFAULT 'IDR',
  timezone             VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  is_system            BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample            BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id      UUID,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by           UUID,
  deactivated_at       TIMESTAMPTZ,
  deactivated_by       UUID,
  deleted_at           TIMESTAMPTZ,
  deleted_by           UUID,
  delete_reason        TEXT,
  version              INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legal_entity_code ON "{{TENANT_SCHEMA}}".legal_entity (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_legal_entity_active ON "{{TENANT_SCHEMA}}".legal_entity (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_legal_entity_sample ON "{{TENANT_SCHEMA}}".legal_entity (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- brand
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".brand (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  logo_file_id    UUID REFERENCES "{{TENANT_SCHEMA}}".file_object (id) ON DELETE SET NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_brand_code ON "{{TENANT_SCHEMA}}".brand (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_brand_entity ON "{{TENANT_SCHEMA}}".brand (legal_entity_id);
CREATE INDEX IF NOT EXISTS ix_brand_active ON "{{TENANT_SCHEMA}}".brand (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_brand_sample ON "{{TENANT_SCHEMA}}".brand (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- region (tree)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".region (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID REFERENCES "{{TENANT_SCHEMA}}".region (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  region_type     VARCHAR(32) NOT NULL DEFAULT 'AREA',
  path            VARCHAR(512) NOT NULL DEFAULT '',
  level           INTEGER NOT NULL DEFAULT 0,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_region_code ON "{{TENANT_SCHEMA}}".region (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_region_parent ON "{{TENANT_SCHEMA}}".region (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_region_active ON "{{TENANT_SCHEMA}}".region (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_region_sample ON "{{TENANT_SCHEMA}}".region (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- outlet_type (master, wajib >= 10 record)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".outlet_type (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  name_key        VARCHAR(160) NOT NULL DEFAULT '',
  category        VARCHAR(48) NOT NULL DEFAULT 'RETAIL',
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_outlet_type_code ON "{{TENANT_SCHEMA}}".outlet_type (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_outlet_type_active ON "{{TENANT_SCHEMA}}".outlet_type (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_outlet_type_sample ON "{{TENANT_SCHEMA}}".outlet_type (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- department (tree, master >= 10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".department (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  parent_id       UUID REFERENCES "{{TENANT_SCHEMA}}".department (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  cost_center     VARCHAR(48),
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_department_code ON "{{TENANT_SCHEMA}}".department (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_department_active ON "{{TENANT_SCHEMA}}".department (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_department_sample ON "{{TENANT_SCHEMA}}".department (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- job_position (master >= 10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".job_position (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  department_id   UUID REFERENCES "{{TENANT_SCHEMA}}".department (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  grade_level     INTEGER NOT NULL DEFAULT 1,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_job_position_code ON "{{TENANT_SCHEMA}}".job_position (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_job_position_active ON "{{TENANT_SCHEMA}}".job_position (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_job_position_sample ON "{{TENANT_SCHEMA}}".job_position (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- outlet
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".outlet (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  brand_id        UUID REFERENCES "{{TENANT_SCHEMA}}".brand (id) ON DELETE RESTRICT,
  region_id       UUID REFERENCES "{{TENANT_SCHEMA}}".region (id) ON DELETE RESTRICT,
  outlet_type_id  UUID REFERENCES "{{TENANT_SCHEMA}}".outlet_type (id) ON DELETE RESTRICT,
  address_id      UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  phone           VARCHAR(50),
  email           VARCHAR(160),
  timezone        VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
  opening_date    DATE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_outlet_code ON "{{TENANT_SCHEMA}}".outlet (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_outlet_entity ON "{{TENANT_SCHEMA}}".outlet (legal_entity_id, brand_id);
CREATE INDEX IF NOT EXISTS ix_outlet_region ON "{{TENANT_SCHEMA}}".outlet (region_id);
CREATE INDEX IF NOT EXISTS ix_outlet_active ON "{{TENANT_SCHEMA}}".outlet (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_outlet_sample ON "{{TENANT_SCHEMA}}".outlet (is_sample, sample_batch_id);

-- ---------------------------------------------------------------------------
-- user_subject — proyeksi PlatformUser pada tenant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".user_subject (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id  UUID NOT NULL,
  code              VARCHAR(64) NOT NULL,
  name              VARCHAR(160) NOT NULL,
  description       TEXT,
  username_snapshot VARCHAR(64) NOT NULL,
  email_snapshot    VARCHAR(255),
  is_owner          BOOLEAN NOT NULL DEFAULT FALSE,
  status            VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  last_login_at     TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_system         BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deactivated_at    TIMESTAMPTZ,
  deactivated_by    UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_subject_platform ON "{{TENANT_SCHEMA}}".user_subject (platform_user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_subject_code ON "{{TENANT_SCHEMA}}".user_subject (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_user_subject_active ON "{{TENANT_SCHEMA}}".user_subject (is_active, deleted_at);

-- ---------------------------------------------------------------------------
-- role, permission_action, menu, menu_action, role_menu_permission, role_scope
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".role (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  role_type       VARCHAR(32) NOT NULL DEFAULT 'CUSTOM',
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_role_code ON "{{TENANT_SCHEMA}}".role (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_role_active ON "{{TENANT_SCHEMA}}".role (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_role_sample ON "{{TENANT_SCHEMA}}".role (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".permission_action (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  name_key        VARCHAR(160) NOT NULL DEFAULT '',
  action_type     VARCHAR(24) NOT NULL DEFAULT 'STANDARD',
  requires_step_up BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_permission_action_code ON "{{TENANT_SCHEMA}}".permission_action (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_permission_action_sample ON "{{TENANT_SCHEMA}}".permission_action (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".menu (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID REFERENCES "{{TENANT_SCHEMA}}".menu (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  translation_key VARCHAR(160) NOT NULL,
  route           VARCHAR(160),
  icon            VARCHAR(64),
  module_code     VARCHAR(48),
  platform_target VARCHAR(24) NOT NULL DEFAULT 'WEB',
  path            VARCHAR(512) NOT NULL DEFAULT '',
  level           INTEGER NOT NULL DEFAULT 0,
  is_coming_soon  BOOLEAN NOT NULL DEFAULT FALSE,
  requires_entitlement BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_menu_code ON "{{TENANT_SCHEMA}}".menu (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_menu_parent ON "{{TENANT_SCHEMA}}".menu (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_menu_active ON "{{TENANT_SCHEMA}}".menu (is_active, deleted_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".menu_action (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".menu (id) ON DELETE CASCADE,
  permission_action_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".permission_action (id) ON DELETE RESTRICT,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  version              INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_menu_action ON "{{TENANT_SCHEMA}}".menu_action (menu_id, permission_action_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".role_menu_permission (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".role (id) ON DELETE CASCADE,
  menu_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".menu (id) ON DELETE CASCADE,
  permission_action_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".permission_action (id) ON DELETE RESTRICT,
  effect               VARCHAR(16) NOT NULL DEFAULT 'ALLOW',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by           UUID,
  version              INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_role_menu_permission
  ON "{{TENANT_SCHEMA}}".role_menu_permission (role_id, menu_id, permission_action_id);
CREATE INDEX IF NOT EXISTS ix_role_menu_permission_role ON "{{TENANT_SCHEMA}}".role_menu_permission (role_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".role_scope (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".role (id) ON DELETE CASCADE,
  scope_type  VARCHAR(32) NOT NULL,
  scope_id    UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version     INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_role_scope
  ON "{{TENANT_SCHEMA}}".role_scope (role_id, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".user_role_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".role (id) ON DELETE RESTRICT,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_role_assignment
  ON "{{TENANT_SCHEMA}}".user_role_assignment (user_subject_id, role_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".user_direct_permission (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  menu_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".menu (id) ON DELETE CASCADE,
  permission_action_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".permission_action (id) ON DELETE RESTRICT,
  effect               VARCHAR(16) NOT NULL DEFAULT 'ALLOW',
  reason               TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  version              INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_direct_permission
  ON "{{TENANT_SCHEMA}}".user_direct_permission (user_subject_id, menu_id, permission_action_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".data_export_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  resource_code   VARCHAR(64) NOT NULL,
  filter_snapshot JSONB,
  row_count       INTEGER NOT NULL DEFAULT 0,
  format          VARCHAR(16) NOT NULL DEFAULT 'CSV',
  exported_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_data_export_log_time ON "{{TENANT_SCHEMA}}".data_export_log (exported_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".step_up_challenge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  purpose         VARCHAR(48) NOT NULL,
  challenge_hash  VARCHAR(128) NOT NULL,
  target_type     VARCHAR(64),
  target_id       VARCHAR(64),
  reason          TEXT,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  verified_at     TIMESTAMPTZ,
  consumed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_step_up_user ON "{{TENANT_SCHEMA}}".step_up_challenge (user_subject_id, purpose, expires_at);

-- ---------------------------------------------------------------------------
-- party / person / owner / investor / management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".party (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type      VARCHAR(24) NOT NULL DEFAULT 'PERSON',
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  tax_number      VARCHAR(64),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  address_id      UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE RESTRICT,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_party_code ON "{{TENANT_SCHEMA}}".party (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_party_active ON "{{TENANT_SCHEMA}}".party (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_party_sample ON "{{TENANT_SCHEMA}}".party (is_sample, sample_batch_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".owner_profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".party (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  bank_account    VARCHAR(64),
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_owner_profile_code ON "{{TENANT_SCHEMA}}".owner_profile (code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".investor_profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".party (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  investor_number VARCHAR(48),
  bank_account    VARCHAR(64),
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_investor_profile_code ON "{{TENANT_SCHEMA}}".investor_profile (code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".ownership_interest (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".party (id) ON DELETE RESTRICT,
  target_type     VARCHAR(32) NOT NULL,
  target_id       UUID NOT NULL,
  percentage      NUMERIC(9,4) NOT NULL DEFAULT 0,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_ownership_target ON "{{TENANT_SCHEMA}}".ownership_interest (target_type, target_id);
