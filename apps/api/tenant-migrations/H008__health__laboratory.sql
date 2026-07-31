-- =========================================================================
-- H008 — LABORATORIUM, RADIOLOGI, SPESIMEN, DAN HASIL
-- =========================================================================
--
-- Fase H-5. Aditif seluruhnya.
--
-- Satu keyakinan menentukan bentuk seluruh berkas ini: **hasil pemeriksaan yang
-- tidak dibaca sama saja dengan pemeriksaan yang tidak pernah dilakukan.**
--
-- Kalium 7,2 yang tersimpan rapi, terverifikasi, dan tidak dibaca siapa pun
-- sampai keesokan paginya bukan kegagalan laboratorium — ia kegagalan
-- penyampaian, dan bagi pasiennya tidak ada bedanya. Karena itu nilai kritis di
-- sini bukan penanda warna pada layar: ia punya tabelnya sendiri, penerimanya
-- yang dapat disebut namanya, bacaan ulangnya, tenggatnya, dan eskalasinya.
--
-- PACS/DICOM sengaja TIDAK ada di sini. Menyimpan berkas citra utuh di dalam
-- basis data relasional akan membengkakkan cadangan sampai tidak dapat
-- dipulihkan pada saat dibutuhkan. Yang disimpan hanya rujukan; arsitektur
-- penyimpanannya menunggu keputusan Core.

-- ---------------------------------------------------------------------------
-- Katalog pemeriksaan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".lab_test_catalog (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  code              VARCHAR(48) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  short_name        VARCHAR(64),
  -- LAB atau RAD. Dipisahkan sebagai kolom, bukan tabel, karena alurnya sama:
  -- dipesan, dikerjakan, dihasilkan, diverifikasi, dilepas. Yang berbeda hanya
  -- ada tidaknya spesimen.
  department        VARCHAR(16) NOT NULL DEFAULT 'LAB',
  category          VARCHAR(64),
  loinc_code        VARCHAR(24),
  result_type       VARCHAR(16) NOT NULL DEFAULT 'NUMERIC',
  unit              VARCHAR(24),

  specimen_type     VARCHAR(48),
  container_type    VARCHAR(48),
  min_volume_ml     NUMERIC(8,2),
  -- Batas waktu antara pengambilan dan penerimaan. Spesimen yang terlalu lama
  -- di jalan tidak lagi menggambarkan keadaan pasien saat diambil.
  max_transport_minutes INTEGER,

  -- Menit. Dipakai daftar kerja untuk menandai yang lewat tenggat.
  turnaround_minutes INTEGER,

  /*
   * Verifikasi otomatis mempercepat, dan pada laboratorium bervolume besar ia
   * satu-satunya cara mengejar. Penandaan ini per pemeriksaan, bukan menyeluruh
   * — dan aturan layanan tetap menolaknya untuk nilai kritis.
   */
  allow_auto_verify BOOLEAN NOT NULL DEFAULT FALSE,
  -- Persen. Selisih dari hasil sebelumnya yang menuntut analis melihat lagi.
  delta_check_percent NUMERIC(6,2),

  requires_fasting  BOOLEAN NOT NULL DEFAULT FALSE,
  requires_consent  BOOLEAN NOT NULL DEFAULT FALSE,
  price             NUMERIC(19,4) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT lab_dept_valid CHECK (department IN ('LAB', 'RAD', 'PATH', 'OTHER')),
  CONSTRAINT lab_result_type_valid CHECK (result_type IN ('NUMERIC', 'TEXT', 'CODED')),
  -- Pemeriksaan radiologi tidak punya spesimen; laboratorium harus punya.
  CONSTRAINT lab_specimen_required CHECK (
    department <> 'LAB' OR specimen_type IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_test_code
  ON "{{TENANT_SCHEMA}}".lab_test_catalog (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_lab_test_dept
  ON "{{TENANT_SCHEMA}}".lab_test_catalog (department, is_active);

-- ---------------------------------------------------------------------------
-- Rentang rujukan
-- ---------------------------------------------------------------------------
-- Bergantung umur DAN jenis kelamin. Hemoglobin 11 g/dL wajar pada anak dan
-- menunjukkan anemia pada laki-laki dewasa; membandingkan seluruh pasien
-- terhadap satu rentang menghasilkan dua kekeliruan sekaligus — menandai yang
-- sehat dan melewatkan yang sakit.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".lab_reference_range (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_test_catalog (id) ON DELETE CASCADE,
  -- Tahun. Pecahan diperbolehkan supaya bayi dapat dinyatakan.
  min_age_years   NUMERIC(6,3),
  max_age_years   NUMERIC(6,3),
  sex             VARCHAR(8),
  low_value       NUMERIC(14,4),
  high_value      NUMERIC(14,4),
  -- Di luar batas ini, hasilnya kritis dan menuntut penyampaian lisan.
  critical_low    NUMERIC(14,4),
  critical_high   NUMERIC(14,4),
  unit            VARCHAR(24) NOT NULL,
  note            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT lab_range_sex_valid CHECK (sex IS NULL OR sex IN ('MALE', 'FEMALE')),
  CONSTRAINT lab_range_ordered CHECK (
    low_value IS NULL OR high_value IS NULL OR low_value <= high_value
  ),
  CONSTRAINT lab_range_age_ordered CHECK (
    min_age_years IS NULL OR max_age_years IS NULL OR min_age_years < max_age_years
  ),
  -- Batas kritis harus berada DI LUAR rentang normal. Batas kritis yang berada
  -- di dalamnya akan menandai hasil normal sebagai kritis, dan penandaan kritis
  -- yang sering keliru adalah penandaan yang akan diabaikan.
  CONSTRAINT lab_critical_outside_normal CHECK (
    (critical_low IS NULL OR low_value IS NULL OR critical_low <= low_value)
    AND (critical_high IS NULL OR high_value IS NULL OR critical_high >= high_value)
  )
);

CREATE INDEX IF NOT EXISTS ix_lab_range_test
  ON "{{TENANT_SCHEMA}}".lab_reference_range (test_id, is_active);

-- ---------------------------------------------------------------------------
-- Pesanan pemeriksaan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".lab_order (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number      VARCHAR(64) NOT NULL,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  encounter_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  department        VARCHAR(16) NOT NULL DEFAULT 'LAB',
  priority          VARCHAR(16) NOT NULL DEFAULT 'ROUTINE',
  ordered_by        UUID,
  ordered_by_provider_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  ordered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Keterangan klinis. Bukan basa-basi: laboratorium yang tahu dugaan dokter
  -- akan menafsirkan hasil yang tidak biasa dengan lebih tepat, dan radiologi
  -- yang tahu apa yang dicari akan melihat tempat yang benar.
  clinical_info     TEXT,
  status            VARCHAR(24) NOT NULL DEFAULT 'ORDERED',
  cancelled_at      TIMESTAMPTZ,
  cancelled_by      UUID,
  cancel_reason     TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT lab_order_priority_valid CHECK (priority IN ('STAT', 'URGENT', 'ROUTINE')),
  CONSTRAINT lab_order_status_valid CHECK (
    status IN ('ORDERED', 'COLLECTED', 'RECEIVED', 'IN_PROCESS', 'PARTIAL',
               'COMPLETED', 'CANCELLED', 'REJECTED')
  ),
  CONSTRAINT lab_order_cancel_needs_reason CHECK (
    cancelled_at IS NULL OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) >= 5)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_order_number
  ON "{{TENANT_SCHEMA}}".lab_order (order_number);
CREATE INDEX IF NOT EXISTS ix_lab_order_patient
  ON "{{TENANT_SCHEMA}}".lab_order (patient_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS ix_lab_order_worklist
  ON "{{TENANT_SCHEMA}}".lab_order (facility_id, department, status, priority, ordered_at)
  WHERE status IN ('ORDERED', 'COLLECTED', 'RECEIVED', 'IN_PROCESS', 'PARTIAL');

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".lab_order_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_order (id) ON DELETE CASCADE,
  test_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_test_catalog (id) ON DELETE RESTRICT,
  line_no         INTEGER NOT NULL,
  status          VARCHAR(24) NOT NULL DEFAULT 'ORDERED',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT lab_item_status_valid CHECK (
    status IN ('ORDERED', 'IN_PROCESS', 'RESULTED', 'VERIFIED', 'RELEASED', 'CANCELLED', 'REJECTED')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_item_line
  ON "{{TENANT_SCHEMA}}".lab_order_item (order_id, line_no);

-- ---------------------------------------------------------------------------
-- Spesimen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".lab_specimen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_order (id) ON DELETE RESTRICT,
  specimen_number VARCHAR(64) NOT NULL,
  specimen_type   VARCHAR(48) NOT NULL,
  container_type  VARCHAR(48),
  volume_ml       NUMERIC(8,2),

  collected_at    TIMESTAMPTZ,
  collected_by    UUID,
  received_at     TIMESTAMPTZ,
  received_by     UUID,

  status          VARCHAR(24) NOT NULL DEFAULT 'ORDERED',
  reject_reason   VARCHAR(32),
  reject_note     TEXT,
  rejected_at     TIMESTAMPTZ,
  rejected_by     UUID,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT lab_specimen_status_valid CHECK (
    status IN ('ORDERED', 'COLLECTED', 'RECEIVED', 'REJECTED', 'IN_PROCESS', 'COMPLETED')
  ),
  /*
   * Sebab penolakan dibatasi daftar tertutup, bukan teks bebas.
   *
   * Teks bebas membuat "hemolisis", "hemolysed", dan "darah pecah" menjadi tiga
   * hal berbeda bagi laporan mutu — dan laporan yang tidak dapat menghitung
   * sebab penolakan tidak dapat memperbaikinya.
   */
  CONSTRAINT lab_specimen_reject_reason_valid CHECK (
    reject_reason IS NULL OR reject_reason IN (
      'UNLABELLED', 'MISLABELLED', 'HEMOLYSED', 'CLOTTED', 'INSUFFICIENT_VOLUME',
      'WRONG_CONTAINER', 'CONTAMINATED', 'EXPIRED_TUBE', 'DELAYED_TRANSPORT', 'LEAKED'
    )
  ),
  CONSTRAINT lab_specimen_rejected_complete CHECK (
    status <> 'REJECTED' OR (reject_reason IS NOT NULL AND rejected_at IS NOT NULL)
  ),
  -- Spesimen yang diterima wajib menyebut kapan dan oleh siapa. Penerimaan yang
  -- tidak dapat ditelusuri membuat penelusuran spesimen tertukar mustahil.
  CONSTRAINT lab_specimen_received_complete CHECK (
    received_at IS NULL OR received_by IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_specimen_number
  ON "{{TENANT_SCHEMA}}".lab_specimen (specimen_number);
CREATE INDEX IF NOT EXISTS ix_lab_specimen_order
  ON "{{TENANT_SCHEMA}}".lab_specimen (order_id);

-- ---------------------------------------------------------------------------
-- Hasil
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".lab_result (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_order (id) ON DELETE RESTRICT,
  order_item_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_order_item (id) ON DELETE RESTRICT,
  specimen_id     UUID REFERENCES "{{TENANT_SCHEMA}}".lab_specimen (id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  test_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_test_catalog (id) ON DELETE RESTRICT,

  value_numeric   NUMERIC(18,6),
  value_text      TEXT,
  unit            VARCHAR(24),
  -- Rentang yang benar-benar dipakai, disalin saat hasil dibuat. Bukan rujukan
  -- ke barisnya: rentang rujukan berubah ketika alat diganti, dan hasil tahun
  -- lalu harus tetap dapat dijelaskan dengan rentang tahun lalu.
  range_low       NUMERIC(14,4),
  range_high      NUMERIC(14,4),
  flag            VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  is_critical     BOOLEAN NOT NULL DEFAULT FALSE,
  delta_percent   NUMERIC(10,2),

  method          VARCHAR(120),
  instrument      VARCHAR(120),
  -- Rujukan citra, BUKAN citranya. Menyimpan DICOM utuh di sini akan
  -- membengkakkan cadangan sampai tidak dapat dipulihkan saat dibutuhkan.
  image_reference VARCHAR(512),
  impression      TEXT,

  entered_by      UUID,
  entered_at      TIMESTAMPTZ,
  verified_by     UUID,
  verified_at     TIMESTAMPTZ,
  auto_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  released_at     TIMESTAMPTZ,

  status          VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT lab_result_status_valid CHECK (
    status IN ('PENDING', 'RESULTED', 'VERIFIED', 'RELEASED', 'AMENDED', 'CANCELLED')
  ),
  CONSTRAINT lab_result_flag_valid CHECK (
    flag IN ('NORMAL', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH', 'ABNORMAL', 'UNKNOWN')
  ),
  /*
   * Verifikator tidak boleh sama dengan yang memasukkan hasil.
   *
   * Alasannya sama seperti telaah apoteker: orang yang mengetik angkanya adalah
   * orang yang paling sulit melihat kekeliruannya. Verifikasi otomatis
   * dikecualikan — di sana yang memasukkan adalah alat, bukan orang.
   */
  CONSTRAINT lab_result_verify_not_self CHECK (
    auto_verified = TRUE OR verified_by IS NULL OR entered_by IS NULL OR verified_by <> entered_by
  ),
  CONSTRAINT lab_result_verified_complete CHECK (
    verified_at IS NULL OR verified_by IS NOT NULL OR auto_verified = TRUE
  ),
  -- Hasil tidak dapat dilepas sebelum diverifikasi.
  CONSTRAINT lab_result_release_needs_verify CHECK (
    released_at IS NULL OR verified_at IS NOT NULL
  ),
  -- Hasil wajib bernilai: angka atau teks. Hasil kosong yang berstatus selesai
  -- akan terbaca sebagai "sudah diperiksa, tidak ada apa-apa".
  CONSTRAINT lab_result_has_value CHECK (
    status IN ('PENDING', 'CANCELLED') OR value_numeric IS NOT NULL OR value_text IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_result_item
  ON "{{TENANT_SCHEMA}}".lab_result (order_item_id);
CREATE INDEX IF NOT EXISTS ix_lab_result_patient
  ON "{{TENANT_SCHEMA}}".lab_result (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_lab_result_critical
  ON "{{TENANT_SCHEMA}}".lab_result (is_critical, released_at)
  WHERE is_critical = TRUE;

-- ---------------------------------------------------------------------------
-- Amandemen hasil
-- ---------------------------------------------------------------------------
-- Diperbaiki, bukan ditimpa. Hasil yang sudah dilepas mungkin sudah dipakai
-- mengambil keputusan — obat sudah diberikan, pasien sudah dipulangkan. Yang
-- salah harus tetap terlihat beserta penggantinya, supaya keputusan yang
-- terlanjur diambil dapat dipahami kelak.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".lab_result_amendment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_result (id) ON DELETE RESTRICT,
  previous_value_numeric NUMERIC(18,6),
  previous_value_text    TEXT,
  previous_flag   VARCHAR(16),
  new_value_numeric      NUMERIC(18,6),
  new_value_text         TEXT,
  new_flag        VARCHAR(16),
  reason          TEXT NOT NULL,
  amended_by      UUID NOT NULL,
  amended_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lab_amendment_reason_meaningful CHECK (length(trim(reason)) >= 10)
);

CREATE INDEX IF NOT EXISTS ix_lab_amendment_result
  ON "{{TENANT_SCHEMA}}".lab_result_amendment (result_id, amended_at DESC);

-- Amandemen tidak dapat diubah maupun dihapus. Ia catatan bahwa hasil pernah
-- berbeda; mengubahnya berarti menghapus jejak kekeliruan yang sudah terjadi.
DROP TRIGGER IF EXISTS trg_lab_amendment_immutable ON "{{TENANT_SCHEMA}}".lab_result_amendment;
CREATE TRIGGER trg_lab_amendment_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".lab_result_amendment
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Penyampaian nilai kritis
-- ---------------------------------------------------------------------------
-- Tabelnya sendiri, bukan kolom pada hasil. Satu nilai kritis dapat disampaikan
-- berkali-kali sebelum ada yang menerimanya, dan setiap percobaan itu berharga
-- ketika kelak ditanya mengapa hasilnya terlambat sampai.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".lab_critical_notification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".lab_result (id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  -- Saat hasilnya diketahui kritis. Tenggat dihitung dari sini, bukan dari
  -- percobaan penyampaian pertama.
  critical_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  notified_at     TIMESTAMPTZ,
  notified_by     UUID,
  notify_channel  VARCHAR(24),
  notified_to     VARCHAR(180),

  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  /*
   * Bacaan ulang: penerima mengulang angkanya kepada penyampai.
   *
   * Satu-satunya cara mengetahui bahwa yang terdengar sama dengan yang
   * diucapkan. "Sudah saya sampaikan" tanpa ini hanya mencatat bahwa telepon
   * berdering.
   */
  read_back_value VARCHAR(120),

  escalated_at    TIMESTAMPTZ,
  escalated_to    UUID,
  escalation_note TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT lab_crit_channel_valid CHECK (
    notify_channel IS NULL OR notify_channel IN ('PHONE', 'IN_PERSON', 'SECURE_MESSAGE', 'OTHER')
  ),
  -- Penerimaan wajib menyebut penerimanya DAN bacaan ulangnya. Ditegakkan basis
  -- data supaya tidak dapat dilewati lewat jalan lain menuju tabel ini.
  CONSTRAINT lab_crit_ack_complete CHECK (
    acknowledged_at IS NULL
    OR (acknowledged_by IS NOT NULL AND read_back_value IS NOT NULL
        AND length(trim(read_back_value)) > 0)
  ),
  CONSTRAINT lab_crit_notified_complete CHECK (
    notified_at IS NULL OR notified_by IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_lab_crit_pending
  ON "{{TENANT_SCHEMA}}".lab_critical_notification (critical_at)
  WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_lab_crit_result
  ON "{{TENANT_SCHEMA}}".lab_critical_notification (result_id);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lab_test_catalog', 'lab_reference_range', 'lab_order',
                           'lab_order_item', 'lab_specimen', 'lab_result',
                           'lab_result_amendment', 'lab_critical_notification'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
