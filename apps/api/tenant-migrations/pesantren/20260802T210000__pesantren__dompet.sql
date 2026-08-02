-- =========================================================================
-- ePesantren — EP-L: Dompet santri dan batas belanja
-- =========================================================================
--
-- §6 perintah master melarang keras "mencampur pembayaran langganan
-- platform dengan pembayaran SPP atau uang saku santri". Dompet ini karena
-- itu TERPISAH baik dari `platform.billing_invoice` (langganan platform)
-- MAUPUN dari `pesantren_tagihan` (SPP, EP-F) — ledger ketiga yang berdiri
-- sendiri, bukan perluasan salah satu dari keduanya.
--
-- Saldo TIDAK disimpan sebagai satu angka yang di-update di tempat.
-- `pesantren_dompet.saldo` adalah salinan (cache) yang selalu ditulis ULANG
-- di dalam transaksi yang sama dengan baris `pesantren_dompet_transaksi`
-- barunya -- kebenarannya berasal dari SUM seluruh transaksi, sama seperti
-- capaian tahfiz EP-I dihitung dari log, bukan dipercaya begitu saja.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_dompet (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  saldo           NUMERIC(14,2) NOT NULL DEFAULT 0,
  batas_harian    NUMERIC(14,2),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

-- Satu dompet per santri.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_dompet_santri
  ON "{{TENANT_SCHEMA}}".pesantren_dompet (santri_id) WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dompet
  ADD CONSTRAINT ck_pesantren_dompet_saldo_non_negatif
  CHECK (saldo >= 0);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dompet
  ADD CONSTRAINT ck_pesantren_dompet_batas_harian_positif
  CHECK (batas_harian IS NULL OR batas_harian > 0);

-- ---------------------------------------------------------------------------
-- pesantren_dompet_transaksi — satu-satunya sumber kebenaran saldo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_dompet_transaksi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dompet_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_dompet (id) ON DELETE CASCADE,
  jenis           VARCHAR(16) NOT NULL,
  jumlah          NUMERIC(14,2) NOT NULL,
  saldo_sesudah   NUMERIC(14,2) NOT NULL,
  keterangan      TEXT,
  dicatat_oleh    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dompet_transaksi
  ADD CONSTRAINT ck_pesantren_dompet_transaksi_jenis
  CHECK (jenis IN ('TOPUP', 'BELANJA', 'PENYESUAIAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dompet_transaksi
  ADD CONSTRAINT ck_pesantren_dompet_transaksi_jumlah_tidak_nol
  CHECK (jumlah <> 0);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_dompet_transaksi
  ADD CONSTRAINT ck_pesantren_dompet_transaksi_saldo_sesudah_non_negatif
  CHECK (saldo_sesudah >= 0);

CREATE INDEX IF NOT EXISTS ix_pesantren_dompet_transaksi_dompet
  ON "{{TENANT_SCHEMA}}".pesantren_dompet_transaksi (dompet_id, created_at DESC);
