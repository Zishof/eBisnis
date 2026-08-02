-- =========================================================================
-- ePesantren — EP-S6: Dapur dan katering
-- =========================================================================
--
-- Diminta langsung oleh pengguna ("masalah dapur/katering") -- bukan dari
-- audit sistem lama, sebab audit sistem lama tidak menemukan gugusan dapur
-- pada `master/sekolah` (dapur pondok bukan konsep sekolah formal). Tiga
-- tabel: menu makan per hari/waktu makan, konsumsi (porsi yang benar-benar
-- didistribusikan, dikelompokkan per asrama -- BUKAN per santri; dapur
-- pondok menghitung porsi, bukan mencatat siapa makan apa satu per satu),
-- dan stok bahan dapur dengan log pergerakan.
--
-- Stok bahan mengikuti pola yang SAMA dengan saldo dompet santri (EP-L):
-- `stok_saat_ini` adalah cache yang HANYA berubah bersamaan dengan baris log
-- pada transaksi yang sama (`SELECT ... FOR UPDATE`), bukan dipercaya
-- sebagai angka berdiri sendiri.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_menu_makan (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal                DATE NOT NULL DEFAULT CURRENT_DATE,
  waktu_makan            VARCHAR(16) NOT NULL,
  nama_menu              VARCHAR(255) NOT NULL,
  deskripsi              TEXT,
  jumlah_porsi_disiapkan INTEGER,
  status                 VARCHAR(16) NOT NULL DEFAULT 'DIRENCANAKAN',

  is_sample              BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id        UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by             UUID,
  deleted_at             TIMESTAMPTZ,
  version                INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_menu_makan
  ADD CONSTRAINT ck_pesantren_menu_makan_waktu
  CHECK (waktu_makan IN ('SARAPAN', 'MAKAN_SIANG', 'MAKAN_MALAM', 'SNACK'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_menu_makan
  ADD CONSTRAINT ck_pesantren_menu_makan_status
  CHECK (status IN ('DIRENCANAKAN', 'DISIAPKAN', 'SELESAI', 'DIBATALKAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_menu_makan
  ADD CONSTRAINT ck_pesantren_menu_makan_porsi
  CHECK (jumlah_porsi_disiapkan IS NULL OR jumlah_porsi_disiapkan > 0);

-- Satu menu per tanggal+waktu makan -- dua menu untuk sarapan yang sama
-- membuat dapur tidak tahu resep mana yang sebenarnya dimasak.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_menu_makan_slot
  ON "{{TENANT_SCHEMA}}".pesantren_menu_makan (tanggal, waktu_makan) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_konsumsi — porsi yang benar-benar didistribusikan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_konsumsi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_menu_makan (id) ON DELETE CASCADE,
  -- NULL berarti seluruh pondok (tidak dipilah per asrama).
  asrama_id       UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_asrama (id) ON DELETE SET NULL,
  jumlah_porsi    INTEGER NOT NULL,
  catatan         TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_konsumsi
  ADD CONSTRAINT ck_pesantren_konsumsi_porsi
  CHECK (jumlah_porsi > 0);

CREATE INDEX IF NOT EXISTS ix_pesantren_konsumsi_menu
  ON "{{TENANT_SCHEMA}}".pesantren_konsumsi (menu_id, deleted_at);

-- ---------------------------------------------------------------------------
-- pesantren_stok_dapur — bahan dan cache stoknya
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_stok_dapur (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_bahan      VARCHAR(160) NOT NULL,
  satuan          VARCHAR(16) NOT NULL,
  stok_saat_ini   NUMERIC(14,2) NOT NULL DEFAULT 0,
  stok_minimum    NUMERIC(14,2),

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_stok_dapur
  ADD CONSTRAINT ck_pesantren_stok_dapur_stok_tidak_negatif
  CHECK (stok_saat_ini >= 0);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_stok_dapur
  ADD CONSTRAINT ck_pesantren_stok_dapur_minimum
  CHECK (stok_minimum IS NULL OR stok_minimum >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_stok_dapur_nama
  ON "{{TENANT_SCHEMA}}".pesantren_stok_dapur (nama_bahan) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_stok_dapur_transaksi — log pergerakan (sumber kebenaran stok)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_stok_dapur_transaksi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_stok_dapur (id) ON DELETE CASCADE,
  jenis           VARCHAR(16) NOT NULL,
  jumlah          NUMERIC(14,2) NOT NULL,
  stok_sesudah    NUMERIC(14,2) NOT NULL,
  keterangan      TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_stok_dapur_transaksi
  ADD CONSTRAINT ck_pesantren_stok_dapur_transaksi_jenis
  CHECK (jenis IN ('MASUK', 'KELUAR', 'PENYESUAIAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_stok_dapur_transaksi
  ADD CONSTRAINT ck_pesantren_stok_dapur_transaksi_jumlah
  CHECK (jumlah > 0);

CREATE INDEX IF NOT EXISTS ix_pesantren_stok_dapur_transaksi_bahan
  ON "{{TENANT_SCHEMA}}".pesantren_stok_dapur_transaksi (bahan_id, created_at DESC);
