-- =============================================================================
-- Pembayaran memakai saldo simpanan anggota
-- =============================================================================
--
-- Sisi koperasi dari IR-002. Core menyediakan `ExternalPaymentRegistry` dan
-- memanggilnya dari tiga tempat pada alur kasir; berkas ini menyediakan yang
-- ditahan, dan bukti bahwa anggota memang mengizinkannya.
--
-- ## Dua tabel, dan keduanya menyimpan sesuatu yang berbahaya
--
-- `cooperative_payment_token` menyimpan bukti bahwa anggota sudah memasukkan
-- PIN-nya pada perangkatnya sendiri. Bukti itu adalah **kredensial pembawa**:
-- siapa pun yang memegangnya dapat membelanjakan saldo anggota. Karena itu
-- yang disimpan hanyalah sidiknya, sama seperti kata sandi — dan sidik yang
-- sudah dipakai tidak dapat dipakai lagi.
--
-- `cooperative_payment_hold` menyimpan penahanan dana. Tanpa barisnya,
-- penahanan tidak dapat diwujudkan maupun dilepaskan, dan saldo anggota
-- tertahan selamanya untuk transaksi yang tidak pernah terjadi.
--
-- ## Satu rekening per penahanan, dan itu disengaja
--
-- Penahanan menunjuk SATU rekening simpanan, bukan menyebar ke beberapa.
-- Pembayaran yang ditarik dari tiga rekening sekaligus tidak punya cara
-- melepaskan diri yang jelas bila salah satunya berubah di antara penahanan
-- dan pewujudan — dan anggota yang mempersoalkan pemotongannya akan
-- memperoleh jawaban yang tidak dapat ditelusuri.
-- =============================================================================

SET LOCAL search_path TO "{{TENANT_SCHEMA}}";

-- -----------------------------------------------------------------------------
-- 1. Bukti persetujuan anggota
-- -----------------------------------------------------------------------------
-- Diterbitkan portal anggota setelah PIN diperiksa, pada perangkat anggota
-- sendiri. Kasir tidak pernah melihat PIN-nya — hanya bukti bahwa ia sudah
-- dimasukkan. Spesifikasi §14.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_payment_token (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,

  -- Hanya sidiknya. Bukti ini adalah kredensial pembawa: siapa pun yang
  -- memegangnya dapat membelanjakan saldo anggota, jadi ia diperlakukan sama
  -- dengan kata sandi.
  token_hash      VARCHAR(64) NOT NULL,

  -- Batas nilai yang boleh dibelanjakan dengan bukti ini. Anggota menyetujui
  -- sebuah jumlah, bukan menyerahkan seluruh saldonya kepada kasir.
  max_amount      NUMERIC(18,2) NOT NULL,

  outlet_id       UUID,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  used_by_hold_id UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_coop_paytoken_amount CHECK (max_amount > 0),
  -- Bukti berumur pendek. Bukti yang berlaku sepanjang hari adalah bukti yang
  -- dapat dipungut orang lain dari layar yang ditinggalkan.
  CONSTRAINT ck_coop_paytoken_expiry CHECK (expires_at > issued_at),
  CONSTRAINT ck_coop_paytoken_used CHECK (used_at IS NULL OR used_by_hold_id IS NOT NULL)
);

-- Sekali pakai, ditegakkan basis data. Sidik yang sama tidak dapat terbit dua
-- kali, sehingga bukti yang sudah terpakai tidak dapat "diterbitkan ulang".
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_paytoken_hash
  ON "{{TENANT_SCHEMA}}".cooperative_payment_token (token_hash);

CREATE INDEX IF NOT EXISTS ix_coop_paytoken_member
  ON "{{TENANT_SCHEMA}}".cooperative_payment_token (member_id, issued_at DESC);

-- Bukti yang masih dapat dipakai — yang dicari saat kasir memasukkannya.
CREATE INDEX IF NOT EXISTS ix_coop_paytoken_open
  ON "{{TENANT_SCHEMA}}".cooperative_payment_token (expires_at)
  WHERE used_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Penahanan dana
-- -----------------------------------------------------------------------------
-- Satu baris per `authorize()` milik POS. `reference` yang dikembalikan ke POS
-- adalah `id` baris ini.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_payment_hold (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,

  -- SATU rekening. Lihat catatan di kepala berkas.
  saving_account_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_saving_account (id) ON DELETE RESTRICT,

  amount           NUMERIC(18,2) NOT NULL,

  -- Rujukan silang ke penjualan kasir. Disimpan sebagai teks, bukan kunci
  -- asing: tabel POS milik Core, dan menautkannya akan membuat penghapusan
  -- modul koperasi menyeret POS.
  pos_sale_id      UUID,
  outlet_id        UUID,
  idempotency_key  VARCHAR(128),

  state            VARCHAR(16) NOT NULL DEFAULT 'AUTHORIZED',
  authorized_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at      TIMESTAMPTZ,
  reversed_at      TIMESTAMPTZ,
  reverse_reason   TEXT,

  -- Transaksi simpanan yang terbentuk saat penahanan diwujudkan. Kosong
  -- selama masih tertahan; itulah pembeda antara dana yang dijanjikan dan
  -- dana yang benar-benar berpindah.
  saving_transaction_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_saving_transaction (id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  version          INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_hold_amount CHECK (amount > 0),
  CONSTRAINT ck_coop_hold_state CHECK (state IN ('AUTHORIZED', 'CAPTURED', 'REVERSED')),

  -- Yang sudah diwujudkan wajib menunjuk transaksi simpanannya. Tanpa itu,
  -- saldo berkurang tanpa baris yang menjelaskannya — dan anggota yang
  -- bertanya tidak dapat dijawab.
  CONSTRAINT ck_coop_hold_captured
    CHECK (state <> 'CAPTURED' OR (captured_at IS NOT NULL AND saving_transaction_id IS NOT NULL)),

  -- Pelepasan wajib beralasan.
  CONSTRAINT ck_coop_hold_reversed
    CHECK (state <> 'REVERSED' OR (reversed_at IS NOT NULL AND reverse_reason IS NOT NULL)),

  -- Penahanan tidak dapat sekaligus diwujudkan dan dilepaskan.
  CONSTRAINT ck_coop_hold_not_both
    CHECK (captured_at IS NULL OR reversed_at IS NULL)
);

ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_payment_token
  DROP CONSTRAINT IF EXISTS fk_coop_paytoken_hold;

ALTER TABLE "{{TENANT_SCHEMA}}".cooperative_payment_token
  ADD CONSTRAINT fk_coop_paytoken_hold
  FOREIGN KEY (used_by_hold_id)
  REFERENCES "{{TENANT_SCHEMA}}".cooperative_payment_hold (id) ON DELETE SET NULL;

/*
 * Satu penahanan per kunci idempotensi POS.
 *
 * Klik ganda pada layar kasir yang lambat pasti terjadi. Tanpa indeks ini,
 * penahanan kedua terbentuk dan saldo anggota berkurang dua kali untuk satu
 * transaksi — kerugian yang paling sulit dijelaskan, sebab kasir melihat satu
 * baris pembayaran saja.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_hold_idempotency
  ON "{{TENANT_SCHEMA}}".cooperative_payment_hold (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_coop_hold_member
  ON "{{TENANT_SCHEMA}}".cooperative_payment_hold (member_id, authorized_at DESC);

-- Penahanan yang masih menggantung — dicari saat menghitung saldo tersedia,
-- dan oleh penjadwal pelepas.
CREATE INDEX IF NOT EXISTS ix_coop_hold_open
  ON "{{TENANT_SCHEMA}}".cooperative_payment_hold (saving_account_id)
  WHERE state = 'AUTHORIZED';
