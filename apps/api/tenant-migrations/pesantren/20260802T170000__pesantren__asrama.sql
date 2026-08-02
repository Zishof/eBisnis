-- =========================================================================
-- ePesantren — EP-G: Asrama, kamar, dan penempatan santri
-- =========================================================================
--
-- Kapasitas kamar TIDAK ditegakkan CHECK/trigger basis data di sini —
-- menghitung penghuni aktif memerlukan query lintas baris (COUNT terhadap
-- pesantren_penempatan), bukan sesuatu yang dapat dijawab CHECK per baris.
-- Batas kapasitas ditegakkan di service sebelum INSERT, di dalam transaksi
-- yang sama dengan penulisannya -- pola yang sama dengan pemeriksaan
-- ketersediaan pada modul lain yang bergantung hitungan lintas baris.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_asrama (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  nama            VARCHAR(160) NOT NULL,
  jenis           VARCHAR(8) NOT NULL,
  pengurus_id     UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  alamat          TEXT,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_asrama_code
  ON "{{TENANT_SCHEMA}}".pesantren_asrama (code) WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_asrama
  ADD CONSTRAINT ck_pesantren_asrama_jenis
  CHECK (jenis IN ('PUTRA', 'PUTRI'));

-- ---------------------------------------------------------------------------
-- pesantren_kamar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_kamar (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asrama_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_asrama (id) ON DELETE RESTRICT,
  nomor           VARCHAR(32) NOT NULL,
  kapasitas       INTEGER NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_kamar_asrama_nomor
  ON "{{TENANT_SCHEMA}}".pesantren_kamar (asrama_id, nomor) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_pesantren_kamar_asrama
  ON "{{TENANT_SCHEMA}}".pesantren_kamar (asrama_id, deleted_at);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_kamar
  ADD CONSTRAINT ck_pesantren_kamar_kapasitas_positif
  CHECK (kapasitas > 0);

-- ---------------------------------------------------------------------------
-- pesantren_penempatan — riwayat penempatan santri ke kamar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_penempatan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  kamar_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_kamar (id) ON DELETE RESTRICT,
  tanggal_mulai   DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_selesai DATE,
  catatan         TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_penempatan
  ADD CONSTRAINT ck_pesantren_penempatan_tanggal_selesai_setelah_mulai
  CHECK (tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_mulai);

-- Satu santri hanya boleh punya SATU penempatan aktif (tanggal_selesai NULL)
-- pada satu waktu. Tanpa ini, santri dapat tercatat menghuni dua kamar
-- sekaligus, dan "kamar mana yang benar" tidak dapat dijawab basis data
-- sendiri -- persis pola satu-wali-utama pada EP-A.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_penempatan_satu_aktif_per_santri
  ON "{{TENANT_SCHEMA}}".pesantren_penempatan (santri_id)
  WHERE tanggal_selesai IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_penempatan_kamar_aktif
  ON "{{TENANT_SCHEMA}}".pesantren_penempatan (kamar_id)
  WHERE tanggal_selesai IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_pesantren_penempatan_santri
  ON "{{TENANT_SCHEMA}}".pesantren_penempatan (santri_id, deleted_at);
