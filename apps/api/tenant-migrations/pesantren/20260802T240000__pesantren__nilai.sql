-- =========================================================================
-- ePesantren — EP-O: Nilai dan rapor
-- =========================================================================
--
-- Audit terhadap sistem lama (C:\opt\AIS\ais\...\master\sekolah\) menemukan
-- mesin penilaian berlapis: Jenis Penilaian -> Grup Penilaian -> Grup
-- Kategori -> Kategori Item -> Jenis Item, plus tabel konversi huruf mutu
-- terpisah -- enam kelas Java untuk satu konsep "nilai berbobot dengan
-- konversi huruf". Perintah pengguna eksplisit: tabel TIDAK perlu meniru
-- strukturnya, tetapi KEMAMPUANNYA harus ada dan LEBIH canggih.
--
-- Empat tabel di sini mencakup kemampuan yang sama (mata pelajaran,
-- komponen bernilai bobot, skala konversi huruf, nilai per komponen) tanpa
-- hierarki lima lapis -- nilai akhir dan huruf mutu DIHITUNG di service dari
-- komponen-komponen ini, bukan disimpan berduplikasi, pola yang sama dengan
-- capaian tahfiz (EP-I) dan saldo dompet (EP-L).

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  nama            VARCHAR(160) NOT NULL,
  kelompok        VARCHAR(32),
  sort_order      INTEGER NOT NULL DEFAULT 0,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_mata_pelajaran_code
  ON "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran (code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_komponen_nilai — pengganti hierarki Jenis/Grup Penilaian lama
-- ---------------------------------------------------------------------------
-- Satu baris = satu komponen bernilai bobot (mis. Tugas 20%, UTS 30%,
-- UAS 50%). Nilai akhir = SUM(nilai * bobot) / 100 -- dihitung, bukan
-- disimpan. Total bobot per mata pelajaran TIDAK ditegakkan basis data
-- (dapat berbeda antar guru/kelas); service memperingatkan bila jumlahnya
-- bukan 100, bukan menolaknya -- guru boleh sengaja belum melengkapi
-- seluruh komponen di tengah semester.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_komponen_nilai (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mata_pelajaran_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_mata_pelajaran (id) ON DELETE CASCADE,
  kode            VARCHAR(32) NOT NULL,
  nama            VARCHAR(120) NOT NULL,
  bobot_persen    NUMERIC(5,2) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_komponen_nilai
  ADD CONSTRAINT ck_pesantren_komponen_nilai_bobot_rentang
  CHECK (bobot_persen > 0 AND bobot_persen <= 100);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_komponen_nilai_kode
  ON "{{TENANT_SCHEMA}}".pesantren_komponen_nilai (mata_pelajaran_id, kode) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_pesantren_komponen_nilai_mapel
  ON "{{TENANT_SCHEMA}}".pesantren_komponen_nilai (mata_pelajaran_id, deleted_at);

-- ---------------------------------------------------------------------------
-- pesantren_skala_huruf — konversi angka ke huruf mutu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_skala_huruf (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huruf           VARCHAR(4) NOT NULL,
  nilai_minimum   NUMERIC(5,2) NOT NULL,
  nilai_maksimum  NUMERIC(5,2) NOT NULL,
  keterangan      VARCHAR(160),
  sort_order      INTEGER NOT NULL DEFAULT 0,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_skala_huruf
  ADD CONSTRAINT ck_pesantren_skala_huruf_rentang_sah
  CHECK (nilai_maksimum >= nilai_minimum);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_skala_huruf_huruf
  ON "{{TENANT_SCHEMA}}".pesantren_skala_huruf (huruf) WHERE deleted_at IS NULL;

-- Rentang antar baris tidak boleh tumpang tindih -- dua huruf yang sama-sama
-- mengklaim nilai 85 membuat rapor mencetak huruf yang berbeda tergantung
-- urutan baca, dan wali yang membandingkan dua rapor anaknya akan
-- menemukan aturan yang tampak tidak konsisten. `EXCLUDE`, bukan sekadar
-- indeks unik, sebab yang dicegah adalah IRISAN rentang, bukan kesamaan
-- nilai persis.
ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_skala_huruf
  ADD CONSTRAINT ex_pesantren_skala_huruf_tanpa_tumpang_tindih
  EXCLUDE USING gist (numrange(nilai_minimum, nilai_maksimum, '[]') WITH &&)
  WHERE (deleted_at IS NULL);

-- ---------------------------------------------------------------------------
-- pesantren_nilai — nilai santri per komponen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_nilai (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  komponen_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_komponen_nilai (id) ON DELETE CASCADE,
  tahun_ajaran_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  nilai_angka     NUMERIC(5,2) NOT NULL,
  catatan         TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_nilai
  ADD CONSTRAINT ck_pesantren_nilai_angka_rentang
  CHECK (nilai_angka >= 0 AND nilai_angka <= 100);

-- Satu santri hanya boleh punya SATU nilai per komponen per tahun ajaran.
-- Guru memperbaiki nilai yang salah lewat UPDATE, bukan menambah baris
-- kedua yang membuat rata-rata berbobot menghitung komponen itu dua kali.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_nilai_satu_per_komponen
  ON "{{TENANT_SCHEMA}}".pesantren_nilai (santri_id, komponen_id, tahun_ajaran_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_nilai_santri_tahun
  ON "{{TENANT_SCHEMA}}".pesantren_nilai (santri_id, tahun_ajaran_id, deleted_at);
