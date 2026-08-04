-- =========================================================================
-- ePesantren - Jadwal kajian, materi, dan arsip dakwah
-- =========================================================================

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_kajian_dakwah (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul           VARCHAR(180) NOT NULL,
  pemateri        VARCHAR(160),
  tanggal_mulai   TIMESTAMPTZ NOT NULL,
  tanggal_selesai TIMESTAMPTZ,
  lokasi          VARCHAR(180),
  ringkasan       TEXT,
  materi_url      VARCHAR(500),
  rekaman_url     VARCHAR(500),
  gambar_url      VARCHAR(500),
  status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  sort_order      INTEGER NOT NULL DEFAULT 0,

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
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_pesantren_kajian_dakwah_status
    CHECK (status IN ('DRAFT', 'TERBIT', 'ARSIP')),
  CONSTRAINT ck_pesantren_kajian_dakwah_waktu
    CHECK (tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_mulai)
);

CREATE INDEX IF NOT EXISTS ix_pesantren_kajian_dakwah_publik
  ON "{{TENANT_SCHEMA}}".pesantren_kajian_dakwah (status, tanggal_mulai DESC, sort_order)
  WHERE deleted_at IS NULL;
