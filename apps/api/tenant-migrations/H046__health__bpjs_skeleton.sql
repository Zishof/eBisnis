-- =========================================================================
-- H046 — KERANGKA BPJS/JKN DAN GERBANG ADAPTERNYA
-- =========================================================================
--
-- Fase H-9B. Aditif seluruhnya.
--
-- ## Pemisahan yang tidak boleh dikaburkan
--
-- SATUSEHAT dan BPJS adalah konteks terbatas yang BERBEDA, dengan kredensial
-- berbeda dan kegagalan yang berbeda pula. Karena itu tabelnya terpisah,
-- gerbang kemampuannya terpisah, dan tidak ada satu pun kunci asing di antara
-- keduanya. Menyatukannya akan membuat kegagalan pengiriman FHIR menghentikan
-- pengajuan klaim.
--
-- ## Aturan yang menentukan seluruh rancangan
--
-- **INA-CBG adalah pembayaran berbasis PAKET KASUS**, dan itu menentukan bentuk
-- basis data ini. Satu hal yang tampak wajar justru DILARANG:
--
-- > Sistem tidak boleh menganggap setiap obat, tindakan, alat, atau kamar
-- > memiliki nilai penggantian BPJS resmi per item.
--
-- Karena itu `bpjs_claim_item` menyimpan **biaya aktual** dan **tagihan
-- pasien**, dan **tidak punya satu pun kolom penggantian BPJS**. Nilai
-- penggantian resmi berada pada `bpjs_claim` — tingkat paket.
--
-- Seorang pasien yang menerima obat senilai dua juta pada paket senilai lima
-- juta tidak membuat BPJS mengganti dua juta untuk obat itu. Kolom yang
-- menyimpannya akan dijumlahkan laporan, dan jumlah itu akan dipakai menghitung
-- jasa dokter.

-- ---------------------------------------------------------------------------
-- Akun penyedia dan gerbang adapternya
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".bpjs_provider_account (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  provider_code   VARCHAR(64) NOT NULL,
  service_level   VARCHAR(8) NOT NULL,
  environment     VARCHAR(16) NOT NULL DEFAULT 'SANDBOX',

  -- Rujukan brankas, bukan nilainya. Sama dengan H-9A dan H-9H.
  credential_secret_ref VARCHAR(255),

  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  activated_by    UUID,
  activated_at    TIMESTAMPTZ,
  note            TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT bpjs_account_level_valid CHECK (service_level IN ('FKTP', 'FKRTL')),
  CONSTRAINT bpjs_account_env_valid CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  CONSTRAINT bpjs_account_secret_is_ref CHECK (
    credential_secret_ref IS NULL
    OR credential_secret_ref ~ '^(vault|secret|kms)://'
  ),
  CONSTRAINT bpjs_account_active_complete CHECK (
    is_active = FALSE
    OR (credential_secret_ref IS NOT NULL AND activated_by IS NOT NULL AND activated_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bpjs_account
  ON "{{TENANT_SCHEMA}}".bpjs_provider_account (facility_id, service_level, environment);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".bpjs_adapter_capability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  adapter_code    VARCHAR(24) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'BLOCKED',
  blocker         TEXT,
  verified_by     UUID,
  verified_at     TIMESTAMPTZ,
  verification_note TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT bpjs_cap_adapter_valid CHECK (
    adapter_code IN ('VCLAIM', 'PCARE', 'ANTREAN', 'APLICARES', 'HFIS', 'EKLAIM', 'CLAIM_INTEROP')
  ),
  CONSTRAINT bpjs_cap_status_valid CHECK (
    status IN ('BLOCKED', 'CONFIGURED', 'SANDBOX_TESTED', 'VERIFIED')
  ),
  CONSTRAINT bpjs_cap_verified_complete CHECK (
    status <> 'VERIFIED'
    OR (verified_by IS NOT NULL AND verified_at IS NOT NULL
        AND verification_note IS NOT NULL AND length(trim(verification_note)) >= 20)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bpjs_cap
  ON "{{TENANT_SCHEMA}}".bpjs_adapter_capability (facility_id, adapter_code);

-- ---------------------------------------------------------------------------
-- Kepesertaan sebagai CACHE, dengan kedaluwarsa
-- ---------------------------------------------------------------------------
-- Kepesertaan berubah: peserta dapat menunggak, pindah fasilitas, atau berhenti
-- bekerja. Cache tanpa kedaluwarsa membuat rumah sakit melayani sebagai peserta
-- orang yang kepesertaannya berakhir bulan lalu — dan klaimnya ditolak sesudah
-- pelayanannya diberikan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".bpjs_participant_eligibility (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,

  membership_number VARCHAR(32),
  participant_status VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  benefit_class   INTEGER,
  registered_fktp VARCHAR(180),

  checked_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  /*
   * DARI MANA JAWABAN INI DATANG.
   *
   * ADAPTER berarti benar-benar ditanyakan ke BPJS; MANUAL berarti diketik
   * petugas dari kartu peserta. Keduanya sah, tetapi keduanya TIDAK sama — dan
   * kolom yang tidak membedakannya membuat data ketikan tampak seperti jawaban
   * resmi.
   */
  source          VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
  checked_by      UUID,
  raw_note        TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT bpjs_elig_status_valid CHECK (
    participant_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNKNOWN')
  ),
  CONSTRAINT bpjs_elig_source_valid CHECK (source IN ('ADAPTER', 'MANUAL')),
  CONSTRAINT bpjs_elig_class_sane CHECK (benefit_class IS NULL OR benefit_class BETWEEN 1 AND 3),
  -- Yang sudah diperiksa wajib punya kedaluwarsa. Cache tanpa kedaluwarsa
  -- adalah cache yang dipercaya selamanya.
  CONSTRAINT bpjs_elig_checked_expires CHECK (
    checked_at IS NULL OR expires_at IS NOT NULL
  ),
  CONSTRAINT bpjs_elig_expiry_after_check CHECK (
    checked_at IS NULL OR expires_at IS NULL OR expires_at > checked_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bpjs_elig_patient
  ON "{{TENANT_SCHEMA}}".bpjs_participant_eligibility (facility_id, patient_id);

-- ---------------------------------------------------------------------------
-- SEP sebagai catatan lokal
-- ---------------------------------------------------------------------------
-- Nomornya dari BPJS; catatannya milik kami. Tabel ini TIDAK menghasilkan
-- nomor, dan tidak punya urutan yang dapat dipakai menghasilkannya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".bpjs_sep (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  encounter_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,

  sep_number      VARCHAR(32) NOT NULL,
  sep_date        DATE NOT NULL,
  service_type    VARCHAR(24) NOT NULL,
  referral_number VARCHAR(64),
  diagnosis_code  VARCHAR(24),
  benefit_class   INTEGER,
  occupied_class  INTEGER,

  status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,

  recorded_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT bpjs_sep_type_valid CHECK (
    service_type IN ('OUTPATIENT', 'INPATIENT', 'EMERGENCY')
  ),
  CONSTRAINT bpjs_sep_status_valid CHECK (status IN ('ACTIVE', 'CANCELLED')),
  CONSTRAINT bpjs_sep_class_sane CHECK (
    (benefit_class IS NULL OR benefit_class BETWEEN 1 AND 3)
    AND (occupied_class IS NULL OR occupied_class BETWEEN 1 AND 3)
  ),
  CONSTRAINT bpjs_sep_cancel_reason CHECK (
    cancelled_at IS NULL OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) >= 10)
  ),
  -- Nomor yang jelas dibuat sendiri ditolak. Formatnya milik BPJS dan kami
  -- tidak menebaknya — yang ditolak hanyalah yang jelas bukan nomor.
  CONSTRAINT bpjs_sep_number_not_placeholder CHECK (
    length(trim(sep_number)) >= 10
    AND sep_number !~* '^(sep|test|dummy|coba)[-_ ]?'
    AND sep_number !~ '^0+$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bpjs_sep_number
  ON "{{TENANT_SCHEMA}}".bpjs_sep (sep_number);
CREATE INDEX IF NOT EXISTS ix_bpjs_sep_patient
  ON "{{TENANT_SCHEMA}}".bpjs_sep (patient_id, sep_date DESC);

-- ---------------------------------------------------------------------------
-- Klaim BPJS — nilai penggantian pada tingkat PAKET
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".bpjs_claim (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  health_claim_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_claim (id) ON DELETE RESTRICT,
  sep_id          UUID REFERENCES "{{TENANT_SCHEMA}}".bpjs_sep (id) ON DELETE RESTRICT,

  payment_method  VARCHAR(20) NOT NULL,

  /*
   * NILAI PENGGANTIAN RESMI — PADA TINGKAT PAKET, DI SINI.
   *
   * Kolom-kolom ini kosong sampai grouper berlisensi tersedia. Yang penting
   * adalah bahwa tempatnya ADA DI SINI dan tidak ada di baris item.
   */
  casemix_group   VARCHAR(32),
  severity_level  VARCHAR(8),
  tariff_region   VARCHAR(16),
  facility_class  VARCHAR(8),
  package_amount  NUMERIC(20,2),

  -- Tiga angka yang berbeda, tiga kolom — pelajaran H-9C.
  submitted_amount NUMERIC(20,2),
  approved_amount NUMERIC(20,2),
  paid_amount     NUMERIC(20,2),

  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  grouped_at      TIMESTAMPTZ,
  grouped_by_adapter BOOLEAN NOT NULL DEFAULT FALSE,

  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT bpjs_claim_method_valid CHECK (
    payment_method IN ('CAPITATION', 'NON_CAPITATION', 'INACBG', 'NON_INACBG', 'PROGRAM')
  ),
  CONSTRAINT bpjs_claim_status_valid CHECK (
    status IN ('DRAFT', 'READY', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED')
  ),
  CONSTRAINT bpjs_claim_amounts_nonneg CHECK (
    (package_amount IS NULL OR package_amount >= 0)
    AND (submitted_amount IS NULL OR submitted_amount >= 0)
    AND (approved_amount IS NULL OR approved_amount >= 0)
    AND (paid_amount IS NULL OR paid_amount >= 0)
  ),
  /*
   * PENGELOMPOKAN HANYA BOLEH DATANG DARI ADAPTER.
   *
   * Casemix group yang terisi tanpa adapter berarti seseorang mengetiknya —
   * dan tarif yang diketik dari ingatan menghasilkan angka yang tampak masuk
   * akal, dipakai menyusun anggaran, lalu dipakai membagi jasa medis.
   */
  CONSTRAINT bpjs_claim_group_from_adapter CHECK (
    casemix_group IS NULL OR grouped_by_adapter = TRUE
  )
);

CREATE INDEX IF NOT EXISTS ix_bpjs_claim_facility
  ON "{{TENANT_SCHEMA}}".bpjs_claim (facility_id, status);

/*
 * BARIS ITEM — PERHATIKAN APA YANG TIDAK ADA DI SINI.
 *
 * Tidak ada bpjs_reimbursement, tidak ada inacbg_amount, tidak ada
 * approved_amount per item. Bukan kelalaian: INA-CBG adalah pembayaran berbasis
 * paket kasus, dan pasien yang menerima obat senilai dua juta pada paket
 * senilai lima juta tidak membuat BPJS mengganti dua juta untuk obat itu.
 *
 * Yang ada adalah biaya AKTUAL dan tagihan PASIEN — keduanya angka yang
 * memang nyata pada tingkat item.
 */
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".bpjs_claim_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bpjs_claim_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".bpjs_claim (id) ON DELETE CASCADE,

  item_type       VARCHAR(24) NOT NULL,
  item_code       VARCHAR(64) NOT NULL,
  item_name       VARCHAR(255),
  quantity        NUMERIC(14,3) NOT NULL DEFAULT 1,

  -- Biaya yang sesungguhnya keluar. Dipakai untuk harga pokok dan utilisasi.
  actual_cost     NUMERIC(20,2),
  -- Yang ditagihkan kepada pasien, misalnya selisih naik kelas.
  patient_charge  NUMERIC(20,2),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bpjs_item_type_valid CHECK (
    item_type IN ('DRUG', 'PROCEDURE', 'DEVICE', 'ROOM', 'SERVICE', 'OTHER')
  ),
  CONSTRAINT bpjs_item_quantity_positive CHECK (quantity > 0),
  CONSTRAINT bpjs_item_amounts_nonneg CHECK (
    (actual_cost IS NULL OR actual_cost >= 0)
    AND (patient_charge IS NULL OR patient_charge >= 0)
  )
);

CREATE INDEX IF NOT EXISTS ix_bpjs_item_claim
  ON "{{TENANT_SCHEMA}}".bpjs_claim_item (bpjs_claim_id);

-- ---------------------------------------------------------------------------
-- Kebijakan kelas dan KRIS — BERVERSI
-- ---------------------------------------------------------------------------
-- Sistem tidak dikunci pada kelas I/II/III maupun KRIS. Tata kelola JKN memang
-- berubah, dan perubahannya harus dapat diikuti tanpa mengubah kode.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".jkn_entitlement_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  policy_code     VARCHAR(48) NOT NULL,
  policy_name     VARCHAR(180) NOT NULL,
  policy_kind     VARCHAR(24) NOT NULL,
  regulation_ref  VARCHAR(180),

  effective_from  DATE NOT NULL,
  effective_to    DATE,
  detail          TEXT,

  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT jkn_policy_kind_valid CHECK (
    policy_kind IN ('BENEFIT_CLASS', 'KRIS_CRITERIA', 'UPGRADE_CLASS', 'DIFFERENCE_PAYMENT', 'COB')
  ),
  CONSTRAINT jkn_policy_period_sane CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  ),
  -- Kebijakan wajib menunjuk peraturannya. Kebijakan tanpa rujukan peraturan
  -- tidak dapat dipertanggungjawabkan ketika ditanya dasar hukumnya.
  CONSTRAINT jkn_policy_has_regulation CHECK (
    regulation_ref IS NOT NULL AND length(trim(regulation_ref)) >= 5
  )
);

CREATE INDEX IF NOT EXISTS ix_jkn_policy_lookup
  ON "{{TENANT_SCHEMA}}".jkn_entitlement_policy (facility_id, policy_kind, effective_from DESC);

-- ---------------------------------------------------------------------------
-- Menyemai gerbang adapter bagi setiap fasilitas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".seed_bpjs_capability(f_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO "{{TENANT_SCHEMA}}".bpjs_adapter_capability (facility_id, adapter_code, status, blocker)
  SELECT f_id, v.kode, 'BLOCKED', v.blocker
    FROM (VALUES
      ('VCLAIM', 'Consumer ID, secret, dan user key belum ada.'),
      ('PCARE', 'Kredensial FKTP belum ada.'),
      ('ANTREAN', 'Kredensial belum ada; kewajiban SLA jawaban belum disepakati.'),
      ('APLICARES', 'Kredensial belum ada.'),
      ('HFIS', 'Kredensial belum ada.'),
      ('EKLAIM', 'Berkas grouper berlisensi belum ada. Menirunya menghasilkan tarif karangan.'),
      ('CLAIM_INTEROP', 'Kredensial dan spesifikasi berversi belum ada.')
    ) AS v(kode, blocker)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".bpjs_adapter_capability c
      WHERE c.facility_id = f_id AND c.adapter_code = v.kode
   );
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN SELECT id FROM "{{TENANT_SCHEMA}}".health_facility LOOP
    PERFORM "{{TENANT_SCHEMA}}".seed_bpjs_capability(f.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".seed_bpjs_on_facility()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM "{{TENANT_SCHEMA}}".seed_bpjs_capability(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_bpjs_capability ON "{{TENANT_SCHEMA}}".health_facility;
CREATE TRIGGER trg_seed_bpjs_capability
  AFTER INSERT ON "{{TENANT_SCHEMA}}".health_facility
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".seed_bpjs_on_facility();

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bpjs_provider_account', 'bpjs_adapter_capability',
                           'bpjs_participant_eligibility', 'bpjs_sep', 'bpjs_claim',
                           'bpjs_claim_item', 'jkn_entitlement_policy'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
