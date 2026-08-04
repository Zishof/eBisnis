-- =========================================================================
-- H006 — FARMASI, RESEP, PENYERAHAN, DAN PEMBERIAN OBAT
-- =========================================================================
--
-- Fase H-4. Aditif seluruhnya.
--
-- Dua aturan menentukan bentuk seluruh berkas ini.
--
-- 1. **Farmasi tidak pernah menulis ke `stock_balance`.** Ia meminta lewat
--    `InventoryPort`. Alasannya bukan kerapian arsitektur: obat punya aturan
--    yang barang dagangan tidak punya — kedaluwarsa yang MENGHENTIKAN
--    pemberian, golongan terkendali yang menuntut pencatatan ganda, penarikan
--    sediaan yang harus dapat menelusuri siapa sudah menerimanya. Menaruh
--    aturan itu di mesin persediaan bersama membuatnya berlaku pada kaus dan
--    kopi; tidak menaruhnya di mana pun berarti obat kedaluwarsa dapat
--    diserahkan.
--
-- 2. **Yang meresepkan bukan yang menyerahkan.** Dipisahkan sebagai dua hak
--    akses dan dua tabel, karena pemeriksaan oleh orang kedua adalah satu-
--    satunya penahan yang benar-benar bekerja ketika dosisnya salah ketik.

-- ---------------------------------------------------------------------------
-- Master obat
-- ---------------------------------------------------------------------------
-- Menunjuk `product` yang sudah ada: obat memang barang yang dibeli, disimpan,
-- dan dihitung stoknya oleh mesin persediaan. Yang ditambahkan di sini adalah
-- yang tidak dikenal barang dagangan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_drug_master (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  code              VARCHAR(48) NOT NULL,
  generic_name      VARCHAR(255) NOT NULL,
  brand_name        VARCHAR(255),
  -- Zat aktif dipisahkan supaya interaksi dan alergi dapat diperiksa terhadap
  -- ZATNYA, bukan terhadap nama dagangnya. Pasien yang alergi amoksisilin
  -- alergi terhadap seluruh merek yang mengandungnya.
  active_ingredient VARCHAR(255) NOT NULL,
  atc_code          VARCHAR(24),
  dosage_form       VARCHAR(48) NOT NULL,
  strength_value    NUMERIC(12,4),
  strength_unit     VARCHAR(24),
  route             VARCHAR(32),

  -- Golongan menurut peraturan Indonesia. Narkotika dan psikotropika menuntut
  -- pencatatan ganda dan lemari terkunci.
  drug_class        VARCHAR(24) NOT NULL DEFAULT 'OTC',
  is_controlled     BOOLEAN NOT NULL DEFAULT FALSE,
  is_high_alert     BOOLEAN NOT NULL DEFAULT FALSE,
  -- LASA: Look-Alike Sound-Alike. Obat yang namanya mirip adalah sebab
  -- kekeliruan pemberian yang paling sering, dan penandaannya harus terlihat
  -- di layar sebelum dipilih.
  is_lasa           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Batas dosis untuk pemeriksaan kewajaran. NULL berarti tidak diperiksa —
  -- lebih baik tidak memeriksa daripada memeriksa dengan angka yang dikarang.
  min_single_dose   NUMERIC(12,4),
  max_single_dose   NUMERIC(12,4),
  max_daily_dose    NUMERIC(12,4),
  dose_unit         VARCHAR(24),

  is_formulary      BOOLEAN NOT NULL DEFAULT TRUE,
  requires_prescription BOOLEAN NOT NULL DEFAULT TRUE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT rx_drug_class_valid CHECK (
    drug_class IN ('OTC', 'OTC_LIMITED', 'PRESCRIPTION', 'PSYCHOTROPIC', 'NARCOTIC')
  ),
  -- Narkotika dan psikotropika SELALU terkendali. Ditegakkan basis data supaya
  -- tidak dapat luput karena kelalaian pengisian.
  CONSTRAINT rx_controlled_consistent CHECK (
    drug_class NOT IN ('PSYCHOTROPIC', 'NARCOTIC') OR is_controlled = TRUE
  ),
  CONSTRAINT rx_dose_range_ordered CHECK (
    min_single_dose IS NULL OR max_single_dose IS NULL OR min_single_dose <= max_single_dose
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rx_drug_code
  ON "{{TENANT_SCHEMA}}".rx_drug_master (code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_rx_drug_product
  ON "{{TENANT_SCHEMA}}".rx_drug_master (product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_rx_drug_ingredient
  ON "{{TENANT_SCHEMA}}".rx_drug_master (lower(active_ingredient));
CREATE INDEX IF NOT EXISTS ix_rx_drug_controlled
  ON "{{TENANT_SCHEMA}}".rx_drug_master (is_controlled) WHERE is_controlled = TRUE;

-- ---------------------------------------------------------------------------
-- Interaksi obat
-- ---------------------------------------------------------------------------
-- Antar ZAT AKTIF, bukan antar merek.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_interaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_a    VARCHAR(255) NOT NULL,
  ingredient_b    VARCHAR(255) NOT NULL,
  severity        VARCHAR(16) NOT NULL,
  description     TEXT NOT NULL,
  management      TEXT,
  source          VARCHAR(120),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT rx_interaction_severity_valid CHECK (
    severity IN ('MINOR', 'MODERATE', 'MAJOR', 'CONTRAINDICATED')
  ),
  CONSTRAINT rx_interaction_not_self CHECK (lower(ingredient_a) <> lower(ingredient_b))
);

-- Pasangan yang sama tidak didaftarkan dua kali dari arah mana pun.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rx_interaction_pair
  ON "{{TENANT_SCHEMA}}".rx_interaction
     (LEAST(lower(ingredient_a), lower(ingredient_b)),
      GREATEST(lower(ingredient_a), lower(ingredient_b)));

-- ---------------------------------------------------------------------------
-- Resep
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_prescription (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  prescription_number VARCHAR(64) NOT NULL,
  prescribed_by_provider_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  prescribed_by     UUID,
  prescribed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  note              TEXT,

  -- Telaah apoteker. Terpisah dari peresepan, dan itu inti keselamatan obat:
  -- pemeriksaan oleh orang kedua adalah satu-satunya penahan yang bekerja
  -- ketika dosisnya salah ketik.
  reviewed_by       UUID,
  reviewed_at       TIMESTAMPTZ,
  review_note       TEXT,

  cancelled_at      TIMESTAMPTZ,
  cancelled_by      UUID,
  cancel_reason     TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT rx_prescription_status_valid CHECK (
    status IN ('DRAFT', 'PRESCRIBED', 'UNDER_REVIEW', 'REVIEWED', 'PARTIALLY_DISPENSED',
               'DISPENSED', 'CANCELLED', 'REJECTED')
  ),
  -- Apoteker penelaah tidak boleh sama dengan dokter peresep. Ditegakkan basis
  -- data pula, bukan hanya layanan: aturan pemisahan wewenang yang hanya ada
  -- di satu lapisan berhenti berlaku begitu ada jalan kedua menuju tabelnya.
  CONSTRAINT rx_prescription_review_not_self CHECK (
    reviewed_by IS NULL OR prescribed_by IS NULL OR reviewed_by <> prescribed_by
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rx_prescription_number
  ON "{{TENANT_SCHEMA}}".rx_prescription (prescription_number);
CREATE INDEX IF NOT EXISTS ix_rx_prescription_patient
  ON "{{TENANT_SCHEMA}}".rx_prescription (patient_id, prescribed_at DESC);
CREATE INDEX IF NOT EXISTS ix_rx_prescription_worklist
  ON "{{TENANT_SCHEMA}}".rx_prescription (facility_id, status, prescribed_at)
  WHERE status IN ('PRESCRIBED', 'UNDER_REVIEW', 'REVIEWED', 'PARTIALLY_DISPENSED');

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_prescription_line (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".rx_prescription (id) ON DELETE CASCADE,
  drug_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".rx_drug_master (id) ON DELETE RESTRICT,
  line_no           INTEGER NOT NULL,

  dose_value        NUMERIC(12,4) NOT NULL,
  dose_unit         VARCHAR(24) NOT NULL,
  route             VARCHAR(32) NOT NULL,
  frequency_code    VARCHAR(24) NOT NULL,
  frequency_per_day NUMERIC(6,2),
  duration_days     INTEGER,
  quantity          NUMERIC(12,3) NOT NULL,
  quantity_unit     VARCHAR(24),
  instruction       TEXT,
  is_prn            BOOLEAN NOT NULL DEFAULT FALSE,

  -- Peringatan yang dilewati saat meresepkan, tersimpan pada barisnya sendiri.
  -- Bila kelak terjadi kejadian tidak diharapkan, pertanyaannya adalah "apakah
  -- sistem memperingatkan?" — dan jawabannya harus ada di sini, bukan disimpulkan.
  override_alerts   JSONB,

  dispensed_qty     NUMERIC(12,3) NOT NULL DEFAULT 0,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT rx_line_dose_positive CHECK (dose_value > 0),
  CONSTRAINT rx_line_quantity_positive CHECK (quantity > 0),
  -- Jumlah yang diserahkan tidak pernah melebihi yang diresepkan. Ditegakkan
  -- basis data: penyerahan yang menghitung sendiri sisanya akan salah begitu
  -- dua penyerahan atas resep yang sama diproses bersamaan.
  CONSTRAINT rx_line_dispensed_bounded CHECK (dispensed_qty >= 0 AND dispensed_qty <= quantity)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rx_line_no
  ON "{{TENANT_SCHEMA}}".rx_prescription_line (prescription_id, line_no);

-- ---------------------------------------------------------------------------
-- Penyerahan obat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_dispensing (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".rx_prescription (id) ON DELETE RESTRICT,
  prescription_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".rx_prescription_line (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL,
  drug_id           UUID NOT NULL,
  -- Obat yang benar-benar diserahkan boleh berbeda dari yang diresepkan bila
  -- ada substitusi; keduanya dicatat supaya penelusuran tetap mungkin.
  dispensed_drug_id UUID REFERENCES "{{TENANT_SCHEMA}}".rx_drug_master (id) ON DELETE RESTRICT,
  substitution_reason TEXT,

  quantity          NUMERIC(12,3) NOT NULL,
  batch_no          VARCHAR(64),
  expiry_date       DATE,
  warehouse_id      UUID,

  dispensed_by      UUID NOT NULL,
  dispensed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Pemeriksaan ganda untuk obat berisiko tinggi dan golongan terkendali.
  double_checked_by UUID,
  double_checked_at TIMESTAMPTZ,

  idempotency_key   VARCHAR(120),
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT rx_dispensing_quantity_positive CHECK (quantity > 0),
  -- Pemeriksa kedua tidak boleh sama dengan penyerahnya. Pemeriksaan ganda oleh
  -- orang yang sama bukan pemeriksaan ganda.
  CONSTRAINT rx_dispensing_double_check_not_self CHECK (
    double_checked_by IS NULL OR double_checked_by <> dispensed_by
  ),
  CONSTRAINT rx_dispensing_substitution_needs_reason CHECK (
    dispensed_drug_id IS NULL OR dispensed_drug_id = drug_id OR
    (substitution_reason IS NOT NULL AND length(trim(substitution_reason)) >= 5)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rx_dispensing_idempotency
  ON "{{TENANT_SCHEMA}}".rx_dispensing (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_rx_dispensing_prescription
  ON "{{TENANT_SCHEMA}}".rx_dispensing (prescription_id);
CREATE INDEX IF NOT EXISTS ix_rx_dispensing_patient
  ON "{{TENANT_SCHEMA}}".rx_dispensing (patient_id, dispensed_at DESC);

-- Penyerahan obat tidak dapat diubah maupun dihapus. Ia catatan bahwa obat
-- berpindah tangan; mengubahnya berarti mengubah kenyataan yang sudah terjadi.
DROP TRIGGER IF EXISTS trg_rx_dispensing_immutable ON "{{TENANT_SCHEMA}}".rx_dispensing;
CREATE TRIGGER trg_rx_dispensing_immutable
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".rx_dispensing
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Pemberian obat (eMAR)
-- ---------------------------------------------------------------------------
-- Enam benar: pasien, obat, dosis, rute, waktu, dokumentasi. Kelima yang
-- pertama adalah kolom; yang keenam adalah keberadaan barisnya sendiri.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_administration (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".rx_prescription_line (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  drug_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".rx_drug_master (id) ON DELETE RESTRICT,
  encounter_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,

  scheduled_at      TIMESTAMPTZ,
  administered_at   TIMESTAMPTZ,
  dose_value        NUMERIC(12,4) NOT NULL,
  dose_unit         VARCHAR(24) NOT NULL,
  route             VARCHAR(32) NOT NULL,

  status            VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED',
  administered_by   UUID,
  witnessed_by      UUID,

  -- Alasan tidak diberikan. Obat yang dilewati tanpa alasan tidak dapat
  -- dibedakan dari obat yang lupa diberikan — dan keduanya menuntut tindak
  -- lanjut yang sama sekali berbeda.
  omission_reason   VARCHAR(48),
  omission_note     TEXT,

  -- Sisa yang dibuang, untuk obat terkendali. Ampul yang terpakai separuh
  -- harus dapat dipertanggungjawabkan sisanya.
  wasted_amount     NUMERIC(12,4),
  waste_witnessed_by UUID,

  note              TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT rx_admin_status_valid CHECK (
    status IN ('SCHEDULED', 'ADMINISTERED', 'OMITTED', 'REFUSED', 'HELD', 'CANCELLED')
  ),
  CONSTRAINT rx_admin_dose_positive CHECK (dose_value > 0),
  -- Yang diberikan wajib menyebut siapa yang memberikan dan kapan. Tanpa
  -- keduanya, "benar dokumentasi" tidak terpenuhi.
  CONSTRAINT rx_admin_given_complete CHECK (
    status <> 'ADMINISTERED' OR (administered_at IS NOT NULL AND administered_by IS NOT NULL)
  ),
  -- Yang tidak diberikan wajib menyebut sebabnya.
  CONSTRAINT rx_admin_omission_needs_reason CHECK (
    status NOT IN ('OMITTED', 'REFUSED', 'HELD') OR omission_reason IS NOT NULL
  ),
  -- Saksi tidak boleh sama dengan pemberinya.
  CONSTRAINT rx_admin_witness_not_self CHECK (
    witnessed_by IS NULL OR administered_by IS NULL OR witnessed_by <> administered_by
  )
);

CREATE INDEX IF NOT EXISTS ix_rx_admin_patient
  ON "{{TENANT_SCHEMA}}".rx_administration (patient_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS ix_rx_admin_due
  ON "{{TENANT_SCHEMA}}".rx_administration (scheduled_at)
  WHERE status = 'SCHEDULED';

-- ---------------------------------------------------------------------------
-- Kejadian obat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_incident (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  prescription_id UUID,
  administration_id UUID,
  incident_type   VARCHAR(32) NOT NULL,
  severity        VARCHAR(16) NOT NULL DEFAULT 'NO_HARM',
  description     TEXT NOT NULL,
  -- Kejadian nyaris cedera dicatat pula, dan justru itu yang paling berharga:
  -- ia menunjukkan celah sebelum ada yang terluka.
  reached_patient BOOLEAN NOT NULL DEFAULT FALSE,
  reported_by     UUID,
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT rx_incident_type_valid CHECK (
    incident_type IN ('WRONG_PATIENT', 'WRONG_DRUG', 'WRONG_DOSE', 'WRONG_ROUTE',
                      'WRONG_TIME', 'OMISSION', 'EXPIRED_DRUG', 'ALLERGY_REACTION',
                      'INTERACTION', 'NEAR_MISS', 'OTHER')
  ),
  CONSTRAINT rx_incident_severity_valid CHECK (
    severity IN ('NEAR_MISS', 'NO_HARM', 'MILD', 'MODERATE', 'SEVERE', 'DEATH')
  )
);

CREATE INDEX IF NOT EXISTS ix_rx_incident_reported
  ON "{{TENANT_SCHEMA}}".rx_incident (reported_at DESC);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['rx_drug_master', 'rx_prescription', 'rx_prescription_line',
                           'rx_dispensing', 'rx_administration', 'rx_incident'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
