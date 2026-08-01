-- eSchool: murid, tingkat, rombel, penempatan, dan otoritas wali.
--
-- Diterapkan ke schema `{username}_eschool`.
--
-- Rujukan ke kernel (`education_learner_profile`, `education_academic_year`)
-- disimpan sebagai id tanpa foreign key: keduanya berada di schema berbeda, dan
-- FK lintas schema mengikat urutan penghapusan schema — menonaktifkan modul
-- sekolah lalu menjadi mustahil tanpa menyentuh kernel yang dipakai vertical lain.

-- --------------------------------------------------------------------------
-- Tingkat dan rombel
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".eschool_grade_level (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID,
  education_level VARCHAR(32)  NOT NULL,
  phase           VARCHAR(16),
  grade           INTEGER      NOT NULL,
  name            VARCHAR(128) NOT NULL,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  is_sample       BOOLEAN      NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT ck_eschool_grade_level_range CHECK (grade BETWEEN 0 AND 13),
  CONSTRAINT ck_eschool_education_level
    CHECK (education_level IN ('PAUD', 'TK', 'SD', 'MI', 'SMP', 'MTS',
                               'SMA', 'MA', 'SMK', 'PKBM'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eschool_grade_level_key
  ON "{{TENANT_SCHEMA}}".eschool_grade_level (institution_id, education_level, grade)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".eschool_homeroom_class (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level_id       UUID         NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".eschool_grade_level (id) ON DELETE RESTRICT,
  /** `education_academic_year.id` pada schema kernel. */
  academic_year_id     UUID         NOT NULL,
  code                 VARCHAR(32)  NOT NULL,
  name                 VARCHAR(128) NOT NULL,
  capacity             INTEGER,
  /** `Person.id` pada schema inti. */
  homeroom_teacher_id  UUID,
  status               VARCHAR(24)  NOT NULL DEFAULT 'ACTIVE',
  is_sample            BOOLEAN      NOT NULL DEFAULT FALSE,
  sample_batch_id      UUID,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by           UUID,
  deleted_at           TIMESTAMPTZ,
  version              INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT ck_eschool_homeroom_capacity CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT ck_eschool_homeroom_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eschool_homeroom_class_key
  ON "{{TENANT_SCHEMA}}".eschool_homeroom_class (academic_year_id, grade_level_id, code)
  WHERE deleted_at IS NULL;

-- --------------------------------------------------------------------------
-- Murid
-- --------------------------------------------------------------------------
--
-- Profil vertical. Biodata manusianya ada pada `Person` di schema inti, dan
-- kepesertaannya pada `education_learner_profile` di schema kernel. Yang di sini
-- hanyalah yang khas sekolah.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".eschool_pupil_profile (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  /** `education_learner_profile.id` pada schema kernel. */
  learner_profile_id UUID        NOT NULL,
  nis                VARCHAR(32),
  nisn               VARCHAR(32),
  entry_grade_id     UUID
    REFERENCES "{{TENANT_SCHEMA}}".eschool_grade_level (id) ON DELETE RESTRICT,
  entry_type         VARCHAR(24) NOT NULL DEFAULT 'NEW',
  is_sample          BOOLEAN     NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID,
  deleted_at         TIMESTAMPTZ,
  version            INTEGER     NOT NULL DEFAULT 1,
  CONSTRAINT ck_eschool_pupil_entry_type
    CHECK (entry_type IN ('NEW', 'TRANSFER_IN', 'REPEAT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eschool_pupil_profile_learner_key
  ON "{{TENANT_SCHEMA}}".eschool_pupil_profile (learner_profile_id)
  WHERE deleted_at IS NULL;

-- NISN diterbitkan pusat dan unik secara nasional. Dua murid dengan NISN sama
-- pada satu sekolah berarti salah satunya salah ketik — dan yang salah ketik
-- akan dikirim ke Dapodik.
CREATE UNIQUE INDEX IF NOT EXISTS eschool_pupil_profile_nisn_key
  ON "{{TENANT_SCHEMA}}".eschool_pupil_profile (nisn)
  WHERE deleted_at IS NULL AND nisn IS NOT NULL;

-- --------------------------------------------------------------------------
-- Penempatan: riwayat, bukan kolom
-- --------------------------------------------------------------------------
--
-- Rombel murid berubah setiap tahun, dan rapor semester lalu milik rombel lama.
-- Menyimpannya sebagai kolom pada murid membuat rapor lama menunjuk wali kelas
-- yang tidak pernah mengajarnya.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".eschool_pupil_placement (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id           UUID        NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".eschool_pupil_profile (id) ON DELETE CASCADE,
  homeroom_class_id  UUID        NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".eschool_homeroom_class (id) ON DELETE RESTRICT,
  start_date         DATE        NOT NULL,
  end_date           DATE,
  reason             TEXT,
  is_sample          BOOLEAN     NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID,
  CONSTRAINT ck_eschool_placement_period CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Satu murid berada pada satu rombel pada satu waktu.
CREATE UNIQUE INDEX IF NOT EXISTS eschool_pupil_placement_active_key
  ON "{{TENANT_SCHEMA}}".eschool_pupil_placement (pupil_id)
  WHERE end_date IS NULL;

CREATE INDEX IF NOT EXISTS eschool_pupil_placement_class_idx
  ON "{{TENANT_SCHEMA}}".eschool_pupil_placement (homeroom_class_id)
  WHERE end_date IS NULL;

-- --------------------------------------------------------------------------
-- Otoritas wali — sumber kebenaran cakupan GUARDIAN_CHILD
-- --------------------------------------------------------------------------
--
-- Tabel paling menentukan keamanannya pada berkas ini.
--
-- Ia satu-satunya yang menjawab "anak mana yang boleh dilihat wali ini", dan
-- jawabannya dipakai setiap permintaan portal wali. Ia BERTANGGAL BERLAKU karena
-- hak asuh dapat berubah: portal harus mengikuti keadaan yang berlaku saat
-- diakses, bukan keadaan saat tautannya dibuat.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".eschool_guardian_authority (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  /** `Person.id` wali, pada schema inti. */
  guardian_person_id  UUID        NOT NULL,
  pupil_id            UUID        NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".eschool_pupil_profile (id) ON DELETE CASCADE,
  relationship        VARCHAR(24) NOT NULL,
  authority_type      VARCHAR(24) NOT NULL DEFAULT 'VIEW',
  valid_from          DATE        NOT NULL DEFAULT CURRENT_DATE,
  valid_to            DATE,
  revoked_reason      TEXT,
  is_sample           BOOLEAN     NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  version             INTEGER     NOT NULL DEFAULT 1,
  CONSTRAINT ck_eschool_guardian_relationship
    CHECK (relationship IN ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'SIBLING', 'OTHER')),
  /*
   * `VIEW` hanya melihat; `MANAGE` boleh mengajukan izin dan mengubah kontak.
   * Tidak ada tingkat yang membolehkan wali mengubah nilai atau presensi —
   * tingkat semacam itu tidak dapat dibuat tanpa mengubah constraint ini.
   */
  CONSTRAINT ck_eschool_guardian_authority_type
    CHECK (authority_type IN ('VIEW', 'MANAGE')),
  CONSTRAINT ck_eschool_guardian_period CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Satu wali punya satu otoritas berlaku atas satu murid.
CREATE UNIQUE INDEX IF NOT EXISTS eschool_guardian_authority_active_key
  ON "{{TENANT_SCHEMA}}".eschool_guardian_authority (guardian_person_id, pupil_id)
  WHERE valid_to IS NULL;

-- Dipakai setiap permintaan portal wali: "anak mana milik wali ini, hari ini".
CREATE INDEX IF NOT EXISTS eschool_guardian_authority_lookup_idx
  ON "{{TENANT_SCHEMA}}".eschool_guardian_authority (guardian_person_id, valid_from, valid_to);

COMMENT ON TABLE "{{TENANT_SCHEMA}}".eschool_guardian_authority IS
  'Sumber kebenaran cakupan data GUARDIAN_CHILD. Bertanggal berlaku: hak asuh dapat berubah, dan portal wali wajib mengikuti keadaan yang berlaku saat diakses.';

COMMENT ON TABLE "{{TENANT_SCHEMA}}".eschool_pupil_placement IS
  'Riwayat penempatan rombel. Bukan kolom pada murid — rapor semester lalu milik rombel lama.';
