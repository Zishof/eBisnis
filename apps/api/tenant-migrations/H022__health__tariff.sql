-- =========================================================================
-- H022 — TARIF BERVERSI DAN CAKUPAN PENJAMIN
-- =========================================================================
--
-- Fase H-9D. Aditif seluruhnya.
--
-- Strukturnya dibangun sekarang; **isinya menunggu terbitan resmi**. Sampai
-- isinya ada, sistem berkata "tarif untuk kunci ini belum tersedia" dan menolak
-- menghitung. Itu jawaban yang benar — menaksirnya akan menghasilkan angka yang
-- tampak resmi lalu dipakai menagih orang.
--
-- Empat hal ditegakkan basis data di sini.
--
-- 1. **Tarif tidak pernah ditimpa.** Impor membuat versi baru; versi lama
--    ditutup dengan tanggal berakhir. Klaim tahun lalu harus tetap dapat
--    dijelaskan dengan tarif tahun lalu — bila tarifnya ditimpa, seluruh klaim
--    lama menjadi tidak dapat diaudit.
--
-- 2. **TUMPANG TINDIH TANGGAL DITOLAK**, ditegakkan constraint pengecualian
--    `EXCLUDE USING gist`. Dua versi yang berlaku pada tanggal yang sama untuk
--    kunci yang sama membuat pemilihan tarif tidak dapat ditentukan — dan yang
--    tidak dapat ditentukan akan ditentukan secara acak oleh urutan baris,
--    yaitu oleh sesuatu yang tidak pernah dilihat siapa pun.
--
-- 3. **Tarif yang tidak dapat ditelusuri ke terbitannya tidak dapat
--    diaktifkan.** Berkas sumber dan sidik jarinya wajib. Tarif tanpa sumber
--    tidak dapat dibedakan dari tarif yang diketik dari ingatan.
--
-- 4. **Yang mengimpor tidak menyetujui.** Impor dan aktivasi dua langkah;
--    menyatukannya berarti satu orang dapat mengubah seluruh tagihan rumah
--    sakit tanpa ada pihak kedua yang pernah melihatnya.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Peraturan yang menjadi dasar
-- ---------------------------------------------------------------------------
-- Inventaris yang KOSONG lebih baik daripada inventaris yang berisi nomor
-- peraturan hasil ingatan. Nomor yang keliru akan disalin ke dokumen klaim, dan
-- dokumen klaim yang menyebut peraturan yang tidak berlaku akan dikembalikan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".jkn_regulation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       VARCHAR(120) NOT NULL,
  year            SMALLINT NOT NULL,
  title           VARCHAR(500) NOT NULL,
  scope           VARCHAR(16) NOT NULL,
  effective_from  DATE NOT NULL,
  revoked_at      DATE,
  revokes_reference VARCHAR(120),
  source_file     VARCHAR(255),
  source_hash     VARCHAR(128),
  verified_by     UUID,
  verified_at     TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT jkn_regulation_scope_valid CHECK (scope IN ('FKTP', 'FKRTL', 'BOTH')),
  CONSTRAINT jkn_regulation_year_sane CHECK (year BETWEEN 2000 AND 2200),
  CONSTRAINT jkn_regulation_revoked_after CHECK (
    revoked_at IS NULL OR revoked_at >= effective_from
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_jkn_regulation_reference
  ON "{{TENANT_SCHEMA}}".jkn_regulation (reference);

-- ---------------------------------------------------------------------------
-- Versi tarif
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".jkn_tariff_version (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  regulation_id   UUID REFERENCES "{{TENANT_SCHEMA}}".jkn_regulation (id) ON DELETE RESTRICT,
  regulation_reference VARCHAR(120),

  -- Berkas sumber beserta sidik jarinya. Tarif yang tidak dapat ditelusuri ke
  -- terbitan resminya tidak dapat dibedakan dari tarif yang diketik dari
  -- ingatan.
  source_file     VARCHAR(255),
  source_hash     VARCHAR(128),

  row_count       INTEGER NOT NULL DEFAULT 0,

  imported_by     UUID,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  approval_note   TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  retired_at      TIMESTAMPTZ,
  retire_reason   TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  -- Yang mengimpor tidak menyetujui.
  CONSTRAINT jkn_version_approval_not_self CHECK (
    approved_by IS NULL OR imported_by IS NULL OR approved_by <> imported_by
  ),
  -- Aktivasi menuntut persetujuan, dasar peraturan, berkas sumber, sidik jari,
  -- dan isi. Versi kosong yang diaktifkan akan menghentikan seluruh
  -- perhitungan tarif tanpa ada yang tahu sebabnya.
  CONSTRAINT jkn_version_active_complete CHECK (
    is_active = FALSE
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL
        AND regulation_reference IS NOT NULL AND length(trim(regulation_reference)) >= 3
        AND source_file IS NOT NULL AND source_hash IS NOT NULL
        AND row_count >= 1)
  ),
  CONSTRAINT jkn_version_retire_reason CHECK (
    retired_at IS NULL OR (retire_reason IS NOT NULL AND length(trim(retire_reason)) >= 5)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_jkn_tariff_version_code
  ON "{{TENANT_SCHEMA}}".jkn_tariff_version (code);
CREATE INDEX IF NOT EXISTS ix_jkn_tariff_version_active
  ON "{{TENANT_SCHEMA}}".jkn_tariff_version (is_active) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Baris tarif
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".jkn_tariff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".jkn_tariff_version (id) ON DELETE CASCADE,

  -- Kunci pemilihan. Enam bagian, dan keenamnya menentukan: menghilangkan salah
  -- satunya akan menghasilkan tarif yang cocok bagi rumah sakit lain di
  -- provinsi lain.
  payment_method  VARCHAR(24) NOT NULL,
  region_code     VARCHAR(24) NOT NULL,
  facility_class  VARCHAR(8) NOT NULL,
  service_class   VARCHAR(16),
  casemix_group   VARCHAR(32),
  casemix_severity VARCHAR(8),

  amount          NUMERIC(18,2) NOT NULL,

  -- Rentang berlaku sebagai daterange, supaya tumpang tindihnya dapat ditolak
  -- constraint pengecualian. Batas atas terbuka: [mulai, selesai).
  effective_range DATERANGE NOT NULL,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT jkn_tariff_method_valid CHECK (
    payment_method IN ('CAPITATION', 'NON_CAPITATION', 'INA_CBG', 'NON_INA_CBG', 'FEE_FOR_SERVICE')
  ),
  CONSTRAINT jkn_tariff_facility_class_valid CHECK (
    facility_class IN ('FKTP', 'A', 'B', 'C', 'D')
  ),
  CONSTRAINT jkn_tariff_service_class_valid CHECK (
    service_class IS NULL
    OR service_class IN ('KRIS', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'VIP', 'VVIP')
  ),
  CONSTRAINT jkn_tariff_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT jkn_tariff_range_not_empty CHECK (NOT isempty(effective_range))
);

/*
 * TUMPANG TINDIH TANGGAL DITOLAK.
 *
 * Dua baris dengan kunci yang sama tidak boleh berlaku pada rentang yang
 * bersinggungan. Bila dibiarkan, pemilihan tarif ditentukan urutan baris — dan
 * urutan baris bukan keputusan siapa pun.
 *
 * COALESCE dipakai pada bagian yang boleh kosong, sebab NULL tidak pernah sama
 * dengan NULL pada operator kesamaan constraint pengecualian; tanpa itu, dua
 * tarif umum yang bertumpang tindih akan lolos.
 */
ALTER TABLE "{{TENANT_SCHEMA}}".jkn_tariff
  DROP CONSTRAINT IF EXISTS jkn_tariff_no_overlap;
ALTER TABLE "{{TENANT_SCHEMA}}".jkn_tariff
  ADD CONSTRAINT jkn_tariff_no_overlap
  EXCLUDE USING gist (
    payment_method WITH =,
    region_code WITH =,
    facility_class WITH =,
    COALESCE(service_class, '~') WITH =,
    COALESCE(casemix_group, '~') WITH =,
    COALESCE(casemix_severity, '~') WITH =,
    effective_range WITH &&
  );

CREATE INDEX IF NOT EXISTS ix_jkn_tariff_lookup
  ON "{{TENANT_SCHEMA}}".jkn_tariff
     (payment_method, region_code, facility_class, casemix_group);
CREATE INDEX IF NOT EXISTS ix_jkn_tariff_version
  ON "{{TENANT_SCHEMA}}".jkn_tariff (version_id);

/*
 * BARIS TARIF PADA VERSI YANG SUDAH AKTIF TIDAK DAPAT DIUBAH.
 *
 * Klaim yang sudah dihitung memakai baris ini harus tetap dapat dijelaskan.
 * Yang hendak mengubah tarif membuat versi baru; itulah gunanya versi.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_active_tariff_mutation()
RETURNS TRIGGER AS $$
DECLARE
  aktif BOOLEAN;
BEGIN
  SELECT is_active INTO aktif
    FROM "{{TENANT_SCHEMA}}".jkn_tariff_version
   WHERE id = COALESCE(OLD.version_id, NEW.version_id);

  IF aktif THEN
    RAISE EXCEPTION
      'TARIFF_VERSION_ACTIVE: baris tarif pada versi yang sudah aktif tidak dapat diubah '
      'maupun dihapus. Klaim yang sudah dihitung memakai baris ini harus tetap dapat '
      'dijelaskan — buat versi baru.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jkn_tariff_immutable ON "{{TENANT_SCHEMA}}".jkn_tariff;
CREATE TRIGGER trg_jkn_tariff_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".jkn_tariff
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_active_tariff_mutation();

-- ---------------------------------------------------------------------------
-- Cakupan penjamin
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_payer_coverage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  payer_type      VARCHAR(24) NOT NULL,
  payer_name      VARCHAR(255) NOT NULL,
  contract_reference VARCHAR(120),

  coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 100,
  ceiling_amount  NUMERIC(18,2),
  deductible_amount NUMERIC(18,2),
  requires_referral BOOLEAN NOT NULL DEFAULT FALSE,
  requires_pre_authorization BOOLEAN NOT NULL DEFAULT FALSE,

  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT payer_type_valid CHECK (
    payer_type IN ('BPJS', 'INSURER', 'CORPORATE', 'SELF_PAY', 'GOVERNMENT_PROGRAM')
  ),
  CONSTRAINT payer_coverage_percent_sane CHECK (
    coverage_percent >= 0 AND coverage_percent <= 100
  ),
  CONSTRAINT payer_ceiling_non_negative CHECK (ceiling_amount IS NULL OR ceiling_amount >= 0),
  CONSTRAINT payer_deductible_non_negative CHECK (
    deductible_amount IS NULL OR deductible_amount >= 0
  ),
  CONSTRAINT payer_period_sane CHECK (effective_to IS NULL OR effective_to >= effective_from),
  -- Penjamin selain pasien sendiri wajib menyebut kontraknya. Tanggungan tanpa
  -- kontrak yang tercatat tidak dapat ditagihkan kepada siapa pun.
  CONSTRAINT payer_contract_required CHECK (
    payer_type = 'SELF_PAY'
    OR contract_reference IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_payer_coverage_active
  ON "{{TENANT_SCHEMA}}".health_payer_coverage (facility_id, payer_type, payer_name)
  WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['jkn_regulation', 'jkn_tariff_version', 'jkn_tariff',
                           'health_payer_coverage'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
