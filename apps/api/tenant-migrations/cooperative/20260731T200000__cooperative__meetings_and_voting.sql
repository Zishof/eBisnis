-- =========================================================================
-- K-5 — RAPAT ANGGOTA, KUORUM, PEMUNGUTAN SUARA, DAN KEPUTUSAN
--
-- Migrasi modul. Aditif; tidak ada tabel maupun kolom Core yang disentuh.
--
-- Satu prinsip menentukan bentuk berkas ini, dan ia pembeda koperasi dari
-- perseroan: **satu anggota satu suara, berapa pun besar simpanannya.**
-- Karena itu tabel suara tidak memiliki kolom bobot, dan tidak boleh
-- memilikinya.
-- =========================================================================

-- Rapat ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_meeting (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  meeting_number  VARCHAR(64),
  meeting_type    VARCHAR(24) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  fiscal_year     INTEGER,

  scheduled_at    TIMESTAMPTZ NOT NULL,
  location        VARCHAR(255),
  online_url      VARCHAR(500),
  is_hybrid       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Syarat kuorum diambil dari AD/ART dan DICUPLIK ke sini saat rapat dibuka.
  -- Membacanya ulang dari kebijakan saat menghitung akan membuat kuorum rapat
  -- tahun lalu ikut berubah bila AD/ART kelak diubah.
  required_quorum_ratio NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  second_call_quorum_ratio NUMERIC(5,4),
  max_proxy_per_holder INTEGER NOT NULL DEFAULT 0,
  proxy_counts_for_quorum BOOLEAN NOT NULL DEFAULT TRUE,
  is_second_call  BOOLEAN NOT NULL DEFAULT FALSE,
  adjourned_from_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting (id) ON DELETE SET NULL,

  -- Hasil perhitungan kuorum, dibekukan saat rapat dibuka.
  total_active_members INTEGER,
  counted_for_quorum   INTEGER,
  required_count       INTEGER,
  quorum_reached       BOOLEAN,
  quorum_computed_at   TIMESTAMPTZ,

  status          VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
  opened_at       TIMESTAMPTZ,
  opened_by       UUID,
  closed_at       TIMESTAMPTZ,
  closed_by       UUID,

  chaired_by_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,
  secretary_member_id  UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_meeting_type CHECK (meeting_type IN ('RAT', 'RALB', 'RAT_TUTUP_BUKU')),
  CONSTRAINT ck_coop_meeting_status CHECK (status IN
    ('PLANNED', 'INVITED', 'OPEN', 'QUORUM_REACHED', 'ADJOURNED', 'CLOSED', 'CANCELLED')),
  CONSTRAINT ck_coop_meeting_quorum_ratio
    CHECK (required_quorum_ratio > 0 AND required_quorum_ratio <= 1),
  CONSTRAINT ck_coop_meeting_second_ratio
    CHECK (second_call_quorum_ratio IS NULL
           OR (second_call_quorum_ratio > 0 AND second_call_quorum_ratio <= required_quorum_ratio)),
  -- Rapat berstatus QUORUM_REACHED wajib menyimpan angka yang membuktikannya.
  -- Kuorum yang dinyatakan tanpa angka tidak dapat diperiksa siapa pun kemudian.
  CONSTRAINT ck_coop_meeting_quorum_evidence
    CHECK (status <> 'QUORUM_REACHED'
           OR (quorum_reached = TRUE AND counted_for_quorum IS NOT NULL
               AND required_count IS NOT NULL AND total_active_members IS NOT NULL)),
  CONSTRAINT ck_coop_meeting_second_call_needs_origin
    CHECK (is_second_call = FALSE OR adjourned_from_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_meeting_number
  ON "{{TENANT_SCHEMA}}".cooperative_meeting (cooperative_id, meeting_number)
  WHERE meeting_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_coop_meeting_status
  ON "{{TENANT_SCHEMA}}".cooperative_meeting (cooperative_id, status, scheduled_at);

-- Mata acara ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_meeting_agenda (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting (id) ON DELETE CASCADE,
  sequence_no     INTEGER NOT NULL,
  agenda_type     VARCHAR(32) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  -- Ambang keputusan dicuplik dari jenis mata acaranya saat rapat disusun.
  decision_rule   VARCHAR(24) NOT NULL DEFAULT 'SIMPLE_MAJORITY',
  requires_vote   BOOLEAN NOT NULL DEFAULT TRUE,
  document_file_id UUID,
  status          VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_agenda_type CHECK (agenda_type IN
    ('ANNUAL_REPORT', 'FINANCIAL_REPORT', 'SHU_DISTRIBUTION', 'BUDGET_PLAN',
     'BOARD_ELECTION', 'BOARD_DISMISSAL', 'BYLAW_AMENDMENT', 'MERGER',
     'DISSOLUTION', 'OTHER')),
  CONSTRAINT ck_coop_agenda_rule CHECK (decision_rule IN
    ('SIMPLE_MAJORITY', 'TWO_THIRDS', 'THREE_QUARTERS', 'UNANIMOUS')),
  CONSTRAINT ck_coop_agenda_status CHECK (status IN
    ('PENDING', 'DISCUSSED', 'VOTING', 'DECIDED', 'DEFERRED')),
  CONSTRAINT uq_coop_agenda_sequence UNIQUE (meeting_id, sequence_no)
);

-- Undangan ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_meeting_invitation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  channel         VARCHAR(24),
  sent_at         TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  rsvp            VARCHAR(16),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_invitation_rsvp
    CHECK (rsvp IS NULL OR rsvp IN ('ATTEND', 'DECLINE', 'PROXY')),
  CONSTRAINT uq_coop_invitation UNIQUE (meeting_id, member_id)
);

-- Kehadiran -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_meeting_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  mode            VARCHAR(16) NOT NULL,
  -- Diisi bila hadir lewat kuasa: siapa yang mewakili.
  proxy_holder_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,
  proxy_document_file_id UUID,
  has_voting_right BOOLEAN NOT NULL DEFAULT TRUE,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by   UUID,
  signature_file_id UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_attendance_mode CHECK (mode IN ('IN_PERSON', 'ONLINE', 'PROXY')),
  CONSTRAINT ck_coop_attendance_proxy_needs_holder
    CHECK (mode <> 'PROXY' OR proxy_holder_member_id IS NOT NULL),
  -- Seseorang tidak dapat menguasakan kepada dirinya sendiri.
  CONSTRAINT ck_coop_attendance_proxy_not_self
    CHECK (proxy_holder_member_id IS NULL OR proxy_holder_member_id <> member_id)
);

-- Satu anggota tercatat hadir sekali saja per rapat. Tanpa ini, kehadiran
-- langsung dan kuasa atas orang yang sama akan dihitung dua kali pada kuorum.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_attendance_member
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_attendance (meeting_id, member_id);

CREATE INDEX IF NOT EXISTS ix_coop_attendance_proxy
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_attendance (meeting_id, proxy_holder_member_id)
  WHERE proxy_holder_member_id IS NOT NULL;

-- Pemungutan suara ----------------------------------------------------------
--
-- PERHATIKAN: tabel ini TIDAK memiliki kolom bobot, dan tidak boleh
-- memilikinya. Satu anggota satu suara, berapa pun besar simpanannya — itulah
-- pembeda koperasi dari perseroan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_meeting_vote (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting (id) ON DELETE CASCADE,
  agenda_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting_agenda (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  -- Bila suara diberikan pemegang kuasa, dicatat siapa yang memberikannya.
  cast_by_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,
  choice          VARCHAR(16) NOT NULL,
  cast_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel         VARCHAR(16),
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_vote_choice CHECK (choice IN ('YES', 'NO', 'ABSTAIN')),
  CONSTRAINT ck_coop_vote_channel
    CHECK (channel IS NULL OR channel IN ('IN_PERSON', 'ONLINE', 'PROXY'))
);

-- Satu anggota satu suara per mata acara. Ditegakkan basis data — inilah
-- penegakan teknis dari prinsip koperasi yang paling mendasar.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_vote_one_per_member
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_vote (agenda_id, member_id);

CREATE INDEX IF NOT EXISTS ix_coop_vote_agenda
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_vote (agenda_id, choice);

-- Keputusan -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_meeting_decision (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting (id) ON DELETE CASCADE,
  agenda_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting_agenda (id) ON DELETE CASCADE,
  decision_number VARCHAR(64),
  summary         TEXT NOT NULL,
  decision_rule   VARCHAR(24) NOT NULL,

  -- Angka yang membuktikan keputusannya. Dibekukan saat keputusan dicatat.
  votes_yes       INTEGER NOT NULL DEFAULT 0,
  votes_no        INTEGER NOT NULL DEFAULT 0,
  votes_abstain   INTEGER NOT NULL DEFAULT 0,
  valid_votes     INTEGER NOT NULL DEFAULT 0,
  required_yes    INTEGER NOT NULL DEFAULT 0,

  /*
   * Keputusan yang diambil tanpa kuorum DITANDAI tidak sah, bukan ditolak
   * diam-diam. Keputusan itu terjadi, tercatat pada notulen, dan mungkin sudah
   * dilaksanakan. Menghilangkannya dari catatan akan membuat pelaksanaannya
   * tidak dapat dijelaskan kemudian; menandainya tidak sah membuatnya terlihat
   * dan dapat diperbaiki lewat rapat berikutnya.
   */
  validity        VARCHAR(32) NOT NULL DEFAULT 'VALID',
  invalidity_note TEXT,

  decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from  DATE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_decision_validity CHECK (validity IN
    ('VALID', 'INVALID_NO_QUORUM', 'INVALID_INSUFFICIENT_VOTE', 'REVOKED')),
  CONSTRAINT ck_coop_decision_rule CHECK (decision_rule IN
    ('SIMPLE_MAJORITY', 'TWO_THIRDS', 'THREE_QUARTERS', 'UNANIMOUS')),
  CONSTRAINT ck_coop_decision_votes_nonnegative
    CHECK (votes_yes >= 0 AND votes_no >= 0 AND votes_abstain >= 0),
  -- Suara sah adalah setuju + tidak setuju; abstain tidak dihitung.
  CONSTRAINT ck_coop_decision_valid_votes
    CHECK (valid_votes = votes_yes + votes_no),
  -- Keputusan yang tidak sah wajib menyebutkan sebabnya.
  CONSTRAINT ck_coop_decision_invalid_needs_note
    CHECK (validity = 'VALID' OR invalidity_note IS NOT NULL),
  -- Keputusan SAH wajib benar-benar memenuhi ambangnya. Menutup jalan mencatat
  -- keputusan sebagai sah padahal angkanya menunjukkan sebaliknya.
  CONSTRAINT ck_coop_decision_valid_needs_threshold
    CHECK (validity <> 'VALID' OR votes_yes >= required_yes)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_decision_number
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_decision (decision_number)
  WHERE decision_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_decision_agenda
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_decision (agenda_id);

-- Tindak lanjut -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_meeting_follow_up (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting_decision (id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  assigned_to_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_follow_up_status CHECK (status IN
    ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'OVERDUE'))
);

CREATE INDEX IF NOT EXISTS ix_coop_follow_up_decision
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_follow_up (decision_id, status);

-- Notulen -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_meeting_minutes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting (id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  -- Notulen yang disusun AI ditandai dengan jelas. Konsep yang tidak diperiksa
  -- manusia tidak boleh tampak seperti catatan resmi rapat.
  drafted_by_ai   BOOLEAN NOT NULL DEFAULT FALSE,
  drafted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  drafted_by      UUID,
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  approved_by_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  file_id         UUID,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_minutes_status CHECK (status IN ('DRAFT', 'REVIEWED', 'APPROVED')),
  -- Notulen berstatus APPROVED wajib menyebutkan siapa yang mengesahkannya.
  CONSTRAINT ck_coop_minutes_approved_needs_approver
    CHECK (status <> 'APPROVED' OR (approved_by_member_id IS NOT NULL AND approved_at IS NOT NULL)),
  -- Konsep AI wajib melalui pemeriksaan manusia sebelum disahkan.
  CONSTRAINT ck_coop_minutes_ai_needs_review
    CHECK (drafted_by_ai = FALSE OR status = 'DRAFT' OR reviewed_by IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_minutes_meeting
  ON "{{TENANT_SCHEMA}}".cooperative_meeting_minutes (meeting_id);
