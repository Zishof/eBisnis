-- =========================================================================
-- ePesantren — Atribusi gambar latar
-- =========================================================================
--
-- Gambar latar (hero) bawaan yang diseed untuk pelanggan pertama bersumber
-- dari Wikimedia Commons berlisensi CC BY-SA 4.0, yang MEWAJIBKAN atribusi.
-- Kolom ini terpisah dari `hero_image_url` supaya keterangan sumbernya
-- MENGIKUTI gambarnya: begitu pengurus mengunggah gambar latar miliknya
-- sendiri, kolom ini WAJIB dikosongkan bersamaan (lihat
-- `PesantrenProfilService.unggahGambar`) -- tanpa itu, foto pengurus sendiri
-- akan tertera "kredit" fotografer Wikimedia yang tidak pernah memotretnya.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_website_setting
  ADD COLUMN IF NOT EXISTS hero_image_attribution VARCHAR(255);
