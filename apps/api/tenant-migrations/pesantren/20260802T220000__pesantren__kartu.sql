-- =========================================================================
-- ePesantren — EP-M: Anjungan dan kartu RFID
-- =========================================================================
--
-- Anjungan (kiosk) dipakai santri tanpa masuk dengan akun pribadinya --
-- perangkat kiosk sendiri yang memegang kredensial (peran
-- `SERVICE_ACCOUNT_KIOSK_PONDOK`, profil P12), memindai nomor kartu, lalu
-- menampilkan cuplikan data diri sendiri milik pemegang kartu. Tabel ini
-- hanya registry kartu; pemetaan kartu -> santri, BUKAN identitas login
-- kiosk itu sendiri (itu akun platform biasa dengan peran device).

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_kartu (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  nomor_kartu     VARCHAR(64) NOT NULL,
  jenis           VARCHAR(8) NOT NULL DEFAULT 'RFID',
  status          VARCHAR(16) NOT NULL DEFAULT 'AKTIF',
  diterbitkan_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  dinonaktifkan_pada TIMESTAMPTZ,
  catatan         TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_kartu
  ADD CONSTRAINT ck_pesantren_kartu_jenis
  CHECK (jenis IN ('RFID', 'QR'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_kartu
  ADD CONSTRAINT ck_pesantren_kartu_status
  CHECK (status IN ('AKTIF', 'NONAKTIF', 'HILANG'));

-- Nomor kartu fisik unik secara global -- dua kartu tidak boleh memindai ke
-- santri yang berbeda. Hanya ditegakkan atas kartu yang masih AKTIF, supaya
-- nomor kartu yang dilaporkan hilang dapat dipakai ulang pada kartu
-- pengganti tanpa mengubah data historis kartu lama.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_kartu_nomor_aktif
  ON "{{TENANT_SCHEMA}}".pesantren_kartu (nomor_kartu)
  WHERE status = 'AKTIF' AND deleted_at IS NULL;

-- Satu santri hanya boleh punya SATU kartu aktif pada satu waktu.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_kartu_satu_aktif_per_santri
  ON "{{TENANT_SCHEMA}}".pesantren_kartu (santri_id)
  WHERE status = 'AKTIF' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_kartu_santri
  ON "{{TENANT_SCHEMA}}".pesantren_kartu (santri_id, deleted_at);
