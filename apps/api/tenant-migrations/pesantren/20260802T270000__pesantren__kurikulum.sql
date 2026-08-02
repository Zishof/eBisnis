-- =========================================================================
-- ePesantren — EP-O4: Kurikulum dan jadwal pelajaran
-- =========================================================================
--
-- Audit terhadap sistem lama (C:\opt\AIS\ais\...\master\sekolah\) yang
-- dilakukan pada EP-O menemukan celah terakhir dari tiga yang tercatat:
-- kurikulum (mata pelajaran apa saja yang diajarkan di tingkat/unit
-- pendidikan mana, berapa jam per minggu) dan jadwal pelajaran (kapan
-- setiap mata pelajaran diajarkan pada rombongan belajar mana).
--
-- pesantren_kurikulum hanyalah daftar mata pelajaran + jam per minggu per
-- unit pendidikan, tingkat, dan tahun ajaran -- referensi rencana, bukan
-- jadwal jam nyata.
--
-- pesantren_jadwal_pelajaran adalah jadwal jam nyata per rombongan
-- belajar. Dua EXCLUDE constraint mencegah tabrakan yang sistem lama
-- (sejauh ditemukan audit) tidak menegakkan sama sekali: satu rombongan
-- tidak boleh punya dua pelajaran pada jam yang tumpang tindih di hari
-- yang sama, dan satu pengajar (bila diisi) tidak boleh mengajar dua
-- rombongan berbeda pada jam yang tumpang tindih di hari yang sama.
-- `btree_gist` dibutuhkan di sini (berbeda dari EP-O yang cukup GiST
-- bawaan) sebab predikat kesetaraan pada kolom UUID/VARCHAR dalam EXCLUDE
-- menuntut operator class dari ekstensi itu -- pola yang sama dengan
-- `cooperative_appointment` (20260731T170000).

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_kurikulum (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_pendidikan_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (id) ON DELETE RESTRICT,
  tahun_ajaran_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  tingkat            VARCHAR(16) NOT NULL,
  mata_pelajaran_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran (id) ON DELETE RESTRICT,
  jam_per_minggu     INTEGER NOT NULL,

  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID,
  deleted_at         TIMESTAMPTZ,
  version            INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_kurikulum
  ADD CONSTRAINT ck_pesantren_kurikulum_jam
  CHECK (jam_per_minggu > 0);

-- Satu mata pelajaran hanya boleh muncul sekali per unit+tingkat+tahun
-- ajaran -- dua baris untuk kombinasi yang sama membuat total jam per
-- minggu ambigu (baris mana yang berlaku).
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_kurikulum_kombinasi
  ON "{{TENANT_SCHEMA}}".pesantren_kurikulum (unit_pendidikan_id, tahun_ajaran_id, tingkat, mata_pelajaran_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_jadwal_pelajaran — jadwal jam nyata per rombongan belajar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_jadwal_pelajaran (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rombongan_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_rombongan_belajar (id) ON DELETE CASCADE,
  mata_pelajaran_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran (id) ON DELETE RESTRICT,
  hari               VARCHAR(8) NOT NULL,
  waktu_mulai        TIME NOT NULL,
  waktu_selesai      TIME NOT NULL,
  -- Kolom turunan untuk EXCLUDE -- GiST tidak punya tipe range bawaan
  -- untuk TIME, jadi jam diubah ke menit-sejak-tengah-malam supaya bisa
  -- dibungkus int4range.
  menit_mulai        INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM waktu_mulai)::integer / 60) STORED,
  menit_selesai      INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM waktu_selesai)::integer / 60) STORED,
  pengajar_user_id   UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  ruangan            VARCHAR(100),

  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID,
  deleted_at         TIMESTAMPTZ,
  version            INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_jadwal_pelajaran
  ADD CONSTRAINT ck_pesantren_jadwal_pelajaran_hari
  CHECK (hari IN ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_jadwal_pelajaran
  ADD CONSTRAINT ck_pesantren_jadwal_pelajaran_waktu
  CHECK (waktu_selesai > waktu_mulai);

-- Satu rombongan tidak boleh punya dua pelajaran pada jam yang tumpang
-- tindih di hari yang sama -- wali kelas yang membaca jadwal tidak boleh
-- menemukan dua mata pelajaran berbeda pada jam yang sama.
ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_jadwal_pelajaran
  ADD CONSTRAINT ex_pesantren_jadwal_pelajaran_rombongan_tanpa_tumpang_tindih
  EXCLUDE USING gist (
    rombongan_id WITH =,
    hari WITH =,
    int4range(menit_mulai, menit_selesai, '[)') WITH &&
  )
  WHERE (deleted_at IS NULL);

-- Satu pengajar (bila diisi) tidak boleh mengajar dua rombongan berbeda
-- pada jam yang tumpang tindih di hari yang sama -- guru yang sama tidak
-- bisa berada di dua kelas sekaligus.
ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_jadwal_pelajaran
  ADD CONSTRAINT ex_pesantren_jadwal_pelajaran_pengajar_tanpa_tumpang_tindih
  EXCLUDE USING gist (
    pengajar_user_id WITH =,
    hari WITH =,
    int4range(menit_mulai, menit_selesai, '[)') WITH &&
  )
  WHERE (pengajar_user_id IS NOT NULL AND deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS ix_pesantren_jadwal_pelajaran_rombongan
  ON "{{TENANT_SCHEMA}}".pesantren_jadwal_pelajaran (rombongan_id, hari, deleted_at);
