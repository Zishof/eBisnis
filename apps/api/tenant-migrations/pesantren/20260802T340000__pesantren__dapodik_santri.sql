-- =========================================================================
-- ePesantren — Kelengkapan data santri dan calon santri setara Dapodik
-- =========================================================================
--
-- Dapodik ("Data Pokok Pendidikan", kemdikbud.go.id) menuntut jauh lebih
-- banyak atribut peserta didik daripada yang dicatat `pesantren_santri`
-- sejak fondasi EP-A: identitas kependudukan (NIK, NISN, NIPD),
-- kewarganegaraan, kebutuhan khusus, alat transportasi dan jarak tempat
-- tinggal, kontak pribadi, status penerima program (KIP/KKS), serta data
-- rinci ayah/ibu/wali (NIK, tahun lahir, pendidikan, pekerjaan,
-- penghasilan masing-masing) -- lihat riset lapangan (helpdesk.pauddasmen.id,
-- "Data Rinci Peserta Didik").
--
-- Seluruhnya NULLABLE: migrasi ini murni EXPAND, tidak MENGUBAH satu pun
-- kolom yang sudah ada, dan tidak mewajibkan pengisian ulang data yang
-- sudah tersimpan tanpa atribut-atribut ini.
--
-- `pesantren_psb_pendaftar` mendapat kolom yang SAMA PERSIS (bukan subset)
-- -- calon santri harus dapat mengisi profil selengkap santri aktif sejak
-- pendaftaran, supaya daftar ulang (EP-O2) tidak menuntut pengisian ulang
-- data yang sebenarnya sudah pernah diberikan pendaftar. Kolom PSB yang
-- sudah ada (`nama_orang_tua`, `no_hp_orang_tua`) TETAP DIPERTAHANKAN --
-- keduanya ringkasan lama, bukan digantikan oleh rincian ayah/ibu baru.

DO $$
BEGIN
  -- ---------------------------------------------------------------------
  -- pesantren_santri
  -- ---------------------------------------------------------------------
  ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_santri
    ADD COLUMN IF NOT EXISTS nik                      VARCHAR(16),
    ADD COLUMN IF NOT EXISTS nisn                      VARCHAR(10),
    ADD COLUMN IF NOT EXISTS nipd                      VARCHAR(20),
    ADD COLUMN IF NOT EXISTS agama                     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS kewarganegaraan           VARCHAR(3) NOT NULL DEFAULT 'WNI',
    ADD COLUMN IF NOT EXISTS kebutuhan_khusus          VARCHAR(30) NOT NULL DEFAULT 'TIDAK_ADA',
    ADD COLUMN IF NOT EXISTS anak_ke                   INTEGER,
    ADD COLUMN IF NOT EXISTS jumlah_saudara            INTEGER,
    ADD COLUMN IF NOT EXISTS alat_transportasi         VARCHAR(30),
    ADD COLUMN IF NOT EXISTS jarak_tempat_tinggal_km   NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS telepon                   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS hp                        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS email                     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS penerima_kip              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS nomor_kip                 VARCHAR(30),
    ADD COLUMN IF NOT EXISTS penerima_kks              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS nomor_kks                 VARCHAR(30),
    ADD COLUMN IF NOT EXISTS nomor_kk                  VARCHAR(16),
    ADD COLUMN IF NOT EXISTS nama_ayah                 VARCHAR(160),
    ADD COLUMN IF NOT EXISTS nik_ayah                  VARCHAR(16),
    ADD COLUMN IF NOT EXISTS tahun_lahir_ayah           INTEGER,
    ADD COLUMN IF NOT EXISTS pendidikan_ayah           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS pekerjaan_ayah            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS penghasilan_ayah          VARCHAR(30),
    ADD COLUMN IF NOT EXISTS nama_ibu                  VARCHAR(160),
    ADD COLUMN IF NOT EXISTS nik_ibu                   VARCHAR(16),
    ADD COLUMN IF NOT EXISTS tahun_lahir_ibu            INTEGER,
    ADD COLUMN IF NOT EXISTS pendidikan_ibu            VARCHAR(30),
    ADD COLUMN IF NOT EXISTS pekerjaan_ibu             VARCHAR(50),
    ADD COLUMN IF NOT EXISTS penghasilan_ibu           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS nama_wali                 VARCHAR(160),
    ADD COLUMN IF NOT EXISTS nik_wali                  VARCHAR(16),
    ADD COLUMN IF NOT EXISTS tahun_lahir_wali           INTEGER,
    ADD COLUMN IF NOT EXISTS pendidikan_wali           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS pekerjaan_wali            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS penghasilan_wali          VARCHAR(30);

  -- ---------------------------------------------------------------------
  -- pesantren_psb_pendaftar -- kolom yang sama persis (lihat catatan di atas)
  -- ---------------------------------------------------------------------
  ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar
    ADD COLUMN IF NOT EXISTS nik                      VARCHAR(16),
    ADD COLUMN IF NOT EXISTS nisn                      VARCHAR(10),
    ADD COLUMN IF NOT EXISTS nipd                      VARCHAR(20),
    ADD COLUMN IF NOT EXISTS agama                     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS kewarganegaraan           VARCHAR(3) NOT NULL DEFAULT 'WNI',
    ADD COLUMN IF NOT EXISTS kebutuhan_khusus          VARCHAR(30) NOT NULL DEFAULT 'TIDAK_ADA',
    ADD COLUMN IF NOT EXISTS anak_ke                   INTEGER,
    ADD COLUMN IF NOT EXISTS jumlah_saudara            INTEGER,
    ADD COLUMN IF NOT EXISTS alat_transportasi         VARCHAR(30),
    ADD COLUMN IF NOT EXISTS jarak_tempat_tinggal_km   NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS telepon                   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS hp                        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS email                     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS penerima_kip              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS nomor_kip                 VARCHAR(30),
    ADD COLUMN IF NOT EXISTS penerima_kks              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS nomor_kks                 VARCHAR(30),
    ADD COLUMN IF NOT EXISTS nomor_kk                  VARCHAR(16),
    ADD COLUMN IF NOT EXISTS nama_ayah                 VARCHAR(160),
    ADD COLUMN IF NOT EXISTS nik_ayah                  VARCHAR(16),
    ADD COLUMN IF NOT EXISTS tahun_lahir_ayah           INTEGER,
    ADD COLUMN IF NOT EXISTS pendidikan_ayah           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS pekerjaan_ayah            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS penghasilan_ayah          VARCHAR(30),
    ADD COLUMN IF NOT EXISTS nama_ibu                  VARCHAR(160),
    ADD COLUMN IF NOT EXISTS nik_ibu                   VARCHAR(16),
    ADD COLUMN IF NOT EXISTS tahun_lahir_ibu            INTEGER,
    ADD COLUMN IF NOT EXISTS pendidikan_ibu            VARCHAR(30),
    ADD COLUMN IF NOT EXISTS pekerjaan_ibu             VARCHAR(50),
    ADD COLUMN IF NOT EXISTS penghasilan_ibu           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS nama_wali                 VARCHAR(160),
    ADD COLUMN IF NOT EXISTS nik_wali                  VARCHAR(16),
    ADD COLUMN IF NOT EXISTS tahun_lahir_wali           INTEGER,
    ADD COLUMN IF NOT EXISTS pendidikan_wali           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS pekerjaan_wali            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS penghasilan_wali          VARCHAR(30);
END $$;

-- NIK/NISN/NIPD/NIK ayah-ibu-wali/nomor KK: bila diisi, wajib berupa digit
-- dengan panjang yang tepat -- NULL tetap diperbolehkan (banyak santri
-- pesantren tidak/belum punya NISN, mis. yang hanya menempuh diniyah).
ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_santri
  ADD CONSTRAINT ck_pesantren_santri_nik_format
    CHECK (nik IS NULL OR nik ~ '^[0-9]{16}$'),
  ADD CONSTRAINT ck_pesantren_santri_nisn_format
    CHECK (nisn IS NULL OR nisn ~ '^[0-9]{10}$'),
  ADD CONSTRAINT ck_pesantren_santri_nomor_kk_format
    CHECK (nomor_kk IS NULL OR nomor_kk ~ '^[0-9]{16}$');

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_psb_pendaftar
  ADD CONSTRAINT ck_pesantren_psb_pendaftar_nik_format
    CHECK (nik IS NULL OR nik ~ '^[0-9]{16}$'),
  ADD CONSTRAINT ck_pesantren_psb_pendaftar_nisn_format
    CHECK (nisn IS NULL OR nisn ~ '^[0-9]{10}$'),
  ADD CONSTRAINT ck_pesantren_psb_pendaftar_nomor_kk_format
    CHECK (nomor_kk IS NULL OR nomor_kk ~ '^[0-9]{16}$');

-- NISN unik lintas santri aktif (bukan global -- Dapodik sendiri toleran
-- terhadap baris ganda saat migrasi/impor, tetapi dua santri AKTIF dengan
-- NISN sama pada satu pondok yang sama adalah kesalahan input yang harus
-- ditolak, bukan diam-diam disimpan berduplikasi).
CREATE UNIQUE INDEX IF NOT EXISTS ux_pesantren_santri_nisn
  ON "{{TENANT_SCHEMA}}".pesantren_santri (nisn) WHERE nisn IS NOT NULL AND deleted_at IS NULL;
