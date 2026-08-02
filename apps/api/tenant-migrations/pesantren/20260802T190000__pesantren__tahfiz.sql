-- =========================================================================
-- ePesantren — EP-I: Tahfiz (setoran hafalan)
-- =========================================================================
--
-- Log transaksional setiap setoran/murajaah, bukan tabel ringkasan
-- terpisah. Capaian tertinggi per santri (juz keberapa yang sudah dicapai)
-- dihitung dari log ini (`MAX(juz) WHERE predikat = 'LANCAR'`) di sisi
-- service, bukan disimpan berduplikasi -- baris ringkasan yang berduplikasi
-- dari log sumbernya cepat berselisih begitu satu di antaranya diperbarui
-- dan yang lain tertinggal.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_tahfiz_setoran (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis           VARCHAR(16) NOT NULL,
  juz             INTEGER NOT NULL,
  predikat        VARCHAR(16) NOT NULL,
  penilai_id      UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  catatan         TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tahfiz_setoran
  ADD CONSTRAINT ck_pesantren_tahfiz_setoran_jenis
  CHECK (jenis IN ('SETORAN', 'MURAJAAH'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tahfiz_setoran
  ADD CONSTRAINT ck_pesantren_tahfiz_setoran_predikat
  CHECK (predikat IN ('LANCAR', 'KURANG_LANCAR', 'TIDAK_LANCAR'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tahfiz_setoran
  ADD CONSTRAINT ck_pesantren_tahfiz_setoran_juz_rentang
  CHECK (juz BETWEEN 1 AND 30);

CREATE INDEX IF NOT EXISTS ix_pesantren_tahfiz_setoran_santri
  ON "{{TENANT_SCHEMA}}".pesantren_tahfiz_setoran (santri_id, tanggal DESC, deleted_at);
CREATE INDEX IF NOT EXISTS ix_pesantren_tahfiz_setoran_tanggal
  ON "{{TENANT_SCHEMA}}".pesantren_tahfiz_setoran (tanggal, deleted_at);

-- Capaian tertinggi per santri dihitung dari indeks ini, bukan tabel
-- terpisah -- lihat catatan di atas berkas.
CREATE INDEX IF NOT EXISTS ix_pesantren_tahfiz_setoran_capaian
  ON "{{TENANT_SCHEMA}}".pesantren_tahfiz_setoran (santri_id, juz DESC)
  WHERE predikat = 'LANCAR' AND jenis = 'SETORAN' AND deleted_at IS NULL;
