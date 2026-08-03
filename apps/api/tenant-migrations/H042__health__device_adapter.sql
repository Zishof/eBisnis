-- =========================================================================
-- H042 — ADAPTER PROTOKOL ALAT: PESAN MASUK DAN PEMETAAN ISTILAH
-- =========================================================================
--
-- Fase H-9I. Aditif seluruhnya.
--
-- Satu aturan menentukan seluruh berkas ini: **pesan aslinya disimpan apa
-- adanya, dan yang disimpan itu tidak pernah berubah.**
--
-- Ketika hasil laboratorium dipersengketakan, yang ditanyakan bukan angka yang
-- tersimpan pada rekam medis, melainkan: *apakah yang tersimpan sama dengan
-- yang dikirim alat?* Pertanyaan itu hanya dapat dijawab bila pesan aslinya
-- masih ada, utuh, dan tidak dapat disunting siapa pun — termasuk oleh orang
-- yang paling ingin jawabannya berbeda.
--
-- Empat hal ditegakkan basis data.
--
-- 1. **Pesan masuk tidak dapat diubah maupun dihapus.** Bukan hanya ledger
--    biasa: kolom isinya sendiri dikunci trigger.
--
-- 2. **Pesan yang GAGAL DIURAI tetap disimpan.** Ini yang paling mudah
--    dilupakan. Pesan cacat yang dibuang menghilangkan satu-satunya petunjuk
--    tentang alat yang firmware-nya baru diperbarui — dan alat itu akan terus
--    mengirim pesan cacat sampai ada yang melihatnya.
--
-- 3. **Kode yang belum terpeta masuk antrean, bukan ditebak.** Menebaknya akan
--    benar hampir selalu dan salah sekali, dan yang sekali itu menaruh kadar
--    kalium pada baris natrium.
--
-- 4. **Pemetaan yang aktif tidak bertumpang tindih.** Satu kode alat pada satu
--    alat memetakan tepat satu kode lokal.

-- ---------------------------------------------------------------------------
-- Pesan masuk
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_inbound_message (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  device_id       UUID REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,
  gateway_id      UUID REFERENCES "{{TENANT_SCHEMA}}".device_gateway (id) ON DELETE RESTRICT,

  source_protocol VARCHAR(24) NOT NULL,

  /*
   * PESAN ASLI, APA ADANYA.
   *
   * Bukan hasil uraiannya, bukan bentuk rapinya. Yang ditanyakan ketika
   * hasilnya dipersengketakan adalah apa yang DIKIRIM ALAT — bukan apa yang
   * berhasil dipahami pengurai kami.
   */
  raw_message     TEXT NOT NULL,
  raw_message_hash VARCHAR(128) NOT NULL,

  message_control_id VARCHAR(120),
  message_type    VARCHAR(24),

  parse_status    VARCHAR(16) NOT NULL,
  parse_findings  JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Hasil pembacaan, bila berhasil. Boleh kosong: pesan yang gagal diurai tetap
  -- disimpan.
  order_identifier VARCHAR(120),
  patient_identifier VARCHAR(120),
  device_identifier VARCHAR(120),
  observation_count INTEGER NOT NULL DEFAULT 0,

  ack_code        VARCHAR(4),
  ack_message     TEXT,

  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT device_msg_protocol_valid CHECK (
    source_protocol IN ('HL7V2', 'ASTM', 'IHE_PCD', 'IEEE_11073', 'TCP_SERIAL', 'SFTP',
                        'MANUAL_ENTRY')
  ),
  CONSTRAINT device_msg_parse_status_valid CHECK (
    parse_status IN ('PARSED', 'FAILED', 'REJECTED')
  ),
  /*
   * PESAN YANG GAGAL DIURAI WAJIB MENYEBUTKAN SEBABNYA.
   *
   * Tanpa temuannya, "gagal" adalah kata yang tidak dapat ditindaklanjuti
   * siapa pun — dan teknisi yang menerimanya akan menyalahkan jaringan.
   */
  CONSTRAINT device_msg_failure_explained CHECK (
    parse_status = 'PARSED' OR jsonb_array_length(parse_findings) >= 1
  ),
  CONSTRAINT device_msg_raw_not_empty CHECK (length(trim(raw_message)) >= 1),
  CONSTRAINT device_msg_ack_valid CHECK (ack_code IS NULL OR ack_code IN ('AA', 'AE', 'AR')),
  CONSTRAINT device_msg_count_nonneg CHECK (observation_count >= 0)
);

/*
 * SIDIK JARI UNIK PER ALAT.
 *
 * Alat yang menyimpan hasil selama jaringan terputus akan mengirim ulang
 * seluruh simpanannya begitu tersambung. Indeks ini yang menghentikannya —
 * bukan jendela waktu, yang akan membuang hasil kedua yang sah dan meloloskan
 * kiriman ulang yang datang terlambat.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_device_msg_hash
  ON "{{TENANT_SCHEMA}}".device_inbound_message (device_id, raw_message_hash)
  WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_device_msg_failed
  ON "{{TENANT_SCHEMA}}".device_inbound_message (facility_id, received_at DESC)
  WHERE parse_status <> 'PARSED';

/*
 * PESAN ASLI TIDAK DAPAT DIUBAH MAUPUN DIHAPUS.
 *
 * Perhatikan bahwa yang dikunci bukan seluruh barisnya: `processed_at` masih
 * boleh berubah, sebab pemrosesannya memang terjadi kemudian. Yang dikunci
 * adalah isinya — pesan aslinya, sidik jarinya, dan protokolnya.
 */
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_inbound_message_tamper()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'INBOUND_MESSAGE_IMMUTABLE: pesan masuk dari alat tidak dapat dihapus. Ketika hasilnya '
      'dipersengketakan, pesan aslinya adalah satu-satunya yang dapat menjawab apakah yang '
      'tersimpan sama dengan yang dikirim alat.'
      USING ERRCODE = 'raise_exception';
  END IF;

  IF NEW.raw_message IS DISTINCT FROM OLD.raw_message
     OR NEW.raw_message_hash IS DISTINCT FROM OLD.raw_message_hash
     OR NEW.source_protocol IS DISTINCT FROM OLD.source_protocol
     OR NEW.received_at IS DISTINCT FROM OLD.received_at
  THEN
    RAISE EXCEPTION
      'INBOUND_MESSAGE_IMMUTABLE: isi pesan masuk tidak dapat diubah. Yang boleh berubah '
      'hanyalah penanda pemrosesannya.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_msg_immutable ON "{{TENANT_SCHEMA}}".device_inbound_message;
CREATE TRIGGER trg_device_msg_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".device_inbound_message
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_inbound_message_tamper();

-- Menautkan hasil alat kepada pesan yang melahirkannya.
ALTER TABLE "{{TENANT_SCHEMA}}".device_observation
  ADD COLUMN IF NOT EXISTS inbound_message_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".device_inbound_message (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS device_code_raw VARCHAR(64),
  ADD COLUMN IF NOT EXISTS code_mapped BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unit_mismatch BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Pemetaan istilah alat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_code_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  device_id       UUID REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,

  device_code     VARCHAR(64) NOT NULL,
  local_code      VARCHAR(64) NOT NULL,
  device_unit     VARCHAR(32),
  local_unit      VARCHAR(32),

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  mapped_by       UUID,
  mapped_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  note            TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT device_map_code_not_empty CHECK (
    length(trim(device_code)) >= 1 AND length(trim(local_code)) >= 1
  ),
  -- Pemetaan wajib bernama pemetanya. Pemetaan yang tidak dapat ditanyakan
  -- kembali adalah pemetaan yang akan dipercaya selamanya.
  CONSTRAINT device_map_named CHECK (is_active = FALSE OR mapped_by IS NOT NULL)
);

/*
 * SATU KODE ALAT MEMETAKAN TEPAT SATU KODE LOKAL.
 *
 * Indeks parsial: hanya yang aktif. Pemetaan lama tetap tersimpan sebagai
 * riwayat — pertanyaan "kode ini dulu dipetakan ke mana" muncul persis ketika
 * ada hasil lama yang dipersengketakan.
 *
 * COALESCE pada device_id: pemetaan tingkat fasilitas (device_id NULL) dan
 * pemetaan tingkat alat harus sama-sama unik. Tanpa COALESCE, dua pemetaan
 * tingkat fasilitas yang bertumpang tindih lolos, sebab NULL <> NULL.
 * Pelajaran H-9D.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_device_map_active
  ON "{{TENANT_SCHEMA}}".device_code_map
     (facility_id, COALESCE(device_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(device_code))
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS ix_device_map_facility
  ON "{{TENANT_SCHEMA}}".device_code_map (facility_id, is_active);

-- ---------------------------------------------------------------------------
-- Antrean kode yang belum terpeta
-- ---------------------------------------------------------------------------
-- Terpisah dari pemetaannya: yang ini adalah pertanyaan yang belum terjawab,
-- dan menyimpannya pada tabel yang sama sebagai baris "kosong" akan membuatnya
-- terbaca sebagai pemetaan yang memetakan ke ketiadaan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".device_code_pending (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  device_id       UUID REFERENCES "{{TENANT_SCHEMA}}".medical_device (id) ON DELETE RESTRICT,

  device_code     VARCHAR(64) NOT NULL,
  device_unit     VARCHAR(32),
  sample_value    VARCHAR(255),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  resolved_map_id UUID REFERENCES "{{TENANT_SCHEMA}}".device_code_map (id) ON DELETE RESTRICT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT device_pending_count_positive CHECK (occurrence_count >= 1),
  CONSTRAINT device_pending_resolved_complete CHECK (
    resolved_at IS NULL OR (resolved_by IS NOT NULL AND resolved_map_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_device_pending_code
  ON "{{TENANT_SCHEMA}}".device_code_pending
     (facility_id, COALESCE(device_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(device_code))
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_device_pending_queue
  ON "{{TENANT_SCHEMA}}".device_code_pending (facility_id, occurrence_count DESC)
  WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['device_inbound_message', 'device_code_map', 'device_code_pending'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
