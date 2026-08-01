-- =========================================================================
-- H035 — PEMELIHARAAN BIOMEDIS, KALIBRASI, DAN KEAMANAN SIBER ALAT
-- =========================================================================
--
-- Fase H-9J. Aditif seluruhnya.
--
-- Satu gagasan menentukan seluruh berkas ini: **tidak ada satu pun jalan di
-- sini yang mematikan alat.** Tidak pada risiko CRITICAL, tidak pada
-- pemeliharaan yang terlambat dua tahun, tidak pada dugaan penyusupan. Alat
-- yang dimatikan sendiri oleh perangkat lunak adalah ventilator yang berhenti
-- pada pasien yang sedang memakainya, dan tidak ada skor risiko yang sepadan
-- dengan itu.
--
-- Yang ditegakkan basis data adalah lima hal yang lain:
--
-- 1. **Penerimaan risiko wajib bertanggal tinjau.** Penerimaan tanpa tanggal
--    adalah penerimaan selamanya, dan selamanya adalah bagaimana alat tahun
--    2016 masih berjalan hari ini dengan catatan "risiko diterima" yang
--    ditandatangani orang yang sudah pensiun.
--
-- 2. **Yang menilai risiko tidak memutuskan penerimaannya sendiri.**
--    Penilaian menyatakan seberapa besar risikonya; keputusan menyatakan
--    bahwa risiko sebesar itu ditanggung rumah sakit.
--
-- 3. **Penahan pengganti wajib berbukti.** Penahan yang diakui tanpa rujukan
--    bukti adalah kotak yang dicentang.
--
-- 4. **Insiden siber yang mengenai perawatan pasien wajib tertaut ke laporan
--    keselamatan pasien.** Dua daftar tentang satu kejadian yang sama adalah
--    cara paling rapi untuk membuat kejadian itu tidak pernah dihitung.
--
-- 5. **Uji keselamatan listrik yang gagal menahan alat kembali melayani.**
--    Satu-satunya penahan keras pada fase ini, dan sebabnya berbeda dari yang
--    lain: kalibrasi yang lewat berarti hasilnya mungkin menyimpang; uji
--    listrik yang gagal berarti alatnya mungkin menyetrum orang.

-- ---------------------------------------------------------------------------
-- Tambahan pada registri alat
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".medical_device
  ADD COLUMN IF NOT EXISTS maintenance_interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS vendor_support_end_date DATE,
  ADD COLUMN IF NOT EXISTS os_end_of_life BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS patient_connected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS out_of_service_reason TEXT,
  ADD COLUMN IF NOT EXISTS safety_inspection_failed BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'medical_device_maintenance_interval_sane'
       AND conrelid = format('%I.medical_device', '{{TENANT_SCHEMA}}')::regclass
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.medical_device ADD CONSTRAINT medical_device_maintenance_interval_sane '
      || 'CHECK (maintenance_interval_days IS NULL OR maintenance_interval_days BETWEEN 1 AND 3650)',
      '{{TENANT_SCHEMA}}'
    );
  END IF;

  /*
   * UJI KESELAMATAN LISTRIK YANG GAGAL MENAHAN ALAT DARI PELAYANAN.
   *
   * Satu-satunya penahan keras pada seluruh H-9J. Perhatikan bahwa ia menahan
   * status ACTIVE, bukan mematikan alat yang sudah menyala — perbedaan yang
   * penting: yang dilarang adalah MENGEMBALIKAN alat ke pelayanan, bukan
   * menghentikan yang sedang dipakai pasien.
   */
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'medical_device_failed_safety_not_active'
       AND conrelid = format('%I.medical_device', '{{TENANT_SCHEMA}}')::regclass
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.medical_device ADD CONSTRAINT medical_device_failed_safety_not_active '
      || 'CHECK (safety_inspection_failed = FALSE OR status <> ''ACTIVE'')',
      '{{TENANT_SCHEMA}}'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Pekerjaan pemeliharaan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_work_order (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  device_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,
  work_order_number VARCHAR(64) NOT NULL,

  work_type       VARCHAR(24) NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  priority        VARCHAR(16) NOT NULL DEFAULT 'NORMAL',

  description     TEXT NOT NULL,
  requested_by    UUID,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_to     UUID,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID,
  completion_note TEXT,

  -- Hasil uji, bila pekerjaannya berupa inspeksi atau kalibrasi.
  inspection_result VARCHAR(16),
  measured_values TEXT,
  reference_standard VARCHAR(180),

  -- Suku cadang dan lama henti. Bukan hiasan: lama henti kumulatif adalah
  -- satu-satunya angka yang membedakan alat yang perlu diganti dari alat yang
  -- perlu diperbaiki.
  downtime_minutes INTEGER,
  parts_note      TEXT,

  /*
   * TAUTAN KE LAPORAN KESELAMATAN PASIEN.
   *
   * Wajib bila pekerjaan korektifnya lahir dari kejadian yang mengenai pasien.
   */
  affected_patient BOOLEAN NOT NULL DEFAULT FALSE,
  safety_incident_id UUID REFERENCES "{{TENANT_SCHEMA}}".safety_incident (id) ON DELETE RESTRICT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT device_wo_type_valid CHECK (
    work_type IN ('PREVENTIVE', 'CORRECTIVE', 'CALIBRATION', 'SAFETY_INSPECTION', 'SOFTWARE_UPDATE')
  ),
  CONSTRAINT device_wo_status_valid CHECK (
    status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
  ),
  CONSTRAINT device_wo_priority_valid CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  CONSTRAINT device_wo_inspection_valid CHECK (
    inspection_result IS NULL OR inspection_result IN ('PASS', 'FAIL', 'PASS_WITH_NOTE')
  ),
  CONSTRAINT device_wo_description_meaningful CHECK (length(trim(description)) >= 10),
  CONSTRAINT device_wo_completed_named CHECK (
    status <> 'COMPLETED' OR (completed_at IS NOT NULL AND completed_by IS NOT NULL)
  ),
  -- Inspeksi dan kalibrasi yang selesai wajib berhasil. Pekerjaan yang ditutup
  -- tanpa hasil adalah pekerjaan yang tidak dapat dipertanyakan kemudian.
  CONSTRAINT device_wo_inspection_result_required CHECK (
    status <> 'COMPLETED'
    OR work_type NOT IN ('CALIBRATION', 'SAFETY_INSPECTION')
    OR inspection_result IS NOT NULL
  ),
  -- Kalibrasi yang LULUS wajib menyebut standar acuannya. "Sudah dikalibrasi"
  -- tanpa menyebut terhadap apa hanya berarti seseorang menekan tombol.
  CONSTRAINT device_wo_calibration_standard CHECK (
    work_type <> 'CALIBRATION'
    OR status <> 'COMPLETED'
    OR inspection_result = 'FAIL'
    OR reference_standard IS NOT NULL
  ),
  /*
   * PEKERJAAN KOREKTIF YANG MENGENAI PASIEN WAJIB MENUNJUK INSIDENNYA.
   *
   * Tanpa tautan itu, catatan teknisi ("pompa diganti") dan catatan keselamatan
   * pasien ("dosis berlebih") hidup terpisah — dan yang mencari pola tidak akan
   * pernah menemukan bahwa alat merek itu sudah tiga kali.
   */
  CONSTRAINT device_wo_patient_needs_incident CHECK (
    affected_patient = FALSE OR safety_incident_id IS NOT NULL
  ),
  CONSTRAINT device_wo_downtime_nonneg CHECK (downtime_minutes IS NULL OR downtime_minutes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_device_wo_number
  ON "{{TENANT_SCHEMA}}".device_work_order (work_order_number);
CREATE INDEX IF NOT EXISTS ix_device_wo_open
  ON "{{TENANT_SCHEMA}}".device_work_order (facility_id, device_id)
  WHERE status IN ('OPEN', 'IN_PROGRESS');
CREATE INDEX IF NOT EXISTS ix_device_wo_device
  ON "{{TENANT_SCHEMA}}".device_work_order (device_id, requested_at DESC);

-- Pekerjaan yang sudah selesai tidak dapat dihapus. Riwayat pemeliharaan yang
-- dapat dihapus adalah riwayat yang akan dihapus ketika alatnya
-- dipersengketakan.
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_completed_work_order_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'WORK_ORDER_IMMUTABLE: pekerjaan pemeliharaan yang sudah selesai tidak dapat dihapus'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_wo_no_delete ON "{{TENANT_SCHEMA}}".device_work_order;
CREATE TRIGGER trg_device_wo_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".device_work_order
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_completed_work_order_delete();

-- ---------------------------------------------------------------------------
-- Riwayat kalibrasi
-- ---------------------------------------------------------------------------
-- Terpisah dari kolom `calibrated_at` pada alat: kolom itu adalah yang
-- TERAKHIR, tabel ini adalah yang SEBENARNYA TERJADI. Ketika hasil laboratorium
-- dipersengketakan, yang ditanyakan bukan kapan alat terakhir dikalibrasi,
-- melainkan apakah ia terkalibrasi pada hari pemeriksaan itu.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_calibration_record (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,
  work_order_id   UUID REFERENCES "{{TENANT_SCHEMA}}".device_work_order (id) ON DELETE RESTRICT,

  performed_on    DATE NOT NULL,
  valid_until     DATE NOT NULL,
  result          VARCHAR(16) NOT NULL,
  reference_standard VARCHAR(180),
  certificate_ref VARCHAR(120),
  performed_by    UUID,
  performed_by_vendor VARCHAR(120),

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,

  CONSTRAINT device_cal_result_valid CHECK (result IN ('PASS', 'FAIL', 'PASS_WITH_NOTE')),
  CONSTRAINT device_cal_period_order CHECK (valid_until >= performed_on),
  CONSTRAINT device_cal_standard_required CHECK (
    result = 'FAIL' OR reference_standard IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_device_cal_device
  ON "{{TENANT_SCHEMA}}".device_calibration_record (device_id, performed_on DESC);

DROP TRIGGER IF EXISTS trg_device_cal_no_delete ON "{{TENANT_SCHEMA}}".device_calibration_record;
CREATE TRIGGER trg_device_cal_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".device_calibration_record
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Penilaian risiko siber
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_risk_assessment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  device_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,

  assessed_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  assessed_by     UUID,

  -- Faktor bawaan, sebagai kolom tersendiri masing-masing. Menyimpannya sebagai
  -- satu medan JSON akan membuatnya tidak dapat dicari — dan pertanyaan
  -- "berapa alat kami yang dapat dijangkau dari internet" adalah pertanyaan
  -- yang harus dapat dijawab dalam satu kueri.
  os_end_of_life  BOOLEAN NOT NULL DEFAULT FALSE,
  vendor_support_ended BOOLEAN NOT NULL DEFAULT FALSE,
  default_credentials BOOLEAN NOT NULL DEFAULT FALSE,
  internet_reachable BOOLEAN NOT NULL DEFAULT FALSE,
  removable_media BOOLEAN NOT NULL DEFAULT FALSE,
  remote_control  BOOLEAN NOT NULL DEFAULT FALSE,
  patient_connected BOOLEAN NOT NULL DEFAULT FALSE,
  stores_phi      BOOLEAN NOT NULL DEFAULT FALSE,

  inherent_score  INTEGER NOT NULL,
  mitigation_score INTEGER NOT NULL DEFAULT 0,
  residual_score  INTEGER NOT NULL,
  risk_level      VARCHAR(16) NOT NULL,

  -- Keputusan. Boleh kosong selama tenggatnya belum lewat.
  decision        VARCHAR(16),
  decision_reason TEXT,
  decision_by     UUID,
  decision_at     TIMESTAMPTZ,
  decision_due_on DATE,
  review_due_on   DATE,
  plan_ref        VARCHAR(120),

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT device_risk_level_valid CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT device_risk_decision_valid CHECK (
    decision IS NULL OR decision IN ('ACCEPT', 'MITIGATE', 'RETIRE')
  ),
  CONSTRAINT device_risk_scores_nonneg CHECK (
    inherent_score >= 0 AND mitigation_score >= 0 AND residual_score >= 0
  ),
  /*
   * RISIKO SISA TIDAK PERNAH NOL SELAMA ADA FAKTOR BAWAAN.
   *
   * Penahan pengganti mengurangi risiko; ia tidak menghilangkannya. Skor nol
   * berarti "tidak perlu ditinjau lagi", dan itu persis kebalikan dari yang
   * benar bagi alat yang tidak dapat ditambal.
   */
  CONSTRAINT device_risk_residual_floor CHECK (
    inherent_score = 0 OR residual_score >= ceil(inherent_score::numeric / 3)
  ),
  CONSTRAINT device_risk_residual_not_above CHECK (residual_score <= inherent_score),
  /*
   * PENERIMAAN RISIKO WAJIB BERTANGGAL TINJAU.
   *
   * Penerimaan tanpa tanggal adalah penerimaan selamanya.
   */
  CONSTRAINT device_risk_accept_needs_review CHECK (
    decision <> 'ACCEPT' OR review_due_on IS NOT NULL
  ),
  CONSTRAINT device_risk_plan_required CHECK (
    decision IS NULL OR decision = 'ACCEPT' OR plan_ref IS NOT NULL
  ),
  CONSTRAINT device_risk_decision_complete CHECK (
    decision IS NULL
    OR (decision_by IS NOT NULL AND decision_at IS NOT NULL
        AND decision_reason IS NOT NULL AND length(trim(decision_reason)) >= 20)
  ),
  /*
   * YANG MENILAI TIDAK MEMUTUSKAN PENERIMAANNYA SENDIRI.
   *
   * Penilaian menyatakan seberapa besar risikonya; keputusan menyatakan bahwa
   * risiko sebesar itu ditanggung rumah sakit. Dua pertanyaan yang berbeda.
   */
  CONSTRAINT device_risk_decide_not_self CHECK (
    decision_by IS NULL OR assessed_by IS NULL OR decision_by <> assessed_by
  )
);

CREATE INDEX IF NOT EXISTS ix_device_risk_device
  ON "{{TENANT_SCHEMA}}".device_risk_assessment (device_id, assessed_on DESC);
CREATE INDEX IF NOT EXISTS ix_device_risk_pending
  ON "{{TENANT_SCHEMA}}".device_risk_assessment (facility_id, decision_due_on)
  WHERE decision IS NULL;

DROP TRIGGER IF EXISTS trg_device_risk_no_delete ON "{{TENANT_SCHEMA}}".device_risk_assessment;
CREATE TRIGGER trg_device_risk_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".device_risk_assessment
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Penahan pengganti yang diakui
-- ---------------------------------------------------------------------------
-- Terpisah dari penilaiannya supaya setiap penahan membawa buktinya sendiri.
-- Penahan yang diakui tanpa rujukan bukti adalah kotak yang dicentang, dan
-- kotak yang dicentang adalah cara paling umum sebuah asesmen risiko menjadi
-- tidak berarti.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_risk_control (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".device_risk_assessment (id) ON DELETE CASCADE,
  control_code    VARCHAR(32) NOT NULL,
  mitigation_weight INTEGER NOT NULL,

  -- Rujukan bukti. WAJIB — tanpanya penahannya tidak dihitung sama sekali.
  evidence_ref    VARCHAR(180) NOT NULL,
  verified_by     UUID,
  verified_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT device_risk_control_valid CHECK (
    control_code IN ('NETWORK_SEGMENTED', 'ACCESS_RESTRICTED', 'TRAFFIC_MONITORED',
                     'PHYSICALLY_SECURED', 'OFFLINE_PROCEDURE')
  ),
  CONSTRAINT device_risk_control_evidence CHECK (length(trim(evidence_ref)) >= 3),
  CONSTRAINT device_risk_control_weight_nonneg CHECK (mitigation_weight >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_device_risk_control
  ON "{{TENANT_SCHEMA}}".device_risk_control (assessment_id, control_code);

-- ---------------------------------------------------------------------------
-- Insiden keamanan siber alat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_security_incident (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  device_id       UUID REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,
  gateway_id      UUID REFERENCES "{{TENANT_SCHEMA}}".device_gateway (id) ON DELETE RESTRICT,
  incident_number VARCHAR(64) NOT NULL,

  incident_type   VARCHAR(32) NOT NULL,
  severity        VARCHAR(16) NOT NULL,
  detected_at     TIMESTAMPTZ NOT NULL,
  description     TEXT NOT NULL,

  /*
   * TAUTAN WAJIB KE KESELAMATAN PASIEN.
   *
   * Insiden siber yang mempengaruhi perawatan pasien JUGA insiden keselamatan
   * pasien. Dua daftar tentang satu kejadian yang sama adalah cara paling rapi
   * untuk membuat kejadian itu tidak pernah dihitung.
   */
  affected_patient_care BOOLEAN NOT NULL DEFAULT FALSE,
  safety_incident_id UUID REFERENCES "{{TENANT_SCHEMA}}".safety_incident (id) ON DELETE RESTRICT,

  containment_note TEXT,
  device_isolated BOOLEAN NOT NULL DEFAULT FALSE,
  isolated_at     TIMESTAMPTZ,

  reported_by     UUID,
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  resolution_note TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT device_sec_type_valid CHECK (
    incident_type IN ('MALWARE', 'UNAUTHORIZED_ACCESS', 'UNAUTHORIZED_COMMAND',
                      'DATA_EXFILTRATION', 'RANSOMWARE', 'DENIAL_OF_SERVICE',
                      'UNPATCHED_EXPLOIT', 'PHYSICAL_TAMPERING', 'OTHER')
  ),
  CONSTRAINT device_sec_severity_valid CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT device_sec_description_meaningful CHECK (length(trim(description)) >= 10),
  CONSTRAINT device_sec_patient_needs_safety CHECK (
    affected_patient_care = FALSE OR safety_incident_id IS NOT NULL
  ),
  CONSTRAINT device_sec_isolated_timed CHECK (
    device_isolated = FALSE OR isolated_at IS NOT NULL
  ),
  CONSTRAINT device_sec_resolved_named CHECK (
    resolved_at IS NULL OR (resolved_by IS NOT NULL AND resolution_note IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_device_sec_number
  ON "{{TENANT_SCHEMA}}".device_security_incident (incident_number);
CREATE INDEX IF NOT EXISTS ix_device_sec_open
  ON "{{TENANT_SCHEMA}}".device_security_incident (facility_id, severity, detected_at DESC)
  WHERE resolved_at IS NULL;

DROP TRIGGER IF EXISTS trg_device_sec_no_delete ON "{{TENANT_SCHEMA}}".device_security_incident;
CREATE TRIGGER trg_device_sec_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".device_security_incident
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- TIDAK ADA SATU PUN JALAN YANG MEMATIKAN ALAT
-- ---------------------------------------------------------------------------
/*
 * Perhatikan yang TIDAK ada pada berkas ini:
 *
 * - tidak ada trigger yang mengubah status alat menjadi DOWNTIME ketika skor
 *   risikonya CRITICAL;
 * - tidak ada trigger yang mengubahnya ketika pemeliharaannya terlambat;
 * - tidak ada trigger yang mengubahnya ketika insiden siber dicatat.
 *
 * Ketiganya pernah dipertimbangkan dan ketiganya ditolak dengan alasan yang
 * sama. Alat yang dimatikan sendiri oleh perangkat lunak adalah ventilator
 * yang berhenti pada pasien yang sedang memakainya. Yang tahu apakah alat itu
 * sedang menopang seseorang bukan basis data, melainkan orang yang berdiri di
 * sebelahnya.
 *
 * Satu-satunya penahan keras adalah `medical_device_failed_safety_not_active`,
 * dan ia pun menahan alat MASUK ke pelayanan, bukan mengeluarkan alat yang
 * sudah di dalamnya.
 */

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['device_work_order', 'device_calibration_record',
                           'device_risk_assessment', 'device_risk_control',
                           'device_security_incident'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
