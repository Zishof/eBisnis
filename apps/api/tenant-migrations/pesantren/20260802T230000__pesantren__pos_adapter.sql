-- =========================================================================
-- ePesantren — EP-N (bagian POS): Dompet santri sebagai metode bayar kasir
-- =========================================================================
--
-- Ini ADAPTER ke POS yang sudah ada (IR-002, `ExternalPaymentRegistry`),
-- BUKAN kasir kedua. §6 perintah master melarang keras membuat POS/
-- inventory/accounting kedua di dalam ePesantren. Pola migrasi ini meniru
-- persis `V036__pos_external_balance_payment.sql` (koperasi) -- kolom
-- `external_handler`/`external_reference`/`external_state` pada
-- `pos_payment` SUDAH ada sejak V036, dipakai bersama, tidak diduplikasi.
--
-- Yang ditambahkan di sini hanya dua hal milik ePesantren sendiri:
-- (1) tabel penahanan dompet (POS menahan dana lewat `authorize()` sebelum
--     transaksi selesai, sama seperti koperasi menahan lewat
--     `cooperative_payment_hold` -- lihat catatan panjang di sana);
-- (2) baris katalog metode pembayaran yang menunjuk penangannya.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_dompet_hold (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dompet_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_dompet (id) ON DELETE RESTRICT,
  idempotency_key   VARCHAR(128) NOT NULL,
  jumlah            NUMERIC(14,2) NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'AUTHORIZED',
  sale_reference    UUID,
  transaksi_id      UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_dompet_transaksi (id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at       TIMESTAMPTZ,
  reversed_at       TIMESTAMPTZ,
  reversed_reason   TEXT,
  version           INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dompet_hold
  ADD CONSTRAINT ck_pesantren_dompet_hold_status
  CHECK (status IN ('AUTHORIZED', 'CAPTURED', 'REVERSED'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dompet_hold
  ADD CONSTRAINT ck_pesantren_dompet_hold_jumlah_positif
  CHECK (jumlah > 0);

-- Kunci idempotensi milik permintaan pembayaran POS -- `authorize()` yang
-- dipanggil ulang dengan kunci yang sama (kasir mengklik dua kali, jaringan
-- mengulang permintaan) WAJIB mengembalikan penahanan yang SAMA, bukan
-- menahan dana dua kali untuk satu niat bayar yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_dompet_hold_idempotency
  ON "{{TENANT_SCHEMA}}".pesantren_dompet_hold (idempotency_key);

CREATE INDEX IF NOT EXISTS ix_pesantren_dompet_hold_dompet
  ON "{{TENANT_SCHEMA}}".pesantren_dompet_hold (dompet_id, status);

-- ---------------------------------------------------------------------------
-- Katalog metode pembayaran kasir
-- ---------------------------------------------------------------------------
INSERT INTO "{{TENANT_SCHEMA}}".payment_method
  (code, name, name_key, method_type, requires_reference, is_system, external_handler)
VALUES
  ('EPESANTREN_DOMPET_SANTRI', 'Dompet Santri', 'payment.epesantren.dompetSantri',
   'EXTERNAL_BALANCE', FALSE, TRUE, 'EPESANTREN_DOMPET_SANTRI')
ON CONFLICT (code) WHERE deleted_at IS NULL DO NOTHING;
