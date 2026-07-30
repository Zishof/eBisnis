-- =========================================================================
-- V013 — LISTING PRODUK ONLINE DAN MEDIANYA
--
-- Listing MENUNJUK produk, tidak menggandakannya. Nama dan harga dasar tetap
-- milik `product` dan `price_book_item`; yang ditambahkan di sini adalah hal
-- yang khusus penjualan online: judul dan deskripsi versi toko, kategori
-- marketplace, media, kebijakan pengiriman per produk, dan status publikasi.
--
-- Menyalin nama dan harga produk ke listing akan menghasilkan dua sumber
-- kebenaran yang segera menyimpang.
--
-- `file_object` sudah ada sejak V001 tetapi belum dipakai satu pun service.
-- Media listing menjadi pemakai pertamanya; tidak ada tabel penyimpanan berkas
-- kedua yang dibuat.
--
-- Additive. Tidak ada tabel maupun kolom lama yang diubah.
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".online_listing (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(64) NOT NULL,
  product_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,

  -- Judul dan deskripsi versi toko. Berbeda dari nama produk internal, yang
  -- sering memuat kode dan singkatan yang tidak berarti bagi pembeli.
  title         VARCHAR(200),
  description   TEXT,
  condition     VARCHAR(24),

  -- Kategori marketplace tinggal di schema platform; yang disimpan hanya
  -- rujukannya. Tidak diberi foreign key karena beda schema.
  marketplace_category_ref UUID,
  tax_category_id UUID REFERENCES "{{TENANT_SCHEMA}}".tax_category (id) ON DELETE RESTRICT,

  -- Hanya id video, bukan URL. Alamat embed dibangun sistem, sehingga apa pun
  -- yang dikirim penjual tidak pernah menjadi bagian dari HTML.
  youtube_video_id VARCHAR(16),

  status        VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  published_at  TIMESTAMPTZ,
  published_by  UUID,
  unpublished_at TIMESTAMPTZ,

  -- Hasil gerbang publikasi terakhir. Disimpan agar penjual melihat alasan
  -- yang sama dengan yang dilihat sistem, bukan pesan umum.
  gate_snapshot   JSONB,
  gate_checked_at TIMESTAMPTZ,

  compliance_status VARCHAR(24),
  compliance_checked_at TIMESTAMPTZ,

  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample     BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  deactivated_at TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID,
  delete_reason TEXT,
  version       INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_online_listing_status CHECK (status IN (
    'DRAFT','INCOMPLETE','VALIDATION_FAILED','READY_FOR_REVIEW','IN_REVIEW',
    'APPROVED','PUBLISHED','PAUSED','OUT_OF_STOCK','REJECTED','SUSPENDED','ARCHIVED'
  )),
  CONSTRAINT ck_online_listing_condition CHECK (
    condition IS NULL OR condition IN ('NEW','USED','REFURBISHED')
  ),
  -- Id video YouTube selalu 11 karakter base64url. Batasan ini menjadi penjaga
  -- terakhir bila validasi aplikasi terlewat.
  CONSTRAINT ck_online_listing_youtube CHECK (
    youtube_video_id IS NULL OR youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_online_listing_code
  ON "{{TENANT_SCHEMA}}".online_listing (code) WHERE deleted_at IS NULL;

-- Satu produk hanya boleh punya satu listing aktif. Dua listing untuk produk
-- yang sama berarti dua harga dan dua stok untuk barang yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS ux_online_listing_product
  ON "{{TENANT_SCHEMA}}".online_listing (product_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_online_listing_status
  ON "{{TENANT_SCHEMA}}".online_listing (status) WHERE deleted_at IS NULL;

-- Varian yang dijual online -------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".online_listing_variant (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".online_listing (id) ON DELETE CASCADE,
  sku         VARCHAR(64) NOT NULL,
  variant_name VARCHAR(160),
  uom_id      UUID REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,

  -- Harga jual online. Terpisah dari price_book karena harga kanal online
  -- sering berbeda, dan pesanan menunjuk harga yang berlaku saat itu.
  price_minor NUMERIC(19,4),
  compare_at_price_minor NUMERIC(19,4),
  currency_code VARCHAR(8) NOT NULL DEFAULT 'IDR',

  stock_qty     NUMERIC(19,6) NOT NULL DEFAULT 0,
  allow_preorder BOOLEAN NOT NULL DEFAULT FALSE,
  preorder_days  INTEGER,

  weight_gram INTEGER,
  length_mm   INTEGER,
  width_mm    INTEGER,
  height_mm   INTEGER,

  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID,
  deleted_at  TIMESTAMPTZ,
  version     INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_online_variant_price CHECK (price_minor IS NULL OR price_minor > 0),
  CONSTRAINT ck_online_variant_dimensions CHECK (
    (weight_gram IS NULL OR weight_gram > 0)
    AND (length_mm IS NULL OR length_mm > 0)
    AND (width_mm  IS NULL OR width_mm  > 0)
    AND (height_mm IS NULL OR height_mm > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_online_variant_sku
  ON "{{TENANT_SCHEMA}}".online_listing_variant (listing_id, sku) WHERE deleted_at IS NULL;

-- Media listing -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".online_listing_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".online_listing (id) ON DELETE CASCADE,
  -- Berkasnya sendiri tinggal di file_object; ini hanya menunjuknya.
  file_object_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".file_object (id) ON DELETE RESTRICT,
  variant_id  UUID REFERENCES "{{TENANT_SCHEMA}}".online_listing_variant (id) ON DELETE SET NULL,

  -- Hasil validasi. Disimpan supaya gerbang publikasi tidak perlu membuka
  -- berkas ulang setiap kali diperiksa.
  image_format VARCHAR(8) NOT NULL,
  width_px     INTEGER NOT NULL,
  height_px    INTEGER NOT NULL,
  -- Hash isi berkas, untuk mengenali gambar yang sama diunggah berulang.
  content_hash VARCHAR(64) NOT NULL,

  alt_text    VARCHAR(255),
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,

  moderation_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  moderated_at      TIMESTAMPTZ,
  moderated_by      UUID,
  moderation_note   TEXT,

  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID,
  deleted_at  TIMESTAMPTZ,
  version     INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_online_media_format CHECK (image_format IN ('JPEG','PNG','WEBP','GIF')),
  CONSTRAINT ck_online_media_dimension CHECK (width_px > 0 AND height_px > 0),
  CONSTRAINT ck_online_media_moderation CHECK (
    moderation_status IN ('PENDING','APPROVED','REJECTED')
  )
);

-- Hanya satu gambar utama per listing. Dua gambar utama membuat sampul produk
-- tidak dapat ditentukan.
CREATE UNIQUE INDEX IF NOT EXISTS ux_online_media_primary
  ON "{{TENANT_SCHEMA}}".online_listing_media (listing_id)
  WHERE is_primary AND is_active AND deleted_at IS NULL;

-- Gambar yang sama tidak diunggah dua kali pada satu listing.
CREATE UNIQUE INDEX IF NOT EXISTS ux_online_media_hash
  ON "{{TENANT_SCHEMA}}".online_listing_media (listing_id, content_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_online_media_listing
  ON "{{TENANT_SCHEMA}}".online_listing_media (listing_id, sort_order)
  WHERE is_active AND deleted_at IS NULL;

-- Riwayat publikasi ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".online_listing_publication (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".online_listing (id) ON DELETE CASCADE,
  from_status VARCHAR(24),
  to_status   VARCHAR(24) NOT NULL,
  reason      TEXT,
  -- Hasil gerbang saat perpindahan, agar penolakan dapat ditelusuri kemudian.
  gate_snapshot JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id    UUID,
  request_id  VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_online_publication_listing
  ON "{{TENANT_SCHEMA}}".online_listing_publication (listing_id, occurred_at DESC);

-- Audit ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'online_listing', 'online_listing_variant', 'online_listing_media'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
