-- =========================================================================
-- ePesantren — EP-F: Tagihan pendidikan (SPP)
-- =========================================================================
--
-- BUKAN perluasan `platform.billing_invoice` (mesin faktur langganan
-- platform, lihat `apps/api/prisma/platform/billing.prisma`). Tabel itu
-- membebankan tagihan ke `Tenant` (pondok berlangganan eBisnis.id) —
-- pembayar SPP adalah WALI SANTRI, bukan pondoknya sendiri. §6 perintah
-- master melarang keras "mencampur pembayaran langganan platform dengan
-- pembayaran SPP" — menaruh tagihan SPP di `billing_invoice` melanggarnya
-- secara langsung, bukan sekadar longgar.
--
-- Ini bukan mesin faktur KEDUA: ini data piutang INTERNAL milik satu
-- penyewa, sekelas dengan buku besar `cooperative_saving`/`member_balance`
-- yang sudah ada — bukan layanan bersama yang dipakai lintas penyewa.
--
-- Status memakai kosakata yang sama dengan `platform.InvoiceStatus`
-- (DRAFT/ISSUED/PARTIALLY_PAID/PAID/OVERDUE/VOID) semata demi konsistensi
-- istilah bagi siapa pun yang sudah mengenal mesin faktur platform — bukan
-- tanda bahwa keduanya satu tabel.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_tagihan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE RESTRICT,
  periode         VARCHAR(7) NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  jatuh_tempo     DATE NOT NULL,
  total_tagihan   NUMERIC(14,2) NOT NULL DEFAULT 0,
  catatan         TEXT,
  diterbitkan_pada TIMESTAMPTZ,
  diterbitkan_oleh UUID,

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

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tagihan
  ADD CONSTRAINT ck_pesantren_tagihan_periode
  CHECK (periode ~ '^\d{4}-\d{2}$');

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tagihan
  ADD CONSTRAINT ck_pesantren_tagihan_status
  CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tagihan
  ADD CONSTRAINT ck_pesantren_tagihan_total_non_negatif
  CHECK (total_tagihan >= 0);

-- Satu santri hanya boleh punya SATU tagihan per periode (bulan). Tanpa ini,
-- kesalahan klik "buat tagihan" dua kali berarti wali menerima dua tagihan
-- SPP untuk bulan yang sama, dan yang mana yang benar tidak dapat dijawab
-- basis data sendiri.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_tagihan_satu_per_periode
  ON "{{TENANT_SCHEMA}}".pesantren_tagihan (santri_id, periode)
  WHERE deleted_at IS NULL AND status <> 'VOID';

CREATE INDEX IF NOT EXISTS ix_pesantren_tagihan_santri
  ON "{{TENANT_SCHEMA}}".pesantren_tagihan (santri_id, deleted_at);
CREATE INDEX IF NOT EXISTS ix_pesantren_tagihan_status
  ON "{{TENANT_SCHEMA}}".pesantren_tagihan (status, jatuh_tempo);

-- ---------------------------------------------------------------------------
-- pesantren_tagihan_item — rincian baris tagihan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_tagihan_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tagihan_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tagihan (id) ON DELETE CASCADE,
  kode            VARCHAR(32) NOT NULL,
  deskripsi       VARCHAR(255) NOT NULL,
  jumlah          NUMERIC(14,2) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tagihan_item
  ADD CONSTRAINT ck_pesantren_tagihan_item_jumlah_positif
  CHECK (jumlah > 0);

CREATE INDEX IF NOT EXISTS ix_pesantren_tagihan_item_tagihan
  ON "{{TENANT_SCHEMA}}".pesantren_tagihan_item (tagihan_id, sort_order);
