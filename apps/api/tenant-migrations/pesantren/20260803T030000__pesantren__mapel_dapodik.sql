-- =========================================================================
-- ePesantren — Kelengkapan Dapodik pada mata pelajaran
-- =========================================================================
--
-- `pesantren_mata_pelajaran` (lihat 20260802T240000) sejauh ini generik:
-- code/nama/kelompok bebas pilih sekolah. Dapodik/EMIS Kemenag menuntut dua
-- hal tambahan yang tidak dapat diturunkan dari kolom yang sudah ada:
--
--   * `kode_mapel_dapodik` -- kode baku mata pelajaran pada referensi
--     Dapodik/EMIS (mis. mapel Kemenag punya kode berbeda dari Dikdasmen
--     untuk pelajaran yang namanya sama, dan mapel keagamaan seperti Fikih/
--     Akidah Akhlak/SKI/Al-Qur'an Hadis TIDAK punya padanan di Dikdasmen
--     sama sekali).
--   * `jenjang` -- satu mata pelajaran generik ("Bahasa Indonesia") dapat
--     dipakai lebih dari satu jenjang, tetapi baris referensi Dapodik-nya
--     BERBEDA per jenjang (kode mapel MI berbeda dari MTs berbeda dari MA).
--
-- Keduanya nullable: sekolah yang belum menyalin kode resminya dari Emis
-- Kemenak tetap dapat memakai mata pelajaran generik seperti sebelumnya.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran
  ADD COLUMN IF NOT EXISTS kode_mapel_dapodik VARCHAR(10),
  ADD COLUMN IF NOT EXISTS jenjang VARCHAR(10);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran
  ADD CONSTRAINT ck_pesantren_mapel_jenjang
  CHECK (jenjang IS NULL OR jenjang IN ('RA', 'MI', 'MTS', 'MA', 'SMK'));

CREATE INDEX IF NOT EXISTS ix_pesantren_mapel_dapodik
  ON "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran (kode_mapel_dapodik)
  WHERE kode_mapel_dapodik IS NOT NULL;
