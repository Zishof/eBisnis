-- =========================================================================
-- H020 — PEMETAAN AKUNTANSI KESEHATAN
-- =========================================================================
--
-- Fase H-9N. Aditif seluruhnya.
--
-- **ATURAN PERTAMA: JANGAN MEMBUAT BUKU BESAR KEDUA.**
--
-- Tidak ada tabel jurnal di sini. Tidak ada tabel saldo. Tidak ada tabel
-- neraca. Rumah sakit memakai mesin akuntansi bersama milik Core —
-- `accounting_event`, `accounting_posting_rule`, `journal_entry`,
-- `chart_of_account` — dan membangun buku besar kesehatan tersendiri akan
-- menghasilkan dua neraca yang tidak pernah cocok. Yang lebih buruk:
-- dua-duanya akan tampak benar.
--
-- Yang dibangun di sini hanya **pemetaannya**: peristiwa klinis apa menjadi
-- jurnal apa, dan peran akun apa menunjuk akun yang mana. Jurnalnya milik Core.
--
-- Dua hal lain yang ditegakkan basis data.
--
-- 1. **Satu peran, satu akun, per fasilitas.** Peran yang menunjuk dua akun
--    membuat pendapatan unit yang sama masuk ke dua tempat, dan selisihnya baru
--    ketahuan ketika neracanya tidak seimbang.
--
-- 2. **Debit dan kredit tidak boleh peran yang sama.** Jurnal yang mendebit dan
--    mengkredit akun yang sama tidak mengubah apa pun, tetapi tampak seperti
--    pekerjaan yang sudah selesai.

-- ---------------------------------------------------------------------------
-- Profil akuntansi per fasilitas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_accounting_profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,
  name            VARCHAR(180) NOT NULL,

  /*
   * Peristiwa yang MEMANG dipakai fasilitas ini.
   *
   * Menuntut penautan akun bagi peristiwa yang tidak akan pernah terjadi — fee
   * sistem yang bawaannya NONE, misalnya — akan membuat seluruh daftar
   * kekurangan diabaikan.
   */
  enabled_events  VARCHAR(64)[] NOT NULL DEFAULT '{}',

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_accounting_profile
  ON "{{TENANT_SCHEMA}}".health_accounting_profile (facility_id) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Penautan peran akun ke akun sungguhan
-- ---------------------------------------------------------------------------
-- Peran, bukan nomor akun. Rumah sakit yang memakai bagan akun berbeda
-- menautkan perannya ke nomor akunnya sendiri; kodenya tidak berubah.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_account_link (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_accounting_profile (id) ON DELETE CASCADE,
  role            VARCHAR(48) NOT NULL,
  -- Akun milik Core. Kami menunjuknya; kami tidak membuat tabel akun sendiri.
  account_id      UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".chart_of_account (id) ON DELETE RESTRICT,
  note            TEXT,
  linked_by       UUID,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT health_account_role_valid CHECK (
    role IN (
      'AR_PATIENT', 'AR_BPJS', 'AR_INSURER',
      'INVENTORY_DRUG', 'INVENTORY_CONSUMABLE', 'INVENTORY_REAGENT', 'INVENTORY_IMPLANT',
      'MEDICAL_EQUIPMENT', 'ACCUMULATED_DEPRECIATION', 'CASH',
      'PATIENT_DEPOSIT', 'AP_DOCTOR_FEE', 'AP_NURSE_FEE', 'AP_SYSTEM_FEE',
      'AP_INVESTOR_DISTRIBUTION', 'RETAINED_EARNINGS',
      'REVENUE_OUTPATIENT', 'REVENUE_INPATIENT', 'REVENUE_EMERGENCY', 'REVENUE_SURGERY',
      'REVENUE_DELIVERY', 'REVENUE_LAB', 'REVENUE_RADIOLOGY', 'REVENUE_PHARMACY',
      'REVENUE_EQUIPMENT', 'REVENUE_BED',
      'COGS_DRUG', 'COGS_CONSUMABLE', 'COGS_REAGENT', 'COGS_IMPLANT',
      'EXPENSE_DOCTOR_FEE', 'EXPENSE_HEALTH_WORKER_FEE', 'EXPENSE_EQUIPMENT_MAINTENANCE',
      'EXPENSE_EQUIPMENT_DEPRECIATION', 'EXPENSE_PLATFORM', 'EXPENSE_CLAIM_ADJUSTMENT'
    )
  )
);

-- SATU PERAN, SATU AKUN, PER PROFIL. Peran yang menunjuk dua akun membuat
-- pendapatan unit yang sama masuk ke dua tempat.
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_account_link
  ON "{{TENANT_SCHEMA}}".health_account_link (profile_id, role);

/*
 * SALDO NORMAL AKUN HARUS COCOK DENGAN GOLONGAN PERANNYA.
 *
 * Menautkan REVENUE_LAB ke akun bersaldo normal debit akan menghasilkan
 * pendapatan bernilai negatif pada setiap laporan — dan yang membacanya akan
 * menyimpulkan laboratoriumnya merugi. Ditegakkan trigger karena ia menuntut
 * pembacaan tabel lain; CHECK constraint tidak dapat melakukannya.
 *
 * Akun induk pun ditolak: jurnal pada akun induk membuat rincian per unit
 * hilang seluruhnya.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".check_health_account_link()
RETURNS TRIGGER AS $$
DECLARE
  akun      RECORD;
  seharusnya TEXT;
BEGIN
  SELECT normal_balance, allow_posting, is_active, deleted_at, code
    INTO akun
    FROM "{{TENANT_SCHEMA}}".chart_of_account
   WHERE id = NEW.account_id;

  IF NOT FOUND OR akun.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'HEALTH_ACCOUNT_LINK_INVALID: akun tidak ditemukan.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF akun.is_active = FALSE THEN
    RAISE EXCEPTION 'HEALTH_ACCOUNT_LINK_INVALID: akun % tidak aktif.', akun.code
      USING ERRCODE = 'check_violation';
  END IF;

  IF akun.allow_posting = FALSE THEN
    RAISE EXCEPTION
      'HEALTH_ACCOUNT_LINK_INVALID: akun % adalah akun induk dan tidak menerima posting. '
      'Tautkan ke akun anaknya — jurnal pada akun induk membuat rincian per unit hilang.',
      akun.code
      USING ERRCODE = 'check_violation';
  END IF;

  seharusnya := CASE
    WHEN NEW.role IN ('ACCUMULATED_DEPRECIATION', 'PATIENT_DEPOSIT', 'AP_DOCTOR_FEE',
                      'AP_NURSE_FEE', 'AP_SYSTEM_FEE', 'AP_INVESTOR_DISTRIBUTION',
                      'RETAINED_EARNINGS')
      THEN 'CREDIT'
    WHEN NEW.role LIKE 'REVENUE\_%' THEN 'CREDIT'
    ELSE 'DEBIT'
  END;

  IF akun.normal_balance <> seharusnya THEN
    RAISE EXCEPTION
      'HEALTH_ACCOUNT_LINK_INVALID: peran % menuntut akun bersaldo normal %, sedangkan akun % '
      'bersaldo normal %. Menautkannya akan membuat nilainya berlawanan tanda pada setiap '
      'laporan.', NEW.role, seharusnya, akun.code, akun.normal_balance
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_health_account_link_sane ON "{{TENANT_SCHEMA}}".health_account_link;
CREATE TRIGGER trg_health_account_link_sane
  BEFORE INSERT OR UPDATE ON "{{TENANT_SCHEMA}}".health_account_link
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".check_health_account_link();

-- ---------------------------------------------------------------------------
-- Aturan pemetaan peristiwa
-- ---------------------------------------------------------------------------
-- Pemetaan tinggal di DATA, bukan di kode. Debit dan kredit tidak pernah
-- ditulis di dalam controller — pola yang sama seperti accounting_posting_rule
-- milik Core sejak V015.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_accounting_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_accounting_profile (id) ON DELETE CASCADE,
  event_code      VARCHAR(64) NOT NULL,

  -- Peran akun, atau BY_SERVICE bila akunnya datang dari pemetaan layanan.
  debit_role      VARCHAR(48) NOT NULL,
  credit_role     VARCHAR(48) NOT NULL,

  -- Nama medan pada `amounts`. BUKAN rumus: rumus bebas pada data adalah pintu
  -- masuk eksekusi kode yang tidak diinginkan, dan larangan eval berlaku pula
  -- di sini.
  amount_key      VARCHAR(48) NOT NULL,

  -- Aturan berlaku pada rentang waktu tertentu supaya perubahan kebijakan
  -- akuntansi tidak mengubah jurnal yang sudah terbentuk.
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT health_rule_event_valid CHECK (
    event_code IN (
      'HEALTH_SERVICE_RENDERED_CASH', 'HEALTH_SERVICE_RENDERED_BPJS',
      'HEALTH_DRUG_DISPENSED', 'HEALTH_REAGENT_CONSUMED', 'HEALTH_IMPLANT_USED',
      'HEALTH_CLAIM_UNDERPAID', 'HEALTH_CLAIM_PAID',
      'HEALTH_FEE_ACCRUED', 'HEALTH_FEE_PAID', 'HEALTH_SYSTEM_FEE_ACCRUED',
      'HEALTH_INVESTOR_DISTRIBUTION_APPROVED',
      'HEALTH_DEPOSIT_RECEIVED', 'HEALTH_DEPOSIT_APPLIED'
    )
  ),
  -- Debit dan kredit tidak boleh peran yang sama.
  CONSTRAINT health_rule_sides_differ CHECK (debit_role <> credit_role),
  CONSTRAINT health_rule_amount_key_plain CHECK (amount_key ~ '^[a-zA-Z][a-zA-Z0-9]*$'),
  CONSTRAINT health_rule_period_sane CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_accounting_rule_active
  ON "{{TENANT_SCHEMA}}".health_accounting_rule (profile_id, event_code)
  WHERE effective_to IS NULL;

-- ---------------------------------------------------------------------------
-- Templat bagan akun kesehatan
-- ---------------------------------------------------------------------------
-- Templat, bukan bagan akun kedua. Ia daftar akun yang dibutuhkan rumah sakit
-- beserta perannya; yang menyemainya membuat baris pada chart_of_account milik
-- Core, lalu menautkannya lewat health_account_link.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_coa_template (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role            VARCHAR(48) NOT NULL,
  suggested_code  VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  account_group   VARCHAR(16) NOT NULL,
  normal_balance  VARCHAR(8) NOT NULL,
  note            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT health_coa_group_valid CHECK (
    account_group IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
  ),
  CONSTRAINT health_coa_balance_valid CHECK (normal_balance IN ('DEBIT', 'CREDIT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_coa_template_role
  ON "{{TENANT_SCHEMA}}".health_coa_template (role);

INSERT INTO "{{TENANT_SCHEMA}}".health_coa_template
  (role, suggested_code, name, account_group, normal_balance, note, sort_order)
SELECT v.role, v.code, v.name, v.grp, v.bal, v.note, v.ord
  FROM (VALUES
    ('AR_PATIENT', '1131', 'Piutang Pasien', 'ASSET', 'DEBIT', NULL, 10),
    ('AR_BPJS', '1132', 'Piutang BPJS', 'ASSET', 'DEBIT',
     'Dipisahkan dari piutang pasien: umurnya berbeda, penagihnya berbeda, dan penyesuaiannya berbeda.', 11),
    ('AR_INSURER', '1133', 'Piutang Asuransi', 'ASSET', 'DEBIT', NULL, 12),
    ('INVENTORY_DRUG', '1141', 'Persediaan Obat', 'ASSET', 'DEBIT', NULL, 20),
    ('INVENTORY_CONSUMABLE', '1142', 'Persediaan BMHP', 'ASSET', 'DEBIT', NULL, 21),
    ('INVENTORY_REAGENT', '1143', 'Persediaan Reagen', 'ASSET', 'DEBIT', NULL, 22),
    ('INVENTORY_IMPLANT', '1144', 'Persediaan Implan', 'ASSET', 'DEBIT', NULL, 23),
    ('MEDICAL_EQUIPMENT', '1211', 'Peralatan Medis', 'ASSET', 'DEBIT', NULL, 30),
    ('ACCUMULATED_DEPRECIATION', '1219', 'Akumulasi Penyusutan Peralatan Medis', 'ASSET', 'CREDIT',
     'Akun lawan: bergolongan aset tetapi bersaldo normal kredit.', 31),
    ('CASH', '1111', 'Kas dan Setara Kas', 'ASSET', 'DEBIT', NULL, 1),
    ('PATIENT_DEPOSIT', '2131', 'Deposit Pasien', 'LIABILITY', 'CREDIT',
     'Uang yang belum menjadi hak rumah sakit. Bukan pendapatan.', 40),
    ('AP_DOCTOR_FEE', '2141', 'Utang Jasa Dokter', 'LIABILITY', 'CREDIT', NULL, 41),
    ('AP_NURSE_FEE', '2142', 'Utang Jasa Perawat dan Bidan', 'LIABILITY', 'CREDIT', NULL, 42),
    ('AP_SYSTEM_FEE', '2151', 'Utang Fee Sistem', 'LIABILITY', 'CREDIT',
     'Hanya bila kontraknya ada. Bawaan fee sistem adalah NONE.', 43),
    ('AP_INVESTOR_DISTRIBUTION', '2152', 'Utang Distribusi Investor', 'LIABILITY', 'CREDIT',
     'Hanya bila kontraknya ada. Bawaan distribusi investor adalah NONE.', 44),
    ('RETAINED_EARNINGS', '3200', 'Laba Ditahan', 'EQUITY', 'CREDIT', NULL, 50),
    ('REVENUE_OUTPATIENT', '4110', 'Pendapatan Rawat Jalan', 'REVENUE', 'CREDIT', NULL, 60),
    ('REVENUE_INPATIENT', '4120', 'Pendapatan Rawat Inap', 'REVENUE', 'CREDIT', NULL, 61),
    ('REVENUE_EMERGENCY', '4130', 'Pendapatan Gawat Darurat', 'REVENUE', 'CREDIT', NULL, 62),
    ('REVENUE_SURGERY', '4140', 'Pendapatan Kamar Operasi', 'REVENUE', 'CREDIT', NULL, 63),
    ('REVENUE_DELIVERY', '4150', 'Pendapatan Kamar Bersalin', 'REVENUE', 'CREDIT', NULL, 64),
    ('REVENUE_LAB', '4160', 'Pendapatan Laboratorium', 'REVENUE', 'CREDIT', NULL, 65),
    ('REVENUE_RADIOLOGY', '4170', 'Pendapatan Radiologi', 'REVENUE', 'CREDIT', NULL, 66),
    ('REVENUE_PHARMACY', '4180', 'Pendapatan Farmasi', 'REVENUE', 'CREDIT', NULL, 67),
    ('REVENUE_EQUIPMENT', '4190', 'Pendapatan Pemakaian Alat', 'REVENUE', 'CREDIT', NULL, 68),
    ('REVENUE_BED', '4195', 'Pendapatan Akomodasi', 'REVENUE', 'CREDIT', NULL, 69),
    ('COGS_DRUG', '5110', 'Harga Pokok Obat', 'EXPENSE', 'DEBIT', NULL, 70),
    ('COGS_CONSUMABLE', '5120', 'Harga Pokok BMHP', 'EXPENSE', 'DEBIT', NULL, 71),
    ('COGS_REAGENT', '5130', 'Harga Pokok Reagen', 'EXPENSE', 'DEBIT',
     'Pemeriksaan laboratorium punya dua sisi: pendapatannya dan harga pokok reagennya. Yang hanya memetakan pendapatannya akan menampilkan margin seratus persen.', 72),
    ('COGS_IMPLANT', '5140', 'Harga Pokok Implan', 'EXPENSE', 'DEBIT', NULL, 73),
    ('EXPENSE_DOCTOR_FEE', '5210', 'Beban Jasa Dokter', 'EXPENSE', 'DEBIT', NULL, 80),
    ('EXPENSE_HEALTH_WORKER_FEE', '5220', 'Beban Jasa Tenaga Kesehatan', 'EXPENSE', 'DEBIT', NULL, 81),
    ('EXPENSE_EQUIPMENT_MAINTENANCE', '5310', 'Beban Pemeliharaan Alat', 'EXPENSE', 'DEBIT', NULL, 82),
    ('EXPENSE_EQUIPMENT_DEPRECIATION', '5320', 'Beban Penyusutan Alat Medis', 'EXPENSE', 'DEBIT', NULL, 83),
    ('EXPENSE_PLATFORM', '5410', 'Beban Platform eMedik', 'EXPENSE', 'DEBIT', NULL, 84),
    ('EXPENSE_CLAIM_ADJUSTMENT', '5420', 'Beban Penyesuaian Klaim', 'EXPENSE', 'DEBIT',
     'Selisih antara yang diajukan dan yang disetujui BUKAN pendapatan yang hilang begitu saja. Ia beban yang harus terlihat, sebab ia ukuran mutu pengkodean dan kelengkapan berkas — dan yang tidak terlihat tidak pernah diperbaiki.', 85)
  ) AS v(role, code, name, grp, bal, note, ord)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".health_coa_template t WHERE t.role = v.role
 );

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_accounting_profile', 'health_account_link',
                           'health_accounting_rule', 'health_coa_template'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
