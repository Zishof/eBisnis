-- =========================================================================
-- V030 — JEJAK PEMBATALAN TRANSAKSI KASIR
-- =========================================================================
--
-- Pembatalan transaksi yang sudah selesai adalah tindakan yang paling sering
-- dipersoalkan pada sistem kasir: uang yang sudah masuk dinyatakan tidak jadi
-- masuk. Tiga hal karena itu harus tercatat pada barisnya sendiri — siapa yang
-- meminta, siapa yang menyetujui, dan apa alasannya.
--
-- Disimpan pada `pos_sale`, bukan hanya pada `pos_sale_status_history`, karena
-- pemeriksaan pemisahan wewenang membutuhkannya sebelum perpindahan status
-- terjadi: layanan harus tahu siapa pemohonnya untuk dapat menolak penyetujuan
-- oleh orang yang sama. Membacanya dari riwayat status berarti mengurai teks
-- alasan, dan aturan yang bergantung pada penguraian teks bukan aturan.
--
-- Constraint menegakkan hal yang sama pada lapisan basis data: penyetuju tidak
-- boleh sama dengan pemohon. Layanan sudah memeriksanya, mesin transisi status
-- juga — dan lapisan ketiga ini yang tetap berlaku ketika kelak ada jalan
-- keempat menuju tabel ini yang lupa memeriksanya.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale
  ADD COLUMN IF NOT EXISTS void_requested_by UUID,
  ADD COLUMN IF NOT EXISTS void_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_approved_by  UUID,
  ADD COLUMN IF NOT EXISTS void_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason       TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'pos_sale_no_self_void_approval'
       AND conrelid = '"{{TENANT_SCHEMA}}".pos_sale'::regclass
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale
      ADD CONSTRAINT pos_sale_no_self_void_approval
      CHECK (
        void_approved_by IS NULL
        OR void_requested_by IS NULL
        OR void_approved_by <> void_requested_by
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pos_sale_void_pending_idx
  ON "{{TENANT_SCHEMA}}".pos_sale (outlet_id, void_requested_at DESC)
  WHERE status = 'VOID_REQUESTED';

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".pos_sale.void_requested_by IS
  'Pemohon pembatalan. Dipakai menegakkan larangan menyetujui permintaan sendiri sebelum perpindahan status terjadi.';
