-- =========================================================================
-- K-2 — ORGANISASI, KEPENGURUSAN, CALON ANGGOTA, DAN ANGGOTA
--
-- Migrasi modul. Aditif; tidak ada tabel maupun kolom Core yang disentuh.
--
-- Satu aturan menentukan bentuk seluruh berkas ini: **seseorang menjadi
-- anggota hanya setelah simpanan pokoknya lunas.** Sebelum itu ia calon
-- anggota, dan calon anggota tidak boleh meminjam, tidak punya hak suara, dan
-- tidak memperoleh SHU.
-- =========================================================================

-- Periode kepengurusan ------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_organization_term (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  term_start      DATE NOT NULL,
  term_end        DATE NOT NULL,
  -- Periode kepengurusan ditetapkan Rapat Anggota. Tautannya diisi pada K-5.
  decided_by_meeting_id UUID,
  status          VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_term_status CHECK (status IN ('PLANNED', 'ACTIVE', 'ENDED')),
  CONSTRAINT ck_coop_term_period CHECK (term_end > term_start),
  CONSTRAINT uq_coop_term_code UNIQUE (cooperative_id, code)
);

-- Jabatan kepengurusan ------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_board_position (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  board_type      VARCHAR(24) NOT NULL,
  -- Jabatan yang berwenang menandatangani perjanjian atas nama koperasi.
  -- Dipakai memeriksa keabsahan tanda tangan pada perjanjian pinjaman.
  can_sign_agreement BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_position_board_type
    CHECK (board_type IN ('MANAGEMENT', 'SUPERVISORY', 'SHARIA_SUPERVISORY', 'COMMITTEE', 'STAFF')),
  CONSTRAINT uq_coop_position_code UNIQUE (cooperative_id, code)
);

-- Calon anggota dan anggota -------------------------------------------------
--
-- Satu tabel untuk keduanya, dibedakan `status`. Dua tabel terpisah akan
-- memaksa pemindahan baris saat calon anggota menjadi anggota, dan pemindahan
-- baris memutus rujukan dokumen serta jejak auditnya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,

  -- Identitas berbagi `party` dengan Core, sehingga anggota yang juga pemasok
  -- koperasi tidak tercatat dua kali dengan data yang lambat laun berbeda.
  party_id        UUID REFERENCES "{{TENANT_SCHEMA}}".party (id) ON DELETE RESTRICT,
  -- Anggota yang berbelanja di unit toko adalah pelanggan POS. Tautan ini yang
  -- membuat patronage terhitung otomatis tanpa mencocokkan nama.
  customer_id     UUID REFERENCES "{{TENANT_SCHEMA}}".customer (id) ON DELETE SET NULL,
  user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,

  member_number   VARCHAR(64),
  full_name       VARCHAR(255) NOT NULL,
  identity_number VARCHAR(64),
  birth_date      DATE,
  birth_place     VARCHAR(160),
  gender          VARCHAR(16),
  occupation      VARCHAR(160),
  phone           VARCHAR(48),
  email           VARCHAR(160),
  address_text    TEXT,
  photo_file_id   UUID,

  member_category_id UUID,
  status          VARCHAR(32) NOT NULL DEFAULT 'PROSPECT',

  applied_at      TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,
  verified_by     UUID,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID,
  -- Tanggal keanggotaan sah dimulai. Diisi HANYA saat simpanan pokok lunas,
  -- dan dipakai menghitung masa keanggotaan untuk SHU.
  activated_at    TIMESTAMPTZ,
  terminated_at   TIMESTAMPTZ,
  termination_reason TEXT,

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

  CONSTRAINT ck_coop_member_status CHECK (status IN (
    'PROSPECT', 'PENDING_VERIFICATION', 'APPROVED', 'PENDING_PRINCIPAL_SAVING',
    'ACTIVE', 'INACTIVE', 'SUSPENDED', 'RESIGNING', 'TERMINATED')),

  -- Anggota penuh WAJIB punya nomor anggota dan tanggal aktif. Ditegakkan basis
  -- data karena inilah pembeda anggota dari calon anggota, dan pembeda itu
  -- menentukan siapa yang boleh meminjam, memberi suara, dan menerima SHU.
  CONSTRAINT ck_coop_member_active_needs_number
    CHECK (status <> 'ACTIVE' OR (member_number IS NOT NULL AND activated_at IS NOT NULL)),

  -- Calon anggota TIDAK boleh punya tanggal aktif. Menutup jalan sebaliknya:
  -- mengisi activated_at lebih dahulu lalu mengubah status kemudian.
  CONSTRAINT ck_coop_member_prospect_not_activated
    CHECK (status NOT IN ('PROSPECT', 'PENDING_VERIFICATION', 'APPROVED', 'PENDING_PRINCIPAL_SAVING')
           OR activated_at IS NULL),

  CONSTRAINT ck_coop_member_terminated_needs_date
    CHECK (status <> 'TERMINATED' OR terminated_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_member_number
  ON "{{TENANT_SCHEMA}}".cooperative_member (cooperative_id, member_number)
  WHERE member_number IS NOT NULL AND deleted_at IS NULL;

-- Satu orang hanya boleh punya satu keanggotaan yang belum berakhir.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_member_identity_open
  ON "{{TENANT_SCHEMA}}".cooperative_member (cooperative_id, identity_number)
  WHERE identity_number IS NOT NULL AND status <> 'TERMINATED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_coop_member_status
  ON "{{TENANT_SCHEMA}}".cooperative_member (cooperative_id, status);

CREATE INDEX IF NOT EXISTS ix_coop_member_customer
  ON "{{TENANT_SCHEMA}}".cooperative_member (customer_id)
  WHERE customer_id IS NOT NULL;

-- Kategori anggota ----------------------------------------------------------
--
-- BUKAN customer_group. customer_group menggolongkan pelanggan untuk harga;
-- kategori anggota menentukan hak suara, hak pinjam, dan bagian SHU.
-- Menyamakannya berarti kategori anggota ikut berubah setiap kali seseorang
-- menyunting daftar harga.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_category (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  has_voting_right BOOLEAN NOT NULL DEFAULT TRUE,
  can_borrow      BOOLEAN NOT NULL DEFAULT TRUE,
  receives_shu    BOOLEAN NOT NULL DEFAULT TRUE,
  -- Tautan opsional ke kelompok pelanggan, supaya harga khusus anggota
  -- berjalan lewat mekanisme POS yang sudah ada.
  customer_group_id UUID REFERENCES "{{TENANT_SCHEMA}}".customer_group (id) ON DELETE SET NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_coop_member_category_code UNIQUE (cooperative_id, code)
);

ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_member
  DROP CONSTRAINT IF EXISTS fk_coop_member_category;
ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_member
  ADD CONSTRAINT fk_coop_member_category
  FOREIGN KEY (member_category_id)
  REFERENCES "{{TENANT_SCHEMA}}".cooperative_member_category (id) ON DELETE SET NULL;

-- Penugasan jabatan ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_appointment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  term_id         UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_organization_term (id) ON DELETE SET NULL,
  position_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_board_position (id) ON DELETE RESTRICT,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,
  employee_id     UUID REFERENCES "{{TENANT_SCHEMA}}".employee (id) ON DELETE SET NULL,
  appointed_from  DATE NOT NULL,
  appointed_until DATE,
  decided_by_meeting_id UUID,
  status          VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_appointment_status CHECK (status IN ('ACTIVE', 'ENDED', 'REVOKED')),
  CONSTRAINT ck_coop_appointment_period
    CHECK (appointed_until IS NULL OR appointed_until >= appointed_from)
);

/*
 * Satu jabatan hanya boleh dipangku satu orang pada satu waktu.
 *
 * Ditegakkan basis data dengan exclusion constraint, bukan hanya layanan:
 * jabatan Ketua menentukan siapa yang sah menandatangani perjanjian pinjaman,
 * dan dua ketua pada satu tanggal berarti dua tanda tangan yang sama-sama
 * tampak sah. Aturan sepenting itu tidak boleh bergantung pada satu jalur kode
 * yang kebetulan memeriksanya.
 */
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_appointment
  DROP CONSTRAINT IF EXISTS ex_coop_appointment_no_overlap;
ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_appointment
  ADD CONSTRAINT ex_coop_appointment_no_overlap
  EXCLUDE USING gist (
    position_id WITH =,
    daterange(appointed_from, COALESCE(appointed_until, DATE '9999-12-31'), '[]') WITH &&
  )
  WHERE (status = 'ACTIVE' AND deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS ix_coop_appointment_member
  ON "{{TENANT_SCHEMA}}".cooperative_appointment (member_id, status);

-- Dokumen, persetujuan, KYC, ahli waris -------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_document (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  document_type   VARCHAR(32) NOT NULL,
  document_number VARCHAR(120),
  file_id         UUID,
  verified_at     TIMESTAMPTZ,
  verified_by     UUID,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_member_document_type
    CHECK (document_type IN ('IDENTITY_CARD', 'FAMILY_CARD', 'TAX_ID', 'PHOTO',
                             'SIGNATURE', 'EMPLOYMENT_LETTER', 'BUSINESS_PERMIT', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS ix_coop_member_document_member
  ON "{{TENANT_SCHEMA}}".cooperative_member_document (member_id, document_type);

-- Persetujuan pemakaian data.
-- Persetujuan yang tidak tercatat berarti TIDAK ADA — bukan berarti boleh.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_consent (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  purpose         VARCHAR(48) NOT NULL,
  granted         BOOLEAN NOT NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  channel         VARCHAR(24),
  evidence_file_id UUID,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_member_consent_purpose
    CHECK (purpose IN ('CREDIT_SCORING', 'MARKETING', 'THIRD_PARTY_SHARING',
                       'DATA_PROCESSING', 'PHOTO_PUBLICATION'))
);

CREATE INDEX IF NOT EXISTS ix_coop_member_consent_member
  ON "{{TENANT_SCHEMA}}".cooperative_member_consent (member_id, purpose);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_beneficiary (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  relationship    VARCHAR(48) NOT NULL,
  identity_number VARCHAR(64),
  phone           VARCHAR(48),
  share_percent   NUMERIC(5,2) NOT NULL DEFAULT 100,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_beneficiary_share
    CHECK (share_percent > 0 AND share_percent <= 100)
);

CREATE INDEX IF NOT EXISTS ix_coop_beneficiary_member
  ON "{{TENANT_SCHEMA}}".cooperative_member_beneficiary (member_id);

-- Hubungan keluarga antar anggota dan pengurus ------------------------------
--
-- Diperlukan aturan pemisahan wewenang nomor 6: petugas pinjaman tidak boleh
-- memproses pinjaman untuk keluarganya. Tanpa tabel ini, benturan kepentingan
-- hanya dapat ditangkap manusia yang kebetulan mengenali nama.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_related_party (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  related_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  related_user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  relationship    VARCHAR(48) NOT NULL,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_related_party_target
    CHECK (related_member_id IS NOT NULL OR related_user_subject_id IS NOT NULL),
  CONSTRAINT ck_coop_related_party_not_self
    CHECK (related_member_id IS NULL OR related_member_id <> member_id)
);

CREATE INDEX IF NOT EXISTS ix_coop_related_party_member
  ON "{{TENANT_SCHEMA}}".cooperative_related_party (member_id);
CREATE INDEX IF NOT EXISTS ix_coop_related_party_subject
  ON "{{TENANT_SCHEMA}}".cooperative_related_party (related_user_subject_id)
  WHERE related_user_subject_id IS NOT NULL;

-- Riwayat status keanggotaan ------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  from_status     VARCHAR(32),
  to_status       VARCHAR(32) NOT NULL,
  reason          TEXT,
  actor_user_id   UUID,
  active_role_id  UUID,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_coop_member_status_history
  ON "{{TENANT_SCHEMA}}".cooperative_member_status_history (member_id, occurred_at);

-- Akun portal anggota -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_portal_account (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  -- PIN disimpan sebagai hash Argon2id, sama dengan kata sandi. TIDAK PERNAH
  -- plaintext, dan tidak pernah terlihat kasir. Spesifikasi §14.
  pin_hash        VARCHAR(255),
  pin_set_at      TIMESTAMPTZ,
  pin_failed_count INTEGER NOT NULL DEFAULT 0,
  pin_locked_until TIMESTAMPTZ,
  activated_at    TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  status          VARCHAR(24) NOT NULL DEFAULT 'INACTIVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_portal_status CHECK (status IN ('INACTIVE', 'ACTIVE', 'LOCKED', 'DISABLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_portal_member
  ON "{{TENANT_SCHEMA}}".cooperative_member_portal_account (member_id);
