-- =========================================================================
-- ePesantren — EP-S3: Absensi guru dan piket
-- =========================================================================
--
-- Audit kedua sistem lama menemukan `AbsenGuruPiketAction`,
-- `AbsenPiketAction`, dan turunan detailnya -- kehadiran harian guru DAN
-- jadwal piket (giliran jaga/pengawasan) sebagai dua konsep yang berbeda.
-- INI BUKAN `pesantren_presensi` (EP-E): presensi mencatat kehadiran
-- SANTRI, tabel ini mencatat kehadiran STAF PENGAJAR -- subjek, pemilik
-- proses (bagian kepegawaian/kurikulum, bukan wali kelas), dan tujuan
-- pemakaiannya (dasar honor/evaluasi kinerja, bukan pemantauan santri)
-- sama sekali berbeda.
--
-- Dua tabel: absensi harian guru (satu baris per guru per tanggal), dan
-- piket (jadwal giliran jaga -- banyak guru bisa piket pada tanggal yang
-- sama untuk jenis piket yang berbeda, atau tidak sama sekali).

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_absensi_guru (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_guru (id) ON DELETE CASCADE,
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(8) NOT NULL,
  jam_masuk       TIME,
  jam_pulang      TIME,
  keterangan      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_absensi_guru
  ADD CONSTRAINT ck_pesantren_absensi_guru_status
  CHECK (status IN ('HADIR', 'IZIN', 'SAKIT', 'ALPA'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_absensi_guru
  ADD CONSTRAINT ck_pesantren_absensi_guru_jam
  CHECK (jam_pulang IS NULL OR jam_masuk IS NULL OR jam_pulang > jam_masuk);

-- Satu guru hanya boleh punya SATU baris absensi per tanggal -- dua baris
-- untuk tanggal yang sama membuat rekap kehadiran bulanan menghitung
-- ganda atau ambigu status mana yang berlaku.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_absensi_guru_satu_per_hari
  ON "{{TENANT_SCHEMA}}".pesantren_absensi_guru (guru_id, tanggal) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_absensi_guru_tanggal
  ON "{{TENANT_SCHEMA}}".pesantren_absensi_guru (tanggal, deleted_at);

-- ---------------------------------------------------------------------------
-- pesantren_piket — jadwal giliran jaga/pengawasan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_piket (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_guru (id) ON DELETE CASCADE,
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis_piket     VARCHAR(16) NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'DIJADWALKAN',
  keterangan      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_piket
  ADD CONSTRAINT ck_pesantren_piket_jenis
  CHECK (jenis_piket IN ('PIKET_HARIAN', 'PIKET_MALAM', 'PIKET_GERBANG', 'PIKET_ASRAMA', 'LAINNYA'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_piket
  ADD CONSTRAINT ck_pesantren_piket_status
  CHECK (status IN ('DIJADWALKAN', 'HADIR', 'TIDAK_HADIR'));

-- Satu guru tidak boleh dijadwalkan piket jenis yang sama dua kali pada
-- tanggal yang sama -- boleh piket jenis BERBEDA di tanggal yang sama
-- (mis. piket harian pagi dan piket malam), dan boleh guru LAIN piket
-- jenis yang sama di tanggal yang sama (giliran bersama).
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_piket_kombinasi
  ON "{{TENANT_SCHEMA}}".pesantren_piket (guru_id, tanggal, jenis_piket) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_piket_tanggal
  ON "{{TENANT_SCHEMA}}".pesantren_piket (tanggal, deleted_at);
