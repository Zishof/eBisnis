-- =========================================================================
-- VILLAGE D-6 — PERENCANAAN, APBDes, DAN ADAPTER KEUANGAN
-- =========================================================================
--
-- Seluruhnya `DESA_ONLY` kecuali `village_activity_plan`. Kelurahan tidak punya
-- APBDes karena ia bagian perangkat daerah, bukan karena fiturnya belum dibuat.
-- Kelayakannya ditegakkan layanan; tabelnya tetap dibuat pada kedua profil agar
-- migrasi tidak bercabang.
--
-- ## Penegakan pagu ada di basis data
--
-- Pada APBDes, belanja melampaui pagu adalah **pelanggaran** — bukan keputusan
-- yang boleh diambil dengan menekan "lanjutkan". Karena itu dua aturan
-- ditegakkan constraint, bukan diserahkan kepada layanan:
--
--     committed_amount <= ceiling_amount
--     realized_amount  <= committed_amount
--
-- Perhitungan sisa pagu yang dilakukan layanan akan salah begitu dua SPP
-- diproses bersamaan: keduanya membaca sisa yang sama, keduanya menyimpulkan
-- cukup, dan keduanya lolos. Constraint pada baris yang dikunci tidak dapat
-- dilewati dengan cara itu.
--
-- Aturan kedua patut disebut sendiri: realisasi dibatasi **ikatan**, bukan pagu.
-- Uang yang keluar tanpa ikatan adalah pengeluaran tanpa dasar — temuan
-- pemeriksaan, bukan sekadar kelalaian pencatatan.

-- ---------------------------------------------------------------------------
-- RPJM Desa
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_rpjm (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  -- Enam tahun, mengikuti masa jabatan Kepala Desa.
  start_year      INTEGER NOT NULL,
  end_year        INTEGER NOT NULL,
  title           VARCHAR(300) NOT NULL,
  vision          TEXT,
  mission         TEXT,
  regulation_number VARCHAR(160),
  established_at  DATE,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAF',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_rpjm_status_valid
    CHECK (status IN ('DRAF', 'DIBAHAS', 'DITETAPKAN', 'DIREVISI', 'SELESAI')),
  CONSTRAINT village_rpjm_period CHECK (end_year >= start_year),
  -- Periode yang lebih panjang dari sepuluh tahun hampir pasti salah ketik.
  CONSTRAINT village_rpjm_period_sane CHECK (end_year - start_year <= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_rpjm_period_unique
  ON "{{TENANT_SCHEMA}}".village_rpjm (village_unit_id, start_year);

-- ---------------------------------------------------------------------------
-- RKP Desa
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_rkp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_rpjm_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_rpjm (id) ON DELETE RESTRICT,
  fiscal_year     INTEGER NOT NULL,
  title           VARCHAR(300) NOT NULL,
  regulation_number VARCHAR(160),
  established_at  DATE,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAF',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_rkp_status_valid
    CHECK (status IN ('DRAF', 'DIBAHAS', 'DITETAPKAN', 'DIREVISI', 'SELESAI'))
);

CREATE UNIQUE INDEX IF NOT EXISTS village_rkp_year_unique
  ON "{{TENANT_SCHEMA}}".village_rkp (village_unit_id, fiscal_year);

-- ---------------------------------------------------------------------------
-- Bidang, kegiatan, sub-kegiatan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_rkp_id  UUID REFERENCES "{{TENANT_SCHEMA}}".village_rkp (id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES "{{TENANT_SCHEMA}}".village_activity (id) ON DELETE RESTRICT,

  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  -- BIDANG, KEGIATAN, atau SUB_KEGIATAN.
  level           VARCHAR(16) NOT NULL DEFAULT 'KEGIATAN',
  sector          VARCHAR(48),
  description     TEXT,
  location_note   TEXT,
  target_output   VARCHAR(300),
  beneficiary_count INTEGER NOT NULL DEFAULT 0,

  -- Usulan Musrenbang yang menjadi kegiatan ini. Tautan eksplisit, bukan
  -- penyalinan: warga yang mengusulkan berhak melihat usulannya menjadi apa.
  village_proposal_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_proposal (id) ON DELETE SET NULL,

  progress_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  status          VARCHAR(24) NOT NULL DEFAULT 'DIRENCANAKAN',

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_activity_level_valid CHECK (level IN ('BIDANG', 'KEGIATAN', 'SUB_KEGIATAN')),
  CONSTRAINT village_activity_status_valid
    CHECK (status IN ('DIRENCANAKAN', 'BERJALAN', 'SELESAI', 'DIBATALKAN')),
  CONSTRAINT village_activity_progress_range CHECK (progress_pct BETWEEN 0 AND 100),
  CONSTRAINT village_activity_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_activity_code_unique
  ON "{{TENANT_SCHEMA}}".village_activity (village_unit_id, code) WHERE deleted_at IS NULL;

-- Satu usulan menjadi paling banyak satu kegiatan. Dua kegiatan yang menunjuk
-- usulan yang sama berarti warga diberi tahu usulannya dikerjakan dua kali.
CREATE UNIQUE INDEX IF NOT EXISTS village_activity_proposal_unique
  ON "{{TENANT_SCHEMA}}".village_activity (village_proposal_id)
  WHERE village_proposal_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- APBDes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_budget (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_rkp_id  UUID REFERENCES "{{TENANT_SCHEMA}}".village_rkp (id) ON DELETE SET NULL,
  fiscal_year     INTEGER NOT NULL,
  -- INDUK atau PERUBAHAN. APBDes Perubahan adalah satu-satunya jalan mengubah
  -- pagu setelah induknya ditetapkan.
  budget_type     VARCHAR(16) NOT NULL DEFAULT 'INDUK',
  revision_number INTEGER NOT NULL DEFAULT 0,
  regulation_number VARCHAR(160),
  established_at  DATE,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAF',

  -- Ringkasan, dihitung dari barisnya. Disimpan supaya laporan tidak menjumlah
  -- ulang ribuan baris setiap kali dibuka.
  total_revenue   NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_expenditure NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_financing_in NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_financing_out NUMERIC(18,2) NOT NULL DEFAULT 0,

  approved_by_bpd_at TIMESTAMPTZ,
  approved_by     UUID,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_budget_type_valid CHECK (budget_type IN ('INDUK', 'PERUBAHAN')),
  CONSTRAINT village_budget_status_valid
    CHECK (status IN ('DRAF', 'DIBAHAS', 'DISETUJUI', 'DITETAPKAN', 'PERUBAHAN', 'DITUTUP')),
  -- APBDes yang ditetapkan wajib menyebut peraturan desanya. Anggaran tanpa
  -- dasar hukum bukan anggaran yang dapat dipertanggungjawabkan.
  CONSTRAINT village_budget_established_needs_regulation
    CHECK (status <> 'DITETAPKAN' OR regulation_number IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_budget_year_unique
  ON "{{TENANT_SCHEMA}}".village_budget (village_unit_id, fiscal_year, budget_type, revision_number);

-- Satu APBDes induk yang ditetapkan per tahun.
CREATE UNIQUE INDEX IF NOT EXISTS village_budget_established_unique
  ON "{{TENANT_SCHEMA}}".village_budget (village_unit_id, fiscal_year)
  WHERE status = 'DITETAPKAN' AND budget_type = 'INDUK';

-- ---------------------------------------------------------------------------
-- Baris anggaran — tempat pagu ditegakkan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_budget_line (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_budget_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_budget (id) ON DELETE CASCADE,
  village_activity_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_activity (id) ON DELETE RESTRICT,

  -- PENDAPATAN, BELANJA, PEMBIAYAAN_PENERIMAAN, PEMBIAYAAN_PENGELUARAN.
  budget_type       VARCHAR(32) NOT NULL,
  account_code      VARCHAR(48) NOT NULL,
  account_name      VARCHAR(300) NOT NULL,
  description       TEXT,

  ceiling_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Yang sudah diikat: SPP disetujui, kontrak ditandatangani. Pagu terpakai
  -- sejak ini, bukan sejak uang keluar.
  committed_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Yang sudah direalisasi: uang benar-benar keluar.
  realized_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_budget_line_type_valid CHECK (budget_type IN (
    'PENDAPATAN', 'BELANJA', 'PEMBIAYAAN_PENERIMAAN', 'PEMBIAYAAN_PENGELUARAN'
  )),
  CONSTRAINT village_budget_line_amounts_nonnegative CHECK (
    ceiling_amount >= 0 AND committed_amount >= 0 AND realized_amount >= 0
  ),

  -- INTI PENEGAKAN PAGU.
  --
  -- Perhitungan sisa pagu yang dilakukan layanan akan salah begitu dua SPP
  -- diproses bersamaan: keduanya membaca sisa yang sama, keduanya menyimpulkan
  -- cukup, dan keduanya lolos. Constraint pada baris yang dikunci tidak dapat
  -- dilewati dengan cara itu.
  CONSTRAINT village_budget_line_committed_within_ceiling
    CHECK (committed_amount <= ceiling_amount),

  -- Realisasi dibatasi IKATAN, bukan pagu. Uang yang keluar tanpa ikatan adalah
  -- pengeluaran tanpa dasar — temuan pemeriksaan, bukan kelalaian pencatatan.
  CONSTRAINT village_budget_line_realized_within_committed
    CHECK (realized_amount <= committed_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_budget_line_account_unique
  ON "{{TENANT_SCHEMA}}".village_budget_line (village_budget_id, account_code, COALESCE(village_activity_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS village_budget_line_activity_idx
  ON "{{TENANT_SCHEMA}}".village_budget_line (village_activity_id);

-- ---------------------------------------------------------------------------
-- Transaksi anggaran
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_budget_transaction (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  budget_line_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_budget_line (id) ON DELETE RESTRICT,

  -- IKATAN (SPP disetujui) atau REALISASI (uang keluar/masuk).
  transaction_type  VARCHAR(24) NOT NULL,
  transaction_number VARCHAR(64),
  transaction_date  DATE NOT NULL,
  amount            NUMERIC(18,2) NOT NULL,
  description       TEXT NOT NULL,

  counterparty      VARCHAR(300),
  document_reference VARCHAR(160),
  payment_method    VARCHAR(48),

  -- Ikatan yang direalisasi menunjuk ikatannya. Realisasi tanpa induk ikatan
  -- tidak dapat dijelaskan asal wewenangnya.
  parent_transaction_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_budget_transaction (id) ON DELETE RESTRICT,

  accounting_event_id UUID,
  posting_key       VARCHAR(120),
  idempotency_key   VARCHAR(120),

  is_reversed       BOOLEAN NOT NULL DEFAULT FALSE,
  reversed_at       TIMESTAMPTZ,
  reverse_reason    TEXT,

  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_budget_transaction_type_valid
    CHECK (transaction_type IN ('IKATAN', 'REALISASI')),
  CONSTRAINT village_budget_transaction_amount_positive CHECK (amount > 0),
  -- Pembatalan wajib beralasan. Transaksi anggaran yang dibatalkan tanpa
  -- keterangan adalah lubang pada pertanggungjawaban.
  CONSTRAINT village_budget_transaction_reverse_needs_reason
    CHECK (is_reversed = FALSE OR reverse_reason IS NOT NULL),
  CONSTRAINT village_budget_transaction_not_self_parent
    CHECK (parent_transaction_id IS NULL OR parent_transaction_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_budget_transaction_idem_unique
  ON "{{TENANT_SCHEMA}}".village_budget_transaction (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS village_budget_transaction_line_idx
  ON "{{TENANT_SCHEMA}}".village_budget_transaction (budget_line_id, transaction_date);

-- ---------------------------------------------------------------------------
-- Buku kas
-- ---------------------------------------------------------------------------
-- Proyeksi dari transaksi, bukan sumber kebenaran kedua. Saldo dihitung
-- berurutan supaya buku kas dapat dicetak sebagaimana adanya di kantor desa.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_cash_book (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  fiscal_year     INTEGER NOT NULL,
  book_type       VARCHAR(24) NOT NULL DEFAULT 'KAS_UMUM',
  entry_date      DATE NOT NULL,
  sequence_no     INTEGER NOT NULL,
  description     TEXT NOT NULL,
  debit_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  running_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  budget_transaction_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_budget_transaction (id) ON DELETE SET NULL,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT village_cash_book_type_valid
    CHECK (book_type IN ('KAS_UMUM', 'KAS_TUNAI', 'BANK', 'PAJAK')),
  -- Satu baris tidak dapat sekaligus debit dan kredit.
  CONSTRAINT village_cash_book_one_side
    CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS village_cash_book_seq_unique
  ON "{{TENANT_SCHEMA}}".village_cash_book (village_unit_id, fiscal_year, book_type, sequence_no);

-- ---------------------------------------------------------------------------
-- Panjar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_advance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  budget_line_id    UUID REFERENCES "{{TENANT_SCHEMA}}".village_budget_line (id) ON DELETE RESTRICT,
  recipient_officer_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE SET NULL,
  recipient_name    VARCHAR(200) NOT NULL,
  purpose           TEXT NOT NULL,
  issued_amount     NUMERIC(18,2) NOT NULL,
  used_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
  returned_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  issued_at         DATE NOT NULL,
  due_at            DATE,
  settled_at        DATE,
  status            VARCHAR(24) NOT NULL DEFAULT 'BERJALAN',
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_advance_status_valid
    CHECK (status IN ('BERJALAN', 'DIPERTANGGUNGJAWABKAN', 'TERLAMBAT')),
  CONSTRAINT village_advance_amount_positive CHECK (issued_amount > 0),
  -- Yang dipakai ditambah yang dikembalikan tidak boleh melebihi yang
  -- diberikan. Panjar yang dipertanggungjawabkan lebih besar dari yang diterima
  -- adalah kekeliruan yang harus tertangkap saat dicatat.
  CONSTRAINT village_advance_settlement_bounded
    CHECK (used_amount + returned_amount <= issued_amount)
);

CREATE INDEX IF NOT EXISTS village_advance_status_idx
  ON "{{TENANT_SCHEMA}}".village_advance (village_unit_id, status, due_at);

-- ---------------------------------------------------------------------------
-- Rencana kegiatan kelurahan
-- ---------------------------------------------------------------------------
-- Kelurahan menerima pagu dari daerah, tidak menyusun anggaran sendiri.
-- Bentuknya karena itu jauh lebih sederhana daripada APBDes.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_activity_plan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  fiscal_year     INTEGER NOT NULL,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  -- Pagu yang diterima dari kecamatan/daerah, bukan disusun sendiri.
  allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  realized_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  source_reference VARCHAR(160),
  status          VARCHAR(24) NOT NULL DEFAULT 'DIRENCANAKAN',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_activity_plan_status_valid
    CHECK (status IN ('DIRENCANAKAN', 'BERJALAN', 'SELESAI', 'DIBATALKAN')),
  CONSTRAINT village_activity_plan_realized_within_allocated
    CHECK (realized_amount <= allocated_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_activity_plan_code_unique
  ON "{{TENANT_SCHEMA}}".village_activity_plan (village_unit_id, fiscal_year, code);

-- ---------------------------------------------------------------------------
-- Pemicu audit
-- ---------------------------------------------------------------------------
-- Dipasang oleh migrasi 20260731000007 yang menelusuri seluruh tabel berawalan
-- `village_`. Migrasi ini dijalankan sesudahnya, sehingga tabel di atas belum
-- ikut terpasang. Pemasangan diulang di sini dengan pemanggilan yang sama.
DO $install$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi audit tidak ada; pemicu audit anggaran dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}' AND c.relkind = 'r'
       AND c.relname IN (
         'village_rpjm', 'village_rkp', 'village_activity', 'village_budget',
         'village_budget_line', 'village_budget_transaction', 'village_advance',
         'village_activity_plan'
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
