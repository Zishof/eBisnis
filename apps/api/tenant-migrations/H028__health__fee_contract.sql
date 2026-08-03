-- =========================================================================
-- H028 — KONTRAK FEE SISTEM DAN FEE INVESTOR
-- =========================================================================
--
-- Fase H-9G. Aditif seluruhnya.
--
-- **BAWAANNYA NONE.** Migrasi ini tidak menyemai satu pun kontrak. Tanpa
-- kontrak yang aktif, fee sistem dan bagian investor bernilai nol — bukan nilai
-- bawaan yang kecil, bukan taksiran, nol.
--
-- Empat hal ditegakkan basis data di sini.
--
-- 1. **TIGA ORANG BERBEDA.** Penyusun, pemeriksa hukum, dan penyetuju
--    manajemen. Dua orang cukup untuk sebagian besar keputusan; kontrak yang
--    mengambil bagian dari kumpulan jasa tenaga medis menuntut tiga, sebab yang
--    dirugikannya tidak duduk di ruangan itu — dan satu-satunya pengganti
--    kehadirannya adalah jumlah mata yang melihat.
--
-- 2. **Kontrak tidak berlaku surut melampaui telaah hukumnya.** Kontrak yang
--    berlaku sejak sebelum diperiksa berarti pemeriksaannya tidak pernah
--    menahan apa pun.
--
-- 3. **Aktif menuntut seluruh syaratnya**, bukan sebagian: nomor kontrak,
--    catatan telaah hukum, perlakuan pajak, batas maksimum, tanggal berlaku,
--    dan rantai tiga orang.
--
-- 4. **Kontrak tidak dapat dihapus.** Ia bukti bahwa uang pernah keluar dari
--    kumpulan jasa dengan izin siapa. Yang keliru diakhiri, bukan dihilangkan.

-- ---------------------------------------------------------------------------
-- Kontrak
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_contract (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  contract_type   VARCHAR(24) NOT NULL,
  contract_reference VARCHAR(120),
  counterparty_name VARCHAR(255) NOT NULL,

  -- Telaah hukum. Catatan, bukan kotak centang: kotak centang dapat dicentang
  -- siapa saja, dan yang membacanya kelak menuntut alasannya.
  legal_review_note TEXT,
  legal_reviewed_by UUID,
  legal_reviewed_at TIMESTAMPTZ,

  tax_treatment   TEXT,

  -- Batas maksimum. Ditegakkan pula saat MENGHITUNG; batas yang hanya tertulis
  -- akan dilampaui oleh perhitungan yang tidak pernah membacanya.
  maximum_percent NUMERIC(6,3),

  effective_from  DATE,
  effective_to    DATE,

  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',

  -- Rantai tiga orang.
  prepared_by     UUID,
  prepared_at     TIMESTAMPTZ,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  approval_note   TEXT,

  suspended_at    TIMESTAMPTZ,
  suspend_reason  TEXT,
  terminated_at   TIMESTAMPTZ,
  terminate_reason TEXT,

  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT fee_contract_type_valid CHECK (
    contract_type IN ('SYSTEM_PLATFORM_FEE', 'INVESTOR_SHARE')
  ),
  CONSTRAINT fee_contract_status_valid CHECK (
    status IN ('DRAFT', 'LEGAL_REVIEW', 'MANAGEMENT_APPROVAL', 'ACTIVE',
               'SUSPENDED', 'EXPIRED', 'TERMINATED')
  ),
  CONSTRAINT fee_contract_percent_sane CHECK (
    maximum_percent IS NULL OR (maximum_percent >= 0 AND maximum_percent <= 100)
  ),
  CONSTRAINT fee_contract_period_sane CHECK (
    effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from
  ),

  /*
   * TIGA ORANG BERBEDA.
   *
   * Ditegakkan berpasangan, sebab constraint tidak dapat menghitung himpunan.
   * Ketiganya diperiksa: penyusun <> pemeriksa, pemeriksa <> penyetuju,
   * penyusun <> penyetuju.
   */
  CONSTRAINT fee_contract_prepare_review_differ CHECK (
    prepared_by IS NULL OR legal_reviewed_by IS NULL OR prepared_by <> legal_reviewed_by
  ),
  CONSTRAINT fee_contract_review_approve_differ CHECK (
    legal_reviewed_by IS NULL OR approved_by IS NULL OR legal_reviewed_by <> approved_by
  ),
  CONSTRAINT fee_contract_prepare_approve_differ CHECK (
    prepared_by IS NULL OR approved_by IS NULL OR prepared_by <> approved_by
  ),

  -- Kontrak tidak berlaku surut melampaui telaah hukumnya.
  CONSTRAINT fee_contract_not_backdated CHECK (
    legal_reviewed_at IS NULL OR effective_from IS NULL
    OR effective_from >= legal_reviewed_at::date
  ),

  /*
   * AKTIF MENUNTUT SELURUH SYARATNYA.
   *
   * Bukan sebagian. Kontrak yang aktif dengan satu syarat kosong mengambil uang
   * yang sama besarnya dengan kontrak yang lengkap.
   */
  CONSTRAINT fee_contract_active_complete CHECK (
    status <> 'ACTIVE'
    OR (contract_reference IS NOT NULL AND length(trim(contract_reference)) >= 3
        AND legal_review_note IS NOT NULL AND length(trim(legal_review_note)) >= 10
        AND legal_reviewed_by IS NOT NULL AND legal_reviewed_at IS NOT NULL
        AND tax_treatment IS NOT NULL AND length(trim(tax_treatment)) >= 5
        AND maximum_percent IS NOT NULL
        AND effective_from IS NOT NULL
        AND prepared_by IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT fee_contract_suspend_reason CHECK (
    suspended_at IS NULL OR (suspend_reason IS NOT NULL AND length(trim(suspend_reason)) >= 5)
  ),
  CONSTRAINT fee_contract_terminate_reason CHECK (
    terminated_at IS NULL OR (terminate_reason IS NOT NULL AND length(trim(terminate_reason)) >= 5)
  ),
  -- Templat contoh tidak dapat aktif.
  CONSTRAINT fee_contract_sample_not_active CHECK (
    is_sample_data = FALSE OR status <> 'ACTIVE'
  )
);

CREATE INDEX IF NOT EXISTS ix_fee_contract_facility
  ON "{{TENANT_SCHEMA}}".fee_contract (facility_id, contract_type, status);

/*
 * SATU KONTRAK AKTIF PER JENIS PER FASILITAS.
 *
 * Dua kontrak aktif untuk jenis yang sama membuat fee terhitung dua kali, dan
 * yang menerimanya tidak akan mempersoalkannya.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_fee_contract_one_active
  ON "{{TENANT_SCHEMA}}".fee_contract (facility_id, contract_type)
  WHERE status = 'ACTIVE';

-- Kontrak tidak dapat dihapus. Ia bukti bahwa uang pernah keluar dari kumpulan
-- jasa dengan izin siapa.
DROP TRIGGER IF EXISTS trg_fee_contract_no_delete ON "{{TENANT_SCHEMA}}".fee_contract;
CREATE TRIGGER trg_fee_contract_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".fee_contract
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

/*
 * KONTRAK YANG SUDAH AKTIF TIDAK DAPAT DIUBAH SYARATNYA.
 *
 * Batas maksimum, tanggal berlaku, dan perlakuan pajak terkunci begitu kontrak
 * aktif. Menaikkan batas maksimum pada kontrak yang sedang berjalan adalah cara
 * paling sunyi untuk mengambil lebih banyak — perubahannya tidak menimbulkan
 * satu pun peristiwa yang terlihat, dan akibatnya baru muncul pada perhitungan
 * bulan berikutnya. Yang hendak mengubahnya membuat kontrak baru.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_active_contract_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'ACTIVE'
     AND (NEW.maximum_percent IS DISTINCT FROM OLD.maximum_percent
          OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
          OR NEW.effective_to IS DISTINCT FROM OLD.effective_to
          OR NEW.tax_treatment IS DISTINCT FROM OLD.tax_treatment
          OR NEW.contract_reference IS DISTINCT FROM OLD.contract_reference) THEN
    RAISE EXCEPTION
      'FEE_CONTRACT_ACTIVE: syarat kontrak yang sudah aktif tidak dapat diubah. Menaikkan '
      'batas maksimum pada kontrak yang sedang berjalan adalah cara paling sunyi untuk '
      'mengambil lebih banyak — buat kontrak baru.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fee_contract_immutable ON "{{TENANT_SCHEMA}}".fee_contract;
CREATE TRIGGER trg_fee_contract_immutable
  BEFORE UPDATE ON "{{TENANT_SCHEMA}}".fee_contract
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_active_contract_change();

-- ---------------------------------------------------------------------------
-- Pengecualian layanan
-- ---------------------------------------------------------------------------
-- Layanan yang menurut kontraknya tidak dikenai fee. Disimpan sebagai baris,
-- bukan sebagai daftar di dalam satu kolom: pengecualian yang tersimpan sebagai
-- teks tidak dapat ditanyakan "layanan apa saja yang dikecualikan bulan lalu".
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_contract_exclusion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".fee_contract (id) ON DELETE CASCADE,
  service_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_service (id) ON DELETE RESTRICT,
  service_type    VARCHAR(24),
  reason          TEXT NOT NULL,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fee_exclusion_target CHECK (service_id IS NOT NULL OR service_type IS NOT NULL),
  CONSTRAINT fee_exclusion_reason_meaningful CHECK (length(trim(reason)) >= 5)
);

CREATE INDEX IF NOT EXISTS ix_fee_exclusion_contract
  ON "{{TENANT_SCHEMA}}".fee_contract_exclusion (contract_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fee_exclusion_service
  ON "{{TENANT_SCHEMA}}".fee_contract_exclusion (contract_id, service_id)
  WHERE service_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Jejak penerapan fee
-- ---------------------------------------------------------------------------
-- Setiap kali fee kontrak dihitung, hasilnya dicatat beserta kontrak dan
-- persentase yang dipakai. Tanpa jejak ini, pertanyaan "mengapa fee bulan lalu
-- segini" hanya dapat dijawab dengan menghitung ulang memakai kontrak hari ini
-- — dan kontrak hari ini mungkin sudah berbeda.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fee_contract_application (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID REFERENCES "{{TENANT_SCHEMA}}".fee_contract (id) ON DELETE RESTRICT,
  settlement_id   UUID REFERENCES "{{TENANT_SCHEMA}}".fee_settlement (id) ON DELETE RESTRICT,
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  contract_type   VARCHAR(24) NOT NULL,

  base_amount     NUMERIC(18,2) NOT NULL,
  requested_percent NUMERIC(6,3) NOT NULL,
  applied_percent NUMERIC(6,3) NOT NULL,
  fee_amount      NUMERIC(18,2) NOT NULL,
  was_capped      BOOLEAN NOT NULL DEFAULT FALSE,
  reason          TEXT,

  applied_on      DATE NOT NULL DEFAULT CURRENT_DATE,
  applied_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fee_application_non_negative CHECK (
    base_amount >= 0 AND fee_amount >= 0 AND requested_percent >= 0 AND applied_percent >= 0
  ),
  -- Persentase yang dipakai tidak pernah melebihi yang diminta.
  CONSTRAINT fee_application_applied_within CHECK (applied_percent <= requested_percent),
  CONSTRAINT fee_application_capped_consistent CHECK (
    was_capped = (applied_percent < requested_percent)
  )
);

CREATE INDEX IF NOT EXISTS ix_fee_application_contract
  ON "{{TENANT_SCHEMA}}".fee_contract_application (contract_id, applied_on);

DROP TRIGGER IF EXISTS trg_fee_application_no_delete
  ON "{{TENANT_SCHEMA}}".fee_contract_application;
CREATE TRIGGER trg_fee_application_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".fee_contract_application
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_contract', 'fee_contract_exclusion',
                           'fee_contract_application'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
