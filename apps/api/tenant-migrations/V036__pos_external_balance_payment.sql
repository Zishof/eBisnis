-- =========================================================================
-- V036 — PEMBAYARAN BERSALDO EKSTERNAL PADA KASIR
-- =========================================================================
--
-- Menyelesaikan IR-002. Registri penangannya sudah ada sejak
-- `external-payment.registry.ts`; yang belum ada adalah tempat menyimpan
-- SIAPA penangannya dan APA rujukan penahanannya.
--
-- ## Mengapa penahanan perlu disimpan
--
-- Alur pembayaran bersaldo eksternal berjalan dua langkah: `authorize()`
-- menahan dana saat kasir memasukkan pembayaran, `capture()` mewujudkannya
-- saat transaksi diselesaikan. Di antara keduanya kasir dapat menutup layar,
-- jaringan dapat putus, atau transaksi dapat dibatalkan.
--
-- Tanpa rujukan yang tersimpan, penahanan itu tidak dapat diwujudkan maupun
-- dilepaskan — dan saldo anggota tertahan selamanya untuk transaksi yang tidak
-- pernah terjadi. Saldo yang hilang tanpa jejak adalah kegagalan yang paling
-- sulit dijelaskan kepada anggota koperasi, sebab uangnya memang miliknya.
--
-- ## Yang ditegakkan basis data
--
-- Constraint di bawah menutup keadaan yang tidak dapat dijelaskan:
--
--   · Metode `EXTERNAL_BALANCE` WAJIB menyebut penangannya. Metode yang
--     menyebut jenis itu tanpa penangan akan tampil di layar kasir dan
--     pembayarannya tidak diproses siapa pun — penjualan tercatat lunas tanpa
--     ada dana yang berpindah.
--   · Pembayaran yang menyebut rujukan penahanan WAJIB menyebut penangannya
--     pula, sebab rujukan hanya berarti bagi penangan yang menerbitkannya.
--   · Pembayaran yang sudah diwujudkan WAJIB punya rujukan. Tanpa itu tidak
--     ada yang dapat ditelusuri saat anggota mempersoalkan pemotongannya.
--
-- Additive seluruhnya.
-- =========================================================================

-- Jenis metode pembayaran baru.
--
-- Sengaja bukan menumpang pada `DEPOSIT` yang sudah ada. `DEPOSIT` adalah
-- titipan pelanggan yang dikelola Core sendiri; `EXTERNAL_BALANCE` adalah
-- saldo yang dikelola modul lain dan yang Core tidak boleh memotongnya
-- langsung. Menyamakan keduanya akan membuat alur potong-langsung milik
-- DEPOSIT berlaku pada saldo yang bukan miliknya.
ALTER TABLE "{{TENANT_SCHEMA}}".payment_method
  ADD COLUMN IF NOT EXISTS external_handler VARCHAR(64);

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".payment_method.external_handler IS
  'Kode penangan pada ExternalPaymentRegistry, mis. COOPERATIVE_MEMBER_BALANCE.';

ALTER TABLE "{{TENANT_SCHEMA}}".payment_method
  DROP CONSTRAINT IF EXISTS ck_payment_method_external_needs_handler;

ALTER TABLE "{{TENANT_SCHEMA}}".payment_method
  ADD CONSTRAINT ck_payment_method_external_needs_handler
  CHECK (method_type <> 'EXTERNAL_BALANCE' OR external_handler IS NOT NULL);

-- Rujukan penahanan pada barisnya sendiri.
ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD COLUMN IF NOT EXISTS external_handler VARCHAR(64);

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD COLUMN IF NOT EXISTS external_reference VARCHAR(128);

/*
 * Keadaan penahanan, terpisah dari `status` pembayaran.
 *
 * Keduanya menjawab pertanyaan berbeda: `status` menjawab apakah kasir sudah
 * menerima pembayarannya, `external_state` menjawab apakah dana di modul lain
 * sudah benar-benar berpindah. Menggabungkannya akan menyembunyikan keadaan
 * yang justru paling perlu terlihat — pembayaran yang diterima kasir tetapi
 * penahanannya belum diwujudkan.
 */
ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD COLUMN IF NOT EXISTS external_state VARCHAR(24);

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD COLUMN IF NOT EXISTS external_captured_at TIMESTAMPTZ;

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  DROP CONSTRAINT IF EXISTS ck_pos_payment_external_state;

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD CONSTRAINT ck_pos_payment_external_state
  CHECK (external_state IS NULL OR external_state IN ('AUTHORIZED', 'CAPTURED', 'REVERSED'));

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  DROP CONSTRAINT IF EXISTS ck_pos_payment_external_reference_needs_handler;

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD CONSTRAINT ck_pos_payment_external_reference_needs_handler
  CHECK (external_reference IS NULL OR external_handler IS NOT NULL);

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  DROP CONSTRAINT IF EXISTS ck_pos_payment_captured_needs_reference;

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD CONSTRAINT ck_pos_payment_captured_needs_reference
  CHECK (external_state <> 'CAPTURED' OR (external_reference IS NOT NULL AND external_captured_at IS NOT NULL));

/*
 * Penahanan yang belum diwujudkan, dicari penjadwal pelepas.
 *
 * Indeks parsial: yang dicari adalah baris yang tertinggal, dan jumlahnya
 * jauh lebih sedikit daripada pembayaran biasa.
 */
CREATE INDEX IF NOT EXISTS ix_pos_payment_external_pending
  ON "{{TENANT_SCHEMA}}".pos_payment (external_handler, created_at)
  WHERE external_state = 'AUTHORIZED';
