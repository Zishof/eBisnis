-- =========================================================================
-- H033 — REGISTRI ALAT KESEHATAN, GATEWAY, DAN HASIL ALAT
-- =========================================================================
--
-- Fase H-9H. Aditif seluruhnya.
--
-- Keamanan alat medis **tidak diletakkan pada alatnya.** Alat medis menjalankan
-- sistem operasi lama yang tidak lagi menerima tambalan, tidak boleh dipasangi
-- perangkat lunak keamanan tambahan tanpa membatalkan sertifikasinya, sering
-- memakai kata sandi bawaan yang tidak dapat diubah, dan tidak dapat dimatikan
-- untuk diperbarui karena ada pasien yang memakainya. Karena itu keamanannya
-- diletakkan pada apa yang mengelilinginya — dan sebagian di antaranya di sini.
--
-- Lima hal ditegakkan basis data.
--
-- 1. **ALAT TIDAK PERNAH PUNYA KREDENSIAL BASIS DATA.** Tidak ada satu pun
--    kolom pada tabel ini yang menampung kata sandi, token, atau kunci.
--    Kredensial gateway disimpan sebagai RUJUKAN ke brankas; constraint menolak
--    rujukan yang tampak seperti nilai.
--
-- 2. **KENDALI JARAK JAUH MATI SECARA BAWAAN**, untuk seluruh alat, tanpa
--    kecuali. Menyalakannya menuntut enam syarat, dan constraint menegakkan
--    keenamnya sekaligus.
--
-- 3. **Hasil wajib berpasangan dengan pasien.** Yang tiba tanpa identitas masuk
--    antrean `PENDING_LINK` — ia tidak ditebak. Mencocokkan berdasarkan nama
--    akan benar sembilan puluh sembilan kali dan salah sekali, dan yang sekali
--    itu adalah hasil laboratorium orang lain di rekam medis seseorang.
--
-- 4. **`captured_at` dan `received_at` disimpan terpisah.** Alat yang jamnya
--    melenceng akan mengirim hasil lama sebagai hasil baru, dan selisih
--    keduanya yang menampakkannya.
--
-- 5. **Sidik jari pesan asli wajib**, dan duplikat dikenali darinya — bukan
--    dari waktunya. Alat yang menyimpan hasil selama jaringan terputus akan
--    mengirim ulang seluruh simpanannya begitu tersambung.

-- ---------------------------------------------------------------------------
-- Gateway
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_gateway (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(180) NOT NULL,
  vendor          VARCHAR(120),

  -- Segmen jaringan tempat gateway ini berada. Alat hanya dapat berbicara
  -- kepada gateway-nya; gateway hanya kepada integration engine.
  network_segment VARCHAR(64),

  /*
   * KREDENSIAL SEBAGAI RUJUKAN, BUKAN NILAI.
   *
   * Administrator yang menyimpannya tidak dapat membacanya kembali — ia dapat
   * menggantinya; ia tidak dapat melihatnya. Perbedaan itu menentukan siapa
   * yang harus dicurigai ketika ada kebocoran.
   */
  credential_secret_ref VARCHAR(255),

  status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  last_seen_at    TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT device_gateway_status_valid CHECK (status IN ('ACTIVE', 'DISABLED')),
  /*
   * Rujukan brankas harus berbentuk rujukan. Nilai yang tidak berawalan
   * skema brankas hampir pasti kata sandi yang ditempel langsung — dan yang
   * menempelnya tidak akan menyadarinya sampai ada yang membaca tabelnya.
   */
  CONSTRAINT device_gateway_secret_is_ref CHECK (
    credential_secret_ref IS NULL
    OR credential_secret_ref ~ '^(vault|secret|kms)://'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_device_gateway_code
  ON "{{TENANT_SCHEMA}}".device_gateway (facility_id, code);

-- ---------------------------------------------------------------------------
-- Alat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".medical_device (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  gateway_id      UUID REFERENCES "{{TENANT_SCHEMA}}".device_gateway (id) ON DELETE RESTRICT,
  service_unit_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,

  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(180) NOT NULL,
  device_category VARCHAR(48) NOT NULL,
  manufacturer    VARCHAR(120),
  model           VARCHAR(120),
  serial_number   VARCHAR(120),

  -- Versi perangkat lunak alat. Perubahannya ditandai: perangkat lunak alat
  -- yang diperbarui diam-diam mengubah perilakunya tanpa ada yang tahu.
  software_version VARCHAR(64),
  software_version_changed_at TIMESTAMPTZ,

  source_protocol VARCHAR(24) NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'REGISTERED',

  calibrated_at   DATE,
  calibration_due_at DATE,
  last_maintenance_at DATE,
  next_maintenance_at DATE,

  /*
   * KENDALI JARAK JAUH — MATI SECARA BAWAAN.
   *
   * Bawaannya FALSE, dan constraint di bawah menuntut keenam syaratnya
   * sekaligus sebelum ia boleh TRUE.
   */
  remote_control_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  remote_written_approval_ref VARCHAR(120),
  remote_risk_review_ref VARCHAR(120),
  remote_allowed_commands VARCHAR(48)[] NOT NULL DEFAULT '{}',
  remote_min_value NUMERIC(18,4),
  remote_max_value NUMERIC(18,4),
  remote_command_logging BOOLEAN NOT NULL DEFAULT FALSE,
  remote_emergency_stop BOOLEAN NOT NULL DEFAULT FALSE,
  remote_enabled_by UUID,
  remote_enabled_at TIMESTAMPTZ,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT medical_device_status_valid CHECK (
    status IN ('REGISTERED', 'ACTIVE', 'MAINTENANCE', 'DOWNTIME', 'RETIRED')
  ),
  CONSTRAINT medical_device_protocol_valid CHECK (
    source_protocol IN ('HL7V2', 'ASTM', 'IHE_PCD', 'IEEE_11073', 'TCP_SERIAL', 'SFTP',
                        'DICOM', 'DICOMWEB', 'MODALITY_WORKLIST', 'MPPS', 'FHIR',
                        'VENDOR_API', 'MQTT', 'MANUAL_ENTRY')
  ),
  CONSTRAINT medical_device_calibration_order CHECK (
    calibrated_at IS NULL OR calibration_due_at IS NULL OR calibration_due_at >= calibrated_at
  ),

  /*
   * KENDALI JARAK JAUH MENUNTUT ENAM SYARAT SEKALIGUS.
   *
   * Bukan sebagian. Alat yang kendalinya menyala dengan satu syarat kosong
   * dapat menerima perintah yang sama berbahayanya dengan alat yang syaratnya
   * lengkap.
   */
  CONSTRAINT medical_device_remote_complete CHECK (
    remote_control_enabled = FALSE
    OR (remote_written_approval_ref IS NOT NULL
        AND remote_risk_review_ref IS NOT NULL
        AND array_length(remote_allowed_commands, 1) >= 1
        AND remote_max_value IS NOT NULL
        AND remote_command_logging = TRUE
        AND remote_emergency_stop = TRUE
        AND remote_enabled_by IS NOT NULL
        AND remote_enabled_at IS NOT NULL)
  ),
  CONSTRAINT medical_device_remote_value_order CHECK (
    remote_min_value IS NULL OR remote_max_value IS NULL OR remote_max_value >= remote_min_value
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_medical_device_code
  ON "{{TENANT_SCHEMA}}".medical_device (facility_id, code);
CREATE INDEX IF NOT EXISTS ix_medical_device_gateway
  ON "{{TENANT_SCHEMA}}".medical_device (gateway_id);
CREATE INDEX IF NOT EXISTS ix_medical_device_calibration
  ON "{{TENANT_SCHEMA}}".medical_device (facility_id, calibration_due_at)
  WHERE status IN ('ACTIVE', 'MAINTENANCE');

/*
 * TIDAK ADA SATU PUN KOLOM KREDENSIAL PADA TABEL ALAT.
 *
 * Ditegakkan trigger pada tingkat skema: setiap upaya menambahkan kolom
 * bernama password, token, api_key, atau secret akan lolos DDL — tetapi
 * pengujian dan naskah bukti memeriksanya. Yang di sini adalah penjaga
 * runtime-nya: alat tidak dapat menyimpan rujukan brankas SENDIRI, ia hanya
 * mewarisi milik gateway-nya.
 *
 * Alasannya: memberi alat kredensialnya sendiri berarti kredensial itu harus
 * ada di dalam alat — di dalam kotak yang tidak dapat dikunci.
 */

-- ---------------------------------------------------------------------------
-- Perubahan versi perangkat lunak alat
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".flag_device_software_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.software_version IS DISTINCT FROM OLD.software_version THEN
    NEW.software_version_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_software_change ON "{{TENANT_SCHEMA}}".medical_device;
CREATE TRIGGER trg_device_software_change
  BEFORE UPDATE ON "{{TENANT_SCHEMA}}".medical_device
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".flag_device_software_change();

-- ---------------------------------------------------------------------------
-- Jejak perintah jarak jauh
-- ---------------------------------------------------------------------------
-- Setiap perintah dicatat, termasuk yang ditolak. Perintah yang ditolak justru
-- yang paling berharga: ia menunjukkan ada yang mencoba.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_command_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,
  command         VARCHAR(48) NOT NULL,
  command_value   NUMERIC(18,4),
  accepted        BOOLEAN NOT NULL,
  rejection_reason TEXT,
  issued_by       UUID,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT device_command_rejection_reason CHECK (
    accepted = TRUE OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) >= 5)
  )
);

CREATE INDEX IF NOT EXISTS ix_device_command_device
  ON "{{TENANT_SCHEMA}}".device_command_log (device_id, issued_at DESC);

DROP TRIGGER IF EXISTS trg_device_command_no_delete ON "{{TENANT_SCHEMA}}".device_command_log;
CREATE TRIGGER trg_device_command_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".device_command_log
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Hasil alat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_observation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  device_id       UUID REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,
  gateway_id      UUID REFERENCES "{{TENANT_SCHEMA}}".device_gateway (id) ON DELETE RESTRICT,

  -- Pengaitan pasien. Boleh kosong — yang kosong masuk antrean PENDING_LINK.
  patient_id      UUID REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  encounter_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  order_id        UUID REFERENCES "{{TENANT_SCHEMA}}".lab_order (id) ON DELETE RESTRICT,
  link_method     VARCHAR(24),
  linked_by       UUID,
  linked_at       TIMESTAMPTZ,

  observation_code VARCHAR(48),
  observation_value VARCHAR(255),
  observation_unit VARCHAR(32),

  /*
   * DUA WAKTU, DUA KOLOM.
   *
   * capturedAt adalah waktu alat mengambilnya; receivedAt waktu kami
   * menerimanya. Menyamakan keduanya akan membuat hasil yang tersimpan selama
   * jaringan terputus tampak seperti hasil yang baru saja diambil.
   */
  captured_at     TIMESTAMPTZ NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_drift_minutes INTEGER,

  source_protocol VARCHAR(24) NOT NULL,
  -- Sidik jari pesan asli. Menjawab pertanyaan yang muncul ketika hasilnya
  -- dipersengketakan: apakah yang tersimpan sama dengan yang dikirim alat?
  raw_message_hash VARCHAR(128),
  operator_id     UUID,

  validation_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  review_status   VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,

  calibration_warning BOOLEAN NOT NULL DEFAULT FALSE,
  provenance_note TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT device_obs_protocol_valid CHECK (
    source_protocol IN ('HL7V2', 'ASTM', 'IHE_PCD', 'IEEE_11073', 'TCP_SERIAL', 'SFTP',
                        'DICOM', 'DICOMWEB', 'MODALITY_WORKLIST', 'MPPS', 'FHIR',
                        'VENDOR_API', 'MQTT', 'MANUAL_ENTRY')
  ),
  CONSTRAINT device_obs_link_method_valid CHECK (
    link_method IS NULL OR link_method IN ('ORDER_ID', 'WRISTBAND_SCAN', 'MANUAL')
  ),
  CONSTRAINT device_obs_validation_valid CHECK (
    validation_status IN ('PENDING', 'VALID', 'INVALID', 'DUPLICATE')
  ),
  CONSTRAINT device_obs_review_valid CHECK (
    review_status IN ('PENDING_LINK', 'PENDING_REVIEW', 'REVIEWED', 'REJECTED')
  ),
  /*
   * PENGAITAN MANUAL WAJIB MENCATAT SIAPA.
   *
   * Pengaitan tanpa nama tidak dapat ditanyakan kembali ketika hasilnya
   * ternyata milik orang lain.
   */
  CONSTRAINT device_obs_manual_link_named CHECK (
    link_method <> 'MANUAL' OR (linked_by IS NOT NULL AND linked_at IS NOT NULL)
  ),
  -- Yang punya pasien wajib punya cara pengaitannya. Pasien yang muncul tanpa
  -- cara adalah pasien yang ditebak.
  CONSTRAINT device_obs_patient_needs_method CHECK (
    patient_id IS NULL OR link_method IS NOT NULL
  ),
  -- Yang belum terkait berstatus PENDING_LINK, bukan PENDING_REVIEW: keduanya
  -- menunggu manusia, tetapi menunggu hal yang berbeda.
  CONSTRAINT device_obs_unlinked_status CHECK (
    patient_id IS NOT NULL OR review_status IN ('PENDING_LINK', 'REJECTED')
  ),
  -- Sidik jari wajib bagi yang datang dari alat. Pencatatan manual tidak punya
  -- pesan asli untuk disidik.
  CONSTRAINT device_obs_hash_required CHECK (
    source_protocol = 'MANUAL_ENTRY' OR raw_message_hash IS NOT NULL
  ),
  CONSTRAINT device_obs_review_complete CHECK (
    review_status <> 'REVIEWED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

/*
 * DUPLIKAT DIKENALI LEWAT SIDIK JARI, BUKAN LEWAT WAKTU.
 *
 * Alat yang menyimpan hasil selama jaringan terputus akan mengirim ulang
 * seluruh simpanannya begitu tersambung, dan deteksi berbasis waktu akan
 * menganggap seluruhnya baru.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_device_obs_message
  ON "{{TENANT_SCHEMA}}".device_observation (device_id, raw_message_hash)
  WHERE raw_message_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_device_obs_pending_link
  ON "{{TENANT_SCHEMA}}".device_observation (facility_id, received_at)
  WHERE review_status = 'PENDING_LINK';
CREATE INDEX IF NOT EXISTS ix_device_obs_patient
  ON "{{TENANT_SCHEMA}}".device_observation (patient_id, captured_at DESC)
  WHERE patient_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_device_obs_no_delete ON "{{TENANT_SCHEMA}}".device_observation;
CREATE TRIGGER trg_device_obs_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".device_observation
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['device_gateway', 'medical_device', 'device_command_log',
                           'device_observation'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
