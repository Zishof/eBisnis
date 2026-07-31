-- =========================================================================
-- K-4 — PINJAMAN, PEMBIAYAAN, ANGSURAN, DAN PENAGIHAN
--
-- Migrasi modul. Aditif; tidak ada tabel maupun kolom Core yang disentuh.
--
-- Satu keputusan menentukan bentuk berkas ini: **jadwal angsuran dibekukan
-- saat pencairan.** Perubahan sesudahnya selalu berupa restrukturisasi yang
-- membentuk jadwal baru dan menandai yang lama — bukan penyuntingan jadwal
-- lama. Jadwal yang disunting diam-diam membuat riwayat tunggakan anggota
-- tidak dapat dipertanggungjawabkan, dan riwayat itulah dasar penilaian
-- kelayakan pinjamannya berikutnya.
-- =========================================================================

-- Produk pinjaman -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_loan_product (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,

  method          VARCHAR(24) NOT NULL,
  -- Tarif tahunan untuk metode konvensional. NULL untuk akad syariah.
  annual_rate     NUMERIC(9,6),
  -- Tarif margin acuan untuk murabahah; nilai akhirnya ditetapkan per akad.
  margin_rate     NUMERIC(9,6),
  -- Nisbah bagi hasil mudharabah, porsi koperasi.
  nisbah          NUMERIC(9,6),

  min_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  max_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  min_tenor_months INTEGER NOT NULL DEFAULT 1,
  max_tenor_months INTEGER NOT NULL DEFAULT 60,

  minimum_membership_months INTEGER NOT NULL DEFAULT 0,
  minimum_mandatory_saving  NUMERIC(18,2) NOT NULL DEFAULT 0,
  max_loan_to_saving_ratio  NUMERIC(9,4) NOT NULL DEFAULT 0,
  max_active_loans INTEGER NOT NULL DEFAULT 1,

  admin_fee_rate  NUMERIC(9,6) NOT NULL DEFAULT 0,
  penalty_daily_rate NUMERIC(9,6) NOT NULL DEFAULT 0,
  penalty_grace_days INTEGER NOT NULL DEFAULT 0,
  penalty_max_multiplier NUMERIC(9,4) NOT NULL DEFAULT 0,
  early_settlement_discount NUMERIC(5,4) NOT NULL DEFAULT 0,

  requires_collateral BOOLEAN NOT NULL DEFAULT FALSE,
  requires_guarantor  BOOLEAN NOT NULL DEFAULT FALSE,
  requires_survey     BOOLEAN NOT NULL DEFAULT FALSE,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_coop_loan_product_code UNIQUE (cooperative_id, code),
  CONSTRAINT ck_coop_loan_method CHECK (method IN
    ('FLAT', 'EFFECTIVE', 'ANNUITY', 'MURABAHA', 'MUDHARABAH', 'IJARAH', 'QARDH')),
  CONSTRAINT ck_coop_loan_tenor CHECK (max_tenor_months >= min_tenor_months),
  CONSTRAINT ck_coop_loan_amount
    CHECK (max_amount = 0 OR max_amount >= min_amount),
  /*
   * Akad syariah TIDAK boleh membawa tarif bunga, dan metode konvensional
   * tidak boleh membawa nisbah. Ditegakkan basis data supaya tidak ada produk
   * yang membawa keduanya — produk semacam itu tidak dapat dipertanggung-
   * jawabkan kepada Dewan Pengawas Syariah maupun kepada pengawas
   * konvensional.
   */
  CONSTRAINT ck_coop_loan_sharia_no_interest
    CHECK (method NOT IN ('MURABAHA', 'MUDHARABAH', 'IJARAH', 'QARDH')
           OR annual_rate IS NULL),
  CONSTRAINT ck_coop_loan_conventional_no_nisbah
    CHECK (method NOT IN ('FLAT', 'EFFECTIVE', 'ANNUITY')
           OR (nisbah IS NULL AND margin_rate IS NULL)),
  -- Qardh adalah pinjaman kebajikan: tanpa imbalan apa pun.
  CONSTRAINT ck_coop_loan_qardh_no_return
    CHECK (method <> 'QARDH' OR (annual_rate IS NULL AND margin_rate IS NULL AND nisbah IS NULL))
);

-- Pengajuan pinjaman --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_loan_application (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,
  product_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan_product (id) ON DELETE RESTRICT,

  application_number VARCHAR(64),
  requested_amount NUMERIC(18,2) NOT NULL,
  requested_tenor  INTEGER NOT NULL,
  purpose         TEXT,

  approved_amount NUMERIC(18,2),
  approved_tenor  INTEGER,
  approved_rate   NUMERIC(9,6),
  approved_margin NUMERIC(18,2),

  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',

  submitted_at    TIMESTAMPTZ,
  submitted_by    UUID,
  surveyed_at     TIMESTAMPTZ,
  surveyed_by     UUID,
  analyzed_at     TIMESTAMPTZ,
  analyzed_by     UUID,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID,
  rejected_at     TIMESTAMPTZ,
  rejected_by     UUID,
  rejection_reason TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_loan_app_status CHECK (status IN
    ('DRAFT', 'SUBMITTED', 'UNDER_SURVEY', 'UNDER_ANALYSIS', 'PENDING_APPROVAL',
     'APPROVED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT ck_coop_loan_app_amount_positive CHECK (requested_amount > 0),
  CONSTRAINT ck_coop_loan_app_tenor_positive CHECK (requested_tenor > 0),

  /*
   * PEMISAHAN WEWENANG, ditegakkan basis data.
   *
   * Ketiganya tidak boleh orang yang sama. Analisis yang dibuat untuk
   * membenarkan persetujuan yang sudah diputuskan bukan analisis, dan penyetuju
   * yang sekaligus mencairkan memegang keputusan sekaligus uangnya.
   *
   * Ditegakkan di basis data pula — bukan hanya di layanan — sebab aturan yang
   * hanya ada di satu lapisan berhenti berlaku begitu ada jalan kedua menuju
   * tabel ini.
   */
  CONSTRAINT ck_coop_loan_app_analyst_not_surveyor
    CHECK (analyzed_by IS NULL OR surveyed_by IS NULL OR analyzed_by <> surveyed_by),
  CONSTRAINT ck_coop_loan_app_approver_not_analyst
    CHECK (approved_by IS NULL OR analyzed_by IS NULL OR approved_by <> analyzed_by),
  CONSTRAINT ck_coop_loan_app_approved_needs_amount
    CHECK (status <> 'APPROVED' OR (approved_amount IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT ck_coop_loan_app_rejected_needs_reason
    CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_loan_app_number
  ON "{{TENANT_SCHEMA}}".cooperative_loan_application (application_number)
  WHERE application_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_coop_loan_app_member
  ON "{{TENANT_SCHEMA}}".cooperative_loan_application (member_id, status);

-- Agunan dan penjamin -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_collateral (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan_application (id) ON DELETE CASCADE,
  collateral_type VARCHAR(32) NOT NULL,
  description     TEXT NOT NULL,
  document_number VARCHAR(120),
  -- Nilai taksiran termasuk data yang dimasker pada log dan audit.
  estimated_value NUMERIC(18,2),
  appraised_value NUMERIC(18,2),
  appraised_by    UUID,
  appraised_at    TIMESTAMPTZ,
  file_id         UUID,
  released_at     TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_collateral_type CHECK (collateral_type IN
    ('LAND_CERTIFICATE', 'VEHICLE_BPKB', 'SAVING_BLOCK', 'GOODS', 'SALARY_SLIP', 'OTHER'))
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_guarantor (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan_application (id) ON DELETE CASCADE,
  guarantor_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,
  full_name       VARCHAR(255) NOT NULL,
  identity_number VARCHAR(64),
  relationship    VARCHAR(48),
  phone           VARCHAR(48),
  agreed_at       TIMESTAMPTZ,
  file_id         UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

-- Analisis dan survei -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_credit_analysis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan_application (id) ON DELETE CASCADE,
  monthly_income  NUMERIC(18,2),
  monthly_expense NUMERIC(18,2),
  existing_installment NUMERIC(18,2),
  proposed_installment NUMERIC(18,2),
  debt_service_ratio NUMERIC(9,4),
  character_score INTEGER,
  capacity_score  INTEGER,
  capital_score   INTEGER,
  collateral_score INTEGER,
  condition_score INTEGER,
  recommendation  VARCHAR(24),
  -- Isi analisis termasuk data yang tidak boleh masuk log.
  notes           TEXT,
  analyzed_by     UUID,
  analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_analysis_recommendation
    CHECK (recommendation IS NULL OR recommendation IN ('APPROVE', 'REJECT', 'APPROVE_WITH_CONDITION'))
);

-- Pinjaman berjalan ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_loan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,
  application_id  UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan_application (id) ON DELETE SET NULL,
  product_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan_product (id) ON DELETE RESTRICT,

  loan_number     VARCHAR(64) NOT NULL,
  method          VARCHAR(24) NOT NULL,

  principal       NUMERIC(18,2) NOT NULL,
  annual_rate     NUMERIC(9,6),
  total_margin    NUMERIC(18,2),
  tenor_months    INTEGER NOT NULL,
  first_due_date  DATE NOT NULL,

  -- Angka yang dibekukan saat pencairan.
  total_interest  NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_payable   NUMERIC(18,2) NOT NULL DEFAULT 0,

  outstanding_principal NUMERIC(18,2) NOT NULL DEFAULT 0,
  outstanding_interest  NUMERIC(18,2) NOT NULL DEFAULT 0,
  outstanding_penalty   NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_principal  NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_interest   NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_penalty    NUMERIC(18,2) NOT NULL DEFAULT 0,

  days_overdue    INTEGER NOT NULL DEFAULT 0,
  risk_class      VARCHAR(24) NOT NULL DEFAULT 'CURRENT',
  provision_amount NUMERIC(18,2) NOT NULL DEFAULT 0,

  status          VARCHAR(24) NOT NULL DEFAULT 'DISBURSED',

  agreement_number VARCHAR(120),
  agreement_date   DATE,
  signed_by_position_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_board_position (id) ON DELETE SET NULL,

  disbursed_at    TIMESTAMPTZ,
  disbursed_by    UUID,
  settled_at      TIMESTAMPTZ,
  written_off_at  TIMESTAMPTZ,
  written_off_by  UUID,
  written_off_approved_by UUID,

  restructured_from_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan (id) ON DELETE SET NULL,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_loan_status CHECK (status IN
    ('DISBURSED', 'ACTIVE', 'IN_ARREARS', 'RESTRUCTURED', 'SETTLED', 'WRITTEN_OFF')),
  CONSTRAINT ck_coop_loan_risk_class CHECK (risk_class IN
    ('CURRENT', 'SPECIAL_MENTION', 'SUBSTANDARD', 'DOUBTFUL', 'LOSS')),
  CONSTRAINT ck_coop_loan_principal_positive CHECK (principal > 0),
  CONSTRAINT ck_coop_loan_outstanding_nonnegative
    CHECK (outstanding_principal >= 0 AND outstanding_interest >= 0 AND outstanding_penalty >= 0),
  -- Yang sudah dibayar tidak pernah melebihi yang terutang.
  CONSTRAINT ck_coop_loan_paid_bounded
    CHECK (paid_principal <= principal),
  /*
   * Penghapusbukuan menuntut DUA orang berbeda: yang mengusulkan dan yang
   * menyetujui. Perbuatan ini yang paling mudah dipakai menghapus jejak
   * pinjaman bermasalah, dan satu tanda tangan tidak cukup untuk itu.
   */
  CONSTRAINT ck_coop_loan_writeoff_two_persons
    CHECK (written_off_by IS NULL OR written_off_approved_by IS NULL
           OR written_off_by <> written_off_approved_by),
  CONSTRAINT ck_coop_loan_writeoff_needs_both
    CHECK (status <> 'WRITTEN_OFF'
           OR (written_off_by IS NOT NULL AND written_off_approved_by IS NOT NULL
               AND written_off_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_loan_number
  ON "{{TENANT_SCHEMA}}".cooperative_loan (cooperative_id, loan_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_coop_loan_member
  ON "{{TENANT_SCHEMA}}".cooperative_loan (member_id, status);

CREATE INDEX IF NOT EXISTS ix_coop_loan_risk
  ON "{{TENANT_SCHEMA}}".cooperative_loan (cooperative_id, risk_class, days_overdue);

-- Pencairan -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_loan_disbursement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan (id) ON DELETE RESTRICT,
  amount          NUMERIC(18,2) NOT NULL,
  admin_fee       NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(18,2) NOT NULL,
  payment_method_id UUID REFERENCES "{{TENANT_SCHEMA}}".payment_method (id) ON DELETE SET NULL,
  reference       VARCHAR(120),
  disbursed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  disbursed_by    UUID,
  accounting_event_id UUID,
  idempotency_key VARCHAR(120),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_disbursement_amount CHECK (amount > 0),
  CONSTRAINT ck_coop_disbursement_net CHECK (net_amount = amount - admin_fee)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_disbursement_idempotency
  ON "{{TENANT_SCHEMA}}".cooperative_loan_disbursement (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Jadwal angsuran -----------------------------------------------------------
--
-- Dibekukan saat pencairan. Restrukturisasi membentuk jadwal BARU pada
-- pinjaman baru yang menunjuk pinjaman lama lewat `restructured_from_id`;
-- baris di sini tidak pernah disunting nilainya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_installment_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan (id) ON DELETE CASCADE,
  installment_no  INTEGER NOT NULL,
  due_date        DATE NOT NULL,

  principal_due   NUMERIC(18,2) NOT NULL,
  interest_due    NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_due       NUMERIC(18,2) NOT NULL,

  principal_paid  NUMERIC(18,2) NOT NULL DEFAULT 0,
  interest_paid   NUMERIC(18,2) NOT NULL DEFAULT 0,
  penalty_accrued NUMERIC(18,2) NOT NULL DEFAULT 0,
  penalty_paid    NUMERIC(18,2) NOT NULL DEFAULT 0,

  remaining_principal NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_at         TIMESTAMPTZ,
  status          VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED',

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_schedule_status CHECK (status IN
    ('SCHEDULED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'RESTRUCTURED', 'WAIVED')),
  CONSTRAINT ck_coop_schedule_total CHECK (total_due = principal_due + interest_due),
  CONSTRAINT ck_coop_schedule_paid_bounded
    CHECK (principal_paid <= principal_due AND interest_paid <= interest_due),
  CONSTRAINT ck_coop_schedule_nonnegative
    CHECK (principal_due >= 0 AND interest_due >= 0 AND penalty_accrued >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_schedule_loan_no
  ON "{{TENANT_SCHEMA}}".cooperative_installment_schedule (loan_id, installment_no);

CREATE INDEX IF NOT EXISTS ix_coop_schedule_due
  ON "{{TENANT_SCHEMA}}".cooperative_installment_schedule (due_date, status);

-- Pembayaran angsuran -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_installment_payment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan (id) ON DELETE RESTRICT,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,
  schedule_id     UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_installment_schedule (id) ON DELETE SET NULL,

  payment_number  VARCHAR(64),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  amount          NUMERIC(18,2) NOT NULL,

  -- Pembagian ke denda, jasa, lalu pokok. Urutannya bukan sembarang:
  -- mendahulukan pokok membuat denda dan jasa menumpuk tanpa pernah terbayar.
  allocated_penalty   NUMERIC(18,2) NOT NULL DEFAULT 0,
  allocated_interest  NUMERIC(18,2) NOT NULL DEFAULT 0,
  allocated_principal NUMERIC(18,2) NOT NULL DEFAULT 0,
  excess_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,

  payment_method_id UUID REFERENCES "{{TENANT_SCHEMA}}".payment_method (id) ON DELETE SET NULL,
  reference       VARCHAR(120),
  note            TEXT,

  accounting_event_id UUID,
  idempotency_key VARCHAR(120),
  reversal_of_id  UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_installment_payment (id) ON DELETE SET NULL,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  active_role_id  UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_payment_amount_positive CHECK (amount > 0),
  -- Seluruh alokasi wajib berjumlah sama dengan pembayarannya. Selisih di sini
  -- berarti uang yang diterima tidak sampai ke mana pun.
  CONSTRAINT ck_coop_payment_allocation_balanced
    CHECK (amount = allocated_penalty + allocated_interest + allocated_principal + excess_amount),
  CONSTRAINT ck_coop_payment_allocation_nonnegative
    CHECK (allocated_penalty >= 0 AND allocated_interest >= 0
           AND allocated_principal >= 0 AND excess_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_payment_idempotency
  ON "{{TENANT_SCHEMA}}".cooperative_installment_payment (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_coop_payment_loan
  ON "{{TENANT_SCHEMA}}".cooperative_installment_payment (loan_id, payment_date);

-- Restrukturisasi -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_loan_restructuring (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_loan_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan (id) ON DELETE RESTRICT,
  new_loan_id     UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan (id) ON DELETE SET NULL,
  restructure_type VARCHAR(32) NOT NULL,
  reason          TEXT NOT NULL,
  old_outstanding NUMERIC(18,2) NOT NULL,
  new_principal   NUMERIC(18,2) NOT NULL,
  new_tenor       INTEGER NOT NULL,
  waived_interest NUMERIC(18,2) NOT NULL DEFAULT 0,
  waived_penalty  NUMERIC(18,2) NOT NULL DEFAULT 0,
  requested_by    UUID,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_restructure_type CHECK (restructure_type IN
    ('TENOR_EXTENSION', 'RATE_REDUCTION', 'PENALTY_WAIVER', 'PRINCIPAL_RESCHEDULE', 'COMBINED')),
  -- Yang mengusulkan restrukturisasi tidak menyetujuinya sendiri.
  CONSTRAINT ck_coop_restructure_no_self_approval
    CHECK (approved_by IS NULL OR requested_by IS NULL OR approved_by <> requested_by)
);

-- Penagihan -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_collection_case (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  loan_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_loan (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,
  case_number     VARCHAR(64),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  days_overdue_at_open INTEGER NOT NULL DEFAULT 0,
  arrears_at_open NUMERIC(18,2) NOT NULL DEFAULT 0,
  assigned_to     UUID,
  status          VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  outcome         VARCHAR(32),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_collection_status CHECK (status IN
    ('OPEN', 'IN_PROGRESS', 'PROMISED', 'ESCALATED', 'RESOLVED', 'CLOSED')),
  CONSTRAINT ck_coop_collection_outcome CHECK (outcome IS NULL OR outcome IN
    ('PAID', 'RESTRUCTURED', 'WRITTEN_OFF', 'LEGAL', 'UNRESOLVED'))
);

CREATE INDEX IF NOT EXISTS ix_coop_collection_loan
  ON "{{TENANT_SCHEMA}}".cooperative_collection_case (loan_id, status);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_collection_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_collection_case (id) ON DELETE CASCADE,
  activity_type   VARCHAR(32) NOT NULL,
  activity_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by    UUID,
  result          VARCHAR(32),
  note            TEXT,
  -- Janji bayar: tanggal dan nilainya. Dipakai memantau kepatuhannya.
  promise_date    DATE,
  promise_amount  NUMERIC(18,2),
  promise_kept    BOOLEAN,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_collection_activity_type CHECK (activity_type IN
    ('CALL', 'SMS', 'WHATSAPP', 'LETTER', 'VISIT', 'MEETING', 'LEGAL_NOTICE', 'OTHER')),
  -- Janji bayar wajib menyebutkan tanggal DAN nilainya. Janji tanpa angka
  -- tidak dapat dipantau kepatuhannya, dan janji yang tidak dapat dipantau
  -- sama saja dengan tidak ada janji.
  CONSTRAINT ck_coop_collection_promise_complete
    CHECK ((promise_date IS NULL AND promise_amount IS NULL)
           OR (promise_date IS NOT NULL AND promise_amount IS NOT NULL AND promise_amount > 0))
);

CREATE INDEX IF NOT EXISTS ix_coop_collection_activity_case
  ON "{{TENANT_SCHEMA}}".cooperative_collection_activity (case_id, activity_at);
