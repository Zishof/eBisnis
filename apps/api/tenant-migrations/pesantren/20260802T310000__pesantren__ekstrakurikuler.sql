-- =========================================================================
-- ePesantren — EP-S4: Ekstrakurikuler dan organisasi siswa
-- =========================================================================
--
-- Audit kedua sistem lama menemukan gugusan besar: `KegiatanKesiswaanAction`,
-- `KegiatanSiswaAction`, `KelompokKegiatanKesiswaanAction`(+Jenis),
-- `JabatanKegiatanKesiswaanAction`, `SkalaKegiatanKesiswaanAction`,
-- `NilaiKegiatanKesiswaanAction`, `OrganisasiSiswaAction`,
-- `JabatanOrganisasiSiswaAction`, `PembinaSiswaAction` -- ekstrakurikuler
-- (klub/kegiatan) DAN organisasi siswa setara OSIS sebagai dua gugusan
-- terpisah, masing-masing dengan tabel jabatan sendiri.
--
-- Modul ini SENGAJA menyatukan keduanya menjadi satu model: satu
-- `pesantren_ekstrakurikuler` bisa berupa klub biasa (Pramuka, Futsal)
-- ATAU organisasi formal (OSIS) -- dibedakan lewat kolom `jenis`, bukan
-- dua gugusan tabel terpisah. Ini penyederhanaan tabel yang SAH sesuai
-- instruksi eksplisit pengguna ("tabel-tabel tidak perlu sama struktur")
-- -- kemampuannya (keanggotaan, jabatan/kepemimpinan, skor partisipasi,
-- pembina) tetap ada seluruhnya, hanya tidak dipecah tabel per gugusan.
--
-- BUKAN `pesantren_diniyah`/`pesantren_tahfiz` (EP-H/EP-I): keduanya
-- jalur akademik-keagamaan dengan penilaian formal; ekstrakurikuler di
-- sini adalah keanggotaan klub/organisasi dengan skor partisipasi, siklus
-- hidup dan tujuan pemakaian yang berbeda (rapor non-akademik, bukan
-- nilai mata pelajaran).

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  nama            VARCHAR(160) NOT NULL,
  jenis           VARCHAR(16) NOT NULL DEFAULT 'KLUB',
  pembina_guru_id UUID REFERENCES "{{TENANT_SCHEMA}}".pesantren_guru (id) ON DELETE SET NULL,
  deskripsi       TEXT,

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

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler
  ADD CONSTRAINT ck_pesantren_ekstrakurikuler_jenis
  CHECK (jenis IN ('KLUB', 'ORGANISASI'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_ekstrakurikuler_code
  ON "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler (code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pesantren_ekstrakurikuler_anggota — keanggotaan, jabatan, dan partisipasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler_anggota (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ekstrakurikuler_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler (id) ON DELETE CASCADE,
  santri_id           UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_santri (id) ON DELETE CASCADE,
  tahun_ajaran_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pesantren_tahun_ajaran (id) ON DELETE RESTRICT,
  jabatan             VARCHAR(32) NOT NULL DEFAULT 'ANGGOTA',
  tanggal_bergabung   DATE NOT NULL DEFAULT CURRENT_DATE,
  status              VARCHAR(16) NOT NULL DEFAULT 'AKTIF',
  nilai_partisipasi   NUMERIC(5,2),
  catatan             TEXT,

  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id      UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  version             INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler_anggota
  ADD CONSTRAINT ck_pesantren_ekskul_anggota_jabatan
  CHECK (jabatan IN ('KETUA', 'WAKIL_KETUA', 'SEKRETARIS', 'BENDAHARA', 'ANGGOTA'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler_anggota
  ADD CONSTRAINT ck_pesantren_ekskul_anggota_status
  CHECK (status IN ('AKTIF', 'KELUAR'));

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler_anggota
  ADD CONSTRAINT ck_pesantren_ekskul_anggota_nilai
  CHECK (nilai_partisipasi IS NULL OR (nilai_partisipasi >= 0 AND nilai_partisipasi <= 100));

-- Santri BOLEH aktif di banyak ekstrakurikuler sekaligus (berbeda dari
-- rombongan belajar/EP-O3 yang satu per tahun ajaran) -- yang dicegah
-- hanya keanggotaan AKTIF ganda pada ekstrakurikuler yang SAMA di tahun
-- ajaran yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_ekskul_anggota_aktif
  ON "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler_anggota (ekstrakurikuler_id, santri_id, tahun_ajaran_id)
  WHERE status = 'AKTIF' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pesantren_ekskul_anggota_santri
  ON "{{TENANT_SCHEMA}}".pesantren_ekstrakurikuler_anggota (santri_id, status, deleted_at);
