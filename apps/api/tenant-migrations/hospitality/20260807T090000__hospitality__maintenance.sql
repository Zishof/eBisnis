-- MI-14 Engineering, shared inventory/procurement links, dan room downtime.
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_block DROP CONSTRAINT ck_hospitality_room_block_source;
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_block ADD CONSTRAINT ck_hospitality_room_block_source CHECK(source IN ('MANUAL','RESERVATION','MAINTENANCE'));

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_asset(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
 room_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,code VARCHAR(64) NOT NULL,name VARCHAR(160) NOT NULL,
 product_id UUID REFERENCES "{{TENANT_SCHEMA}}".product(id) ON DELETE RESTRICT,supplier_id UUID REFERENCES "{{TENANT_SCHEMA}}".supplier(id) ON DELETE RESTRICT,
 serial_number VARCHAR(120),installed_at DATE,meter_value NUMERIC(16,3),status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',metadata JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),created_by UUID,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_by UUID,version INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT ck_hospitality_asset_status CHECK(status IN('ACTIVE','DOWN','RETIRED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_asset_code ON "{{TENANT_SCHEMA}}".hospitality_asset(property_id,code);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_work_order(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
 room_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,asset_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_asset(id) ON DELETE RESTRICT,
 source VARCHAR(24) NOT NULL,title VARCHAR(180) NOT NULL,description TEXT NOT NULL,priority VARCHAR(12) NOT NULL DEFAULT 'NORMAL',status VARCHAR(24) NOT NULL DEFAULT 'NEW',
 assigned_to UUID,supplier_id UUID REFERENCES "{{TENANT_SCHEMA}}".supplier(id) ON DELETE RESTRICT,sla_due_at TIMESTAMPTZ NOT NULL,
 triaged_at TIMESTAMPTZ,started_at TIMESTAMPTZ,completed_at TIMESTAMPTZ,verified_at TIMESTAMPTZ,closed_at TIMESTAMPTZ,
 idempotency_key VARCHAR(128) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),created_by UUID NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_by UUID,version INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT ck_hospitality_wo_source CHECK(source IN('HOUSEKEEPING','GUEST','FRONT_DESK','PREVENTIVE','IOT','ENERGY','INSPECTION','ASSET','SAFETY','OTHER')),
 CONSTRAINT ck_hospitality_wo_priority CHECK(priority IN('LOW','NORMAL','HIGH','CRITICAL')),
 CONSTRAINT ck_hospitality_wo_status CHECK(status IN('NEW','TRIAGED','ASSIGNED','IN_PROGRESS','WAITING_PART','WAITING_VENDOR','READY_FOR_INSPECTION','COMPLETED','VERIFIED','CLOSED','CANCELLED','DUPLICATE','DEFERRED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_wo_key ON "{{TENANT_SCHEMA}}".hospitality_work_order(idempotency_key);
CREATE INDEX IF NOT EXISTS ix_hospitality_wo_board ON "{{TENANT_SCHEMA}}".hospitality_work_order(property_id,status,sla_due_at);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_work_order_event(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),work_order_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_work_order(id) ON DELETE RESTRICT,
 from_status VARCHAR(24),to_status VARCHAR(24) NOT NULL,note TEXT,parts JSONB NOT NULL DEFAULT '[]'::jsonb,photos JSONB NOT NULL DEFAULT '[]'::jsonb,
 client_operation_id VARCHAR(128) NOT NULL UNIQUE,occurred_at TIMESTAMPTZ NOT NULL,actor_id UUID NOT NULL
);
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_inventory_issue_outbox(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),work_order_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_work_order(id) ON DELETE RESTRICT,
 product_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product(id) ON DELETE RESTRICT,quantity NUMERIC(14,3) NOT NULL,warehouse_id UUID,
 status VARCHAR(12) NOT NULL DEFAULT 'PENDING',idempotency_key VARCHAR(128) NOT NULL UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),processed_at TIMESTAMPTZ,
 CONSTRAINT ck_hospitality_inventory_issue_status CHECK(status IN('PENDING','POSTED','FAILED','REVERSED')),CONSTRAINT ck_hospitality_inventory_issue_qty CHECK(quantity>0)
);
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_preventive_plan(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),property_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property(id) ON DELETE RESTRICT,
 asset_id UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_asset(id) ON DELETE RESTRICT,name VARCHAR(160) NOT NULL,basis VARCHAR(16) NOT NULL,
 interval_days INTEGER,interval_meter NUMERIC(16,3),next_due_at TIMESTAMPTZ,next_meter NUMERIC(16,3),checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
 active BOOLEAN NOT NULL DEFAULT TRUE,last_generated_at TIMESTAMPTZ,created_by UUID,CONSTRAINT ck_hospitality_pm_basis CHECK(basis IN('CALENDAR','METER','HOURS','CONDITION','COMPLIANCE'))
);
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_room_closure(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),work_order_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_work_order(id) ON DELETE RESTRICT,
 room_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room(id) ON DELETE RESTRICT,status VARCHAR(16) NOT NULL,starts_on DATE NOT NULL,ends_on DATE NOT NULL,
 reason TEXT NOT NULL,impact_nights INTEGER NOT NULL,approved_at TIMESTAMPTZ NOT NULL,approved_by UUID NOT NULL,released_at TIMESTAMPTZ,released_by UUID,verification_note TEXT,
 idempotency_key VARCHAR(128) NOT NULL UNIQUE,CONSTRAINT ck_hospitality_room_closure_status CHECK(status IN('OUT_OF_ORDER','OUT_OF_SERVICE','RELEASED')),CONSTRAINT ck_hospitality_room_closure_dates CHECK(ends_on>starts_on)
);

