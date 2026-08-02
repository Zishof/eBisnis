-- =========================================================================
-- ePesantren — EP-O2: PSB/PPDB (penerimaan santri baru bergelombang)
-- =========================================================================
--
-- Audit terhadap sistem lama (C:\opt\AIS\ais\...\master\sekolah\) dan
-- pendaftaran pondok yang sudah ada (apps/api/src/modules/public/
-- pesantren-registration.*) menemukan bahwa keduanya BUKAN alur ini:
-- pendaftaran pondok mendaftarkan SEBUAH PESANTREN (tenant baru), bukan
-- SEORANG CALON SANTRI ke pesantren yang sudah berjalan. Perintah pengguna
-- eksplisit meminta PSB/PPDB lebih canggih dari pendaftaran pondok --
-- bergelombang, berjadwal ujian/wawancara, terverifikasi, bernomor otomatis,
-- dan berujung penempatan setelah diterima.
--
-- Tiga tabel: gelombang (periode penerimaan), pendaftar (calon santri per
-- gelombang, dengan alur status penuh), dan jadwal (ujian/wawancara per
-- pendaftar, banyak baris per pendaftar). Penempatan pasca-diterima memakai
-- kembali pesantren_santri (EP-A) dan pesantren_penempatan/asrama (EP-G) --
-- TIDAK menduplikasi tabel itu. Penempatan rombongan belajar/kelas belum
-- dapat dilakukan sebab tabelnya belum ada (EP-O3, belum dikerjakan);
-- pendaftar yang diterima hanya diberi unit_pendidikan_tujuan_id (sudah ada
-- sejak EP-A), bukan kelas.

-- ---------------------------------------------------------------------------
-- pesantren_psb_gelombang — periode penerimaan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_psb_gelombang (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tahun_ajaran_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  kode                  VARCHAR(16) NOT NULL,
  nama                  VARCHAR(160) NOT NULL,
  tanggal_buka          DATE NOT NULL,
  tanggal_tutup         DATE NOT NULL,
  kuota                 INTEGER,
  biaya_pendaftaran     NUMERIC(14,2) NOT NULL DEFAULT 0,
  status                VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  -- Penghitung nomor pendaftaran, dinaikkan atomik lewat
  -- `UPDATE ... SET nomor_urut_terakhir = nomor_urut_terakhir + 1 ...
  -- RETURNING` di dalam transaksi -- pola yang sama dengan
  -- `surat_number_counter`, disederhanakan sebab PSB tidak butuh skema
  -- bernomor yang dapat diedit dari UI seperti modul surat.
  nomor_urut_terakhir   INTEGER NOT NULL DEFAULT 0,

  is_sample             BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id       UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  version               INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_gelombang
  ADD CONSTRAINT ck_pesantren_psb_gelombang_status
  CHECK (status IN ('DRAFT', 'DIBUKA', 'DITUTUP', 'SELESAI'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_gelombang
  ADD CONSTRAINT ck_pesantren_psb_gelombang_tanggal
  CHECK (tanggal_tutup > tanggal_buka);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_gelombang
  ADD CONSTRAINT ck_pesantren_psb_gelombang_kuota
  CHECK (kuota IS NULL OR kuota > 0);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_gelombang
  ADD CONSTRAINT ck_pesantren_psb_gelombang_biaya
  CHECK (biaya_pendaftaran >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_psb_gelombang_kode
  ON "{{TENANT_SCHEMA}}".pesantren_psb_gelombang (tahun_ajaran_id, kode) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_psb_pendaftar — calon santri per gelombang
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gelombang_id              UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_psb_gelombang (id) ON DELETE RESTRICT,
  nomor_pendaftaran         VARCHAR(40) NOT NULL,
  nama_lengkap              VARCHAR(160) NOT NULL,
  jenis_kelamin             CHAR(1) NOT NULL,
  tempat_lahir              VARCHAR(100),
  tanggal_lahir             DATE,
  nama_orang_tua            VARCHAR(160),
  no_hp_orang_tua           VARCHAR(32),
  alamat                    VARCHAR(255),
  asal_sekolah              VARCHAR(160),
  unit_pendidikan_tujuan_id UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan (id) ON DELETE RESTRICT,

  -- Alur: TERDAFTAR -> VERIFIKASI -> DIJADWALKAN -> (LULUS_SELEKSI |
  -- TIDAK_LULUS) -> DITERIMA -> DAFTAR_ULANG. DIBATALKAN dapat dicapai dari
  -- status non-final mana pun (mengundurkan diri, data ganda, dan lain
  -- sebagainya).
  status                    VARCHAR(20) NOT NULL DEFAULT 'TERDAFTAR',
  catatan_verifikasi        TEXT,
  diverifikasi_oleh         UUID,
  diverifikasi_pada         TIMESTAMPTZ,
  catatan_keputusan         TEXT,
  diputuskan_oleh           UUID,
  diputuskan_pada           TIMESTAMPTZ,
  -- Terisi hanya setelah daftar ulang benar-benar membuat baris
  -- pesantren_santri (lewat PesantrenSantriService.catat -- TIDAK
  -- menduplikasi logikanya di sini).
  santri_id                 UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE SET NULL,

  is_sample                 BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id           UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                UUID,
  deleted_at                TIMESTAMPTZ,
  version                   INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar
  ADD CONSTRAINT ck_pesantren_psb_pendaftar_jenis_kelamin
  CHECK (jenis_kelamin IN ('L', 'P'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar
  ADD CONSTRAINT ck_pesantren_psb_pendaftar_status
  CHECK (status IN (
    'TERDAFTAR', 'VERIFIKASI', 'DIJADWALKAN', 'LULUS_SELEKSI',
    'TIDAK_LULUS', 'DITERIMA', 'DAFTAR_ULANG', 'DIBATALKAN'
  ));

-- Nomor pendaftaran ditampilkan ke calon santri saat itu juga (mis. di
-- kuitansi/SMS) -- nomor kembar tidak boleh terjadi, sama seperti prinsip
-- yang sudah dipegang `surat_number_counter`.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_psb_pendaftar_nomor
  ON "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar (nomor_pendaftaran) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_psb_pendaftar_gelombang
  ON "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar (gelombang_id, status, deleted_at);

-- ---------------------------------------------------------------------------
-- pesantren_psb_jadwal — ujian/wawancara per pendaftar (banyak baris)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_psb_jadwal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pendaftar_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar (id) ON DELETE CASCADE,
  jenis           VARCHAR(24) NOT NULL,
  tanggal         DATE NOT NULL,
  waktu_mulai     TIME,
  waktu_selesai   TIME,
  lokasi          VARCHAR(160),
  penguji         VARCHAR(160),
  status          VARCHAR(16) NOT NULL DEFAULT 'DIJADWALKAN',
  nilai           NUMERIC(5,2),
  catatan_hasil   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_jadwal
  ADD CONSTRAINT ck_pesantren_psb_jadwal_jenis
  CHECK (jenis IN ('UJIAN_TULIS', 'TES_BACA_QURAN', 'WAWANCARA', 'TES_KESEHATAN', 'LAINNYA'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_jadwal
  ADD CONSTRAINT ck_pesantren_psb_jadwal_status
  CHECK (status IN ('DIJADWALKAN', 'SELESAI', 'TIDAK_HADIR', 'DIBATALKAN'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_jadwal
  ADD CONSTRAINT ck_pesantren_psb_jadwal_nilai_rentang
  CHECK (nilai IS NULL OR (nilai >= 0 AND nilai <= 100));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_jadwal
  ADD CONSTRAINT ck_pesantren_psb_jadwal_waktu
  CHECK (waktu_selesai IS NULL OR waktu_mulai IS NULL OR waktu_selesai > waktu_mulai);

CREATE INDEX IF NOT EXISTS ix_pesantren_psb_jadwal_pendaftar
  ON "{{TENANT_SCHEMA}}".pesantren_psb_jadwal (pendaftar_id, deleted_at);
