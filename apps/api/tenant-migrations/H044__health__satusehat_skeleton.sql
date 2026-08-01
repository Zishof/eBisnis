-- =========================================================================
-- H044 — KERANGKA SATUSEHAT DAN GERBANG KEMAMPUANNYA
-- =========================================================================
--
-- Fase H-9A. Aditif seluruhnya.
--
-- Migrasi ini membangun **kerangka yang menolak berjalan**, dan itulah
-- maksudnya. Perintah R2 §5 menyebutnya tegas: *"Jangan mengarang
-- endpoint/payload."*
--
-- Perhatikan apa yang TIDAK ada di sini: tidak ada tabel payload, tidak ada
-- kolom yang menampung badan permintaan FHIR, dan tidak ada satu pun kolom
-- yang menyimpan rahasia. Yang ada adalah:
--
-- - pendaftaran lingkungan, beserta **rujukan** kredensialnya;
-- - matriks kemampuan beserta statusnya — inilah gerbangnya;
-- - pemetaan entitas lokal ke jenis sumber daya FHIR (pemetaannya milik kami;
--   bentuk payload-nya bukan);
-- - jejak percobaan pengiriman;
-- - dan rekonsiliasi.
--
-- Lima hal ditegakkan basis data.
--
-- 1. **Rahasia tidak pernah masuk basis data tenant.** Yang tersimpan adalah
--    rujukan brankas, dan constraint menolak yang tampak seperti nilai.
--
-- 2. **`VERIFIED` menuntut keenam syaratnya DAN nama manusianya.** Status yang
--    dapat dinaikkan tanpa nama adalah status yang akan dinaikkan oleh naskah
--    penyemaian.
--
-- 3. **Kenaikan status tidak boleh melompat**, ditegakkan trigger. Tahap yang
--    dilompati justru yang menemukan bahwa dokumentasinya berbeda dari
--    sandbox-nya.
--
-- 4. **Kunci idempotensi unik per fasilitas.** Percobaan ulang karena jaringan
--    terputus tidak boleh menghasilkan dua sumber daya di sistem nasional.
--
-- 5. **Jejak percobaan tidak dapat dihapus.** Ia satu-satunya catatan tentang
--    apa yang pernah dikirimkan atas nama fasilitas ini.

-- ---------------------------------------------------------------------------
-- Lingkungan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".satusehat_environment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  environment     VARCHAR(16) NOT NULL,
  organization_id VARCHAR(120),
  base_url        VARCHAR(255),

  /*
   * RUJUKAN KREDENSIAL, BUKAN KREDENSIALNYA.
   *
   * Kredensial sistem nasional yang bocor tidak hanya membuka data satu
   * fasilitas — ia membuka jalan mengirimkan data ATAS NAMA fasilitas itu, dan
   * yang menerima tidak punya cara membedakannya.
   */
  credential_secret_ref VARCHAR(255),

  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  activated_by    UUID,
  activated_at    TIMESTAMPTZ,
  note            TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT satusehat_env_valid CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  CONSTRAINT satusehat_env_secret_is_ref CHECK (
    credential_secret_ref IS NULL
    OR credential_secret_ref ~ '^(vault|secret|kms)://'
  ),
  -- Lingkungan yang aktif wajib punya rujukan kredensial dan ID organisasi.
  -- Lingkungan aktif tanpa keduanya adalah tombol yang menyala tanpa kabel.
  CONSTRAINT satusehat_env_active_complete CHECK (
    is_active = FALSE
    OR (credential_secret_ref IS NOT NULL AND organization_id IS NOT NULL
        AND activated_by IS NOT NULL AND activated_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_satusehat_env
  ON "{{TENANT_SCHEMA}}".satusehat_environment (facility_id, environment);
-- Satu lingkungan aktif per fasilitas. Dua lingkungan aktif berarti tidak ada
-- yang tahu ke mana data pasien dikirimkan.
CREATE UNIQUE INDEX IF NOT EXISTS ux_satusehat_env_active
  ON "{{TENANT_SCHEMA}}".satusehat_environment (facility_id)
  WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Matriks kemampuan — INILAH GERBANGNYA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".satusehat_capability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  resource_type   VARCHAR(48) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'BLOCKED',
  blocker         TEXT,

  /*
   * BUKTI KEENAM SYARATNYA.
   *
   * Larik kode, bukan kotak centang tunggal. Kotak centang tunggal akan
   * dicentang oleh orang yang punya tiga di antaranya dan tergesa.
   */
  evidence_codes  VARCHAR(32)[] NOT NULL DEFAULT '{}',

  verified_by     UUID,
  verified_at     TIMESTAMPTZ,
  verification_note TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT satusehat_cap_status_valid CHECK (
    status IN ('BLOCKED', 'DOCUMENTED', 'SANDBOX_TESTED', 'VERIFIED')
  ),
  /*
   * VERIFIED MENUNTUT NAMA MANUSIANYA DAN KEENAM BUKTINYA.
   *
   * VERIFIED hanya boleh diberikan manusia yang sudah menjalankan panggilannya
   * terhadap sandbox — bukan program, dan bukan berdasarkan dokumentasi saja.
   */
  CONSTRAINT satusehat_cap_verified_complete CHECK (
    status <> 'VERIFIED'
    OR (verified_by IS NOT NULL AND verified_at IS NOT NULL
        AND array_length(evidence_codes, 1) >= 6
        AND verification_note IS NOT NULL AND length(trim(verification_note)) >= 20)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_satusehat_cap
  ON "{{TENANT_SCHEMA}}".satusehat_capability (facility_id, resource_type);

/*
 * KENAIKAN STATUS TIDAK BOLEH MELOMPAT.
 *
 * Tahap yang dilompati justru yang menemukan bahwa dokumentasinya berbeda dari
 * sandbox-nya — dan perbedaan itu selalu ada. Penurunan selalu diizinkan: yang
 * ternyata tidak bekerja harus dapat dikembalikan tanpa perdebatan.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_capability_status_skip()
RETURNS TRIGGER AS $$
DECLARE
  urutan TEXT[] := ARRAY['BLOCKED', 'DOCUMENTED', 'SANDBOX_TESTED', 'VERIFIED'];
  i INTEGER;
  j INTEGER;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  i := array_position(urutan, OLD.status);
  j := array_position(urutan, NEW.status);
  IF j > i + 1 THEN
    RAISE EXCEPTION
      'CAPABILITY_STATUS_SKIP: kenaikan dari % ke % melompati tahap. Tahap yang dilompati '
      'justru yang menemukan bahwa dokumentasinya berbeda dari sandbox-nya.', OLD.status, NEW.status
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_satusehat_cap_no_skip ON "{{TENANT_SCHEMA}}".satusehat_capability;
CREATE TRIGGER trg_satusehat_cap_no_skip
  BEFORE UPDATE ON "{{TENANT_SCHEMA}}".satusehat_capability
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_capability_status_skip();

-- ---------------------------------------------------------------------------
-- Pemetaan entitas lokal ke jenis sumber daya
-- ---------------------------------------------------------------------------
-- Pemetaannya milik kami; bentuk payload-nya bukan. Karena itu tabel ini
-- menyimpan NAMA TABEL, bukan bentuk pesannya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".satusehat_resource_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  resource_type   VARCHAR(48) NOT NULL,
  local_table     VARCHAR(120) NOT NULL,
  local_key_column VARCHAR(64) NOT NULL DEFAULT 'id',
  note            TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,

  CONSTRAINT satusehat_map_table_not_empty CHECK (length(trim(local_table)) >= 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_satusehat_map
  ON "{{TENANT_SCHEMA}}".satusehat_resource_mapping (facility_id, resource_type, local_table);

-- ---------------------------------------------------------------------------
-- Jejak percobaan pengiriman
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".satusehat_transaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  environment_id  UUID REFERENCES "{{TENANT_SCHEMA}}".satusehat_environment (id) ON DELETE RESTRICT,

  resource_type   VARCHAR(48) NOT NULL,
  local_id        UUID NOT NULL,
  local_version   INTEGER NOT NULL DEFAULT 1,

  /*
   * KUNCI IDEMPOTENSI, deterministik dari isinya dan BUKAN dari waktunya.
   *
   * Kunci yang bergantung waktu membuat setiap percobaan ulang menjadi
   * pengiriman baru, dan sumber daya ganda di sistem nasional tidak dapat
   * dihapus dari sini.
   */
  idempotency_key VARCHAR(255) NOT NULL,

  status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,

  -- Pengenal yang diberikan sistem nasional, bila pengirimannya berhasil.
  remote_resource_id VARCHAR(120),
  last_error_code VARCHAR(64),
  last_error_message TEXT,

  first_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  succeeded_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT satusehat_txn_status_valid CHECK (
    status IN ('PENDING', 'SUCCESS', 'FAILED', 'REJECTED')
  ),
  CONSTRAINT satusehat_txn_attempts_sane CHECK (
    attempt_count >= 0 AND max_attempts >= 1 AND attempt_count <= max_attempts + 1
  ),
  -- Yang berhasil wajib membawa pengenal dari sisi sana. Tanpa itu, "berhasil"
  -- hanya berarti "tidak ada galat" — dan keduanya berbeda.
  CONSTRAINT satusehat_txn_success_has_id CHECK (
    status <> 'SUCCESS' OR (remote_resource_id IS NOT NULL AND succeeded_at IS NOT NULL)
  ),
  CONSTRAINT satusehat_txn_failure_explained CHECK (
    status NOT IN ('FAILED', 'REJECTED') OR last_error_message IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_satusehat_txn_idem
  ON "{{TENANT_SCHEMA}}".satusehat_transaction (facility_id, idempotency_key);
CREATE INDEX IF NOT EXISTS ix_satusehat_txn_pending
  ON "{{TENANT_SCHEMA}}".satusehat_transaction (facility_id, resource_type)
  WHERE status <> 'SUCCESS';

-- Jejaknya tidak dapat dihapus: ia satu-satunya catatan tentang apa yang pernah
-- dikirimkan atas nama fasilitas ini.
DROP TRIGGER IF EXISTS trg_satusehat_txn_no_delete ON "{{TENANT_SCHEMA}}".satusehat_transaction;
CREATE TRIGGER trg_satusehat_txn_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".satusehat_transaction
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".satusehat_attempt (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".satusehat_transaction (id) ON DELETE RESTRICT,

  attempt_number  INTEGER NOT NULL,
  outcome         VARCHAR(16) NOT NULL,
  http_status     INTEGER,
  error_code      VARCHAR(64),
  error_message   TEXT,
  duration_ms     INTEGER,
  attempted_by    UUID,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT satusehat_attempt_outcome_valid CHECK (
    outcome IN ('SUCCESS', 'FAILED', 'REJECTED', 'BLOCKED')
  ),
  CONSTRAINT satusehat_attempt_number_positive CHECK (attempt_number >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_satusehat_attempt
  ON "{{TENANT_SCHEMA}}".satusehat_attempt (transaction_id, attempt_number);

DROP TRIGGER IF EXISTS trg_satusehat_attempt_no_delete ON "{{TENANT_SCHEMA}}".satusehat_attempt;
CREATE TRIGGER trg_satusehat_attempt_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".satusehat_attempt
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK ADA
-- ---------------------------------------------------------------------------
/*
 * Tidak ada tabel payload. Tidak ada kolom yang menampung badan permintaan
 * FHIR. Tidak ada kolom yang menyimpan token, kata sandi, atau kunci.
 *
 * Ketiganya dipertimbangkan dan ketiganya ditolak dengan alasan yang sama:
 * bentuk payload FHIR harus datang dari dokumentasi resmi berversi, dan
 * menyediakan tempat menyimpannya sebelum bentuknya diketahui akan mengundang
 * orang pertama yang membutuhkannya untuk mengarangnya.
 *
 * Payload yang dikarang akan diterima sandbox, ditolak produksi, dan di antara
 * keduanya seseorang akan menyimpulkan bahwa integrasinya berfungsi.
 */

-- ---------------------------------------------------------------------------
-- Menyemai matriks kemampuan bagi setiap fasilitas
-- ---------------------------------------------------------------------------
-- Seluruhnya BLOCKED, beserta penghalangnya. Ini bukan nilai bawaan yang
-- menunggu diisi: ia keadaan yang sesungguhnya hari ini.
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".seed_satusehat_capability(f_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO "{{TENANT_SCHEMA}}".satusehat_capability (facility_id, resource_type, status, blocker)
  SELECT f_id, v.rt, 'BLOCKED', v.blocker
    FROM (VALUES
      ('Organization', 'Kredensial dan ID organisasi resmi.'),
      ('Location', 'Bergantung Organization.'),
      ('Practitioner', 'Kredensial; NIK tenaga kesehatan.'),
      ('PractitionerRole', 'Bergantung Practitioner.'),
      ('Patient', 'Kredensial; aturan pencocokan NIK.'),
      ('Encounter', 'Bergantung Patient dan Location.'),
      ('Condition', 'Terminologi ICD-10 berversi.'),
      ('Procedure', 'Terminologi ICD-9-CM berversi.'),
      ('Observation', 'Terminologi LOINC.'),
      ('ServiceRequest', 'Bergantung Encounter.'),
      ('Specimen', 'Bergantung ServiceRequest.'),
      ('DiagnosticReport', 'Bergantung Observation.'),
      ('ImagingStudy', 'Bergantung PACS; arsitekturnya belum diputuskan Core.'),
      ('Medication', 'KFA - katalog obat nasional belum dapat diimpor.'),
      ('MedicationRequest', 'Bergantung Medication.'),
      ('MedicationDispense', 'Bergantung Medication.'),
      ('MedicationAdministration', 'Bergantung Medication.'),
      ('AllergyIntolerance', 'Terminologi alergen.'),
      ('CarePlan', 'Belum ada model asuhan berencana di sisi kami.'),
      ('Claim', 'Bergantung kemampuan BPJS; lihat H-9B.')
    ) AS v(rt, blocker)
   WHERE NOT EXISTS (
     SELECT 1 FROM "{{TENANT_SCHEMA}}".satusehat_capability c
      WHERE c.facility_id = f_id AND c.resource_type = v.rt
   );
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN SELECT id FROM "{{TENANT_SCHEMA}}".health_facility LOOP
    PERFORM "{{TENANT_SCHEMA}}".seed_satusehat_capability(f.id);
  END LOOP;
END $$;

/*
 * Fasilitas yang lahir kemudian pun disemai — pelajaran H041, tempat
 * penyemaian yang hanya menjangkau fasilitas yang ada pada saat migrasinya
 * dijalankan membuat penjaga basis datanya diam bagi setiap fasilitas baru.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".seed_satusehat_on_facility()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM "{{TENANT_SCHEMA}}".seed_satusehat_capability(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_satusehat_capability ON "{{TENANT_SCHEMA}}".health_facility;
CREATE TRIGGER trg_seed_satusehat_capability
  AFTER INSERT ON "{{TENANT_SCHEMA}}".health_facility
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".seed_satusehat_on_facility();

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['satusehat_environment', 'satusehat_capability',
                           'satusehat_resource_mapping', 'satusehat_transaction',
                           'satusehat_attempt'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
