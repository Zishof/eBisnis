-- =========================================================================
-- V050 - Master pihak Sales / Inventory (paritas layar 01-07)
-- Memperluas master ERP yang sudah ada; tidak membuat master pemasok atau
-- pelanggan kedua. Profil sales berdiri sendiri dan dapat dihubungkan ke
-- user_subject ketika sales tersebut memperoleh akun aplikasi.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".supplier
  ADD COLUMN IF NOT EXISTS legacy_payment_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS address_text TEXT,
  ADD COLUMN IF NOT EXISTS region_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(96),
  ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS bank_address TEXT;

ALTER TABLE "{{TENANT_SCHEMA}}".customer
  ADD COLUMN IF NOT EXISTS legacy_payment_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS address_text TEXT,
  ADD COLUMN IF NOT EXISTS region_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS default_discount_percent NUMERIC(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(96),
  ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS bank_address TEXT;

ALTER TABLE "{{TENANT_SCHEMA}}".supplier
  DROP CONSTRAINT IF EXISTS ck_supplier_legacy_payment_days;
ALTER TABLE "{{TENANT_SCHEMA}}".supplier
  ADD CONSTRAINT ck_supplier_legacy_payment_days CHECK (legacy_payment_days BETWEEN 0 AND 3650);

ALTER TABLE "{{TENANT_SCHEMA}}".customer
  DROP CONSTRAINT IF EXISTS ck_customer_legacy_payment_days;
ALTER TABLE "{{TENANT_SCHEMA}}".customer
  ADD CONSTRAINT ck_customer_legacy_payment_days CHECK (legacy_payment_days BETWEEN 0 AND 3650);
ALTER TABLE "{{TENANT_SCHEMA}}".customer
  DROP CONSTRAINT IF EXISTS ck_customer_default_discount_percent;
ALTER TABLE "{{TENANT_SCHEMA}}".customer
  ADD CONSTRAINT ck_customer_default_discount_percent CHECK (default_discount_percent BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".inventory_salesperson_profile (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id   UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  code              VARCHAR(64) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  account_number    VARCHAR(64),
  territory         VARCHAR(160),
  monthly_target    NUMERIC(19,4) NOT NULL DEFAULT 0,
  phone             VARCHAR(50),
  email             VARCHAR(160),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_system         BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deactivated_at    TIMESTAMPTZ,
  deactivated_by    UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_inventory_salesperson_target CHECK (monthly_target >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_salesperson_profile_code
  ON "{{TENANT_SCHEMA}}".inventory_salesperson_profile (code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_salesperson_profile_user
  ON "{{TENANT_SCHEMA}}".inventory_salesperson_profile (user_subject_id)
  WHERE user_subject_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_inventory_salesperson_profile_active
  ON "{{TENANT_SCHEMA}}".inventory_salesperson_profile (is_active, deleted_at, name);

-- Proyeksikan pemetaan sales legacy yang sudah ada. Upsert ini idempoten dan
-- tidak mengubah profil yang kelak disunting pengguna.
INSERT INTO "{{TENANT_SCHEMA}}".inventory_salesperson_profile
  (user_subject_id, code, name, account_number, territory, phone, metadata, is_active)
SELECT lsm.user_subject_id,
       lsm.legacy_code,
       lsm.legacy_name,
       NULLIF(lsm.metadata->>'accountNumber', ''),
       NULLIF(lsm.metadata->>'territory', ''),
       NULLIF(lsm.metadata->>'phone', ''),
       jsonb_build_object('legacySalespersonMapId', lsm.id, 'source', 'V050_PROJECTION'),
       lsm.is_active
  FROM "{{TENANT_SCHEMA}}".legacy_salesperson_map lsm
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".inventory_salesperson_profile isp
    WHERE isp.code = lsm.legacy_code AND isp.deleted_at IS NULL
 );
