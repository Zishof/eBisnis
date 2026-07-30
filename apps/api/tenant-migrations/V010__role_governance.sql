-- =========================================================================
-- V010 — TATA KELOLA ROLE: PROFIL, DATA SCOPE, DAN PEMISAHAN TUGAS
--
-- Versi 8 Revisi 1 menuntut otorisasi berlapis: profil hak (P0–P12), batas
-- data per tingkat organisasi, dan pemisahan tugas (segregation of duty).
-- Sampai V009 yang ada hanya role -> role_menu_permission, sehingga tiga
-- pertanyaan berikut tidak dapat dijawab oleh data:
--
--   1. Role ini diturunkan dari profil apa, pada modul apa?
--   2. Baris mana yang boleh dilihat pemegang role ini?
--   3. Kombinasi role mana yang tidak boleh dipegang satu orang?
--
-- Seluruhnya additive. Tidak ada tabel maupun kolom lama yang diubah.
-- role_menu_permission dipertahankan apa adanya sebagai hasil turunan, agar
-- mesin permission yang sudah berjalan tidak perlu diubah sama sekali.
-- =========================================================================

-- Profil hak per modul ------------------------------------------------------
-- Sumber kebenaran dari mana role_menu_permission diturunkan. Disimpan agar
-- penurunan dapat diulang saat menu baru ditambahkan, tanpa menebak-nebak
-- profil apa yang dulu dipakai.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".role_module_profile (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".role (id) ON DELETE CASCADE,
  module_code   VARCHAR(64) NOT NULL,
  profile_code  VARCHAR(8) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  version       INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_role_module_profile_code
    CHECK (profile_code IN ('P0','P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_role_module_profile
  ON "{{TENANT_SCHEMA}}".role_module_profile (role_id, module_code);

-- Batas data bawaan per role ------------------------------------------------
-- role_scope yang sudah ada menyimpan penugasan konkret (scope_id tertentu).
-- Tabel ini menyimpan TINGKAT bawaannya, yang berlaku bahkan sebelum satu pun
-- outlet atau gudang ditugaskan — tanpa itu role baru tidak punya batas sama
-- sekali sampai seseorang ingat menugaskannya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".role_data_scope (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".role (id) ON DELETE CASCADE,
  scope_level       VARCHAR(32) NOT NULL,
  requires_assignment BOOLEAN NOT NULL DEFAULT FALSE,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_role_data_scope_level CHECK (scope_level IN (
    'PLATFORM','TENANT','LEGAL_ENTITY','BRAND','OUTLET','OUTLET_TERMINAL',
    'WAREHOUSE','DEPARTMENT','TEAM','SELF','ASSIGNED_TRIP','ASSIGNED_QUEUE',
    'OWNERSHIP','API_SCOPE'
  ))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_role_data_scope
  ON "{{TENANT_SCHEMA}}".role_data_scope (role_id);

-- Aturan pemisahan tugas ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".segregation_of_duty_rule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(64) NOT NULL,
  name              VARCHAR(160) NOT NULL,
  description       TEXT,
  severity          VARCHAR(16) NOT NULL DEFAULT 'HIGH',
  -- BLOCK menolak penetapan; WARN mencatat pelanggaran tetapi meneruskan.
  enforcement       VARCHAR(16) NOT NULL DEFAULT 'BLOCK',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_system         BOOLEAN NOT NULL DEFAULT FALSE,
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
  CONSTRAINT ck_sod_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT ck_sod_enforcement CHECK (enforcement IN ('BLOCK','WARN'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sod_rule_code
  ON "{{TENANT_SCHEMA}}".segregation_of_duty_rule (code)
  WHERE deleted_at IS NULL;

-- Sisi mana sebuah role berdiri dalam satu aturan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".segregation_of_duty_role (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".segregation_of_duty_rule (id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".role (id) ON DELETE CASCADE,
  side        VARCHAR(16) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  version     INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_sod_role_side CHECK (side IN ('PREPARER','APPROVER','EXECUTOR','CUSTODIAN'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sod_role
  ON "{{TENANT_SCHEMA}}".segregation_of_duty_role (rule_id, role_id);
CREATE INDEX IF NOT EXISTS idx_sod_role_role
  ON "{{TENANT_SCHEMA}}".segregation_of_duty_role (role_id);

-- Pengecualian tertulis -----------------------------------------------------
-- Tenant kecil sering hanya punya beberapa orang, sehingga pemisahan tugas
-- penuh mustahil. Pengecualian diizinkan, tetapi harus beralasan, ada yang
-- menyetujui, dan ada tanggal berakhirnya — bukan dimatikan diam-diam.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".segregation_of_duty_exception (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".segregation_of_duty_rule (id) ON DELETE CASCADE,
  user_subject_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  reason            TEXT NOT NULL,
  approved_by       UUID NOT NULL,
  approved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until       TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  revoked_by        UUID,
  revoke_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_sod_exception_period CHECK (valid_until > valid_from),
  CONSTRAINT ck_sod_exception_reason CHECK (length(btrim(reason)) >= 10)
);
CREATE INDEX IF NOT EXISTS idx_sod_exception_lookup
  ON "{{TENANT_SCHEMA}}".segregation_of_duty_exception (user_subject_id, rule_id)
  WHERE revoked_at IS NULL;

-- Catatan pelanggaran -------------------------------------------------------
-- Dicatat baik saat ditolak maupun saat diloloskan pengecualian. Tanpa catatan
-- untuk yang diloloskan, laporan audit hanya memuat percobaan yang gagal dan
-- justru melewatkan risiko yang benar-benar berjalan di produksi.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".segregation_of_duty_violation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".segregation_of_duty_rule (id) ON DELETE CASCADE,
  user_subject_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  existing_role_id  UUID REFERENCES "{{TENANT_SCHEMA}}".role (id) ON DELETE SET NULL,
  attempted_role_id UUID REFERENCES "{{TENANT_SCHEMA}}".role (id) ON DELETE SET NULL,
  outcome           VARCHAR(16) NOT NULL,
  exception_id      UUID REFERENCES "{{TENANT_SCHEMA}}".segregation_of_duty_exception (id) ON DELETE SET NULL,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_by       UUID,
  request_id        VARCHAR(64),
  CONSTRAINT ck_sod_violation_outcome CHECK (outcome IN ('BLOCKED','ALLOWED_BY_EXCEPTION','WARNED'))
);
CREATE INDEX IF NOT EXISTS idx_sod_violation_user
  ON "{{TENANT_SCHEMA}}".segregation_of_duty_violation (user_subject_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_sod_violation_rule
  ON "{{TENANT_SCHEMA}}".segregation_of_duty_violation (rule_id, detected_at DESC);

-- Kolom tambahan pada role --------------------------------------------------
-- ADD COLUMN IF NOT EXISTS tanpa nilai bawaan yang memaksa penulisan ulang
-- tabel; aman dijalankan pada schema yang sudah berisi data.
ALTER TABLE "{{TENANT_SCHEMA}}".role
  ADD COLUMN IF NOT EXISTS profile_code    VARCHAR(8),
  ADD COLUMN IF NOT EXISTS role_family     VARCHAR(64),
  ADD COLUMN IF NOT EXISTS is_core         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_legacy       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS successor_code  VARCHAR(64);

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".role.successor_code IS
  'Kode role Versi 8 yang menggantikan role lama ini. Role lama tidak dihapus agar penugasan pengguna tidak putus.';

-- Audit ---------------------------------------------------------------------
-- Tabel tata kelola wajib terekam sama seperti master lain. Trigger generik
-- dari V008 dipasang ulang untuk tabel baru.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'role_module_profile',
    'role_data_scope',
    'segregation_of_duty_rule',
    'segregation_of_duty_role',
    'segregation_of_duty_exception'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I',
      t, '{{TENANT_SCHEMA}}'
    );
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
