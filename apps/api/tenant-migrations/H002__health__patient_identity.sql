-- =========================================================================
-- H002 — IDENTITAS PASIEN
-- =========================================================================
--
-- Dinaikkan dari H-2 ke H-1 dengan sengaja. Setiap konteks sesudahnya menunjuk
-- pasien; membangun janji temu, kunjungan, resep, dan hasil di atas identitas
-- yang belum punya aturan penggandaan berarti menumpuk semuanya pada rekam
-- medis ganda. Mencegahnya berbiaya beberapa hari; memperbaikinya
-- berbulan-bulan, dan sebagiannya tidak dapat diperbaiki.
--
-- MENGAPA PASIEN BUKAN PELANGGAN
--
-- `customer` sudah ada, punya nama, telepon, dan menerima tagihan. Memakainya
-- untuk pasien akan menghemat satu tabel dan merusak segalanya:
--
--   identitas ganda pada pelanggan  → merepotkan
--   identitas ganda pada pasien     → alergi yang tercatat pada satu berkas
--                                     tidak terlihat saat obat diresepkan dari
--                                     berkas lain
--
-- Ditambah: pasien tidak boleh dihapus (retensi hukum), setiap pembacaannya
-- dicatat, riwayat namanya disimpan, dan penggabungannya harus dapat
-- dibatalkan. Tidak satu pun berlaku bagi pelanggan.

-- ---------------------------------------------------------------------------
-- Pasien
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identitas perusahaan: satu orang, satu nilai, berapa pun nomor rekam medis
  -- yang dimilikinya pada fasilitas berbeda. Inilah yang membuat alergi yang
  -- tercatat di klinik A terlihat saat meresepkan di rumah sakit B.
  enterprise_patient_id VARCHAR(64) NOT NULL,

  -- NULLABLE dan searah. Diisi hanya bila pasien menjadi pihak tertagih
  -- (bayar sendiri). Pasien yang ditanggung penjamin tidak punya nilai ini.
  -- Arahnya penting: pasien menunjuk pelanggan, tidak sebaliknya — sebaliknya
  -- akan membuat setiap pelanggan tampak seperti calon pasien.
  customer_id           UUID REFERENCES "{{TENANT_SCHEMA}}".customer (id) ON DELETE SET NULL,

  full_name             VARCHAR(180) NOT NULL,
  -- Nama panggilan dipisahkan supaya sapaan di layar tidak menuntut memotong
  -- nama lengkap, yang sering salah pada nama Indonesia.
  preferred_name        VARCHAR(120),
  birth_date            DATE,
  -- Sebagian pasien tidak tahu tanggal lahirnya. Menolak pendaftaran karena itu
  -- akan menghalangi perawatan; menebaknya akan merusak perhitungan dosis anak.
  birth_date_estimated  BOOLEAN NOT NULL DEFAULT FALSE,
  birth_place           VARCHAR(120),
  gender                VARCHAR(16),
  blood_type            VARCHAR(8),
  marital_status        VARCHAR(24),
  religion              VARCHAR(48),
  occupation            VARCHAR(120),
  education             VARCHAR(48),
  nationality           VARCHAR(64),

  phone                 VARCHAR(48),
  email                 VARCHAR(160),
  address_id            UUID REFERENCES "{{TENANT_SCHEMA}}".address (id) ON DELETE SET NULL,
  address_text          TEXT,

  -- Seberapa yakin sistem bahwa baris ini benar-benar satu orang tertentu.
  -- Pendaftaran daring tanpa verifikasi identitas menghasilkan keyakinan
  -- rendah; pencocokan NIK terverifikasi menghasilkan keyakinan tinggi.
  identity_confidence   VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',

  -- Peringatan keselamatan yang harus terlihat sebelum tindakan apa pun:
  -- nama mirip pasien lain di bangsal yang sama, riwayat alergi berat,
  -- kesulitan komunikasi.
  safety_alert          TEXT,

  deceased_at           TIMESTAMPTZ,
  deceased_note         TEXT,

  -- Penggabungan. Baris yang digabungkan TIDAK dihapus — ia ditandai dan
  -- menunjuk induknya, supaya rujukan lama tetap dapat diikuti dan
  -- penggabungannya dapat dibatalkan.
  merged_into_id        UUID REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  merged_at             TIMESTAMPTZ,

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample             BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id       UUID,
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID,
  -- `deleted_at` ADA tetapi pemakaiannya dibatasi retensi hukum dan penahanan
  -- hukum. Pasien tidak dihapus atas permintaan; itu diatur H-9.
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID,
  delete_reason         TEXT,
  version               INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT patient_gender_valid CHECK (
    gender IS NULL OR gender IN ('MALE', 'FEMALE', 'UNKNOWN')
  ),
  CONSTRAINT patient_confidence_valid CHECK (
    identity_confidence IN ('LOW', 'MEDIUM', 'HIGH', 'VERIFIED')
  ),
  CONSTRAINT patient_not_merged_into_self CHECK (merged_into_id IS NULL OR merged_into_id <> id),
  -- Baris yang menunjuk induk wajib punya waktu penggabungan, dan sebaliknya.
  -- Salah satu tanpa yang lain berarti penggabungan setengah jadi yang tidak
  -- dapat dibatalkan maupun diselesaikan.
  CONSTRAINT patient_merge_complete CHECK (
    (merged_into_id IS NULL AND merged_at IS NULL) OR
    (merged_into_id IS NOT NULL AND merged_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_patient_enterprise_id
  ON "{{TENANT_SCHEMA}}".patient (enterprise_patient_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_patient_name ON "{{TENANT_SCHEMA}}".patient (lower(full_name));
CREATE INDEX IF NOT EXISTS ix_patient_birth ON "{{TENANT_SCHEMA}}".patient (birth_date);
CREATE INDEX IF NOT EXISTS ix_patient_phone ON "{{TENANT_SCHEMA}}".patient (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_patient_merged ON "{{TENANT_SCHEMA}}".patient (merged_into_id)
  WHERE merged_into_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Pengenal pasien
-- ---------------------------------------------------------------------------
-- Satu tabel untuk NIK, nomor rekam medis, nomor BPJS, paspor, dan nomor lain.
-- Nomor rekam medis dibedakan `identifier_type = 'MRN'` dan terikat fasilitas —
-- satu pasien memiliki nomor rekam medis berbeda di setiap fasilitas, dan
-- itulah keadaan normal, bukan cacat.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_identifier (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  facility_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,
  identifier_type VARCHAR(24) NOT NULL,
  identifier_value VARCHAR(96) NOT NULL,
  issued_at       DATE,
  valid_until     DATE,
  -- Nomor yang sudah diverifikasi terhadap sumber resmi. NIK yang diketik
  -- petugas berbeda dari NIK yang dicocokkan ke Dukcapil.
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  verified_by     UUID,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT patient_identifier_type_valid CHECK (
    identifier_type IN ('MRN', 'NIK', 'BPJS', 'PASSPORT', 'DRIVING_LICENSE',
                        'BIRTH_CERTIFICATE', 'FAMILY_CARD', 'OTHER')
  ),
  -- Nomor rekam medis wajib menyebut fasilitasnya; tanpa itu ia tidak berarti.
  CONSTRAINT patient_identifier_mrn_needs_facility CHECK (
    identifier_type <> 'MRN' OR facility_id IS NOT NULL
  )
);

-- Satu nomor rekam medis hanya milik satu pasien pada satu fasilitas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_patient_identifier_mrn
  ON "{{TENANT_SCHEMA}}".patient_identifier (facility_id, identifier_value)
  WHERE identifier_type = 'MRN' AND deleted_at IS NULL;

-- NIK hanya boleh menunjuk satu pasien. Ini penjaga penggandaan yang paling
-- kuat yang dapat ditegakkan basis data.
CREATE UNIQUE INDEX IF NOT EXISTS ux_patient_identifier_nik
  ON "{{TENANT_SCHEMA}}".patient_identifier (identifier_value)
  WHERE identifier_type = 'NIK' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_patient_identifier_patient
  ON "{{TENANT_SCHEMA}}".patient_identifier (patient_id, identifier_type);
CREATE INDEX IF NOT EXISTS ix_patient_identifier_lookup
  ON "{{TENANT_SCHEMA}}".patient_identifier (identifier_type, identifier_value);

-- ---------------------------------------------------------------------------
-- Riwayat nama
-- ---------------------------------------------------------------------------
-- Nama berubah — pernikahan, perbaikan ejaan, perubahan resmi. Rekam medis
-- lampau harus tetap dapat ditemukan dengan nama yang dipakai saat itu, dan
-- dokumen yang sudah terbit tidak boleh berubah surut namanya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_name_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  full_name     VARCHAR(180) NOT NULL,
  valid_from    TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until   TIMESTAMPTZ,
  change_reason TEXT,
  changed_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_patient_name_history_patient
  ON "{{TENANT_SCHEMA}}".patient_name_history (patient_id, valid_from DESC);
CREATE INDEX IF NOT EXISTS ix_patient_name_history_name
  ON "{{TENANT_SCHEMA}}".patient_name_history (lower(full_name));

-- ---------------------------------------------------------------------------
-- Dugaan penggandaan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_potential_duplicate (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE CASCADE,
  -- Skor 0..100 beserta alasannya. Alasan disimpan supaya petugas yang menilai
  -- tahu MENGAPA sistem menduga — "nama dan tanggal lahir sama persis" berbeda
  -- jauh dari "nama mirip" dalam hal keyakinan.
  match_score     NUMERIC(5,2) NOT NULL,
  match_reason    JSONB NOT NULL,
  status          VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT patient_duplicate_status_valid CHECK (
    status IN ('OPEN', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'MERGED')
  ),
  CONSTRAINT patient_duplicate_not_self CHECK (patient_id <> candidate_id),
  CONSTRAINT patient_duplicate_score_range CHECK (match_score >= 0 AND match_score <= 100)
);

-- Pasangan yang sama tidak dilaporkan dua kali, dari arah mana pun.
CREATE UNIQUE INDEX IF NOT EXISTS ux_patient_duplicate_pair
  ON "{{TENANT_SCHEMA}}".patient_potential_duplicate
     (LEAST(patient_id, candidate_id), GREATEST(patient_id, candidate_id));

CREATE INDEX IF NOT EXISTS ix_patient_duplicate_open
  ON "{{TENANT_SCHEMA}}".patient_potential_duplicate (status, match_score DESC)
  WHERE status = 'OPEN';

-- ---------------------------------------------------------------------------
-- Riwayat penggabungan
-- ---------------------------------------------------------------------------
-- Penggabungan rekam medis adalah tindakan yang dapat membahayakan bila salah,
-- jadi ia harus dapat dibatalkan. Tabel ini menyimpan apa yang dipindahkan,
-- sehingga pembatalan tahu apa yang harus dikembalikan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".patient_merge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_patient_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  target_patient_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".patient (id) ON DELETE RESTRICT,
  reason          TEXT NOT NULL,
  moved_summary   JSONB,
  merged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  merged_by       UUID,
  unmerged_at     TIMESTAMPTZ,
  unmerged_by     UUID,
  unmerge_reason  TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT patient_merge_not_self CHECK (source_patient_id <> target_patient_id)
);

CREATE INDEX IF NOT EXISTS ix_patient_merge_source
  ON "{{TENANT_SCHEMA}}".patient_merge (source_patient_id);
CREATE INDEX IF NOT EXISTS ix_patient_merge_target
  ON "{{TENANT_SCHEMA}}".patient_merge (target_patient_id);

-- ---------------------------------------------------------------------------
-- Jejak PEMBACAAN rekam medis
-- ---------------------------------------------------------------------------
-- Tidak ada padanannya di inti, dan memang tidak boleh ada: perdagangan tidak
-- mencatat siapa membaca data pelanggan mana.
--
-- Kesehatan wajib. Ancaman yang paling sering terjadi bukan peretasan dari
-- luar, melainkan tenaga kesehatan yang membuka rekam medis orang yang tidak
-- dirawatnya — tetangga, mantan pasangan, orang terkenal. Hak akses berbasis
-- peran tidak menahannya; perawat memang berhak membaca rekam medis.
-- Pertanyaannya rekam medis siapa.
--
-- TERPISAH dari `audit_event` dengan sengaja. Volumenya jauh lebih besar
-- (setiap pembukaan layar menambah baris), retensinya berbeda, dan
-- mencampurnya akan menenggelamkan jejak perubahan di antara jejak pembacaan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_access_log (
  id              BIGSERIAL PRIMARY KEY,
  patient_id      UUID NOT NULL,
  facility_id     UUID,
  actor_user_id   UUID,
  active_role_id  UUID,
  provider_id     UUID,

  -- Tujuan penggunaan. WAJIB, dan inilah yang membuat jejak ini berguna:
  -- "siapa membaca apa" tanpa "untuk apa" tidak dapat dinilai wajar atau tidak.
  purpose_of_use  VARCHAR(24) NOT NULL,

  entity_type     VARCHAR(64) NOT NULL,
  entity_id       UUID,
  action          VARCHAR(24) NOT NULL DEFAULT 'READ',

  -- Akses darurat di luar hubungan perawatan. DIIZINKAN — menolaknya akan
  -- membunuh orang di IGD — tetapi wajib beralasan dan ditelaah petugas mutu.
  break_glass     BOOLEAN NOT NULL DEFAULT FALSE,
  break_glass_reason TEXT,

  ip_address      VARCHAR(64),
  request_id      VARCHAR(96),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT health_access_purpose_valid CHECK (
    purpose_of_use IN ('TREATMENT', 'PAYMENT', 'OPERATIONS', 'QUALITY',
                       'RESEARCH', 'PATIENT_REQUEST', 'LEGAL', 'EMERGENCY')
  ),
  -- Break-glass tanpa alasan tidak dapat ditelaah, dan yang tidak dapat
  -- ditelaah sama saja dengan tidak dicatat.
  CONSTRAINT health_access_breakglass_needs_reason CHECK (
    break_glass = FALSE OR (break_glass_reason IS NOT NULL AND length(trim(break_glass_reason)) >= 10)
  )
);

CREATE INDEX IF NOT EXISTS ix_health_access_patient
  ON "{{TENANT_SCHEMA}}".health_access_log (patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_health_access_actor
  ON "{{TENANT_SCHEMA}}".health_access_log (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_health_access_breakglass
  ON "{{TENANT_SCHEMA}}".health_access_log (occurred_at DESC)
  WHERE break_glass = TRUE;

-- Jejak pembacaan tidak dapat diubah maupun dihapus. Jejak yang dapat disunting
-- oleh pihak yang diaudit tidak membuktikan apa pun ketika benar-benar
-- dibutuhkan.
DROP TRIGGER IF EXISTS trg_health_access_log_immutable ON "{{TENANT_SCHEMA}}".health_access_log;
CREATE TRIGGER trg_health_access_log_immutable
  BEFORE UPDATE OR DELETE ON "{{TENANT_SCHEMA}}".health_access_log
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Jejak audit perubahan
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient', 'patient_identifier', 'patient_potential_duplicate',
                           'patient_merge'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;

-- `patient_name_history` dan `health_access_log` TIDAK diaudit dengan sengaja:
-- keduanya sudah merupakan jejak. Mengaudit jejak menghasilkan jejak atas
-- jejak, yang menggandakan volume tanpa menjawab satu pun pertanyaan baru.
