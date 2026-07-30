-- =========================================================================
-- V011 — PENUGASAN BATAS DATA PER PENGGUNA
--
-- V010 menyimpan TINGKAT batas data pada role (role_data_scope) dan menandai
-- tingkat mana yang menuntut penugasan konkret. Yang belum ada adalah
-- penugasannya sendiri untuk masing-masing orang.
--
-- role_scope yang sudah ada bersifat per-ROLE, sehingga dua kepala gudang yang
-- memegang role sama akan melihat gudang yang sama persis. Blueprint Versi 9
-- menuntut sebaliknya: satu Picker per gudang, satu Operator Pesanan per toko,
-- satu Koordinator Fulfillment per lokasi pemenuhan.
--
-- Tabel ini melengkapi, bukan menggantikan. role_scope tetap berlaku sebagai
-- batas bawaan role; user_scope_assignment mempersempitnya untuk orang tertentu.
--
-- Additive. Tidak ada tabel maupun kolom lama yang diubah.
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".user_scope_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  scope_type      VARCHAR(32) NOT NULL,
  -- Id objek yang ditugaskan: gudang, outlet, brand, departemen, dan seterusnya.
  -- Tidak diberi foreign key karena satu kolom menunjuk tabel yang berbeda-beda
  -- bergantung scope_type; keutuhannya dijaga layanan penugasan dan diperiksa
  -- berkala, bukan oleh constraint yang tidak mungkin dinyatakan di sini.
  scope_id        UUID NOT NULL,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID,
  revoke_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_user_scope_type CHECK (scope_type IN (
    'PLATFORM','TENANT','LEGAL_ENTITY','BRAND','STORE','OUTLET','OUTLET_TERMINAL',
    'WAREHOUSE','FULFILLMENT_LOCATION','DEPARTMENT','TEAM','SELF',
    'ASSIGNED_TRIP','ASSIGNED_QUEUE','OWNERSHIP','API_SCOPE',
    'PAYMENT_PROVIDER_ACCOUNT'
  )),
  CONSTRAINT ck_user_scope_period CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Satu penugasan aktif per (pengguna, jenis, objek). Penugasan yang dicabut
-- tidak menghalangi penugasan ulang, sehingga riwayatnya tetap utuh.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_scope_active
  ON "{{TENANT_SCHEMA}}".user_scope_assignment (user_subject_id, scope_type, scope_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_scope_lookup
  ON "{{TENANT_SCHEMA}}".user_scope_assignment (user_subject_id, scope_type)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_scope_object
  ON "{{TENANT_SCHEMA}}".user_scope_assignment (scope_type, scope_id)
  WHERE revoked_at IS NULL;

-- Tingkat batas data Versi 9 pada role_data_scope ------------------------------
-- V010 mengenal 14 tingkat. Versi 9 menambah STORE, FULFILLMENT_LOCATION, dan
-- PAYMENT_PROVIDER_ACCOUNT. Constraint lama diganti dengan yang memuat ketiganya.
ALTER TABLE "{{TENANT_SCHEMA}}".role_data_scope
  DROP CONSTRAINT IF EXISTS ck_role_data_scope_level;

ALTER TABLE "{{TENANT_SCHEMA}}".role_data_scope
  ADD CONSTRAINT ck_role_data_scope_level CHECK (scope_level IN (
    'PLATFORM','TENANT','LEGAL_ENTITY','BRAND','STORE','OUTLET','OUTLET_TERMINAL',
    'WAREHOUSE','FULFILLMENT_LOCATION','DEPARTMENT','TEAM','SELF',
    'ASSIGNED_TRIP','ASSIGNED_QUEUE','OWNERSHIP','API_SCOPE',
    'PAYMENT_PROVIDER_ACCOUNT'
  ));

COMMENT ON TABLE "{{TENANT_SCHEMA}}".user_scope_assignment IS
  'Penugasan batas data untuk pengguna tertentu. Pemegang role bertingkat WAREHOUSE tanpa satu pun baris di sini melihat nol baris, bukan seluruh gudang.';

-- Audit -----------------------------------------------------------------------
DO $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_audit_user_scope_assignment ON %I.user_scope_assignment',
    '{{TENANT_SCHEMA}}'
  );
  EXECUTE format(
    'CREATE TRIGGER trg_audit_user_scope_assignment AFTER INSERT OR UPDATE OR DELETE '
    || 'ON %1$I.user_scope_assignment FOR EACH ROW EXECUTE FUNCTION %2$I.audit_row_trigger()',
    '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
  );
END $$;
