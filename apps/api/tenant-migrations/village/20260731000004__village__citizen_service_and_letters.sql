-- =========================================================================
-- VILLAGE D-4 — LAYANAN WARGA, SURAT, ANTREAN, DAN ALUR PERSETUJUAN
-- =========================================================================
--
-- Inti sistem. Layanan warga dan surat adalah alasan sebuah desa memakai
-- sistem seperti ini; segala yang lain menambah nilai.
--
-- ## Mengapa BUKAN memakai tabel `surat_*` yang sudah ada
--
-- `surat_outgoing` milik Core adalah korespondensi resmi antar lembaga: ada
-- pengirim, penerima, klasifikasi, dan disposisi. Surat keterangan domisili
-- bukan surat keluar — ia **keluaran layanan**, yang pemohonnya warga dari luar
-- organisasi, punya persyaratan berkas, antrean, dan janji waktu.
--
-- Memaksakan keduanya ke satu tabel menghasilkan tabel yang setengah kolomnya
-- selalu kosong, dan laporan surat kantor yang tercemar ribuan surat keterangan.
--
-- Yang **dipakai ulang** adalah `SuratNumberService`: penomoran yang dijamin
-- tidak kembar bahkan di bawah permintaan bersamaan, sudah dibuktikan pada V10-6.

-- ---------------------------------------------------------------------------
-- Katalog layanan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_service_catalog (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  code              VARCHAR(48) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  category          VARCHAR(48),

  -- Pola nomor surat disimpan sebagai data, bukan ditulis di kode. Setiap desa
  -- punya kebiasaan penomoran sendiri, dan yang di kode berarti setiap desa
  -- memerlukan pemasangan tersendiri.
  letter_code       VARCHAR(24),
  number_pattern    VARCHAR(120) NOT NULL DEFAULT '{urut}/{kode}/{bulanRomawi}/{tahun}',
  number_padding    INTEGER NOT NULL DEFAULT 3,
  template_body     TEXT,

  sla_working_days  INTEGER NOT NULL DEFAULT 3,
  fee_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Versi bertambah setiap kali definisi diubah. Permohonan menyimpan versi
  -- yang berlaku saat ia masuk, sehingga perubahan katalog tidak mengubah
  -- aturan main di tengah jalan.
  definition_version INTEGER NOT NULL DEFAULT 1,
  -- Langkah persetujuan, sebagai data. Bentuknya:
  -- [{ sequence, code, name, roleCode, skippable }]
  approval_steps    JSONB NOT NULL DEFAULT '[]'::jsonb,

  is_online         BOOLEAN NOT NULL DEFAULT TRUE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_service_sla_positive CHECK (sla_working_days > 0),
  CONSTRAINT village_service_fee_nonnegative CHECK (fee_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_service_catalog_code_unique
  ON "{{TENANT_SCHEMA}}".village_service_catalog (village_unit_id, code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Persyaratan berkas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_service_requirement (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_catalog_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_service_catalog (id) ON DELETE CASCADE,
  code               VARCHAR(48) NOT NULL,
  name               VARCHAR(200) NOT NULL,
  description        TEXT,
  is_mandatory       BOOLEAN NOT NULL DEFAULT TRUE,
  accepts_upload     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS village_service_requirement_code_unique
  ON "{{TENANT_SCHEMA}}".village_service_requirement (service_catalog_id, code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Permohonan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_service_request (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  service_catalog_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_service_catalog (id) ON DELETE RESTRICT,
  request_number      VARCHAR(64),

  -- Pemohon: warga terdaftar, atau nama yang dituliskan petugas loket untuk
  -- warga yang belum punya akun.
  village_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  applicant_name      VARCHAR(200) NOT NULL,
  applicant_nik       VARCHAR(24),
  applicant_phone     VARCHAR(40),
  applicant_user_id   UUID,

  purpose             TEXT,
  form_data           JSONB NOT NULL DEFAULT '{}'::jsonb,

  status              VARCHAR(32) NOT NULL DEFAULT 'DRAF',

  -- Cuplikan definisi alur, disimpan pada permohonan. Bila katalog diubah —
  -- persyaratan ditambah, jenjang persetujuan diubah — permohonan yang sudah
  -- berjalan tetap memakai aturan yang berlaku saat ia masuk. Warga yang
  -- mengajukan surat pada hari Senin tidak boleh tiba-tiba dituntut melengkapi
  -- berkas yang baru diwajibkan pada hari Rabu.
  definition_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  definition_version  INTEGER NOT NULL DEFAULT 1,

  submitted_at        TIMESTAMPTZ,
  -- Kapan berkas dinyatakan lengkap. SLA dihitung SEJAK INI, bukan sejak
  -- permohonan masuk: warga yang butuh seminggu melengkapi berkas bukan
  -- kesalahan desa, dan angka yang menyalahkan pihak yang salah tidak akan
  -- dipakai siapa pun untuk memperbaiki apa pun.
  documents_completed_at TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  due_date            DATE,

  workflow_instance_id UUID,
  reject_reason       TEXT,
  return_reason       TEXT,

  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_service_request_status_valid CHECK (status IN (
    'DRAF', 'DIAJUKAN', 'BERKAS_KURANG', 'DIVERIFIKASI', 'MENUNGGU_PERSETUJUAN',
    'DISETUJUI', 'DITOLAK', 'DITERBITKAN', 'DISERAHKAN', 'DIBATALKAN'
  )),
  -- Penolakan wajib beralasan. Warga yang permohonannya ditolak tanpa
  -- keterangan akan datang lagi menanyakan hal yang sama, dan petugas
  -- berikutnya tidak tahu apa yang harus dijawab.
  CONSTRAINT village_service_request_reject_needs_reason
    CHECK (status <> 'DITOLAK' OR reject_reason IS NOT NULL),
  CONSTRAINT village_service_request_return_needs_reason
    CHECK (status <> 'BERKAS_KURANG' OR return_reason IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_service_request_number_unique
  ON "{{TENANT_SCHEMA}}".village_service_request (village_unit_id, request_number)
  WHERE request_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS village_service_request_status_idx
  ON "{{TENANT_SCHEMA}}".village_service_request (village_unit_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS village_service_request_resident_idx
  ON "{{TENANT_SCHEMA}}".village_service_request (village_resident_id);
CREATE INDEX IF NOT EXISTS village_service_request_due_idx
  ON "{{TENANT_SCHEMA}}".village_service_request (due_date)
  WHERE finished_at IS NULL;

-- ---------------------------------------------------------------------------
-- Berkas yang diserahkan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_request_document (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_service_request (id) ON DELETE CASCADE,
  requirement_code   VARCHAR(48) NOT NULL,
  file_object_id     UUID,
  -- Berkas yang diserahkan fisik di loket tidak punya berkas unggahan.
  received_physically BOOLEAN NOT NULL DEFAULT FALSE,
  note               TEXT,
  verified_by        UUID,
  verified_at        TIMESTAMPTZ,
  rejected_reason    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID,
  CONSTRAINT village_request_document_has_evidence
    CHECK (file_object_id IS NOT NULL OR received_physically = TRUE)
);

CREATE INDEX IF NOT EXISTS village_request_document_request_idx
  ON "{{TENANT_SCHEMA}}".village_request_document (service_request_id);

-- ---------------------------------------------------------------------------
-- Riwayat status permohonan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_request_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_service_request (id) ON DELETE CASCADE,
  from_status        VARCHAR(32),
  to_status          VARCHAR(32) NOT NULL,
  reason             TEXT,
  actor_user_id      UUID,
  active_role_id     UUID,
  -- Benar bila perubahan ini terlihat warga pada portal. Catatan internal
  -- petugas tidak perlu — dan tidak seharusnya — dibaca warga.
  visible_to_citizen BOOLEAN NOT NULL DEFAULT TRUE,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS village_request_history_idx
  ON "{{TENANT_SCHEMA}}".village_request_history (service_request_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Alur persetujuan
-- ---------------------------------------------------------------------------
-- Mesin sendiri, bukan memakai `workflow_*` Core: tabel itu ada sejak V007
-- tetapi tidak ada satu baris kode pun yang menjalankannya. Lihat integration
-- request 001. Bentuknya sengaja sederhana dan sesempit kebutuhan D-4.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_workflow_instance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  definition_code   VARCHAR(48) NOT NULL,
  definition_version INTEGER NOT NULL DEFAULT 1,
  subject_type      VARCHAR(48) NOT NULL,
  subject_id        UUID NOT NULL,
  status            VARCHAR(24) NOT NULL DEFAULT 'BERJALAN',
  current_sequence  INTEGER NOT NULL DEFAULT 1,
  initiated_by      UUID,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_workflow_status_valid
    CHECK (status IN ('BERJALAN', 'SELESAI', 'DITOLAK', 'DIKEMBALIKAN', 'DIBATALKAN'))
);

CREATE INDEX IF NOT EXISTS village_workflow_subject_idx
  ON "{{TENANT_SCHEMA}}".village_workflow_instance (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS village_workflow_open_idx
  ON "{{TENANT_SCHEMA}}".village_workflow_instance (village_unit_id, status)
  WHERE status = 'BERJALAN';

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_workflow_step (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_workflow_instance (id) ON DELETE CASCADE,
  sequence       INTEGER NOT NULL,
  code           VARCHAR(48) NOT NULL,
  name           VARCHAR(160) NOT NULL,
  role_code      VARCHAR(48) NOT NULL,
  status         VARCHAR(24) NOT NULL DEFAULT 'MENUNGGU',
  actor_user_id  UUID,
  active_role_id UUID,
  acted_at       TIMESTAMPTZ,
  reason         TEXT,
  delegated_to   UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT village_workflow_step_status_valid
    CHECK (status IN ('MENUNGGU', 'SELESAI', 'DILEWATI', 'DITOLAK')),
  -- Penolakan pada langkah wajib beralasan, sama seperti pada permohonannya.
  CONSTRAINT village_workflow_step_reject_needs_reason
    CHECK (status <> 'DITOLAK' OR reason IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_workflow_step_seq_unique
  ON "{{TENANT_SCHEMA}}".village_workflow_step (instance_id, sequence);

-- ---------------------------------------------------------------------------
-- Penerbitan surat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_letter (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  service_request_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_service_request (id) ON DELETE RESTRICT,
  letter_number      VARCHAR(64) NOT NULL,
  letter_date        DATE NOT NULL,
  subject            VARCHAR(300) NOT NULL,
  body               TEXT,
  signed_by_officer_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE SET NULL,
  signed_position    VARCHAR(160),
  -- Ditandatangani atas nama pejabat lain karena pelimpahan wewenang. Tanpa
  -- pencatatan ini, tidak ada yang dapat menjelaskan mengapa surat itu
  -- ditandatangani orang lain.
  signed_on_behalf_of UUID REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE SET NULL,
  delegation_id      UUID REFERENCES "{{TENANT_SCHEMA}}".village_delegation (id) ON DELETE SET NULL,

  -- Token verifikasi publik. Pihak ketiga memeriksa keaslian surat tanpa masuk
  -- sistem — dan TANPA melihat data pribadi di dalamnya. Halaman verifikasi
  -- hanya menyatakan sah/tidak sah beserta nomor dan tanggalnya.
  verification_token VARCHAR(64) NOT NULL,
  is_revoked         BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at         TIMESTAMPTZ,
  revoked_by         UUID,
  revoke_reason      TEXT,

  print_count        INTEGER NOT NULL DEFAULT 0,
  last_printed_at    TIMESTAMPTZ,
  last_printed_by    UUID,

  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID,
  version            INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_letter_revoke_needs_reason
    CHECK (is_revoked = FALSE OR revoke_reason IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_letter_number_unique
  ON "{{TENANT_SCHEMA}}".village_letter (village_unit_id, letter_number);

CREATE UNIQUE INDEX IF NOT EXISTS village_letter_token_unique
  ON "{{TENANT_SCHEMA}}".village_letter (verification_token);

-- Satu surat per permohonan. Permohonan yang menerbitkan dua surat bernomor
-- berbeda berarti salah satunya tidak dapat dipertanggungjawabkan.
CREATE UNIQUE INDEX IF NOT EXISTS village_letter_request_unique
  ON "{{TENANT_SCHEMA}}".village_letter (service_request_id);

-- ---------------------------------------------------------------------------
-- Antrean loket
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_counter (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  code            VARCHAR(8) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS village_counter_code_unique
  ON "{{TENANT_SCHEMA}}".village_counter (village_unit_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_queue_ticket (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  counter_id         UUID REFERENCES "{{TENANT_SCHEMA}}".village_counter (id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_service_request (id) ON DELETE SET NULL,
  ticket_number      VARCHAR(16) NOT NULL,
  -- Nomor antrean kembali ke satu setiap hari. Yang tidak pernah kembali akan
  -- mencapai angka ribuan pada bulan ketiga, dan warga yang dipanggil
  -- "nomor 3.412" kehilangan gambaran berapa lama lagi gilirannya.
  queue_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  sequence_no        INTEGER NOT NULL,
  status             VARCHAR(24) NOT NULL DEFAULT 'MENUNGGU',
  called_at          TIMESTAMPTZ,
  served_at          TIMESTAMPTZ,
  finished_at        TIMESTAMPTZ,
  served_by          UUID,
  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT village_queue_status_valid
    CHECK (status IN ('MENUNGGU', 'DIPANGGIL', 'DILAYANI', 'SELESAI', 'BATAL'))
);

CREATE UNIQUE INDEX IF NOT EXISTS village_queue_number_unique
  ON "{{TENANT_SCHEMA}}".village_queue_ticket (village_unit_id, queue_date, ticket_number);

CREATE INDEX IF NOT EXISTS village_queue_waiting_idx
  ON "{{TENANT_SCHEMA}}".village_queue_ticket (village_unit_id, queue_date, status, sequence_no);

-- ---------------------------------------------------------------------------
-- Hari libur
-- ---------------------------------------------------------------------------
-- Dipakai menghitung SLA dalam hari kerja. Tanpa daftar ini, janji layanan
-- tiga hari kerja yang jatuh pada libur panjang akan tercatat terlambat
-- padahal kantornya memang tutup.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_holiday (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE CASCADE,
  holiday_date    DATE NOT NULL,
  name            VARCHAR(160) NOT NULL,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS village_holiday_unique
  ON "{{TENANT_SCHEMA}}".village_holiday (village_unit_id, holiday_date);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_audit_row_change') THEN
    FOREACH t IN ARRAY ARRAY[
      'village_service_catalog', 'village_service_request', 'village_letter',
      'village_workflow_instance'
    ] LOOP
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I;
         CREATE TRIGGER trg_audit_%1$s
           AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I
           FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change()',
        t, '{{TENANT_SCHEMA}}'
      );
    END LOOP;
  END IF;
END $$;
