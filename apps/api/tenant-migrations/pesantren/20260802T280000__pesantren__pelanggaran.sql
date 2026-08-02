-- =========================================================================
-- ePesantren — EP-S1: Pelanggaran dan hukuman santri
-- =========================================================================
--
-- Audit KEDUA terhadap sistem lama (C:\opt\AIS\ais\...\master\sekolah\),
-- kali ini menyeluruh atas seluruh direktori (bukan hanya penilaian) atas
-- permintaan eksplisit pengguna, menemukan `PelanggaranAction`,
-- `PelanggaranSiswaAction`, `HukumanAction` -- pencatatan pelanggaran tata
-- tertib dan sanksinya. INI BUKAN `pesantren_izin` (EP-J): izin adalah
-- pengajuan proaktif santri untuk keluar pondok, pelanggaran adalah
-- pencatatan reaktif oleh pengurus/musyrif atas pelanggaran tata tertib.
-- Keduanya punya pemilik proses dan siklus hidup yang sama sekali berbeda.
--
-- Tiga tabel: katalog jenis pelanggaran (dengan bobot poin), catatan
-- pelanggaran per santri (poin DISALIN pada saat pencatatan -- lihat
-- alasan di bawah), dan hukuman yang dijatuhkan atas satu pelanggaran.
-- Total poin per santri DIHITUNG di service dari log, pola yang sama
-- dengan saldo dompet (EP-L) dan capaian tahfiz (EP-I) -- bukan kolom
-- akumulator yang bisa menyimpang dari jumlah barisnya.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_jenis_pelanggaran (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  nama            VARCHAR(160) NOT NULL,
  kategori        VARCHAR(8) NOT NULL,
  poin            INTEGER NOT NULL,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_jenis_pelanggaran
  ADD CONSTRAINT ck_pesantren_jenis_pelanggaran_kategori
  CHECK (kategori IN ('RINGAN', 'SEDANG', 'BERAT'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_jenis_pelanggaran
  ADD CONSTRAINT ck_pesantren_jenis_pelanggaran_poin
  CHECK (poin > 0);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_jenis_pelanggaran_code
  ON "{{TENANT_SCHEMA}}".pesantren_jenis_pelanggaran (code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_pelanggaran — catatan pelanggaran per santri
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_pelanggaran (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id            UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  jenis_pelanggaran_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_jenis_pelanggaran (id) ON DELETE RESTRICT,
  tanggal              DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan           TEXT,
  -- Poin DISALIN dari jenis_pelanggaran pada saat pencatatan, bukan
  -- dibaca ulang lewat JOIN setiap kali dihitung -- bobot poin sebuah
  -- jenis pelanggaran dapat berubah di kemudian hari (kebijakan pondok
  -- berubah), dan catatan lama tidak boleh diam-diam ikut berubah
  -- nilainya hanya karena aturan baru diterbitkan.
  poin                 INTEGER NOT NULL,
  status               VARCHAR(16) NOT NULL DEFAULT 'DICATAT',
  alasan_pembatalan    TEXT,
  dibatalkan_oleh      UUID,
  dibatalkan_pada      TIMESTAMPTZ,

  is_sample            BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id      UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by           UUID,
  deleted_at           TIMESTAMPTZ,
  version              INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_pelanggaran
  ADD CONSTRAINT ck_pesantren_pelanggaran_status
  CHECK (status IN ('DICATAT', 'DIBATALKAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_pelanggaran
  ADD CONSTRAINT ck_pesantren_pelanggaran_poin
  CHECK (poin > 0);

CREATE INDEX IF NOT EXISTS ix_pesantren_pelanggaran_santri
  ON "{{TENANT_SCHEMA}}".pesantren_pelanggaran (santri_id, status, deleted_at);

-- ---------------------------------------------------------------------------
-- pesantren_hukuman — sanksi yang dijatuhkan atas satu pelanggaran
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_hukuman (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelanggaran_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_pelanggaran (id) ON DELETE CASCADE,
  jenis_hukuman   VARCHAR(32) NOT NULL,
  keterangan      TEXT,
  tanggal_mulai   DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_selesai DATE,
  status          VARCHAR(16) NOT NULL DEFAULT 'DIJATUHKAN',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_hukuman
  ADD CONSTRAINT ck_pesantren_hukuman_jenis
  CHECK (jenis_hukuman IN (
    'TEGURAN_LISAN', 'TEGURAN_TERTULIS', 'PEMANGGILAN_ORANG_TUA',
    'SKORSING', 'PEMBINAAN_KHUSUS', 'LAINNYA'
  ));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_hukuman
  ADD CONSTRAINT ck_pesantren_hukuman_status
  CHECK (status IN ('DIJATUHKAN', 'SELESAI', 'DIBATALKAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_hukuman
  ADD CONSTRAINT ck_pesantren_hukuman_tanggal
  CHECK (tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_mulai);

CREATE INDEX IF NOT EXISTS ix_pesantren_hukuman_pelanggaran
  ON "{{TENANT_SCHEMA}}".pesantren_hukuman (pelanggaran_id, deleted_at);
