-- =========================================================================
-- H016 — REKAM MEDIS, PENGKODEAN, MUTU, DAN KESELAMATAN PASIEN
-- =========================================================================
--
-- Fase H-9. Aditif seluruhnya.
--
-- Tiga hal ditegakkan basis data di sini.
--
-- 1. **Penahanan hukum menahan perubahan, bukan hanya penghapusan.** Rekam
--    medis yang sedang diperkarakan lalu "diperbaiki" adalah bukti yang rusak —
--    dan perbaikan yang niatnya baik pun akan terbaca sebagai penghilangan
--    bukti. Trigger menahannya; pembacaan tetap bebas.
--
-- 2. **Kode yang dicabut tetap terbaca, tetapi tidak dapat dipilih.** Rekam
--    lama dikode dengan terminologi yang berlaku saat itu. Menyembunyikannya
--    membuat rekam lama tidak terbaca; mengizinkannya dipilih membuat klaim
--    baru ditolak.
--
-- 3. **Laporan insiden tidak dapat dihapus.** Program keselamatan pasien
--    bergantung pada orang yang mau melapor. Laporan yang dapat dihapus adalah
--    laporan yang akan dihapus ketika hasilnya tidak menyenangkan — dan sekali
--    itu terjadi, tidak ada lagi yang melapor.

-- ---------------------------------------------------------------------------
-- Terminologi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".terminology_snapshot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system          VARCHAR(24) NOT NULL,
  version         VARCHAR(48) NOT NULL,
  source_file     VARCHAR(255),
  -- Sidik jari berkas sumber. Terminologi yang tidak dapat ditelusuri ke
  -- berkasnya tidak boleh diaktifkan: kode diagnosis yang keliru akan disalin
  -- ke dokumen klaim, dan dokumen klaim yang salah kode akan dikembalikan.
  source_hash     VARCHAR(128),
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by     UUID,
  activated_at    TIMESTAMPTZ,
  activated_by    UUID,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  code_count      INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version_no      INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT terminology_system_valid CHECK (
    system IN ('ICD10', 'ICD9CM', 'LOINC', 'SNOMED', 'KFA', 'LOCAL')
  ),
  -- Yang mengimpor tidak mengaktifkan. Impor dan aktivasi adalah dua langkah.
  CONSTRAINT terminology_activation_not_self CHECK (
    activated_by IS NULL OR imported_by IS NULL OR activated_by <> imported_by
  ),
  CONSTRAINT terminology_active_needs_activation CHECK (
    is_active = FALSE OR activated_at IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_terminology_snapshot
  ON "{{TENANT_SCHEMA}}".terminology_snapshot (system, version);
CREATE UNIQUE INDEX IF NOT EXISTS ux_terminology_one_active
  ON "{{TENANT_SCHEMA}}".terminology_snapshot (system) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".terminology_code (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".terminology_snapshot (id) ON DELETE CASCADE,
  system          VARCHAR(24) NOT NULL,
  code            VARCHAR(48) NOT NULL,
  display         VARCHAR(500) NOT NULL,
  parent_code     VARCHAR(48),
  -- Tanggal kode dicabut. Dibandingkan dengan TANGGAL LAYANAN, bukan tanggal
  -- pengkodean: berkas Maret yang dikode Juni tetap memakai terminologi Maret.
  deprecated_at   DATE,
  replaced_by     VARCHAR(48),
  is_billable     BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_terminology_code
  ON "{{TENANT_SCHEMA}}".terminology_code (snapshot_id, code);
CREATE INDEX IF NOT EXISTS ix_terminology_code_lookup
  ON "{{TENANT_SCHEMA}}".terminology_code (system, code);
CREATE INDEX IF NOT EXISTS ix_terminology_code_search
  ON "{{TENANT_SCHEMA}}".terminology_code (system, lower(display));

-- ---------------------------------------------------------------------------
-- Pengkodean kunjungan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".him_coding (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  admission_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  -- Tanggal layanan, disalin. Menentukan versi terminologi mana yang berlaku,
  -- dan tidak boleh berubah ketika kunjungannya kelak disunting.
  service_date      DATE NOT NULL,
  encounter_type    VARCHAR(24) NOT NULL,

  status            VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  coded_by          UUID,
  coded_at          TIMESTAMPTZ,
  verified_by       UUID,
  verified_at       TIMESTAMPTZ,
  verification_note TEXT,

  -- Hasil pemeriksaan kelengkapan, DISIMPAN. Aturan kelengkapan akan berubah;
  -- pemeriksaan bulan lalu harus tetap dapat dijelaskan dengan aturan bulan lalu.
  deficiency_count  SMALLINT NOT NULL DEFAULT 0,
  blocking_count    SMALLINT NOT NULL DEFAULT 0,
  checked_at        TIMESTAMPTZ,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT him_coding_status_valid CHECK (
    status IN ('PENDING', 'IN_CODING', 'CODED', 'VERIFIED', 'RETURNED', 'CANCELLED')
  ),
  CONSTRAINT him_coding_target CHECK (encounter_id IS NOT NULL OR admission_id IS NOT NULL),
  CONSTRAINT him_coding_coded_complete CHECK (
    status NOT IN ('CODED', 'VERIFIED') OR (coded_by IS NOT NULL AND coded_at IS NOT NULL)
  ),
  CONSTRAINT him_coding_verified_complete CHECK (
    status <> 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)
  ),
  CONSTRAINT him_coding_return_needs_note CHECK (
    status <> 'RETURNED' OR (verification_note IS NOT NULL AND length(trim(verification_note)) >= 5)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_him_coding_encounter
  ON "{{TENANT_SCHEMA}}".him_coding (encounter_id) WHERE encounter_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_him_coding_admission
  ON "{{TENANT_SCHEMA}}".him_coding (admission_id) WHERE admission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_him_coding_worklist
  ON "{{TENANT_SCHEMA}}".him_coding (facility_id, status, service_date)
  WHERE status IN ('PENDING', 'IN_CODING', 'CODED', 'RETURNED');

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".him_coded_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coding_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".him_coding (id) ON DELETE CASCADE,
  item_type       VARCHAR(16) NOT NULL,
  code            VARCHAR(48) NOT NULL,
  code_system     VARCHAR(24) NOT NULL,
  -- Versi terminologi yang dipakai, DISALIN. Tanpa ini, kode lama tidak dapat
  -- ditafsirkan ketika terminologinya sudah berganti dua kali.
  code_version    VARCHAR(48) NOT NULL,
  display         VARCHAR(500),
  sequence_no     SMALLINT NOT NULL DEFAULT 1,
  is_principal    BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT him_coded_item_type_valid CHECK (item_type IN ('DIAGNOSIS', 'PROCEDURE')),
  CONSTRAINT him_coded_item_sequence_positive CHECK (sequence_no >= 1)
);

/*
 * SATU DIAGNOSIS UTAMA, TIDAK LEBIH.
 *
 * Pengelompokan casemix memilih satu; bila ada dua, yang dipilih ditentukan
 * urutan baris — dan urutan baris bukan keputusan klinis. Ditegakkan indeks
 * unik parsial, bukan hanya layanan.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_him_coded_one_principal
  ON "{{TENANT_SCHEMA}}".him_coded_item (coding_id)
  WHERE is_principal = TRUE AND item_type = 'DIAGNOSIS';

CREATE UNIQUE INDEX IF NOT EXISTS ux_him_coded_item
  ON "{{TENANT_SCHEMA}}".him_coded_item (coding_id, item_type, code);

-- ---------------------------------------------------------------------------
-- Kekurangan berkas
-- ---------------------------------------------------------------------------
-- Satu baris per kekurangan, bukan satu kolom berisi hitungan. Kekurangan yang
-- hanya berupa angka tidak dapat ditugaskan kepada siapa pun.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".him_deficiency (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coding_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".him_coding (id) ON DELETE CASCADE,
  deficiency_type VARCHAR(48) NOT NULL,
  message         TEXT NOT NULL,
  -- Peran yang dapat memperbaikinya. Kekurangan tanpa pemilik tidak akan
  -- diperbaiki oleh siapa pun.
  responsible_role VARCHAR(64) NOT NULL,
  assigned_to     UUID,
  blocks_coding   BOOLEAN NOT NULL DEFAULT TRUE,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_him_deficiency_open
  ON "{{TENANT_SCHEMA}}".him_deficiency (coding_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_him_deficiency_assigned
  ON "{{TENANT_SCHEMA}}".him_deficiency (assigned_to, detected_at)
  WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------------
-- Penahanan hukum
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".him_legal_hold (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  encounter_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  reason          TEXT NOT NULL,
  case_reference  VARCHAR(120),
  requested_by    VARCHAR(180),
  placed_by       UUID NOT NULL,
  placed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_by     UUID,
  released_at     TIMESTAMPTZ,
  release_reason  TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT him_hold_reason_meaningful CHECK (length(trim(reason)) >= 10),
  -- Pencabutan penahanan wajib beralasan dan menyebut siapa. Penahanan yang
  -- lepas tanpa jejak sama saja dengan tidak pernah ada.
  CONSTRAINT him_hold_release_complete CHECK (
    released_at IS NULL
    OR (released_by IS NOT NULL AND release_reason IS NOT NULL
        AND length(trim(release_reason)) >= 5)
  ),
  -- Yang menahan tidak mencabut penahanannya sendiri.
  CONSTRAINT him_hold_release_not_self CHECK (
    released_by IS NULL OR released_by <> placed_by
  )
);

CREATE INDEX IF NOT EXISTS ix_him_hold_active
  ON "{{TENANT_SCHEMA}}".him_legal_hold (patient_id) WHERE released_at IS NULL;

/*
 * PENAHANAN HUKUM MENAHAN PERUBAHAN CATATAN KLINIS.
 *
 * Trigger pada catatan klinis: menolak UPDATE dan DELETE bila pasiennya sedang
 * ditahan. Pembacaan tidak tersentuh — menahan pembacaan akan menghentikan
 * perawatan pasien yang rekamnya kebetulan diperkarakan, dan pasien itu tetap
 * sakit.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_change_under_legal_hold()
RETURNS TRIGGER AS $$
DECLARE
  pid UUID;
  jumlah INTEGER;
BEGIN
  pid := COALESCE(OLD.patient_id, NEW.patient_id);
  IF pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*) INTO jumlah
    FROM "{{TENANT_SCHEMA}}".him_legal_hold
   WHERE patient_id = pid AND released_at IS NULL;

  IF jumlah > 0 THEN
    RAISE EXCEPTION
      'Rekam medis pasien ini ditahan untuk keperluan hukum (% penahanan aktif). '
      'Perubahan tidak diizinkan sampai penahanannya dicabut.', jumlah
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_hold_clinical_note ON "{{TENANT_SCHEMA}}".clinical_note;
CREATE TRIGGER trg_legal_hold_clinical_note
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".clinical_note
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_change_under_legal_hold();

DROP TRIGGER IF EXISTS trg_legal_hold_diagnosis ON "{{TENANT_SCHEMA}}".encounter_diagnosis;
CREATE TRIGGER trg_legal_hold_diagnosis
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".encounter_diagnosis
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_change_under_legal_hold();

-- ---------------------------------------------------------------------------
-- Pelepasan informasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".him_information_release (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  requester_type    VARCHAR(32) NOT NULL,
  requester_name    VARCHAR(255) NOT NULL,
  purpose           TEXT NOT NULL,
  -- Bagian rekam yang diminta, sebagai daftar. "Kirimkan rekam medisnya" bukan
  -- permintaan; ia jaring.
  requested_scope   VARCHAR(64)[] NOT NULL,
  has_patient_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_reference VARCHAR(120),
  has_legal_basis   BOOLEAN NOT NULL DEFAULT FALSE,
  legal_basis_document VARCHAR(120),

  decision          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  decided_by        UUID,
  decided_at        TIMESTAMPTZ,
  decision_reason   TEXT,
  requires_redaction BOOLEAN NOT NULL DEFAULT FALSE,
  -- Apa yang BENAR-BENAR dilepas, bukan hanya apa yang diminta. Keduanya sering
  -- berbeda, dan yang penting bagi audit adalah yang kedua.
  released_scope    VARCHAR(64)[],
  released_at       TIMESTAMPTZ,
  released_by       UUID,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT him_release_requester_valid CHECK (
    requester_type IN ('PATIENT', 'LEGAL_GUARDIAN', 'INSURER', 'COURT', 'POLICE',
                       'OTHER_FACILITY', 'RESEARCHER', 'EMPLOYER', 'OTHER')
  ),
  CONSTRAINT him_release_decision_valid CHECK (
    decision IN ('PENDING', 'APPROVED', 'REJECTED')
  ),
  CONSTRAINT him_release_scope_not_empty CHECK (array_length(requested_scope, 1) >= 1),
  CONSTRAINT him_release_rejection_needs_reason CHECK (
    decision <> 'REJECTED' OR (decision_reason IS NOT NULL AND length(trim(decision_reason)) >= 5)
  ),
  -- Pengadilan dan kepolisian wajib menyertakan nomor surat resmi. Permintaan
  -- lisan tidak dapat dibedakan dari permintaan yang dikarang.
  CONSTRAINT him_release_court_needs_document CHECK (
    decision <> 'APPROVED'
    OR requester_type NOT IN ('COURT', 'POLICE')
    OR (legal_basis_document IS NOT NULL AND length(trim(legal_basis_document)) >= 3)
  ),
  -- Pelepasan wajib mencatat apa yang dilepas.
  CONSTRAINT him_release_released_complete CHECK (
    released_at IS NULL
    OR (released_by IS NOT NULL AND released_scope IS NOT NULL
        AND array_length(released_scope, 1) >= 1)
  )
);

CREATE INDEX IF NOT EXISTS ix_him_release_patient
  ON "{{TENANT_SCHEMA}}".him_information_release (patient_id, created_at DESC);

-- Catatan pelepasan tidak dapat dihapus. Ia satu-satunya bukti bahwa rekam
-- medis seseorang pernah keluar dari rumah sakit ini.
DROP TRIGGER IF EXISTS trg_him_release_no_delete ON "{{TENANT_SCHEMA}}".him_information_release;
CREATE TRIGGER trg_him_release_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".him_information_release
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Insiden keselamatan pasien
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".safety_incident (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number   VARCHAR(64) NOT NULL,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  patient_id        UUID REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  encounter_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  service_unit_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,

  incident_type     VARCHAR(48) NOT NULL,
  occurred_at       TIMESTAMPTZ NOT NULL,
  description       TEXT NOT NULL,
  immediate_action  TEXT,

  harm_level        VARCHAR(16) NOT NULL,
  reached_patient   BOOLEAN NOT NULL DEFAULT FALSE,
  is_sentinel       BOOLEAN NOT NULL DEFAULT FALSE,
  grade             VARCHAR(8) NOT NULL,
  review_due_at     TIMESTAMPTZ,
  requires_rca      BOOLEAN NOT NULL DEFAULT FALSE,
  requires_external_report BOOLEAN NOT NULL DEFAULT FALSE,

  /*
   * Pelapor boleh anonim. Program keselamatan pasien bergantung pada orang yang
   * mau melapor, dan sebagian tidak akan melapor bila namanya tercatat —
   * terutama ketika yang keliru adalah atasannya.
   */
  reported_by       UUID,
  is_anonymous      BOOLEAN NOT NULL DEFAULT FALSE,
  reported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  rca_completed_at  TIMESTAMPTZ,
  rca_summary       TEXT,
  closed_at         TIMESTAMPTZ,
  closed_by         UUID,
  closure_note      TEXT,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT safety_harm_valid CHECK (
    harm_level IN ('NEAR_MISS', 'NO_HARM', 'MILD', 'MODERATE', 'SEVERE', 'DEATH')
  ),
  CONSTRAINT safety_grade_valid CHECK (grade IN ('BLUE', 'GREEN', 'YELLOW', 'RED')),
  CONSTRAINT safety_description_meaningful CHECK (length(trim(description)) >= 10),
  -- Nyaris cedera menurut definisinya tidak sampai ke pasien. Bila ia sampai,
  -- ia bukan lagi nyaris cedera — dan menyebutnya begitu akan menyembunyikan
  -- kejadian yang sesungguhnya terjadi.
  CONSTRAINT safety_near_miss_not_reached CHECK (
    harm_level <> 'NEAR_MISS' OR reached_patient = FALSE
  ),
  -- Cedera menurut definisinya sampai ke pasien.
  CONSTRAINT safety_harm_reached CHECK (
    harm_level NOT IN ('MILD', 'MODERATE', 'SEVERE', 'DEATH') OR reached_patient = TRUE
  ),
  CONSTRAINT safety_rca_before_close CHECK (
    closed_at IS NULL OR requires_rca = FALSE OR rca_completed_at IS NOT NULL
  ),
  -- Pelapor tidak menutup laporannya sendiri pada kejadian berat. Telaah oleh
  -- pihak yang terlibat bukan telaah.
  CONSTRAINT safety_close_not_self CHECK (
    closed_at IS NULL OR grade IN ('BLUE', 'GREEN')
    OR reported_by IS NULL OR closed_by IS NULL OR closed_by <> reported_by
  ),
  CONSTRAINT safety_anonymous_has_no_reporter CHECK (
    is_anonymous = FALSE OR reported_by IS NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_safety_incident_number
  ON "{{TENANT_SCHEMA}}".safety_incident (incident_number);
CREATE INDEX IF NOT EXISTS ix_safety_incident_board
  ON "{{TENANT_SCHEMA}}".safety_incident (facility_id, grade, review_due_at)
  WHERE closed_at IS NULL;

-- Laporan insiden tidak dapat dihapus. Laporan yang dapat dihapus adalah
-- laporan yang akan dihapus ketika hasilnya tidak menyenangkan — dan sekali itu
-- terjadi, tidak ada lagi yang melapor.
DROP TRIGGER IF EXISTS trg_safety_incident_no_delete ON "{{TENANT_SCHEMA}}".safety_incident;
CREATE TRIGGER trg_safety_incident_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".safety_incident
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".safety_corrective_action (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".safety_incident (id) ON DELETE RESTRICT,
  action          TEXT NOT NULL,
  action_type     VARCHAR(32),
  assigned_to     UUID,
  due_at          TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID,
  effectiveness_note TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT safety_action_meaningful CHECK (length(trim(action)) >= 5),
  CONSTRAINT safety_action_type_valid CHECK (
    action_type IS NULL OR action_type IN
      ('PROCESS', 'TRAINING', 'EQUIPMENT', 'STAFFING', 'POLICY', 'SYSTEM', 'OTHER')
  )
);

CREATE INDEX IF NOT EXISTS ix_safety_action_incident
  ON "{{TENANT_SCHEMA}}".safety_corrective_action (incident_id);

-- ---------------------------------------------------------------------------
-- Indikator mutu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".quality_indicator (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  category        VARCHAR(48),
  numerator_definition   TEXT NOT NULL,
  -- Penyebut WAJIB didefinisikan. Indikator tanpa penyebut adalah jumlah, dan
  -- jumlah tidak dapat dibandingkan antar bulan maupun antar rumah sakit —
  -- bulan yang lebih ramai akan selalu tampak lebih buruk.
  denominator_definition TEXT NOT NULL,
  direction       VARCHAR(20) NOT NULL DEFAULT 'HIGHER_IS_BETTER',
  target_value    NUMERIC(8,2),
  unit            VARCHAR(16) NOT NULL DEFAULT 'PERCENT',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT quality_direction_valid CHECK (
    direction IN ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_quality_indicator_code
  ON "{{TENANT_SCHEMA}}".quality_indicator (facility_id, code);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".quality_measurement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".quality_indicator (id) ON DELETE RESTRICT,
  period_year     SMALLINT NOT NULL,
  period_month    SMALLINT,
  numerator       INTEGER NOT NULL,
  denominator     INTEGER NOT NULL,
  value           NUMERIC(8,2),
  meets_target    BOOLEAN,
  note            TEXT,
  measured_by     UUID,
  measured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quality_measure_non_negative CHECK (numerator >= 0 AND denominator >= 0),
  CONSTRAINT quality_measure_month_valid CHECK (
    period_month IS NULL OR (period_month >= 1 AND period_month <= 12)
  ),
  -- Pembilang tidak melebihi penyebut. Bila melebihi, salah satu definisinya
  -- keliru — dan indikator yang melebihi seratus persen akan dilaporkan sebagai
  -- prestasi.
  CONSTRAINT quality_measure_ratio_sane CHECK (numerator <= denominator)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_quality_measurement
  ON "{{TENANT_SCHEMA}}".quality_measurement
     (indicator_id, period_year, COALESCE(period_month, 0));

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['terminology_snapshot', 'terminology_code', 'him_coding',
                           'him_coded_item', 'him_deficiency', 'him_legal_hold',
                           'him_information_release', 'safety_incident',
                           'safety_corrective_action', 'quality_indicator',
                           'quality_measurement'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
