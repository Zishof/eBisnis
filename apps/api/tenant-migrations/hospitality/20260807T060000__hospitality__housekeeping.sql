-- MI-13 Housekeeping, linen/laundry, minibar, dan lost-and-found.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_room_operation_state (
  room_id UUID PRIMARY KEY REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  condition VARCHAR(16) NOT NULL DEFAULT 'DIRTY', dnd BOOLEAN NOT NULL DEFAULT FALSE,
  service_refused BOOLEAN NOT NULL DEFAULT FALSE, discrepancy_note TEXT, inspected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID, version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_room_condition CHECK (condition IN ('DIRTY','CLEANING','CLEAN','INSPECTED'))
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_housekeeping_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,
  stay_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest_stay(id) ON DELETE RESTRICT,
  task_kind VARCHAR(16) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'ASSIGNED', priority VARCHAR(8) NOT NULL DEFAULT 'NORMAL',
  assigned_to UUID, shift_code VARCHAR(32), due_at TIMESTAMPTZ, workload_points INTEGER NOT NULL DEFAULT 3,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, closed_at TIMESTAMPTZ,
  idempotency_key VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID, version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_hk_task_kind CHECK (task_kind IN ('CHECKOUT','STAYOVER','TURNDOWN','DEEP_CLEAN','INSPECTION','OTHER')),
  CONSTRAINT ck_hospitality_hk_task_status CHECK (status IN ('ASSIGNED','IN_PROGRESS','PAUSED','COMPLETED','INSPECTION_REQUIRED','INSPECTED','CLOSED','REFUSED')),
  CONSTRAINT ck_hospitality_hk_priority CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_hk_task_key ON "{{TENANT_SCHEMA}}".hospitality_housekeeping_task(idempotency_key);
CREATE INDEX IF NOT EXISTS ix_hospitality_hk_task_board ON "{{TENANT_SCHEMA}}".hospitality_housekeeping_task(property_id,status,due_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_housekeeping_task_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), task_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_housekeeping_task(id) ON DELETE RESTRICT,
  client_operation_id VARCHAR(128) NOT NULL, action VARCHAR(24) NOT NULL, from_status VARCHAR(24), to_status VARCHAR(24) NOT NULL,
  note TEXT, supplies JSONB NOT NULL DEFAULT '[]'::jsonb, linen JSONB NOT NULL DEFAULT '[]'::jsonb,
  minibar JSONB NOT NULL DEFAULT '[]'::jsonb, photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(), actor_id UUID NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_hk_event_offline ON "{{TENANT_SCHEMA}}".hospitality_housekeeping_task_event(client_operation_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_housekeeping_inspection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), task_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_housekeeping_task(id) ON DELETE RESTRICT,
  passed BOOLEAN NOT NULL, checklist_result JSONB NOT NULL DEFAULT '[]'::jsonb, note TEXT,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(), inspected_by UUID NOT NULL, client_operation_id VARCHAR(128) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_linen_transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  item_code VARCHAR(64) NOT NULL, movement VARCHAR(16) NOT NULL, quantity NUMERIC(14,3) NOT NULL,
  from_location VARCHAR(120), to_location VARCHAR(120), vendor_name VARCHAR(160), expected_quantity NUMERIC(14,3),
  discrepancy_quantity NUMERIC(14,3), unit_cost NUMERIC(14,2), reason TEXT, occurred_at TIMESTAMPTZ NOT NULL,
  client_operation_id VARCHAR(128) NOT NULL UNIQUE, created_by UUID NOT NULL,
  CONSTRAINT ck_hospitality_linen_movement CHECK (movement IN ('ISSUE','RETURN','DIRTY','CLEAN','DAMAGED','MISSING','VENDOR_OUT','VENDOR_IN','WRITE_OFF')),
  CONSTRAINT ck_hospitality_linen_quantity CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_minibar_posting_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), task_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_housekeeping_task(id) ON DELETE RESTRICT,
  stay_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest_stay(id) ON DELETE RESTRICT,
  items JSONB NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'PENDING', idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), processed_at TIMESTAMPTZ, error_code VARCHAR(64),
  CONSTRAINT ck_hospitality_minibar_outbox_status CHECK (status IN ('PENDING','POSTED','FAILED','REVERSED'))
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_lost_found_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT, category VARCHAR(64) NOT NULL,
  description TEXT NOT NULL, found_location VARCHAR(160) NOT NULL, found_at TIMESTAMPTZ NOT NULL, found_by UUID NOT NULL,
  secure_storage VARCHAR(160) NOT NULL, photos JSONB NOT NULL DEFAULT '[]'::jsonb, status VARCHAR(20) NOT NULL DEFAULT 'STORED',
  claimant_verification TEXT, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_lost_found_status CHECK (status IN ('STORED','CLAIM_VERIFIED','RELEASED','SHIPPED','EXPIRED','DISPOSED'))
);
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_lost_found_custody (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), item_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_lost_found_item(id) ON DELETE RESTRICT,
  action VARCHAR(24) NOT NULL, from_location VARCHAR(160), to_location VARCHAR(160), recipient_name VARCHAR(160),
  verification_note TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), actor_id UUID NOT NULL, client_operation_id VARCHAR(128) NOT NULL UNIQUE
);

