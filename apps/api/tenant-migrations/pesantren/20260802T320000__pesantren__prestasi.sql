-- =========================================================================
-- ePesantren — EP-S5: Prestasi dan penghargaan santri
-- =========================================================================
--
-- Kesenjangan terakhir Tier 1 dari audit kedua sistem lama:
-- `PrestasiSiswaAction`, `CabangPrestasiSiswaAction`,
-- `KategoriPrestasiSiswaAction`, `ApresiasiAction`(+DanPenghargaan,
-- +Siswa), `PenghargaanAction`, `PenghargaanSiswaAction` -- catatan
-- prestasi kompetisi DAN penghargaan/apresiasi formal sebagai dua
-- konsep berbeda: prestasi adalah HASIL kompetisi eksternal (menang
-- lomba), penghargaan adalah pengakuan internal pondok (mis. "Santri
-- Teladan Bulan Ini") yang tidak selalu berasal dari kompetisi.
--
-- BUKAN `pesantren_nilai` (EP-O): nilai adalah hasil akademik reguler per
-- mata pelajaran, prestasi/penghargaan di sini adalah pencapaian di
-- LUAR kurikulum reguler -- tujuan pemakaiannya (rapor non-akademik,
-- materi promosi pondok, syarat rekomendasi) juga berbeda.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_prestasi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  cabang          VARCHAR(160) NOT NULL,
  nama_kompetisi  VARCHAR(255) NOT NULL,
  tingkat         VARCHAR(16) NOT NULL,
  peringkat       VARCHAR(32) NOT NULL,
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  penyelenggara   VARCHAR(255),
  keterangan      TEXT,
  dokumen_url     TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_prestasi
  ADD CONSTRAINT ck_pesantren_prestasi_tingkat
  CHECK (tingkat IN ('SEKOLAH', 'KECAMATAN', 'KABUPATEN', 'PROVINSI', 'NASIONAL', 'INTERNASIONAL'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_prestasi
  ADD CONSTRAINT ck_pesantren_prestasi_peringkat
  CHECK (peringkat IN ('JUARA_1', 'JUARA_2', 'JUARA_3', 'HARAPAN_1', 'HARAPAN_2', 'HARAPAN_3', 'PARTISIPASI'));

CREATE INDEX IF NOT EXISTS ix_pesantren_prestasi_santri
  ON "{{TENANT_SCHEMA}}".pesantren_prestasi (santri_id, deleted_at);

-- ---------------------------------------------------------------------------
-- pesantren_penghargaan — pengakuan/apresiasi internal pondok
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_penghargaan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  judul           VARCHAR(255) NOT NULL,
  jenis           VARCHAR(32) NOT NULL DEFAULT 'APRESIASI',
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  diberikan_oleh  UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_guru (id) ON DELETE SET NULL,
  keterangan      TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_penghargaan
  ADD CONSTRAINT ck_pesantren_penghargaan_jenis
  CHECK (jenis IN ('APRESIASI', 'PENGHARGAAN_BULANAN', 'PENGHARGAAN_TAHUNAN', 'SERTIFIKAT', 'LAINNYA'));

CREATE INDEX IF NOT EXISTS ix_pesantren_penghargaan_santri
  ON "{{TENANT_SCHEMA}}".pesantren_penghargaan (santri_id, deleted_at);
