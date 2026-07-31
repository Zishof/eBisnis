-- =========================================================================
-- V027 — RINCIAN PENJUALAN, STRUK, KAS, RETUR, DAN REFUND KASIR
-- =========================================================================
--
-- Aditif. Sembilan tabel baru dan beberapa kolom; tidak ada yang diubah.
--
-- `pos_sale_line` yang ada menyimpan `tax_amount` dan `discount_amount` sebagai
-- satu angka. Angka itu cukup untuk mencetak struk, tetapi tidak cukup untuk
-- menjawab "tarif mana yang dipakai" saat pemeriksaan pajak, atau "siapa yang
-- menyetujui diskon ini" saat angka penjualan dipersoalkan. Tabel-tabel di
-- bawah menyimpan asal-usulnya.

-- ---------------------------------------------------------------------------
-- Rincian pajak per baris
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_sale_line_tax (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale_line (id) ON DELETE CASCADE,
  tax_rate_id      UUID,
  tax_code         VARCHAR(48) NOT NULL,
  -- Tarif disimpan sebagai cuplikan, bukan hanya sebagai rujukan. Tarif pajak
  -- berubah, dan struk yang dicetak ulang tahun depan harus menunjukkan tarif
  -- yang berlaku saat transaksi terjadi — bukan tarif hari ini.
  rate_snapshot    NUMERIC(9,4) NOT NULL,
  is_inclusive     BOOLEAN NOT NULL DEFAULT FALSE,
  taxable_base     NUMERIC(18,4) NOT NULL,
  tax_amount       NUMERIC(18,4) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pos_sale_line_tax_line_idx
  ON "{{TENANT_SCHEMA}}".pos_sale_line_tax (pos_sale_line_id);

-- ---------------------------------------------------------------------------
-- Rincian diskon per baris dan per keranjang
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_sale_line_discount (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale_line (id) ON DELETE CASCADE,
  source_type      VARCHAR(24) NOT NULL,
  source_id        UUID,
  label            VARCHAR(160) NOT NULL,
  discount_type    VARCHAR(16) NOT NULL,
  discount_value   NUMERIC(18,4) NOT NULL,
  discount_amount  NUMERIC(18,4) NOT NULL,
  approved_by      UUID,
  approval_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pos_sale_line_discount_type_valid CHECK (discount_type IN ('PERCENT', 'AMOUNT')),
  CONSTRAINT pos_sale_line_discount_nonnegative CHECK (discount_amount >= 0)
);

CREATE INDEX IF NOT EXISTS pos_sale_line_discount_line_idx
  ON "{{TENANT_SCHEMA}}".pos_sale_line_discount (pos_sale_line_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_sale_discount (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale (id) ON DELETE CASCADE,
  source_type     VARCHAR(24) NOT NULL,
  source_id       UUID,
  label           VARCHAR(160) NOT NULL,
  discount_type   VARCHAR(16) NOT NULL,
  discount_value  NUMERIC(18,4) NOT NULL,
  discount_amount NUMERIC(18,4) NOT NULL,
  approved_by     UUID,
  approval_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pos_sale_discount_type_valid CHECK (discount_type IN ('PERCENT', 'AMOUNT')),
  CONSTRAINT pos_sale_discount_nonnegative CHECK (discount_amount >= 0)
);

CREATE INDEX IF NOT EXISTS pos_sale_discount_sale_idx
  ON "{{TENANT_SCHEMA}}".pos_sale_discount (pos_sale_id);

-- ---------------------------------------------------------------------------
-- Riwayat status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_sale_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale (id) ON DELETE CASCADE,
  from_status    VARCHAR(24),
  to_status      VARCHAR(24) NOT NULL,
  reason         TEXT,
  actor_user_id  UUID,
  active_role_id UUID,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pos_sale_status_history_sale_idx
  ON "{{TENANT_SCHEMA}}".pos_sale_status_history (pos_sale_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Cuplikan
-- ---------------------------------------------------------------------------
-- Satu tabel untuk cuplikan harga, pajak, promosi, dan pelanggan, dibedakan
-- oleh `snapshot_type`. Empat tabel terpisah berbentuk sama hanya memperbanyak
-- kode tanpa menambah apa pun.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_sale_snapshot (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale (id) ON DELETE CASCADE,
  snapshot_type VARCHAR(24) NOT NULL,
  payload       JSONB NOT NULL,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pos_sale_snapshot_type_valid
    CHECK (snapshot_type IN ('PRICE', 'TAX', 'PROMOTION', 'CUSTOMER', 'CART'))
);

CREATE INDEX IF NOT EXISTS pos_sale_snapshot_sale_idx
  ON "{{TENANT_SCHEMA}}".pos_sale_snapshot (pos_sale_id, snapshot_type);

-- ---------------------------------------------------------------------------
-- Struk
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_sale_receipt (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale (id) ON DELETE CASCADE,
  receipt_number    VARCHAR(64) NOT NULL,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by         UUID,
  -- Cetak ulang yang tidak tercatat adalah celah yang nyata pada sistem kasir:
  -- struk kedua atas transaksi yang sama dapat dipakai menuntut barang dua kali.
  print_count       INTEGER NOT NULL DEFAULT 0,
  last_printed_at   TIMESTAMPTZ,
  last_printed_by   UUID,
  delivery_channel  VARCHAR(24),
  delivery_target   VARCHAR(255),
  payload           JSONB,
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_sale_receipt_number_unique
  ON "{{TENANT_SCHEMA}}".pos_sale_receipt (receipt_number);

CREATE UNIQUE INDEX IF NOT EXISTS pos_sale_receipt_sale_unique
  ON "{{TENANT_SCHEMA}}".pos_sale_receipt (pos_sale_id);

-- ---------------------------------------------------------------------------
-- Penghitungan kas berdenominasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_cash_count (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_shift (id) ON DELETE CASCADE,
  count_type   VARCHAR(16) NOT NULL DEFAULT 'CLOSING',
  denomination NUMERIC(18,4) NOT NULL,
  quantity     INTEGER NOT NULL,
  subtotal     NUMERIC(18,4) NOT NULL,
  counted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  counted_by   UUID,
  CONSTRAINT pos_cash_count_type_valid CHECK (count_type IN ('OPENING', 'MIDSHIFT', 'CLOSING')),
  CONSTRAINT pos_cash_count_quantity_nonnegative CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS pos_cash_count_shift_idx
  ON "{{TENANT_SCHEMA}}".pos_cash_count (shift_id, count_type);

-- ---------------------------------------------------------------------------
-- Retur dan refund
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_return (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_sale_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale (id) ON DELETE RESTRICT,
  return_number     VARCHAR(64),
  outlet_id         UUID,
  terminal_id       UUID,
  shift_id          UUID,
  customer_id       UUID,
  return_type       VARCHAR(16) NOT NULL DEFAULT 'PARTIAL',
  reason_code       VARCHAR(48),
  reason            TEXT,
  status            VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
  subtotal          NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(18,4) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(18,4) NOT NULL DEFAULT 0,
  requested_by      UUID,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  idempotency_key   VARCHAR(120),
  posting_key       VARCHAR(120),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pos_return_type_valid CHECK (return_type IN ('PARTIAL', 'FULL')),
  -- Penyetuju tidak boleh sama dengan pemohon. Ditegakkan basis data pula,
  -- bukan hanya layanan: aturan pemisahan wewenang yang hanya ada di satu
  -- lapisan akan berhenti berlaku begitu ada jalan kedua menuju tabel ini.
  CONSTRAINT pos_return_no_self_approval
    CHECK (approved_by IS NULL OR requested_by IS NULL OR approved_by <> requested_by)
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_return_number_unique
  ON "{{TENANT_SCHEMA}}".pos_return (return_number)
  WHERE return_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pos_return_idempotency_unique
  ON "{{TENANT_SCHEMA}}".pos_return (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS pos_return_sale_idx
  ON "{{TENANT_SCHEMA}}".pos_return (original_sale_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_return_line (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_return_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_return (id) ON DELETE CASCADE,
  original_sale_line_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale_line (id) ON DELETE RESTRICT,
  product_id            UUID NOT NULL,
  uom_id                UUID,
  quantity              NUMERIC(18,4) NOT NULL,
  unit_price            NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_amount            NUMERIC(18,4) NOT NULL DEFAULT 0,
  line_total            NUMERIC(18,4) NOT NULL DEFAULT 0,
  -- Ke mana barang kembali. Mengembalikan seluruh barang retur ke stok jual
  -- adalah cara tercepat membuat catatan stok berbeda dari kenyataan di rak.
  disposition           VARCHAR(16) NOT NULL DEFAULT 'RESTOCK',
  restock_warehouse_id  UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pos_return_line_disposition_valid
    CHECK (disposition IN ('RESTOCK', 'DAMAGED', 'DISPOSED')),
  CONSTRAINT pos_return_line_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS pos_return_line_return_idx
  ON "{{TENANT_SCHEMA}}".pos_return_line (pos_return_id);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_refund (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_return_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_return (id) ON DELETE RESTRICT,
  payment_method_id UUID,
  amount            NUMERIC(18,4) NOT NULL,
  reference         VARCHAR(120),
  status            VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  refunded_at       TIMESTAMPTZ,
  refunded_by       UUID,
  idempotency_key   VARCHAR(120),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pos_refund_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_refund_idempotency_unique
  ON "{{TENANT_SCHEMA}}".pos_refund (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS pos_refund_return_idx
  ON "{{TENANT_SCHEMA}}".pos_refund (pos_return_id);

-- ---------------------------------------------------------------------------
-- Kolom pelengkap pada baris penjualan
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale_line
  ADD COLUMN IF NOT EXISTS warehouse_id     UUID,
  ADD COLUMN IF NOT EXISTS lot_id           UUID,
  ADD COLUMN IF NOT EXISTS price_book_id    UUID,
  ADD COLUMN IF NOT EXISTS returned_qty     NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_by      UUID,
  ADD COLUMN IF NOT EXISTS note             TEXT;

-- Jumlah yang diretur tidak pernah melebihi yang dijual. Ditegakkan basis
-- data: retur yang menghitung sendiri berapa sisanya akan salah begitu dua
-- retur atas transaksi yang sama diproses bersamaan.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'pos_sale_line_returned_bounded'
       AND conrelid = '"{{TENANT_SCHEMA}}".pos_sale_line'::regclass
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale_line
      ADD CONSTRAINT pos_sale_line_returned_bounded
      CHECK (returned_qty >= 0 AND returned_qty <= quantity);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pos_sale_line_sale_idx
  ON "{{TENANT_SCHEMA}}".pos_sale_line (pos_sale_id, line_no);
