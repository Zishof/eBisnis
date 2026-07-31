-- =========================================================================
-- K-6 — SISA HASIL USAHA (SHU) DAN PATRONAGE
--
-- Migrasi modul. Aditif; tidak ada tabel maupun kolom Core yang disentuh.
--
-- Satu sifat menentukan bentuk berkas ini: **perhitungan SHU harus dapat
-- diulang.** Menjalankannya ulang atas periode dan kebijakan yang sama wajib
-- menghasilkan angka yang persis sama.
--
-- Karena itu angka masukannya DICUPLIK ke dalam tabel perhitungan, bukan
-- dibaca ulang dari data yang sementara itu sudah berubah. Simpanan seorang
-- anggota hari ini berbeda dari simpanannya saat periode buku ditutup; membaca
-- ulang berarti menghitung SHU tahun lalu memakai angka tahun ini.
-- =========================================================================

-- Kebijakan SHU dan komponennya ---------------------------------------------
--
-- Kebijakannya sendiri disimpan pada `cooperative_policy` (K-1) yang sudah
-- berversi dan bertanggal berlaku. Yang di sini adalah rincian komponennya,
-- ditautkan ke versi kebijakan tertentu.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_shu_component (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  policy_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_policy (id) ON DELETE CASCADE,
  component       VARCHAR(32) NOT NULL,
  ratio           NUMERIC(9,6) NOT NULL,
  account_mapping_code VARCHAR(64),
  note            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_shu_component CHECK (component IN
    ('RESERVE', 'CAPITAL_SERVICE', 'PATRONAGE_SERVICE', 'EDUCATION_FUND',
     'SOCIAL_FUND', 'BOARD_INCENTIVE', 'DEVELOPMENT_FUND')),
  CONSTRAINT ck_coop_shu_component_ratio CHECK (ratio >= 0 AND ratio <= 1),
  -- Satu komponen tercantum sekali saja per versi kebijakan.
  CONSTRAINT uq_coop_shu_component UNIQUE (policy_id, component)
);

CREATE INDEX IF NOT EXISTS ix_coop_shu_component_policy
  ON "{{TENANT_SCHEMA}}".cooperative_shu_component (policy_id);

-- Perhitungan SHU per periode -----------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_shu_calculation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  fiscal_year     INTEGER NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  -- Kebijakan yang dipakai, DICUPLIK bersama versinya. Kebijakan yang kelak
  -- diubah tidak mengubah perhitungan yang sudah dilakukan.
  policy_id       UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_policy (id) ON DELETE SET NULL,
  policy_code     VARCHAR(64) NOT NULL,
  policy_version  INTEGER NOT NULL,

  surplus         NUMERIC(18,2) NOT NULL,
  total_allocated NUMERIC(18,2) NOT NULL DEFAULT 0,
  capital_service_total   NUMERIC(18,2) NOT NULL DEFAULT 0,
  patronage_service_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  eligible_member_count   INTEGER NOT NULL DEFAULT 0,

  /*
   * Sidik jari masukan perhitungan. Dua perhitungan bersidik jari sama wajib
   * menghasilkan angka yang sama — dan itulah cara membuktikan bahwa
   * perhitungan ulang memakai masukan yang benar-benar sama, bukan sekadar
   * diyakini demikian.
   */
  input_fingerprint VARCHAR(32) NOT NULL,

  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  integrity_ok    BOOLEAN NOT NULL DEFAULT FALSE,
  integrity_note  TEXT,

  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculated_by   UUID,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID,
  -- Keputusan RAT yang mengesahkannya. Pembagian SHU tanpa keputusan RAT yang
  -- sah adalah pengurus membagikan uang anggota atas keputusannya sendiri.
  meeting_decision_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting_decision (id) ON DELETE SET NULL,
  distributed_at  TIMESTAMPTZ,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_shu_calc_status CHECK (status IN
    ('DRAFT', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'DISTRIBUTED', 'CANCELLED')),
  CONSTRAINT ck_coop_shu_calc_period CHECK (period_end > period_start),
  -- Perhitungan yang sudah disetujui WAJIB menunjuk keputusan RAT-nya.
  CONSTRAINT ck_coop_shu_calc_approved_needs_decision
    CHECK (status NOT IN ('APPROVED', 'DISTRIBUTED') OR meeting_decision_id IS NOT NULL),
  -- Perhitungan yang tidak utuh tidak boleh berstatus disetujui maupun
  -- dibagikan. Angka yang alokasinya tidak cocok dengan surplusnya tidak dapat
  -- dipertanggungjawabkan pada RAT.
  CONSTRAINT ck_coop_shu_calc_approved_needs_integrity
    CHECK (status NOT IN ('APPROVED', 'DISTRIBUTED') OR integrity_ok = TRUE),
  CONSTRAINT ck_coop_shu_calc_distributed_needs_date
    CHECK (status <> 'DISTRIBUTED' OR distributed_at IS NOT NULL)
);

-- Satu perhitungan hidup per tahun buku. Dua perhitungan atas tahun yang sama
-- berarti dua angka SHU, dan tidak ada yang tahu mana yang dibagikan.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_shu_calc_year
  ON "{{TENANT_SCHEMA}}".cooperative_shu_calculation (cooperative_id, fiscal_year)
  WHERE status <> 'CANCELLED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_coop_shu_calc_status
  ON "{{TENANT_SCHEMA}}".cooperative_shu_calculation (cooperative_id, status);

-- Alokasi per komponen, dibekukan --------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_shu_allocation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_shu_calculation (id) ON DELETE CASCADE,
  component       VARCHAR(32) NOT NULL,
  ratio           NUMERIC(9,6) NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  account_id      UUID REFERENCES "{{TENANT_SCHEMA}}".chart_of_account (id) ON DELETE SET NULL,
  accounting_event_id UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_shu_alloc_component CHECK (component IN
    ('RESERVE', 'CAPITAL_SERVICE', 'PATRONAGE_SERVICE', 'EDUCATION_FUND',
     'SOCIAL_FUND', 'BOARD_INCENTIVE', 'DEVELOPMENT_FUND')),
  CONSTRAINT ck_coop_shu_alloc_amount_nonnegative CHECK (amount >= 0),
  CONSTRAINT uq_coop_shu_alloc UNIQUE (calculation_id, component)
);

-- Patronage anggota, dicuplik ------------------------------------------------
--
-- Nilai transaksi anggota dengan koperasi selama periode. DIBACA BERKALA dari
-- POS dan dari transaksi koperasi lain, bukan ditulis saat transaksi terjadi:
-- patronage dihitung atas periode buku yang sudah ditutup, dan menuliskannya
-- saat transaksi berarti angkanya ikut berubah setiap ada retur — sesudah SHU
-- dihitung.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_patronage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_shu_calculation (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,

  -- Rincian sumber patronage, supaya anggota dapat menelusuri angkanya.
  unit_business_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  loan_interest_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  service_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
  patronage_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Dasar jasa modal: rata-rata simpanan EKUITAS. Simpanan sukarela tidak ikut
  -- — ia kewajiban koperasi kepada anggota, bukan modal anggota pada koperasi,
  -- dan memperoleh bagi hasil tersendiri, bukan SHU.
  average_equity_saving NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Bagian periode yang dijalani sebagai anggota, 0..1.
  membership_fraction   NUMERIC(9,6) NOT NULL DEFAULT 1,
  receives_shu          BOOLEAN NOT NULL DEFAULT TRUE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_patronage_fraction
    CHECK (membership_fraction >= 0 AND membership_fraction <= 1),
  CONSTRAINT ck_coop_patronage_nonnegative
    CHECK (patronage_amount >= 0 AND average_equity_saving >= 0),
  -- Jumlah rincian wajib sama dengan totalnya, supaya angka yang ditelusuri
  -- anggota benar-benar menjelaskan angka yang diterimanya.
  CONSTRAINT ck_coop_patronage_detail_sums
    CHECK (patronage_amount = unit_business_amount + loan_interest_amount + service_amount),
  CONSTRAINT uq_coop_patronage_member UNIQUE (calculation_id, member_id)
);

CREATE INDEX IF NOT EXISTS ix_coop_patronage_calc
  ON "{{TENANT_SCHEMA}}".cooperative_member_patronage (calculation_id);

-- Bagian SHU per anggota -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_shu_distribution (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_shu_calculation (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,

  capital_service NUMERIC(18,2) NOT NULL DEFAULT 0,
  patronage_service NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Pemotongan sebelum dibayarkan: tunggakan angsuran, simpanan wajib yang
  -- belum disetor. Dinyatakan tersendiri supaya anggota melihat nilai penuh
  -- haknya sekaligus alasan pemotongannya.
  deduction_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  deduction_note   TEXT,
  net_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,

  payment_status  VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  paid_at         TIMESTAMPTZ,
  payment_method_id UUID REFERENCES "{{TENANT_SCHEMA}}".payment_method (id) ON DELETE SET NULL,
  -- Dialihkan menjadi simpanan, bukan dibayar tunai — pilihan yang lazim dan
  -- menguatkan modal koperasi.
  credited_to_saving_account_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_saving_account (id) ON DELETE SET NULL,

  accounting_event_id UUID,
  idempotency_key VARCHAR(120),

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_shu_dist_payment_status CHECK (payment_status IN
    ('PENDING', 'PAID', 'CREDITED_TO_SAVING', 'DEDUCTED_FULL', 'CANCELLED')),
  CONSTRAINT ck_coop_shu_dist_total
    CHECK (total_amount = capital_service + patronage_service),
  CONSTRAINT ck_coop_shu_dist_net
    CHECK (net_amount = total_amount - deduction_amount),
  CONSTRAINT ck_coop_shu_dist_nonnegative
    CHECK (capital_service >= 0 AND patronage_service >= 0 AND deduction_amount >= 0
           AND net_amount >= 0),
  -- Pemotongan tidak boleh melebihi haknya; SHU tidak dapat menjadi utang.
  CONSTRAINT ck_coop_shu_dist_deduction_bounded
    CHECK (deduction_amount <= total_amount),
  CONSTRAINT ck_coop_shu_dist_deduction_needs_note
    CHECK (deduction_amount = 0 OR deduction_note IS NOT NULL),
  CONSTRAINT uq_coop_shu_dist_member UNIQUE (calculation_id, member_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_shu_dist_idempotency
  ON "{{TENANT_SCHEMA}}".cooperative_shu_distribution (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_coop_shu_dist_member
  ON "{{TENANT_SCHEMA}}".cooperative_shu_distribution (member_id, payment_status);

-- Rincian SHU untuk anggota --------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_shu_statement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_shu_distribution (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  fiscal_year     INTEGER NOT NULL,
  -- Cuplikan angka yang menjelaskan perhitungannya kepada anggota: berapa
  -- simpanannya, berapa transaksinya, berapa bagian seluruh anggota. Tanpa
  -- ini, anggota hanya melihat satu angka tanpa cara memeriksanya.
  explanation     JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_id         UUID,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by    UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_coop_shu_statement UNIQUE (distribution_id)
);

CREATE INDEX IF NOT EXISTS ix_coop_shu_statement_member
  ON "{{TENANT_SCHEMA}}".cooperative_shu_statement (member_id, fiscal_year);
