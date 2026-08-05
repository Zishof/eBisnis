-- =========================================================================
-- ePesantren -- Finalisasi rapor, verifikasi QR, dan tanda tangan digital
-- =========================================================================
--
-- Rapor yang dicetak harus tetap sama walaupun skala huruf, bobot komponen,
-- atau nilai sumber diperbaiki setelah semester ditutup. Karena itu finalisasi
-- menyimpan snapshot JSONB hasil perhitungan saat disahkan, beserta checksum
-- dan kode verifikasi. Nilai sumber tetap berada di pesantren_nilai untuk
-- audit; snapshot adalah dokumen finalnya.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_rapor_finalisasi (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id             UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE RESTRICT,
  tahun_ajaran_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  status                VARCHAR(24) NOT NULL DEFAULT 'FINALIZED',
  snapshot              JSONB NOT NULL,
  summary               JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum              VARCHAR(128) NOT NULL,
  verification_code     VARCHAR(64) NOT NULL,
  qr_payload            TEXT NOT NULL,
  catatan_finalisasi    TEXT,

  wali_kelas_user_id    UUID,
  wali_kelas_signed_at  TIMESTAMPTZ,
  kepala_user_id        UUID,
  kepala_signed_at      TIMESTAMPTZ,
  signature_metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,

  finalized_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_by          UUID,
  voided_at             TIMESTAMPTZ,
  voided_by             UUID,
  void_reason           TEXT,

  is_sample             BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id       UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  version               INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_rapor_finalisasi
  ADD CONSTRAINT ck_pesantren_rapor_finalisasi_status
  CHECK (status IN ('FINALIZED', 'VOID'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_rapor_finalisasi
  ADD CONSTRAINT ck_pesantren_rapor_finalisasi_void_reason
  CHECK (
    (status = 'VOID' AND voided_at IS NOT NULL AND void_reason IS NOT NULL)
    OR (status = 'FINALIZED' AND voided_at IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_rapor_finalisasi_aktif
  ON "{{TENANT_SCHEMA}}".pesantren_rapor_finalisasi (santri_id, tahun_ajaran_id)
  WHERE status = 'FINALIZED' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_rapor_finalisasi_verifikasi
  ON "{{TENANT_SCHEMA}}".pesantren_rapor_finalisasi (verification_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_rapor_finalisasi_santri_tahun
  ON "{{TENANT_SCHEMA}}".pesantren_rapor_finalisasi (santri_id, tahun_ajaran_id, status, deleted_at);
