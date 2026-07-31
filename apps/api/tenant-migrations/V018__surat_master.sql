-- =========================================================================
-- V018 — TATA KELOLA SURAT: MASTER DAN PENOMORAN
--
-- Dipetakan dari sistem lama pada C:\opt\AIS. Yang dipertahankan adalah
-- semantiknya, bukan bentuk tabelnya — beberapa keputusan sengaja berbeda dan
-- alasannya ditulis di tempatnya masing-masing.
--
-- Pemetaan istilah:
--
--   KelompokNomorSurat   -> surat_number_group
--   NomorSurat           -> surat_number_scheme
--   SifatSurat           -> surat_nature
--   LokerSurat           -> surat_locker
--   MasaBerlakuSurat     -> surat_retention_period
--   KopSurat             -> surat_letterhead
--   Klasifikasi*         -> surat_classification (satu tabel, dua arah)
--   AlurPersetujuan*     -> surat_approval_flow + surat_approval_flow_step
--
-- Additive. Tidak ada tabel maupun kolom lama yang diubah.
-- =========================================================================

-- Kelompok nomor -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_number_group (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(32) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample    BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID,
  version      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_surat_number_group_code UNIQUE (code)
);

-- Skema penomoran ----------------------------------------------------------
--
-- Sistem lama menyimpan `contohFormat` — sebuah CONTOH, bukan pola yang
-- ditegakkan. Contoh tidak dapat dieksekusi: dua orang yang membaca contoh yang
-- sama tetap dapat menuliskan nomor yang berbeda, dan mesin tidak dapat
-- memeriksanya sama sekali.
--
-- Karena itu di sini yang disimpan adalah POLA, dengan penanda yang tertutup:
--
--   {NOMOR}     nomor urut, dipadkan menurut number_padding
--   {TAHUN}     tahun empat angka
--   {TAHUN2}    tahun dua angka
--   {BULAN}     bulan dua angka
--   {BULAN_ROMAWI}  bulan dalam angka Romawi — lazim pada surat resmi Indonesia
--   {KODE_KLASIFIKASI}  kode klasifikasi surat
--   {KODE_UNIT} kode unit organisasi
--
-- Penanda di luar daftar itu ditolak oleh aplikasi, bukan dibiarkan menjadi
-- teks apa adanya: penanda salah ketik yang lolos akan menghasilkan nomor surat
-- resmi yang memuat "{TAHNU}".
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_number_scheme (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(32) NOT NULL,
  name          VARCHAR(160) NOT NULL,
  number_group_id UUID REFERENCES "{{TENANT_SCHEMA}}".surat_number_group(id),

  pattern       VARCHAR(255) NOT NULL,
  number_padding SMALLINT NOT NULL DEFAULT 4
                CHECK (number_padding BETWEEN 1 AND 10),
  start_number  INTEGER NOT NULL DEFAULT 1 CHECK (start_number >= 0),

  -- Kapan penghitung kembali ke angka awal.
  -- NEVER berarti berlanjut selamanya.
  reset_period  VARCHAR(16) NOT NULL DEFAULT 'YEARLY'
                CHECK (reset_period IN ('NEVER', 'YEARLY', 'MONTHLY')),

  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample     BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID,
  version       INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_surat_number_scheme_code UNIQUE (code),
  -- Pola tanpa {NOMOR} akan menghasilkan nomor yang sama untuk setiap surat.
  CONSTRAINT ck_surat_scheme_has_number CHECK (pattern LIKE '%{NOMOR}%')
);

-- Penghitung nomor ---------------------------------------------------------
--
-- ## Mengapa penghitungnya tabel, bukan MAX(nomor) + 1
--
-- Sistem lama punya `SinkronNomorSuratHelper` — sebuah penolong untuk
-- MENYELARASKAN nomor. Penolong seperti itu hanya dibutuhkan bila nomornya
-- pernah tidak selaras, dan nomor surat resmi yang kembar adalah cacat yang
-- terbawa ke luar organisasi: dua surat berbeda dengan nomor sama tidak dapat
-- dibedakan lagi oleh penerimanya.
--
-- `MAX(nomor) + 1` tidak dapat mencegahnya. Dua permintaan bersamaan membaca
-- MAX yang sama lalu menuliskan nomor yang sama, dan tidak ada cara menutup
-- celah itu tanpa mengunci seluruh tabel surat.
--
-- Di sini penghitungnya baris tersendiri dengan kunci unik pada (skema,
-- periode). Alokasi memakai `UPDATE ... RETURNING` dalam satu pernyataan, yang
-- mengunci hanya satu baris dan menjamin dua permintaan bersamaan menerima dua
-- angka berbeda. Tidak ada penyelarasan yang perlu dilakukan belakangan, karena
-- tidak ada keadaan tidak selaras yang mungkin terjadi.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_number_counter (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".surat_number_scheme(id),

  -- Kunci periode, mis. '2026' untuk YEARLY, '2026-07' untuk MONTHLY, atau
  -- 'ALL' untuk NEVER. Disimpan sebagai teks supaya satu kolom melayani ketiga
  -- jenis reset tanpa kolom tanggal yang separuhnya selalu kosong.
  period_key   VARCHAR(16) NOT NULL,

  last_number  INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_surat_counter UNIQUE (scheme_id, period_key)
);

-- Sifat surat --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_nature (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(32) NOT NULL,
  name         VARCHAR(120) NOT NULL,
  -- Urutan kepentingan; dipakai mengurutkan daftar dan menyorot yang mendesak.
  urgency_rank SMALLINT NOT NULL DEFAULT 0,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample    BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID,
  version      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_surat_nature_code UNIQUE (code)
);

-- Loker arsip --------------------------------------------------------------
--
-- Tempat fisik berkasnya. Dipertahankan dari sistem lama karena surat resmi
-- yang sudah ditandatangani tetap disimpan sebagai kertas, dan pertanyaan
-- "berkasnya di mana" tidak terjawab oleh sistem yang hanya menyimpan berkas
-- digitalnya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_locker (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(32) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  building     VARCHAR(96),
  room         VARCHAR(96),
  floor        VARCHAR(32),
  cabinet      VARCHAR(64),
  shelf        VARCHAR(64),
  box          VARCHAR(64),
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample    BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID,
  version      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_surat_locker_code UNIQUE (code)
);

-- Masa simpan --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_retention_period (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(32) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  retention_years SMALLINT CHECK (retention_years IS NULL OR retention_years >= 0),
  -- Sebagian arsip disimpan permanen; itu berbeda dari "masa simpannya belum
  -- ditentukan", dan membedakannya mencegah arsip permanen ikut terusulkan
  -- musnah.
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample    BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID,
  version      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_surat_retention_code UNIQUE (code),
  CONSTRAINT ck_surat_retention_permanent
    CHECK ((is_permanent AND retention_years IS NULL) OR (NOT is_permanent))
);

-- Kop surat ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_letterhead (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(32) NOT NULL,
  name          VARCHAR(160) NOT NULL,
  organization_name VARCHAR(255),
  address_line  TEXT,
  contact_line  VARCHAR(255),
  logo_file_id  UUID,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample     BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID,
  version       INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_surat_letterhead_code UNIQUE (code)
);

-- Alur persetujuan ---------------------------------------------------------
--
-- Sistem lama menyimpan alur sebagai POHON: setiap simpul menunjuk induknya
-- beserta kedalamannya (`parent`, `deep`). Bentuk itu ditinggalkan.
--
-- Alasannya: persetujuan surat berjalan BERURUTAN, bukan bercabang. Pohon
-- membolehkan bentuk yang tidak punya arti — dua anak pada kedalaman yang sama
-- berarti dua penyetuju sejajar, dan sistem lama tidak punya cara menyatakan
-- apakah keduanya harus setuju atau cukup salah satu. Bentuk yang membolehkan
-- keadaan tanpa arti akan menghasilkan keadaan tanpa arti.
--
-- Di sini alurnya daftar berurut. Percabangan yang benar-benar dibutuhkan
-- dinyatakan lewat `approver_mode` pada satu langkah — ANY berarti cukup satu
-- dari beberapa jabatan, ALL berarti seluruhnya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_approval_flow (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(32) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  direction    VARCHAR(8) NOT NULL CHECK (direction IN ('IN', 'OUT')),
  description  TEXT,

  -- Bila TRUE, surat tidak dapat diselesaikan tanpa melewati seluruh langkah.
  -- Bila FALSE, penyetuju berwenang dapat menyelesaikannya lebih awal.
  enforce_all_steps BOOLEAN NOT NULL DEFAULT TRUE,

  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample    BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID,
  version      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_surat_flow_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_approval_flow_step (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".surat_approval_flow(id) ON DELETE CASCADE,
  step_order    SMALLINT NOT NULL CHECK (step_order > 0),
  name          VARCHAR(160) NOT NULL,

  -- Siapa yang berwenang. Peran, bukan orang: orang berganti jabatan, dan alur
  -- yang menunjuk orang akan berhenti bekerja pada hari orang itu pindah.
  role_code     VARCHAR(64),

  approver_mode VARCHAR(8) NOT NULL DEFAULT 'ANY'
                CHECK (approver_mode IN ('ANY', 'ALL')),

  -- Batas waktu langkah ini, dalam jam kerja. Dipakai menandai keterlambatan
  -- dan menaikkan eskalasi.
  sla_hours     INTEGER CHECK (sla_hours IS NULL OR sla_hours > 0),

  -- Langkah yang boleh dilewati bila tidak ada penyetujunya. Ditandai eksplisit
  -- supaya alur tidak macet diam-diam ketika sebuah jabatan sedang kosong.
  is_skippable  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  version       INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_surat_flow_step_order UNIQUE (flow_id, step_order)
);

-- Klasifikasi surat --------------------------------------------------------
--
-- Sistem lama memisahkan klasifikasi masuk dan keluar menjadi dua tabel dengan
-- kolom yang hampir sama persis. Di sini satu tabel dengan kolom `direction`:
-- dua tabel kembar berarti setiap perubahan harus dilakukan dua kali, dan
-- perubahan yang harus dilakukan dua kali pada akhirnya dilakukan sekali.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".surat_classification (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(32) NOT NULL,
  name           VARCHAR(200) NOT NULL,
  direction      VARCHAR(8) NOT NULL CHECK (direction IN ('IN', 'OUT')),

  number_scheme_id UUID REFERENCES "{{TENANT_SCHEMA}}".surat_number_scheme(id),
  approval_flow_id UUID REFERENCES "{{TENANT_SCHEMA}}".surat_approval_flow(id),
  nature_id        UUID REFERENCES "{{TENANT_SCHEMA}}".surat_nature(id),
  retention_id     UUID REFERENCES "{{TENANT_SCHEMA}}".surat_retention_period(id),
  letterhead_id    UUID REFERENCES "{{TENANT_SCHEMA}}".surat_letterhead(id),

  default_subject  VARCHAR(255),
  template_body    TEXT,

  -- Jendela waktu surat jenis ini boleh diterbitkan. Dari sistem lama
  -- (`bisaDicetakMulai`/`bisaDicetakSampai`); berguna untuk surat musiman
  -- seperti keterangan kelulusan.
  issuable_from  DATE,
  issuable_until DATE,

  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample      BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID,
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID,
  version        INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_surat_classification_code UNIQUE (code),
  CONSTRAINT ck_surat_classification_window
    CHECK (issuable_from IS NULL OR issuable_until IS NULL OR issuable_from <= issuable_until)
);

-- Klasifikasi keluar wajib punya skema penomoran: surat keluar tanpa nomor
-- tidak dapat dirujuk oleh siapa pun. Surat masuk memakai nomor dari
-- pengirimnya, jadi tidak menuntutnya.
ALTER TABLE "{{TENANT_SCHEMA}}".surat_classification
  DROP CONSTRAINT IF EXISTS ck_surat_classification_out_needs_scheme;
ALTER TABLE "{{TENANT_SCHEMA}}".surat_classification
  ADD CONSTRAINT ck_surat_classification_out_needs_scheme
  CHECK (direction <> 'OUT' OR number_scheme_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_surat_classification_direction
  ON "{{TENANT_SCHEMA}}".surat_classification (direction, is_active);
CREATE INDEX IF NOT EXISTS idx_surat_flow_step_flow
  ON "{{TENANT_SCHEMA}}".surat_approval_flow_step (flow_id, step_order);
CREATE INDEX IF NOT EXISTS idx_surat_scheme_group
  ON "{{TENANT_SCHEMA}}".surat_number_scheme (number_group_id);

-- Trigger audit ------------------------------------------------------------
--
-- Master surat menentukan nomor resmi dan siapa yang berhak menyetujui.
-- Perubahannya wajib terlacak.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['surat_number_scheme', 'surat_classification',
                           'surat_approval_flow', 'surat_approval_flow_step'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;

-- surat_number_counter TIDAK diaudit dengan sengaja: ia berubah pada setiap
-- penerbitan surat, dan barisnya hanya memuat angka terakhir. Riwayat
-- penomoran yang sebenarnya ada pada surat itu sendiri — di sanalah terlihat
-- nomor mana diberikan kepada surat mana.
