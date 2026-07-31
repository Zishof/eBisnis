-- =========================================================================
-- V031 — PENUTUPAN SHIFT DAN REKONSILIASI KAS
-- =========================================================================
--
-- `pos_shift` sudah menyimpan `closing_cash`, `expected_cash`, dan `variance`
-- sejak V006, tetapi tidak menyimpan SIAPA yang menutup, siapa yang menyetujui
-- selisihnya, dan apa alasannya.
--
-- Ketiganya justru yang ditanyakan ketika kas tidak cocok. Selisih kas adalah
-- perkara yang menyangkut kepercayaan kepada orang, bukan sekadar angka yang
-- tidak sama — dan menjawabnya dengan "sistem tidak mencatat itu" adalah
-- jawaban yang merugikan kasir yang jujur lebih dahulu.
--
-- Status shift juga diperluas dengan PENDING_APPROVAL: selisih di atas ambang
-- tidak boleh langsung menutup shift, tetapi juga tidak boleh menahan kasir
-- pulang. Shift ditutup, kasnya terkunci, dan persetujuannya menyusul.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".pos_shift
  ADD COLUMN IF NOT EXISTS opened_by       UUID,
  ADD COLUMN IF NOT EXISTS closed_by       UUID,
  ADD COLUMN IF NOT EXISTS approved_by     UUID,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS variance_reason TEXT,
  ADD COLUMN IF NOT EXISTS approval_note   TEXT;

-- Penyetuju selisih tidak boleh orang yang menutup shiftnya. Aturan yang sama
-- dengan void dan refund, ditegakkan pada lapisan yang sama pula.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'pos_shift_no_self_variance_approval'
       AND conrelid = '"{{TENANT_SCHEMA}}".pos_shift'::regclass
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".pos_shift
      ADD CONSTRAINT pos_shift_no_self_variance_approval
      CHECK (approved_by IS NULL OR closed_by IS NULL OR approved_by <> closed_by);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pos_shift_pending_approval_idx
  ON "{{TENANT_SCHEMA}}".pos_shift (outlet_id, closed_at DESC)
  WHERE status = 'PENDING_APPROVAL';

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".pos_shift.variance_reason IS
  'Keterangan kasir atas selisih kas. Kosong bukan berarti tidak ada selisih — periksa kolom variance.';
