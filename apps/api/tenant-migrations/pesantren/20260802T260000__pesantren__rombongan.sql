-- =========================================================================
-- ePesantren — EP-O3: Rombongan belajar/kelas
-- =========================================================================
--
-- Audit terhadap sistem lama (C:\opt\AIS\ais\...\master\sekolah\) yang
-- dilakukan pada EP-O menemukan bahwa presensi (EP-E) dan nilai (EP-O)
-- keduanya HANYA mengenal santri secara individu -- tidak ada konsep
-- "rombongan belajar/kelas" untuk mengelompokkan santri per unit
-- pendidikan dan tahun ajaran. Dua tabel di sini mengisi kekosongan itu.
--
-- pesantren_rombongan_belajar adalah kelasnya sendiri (mis. "VII-A" pada
-- tahun ajaran 2026/2027). pesantren_rombongan_anggota adalah keanggotaan
-- santri pada satu rombongan -- SATU santri hanya boleh punya SATU
-- keanggotaan AKTIF per tahun ajaran, ditegakkan indeks unik parsial,
-- sebab dua kelas aktif sekaligus untuk santri yang sama membuat setiap
-- laporan yang mengelompokkan per kelas menghitungnya dua kali.
--
-- Wali kelas SENGAJA menunjuk user_subject (akun staf yang sudah ada),
-- BUKAN peran baru "Guru" -- perintah pengguna eksplisit melarang
-- menyemai peran untuk fitur yang belum benar-benar berdiri (§6), dan
-- peran Guru dengan modulnya sendiri (jadwal mengajar, penilaian atas
-- nama guru, dan lain sebagainya) belum dikerjakan. Kolom ini karena itu
-- boleh NULL dan hanya menunjuk siapa pun user_subject yang sudah ada.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_rombongan_belajar (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_pendidikan_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (id) ON DELETE RESTRICT,
  tahun_ajaran_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  tingkat               VARCHAR(16) NOT NULL,
  nama                  VARCHAR(64) NOT NULL,
  wali_kelas_user_id    UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  kapasitas             INTEGER,

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample             BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id       UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  version               INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_rombongan_belajar
  ADD CONSTRAINT ck_pesantren_rombongan_belajar_kapasitas
  CHECK (kapasitas IS NULL OR kapasitas > 0);

-- Nama kelas unik per unit pendidikan + tahun ajaran -- dua kelas "VII-A"
-- pada tahun ajaran yang sama pada unit yang sama membuat setiap laporan
-- yang mengelompokkan per nama kelas ambigu.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_rombongan_belajar_nama
  ON "{{TENANT_SCHEMA}}".pesantren_rombongan_belajar (unit_pendidikan_id, tahun_ajaran_id, nama)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_rombongan_anggota — keanggotaan santri pada satu rombongan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_rombongan_anggota (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rombongan_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_rombongan_belajar (id) ON DELETE RESTRICT,
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  tahun_ajaran_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  tanggal_masuk   DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_keluar  DATE,
  status          VARCHAR(16) NOT NULL DEFAULT 'AKTIF',

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_rombongan_anggota
  ADD CONSTRAINT ck_pesantren_rombongan_anggota_status
  CHECK (status IN ('AKTIF', 'PINDAH', 'KELUAR'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_rombongan_anggota
  ADD CONSTRAINT ck_pesantren_rombongan_anggota_tanggal
  CHECK (tanggal_keluar IS NULL OR tanggal_keluar >= tanggal_masuk);

-- Satu santri hanya boleh punya SATU keanggotaan AKTIF per tahun ajaran --
-- lihat penjelasan di atas berkas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_rombongan_anggota_aktif
  ON "{{TENANT_SCHEMA}}".pesantren_rombongan_anggota (santri_id, tahun_ajaran_id)
  WHERE status = 'AKTIF' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_rombongan_anggota_rombongan
  ON "{{TENANT_SCHEMA}}".pesantren_rombongan_anggota (rombongan_id, status, deleted_at);
