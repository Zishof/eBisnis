-- =========================================================================
-- VILLAGE D-2 — PENDUDUK, KELUARGA, DAN PERISTIWA KEPENDUDUKAN
-- =========================================================================
--
-- Data paling sensitif di seluruh eBisnis: NIK, kartu keluarga, kondisi
-- sosial, dan disabilitas seluruh warga sebuah desa.
--
-- Tiga hal yang membedakannya dari data penyewa lain, dan ketiganya terlihat
-- pada rancangan di bawah:
--
-- 1. **Ini data orang lain.** Warga tidak menandatangani apa pun dan sering
--    tidak tahu datanya ada di sini. Dasar hukum pemrosesannya kewajiban
--    pemerintahan desa — dan itu berarti cakupannya dibatasi kewajiban itu.
-- 2. **Penyalahgunaannya berbentuk PEMBACAAN**, bukan penulisan: membuka data
--    tetangga, menyalin daftar penerima bantuan menjelang pemilihan. Karena itu
--    ada `village_resident_access_log`, yang tidak punya padanan di modul lain.
-- 3. **Kerugiannya tidak dapat dipulihkan.** NIK yang bocor tidak dapat diganti
--    seperti kata sandi.

-- ---------------------------------------------------------------------------
-- Kartu keluarga
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_family (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  family_card_no    VARCHAR(24),
  address           TEXT,
  village_rt_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_rt (id) ON DELETE SET NULL,
  postal_code       VARCHAR(10),
  -- Klasifikasi kesejahteraan. Golongan sangat sensitif: menentukan kelayakan
  -- bantuan, dan bocornya menimbulkan kecemburuan antar tetangga.
  welfare_status    VARCHAR(24),
  house_ownership   VARCHAR(24),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1
);

-- Nomor KK unik PER PENYEWA, bukan global. Satu desa tidak berhak menghalangi
-- desa lain memakai nomor yang sama — dan nomor KK yang tercetak kembar pada
-- kartu sungguhan memang ada.
CREATE UNIQUE INDEX IF NOT EXISTS village_family_card_no_unique
  ON "{{TENANT_SCHEMA}}".village_family (family_card_no)
  WHERE family_card_no IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_family_rt_idx
  ON "{{TENANT_SCHEMA}}".village_family (village_rt_id);

-- ---------------------------------------------------------------------------
-- Penduduk
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_resident (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_family_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_family (id) ON DELETE SET NULL,
  family_relation   VARCHAR(24),

  national_id       VARCHAR(24),
  -- Ditandai, bukan ditolak. NIK yang tercetak keliru pada KTP sungguhan ada,
  -- dan warga pemiliknya tetap berhak dilayani desanya. Menolaknya akan memaksa
  -- petugas mengarang NIK lain agar datanya dapat masuk — dan data karangan
  -- lebih buruk daripada data yang ditandai janggal.
  national_id_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  national_id_notes TEXT,

  full_name         VARCHAR(200) NOT NULL,
  -- Dipakai membandingkan nama tanpa gelar saat menandai duplikat.
  normalized_name   VARCHAR(200),
  birth_place       VARCHAR(120),
  birth_date        DATE,
  gender            VARCHAR(1),
  religion          VARCHAR(40),
  marital_status    VARCHAR(24),
  education         VARCHAR(60),
  occupation        VARCHAR(120),
  blood_type        VARCHAR(4),
  citizenship       VARCHAR(40) NOT NULL DEFAULT 'WNI',

  mother_name       VARCHAR(200),
  father_name       VARCHAR(200),

  village_rt_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_rt (id) ON DELETE SET NULL,
  address           TEXT,
  phone             VARCHAR(40),
  email             VARCHAR(160),

  resident_status   VARCHAR(24) NOT NULL DEFAULT 'TETAP',

  -- Golongan sangat sensitif. Hak akses tersendiri; tidak muncul pada daftar
  -- umum, dan tidak pernah masuk prompt AI.
  disability_type   VARCHAR(60),
  social_condition  VARCHAR(60),
  is_vulnerable     BOOLEAN NOT NULL DEFAULT FALSE,

  photo_file_id     UUID,
  is_sample         BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id   UUID,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  delete_reason     TEXT,
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_resident_gender_valid CHECK (gender IS NULL OR gender IN ('L', 'P')),
  CONSTRAINT village_resident_status_valid
    CHECK (resident_status IN ('TETAP', 'TIDAK_TETAP', 'PINDAH', 'MENINGGAL', 'HILANG')),
  CONSTRAINT village_resident_marital_valid
    CHECK (marital_status IS NULL OR marital_status IN
      ('BELUM_KAWIN', 'KAWIN', 'CERAI_HIDUP', 'CERAI_MATI')),
  CONSTRAINT village_resident_relation_valid
    CHECK (family_relation IS NULL OR family_relation IN
      ('KEPALA_KELUARGA', 'SUAMI', 'ISTRI', 'ANAK', 'MENANTU', 'CUCU',
       'ORANGTUA', 'MERTUA', 'FAMILI_LAIN', 'PEMBANTU', 'LAINNYA')),
  -- Enam belas digit angka. Yang JANGGAL tetap diterima; yang bukan angka atau
  -- salah panjang ditolak, sebab itu pasti kesalahan pengetikan.
  CONSTRAINT village_resident_nik_shape
    CHECK (national_id IS NULL OR national_id ~ '^[0-9]{16}$')
);

-- NIK unik PER PENYEWA. Bukan global: warga yang pindah antar desa akan
-- tercatat pada keduanya untuk sementara, dan keunikan global akan menghalangi
-- desa tujuan mendata kedatangannya.
CREATE UNIQUE INDEX IF NOT EXISTS village_resident_nik_unique
  ON "{{TENANT_SCHEMA}}".village_resident (national_id)
  WHERE national_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_resident_family_idx
  ON "{{TENANT_SCHEMA}}".village_resident (village_family_id);
CREATE INDEX IF NOT EXISTS village_resident_rt_idx
  ON "{{TENANT_SCHEMA}}".village_resident (village_rt_id);
CREATE INDEX IF NOT EXISTS village_resident_name_idx
  ON "{{TENANT_SCHEMA}}".village_resident (normalized_name);
CREATE INDEX IF NOT EXISTS village_resident_status_idx
  ON "{{TENANT_SCHEMA}}".village_resident (resident_status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Riwayat perubahan data penduduk
-- ---------------------------------------------------------------------------
-- Terpisah dari `audit_row_change` generik dengan sengaja. Audit generik
-- menjawab "apa yang berubah"; tabel ini menjawab pertanyaan yang sungguh
-- ditanyakan di kantor desa: "sejak kapan alamatnya begini, dan atas dasar
-- surat apa?" Jawaban itu perlu dapat dibaca petugas, bukan hanya ditelusuri
-- pemeriksa.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_resident_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_resident_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE CASCADE,
  changed_field       VARCHAR(60) NOT NULL,
  old_value           TEXT,
  new_value           TEXT,
  reason              TEXT,
  document_reference  VARCHAR(160),
  effective_date      DATE,
  actor_user_id       UUID,
  active_role_id      UUID,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS village_resident_history_idx
  ON "{{TENANT_SCHEMA}}".village_resident_history (village_resident_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Jejak PEMBACAAN data penduduk
-- ---------------------------------------------------------------------------
-- Tidak punya padanan di modul lain, dan itu disengaja.
--
-- Pada kependudukan, penyalahgunaan berbentuk pembacaan: membuka data
-- tetangga karena penasaran, menyalin daftar penerima bantuan menjelang
-- pemilihan. Audit yang hanya mencatat perubahan tidak akan pernah melihatnya.
--
-- Yang dicatat: siapa, kapan, dalam kapasitas apa, penduduk mana, dari layar
-- mana. Yang TIDAK dicatat: isi datanya — catatan akses tidak boleh menjadi
-- salinan kedua dari data yang dilindunginya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_resident_access_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_resident_id UUID,
  actor_user_id       UUID NOT NULL,
  active_role_id      UUID,
  access_type         VARCHAR(24) NOT NULL,
  surface             VARCHAR(80),
  record_count        INTEGER NOT NULL DEFAULT 1,
  purpose             VARCHAR(120),
  ip_address          VARCHAR(64),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT village_resident_access_type_valid
    CHECK (access_type IN ('DETAIL', 'LIST', 'SEARCH', 'EXPORT', 'PRINT'))
);

CREATE INDEX IF NOT EXISTS village_resident_access_actor_idx
  ON "{{TENANT_SCHEMA}}".village_resident_access_log (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS village_resident_access_resident_idx
  ON "{{TENANT_SCHEMA}}".village_resident_access_log (village_resident_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Peristiwa kependudukan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_vital_event (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE RESTRICT,
  event_type          VARCHAR(24) NOT NULL,
  event_date          DATE NOT NULL,
  event_place         VARCHAR(200),

  -- Kelahiran: bayi belum tentu sudah terdaftar sebagai penduduk saat
  -- dilaporkan. Nama dan orang tua disimpan di sini sampai pendaftarannya
  -- selesai.
  child_name          VARCHAR(200),
  mother_resident_id  UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  father_resident_id  UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,

  -- Kematian dan kepindahan.
  cause_note          TEXT,
  destination_address TEXT,
  origin_address      TEXT,

  document_reference  VARCHAR(160),
  status              VARCHAR(24) NOT NULL DEFAULT 'DILAPORKAN',
  reported_by         UUID,
  reported_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  reject_reason       TEXT,

  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_vital_event_type_valid
    CHECK (event_type IN ('KELAHIRAN', 'KEMATIAN', 'PINDAH_MASUK', 'PINDAH_KELUAR',
                          'PERKAWINAN', 'PERCERAIAN')),
  CONSTRAINT village_vital_event_status_valid
    CHECK (status IN ('DILAPORKAN', 'DISETUJUI', 'DITOLAK')),
  -- Penolakan wajib beralasan. Warga yang laporannya ditolak tanpa keterangan
  -- akan datang kembali menanyakan hal yang sama, dan petugas berikutnya tidak
  -- tahu apa yang harus dijawab.
  CONSTRAINT village_vital_event_reject_needs_reason
    CHECK (status <> 'DITOLAK' OR reject_reason IS NOT NULL),
  -- Peristiwa tidak dapat terjadi di masa depan.
  CONSTRAINT village_vital_event_not_future CHECK (event_date <= CURRENT_DATE + 1)
);

CREATE INDEX IF NOT EXISTS village_vital_event_resident_idx
  ON "{{TENANT_SCHEMA}}".village_vital_event (village_resident_id, event_date DESC);
CREATE INDEX IF NOT EXISTS village_vital_event_type_idx
  ON "{{TENANT_SCHEMA}}".village_vital_event (village_unit_id, event_type, event_date DESC);

-- ---------------------------------------------------------------------------
-- Penandaan duplikat
-- ---------------------------------------------------------------------------
-- Menandai, bukan menolak. Sistem tidak tahu apakah NIK kembar itu salah ketik,
-- pemalsuan, atau kesalahan penerbitan; manusia yang menelusuri.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_resident_duplicate (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_resident_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE CASCADE,
  matched_resident_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE CASCADE,
  reason              VARCHAR(40) NOT NULL,
  confidence          VARCHAR(16) NOT NULL,
  status              VARCHAR(24) NOT NULL DEFAULT 'TERBUKA',
  resolution_note     TEXT,
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT village_resident_duplicate_status_valid
    CHECK (status IN ('TERBUKA', 'BUKAN_DUPLIKAT', 'DIGABUNG', 'DIPERBAIKI')),
  CONSTRAINT village_resident_duplicate_not_self
    CHECK (village_resident_id <> matched_resident_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_resident_duplicate_pair_unique
  ON "{{TENANT_SCHEMA}}".village_resident_duplicate
     (LEAST(village_resident_id, matched_resident_id), GREATEST(village_resident_id, matched_resident_id));

-- ---------------------------------------------------------------------------
-- Dokumen penduduk
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_resident_document (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_resident_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE CASCADE,
  document_type       VARCHAR(48) NOT NULL,
  document_number     VARCHAR(80),
  issued_at           DATE,
  expires_at          DATE,
  file_object_id      UUID,
  note                TEXT,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  deleted_at          TIMESTAMPTZ,
  version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS village_resident_document_idx
  ON "{{TENANT_SCHEMA}}".village_resident_document (village_resident_id, document_type);

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
-- Dipasang oleh migrasi 20260731000007, bukan di sini.
--
-- Berkas ini semula memuat blok pemasangan pemicu yang mencari fungsi bernama
-- `fn_audit_row_change` — nama yang tidak pernah ada. Fungsi audit yang
-- sesungguhnya bernama `audit_row_trigger()` dan tinggal pada skema audit
-- terpisah. Karena blok itu dijaga `IF EXISTS`, ia dilewati tanpa galat, dan
-- tidak satu pun tabel village benar-benar diaudit.
--
-- Blok itu dibuang alih-alih dibetulkan di tempatnya: migrasi ini belum
-- pernah diterapkan pada skema penyewa mana pun, sehingga membetulkannya di
-- sini masih aman. Pemasangannya dipusatkan pada satu migrasi supaya tidak
-- terulang lima kali dengan lima peluang salah ketik.
