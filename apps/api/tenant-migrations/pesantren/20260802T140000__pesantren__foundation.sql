-- =========================================================================
-- ePesantren — Fondasi: tahun ajaran, unit pendidikan, wali, dan santri
-- =========================================================================
--
-- EP-A pada rencana docs/santri-info/16-implementation-plan.md. Prasyarat
-- mutlak seluruh modul ePesantren lain: presensi, tagihan, asrama, diniyah,
-- tahfiz, dan portal wali tidak punya pijakan tanpa tabel-tabel ini.
--
-- Nama tabel berawalan `pesantren_`, mengikuti usul docs/santri-info/06 —
-- schema tetap satu per penyewa (bukan satu per modul), dan awalan inilah yang
-- membuat tabel modul ini dapat dikenali dan, bila kelak pemisahan per modul
-- diputuskan, dipindahkan sebagai satu kesatuan.

-- ---------------------------------------------------------------------------
-- pesantren_tahun_ajaran
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  name            VARCHAR(64) NOT NULL,
  tanggal_mulai   DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_tahun_ajaran_code
  ON "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_pesantren_tahun_ajaran_active
  ON "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (is_active, deleted_at);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran
  ADD CONSTRAINT ck_pesantren_tahun_ajaran_status
  CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED'));

-- Tanggal selesai wajib setelah tanggal mulai. Tahun ajaran yang terbalik
-- tanggalnya membuat setiap laporan yang memfilter periode salah tanpa galat.
ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran
  ADD CONSTRAINT ck_pesantren_tahun_ajaran_tanggal
  CHECK (tanggal_selesai > tanggal_mulai);

-- Hanya satu tahun ajaran berstatus ACTIVE pada satu waktu. Dua tahun ajaran
-- aktif sekaligus membuat setiap layar yang bertanya "tahun ajaran mana yang
-- berjalan" mendapat jawaban yang berbeda tergantung urutan baca.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_tahun_ajaran_satu_aktif
  ON "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran ((true))
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_unit_pendidikan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  name            VARCHAR(160) NOT NULL,
  jenis           VARCHAR(24) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_unit_pendidikan_code
  ON "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (code) WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan
  ADD CONSTRAINT ck_pesantren_unit_pendidikan_jenis
  CHECK (jenis IN ('SEKOLAH_FORMAL', 'DINIYAH', 'TAHFIZ', 'LAINNYA'));

-- ---------------------------------------------------------------------------
-- pesantren_wali — wali santri, TERPISAH dari user_subject inti
-- ---------------------------------------------------------------------------
-- Tidak setiap wali memperoleh akun masuk. Menggabungkannya dengan
-- user_subject berarti mencatat wali yang belum diberi akses portal sebagai
-- baris user_subject yang tidak dapat masuk, dan pemeriksaan "siapa yang dapat
-- masuk" tercampur dengan "siapa wali santri".
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_wali (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Terisi hanya bila wali ini diberi akun portal. NULL berarti wali yang
  -- datanya tercatat tetapi belum dapat masuk sendiri.
  user_subject_id UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id) ON DELETE SET NULL,
  nama            VARCHAR(160) NOT NULL,
  hubungan        VARCHAR(16) NOT NULL,
  telepon         VARCHAR(32),
  whatsapp        VARCHAR(32),
  alamat          TEXT,
  pekerjaan       VARCHAR(120),

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE INDEX IF NOT EXISTS ix_pesantren_wali_active
  ON "{{TENANT_SCHEMA}}".pesantren_wali (is_active, deleted_at);
CREATE INDEX IF NOT EXISTS ix_pesantren_wali_user_subject
  ON "{{TENANT_SCHEMA}}".pesantren_wali (user_subject_id);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_wali
  ADD CONSTRAINT ck_pesantren_wali_hubungan
  CHECK (hubungan IN ('AYAH', 'IBU', 'WALI_LAIN'));

-- ---------------------------------------------------------------------------
-- pesantren_santri
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_santri (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nis                   VARCHAR(32) NOT NULL,
  nama_lengkap          VARCHAR(160) NOT NULL,
  nama_panggilan        VARCHAR(64),
  jenis_kelamin         VARCHAR(1) NOT NULL,
  tempat_lahir          VARCHAR(100),
  tanggal_lahir         DATE,
  unit_pendidikan_id    UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (id) ON DELETE RESTRICT,
  status                VARCHAR(16) NOT NULL DEFAULT 'AKTIF',
  status_tinggal        VARCHAR(16) NOT NULL,
  tanggal_masuk         DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_keluar        DATE,
  alasan_keluar         TEXT,
  alamat_asal           TEXT,
  golongan_darah        VARCHAR(4),
  catatan_alergi        TEXT,
  catatan               TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_santri_nis
  ON "{{TENANT_SCHEMA}}".pesantren_santri (nis) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_pesantren_santri_status
  ON "{{TENANT_SCHEMA}}".pesantren_santri (status, status_tinggal, deleted_at);
CREATE INDEX IF NOT EXISTS ix_pesantren_santri_unit
  ON "{{TENANT_SCHEMA}}".pesantren_santri (unit_pendidikan_id);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_santri
  ADD CONSTRAINT ck_pesantren_santri_jenis_kelamin
  CHECK (jenis_kelamin IN ('L', 'P'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_santri
  ADD CONSTRAINT ck_pesantren_santri_status
  CHECK (status IN ('AKTIF', 'LULUS', 'KELUAR', 'PINDAH'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_santri
  ADD CONSTRAINT ck_pesantren_santri_status_tinggal
  CHECK (status_tinggal IN ('MUKIM', 'NONMUKIM'));

-- Santri yang sudah tidak AKTIF wajib punya tanggal keluar; santri AKTIF wajib
-- TIDAK punya tanggal keluar. Tanpa ini, "santri aktif" (dasar penagihan
-- §13.4) dapat dihitung dari status ATAU dari tanggal keluar, dan keduanya
-- dapat berselisih tanpa satu pun galat.
ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_santri
  ADD CONSTRAINT ck_pesantren_santri_tanggal_keluar_konsisten
  CHECK (
    (status = 'AKTIF' AND tanggal_keluar IS NULL) OR
    (status <> 'AKTIF' AND tanggal_keluar IS NOT NULL)
  );

-- Tanggal keluar tidak boleh sebelum tanggal masuk. Longgar terhadap hari yang
-- sama (masuk dan keluar pada tanggal identik dapat terjadi pada koreksi data).
ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_santri
  ADD CONSTRAINT ck_pesantren_santri_tanggal_keluar_setelah_masuk
  CHECK (tanggal_keluar IS NULL OR tanggal_keluar >= tanggal_masuk);

-- ---------------------------------------------------------------------------
-- pesantren_santri_wali — relasi banyak ke banyak
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_santri_wali (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  wali_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_wali (id) ON DELETE CASCADE,
  adalah_wali_utama BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_santri_wali_pasangan
  ON "{{TENANT_SCHEMA}}".pesantren_santri_wali (santri_id, wali_id) WHERE deleted_at IS NULL;

-- Maksimal satu wali utama per santri. Portal wali (EP-K) menuntut satu jawaban
-- pasti atas "siapa yang menerima pemberitahuan utama anak ini" — dua wali
-- utama membuat pemberitahuan terkirim dua kali atau tidak terkirim sama
-- sekali, tergantung bagaimana pengirimnya menafsirkan baris yang mendua.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_santri_satu_wali_utama
  ON "{{TENANT_SCHEMA}}".pesantren_santri_wali (santri_id)
  WHERE adalah_wali_utama = TRUE AND deleted_at IS NULL;
