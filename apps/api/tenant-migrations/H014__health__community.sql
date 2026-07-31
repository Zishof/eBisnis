-- =========================================================================
-- H014 — PUSKESMAS DAN POSYANDU
-- =========================================================================
--
-- Fase H-8. Aditif seluruhnya.
--
-- Dua hal menentukan bentuk seluruh berkas ini.
--
-- 1. **Tabel rujukan pertumbuhan WHO adalah DATA, bukan kode.** Ia disemai ke
--    `growth_reference` dan dimuat layanan saat menghitung. Menanam angka hasil
--    taksiran di dalam kode akan menghasilkan klasifikasi stunting yang tampak
--    resmi dan sebenarnya karangan — dan klasifikasi itu dipakai menentukan
--    siapa menerima bantuan pangan. Bila barisnya tidak ada, jawabannya "belum
--    dapat dinilai", bukan "normal".
--
-- 2. **Imunisasi yang diberikan terlalu cepat tidak boleh tercatat sebagai
--    diberikan.** Anak yang tercatat lengkap tetapi tidak terlindungi jauh
--    lebih berbahaya daripada anak yang tercatat belum lengkap: yang kedua akan
--    dikejar petugas, yang pertama tidak. Constraint menegakkan bahwa tanggal
--    pemberian tidak mendahului umur minimum jadwalnya.

-- ---------------------------------------------------------------------------
-- Folder keluarga
-- ---------------------------------------------------------------------------
-- Puskesmas bekerja pada keluarga, bukan pada individu yang kebetulan datang.
-- Anak yang gizinya buruk hampir selalu punya saudara yang gizinya juga buruk,
-- dan kunjungan rumah yang hanya menyasar satu anak akan melewati yang lain.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".family_folder (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  folder_number     VARCHAR(64) NOT NULL,
  head_patient_id   UUID REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  family_card_number VARCHAR(32),
  address_text      TEXT,
  rt                VARCHAR(8),
  rw                VARCHAR(8),
  village           VARCHAR(120),
  posyandu_name     VARCHAR(120),
  -- Penanda keluarga berisiko. Bukan tuduhan: ia penentu prioritas kunjungan.
  is_high_risk      BOOLEAN NOT NULL DEFAULT FALSE,
  risk_note         TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_folder_number
  ON "{{TENANT_SCHEMA}}".family_folder (facility_id, folder_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_family_folder_area
  ON "{{TENANT_SCHEMA}}".family_folder (facility_id, village, rw, rt);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".family_member (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_folder_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".family_folder (id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  relationship    VARCHAR(32) NOT NULL DEFAULT 'OTHER',
  joined_at       DATE,
  left_at         DATE,
  left_reason     VARCHAR(32),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT family_member_left_valid CHECK (
    left_reason IS NULL OR left_reason IN ('MOVED', 'MARRIED', 'DIED', 'OTHER')
  ),
  CONSTRAINT family_member_left_needs_reason CHECK (left_at IS NULL OR left_reason IS NOT NULL)
);

-- Satu orang hanya menjadi anggota AKTIF pada satu folder keluarga.
-- Tanpa ini, anak yang pindah rumah akan terhitung dua kali pada laporan
-- cakupan — dan cakupan yang menghitung ganda selalu tampak lebih baik.
CREATE UNIQUE INDEX IF NOT EXISTS ux_family_member_one_active
  ON "{{TENANT_SCHEMA}}".family_member (patient_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_family_member_folder
  ON "{{TENANT_SCHEMA}}".family_member (family_folder_id);

-- ---------------------------------------------------------------------------
-- Tabel rujukan pertumbuhan
-- ---------------------------------------------------------------------------
-- Bentuk LMS, seperti yang dipakai WHO sendiri. Menyimpan persentil jadi akan
-- kehilangan kemampuan menghitung z-score di antara persentil yang tersedia.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".growth_reference (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator       VARCHAR(24) NOT NULL,
  sex             VARCHAR(8) NOT NULL,
  -- Umur dalam bulan, atau panjang/tinggi dalam cm untuk WEIGHT_FOR_HEIGHT.
  x_value         NUMERIC(8,2) NOT NULL,
  l_value         NUMERIC(12,6) NOT NULL,
  m_value         NUMERIC(12,6) NOT NULL,
  s_value         NUMERIC(12,6) NOT NULL,
  source          VARCHAR(64) NOT NULL DEFAULT 'WHO_2006',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT growth_ref_indicator_valid CHECK (
    indicator IN ('WEIGHT_FOR_AGE', 'HEIGHT_FOR_AGE', 'WEIGHT_FOR_HEIGHT', 'BMI_FOR_AGE')
  ),
  CONSTRAINT growth_ref_sex_valid CHECK (sex IN ('MALE', 'FEMALE')),
  -- Median dan simpangan wajib positif. Baris dengan M atau S nol akan membuat
  -- rumus z menghasilkan tak hingga, dan tak hingga yang lolos ke laporan
  -- stunting akan terbaca sebagai gizi buruk berat.
  CONSTRAINT growth_ref_positive CHECK (m_value > 0 AND s_value > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_growth_reference
  ON "{{TENANT_SCHEMA}}".growth_reference (indicator, sex, x_value, source);

-- ---------------------------------------------------------------------------
-- Pengukuran pertumbuhan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".growth_measurement (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  family_folder_id  UUID REFERENCES "{{TENANT_SCHEMA}}".family_folder (id) ON DELETE RESTRICT,
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  measured_by       UUID,
  posyandu_name     VARCHAR(120),

  age_months        NUMERIC(6,2) NOT NULL,
  weight_kg         NUMERIC(6,2),
  height_cm         NUMERIC(6,1),
  /*
   * Cara pengukuran DISIMPAN, tidak disimpulkan dari umur.
   *
   * Berbaring dan berdiri berselisih sekitar 0,7 cm — cukup untuk memindahkan
   * anak melintasi ambang −2 simpangan baku, dan ambang itulah yang menentukan
   * ia masuk hitungan stunting atau tidak. Nilai yang sudah dibetulkan disimpan
   * pada `height_cm`; yang asli pada `height_raw_cm`, supaya pembetulannya
   * dapat ditelusuri.
   */
  height_measured_as VARCHAR(16),
  height_raw_cm     NUMERIC(6,1),
  height_adjusted   BOOLEAN NOT NULL DEFAULT FALSE,
  head_circumference_cm NUMERIC(6,1),
  muac_cm           NUMERIC(6,1),

  -- Hasil penilaian DISIMPAN, bukan dihitung ulang saat dibaca. Tabel rujukan
  -- akan diperbarui; pengukuran tahun lalu harus tetap dapat dijelaskan dengan
  -- rujukan tahun lalu.
  waz               NUMERIC(8,3),
  haz               NUMERIC(8,3),
  whz               NUMERIC(8,3),
  waz_status        VARCHAR(32),
  haz_status        VARCHAR(32),
  whz_status        VARCHAR(32),
  reference_source  VARCHAR(64),
  weight_flat_count SMALLINT,

  note              TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT growth_measure_age_valid CHECK (age_months >= 0 AND age_months <= 300),
  CONSTRAINT growth_measure_positive CHECK (
    (weight_kg IS NULL OR weight_kg > 0) AND (height_cm IS NULL OR height_cm > 0)
  ),
  CONSTRAINT growth_measure_how_valid CHECK (
    height_measured_as IS NULL OR height_measured_as IN ('RECUMBENT', 'STANDING')
  ),
  -- Tinggi yang tercatat wajib menyebut cara pengukurannya. Tanpa itu,
  -- pembetulan 0,7 cm tidak dapat dilakukan maupun ditelusuri.
  CONSTRAINT growth_measure_height_needs_method CHECK (
    height_cm IS NULL OR height_measured_as IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_growth_measure_patient
  ON "{{TENANT_SCHEMA}}".growth_measurement (patient_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS ix_growth_measure_flagged
  ON "{{TENANT_SCHEMA}}".growth_measurement (facility_id, measured_at DESC)
  WHERE haz_status IN ('STUNTED', 'SEVERELY_STUNTED')
     OR whz_status IN ('WASTED', 'SEVERELY_WASTED');

-- Pengukuran tidak dapat diubah maupun dihapus. Grafik pertumbuhan yang dapat
-- disunting bukan grafik pertumbuhan; ia gambar.
DROP TRIGGER IF EXISTS trg_growth_measure_immutable ON "{{TENANT_SCHEMA}}".growth_measurement;
CREATE TRIGGER trg_growth_measure_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".growth_measurement
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Jadwal dan catatan imunisasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".immunization_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaccine_code      VARCHAR(48) NOT NULL,
  vaccine_name      VARCHAR(160) NOT NULL,
  dose_number       SMALLINT NOT NULL,
  -- Umur paling awal boleh diberikan. Batas keamanan.
  min_age_days      INTEGER NOT NULL DEFAULT 0,
  -- Umur yang dianjurkan. Kapan anak seharusnya SUDAH terlindungi.
  recommended_age_days INTEGER,
  min_interval_days INTEGER,
  route             VARCHAR(32),
  site              VARCHAR(48),
  is_mandatory      BOOLEAN NOT NULL DEFAULT TRUE,
  program_code      VARCHAR(48),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT immunization_dose_positive CHECK (dose_number >= 1),
  CONSTRAINT immunization_age_non_negative CHECK (min_age_days >= 0),
  -- Umur anjuran tidak boleh mendahului umur minimum. Bila itu terjadi, setiap
  -- anak akan tampak tertunggak sejak hari ia boleh divaksin.
  CONSTRAINT immunization_recommended_after_min CHECK (
    recommended_age_days IS NULL OR recommended_age_days >= min_age_days
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_immunization_schedule
  ON "{{TENANT_SCHEMA}}".immunization_schedule (vaccine_code, dose_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".immunization_record (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  schedule_id       UUID REFERENCES "{{TENANT_SCHEMA}}".immunization_schedule (id) ON DELETE RESTRICT,
  vaccine_code      VARCHAR(48) NOT NULL,
  dose_number       SMALLINT NOT NULL,
  given_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  given_by          UUID,
  -- Umur anak saat diberikan, DISIMPAN. Menghitungnya ulang saat dibaca akan
  -- berubah bila tanggal lahirnya kelak dibetulkan, dan catatan imunisasi yang
  -- berubah sendiri tidak dapat dipakai membuktikan apa pun.
  age_days_at_dose  INTEGER,
  batch_number      VARCHAR(64),
  expiry_date       DATE,
  site              VARCHAR(48),
  route             VARCHAR(32),
  adverse_event     TEXT,
  posyandu_name     VARCHAR(120),
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT immunization_record_dose_positive CHECK (dose_number >= 1),
  CONSTRAINT immunization_record_age_non_negative CHECK (
    age_days_at_dose IS NULL OR age_days_at_dose >= 0
  )
);

-- Satu dosis vaksin hanya dicatat sekali per anak. Dosis yang tercatat dua kali
-- akan membuat cakupan tampak lebih baik daripada kenyataannya.
CREATE UNIQUE INDEX IF NOT EXISTS ux_immunization_record_dose
  ON "{{TENANT_SCHEMA}}".immunization_record (patient_id, vaccine_code, dose_number);
CREATE INDEX IF NOT EXISTS ix_immunization_record_patient
  ON "{{TENANT_SCHEMA}}".immunization_record (patient_id, given_at DESC);

-- Catatan imunisasi tidak dapat dihapus. Ia dasar keputusan memberikan dosis
-- berikutnya; menghapusnya akan membuat anak menerima dosis yang sama dua kali.
DROP TRIGGER IF EXISTS trg_immunization_record_no_delete ON "{{TENANT_SCHEMA}}".immunization_record;
CREATE TRIGGER trg_immunization_record_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".immunization_record
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Sasaran dan cakupan program
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".community_program_target (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  program_code    VARCHAR(48) NOT NULL,
  program_name    VARCHAR(160) NOT NULL,
  period_year     SMALLINT NOT NULL,
  period_month    SMALLINT,
  village         VARCHAR(120),
  /*
   * Penyebutnya SASARAN, bukan yang datang.
   *
   * Menghitung "berapa persen yang datang sudah diimunisasi" akan selalu
   * mendekati seratus persen dan tidak memberi tahu apa pun — yang perlu
   * diketahui justru berapa banyak yang tidak pernah datang.
   */
  target_count    INTEGER NOT NULL,
  achieved_count  INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT program_target_positive CHECK (target_count > 0),
  CONSTRAINT program_target_achieved_non_negative CHECK (achieved_count >= 0),
  CONSTRAINT program_target_month_valid CHECK (
    period_month IS NULL OR (period_month >= 1 AND period_month <= 12)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_program_target
  ON "{{TENANT_SCHEMA}}".community_program_target
     (facility_id, program_code, period_year, COALESCE(period_month, 0), COALESCE(village, ''));

-- ---------------------------------------------------------------------------
-- Kunjungan rumah
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".home_visit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_folder_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".family_folder (id) ON DELETE RESTRICT,
  patient_id        UUID REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  visited_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  visited_by        UUID,
  reason            VARCHAR(48) NOT NULL,
  findings          TEXT,
  action_taken      TEXT,
  referred          BOOLEAN NOT NULL DEFAULT FALSE,
  referred_to       VARCHAR(160),
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT home_visit_reason_valid CHECK (
    reason IN ('SEVERE_WASTING', 'WEIGHT_FLAT', 'STUNTING', 'IMMUNIZATION_OVERDUE',
               'HIGH_RISK_FAMILY', 'FOLLOW_UP', 'OTHER')
  ),
  CONSTRAINT home_visit_referral_needs_target CHECK (referred = FALSE OR referred_to IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_home_visit_folder
  ON "{{TENANT_SCHEMA}}".home_visit (family_folder_id, visited_at DESC);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['family_folder', 'family_member', 'growth_reference',
                           'growth_measurement', 'immunization_schedule',
                           'immunization_record', 'community_program_target', 'home_visit'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
