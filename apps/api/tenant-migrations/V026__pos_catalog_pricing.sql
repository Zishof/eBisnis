-- =========================================================================
-- V026 — PENUGASAN BUKU HARGA DAN PROMOSI KASIR
-- =========================================================================
--
-- Aditif. Dua tabel baru dan beberapa indeks; tidak ada yang diubah.
--
-- `price_book` sudah punya `scope_type` dan `scope_id`, tetapi tidak punya
-- PRIORITAS. Tanpa prioritas, dua buku harga yang sama-sama berlaku pada satu
-- outlet tidak dapat diputuskan mana yang menang, dan urutannya menjadi
-- bergantung pada urutan baris di basis data — yang berarti harga yang muncul
-- di kasir dapat berubah tanpa ada yang mengubah apa pun.

-- ---------------------------------------------------------------------------
-- Penugasan buku harga
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_price_book_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".price_book (id) ON DELETE CASCADE,
  scope_type      VARCHAR(24) NOT NULL,
  -- Kosong berarti berlaku untuk seluruh lingkup jenis itu. Penugasan tingkat
  -- TENANT tidak menunjuk apa pun; penugasan OUTLET menunjuk satu outlet.
  scope_id        UUID,
  -- Angka kecil menang. Kekhususan yang lebih tinggi diberi angka lebih kecil,
  -- sehingga harga khusus outlet mengalahkan harga tingkat tenant.
  priority        INTEGER NOT NULL DEFAULT 100,
  valid_from      DATE,
  valid_until     DATE,
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
  CONSTRAINT pos_price_book_assignment_scope_valid
    CHECK (scope_type IN ('TENANT', 'BRAND', 'OUTLET', 'CUSTOMER_GROUP', 'CHANNEL')),
  CONSTRAINT pos_price_book_assignment_period_valid
    CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS pos_price_book_assignment_scope_idx
  ON "{{TENANT_SCHEMA}}".pos_price_book_assignment (scope_type, scope_id)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS pos_price_book_assignment_unique
  ON "{{TENANT_SCHEMA}}".pos_price_book_assignment (
    price_book_id, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Promosi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_promotion (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(48) NOT NULL,
  name                VARCHAR(160) NOT NULL,
  description         TEXT,
  promotion_type      VARCHAR(24) NOT NULL DEFAULT 'LINE_DISCOUNT',
  /*
   * Pohon kondisi terstruktur, dievaluasi kode dengan DiscountEvaluatorService
   * yang sudah ada. TIDAK PERNAH dievaluasi dengan eval, Function, maupun SQL
   * bebas: ekspresi diskon yang dapat mengeksekusi kode sembarang adalah lubang
   * keamanan pada jalur uang, dan promosi adalah data yang boleh disunting
   * pengguna tenant.
   */
  condition_tree      JSONB,
  benefit_type        VARCHAR(16) NOT NULL DEFAULT 'PERCENT',
  benefit_value       NUMERIC(18,4) NOT NULL DEFAULT 0,
  max_discount_amount NUMERIC(18,4),
  minimum_purchase    NUMERIC(18,4),
  minimum_quantity    NUMERIC(18,4),
  scope_type          VARCHAR(24) NOT NULL DEFAULT 'TENANT',
  scope_id            UUID,
  valid_from          TIMESTAMPTZ,
  valid_until         TIMESTAMPTZ,
  -- Hari berlaku sebagai angka ISO 1..7; kosong berarti setiap hari.
  valid_days          SMALLINT[],
  valid_time_from     TIME,
  valid_time_to       TIME,
  usage_limit         INTEGER,
  usage_count         INTEGER NOT NULL DEFAULT 0,
  requires_approval   BOOLEAN NOT NULL DEFAULT FALSE,
  priority            INTEGER NOT NULL DEFAULT 100,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  deactivated_at      TIMESTAMPTZ,
  deactivated_by      UUID,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID,
  delete_reason       TEXT,
  version             INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pos_promotion_benefit_valid
    CHECK (benefit_type IN ('PERCENT', 'AMOUNT')),
  CONSTRAINT pos_promotion_benefit_nonnegative
    CHECK (benefit_value >= 0),
  -- Diskon persen di atas seratus persen berarti menyerahkan uang kepada
  -- pembeli. Ditolak di sini, bukan hanya diperiksa layanan.
  CONSTRAINT pos_promotion_percent_bounded
    CHECK (benefit_type <> 'PERCENT' OR benefit_value <= 100),
  CONSTRAINT pos_promotion_period_valid
    CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_promotion_code_unique
  ON "{{TENANT_SCHEMA}}".pos_promotion (code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pos_promotion_active_idx
  ON "{{TENANT_SCHEMA}}".pos_promotion (valid_from, valid_until)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Produk yang tercakup sebuah promosi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_promotion_product (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_promotion_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_promotion (id) ON DELETE CASCADE,
  product_id        UUID REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE CASCADE,
  product_category_id UUID REFERENCES "{{TENANT_SCHEMA}}".product_category (id) ON DELETE CASCADE,
  is_exclusion      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Satu baris menunjuk produk ATAU kategori, tidak keduanya dan tidak
  -- kosong keduanya.
  CONSTRAINT pos_promotion_product_target_valid
    CHECK (
      (product_id IS NOT NULL AND product_category_id IS NULL) OR
      (product_id IS NULL AND product_category_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS pos_promotion_product_promo_idx
  ON "{{TENANT_SCHEMA}}".pos_promotion_product (pos_promotion_id);

-- ---------------------------------------------------------------------------
-- Indeks pencarian katalog kasir
-- ---------------------------------------------------------------------------
-- Sasaran kinerja POS-2: pencarian barcode P95 di bawah 300 ms.
CREATE INDEX IF NOT EXISTS product_barcode_lookup_idx
  ON "{{TENANT_SCHEMA}}".product_barcode (barcode)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS product_sku_lookup_idx
  ON "{{TENANT_SCHEMA}}".product (sku)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS price_book_item_lookup_idx
  ON "{{TENANT_SCHEMA}}".price_book_item (product_id, price_book_id)
  WHERE deleted_at IS NULL AND is_active = TRUE;
