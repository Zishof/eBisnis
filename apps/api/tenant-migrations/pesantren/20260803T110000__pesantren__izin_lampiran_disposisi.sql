-- =========================================================================
-- ePesantren: Perizinan lengkap dengan lampiran, disposisi, dan riwayat
-- =========================================================================
--
-- Menutup gap lanjutan dari AIS PengajuanSiswaAction.java: izin tidak hanya
-- status akhir, tetapi juga membawa lampiran bukti, parameter tambahan, dan
-- jejak disposisi/persetujuan yang dapat diaudit.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_izin
  ADD COLUMN IF NOT EXISTS lampiran_url TEXT,
  ADD COLUMN IF NOT EXISTS kontak_penjemput VARCHAR(120),
  ADD COLUMN IF NOT EXISTS no_hp_penjemput VARCHAR(40),
  ADD COLUMN IF NOT EXISTS disposisi_ke UUID,
  ADD COLUMN IF NOT EXISTS catatan_disposisi TEXT,
  ADD COLUMN IF NOT EXISTS didisposisi_pada TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_izin_riwayat (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  izin_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_izin (id) ON DELETE CASCADE,
  aksi            VARCHAR(24) NOT NULL,
  status_sebelum  VARCHAR(16),
  status_sesudah  VARCHAR(16),
  catatan         TEXT,
  actor_user_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_izin_riwayat
  ADD CONSTRAINT ck_pesantren_izin_riwayat_aksi
  CHECK (aksi IN ('AJUKAN', 'DISPOSISI', 'SETUJUI', 'TOLAK', 'BATALKAN', 'SELESAIKAN'));

CREATE INDEX IF NOT EXISTS ix_pesantren_izin_riwayat_izin
  ON "{{TENANT_SCHEMA}}".pesantren_izin_riwayat (izin_id, created_at);
