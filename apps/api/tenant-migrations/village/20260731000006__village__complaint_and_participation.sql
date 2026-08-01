-- =========================================================================
-- VILLAGE D-5 — PENGADUAN, ASPIRASI, DAN MUSRENBANG
-- =========================================================================
--
-- ## Anonimitas ditegakkan basis data, bukan hanya layanan
--
-- Pengaduan yang paling perlu didengar adalah pengaduan **tentang perangkat
-- desa itu sendiri** — pungutan liar, bantuan yang tidak sampai, keputusan yang
-- berpihak. Warga tidak akan menyampaikannya bila namanya terlihat oleh orang
-- yang ia adukan, yang tinggal di kampung yang sama dan akan terus ia temui.
--
-- Karena itu pengaduan anonim di sini berarti **identitas pelapor tidak
-- disimpan sama sekali** — bukan disimpan lalu disembunyikan. Constraint di
-- bawah menolak baris anonim yang membawa identitas apa pun, sehingga satu
-- jalan kode yang lupa mengosongkannya akan gagal saat menyimpan, bukan
-- menyimpan diam-diam.
--
-- Tidak ada kolom hash pelapor. Ruang NIK hanya enam belas digit dan desa
-- memiliki daftar NIK seluruh warganya; hash-nya dapat dicocokkan exhaustively
-- dalam hitungan detik. Hash dari data berentropi rendah yang daftarnya sudah
-- dipegang bukan penyamaran — ia penundaan yang tidak menunda apa pun.

-- ---------------------------------------------------------------------------
-- Kategori pengaduan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_complaint_category (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  -- Kategori yang menyangkut aparatur ditangani berbeda: tidak boleh
  -- ditugaskan kepada yang diadukan, dan bawaannya anonim.
  concerns_officer BOOLEAN NOT NULL DEFAULT FALSE,
  default_handler_role VARCHAR(48),
  sla_working_days INTEGER NOT NULL DEFAULT 7,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS village_complaint_category_code_unique
  ON "{{TENANT_SCHEMA}}".village_complaint_category (village_unit_id, code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Pengaduan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_complaint (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  category_id         UUID REFERENCES "{{TENANT_SCHEMA}}".village_complaint_category (id) ON DELETE SET NULL,
  ticket_number       VARCHAR(48) NOT NULL,

  -- TERBUKA atau ANONIM. Menentukan apakah medan identitas boleh terisi.
  reporter_mode       VARCHAR(16) NOT NULL DEFAULT 'TERBUKA',
  reporter_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  reporter_user_id    UUID,
  reporter_name       VARCHAR(200),
  reporter_phone      VARCHAR(40),

  -- Token pelacakan, diberikan kepada pelapor. Untuk pengaduan anonim inilah
  -- satu-satunya cara pelapor menengok kembali aduannya — dan ia tidak
  -- menunjuk kepada siapa pun.
  tracking_token      VARCHAR(64) NOT NULL,

  title               VARCHAR(300) NOT NULL,
  description         TEXT NOT NULL,
  location_note       TEXT,
  latitude            NUMERIC(10,7),
  longitude           NUMERIC(10,7),
  village_rt_id       UUID REFERENCES "{{TENANT_SCHEMA}}".village_rt (id) ON DELETE SET NULL,

  -- Aparatur yang diadukan, bila ada. Dipakai menolak penugasan kepada
  -- yang bersangkutan.
  concerns_officer_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE SET NULL,

  status              VARCHAR(24) NOT NULL DEFAULT 'BARU',
  assigned_officer_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE SET NULL,
  assigned_at         TIMESTAMPTZ,
  last_action_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ,
  resolution_note     TEXT,
  close_reason        TEXT,

  is_public           BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_complaint_mode_valid CHECK (reporter_mode IN ('TERBUKA', 'ANONIM')),
  CONSTRAINT village_complaint_status_valid CHECK (status IN (
    'BARU', 'DITERIMA', 'DITUGASKAN', 'DITINDAKLANJUTI', 'SELESAI',
    'DITUTUP', 'BUKAN_KEWENANGAN'
  )),

  -- Inti penegakan anonimitas. Baris anonim tidak boleh membawa identitas apa
  -- pun; satu jalan kode yang lupa mengosongkannya akan gagal saat menyimpan,
  -- bukan menyimpan diam-diam.
  CONSTRAINT village_complaint_anonymous_carries_no_identity CHECK (
    reporter_mode <> 'ANONIM' OR (
      reporter_resident_id IS NULL AND
      reporter_user_id IS NULL AND
      reporter_name IS NULL AND
      reporter_phone IS NULL
    )
  ),

  -- Penghentian tanpa penyelesaian wajib beralasan. Warga berhak tahu mengapa
  -- aduannya berhenti.
  CONSTRAINT village_complaint_close_needs_reason
    CHECK (status NOT IN ('DITUTUP', 'BUKAN_KEWENANGAN') OR close_reason IS NOT NULL),

  -- Pengaduan tentang aparatur tidak boleh ditugaskan kepada yang bersangkutan.
  -- Ditegakkan di sini pula, bukan hanya layanan: menugaskan aduan kepada
  -- terlapor sama dengan menutupnya.
  CONSTRAINT village_complaint_not_assigned_to_subject CHECK (
    concerns_officer_id IS NULL
    OR assigned_officer_id IS NULL
    OR concerns_officer_id <> assigned_officer_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS village_complaint_ticket_unique
  ON "{{TENANT_SCHEMA}}".village_complaint (village_unit_id, ticket_number);

CREATE UNIQUE INDEX IF NOT EXISTS village_complaint_token_unique
  ON "{{TENANT_SCHEMA}}".village_complaint (tracking_token);

CREATE INDEX IF NOT EXISTS village_complaint_status_idx
  ON "{{TENANT_SCHEMA}}".village_complaint (village_unit_id, status, last_action_at);

-- ---------------------------------------------------------------------------
-- Bukti dan tindak lanjut
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_complaint_evidence (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_complaint (id) ON DELETE CASCADE,
  file_object_id UUID,
  caption        VARCHAR(300),
  -- Diunggah pelapor atau petugas. Bukti dari petugas adalah hasil peninjauan
  -- lapangan, dan membedakannya penting saat aduan dipersoalkan.
  uploaded_by_officer BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS village_complaint_evidence_idx
  ON "{{TENANT_SCHEMA}}".village_complaint_evidence (complaint_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_complaint_followup (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_complaint (id) ON DELETE CASCADE,
  from_status    VARCHAR(24),
  to_status      VARCHAR(24),
  note           TEXT NOT NULL,
  actor_user_id  UUID,
  active_role_id UUID,
  -- Catatan internal petugas tidak dibaca pelapor. Yang ditandai terlihat
  -- warga adalah jawaban resminya.
  visible_to_reporter BOOLEAN NOT NULL DEFAULT TRUE,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS village_complaint_followup_idx
  ON "{{TENANT_SCHEMA}}".village_complaint_followup (complaint_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Penilaian warga atas penyelesaian
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_complaint_feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_complaint (id) ON DELETE CASCADE,
  rating       INTEGER NOT NULL,
  comment      TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT village_complaint_feedback_rating_range CHECK (rating BETWEEN 1 AND 5)
);

-- Satu penilaian per pengaduan.
CREATE UNIQUE INDEX IF NOT EXISTS village_complaint_feedback_unique
  ON "{{TENANT_SCHEMA}}".village_complaint_feedback (complaint_id);

-- ---------------------------------------------------------------------------
-- Aspirasi
-- ---------------------------------------------------------------------------
-- Berbeda dari pengaduan: aspirasi adalah usul, bukan keluhan. Ia tidak punya
-- SLA penyelesaian dan tidak "selesai" — ia diterima, dipertimbangkan, dan
-- mungkin menjadi usulan Musrenbang.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_aspiration (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  reporter_mode       VARCHAR(16) NOT NULL DEFAULT 'TERBUKA',
  reporter_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  reporter_name       VARCHAR(200),
  title               VARCHAR(300) NOT NULL,
  description         TEXT NOT NULL,
  category            VARCHAR(48),
  support_count       INTEGER NOT NULL DEFAULT 0,
  status              VARCHAR(24) NOT NULL DEFAULT 'DITERIMA',
  response_note       TEXT,
  is_public           BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_aspiration_mode_valid CHECK (reporter_mode IN ('TERBUKA', 'ANONIM')),
  CONSTRAINT village_aspiration_status_valid
    CHECK (status IN ('DITERIMA', 'DIPERTIMBANGKAN', 'JADI_USULAN', 'BELUM_DAPAT_DIPENUHI')),
  CONSTRAINT village_aspiration_anonymous_carries_no_identity CHECK (
    reporter_mode <> 'ANONIM' OR (reporter_resident_id IS NULL AND reporter_name IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS village_aspiration_unit_idx
  ON "{{TENANT_SCHEMA}}".village_aspiration (village_unit_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Musrenbang
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_musrenbang (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  -- MUSDES untuk desa, MUSKEL untuk kelurahan. Bentuk dan jenjangnya berbeda,
  -- dan kelayakannya ditegakkan layanan menurut profil penyewa.
  forum_type      VARCHAR(16) NOT NULL DEFAULT 'MUSDES',
  fiscal_year     INTEGER NOT NULL,
  title           VARCHAR(300) NOT NULL,
  held_at         DATE,
  venue           VARCHAR(200),
  -- Kuorum sebagai data, bukan angka tetap: ketentuannya berbeda antar daerah,
  -- dan menebaknya dari pusat akan salah di sebagian tempat.
  quorum_minimum  INTEGER NOT NULL DEFAULT 30,
  attendee_count  INTEGER NOT NULL DEFAULT 0,
  -- Pagu indikatif yang dibagikan kepada usulan.
  budget_ceiling  NUMERIC(18,2) NOT NULL DEFAULT 0,
  status          VARCHAR(24) NOT NULL DEFAULT 'DIRENCANAKAN',
  minutes_note    TEXT,
  -- Siapa yang menetapkan hasilnya. Inilah saat usulan menjadi mengikat dan
  -- pagu terbagi; pertanyaan "atas dasar apa usulan saya ditunda" akan
  -- ditanyakan, dan jawabannya menuntut nama.
  finalized_by    UUID,
  finalized_at    TIMESTAMPTZ,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_musrenbang_forum_valid CHECK (forum_type IN ('MUSDES', 'MUSKEL', 'MUSDUS')),
  CONSTRAINT village_musrenbang_status_valid
    CHECK (status IN ('DIRENCANAKAN', 'BERLANGSUNG', 'SELESAI', 'BATAL')),
  CONSTRAINT village_musrenbang_quorum_positive CHECK (quorum_minimum > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_musrenbang_year_unique
  ON "{{TENANT_SCHEMA}}".village_musrenbang (village_unit_id, forum_type, fiscal_year);

-- ---------------------------------------------------------------------------
-- Usulan pembangunan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_proposal (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  musrenbang_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_musrenbang (id) ON DELETE SET NULL,
  -- Aspirasi yang menjadi usulan. Tautan eksplisit, bukan penyalinan manual:
  -- warga yang aspirasinya menjadi usulan berhak melihat jejaknya.
  aspiration_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_aspiration (id) ON DELETE SET NULL,

  proposal_number   VARCHAR(48),
  title             VARCHAR(300) NOT NULL,
  description       TEXT,
  sector            VARCHAR(48),
  location_note     TEXT,
  village_rt_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_rt (id) ON DELETE SET NULL,

  estimated_cost    NUMERIC(18,2) NOT NULL DEFAULT 0,
  beneficiary_count INTEGER NOT NULL DEFAULT 0,
  -- Skor prioritas hasil musyawarah, 1-5.
  priority_score    INTEGER NOT NULL DEFAULT 3,

  proposed_by_name  VARCHAR(200),
  proposed_by_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,

  status            VARCHAR(24) NOT NULL DEFAULT 'DIUSULKAN',
  decision_note     TEXT,
  -- Diisi ketika usulan masuk RKP pada D-6. Tautannya eksplisit supaya
  -- pertanyaan "usulan saya jadi apa" dapat dijawab tanpa menebak.
  rkp_activity_id   UUID,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_proposal_status_valid CHECK (status IN (
    'DIUSULKAN', 'DIBAHAS', 'DISEPAKATI', 'DITUNDA', 'DITOLAK', 'MASUK_RKP'
  )),
  CONSTRAINT village_proposal_priority_range CHECK (priority_score BETWEEN 1 AND 5),
  CONSTRAINT village_proposal_cost_nonnegative CHECK (estimated_cost >= 0),
  -- Penolakan dan penundaan wajib beralasan. Warga yang usulannya ditolak tanpa
  -- keterangan tidak akan mengusulkan lagi tahun depan.
  CONSTRAINT village_proposal_decision_needs_note
    CHECK (status NOT IN ('DITOLAK', 'DITUNDA') OR decision_note IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS village_proposal_musrenbang_idx
  ON "{{TENANT_SCHEMA}}".village_proposal (musrenbang_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS village_proposal_status_idx
  ON "{{TENANT_SCHEMA}}".village_proposal (village_unit_id, status);

-- ---------------------------------------------------------------------------
-- Kehadiran Musrenbang
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_musrenbang_attendee (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  musrenbang_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_musrenbang (id) ON DELETE CASCADE,
  resident_id    UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  attendee_name  VARCHAR(200) NOT NULL,
  representing   VARCHAR(160),
  is_sample      BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS village_musrenbang_attendee_idx
  ON "{{TENANT_SCHEMA}}".village_musrenbang_attendee (musrenbang_id);

-- Satu warga tidak tercatat hadir dua kali pada forum yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS village_musrenbang_attendee_unique
  ON "{{TENANT_SCHEMA}}".village_musrenbang_attendee (musrenbang_id, resident_id)
  WHERE resident_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Konsultasi publik dan survei
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_survey (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  survey_type     VARCHAR(24) NOT NULL DEFAULT 'SURVEI',
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  questions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  opens_at        DATE,
  closes_at       DATE,
  -- Survei anonim tidak menyimpan penjawabnya sama sekali, sama halnya dengan
  -- pengaduan anonim.
  is_anonymous    BOOLEAN NOT NULL DEFAULT TRUE,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAF',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_survey_type_valid CHECK (survey_type IN ('SURVEI', 'KONSULTASI_PUBLIK', 'JAJAK_PENDAPAT')),
  CONSTRAINT village_survey_status_valid CHECK (status IN ('DRAF', 'TERBUKA', 'TERTUTUP')),
  CONSTRAINT village_survey_period CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at >= opens_at)
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_survey_response (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_survey (id) ON DELETE CASCADE,
  resident_id  UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  answers      JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS village_survey_response_idx
  ON "{{TENANT_SCHEMA}}".village_survey_response (survey_id);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
-- Dipasang oleh migrasi 20260731000007, bukan di sini.
--
-- Berkas ini semula memuat blok pemasangan pemicu yang mencari fungsi bernama
-- `fn_audit_row_change` — nama yang tidak pernah ada. Fungsi audit yang
-- sesungguhnya bernama `audit_row_trigger()` dan tinggal pada skema audit
-- terpisah. Karena blok itu dijaga `IF EXISTS`, ia dilewati tanpa galat, dan
-- tidak satu pun tabel village benar-benar diaudit.
--
-- Blok itu dibuang alih-alih dibetulkan di tempatnya: migrasi ini belum
-- pernah diterapkan pada skema penyewa mana pun, sehingga membetulkannya di
-- sini masih aman. Pemasangannya dipusatkan pada satu migrasi supaya tidak
-- terulang lima kali dengan lima peluang salah ketik.
