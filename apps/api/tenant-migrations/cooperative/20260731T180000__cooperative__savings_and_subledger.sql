-- =========================================================================
-- K-3 — SIMPANAN DAN BUKU PEMBANTU ANGGOTA
--
-- Migrasi modul. Aditif; tidak ada tabel maupun kolom Core yang disentuh.
--
-- Dua keputusan menentukan bentuk berkas ini:
--
-- 1. Simpanan pokok dan wajib adalah EKUITAS koperasi, bukan kewajiban.
--    Keduanya tidak dapat ditarik selama keanggotaan berjalan. Menyamakannya
--    dengan simpanan sukarela membuat neraca menyatakan modal sendiri jauh
--    lebih kecil daripada sebenarnya.
--
-- 2. Saldo adalah PROYEKSI dari buku transaksinya, bukan kolom yang disunting.
--    Kolom saldo tetap ada sebagai cache — tanpa itu setiap pembacaan saldo
--    harus menjumlahkan seluruh riwayat — tetapi kebenarannya ada pada
--    mutasinya, dan uji rekonsiliasi K-8 membangunnya ulang untuk membuktikan
--    keduanya cocok.
-- =========================================================================

-- Produk simpanan -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_saving_product (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,

  saving_kind     VARCHAR(24) NOT NULL,

  -- Besaran wajib. Untuk pokok: sekali bayar. Untuk wajib: per periode.
  required_amount NUMERIC(18,2),
  period_unit     VARCHAR(16),

  minimum_deposit NUMERIC(18,2) NOT NULL DEFAULT 0,
  minimum_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  admin_fee       NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Bagi hasil. Koperasi syariah memakai `nisbah`; konvensional memakai
  -- `interest_rate`. Keduanya tidak boleh diisi bersamaan — produk yang
  -- membawa bunga sekaligus nisbah adalah produk yang tidak dapat dijelaskan
  -- kepada Dewan Pengawas Syariah maupun kepada pengawas konvensional.
  interest_rate   NUMERIC(9,6),
  nisbah          NUMERIC(9,6),
  term_months     INTEGER,
  dormant_after_days INTEGER NOT NULL DEFAULT 365,

  allows_withdrawal BOOLEAN NOT NULL DEFAULT TRUE,
  is_equity       BOOLEAN NOT NULL DEFAULT FALSE,
  counts_for_capital_service BOOLEAN NOT NULL DEFAULT FALSE,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_coop_saving_product_code UNIQUE (cooperative_id, code),
  CONSTRAINT ck_coop_saving_kind
    CHECK (saving_kind IN ('PRINCIPAL', 'MANDATORY', 'VOLUNTARY', 'TIME_DEPOSIT')),
  CONSTRAINT ck_coop_saving_period_unit
    CHECK (period_unit IS NULL OR period_unit IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
  -- Bunga dan nisbah tidak boleh diisi bersamaan.
  CONSTRAINT ck_coop_saving_rate_exclusive
    CHECK (interest_rate IS NULL OR nisbah IS NULL),
  -- Pokok dan wajib WAJIB ditandai ekuitas dan tidak dapat ditarik. Ditegakkan
  -- basis data supaya seseorang tidak dapat membuat "simpanan wajib yang dapat
  -- ditarik" — yang secara hukum bukan simpanan wajib lagi.
  CONSTRAINT ck_coop_saving_equity_consistent
    CHECK (saving_kind NOT IN ('PRINCIPAL', 'MANDATORY')
           OR (is_equity = TRUE AND allows_withdrawal = FALSE)),
  CONSTRAINT ck_coop_saving_liability_consistent
    CHECK (saving_kind NOT IN ('VOLUNTARY', 'TIME_DEPOSIT') OR is_equity = FALSE),
  CONSTRAINT ck_coop_saving_mandatory_needs_amount
    CHECK (saving_kind <> 'MANDATORY' OR (required_amount IS NOT NULL AND period_unit IS NOT NULL)),
  CONSTRAINT ck_coop_saving_principal_needs_amount
    CHECK (saving_kind <> 'PRINCIPAL' OR required_amount IS NOT NULL)
);

-- Hanya satu produk simpanan pokok yang aktif per koperasi. Dua simpanan pokok
-- berarti dua besaran modal keanggotaan, dan tidak ada yang tahu mana yang
-- menentukan keabsahan keanggotaan.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_saving_product_single_principal
  ON "{{TENANT_SCHEMA}}".cooperative_saving_product (cooperative_id)
  WHERE saving_kind = 'PRINCIPAL' AND is_active = TRUE AND deleted_at IS NULL;

-- Rekening simpanan ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_saving_account (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,
  product_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_saving_product (id) ON DELETE RESTRICT,

  account_number  VARCHAR(64) NOT NULL,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  maturity_date   DATE,

  -- Cache dari buku transaksinya. Kebenarannya ada pada mutasinya; kolom ini
  -- ada supaya pembacaan saldo tidak menjumlahkan seluruh riwayat.
  balance         NUMERIC(18,2) NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,

  status          VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_saving_account_status
    CHECK (status IN ('ACTIVE', 'DORMANT', 'FROZEN', 'CLOSED')),
  -- Saldo simpanan tidak pernah negatif. Simpanan bukan pinjaman.
  CONSTRAINT ck_coop_saving_account_balance_nonnegative CHECK (balance >= 0),
  CONSTRAINT ck_coop_saving_account_closed_needs_date
    CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_saving_account_number
  ON "{{TENANT_SCHEMA}}".cooperative_saving_account (cooperative_id, account_number)
  WHERE deleted_at IS NULL;

-- Satu anggota hanya punya satu rekening per produk yang belum ditutup.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_saving_account_member_product
  ON "{{TENANT_SCHEMA}}".cooperative_saving_account (member_id, product_id)
  WHERE status <> 'CLOSED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_coop_saving_account_member
  ON "{{TENANT_SCHEMA}}".cooperative_saving_account (member_id, status);

-- Transaksi simpanan --------------------------------------------------------
--
-- Buku besar rekening. Append-only pada praktiknya: koreksi dicatat sebagai
-- mutasi lawan, bukan dengan menyunting mutasi lama. Mutasi yang disunting
-- menghapus jejak kesalahannya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_saving_transaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_saving_account (id) ON DELETE RESTRICT,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,

  transaction_number VARCHAR(64),
  transaction_type VARCHAR(24) NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Periode yang dibayar, untuk simpanan wajib. Tunggakan dihitung dari
  -- periode, bukan dari selisih nilai: menyetor dua kali lipat pada satu bulan
  -- tidak melunasi bulan yang terlewat.
  period_code     VARCHAR(16),

  amount          NUMERIC(18,2) NOT NULL,
  balance_after   NUMERIC(18,2) NOT NULL,

  payment_method_id UUID REFERENCES "{{TENANT_SCHEMA}}".payment_method (id) ON DELETE SET NULL,
  reference       VARCHAR(120),
  note            TEXT,

  -- Tautan ke peristiwa akuntansi. Kosong sampai IR-003 disetujui — peristiwanya
  -- tercatat tetapi belum dijurnal mesin Core.
  accounting_event_id UUID,
  posting_key     VARCHAR(120),
  idempotency_key VARCHAR(120),

  reversed_by_id  UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_saving_transaction (id) ON DELETE SET NULL,
  reversal_of_id  UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_saving_transaction (id) ON DELETE SET NULL,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  active_role_id  UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_saving_txn_type CHECK (transaction_type IN (
    'DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'PROFIT_SHARING',
    'ADMIN_FEE', 'CORRECTION_IN', 'CORRECTION_OUT', 'CLOSING_PAYOUT')),
  CONSTRAINT ck_coop_saving_txn_amount_positive CHECK (amount > 0),
  CONSTRAINT ck_coop_saving_txn_balance_nonnegative CHECK (balance_after >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_saving_txn_idempotency
  ON "{{TENANT_SCHEMA}}".cooperative_saving_transaction (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_saving_txn_number
  ON "{{TENANT_SCHEMA}}".cooperative_saving_transaction (transaction_number)
  WHERE transaction_number IS NOT NULL;

-- Satu periode simpanan wajib hanya dibayar sekali per rekening.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_saving_txn_period
  ON "{{TENANT_SCHEMA}}".cooperative_saving_transaction (account_id, period_code)
  WHERE period_code IS NOT NULL AND transaction_type = 'DEPOSIT';

CREATE INDEX IF NOT EXISTS ix_coop_saving_txn_account
  ON "{{TENANT_SCHEMA}}".cooperative_saving_transaction (account_id, transaction_date, created_at);

CREATE INDEX IF NOT EXISTS ix_coop_saving_txn_member
  ON "{{TENANT_SCHEMA}}".cooperative_saving_transaction (member_id, transaction_date);

-- Buku pembantu anggota -----------------------------------------------------
--
-- BUKAN buku besar kedua. Ia rincian per anggota atas akun yang sama, dan
-- setiap barisnya menunjuk peristiwa akuntansi yang menjadi asalnya.
--
-- Invarian yang diuji pada K-8: jumlah seluruh baris buku pembantu atas satu
-- akun WAJIB sama dengan saldo akun itu di buku besar.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_subledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE RESTRICT,

  subledger_type  VARCHAR(16) NOT NULL,
  account_id      UUID REFERENCES "{{TENANT_SCHEMA}}".chart_of_account (id) ON DELETE RESTRICT,

  reference_type  VARCHAR(48) NOT NULL,
  reference_id    UUID NOT NULL,
  reference_number VARCHAR(64),

  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  debit           NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit          NUMERIC(18,2) NOT NULL DEFAULT 0,
  balance_after   NUMERIC(18,2) NOT NULL DEFAULT 0,

  accounting_event_id UUID,
  description     TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_subledger_type
    CHECK (subledger_type IN ('SAVING', 'LOAN', 'SHU', 'WALLET')),
  -- Satu baris hanya boleh debit ATAU kredit, tidak keduanya dan tidak
  -- keduanya nol. Baris yang bernilai nol pada keduanya tidak berarti apa-apa
  -- tetapi ikut terhitung saat rekonsiliasi.
  CONSTRAINT ck_coop_subledger_one_side
    CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  CONSTRAINT ck_coop_subledger_nonnegative CHECK (debit >= 0 AND credit >= 0)
);

CREATE INDEX IF NOT EXISTS ix_coop_subledger_member
  ON "{{TENANT_SCHEMA}}".cooperative_member_subledger (member_id, subledger_type, entry_date);

CREATE INDEX IF NOT EXISTS ix_coop_subledger_account
  ON "{{TENANT_SCHEMA}}".cooperative_member_subledger (account_id, entry_date);

CREATE INDEX IF NOT EXISTS ix_coop_subledger_reference
  ON "{{TENANT_SCHEMA}}".cooperative_member_subledger (reference_type, reference_id);

-- Rekening koran ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_saving_statement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_saving_account (id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  opening_balance NUMERIC(18,2) NOT NULL,
  total_credit    NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_debit     NUMERIC(18,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(18,2) NOT NULL,
  average_balance NUMERIC(18,2),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by    UUID,
  file_id         UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_statement_period CHECK (period_end >= period_start),
  -- Saldo akhir wajib sama dengan saldo awal ditambah mutasinya. Rekening koran
  -- yang tidak seimbang adalah rekening koran yang salah, dan anggota yang
  -- menerimanya akan mempertanyakan seluruh catatan koperasi.
  CONSTRAINT ck_coop_statement_balanced
    CHECK (closing_balance = opening_balance + total_credit - total_debit)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_statement_period
  ON "{{TENANT_SCHEMA}}".cooperative_saving_statement (account_id, period_start, period_end);
