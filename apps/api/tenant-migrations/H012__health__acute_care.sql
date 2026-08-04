-- =========================================================================
-- H012 — GAWAT DARURAT, KAMAR OPERASI, DAN PERAWATAN INTENSIF
-- =========================================================================
--
-- Fase H-7. Aditif seluruhnya.
--
-- Tiga hal yang ditegakkan basis data di sini, dan ketiganya menyangkut
-- kejadian yang tidak dapat diperbaiki setelah terjadi.
--
-- 1. **Jeda sebelum sayatan tidak dapat dicentang belakangan.** Waktu
--    penyelesaiannya wajib mendahului waktu sayatan, ditegakkan constraint. Ia
--    satu-satunya penahan yang tersisa untuk operasi salah sisi dan salah
--    pasien, dan seluruh gunanya hilang bila ia dapat diisi sesudahnya.
--
-- 2. **Satu kamar operasi, satu operasi pada satu waktu.** Ditegakkan constraint
--    pengecualian (EXCLUDE) atas rentang waktunya — bukan oleh layanan, karena
--    dua penjadwalan bersamaan sama-sama melihat kamarnya kosong.
--
-- 3. **Hitungan kasa yang tidak cocok wajib berketerangan.** Benda yang
--    tertinggal di dalam tubuh baru ditemukan berbulan-bulan kemudian, lewat
--    pembedahan kedua.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Kunjungan gawat darurat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".ed_visit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_number      VARCHAR(64) NOT NULL,
  patient_id        UUID REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  encounter_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,

  arrived_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  arrival_mode      VARCHAR(32),
  chief_complaint   TEXT,

  /*
   * Tingkat yang DIUSULKAN petugas dan tingkat AKHIR disimpan keduanya.
   *
   * Selisihnya adalah data mutu yang paling berharga di IGD: seberapa sering
   * penilaian manusia lebih ringan daripada tanda vitalnya. Menyimpan yang
   * akhir saja menghapus pertanyaannya sekaligus jawabannya.
   */
  requested_level   SMALLINT,
  triage_level      SMALLINT,
  triage_red_flags  TEXT[],
  triaged_at        TIMESTAMPTZ,
  triaged_by        UUID,
  max_wait_minutes  INTEGER,

  seen_by_doctor_at TIMESTAMPTZ,
  seen_by           UUID,

  disposition       VARCHAR(32),
  disposition_at    TIMESTAMPTZ,
  disposition_by    UUID,
  disposition_reason TEXT,
  admission_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,

  status            VARCHAR(24) NOT NULL DEFAULT 'WAITING',
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ed_visit_status_valid CHECK (
    status IN ('WAITING', 'IN_TREATMENT', 'OBSERVATION', 'CLOSED')
  ),
  CONSTRAINT ed_visit_level_range CHECK (
    triage_level IS NULL OR (triage_level >= 1 AND triage_level <= 5)
  ),
  CONSTRAINT ed_visit_requested_range CHECK (
    requested_level IS NULL OR (requested_level >= 1 AND requested_level <= 5)
  ),
  -- Tingkat akhir tidak pernah lebih ringan daripada yang diusulkan petugas.
  -- Tanda bahaya hanya menaikkan; penurunan tingkat ditangani jalur tersendiri
  -- yang menuntut alasan.
  CONSTRAINT ed_visit_level_not_softened CHECK (
    requested_level IS NULL OR triage_level IS NULL OR triage_level <= requested_level
  ),
  CONSTRAINT ed_visit_disposition_valid CHECK (
    disposition IS NULL OR disposition IN (
      'DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'OBSERVATION',
      'LEFT_WITHOUT_BEING_SEEN', 'DIED_IN_ED', 'DOA'
    )
  ),
  /*
   * "Pergi tanpa dilihat" tidak boleh dipakai pada pasien yang sudah dilihat
   * dokter. Menyamakan keduanya akan menyembunyikan angka yang paling penting
   * bagi mutu IGD: berapa banyak orang yang menyerah menunggu.
   */
  CONSTRAINT ed_visit_lwbs_never_seen CHECK (
    disposition <> 'LEFT_WITHOUT_BEING_SEEN' OR seen_by_doctor_at IS NULL
  ),
  CONSTRAINT ed_visit_seen_after_arrival CHECK (
    seen_by_doctor_at IS NULL OR seen_by_doctor_at >= arrived_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ed_visit_number
  ON "{{TENANT_SCHEMA}}".ed_visit (visit_number);
CREATE INDEX IF NOT EXISTS ix_ed_visit_board
  ON "{{TENANT_SCHEMA}}".ed_visit (facility_id, status, triage_level, arrived_at)
  WHERE status IN ('WAITING', 'IN_TREATMENT', 'OBSERVATION');
CREATE INDEX IF NOT EXISTS ix_ed_visit_patient
  ON "{{TENANT_SCHEMA}}".ed_visit (patient_id, arrived_at DESC);

-- Riwayat perubahan tingkat triase. Tabel tersendiri, bukan kolom: penurunan
-- tingkat adalah tempat tekanan antrean paling mudah menyusup, dan yang perlu
-- diketahui kelak bukan tingkat terakhirnya melainkan siapa mengubahnya kapan
-- dan dengan alasan apa.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".ed_triage_change (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_visit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".ed_visit (id) ON DELETE RESTRICT,
  from_level      SMALLINT,
  to_level        SMALLINT NOT NULL,
  reason          TEXT,
  changed_by      UUID,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Penurunan tingkat wajib berketerangan. Kenaikan tidak: keadaan pasien
  -- memang dapat memburuk sambil menunggu.
  CONSTRAINT ed_triage_downgrade_needs_reason CHECK (
    from_level IS NULL OR to_level <= from_level
    OR (reason IS NOT NULL AND length(trim(reason)) >= 10)
  )
);

CREATE INDEX IF NOT EXISTS ix_ed_triage_change_visit
  ON "{{TENANT_SCHEMA}}".ed_triage_change (ed_visit_id, changed_at);

DROP TRIGGER IF EXISTS trg_ed_triage_change_immutable ON "{{TENANT_SCHEMA}}".ed_triage_change;
CREATE TRIGGER trg_ed_triage_change_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".ed_triage_change
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Kamar operasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".ot_theatre (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  theatre_type    VARCHAR(32),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ot_theatre_code
  ON "{{TENANT_SCHEMA}}".ot_theatre (facility_id, code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Operasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".ot_case (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number       VARCHAR(64) NOT NULL,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  theatre_id        UUID REFERENCES "{{TENANT_SCHEMA}}".ot_theatre (id) ON DELETE RESTRICT,
  admission_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,

  procedure_name    VARCHAR(255) NOT NULL,
  procedure_code    VARCHAR(48),
  /*
   * Sisi pada persetujuan tindakan dan sisi yang ditandai pada tubuh disimpan
   * TERPISAH, dan dibandingkan sebelum sayatan. Bila keduanya berbeda, salah
   * satunya keliru — dan tidak ada seorang pun di kamar operasi yang dapat
   * memastikan yang mana tanpa bertanya kepada pasien, yang sudah terbius.
   */
  requires_site_marking BOOLEAN NOT NULL DEFAULT FALSE,
  consent_site      VARCHAR(32),
  marked_site       VARCHAR(32),
  marked_by         UUID,
  marked_at         TIMESTAMPTZ,

  surgeon_id        UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  anaesthetist_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  anaesthesia_type  VARCHAR(32),
  urgency           VARCHAR(16) NOT NULL DEFAULT 'ELECTIVE',

  scheduled_start   TIMESTAMPTZ,
  scheduled_end     TIMESTAMPTZ,
  -- Rentang waktu terjadwal sebagai satu nilai, supaya constraint pengecualian
  -- dapat menahan tumpang tindih. Dipelihara layanan bersama dua kolom di atas.
  scheduled_range   TSTZRANGE,

  sign_in_at        TIMESTAMPTZ,
  time_out_at       TIMESTAMPTZ,
  incision_at       TIMESTAMPTZ,
  closure_at        TIMESTAMPTZ,
  sign_out_at       TIMESTAMPTZ,
  left_theatre_at   TIMESTAMPTZ,

  operative_note    TEXT,
  findings          TEXT,
  blood_loss_ml     NUMERIC(10,2),
  count_discrepancy_resolution TEXT,

  status            VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED',
  cancel_reason     TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ot_case_status_valid CHECK (
    status IN ('SCHEDULED', 'IN_THEATRE', 'IN_PROGRESS', 'CLOSING', 'RECOVERY',
               'COMPLETED', 'CANCELLED')
  ),
  CONSTRAINT ot_case_urgency_valid CHECK (
    urgency IN ('ELECTIVE', 'URGENT', 'EMERGENCY')
  ),
  CONSTRAINT ot_case_schedule_ordered CHECK (
    scheduled_start IS NULL OR scheduled_end IS NULL OR scheduled_end > scheduled_start
  ),
  /*
   * JEDA SEBELUM SAYATAN TIDAK DAPAT DICENTANG BELAKANGAN.
   *
   * Waktu penyelesaiannya wajib mendahului waktu sayatan. Tanpa constraint ini,
   * daftar periksa dapat diisi setelah operasinya selesai — dan daftar periksa
   * yang diisi belakangan tidak menahan apa pun; ia hanya membuat berkasnya
   * tampak rapi.
   */
  CONSTRAINT ot_case_timeout_before_incision CHECK (
    incision_at IS NULL OR (time_out_at IS NOT NULL AND time_out_at <= incision_at)
  ),
  CONSTRAINT ot_case_signin_before_timeout CHECK (
    time_out_at IS NULL OR (sign_in_at IS NOT NULL AND sign_in_at <= time_out_at)
  ),
  CONSTRAINT ot_case_signout_before_leaving CHECK (
    left_theatre_at IS NULL OR (sign_out_at IS NOT NULL AND sign_out_at <= left_theatre_at)
  ),
  -- Prosedur bersisi wajib menyebut sisi pada persetujuan tindakan.
  CONSTRAINT ot_case_site_required CHECK (
    requires_site_marking = FALSE OR incision_at IS NULL
    OR (consent_site IS NOT NULL AND marked_site IS NOT NULL)
  ),
  CONSTRAINT ot_case_cancel_needs_reason CHECK (
    status <> 'CANCELLED' OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) >= 5)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ot_case_number
  ON "{{TENANT_SCHEMA}}".ot_case (case_number);
CREATE INDEX IF NOT EXISTS ix_ot_case_schedule
  ON "{{TENANT_SCHEMA}}".ot_case (facility_id, scheduled_start)
  WHERE status IN ('SCHEDULED', 'IN_THEATRE', 'IN_PROGRESS');
CREATE INDEX IF NOT EXISTS ix_ot_case_patient
  ON "{{TENANT_SCHEMA}}".ot_case (patient_id, scheduled_start DESC);

/*
 * SATU KAMAR OPERASI, SATU OPERASI PADA SATU WAKTU.
 *
 * Constraint pengecualian atas rentang waktu terjadwal. Ditegakkan basis data,
 * bukan layanan: dua penjadwalan bersamaan sama-sama melihat kamarnya kosong,
 * dan yang kedua baru ketahuan ketika tim datang menemukan kamarnya terpakai —
 * lalu pasien yang sudah berpuasa sejak tengah malam ditunda.
 *
 * `&&` adalah tumpang tindih rentang. Rentangnya `[)` sehingga operasi
 * berikutnya boleh dimulai tepat saat yang sebelumnya berakhir.
 */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ot_case_no_theatre_overlap'
       AND conrelid = '{{TENANT_SCHEMA}}.ot_case'::regclass
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".ot_case
      ADD CONSTRAINT ot_case_no_theatre_overlap
      EXCLUDE USING gist (
        theatre_id WITH =,
        scheduled_range WITH &&
      ) WHERE (status <> 'CANCELLED' AND theatre_id IS NOT NULL AND scheduled_range IS NOT NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Daftar periksa keselamatan bedah
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".ot_checklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_case_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".ot_case (id) ON DELETE RESTRICT,
  phase           VARCHAR(16) NOT NULL,
  -- Butir yang dicentang, sebagai daftar tertutup. Bukan teks bebas: laporan
  -- mutu yang tidak dapat menghitung butir mana yang paling sering terlewat
  -- tidak dapat memperbaikinya.
  items           VARCHAR(48)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(48)[],
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by    UUID NOT NULL,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ot_checklist_phase_valid CHECK (phase IN ('SIGN_IN', 'TIME_OUT', 'SIGN_OUT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ot_checklist_phase
  ON "{{TENANT_SCHEMA}}".ot_checklist (ot_case_id, phase);

-- Daftar periksa tidak dapat dihapus. Ia catatan bahwa tim berhenti sejenak
-- dan berbicara; menghapusnya menghapus satu-satunya bukti bahwa mereka
-- melakukannya.
DROP TRIGGER IF EXISTS trg_ot_checklist_no_delete ON "{{TENANT_SCHEMA}}".ot_checklist;
CREATE TRIGGER trg_ot_checklist_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".ot_checklist
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Hitungan kasa, jarum, dan instrumen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".ot_count (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_case_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".ot_case (id) ON DELETE RESTRICT,
  item_type       VARCHAR(48) NOT NULL,
  counted_in      INTEGER NOT NULL DEFAULT 0,
  counted_out     INTEGER,
  counted_in_by   UUID,
  counted_out_by  UUID,
  -- Penghitung kedua. Hitungan oleh satu orang bukan hitungan ganda, dan
  -- benda yang tertinggal hampir selalu lolos justru pada hitungan tunggal.
  verified_by     UUID,
  counted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ot_count_non_negative CHECK (
    counted_in >= 0 AND (counted_out IS NULL OR counted_out >= 0)
  ),
  CONSTRAINT ot_count_verifier_not_counter CHECK (
    verified_by IS NULL OR counted_out_by IS NULL OR verified_by <> counted_out_by
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ot_count_item
  ON "{{TENANT_SCHEMA}}".ot_count (ot_case_id, item_type);

-- ---------------------------------------------------------------------------
-- Perawatan intensif
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".icu_stay (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  service_unit_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  admission_reason  TEXT,
  outcome           VARCHAR(32),
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT icu_stay_ordered CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT icu_stay_outcome_valid CHECK (
    outcome IS NULL OR outcome IN ('STEPPED_DOWN', 'DISCHARGED', 'TRANSFERRED', 'DIED')
  )
);

CREATE INDEX IF NOT EXISTS ix_icu_stay_admission
  ON "{{TENANT_SCHEMA}}".icu_stay (admission_id);
CREATE INDEX IF NOT EXISTS ix_icu_stay_active
  ON "{{TENANT_SCHEMA}}".icu_stay (started_at) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".icu_assessment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icu_stay_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".icu_stay (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  assessed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessed_by       UUID,

  respiratory_rate  NUMERIC(5,1),
  spo2              NUMERIC(5,1),
  systolic_bp       NUMERIC(5,1),
  heart_rate        NUMERIC(5,1),
  temperature       NUMERIC(4,1),
  consciousness     VARCHAR(16),

  -- Dukungan organ. Pasien dengan ventilator dan vasopresor sekaligus adalah
  -- pasien yang tanda vitalnya tampak baik JUSTRU KARENA mesin yang menahannya;
  -- skor yang membaca tanda vital saja akan menyimpulkan ia sedang membaik.
  on_ventilator     BOOLEAN NOT NULL DEFAULT FALSE,
  on_vasopressor    BOOLEAN NOT NULL DEFAULT FALSE,
  on_dialysis       BOOLEAN NOT NULL DEFAULT FALSE,

  severity_score    INTEGER,
  organ_support     SMALLINT,
  risk_level        VARCHAR(16),
  note              TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT icu_assessment_risk_valid CHECK (
    risk_level IS NULL OR risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
  )
);

CREATE INDEX IF NOT EXISTS ix_icu_assessment_stay
  ON "{{TENANT_SCHEMA}}".icu_assessment (icu_stay_id, assessed_at DESC);

DROP TRIGGER IF EXISTS trg_icu_assessment_immutable ON "{{TENANT_SCHEMA}}".icu_assessment;
CREATE TRIGGER trg_icu_assessment_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".icu_assessment
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ed_visit', 'ed_triage_change', 'ot_theatre', 'ot_case',
                           'ot_checklist', 'ot_count', 'icu_stay', 'icu_assessment'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
