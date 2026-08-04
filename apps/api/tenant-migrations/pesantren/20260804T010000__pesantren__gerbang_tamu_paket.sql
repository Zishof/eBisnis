-- =========================================================================
-- ePesantren - Gerbang tamu, paket, dan penjemput
-- =========================================================================
--
-- Tabel ini sengaja TERPISAH dari pesantren_izin dan pesantren_gerbang_log.
-- Izin/log gerbang santri hanya untuk lintasan santri yang sudah mendapat
-- persetujuan. Kunjungan tamu, paket kiriman, dan penjemput perlu dicatat di
-- pos keamanan, tetapi tidak boleh mengubah status izin santri.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_gerbang_kunjungan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori        VARCHAR(16) NOT NULL,
  nama_tamu       VARCHAR(160) NOT NULL,
  no_hp           VARCHAR(40),
  instansi        VARCHAR(160),
  tujuan          VARCHAR(240) NOT NULL,
  santri_id       UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE SET NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'MASUK',
  waktu_masuk     TIMESTAMPTZ NOT NULL DEFAULT now(),
  waktu_keluar    TIMESTAMPTZ,
  catatan         TEXT,
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_gerbang_kunjungan
  ADD CONSTRAINT ck_pesantren_gerbang_kunjungan_kategori
  CHECK (kategori IN ('TAMU', 'PAKET', 'PENJEMPUT'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_gerbang_kunjungan
  ADD CONSTRAINT ck_pesantren_gerbang_kunjungan_status
  CHECK (status IN ('MASUK', 'SELESAI', 'DIBATALKAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_gerbang_kunjungan
  ADD CONSTRAINT ck_pesantren_gerbang_kunjungan_waktu_keluar
  CHECK (
    (status = 'MASUK' AND waktu_keluar IS NULL) OR
    (status <> 'MASUK' AND waktu_keluar IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS ix_pesantren_gerbang_kunjungan_status
  ON "{{TENANT_SCHEMA}}".pesantren_gerbang_kunjungan (status, waktu_masuk DESC);

CREATE INDEX IF NOT EXISTS ix_pesantren_gerbang_kunjungan_santri
  ON "{{TENANT_SCHEMA}}".pesantren_gerbang_kunjungan (santri_id, waktu_masuk DESC)
  WHERE santri_id IS NOT NULL;
