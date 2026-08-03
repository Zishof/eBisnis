-- =========================================================================
-- H003 — PERSETUJUAN, WALI, JANJI TEMU, PENDAFTARAN, DAN ANTREAN
-- =========================================================================
--
-- Fase H-2. Aditif seluruhnya.
--
-- Di sinilah `BillablePatientRegistration` menjadi nyata: `health_registration`
-- adalah satu-satunya tabel yang menghasilkan tagihan langganan eMedik, dan
-- kolom-kolom pengecualiannya ada pada barisnya sendiri — bukan disimpulkan
-- kemudian dari gabungan beberapa tabel. Tagihan yang harus disimpulkan adalah
-- tagihan yang akan salah.

-- ---------------------------------------------------------------------------
-- Persetujuan pasien
-- ---------------------------------------------------------------------------
-- Per tujuan, dan dapat dicabut. Persetujuan menyeluruh yang diminta sekali
-- seumur hidup bukan persetujuan — ia hanya tanda tangan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_consent (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  consent_type    VARCHAR(32) NOT NULL,
  scope_facility_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE CASCADE,
  granted         BOOLEAN NOT NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,
  -- Siapa yang menyatakan. Pasien sendiri, atau wali yang berhak mewakilinya.
  granted_by_patient BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by_proxy_id UUID,
  evidence_file_id UUID,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID,
  revoke_reason   TEXT,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT patient_consent_type_valid CHECK (
    consent_type IN ('TREATMENT', 'DATA_SHARING_INTERNAL', 'DATA_SHARING_EXTERNAL',
                     'RESEARCH', 'MARKETING', 'PROXY_ACCESS', 'TELEMEDICINE')
  )
);

CREATE INDEX IF NOT EXISTS ix_patient_consent_active
  ON "{{TENANT_SCHEMA}}".patient_consent (patient_id, consent_type)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Wali dan hubungan keluarga
-- ---------------------------------------------------------------------------
-- Akses wali adalah HUBUNGAN yang tercatat dan dapat dicabut, bukan penyamaan
-- identitas. Orang tua yang membuka rekam medis anaknya tetap dirinya sendiri
-- pada jejak akses — bukan menjadi anaknya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_proxy (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  -- Wali boleh berupa pasien lain (ibu atas anaknya) atau pengguna sistem.
  proxy_patient_id  UUID REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  proxy_user_id     UUID,
  proxy_name        VARCHAR(180) NOT NULL,
  relationship      VARCHAR(32) NOT NULL,
  -- Apa yang boleh dilihat wali. Wali anak berhak melihat seluruhnya; wali
  -- yang ditunjuk untuk satu keperluan tidak.
  access_level      VARCHAR(24) NOT NULL DEFAULT 'FULL',
  valid_from        DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until       DATE,
  revoked_at        TIMESTAMPTZ,
  revoked_by        UUID,
  revoke_reason     TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT patient_proxy_relationship_valid CHECK (
    relationship IN ('PARENT', 'CHILD', 'SPOUSE', 'SIBLING', 'GUARDIAN',
                     'CAREGIVER', 'LEGAL_REPRESENTATIVE', 'OTHER')
  ),
  CONSTRAINT patient_proxy_access_valid CHECK (
    access_level IN ('FULL', 'SUMMARY_ONLY', 'APPOINTMENT_ONLY')
  ),
  CONSTRAINT patient_proxy_not_self CHECK (proxy_patient_id IS NULL OR proxy_patient_id <> patient_id),
  -- Wali harus dapat dikenali: pasien lain, pengguna sistem, atau keduanya.
  CONSTRAINT patient_proxy_identified CHECK (
    proxy_patient_id IS NOT NULL OR proxy_user_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_patient_proxy_patient
  ON "{{TENANT_SCHEMA}}".patient_proxy (patient_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_patient_proxy_proxy
  ON "{{TENANT_SCHEMA}}".patient_proxy (proxy_patient_id)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Jadwal dan ketersediaan pemberi layanan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE CASCADE,
  service_unit_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE CASCADE,
  provider_id       UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE CASCADE,
  -- 0=Minggu … 6=Sabtu, mengikuti EXTRACT(DOW).
  day_of_week       SMALLINT NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  slot_minutes      SMALLINT NOT NULL DEFAULT 15,
  -- Berapa pasien per slot. Poliklinik ramai sering melayani lebih dari satu.
  capacity_per_slot SMALLINT NOT NULL DEFAULT 1,
  valid_from        DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until       DATE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_schedule_dow_valid CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT health_schedule_time_valid CHECK (end_time > start_time),
  CONSTRAINT health_schedule_slot_positive CHECK (slot_minutes > 0),
  CONSTRAINT health_schedule_capacity_positive CHECK (capacity_per_slot > 0)
);

CREATE INDEX IF NOT EXISTS ix_health_schedule_lookup
  ON "{{TENANT_SCHEMA}}".health_schedule (facility_id, day_of_week)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Pengecualian jadwal: cuti, libur, penambahan sesi.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_schedule_exception (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_schedule (id) ON DELETE CASCADE,
  provider_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE CASCADE,
  facility_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  exception_type VARCHAR(16) NOT NULL,
  start_time    TIME,
  end_time      TIME,
  reason        TEXT,
  is_sample     BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  CONSTRAINT health_schedule_exception_type_valid CHECK (
    exception_type IN ('CLOSED', 'EXTRA', 'MODIFIED')
  )
);

CREATE INDEX IF NOT EXISTS ix_health_schedule_exception_date
  ON "{{TENANT_SCHEMA}}".health_schedule_exception (exception_date);

-- ---------------------------------------------------------------------------
-- Janji temu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_appointment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  service_unit_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,
  provider_id       UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  appointment_number VARCHAR(64),
  scheduled_at      TIMESTAMPTZ NOT NULL,
  scheduled_end_at  TIMESTAMPTZ,
  channel           VARCHAR(24) NOT NULL DEFAULT 'WALK_IN',
  status            VARCHAR(24) NOT NULL DEFAULT 'BOOKED',
  chief_complaint   TEXT,
  note              TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancelled_by      UUID,
  cancel_reason     TEXT,
  -- Tidak hadir dicatat tersendiri, bukan disamakan dengan pembatalan. Pasien
  -- yang membatalkan memberi tahu; yang tidak hadir tidak — dan keduanya
  -- menuntut tindak lanjut yang berbeda.
  no_show_at        TIMESTAMPTZ,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_appointment_channel_valid CHECK (
    channel IN ('WALK_IN', 'ONLINE', 'PHONE', 'REFERRAL', 'FOLLOW_UP')
  ),
  CONSTRAINT health_appointment_status_valid CHECK (
    status IN ('BOOKED', 'CONFIRMED', 'ARRIVED', 'IN_SERVICE', 'COMPLETED',
               'CANCELLED', 'NO_SHOW', 'RESCHEDULED')
  ),
  CONSTRAINT health_appointment_end_after_start CHECK (
    scheduled_end_at IS NULL OR scheduled_end_at > scheduled_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_appointment_number
  ON "{{TENANT_SCHEMA}}".health_appointment (appointment_number)
  WHERE appointment_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_health_appointment_schedule
  ON "{{TENANT_SCHEMA}}".health_appointment (facility_id, scheduled_at);
CREATE INDEX IF NOT EXISTS ix_health_appointment_patient
  ON "{{TENANT_SCHEMA}}".health_appointment (patient_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS ix_health_appointment_provider
  ON "{{TENANT_SCHEMA}}".health_appointment (provider_id, scheduled_at)
  WHERE provider_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Pendaftaran
-- ---------------------------------------------------------------------------
-- **Satu-satunya tabel yang menghasilkan tagihan langganan eMedik.**
--
-- Kelima pengecualian pada spesifikasi §4 disimpan sebagai kolom pada barisnya
-- sendiri, bukan disimpulkan kemudian dari gabungan beberapa tabel. Alasannya
-- praktis: tagihan yang harus disimpulkan adalah tagihan yang akan salah begitu
-- salah satu tabel sumbernya berubah bentuk, dan yang menanggung kekeliruannya
-- adalah penyewa.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_registration (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  service_unit_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,
  provider_id       UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  appointment_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_appointment (id) ON DELETE SET NULL,

  registration_number VARCHAR(64) NOT NULL,
  -- Tanggal usaha menurut zona waktu FASILITAS, bukan zona waktu peladen.
  -- Penagihan harian dihitung menurut kolom ini; memakai waktu peladen akan
  -- memindahkan pendaftaran malam ke hari berikutnya bagi fasilitas di zona
  -- waktu yang berbeda.
  business_date     DATE NOT NULL,
  registered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  visit_type        VARCHAR(24) NOT NULL DEFAULT 'OUTPATIENT',
  channel           VARCHAR(24) NOT NULL DEFAULT 'WALK_IN',
  payer_type        VARCHAR(24) NOT NULL DEFAULT 'SELF_PAY',
  status            VARCHAR(24) NOT NULL DEFAULT 'REGISTERED',

  -- --- Penentu tagihan -----------------------------------------------------
  -- Benar berarti TIDAK tertagih.
  is_test_patient           BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_before_service  BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by_correction  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Dihitung layanan dan disimpan, supaya tagihan yang sudah terbit tidak
  -- berubah surut ketika aturannya kelak disesuaikan. Tagihan bulan lalu harus
  -- tetap dapat dijelaskan dengan aturan bulan lalu.
  is_billable       BOOLEAN NOT NULL DEFAULT TRUE,
  non_billable_reason VARCHAR(32),

  chief_complaint   TEXT,
  note              TEXT,
  served_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancelled_by      UUID,
  cancel_reason     TEXT,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT health_registration_visit_valid CHECK (
    visit_type IN ('OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'HOME_CARE',
                   'TELEMEDICINE', 'OUTREACH', 'POSYANDU')
  ),
  CONSTRAINT health_registration_channel_valid CHECK (
    channel IN ('WALK_IN', 'ONLINE', 'PHONE', 'REFERRAL', 'FOLLOW_UP', 'OUTREACH')
  ),
  CONSTRAINT health_registration_payer_valid CHECK (
    payer_type IN ('SELF_PAY', 'INSURANCE', 'BPJS', 'CORPORATE', 'GOVERNMENT_PROGRAM', 'FREE')
  ),
  CONSTRAINT health_registration_status_valid CHECK (
    status IN ('REGISTERED', 'WAITING', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'NO_SHOW')
  ),
  -- Yang tidak tertagih WAJIB menyebut sebabnya. Tanpa itu, laporan penagihan
  -- tidak dapat menjelaskan selisih antara jumlah pendaftaran dan jumlah yang
  -- ditagih — dan selisih yang tidak dapat dijelaskan akan dipersoalkan.
  CONSTRAINT health_registration_nonbillable_needs_reason CHECK (
    is_billable = TRUE OR non_billable_reason IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_registration_number
  ON "{{TENANT_SCHEMA}}".health_registration (registration_number);

CREATE INDEX IF NOT EXISTS ix_health_registration_billing
  ON "{{TENANT_SCHEMA}}".health_registration (facility_id, business_date)
  WHERE is_billable = TRUE;

CREATE INDEX IF NOT EXISTS ix_health_registration_patient
  ON "{{TENANT_SCHEMA}}".health_registration (patient_id, business_date DESC);

CREATE INDEX IF NOT EXISTS ix_health_registration_active
  ON "{{TENANT_SCHEMA}}".health_registration (facility_id, status, business_date)
  WHERE status IN ('REGISTERED', 'WAITING', 'IN_SERVICE');

-- ---------------------------------------------------------------------------
-- Antrean
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_registration (id) ON DELETE CASCADE,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE CASCADE,
  service_unit_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE CASCADE,
  business_date     DATE NOT NULL,
  -- Awalan per unit: A-001 untuk poli umum, B-001 untuk poli gigi. Pasien
  -- membaca nomornya di layar, dan nomor tanpa awalan tidak memberi tahu
  -- antrean mana yang sedang dipanggil.
  queue_prefix      VARCHAR(8) NOT NULL DEFAULT 'A',
  queue_number      INTEGER NOT NULL,
  queue_label       VARCHAR(24) NOT NULL,
  -- Antrean prioritas: lanjut usia, ibu hamil, disabilitas, gawat.
  priority          SMALLINT NOT NULL DEFAULT 0,
  priority_reason   VARCHAR(48),
  status            VARCHAR(24) NOT NULL DEFAULT 'WAITING',
  called_at         TIMESTAMPTZ,
  called_by         UUID,
  call_count        SMALLINT NOT NULL DEFAULT 0,
  served_at         TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  counter_code      VARCHAR(24),
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_queue_status_valid CHECK (
    status IN ('WAITING', 'CALLED', 'IN_SERVICE', 'SERVED', 'SKIPPED', 'CANCELLED')
  ),
  CONSTRAINT health_queue_number_positive CHECK (queue_number > 0),
  CONSTRAINT health_queue_priority_range CHECK (priority BETWEEN 0 AND 9)
);

-- Nomor antrean tidak kembar pada satu unit, satu hari, satu awalan.
-- Ditegakkan basis data: dua petugas yang mendaftarkan bersamaan akan
-- menghasilkan nomor yang sama bila hanya layanan yang menjaganya.
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_queue_number
  ON "{{TENANT_SCHEMA}}".health_queue
     (facility_id, COALESCE(service_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
      business_date, queue_prefix, queue_number);

CREATE INDEX IF NOT EXISTS ix_health_queue_waiting
  ON "{{TENANT_SCHEMA}}".health_queue
     (facility_id, service_unit_id, business_date, priority DESC, queue_number)
  WHERE status IN ('WAITING', 'CALLED');

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_queue_registration
  ON "{{TENANT_SCHEMA}}".health_queue (registration_id);

-- ---------------------------------------------------------------------------
-- Rujukan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_referral (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  direction         VARCHAR(16) NOT NULL,
  from_facility_id  UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE SET NULL,
  to_facility_id    UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE SET NULL,
  -- Fasilitas luar tidak ada di basis data kita; namanya disimpan apa adanya.
  external_facility_name VARCHAR(180),
  referral_number   VARCHAR(64),
  referral_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until       DATE,
  reason            TEXT NOT NULL,
  diagnosis_text    TEXT,
  status            VARCHAR(24) NOT NULL DEFAULT 'ISSUED',
  registration_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_registration (id) ON DELETE SET NULL,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT health_referral_direction_valid CHECK (direction IN ('OUTGOING', 'INCOMING')),
  CONSTRAINT health_referral_status_valid CHECK (
    status IN ('ISSUED', 'ACCEPTED', 'SERVED', 'REJECTED', 'EXPIRED', 'CANCELLED')
  ),
  -- Rujukan harus punya tujuan yang dapat dikenali, di dalam atau di luar.
  CONSTRAINT health_referral_has_destination CHECK (
    direction = 'INCOMING' OR to_facility_id IS NOT NULL OR external_facility_name IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_health_referral_patient
  ON "{{TENANT_SCHEMA}}".health_referral (patient_id, referral_date DESC);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_consent', 'patient_proxy', 'health_schedule',
                           'health_appointment', 'health_registration', 'health_referral'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;

-- `health_queue` TIDAK diaudit dengan sengaja: barisnya berubah setiap
-- pemanggilan, dan riwayat yang berarti ada pada pendaftarannya. Mengauditnya
-- akan menghasilkan ribuan baris audit per hari yang tidak menjawab satu pun
-- pertanyaan yang benar-benar ditanyakan.
