-- =========================================================================
-- ePesantren: Buku penghubung, catatan guru, dan catatan wali
-- =========================================================================
--
-- Menutup gap AIS lama:
-- - BukuPenghubungSiswa.java
-- - CatatanGuruAction.java
-- - CatatanSiswaAction.java
-- - CatatanOrangTuaAktiftasHarianAction.java
--
-- Modul ini berbeda dari presensi/nilai/pelanggaran. Isinya komunikasi
-- naratif per santri: catatan guru/pengurus/wali yang dapat dibuka ke wali
-- atau disimpan internal untuk tindak lanjut pondok.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_buku_penghubung (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id             UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  tanggal               DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis                 VARCHAR(32) NOT NULL DEFAULT 'LAINNYA',
  visibilitas           VARCHAR(32) NOT NULL DEFAULT 'INTERNAL',
  judul                 VARCHAR(180) NOT NULL,
  isi                   TEXT NOT NULL,
  tindak_lanjut         TEXT,
  status                VARCHAR(16) NOT NULL DEFAULT 'TERBUKA',
  ditulis_oleh_guru_id  UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_guru (id) ON DELETE SET NULL,
  ditulis_oleh_user_id  UUID,

  is_sample             BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id       UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  version               INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_buku_penghubung
  ADD CONSTRAINT ck_pesantren_buku_penghubung_jenis
  CHECK (jenis IN ('AKADEMIK', 'KESEHATAN', 'KEDISIPLINAN', 'IBADAH', 'ASRAMA', 'WALI', 'LAINNYA'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_buku_penghubung
  ADD CONSTRAINT ck_pesantren_buku_penghubung_visibilitas
  CHECK (visibilitas IN ('INTERNAL', 'WALI'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_buku_penghubung
  ADD CONSTRAINT ck_pesantren_buku_penghubung_status
  CHECK (status IN ('TERBUKA', 'SELESAI'));

CREATE INDEX IF NOT EXISTS ix_pesantren_buku_penghubung_santri
  ON "{{TENANT_SCHEMA}}".pesantren_buku_penghubung (santri_id, tanggal DESC, deleted_at);

CREATE INDEX IF NOT EXISTS ix_pesantren_buku_penghubung_status
  ON "{{TENANT_SCHEMA}}".pesantren_buku_penghubung (status, tanggal DESC, deleted_at);
