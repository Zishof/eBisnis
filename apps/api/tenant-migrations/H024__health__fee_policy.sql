-- =========================================================================
-- H024 — KEBIJAKAN PEMBAGIAN JASA DAN KONTRIBUTOR
-- =========================================================================
--
-- Fase H-9E. Aditif seluruhnya.
--
-- **TIDAK ADA SATU PUN PERSENTASE BAWAAN DI DALAM MIGRASI INI.**
--
-- Persentase pembagian jasa adalah kesepakatan antara rumah sakit dan tenaga
-- medisnya. Ia berbeda antar fasilitas, berubah, dan kadang menjadi pokok
-- sengketa. Menyemainya di sini akan membuat angka karangan tampak seperti
-- standar nasional — dan angka yang tampak resmi akan dipakai membayar orang.
--
-- Empat hal ditegakkan basis data di sini.
--
-- 1. **Kebijakan berversi dan tidak dapat diubah setelah disetujui.** Versi
--    baru dibuat; versi lama tetap ada. Pertanyaan "mengapa jasa saya bulan
--    lalu segini" harus dapat dijawab dengan aturan bulan lalu.
--
-- 2. **Pembuat kebijakan tidak menyetujui versinya sendiri.** Persentase
--    pembagian jasa adalah kesepakatan dua pihak; disetujui satu pihak saja, ia
--    bukan kesepakatan.
--
-- 3. **Fee sistem dan fee investor bawaannya NONE.** Barisnya boleh ada, tetapi
--    tidak dapat aktif tanpa kontrak — dan syarat kontraknya diperiksa H-9G.
--
-- 4. **Kontributor tanpa bukti kehadiran tidak dapat dibayar.** Jasa dibayarkan
--    kepada yang benar-benar hadir; tanpa buktinya, daftar kontributor menjadi
--    daftar keinginan, dan pada operasi yang jasanya besar daftar keinginan
--    cenderung memanjang.

-- ---------------------------------------------------------------------------
-- Kebijakan pembagian jasa
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,

  -- Dasar perhitungan. Bawaan bagi penjamin yang membayar lewat klaim adalah
  -- PAID_CLAIM: klaim yang diajukan sepuluh juta dan dibayar tujuh juta akan
  -- membuat rumah sakit membayarkan uang yang tidak pernah diterimanya.
  basis           VARCHAR(24) NOT NULL DEFAULT 'PAID_CLAIM',

  -- Cakupan. Kosong berarti berlaku bagi semua.
  service_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_service (id) ON DELETE RESTRICT,
  service_type    VARCHAR(24),
  payer_type      VARCHAR(24),

  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,

  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  approval_note   TEXT,

  /*
   * Templat contoh dari blueprint bertanda ketiganya. Ia BUKAN standar nasional
   * dan bukan saran hukum.
   */
  is_sample_data      BOOLEAN NOT NULL DEFAULT FALSE,
  active              BOOLEAN NOT NULL DEFAULT FALSE,
  production_approved BOOLEAN NOT NULL DEFAULT FALSE,

  sample_batch_id UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT fee_policy_basis_valid CHECK (
    basis IN ('GROSS_CHARGE', 'NET_CHARGE', 'NET_COLLECTED', 'VERIFIED_CLAIM',
              'PAID_CLAIM', 'FIXED_AMOUNT')
  ),
  CONSTRAINT fee_policy_period_sane CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  ),
  -- Pembuat kebijakan tidak menyetujui versinya sendiri.
  CONSTRAINT fee_policy_approval_not_self CHECK (
    approved_by IS NULL OR created_by IS NULL OR approved_by <> created_by
  ),
  -- Aktif menuntut persetujuan.
  CONSTRAINT fee_policy_active_needs_approval CHECK (
    active = FALSE OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  /*
   * TEMPLAT CONTOH TIDAK DAPAT AKTIF SEBELUM DISETUJUI UNTUK PRODUKSI.
   *
   * Persentase produksi ditentukan masing-masing fasilitas bersama tenaga
   * medisnya. Templat yang aktif tanpa persetujuan itu akan membayar orang
   * dengan angka yang tidak pernah disepakati siapa pun.
   */
  CONSTRAINT fee_policy_sample_not_production CHECK (
    is_sample_data = FALSE OR active = FALSE OR production_approved = TRUE
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fee_policy_code
  ON "{{TENANT_SCHEMA}}".fee_policy (facility_id, code);
CREATE INDEX IF NOT EXISTS ix_fee_policy_active
  ON "{{TENANT_SCHEMA}}".fee_policy (facility_id, effective_from)
  WHERE active = TRUE;

-- ---------------------------------------------------------------------------
-- Baris kebijakan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_policy_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".fee_policy (id) ON DELETE CASCADE,
  recipient       VARCHAR(32) NOT NULL,
  method          VARCHAR(24) NOT NULL,

  -- Nilainya datang dari kesepakatan fasilitas. Tidak ada bawaan.
  value           NUMERIC(12,4) NOT NULL,

  provider_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  contributor_role VARCHAR(48),
  note            TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fee_line_recipient_valid CHECK (
    recipient IN (
      'FACILITY_FEE', 'DOCTOR_FEE', 'MIDWIFE_FEE', 'NURSE_FEE', 'PHARMACY_SERVICE_FEE',
      'LAB_SERVICE_FEE', 'RADIOLOGY_SERVICE_FEE', 'ANESTHESIA_FEE', 'ASSISTANT_FEE',
      'WARD_SERVICE_FEE', 'BED_FACILITY_FEE', 'EQUIPMENT_USAGE_FEE',
      'MEDICAL_DEVICE_USAGE_FEE', 'DRUG_DISPENSING_FEE', 'TEAM_POOL_FEE',
      'MANAGEMENT_POOL', 'SUPPORT_STAFF_POOL', 'SYSTEM_PLATFORM_FEE', 'INVESTOR_SHARE',
      'RESERVE_FUND', 'QUALITY_FUND', 'TAX_WITHHOLDING', 'OTHER_FEE'
    )
  ),
  CONSTRAINT fee_line_method_valid CHECK (
    method IN ('PERCENTAGE', 'FIXED_AMOUNT', 'POINT_BASED', 'TIME_BASED',
               'UNIT_BASED', 'WEIGHTED_SCORE')
  ),
  CONSTRAINT fee_line_value_non_negative CHECK (value >= 0),
  CONSTRAINT fee_line_percentage_sane CHECK (
    method <> 'PERCENTAGE' OR value <= 100
  )
);

CREATE INDEX IF NOT EXISTS ix_fee_policy_line_policy
  ON "{{TENANT_SCHEMA}}".fee_policy_line (policy_id, sort_order);

/*
 * JUMLAH PERSENTASE TIDAK MELEBIHI SERATUS.
 *
 * Melebihi seratus berarti rumah sakit membagikan uang yang tidak dimilikinya.
 * Kurang dari seratus sah — sisanya menjadi bagian fasilitas, dan banyak
 * kesepakatan memang berbentuk begitu.
 *
 * Ditegakkan trigger karena ia menuntut penjumlahan lintas baris; CHECK
 * constraint tidak dapat melakukannya.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".check_fee_policy_total()
RETURNS TRIGGER AS $$
DECLARE
  total NUMERIC;
  pid   UUID;
BEGIN
  pid := COALESCE(NEW.policy_id, OLD.policy_id);

  SELECT COALESCE(sum(value), 0) INTO total
    FROM "{{TENANT_SCHEMA}}".fee_policy_line
   WHERE policy_id = pid AND method = 'PERCENTAGE';

  IF total > 100 THEN
    RAISE EXCEPTION
      'FEE_POLICY_OVER_100: jumlah persentase pada kebijakan ini % persen. Rumah sakit akan '
      'membagikan uang yang tidak dimilikinya.', total
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fee_policy_total ON "{{TENANT_SCHEMA}}".fee_policy_line;
CREATE CONSTRAINT TRIGGER trg_fee_policy_total
  AFTER INSERT OR UPDATE ON "{{TENANT_SCHEMA}}".fee_policy_line
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".check_fee_policy_total();

/*
 * KEBIJAKAN YANG SUDAH AKTIF TIDAK DAPAT DIUBAH BARISNYA.
 *
 * Perhitungan jasa yang sudah dilakukan memakai baris ini harus tetap dapat
 * dijelaskan. Yang hendak mengubah kesepakatan membuat versi baru; itulah
 * gunanya versi.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_active_fee_policy_mutation()
RETURNS TRIGGER AS $$
DECLARE
  aktif BOOLEAN;
BEGIN
  SELECT active INTO aktif
    FROM "{{TENANT_SCHEMA}}".fee_policy
   WHERE id = COALESCE(OLD.policy_id, NEW.policy_id);

  IF aktif THEN
    RAISE EXCEPTION
      'FEE_POLICY_ACTIVE: baris kebijakan yang sudah aktif tidak dapat diubah maupun dihapus. '
      'Perhitungan jasa yang sudah dilakukan memakainya harus tetap dapat dijelaskan — buat '
      'versi baru.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fee_policy_line_immutable ON "{{TENANT_SCHEMA}}".fee_policy_line;
CREATE TRIGGER trg_fee_policy_line_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".fee_policy_line
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_active_fee_policy_mutation();

-- ---------------------------------------------------------------------------
-- Kontributor per tindakan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_contributor (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  -- Tindakan yang jasanya dibagi. Salah satunya wajib.
  encounter_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  admission_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,
  ot_case_id      UUID REFERENCES "{{TENANT_SCHEMA}}".ot_case (id) ON DELETE RESTRICT,

  provider_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  contributor_role VARCHAR(48) NOT NULL,

  /*
   * BUKTI KEHADIRAN.
   *
   * Sumbernya sudah ada sejak H-7: ot_checklist.completed_by,
   * ot_count.counted_out_by, ot_case.surgeon_id, ot_case.anaesthetist_id.
   * Disimpan sebagai penunjuk, bukan sebagai kotak centang — kotak centang
   * dapat dicentang siapa saja.
   */
  attendance_evidence VARCHAR(120),

  percentage      NUMERIC(6,3),
  point           NUMERIC(10,3),
  fixed_amount    NUMERIC(18,2),
  duration_minutes INTEGER,
  complexity_weight NUMERIC(6,3),
  clinical_responsibility VARCHAR(24),

  recorded_by     UUID,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT fee_contributor_target CHECK (
    encounter_id IS NOT NULL OR admission_id IS NOT NULL OR ot_case_id IS NOT NULL
  ),
  CONSTRAINT fee_contributor_percentage_sane CHECK (
    percentage IS NULL OR (percentage >= 0 AND percentage <= 100)
  ),
  CONSTRAINT fee_contributor_non_negative CHECK (
    (point IS NULL OR point >= 0)
    AND (fixed_amount IS NULL OR fixed_amount >= 0)
    AND (duration_minutes IS NULL OR duration_minutes >= 0)
    AND (complexity_weight IS NULL OR complexity_weight >= 0)
  ),
  CONSTRAINT fee_contributor_responsibility_valid CHECK (
    clinical_responsibility IS NULL
    OR clinical_responsibility IN ('PRIMARY', 'ASSISTANT', 'SUPERVISING', 'CONSULTING', 'SUPPORT')
  )
);

CREATE INDEX IF NOT EXISTS ix_fee_contributor_case
  ON "{{TENANT_SCHEMA}}".fee_contributor (ot_case_id) WHERE ot_case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_fee_contributor_encounter
  ON "{{TENANT_SCHEMA}}".fee_contributor (encounter_id) WHERE encounter_id IS NOT NULL;

-- Satu pemberi layanan hanya sekali per peran pada satu tindakan. Tanpa ini,
-- daftar kontributor dapat memuat nama yang sama tiga kali dengan peran yang
-- sama, dan jumlahnya akan tampak wajar pada setiap barisnya.
CREATE UNIQUE INDEX IF NOT EXISTS ux_fee_contributor_case_role
  ON "{{TENANT_SCHEMA}}".fee_contributor (ot_case_id, provider_id, contributor_role)
  WHERE ot_case_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_policy', 'fee_policy_line', 'fee_contributor'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
