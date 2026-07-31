-- =========================================================================
-- V024 — KONTEKS POS: PENUGASAN REGISTER DAN KOLOM PELENGKAP
-- =========================================================================
--
-- Seluruhnya aditif. Satu tabel baru dan kolom-kolom yang boleh kosong;
-- tidak ada kolom yang dihapus, tidak ada tipe yang berubah, dan versi
-- aplikasi sebelumnya tetap berjalan di atas skema ini.
--
-- Yang diselesaikan migrasi ini:
--
-- 1. Sampai sekarang tidak ada yang membatasi kasir mana boleh membuka shift
--    pada register mana. Aturan "kasir hanya outlet yang ditugaskan" tidak
--    dapat ditegakkan maupun diuji tanpa pos_register_assignment.
--
-- 2. pos_terminal.status dipakai untuk siklus hidup master (aktif/nonaktif).
--    Status operasional register — siap, terbuka, ditangguhkan — berubah
--    setiap hari dan merupakan hal yang berbeda. Menumpangkan keduanya pada
--    satu kolom membuat penonaktifan terminal dan penutupan register saling
--    tertukar.

-- ---------------------------------------------------------------------------
-- Penugasan kasir ke register
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_register_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_terminal (id) ON DELETE CASCADE,
  user_subject_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE CASCADE,
  -- Penugasan boleh berjangka: kasir pengganti selama seseorang cuti tidak
  -- perlu dicabut manual dan tidak perlu diingat siapa pun.
  valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  note            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pos_register_assignment_period_valid
    CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Satu penugasan aktif per pasangan terminal-pengguna. Dipakai COALESCE dan
-- bukan NULLS NOT DISTINCT karena produksi masih PostgreSQL 13.
CREATE UNIQUE INDEX IF NOT EXISTS pos_register_assignment_unique_active
  ON "{{TENANT_SCHEMA}}".pos_register_assignment (
    terminal_id, user_subject_id, valid_from, COALESCE(valid_until, DATE '9999-12-31')
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pos_register_assignment_user_idx
  ON "{{TENANT_SCHEMA}}".pos_register_assignment (user_subject_id)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS pos_register_assignment_terminal_idx
  ON "{{TENANT_SCHEMA}}".pos_register_assignment (terminal_id)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- ---------------------------------------------------------------------------
-- pos_terminal — status operasional dan setelan struk
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".pos_terminal
  ADD COLUMN IF NOT EXISTS register_status  VARCHAR(24) NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS receipt_setting  JSONB,
  ADD COLUMN IF NOT EXISTS last_opened_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_closed_at   TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'pos_terminal_register_status_valid'
       AND conrelid = '"{{TENANT_SCHEMA}}".pos_terminal'::regclass
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".pos_terminal
      ADD CONSTRAINT pos_terminal_register_status_valid
      CHECK (register_status IN ('INACTIVE', 'READY', 'OPEN', 'SUSPENDED', 'MAINTENANCE', 'CLOSED'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- pos_shift — outlet, pelaku, dan alasan selisih
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".pos_shift
  ADD COLUMN IF NOT EXISTS outlet_id       UUID REFERENCES "{{TENANT_SCHEMA}}".outlet (id),
  ADD COLUMN IF NOT EXISTS business_date   DATE,
  ADD COLUMN IF NOT EXISTS opened_by       UUID,
  ADD COLUMN IF NOT EXISTS closed_by       UUID,
  -- Selisih kas tanpa alasan adalah selisih yang tidak dapat ditindaklanjuti.
  ADD COLUMN IF NOT EXISTS variance_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_by     UUID,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_role_id  UUID,
  ADD COLUMN IF NOT EXISTS note            TEXT;

-- Satu shift terbuka per terminal. Inilah yang membuat "buka shift ganda"
-- mustahil, bukan sekadar diperiksa layanan.
CREATE UNIQUE INDEX IF NOT EXISTS pos_shift_one_open_per_terminal
  ON "{{TENANT_SCHEMA}}".pos_shift (terminal_id)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS pos_shift_outlet_date_idx
  ON "{{TENANT_SCHEMA}}".pos_shift (outlet_id, business_date);

CREATE INDEX IF NOT EXISTS pos_shift_cashier_idx
  ON "{{TENANT_SCHEMA}}".pos_shift (cashier_id, opened_at DESC);

-- Mengisi outlet_id dan business_date untuk baris yang sudah ada.
UPDATE "{{TENANT_SCHEMA}}".pos_shift s
   SET outlet_id = t.outlet_id
  FROM "{{TENANT_SCHEMA}}".pos_terminal t
 WHERE s.terminal_id = t.id AND s.outlet_id IS NULL;

UPDATE "{{TENANT_SCHEMA}}".pos_shift
   SET business_date = (opened_at AT TIME ZONE 'UTC')::date
 WHERE business_date IS NULL;

-- ---------------------------------------------------------------------------
-- pos_sale — konteks merek, peran aktif, dan pembatalan
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale
  ADD COLUMN IF NOT EXISTS brand_id       UUID REFERENCES "{{TENANT_SCHEMA}}".brand (id),
  ADD COLUMN IF NOT EXISTS active_role_id UUID,
  ADD COLUMN IF NOT EXISTS cashier_id     UUID,
  ADD COLUMN IF NOT EXISTS void_reason    TEXT,
  ADD COLUMN IF NOT EXISTS voided_by      UUID,
  ADD COLUMN IF NOT EXISTS voided_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS held_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS note           TEXT;

CREATE INDEX IF NOT EXISTS pos_sale_outlet_date_idx
  ON "{{TENANT_SCHEMA}}".pos_sale (outlet_id, business_date);

CREATE INDEX IF NOT EXISTS pos_sale_shift_idx
  ON "{{TENANT_SCHEMA}}".pos_sale (shift_id);

CREATE INDEX IF NOT EXISTS pos_sale_status_idx
  ON "{{TENANT_SCHEMA}}".pos_sale (status)
  WHERE status IN ('DRAFT', 'HELD', 'PAYMENT_PENDING');

-- Nomor struk tidak boleh kembar. Ditegakkan basis data, bukan layanan —
-- dua kasir yang menyelesaikan transaksi pada milidetik yang sama tidak dapat
-- dihentikan oleh pemeriksaan di lapisan aplikasi.
CREATE UNIQUE INDEX IF NOT EXISTS pos_sale_receipt_number_unique
  ON "{{TENANT_SCHEMA}}".pos_sale (receipt_number)
  WHERE receipt_number IS NOT NULL;

UPDATE "{{TENANT_SCHEMA}}".pos_sale s
   SET brand_id = o.brand_id
  FROM "{{TENANT_SCHEMA}}".outlet o
 WHERE s.outlet_id = o.id AND s.brand_id IS NULL;

-- ---------------------------------------------------------------------------
-- pos_payment — urutan dan pembalikan
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD COLUMN IF NOT EXISTS sequence_no     INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reversed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by     UUID,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

CREATE INDEX IF NOT EXISTS pos_payment_sale_idx
  ON "{{TENANT_SCHEMA}}".pos_payment (pos_sale_id, sequence_no);

-- ---------------------------------------------------------------------------
-- cash_drawer_movement — pelaku dan persetujuan
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".cash_drawer_movement
  ADD COLUMN IF NOT EXISTS approved_by     UUID,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_role_id  UUID;

CREATE INDEX IF NOT EXISTS cash_drawer_movement_shift_idx
  ON "{{TENANT_SCHEMA}}".cash_drawer_movement (shift_id, occurred_at);
