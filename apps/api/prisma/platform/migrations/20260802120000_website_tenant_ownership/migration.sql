-- Kepemilikan penyewa pada situs CMS (EP-C).
--
-- Mesin CMS ini melayani banyak SITUS, bukan banyak PENYEWA. Tanpa kolom ini,
-- endpoint publik CMS tidak dapat membedakan situs platform dari situs pondok
-- pesantren — penghalang tepat bagi janji "berita disunting pondok sendiri"
-- yang sudah tertulis pada halaman pemasaran santri.info.
--
-- Murni aditif. NULL berarti milik platform sendiri, sebagaimana seluruh baris
-- yang sudah ada sebelum migrasi ini. Tidak ada baris yang perlu diisi ulang.

ALTER TABLE "platform"."website"
  ADD COLUMN "tenant_id" UUID;

ALTER TABLE "platform"."website"
  ADD CONSTRAINT "website_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "website_tenant_id_idx" ON "platform"."website" ("tenant_id");
