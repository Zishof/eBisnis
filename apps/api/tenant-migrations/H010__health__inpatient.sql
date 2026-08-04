-- =========================================================================
-- H010 — RAWAT INAP, ADT, TEMPAT TIDUR, DAN KEPERAWATAN
-- =========================================================================
--
-- Fase H-6. Aditif seluruhnya.
--
-- Satu invarian berdiri di atas segalanya: **satu tempat tidur, satu pasien.**
--
-- Ia terdengar sepele sampai seseorang menempatkan pasien kedua di tempat tidur
-- yang menurut sistem kosong — lalu obat, hasil laboratorium, dan tanda vital
-- milik dua orang bercampur di bawah satu nomor kamar. Karena itu invarian ini
-- ditegakkan INDEKS UNIK PARSIAL di sini, bukan hanya oleh layanan: aturan yang
-- hanya ada di satu lapisan berhenti berlaku begitu ada jalan kedua menuju
-- tabelnya, dan pada tabel penempatan selalu ada jalan kedua.
--
-- Yang kedua: **tempat tidur yang baru ditinggalkan bukan tempat tidur yang
-- kosong.** Ia kotor sampai ada yang membersihkannya dan menyatakannya bersih.
-- Menempatkan pasien baru di sana adalah cara paling langsung memindahkan
-- infeksi dari pasien yang sudah pulang kepada pasien yang baru masuk — dan
-- yang kedua tidak akan pernah tahu dari mana ia mendapatkannya.

-- ---------------------------------------------------------------------------
-- Kamar dan tempat tidur — MEMPERLUAS yang sudah ada, bukan membuat ulang
-- ---------------------------------------------------------------------------
--
-- H001 sudah membuat `health_room` dan `health_bed`, dan komentarnya sendiri
-- menyebut bahwa penetapan pasien menyusul pada H-6. Yang ditambahkan di sini
-- hanyalah yang belum ada.
--
-- Nama kolom mengikuti yang sudah terpasang, bukan sebaliknya: `bed_status`,
-- bukan `status`; `care_class`, bukan `class_code`. Mengganti nama kolom yang
-- sudah applied berarti mengubah migrasi yang sudah berjalan, dan itu dilarang
-- tegas oleh perintah eMedik §4.
ALTER TABLE "{{TENANT_SCHEMA}}".health_room
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1,
  /*
   * Kemampuan isolasi kamar, bukan kebutuhan pasien. Kamar yang tidak mampu
   * menampung isolasi yang dibutuhkan tidak boleh dipakai — sekalipun kosong,
   * dan sekalipun seluruh rumah sakit sedang penuh.
   */
  ADD COLUMN IF NOT EXISTS isolation_capability VARCHAR(24)[] NOT NULL
    DEFAULT ARRAY['NONE']::VARCHAR(24)[],
  -- Jenis kelamin yang sedang menempati. Diperbarui layanan pada setiap
  -- penempatan dan pengosongan; kamar kosong bernilai NULL.
  ADD COLUMN IF NOT EXISTS current_sex VARCHAR(8);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'health_room_capacity_positive'
       AND conrelid = '{{TENANT_SCHEMA}}.health_room'::regclass
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".health_room
      ADD CONSTRAINT health_room_capacity_positive CHECK (capacity >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'health_room_sex_valid'
       AND conrelid = '{{TENANT_SCHEMA}}.health_room'::regclass
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".health_room
      ADD CONSTRAINT health_room_sex_valid
      CHECK (current_sex IS NULL OR current_sex IN ('MALE', 'FEMALE'));
  END IF;
END $$;

ALTER TABLE "{{TENANT_SCHEMA}}".health_bed
  -- Diisi layanan saat penempatan, dikosongkan saat pengosongan. BUKAN sumber
  -- kebenaran — `health_bed_assignment` yang menjadi sumbernya — melainkan
  -- salinan agar daftar tempat tidur dapat dibaca tanpa menggabung tabel.
  ADD COLUMN IF NOT EXISTS current_admission_id UUID,
  ADD COLUMN IF NOT EXISTS last_cleaned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_cleaned_by UUID,
  ADD COLUMN IF NOT EXISTS care_class VARCHAR(32);

CREATE INDEX IF NOT EXISTS ix_health_bed_room_status
  ON "{{TENANT_SCHEMA}}".health_bed (room_id, bed_status);

-- ---------------------------------------------------------------------------
-- Perawatan inap
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_admission (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number  VARCHAR(64) NOT NULL,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  facility_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  encounter_id      UUID REFERENCES "{{TENANT_SCHEMA}}".health_encounter (id) ON DELETE RESTRICT,
  service_unit_id   UUID REFERENCES "{{TENANT_SCHEMA}}".health_service_unit (id) ON DELETE RESTRICT,

  admitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  admitted_by       UUID,
  attending_provider_id UUID REFERENCES "{{TENANT_SCHEMA}}".health_provider (id) ON DELETE RESTRICT,
  admission_reason  TEXT,
  -- Kebutuhan isolasi pasien. Menentukan kamar mana yang boleh dipakai.
  isolation_type    VARCHAR(24) NOT NULL DEFAULT 'NONE',
  class_code        VARCHAR(32),

  status            VARCHAR(24) NOT NULL DEFAULT 'ADMITTED',
  discharged_at     TIMESTAMPTZ,
  discharged_by     UUID,
  disposition       VARCHAR(32),
  discharge_reason  TEXT,
  death_at          TIMESTAMPTZ,
  length_of_stay    INTEGER,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT health_admission_status_valid CHECK (
    status IN ('PENDING', 'ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED',
               'DISCHARGED', 'DECEASED', 'CANCELLED')
  ),
  CONSTRAINT health_admission_isolation_valid CHECK (
    isolation_type IN ('NONE', 'CONTACT', 'DROPLET', 'AIRBORNE', 'PROTECTIVE')
  ),
  CONSTRAINT health_admission_disposition_valid CHECK (
    disposition IS NULL OR disposition IN (
      'ROUTINE', 'TRANSFER_OUT', 'AGAINST_MEDICAL_ADVICE', 'ABSCONDED', 'DECEASED'
    )
  ),
  -- Kematian wajib menyebut waktunya. Tanpa itu, laporan mortalitas tidak dapat
  -- membedakan yang meninggal di rumah sakit dari yang meninggal dalam
  -- perjalanan pulang.
  CONSTRAINT health_admission_death_complete CHECK (
    disposition <> 'DECEASED' OR death_at IS NOT NULL
  ),
  -- Pulang paksa dan pasien menghilang wajib berketerangan, supaya kelak dapat
  -- dibedakan dari pasien yang pulang karena sudah sembuh.
  CONSTRAINT health_admission_ama_needs_reason CHECK (
    disposition IS NULL
    OR disposition NOT IN ('AGAINST_MEDICAL_ADVICE', 'ABSCONDED')
    OR (discharge_reason IS NOT NULL AND length(trim(discharge_reason)) >= 5)
  ),
  CONSTRAINT health_admission_discharge_complete CHECK (
    discharged_at IS NULL OR disposition IS NOT NULL
  ),
  CONSTRAINT health_admission_discharge_after_admit CHECK (
    discharged_at IS NULL OR discharged_at >= admitted_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_admission_number
  ON "{{TENANT_SCHEMA}}".health_admission (admission_number);
CREATE INDEX IF NOT EXISTS ix_health_admission_patient
  ON "{{TENANT_SCHEMA}}".health_admission (patient_id, admitted_at DESC);
CREATE INDEX IF NOT EXISTS ix_health_admission_active
  ON "{{TENANT_SCHEMA}}".health_admission (facility_id, status)
  WHERE status IN ('ADMITTED', 'DISCHARGE_PLANNED');

/*
 * SATU PASIEN, SATU PERAWATAN INAP AKTIF.
 *
 * Pasien yang tercatat dirawat di dua tempat sekaligus akan memperoleh dua
 * jadwal obat, dua daftar pemeriksaan, dan dua tagihan — dan tidak ada satu
 * pun bagian sistem yang dapat memutuskan mana yang benar.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_admission_one_active
  ON "{{TENANT_SCHEMA}}".health_admission (patient_id)
  WHERE status IN ('ADMITTED', 'DISCHARGE_PLANNED');

-- ---------------------------------------------------------------------------
-- Penempatan tempat tidur
-- ---------------------------------------------------------------------------
-- Riwayat, bukan keadaan sekarang. Satu perawatan dapat berpindah beberapa
-- kali, dan setiap perpindahan meninggalkan barisnya sendiri — dengan yang lama
-- ditutup dan yang baru dibuka pada saat yang sama.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_bed_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,
  bed_id          UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_bed (id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by     UUID,
  released_at     TIMESTAMPTZ,
  released_by     UUID,
  release_reason  VARCHAR(32),
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT health_bed_assignment_ordered CHECK (
    released_at IS NULL OR released_at >= assigned_at
  ),
  CONSTRAINT health_bed_assignment_release_valid CHECK (
    release_reason IS NULL OR release_reason IN ('TRANSFER', 'DISCHARGE', 'DEATH', 'CORRECTION')
  )
);

/*
 * SATU TEMPAT TIDUR, SATU PASIEN.
 *
 * Indeks unik parsial: hanya satu penempatan yang belum dilepas boleh ada per
 * tempat tidur. Ditegakkan basis data, bukan hanya layanan, karena aturan yang
 * hanya ada di satu lapisan berhenti berlaku begitu ada jalan kedua menuju
 * tabelnya — dan pada tabel penempatan selalu ada jalan kedua.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_bed_one_patient
  ON "{{TENANT_SCHEMA}}".health_bed_assignment (bed_id)
  WHERE released_at IS NULL;

/* Dan sebaliknya: satu perawatan tidak menempati dua tempat tidur sekaligus. */
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_bed_one_admission
  ON "{{TENANT_SCHEMA}}".health_bed_assignment (admission_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_health_bed_assignment_admission
  ON "{{TENANT_SCHEMA}}".health_bed_assignment (admission_id, assigned_at);

-- ---------------------------------------------------------------------------
-- Pengamatan keperawatan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_nursing_observation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  observed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  observed_by       UUID,

  respiratory_rate  NUMERIC(5,1),
  spo2              NUMERIC(5,1),
  systolic_bp       NUMERIC(5,1),
  diastolic_bp      NUMERIC(5,1),
  heart_rate        NUMERIC(5,1),
  temperature       NUMERIC(4,1),
  consciousness     VARCHAR(16),
  pain_score        INTEGER,

  -- Skor peringatan dini dan jarak pengamatan berikutnya, dihitung peladen dan
  -- DISIMPAN. Menghitungnya ulang saat dibaca akan mengubah riwayat ketika
  -- rumusnya kelak disesuaikan.
  early_warning_score INTEGER,
  risk_level        VARCHAR(16),
  next_due_at       TIMESTAMPTZ,
  -- Tanda vital yang tidak diukur dicatat sebagai tidak diukur, BUKAN dianggap
  -- normal. Menganggapnya normal menghasilkan skor rendah pada pasien yang
  -- justru belum diperiksa.
  missing_vitals    VARCHAR(32)[],

  note              TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT nursing_consciousness_valid CHECK (
    consciousness IS NULL OR consciousness IN ('ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE')
  ),
  CONSTRAINT nursing_pain_range CHECK (pain_score IS NULL OR (pain_score >= 0 AND pain_score <= 10)),
  CONSTRAINT nursing_risk_valid CHECK (
    risk_level IS NULL OR risk_level IN ('LOW', 'MEDIUM', 'HIGH')
  )
);

CREATE INDEX IF NOT EXISTS ix_nursing_obs_admission
  ON "{{TENANT_SCHEMA}}".health_nursing_observation (admission_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS ix_nursing_obs_due
  ON "{{TENANT_SCHEMA}}".health_nursing_observation (next_due_at)
  WHERE next_due_at IS NOT NULL;

-- Pengamatan tidak dapat diubah maupun dihapus. Ia catatan keadaan pasien pada
-- satu saat; mengubahnya berarti mengubah kenyataan yang menjadi dasar
-- keputusan berikutnya.
DROP TRIGGER IF EXISTS trg_nursing_obs_immutable ON "{{TENANT_SCHEMA}}".health_nursing_observation;
CREATE TRIGGER trg_nursing_obs_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".health_nursing_observation
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Ringkasan pulang
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_discharge_summary (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_admission (id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  admission_diagnosis TEXT,
  discharge_diagnosis TEXT NOT NULL,
  hospital_course   TEXT,
  procedures        TEXT,
  discharge_medications TEXT,
  follow_up_plan    TEXT,
  diet              TEXT,
  activity          TEXT,
  -- Tanda-tanda yang menuntut pasien kembali. Bagian yang paling sering
  -- dilewati dan paling sering dibutuhkan.
  warning_signs     TEXT,

  written_by        UUID NOT NULL,
  written_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_by         UUID,
  signed_at         TIMESTAMPTZ,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT discharge_summary_diagnosis_meaningful CHECK (
    length(trim(discharge_diagnosis)) >= 3
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_discharge_summary_admission
  ON "{{TENANT_SCHEMA}}".health_discharge_summary (admission_id);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_admission',
                           'health_bed_assignment', 'health_nursing_observation',
                           'health_discharge_summary'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
