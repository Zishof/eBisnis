-- =========================================================================
-- ePesantren - Media/gallery situs pondok dan unit pendidikan
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_media (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_pendidikan_id  UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (id) ON DELETE SET NULL,
  kategori            VARCHAR(24) NOT NULL DEFAULT 'GALERI',
  judul               VARCHAR(160) NOT NULL,
  deskripsi           TEXT,
  image_url           VARCHAR(500),
  alt_text            VARCHAR(255),
  attribution         VARCHAR(255),
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_published        BOOLEAN NOT NULL DEFAULT TRUE,
  file_code           VARCHAR(120),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID,
  version             INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_media
  ADD CONSTRAINT ck_pesantren_media_kategori
  CHECK (kategori IN ('GALERI', 'PROGRAM', 'FASILITAS', 'KEGIATAN', 'PRESTASI'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_media_file_code
  ON "{{TENANT_SCHEMA}}".pesantren_media (file_code)
  WHERE file_code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_media_publik
  ON "{{TENANT_SCHEMA}}".pesantren_media (unit_pendidikan_id, is_published, sort_order, created_at DESC)
  WHERE deleted_at IS NULL;
