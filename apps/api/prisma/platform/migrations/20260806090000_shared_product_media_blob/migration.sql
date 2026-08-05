-- Media produk lintas tenant. Satu checksum menyimpan satu BLOB; identitas
-- produk (barcode/nama/kode) menunjuk BLOB yang sama untuk seluruh tenant.
CREATE TABLE IF NOT EXISTS platform.product_media_blob (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash VARCHAR(64) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  content BYTEA NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  source_url VARCHAR(1000),
  source_attribution VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_product_media_blob_hash UNIQUE (content_hash),
  CONSTRAINT ck_product_media_blob_size CHECK (size_bytes > 0 AND size_bytes <= 5242880)
);

CREATE TABLE IF NOT EXISTS platform.product_media_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key VARCHAR(320) NOT NULL,
  normalized_barcode VARCHAR(128),
  normalized_code VARCHAR(128),
  normalized_name VARCHAR(255) NOT NULL,
  media_blob_id UUID NOT NULL REFERENCES platform.product_media_blob(id) ON DELETE RESTRICT,
  match_basis VARCHAR(24) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_product_media_identity_key UNIQUE (canonical_key),
  CONSTRAINT ck_product_media_identity_basis CHECK (match_basis IN ('BARCODE', 'NAME', 'CODE'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_media_identity_barcode
  ON platform.product_media_identity (normalized_barcode)
  WHERE normalized_barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_media_identity_name
  ON platform.product_media_identity (normalized_name);
CREATE INDEX IF NOT EXISTS ix_product_media_identity_code
  ON platform.product_media_identity (normalized_code)
  WHERE normalized_code IS NOT NULL;
