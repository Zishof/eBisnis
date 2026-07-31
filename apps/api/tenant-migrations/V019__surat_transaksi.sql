-- =========================================================================
-- V019 — TATA KELOLA SURAT: SURAT MASUK, SURAT KELUAR, DISPOSISI, PERSETUJUAN
--
-- Additive. Tidak ada tabel maupun kolom lama yang diubah.
-- =========================================================================

-- Surat masuk --------------------------------------------------------------
--
-- Nomor suratnya berasal dari PENGIRIM dan tidak dapat dipercaya unik: dua
-- instansi berbeda dapat mengirim surat dengan nomor yang sama persis. Karena
-- itu yang unik adalah nomor agenda internal, dan nomor pengirim disimpan apa
-- adanya sebagai keterangan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_incoming (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nomor agenda internal; inilah yang unik dan dipakai merujuk surat ini.
  agenda_number     VARCHAR(96) NOT NULL,
  -- Nomor menurut pengirimnya. Boleh kembar; boleh kosong bila suratnya memang
  -- tidak bernomor.
  sender_number     VARCHAR(96),

  classification_id UUID REFERENCES "{{TENANT_SCHEMA}}".surat_classification(id),
  nature_id         UUID REFERENCES "{{TENANT_SCHEMA}}".surat_nature(id),
  locker_id         UUID REFERENCES "{{TENANT_SCHEMA}}".surat_locker(id),

  sender_name       VARCHAR(255) NOT NULL,
  sender_address    TEXT,
  subject           VARCHAR(500) NOT NULL,
  summary           TEXT,
  attachment_note   VARCHAR(255),

  -- Tanggal pada suratnya, dan tanggal ia benar-benar diterima. Keduanya
  -- berbeda dan keduanya perlu: surat bertanggal lama yang baru diterima
  -- kemarin bukan surat yang terlambat ditangani.
  letter_date       DATE,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  confidentiality   VARCHAR(16) NOT NULL DEFAULT 'BIASA'
                    CHECK (confidentiality IN ('BIASA', 'TERBATAS', 'RAHASIA', 'SANGAT_RAHASIA')),

  status            VARCHAR(24) NOT NULL DEFAULT 'DITERIMA'
                    CHECK (status IN ('DITERIMA', 'DIDISPOSISI', 'DIPROSES', 'SELESAI', 'DIARSIPKAN')),

  -- Kepada siapa surat ini ditujukan di dalam organisasi.
  addressed_role_code VARCHAR(64),
  addressed_user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),

  registered_by_user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),

  -- Kaitan ke surat keluar yang menjadi balasannya, bila ada.
  replied_by_outgoing_id UUID,

  notes             TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_surat_incoming_agenda UNIQUE (agenda_number)
);

-- Surat keluar -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_outgoing (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nomor resmi. KOSONG selama surat masih konsep — nomor resmi hanya diberikan
  -- pada surat yang sudah disetujui, karena nomor yang sudah keluar tidak dapat
  -- ditarik kembali bila konsepnya ternyata dibatalkan.
  letter_number     VARCHAR(96),
  number_issued_at  TIMESTAMPTZ,

  classification_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".surat_classification(id),
  nature_id         UUID REFERENCES "{{TENANT_SCHEMA}}".surat_nature(id),
  locker_id         UUID REFERENCES "{{TENANT_SCHEMA}}".surat_locker(id),
  letterhead_id     UUID REFERENCES "{{TENANT_SCHEMA}}".surat_letterhead(id),
  approval_flow_id  UUID REFERENCES "{{TENANT_SCHEMA}}".surat_approval_flow(id),

  recipient_name    VARCHAR(255) NOT NULL,
  recipient_address TEXT,
  subject           VARCHAR(500) NOT NULL,
  body              TEXT,
  attachment_note   VARCHAR(255),

  letter_date       DATE,

  status            VARCHAR(24) NOT NULL DEFAULT 'KONSEP'
                    CHECK (status IN ('KONSEP', 'DIAJUKAN', 'DIREVISI', 'DISETUJUI',
                                      'DITOLAK', 'DITERBITKAN', 'DIKIRIM', 'DIARSIPKAN',
                                      'DIBATALKAN')),

  -- Langkah alur yang sedang menunggu. Kosong bila belum diajukan atau sudah
  -- selesai.
  current_step_order SMALLINT,

  drafted_by_user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  signed_by_user_subject_id  UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  signed_at         TIMESTAMPTZ,

  -- Membalas surat masuk yang mana.
  in_reply_to_incoming_id UUID REFERENCES "{{TENANT_SCHEMA}}".surat_incoming(id),
  -- Revisi dari surat keluar sebelumnya; dari `suratSebelumnya` sistem lama.
  supersedes_outgoing_id  UUID REFERENCES "{{TENANT_SCHEMA}}".surat_outgoing(id),

  revision_note     TEXT,
  notes             TEXT,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,

  -- Nomor resmi tidak boleh kembar. Parsial: surat konsep yang belum bernomor
  -- boleh berjumlah berapa pun.
  CONSTRAINT ck_surat_outgoing_number_time
    CHECK ((letter_number IS NULL AND number_issued_at IS NULL)
        OR (letter_number IS NOT NULL AND number_issued_at IS NOT NULL)),

  -- Surat yang sudah terbit wajib bernomor. Inilah yang membuat "diterbitkan
  -- tanpa nomor" menjadi keadaan yang tidak dapat tersimpan, bukan sekadar
  -- keadaan yang tidak seharusnya terjadi.
  CONSTRAINT ck_surat_outgoing_issued_has_number
    CHECK (status NOT IN ('DITERBITKAN', 'DIKIRIM', 'DIARSIPKAN') OR letter_number IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_surat_outgoing_number
  ON "{{TENANT_SCHEMA}}".surat_outgoing (letter_number)
  WHERE letter_number IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".surat_incoming
  DROP CONSTRAINT IF EXISTS fk_surat_incoming_reply;
ALTER TABLE "{{TENANT_SCHEMA}}".surat_incoming
  ADD CONSTRAINT fk_surat_incoming_reply
  FOREIGN KEY (replied_by_outgoing_id)
  REFERENCES "{{TENANT_SCHEMA}}".surat_outgoing(id);

-- Disposisi ----------------------------------------------------------------
--
-- Perintah tindak lanjut atas surat masuk. Berantai: seorang pimpinan
-- mendisposisi kepada bawahannya, yang dapat mendisposisi lagi ke bawahnya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_disposition (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".surat_incoming(id) ON DELETE CASCADE,

  -- Disposisi lanjutan menunjuk disposisi yang mendahuluinya.
  parent_id      UUID REFERENCES "{{TENANT_SCHEMA}}".surat_disposition(id),

  from_user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  to_user_subject_id   UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  to_role_code   VARCHAR(64),

  instruction    TEXT NOT NULL,
  due_date       DATE,

  status         VARCHAR(16) NOT NULL DEFAULT 'DIKIRIM'
                 CHECK (status IN ('DIKIRIM', 'DIBACA', 'DIKERJAKAN', 'SELESAI', 'DITOLAK')),

  read_at        TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  completion_note TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID,
  version        INTEGER NOT NULL DEFAULT 1,

  -- Disposisi wajib punya tujuan: kepada orang, kepada peran, atau keduanya.
  -- Tanpa tujuan ia hanya catatan yang tidak pernah sampai kepada siapa pun.
  CONSTRAINT ck_surat_disposition_target
    CHECK (to_user_subject_id IS NOT NULL OR to_role_code IS NOT NULL),
  CONSTRAINT ck_surat_disposition_completed
    CHECK (status <> 'SELESAI' OR completed_at IS NOT NULL)
);

-- Persetujuan surat keluar -------------------------------------------------
--
-- Satu baris per langkah yang benar-benar dilalui. Append-only pada praktiknya:
-- keputusan yang sudah diambil tidak diubah, melainkan disusul keputusan
-- berikutnya. Revisi menghasilkan baris baru, bukan menimpa yang lama —
-- riwayat siapa menyetujui apa pada versi keberapa adalah inti dari tata kelola
-- surat.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_approval (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outgoing_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".surat_outgoing(id) ON DELETE CASCADE,
  flow_step_id   UUID REFERENCES "{{TENANT_SCHEMA}}".surat_approval_flow_step(id),
  step_order     SMALLINT NOT NULL,

  decision       VARCHAR(16) NOT NULL
                 CHECK (decision IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIKEMBALIKAN', 'DILEWATI')),

  decided_by_user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  decided_at     TIMESTAMPTZ,
  -- Peran yang dipakai saat memutuskan; menjawab "dalam kapasitas apa ia
  -- menyetujui" tanpa penelusuran silang.
  decided_as_role_code VARCHAR(64),

  -- Penolakan dan pengembalian WAJIB beralasan. Surat yang dikembalikan tanpa
  -- keterangan memaksa penyusunnya menebak apa yang harus diperbaiki, dan
  -- tebakan yang salah menghasilkan putaran revisi berikutnya.
  note           TEXT,

  -- Batas waktu langkah ini menurut SLA, dihitung saat langkah dimulai.
  due_at         TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID,
  version        INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_surat_approval_decided
    CHECK (decision = 'MENUNGGU' OR decided_at IS NOT NULL),
  CONSTRAINT ck_surat_approval_reason
    CHECK (decision NOT IN ('DITOLAK', 'DIKEMBALIKAN')
        OR (note IS NOT NULL AND length(btrim(note)) >= 5))
);

-- Satu langkah hanya boleh punya satu keputusan yang masih menunggu.
CREATE UNIQUE INDEX IF NOT EXISTS uq_surat_approval_pending
  ON "{{TENANT_SCHEMA}}".surat_approval (outgoing_id, step_order)
  WHERE decision = 'MENUNGGU';

CREATE INDEX IF NOT EXISTS idx_surat_incoming_status
  ON "{{TENANT_SCHEMA}}".surat_incoming (status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_surat_outgoing_status
  ON "{{TENANT_SCHEMA}}".surat_outgoing (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surat_disposition_incoming
  ON "{{TENANT_SCHEMA}}".surat_disposition (incoming_id, created_at);
CREATE INDEX IF NOT EXISTS idx_surat_disposition_to
  ON "{{TENANT_SCHEMA}}".surat_disposition (to_user_subject_id, status);
CREATE INDEX IF NOT EXISTS idx_surat_approval_outgoing
  ON "{{TENANT_SCHEMA}}".surat_approval (outgoing_id, step_order);

-- Audit --------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['surat_incoming', 'surat_outgoing',
                           'surat_disposition', 'surat_approval'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
