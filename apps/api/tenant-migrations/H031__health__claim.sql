-- =========================================================================
-- H031 — SIKLUS KLAIM INTERNAL
-- =========================================================================
--
-- Fase H-9C. Aditif seluruhnya.
--
-- Sembilan dari lima belas tahap siklus klaim dapat berjalan tanpa kredensial
-- siapa pun, dan sembilan itulah yang paling banyak menghabiskan waktu petugas
-- rumah sakit. Penghalang kredensial menahan ujung-ujungnya, bukan tengahnya.
--
-- Empat hal ditegakkan basis data di sini.
--
-- 1. **TIGA ANGKA DISIMPAN TERPISAH:** diajukan, disetujui, dibayar. Menyamakan
--    yang pertama dengan yang ketiga adalah cara paling langsung membuat rumah
--    sakit mengira dirinya punya uang yang tidak ada — lalu membagikannya
--    sebagai jasa medis.
--
-- 2. **Selisih yang merugikan wajib bersebab, dan sebabnya KODE TERTUTUP.**
--    Laporan yang tidak dapat menghitung sebab penolakan tidak dapat
--    memperbaikinya.
--
-- 3. **Klaim yang sudah diajukan tidak dapat dihapus.** Ia sudah ada di sisi
--    penjamin pula, dan catatan yang hilang di satu sisi menjadi selisih yang
--    tidak dapat dijelaskan pada rekonsiliasi berikutnya.
--
-- 4. **Penanda anti-fraud tidak pernah menghentikan pengajuan.** Kolomnya
--    bernama `needs_review`, bukan `blocked` — dan tidak ada satu pun constraint
--    yang memakainya untuk menahan.

-- ---------------------------------------------------------------------------
-- Klaim
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_claim (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number    VARCHAR(64) NOT NULL,
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  encounter_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  admission_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,
  coding_id       UUID REFERENCES "{{TENANT_SCHEMA}}".him_coding (id) ON DELETE RESTRICT,
  payer_coverage_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_payer_coverage (id) ON DELETE RESTRICT,

  -- Catatan lokal SEP. Nomornya berasal dari penjamin; kami hanya menyimpannya,
  -- dan tidak pernah mengarangnya.
  sep_number      VARCHAR(64),
  membership_number VARCHAR(64),

  service_date    DATE NOT NULL,
  admitted_at     TIMESTAMPTZ,
  discharged_at   TIMESTAMPTZ,
  billed_class    VARCHAR(16),
  entitled_class  VARCHAR(16),

  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',

  /*
   * TIGA ANGKA, TIGA KOLOM.
   *
   * Tidak ada satu pun kolom "nilai klaim" yang menyatukannya. Kolom tunggal
   * akan dipakai bergantian sebagai ketiganya, dan tidak ada yang akan tahu
   * yang mana yang tersimpan pada baris mana.
   */
  submitted_amount NUMERIC(18,2),
  approved_amount  NUMERIC(18,2),
  paid_amount      NUMERIC(18,2),

  rejection_reason VARCHAR(32),
  rejection_note   TEXT,

  -- Penanda anti-fraud. BUKAN penahan.
  needs_review     BOOLEAN NOT NULL DEFAULT FALSE,
  review_note      TEXT,
  reviewed_by      UUID,
  reviewed_at      TIMESTAMPTZ,

  coded_by        UUID,
  coded_at        TIMESTAMPTZ,
  verified_by     UUID,
  verified_at     TIMESTAMPTZ,
  submitted_by    UUID,
  submitted_at    TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  reconciled_by   UUID,
  reconciled_at   TIMESTAMPTZ,

  cancel_reason   TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT health_claim_status_valid CHECK (
    status IN ('DRAFT', 'CODED', 'INTERNALLY_VERIFIED', 'READY_TO_SUBMIT', 'SUBMITTED',
               'PENDING', 'DISPUTED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED',
               'PAID', 'RECONCILED', 'CANCELLED')
  ),
  CONSTRAINT health_claim_target CHECK (encounter_id IS NOT NULL OR admission_id IS NOT NULL),
  CONSTRAINT health_claim_amounts_non_negative CHECK (
    (submitted_amount IS NULL OR submitted_amount >= 0)
    AND (approved_amount IS NULL OR approved_amount >= 0)
    AND (paid_amount IS NULL OR paid_amount >= 0)
  ),
  CONSTRAINT health_claim_reason_valid CHECK (
    rejection_reason IS NULL OR rejection_reason IN (
      'CODING_ERROR', 'DOCUMENTATION_INCOMPLETE', 'MEDICAL_NECESSITY', 'DUPLICATE_CLAIM',
      'ELIGIBILITY_ISSUE', 'TARIFF_MISMATCH', 'SERVICE_NOT_COVERED', 'ADMINISTRATIVE', 'OTHER'
    )
  ),
  /*
   * SELISIH YANG MERUGIKAN WAJIB BERSEBAB.
   *
   * Tanpa sebabnya, laporan penolakan tidak dapat dihitung — dan yang tidak
   * dapat dihitung tidak dapat diperbaiki.
   */
  CONSTRAINT health_claim_gap_needs_reason CHECK (
    approved_amount IS NULL OR submitted_amount IS NULL
    OR approved_amount >= submitted_amount
    OR rejection_reason IS NOT NULL
  ),
  -- Sebab OTHER wajib berketerangan; tanpa itu ia menjadi tempat pembuangan
  -- yang menampung separuh penolakan dan tidak menjelaskan satu pun.
  CONSTRAINT health_claim_other_needs_note CHECK (
    rejection_reason <> 'OTHER'
    OR (rejection_note IS NOT NULL AND length(trim(rejection_note)) >= 5)
  ),
  CONSTRAINT health_claim_submitted_complete CHECK (
    status NOT IN ('SUBMITTED', 'PENDING', 'DISPUTED', 'APPROVED', 'PARTIALLY_APPROVED',
                   'REJECTED', 'PAID', 'RECONCILED')
    OR (submitted_at IS NOT NULL AND submitted_amount IS NOT NULL)
  ),
  CONSTRAINT health_claim_paid_complete CHECK (
    status NOT IN ('PAID', 'RECONCILED') OR (paid_at IS NOT NULL AND paid_amount IS NOT NULL)
  ),
  CONSTRAINT health_claim_cancel_reason CHECK (
    status <> 'CANCELLED' OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) >= 5)
  ),
  -- Yang mengode tidak memverifikasi klaimnya sendiri.
  CONSTRAINT health_claim_verify_not_self CHECK (
    verified_by IS NULL OR coded_by IS NULL OR verified_by <> coded_by
  ),
  CONSTRAINT health_claim_dates_plausible CHECK (
    admitted_at IS NULL OR discharged_at IS NULL OR discharged_at >= admitted_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_claim_number
  ON "{{TENANT_SCHEMA}}".health_claim (claim_number);
CREATE INDEX IF NOT EXISTS ix_health_claim_worklist
  ON "{{TENANT_SCHEMA}}".health_claim (facility_id, status, service_date);
CREATE INDEX IF NOT EXISTS ix_health_claim_review
  ON "{{TENANT_SCHEMA}}".health_claim (facility_id) WHERE needs_review = TRUE;

/*
 * SATU KLAIM PER KUNJUNGAN YANG MASIH HIDUP.
 *
 * Klaim ganda atas kunjungan yang sama adalah salah satu sebab penolakan yang
 * paling sering, dan yang paling mudah dicegah. Yang dibatalkan tidak dihitung:
 * kunjungan yang klaimnya batal memang boleh diklaimkan ulang.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_claim_one_per_encounter
  ON "{{TENANT_SCHEMA}}".health_claim (encounter_id)
  WHERE encounter_id IS NOT NULL AND status <> 'CANCELLED';
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_claim_one_per_admission
  ON "{{TENANT_SCHEMA}}".health_claim (admission_id)
  WHERE admission_id IS NOT NULL AND status <> 'CANCELLED';

/*
 * KLAIM YANG SUDAH DIAJUKAN TIDAK DAPAT DIHAPUS.
 *
 * Ia sudah ada di sisi penjamin pula, dan catatan yang hilang di satu sisi
 * menjadi selisih yang tidak dapat dijelaskan pada rekonsiliasi berikutnya.
 * Yang belum diajukan boleh dihapus — ia belum ada di mana pun selain di sini.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_submitted_claim_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status NOT IN ('DRAFT', 'CODED', 'INTERNALLY_VERIFIED', 'READY_TO_SUBMIT') THEN
    RAISE EXCEPTION
      'CLAIM_SUBMITTED: klaim yang sudah diajukan tidak dapat dihapus. Ia sudah ada di sisi '
      'penjamin pula, dan catatan yang hilang di satu sisi menjadi selisih yang tidak dapat '
      'dijelaskan pada rekonsiliasi berikutnya.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_health_claim_no_delete ON "{{TENANT_SCHEMA}}".health_claim;
CREATE TRIGGER trg_health_claim_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".health_claim
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_submitted_claim_delete();

/*
 * NILAI YANG DIAJUKAN TIDAK BERUBAH SETELAH DIAJUKAN.
 *
 * Yang sudah dikirim ke penjamin adalah angka itu. Mengubahnya kemudian akan
 * membuat selisih pada rekonsiliasi tampak seperti kesalahan penjamin, padahal
 * angkanya yang bergeser di sini.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_submitted_amount_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.submitted_at IS NOT NULL
     AND NEW.submitted_amount IS DISTINCT FROM OLD.submitted_amount THEN
    RAISE EXCEPTION
      'CLAIM_SUBMITTED: nilai yang sudah diajukan tidak dapat diubah. Yang sudah dikirim ke '
      'penjamin adalah angka itu; mengubahnya akan membuat selisih pada rekonsiliasi tampak '
      'seperti kesalahan penjamin, padahal angkanya yang bergeser di sini.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_health_claim_amount_immutable ON "{{TENANT_SCHEMA}}".health_claim;
CREATE TRIGGER trg_health_claim_amount_immutable
  BEFORE UPDATE ON "{{TENANT_SCHEMA}}".health_claim
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_submitted_amount_change();

-- ---------------------------------------------------------------------------
-- Temuan verifikasi internal
-- ---------------------------------------------------------------------------
-- Satu baris per temuan, bernama, beserta peran yang memperbaikinya. Petugas
-- yang membaca "berkas tidak lengkap" akan memeriksa seluruhnya satu per satu —
-- dan pemeriksaan satu per satu itulah yang hendak digantikan mesin.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_claim_finding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_claim (id) ON DELETE CASCADE,
  finding_type    VARCHAR(48) NOT NULL,
  message         TEXT NOT NULL,
  blocks_submission BOOLEAN NOT NULL DEFAULT TRUE,
  responsible_role VARCHAR(64) NOT NULL,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_claim_finding_open
  ON "{{TENANT_SCHEMA}}".health_claim_finding (claim_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_claim_finding_role
  ON "{{TENANT_SCHEMA}}".health_claim_finding (responsible_role) WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------------
-- Penanda untuk telaah
-- ---------------------------------------------------------------------------
-- Kolomnya bernama `needs_review`; tidak ada satu pun kolom bernama `blocked`.
-- Penanda yang dapat menahan akan dipakai menahan, dan rumah sakit yang
-- klaimnya tertahan akan berhenti memakainya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_claim_flag (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_claim (id) ON DELETE CASCADE,
  flag_type       VARCHAR(48) NOT NULL,
  message         TEXT NOT NULL,
  raised_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  review_outcome  VARCHAR(24),
  review_note     TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT claim_flag_type_valid CHECK (
    flag_type IN ('DUPLICATE_MEMBER_DATE', 'LENGTH_OF_STAY_OUTLIER',
                  'UNUSUAL_PROCEDURE_FOR_DIAGNOSIS', 'CODER_PATTERN_OUTLIER',
                  'RAPID_READMISSION')
  ),
  CONSTRAINT claim_flag_outcome_valid CHECK (
    review_outcome IS NULL
    OR review_outcome IN ('EXPLAINED', 'CORRECTED', 'ESCALATED', 'NO_ISSUE')
  ),
  -- Telaah wajib berketerangan. Penanda yang ditutup tanpa keterangan sama
  -- saja dengan penanda yang tidak pernah ada.
  CONSTRAINT claim_flag_review_complete CHECK (
    reviewed_at IS NULL
    OR (reviewed_by IS NOT NULL AND review_outcome IS NOT NULL
        AND review_note IS NOT NULL AND length(trim(review_note)) >= 5)
  )
);

CREATE INDEX IF NOT EXISTS ix_claim_flag_open
  ON "{{TENANT_SCHEMA}}".health_claim_flag (claim_id) WHERE reviewed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Rekonsiliasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_claim_reconciliation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_claim (id) ON DELETE RESTRICT,

  -- TIGA SISI: catatan kami, catatan penjamin, mutasi rekening.
  our_paid_amount     NUMERIC(18,2) NOT NULL,
  payer_stated_amount NUMERIC(18,2) NOT NULL,
  bank_credited_amount NUMERIC(18,2) NOT NULL,
  payer_gap       NUMERIC(18,2) NOT NULL,
  bank_gap        NUMERIC(18,2) NOT NULL,
  bank_reference  VARCHAR(120),

  explanation     TEXT,
  closed_at       TIMESTAMPTZ,
  closed_by       UUID,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT claim_recon_non_negative CHECK (
    our_paid_amount >= 0 AND payer_stated_amount >= 0 AND bank_credited_amount >= 0
  ),
  /*
   * SELISIH YANG TIDAK TERJELASKAN TIDAK BOLEH DITUTUP.
   *
   * Rekonsiliasi yang dapat ditutup dengan selisih akan selalu ditutup dengan
   * selisih — dan selisih yang tertutup tidak pernah dicari lagi.
   */
  CONSTRAINT claim_recon_gap_needs_explanation CHECK (
    closed_at IS NULL
    OR (payer_gap = 0 AND bank_gap = 0)
    OR (explanation IS NOT NULL AND length(trim(explanation)) >= 10)
  ),
  CONSTRAINT claim_recon_closed_complete CHECK (
    closed_at IS NULL OR closed_by IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_claim_recon_claim
  ON "{{TENANT_SCHEMA}}".health_claim_reconciliation (claim_id);

DROP TRIGGER IF EXISTS trg_claim_recon_no_delete
  ON "{{TENANT_SCHEMA}}".health_claim_reconciliation;
CREATE TRIGGER trg_claim_recon_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".health_claim_reconciliation
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_claim', 'health_claim_finding', 'health_claim_flag',
                           'health_claim_reconciliation'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
