-- Sekat situs pada berita dan kategori berita (EP-C2).
--
-- `NewsCategory` dan `NewsArticle` tidak mempunyai kolom situs sama sekali —
-- bukan ambigu seperti `CmsPage` (yang sudah punya `website_id` tetapi
-- `getPage()` lupa menyaringnya), melainkan benar-benar tidak bersekat.
-- `slug` unik secara GLOBAL lintas seluruh situs: begitu situs pondok kedua
-- memilih slug yang sama dengan pondok pertama atau dengan eBisnis.id sendiri,
-- pembuatannya gagal dengan pesan yang tidak masuk akal bagi penggunanya, dan
-- baris yang sudah ada tidak dapat dibedakan situs pemiliknya sama sekali.
--
-- Kolom ini wajib diisi (bukan nullable seperti `website.tenant_id`) sebab
-- setiap kategori/artikel SELALU milik satu situs tertentu. Seluruh baris yang
-- sudah ada diisi ke situs platform sendiri (`tenant_id IS NULL`) — perilaku
-- yang identik dengan yang mereka miliki sebelum migrasi ini, sebab satu-
-- satunya situs yang ada sebelum EP-C hanyalah situs itu.

ALTER TABLE "platform"."news_category"
  ADD COLUMN "website_id" UUID;

ALTER TABLE "platform"."news_article"
  ADD COLUMN "website_id" UUID;

UPDATE "platform"."news_category"
SET "website_id" = (
  SELECT "id" FROM "platform"."website"
  WHERE "tenant_id" IS NULL AND "deleted_at" IS NULL
  ORDER BY "sort_order" ASC
  LIMIT 1
)
WHERE "website_id" IS NULL;

UPDATE "platform"."news_article"
SET "website_id" = (
  SELECT "id" FROM "platform"."website"
  WHERE "tenant_id" IS NULL AND "deleted_at" IS NULL
  ORDER BY "sort_order" ASC
  LIMIT 1
)
WHERE "website_id" IS NULL;

ALTER TABLE "platform"."news_category"
  ALTER COLUMN "website_id" SET NOT NULL;

ALTER TABLE "platform"."news_article"
  ALTER COLUMN "website_id" SET NOT NULL;

ALTER TABLE "platform"."news_category"
  ADD CONSTRAINT "news_category_website_id_fkey"
  FOREIGN KEY ("website_id") REFERENCES "platform"."website"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."news_article"
  ADD CONSTRAINT "news_article_website_id_fkey"
  FOREIGN KEY ("website_id") REFERENCES "platform"."website"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "platform"."news_category_slug_key";
CREATE UNIQUE INDEX "news_category_website_id_slug_key" ON "platform"."news_category" ("website_id", "slug");
CREATE INDEX "news_category_website_id_idx" ON "platform"."news_category" ("website_id");

DROP INDEX "platform"."news_article_slug_key";
CREATE UNIQUE INDEX "news_article_website_id_slug_key" ON "platform"."news_article" ("website_id", "slug");
CREATE INDEX "news_article_website_id_idx" ON "platform"."news_article" ("website_id");
