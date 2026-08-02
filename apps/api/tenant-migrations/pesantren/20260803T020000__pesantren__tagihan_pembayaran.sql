-- =========================================================================
-- ePesantren — Pencatatan pembayaran tagihan (EP-F lanjutan)
-- =========================================================================
--
-- `pesantren_tagihan` sudah membawa status PARTIALLY_PAID/PAID sejak awal,
-- tetapi TIDAK ADA yang menuliskannya -- tidak ada baris pembayaran, tidak
-- ada jalan dari "tagihan diterbitkan" ke "tagihan lunas". Tabel ini adalah
-- baris yang hilang itu: satu baris per setoran (tunai, transfer, atau lewat
-- eSmartlink), dan status tagihan dihitung ULANG dari jumlah baris ini --
-- bukan ditulis manual terpisah -- supaya status tidak pernah menyimpang
-- dari jumlah yang benar-benar tercatat.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_tagihan_pembayaran (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tagihan_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tagihan (id) ON DELETE RESTRICT,
  jumlah_bayar    NUMERIC(14,2) NOT NULL,
  metode          VARCHAR(16) NOT NULL,
  tanggal_bayar   DATE NOT NULL DEFAULT CURRENT_DATE,
  catatan         TEXT,
  dicatat_oleh    UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tagihan_pembayaran
  ADD CONSTRAINT ck_pesantren_tagihan_pembayaran_jumlah_positif
  CHECK (jumlah_bayar > 0);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tagihan_pembayaran
  ADD CONSTRAINT ck_pesantren_tagihan_pembayaran_metode
  CHECK (metode IN ('TUNAI', 'TRANSFER', 'ESMARTLINK'));

CREATE INDEX IF NOT EXISTS ix_pesantren_tagihan_pembayaran_tagihan
  ON "{{TENANT_SCHEMA}}".pesantren_tagihan_pembayaran (tagihan_id, tanggal_bayar);
