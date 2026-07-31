-- =========================================================================
-- K-1 — PROFIL KOPERASI, LEGALITAS, DAN KEBIJAKAN
--
-- Migrasi modul, bukan migrasi inti. Belum didaftarkan pada manifest global
-- sampai IR-001 (katalog migrasi modular) disetujui sesi Core. Sampai saat itu
-- diterapkan ke skema uji lewat `scripts/apply-cooperative-migrations.mjs`.
--
-- Aditif sepenuhnya. Tidak ada tabel maupun kolom Core yang disentuh.
-- =========================================================================

-- Jenis koperasi -----------------------------------------------------------
--
-- Data acuan, bukan data contoh. Koperasi tanpa jenis tidak dapat menentukan
-- produk simpanan maupun pinjaman yang boleh dijalankannya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_type (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(32) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  description  TEXT,
  -- Koperasi simpan pinjam tunduk pada aturan pengawasan yang berbeda, dan
  -- hanya jenis inilah yang boleh menjalankan produk pinjaman sebagai usaha
  -- utamanya. Ditandai di sini supaya aturannya tidak perlu ditebak dari nama.
  allows_lending    BOOLEAN NOT NULL DEFAULT FALSE,
  allows_retail     BOOLEAN NOT NULL DEFAULT FALSE,
  is_sharia         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample    BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID,
  delete_reason TEXT,
  version      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_cooperative_type_code UNIQUE (code)
);

-- Koperasi -----------------------------------------------------------------
--
-- Satu tenant = satu koperasi. Koperasi sekunder yang beranggotakan koperasi
-- lain ditangani lewat tautan keanggotaan pada K-2, bukan dengan beberapa baris
-- di sini — sebab dua koperasi pada satu tenant berarti dua bagan akun, dua
-- RAT, dan dua SHU yang harus dipisahkan pada setiap kueri.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id   UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  cooperative_type_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_type (id) ON DELETE RESTRICT,
  code              VARCHAR(48) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  short_name        VARCHAR(120),
  slug              VARCHAR(120) NOT NULL,
  description       TEXT,

  -- Legalitas ringkas. Rinciannya pada cooperative_legal_document; yang di sini
  -- adalah yang muncul pada kop surat dan perjanjian, sehingga perlu terbaca
  -- tanpa menggabungkan tabel.
  establishment_date DATE,
  legal_entity_number VARCHAR(120),
  legal_entity_date  DATE,
  tax_number        VARCHAR(64),

  -- Tingkatan menentukan siapa yang berwenang mengawasi dan kepada siapa
  -- laporan tahunan disampaikan.
  level             VARCHAR(24) NOT NULL DEFAULT 'PRIMARY',
  membership_scope  VARCHAR(24) NOT NULL DEFAULT 'OPEN',

  phone             VARCHAR(48),
  email             VARCHAR(160),
  website           VARCHAR(255),
  logo_file_id      UUID,

  status            VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  went_live_at      TIMESTAMPTZ,

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

  CONSTRAINT uq_cooperative_code UNIQUE (code),
  CONSTRAINT uq_cooperative_slug UNIQUE (slug),
  CONSTRAINT ck_cooperative_level
    CHECK (level IN ('PRIMARY', 'SECONDARY', 'TERTIARY')),
  CONSTRAINT ck_cooperative_membership_scope
    CHECK (membership_scope IN ('OPEN', 'CLOSED', 'EMPLOYEE', 'COMMUNITY', 'FUNCTIONAL')),
  CONSTRAINT ck_cooperative_status
    CHECK (status IN ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISSOLVED')),
  -- Koperasi berstatus ACTIVE wajib punya nomor badan hukum. Ditegakkan basis
  -- data karena inilah pembeda antara koperasi yang sah dan perkumpulan biasa,
  -- dan koperasi tidak sah tidak boleh menghimpun simpanan anggota.
  CONSTRAINT ck_cooperative_active_needs_legal
    CHECK (status <> 'ACTIVE' OR legal_entity_number IS NOT NULL)
);

-- Satu koperasi per tenant. Indeks parsial: baris terhapus tidak menghalangi
-- pembuatan ulang setelah kesalahan pendaftaran.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cooperative_single_per_tenant
  ON "{{TENANT_SCHEMA}}".cooperative ((TRUE))
  WHERE deleted_at IS NULL;

-- Dokumen legalitas --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_legal_document (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  document_type   VARCHAR(32) NOT NULL,
  document_number VARCHAR(160) NOT NULL,
  document_date   DATE,
  issued_by       VARCHAR(255),
  valid_from      DATE,
  valid_until     DATE,
  file_id         UUID,
  note            TEXT,
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
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_cooperative_legal_document_type
    CHECK (document_type IN (
      'ESTABLISHMENT_DEED', 'AMENDMENT_DEED', 'LEGAL_ENTITY_DECISION',
      'TAX_IDENTITY', 'BUSINESS_LICENSE', 'DOMICILE_LETTER',
      'SHARIA_CERTIFICATE', 'OTHER')),
  -- Masa berlaku yang terbalik adalah salah ketik, dan salah ketik pada tanggal
  -- izin usaha berarti izin yang dikira masih berlaku padahal sudah lewat.
  CONSTRAINT ck_cooperative_legal_document_period
    CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS ix_cooperative_legal_document_cooperative
  ON "{{TENANT_SCHEMA}}".cooperative_legal_document (cooperative_id, document_type);

-- Alamat -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_address (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  address_id      UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE SET NULL,
  address_type    VARCHAR(24) NOT NULL DEFAULT 'HEAD_OFFICE',
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_cooperative_address_type
    CHECK (address_type IN ('HEAD_OFFICE', 'BRANCH', 'SERVICE_OFFICE', 'CORRESPONDENCE'))
);

-- Satu alamat utama saja per koperasi.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cooperative_address_primary
  ON "{{TENANT_SCHEMA}}".cooperative_address (cooperative_id)
  WHERE is_primary = TRUE AND deleted_at IS NULL;

-- Wilayah kerja ------------------------------------------------------------
--
-- Menentukan siapa yang boleh menjadi anggota. Koperasi karyawan terbatas pada
-- instansinya; koperasi kelurahan terbatas pada wilayahnya. Tanpa wilayah kerja
-- tercatat, syarat keanggotaan hanya dapat diperiksa manusia yang kebetulan
-- mengetahuinya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_service_area (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  area_type       VARCHAR(24) NOT NULL,
  area_code       VARCHAR(48),
  area_name       VARCHAR(255) NOT NULL,
  note            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_cooperative_service_area_type
    CHECK (area_type IN ('PROVINCE', 'CITY', 'DISTRICT', 'VILLAGE',
                         'INSTITUTION', 'COMMUNITY', 'NATIONWIDE'))
);

CREATE INDEX IF NOT EXISTS ix_cooperative_service_area_cooperative
  ON "{{TENANT_SCHEMA}}".cooperative_service_area (cooperative_id);

-- Kebijakan ----------------------------------------------------------------
--
-- AD/ART, aturan keanggotaan, kebijakan akuntansi, kebijakan syariah — seluruhnya
-- pada satu tabel yang dibedakan `policy_type`. Empat tabel berbentuk sama hanya
-- memperbanyak kode tanpa menambah apa pun.
--
-- Berversi dan bertanggal berlaku dengan sengaja: SHU dihitung menurut kebijakan
-- yang berlaku pada periode bukunya, dan kebijakan yang disunting di tempat akan
-- membuat perhitungan tahun lalu tidak dapat diulang.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  policy_type     VARCHAR(32) NOT NULL,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  version_no      INTEGER NOT NULL DEFAULT 1,
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,
  document_file_id UUID,

  effective_from  DATE NOT NULL,
  effective_until DATE,

  -- Kebijakan yang mengubah hak anggota — AD/ART, aturan keanggotaan, rumus SHU
  -- — sah hanya setelah diputuskan RAT. Tautan keputusannya diisi pada K-5.
  approved_by_meeting_id UUID,
  approved_at     TIMESTAMPTZ,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',

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
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_cooperative_policy_type
    CHECK (policy_type IN ('BYLAW', 'MEMBERSHIP_RULE', 'ACCOUNTING_POLICY',
                           'SHARIA_POLICY', 'SHU_POLICY', 'SAVING_POLICY',
                           'LOAN_POLICY', 'OTHER')),
  CONSTRAINT ck_cooperative_policy_status
    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUPERSEDED', 'REVOKED')),
  CONSTRAINT ck_cooperative_policy_period
    CHECK (effective_until IS NULL OR effective_until >= effective_from),
  -- Kebijakan aktif wajib menyebutkan siapa yang menyetujuinya dan kapan.
  -- Kebijakan yang berlaku tanpa persetujuan adalah kebijakan yang dibuat
  -- seseorang sendirian atas hak seluruh anggota.
  CONSTRAINT ck_cooperative_policy_active_needs_approval
    CHECK (status <> 'ACTIVE' OR approved_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cooperative_policy_code_version
  ON "{{TENANT_SCHEMA}}".cooperative_policy (cooperative_id, code, version_no)
  WHERE deleted_at IS NULL;

-- Hanya satu versi aktif per kode kebijakan.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cooperative_policy_single_active
  ON "{{TENANT_SCHEMA}}".cooperative_policy (cooperative_id, code)
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- Domain -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_domain (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  domain          VARCHAR(255) NOT NULL,
  domain_type     VARCHAR(24) NOT NULL DEFAULT 'SUBDOMAIN',
  -- Domain sendiri hanya boleh melayani lalu lintas setelah kepemilikannya
  -- terbukti. Menerima domain tanpa verifikasi memungkinkan seseorang
  -- mengarahkan domain milik koperasi lain ke tenantnya.
  verification_token VARCHAR(120),
  verified_at     TIMESTAMPTZ,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_cooperative_domain_type
    CHECK (domain_type IN ('SUBDOMAIN', 'CUSTOM')),
  CONSTRAINT ck_cooperative_domain_custom_needs_token
    CHECK (domain_type <> 'CUSTOM' OR verification_token IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cooperative_domain_name
  ON "{{TENANT_SCHEMA}}".cooperative_domain (lower(domain))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cooperative_domain_primary
  ON "{{TENANT_SCHEMA}}".cooperative_domain (cooperative_id)
  WHERE is_primary = TRUE AND deleted_at IS NULL;

-- Pemetaan akun ------------------------------------------------------------
--
-- Kode akun tidak dikunci di dalam program. Koperasi yang memakai bagan akun
-- standar Kementerian Koperasi dan yang memakai bagan akunnya sendiri harus
-- sama-sama dapat berjalan. Bertanggal berlaku karena bagan akun berubah, dan
-- jurnal tahun lalu harus tetap menunjuk akun yang berlaku saat itu.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_account_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  mapping_code    VARCHAR(64) NOT NULL,
  account_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".chart_of_account (id) ON DELETE RESTRICT,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_cooperative_account_mapping_period
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cooperative_account_mapping_active
  ON "{{TENANT_SCHEMA}}".cooperative_account_mapping (cooperative_id, mapping_code)
  WHERE effective_until IS NULL AND deleted_at IS NULL;
