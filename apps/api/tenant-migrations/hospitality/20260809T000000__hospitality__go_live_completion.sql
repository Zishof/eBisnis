-- MitraInap v14 — additive completion for MI-2/3/5..11.
-- The tables below deliberately keep provider credentials and TLS private keys out
-- of tenant storage. External integrations reference provider-side secret aliases.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(24) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(240) NOT NULL,
  summary TEXT,
  body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  published_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_hospitality_site_content_type CHECK (content_type IN ('PAGE','ARTICLE','GALLERY','MENU','FAQ')),
  CONSTRAINT ck_hospitality_site_content_status CHECK (status IN ('DRAFT','REVIEW','PUBLISHED','ARCHIVED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_site_content_slug
  ON "{{TENANT_SCHEMA}}".hospitality_site_content(content_type, slug) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_legal_entity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(32) NOT NULL, name VARCHAR(160) NOT NULL,
  registration_number VARCHAR(80), tax_number VARCHAR(80), address TEXT, status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_legal_entity_code ON "{{TENANT_SCHEMA}}".hospitality_legal_entity(code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_legal_entity(id) ON DELETE RESTRICT,
  code VARCHAR(32) NOT NULL, name VARCHAR(160) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_portfolio_code ON "{{TENANT_SCHEMA}}".hospitality_portfolio(code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_brand (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_portfolio(id) ON DELETE RESTRICT,
  code VARCHAR(32) NOT NULL, name VARCHAR(160) NOT NULL, theme_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_brand_code ON "{{TENANT_SCHEMA}}".hospitality_brand(code) WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_property ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_portfolio(id) ON DELETE RESTRICT;
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_property ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_brand(id) ON DELETE RESTRICT;
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_property ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_legal_entity(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_building (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  code VARCHAR(32) NOT NULL, name VARCHAR(120) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_building_code ON "{{TENANT_SCHEMA}}".hospitality_building(property_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_floor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), building_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_building(id) ON DELETE RESTRICT,
  code VARCHAR(32) NOT NULL, name VARCHAR(120) NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_floor_code ON "{{TENANT_SCHEMA}}".hospitality_floor(building_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_zone (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  building_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_building(id) ON DELETE RESTRICT,
  floor_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_floor(id) ON DELETE RESTRICT,
  code VARCHAR(32) NOT NULL, name VARCHAR(120) NOT NULL, zone_type VARCHAR(32) NOT NULL DEFAULT 'GUEST_ROOM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_zone_code ON "{{TENANT_SCHEMA}}".hospitality_zone(property_id, code) WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_building(id) ON DELETE RESTRICT;
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room ADD COLUMN IF NOT EXISTS floor_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_floor(id) ON DELETE RESTRICT;
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_zone(id) ON DELETE RESTRICT;
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room ADD COLUMN IF NOT EXISTS accessibility_features JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_sellable_space (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,
  parent_space_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_sellable_space(id) ON DELETE RESTRICT,
  code VARCHAR(48) NOT NULL, name VARCHAR(120) NOT NULL, space_type VARCHAR(24) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1, status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE', features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_sellable_space_type CHECK (space_type IN ('ROOM','UNIT','BED','SPACE')),
  CONSTRAINT ck_hospitality_sellable_space_status CHECK (status IN ('AVAILABLE','OCCUPIED','DIRTY','CLEANING','INSPECTION','BLOCKED','OUT_OF_ORDER','OUT_OF_SERVICE'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_sellable_space_code ON "{{TENANT_SCHEMA}}".hospitality_sellable_space(property_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_active_context (
  user_id UUID PRIMARY KEY, property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE CASCADE,
  role_code VARCHAR(80) NOT NULL, business_date DATE NOT NULL, timezone VARCHAR(64) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  room_type_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room_type(id) ON DELETE RESTRICT,
  stay_date DATE NOT NULL, physical_capacity INTEGER NOT NULL, out_of_inventory INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0, held INTEGER NOT NULL DEFAULT 0, allotted INTEGER NOT NULL DEFAULT 0,
  overbooking_limit INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, reconciled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID,
  CONSTRAINT ck_hospitality_inventory_ledger_nonnegative CHECK (physical_capacity >= 0 AND out_of_inventory >= 0 AND sold >= 0 AND held >= 0 AND allotted >= 0 AND overbooking_limit >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_inventory_ledger ON "{{TENANT_SCHEMA}}".hospitality_inventory_ledger(room_type_id, stay_date);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_allotment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  room_type_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room_type(id) ON DELETE RESTRICT,
  business_account_id UUID, code VARCHAR(48) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
  quantity INTEGER NOT NULL, pickup INTEGER NOT NULL DEFAULT 0, release_days INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID, version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_allotment_dates CHECK (end_date > start_date),
  CONSTRAINT ck_hospitality_allotment_qty CHECK (quantity > 0 AND pickup >= 0 AND pickup <= quantity)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_allotment_code ON "{{TENANT_SCHEMA}}".hospitality_allotment(property_id, code);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_guest_relationship (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), guest_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest(id) ON DELETE RESTRICT,
  related_guest_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest(id) ON DELETE RESTRICT,
  relationship_type VARCHAR(32) NOT NULL, is_companion BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID,
  CONSTRAINT ck_hospitality_guest_relationship_self CHECK (guest_id <> related_guest_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_guest_relationship ON "{{TENANT_SCHEMA}}".hospitality_guest_relationship(guest_id, related_guest_id, relationship_type);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_guest_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), guest_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest(id) ON DELETE RESTRICT,
  program_code VARCHAR(48) NOT NULL, member_number VARCHAR(80) NOT NULL, tier_code VARCHAR(48), points_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', joined_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_guest_loyalty_member ON "{{TENANT_SCHEMA}}".hospitality_guest_loyalty(program_code, member_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_availability_quote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  quote_number VARCHAR(48) NOT NULL, checkin_date DATE NOT NULL, checkout_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'IDR', total_amount NUMERIC(18,2) NOT NULL,
  price_snapshot JSONB NOT NULL, restriction_snapshot JSONB NOT NULL, availability_snapshot JSONB NOT NULL,
  guest_json JSONB NOT NULL DEFAULT '{}'::jsonb, status VARCHAR(16) NOT NULL DEFAULT 'OPEN', expires_at TIMESTAMPTZ NOT NULL,
  reservation_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_reservation(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_quote_dates CHECK (checkout_date > checkin_date),
  CONSTRAINT ck_hospitality_quote_status CHECK (status IN ('OPEN','ACCEPTED','EXPIRED','CANCELLED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_quote_number ON "{{TENANT_SCHEMA}}".hospitality_availability_quote(quote_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  room_type_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_room_type(id) ON DELETE RESTRICT,
  guest_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest(id) ON DELETE RESTRICT,
  checkin_date DATE NOT NULL, checkout_date DATE NOT NULL, adults INTEGER NOT NULL DEFAULT 1, children INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100, status VARCHAR(16) NOT NULL DEFAULT 'WAITING', contact_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  offered_at TIMESTAMPTZ, offer_expires_at TIMESTAMPTZ, reservation_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_reservation(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID, version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_waitlist_dates CHECK (checkout_date > checkin_date),
  CONSTRAINT ck_hospitality_waitlist_status CHECK (status IN ('WAITING','OFFERED','CONVERTED','EXPIRED','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS ix_hospitality_waitlist_queue ON "{{TENANT_SCHEMA}}".hospitality_waitlist(property_id, status, priority, created_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_booking_payment_intent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  reservation_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_reservation(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(160) NOT NULL, request_hash VARCHAR(64) NOT NULL, provider_key VARCHAR(80) NOT NULL, provider_secret_alias VARCHAR(160),
  amount NUMERIC(18,2) NOT NULL, currency VARCHAR(3) NOT NULL DEFAULT 'IDR', status VARCHAR(24) NOT NULL DEFAULT 'CREATED',
  provider_reference VARCHAR(160), client_token_reference VARCHAR(240), failure_code VARCHAR(80), expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_booking_payment_status CHECK (status IN ('CREATED','PENDING','AUTHORIZED','CAPTURED','FAILED','CANCELLED','EXPIRED','BLOCKED_PROVIDER_INPUT'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_booking_payment_idempotency ON "{{TENANT_SCHEMA}}".hospitality_booking_payment_intent(property_id, idempotency_key);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_booking_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  recovery_token_hash VARCHAR(64) NOT NULL, booking_state JSONB NOT NULL, consented BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN', expires_at TIMESTAMPTZ NOT NULL, recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_booking_recovery_token ON "{{TENANT_SCHEMA}}".hospitality_booking_recovery(recovery_token_hash);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_revenue_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  stay_date DATE NOT NULL, room_type_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_room_type(id) ON DELETE RESTRICT,
  on_books INTEGER NOT NULL DEFAULT 0, pickup_7d INTEGER NOT NULL DEFAULT 0, pickup_30d INTEGER NOT NULL DEFAULT 0,
  forecast_rooms NUMERIC(12,2) NOT NULL DEFAULT 0, forecast_revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  model_version VARCHAR(48) NOT NULL, evidence_json JSONB NOT NULL, generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_revenue_forecast ON "{{TENANT_SCHEMA}}".hospitality_revenue_forecast(property_id, room_type_id, stay_date, model_version);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_revenue_recommendation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  rate_plan_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_rate_plan(id) ON DELETE RESTRICT,
  stay_date DATE NOT NULL, current_amount NUMERIC(18,2) NOT NULL, recommended_amount NUMERIC(18,2) NOT NULL,
  reason_json JSONB NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_by UUID, reviewed_at TIMESTAMPTZ, review_note TEXT, published_by UUID, published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_revenue_recommendation_status CHECK (status IN ('PENDING_REVIEW','APPROVED','REJECTED','PUBLISHED','SUPERSEDED'))
);
CREATE INDEX IF NOT EXISTS ix_hospitality_revenue_recommendation_queue ON "{{TENANT_SCHEMA}}".hospitality_revenue_recommendation(property_id, status, stay_date);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_channel_delivery_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), distribution_job_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_distribution_job(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL, adapter_key VARCHAR(80) NOT NULL, status VARCHAR(24) NOT NULL,
  request_hash VARCHAR(64) NOT NULL, provider_http_status INTEGER, response_sanitized JSONB, error_code VARCHAR(80), duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
  CONSTRAINT ck_hospitality_channel_attempt_status CHECK (status IN ('STARTED','ACKNOWLEDGED','RETRY','DEAD_LETTER','BLOCKED_PROVIDER_INPUT'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_channel_attempt ON "{{TENANT_SCHEMA}}".hospitality_channel_delivery_attempt(distribution_job_id, attempt_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_channel_parity_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  channel_account_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_channel_account(id) ON DELETE RESTRICT,
  stay_date DATE NOT NULL, local_hash VARCHAR(64) NOT NULL, provider_hash VARCHAR(64), status VARCHAR(24) NOT NULL,
  difference_json JSONB NOT NULL DEFAULT '{}'::jsonb, checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_hospitality_channel_parity_status CHECK (status IN ('MATCH','MISMATCH','PENDING','BLOCKED_PROVIDER_INPUT'))
);
CREATE INDEX IF NOT EXISTS ix_hospitality_channel_parity ON "{{TENANT_SCHEMA}}".hospitality_channel_parity_snapshot(property_id, status, checked_at DESC);
