-- =========================================================================
-- VILLAGE D-10 — SITUS, PORTAL WARGA, KIOSK, DAN SIARAN
-- =========================================================================
--
-- ## Kiosk menghapus jejaknya, dan itu ditegakkan constraint
--
-- Kiosk di balai desa dipakai bergantian. Warga berikutnya berdiri di depan
-- layar yang sama kurang dari satu menit setelah yang sebelumnya pergi, sering
-- tanpa menekan apa pun untuk keluar. Karena itu:
--
--     CHECK (ended_at IS NULL OR (resident_id IS NULL
--                                 AND search_term IS NULL
--                                 AND last_view_payload IS NULL))
--
-- Sesi yang berakhir tetapi masih menyimpan jejaknya ditolak basis data.
-- Menutupi layar tidak cukup — tombol "kembali" mengembalikannya.
--
-- ## Siaran tidak dapat menyatakan terkirim tanpa bukti
--
--     CHECK (status <> 'TERKIRIM' OR provider_reference IS NOT NULL)
--
-- Kanal tanpa kredensial menghasilkan `TERHALANG`, bukan `GAGAL` dan bukan
-- `TERKIRIM`. Perbedaannya bukan istilah: `GAGAL` mengundang percobaan ulang
-- yang tidak akan pernah berhasil, dan `TERKIRIM` adalah kebohongan yang akan
-- diulang pemerintah desa kepada warganya ketika ditanya mengapa pesannya tidak
-- sampai.
--
-- ## Portal warga hanya diri dan keluarga
--
-- `village_portal_link` menautkan akun ke penduduk, satu lawan satu, dan
-- penautannya dilakukan petugas — bukan pemilik akun. Seluruh kueri portal
-- berangkat dari tautan ini, bukan dari pengenal yang datang bersama
-- permintaan.

-- ---------------------------------------------------------------------------
-- Halaman situs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_page (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  slug            VARCHAR(160) NOT NULL,
  title           VARCHAR(300) NOT NULL,
  body            TEXT NOT NULL,
  summary         TEXT,
  menu_label      VARCHAR(120),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  show_in_menu    BOOLEAN NOT NULL DEFAULT TRUE,

  status          VARCHAR(16) NOT NULL DEFAULT 'DRAF',
  published_at    TIMESTAMPTZ,
  published_by    UUID,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_page_status_valid CHECK (status IN ('DRAF','TERJADWAL','TAYANG','DIARSIPKAN')),
  -- Halaman kosong yang tayang lebih buruk daripada halaman yang belum ada:
  -- yang belum ada tidak menjanjikan apa-apa, yang kosong menjanjikan lalu
  -- tidak memberi.
  CONSTRAINT village_page_published_has_body
    CHECK (status <> 'TAYANG' OR (length(btrim(body)) >= 20 AND published_at IS NOT NULL)),
  CONSTRAINT village_page_slug_shape CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS village_page_slug_unique
  ON "{{TENANT_SCHEMA}}".village_page (village_unit_id, slug) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Berita
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_news (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  slug            VARCHAR(200) NOT NULL,
  title           VARCHAR(300) NOT NULL,
  summary         TEXT,
  body            TEXT NOT NULL,
  category        VARCHAR(48),
  cover_path      VARCHAR(500),
  -- Nama penulis sebagaimana hendak ditampilkan. BUKAN rujukan ke penduduk:
  -- penulis berita bukan data kependudukan, dan menautkannya membuat halaman
  -- publik menunjuk ke tabel yang seluruh isinya pribadi.
  author_name     VARCHAR(200),

  status          VARCHAR(16) NOT NULL DEFAULT 'DRAF',
  published_at    TIMESTAMPTZ,
  published_by    UUID,
  view_count      INTEGER NOT NULL DEFAULT 0,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_news_status_valid CHECK (status IN ('DRAF','TERJADWAL','TAYANG','DIARSIPKAN')),
  CONSTRAINT village_news_published_has_body
    CHECK (status <> 'TAYANG' OR (length(btrim(body)) >= 20 AND published_at IS NOT NULL)),
  CONSTRAINT village_news_scheduled_has_date
    CHECK (status <> 'TERJADWAL' OR published_at IS NOT NULL),
  CONSTRAINT village_news_slug_shape CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT village_news_view_not_negative CHECK (view_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_news_slug_unique
  ON "{{TENANT_SCHEMA}}".village_news (village_unit_id, slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_news_published_idx
  ON "{{TENANT_SCHEMA}}".village_news (village_unit_id, published_at DESC)
  WHERE status = 'TAYANG' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_agenda (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  location        VARCHAR(300),
  organizer       VARCHAR(200),
  -- Agenda internal tidak tampil pada situs publik. Rapat perangkat desa bukan
  -- undangan bagi warga, dan menayangkannya membuat warga datang ke pertemuan
  -- yang tidak menyediakan tempat baginya.
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_agenda_period CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS village_agenda_start_idx
  ON "{{TENANT_SCHEMA}}".village_agenda (village_unit_id, start_at)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Galeri
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_gallery (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  title           VARCHAR(300) NOT NULL,
  caption         TEXT,
  file_path       VARCHAR(500) NOT NULL,
  album           VARCHAR(120),
  taken_at        DATE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS village_gallery_album_idx
  ON "{{TENANT_SCHEMA}}".village_gallery (village_unit_id, album, sort_order)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Tautan akun warga ke data kependudukan
-- ---------------------------------------------------------------------------
-- Penautan dilakukan **petugas** setelah memastikan identitasnya, bukan oleh
-- pemilik akun. Akun yang menautkan dirinya sendiri hanya perlu menebak NIK
-- orang lain untuk membuka datanya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_portal_link (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL,
  resident_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE RESTRICT,

  linked_by       UUID NOT NULL,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_note TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at      TIMESTAMPTZ,
  revoke_reason   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  -- Cara identitasnya dipastikan wajib dicatat. Penautan tanpa keterangan tidak
  -- dapat dibedakan dari penautan yang keliru, dan yang keliru membuka seluruh
  -- data satu keluarga kepada orang lain.
  CONSTRAINT village_portal_link_verified CHECK (length(btrim(verification_note)) >= 10),
  CONSTRAINT village_portal_link_revoke_reason
    CHECK (revoked_at IS NULL OR length(btrim(coalesce(revoke_reason, ''))) >= 5),
  CONSTRAINT village_portal_link_revoked_not_active CHECK (revoked_at IS NULL OR is_active = FALSE)
);

-- Satu akun satu penduduk, dan satu penduduk satu akun.
CREATE UNIQUE INDEX IF NOT EXISTS village_portal_link_user_unique
  ON "{{TENANT_SCHEMA}}".village_portal_link (user_id) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS village_portal_link_resident_unique
  ON "{{TENANT_SCHEMA}}".village_portal_link (resident_id) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Sesi kiosk
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_kiosk_session (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  kiosk_code      VARCHAR(48) NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_touch_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  end_reason      VARCHAR(24),

  -- Jejak layar. Seluruhnya WAJIB kosong begitu sesinya berakhir.
  resident_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  search_term     VARCHAR(200),
  last_view_payload JSONB,
  request_id      VARCHAR(64),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_kiosk_end_reason_valid
    CHECK (end_reason IS NULL OR end_reason IN ('MENGANGGUR','UMUR_MAKSIMAL','DITUTUP_PENGGUNA')),
  CONSTRAINT village_kiosk_ended_has_reason CHECK (ended_at IS NULL OR end_reason IS NOT NULL),
  -- INTI: sesi yang berakhir tidak boleh menyisakan jejak layar. Menutupi layar
  -- tidak cukup — tombol "kembali" mengembalikannya.
  CONSTRAINT village_kiosk_ended_leaves_no_trace
    CHECK (
      ended_at IS NULL
      OR (resident_id IS NULL AND search_term IS NULL AND last_view_payload IS NULL
          AND request_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS village_kiosk_open_idx
  ON "{{TENANT_SCHEMA}}".village_kiosk_session (village_unit_id, kiosk_code)
  WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- Siaran informasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_broadcast (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  title           VARCHAR(300) NOT NULL,
  message         TEXT NOT NULL,
  channel         VARCHAR(24) NOT NULL,
  audience        VARCHAR(32) NOT NULL DEFAULT 'SEMUA_WARGA',
  audience_filter JSONB,
  recipient_count INTEGER NOT NULL DEFAULT 0,

  status          VARCHAR(16) NOT NULL DEFAULT 'DRAF',
  -- Rujukan dari penyedia. Tanpa ini, status tidak dapat menjadi TERKIRIM.
  provider_reference VARCHAR(200),
  blocked_reason  TEXT,
  failure_reason  TEXT,
  queued_at       TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_broadcast_channel_valid
    CHECK (channel IN ('WHATSAPP','SUREL','SMS','PAPAN_INFORMASI')),
  CONSTRAINT village_broadcast_status_valid
    CHECK (status IN ('DRAF','ANTRE','TERKIRIM','GAGAL','TERHALANG')),
  CONSTRAINT village_broadcast_recipient_not_negative CHECK (recipient_count >= 0),
  -- INTI: tidak dapat menyatakan terkirim tanpa bukti dari penyedianya.
  CONSTRAINT village_broadcast_sent_needs_reference
    CHECK (status <> 'TERKIRIM' OR (btrim(coalesce(provider_reference, '')) <> ''
                                    AND sent_at IS NOT NULL)),
  CONSTRAINT village_broadcast_blocked_has_reason
    CHECK (status <> 'TERHALANG' OR length(btrim(coalesce(blocked_reason, ''))) >= 10),
  CONSTRAINT village_broadcast_failed_has_reason
    CHECK (status <> 'GAGAL' OR length(btrim(coalesce(failure_reason, ''))) >= 5)
);

CREATE INDEX IF NOT EXISTS village_broadcast_status_idx
  ON "{{TENANT_SCHEMA}}".village_broadcast (village_unit_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Pemicu audit
-- ---------------------------------------------------------------------------
-- `village_kiosk_session` sengaja TIDAK diaudit. Isinya justru jejak layar yang
-- wajib dihapus saat sesi berakhir; menyalinnya ke tabel audit yang bersifat
-- append-only berarti menyimpan selamanya persis apa yang aturannya
-- memerintahkan untuk dihapus.
DO $install$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi audit tidak ada; pemicu audit D-10 dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}' AND c.relkind = 'r'
       AND c.relname IN (
         'village_page', 'village_news', 'village_agenda', 'village_gallery',
         'village_portal_link', 'village_broadcast'
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
