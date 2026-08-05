-- =========================================================================
-- ePesantren -- Keputusan akademik: kenaikan kelas dan kelulusan
-- =========================================================================
--
-- Finalisasi rapor mengunci dokumen nilai. Tabel ini mencatat keputusan
-- akademik berikutnya: santri naik ke rombongan tahun ajaran berikutnya,
-- tinggal kelas, atau lulus/keluar dari satuan pendidikan. Keputusan dibuat
-- sebagai DRAFT, difinalisasi, lalu dieksekusi dalam transaksi agar status
-- santri dan keanggotaan rombongan tetap konsisten.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_keputusan_akademik (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id                  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE RESTRICT,
  tahun_ajaran_asal_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  rombongan_asal_id          UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_rombongan_belajar (id) ON DELETE SET NULL,
  jenis                      VARCHAR(24) NOT NULL,
  status                     VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  rombongan_tujuan_id        UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_rombongan_belajar (id) ON DELETE RESTRICT,
  tanggal_keputusan          DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_efektif            DATE NOT NULL DEFAULT CURRENT_DATE,
  catatan                    TEXT,
  rapor_finalisasi_id        UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_rapor_finalisasi (id) ON DELETE SET NULL,

  finalized_at               TIMESTAMPTZ,
  finalized_by               UUID,
  executed_at                TIMESTAMPTZ,
  executed_by                UUID,
  canceled_at                TIMESTAMPTZ,
  canceled_by                UUID,
  cancel_reason              TEXT,

  is_sample                  BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id            UUID,
  metadata                   JSONB,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                 UUID,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                 UUID,
  deleted_at                 TIMESTAMPTZ,
  deleted_by                 UUID,
  delete_reason              TEXT,
  version                    INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_keputusan_akademik
  ADD CONSTRAINT ck_pesantren_keputusan_akademik_jenis
  CHECK (jenis IN ('NAIK_KELAS', 'TINGGAL_KELAS', 'LULUS', 'KELUAR'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_keputusan_akademik
  ADD CONSTRAINT ck_pesantren_keputusan_akademik_status
  CHECK (status IN ('DRAFT', 'FINALIZED', 'EXECUTED', 'CANCELED'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_keputusan_akademik
  ADD CONSTRAINT ck_pesantren_keputusan_akademik_target
  CHECK (
    (jenis IN ('NAIK_KELAS', 'TINGGAL_KELAS') AND rombongan_tujuan_id IS NOT NULL) OR
    (jenis IN ('LULUS', 'KELUAR') AND rombongan_tujuan_id IS NULL)
  );

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_keputusan_akademik
  ADD CONSTRAINT ck_pesantren_keputusan_akademik_cancel_reason
  CHECK (status <> 'CANCELED' OR length(trim(coalesce(cancel_reason, ''))) >= 10);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_keputusan_akademik_aktif
  ON "{{TENANT_SCHEMA}}".pesantren_keputusan_akademik (santri_id, tahun_ajaran_asal_id)
  WHERE status IN ('DRAFT', 'FINALIZED') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_keputusan_akademik_status
  ON "{{TENANT_SCHEMA}}".pesantren_keputusan_akademik (tahun_ajaran_asal_id, jenis, status, deleted_at);

CREATE INDEX IF NOT EXISTS ix_pesantren_keputusan_akademik_santri
  ON "{{TENANT_SCHEMA}}".pesantren_keputusan_akademik (santri_id, deleted_at);
