-- =========================================================================
-- H026 — SETTLEMENT JASA, KOREKSI, DAN PERNYATAAN
-- =========================================================================
--
-- Fase H-9F. Aditif seluruhnya.
--
-- Empat hal ditegakkan basis data di sini, dan ketiganya yang pertama menyangkut
-- uang yang sudah berpindah tangan.
--
-- 1. **SETTLEMENT YANG SUDAH DIKUNCI TIDAK DAPAT DIHAPUS.** Kekeliruan
--    diperbaiki lewat penyesuaian atau pembalikan, yang keduanya meninggalkan
--    barisnya sendiri. Yang dipegang dokter adalah kertas yang sudah dicetak;
--    menghapus catatannya membuat kertas itu tidak lagi cocok dengan apa pun.
--
-- 2. **Simulasi tidak pernah menjadi utang.** Tandanya melekat sejak baris itu
--    dibuat dan tidak dapat diubah — simulasi yang dapat berubah menjadi
--    settlement sungguhan hanya dengan satu UPDATE akan berubah ketika seseorang
--    menjalankan UPDATE yang keliru.
--
-- 3. **Nilai bersih dihitung, bukan diketik.** Constraint menuntut bersih sama
--    dengan kotor dikurangi pajak. Nilai bersih yang diketik terpisah akan
--    berselisih dengan hitungannya, dan yang menerima kertasnya akan menagih
--    selisihnya.
--
-- 4. **Pernyataan tidak diterbitkan dua kali dengan angka berbeda.** Bila
--    angkanya berubah, terbitkan pernyataan koreksi yang menunjuk pernyataan
--    lamanya.

-- ---------------------------------------------------------------------------
-- Settlement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_settlement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_number VARCHAR(64) NOT NULL,
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  policy_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".fee_policy (id) ON DELETE RESTRICT,

  -- Versi kebijakan yang dipakai, DISALIN. Pertanyaan "mengapa jasa saya bulan
  -- lalu segini" dijawab dengan aturan bulan lalu, bukan aturan hari ini.
  policy_version  INTEGER NOT NULL,
  basis           VARCHAR(24) NOT NULL,

  period_year     SMALLINT NOT NULL,
  period_month    SMALLINT,
  basis_amount    NUMERIC(18,2) NOT NULL,

  /*
   * Tanda simulasi. Sengaja tanpa nilai bawaan yang dapat diubah kemudian:
   * trigger di bawah menolak setiap perubahan atasnya.
   */
  is_simulation   BOOLEAN NOT NULL DEFAULT FALSE,

  status          VARCHAR(16) NOT NULL DEFAULT 'CALCULATED',
  calculated_by   UUID,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  locked_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  paid_reference  VARCHAR(120),
  stated_at       TIMESTAMPTZ,
  note            TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT fee_settlement_status_valid CHECK (
    status IN ('CALCULATED', 'SIMULATED', 'APPROVED', 'LOCKED', 'PAID', 'STATED')
  ),
  CONSTRAINT fee_settlement_basis_valid CHECK (
    basis IN ('GROSS_CHARGE', 'NET_CHARGE', 'NET_COLLECTED', 'VERIFIED_CLAIM',
              'PAID_CLAIM', 'FIXED_AMOUNT')
  ),
  CONSTRAINT fee_settlement_amount_non_negative CHECK (basis_amount >= 0),
  CONSTRAINT fee_settlement_month_valid CHECK (
    period_month IS NULL OR (period_month >= 1 AND period_month <= 12)
  ),
  -- Yang menghitung tidak menyetujuinya sendiri.
  CONSTRAINT fee_settlement_approval_not_self CHECK (
    approved_by IS NULL OR calculated_by IS NULL OR approved_by <> calculated_by
  ),
  CONSTRAINT fee_settlement_approved_complete CHECK (
    status NOT IN ('APPROVED', 'LOCKED', 'PAID', 'STATED')
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT fee_settlement_locked_complete CHECK (
    status NOT IN ('LOCKED', 'PAID', 'STATED') OR locked_at IS NOT NULL
  ),
  CONSTRAINT fee_settlement_paid_complete CHECK (
    status NOT IN ('PAID', 'STATED') OR (paid_at IS NOT NULL AND paid_reference IS NOT NULL)
  ),
  /*
   * SIMULASI TIDAK PERNAH DIBAYARKAN.
   *
   * Ditegakkan constraint, bukan hanya layanan: ada beberapa jalan menuju
   * tabel ini, dan aturan yang hanya ada di satu jalan berhenti berlaku pada
   * jalan berikutnya.
   */
  CONSTRAINT fee_settlement_simulation_never_paid CHECK (
    is_simulation = FALSE OR status NOT IN ('PAID', 'STATED')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fee_settlement_number
  ON "{{TENANT_SCHEMA}}".fee_settlement (settlement_number);
CREATE INDEX IF NOT EXISTS ix_fee_settlement_period
  ON "{{TENANT_SCHEMA}}".fee_settlement (facility_id, period_year, period_month, status);

-- SETTLEMENT YANG SUDAH DIKUNCI TIDAK DAPAT DIHAPUS.
DROP TRIGGER IF EXISTS trg_fee_settlement_no_delete ON "{{TENANT_SCHEMA}}".fee_settlement;
CREATE TRIGGER trg_fee_settlement_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".fee_settlement
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

/*
 * TANDA SIMULASI DAN NILAI DASARNYA TIDAK DAPAT DIUBAH.
 *
 * Simulasi yang berubah menjadi settlement sungguhan lewat satu UPDATE adalah
 * pintu paling sunyi untuk membuat utang yang tidak pernah dihitung siapa pun.
 * Nilai dasarnya pun terkunci setelah settlement disetujui: mengubah dasarnya
 * setelah barisnya dibagi akan membuat jumlah baris tidak lagi cocok dengan
 * dasarnya, dan tidak ada yang memeriksanya kembali.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_settlement_identity_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_simulation IS DISTINCT FROM OLD.is_simulation THEN
    RAISE EXCEPTION
      'SETTLEMENT_SIMULATION_IMMUTABLE: tanda simulasi tidak dapat diubah. Simulasi yang '
      'berubah menjadi settlement sungguhan lewat satu UPDATE adalah pintu paling sunyi untuk '
      'membuat utang yang tidak pernah dihitung siapa pun — hitung ulang sebagai settlement.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status IN ('APPROVED', 'LOCKED', 'PAID', 'STATED')
     AND (NEW.basis_amount IS DISTINCT FROM OLD.basis_amount
          OR NEW.policy_id IS DISTINCT FROM OLD.policy_id
          OR NEW.policy_version IS DISTINCT FROM OLD.policy_version) THEN
    RAISE EXCEPTION
      'SETTLEMENT_LOCKED: dasar dan kebijakan settlement yang sudah disetujui tidak dapat '
      'diubah. Barisnya sudah dibagi menurut angka itu — pakai penyesuaian atau pembalikan.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fee_settlement_identity ON "{{TENANT_SCHEMA}}".fee_settlement;
CREATE TRIGGER trg_fee_settlement_identity
  BEFORE UPDATE ON "{{TENANT_SCHEMA}}".fee_settlement
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_settlement_identity_change();

-- ---------------------------------------------------------------------------
-- Baris settlement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_settlement_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".fee_settlement (id) ON DELETE RESTRICT,
  recipient       VARCHAR(32) NOT NULL,
  provider_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,

  gross_amount    NUMERIC(18,2) NOT NULL,
  tax_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(18,2) NOT NULL,
  tax_rate_percent NUMERIC(6,3),

  method          VARCHAR(24) NOT NULL,
  basis_value     NUMERIC(12,4),
  note            TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fee_settlement_line_non_negative CHECK (
    gross_amount >= 0 AND tax_amount >= 0 AND net_amount >= 0
  ),
  CONSTRAINT fee_settlement_line_tax_within CHECK (tax_amount <= gross_amount),
  -- NILAI BERSIH DIHITUNG, BUKAN DIKETIK.
  CONSTRAINT fee_settlement_line_net_derived CHECK (net_amount = gross_amount - tax_amount)
);

CREATE INDEX IF NOT EXISTS ix_fee_settlement_line_settlement
  ON "{{TENANT_SCHEMA}}".fee_settlement_line (settlement_id);
CREATE INDEX IF NOT EXISTS ix_fee_settlement_line_provider
  ON "{{TENANT_SCHEMA}}".fee_settlement_line (provider_id) WHERE provider_id IS NOT NULL;

-- Baris settlement yang sudah dikunci tidak dapat diubah maupun dihapus.
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_locked_settlement_line()
RETURNS TRIGGER AS $$
DECLARE
  st TEXT;
BEGIN
  SELECT status INTO st
    FROM "{{TENANT_SCHEMA}}".fee_settlement
   WHERE id = COALESCE(OLD.settlement_id, NEW.settlement_id);

  IF st IN ('LOCKED', 'PAID', 'STATED') THEN
    RAISE EXCEPTION
      'SETTLEMENT_LOCKED: baris settlement yang sudah dikunci tidak dapat diubah maupun '
      'dihapus. Kekeliruan diperbaiki lewat penyesuaian atau pembalikan, yang keduanya '
      'meninggalkan barisnya sendiri.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fee_settlement_line_locked ON "{{TENANT_SCHEMA}}".fee_settlement_line;
CREATE TRIGGER trg_fee_settlement_line_locked
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".fee_settlement_line
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_locked_settlement_line();

-- ---------------------------------------------------------------------------
-- Koreksi: penyesuaian dan pembalikan
-- ---------------------------------------------------------------------------
-- Keduanya meninggalkan barisnya sendiri. Tidak ada penghapusan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_settlement_correction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".fee_settlement (id) ON DELETE RESTRICT,
  correction_type VARCHAR(16) NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  reason          TEXT NOT NULL,

  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT fee_correction_type_valid CHECK (correction_type IN ('ADJUSTMENT', 'REVERSAL')),
  CONSTRAINT fee_correction_amount_positive CHECK (amount > 0),
  CONSTRAINT fee_correction_reason_meaningful CHECK (length(trim(reason)) >= 10),
  -- Yang membuat koreksi tidak menyetujuinya sendiri. Koreksi adalah tempat
  -- paling mudah untuk memindahkan uang tanpa ada yang melihat, sebab ia
  -- terlihat seperti pembetulan.
  CONSTRAINT fee_correction_approval_not_self CHECK (
    approved_by IS NULL OR created_by IS NULL OR approved_by <> created_by
  )
);

CREATE INDEX IF NOT EXISTS ix_fee_correction_settlement
  ON "{{TENANT_SCHEMA}}".fee_settlement_correction (settlement_id);

DROP TRIGGER IF EXISTS trg_fee_correction_no_delete ON "{{TENANT_SCHEMA}}".fee_settlement_correction;
CREATE TRIGGER trg_fee_correction_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".fee_settlement_correction
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

/*
 * KOREKSI TIDAK MELEBIHI YANG TERSISA.
 *
 * Jumlah seluruh koreksi atas satu settlement tidak boleh melebihi nilai
 * dasarnya. Melebihinya berarti rumah sakit menagih kembali kepada dokter, dan
 * itu keputusan tersendiri — bukan akibat sampingan dari koreksi kelima yang
 * dibuat orang yang tidak melihat keempat koreksi sebelumnya.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".check_correction_total()
RETURNS TRIGGER AS $$
DECLARE
  dasar NUMERIC;
  total NUMERIC;
BEGIN
  SELECT basis_amount INTO dasar
    FROM "{{TENANT_SCHEMA}}".fee_settlement WHERE id = NEW.settlement_id;

  SELECT COALESCE(sum(amount), 0) INTO total
    FROM "{{TENANT_SCHEMA}}".fee_settlement_correction
   WHERE settlement_id = NEW.settlement_id;

  IF total > dasar THEN
    RAISE EXCEPTION
      'CORRECTION_EXCEEDS_SETTLEMENT: jumlah koreksi % melebihi nilai settlement %. Melebihinya '
      'berarti rumah sakit menagih kembali kepada dokter, dan itu keputusan tersendiri.',
      total, dasar
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fee_correction_total ON "{{TENANT_SCHEMA}}".fee_settlement_correction;
CREATE CONSTRAINT TRIGGER trg_fee_correction_total
  AFTER INSERT OR UPDATE ON "{{TENANT_SCHEMA}}".fee_settlement_correction
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".check_correction_total();

-- ---------------------------------------------------------------------------
-- Pernyataan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_statement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_number VARCHAR(64) NOT NULL,
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  provider_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,

  period_year     SMALLINT NOT NULL,
  period_month    SMALLINT,

  -- Keempatnya dinyatakan. Pernyataan yang hanya menyebut nilai bersih akan
  -- ditanyakan setiap bulan; yang hanya menyebut kotor membuat penerimanya
  -- mengira ia dibayar kurang.
  gross_amount    NUMERIC(18,2) NOT NULL,
  tax_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(18,2) NOT NULL,
  settlement_count INTEGER NOT NULL DEFAULT 0,

  -- Pernyataan koreksi menunjuk pernyataan yang dikoreksinya. Yang dipegang
  -- penerimanya harus dua kertas, bukan satu kertas yang diam-diam berganti isi.
  is_correction   BOOLEAN NOT NULL DEFAULT FALSE,
  corrects_statement_id UUID REFERENCES "{{TENANT_SCHEMA}}".fee_statement (id) ON DELETE RESTRICT,

  issued_by       UUID,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT fee_statement_non_negative CHECK (
    gross_amount >= 0 AND tax_amount >= 0 AND net_amount >= 0 AND adjustment_amount >= 0
  ),
  CONSTRAINT fee_statement_month_valid CHECK (
    period_month IS NULL OR (period_month >= 1 AND period_month <= 12)
  ),
  CONSTRAINT fee_statement_correction_points CHECK (
    is_correction = FALSE OR corrects_statement_id IS NOT NULL
  ),
  CONSTRAINT fee_statement_not_self_correcting CHECK (
    corrects_statement_id IS NULL OR corrects_statement_id <> id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fee_statement_number
  ON "{{TENANT_SCHEMA}}".fee_statement (statement_number);

-- SATU PERNYATAAN ASLI PER PENERIMA PER PERIODE. Koreksinya boleh berkali-kali,
-- dan tiap koreksi menunjuk yang dikoreksinya.
CREATE UNIQUE INDEX IF NOT EXISTS ux_fee_statement_original
  ON "{{TENANT_SCHEMA}}".fee_statement
     (provider_id, period_year, COALESCE(period_month, 0))
  WHERE is_correction = FALSE;

DROP TRIGGER IF EXISTS trg_fee_statement_no_delete ON "{{TENANT_SCHEMA}}".fee_statement;
CREATE TRIGGER trg_fee_statement_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".fee_statement
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_settlement', 'fee_settlement_line',
                           'fee_settlement_correction', 'fee_statement'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
