-- Kernel pendidikan: kalender, program, peserta didik, dan keikutsertaan.
--
-- Diterapkan ke schema `{username}_education`, bukan ke schema inti. Vertical
-- merujuk tabel di sini; tidak ada vertical yang merujuk tabel vertical lain.
--
-- Yang dibangun lebih dahulu adalah yang dituntut billing. `education_enrollment`
-- menjadi sumber Billable Learner Month (BRD §187.3), dan tanpa riwayat status
-- yang dapat dipercaya, tagihan langganan tidak dapat dijelaskan kepada tenant
-- yang menyanggahnya.

-- --------------------------------------------------------------------------
-- Kalender akademik
-- --------------------------------------------------------------------------
--
-- Bukan tahun fiskal. Tahun ajaran 2026/2027 dimulai Juli dan berakhir Juni;
-- menyamakannya dengan periode akuntansi membuat laporan akademik terpotong di
-- tengah semester.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".education_academic_year (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID,
  code            VARCHAR(32)  NOT NULL,
  name            VARCHAR(128) NOT NULL,
  start_date      DATE         NOT NULL,
  end_date        DATE         NOT NULL,
  status          VARCHAR(24)  NOT NULL DEFAULT 'DRAFT',
  is_sample       BOOLEAN      NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT ck_education_academic_year_period CHECK (end_date > start_date),
  CONSTRAINT ck_education_academic_year_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS education_academic_year_code_key
  ON "{{TENANT_SCHEMA}}".education_academic_year (institution_id, code)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".education_academic_period (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID         NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".education_academic_year (id) ON DELETE RESTRICT,
  period_type      VARCHAR(24)  NOT NULL,
  sequence         INTEGER      NOT NULL,
  code             VARCHAR(32)  NOT NULL,
  name             VARCHAR(128) NOT NULL,
  start_date       DATE         NOT NULL,
  end_date         DATE         NOT NULL,
  status           VARCHAR(24)  NOT NULL DEFAULT 'DRAFT',
  is_sample        BOOLEAN      NOT NULL DEFAULT FALSE,
  sample_batch_id  UUID,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by       UUID,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ,
  version          INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT ck_education_academic_period_range CHECK (end_date > start_date),
  CONSTRAINT ck_education_academic_period_type
    CHECK (period_type IN ('SEMESTER', 'TERM', 'QUARTER', 'YEAR', 'MARHALAH')),
  CONSTRAINT ck_education_academic_period_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS education_academic_period_seq_key
  ON "{{TENANT_SCHEMA}}".education_academic_period (academic_year_id, sequence)
  WHERE deleted_at IS NULL;

-- --------------------------------------------------------------------------
-- Program pendidikan
-- --------------------------------------------------------------------------
--
-- Prodi pada kampus, jenjang pada sekolah, marhalah pada pesantren. Satu tabel
-- kernel karena keikutsertaan, kurikulum, dan kelulusan bekerja sama untuk
-- ketiganya; yang khas per vertical menempel lewat tabel vertical.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".education_program (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID,
  program_type    VARCHAR(24)  NOT NULL,
  code            VARCHAR(64)  NOT NULL,
  name            VARCHAR(255) NOT NULL,
  education_level VARCHAR(32),
  status          VARCHAR(24)  NOT NULL DEFAULT 'ACTIVE',
  is_sample       BOOLEAN      NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT ck_education_program_type
    CHECK (program_type IN ('STUDY_PROGRAM', 'SCHOOL_LEVEL', 'PESANTREN_UNIT')),
  CONSTRAINT ck_education_program_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'CLOSED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS education_program_code_key
  ON "{{TENANT_SCHEMA}}".education_program (institution_id, code)
  WHERE deleted_at IS NULL;

-- --------------------------------------------------------------------------
-- Peserta didik
-- --------------------------------------------------------------------------
--
-- Supertype. Satu baris per (orang, institusi, jenis peserta), sehingga santri
-- yang juga siswa pada yayasan yang sama TIDAK menghasilkan dua biodata manusia.
--
-- `person_id` menunjuk `Person` di schema inti. Tidak ada foreign key lintas
-- schema: rujukannya ditegakkan aplikasi, sebab FK lintas schema mengikat urutan
-- penghapusan schema dan membuat penonaktifan modul mustahil tanpa menyentuh inti.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".education_learner_profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID         NOT NULL,
  institution_id  UUID,
  learner_type    VARCHAR(24)  NOT NULL,
  entry_date      DATE,
  status          VARCHAR(24)  NOT NULL DEFAULT 'PROSPECT',
  is_sample       BOOLEAN      NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT ck_education_learner_type
    CHECK (learner_type IN ('STUDENT', 'PUPIL', 'SANTRI')),
  CONSTRAINT ck_education_learner_status
    CHECK (status IN ('PROSPECT', 'ACTIVE', 'ON_LEAVE', 'GRADUATED', 'EXITED', 'MERGED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS education_learner_profile_person_key
  ON "{{TENANT_SCHEMA}}".education_learner_profile (person_id, institution_id, learner_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS education_learner_profile_status_idx
  ON "{{TENANT_SCHEMA}}".education_learner_profile (status)
  WHERE deleted_at IS NULL;

-- Nomor induk berjenjang waktu, bukan kolom tunggal.
--
-- NIM/NIS/NISN berubah karena mutasi, pindah prodi, atau koreksi Dapodik.
-- Menyimpannya sebagai satu kolom menghapus jejak nomor lama — yang masih
-- tercetak pada rapor dan ijazah yang sudah dibagikan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".education_learner_identifier_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      UUID         NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".education_learner_profile (id) ON DELETE CASCADE,
  identifier_type VARCHAR(24)  NOT NULL,
  value           VARCHAR(64)  NOT NULL,
  valid_from      DATE         NOT NULL DEFAULT CURRENT_DATE,
  valid_to        DATE,
  reason          TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by      UUID,
  CONSTRAINT ck_education_identifier_type
    CHECK (identifier_type IN ('NIM', 'NIS', 'NISN', 'SANTRI_NO', 'LOCAL')),
  CONSTRAINT ck_education_identifier_period CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Satu nomor berlaku untuk satu peserta pada satu waktu.
CREATE UNIQUE INDEX IF NOT EXISTS education_learner_identifier_active_key
  ON "{{TENANT_SCHEMA}}".education_learner_identifier_history (identifier_type, value)
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS education_learner_identifier_learner_idx
  ON "{{TENANT_SCHEMA}}".education_learner_identifier_history (learner_id, identifier_type);

-- --------------------------------------------------------------------------
-- Keikutsertaan — sumber Billable Learner Month
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".education_enrollment (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id         UUID         NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".education_learner_profile (id) ON DELETE RESTRICT,
  program_id         UUID         NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".education_program (id) ON DELETE RESTRICT,
  academic_period_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".education_academic_period (id) ON DELETE RESTRICT,
  cohort             VARCHAR(32),
  status             VARCHAR(24)  NOT NULL DEFAULT 'DRAFT',
  activated_at       DATE,
  exited_at          DATE,
  is_sample          BOOLEAN      NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by         UUID,
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by         UUID,
  deleted_at         TIMESTAMPTZ,
  version            INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT ck_education_enrollment_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'ON_LEAVE', 'ON_LEAVE_BILLABLE',
                      'GRADUATED', 'EXITED', 'CANCELLED')),
  /*
   * Keikutsertaan aktif WAJIB punya tanggal aktif.
   *
   * Tanpa ini, satu baris berstatus ACTIVE tanpa tanggal ikut terhitung pada
   * snapshot harian tanpa ada yang tahu sejak kapan ia seharusnya ditagih —
   * dan sengketa tagihan pertama tidak dapat dijawab.
   */
  CONSTRAINT ck_education_enrollment_activated
    CHECK (status NOT IN ('ACTIVE', 'ON_LEAVE', 'ON_LEAVE_BILLABLE') OR activated_at IS NOT NULL),
  CONSTRAINT ck_education_enrollment_exit
    CHECK (exited_at IS NULL OR activated_at IS NULL OR exited_at >= activated_at)
);

CREATE INDEX IF NOT EXISTS education_enrollment_learner_idx
  ON "{{TENANT_SCHEMA}}".education_enrollment (learner_id)
  WHERE deleted_at IS NULL;

-- Dipakai snapshot harian metering: baris yang billable pada satu tanggal.
CREATE INDEX IF NOT EXISTS education_enrollment_billable_idx
  ON "{{TENANT_SCHEMA}}".education_enrollment (status, activated_at, exited_at)
  WHERE deleted_at IS NULL AND is_sample = FALSE;

-- Riwayat status: append-only.
--
-- Billing membaca riwayat ini. Menimpa status berarti mengubah tagihan bulan
-- yang sudah terbit, dan tidak ada jejak yang menjelaskan mengapa angkanya
-- berubah.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".education_enrollment_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID        NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".education_enrollment (id) ON DELETE CASCADE,
  status        VARCHAR(24) NOT NULL,
  effective_at  DATE        NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID
);

CREATE INDEX IF NOT EXISTS education_enrollment_status_history_idx
  ON "{{TENANT_SCHEMA}}".education_enrollment_status_history (enrollment_id, effective_at);

COMMENT ON TABLE "{{TENANT_SCHEMA}}".education_enrollment IS
  'Keikutsertaan peserta pada program. Sumber Billable Learner Month (BRD Versi 13 §187.3): hanya baris ACTIVE/ON_LEAVE_BILLABLE yang bukan sample dan belum keluar yang masuk hitungan langganan.';

COMMENT ON TABLE "{{TENANT_SCHEMA}}".education_enrollment_status_history IS
  'Append-only. Billing membaca riwayat ini; menimpa status mengubah tagihan bulan yang sudah terbit.';
