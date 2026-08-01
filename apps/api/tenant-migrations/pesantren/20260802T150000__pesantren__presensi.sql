-- =========================================================================
-- ePesantren — EP-E: Presensi harian santri
-- =========================================================================
--
-- Presensi ibadah/kegiatan pesantren-wide — bukan presensi kelas formal, yang
-- menuntut rombongan belajar (rombel) yang belum ada (dicatat MISSING pada
-- docs/santri-info/05). Modul ini adalah `EPESANTREN_IBADAH_ATTENDANCE`
-- pada §8.3 perintah master, dipilih lebih dulu dari presensi sekolah formal
-- sebab tidak bergantung pada struktur kelas yang belum dibangun.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_presensi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  tanggal         DATE NOT NULL,
  jenis           VARCHAR(16) NOT NULL,
  status          VARCHAR(8) NOT NULL,
  keterangan      TEXT,
  dicatat_oleh    UUID,

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

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_presensi
  ADD CONSTRAINT ck_pesantren_presensi_jenis
  CHECK (jenis IN ('SEKOLAH', 'DINIYAH', 'IBADAH', 'KEGIATAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_presensi
  ADD CONSTRAINT ck_pesantren_presensi_status
  CHECK (status IN ('HADIR', 'IZIN', 'SAKIT', 'ALPA'));

-- Satu santri hanya boleh punya satu baris presensi per tanggal per jenis
-- kegiatan. Tanpa ini, mencatat ulang presensi yang salah ketik berarti
-- menduakan baris, dan rekap harian menghitung dua kehadiran untuk satu
-- santri pada satu hari yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_presensi_satu_per_hari
  ON "{{TENANT_SCHEMA}}".pesantren_presensi (santri_id, tanggal, jenis)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_presensi_tanggal
  ON "{{TENANT_SCHEMA}}".pesantren_presensi (tanggal, jenis, deleted_at);
CREATE INDEX IF NOT EXISTS ix_pesantren_presensi_santri
  ON "{{TENANT_SCHEMA}}".pesantren_presensi (santri_id, deleted_at);
