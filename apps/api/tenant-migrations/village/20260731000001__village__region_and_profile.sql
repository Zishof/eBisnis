-- =========================================================================
-- VILLAGE D-1 — UNIT PEMERINTAHAN, PROFIL WILAYAH, DAN DOMAIN
-- =========================================================================
--
-- Migrasi pertama vertikal info-desa. Seluruhnya aditif; tidak menyentuh satu
-- pun tabel Core.
--
-- `profile_type` pada `village_unit` adalah tumpuan seluruh vertikal. Desa dan
-- kelurahan berbeda menurut undang-undang: kelurahan adalah perangkat
-- kecamatan yang tidak punya anggaran sendiri, sedangkan desa adalah kesatuan
-- masyarakat hukum yang menyusun APBDes-nya sendiri. Kolom ini yang menentukan
-- fitur mana yang berlaku, dan penegakannya terjadi di layanan — bukan hanya
-- di menu.

-- ---------------------------------------------------------------------------
-- Unit pemerintahan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_unit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- DESA atau KELURAHAN. Tidak ada nilai ketiga; wilayah yang berstatus lain
  -- bukan sasaran sistem ini, dan menyediakan nilai "LAINNYA" hanya akan
  -- membuat aturan kelayakan tidak dapat diputuskan.
  profile_type      VARCHAR(16) NOT NULL,
  code              VARCHAR(48) NOT NULL,
  name              VARCHAR(160) NOT NULL,
  slug              VARCHAR(80) NOT NULL,

  -- Kode wilayah administratif nasional, sepuluh digit berformat
  -- PP.KK.CC.DDDD. Disimpan sebagai teks, bukan angka: nol di depan bermakna
  -- dan akan hilang bila disimpan sebagai bilangan.
  administrative_code VARCHAR(20),
  province_code     VARCHAR(4),
  province_name     VARCHAR(120),
  regency_code      VARCHAR(8),
  regency_name      VARCHAR(120),
  district_code     VARCHAR(12),
  district_name     VARCHAR(120),

  address           TEXT,
  postal_code       VARCHAR(10),
  phone             VARCHAR(40),
  email             VARCHAR(160),
  latitude          NUMERIC(10,7),
  longitude         NUMERIC(10,7),
  area_km2          NUMERIC(12,4),
  established_year  INTEGER,
  motto             VARCHAR(255),
  logo_file_id      UUID,

  -- Sakelar fitur CONFIGURABLE yang dinyalakan penyewa ini, beserta jejaknya:
  -- siapa menyalakan, kapan, atas dasar apa. Kewenangan yang dinyalakan tanpa
  -- dasar adalah temuan audit yang menunggu terjadi.
  enabled_features  JSONB NOT NULL DEFAULT '[]'::jsonb,
  feature_notes     JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_unit_profile_valid CHECK (profile_type IN ('DESA', 'KELURAHAN')),
  CONSTRAINT village_unit_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  CONSTRAINT village_unit_admin_code_format
    CHECK (administrative_code IS NULL OR administrative_code ~ '^[0-9.]{2,20}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS village_unit_code_unique
  ON "{{TENANT_SCHEMA}}".village_unit (code) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS village_unit_slug_unique
  ON "{{TENANT_SCHEMA}}".village_unit (slug) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Riwayat perubahan profil
-- ---------------------------------------------------------------------------
-- Desa berubah status menjadi kelurahan ketika wilayahnya menjadi perkotaan.
-- Itu peristiwa hukum, dan APBDes yang tersusun sebelum perubahan tetap harus
-- dapat dipertanggungjawabkan sesudahnya. Riwayat ini yang menjelaskan mengapa
-- ada data APBDes pada tenant yang kini berprofil kelurahan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_profile_change (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE CASCADE,
  from_profile    VARCHAR(16),
  to_profile      VARCHAR(16) NOT NULL,
  legal_basis     TEXT NOT NULL,
  effective_date  DATE NOT NULL,
  changed_by      UUID,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT village_profile_change_to_valid CHECK (to_profile IN ('DESA', 'KELURAHAN'))
);

CREATE INDEX IF NOT EXISTS village_profile_change_unit_idx
  ON "{{TENANT_SCHEMA}}".village_profile_change (village_unit_id, effective_date DESC);

-- ---------------------------------------------------------------------------
-- Sub-wilayah: dusun (desa) atau lingkungan (kelurahan)
-- ---------------------------------------------------------------------------
-- Satu tabel untuk keduanya, dibedakan `kind`. Dua tabel berbentuk sama hanya
-- memperbanyak kode tanpa menambah apa pun, dan setiap kueri kependudukan
-- kemudian harus menggabungkan keduanya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_sub_area (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  kind            VARCHAR(16) NOT NULL,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  head_name       VARCHAR(160),
  head_phone      VARCHAR(40),
  area_km2        NUMERIC(12,4),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_sub_area_kind_valid CHECK (kind IN ('DUSUN', 'LINGKUNGAN'))
);

CREATE UNIQUE INDEX IF NOT EXISTS village_sub_area_code_unique
  ON "{{TENANT_SCHEMA}}".village_sub_area (village_unit_id, code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- RW dan RT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_rw (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  sub_area_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_sub_area (id) ON DELETE SET NULL,
  number          VARCHAR(8) NOT NULL,
  name            VARCHAR(160),
  head_name       VARCHAR(160),
  head_phone      VARCHAR(40),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS village_rw_number_unique
  ON "{{TENANT_SCHEMA}}".village_rw (village_unit_id, number) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_rt (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_rw_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_rw (id) ON DELETE RESTRICT,
  number          VARCHAR(8) NOT NULL,
  head_name       VARCHAR(160),
  head_phone      VARCHAR(40),
  household_count INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS village_rt_number_unique
  ON "{{TENANT_SCHEMA}}".village_rt (village_rw_id, number) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_rt_rw_idx
  ON "{{TENANT_SCHEMA}}".village_rt (village_rw_id);

-- ---------------------------------------------------------------------------
-- Batas wilayah
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_boundary (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE CASCADE,
  direction       VARCHAR(16) NOT NULL,
  adjacent_name   VARCHAR(160) NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT village_boundary_direction_valid
    CHECK (direction IN ('UTARA', 'TIMUR', 'SELATAN', 'BARAT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS village_boundary_unique
  ON "{{TENANT_SCHEMA}}".village_boundary (village_unit_id, direction);

-- Poligon wilayah sebagai GeoJSON. Disimpan sebagai JSONB alih-alih tipe
-- geometri PostGIS: ekstensi itu belum tentu ada pada setiap pemasangan, dan
-- kebutuhan village hanya menampilkan peta — bukan analisis spasial.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_geo_area (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE CASCADE,
  sub_area_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_sub_area (id) ON DELETE CASCADE,
  area_type       VARCHAR(24) NOT NULL DEFAULT 'ADMINISTRATIVE',
  geojson         JSONB NOT NULL,
  source          VARCHAR(160),
  captured_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS village_geo_area_unit_idx
  ON "{{TENANT_SCHEMA}}".village_geo_area (village_unit_id);

-- ---------------------------------------------------------------------------
-- Potensi dan indikator
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_potential (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE CASCADE,
  category        VARCHAR(48) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  quantity        NUMERIC(18,4),
  unit            VARCHAR(40),
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS village_potential_unit_idx
  ON "{{TENANT_SCHEMA}}".village_potential (village_unit_id, category);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_indicator (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE CASCADE,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  period          VARCHAR(16) NOT NULL,
  value           NUMERIC(18,4),
  unit            VARCHAR(40),
  source          VARCHAR(160),
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS village_indicator_unique
  ON "{{TENANT_SCHEMA}}".village_indicator (village_unit_id, code, period);

-- ---------------------------------------------------------------------------
-- Domain situs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_domain (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE CASCADE,
  hostname        VARCHAR(255) NOT NULL,
  domain_type     VARCHAR(16) NOT NULL DEFAULT 'SUBDOMAIN',
  -- Domain milik sendiri wajib dibuktikan kepemilikannya sebelum dipakai.
  -- Tanpa itu, siapa pun dapat mengarahkan domain orang lain ke situs desanya.
  verification_token   VARCHAR(120),
  verification_status  VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  verified_at     TIMESTAMPTZ,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_domain_type_valid CHECK (domain_type IN ('SUBDOMAIN', 'CUSTOM')),
  CONSTRAINT village_domain_status_valid
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED')),
  -- Subdomain info-desa.id tidak perlu diverifikasi; domain sendiri wajib.
  CONSTRAINT village_domain_custom_needs_token
    CHECK (domain_type = 'SUBDOMAIN' OR verification_token IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_domain_hostname_unique
  ON "{{TENANT_SCHEMA}}".village_domain (lower(hostname)) WHERE deleted_at IS NULL;

-- Hanya satu domain utama per unit.
CREATE UNIQUE INDEX IF NOT EXISTS village_domain_primary_unique
  ON "{{TENANT_SCHEMA}}".village_domain (village_unit_id)
  WHERE is_primary = TRUE AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
-- Dipasang oleh migrasi 20260731000007, bukan di sini.
--
-- Berkas ini semula memuat blok pemasangan pemicu yang mencari fungsi bernama
-- `fn_audit_row_change` — nama yang tidak pernah ada. Fungsi audit yang
-- sesungguhnya bernama `audit_row_trigger()` dan tinggal pada skema audit
-- terpisah. Karena blok itu dijaga `IF EXISTS`, ia dilewati tanpa galat, dan
-- tidak satu pun tabel village benar-benar diaudit.
--
-- Blok itu dibuang alih-alih dibetulkan di tempatnya: migrasi ini belum
-- pernah diterapkan pada skema penyewa mana pun, sehingga membetulkannya di
-- sini masih aman. Pemasangannya dipusatkan pada satu migrasi supaya tidak
-- terulang lima kali dengan lima peluang salah ketik.
