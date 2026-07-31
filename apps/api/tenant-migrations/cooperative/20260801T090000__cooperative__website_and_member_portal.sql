-- =============================================================================
-- K-9 · Situs koperasi dan portal anggota
-- =============================================================================
--
-- Bagian ini berbeda sifatnya dari K-1 sampai K-8. Semua yang sebelumnya
-- dipakai pengurus dan petugas — orang yang jumlahnya belasan, yang dikenal
-- namanya, dan yang aksesnya diberikan satu per satu.
--
-- Portal anggota dibuka kepada RATUSAN orang sekaligus, dan situsnya dibuka
-- kepada siapa saja yang mengetahui alamatnya. Itu mengubah dua hal:
--
--   1. Cakupan datanya menjadi yang paling ketat di seluruh modul. Bukan
--      "anggota melihat data koperasinya" melainkan "anggota melihat barisnya
--      sendiri". Setiap tabel di sini karena itu membawa member_id, dan setiap
--      pembacaannya melewati aturan yang sama pada cooperative-portal.ts.
--
--   2. Ada pintu yang menerima kiriman dari orang yang belum dikenal sama
--      sekali — formulir pendaftaran calon anggota. Kiriman itu TIDAK boleh
--      langsung menjadi baris cooperative_member.
--
-- Semua tabel memakai {{TENANT_SCHEMA}}: skema per koperasi, bukan kolom
-- pembeda. Lihat docs/ekoperasi/09-isolasi-data-antar-koperasi.md.
-- =============================================================================

SET LOCAL search_path TO "{{TENANT_SCHEMA}}";

-- -----------------------------------------------------------------------------
-- 1. Pengaturan situs koperasi
-- -----------------------------------------------------------------------------
-- Satu baris per koperasi. Menentukan apa yang tampil di situs publik dan —
-- yang lebih penting — apa yang TIDAK tampil.
--
-- `show_member_count` dan `show_asset_total` bawaannya false. Jumlah anggota
-- dan besar aset adalah angka yang sering diminta ditampilkan untuk meyakinkan
-- calon anggota, tetapi keduanya juga angka yang dipakai orang lain untuk
-- menilai apakah koperasi ini layak didekati. Menampilkannya adalah pilihan
-- sadar pengurus, bukan bawaan yang baru disadari setelah terlanjur tampil.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_website_setting (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,

  is_published                BOOLEAN NOT NULL DEFAULT false,
  tagline                     VARCHAR(255),
  about_html                  TEXT,
  hero_image_url              VARCHAR(500),
  logo_url                    VARCHAR(500),
  primary_color               VARCHAR(16),

  contact_email               VARCHAR(160),
  contact_phone               VARCHAR(40),
  contact_whatsapp            VARCHAR(40),
  public_address              TEXT,
  map_embed_url               VARCHAR(500),

  -- Angka yang ditampilkan hanya bila pengurus memilihnya. Lihat catatan di atas.
  show_member_count           BOOLEAN NOT NULL DEFAULT false,
  show_asset_total            BOOLEAN NOT NULL DEFAULT false,
  show_board_members          BOOLEAN NOT NULL DEFAULT true,
  show_saving_products        BOOLEAN NOT NULL DEFAULT true,
  show_loan_products          BOOLEAN NOT NULL DEFAULT true,

  -- Pendaftaran daring dapat ditutup tanpa menurunkan seluruh situs, misalnya
  -- ketika pengurus sedang tidak sanggup memeriksa berkas yang masuk.
  accepts_online_application  BOOLEAN NOT NULL DEFAULT false,
  application_notice_html     TEXT,

  meta_description            VARCHAR(320),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version                     INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_website_setting_single
  ON "{{TENANT_SCHEMA}}".cooperative_website_setting (cooperative_id);

-- -----------------------------------------------------------------------------
-- 2. Halaman situs
-- -----------------------------------------------------------------------------
-- Halaman statis: profil, sejarah, struktur organisasi, syarat keanggotaan,
-- kebijakan privasi.
--
-- Halaman TIDAK terbit sampai published_at diisi. Draf yang tampil karena
-- lupa diberi tanda adalah cara paling mudah menerbitkan sesuatu yang belum
-- selesai ditulis ke internet.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_website_page (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  slug            VARCHAR(120) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  content_html    TEXT,
  page_type       VARCHAR(32) NOT NULL DEFAULT 'CUSTOM',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  show_in_menu    BOOLEAN NOT NULL DEFAULT true,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_page_type CHECK (page_type IN (
    'PROFILE', 'HISTORY', 'ORGANIZATION', 'MEMBERSHIP_REQUIREMENT',
    'SAVING_PRODUCT', 'LOAN_PRODUCT', 'PRIVACY', 'CONTACT', 'CUSTOM'
  )),
  -- Slug hanya huruf kecil, angka, dan tanda hubung. Slug yang membawa
  -- karakter lain menjadi alamat yang tidak dapat ditebak bentuknya dan
  -- membuka jalan ke penyalahgunaan pemetaan rute.
  CONSTRAINT ck_coop_page_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_page_slug
  ON "{{TENANT_SCHEMA}}".cooperative_website_page (cooperative_id, slug);

-- -----------------------------------------------------------------------------
-- 3. Pengumuman
-- -----------------------------------------------------------------------------
-- Dibaca di dua tempat: situs publik (bila audience = 'PUBLIC') dan portal
-- anggota (bila 'MEMBER' atau 'PUBLIC').
--
-- Pemisahan audience penting: undangan RAT memuat tempat, waktu, dan kadang
-- nomor rekening — keterangan yang berguna bagi anggota dan berguna pula bagi
-- orang yang berniat mengaku sebagai koperasi ini.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_announcement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  body_html       TEXT,
  audience        VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
  category        VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
  is_pinned       BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  meeting_id      UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting (id) ON DELETE SET NULL,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_ann_audience CHECK (audience IN ('PUBLIC', 'MEMBER', 'BOARD')),
  CONSTRAINT ck_coop_ann_category CHECK (category IN (
    'GENERAL', 'MEETING', 'SHU', 'PRODUCT', 'REGULATION', 'EMERGENCY'
  )),
  CONSTRAINT ck_coop_ann_period CHECK (expires_at IS NULL OR published_at IS NULL OR expires_at > published_at)
);

CREATE INDEX IF NOT EXISTS ix_coop_ann_published
  ON "{{TENANT_SCHEMA}}".cooperative_announcement (cooperative_id, audience, published_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Pendaftaran calon anggota lewat situs
-- -----------------------------------------------------------------------------
-- Tabel karantina. Kiriman dari internet berhenti DI SINI dan tidak pernah
-- langsung menjadi baris cooperative_member.
--
-- Alasannya: formulir publik dapat diisi siapa saja, berapa kali pun,
-- dengan nama siapa saja. Bila kirimannya langsung menjadi calon anggota,
-- maka siapa pun di internet dapat menumbuhkan daftar anggota koperasi orang
-- lain, memasukkan nama orang yang tidak pernah mendaftar, dan mengisi basis
-- data koperasi dengan data pribadi yang bukan miliknya.
--
-- Pengurus memeriksa, lalu menerbitkan baris cooperative_member — dan
-- `converted_member_id` menyimpan hubungannya supaya asal-usul setiap anggota
-- yang masuk lewat internet tetap dapat ditelusuri.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_public_application (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  application_number  VARCHAR(40) NOT NULL,

  full_name           VARCHAR(255) NOT NULL,
  email               VARCHAR(160),
  phone               VARCHAR(40) NOT NULL,
  birth_date          DATE,
  occupation          VARCHAR(120),
  address             TEXT,
  motivation          TEXT,
  referrer_member_id  UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,

  -- Persetujuan pengolahan data pribadi diambil di formulirnya dan disimpan
  -- bersama waktunya. Tanpa ini, koperasi menyimpan data pribadi orang yang
  -- tidak pernah menyatakan setuju — dan tidak dapat membuktikan sebaliknya.
  consent_given       BOOLEAN NOT NULL DEFAULT false,
  consent_at          TIMESTAMPTZ,
  consent_text_hash   VARCHAR(64),

  status              VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
  review_note         TEXT,
  reviewed_by         UUID,
  reviewed_at         TIMESTAMPTZ,
  converted_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,

  -- Untuk pembatasan laju dan penelusuran kiriman berulang. Bukan untuk
  -- ditampilkan kepada siapa pun.
  source_ip_hash      VARCHAR(64),
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_app_status CHECK (status IN (
    'SUBMITTED', 'UNDER_REVIEW', 'NEED_DOCUMENT', 'APPROVED', 'REJECTED', 'EXPIRED'
  )),
  -- Persetujuan wajib bertanggal. Nilai true tanpa waktunya tidak membuktikan
  -- apa pun.
  CONSTRAINT ck_coop_app_consent CHECK (consent_given = false OR consent_at IS NOT NULL),
  -- Kiriman tidak boleh disimpan tanpa persetujuan sama sekali.
  CONSTRAINT ck_coop_app_consent_required CHECK (consent_given = true),
  -- Lamaran yang DISETUJUI wajib menunjuk anggota yang diterbitkannya.
  -- Tanpa ini, "disetujui" dapat berarti tidak terjadi apa-apa.
  CONSTRAINT ck_coop_app_approved_link CHECK (
    status <> 'APPROVED' OR converted_member_id IS NOT NULL
  ),
  -- Penolakan wajib beralasan. Calon anggota berhak tahu mengapa.
  CONSTRAINT ck_coop_app_rejected_reason CHECK (
    status <> 'REJECTED' OR (review_note IS NOT NULL AND length(btrim(review_note)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_app_number
  ON "{{TENANT_SCHEMA}}".cooperative_public_application (cooperative_id, application_number);

-- Satu anggota hanya boleh berasal dari satu lamaran.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_app_converted
  ON "{{TENANT_SCHEMA}}".cooperative_public_application (converted_member_id)
  WHERE converted_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_coop_app_status
  ON "{{TENANT_SCHEMA}}".cooperative_public_application (cooperative_id, status, submitted_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Pengaduan anggota
-- -----------------------------------------------------------------------------
-- Hak anggota untuk menyatakan keberatan adalah bagian dari tata kelola
-- koperasi, bukan fitur pelayanan pelanggan.
--
-- Dua hal ditegakkan di sini:
--   · Pengaduan tidak dapat dihapus, hanya berpindah status sampai CLOSED.
--     Pengaduan yang dapat dihapus adalah pengaduan yang dapat dihilangkan
--     oleh orang yang isinya menegur dirinya.
--   · Pengaduan anonim tetap menyimpan member_id di basis data, tetapi
--     `is_anonymous` menahan namanya dari tampilan pengurus. Menyimpan
--     pengaduan benar-benar tanpa pemilik membuatnya tidak dapat ditindak-
--     lanjuti dan membuka jalan bagi kiriman massal.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_complaint (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,
  complaint_number  VARCHAR(40) NOT NULL,

  category          VARCHAR(32) NOT NULL DEFAULT 'OTHER',
  subject           VARCHAR(255) NOT NULL,
  body              TEXT NOT NULL,
  is_anonymous      BOOLEAN NOT NULL DEFAULT false,
  severity          VARCHAR(16) NOT NULL DEFAULT 'NORMAL',

  status            VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
  assigned_to       UUID,
  resolution        TEXT,
  resolved_at       TIMESTAMPTZ,
  closed_by         UUID,
  closed_at         TIMESTAMPTZ,

  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_complaint_status CHECK (status IN (
    'SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'
  )),
  CONSTRAINT ck_coop_complaint_category CHECK (category IN (
    'SERVICE', 'SAVING', 'LOAN', 'SHU', 'GOVERNANCE', 'STAFF', 'UNIT_BUSINESS', 'OTHER'
  )),
  CONSTRAINT ck_coop_complaint_severity CHECK (severity IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  -- Pengaduan yang dinyatakan selesai wajib memuat penyelesaiannya. "RESOLVED"
  -- tanpa keterangan tidak dapat dibedakan dari pengaduan yang diabaikan.
  CONSTRAINT ck_coop_complaint_resolution CHECK (
    status NOT IN ('RESOLVED', 'REJECTED')
    OR (resolution IS NOT NULL AND length(btrim(resolution)) > 0)
  ),
  -- Penutupan wajib menyebutkan siapa yang menutup. Anggota tidak berwenang
  -- menutup pengaduannya sendiri; wewenang itu harus dapat ditelusuri orangnya.
  CONSTRAINT ck_coop_complaint_closed_by CHECK (
    status <> 'CLOSED' OR (closed_by IS NOT NULL AND closed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_complaint_number
  ON "{{TENANT_SCHEMA}}".cooperative_complaint (cooperative_id, complaint_number);

CREATE INDEX IF NOT EXISTS ix_coop_complaint_member
  ON "{{TENANT_SCHEMA}}".cooperative_complaint (member_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS ix_coop_complaint_status
  ON "{{TENANT_SCHEMA}}".cooperative_complaint (cooperative_id, status, submitted_at DESC);

-- Tanggapan atas pengaduan, dari kedua pihak.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_complaint_response (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_complaint (id) ON DELETE CASCADE,
  author_type   VARCHAR(16) NOT NULL,
  author_id     UUID,
  body          TEXT NOT NULL,
  -- Catatan internal tidak pernah tampil di portal anggota. Pengurus perlu
  -- tempat berdiskusi tanpa membuat setiap pertimbangannya menjadi jawaban
  -- resmi kepada pelapor.
  is_internal   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_coop_cresp_author CHECK (author_type IN ('MEMBER', 'STAFF', 'BOARD', 'SYSTEM')),
  -- Anggota tidak dapat menulis catatan internal.
  CONSTRAINT ck_coop_cresp_internal CHECK (author_type <> 'MEMBER' OR is_internal = false)
);

CREATE INDEX IF NOT EXISTS ix_coop_cresp_complaint
  ON "{{TENANT_SCHEMA}}".cooperative_complaint_response (complaint_id, created_at);

-- -----------------------------------------------------------------------------
-- 6. Pemberitahuan kepada anggota
-- -----------------------------------------------------------------------------
-- Angsuran jatuh tempo, SHU dibagikan, undangan RAT, pengaduan dijawab.
--
-- Isinya sengaja RINGKAS dan tidak memuat angka rinci. Pemberitahuan berjalan
-- lewat surel dan pesan singkat — kanal yang tidak dikendalikan koperasi dan
-- sering terbaca pada layar terkunci. "Angsuran Anda jatuh tempo 5 Agustus"
-- cukup; "Angsuran Rp2.350.000 atas pinjaman Rp30.000.000" memberitahu lebih
-- banyak kepada siapa pun yang kebetulan melihat layar itu.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_notification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  kind            VARCHAR(40) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  -- Tautan dalam portal, bukan alamat luar. Pemberitahuan yang membawa alamat
  -- luar melatih anggota menekan tautan yang dikirim mengatasnamakan koperasi.
  link_path       VARCHAR(255),
  reference_type  VARCHAR(40),
  reference_id    UUID,
  channel         VARCHAR(16) NOT NULL DEFAULT 'PORTAL',
  read_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_coop_notif_channel CHECK (channel IN ('PORTAL', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH')),
  CONSTRAINT ck_coop_notif_kind CHECK (kind IN (
    'INSTALLMENT_DUE', 'INSTALLMENT_OVERDUE', 'INSTALLMENT_RECEIVED',
    'SAVING_RECEIVED', 'SAVING_WITHDRAWN', 'MANDATORY_SAVING_DUE',
    'LOAN_APPROVED', 'LOAN_REJECTED', 'LOAN_DISBURSED',
    'SHU_ALLOCATED', 'SHU_PAID',
    'MEETING_INVITATION', 'MEETING_RESULT', 'VOTE_OPEN',
    'COMPLAINT_RESPONDED', 'COMPLAINT_RESOLVED',
    'APPLICATION_APPROVED', 'APPLICATION_REJECTED',
    'ANNOUNCEMENT', 'PORTAL_SECURITY'
  )),
  -- Tautan wajib relatif terhadap portal.
  CONSTRAINT ck_coop_notif_link CHECK (link_path IS NULL OR link_path ~ '^/[A-Za-z0-9._~/-]*$')
);

CREATE INDEX IF NOT EXISTS ix_coop_notif_member
  ON "{{TENANT_SCHEMA}}".cooperative_notification (member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_coop_notif_unread
  ON "{{TENANT_SCHEMA}}".cooperative_notification (member_id)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- 7. Jejak aktivitas portal
-- -----------------------------------------------------------------------------
-- Mencatat SIAPA membaca APA lewat portal.
--
-- Diperlukan karena portal adalah permukaan terbesar modul ini dan satu-
-- satunya yang dibuka kepada orang di luar kantor koperasi. Bila kelak ada
-- dugaan seseorang membaca data anggota lain, tabel inilah yang dapat
-- menjawabnya — atau membuktikan bahwa hal itu tidak terjadi.
--
-- Hanya menyimpan JENIS sumber daya dan hasilnya, tidak isinya. Jejak audit
-- yang menyalin isi data yang dibacanya menggandakan justru data yang hendak
-- dilindunginya.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_portal_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id       UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,
  action          VARCHAR(40) NOT NULL,
  resource        VARCHAR(40),
  resource_id     UUID,
  outcome         VARCHAR(16) NOT NULL DEFAULT 'ALLOWED',
  deny_code       VARCHAR(40),
  ip_hash         VARCHAR(64),
  user_agent_hash VARCHAR(64),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_coop_pact_outcome CHECK (outcome IN ('ALLOWED', 'DENIED', 'ERROR')),
  -- Penolakan wajib menyebutkan alasannya dalam bentuk kode. Jejak yang hanya
  -- mengatakan "ditolak" tidak dapat membedakan salah ketik dari percobaan
  -- membaca data orang lain.
  CONSTRAINT ck_coop_pact_deny CHECK (outcome <> 'DENIED' OR deny_code IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_coop_pact_member
  ON "{{TENANT_SCHEMA}}".cooperative_portal_activity (member_id, occurred_at DESC);

-- Indeks khusus penolakan: yang dicari saat menyelidiki adalah percobaan yang
-- gagal, dan jumlahnya jauh lebih sedikit daripada pembacaan biasa.
CREATE INDEX IF NOT EXISTS ix_coop_pact_denied
  ON "{{TENANT_SCHEMA}}".cooperative_portal_activity (cooperative_id, occurred_at DESC)
  WHERE outcome = 'DENIED';
