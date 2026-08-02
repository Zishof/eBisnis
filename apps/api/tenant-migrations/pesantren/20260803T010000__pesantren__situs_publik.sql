-- =========================================================================
-- ePesantren — Situs publik pondok dan tema tampilan
-- =========================================================================
--
-- Pola sama dengan K-9 (`cooperative__website_and_member_portal.sql`):
-- pengaturan situs dan berita ada di skema penyewa, dibaca lewat
-- `PublicTenantResolver` (IR-005) berdasarkan host permintaan -- bukan
-- lewat sesi, sebab pengunjungnya belum masuk sama sekali.
--
-- Berbeda dari koperasi: TIDAK ada tabel entitas `pesantren` tersendiri di
-- skema penyewa -- penyewanya SENDIRI adalah pondoknya (lihat
-- `platform.registration_pesantren` untuk identitas legal/perizinan).
-- Karena itu `pesantren_website_setting` adalah satu baris tunggal per
-- skema, ditegakkan lewat kolom `singleton` yang diberi UNIQUE -- percobaan
-- menyisipkan baris kedua akan gagal pada constraint itu, bukan menghasilkan
-- dua pengaturan situs yang bersaing.
--
-- Tema tampilan (`theme_code`) sengaja berupa KODE dari daftar tetap, bukan
-- warna bebas: setiap tema adalah satu set warna yang sudah diperiksa
-- kontras dan keterbacaannya (lihat `apps/web/src/pages/public/pesantren`),
-- bukan sembarang warna yang mungkin membuat teks tidak terbaca.

SET LOCAL search_path TO "{{TENANT_SCHEMA}}";

-- -----------------------------------------------------------------------------
-- 1. Pengaturan situs pondok
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_website_setting (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton         BOOLEAN NOT NULL DEFAULT TRUE,

  is_published      BOOLEAN NOT NULL DEFAULT FALSE,
  theme_code        VARCHAR(24) NOT NULL DEFAULT 'HIJAU_ISLAMI',

  nama_tampilan     VARCHAR(160),
  tagline           VARCHAR(255),
  sejarah_html      TEXT,
  visi              TEXT,
  misi              TEXT,
  pengasuh          VARCHAR(160),
  tahun_berdiri     INTEGER,
  afiliasi          VARCHAR(80),

  logo_url          VARCHAR(500),
  hero_image_url    VARCHAR(500),

  alamat_publik     TEXT,
  kontak_telepon    VARCHAR(40),
  kontak_whatsapp   VARCHAR(40),
  kontak_email      VARCHAR(160),
  map_embed_url     VARCHAR(500),
  instagram_url     VARCHAR(255),

  meta_description  VARCHAR(320),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_website_setting_singleton
  ON "{{TENANT_SCHEMA}}".pesantren_website_setting (singleton);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_website_setting
  ADD CONSTRAINT ck_pesantren_website_setting_singleton CHECK (singleton = TRUE);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_website_setting
  ADD CONSTRAINT ck_pesantren_website_setting_theme CHECK (theme_code IN (
    'HIJAU_ISLAMI', 'EMAS_KHATULISTIWA', 'BIRU_LANGIT', 'COKLAT_KAYU', 'UNGU_LEMBUT'
  ));

-- -----------------------------------------------------------------------------
-- 2. Berita/kabar pondok
-- -----------------------------------------------------------------------------
-- `sumber_url` diisi bila beritanya diadaptasi dari sumber luar (mis. liputan
-- media lokal atas kegiatan pondok) -- supaya asal kutipannya tetap tertaut,
-- bukan seolah-olah ditulis pondok sendiri dari nol.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_berita (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul           VARCHAR(255) NOT NULL,
  ringkasan       VARCHAR(500),
  isi_html        TEXT,
  gambar_url      VARCHAR(500),
  sumber_url      VARCHAR(500),
  status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  tanggal_terbit  DATE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_berita
  ADD CONSTRAINT ck_pesantren_berita_status CHECK (status IN ('DRAFT', 'TERBIT'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_berita
  ADD CONSTRAINT ck_pesantren_berita_terbit_bertanggal
  CHECK (status <> 'TERBIT' OR tanggal_terbit IS NOT NULL);

CREATE INDEX IF NOT EXISTS ix_pesantren_berita_terbit
  ON "{{TENANT_SCHEMA}}".pesantren_berita (status, tanggal_terbit DESC)
  WHERE deleted_at IS NULL;
