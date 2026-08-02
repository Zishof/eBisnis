-- =========================================================================
-- ePesantren — Muqodimah situs publik
-- =========================================================================
--
-- Kolom TERPISAH dari `sejarah_html`, bukan digabung ke dalamnya. Sejarah
-- bercerita tentang PONDOKNYA (kapan berdiri, siapa pendirinya); muqodimah
-- adalah sambutan pembuka bernuansa keagamaan (basmalah, hamdalah, shalawat,
-- nilai Ahlussunnah wal Jama'ah An-Nahdliyah) yang lazim mengawali situs/
-- media cetak pondok NU -- dua isi yang berbeda maksud, ditulis terpisah,
-- dan boleh diedit terpisah pula oleh pengurus.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_website_setting
  ADD COLUMN IF NOT EXISTS muqodimah_html TEXT;
