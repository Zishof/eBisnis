-- =========================================================================
-- V015 — PERISTIWA AKUNTANSI DAN ATURAN POSTING
--
-- Blueprint melarang menulis debit/kredit di controller. Larangan itu tidak
-- dapat ditegakkan hanya dengan disiplin: satu endpoint baru yang lupa akan
-- membuat jurnal dengan akun yang berbeda dari endpoint lain untuk peristiwa
-- yang sama.
--
-- Karena itu pemetaan peristiwa-ke-akun tinggal di **data**, bukan di kode.
-- Kode hanya menyatakan "peristiwa ini terjadi dengan nilai sekian"; akun mana
-- yang didebit dan dikredit ditentukan baris aturan yang dapat diubah tanpa
-- rilis.
--
-- Yang TIDAK dibuat di sini: buku besar kedua. `journal_entry` dan
-- `journal_entry_line` yang sudah ada sejak V006 dipakai apa adanya, dan
-- kolom `source_type`, `source_id`, serta `posting_key` di sana memang sudah
-- dirancang untuk penelusuran sumber-ke-jurnal.
--
-- Additive. Tidak ada tabel maupun kolom lama yang diubah.
-- =========================================================================

-- Peristiwa akuntansi ------------------------------------------------------
--
-- Satu baris berarti "hal ini terjadi dan berdampak pada pembukuan". Baris ini
-- dibuat oleh modul bisnis; penjurnalannya menyusul, mungkin oleh penjadwal.
--
-- Memisahkan peristiwa dari jurnal membuat kegagalan menjurnal tidak
-- membatalkan transaksi bisnisnya — pesanan yang lunas tetap lunas meski
-- pembukuannya belum terbentuk.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".accounting_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Kode peristiwa, mis. MARKETPLACE_SALE_RECOGNIZED.
  event_code      VARCHAR(64) NOT NULL,

  -- Dokumen sumber. Bersama `event_code` inilah yang membuat jurnal dapat
  -- ditelusuri balik ke asalnya, dan sebaliknya.
  source_type     VARCHAR(48) NOT NULL,
  source_id       UUID NOT NULL,
  source_number   VARCHAR(64),

  legal_entity_id UUID REFERENCES "{{TENANT_SCHEMA}}".legal_entity (id) ON DELETE RESTRICT,

  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Nilai-nilai yang dipakai aturan posting. Disimpan sebagai JSON karena
  -- setiap jenis peristiwa membawa nilai yang berbeda; memaksakan kolom tetap
  -- akan menghasilkan tabel dengan puluhan kolom yang mayoritas kosong.
  amounts         JSONB NOT NULL,
  currency_code   VARCHAR(8) NOT NULL DEFAULT 'IDR',

  -- PENDING, POSTED, FAILED, atau SKIPPED.
  status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',

  -- Jurnal yang dihasilkan. Kosong sampai berhasil dijurnal.
  journal_entry_id UUID REFERENCES "{{TENANT_SCHEMA}}".journal_entry (id) ON DELETE SET NULL,

  posted_at       TIMESTAMPTZ,
  failure_reason  TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,

  -- Kunci yang membuat peristiwa yang sama tidak tercatat dua kali. Peristiwa
  -- pembayaran dapat sampai berulang.
  idempotency_key VARCHAR(160) NOT NULL,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_accounting_event_status CHECK (
    status IN ('PENDING','POSTED','FAILED','SKIPPED')
  ),
  -- Peristiwa yang berstatus POSTED wajib menunjuk jurnalnya. Tanpa syarat
  -- ini, "sudah dijurnal" dapat berdiri tanpa jurnal yang dapat diperiksa.
  CONSTRAINT ck_accounting_event_posted CHECK (
    status <> 'POSTED' OR journal_entry_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_accounting_event_idempotency
  ON "{{TENANT_SCHEMA}}".accounting_event (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_accounting_event_status
  ON "{{TENANT_SCHEMA}}".accounting_event (status, occurred_at);

CREATE INDEX IF NOT EXISTS idx_accounting_event_source
  ON "{{TENANT_SCHEMA}}".accounting_event (source_type, source_id);

-- Aturan posting -----------------------------------------------------------
--
-- Satu peristiwa menghasilkan beberapa baris aturan: satu untuk setiap sisi
-- jurnal. Bentuk ini yang membuat pemetaan dapat diubah tanpa rilis kode.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".accounting_posting_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,

  event_code      VARCHAR(64) NOT NULL,

  -- Urutan baris pada jurnal yang dihasilkan.
  sort_order      INTEGER NOT NULL DEFAULT 0,

  account_id      UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".chart_of_account (id) ON DELETE RESTRICT,

  -- DEBIT atau CREDIT.
  side            VARCHAR(8) NOT NULL,

  -- Nama medan pada `amounts` yang menjadi nilai baris ini. Bukan rumus:
  -- rumus bebas pada data adalah pintu masuk eksekusi kode yang tidak
  -- diinginkan, dan larangan `eval` berlaku di sini.
  amount_key      VARCHAR(48) NOT NULL,

  -- Baris hanya dibuat bila nilainya di atas nol. Tanpa ini, peristiwa tanpa
  -- ongkos kirim akan menghasilkan baris jurnal bernilai nol yang tidak
  -- berarti apa-apa.
  skip_when_zero  BOOLEAN NOT NULL DEFAULT TRUE,

  description_template VARCHAR(255),

  -- Aturan berlaku pada rentang waktu tertentu agar perubahan kebijakan
  -- akuntansi tidak mengubah jurnal yang sudah terbentuk.
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_posting_rule_side CHECK (side IN ('DEBIT','CREDIT')),
  CONSTRAINT ck_posting_rule_period CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_posting_rule_code
  ON "{{TENANT_SCHEMA}}".accounting_posting_rule (code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posting_rule_event
  ON "{{TENANT_SCHEMA}}".accounting_posting_rule (event_code, is_active, sort_order)
  WHERE deleted_at IS NULL;

-- Audit ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounting_event', 'accounting_posting_rule'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
