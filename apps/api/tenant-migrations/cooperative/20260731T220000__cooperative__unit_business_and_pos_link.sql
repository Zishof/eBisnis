-- =========================================================================
-- K-7 — UNIT USAHA DAN PENGHUBUNGNYA KE POS
--
-- Migrasi modul. Aditif; tidak ada tabel maupun kolom Core yang disentuh.
--
-- Satu keputusan menentukan bentuk berkas ini: **unit usaha koperasi TIDAK
-- memiliki POS sendiri.** Ia tertaut ke `outlet` dan `pos_terminal` milik Core
-- lewat satu tabel penghubung. Menghapus tabel penghubung itu harus cukup untuk
-- membuat POS berjalan tanpa koperasi, dan koperasi berjalan tanpa POS.
--
-- Membangun POS kedua akan menyelesaikan kebutuhan koperasi dalam sehari dan
-- menimbulkan masalah yang tidak selesai bertahun-tahun: persediaan terbelah
-- menjadi dua angka yang tidak pernah cocok saat opname, pembukuan terbelah
-- menjadi dua jalur jurnal, dan cacat yang dibetulkan pada POS Core tetap ada
-- pada POS koperasi sampai seseorang ingat menyalinnya.
-- =========================================================================

-- Unit usaha ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_unit_business (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  business_type   VARCHAR(24) NOT NULL,

  manager_member_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE SET NULL,

  -- Gudang unit usaha adalah gudang biasa milik Core yang dimiliki unit ini.
  -- Bukan gudang kedua; persediaan tetap satu.
  warehouse_id    UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE SET NULL,

  established_at  DATE,
  closed_at       DATE,
  status          VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_coop_unit_code UNIQUE (cooperative_id, code),
  CONSTRAINT ck_coop_unit_type CHECK (business_type IN
    ('RETAIL_STORE', 'CANTEEN', 'SAVINGS_LOAN', 'SERVICE', 'PRODUCTION',
     'AGRICULTURE', 'RENTAL', 'OTHER')),
  CONSTRAINT ck_coop_unit_status CHECK (status IN ('PLANNED', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
  CONSTRAINT ck_coop_unit_closed_needs_date
    CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_coop_unit_status
  ON "{{TENANT_SCHEMA}}".cooperative_unit_business (cooperative_id, status);

-- Penghubung ke POS ---------------------------------------------------------
--
-- Satu-satunya tempat konteks koperasi dan konteks POS bertemu.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_unit_pos_link (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  unit_business_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_unit_business (id) ON DELETE CASCADE,
  -- Menunjuk `outlet` milik Core. ON DELETE RESTRICT: outlet yang masih
  -- dimiliki unit usaha tidak boleh terhapus diam-diam.
  outlet_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".outlet (id) ON DELETE RESTRICT,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by       UUID,
  unlinked_at     TIMESTAMPTZ,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

/*
 * Satu outlet hanya boleh dimiliki satu unit usaha pada satu waktu.
 *
 * Dua unit yang mengaku memiliki outlet yang sama akan menghitung patronage
 * penjualan yang sama dua kali — dan SHU dibagikan atas angka itu.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_unit_pos_link_outlet
  ON "{{TENANT_SCHEMA}}".cooperative_unit_pos_link (outlet_id)
  WHERE unlinked_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_coop_unit_pos_link_unit
  ON "{{TENANT_SCHEMA}}".cooperative_unit_pos_link (unit_business_id)
  WHERE unlinked_at IS NULL;

-- Tautan kategori anggota ke kelompok pelanggan ------------------------------
--
-- Inilah yang membuat harga khusus anggota berjalan LEWAT MEKANISME POS YANG
-- SUDAH ADA — tanpa satu baris pun perubahan pada POS. Kasir memindai kartu
-- anggota, POS mengenali pelanggannya, dan buku harga berlingkup kelompok itu
-- berlaku.
--
-- Tautannya diletakkan di sini, bukan sebagai kolom pada `customer_group`,
-- sebab `customer_group` milik Core dan tidak boleh disentuh modul vertikal.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_member_price_link (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  member_category_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member_category (id) ON DELETE CASCADE,
  customer_group_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".customer_group (id) ON DELETE RESTRICT,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_price_link_period
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

-- Satu kelompok pelanggan hanya mewakili satu kategori anggota — harga yang
-- berlaku ditentukan kelompoknya, jadi dua kategori pada satu kelompok berarti
-- dua kategori berharga sama tanpa ada yang menyadarinya.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_price_link_group
  ON "{{TENANT_SCHEMA}}".cooperative_member_price_link (customer_group_id)
  WHERE effective_until IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coop_price_link_category
  ON "{{TENANT_SCHEMA}}".cooperative_member_price_link (member_category_id)
  WHERE effective_until IS NULL;

-- Anggaran unit usaha -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_unit_budget (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_business_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_unit_business (id) ON DELETE CASCADE,
  fiscal_year     INTEGER NOT NULL,
  revenue_target  NUMERIC(18,2) NOT NULL DEFAULT 0,
  expense_budget  NUMERIC(18,2) NOT NULL DEFAULT 0,
  capital_budget  NUMERIC(18,2) NOT NULL DEFAULT 0,
  approved_by_meeting_id UUID REFERENCES "{{TENANT_SCHEMA}}".cooperative_meeting_decision (id) ON DELETE SET NULL,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_coop_unit_budget UNIQUE (unit_business_id, fiscal_year),
  CONSTRAINT ck_coop_unit_budget_nonnegative
    CHECK (revenue_target >= 0 AND expense_budget >= 0 AND capital_budget >= 0)
);

-- Hasil usaha unit per periode ----------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_unit_period_result (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_business_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_unit_business (id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  revenue         NUMERIC(18,2) NOT NULL DEFAULT 0,
  cogs            NUMERIC(18,2) NOT NULL DEFAULT 0,
  operating_expense NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Beban umum koperasi yang dialokasikan ke unit ini. Tanpanya, unit tampak
  -- jauh lebih untung daripada sebenarnya, dan pengurus mengambil keputusan
  -- membuka unit baru berdasarkan angka yang belum menanggung bagiannya atas
  -- gaji, listrik, dan sewa kantor koperasi.
  allocated_overhead NUMERIC(18,2) NOT NULL DEFAULT 0,

  gross_profit    NUMERIC(18,2) NOT NULL DEFAULT 0,
  operating_profit NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_profit      NUMERIC(18,2) NOT NULL DEFAULT 0,

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  computed_by     UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_unit_result_period CHECK (period_end >= period_start),
  -- Ketiga laba wajib benar-benar merupakan hasil pengurangannya. Laporan yang
  -- angkanya tidak saling cocok tidak dapat dipertanggungjawabkan pada RAT.
  CONSTRAINT ck_coop_unit_result_gross CHECK (gross_profit = revenue - cogs),
  CONSTRAINT ck_coop_unit_result_operating
    CHECK (operating_profit = gross_profit - operating_expense),
  CONSTRAINT ck_coop_unit_result_net
    CHECK (net_profit = operating_profit - allocated_overhead),
  CONSTRAINT uq_coop_unit_result_period UNIQUE (unit_business_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS ix_coop_unit_result_unit
  ON "{{TENANT_SCHEMA}}".cooperative_unit_period_result (unit_business_id, period_end);

-- Pembacaan patronage dari POS ----------------------------------------------
--
-- DIBACA BERKALA dari POS, bukan ditulis saat transaksi terjadi. Patronage
-- dihitung atas periode buku yang sudah ditutup; menuliskannya saat transaksi
-- berarti angkanya ikut berubah setiap ada retur — sesudah SHU dihitung.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_unit_patronage_read (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative (id) ON DELETE CASCADE,
  unit_business_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_unit_business (id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  total_sales_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  attributed_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Penjualan yang tidak dapat ditautkan ke anggota mana pun. DILAPORKAN, bukan
  -- dibuang: unit toko yang sebagian besar penjualannya tidak teratribusi
  -- berarti kartu anggotanya jarang dipakai — keadaan yang perlu diketahui
  -- pengurus sebelum SHU dihitung, bukan sesudahnya.
  unattributed_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  unattributed_count   INTEGER NOT NULL DEFAULT 0,
  counted_sale_count   INTEGER NOT NULL DEFAULT 0,

  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_by         UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_coop_patronage_read_period CHECK (period_end >= period_start),
  -- Teratribusi + tidak teratribusi wajib sama dengan totalnya. Selisih di sini
  -- berarti ada penjualan yang tidak terhitung di kedua sisi.
  CONSTRAINT ck_coop_patronage_read_balanced
    CHECK (total_sales_amount = attributed_amount + unattributed_amount),
  CONSTRAINT ck_coop_patronage_read_nonnegative
    CHECK (total_sales_amount >= 0 AND attributed_amount >= 0 AND unattributed_amount >= 0),
  CONSTRAINT uq_coop_patronage_read UNIQUE (unit_business_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_unit_patronage_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  read_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_unit_patronage_read (id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_member (id) ON DELETE CASCADE,
  amount          NUMERIC(18,2) NOT NULL,
  sale_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT ck_coop_patronage_line_amount CHECK (amount > 0),
  CONSTRAINT uq_coop_patronage_line UNIQUE (read_id, member_id)
);

CREATE INDEX IF NOT EXISTS ix_coop_patronage_line_member
  ON "{{TENANT_SCHEMA}}".cooperative_unit_patronage_line (member_id);

-- Aset unit usaha -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".cooperative_unit_asset (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_business_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".cooperative_unit_business (id) ON DELETE CASCADE,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  asset_type      VARCHAR(32),
  acquired_at     DATE,
  acquisition_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  useful_life_months INTEGER,
  accumulated_depreciation NUMERIC(18,2) NOT NULL DEFAULT 0,
  disposed_at     DATE,
  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_coop_unit_asset_code UNIQUE (unit_business_id, code),
  -- Penyusutan tidak pernah melebihi harga perolehannya.
  CONSTRAINT ck_coop_unit_asset_depreciation
    CHECK (accumulated_depreciation >= 0 AND accumulated_depreciation <= acquisition_cost)
);
