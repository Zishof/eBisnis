-- =========================================================================
-- ePesantren: Formulir PSB dinamis per gelombang
-- =========================================================================
--
-- AIS lama punya banyak variasi PPDB*.java. Di ePesantren variasi itu
-- disiapkan sebagai JSON schema ringan per gelombang, sehingga MI, Diniyah,
-- BLK, atau unit lain dapat menambah pertanyaan tanpa membuat tabel baru.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_gelombang
  ADD COLUMN IF NOT EXISTS form_schema JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_gelombang
  ADD CONSTRAINT ck_pesantren_psb_gelombang_form_schema_array
  CHECK (jsonb_typeof(form_schema) = 'array');

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar
  ADD COLUMN IF NOT EXISTS jawaban_tambahan JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar
  ADD CONSTRAINT ck_pesantren_psb_pendaftar_jawaban_tambahan_object
  CHECK (jsonb_typeof(jawaban_tambahan) = 'object');
