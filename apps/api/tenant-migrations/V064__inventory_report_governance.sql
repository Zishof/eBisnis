-- =========================================================================
-- V064 — GOVERNANCE SNAPSHOT DAN CETAK LAPORAN INVENTORY / SALES
-- Aditif: tidak mengubah atau menghapus snapshot/print-log lama.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  ADD COLUMN IF NOT EXISTS report_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS column_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS result_sha256 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS watermark VARCHAR(64);

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  DROP CONSTRAINT IF EXISTS ck_inventory_report_snapshot_version;
ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  ADD CONSTRAINT ck_inventory_report_snapshot_version CHECK (report_version > 0);

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  DROP CONSTRAINT IF EXISTS ck_inventory_report_snapshot_approval;
ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  ADD CONSTRAINT ck_inventory_report_snapshot_approval
  CHECK (approval_status IN ('DRAFT', 'APPROVED', 'REJECTED'));

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  DROP CONSTRAINT IF EXISTS ck_inventory_report_snapshot_approved_actor;
ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  ADD CONSTRAINT ck_inventory_report_snapshot_approved_actor CHECK (
    approval_status <> 'APPROVED'
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  );

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  DROP CONSTRAINT IF EXISTS ck_inventory_report_snapshot_no_self_approval;
ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  ADD CONSTRAINT ck_inventory_report_snapshot_no_self_approval CHECK (
    approved_by IS NULL OR generated_by IS NULL OR approved_by <> generated_by
  );

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  DROP CONSTRAINT IF EXISTS ck_inventory_report_snapshot_page_count;
ALTER TABLE "{{TENANT_SCHEMA}}".inventory_report_snapshot
  ADD CONSTRAINT ck_inventory_report_snapshot_page_count
  CHECK (page_count IS NULL OR page_count > 0);

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_print_log
  ADD COLUMN IF NOT EXISTS reprint_reason TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS watermark VARCHAR(64) NOT NULL DEFAULT 'ASLI';

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_print_log
  DROP CONSTRAINT IF EXISTS ck_inventory_print_reprint_reason;
ALTER TABLE "{{TENANT_SCHEMA}}".inventory_print_log
  ADD CONSTRAINT ck_inventory_print_reprint_reason CHECK (
    copy_number = 1 OR length(trim(COALESCE(reprint_reason, ''))) >= 3
  );

ALTER TABLE "{{TENANT_SCHEMA}}".inventory_print_log
  DROP CONSTRAINT IF EXISTS ck_inventory_print_page_count;
ALTER TABLE "{{TENANT_SCHEMA}}".inventory_print_log
  ADD CONSTRAINT ck_inventory_print_page_count
  CHECK (page_count IS NULL OR page_count > 0);

-- Versi lama selalu menulis copy_number=1. Nomori ulang deterministik sebelum
-- indeks unik dibuat; alasan migrasi hanya dipakai untuk histori yang memang
-- sudah merupakan cetak kedua dan seterusnya.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY snapshot_id ORDER BY printed_at, id
         )::integer AS copy_no
    FROM "{{TENANT_SCHEMA}}".inventory_print_log
   WHERE snapshot_id IS NOT NULL
)
UPDATE "{{TENANT_SCHEMA}}".inventory_print_log log
   SET copy_number = ranked.copy_no,
       reprint_reason = CASE
         WHEN ranked.copy_no > 1
           THEN COALESCE(NULLIF(trim(log.reprint_reason), ''), 'Migrasi histori cetak ulang')
         ELSE log.reprint_reason
       END,
       watermark = CASE WHEN ranked.copy_no > 1 THEN 'SALINAN-' || ranked.copy_no ELSE 'ASLI' END
  FROM ranked
 WHERE log.id = ranked.id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_print_snapshot_copy
  ON "{{TENANT_SCHEMA}}".inventory_print_log(snapshot_id, copy_number)
  WHERE snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_inventory_report_snapshot_approval
  ON "{{TENANT_SCHEMA}}".inventory_report_snapshot(approval_status, generated_at DESC);
