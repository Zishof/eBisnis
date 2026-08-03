-- =========================================================================
-- H001 — FASILITAS KESEHATAN, PROFIL TENANT, DAN PEMBERI LAYANAN
-- =========================================================================
--
-- Fase H-1 vertical eMedik. Aditif seluruhnya; tidak ada tabel inti yang
-- disentuh.
--
-- Awalan `H` dipakai karena `TenantModuleMigrationCatalog` yang diperintahkan
-- panduan koordinasi §7 belum ada di repositori ini, sementara §7 itu juga
-- melarang nomor urut global manual. `H###` dengan `sequence` mulai 1000 tidak
-- dapat bertabrakan dengan `V###` milik Core maupun awalan vertical lain.
-- Lihat docs/integration-requests/health/002-modular-migration-catalog.md.

-- ---------------------------------------------------------------------------
-- Profil tenant kesehatan
-- ---------------------------------------------------------------------------
-- Satu baris per tenant. Menyimpan hal yang berlaku bagi seluruh fasilitas di
-- bawahnya: jenjang tarif langganan, zona waktu bawaan, dan kebijakan yang
-- tidak boleh berbeda antar fasilitas dalam satu badan hukum.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_tenant_profile (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id       UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  display_name          VARCHAR(180) NOT NULL,
  -- Jenjang tarif pendaftaran pasien. Disimpan sebagai data, bukan dikunci di
  -- program, karena spesifikasi §4 menyebut 500+ sebagai "contract/negotiation"
  -- — dan angka hasil negosiasi tidak dapat dikunci di kode.
  billing_tier_code     VARCHAR(48) NOT NULL DEFAULT 'GRADUATED_DEFAULT',
  default_timezone      VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
  -- Lingkungan pelatihan tidak pernah ditagih. Dipisahkan dari `is_sample`
  -- karena keduanya berbeda: data contoh dapat ada di tenant produksi,
  -- sedangkan seluruh tenant pelatihan tidak tertagih apa pun isinya.
  is_training           BOOLEAN NOT NULL DEFAULT FALSE,
  go_live_at            TIMESTAMPTZ,
  metadata              JSONB,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample             BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id       UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID,
  delete_reason         TEXT,
  version               INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Jenis fasilitas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_facility_type (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  -- Golongan menentukan kemampuan apa yang masuk akal bagi fasilitas ini.
  -- Posyandu tidak punya rawat inap; laboratorium tidak punya poliklinik.
  category        VARCHAR(24) NOT NULL,
  supports_inpatient  BOOLEAN NOT NULL DEFAULT FALSE,
  supports_emergency  BOOLEAN NOT NULL DEFAULT FALSE,
  supports_pharmacy   BOOLEAN NOT NULL DEFAULT FALSE,
  supports_laboratory BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_facility_type_category_valid CHECK (
    category IN ('HOSPITAL', 'CLINIC', 'PUSKESMAS', 'POSYANDU', 'POSKESDES',
                 'LABORATORY', 'PHARMACY', 'OTHER')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_facility_type_code
  ON "{{TENANT_SCHEMA}}".health_facility_type (code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Fasilitas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_facility (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_type_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility_type (id) ON DELETE RESTRICT,
  legal_entity_id     UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  parent_facility_id  UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  address_id          UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE SET NULL,

  -- NULLABLE dengan sengaja, dan ini keputusan yang perlu diingat.
  --
  -- Fasilitas yang juga menjual barang — apotek dengan kasir — menautkan diri
  -- ke outlet supaya POS dan gudangnya berjalan di atas mesin yang sudah ada.
  -- Posyandu tidak punya outlet sama sekali. Mewajibkan kolom ini akan memaksa
  -- pembuatan outlet palsu untuk setiap Posyandu, dan outlet palsu itu akan
  -- muncul pada laporan penjualan sebagai toko yang tidak pernah menjual apa pun.
  outlet_id           UUID REFERENCES "{{TENANT_SCHEMA}}".outlet (id) ON DELETE SET NULL,

  code                VARCHAR(48) NOT NULL,
  name                VARCHAR(180) NOT NULL,
  short_name          VARCHAR(80),
  description         TEXT,

  -- Perizinan dan kelas. Kosong pada Posyandu, wajib pada rumah sakit —
  -- ditegakkan layanan, bukan basis data, karena aturannya berubah mengikuti
  -- regulasi dan tidak boleh menuntut migrasi setiap kali berubah.
  hospital_class      VARCHAR(8),
  license_number      VARCHAR(96),
  license_valid_until DATE,
  accreditation_grade VARCHAR(48),

  timezone            VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
  phone               VARCHAR(48),
  email               VARCHAR(160),

  -- Subdomain pada emedik.id. Unik se-tenant di sini; keunikan lintas tenant
  -- dijaga control plane, sama seperti domain toko online.
  subdomain           VARCHAR(64),

  opened_at           DATE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  deactivated_at      TIMESTAMPTZ,
  deactivated_by      UUID,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID,
  delete_reason       TEXT,
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT health_facility_hospital_class_valid CHECK (
    hospital_class IS NULL OR hospital_class IN ('A', 'B', 'C', 'D', 'D_PRATAMA')
  ),
  -- Fasilitas tidak boleh menjadi induknya sendiri. Terdengar mustahil sampai
  -- seseorang menyunting induk lewat antarmuka dan memilih dirinya sendiri.
  CONSTRAINT health_facility_not_own_parent CHECK (parent_facility_id IS NULL OR parent_facility_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_facility_code
  ON "{{TENANT_SCHEMA}}".health_facility (code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_facility_subdomain
  ON "{{TENANT_SCHEMA}}".health_facility (lower(subdomain))
  WHERE subdomain IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_health_facility_type ON "{{TENANT_SCHEMA}}".health_facility (facility_type_id);
CREATE INDEX IF NOT EXISTS ix_health_facility_parent ON "{{TENANT_SCHEMA}}".health_facility (parent_facility_id);
CREATE INDEX IF NOT EXISTS ix_health_facility_outlet ON "{{TENANT_SCHEMA}}".health_facility (outlet_id);

-- ---------------------------------------------------------------------------
-- Unit layanan, bangsal, kamar, tempat tidur
-- ---------------------------------------------------------------------------
-- Satu tabel untuk seluruh jenis unit, dibedakan `unit_type`. Delapan belas
-- tabel berbentuk sama (LaboratoryUnit, RadiologyUnit, PharmacyUnit, …) hanya
-- memperbanyak kode tanpa menambah apa pun; yang membedakannya adalah aturan
-- di layanan, bukan bentuk barisnya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_service_unit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  parent_unit_id  UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,
  department_id   UUID REFERENCES "{{TENANT_SCHEMA}}".department (id) ON DELETE SET NULL,
  unit_type       VARCHAR(32) NOT NULL,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(180) NOT NULL,
  description     TEXT,
  -- Poliklinik menerima pasien rawat jalan; bangsal menerima rawat inap.
  -- Dipakai menyaring pilihan saat pendaftaran.
  accepts_outpatient BOOLEAN NOT NULL DEFAULT FALSE,
  accepts_inpatient  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_service_unit_type_valid CHECK (
    unit_type IN ('POLYCLINIC', 'WARD', 'EMERGENCY', 'OPERATING_THEATRE', 'ICU',
                  'LABORATORY', 'RADIOLOGY', 'PHARMACY', 'BLOOD_BANK', 'CSSD',
                  'AMBULANCE', 'MORGUE', 'HOMECARE', 'NUTRITION', 'REHAB',
                  'ADMINISTRATION', 'SERVICE_POINT', 'OTHER')
  ),
  CONSTRAINT health_service_unit_not_own_parent CHECK (parent_unit_id IS NULL OR parent_unit_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_service_unit_code
  ON "{{TENANT_SCHEMA}}".health_service_unit (facility_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_health_service_unit_facility
  ON "{{TENANT_SCHEMA}}".health_service_unit (facility_id, unit_type);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_room (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  -- Kelas rawat menentukan tarif. Disimpan pada kamar, bukan pada tempat tidur,
  -- karena kelas adalah sifat ruangannya.
  care_class      VARCHAR(24),
  floor           VARCHAR(24),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_room_code
  ON "{{TENANT_SCHEMA}}".health_room (service_unit_id, code)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_bed (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_room (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120),
  -- Status tempat tidur, bukan status pasien. Penetapan pasien ke tempat tidur
  -- ada pada H-6 (`adt_bed_assignment`); di sini hanya kesiapan fisiknya.
  bed_status      VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_bed_status_valid CHECK (
    bed_status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE', 'CLOSED')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_bed_code
  ON "{{TENANT_SCHEMA}}".health_bed (room_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_health_bed_status ON "{{TENANT_SCHEMA}}".health_bed (bed_status);

-- ---------------------------------------------------------------------------
-- Pemberi layanan
-- ---------------------------------------------------------------------------
-- Kedua tautan NULLABLE dengan sengaja, dan alasannya menentukan:
--
--   dokter tamu     punya kewenangan klinis, BUKAN pegawai
--   kader Posyandu  memberi layanan, TIDAK punya akun sistem
--
-- Mewajibkan keduanya akan menutup dua keadaan yang justru umum di lapangan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_provider (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id    UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  employee_id        UUID REFERENCES "{{TENANT_SCHEMA}}".employee (id) ON DELETE SET NULL,
  primary_facility_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE SET NULL,
  code               VARCHAR(48) NOT NULL,
  full_name          VARCHAR(180) NOT NULL,
  provider_type      VARCHAR(32) NOT NULL,
  -- Nomor Surat Izin Praktik dan STR. Kosong pada kader; wajib pada dokter —
  -- ditegakkan layanan menurut `provider_type`.
  practice_license_no VARCHAR(96),
  practice_license_valid_until DATE,
  registration_no    VARCHAR(96),
  specialty_code     VARCHAR(48),
  phone              VARCHAR(48),
  email              VARCHAR(160),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  metadata           JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID,
  deactivated_at     TIMESTAMPTZ,
  deactivated_by     UUID,
  deleted_at         TIMESTAMPTZ,
  deleted_by         UUID,
  delete_reason      TEXT,
  version            INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_provider_type_valid CHECK (
    provider_type IN ('DOCTOR', 'DENTIST', 'NURSE', 'MIDWIFE', 'PHARMACIST',
                      'PHARMACY_ASSISTANT', 'LAB_ANALYST', 'RADIOGRAPHER',
                      'RADIOLOGIST', 'NUTRITIONIST', 'PHYSIOTHERAPIST',
                      'PSYCHOLOGIST', 'CADRE', 'OTHER')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_provider_code
  ON "{{TENANT_SCHEMA}}".health_provider (code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_health_provider_user
  ON "{{TENANT_SCHEMA}}".health_provider (user_subject_id)
  WHERE user_subject_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Kewenangan klinis
-- ---------------------------------------------------------------------------
-- Terpisah dari peran, dan perbedaannya penting:
--
--   peran            menentukan MENU APA yang terbuka
--   kewenangan klinis menentukan TINDAKAN APA yang boleh dilakukan
--
-- Dokter umum dan dokter bedah memakai peran "Dokter" yang sama, tetapi hanya
-- satu di antaranya boleh melakukan operasi. Menyatukan keduanya berarti
-- membuat peran baru untuk setiap kombinasi kewenangan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_clinical_privilege (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE CASCADE,
  facility_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE CASCADE,
  privilege_code  VARCHAR(64) NOT NULL,
  granted_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE,
  granted_by      UUID,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID,
  revoke_reason   TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_privilege_period_valid CHECK (valid_until IS NULL OR valid_until >= granted_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_privilege_active
  ON "{{TENANT_SCHEMA}}".health_clinical_privilege
     (provider_id, COALESCE(facility_id, '00000000-0000-0000-0000-000000000000'::uuid), privilege_code)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_tenant_profile', 'health_facility_type', 'health_facility',
                           'health_service_unit', 'health_room', 'health_bed',
                           'health_provider', 'health_clinical_privilege'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
