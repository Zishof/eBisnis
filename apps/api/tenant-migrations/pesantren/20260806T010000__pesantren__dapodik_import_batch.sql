-- =========================================================================
-- ePesantren -- Log batch import DAPODIK dan rollback aman
-- =========================================================================
--
-- Import DAPODIK final tidak boleh menjadi operasi "gelap": operator perlu
-- tahu file mana yang masuk, siapa yang mengunggah, berapa baris berhasil,
-- dan baris mana yang dapat dibatalkan. Rollback awal dibatasi pada baris
-- yang DIBUAT oleh batch, karena mengembalikan UPDATE lama-vs-baru menuntut
-- snapshot per kolom yang akan ditambahkan pada batch berikutnya.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_dapodik_import_batch (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset         VARCHAR(64) NOT NULL,
  format          VARCHAR(16) NOT NULL,
  content_hash    VARCHAR(128),
  dry_run         BOOLEAN NOT NULL DEFAULT FALSE,
  total_rows      INTEGER NOT NULL DEFAULT 0,
  created_count   INTEGER NOT NULL DEFAULT 0,
  updated_count   INTEGER NOT NULL DEFAULT 0,
  skipped_count   INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
  error_summary   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  completed_at    TIMESTAMPTZ,
  rolled_back_at  TIMESTAMPTZ,
  rolled_back_by  UUID,
  rollback_note   TEXT
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dapodik_import_batch
  ADD CONSTRAINT ck_pesantren_dapodik_import_batch_status
  CHECK (status IN ('PROCESSING', 'IMPORTED', 'IMPORTED_WITH_ERRORS', 'FAILED', 'ROLLED_BACK', 'PARTIAL_ROLLBACK'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dapodik_import_batch
  ADD CONSTRAINT ck_pesantren_dapodik_import_batch_format
  CHECK (format IN ('csv', 'json'));

CREATE INDEX IF NOT EXISTS ix_pesantren_dapodik_import_batch_dataset_created
  ON "{{TENANT_SCHEMA}}".pesantren_dapodik_import_batch (dataset, created_at DESC);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_dapodik_import_row (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_dapodik_import_batch (id) ON DELETE CASCADE,
  row_number       INTEGER NOT NULL,
  action           VARCHAR(16) NOT NULL,
  target_table     VARCHAR(96),
  target_id        UUID,
  import_key       TEXT,
  summary          TEXT,
  error_message    TEXT,
  raw_row          JSONB,
  rollback_status  VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
  rollback_message TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dapodik_import_row
  ADD CONSTRAINT ck_pesantren_dapodik_import_row_action
  CHECK (action IN ('CREATE', 'UPDATE', 'SKIP'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dapodik_import_row
  ADD CONSTRAINT ck_pesantren_dapodik_import_row_rollback_status
  CHECK (rollback_status IN ('NOT_REQUIRED', 'PENDING', 'ROLLED_BACK', 'FAILED'));

CREATE INDEX IF NOT EXISTS ix_pesantren_dapodik_import_row_batch
  ON "{{TENANT_SCHEMA}}".pesantren_dapodik_import_row (batch_id, row_number);

CREATE INDEX IF NOT EXISTS ix_pesantren_dapodik_import_row_target
  ON "{{TENANT_SCHEMA}}".pesantren_dapodik_import_row (target_table, target_id)
  WHERE target_id IS NOT NULL;
