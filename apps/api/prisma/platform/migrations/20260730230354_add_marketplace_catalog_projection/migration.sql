-- CreateTable
CREATE TABLE "marketplace_category" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(96) NOT NULL,
    "path" VARCHAR(512) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "icon_name" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_restricted" BOOLEAN NOT NULL DEFAULT false,
    "restriction_note" TEXT,
    "is_leaf" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "marketplace_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing_projection" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tenant_schema" VARCHAR(72) NOT NULL,
    "tenant_listing_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "condition" VARCHAR(24) NOT NULL,
    "min_price" DECIMAL(19,4) NOT NULL,
    "max_price" DECIMAL(19,4) NOT NULL,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "availability" VARCHAR(24) NOT NULL DEFAULT 'IN_STOCK',
    "primary_image_key" VARCHAR(512),
    "image_count" INTEGER NOT NULL DEFAULT 0,
    "youtube_video_id" VARCHAR(16),
    "store_name" VARCHAR(160) NOT NULL,
    "store_slug" VARCHAR(96) NOT NULL,
    "source_updated_at" TIMESTAMPTZ(6) NOT NULL,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_document" tsvector,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_listing_projection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_projection_run" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tenant_schema" VARCHAR(72) NOT NULL,
    "events_read" INTEGER NOT NULL DEFAULT 0,
    "events_applied" INTEGER NOT NULL DEFAULT 0,
    "events_skipped" INTEGER NOT NULL DEFAULT 0,
    "events_failed" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "last_error" TEXT,

    CONSTRAINT "marketplace_projection_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_category_parent_id_sort_order_idx" ON "marketplace_category"("parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "marketplace_category_is_active_is_leaf_idx" ON "marketplace_category"("is_active", "is_leaf");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_category_code_key" ON "marketplace_category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_category_slug_key" ON "marketplace_category"("slug");

-- CreateIndex
CREATE INDEX "marketplace_listing_projection_category_id_min_price_idx" ON "marketplace_listing_projection"("category_id", "min_price");

-- CreateIndex
CREATE INDEX "marketplace_listing_projection_store_id_idx" ON "marketplace_listing_projection"("store_id");

-- CreateIndex
CREATE INDEX "marketplace_listing_projection_seller_id_idx" ON "marketplace_listing_projection"("seller_id");

-- CreateIndex
CREATE INDEX "marketplace_listing_projection_availability_synced_at_idx" ON "marketplace_listing_projection"("availability", "synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listing_projection_tenant_id_tenant_listing_id_key" ON "marketplace_listing_projection"("tenant_id", "tenant_listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listing_projection_slug_key" ON "marketplace_listing_projection"("slug");

-- CreateIndex
CREATE INDEX "marketplace_projection_run_tenant_id_started_at_idx" ON "marketplace_projection_run"("tenant_id", "started_at");

-- AddForeignKey
ALTER TABLE "marketplace_category" ADD CONSTRAINT "marketplace_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "marketplace_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_projection" ADD CONSTRAINT "marketplace_listing_projection_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_projection" ADD CONSTRAINT "marketplace_listing_projection_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "marketplace_store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_projection" ADD CONSTRAINT "marketplace_listing_projection_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "marketplace_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indeks pencarian teks penuh.
--
-- PostgreSQL 13 tidak punya konfigurasi bahasa Indonesia bawaan, sehingga
-- 'simple' dipakai: ia memecah kata tanpa stemming. Untuk katalog produk itu
-- justru lebih dapat diramalkan — "sepatu" tidak berubah menjadi "sepat", dan
-- pencarian nama merek tetap utuh.
CREATE INDEX IF NOT EXISTS idx_listing_projection_search
  ON "platform"."marketplace_listing_projection" USING GIN ("search_document");

-- Trigram untuk pencarian sebagian kata dan salah ketik ringan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_listing_projection_title_trgm
  ON "platform"."marketplace_listing_projection" USING GIN (title gin_trgm_ops);

-- Dokumen pencarian dibentuk trigger, bukan aplikasi. Menaruhnya di aplikasi
-- berarti satu jalur penulisan yang lupa memanggilnya menghasilkan baris yang
-- tidak pernah muncul pada pencarian.
CREATE OR REPLACE FUNCTION "platform".marketplace_listing_search_document()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_document :=
      setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A')
   || setweight(to_tsvector('simple', coalesce(NEW.store_name, '')), 'B')
   || setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listing_projection_search ON "platform"."marketplace_listing_projection";
CREATE TRIGGER trg_listing_projection_search
  BEFORE INSERT OR UPDATE OF title, description, store_name
  ON "platform"."marketplace_listing_projection"
  FOR EACH ROW EXECUTE FUNCTION "platform".marketplace_listing_search_document();
