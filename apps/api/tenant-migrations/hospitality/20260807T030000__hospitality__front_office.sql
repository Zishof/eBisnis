-- MI-12 Front Office. Lifecycle operasional dipisah dari lifecycle booking.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_guest_stay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_reservation(id) ON DELETE RESTRICT,
  room_stay_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_reservation_room_stay(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  guest_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'PRE_ARRIVAL',
  eta TIMESTAMPTZ, transport_note TEXT, pre_arrival_note TEXT, special_request_note TEXT,
  identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  guarantee_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  registration_card_signed BOOLEAN NOT NULL DEFAULT FALSE,
  digital_key_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  actual_checkin_at TIMESTAMPTZ, actual_checkout_at TIMESTAMPTZ,
  late_checkout_until TIMESTAMPTZ, forwarding_preference TEXT,
  checkin_idempotency_key VARCHAR(128), checkout_idempotency_key VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID, version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_hospitality_guest_stay_status CHECK (status IN ('PRE_ARRIVAL','ASSIGNED','IN_HOUSE','CHECKED_OUT','WALKED')),
  CONSTRAINT ck_hospitality_guest_stay_times CHECK (actual_checkout_at IS NULL OR actual_checkin_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_guest_stay_room_stay ON "{{TENANT_SCHEMA}}".hospitality_guest_stay(room_stay_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_guest_stay_checkin_key ON "{{TENANT_SCHEMA}}".hospitality_guest_stay(checkin_idempotency_key) WHERE checkin_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_guest_stay_checkout_key ON "{{TENANT_SCHEMA}}".hospitality_guest_stay(checkout_idempotency_key) WHERE checkout_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_guest_stay_active_room ON "{{TENANT_SCHEMA}}".hospitality_guest_stay(room_id) WHERE status = 'IN_HOUSE';
CREATE INDEX IF NOT EXISTS ix_hospitality_guest_stay_board ON "{{TENANT_SCHEMA}}".hospitality_guest_stay(property_id,status,updated_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_key_issuance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stay_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest_stay(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,
  key_type VARCHAR(12) NOT NULL, provider_key VARCHAR(64), external_reference VARCHAR(160),
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE', issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, idempotency_key VARCHAR(128) NOT NULL,
  created_by UUID, metadata JSONB,
  CONSTRAINT ck_hospitality_key_type CHECK (key_type IN ('PHYSICAL','DIGITAL')),
  CONSTRAINT ck_hospitality_key_status CHECK (status IN ('ACTIVE','REVOKED','FAILED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_key_idempotency ON "{{TENANT_SCHEMA}}".hospitality_key_issuance(idempotency_key);
CREATE INDEX IF NOT EXISTS ix_hospitality_key_active ON "{{TENANT_SCHEMA}}".hospitality_key_issuance(stay_id,status);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_room_move (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stay_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest_stay(id) ON DELETE RESTRICT,
  from_room_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,
  to_room_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL, moved_at TIMESTAMPTZ NOT NULL DEFAULT now(), moved_by UUID NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL, metadata JSONB,
  CONSTRAINT ck_hospitality_room_move_distinct CHECK (from_room_id <> to_room_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_room_move_key ON "{{TENANT_SCHEMA}}".hospitality_room_move(idempotency_key);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_frontdesk_exception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  stay_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest_stay(id) ON DELETE RESTRICT,
  kind VARCHAR(24) NOT NULL, reason TEXT NOT NULL, resolution TEXT, status VARCHAR(12) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID NOT NULL, resolved_at TIMESTAMPTZ, resolved_by UUID,
  CONSTRAINT ck_hospitality_frontdesk_exception_kind CHECK (kind IN ('WALK','OVERBOOKING','ROOM_NOT_READY','CREDIT','OTHER')),
  CONSTRAINT ck_hospitality_frontdesk_exception_status CHECK (status IN ('OPEN','RESOLVED'))
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_frontdesk_handover (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
  shift_code VARCHAR(32) NOT NULL, notes TEXT NOT NULL, unresolved_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  handed_over_at TIMESTAMPTZ NOT NULL DEFAULT now(), handed_over_by UUID NOT NULL,
  accepted_at TIMESTAMPTZ, accepted_by UUID, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_hospitality_frontdesk_handover ON "{{TENANT_SCHEMA}}".hospitality_frontdesk_handover(property_id,handed_over_at DESC);

