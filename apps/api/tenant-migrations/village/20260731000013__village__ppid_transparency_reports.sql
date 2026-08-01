-- =========================================================================
-- VILLAGE D-11 — PPID, TRANSPARANSI, DAN LAPORAN
-- =========================================================================
--
-- ## Ambang penyajian tidak dapat diturunkan setelah laporan terbit
--
-- Laporan yang terbit dengan ambang 5 lalu diterbitkan ulang dengan ambang 3
-- membuka sel yang tadinya ditekan — dan siapa pun yang menyimpan versi
-- pertama kini memegang keduanya. Menurunkan ambang bukan penyesuaian; ia
-- penerbitan surut atas apa yang pernah dinyatakan tidak boleh terbit.
--
-- Ditegakkan constraint, bukan pemeriksaan layanan:
--
--     CHECK (threshold >= published_threshold_floor)
--
-- `published_threshold_floor` dinaikkan pemicu setiap kali sebuah laporan
-- terbit. Layanan yang lupa memeriksa, jalur impor, dan penyuntingan langsung
-- sama-sama tertahan.
--
-- ## Pengecualian informasi wajib bertanggal
--
-- Pengecualian tanpa batas waktu adalah kerahasiaan permanen yang ditetapkan
-- diam-diam: tidak ada seorang pun yang akan meninjaunya kembali bila tidak ada
-- tanggal yang memaksanya. Bersamanya wajib ada dasar hukum dan **uji
-- konsekuensi** — akibat apa yang timbul bila dibuka. Pengecualian tanpa
-- konsekuensi yang dinyatakan bukan pengecualian melainkan penolakan yang
-- diberi nama lain.
--
-- ## Penolakan wajib menyebut cara mengajukan keberatan
--
-- Pemohon yang tidak diberi tahu haknya tidak akan memakainya, dan itu berarti
-- hak itu dihapus tanpa ada yang menghapusnya.

-- ---------------------------------------------------------------------------
-- Kebijakan penyajian
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_disclosure_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE CASCADE,

  -- Ambang minimum penyajian agregat. Lima adalah nilai yang lazim dipakai
  -- lembaga statistik: pada cacah empat ke bawah, orang yang mengenal
  -- wilayahnya sering dapat menebak siapa saja mereka tanpa menghitung apa pun.
  threshold       INTEGER NOT NULL DEFAULT 5,
  -- Ambang tertinggi yang pernah dipakai laporan yang sudah terbit. Dinaikkan
  -- pemicu; tidak pernah turun.
  published_threshold_floor INTEGER NOT NULL DEFAULT 0,

  note            TEXT,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_disclosure_threshold_sane CHECK (threshold BETWEEN 2 AND 100),
  CONSTRAINT village_disclosure_floor_sane CHECK (published_threshold_floor >= 0),
  -- INTI: ambang tidak dapat turun di bawah yang pernah dipakai laporan terbit.
  CONSTRAINT village_disclosure_no_retroactive_lowering
    CHECK (threshold >= published_threshold_floor)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_disclosure_policy_unit_unique
  ON "{{TENANT_SCHEMA}}".village_disclosure_policy (village_unit_id);

-- ---------------------------------------------------------------------------
-- Daftar Informasi Publik
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_information_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  code            VARCHAR(48) NOT NULL,
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  -- BERKALA, SERTA_MERTA, SETIAP_SAAT, atau DIKECUALIKAN.
  classification  VARCHAR(20) NOT NULL DEFAULT 'SETIAP_SAAT',
  responsible_unit VARCHAR(200),
  format          VARCHAR(64),
  retention_period VARCHAR(64),
  publication_url VARCHAR(500),

  -- Diisi hanya bila DIKECUALIKAN. Ketiganya wajib bersama-sama.
  exemption_basis VARCHAR(300),
  exemption_consequence TEXT,
  exemption_until DATE,

  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_information_classification_valid
    CHECK (classification IN ('BERKALA','SERTA_MERTA','SETIAP_SAAT','DIKECUALIKAN')),
  -- Pengecualian wajib lengkap: dasar hukum, uji konsekuensi, dan batas waktu.
  CONSTRAINT village_information_exemption_complete
    CHECK (
      classification <> 'DIKECUALIKAN'
      OR (btrim(coalesce(exemption_basis, '')) <> ''
          AND length(btrim(coalesce(exemption_consequence, ''))) >= 20
          AND exemption_until IS NOT NULL)
    ),
  -- Yang tidak dikecualikan tidak menyimpan alasan pengecualian. Sisa isian
  -- dari penggolongan sebelumnya akan terbaca sebagai pengecualian yang masih
  -- berlaku oleh siapa pun yang membacanya kemudian.
  CONSTRAINT village_information_no_stale_exemption
    CHECK (
      classification = 'DIKECUALIKAN'
      OR (exemption_basis IS NULL AND exemption_consequence IS NULL AND exemption_until IS NULL)
    ),
  -- Informasi yang dikecualikan tidak ditayangkan.
  CONSTRAINT village_information_exempt_not_published
    CHECK (classification <> 'DIKECUALIKAN' OR is_published = FALSE)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_information_item_code_unique
  ON "{{TENANT_SCHEMA}}".village_information_item (village_unit_id, code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Permohonan informasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_information_request (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  request_number  VARCHAR(64) NOT NULL,
  applicant_name  VARCHAR(200) NOT NULL,
  applicant_contact VARCHAR(160),
  applicant_address TEXT,
  -- Alasan permohonan TIDAK diwajibkan. Hak atas informasi publik tidak
  -- bergantung pada keperluan pemohon, dan mewajibkannya membuat petugas
  -- menilai keperluan itu — penilaian yang tidak menjadi kewenangannya.
  purpose         TEXT,

  requested_information TEXT NOT NULL,
  information_item_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_information_item (id) ON DELETE SET NULL,
  delivery_method VARCHAR(32),

  received_at     DATE NOT NULL,
  due_at          DATE NOT NULL,
  extended        BOOLEAN NOT NULL DEFAULT FALSE,
  extension_reason TEXT,
  answered_at     DATE,

  status          VARCHAR(24) NOT NULL DEFAULT 'DITERIMA',
  response_note   TEXT,
  -- Diisi bila DITOLAK. Ketiganya wajib bersama-sama.
  refusal_basis   VARCHAR(300),
  refusal_detail  TEXT,
  objection_guidance TEXT,

  handled_by      UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_information_request_status_valid
    CHECK (status IN ('DITERIMA','DIPROSES','DIPERPANJANG','DIPENUHI','DIPENUHI_SEBAGIAN','DITOLAK')),
  CONSTRAINT village_information_request_due_after_received CHECK (due_at >= received_at),
  CONSTRAINT village_information_request_extension_reason
    CHECK (NOT extended OR length(btrim(coalesce(extension_reason, ''))) >= 10),
  -- Penolakan wajib menyebut dasar hukum, uraian, DAN cara mengajukan
  -- keberatan. Yang terakhir yang paling sering hilang, dan yang paling
  -- merugikan pemohon.
  CONSTRAINT village_information_refusal_complete
    CHECK (
      status <> 'DITOLAK'
      OR (btrim(coalesce(refusal_basis, '')) <> ''
          AND length(btrim(coalesce(refusal_detail, ''))) >= 20
          AND btrim(coalesce(objection_guidance, '')) <> '')
    ),
  CONSTRAINT village_information_answered_has_date
    CHECK (status NOT IN ('DIPENUHI','DIPENUHI_SEBAGIAN','DITOLAK') OR answered_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_information_request_number_unique
  ON "{{TENANT_SCHEMA}}".village_information_request (village_unit_id, request_number);

-- Permohonan yang lewat tenggat dan belum dijawab. Dipakai laporan PPID; yang
-- terlambat harus terlihat, bukan tenggelam di antara yang lain.
CREATE INDEX IF NOT EXISTS village_information_overdue_idx
  ON "{{TENANT_SCHEMA}}".village_information_request (village_unit_id, due_at)
  WHERE status IN ('DITERIMA','DIPROSES','DIPERPANJANG');

-- ---------------------------------------------------------------------------
-- Keberatan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_information_objection (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  information_request_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".village_information_request (id) ON DELETE RESTRICT,

  objection_number VARCHAR(64) NOT NULL,
  reason          TEXT NOT NULL,
  filed_at        DATE NOT NULL,
  due_at          DATE NOT NULL,
  decided_at      DATE,
  decision        VARCHAR(24),
  decision_note   TEXT,
  decided_by      UUID,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_objection_decision_valid
    CHECK (decision IS NULL OR decision IN ('DIKABULKAN','DIKABULKAN_SEBAGIAN','DITOLAK')),
  CONSTRAINT village_objection_decided_has_note
    CHECK (decided_at IS NULL OR (decision IS NOT NULL AND length(btrim(coalesce(decision_note, ''))) >= 20)),
  CONSTRAINT village_objection_due_after_filed CHECK (due_at >= filed_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_objection_number_unique
  ON "{{TENANT_SCHEMA}}".village_information_objection (village_unit_id, objection_number);

-- Satu permohonan, satu keberatan yang berjalan.
CREATE UNIQUE INDEX IF NOT EXISTS village_objection_one_open
  ON "{{TENANT_SCHEMA}}".village_information_objection (information_request_id)
  WHERE decided_at IS NULL;

-- ---------------------------------------------------------------------------
-- Laporan yang terbit
-- ---------------------------------------------------------------------------
-- Menyimpan **ambang yang dipakai** beserta hasilnya. Ambangnya dicuplik, bukan
-- dirujuk: laporan yang merujuk kebijakan yang berlaku sekarang akan berubah
-- artinya setiap kali kebijakannya diubah, dan laporan yang berubah artinya
-- bukan laporan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_report_publication (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  report_code     VARCHAR(64) NOT NULL,
  title           VARCHAR(300) NOT NULL,
  period          VARCHAR(32) NOT NULL,
  threshold_used  INTEGER NOT NULL,
  suppressed_cells INTEGER NOT NULL DEFAULT 0,
  hidden_count    INTEGER NOT NULL DEFAULT 0,
  total_shown     BOOLEAN NOT NULL DEFAULT TRUE,
  payload         JSONB NOT NULL,

  published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by    UUID,
  withdrawn_at    TIMESTAMPTZ,
  withdraw_reason TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_report_threshold_sane CHECK (threshold_used BETWEEN 2 AND 100),
  CONSTRAINT village_report_counts_not_negative
    CHECK (suppressed_cells >= 0 AND hidden_count >= 0),
  CONSTRAINT village_report_payload_is_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT village_report_withdraw_has_reason
    CHECK (withdrawn_at IS NULL OR length(btrim(coalesce(withdraw_reason, ''))) >= 10),
  -- Satu sel tertekan sendirian bersama total yang tayang dapat dihitung dengan
  -- pengurangan. Laporan berbentuk itu tidak boleh tersimpan sebagai terbit.
  CONSTRAINT village_report_not_reconstructible
    CHECK (suppressed_cells = 0 OR NOT total_shown OR suppressed_cells >= 2)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_report_publication_unique
  ON "{{TENANT_SCHEMA}}".village_report_publication (village_unit_id, report_code, period)
  WHERE withdrawn_at IS NULL;

-- ---------------------------------------------------------------------------
-- Pemicu: ambang yang pernah dipakai tidak pernah turun
-- ---------------------------------------------------------------------------
-- Menaikkan `published_threshold_floor` setiap kali laporan terbit. Bersama
-- constraint `threshold >= published_threshold_floor`, ini membuat penurunan
-- ambang setelah penerbitan mustahil — bukan sekadar dilarang layanan.
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".village_raise_threshold_floor()
RETURNS trigger AS $fn$
BEGIN
  UPDATE "{{TENANT_SCHEMA}}".village_disclosure_policy
     SET published_threshold_floor = GREATEST(published_threshold_floor, NEW.threshold_used),
         updated_at = now(),
         version = version + 1
   WHERE village_unit_id = NEW.village_unit_id
     AND published_threshold_floor < NEW.threshold_used;
  RETURN NEW;
END
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_village_raise_threshold_floor
  ON "{{TENANT_SCHEMA}}".village_report_publication;
CREATE TRIGGER trg_village_raise_threshold_floor
  AFTER INSERT ON "{{TENANT_SCHEMA}}".village_report_publication
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".village_raise_threshold_floor();

-- ---------------------------------------------------------------------------
-- Pemicu audit
-- ---------------------------------------------------------------------------
DO $install$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi audit tidak ada; pemicu audit D-11 dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}' AND c.relkind = 'r'
       AND c.relname IN (
         'village_disclosure_policy', 'village_information_item',
         'village_information_request', 'village_information_objection',
         'village_report_publication'
       )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I',
      r.table_name, '{{TENANT_SCHEMA}}'
    );
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      r.table_name, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END
$install$;
