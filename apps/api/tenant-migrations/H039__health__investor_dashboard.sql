-- =========================================================================
-- H039 — DASBOR INVESTOR AGREGAT, WATERFALL, DAN DISTRIBUSI
-- =========================================================================
--
-- Fase H-9K. Aditif seluruhnya.
--
-- Cara penegakannya menentukan seluruh bentuk migrasi ini, dan ia disebut
-- tegas pada dokumen 16: **bukan dengan menyaring di layar.**
--
-- Investor memperoleh **proyeksi agregat yang sudah dihitung** — bukan akses ke
-- tabel sumbernya dengan penyaring. Perbedaannya menentukan: penyaring dapat
-- dilewati siapa pun yang memanggil jalur di bawahnya, sedangkan proyeksi yang
-- **tidak memuat data pasien** tidak dapat mengungkapkannya sekalipun jalurnya
-- ditembus.
--
-- Karena itu perhatikan apa yang TIDAK ada pada `investor_projection_cell`:
-- tidak ada `patient_id`, tidak ada `encounter_id`, tidak ada satu pun kunci
-- asing ke tabel pasien. Bukan karena kuerinya tidak akan mengambilnya,
-- melainkan karena tabelnya **tidak punya tempat untuk menyimpannya**.
--
-- Empat hal ditegakkan basis data.
--
-- 1. **Ambang kohort tidak boleh nol.** Ambang nol berarti tidak ada
--    penyamaran sama sekali, dan konfigurasi yang mengizinkan nol akan disetel
--    nol oleh orang pertama yang terganggu oleh sel yang tersembunyi.
--
-- 2. **Sel yang tersamar tidak menyimpan nilainya.** Bukan menyimpan lalu
--    menyembunyikan saat ditampilkan — tidak menyimpan sama sekali. Nilai yang
--    tersimpan akan terbaca oleh kueri berikutnya yang lupa menyaring.
--
-- 3. **Distribusi menuntut tiga orang berbeda**: yang menghitung, yang
--    menyetujui, dan yang membayarkan.
--
-- 4. **Distribusi menuntut kontrak yang ditunjuk.** Pemindahan uang tanpa
--    kontrak adalah pemindahan yang tidak dapat dijelaskan kepada siapa pun
--    yang bertanya kemudian.

-- ---------------------------------------------------------------------------
-- Pengaturan penyamaran per fasilitas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".investor_disclosure_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  /*
   * AMBANG KOHORT. Bawaan lima, dan constraint menolak nol.
   *
   * "Satu pasien HIV pada bulan Maret di Poliklinik Kulit" adalah kalimat
   * agregat yang menyebut seseorang.
   */
  minimum_cohort  INTEGER NOT NULL DEFAULT 5,

  -- Penyamaran pelengkap: bila hanya satu sel yang tersamar sedangkan totalnya
  -- diketahui, sel itu dapat dihitung kembali dengan pengurangan.
  complement_suppression BOOLEAN NOT NULL DEFAULT TRUE,

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT investor_policy_cohort_not_zero CHECK (minimum_cohort >= 1),
  CONSTRAINT investor_policy_cohort_sane CHECK (minimum_cohort <= 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_investor_policy_facility
  ON "{{TENANT_SCHEMA}}".investor_disclosure_policy (facility_id);

-- ---------------------------------------------------------------------------
-- Proyeksi agregat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".investor_projection (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  metric_code     VARCHAR(48) NOT NULL,

  -- Angka gabungan seluruh fasilitas pada periode ini.
  total_value     NUMERIC(20,2),
  total_cohort    INTEGER,
  total_suppressed BOOLEAN NOT NULL DEFAULT FALSE,

  minimum_cohort_applied INTEGER NOT NULL,
  suppressed_cell_count INTEGER NOT NULL DEFAULT 0,
  visible_cell_count INTEGER NOT NULL DEFAULT 0,

  /*
   * PENANDA SINTETIS.
   *
   * Akun investor contoh hanya melihat proyeksi sintetis. Agregat dari data
   * NYATA tetap dapat menyingkap sesuatu ketika penyebutnya kecil — dan demo
   * dijalankan justru pada fasilitas yang penyebutnya selalu kecil.
   */
  is_synthetic    BOOLEAN NOT NULL DEFAULT FALSE,

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  computed_by     UUID,
  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT investor_projection_period_order CHECK (period_end >= period_start),
  CONSTRAINT investor_projection_cohort_positive CHECK (minimum_cohort_applied >= 1),
  /*
   * TOTAL YANG TERSAMAR TIDAK MENYIMPAN NILAINYA.
   *
   * Bukan menyimpan lalu menyembunyikan saat ditampilkan. Nilai yang tersimpan
   * akan terbaca oleh kueri berikutnya yang lupa menyaring — dan kueri
   * berikutnya selalu ditulis orang yang tidak membaca migrasi ini.
   */
  CONSTRAINT investor_projection_suppressed_empty CHECK (
    total_suppressed = FALSE OR (total_value IS NULL AND total_cohort IS NULL)
  ),
  CONSTRAINT investor_projection_counts_nonneg CHECK (
    suppressed_cell_count >= 0 AND visible_cell_count >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_investor_projection_period
  ON "{{TENANT_SCHEMA}}".investor_projection (facility_id, period_start, period_end, metric_code);

/*
 * TABEL SEL — PERHATIKAN APA YANG TIDAK ADA DI SINI.
 *
 * Tidak ada patient_id. Tidak ada encounter_id. Tidak ada satu pun kunci asing
 * ke tabel pasien, dan tidak ada kolom bebas yang dapat menampungnya.
 *
 * Bukan karena kuerinya tidak akan mengambilnya, melainkan karena tabelnya
 * tidak punya tempat untuk menyimpannya. Penyaring dapat dilewati siapa pun
 * yang memanggil jalur di bawahnya; tabel yang tidak berkolom tidak dapat.
 */
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".investor_projection_cell (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".investor_projection (id) ON DELETE CASCADE,

  -- Kunci pemecahan: nama unit, bulan, atau bauran pembayar. Teks, bukan kunci
  -- asing — proyeksi tidak menunjuk baris apa pun pada basis data klinis.
  breakdown_key   VARCHAR(180) NOT NULL,

  cell_value      NUMERIC(20,2),
  cell_cohort     INTEGER,
  suppressed      BOOLEAN NOT NULL DEFAULT FALSE,
  suppression_reason VARCHAR(32),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT investor_cell_reason_valid CHECK (
    suppression_reason IS NULL
    OR suppression_reason IN ('BELOW_THRESHOLD', 'COMPLEMENT_DISCLOSURE')
  ),
  -- Yang tersamar wajib menyebut sebabnya, dan sebabnya ditampilkan kepada
  -- investor. Dasbor yang menyembunyikan tanpa mengatakan bahwa ia
  -- menyembunyikan akan dipercaya sebagai gambaran lengkap.
  CONSTRAINT investor_cell_suppressed_reason CHECK (
    suppressed = FALSE OR suppression_reason IS NOT NULL
  ),
  /*
   * SEL YANG TERSAMAR TIDAK MENYIMPAN NILAI MAUPUN KOHORTNYA.
   *
   * Menyembunyikan nilainya tetapi menyimpan "n = 2" tidak menyembunyikan apa
   * pun yang penting: yang berbahaya justru penyebutnya.
   */
  CONSTRAINT investor_cell_suppressed_empty CHECK (
    suppressed = FALSE OR (cell_value IS NULL AND cell_cohort IS NULL)
  ),
  -- Sebaliknya: yang TIDAK tersamar wajib punya kohort. Sel tanpa penyebut
  -- tidak dapat diperiksa apakah ia seharusnya tersamar.
  CONSTRAINT investor_cell_visible_has_cohort CHECK (
    suppressed = TRUE OR cell_cohort IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_investor_cell_projection
  ON "{{TENANT_SCHEMA}}".investor_projection_cell (projection_id);

-- ---------------------------------------------------------------------------
-- Kebijakan waterfall
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".investor_waterfall_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  fee_contract_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".fee_contract (id) ON DELETE RESTRICT,

  name            VARCHAR(180) NOT NULL,
  effective_from  DATE,
  effective_to    DATE,
  status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',

  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT investor_waterfall_status_valid CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT investor_waterfall_period_sane CHECK (
    effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS ix_investor_waterfall_facility
  ON "{{TENANT_SCHEMA}}".investor_waterfall_policy (facility_id, status);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".investor_waterfall_tier (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".investor_waterfall_policy (id) ON DELETE CASCADE,

  tier_order      INTEGER NOT NULL,
  tier_type       VARCHAR(24) NOT NULL,
  fixed_amount    NUMERIC(20,2),
  percent_of_remaining NUMERIC(6,3),
  note            TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT investor_tier_type_valid CHECK (
    tier_type IN ('OPERATING_COST', 'DEBT_SERVICE', 'RESERVE',
                  'PREFERRED_RETURN', 'CAPITAL_RETURN', 'PROFIT_SHARE')
  ),
  CONSTRAINT investor_tier_order_positive CHECK (tier_order >= 1),
  -- Satu lapisan berupa jumlah ATAU persentase, tidak keduanya dan tidak
  -- satu pun. Lapisan yang keduanya kosong tidak pernah menerima apa pun dan
  -- tidak ada yang menyadarinya.
  CONSTRAINT investor_tier_one_basis CHECK (
    (fixed_amount IS NOT NULL AND percent_of_remaining IS NULL)
    OR (fixed_amount IS NULL AND percent_of_remaining IS NOT NULL)
  ),
  CONSTRAINT investor_tier_amount_nonneg CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
  CONSTRAINT investor_tier_percent_sane CHECK (
    percent_of_remaining IS NULL OR (percent_of_remaining >= 0 AND percent_of_remaining <= 100)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_investor_tier_order
  ON "{{TENANT_SCHEMA}}".investor_waterfall_tier (policy_id, tier_order);

-- ---------------------------------------------------------------------------
-- Distribusi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".investor_distribution (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  /*
   * KONTRAK WAJIB DITUNJUK.
   *
   * Bukan boleh kosong. Distribusi tanpa kontrak adalah pemindahan uang yang
   * tidak dapat dijelaskan kepada siapa pun yang bertanya kemudian.
   */
  fee_contract_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".fee_contract (id) ON DELETE RESTRICT,
  policy_id       UUID REFERENCES "{{TENANT_SCHEMA}}".investor_waterfall_policy (id) ON DELETE RESTRICT,

  distribution_number VARCHAR(64) NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  distributable_amount NUMERIC(20,2) NOT NULL,
  investor_amount NUMERIC(20,2) NOT NULL,
  investor_percent NUMERIC(6,3),
  was_capped      BOOLEAN NOT NULL DEFAULT FALSE,
  shortfall_amount NUMERIC(20,2) NOT NULL DEFAULT 0,

  status          VARCHAR(24) NOT NULL DEFAULT 'CALCULATED',

  -- Tiga orang.
  calculated_by   UUID,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  approval_note   TEXT,
  paid_by         UUID,
  paid_at         TIMESTAMPTZ,
  payment_reference VARCHAR(120),

  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,

  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT investor_dist_status_valid CHECK (
    status IN ('CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED')
  ),
  CONSTRAINT investor_dist_period_order CHECK (period_end >= period_start),
  CONSTRAINT investor_dist_amounts_nonneg CHECK (
    distributable_amount >= 0 AND investor_amount >= 0 AND shortfall_amount >= 0
  ),
  -- Bagian investor tidak melampaui dana yang dibagikan. Ia terdengar sepele
  -- sampai satu perhitungan menghasilkannya, dan sesudah itu uangnya sudah
  -- berpindah.
  CONSTRAINT investor_dist_within_pool CHECK (investor_amount <= distributable_amount),
  CONSTRAINT investor_dist_percent_sane CHECK (
    investor_percent IS NULL OR (investor_percent >= 0 AND investor_percent <= 100)
  ),
  CONSTRAINT investor_dist_approved_named CHECK (
    status NOT IN ('APPROVED', 'PAID') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT investor_dist_paid_named CHECK (
    status <> 'PAID' OR (paid_by IS NOT NULL AND paid_at IS NOT NULL)
  ),
  /*
   * TIGA ORANG BERBEDA.
   *
   * Uang yang berpindah berdasarkan angka yang keliru sulit ditarik kembali,
   * dan investor yang sudah menerimanya punya alasan untuk tidak
   * mengembalikannya.
   */
  CONSTRAINT investor_dist_approve_not_self CHECK (
    approved_by IS NULL OR calculated_by IS NULL OR approved_by <> calculated_by
  ),
  CONSTRAINT investor_dist_pay_not_approver CHECK (
    paid_by IS NULL OR approved_by IS NULL OR paid_by <> approved_by
  ),
  CONSTRAINT investor_dist_cancel_reason CHECK (
    cancelled_at IS NULL OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) >= 10)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_investor_dist_number
  ON "{{TENANT_SCHEMA}}".investor_distribution (distribution_number);
CREATE INDEX IF NOT EXISTS ix_investor_dist_facility
  ON "{{TENANT_SCHEMA}}".investor_distribution (facility_id, period_start DESC);

-- Distribusi yang sudah dibayar tidak dapat dihapus maupun diubah nilainya.
CREATE OR REPLACE FUNCTION "{{TENANT_SCHEMA}}".forbid_paid_distribution_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PAID' THEN
      RAISE EXCEPTION 'DISTRIBUTION_IMMUTABLE: distribusi yang sudah dibayar tidak dapat dihapus'
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'PAID' AND (
       NEW.investor_amount IS DISTINCT FROM OLD.investor_amount
       OR NEW.distributable_amount IS DISTINCT FROM OLD.distributable_amount
     ) THEN
    RAISE EXCEPTION
      'DISTRIBUTION_IMMUTABLE: nilai distribusi yang sudah dibayar tidak dapat diubah. '
      'Yang sudah berpindah adalah angka itu; mengubahnya kemudian membuat catatan di sini '
      'berbeda dari mutasi rekening, dan yang berbeda tidak akan pernah bertemu lagi.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_investor_dist_immutable ON "{{TENANT_SCHEMA}}".investor_distribution;
CREATE TRIGGER trg_investor_dist_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".investor_distribution
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_paid_distribution_change();

-- ---------------------------------------------------------------------------
-- TIDAK ADA PEMBAYARAN OTOMATIS
-- ---------------------------------------------------------------------------
/*
 * Perhatikan yang TIDAK ada pada berkas ini:
 *
 * - tidak ada trigger yang mengubah status distribusi menjadi APPROVED;
 * - tidak ada trigger yang mengubahnya menjadi PAID;
 * - tidak ada penjadwal, tidak ada ambang, tidak ada "bila nilainya di bawah
 *   sekian maka setujui sendiri".
 *
 * Setiap distribusi menuntut persetujuan manusia, dan yang menghitung tidak
 * menyetujui. Alasannya sama seperti pada pembagian jasa: uang yang berpindah
 * berdasarkan angka yang keliru sulit ditarik kembali.
 */

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['investor_disclosure_policy', 'investor_projection',
                           'investor_projection_cell', 'investor_waterfall_policy',
                           'investor_waterfall_tier', 'investor_distribution'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
