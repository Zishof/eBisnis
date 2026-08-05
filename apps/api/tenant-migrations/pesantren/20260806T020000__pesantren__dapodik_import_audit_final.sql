-- =========================================================================
-- ePesantren -- Audit final import DAPODIK dan rollback UPDATE
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dapodik_import_batch
  ADD COLUMN IF NOT EXISTS source_filename TEXT,
  ADD COLUMN IF NOT EXISTS source_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS source_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS source_hash VARCHAR(128);

UPDATE "{{TENANT_SCHEMA}}".pesantren_dapodik_import_batch
   SET source_hash = COALESCE(source_hash, content_hash)
 WHERE source_hash IS NULL
   AND content_hash IS NOT NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dapodik_import_row
  ADD COLUMN IF NOT EXISTS before_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS after_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS diff_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS ix_pesantren_dapodik_import_batch_source_hash
  ON "{{TENANT_SCHEMA}}".pesantren_dapodik_import_batch (source_hash)
  WHERE source_hash IS NOT NULL;
