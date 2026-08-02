-- =========================================================================
-- ePesantren — EP-S2: Guru (data induk) dan penugasan mengajar
-- =========================================================================
--
-- Audit kedua (menyeluruh) sistem lama menemukan `GuruAction`,
-- `JenisGuruAction`, `GuruMengajarAction`, `PenugasanGuruMengajarAction`
-- -- data induk guru dan penugasan mengajar mata pelajaran ke rombongan
-- per tahun ajaran. Modul sebelumnya (EP-O4, kurikulum/jadwal) hanya
-- punya `pesantren_jadwal_pelajaran.pengajar_user_id`, satu kolom yang
-- menjawab "siapa mengajar jam INI" -- tidak ada yang menjawab "siapa
-- guru pondok ini, dan apa penugasan resminya" secara terpisah dari
-- jadwal jam. Dua tabel di sini mengisi itu.
--
-- `pesantren_guru` SENGAJA tidak menuntut `user_subject_id` -- pola yang
-- sama dengan `pesantren_wali` (EP-A) dan `wali_kelas_user_id` (EP-O3):
-- tidak setiap guru diberi akun masuk sejak awal, dan mencatat data induk
-- guru tidak boleh menunggu akun portalnya siap.
--
-- `pesantren_penugasan_mengajar` adalah RENCANA resmi (guru X ditugaskan
-- mengajar mapel Y di rombongan Z tahun ajaran T, sekian jam per minggu)
-- -- terpisah dari `pesantren_jadwal_pelajaran` (jam nyata di kalender).
-- Pemisahan ini sama persis dengan yang dijaga sistem lama antara
-- `PenugasanGuruMengajarAction` dan `JadwalPelajaranAction`.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_guru (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  nip             VARCHAR(32),
  nama            VARCHAR(160) NOT NULL,
  jenis           VARCHAR(16) NOT NULL DEFAULT 'HONORER',
  no_hp           VARCHAR(32),
  email           VARCHAR(160),
  alamat          TEXT,
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

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_guru
  ADD CONSTRAINT ck_pesantren_guru_jenis
  CHECK (jenis IN ('TETAP', 'HONORER', 'DPK'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_guru
  ADD CONSTRAINT ck_pesantren_guru_status
  CHECK (status IN ('AKTIF', 'NONAKTIF'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_guru_nip
  ON "{{TENANT_SCHEMA}}".pesantren_guru (nip) WHERE deleted_at IS NULL AND nip IS NOT NULL;

-- ---------------------------------------------------------------------------
-- pesantren_penugasan_mengajar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_penugasan_mengajar (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_guru (id) ON DELETE RESTRICT,
  mata_pelajaran_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran (id) ON DELETE RESTRICT,
  rombongan_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_rombongan_belajar (id) ON DELETE CASCADE,
  tahun_ajaran_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  jam_per_minggu    INTEGER NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'AKTIF',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  version           INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_penugasan_mengajar
  ADD CONSTRAINT ck_pesantren_penugasan_mengajar_jam
  CHECK (jam_per_minggu > 0);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_penugasan_mengajar
  ADD CONSTRAINT ck_pesantren_penugasan_mengajar_status
  CHECK (status IN ('AKTIF', 'SELESAI'));

-- Satu kombinasi guru+mapel+rombongan+tahun ajaran hanya boleh dicatat
-- sekali -- dua baris identik berarti jam per minggu yang sama dihitung
-- dua kali pada rekap beban mengajar. Team-teaching (dua guru berbeda
-- untuk mapel+rombongan yang sama) tetap diperbolehkan, sebab kombinasi
-- guru_id-nya berbeda.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_penugasan_mengajar_kombinasi
  ON "{{TENANT_SCHEMA}}".pesantren_penugasan_mengajar (guru_id, mata_pelajaran_id, rombongan_id, tahun_ajaran_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_penugasan_mengajar_guru
  ON "{{TENANT_SCHEMA}}".pesantren_penugasan_mengajar (guru_id, status, deleted_at);
