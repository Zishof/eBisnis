-- =========================================================================
-- ePesantren -- Visual situs per unit pendidikan
-- =========================================================================
--
-- Unit pendidikan dapat memiliki identitas visual sendiri (logo dan foto hero)
-- tanpa memutus keterikatan dengan situs pondok induk. Kolom nullable/aditif:
-- unit lama tetap memakai logo/foto pondok sebagai fallback sampai admin
-- mengisi gambar unit masing-masing.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS hero_image_url VARCHAR(500);
