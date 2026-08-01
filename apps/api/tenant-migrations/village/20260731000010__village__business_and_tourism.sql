-- =========================================================================
-- VILLAGE D-8 — BUMDes, UMKM, DAN WISATA
-- =========================================================================
--
-- ## BUMDes adalah badan hukum tersendiri
--
-- Desa menyertakan modal; ia tidak "punya kas BUMDes". Akibat yang paling
-- penting: **kerugian BUMDes tidak menjadi beban APBDes.** Begitu kerugian
-- dapat mengalir kembali sebagai angka negatif pada bagian desa, pemisahan
-- badan hukumnya sudah runtuh — bukan lewat keputusan, melainkan lewat satu
-- baris pembukuan. Karena itu:
--
--     CHECK (village_share_amount >= 0)
--
-- Rugi dicatat pada `net_result` yang boleh negatif; yang tidak boleh negatif
-- adalah yang mengalir ke desa.
--
-- ## Persentase bagi hasil dicuplik, bukan dirujuk
--
-- `village_share_pct` disalin ke tiap laporan hasil usaha. Laporan yang hanya
-- merujuk anggaran dasar akan berubah artinya ketika anggaran dasarnya diubah,
-- dan laporan tahun lalu yang berubah artinya bukan laporan.
--
-- ## Rujukan ke vertikal lain disimpan tanpa foreign key
--
-- `pos_outlet_id`, `marketplace_listing_id`, dan `cooperative_id` menunjuk
-- entitas milik sistem lain. Keduanya sengaja tidak berelasi: foreign key yang
-- melintasi batas vertikal membuat migrasi satu vertikal dapat mematahkan
-- vertikal lain, dan itu persis yang dilarang perintah §3. Keabsahannya
-- diperiksa lewat port, bukan lewat basis data.

-- ---------------------------------------------------------------------------
-- BUMDes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_bumdes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  name            VARCHAR(300) NOT NULL,
  legal_entity_number VARCHAR(160),
  -- Peraturan desa tentang pendirian. BUMDes tanpa perdes bukan badan usaha
  -- milik desa melainkan usaha yang kebetulan dikelola perangkat desa.
  regulation_number VARCHAR(160),
  established_at  DATE,
  address         TEXT,
  phone           VARCHAR(40),
  email           VARCHAR(160),

  -- Persentase laba yang menjadi pendapatan asli desa, dari anggaran dasar.
  -- Bukan 100: BUMDes yang seluruh labanya disetor tidak akan tumbuh, dan tahun
  -- berikutnya desa menyertakan modal lagi untuk hal yang sama.
  village_share_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ad_art_established BOOLEAN NOT NULL DEFAULT FALSE,

  director_name   VARCHAR(200),
  director_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  supervisor_name VARCHAR(200),

  status          VARCHAR(16) NOT NULL DEFAULT 'DIRENCANAKAN',
  dissolved_at    DATE,
  dissolution_reason TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_bumdes_status_valid
    CHECK (status IN ('DIRENCANAKAN','BERDIRI','AKTIF','TIDAK_AKTIF','BUBAR')),
  CONSTRAINT village_bumdes_share_range CHECK (village_share_pct >= 0 AND village_share_pct < 100),
  -- BUMDes yang sudah berdiri wajib menyebut perdes pendiriannya.
  CONSTRAINT village_bumdes_established_needs_regulation
    CHECK (status = 'DIRENCANAKAN' OR btrim(coalesce(regulation_number, '')) <> ''),
  CONSTRAINT village_bumdes_dissolved_has_reason
    CHECK (status <> 'BUBAR' OR length(btrim(coalesce(dissolution_reason, ''))) >= 10)
);

-- Satu desa satu BUMDes. Yang bubar dikecualikan supaya pendirian berikutnya
-- tetap mungkin tanpa menghapus jejak yang sebelumnya.
CREATE UNIQUE INDEX IF NOT EXISTS village_bumdes_one_active
  ON "{{TENANT_SCHEMA}}".village_bumdes (village_unit_id)
  WHERE status <> 'BUBAR' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Unit usaha BUMDes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_bumdes_unit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_bumdes_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_bumdes (id) ON DELETE RESTRICT,

  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  business_type   VARCHAR(48) NOT NULL DEFAULT 'PERDAGANGAN',
  description     TEXT,
  manager_name    VARCHAR(200),
  employee_count  INTEGER NOT NULL DEFAULT 0,

  -- Outlet POS milik Core. Tanpa foreign key: batas vertikal.
  pos_outlet_id   UUID,
  pos_linked_at   TIMESTAMPTZ,

  status          VARCHAR(16) NOT NULL DEFAULT 'DIRENCANAKAN',
  started_at      DATE,
  closed_at       DATE,
  closure_reason  TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_bumdes_unit_status_valid
    CHECK (status IN ('DIRENCANAKAN','BERJALAN','TIDAK_AKTIF','TUTUP')),
  CONSTRAINT village_bumdes_unit_employee_not_negative CHECK (employee_count >= 0),
  CONSTRAINT village_bumdes_unit_closed_has_reason
    CHECK (status <> 'TUTUP' OR length(btrim(coalesce(closure_reason, ''))) >= 5),
  -- Tautan POS yang tercatat wajib menyebut kapan ditautkan, supaya ringkasan
  -- penjualan yang kosong dapat dibedakan dari tautan yang belum pernah dibuat.
  CONSTRAINT village_bumdes_unit_pos_link_dated
    CHECK (pos_outlet_id IS NULL OR pos_linked_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_bumdes_unit_code_unique
  ON "{{TENANT_SCHEMA}}".village_bumdes_unit (village_unit_id, code) WHERE deleted_at IS NULL;

-- Satu outlet POS ditautkan kepada paling banyak satu unit usaha. Dua unit yang
-- menunjuk outlet yang sama akan melaporkan penjualan yang sama dua kali.
CREATE UNIQUE INDEX IF NOT EXISTS village_bumdes_unit_pos_outlet_unique
  ON "{{TENANT_SCHEMA}}".village_bumdes_unit (pos_outlet_id)
  WHERE pos_outlet_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Penyertaan modal
-- ---------------------------------------------------------------------------
-- Wajib menunjuk transaksi APBDes-nya. Modal yang tercatat pada BUMDes tanpa
-- padanan pada APBDes berarti uangnya belum keluar, atau keluar tanpa dicatat.
-- Keduanya perlu ketahuan sekarang, bukan saat pemeriksaan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_bumdes_capital (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_bumdes_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_bumdes (id) ON DELETE RESTRICT,

  fiscal_year     INTEGER NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  regulation_number VARCHAR(160) NOT NULL,
  budget_transaction_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".village_budget_transaction (id) ON DELETE RESTRICT,
  transferred_at  DATE NOT NULL,
  note            TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_bumdes_capital_amount_positive CHECK (amount > 0),
  CONSTRAINT village_bumdes_capital_regulation_present
    CHECK (btrim(regulation_number) <> '')
);

-- Satu transaksi APBDes menjadi satu penyertaan modal. Dua penyertaan yang
-- menunjuk transaksi yang sama berarti uang yang keluar sekali dicatat dua
-- kali sebagai modal.
CREATE UNIQUE INDEX IF NOT EXISTS village_bumdes_capital_transaction_unique
  ON "{{TENANT_SCHEMA}}".village_bumdes_capital (budget_transaction_id);

CREATE INDEX IF NOT EXISTS village_bumdes_capital_bumdes_idx
  ON "{{TENANT_SCHEMA}}".village_bumdes_capital (village_bumdes_id, fiscal_year);

-- ---------------------------------------------------------------------------
-- Laporan hasil usaha
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_bumdes_result (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_bumdes_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_bumdes (id) ON DELETE RESTRICT,

  fiscal_year     INTEGER NOT NULL,
  revenue_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  expense_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Boleh negatif: BUMDes memang dapat rugi, dan menyembunyikannya tidak
  -- membuat uangnya kembali.
  net_result      NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Dicuplik dari `village_bumdes.village_share_pct` saat laporan dibuat.
  village_share_pct NUMERIC(5,2) NOT NULL,
  -- TIDAK PERNAH negatif. Kerugian BUMDes ditanggung modalnya sendiri; yang
  -- mengalir ke desa hanya bagian dari laba. Inilah constraint yang menjaga
  -- pemisahan badan hukumnya tetap berarti pada pembukuan, bukan hanya pada
  -- akta.
  village_share_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  retained_amount NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Transaksi APBDes tempat bagian desa diterima sebagai pendapatan asli desa.
  budget_transaction_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".village_budget_transaction (id) ON DELETE SET NULL,

  status          VARCHAR(16) NOT NULL DEFAULT 'DRAF',
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  report_document VARCHAR(500),

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_bumdes_result_status_valid
    CHECK (status IN ('DRAF','DIAJUKAN','DITETAPKAN')),
  CONSTRAINT village_bumdes_result_share_pct_range
    CHECK (village_share_pct >= 0 AND village_share_pct < 100),
  CONSTRAINT village_bumdes_result_share_not_negative CHECK (village_share_amount >= 0),
  CONSTRAINT village_bumdes_result_amounts_not_negative
    CHECK (revenue_amount >= 0 AND expense_amount >= 0),
  -- Rugi tidak menghasilkan bagian desa. Aturan yang sama dari sisi yang lain.
  CONSTRAINT village_bumdes_result_loss_pays_nothing
    CHECK (net_result > 0 OR village_share_amount = 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_bumdes_result_year_unique
  ON "{{TENANT_SCHEMA}}".village_bumdes_result (village_bumdes_id, fiscal_year);

-- ---------------------------------------------------------------------------
-- UMKM
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_umkm (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  code            VARCHAR(48) NOT NULL,
  business_name   VARCHAR(300) NOT NULL,
  -- Pemilik sebagai penduduk desa. Usaha yang pemiliknya tidak dikenali tidak
  -- dapat diverifikasi sebagai usaha warga desa ini.
  owner_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  owner_name      VARCHAR(200) NOT NULL,
  owner_user_id   UUID,

  business_sector VARCHAR(64),
  description     TEXT,
  address         TEXT,
  village_rt_id   UUID REFERENCES "{{TENANT_SCHEMA}}".village_rt (id) ON DELETE SET NULL,
  phone           VARCHAR(40),

  nib             VARCHAR(64),
  halal_certificate VARCHAR(64),
  pirt_number     VARCHAR(64),

  annual_turnover NUMERIC(18,2),
  -- Dihitung dari omzet, bukan diketik. Skala yang diisi sendiri akan mengikuti
  -- syarat bantuan yang sedang dibuka, bukan mengikuti usahanya.
  scale           VARCHAR(16),
  employee_count  INTEGER NOT NULL DEFAULT 0,

  status          VARCHAR(16) NOT NULL DEFAULT 'AKTIF',
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_umkm_scale_valid CHECK (scale IS NULL OR scale IN ('MIKRO','KECIL','MENENGAH')),
  CONSTRAINT village_umkm_status_valid CHECK (status IN ('AKTIF','TIDAK_AKTIF','TUTUP')),
  CONSTRAINT village_umkm_turnover_not_negative
    CHECK (annual_turnover IS NULL OR annual_turnover >= 0),
  CONSTRAINT village_umkm_employee_not_negative CHECK (employee_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_umkm_code_unique
  ON "{{TENANT_SCHEMA}}".village_umkm (village_unit_id, code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_umkm_owner_idx
  ON "{{TENANT_SCHEMA}}".village_umkm (owner_resident_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Produk UMKM
-- ---------------------------------------------------------------------------
-- Desa **menautkan** listing, tidak membuatnya. Produk yang didaftarkan
-- pemerintah desa atas nama warga menimbulkan pertanyaan siapa yang
-- bertanggung jawab bila produknya bermasalah — dan pertanyaan itu muncul
-- justru ketika keadaannya sedang buruk.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_umkm_product (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_umkm_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_umkm (id) ON DELETE CASCADE,

  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  unit            VARCHAR(32),
  price_display   VARCHAR(64),
  photo_path      VARCHAR(500),

  -- Listing milik marketplace. Tanpa foreign key: batas vertikal. Keabsahan
  -- dan kepemilikannya diperiksa lewat MarketplaceLinkPort sebelum ditautkan.
  marketplace_listing_id UUID,
  linked_at       TIMESTAMPTZ,
  linked_by       UUID,

  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  -- Tautan yang tercatat wajib menyebut kapan dan oleh siapa. Tautan tanpa
  -- jejak tidak dapat dipertanggungjawabkan ketika kepemilikannya digugat.
  CONSTRAINT village_umkm_product_link_traceable
    CHECK (marketplace_listing_id IS NULL OR (linked_at IS NOT NULL AND linked_by IS NOT NULL))
);

-- Satu listing ditautkan kepada paling banyak satu produk.
CREATE UNIQUE INDEX IF NOT EXISTS village_umkm_product_listing_unique
  ON "{{TENANT_SCHEMA}}".village_umkm_product (marketplace_listing_id)
  WHERE marketplace_listing_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_umkm_product_umkm_idx
  ON "{{TENANT_SCHEMA}}".village_umkm_product (village_umkm_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Destinasi wisata
-- ---------------------------------------------------------------------------
-- Penayangan adalah janji kepada orang yang belum pernah datang. Karena itu
-- destinasi yang ditayangkan wajib menyebut pengelola, kontak, dan tarifnya —
-- termasuk bila gratis. Destinasi yang ditayangkan tanpa tarif adalah destinasi
-- yang tarifnya ditentukan di pintu masuk, berbeda-beda menurut penampilan yang
-- datang.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_tourism_site (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  category        VARCHAR(48) NOT NULL DEFAULT 'ALAM',
  description     TEXT,
  address         TEXT,
  sub_area_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_sub_area (id) ON DELETE SET NULL,
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),

  manager_name    VARCHAR(200),
  manager_contact VARCHAR(64),
  manager_bumdes_unit_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".village_bumdes_unit (id) ON DELETE SET NULL,

  is_free         BOOLEAN NOT NULL DEFAULT FALSE,
  entry_fee       NUMERIC(14,2),
  open_hours      VARCHAR(160),
  facilities      TEXT,
  photo_count     INTEGER NOT NULL DEFAULT 0,

  annual_visitors INTEGER,
  status          VARCHAR(16) NOT NULL DEFAULT 'DIRENCANAKAN',
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_tourism_status_valid
    CHECK (status IN ('DIRENCANAKAN','BEROPERASI','TUTUP_SEMENTARA','TUTUP')),
  CONSTRAINT village_tourism_category_valid
    CHECK (category IN ('ALAM','BUDAYA','BUATAN','RELIGI','KULINER','EDUKASI')),
  CONSTRAINT village_tourism_fee_not_negative CHECK (entry_fee IS NULL OR entry_fee >= 0),
  CONSTRAINT village_tourism_photo_not_negative CHECK (photo_count >= 0),
  -- Gratis dan bertarif tidak dapat keduanya.
  CONSTRAINT village_tourism_free_has_no_fee
    CHECK (NOT is_free OR entry_fee IS NULL OR entry_fee = 0),
  -- Yang ditayangkan wajib lengkap. Constraint ini, bukan pemeriksaan layanan,
  -- yang menahan penayangan lewat jalan tulis mana pun.
  CONSTRAINT village_tourism_published_is_complete
    CHECK (
      NOT is_published OR (
        btrim(coalesce(manager_name, '')) <> ''
        AND btrim(coalesce(manager_contact, '')) <> ''
        AND photo_count >= 1
        AND (is_free OR (entry_fee IS NOT NULL AND entry_fee > 0))
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS village_tourism_code_unique
  ON "{{TENANT_SCHEMA}}".village_tourism_site (village_unit_id, code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Koperasi yang beroperasi di desa
-- ---------------------------------------------------------------------------
-- Village TIDAK menyimpan data koperasi. Tabel ini hanya mencatat bahwa sebuah
-- koperasi beroperasi di wilayah desa, beserta rujukan buramnya ke eKoperasi.
-- Tidak ada kolom simpanan, pinjaman, maupun tunggakan — desa tidak
-- berkepentingan mengetahuinya, dan kepentingan yang tidak ada tidak boleh
-- diberi jalan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_cooperative_presence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  name            VARCHAR(300) NOT NULL,
  cooperative_type VARCHAR(48),
  legal_number    VARCHAR(160),
  address         TEXT,
  contact_person  VARCHAR(200),
  phone           VARCHAR(40),

  -- Rujukan buram ke eKoperasi. Tanpa foreign key: batas vertikal.
  external_cooperative_id UUID,
  linked_at       TIMESTAMPTZ,

  status          VARCHAR(16) NOT NULL DEFAULT 'AKTIF',
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_cooperative_presence_status_valid
    CHECK (status IN ('AKTIF','TIDAK_AKTIF','BUBAR')),
  CONSTRAINT village_cooperative_presence_link_dated
    CHECK (external_cooperative_id IS NULL OR linked_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_cooperative_presence_external_unique
  ON "{{TENANT_SCHEMA}}".village_cooperative_presence (external_cooperative_id)
  WHERE external_cooperative_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Pemicu audit
-- ---------------------------------------------------------------------------
DO $install$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi audit tidak ada; pemicu audit usaha desa dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}' AND c.relkind = 'r'
       AND c.relname IN (
         'village_bumdes', 'village_bumdes_unit', 'village_bumdes_capital',
         'village_bumdes_result', 'village_umkm', 'village_umkm_product',
         'village_tourism_site', 'village_cooperative_presence'
       )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I',
      r.table_name, '{{TENANT_SCHEMA}}'
    );
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      r.table_name, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END
$install$;
