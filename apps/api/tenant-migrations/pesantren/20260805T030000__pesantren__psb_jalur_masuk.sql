-- =========================================================================
-- ePesantren -- Jalur masuk PSB untuk rekap multi-tahun
-- =========================================================================
--
-- AIS lama punya RekapJalurMasukMultiTahunPsb. PSB modern sudah memiliki
-- gelombang, unit tujuan, dan asal sekolah, tetapi belum punya dimensi jalur
-- masuk seperti REGULER, PRESTASI, AFIRMASI, atau PINDAHAN. Kolom nullable ini
-- menambah dimensi laporan tanpa mematahkan pendaftar lama; laporan memakai
-- COALESCE(..., 'REGULER') untuk data historis yang belum diisi.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar
  ADD COLUMN IF NOT EXISTS jalur_masuk VARCHAR(40);

CREATE INDEX IF NOT EXISTS ix_pesantren_psb_pendaftar_jalur
  ON "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar (jalur_masuk, deleted_at);
