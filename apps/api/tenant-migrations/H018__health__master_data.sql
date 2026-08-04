-- =========================================================================
-- H018 — KATALOG LAYANAN, PEMETAAN UNIT, DAN SUMBER MASTER DATA
-- =========================================================================
--
-- Fase H-9L. Aditif seluruhnya.
--
-- Tiga hal ditegakkan basis data di sini.
--
-- 1. **Layanan tidak dapat diaktifkan sebelum pemetaannya lengkap.** Satu
--    layanan yang tidak terpetakan tampak tidak berbahaya sampai ia dipesan.
--    Lalu pesanannya tidak sampai ke unit mana pun, tidak ada peran yang
--    berwenang mengerjakannya, tarifnya tidak ditemukan, jasanya tidak
--    terhitung, dan pendapatannya tidak masuk akun mana pun — kelimanya baru
--    ketahuan pada akhir bulan, ketika seseorang bertanya mengapa pendapatan
--    radiologi lebih kecil daripada jumlah pemeriksaan yang dikerjakan.
--
-- 2. **Harga sintetis tidak dapat menyamar sebagai harga resmi.** Baris yang
--    bersumber SYNTHETIC_DEMO tidak boleh menyebut penerbit resmi, dan
--    penandanya tidak dapat dilepas. Bila harga contoh tidak dibedakan dari
--    harga resmi, seseorang akan memakainya menagih pasien — dan ketika
--    ketahuan, tidak ada cara membedakan mana yang contoh dan mana yang
--    sungguhan.
--
-- 3. **Satu kode lokal tidak menunjuk dua kode resmi pada sistem yang sama.**
--    Yang mengirim ke luar akan memilih salah satunya menurut urutan baris, dan
--    urutan baris bukan keputusan klinis.

-- ---------------------------------------------------------------------------
-- Kumpulan data contoh
-- ---------------------------------------------------------------------------
-- Satu baris per kali penyemaian. Tanpa induk yang dapat ditunjuk, data contoh
-- hanya dapat dihapus satu per satu — dan yang menghapus satu per satu akan
-- berhenti di tengah.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".master_data_batch (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(180) NOT NULL,
  source          VARCHAR(24) NOT NULL,
  profile         VARCHAR(24),
  -- Benih pembangkitannya, DISIMPAN. Benih yang sama menghasilkan data yang
  -- sama; tanpa menyimpannya, katalog contoh tidak dapat dibangun ulang persis
  -- dan dua penyewa demo akan melihat isi yang berbeda.
  seed            VARCHAR(64),
  row_count       INTEGER NOT NULL DEFAULT 0,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by    UUID,
  hidden_at       TIMESTAMPTZ,
  hidden_by       UUID,
  hide_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT master_batch_source_valid CHECK (
    source IN ('OFFICIAL_REFERENCE', 'FACILITY_IMPORT', 'SYNTHETIC_DEMO', 'LOCAL_MAPPING')
  ),
  CONSTRAINT master_batch_profile_valid CHECK (
    profile IS NULL OR profile IN ('MINIMAL', 'STANDARD', 'LARGE_HOSPITAL')
  ),
  CONSTRAINT master_batch_hidden_needs_reason CHECK (
    hidden_at IS NULL OR (hidden_by IS NOT NULL AND hide_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_master_data_batch_code
  ON "{{TENANT_SCHEMA}}".master_data_batch (code);

-- ---------------------------------------------------------------------------
-- Katalog layanan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_service (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  service_type    VARCHAR(24) NOT NULL,
  care_setting    VARCHAR(24) NOT NULL,
  description     TEXT,

  -- Sifat yang MENENTUKAN apa yang wajib dipetakan. Bukan pilihan pengguna:
  -- pemeriksaan laboratorium selalu menuntut spesimen, dan menandainya "tidak
  -- berlaku" adalah jalan memutar yang akan selalu diambil ketika tenggat
  -- mendesak.
  uses_inventory  BOOLEAN NOT NULL DEFAULT FALSE,
  has_fee_sharing BOOLEAN NOT NULL DEFAULT FALSE,

  -- Sumber barisnya. Menempel pada barisnya dan tidak dapat dilepas.
  source          VARCHAR(24) NOT NULL DEFAULT 'FACILITY_IMPORT',
  issuer          VARCHAR(24),
  issuer_reference VARCHAR(120),

  -- Aktivasi menuntut pemetaan lengkap. Ditegakkan trigger di bawah.
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at    TIMESTAMPTZ,
  activated_by    UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivate_reason TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID REFERENCES "{{TENANT_SCHEMA}}".master_data_batch (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT health_service_type_valid CHECK (
    service_type IN ('CONSULTATION', 'PROCEDURE', 'LABORATORY', 'RADIOLOGY', 'SURGERY',
                     'ANAESTHESIA', 'MIDWIFERY', 'NURSING', 'EMERGENCY', 'REHABILITATION',
                     'DENTAL', 'NUTRITION', 'DIALYSIS', 'ONCOLOGY', 'ROOM', 'AMBULANCE', 'OTHER')
  ),
  CONSTRAINT health_service_setting_valid CHECK (
    care_setting IN ('OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'OPERATING_THEATRE', 'ICU',
                     'NICU', 'PICU', 'DELIVERY_ROOM', 'LABORATORY', 'RADIOLOGY', 'PHARMACY',
                     'NUTRITION', 'REHABILITATION', 'DENTAL', 'DIALYSIS', 'ONCOLOGY',
                     'HOMECARE', 'PUSKESMAS', 'POSYANDU')
  ),
  CONSTRAINT health_service_source_valid CHECK (
    source IN ('OFFICIAL_REFERENCE', 'FACILITY_IMPORT', 'SYNTHETIC_DEMO', 'LOCAL_MAPPING')
  ),
  /*
   * HARGA DAN KODE SINTETIS TIDAK DAPAT MENGAKU RESMI.
   *
   * Hanya baris bersumber OFFICIAL_REFERENCE yang boleh menyebut penerbit, dan
   * penerbit itu wajib disertai nomor atau tanggal terbitannya — rujukan yang
   * tidak dapat ditelusuri ke terbitannya tidak dapat dibedakan dari karangan.
   */
  CONSTRAINT health_service_issuer_only_official CHECK (
    issuer IS NULL OR source = 'OFFICIAL_REFERENCE'
  ),
  CONSTRAINT health_service_official_traceable CHECK (
    source <> 'OFFICIAL_REFERENCE'
    OR (issuer IS NOT NULL AND issuer_reference IS NOT NULL
        AND length(trim(issuer_reference)) >= 3)
  ),
  CONSTRAINT health_service_sample_has_batch CHECK (
    is_sample = FALSE OR sample_batch_id IS NOT NULL
  ),
  CONSTRAINT health_service_activation_complete CHECK (
    is_active = FALSE OR (activated_at IS NOT NULL AND activated_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_service_code
  ON "{{TENANT_SCHEMA}}".health_service (facility_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_health_service_active
  ON "{{TENANT_SCHEMA}}".health_service (facility_id, service_type)
  WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_health_service_sample
  ON "{{TENANT_SCHEMA}}".health_service (sample_batch_id) WHERE is_sample = TRUE;

-- ---------------------------------------------------------------------------
-- Pemetaan layanan ke unit
-- ---------------------------------------------------------------------------
-- Empat belas slot. Enam di antaranya menunjuk tabel yang belum dibangun —
-- disimpan sebagai UUID tanpa foreign key, dan foreign key-nya dipasang oleh
-- fase yang membangunnya. Menahan seluruh pemetaan sampai keenam tabel itu ada
-- akan menahan pula sembilan slot yang sudah dapat diisi hari ini.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_service_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_service (id) ON DELETE CASCADE,

  -- Sudah ada sejak H-1 sampai H-5.
  department_id   UUID REFERENCES "{{TENANT_SCHEMA}}".department (id) ON DELETE RESTRICT,
  service_unit_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,
  location_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_room (id) ON DELETE RESTRICT,
  performer_role  VARCHAR(64),
  verifier_role   VARCHAR(64),
  specimen_type   VARCHAR(48),
  clinical_order_type VARCHAR(48),
  clinical_form_id UUID,

  -- Menunggu fase berikutnya. Disebutkan namanya supaya yang membacanya tahu
  -- kolomnya memang belum dapat diisi, bukan terlupa.
  equipment_id    UUID,       -- H-9H
  tariff_id       UUID,       -- H-9D
  payer_coverage_id UUID,     -- H-9D
  fee_rule_id     UUID,       -- H-9E
  revenue_account_id UUID,    -- H-9N
  cogs_account_id UUID,       -- H-9N

  -- Hasil pemeriksaan kelengkapan, DISIMPAN. Aturan kelengkapan akan berubah;
  -- pemeriksaan bulan lalu harus tetap dapat dijelaskan dengan aturan bulan lalu.
  missing_count   SMALLINT NOT NULL DEFAULT 0,
  blocking_count  SMALLINT NOT NULL DEFAULT 0,
  checked_at      TIMESTAMPTZ,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID REFERENCES "{{TENANT_SCHEMA}}".master_data_batch (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_service_mapping
  ON "{{TENANT_SCHEMA}}".health_service_mapping (service_id);

-- Satu baris per kekurangan, bukan satu kolom berisi hitungan. Kekurangan yang
-- hanya berupa angka tidak dapat ditugaskan kepada siapa pun — pola yang sama
-- seperti kekurangan berkas rekam medis pada H-9.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_service_mapping_gap (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_service_mapping (id) ON DELETE CASCADE,
  slot            VARCHAR(48) NOT NULL,
  message         TEXT NOT NULL,
  blocks_activation BOOLEAN NOT NULL DEFAULT TRUE,
  -- Fase yang akan membangun tabelnya, bila memang belum ada. Menyamarkannya
  -- sebagai kekurangan biasa akan membuat penggunanya mencari kolom yang tidak
  -- ada, lalu menyimpulkan sistemnya rusak.
  awaiting_phase  VARCHAR(16),
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_service_mapping_gap_open
  ON "{{TENANT_SCHEMA}}".health_service_mapping_gap (mapping_id) WHERE resolved_at IS NULL;

/*
 * LAYANAN TIDAK DAPAT DIAKTIFKAN SEBELUM PEMETAANNYA LENGKAP.
 *
 * Ditegakkan trigger, bukan hanya layanan. Katalog layanan adalah tabel yang
 * paling sering disunting lewat jalan lain — impor massal, perbaikan data,
 * naskah penyemaian — dan aturan yang hanya ada di layanan berhenti berlaku
 * pada setiap jalan itu.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_activation_without_mapping()
RETURNS TRIGGER AS $$
DECLARE
  penahan INTEGER;
  ada     INTEGER;
BEGIN
  IF NEW.is_active = FALSE OR (TG_OP = 'UPDATE' AND OLD.is_active = TRUE) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO ada
    FROM "{{TENANT_SCHEMA}}".health_service_mapping m
   WHERE m.service_id = NEW.id;

  IF ada = 0 THEN
    RAISE EXCEPTION
      'SERVICE_MAPPING_INCOMPLETE: layanan % belum dipetakan sama sekali. Layanan yang '
      'tidak terpetakan tidak sampai ke unit mana pun ketika dipesan.', NEW.code
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO penahan
    FROM "{{TENANT_SCHEMA}}".health_service_mapping m
    JOIN "{{TENANT_SCHEMA}}".health_service_mapping_gap g ON g.mapping_id = m.id
   WHERE m.service_id = NEW.id
     AND g.resolved_at IS NULL
     AND g.blocks_activation = TRUE;

  IF penahan > 0 THEN
    RAISE EXCEPTION
      'SERVICE_MAPPING_INCOMPLETE: layanan % memiliki % bagian pemetaan yang belum terisi '
      'dan menahan aktivasi.', NEW.code, penahan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_activation_needs_mapping ON "{{TENANT_SCHEMA}}".health_service;
CREATE TRIGGER trg_service_activation_needs_mapping
  BEFORE INSERT OR UPDATE ON "{{TENANT_SCHEMA}}".health_service
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_activation_without_mapping();

-- ---------------------------------------------------------------------------
-- Pemetaan kode lokal ke kode resmi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".local_code_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_system    VARCHAR(32) NOT NULL,
  local_code      VARCHAR(64) NOT NULL,
  local_display   VARCHAR(255),
  target_system   VARCHAR(24) NOT NULL,
  target_code     VARCHAR(64) NOT NULL,
  target_display  VARCHAR(255),
  -- Seberapa yakin pemetaannya. Pemetaan yang ditebak tetap berguna asal
  -- ketahuan bahwa ia tebakan; yang berbahaya adalah tebakan yang tercatat
  -- sebagai kepastian.
  confidence      VARCHAR(16) NOT NULL DEFAULT 'EXACT',
  mapped_by       UUID,
  mapped_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Dipensiunkan, bukan dihapus. Rekam lama yang dikirim memakai pemetaan lama
  -- harus tetap dapat dijelaskan.
  retired_at      TIMESTAMPTZ,
  retired_by      UUID,
  retire_reason   TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID REFERENCES "{{TENANT_SCHEMA}}".master_data_batch (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT local_map_target_system_valid CHECK (
    target_system IN ('ICD10', 'ICD9CM', 'LOINC', 'SNOMED', 'KFA', 'BPJS')
  ),
  CONSTRAINT local_map_confidence_valid CHECK (
    confidence IN ('EXACT', 'NARROWER', 'BROADER', 'APPROXIMATE')
  ),
  CONSTRAINT local_map_retire_complete CHECK (
    retired_at IS NULL OR (retired_by IS NOT NULL AND retire_reason IS NOT NULL)
  )
);

/*
 * SATU KODE LOKAL, SATU KODE RESMI PER SISTEM.
 *
 * Indeks unik parsial: hanya pemetaan yang belum dipensiunkan yang dijaga.
 * Yang mengirim ke luar akan memilih salah satunya menurut urutan baris bila
 * ada dua, dan urutan baris bukan keputusan klinis.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_local_code_mapping_active
  ON "{{TENANT_SCHEMA}}".local_code_mapping (local_system, local_code, target_system)
  WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_local_code_mapping_target
  ON "{{TENANT_SCHEMA}}".local_code_mapping (target_system, target_code);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['master_data_batch', 'health_service', 'health_service_mapping',
                           'health_service_mapping_gap', 'local_code_mapping'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
