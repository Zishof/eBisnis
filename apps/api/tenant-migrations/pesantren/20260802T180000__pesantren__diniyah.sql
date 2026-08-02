-- =========================================================================
-- ePesantren — EP-H: Diniyah, halaqah, dan kitab
-- =========================================================================
--
-- Presensi diniyah sudah dapat dicatat sejak EP-E (`pesantren_presensi`,
-- jenis DINIYAH) terhadap santri secara langsung, tanpa perlu tahu
-- halaqah/kitabnya. Modul ini menambah struktur PENGELOMPOKAN yang belum
-- ada: halaqah (kelompok kajian kitab) dan kitab (naskah yang dikaji) —
-- keduanya diperlukan sebelum jadwal kajian per kelompok dapat dibangun.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_kitab (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  judul           VARCHAR(160) NOT NULL,
  pengarang       VARCHAR(160),
  keterangan      TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_kitab_code
  ON "{{TENANT_SCHEMA}}".pesantren_kitab (code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_halaqah
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_halaqah (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  nama            VARCHAR(160) NOT NULL,
  kitab_id        UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_kitab (id) ON DELETE SET NULL,
  ustadz_id       UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_halaqah_code
  ON "{{TENANT_SCHEMA}}".pesantren_halaqah (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_pesantren_halaqah_kitab
  ON "{{TENANT_SCHEMA}}".pesantren_halaqah (kitab_id);

-- ---------------------------------------------------------------------------
-- pesantren_halaqah_santri — keanggotaan santri pada halaqah
-- ---------------------------------------------------------------------------
-- Satu santri BOLEH mengikuti lebih dari satu halaqah sekaligus (mis. kajian
-- Nahwu dan kajian Fiqih berbeda kelompok) -- berbeda dari penempatan kamar
-- (EP-G) yang membatasi satu aktif per santri. Yang dicegah di sini hanya
-- keanggotaan GANDA pada halaqah yang SAMA.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_halaqah_santri (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  halaqah_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_halaqah (id) ON DELETE CASCADE,
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  tanggal_gabung  DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_keluar  DATE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_halaqah_santri
  ADD CONSTRAINT ck_pesantren_halaqah_santri_keluar_setelah_gabung
  CHECK (tanggal_keluar IS NULL OR tanggal_keluar >= tanggal_gabung);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_halaqah_santri_aktif
  ON "{{TENANT_SCHEMA}}".pesantren_halaqah_santri (halaqah_id, santri_id)
  WHERE tanggal_keluar IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_halaqah_santri_santri
  ON "{{TENANT_SCHEMA}}".pesantren_halaqah_santri (santri_id, deleted_at);
CREATE INDEX IF NOT EXISTS ix_pesantren_halaqah_santri_halaqah
  ON "{{TENANT_SCHEMA}}".pesantren_halaqah_santri (halaqah_id, deleted_at);
