-- =========================================================================
-- VILLAGE D-7 — ASET, PENGADAAN, DAN BANTUAN
-- =========================================================================
--
-- ## Aset desa tidak disusutkan
--
-- Penyusutan membebankan harga perolehan kepada periode yang menikmati
-- manfaatnya, supaya laba tiap periode terukur. Balai desa tidak menghasilkan
-- pendapatan yang perlu dilawankan dengan beban apa pun. Yang ditanyakan pada
-- Musyawarah Desa adalah pertanyaan lain — mana yang rusak dan perlu
-- diperbaiki tahun ini — sehingga yang dicatat di sini `condition`, bukan nilai
-- buku.
--
-- ## Kriteria bantuan disimpan sebagai pohon, bukan sebagai teks
--
-- `criteria` berbentuk JSONB dan **tidak pernah dieksekusi**. Menyimpan
-- kriteria sebagai ekspresi lalu mengevaluasinya — `eval`, `new Function`, atau
-- menempelkannya ke `WHERE` — berarti siapa pun yang dapat menyunting kriteria
-- program bantuan dapat menjalankan kode di server. Yang menyunting kriteria
-- adalah operator desa, dan pada satu dari sekian ribu desa ada operator yang
-- akan mencobanya.
--
-- ## Bantuan sejenis tidak berganda, dan itu ditegakkan indeks
--
-- Dua petugas yang menetapkan warga yang sama pada dua program berbeda secara
-- bersamaan akan sama-sama lolos pemeriksaan layanan: keduanya membaca daftar
-- penerima yang sama, keduanya tidak menemukan bentrok. Indeks unik parsial
-- pada (warga, jenis bantuan, tahun) tidak dapat dilewati dengan cara itu.
--
-- Indeks memakai **tahun anggaran**, bukan rentang tanggal. Rentang menuntut
-- `btree_gist`, dan migrasi ini dijalankan setiap kali sebuah desa mendaftar:
-- satu desa gagal disiapkan karena ekstensi tidak terpasang jauh lebih buruk
-- daripada penegakan yang sedikit lebih kasar. Rentang yang sesungguhnya tetap
-- diperiksa layanan, yang pesannya dapat dibaca petugas.

-- ---------------------------------------------------------------------------
-- Penggolongan aset
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_asset_category (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  parent_id       UUID REFERENCES "{{TENANT_SCHEMA}}".village_asset_category (id) ON DELETE RESTRICT,
  -- Golongan Kartu Inventaris Barang: A tanah, B peralatan dan mesin,
  -- C gedung dan bangunan, D jalan/irigasi/jaringan, E aset tetap lainnya,
  -- F konstruksi dalam pengerjaan. Penggolongan yang sudah dipakai
  -- pemerintahan, bukan penggolongan baru yang lebih rapi — petugas menyalin
  -- dari daftar ini ketika melapor ke kecamatan.
  kib_group       CHAR(1) NOT NULL,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_asset_category_kib_valid CHECK (kib_group IN ('A','B','C','D','E','F')),
  CONSTRAINT village_asset_category_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_asset_category_code_unique
  ON "{{TENANT_SCHEMA}}".village_asset_category (village_unit_id, code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Register aset
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_asset (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  category_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_asset_category (id) ON DELETE RESTRICT,

  register_number VARCHAR(64) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  kib_group       CHAR(1) NOT NULL,

  -- DESA, DAERAH, atau PIHAK_KETIGA. Kelurahan tidak dapat mencatat DESA:
  -- ia perangkat daerah dan tidak memiliki kekayaan sendiri. Ditegakkan
  -- layanan, karena constraint di sini tidak dapat melihat profil unitnya.
  ownership       VARCHAR(16) NOT NULL DEFAULT 'DESA',

  acquisition_date  DATE,
  acquisition_source VARCHAR(32) NOT NULL DEFAULT 'PEMBELIAN',
  acquisition_value NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Aset yang dibeli dari APBDes menunjuk transaksi anggarannya. Uang desa yang
  -- berubah menjadi barang tetapi barangnya tidak masuk register adalah temuan
  -- pemeriksaan yang paling sering muncul: uangnya dipertanggungjawabkan,
  -- barangnya tidak.
  budget_transaction_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_budget_transaction (id) ON DELETE SET NULL,

  quantity        NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit            VARCHAR(32),
  location_note   TEXT,
  sub_area_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_sub_area (id) ON DELETE SET NULL,

  -- Yang dicatat kondisinya, bukan nilai bukunya. Traktor berumur sepuluh tahun
  -- yang terawat lebih berguna daripada traktor berumur dua tahun yang rusak
  -- berat, dan penyusutan garis lurus menyatakan sebaliknya.
  condition       VARCHAR(16) NOT NULL DEFAULT 'BAIK',
  status          VARCHAR(16) NOT NULL DEFAULT 'AKTIF',

  certificate_number VARCHAR(160),
  photo_path      VARCHAR(500),
  is_lendable     BOOLEAN NOT NULL DEFAULT FALSE,
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_asset_kib_valid CHECK (kib_group IN ('A','B','C','D','E','F')),
  CONSTRAINT village_asset_ownership_valid CHECK (ownership IN ('DESA','DAERAH','PIHAK_KETIGA')),
  CONSTRAINT village_asset_condition_valid CHECK (condition IN ('BAIK','RUSAK_RINGAN','RUSAK_BERAT')),
  CONSTRAINT village_asset_status_valid CHECK (status IN ('AKTIF','DIPINJAM','DIPELIHARA','DIHAPUS')),
  CONSTRAINT village_asset_source_valid
    CHECK (acquisition_source IN ('PEMBELIAN','HIBAH','SWADAYA','WARISAN_DESA','PELIMPAHAN','LAINNYA')),
  CONSTRAINT village_asset_value_not_negative CHECK (acquisition_value >= 0),
  CONSTRAINT village_asset_quantity_positive CHECK (quantity > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_asset_register_unique
  ON "{{TENANT_SCHEMA}}".village_asset (village_unit_id, register_number) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_asset_status_idx
  ON "{{TENANT_SCHEMA}}".village_asset (village_unit_id, status, condition) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_asset_budget_idx
  ON "{{TENANT_SCHEMA}}".village_asset (budget_transaction_id) WHERE budget_transaction_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Peminjaman
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_asset_borrowing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_asset_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_asset (id) ON DELETE RESTRICT,

  borrower_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  borrower_name   VARCHAR(200) NOT NULL,
  borrower_phone  VARCHAR(32),
  borrower_institution VARCHAR(200),
  purpose         TEXT NOT NULL,

  borrowed_at     DATE NOT NULL,
  -- Wajib. Peminjaman tanpa batas waktu bukan peminjaman melainkan pemberian,
  -- dan register akan menyimpan barang yang sudah lama tidak ada di tempatnya
  -- tanpa seorang pun merasa perlu menanyakannya.
  due_at          DATE NOT NULL,
  returned_at     DATE,
  condition_on_return VARCHAR(16),
  return_note     TEXT,

  status          VARCHAR(16) NOT NULL DEFAULT 'DIPINJAM',
  approved_by     UUID,
  handed_over_by  UUID,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_asset_borrowing_status_valid
    CHECK (status IN ('DIPINJAM','DIKEMBALIKAN','TERLAMBAT','HILANG')),
  CONSTRAINT village_asset_borrowing_due_after_start CHECK (due_at >= borrowed_at),
  CONSTRAINT village_asset_borrowing_return_after_start
    CHECK (returned_at IS NULL OR returned_at >= borrowed_at),
  CONSTRAINT village_asset_borrowing_return_condition
    CHECK (condition_on_return IS NULL OR condition_on_return IN ('BAIK','RUSAK_RINGAN','RUSAK_BERAT')),
  -- Peminjaman yang sudah selesai wajib menyebut tanggal kembalinya.
  CONSTRAINT village_asset_borrowing_returned_has_date
    CHECK (status <> 'DIKEMBALIKAN' OR returned_at IS NOT NULL)
);

-- Satu aset hanya dapat sedang dipinjam oleh satu orang.
--
-- Bukan aturan administrasi melainkan kenyataan: proyektornya hanya satu.
-- Ditegakkan indeks, bukan layanan — dua permintaan pinjam yang tiba bersamaan
-- akan sama-sama membaca status AKTIF dan keduanya lolos pemeriksaan layanan.
CREATE UNIQUE INDEX IF NOT EXISTS village_asset_borrowing_one_active
  ON "{{TENANT_SCHEMA}}".village_asset_borrowing (village_asset_id)
  WHERE status IN ('DIPINJAM', 'TERLAMBAT');

CREATE INDEX IF NOT EXISTS village_asset_borrowing_due_idx
  ON "{{TENANT_SCHEMA}}".village_asset_borrowing (village_unit_id, due_at)
  WHERE status IN ('DIPINJAM', 'TERLAMBAT');

-- ---------------------------------------------------------------------------
-- Pemeliharaan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_asset_maintenance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_asset_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_asset (id) ON DELETE RESTRICT,

  maintenance_type VARCHAR(24) NOT NULL DEFAULT 'PERBAIKAN',
  scheduled_at    DATE,
  performed_at    DATE,
  description     TEXT NOT NULL,
  vendor_name     VARCHAR(200),
  cost            NUMERIC(18,2) NOT NULL DEFAULT 0,
  budget_transaction_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_budget_transaction (id) ON DELETE SET NULL,

  condition_before VARCHAR(16),
  condition_after  VARCHAR(16),
  status          VARCHAR(16) NOT NULL DEFAULT 'DIRENCANAKAN',

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_asset_maintenance_type_valid
    CHECK (maintenance_type IN ('PERBAIKAN','PERAWATAN','KALIBRASI','PENGGANTIAN_SUKU_CADANG')),
  CONSTRAINT village_asset_maintenance_status_valid
    CHECK (status IN ('DIRENCANAKAN','BERJALAN','SELESAI','DIBATALKAN')),
  CONSTRAINT village_asset_maintenance_cost_not_negative CHECK (cost >= 0),
  CONSTRAINT village_asset_maintenance_done_has_date
    CHECK (status <> 'SELESAI' OR performed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS village_asset_maintenance_asset_idx
  ON "{{TENANT_SCHEMA}}".village_asset_maintenance (village_asset_id, status);

-- ---------------------------------------------------------------------------
-- Penghapusan
-- ---------------------------------------------------------------------------
-- Wajib berdasar keputusan yang bernomor. Aset yang lenyap dari register tanpa
-- dasar keputusan bukanlah aset yang dihapus melainkan aset yang hilang, dan
-- sistem tidak boleh menjadi tempat sebuah barang berhenti ada diam-diam.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_asset_disposal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_asset_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_asset (id) ON DELETE RESTRICT,

  method          VARCHAR(24) NOT NULL,
  decision_number VARCHAR(160) NOT NULL,
  decision_date   DATE NOT NULL,
  reason          TEXT NOT NULL,
  disposal_value  NUMERIC(18,2),
  recipient_name  VARCHAR(200),

  proposed_by     UUID,
  approved_by     UUID,
  status          VARCHAR(16) NOT NULL DEFAULT 'DIUSULKAN',

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_asset_disposal_method_valid
    CHECK (method IN ('DIJUAL','DIHIBAHKAN','DIMUSNAHKAN','HILANG','TERTIMPA_BENCANA')),
  CONSTRAINT village_asset_disposal_status_valid
    CHECK (status IN ('DIUSULKAN','DISETUJUI','SELESAI','DITOLAK')),
  CONSTRAINT village_asset_disposal_decision_present CHECK (btrim(decision_number) <> ''),
  CONSTRAINT village_asset_disposal_reason_present CHECK (length(btrim(reason)) >= 10),
  -- Hasil penjualan aset desa adalah pendapatan desa; ia harus dapat
  -- ditelusuri, bukan menghilang bersama barangnya.
  CONSTRAINT village_asset_disposal_sale_has_value
    CHECK (method <> 'DIJUAL' OR (disposal_value IS NOT NULL AND disposal_value > 0))
);

-- Satu aset dihapus satu kali. Penghapusan kedua atas aset yang sama berarti
-- ada dua keputusan atas barang yang sudah tidak ada.
CREATE UNIQUE INDEX IF NOT EXISTS village_asset_disposal_one_final
  ON "{{TENANT_SCHEMA}}".village_asset_disposal (village_asset_id)
  WHERE status IN ('DIUSULKAN', 'DISETUJUI', 'SELESAI');

-- ---------------------------------------------------------------------------
-- Rencana pengadaan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_procurement_plan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  fiscal_year     INTEGER NOT NULL,

  -- Wajib. Pengadaan tanpa pagu akan ketahuan saat pembayarannya ditolak,
  -- ketika barangnya sudah telanjur dipesan.
  budget_line_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_budget_line (id) ON DELETE RESTRICT,
  village_activity_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_activity (id) ON DELETE SET NULL,

  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  specification   TEXT,
  quantity        NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit            VARCHAR(32),
  estimated_value NUMERIC(18,2) NOT NULL,
  -- SWAKELOLA untuk yang kecil, PENYEDIA untuk yang besar. Swakelola bukan
  -- kelonggaran melainkan tujuan: uang desa yang berputar di desa itu sendiri.
  method          VARCHAR(16) NOT NULL DEFAULT 'SWAKELOLA',
  planned_quarter SMALLINT,
  status          VARCHAR(16) NOT NULL DEFAULT 'DIRENCANAKAN',
  realized_value  NUMERIC(18,2) NOT NULL DEFAULT 0,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_procurement_method_valid CHECK (method IN ('SWAKELOLA','PENYEDIA')),
  CONSTRAINT village_procurement_status_valid
    CHECK (status IN ('DIRENCANAKAN','BERJALAN','SELESAI','DIBATALKAN')),
  CONSTRAINT village_procurement_value_positive CHECK (estimated_value > 0),
  CONSTRAINT village_procurement_quarter_valid
    CHECK (planned_quarter IS NULL OR planned_quarter BETWEEN 1 AND 4)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_procurement_code_unique
  ON "{{TENANT_SCHEMA}}".village_procurement_plan (village_unit_id, fiscal_year, code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Program bantuan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_aid_program (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  -- BLT, RUTILAHU, PKH, BEASISWA, dan seterusnya. Jenis inilah yang memutuskan
  -- apakah dua bantuan dianggap sejenis.
  aid_category    VARCHAR(48) NOT NULL,
  aid_form        VARCHAR(16) NOT NULL DEFAULT 'UANG',
  funding_source  VARCHAR(48) NOT NULL DEFAULT 'APBDES',

  fiscal_year     INTEGER NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  quota           INTEGER,
  amount_per_beneficiary NUMERIC(18,2),
  budget_line_id  UUID REFERENCES "{{TENANT_SCHEMA}}".village_budget_line (id) ON DELETE SET NULL,

  -- Bantuan yang memang dirancang menambah bantuan lain. Bawaannya tidak:
  -- bantuan yang diam-diam berganda bagi sebagian keluarga dan tidak bagi yang
  -- lain adalah cara pemerintah desa kehilangan kepercayaan warganya, dan
  -- bawaan yang aman menuntut seseorang memutuskan sebaliknya secara sadar.
  allow_stacking  BOOLEAN NOT NULL DEFAULT FALSE,

  status          VARCHAR(16) NOT NULL DEFAULT 'DRAF',
  regulation_number VARCHAR(160),
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_aid_program_form_valid CHECK (aid_form IN ('UANG','BARANG','JASA')),
  CONSTRAINT village_aid_program_status_valid
    CHECK (status IN ('DRAF','DIBUKA','DITUTUP','DISALURKAN','SELESAI','DIBATALKAN')),
  CONSTRAINT village_aid_program_period CHECK (period_end >= period_start),
  CONSTRAINT village_aid_program_quota_positive CHECK (quota IS NULL OR quota > 0),
  CONSTRAINT village_aid_program_amount_positive
    CHECK (amount_per_beneficiary IS NULL OR amount_per_beneficiary > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_aid_program_code_unique
  ON "{{TENANT_SCHEMA}}".village_aid_program (village_unit_id, code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Pendataan keadaan keluarga
-- ---------------------------------------------------------------------------
-- Kriteria kelayakan tidak dapat dinilai tanpa data yang dinilai. Sebagian
-- sudah diketahui sistem — usia, jenis kelamin kepala keluarga, RT, jenis
-- kedisabilitasan — dan itu diturunkan, bukan ditanyakan ulang. Sisanya hanya
-- diperoleh dengan mendatangi rumahnya, dan itulah isi tabel ini.
--
-- `surveyed_at` bukan kolom pelengkap. Penetapan bantuan atas data pendataan
-- tiga tahun lalu adalah penetapan atas desa yang sudah tidak ada; umur datanya
-- ikut disajikan pada hasil penyaringan supaya petugas melihatnya sebelum
-- memutuskan, bukan sesudah digugat.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_household_survey (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_family_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_family (id) ON DELETE CASCADE,
  survey_year     INTEGER NOT NULL,

  monthly_income  NUMERIC(18,2),
  dependent_count INTEGER,
  house_status    VARCHAR(24),
  floor_type      VARCHAR(24),
  floor_area_m2   NUMERIC(10,2),
  water_source    VARCHAR(32),
  electricity_va  INTEGER,
  has_motor_vehicle BOOLEAN,
  has_pregnant_member BOOLEAN,
  has_toddler     BOOLEAN,
  is_dtks_registered BOOLEAN,
  note            TEXT,

  surveyed_at     DATE NOT NULL,
  surveyed_by     UUID,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_household_survey_house_status_valid
    CHECK (house_status IS NULL OR house_status IN ('MILIK','SEWA','MENUMPANG','DINAS','LAINNYA')),
  CONSTRAINT village_household_survey_income_not_negative
    CHECK (monthly_income IS NULL OR monthly_income >= 0),
  CONSTRAINT village_household_survey_area_positive
    CHECK (floor_area_m2 IS NULL OR floor_area_m2 > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_household_survey_unique
  ON "{{TENANT_SCHEMA}}".village_household_survey (village_family_id, survey_year);

-- ---------------------------------------------------------------------------
-- Kriteria kelayakan
-- ---------------------------------------------------------------------------
-- `criteria` adalah pohon kondisi terstruktur, **tidak pernah dieksekusi**.
-- Bentuknya diperiksa layanan sebelum disimpan: setiap daun wajib menunjuk satu
-- ruas dari daftar tertutup, dengan satu pembanding dari daftar tertutup
-- lainnya. Kedalaman dan jumlah simpulnya dibatasi — pohon yang datang dari
-- badan permintaan adalah masukan yang tidak tepercaya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_aid_criteria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  aid_program_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_aid_program (id) ON DELETE CASCADE,

  name            VARCHAR(200) NOT NULL,
  criteria        JSONB NOT NULL,
  -- Diisi layanan dari hasil pemeriksaan bentuk, supaya kriteria yang tersimpan
  -- dapat ditinjau tanpa menelusuri pohonnya lagi.
  node_count      INTEGER NOT NULL DEFAULT 0,
  depth           INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_aid_criteria_is_object CHECK (jsonb_typeof(criteria) = 'object'),
  -- Akar pohon hanya boleh salah satu dari empat jenis yang dikenal. Bukan
  -- pengganti pemeriksaan bentuk di layanan — lapisan terakhir bila kelak ada
  -- jalan tulis lain ke tabel ini.
  CONSTRAINT village_aid_criteria_root_known
    CHECK (criteria->>'jenis' IN ('SEMUA','SALAH_SATU','TIDAK','BANDING')),
  CONSTRAINT village_aid_criteria_size_sane CHECK (node_count BETWEEN 0 AND 80 AND depth BETWEEN 0 AND 6)
);

CREATE INDEX IF NOT EXISTS village_aid_criteria_program_idx
  ON "{{TENANT_SCHEMA}}".village_aid_criteria (aid_program_id) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Calon penerima
-- ---------------------------------------------------------------------------
-- Penyaringan otomatis hanya sampai di sini. Baris pada tabel ini adalah
-- **dugaan**, bukan temuan; yang menjadikannya temuan adalah kunjungan petugas.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_aid_candidate (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  aid_program_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_aid_program (id) ON DELETE CASCADE,
  resident_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE RESTRICT,
  family_id       UUID REFERENCES "{{TENANT_SCHEMA}}".village_family (id) ON DELETE SET NULL,

  -- MANUAL, ATURAN, atau AI. Yang berasal dari AI tidak pernah menjadi penerima
  -- tanpa melewati manusia; kolom ini membuat asal usulnya tetap terbaca
  -- setelah penetapannya.
  source          VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
  proposed_by     UUID,
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Jejak penilaian kriteria: ruas mana lulus, mana tidak, dan berapa nilainya.
  -- Warga yang tidak masuk daftar akan bertanya mengapa, dan petugas yang tidak
  -- dapat menjawabnya akan dituduh pilih kasih.
  evaluation_trace JSONB,
  score           NUMERIC(8,4),

  status          VARCHAR(16) NOT NULL DEFAULT 'DIUSULKAN',
  verified_by     UUID,
  verified_at     TIMESTAMPTZ,
  verification_note TEXT,
  rejection_reason TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_aid_candidate_source_valid CHECK (source IN ('MANUAL','ATURAN','AI')),
  CONSTRAINT village_aid_candidate_status_valid
    CHECK (status IN ('DIUSULKAN','DIVERIFIKASI','DITETAPKAN','DITOLAK')),
  CONSTRAINT village_aid_candidate_verified_has_actor
    CHECK (status <> 'DIVERIFIKASI' OR verified_by IS NOT NULL),
  CONSTRAINT village_aid_candidate_rejected_has_reason
    CHECK (status <> 'DITOLAK' OR length(btrim(coalesce(rejection_reason, ''))) >= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_aid_candidate_unique
  ON "{{TENANT_SCHEMA}}".village_aid_candidate (aid_program_id, resident_id);

CREATE INDEX IF NOT EXISTS village_aid_candidate_status_idx
  ON "{{TENANT_SCHEMA}}".village_aid_candidate (aid_program_id, status);

-- ---------------------------------------------------------------------------
-- Penerima yang ditetapkan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_aid_beneficiary (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  aid_program_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_aid_program (id) ON DELETE RESTRICT,
  candidate_id    UUID REFERENCES "{{TENANT_SCHEMA}}".village_aid_candidate (id) ON DELETE SET NULL,
  resident_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE RESTRICT,

  -- Disalin dari programnya saat ditetapkan, bukan dibaca ulang kemudian.
  -- Jenis bantuan yang berlaku adalah jenis pada saat penetapan; penyuntingan
  -- program setelahnya tidak boleh mengubah arti penetapan yang sudah terjadi.
  aid_category    VARCHAR(48) NOT NULL,
  fiscal_year     INTEGER NOT NULL,
  allow_stacking  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Penetapan oleh manusia, tercatat siapa dan atas dasar apa. Kolom ini tidak
  -- boleh kosong: warga yang tidak menerima bantuan berhak mendapat jawaban
  -- dari seseorang, dan "begitu hasil sistemnya" bukan jawaban yang dapat
  -- dipertanggungjawabkan siapa pun.
  decided_by      UUID NOT NULL,
  -- Sesi tempat keputusan diambil. Kolom ini yang membuat batas "kecerdasan
  -- buatan tidak menetapkan" menjadi penegakan, bukan sekadar niat: pemanggilan
  -- otomatis dari dalam sistem tidak memiliki sesi, sehingga jalan kode yang
  -- kelak mencoba menetapkan penerima tanpa manusia yang masuk tidak dapat
  -- mengisinya. Penyaringan otomatis berhenti pada village_aid_candidate.
  decided_session_id UUID NOT NULL,
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision_basis  TEXT NOT NULL,
  decision_number VARCHAR(160),

  entitlement_amount NUMERIC(18,2),
  status          VARCHAR(16) NOT NULL DEFAULT 'AKTIF',
  ended_at        DATE,
  end_reason      TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_aid_beneficiary_status_valid CHECK (status IN ('AKTIF','SELESAI','DICABUT')),
  CONSTRAINT village_aid_beneficiary_basis_present CHECK (length(btrim(decision_basis)) >= 15),
  CONSTRAINT village_aid_beneficiary_revoked_has_reason
    CHECK (status <> 'DICABUT' OR length(btrim(coalesce(end_reason, ''))) >= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_aid_beneficiary_program_unique
  ON "{{TENANT_SCHEMA}}".village_aid_beneficiary (aid_program_id, resident_id)
  WHERE status <> 'DICABUT';

-- Satu warga tidak menerima bantuan sejenis dari dua jalur pada tahun yang
-- sama.
--
-- Dua petugas yang menetapkan warga yang sama pada dua program berbeda secara
-- bersamaan akan sama-sama lolos pemeriksaan layanan: keduanya membaca daftar
-- penerima yang sama, keduanya tidak menemukan bentrok. Indeks ini tidak dapat
-- dilewati dengan cara itu.
--
-- Program yang memang dirancang bertumpuk dikecualikan lewat `allow_stacking`,
-- yang harus dinyatakan pada rancangan programnya — bukan diputuskan diam-diam
-- per warga.
CREATE UNIQUE INDEX IF NOT EXISTS village_aid_beneficiary_no_double_dip
  ON "{{TENANT_SCHEMA}}".village_aid_beneficiary (resident_id, aid_category, fiscal_year)
  WHERE status = 'AKTIF' AND allow_stacking = FALSE;

-- ---------------------------------------------------------------------------
-- Penyaluran
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_aid_distribution (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  aid_program_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_aid_program (id) ON DELETE RESTRICT,
  beneficiary_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_aid_beneficiary (id) ON DELETE RESTRICT,

  -- Termin penyaluran: 1, 2, 3, … Satu termin satu kali.
  installment_no  SMALLINT NOT NULL DEFAULT 1,
  distributed_at  DATE NOT NULL,
  aid_form        VARCHAR(16) NOT NULL DEFAULT 'UANG',
  amount          NUMERIC(18,2) NOT NULL,
  item_description TEXT,

  -- PENERIMA atau KUASA. Penyaluran yang hanya tertulis "diwakilkan" tanpa nama
  -- tidak dapat ditelusuri ketika penerimanya menyatakan tidak pernah menerima
  -- apa pun — dan pernyataan itu pasti muncul sekurang-kurangnya sekali.
  received_by     VARCHAR(16) NOT NULL DEFAULT 'PENERIMA',
  proxy_name      VARCHAR(200),
  proxy_relation  VARCHAR(64),
  receipt_reference VARCHAR(160),
  photo_path      VARCHAR(500),

  budget_transaction_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_budget_transaction (id) ON DELETE SET NULL,
  distributed_by  UUID,
  idempotency_key VARCHAR(120),
  note            TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_aid_distribution_form_valid CHECK (aid_form IN ('UANG','BARANG','JASA')),
  CONSTRAINT village_aid_distribution_amount_positive CHECK (amount > 0),
  CONSTRAINT village_aid_distribution_installment_positive CHECK (installment_no >= 1),
  CONSTRAINT village_aid_distribution_receiver_valid CHECK (received_by IN ('PENERIMA','KUASA')),
  CONSTRAINT village_aid_distribution_proxy_named
    CHECK (received_by <> 'KUASA' OR length(btrim(coalesce(proxy_name, ''))) >= 2),
  -- Bantuan berbentuk uang wajib menyertakan bukti terima.
  CONSTRAINT village_aid_distribution_cash_has_receipt
    CHECK (aid_form <> 'UANG' OR length(btrim(coalesce(receipt_reference, ''))) >= 1)
);

-- Satu termin disalurkan satu kali kepada satu penerima. Penyaluran ganda pada
-- termin yang sama adalah pembayaran kedua, bukan pencatatan kedua.
CREATE UNIQUE INDEX IF NOT EXISTS village_aid_distribution_once
  ON "{{TENANT_SCHEMA}}".village_aid_distribution (beneficiary_id, installment_no);

CREATE UNIQUE INDEX IF NOT EXISTS village_aid_distribution_idempotency
  ON "{{TENANT_SCHEMA}}".village_aid_distribution (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS village_aid_distribution_program_idx
  ON "{{TENANT_SCHEMA}}".village_aid_distribution (aid_program_id, distributed_at);

-- ---------------------------------------------------------------------------
-- Pemicu audit
-- ---------------------------------------------------------------------------
-- Dipasang oleh migrasi 20260731000007 yang menelusuri tabel yang sudah ada
-- saat itu. Migrasi ini dijalankan sesudahnya, sehingga tabel di atas belum
-- ikut terpasang. Pemanggilannya sama: `audit_row_trigger()` pada skema audit.
DO $install$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi audit tidak ada; pemicu audit aset dan bantuan dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}' AND c.relkind = 'r'
       AND c.relname IN (
         'village_asset', 'village_asset_borrowing', 'village_asset_maintenance',
         'village_asset_disposal', 'village_procurement_plan', 'village_household_survey',
         'village_aid_program', 'village_aid_criteria', 'village_aid_candidate',
         'village_aid_beneficiary', 'village_aid_distribution'
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
