-- =========================================================================
-- H004 — KUNJUNGAN, DOKUMENTASI KLINIS, DAN ORDER
-- =========================================================================
--
-- Fase H-3. Aditif seluruhnya.
--
-- Satu aturan menentukan bentuk seluruh berkas ini: **catatan klinis yang sudah
-- ditandatangani tidak dapat diubah.** Perubahan menjadi amandemen tersendiri
-- yang juga ditandatangani, dan yang asli tetap terbaca.
--
-- Dokumentasi yang dapat disunting diam-diam tidak bernilai — baik sebagai
-- bukti hukum maupun sebagai dasar keputusan medis berikutnya. Dokter yang
-- membaca catatan kemarin harus tahu bahwa yang dibacanya memang yang ditulis
-- kemarin, bukan yang disesuaikan tadi pagi setelah pasien memburuk.
--
-- Ditegakkan pemicu basis data, bukan layanan, mengikuti pola penjaga
-- journal_entry POSTED pada V008.

-- ---------------------------------------------------------------------------
-- Alergi — data keselamatan tingkat PASIEN, bukan tingkat kunjungan
-- ---------------------------------------------------------------------------
-- Diletakkan pertama karena inilah yang paling berbahaya bila hilang. Alergi
-- yang tercatat pada kunjungan akan tidak terlihat pada kunjungan berikutnya,
-- dan obat yang mematikan pasien akan diresepkan oleh dokter yang tidak pernah
-- melihat catatannya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_allergy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  allergen_type   VARCHAR(24) NOT NULL,
  allergen_code   VARCHAR(64),
  allergen_name   VARCHAR(180) NOT NULL,
  reaction        TEXT,
  severity        VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  -- Seberapa yakin. Alergi yang dilaporkan pasien berbeda dari yang terbukti
  -- uji; keduanya harus dicatat, tetapi tidak boleh disamakan.
  certainty       VARCHAR(16) NOT NULL DEFAULT 'REPORTED',
  onset_date      DATE,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     UUID,
  -- Alergi tidak dihapus, hanya dinyatakan tidak berlaku lagi beserta
  -- alasannya. Menghapusnya menghilangkan jejak bahwa ia pernah dicurigai.
  refuted_at      TIMESTAMPTZ,
  refuted_by      UUID,
  refute_reason   TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT patient_allergy_type_valid CHECK (
    allergen_type IN ('DRUG', 'FOOD', 'ENVIRONMENT', 'LATEX', 'OTHER')
  ),
  CONSTRAINT patient_allergy_severity_valid CHECK (
    severity IN ('MILD', 'MODERATE', 'SEVERE', 'FATAL', 'UNKNOWN')
  ),
  CONSTRAINT patient_allergy_certainty_valid CHECK (
    certainty IN ('SUSPECTED', 'REPORTED', 'CONFIRMED')
  )
);

CREATE INDEX IF NOT EXISTS ix_patient_allergy_active
  ON "{{TENANT_SCHEMA}}".patient_allergy (patient_id)
  WHERE refuted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Kunjungan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_encounter (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  registration_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_registration (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  service_unit_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,
  provider_id       UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  encounter_number  VARCHAR(64) NOT NULL,
  encounter_type    VARCHAR(24) NOT NULL DEFAULT 'OUTPATIENT',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  status            VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
  chief_complaint   TEXT,
  disposition       VARCHAR(32),
  -- Penandaan kepekaan pada tingkat kunjungan. Kunjungan kesehatan jiwa,
  -- kekerasan seksual, atau HIV ditandai sejak awal supaya penyaringan
  -- aksesnya tidak perlu menebak dari isinya.
  sensitivity       VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_encounter_type_valid CHECK (
    encounter_type IN ('OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'HOME_CARE',
                       'TELEMEDICINE', 'OUTREACH', 'POSYANDU')
  ),
  CONSTRAINT health_encounter_status_valid CHECK (
    status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'LEFT_WITHOUT_SEEN')
  ),
  CONSTRAINT health_encounter_sensitivity_valid CHECK (
    sensitivity IN ('NORMAL', 'RESTRICTED', 'VERY_RESTRICTED')
  ),
  CONSTRAINT health_encounter_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_encounter_number
  ON "{{TENANT_SCHEMA}}".health_encounter (encounter_number);
CREATE INDEX IF NOT EXISTS ix_health_encounter_patient
  ON "{{TENANT_SCHEMA}}".health_encounter (patient_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_health_encounter_open
  ON "{{TENANT_SCHEMA}}".health_encounter (facility_id, status)
  WHERE status = 'IN_PROGRESS';

-- ---------------------------------------------------------------------------
-- Catatan klinis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".clinical_note (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  note_type       VARCHAR(32) NOT NULL DEFAULT 'SOAP',
  -- SOAP dipisah menjadi empat kolom, bukan satu teks bebas. Alasannya bukan
  -- kerapian: pemeriksaan mutu rekam medis menghitung kelengkapan per bagian,
  -- dan satu teks bebas tidak dapat dinilai kelengkapannya.
  subjective      TEXT,
  objective       TEXT,
  assessment      TEXT,
  plan            TEXT,
  free_text       TEXT,

  -- --- Tanda tangan --------------------------------------------------------
  signed_at       TIMESTAMPTZ,
  signed_by       UUID,
  signed_by_provider_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  -- Amandemen menunjuk catatan yang digantikannya. Yang asli TIDAK diubah dan
  -- tetap terbaca; pembaca melihat keduanya beserta urutannya.
  amended_from_id UUID REFERENCES "{{TENANT_SCHEMA}}".clinical_note (id) ON DELETE RESTRICT,
  amendment_reason TEXT,

  sensitivity     VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT clinical_note_type_valid CHECK (
    note_type IN ('SOAP', 'PROGRESS', 'ADMISSION', 'DISCHARGE_SUMMARY', 'OPERATION',
                  'NURSING', 'CONSULTATION', 'TRIAGE', 'EDUCATION', 'OTHER')
  ),
  CONSTRAINT clinical_note_sensitivity_valid CHECK (
    sensitivity IN ('NORMAL', 'RESTRICTED', 'VERY_RESTRICTED')
  ),
  -- Tanda tangan harus lengkap: waktu dan penandatangan bersama-sama.
  -- Salah satu tanpa yang lain menghasilkan catatan yang tampak sah tetapi
  -- tidak dapat dipertanggungjawabkan siapa pun.
  CONSTRAINT clinical_note_signature_complete CHECK (
    (signed_at IS NULL AND signed_by IS NULL) OR
    (signed_at IS NOT NULL AND signed_by IS NOT NULL)
  ),
  -- Amandemen wajib beralasan. Perubahan catatan medis tanpa alasan tidak dapat
  -- dibedakan dari penyembunyian.
  CONSTRAINT clinical_note_amendment_needs_reason CHECK (
    amended_from_id IS NULL OR
    (amendment_reason IS NOT NULL AND length(trim(amendment_reason)) >= 10)
  ),
  CONSTRAINT clinical_note_not_own_amendment CHECK (
    amended_from_id IS NULL OR amended_from_id <> id
  )
);

CREATE INDEX IF NOT EXISTS ix_clinical_note_encounter
  ON "{{TENANT_SCHEMA}}".clinical_note (encounter_id, created_at);
CREATE INDEX IF NOT EXISTS ix_clinical_note_patient
  ON "{{TENANT_SCHEMA}}".clinical_note (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_clinical_note_amended
  ON "{{TENANT_SCHEMA}}".clinical_note (amended_from_id)
  WHERE amended_from_id IS NOT NULL;

-- --- Penjaga: catatan yang sudah ditandatangani tidak dapat diubah ----------
--
-- Yang diizinkan sesudah tanda tangan hanyalah penandaan bahwa catatan ini
-- telah diamandemen — dan itu pun tidak mengubah isinya.
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_signed_note_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $sn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.signed_at IS NOT NULL THEN
      RAISE EXCEPTION
        'CLINICAL_NOTE_IMMUTABLE: catatan klinis yang sudah ditandatangani tidak dapat dihapus. Buat amandemen.'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.signed_at IS NOT NULL THEN
    IF NEW.subjective   IS DISTINCT FROM OLD.subjective
    OR NEW.objective    IS DISTINCT FROM OLD.objective
    OR NEW.assessment   IS DISTINCT FROM OLD.assessment
    OR NEW.plan         IS DISTINCT FROM OLD.plan
    OR NEW.free_text    IS DISTINCT FROM OLD.free_text
    OR NEW.note_type    IS DISTINCT FROM OLD.note_type
    OR NEW.patient_id   IS DISTINCT FROM OLD.patient_id
    OR NEW.encounter_id IS DISTINCT FROM OLD.encounter_id
    OR NEW.signed_at    IS DISTINCT FROM OLD.signed_at
    OR NEW.signed_by    IS DISTINCT FROM OLD.signed_by THEN
      RAISE EXCEPTION
        'CLINICAL_NOTE_IMMUTABLE: isi catatan klinis yang sudah ditandatangani tidak dapat diubah. Buat amandemen yang menunjuk catatan ini.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$sn$;

DROP TRIGGER IF EXISTS trg_clinical_note_immutable ON "{{TENANT_SCHEMA}}".clinical_note;
CREATE TRIGGER trg_clinical_note_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".clinical_note
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_signed_note_mutation();

-- ---------------------------------------------------------------------------
-- Tanda vital
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".vital_sign (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  measured_by       UUID,
  systolic_mmhg     SMALLINT,
  diastolic_mmhg    SMALLINT,
  pulse_bpm         SMALLINT,
  respiratory_rate  SMALLINT,
  temperature_c     NUMERIC(4,1),
  spo2_percent      SMALLINT,
  weight_kg         NUMERIC(6,2),
  height_cm         NUMERIC(5,1),
  -- Lingkar kepala dan lingkar lengan atas dipakai Posyandu dan pemantauan
  -- gizi anak; tidak dipakai rawat jalan dewasa.
  head_circum_cm    NUMERIC(5,1),
  muac_cm           NUMERIC(5,1),
  pain_score        SMALLINT,
  note              TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  -- Batas kewajaran, bukan batas normal. Yang ditolak adalah angka yang
  -- MUSTAHIL — salah ketik, satuan tertukar, alat rusak. Angka yang tidak
  -- normal tetapi mungkin justru harus dapat dicatat: itulah pasien yang
  -- sedang gawat.
  CONSTRAINT vital_sign_systolic_plausible CHECK (systolic_mmhg IS NULL OR systolic_mmhg BETWEEN 30 AND 300),
  CONSTRAINT vital_sign_diastolic_plausible CHECK (diastolic_mmhg IS NULL OR diastolic_mmhg BETWEEN 10 AND 200),
  CONSTRAINT vital_sign_pulse_plausible CHECK (pulse_bpm IS NULL OR pulse_bpm BETWEEN 10 AND 300),
  CONSTRAINT vital_sign_rr_plausible CHECK (respiratory_rate IS NULL OR respiratory_rate BETWEEN 4 AND 100),
  CONSTRAINT vital_sign_temp_plausible CHECK (temperature_c IS NULL OR temperature_c BETWEEN 25 AND 45),
  CONSTRAINT vital_sign_spo2_plausible CHECK (spo2_percent IS NULL OR spo2_percent BETWEEN 30 AND 100),
  CONSTRAINT vital_sign_weight_plausible CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0.3 AND 500),
  CONSTRAINT vital_sign_height_plausible CHECK (height_cm IS NULL OR height_cm BETWEEN 20 AND 260),
  CONSTRAINT vital_sign_pain_range CHECK (pain_score IS NULL OR pain_score BETWEEN 0 AND 10),
  -- Sistolik harus di atas diastolik. Terbalik berarti salah ketik, dan
  -- tekanan darah terbalik yang tercatat akan dibaca sebagai syok.
  CONSTRAINT vital_sign_bp_ordered CHECK (
    systolic_mmhg IS NULL OR diastolic_mmhg IS NULL OR systolic_mmhg > diastolic_mmhg
  )
);

CREATE INDEX IF NOT EXISTS ix_vital_sign_patient
  ON "{{TENANT_SCHEMA}}".vital_sign (patient_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS ix_vital_sign_encounter
  ON "{{TENANT_SCHEMA}}".vital_sign (encounter_id, measured_at);

-- ---------------------------------------------------------------------------
-- Diagnosis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".encounter_diagnosis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  code_system     VARCHAR(24) NOT NULL DEFAULT 'ICD10',
  code            VARCHAR(24),
  -- Diagnosis boleh berupa teks saja sebelum dikodekan. Menuntut kode sejak
  -- awal akan memaksa dokter memilih kode yang kurang tepat demi menyimpan
  -- catatannya, dan koder kemudian tidak tahu apa yang sebenarnya dimaksud.
  description     TEXT NOT NULL,
  diagnosis_role  VARCHAR(16) NOT NULL DEFAULT 'SECONDARY',
  certainty       VARCHAR(16) NOT NULL DEFAULT 'CONFIRMED',
  onset_date      DATE,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT encounter_diagnosis_role_valid CHECK (
    diagnosis_role IN ('PRIMARY', 'SECONDARY', 'COMPLICATION', 'COMORBIDITY')
  ),
  CONSTRAINT encounter_diagnosis_certainty_valid CHECK (
    certainty IN ('SUSPECTED', 'PROVISIONAL', 'CONFIRMED', 'RULED_OUT')
  )
);

-- Satu kunjungan hanya punya satu diagnosis utama. Dua diagnosis utama membuat
-- pengodean casemix tidak dapat memutuskan mana yang menentukan tarif.
CREATE UNIQUE INDEX IF NOT EXISTS ux_encounter_diagnosis_primary
  ON "{{TENANT_SCHEMA}}".encounter_diagnosis (encounter_id)
  WHERE diagnosis_role = 'PRIMARY';

CREATE INDEX IF NOT EXISTS ix_encounter_diagnosis_patient
  ON "{{TENANT_SCHEMA}}".encounter_diagnosis (patient_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Order klinis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".clinical_order (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  order_number      VARCHAR(64) NOT NULL,
  order_type        VARCHAR(24) NOT NULL,
  order_code        VARCHAR(64),
  order_name        VARCHAR(255) NOT NULL,
  priority          VARCHAR(16) NOT NULL DEFAULT 'ROUTINE',
  status            VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  -- Pemesan wajib pemberi layanan berkewenangan; itu ditegakkan layanan
  -- terhadap health_clinical_privilege, bukan oleh kolom ini.
  ordered_by_provider_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  ordered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_unit_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE SET NULL,
  clinical_note     TEXT,
  instruction       TEXT,
  -- Penerimaan oleh unit tujuan. Order yang terkirim tetapi tidak pernah
  -- dibaca unit tujuan adalah kegagalan yang tidak terlihat sampai pasien
  -- menunggu terlalu lama.
  acknowledged_at   TIMESTAMPTZ,
  acknowledged_by   UUID,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancelled_by      UUID,
  cancel_reason     TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT clinical_order_type_valid CHECK (
    order_type IN ('LABORATORY', 'RADIOLOGY', 'MEDICATION', 'PROCEDURE', 'DIET',
                   'CONSULTATION', 'THERAPY', 'BLOOD_PRODUCT', 'NURSING', 'OTHER')
  ),
  CONSTRAINT clinical_order_priority_valid CHECK (
    priority IN ('ROUTINE', 'URGENT', 'STAT')
  ),
  CONSTRAINT clinical_order_status_valid CHECK (
    status IN ('DRAFT', 'ORDERED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED',
               'CANCELLED', 'REJECTED')
  ),
  CONSTRAINT clinical_order_cancel_needs_reason CHECK (
    cancelled_at IS NULL OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) >= 5)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_clinical_order_number
  ON "{{TENANT_SCHEMA}}".clinical_order (order_number);
CREATE INDEX IF NOT EXISTS ix_clinical_order_encounter
  ON "{{TENANT_SCHEMA}}".clinical_order (encounter_id, ordered_at);
CREATE INDEX IF NOT EXISTS ix_clinical_order_worklist
  ON "{{TENANT_SCHEMA}}".clinical_order (target_unit_id, status, priority DESC, ordered_at)
  WHERE status IN ('ORDERED', 'ACKNOWLEDGED', 'IN_PROGRESS');

-- ---------------------------------------------------------------------------
-- Peringatan klinis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".clinical_alert (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  encounter_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE CASCADE,
  alert_type      VARCHAR(32) NOT NULL,
  severity        VARCHAR(16) NOT NULL DEFAULT 'WARNING',
  message         TEXT NOT NULL,
  source_type     VARCHAR(32),
  source_id       UUID,
  raised_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Peringatan yang dilewati DICATAT beserta alasannya. Ini bukan formalitas:
  -- bila hampir seluruh peringatan dilewati, yang salah adalah peringatannya,
  -- bukan penggunanya — dan hanya angka pelewatan yang dapat menunjukkannya.
  overridden_at   TIMESTAMPTZ,
  overridden_by   UUID,
  override_reason TEXT,
  resolved_at     TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT clinical_alert_type_valid CHECK (
    alert_type IN ('ALLERGY', 'DRUG_INTERACTION', 'DUPLICATE_THERAPY', 'DOSE_RANGE',
                   'CRITICAL_RESULT', 'PATIENT_SAFETY', 'IDENTITY', 'OTHER')
  ),
  CONSTRAINT clinical_alert_severity_valid CHECK (
    severity IN ('INFO', 'WARNING', 'CRITICAL', 'BLOCKING')
  ),
  CONSTRAINT clinical_alert_override_needs_reason CHECK (
    overridden_at IS NULL OR (override_reason IS NOT NULL AND length(trim(override_reason)) >= 5)
  )
);

CREATE INDEX IF NOT EXISTS ix_clinical_alert_patient
  ON "{{TENANT_SCHEMA}}".clinical_alert (patient_id, raised_at DESC);
CREATE INDEX IF NOT EXISTS ix_clinical_alert_overridden
  ON "{{TENANT_SCHEMA}}".clinical_alert (alert_type, raised_at DESC)
  WHERE overridden_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_allergy', 'health_encounter', 'clinical_note',
                           'encounter_diagnosis', 'clinical_order', 'clinical_alert'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;

-- `vital_sign` TIDAK diaudit: barisnya sudah bersifat catatan pengukuran yang
-- tidak disunting, dan volumenya tinggi pada rawat inap. Perubahannya, bila
-- ada, tertangkap sebagai koreksi tersendiri.
