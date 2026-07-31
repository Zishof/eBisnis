-- =========================================================================
-- VILLAGE D-9 — KEAMANAN, BENCANA, LINGKUNGAN, DAN PERTANAHAN
-- =========================================================================
--
-- ## Sistem ini tidak menggantikan sistem pertanahan nasional
--
-- Yang disimpan adalah catatan desa: penguasaan fisik, riwayat yang diketahui,
-- dan pernyataan batas. Bukan hak atas tanah. Karena itu kolomnya bernama
-- `possessor`, bukan `owner` — nama kolom yang menyatakan kepemilikan membuat
-- sistem mengklaim apa yang justru dinyatakannya tidak dilakukan, dan yang
-- membaca basis data tidak membaca dokumentasi.
--
-- Penyangkalannya wajib ada **di dalam badan suratnya**, dan itu ditegakkan
-- constraint pada teks yang akan tercetak:
--
--     body_text ILIKE '%bukan bukti kepemilikan%'
--     body_text ILIKE '%tidak menggantikan sertifikat%'
--
-- Memeriksanya pada berkas templat tidak cukup: templat dapat disunting,
-- diganti, atau dilewati oleh jalur penerbitan lain. Yang dipegang warga adalah
-- teks yang tercetak, bukan templatnya.
--
-- ## Catatan insiden tidak menyimpan tuduhan sebagai fakta
--
-- Tidak ada kolom untuk nama pelaku, tersangka, maupun terduga. Catatan desa
-- yang menyebut seseorang sebagai pelaku adalah pencemaran nama baik yang
-- menunggu waktu, dan ia tersimpan jauh lebih lama daripada peristiwanya. Yang
-- dicatat: apa yang terjadi, kapan, di mana, siapa yang melaporkan. Bila
-- perkaranya berlanjut, ia dirujuk ke kepolisian beserta nomor laporannya — dan
-- di sanalah nama pihak-pihaknya dicatat, oleh lembaga yang berwenang.
--
-- ## Bantuan bencana tidak menunggu penyaringan kelayakan
--
-- Kebalikan sengaja dari bantuan sosial D-7. Di sana penetapan penerima
-- menuntut verifikasi, dasar tertulis, dan pemeriksaan bantuan ganda. Di sini
-- tidak ada satu pun dari itu, dan tabelnya tidak menyediakan tempatnya:
-- keluarga yang kehilangan rumah pada pukul tiga pagi bukan berkas yang perlu
-- dinilai kelayakannya. Yang tetap dituntut hanyalah pencatatan siapa menerima
-- apa — pertanggungjawaban sesudahnya, bukan syarat sebelumnya.

-- ---------------------------------------------------------------------------
-- Pos keamanan dan Linmas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_security_post (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  address         TEXT,
  sub_area_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_sub_area (id) ON DELETE SET NULL,
  village_rw_id   UUID REFERENCES "{{TENANT_SCHEMA}}".village_rw (id) ON DELETE SET NULL,
  coordinator_name VARCHAR(200),
  phone           VARCHAR(40),
  condition       VARCHAR(16) NOT NULL DEFAULT 'BAIK',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_security_post_condition_valid
    CHECK (condition IN ('BAIK','RUSAK_RINGAN','RUSAK_SEDANG','RUSAK_BERAT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS village_security_post_code_unique
  ON "{{TENANT_SCHEMA}}".village_security_post (village_unit_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_linmas_member (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  resident_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  full_name       VARCHAR(200) NOT NULL,
  phone           VARCHAR(40),
  security_post_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_security_post (id) ON DELETE SET NULL,
  member_number   VARCHAR(48),
  position        VARCHAR(64),
  joined_at       DATE,
  ended_at        DATE,
  training_note   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_linmas_period CHECK (ended_at IS NULL OR joined_at IS NULL OR ended_at >= joined_at),
  -- Anggota yang masa tugasnya berakhir tidak dapat tetap aktif. Daftar Linmas
  -- yang memuat orang yang sudah berhenti akan dipanggil saat keadaan darurat.
  CONSTRAINT village_linmas_ended_not_active CHECK (ended_at IS NULL OR is_active = FALSE)
);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_patrol_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  security_post_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_security_post (id) ON DELETE CASCADE,
  patrol_date     DATE NOT NULL,
  shift_start     TIME NOT NULL,
  shift_end       TIME NOT NULL,
  member_names    TEXT,
  note            TEXT,
  attended        BOOLEAN,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS village_patrol_date_idx
  ON "{{TENANT_SCHEMA}}".village_patrol_schedule (village_unit_id, patrol_date);

-- ---------------------------------------------------------------------------
-- Insiden
-- ---------------------------------------------------------------------------
-- TIDAK ADA kolom untuk nama pelaku, tersangka, maupun terduga. Larangan ini
-- ditegakkan dengan tidak menyediakan kolomnya — kolom yang tidak ada tidak
-- dapat diisi, dan itu jauh lebih kuat daripada kolom yang ada tetapi diberi
-- peringatan pada tampilannya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_incident (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  incident_number VARCHAR(64) NOT NULL,
  incident_type   VARCHAR(32) NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  location_note   TEXT NOT NULL,
  sub_area_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_sub_area (id) ON DELETE SET NULL,
  village_rt_id   UUID REFERENCES "{{TENANT_SCHEMA}}".village_rt (id) ON DELETE SET NULL,

  -- Apa yang terjadi. Bukan siapa yang bersalah.
  description     TEXT NOT NULL,
  estimated_loss  NUMERIC(18,2),
  casualty_count  INTEGER NOT NULL DEFAULT 0,

  -- Pelapor, bukan terlapor. Boleh kosong: laporan anonim tetap mungkin, sama
  -- seperti pengaduan pada D-5.
  reporter_name   VARCHAR(200),
  reporter_phone  VARCHAR(40),
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,

  handled_by      UUID,
  handling_note   TEXT,

  -- Rujukan ke lembaga berwenang. Nomor laporannya wajib: "sudah dilaporkan ke
  -- polisi" tanpa nomornya tidak dapat ditelusuri warga yang menanyakannya enam
  -- bulan kemudian.
  referred_to     VARCHAR(200),
  referral_number VARCHAR(120),
  referred_at     TIMESTAMPTZ,

  status          VARCHAR(16) NOT NULL DEFAULT 'DILAPORKAN',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_incident_type_valid
    CHECK (incident_type IN ('PENCURIAN','PERKELAHIAN','KEBAKARAN','KECELAKAAN',
                             'GANGGUAN_KETERTIBAN','ORANG_HILANG','LAINNYA')),
  CONSTRAINT village_incident_status_valid
    CHECK (status IN ('DILAPORKAN','DITANGANI','DIRUJUK','SELESAI')),
  CONSTRAINT village_incident_casualty_not_negative CHECK (casualty_count >= 0),
  CONSTRAINT village_incident_loss_not_negative
    CHECK (estimated_loss IS NULL OR estimated_loss >= 0),
  -- Laporan anonim benar-benar tidak menyimpan identitas pelapor.
  CONSTRAINT village_incident_anonymous_has_no_reporter
    CHECK (NOT is_anonymous OR (reporter_name IS NULL AND reporter_phone IS NULL)),
  -- Rujukan wajib bernomor.
  CONSTRAINT village_incident_referral_numbered
    CHECK (status <> 'DIRUJUK' OR (btrim(coalesce(referred_to, '')) <> ''
                                   AND btrim(coalesce(referral_number, '')) <> ''))
);

CREATE UNIQUE INDEX IF NOT EXISTS village_incident_number_unique
  ON "{{TENANT_SCHEMA}}".village_incident (village_unit_id, incident_number);

CREATE INDEX IF NOT EXISTS village_incident_occurred_idx
  ON "{{TENANT_SCHEMA}}".village_incident (village_unit_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Kejadian bencana
-- ---------------------------------------------------------------------------
-- Tidak memiliki `deleted_at`, dan itu disengaja. Laporan kejadian naik ke
-- kecamatan dan BPBD serta menjadi dasar penetapan status tanggap darurat;
-- menghapusnya mengubah catatan sejarah yang sudah dipakai pihak lain. Yang
-- salah dikoreksi beserta alasannya, sehingga koreksinya ikut terbaca.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_disaster_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  event_number    VARCHAR(64) NOT NULL,
  disaster_type   VARCHAR(32) NOT NULL,
  occurred_at     DATE NOT NULL,
  ended_at        DATE,
  location_note   TEXT NOT NULL,
  description     TEXT,

  affected_family_count INTEGER NOT NULL DEFAULT 0,
  displaced_count INTEGER NOT NULL DEFAULT 0,
  casualty_count  INTEGER NOT NULL DEFAULT 0,
  injured_count   INTEGER NOT NULL DEFAULT 0,
  estimated_loss  NUMERIC(18,2),

  emergency_status VARCHAR(24),
  reported_to     VARCHAR(200),
  report_number   VARCHAR(120),
  reported_at     TIMESTAMPTZ,

  correction_note TEXT,
  corrected_at    TIMESTAMPTZ,
  corrected_by    UUID,

  status          VARCHAR(16) NOT NULL DEFAULT 'BERLANGSUNG',
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_disaster_type_valid
    CHECK (disaster_type IN ('BANJIR','TANAH_LONGSOR','KEBAKARAN','ANGIN_PUTING_BELIUNG',
                             'GEMPA_BUMI','KEKERINGAN','WABAH','LAINNYA')),
  CONSTRAINT village_disaster_status_valid
    CHECK (status IN ('BERLANGSUNG','TANGGAP_DARURAT','PEMULIHAN','SELESAI')),
  CONSTRAINT village_disaster_counts_not_negative
    CHECK (affected_family_count >= 0 AND displaced_count >= 0
           AND casualty_count >= 0 AND injured_count >= 0),
  CONSTRAINT village_disaster_period CHECK (ended_at IS NULL OR ended_at >= occurred_at),
  -- Koreksi wajib beralasan. Angka yang berubah tanpa keterangan membuat
  -- laporan yang sudah naik ke BPBD tidak dapat dijelaskan lagi.
  CONSTRAINT village_disaster_correction_has_note
    CHECK (corrected_at IS NULL OR length(btrim(coalesce(correction_note, ''))) >= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_disaster_event_number_unique
  ON "{{TENANT_SCHEMA}}".village_disaster_event (village_unit_id, event_number);

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_disaster_damage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  disaster_event_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".village_disaster_event (id) ON DELETE RESTRICT,

  damage_category VARCHAR(32) NOT NULL,
  object_name     VARCHAR(300) NOT NULL,
  damage_level    VARCHAR(16) NOT NULL DEFAULT 'RUSAK_RINGAN',
  quantity        NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit            VARCHAR(32),
  estimated_value NUMERIC(18,2),
  -- Keluarga terdampak, bila kerusakannya menimpa rumah tertentu.
  family_id       UUID REFERENCES "{{TENANT_SCHEMA}}".village_family (id) ON DELETE SET NULL,
  location_note   TEXT,
  photo_path      VARCHAR(500),

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_damage_category_valid
    CHECK (damage_category IN ('RUMAH','FASILITAS_UMUM','JALAN','JEMBATAN','IRIGASI',
                               'LAHAN_PERTANIAN','TERNAK','LAINNYA')),
  CONSTRAINT village_damage_level_valid
    CHECK (damage_level IN ('RUSAK_RINGAN','RUSAK_SEDANG','RUSAK_BERAT','HANCUR')),
  CONSTRAINT village_damage_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS village_damage_event_idx
  ON "{{TENANT_SCHEMA}}".village_disaster_damage (disaster_event_id, damage_category);

-- ---------------------------------------------------------------------------
-- Logistik bantuan bencana
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_relief_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  unit            VARCHAR(32) NOT NULL DEFAULT 'paket',
  category        VARCHAR(32) NOT NULL DEFAULT 'PANGAN',
  stock_quantity  NUMERIC(14,2) NOT NULL DEFAULT 0,
  storage_location VARCHAR(200),
  expiry_date     DATE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_relief_category_valid
    CHECK (category IN ('PANGAN','SANDANG','OBAT','PERALATAN','HUNIAN','LAINNYA')),
  -- Stok tidak pernah negatif. Gudang yang menampilkan minus dua puluh paket
  -- membuat petugas berhenti mempercayai seluruh angkanya.
  CONSTRAINT village_relief_stock_not_negative CHECK (stock_quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_relief_item_code_unique
  ON "{{TENANT_SCHEMA}}".village_relief_item (village_unit_id, code) WHERE deleted_at IS NULL;

-- Penyaluran bantuan bencana.
--
-- Perhatikan apa yang TIDAK ada di sini: tidak ada `candidate_id`, tidak ada
-- `verified_by`, tidak ada `decision_basis`, tidak ada pemeriksaan bantuan
-- ganda. Seluruhnya ada pada bantuan sosial D-7 dan sengaja tidak ada di sini.
-- Yang tetap dituntut hanyalah nama penerimanya.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_relief_distribution (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  disaster_event_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_disaster_event (id) ON DELETE SET NULL,
  relief_item_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_relief_item (id) ON DELETE RESTRICT,

  quantity        NUMERIC(14,2) NOT NULL,
  distributed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_name  VARCHAR(200) NOT NULL,
  recipient_family_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_family (id) ON DELETE SET NULL,
  location_note   TEXT,
  distributed_by  UUID,
  note            TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_relief_distribution_quantity_positive CHECK (quantity > 0),
  CONSTRAINT village_relief_distribution_recipient_named
    CHECK (btrim(recipient_name) <> '')
);

CREATE INDEX IF NOT EXISTS village_relief_distribution_event_idx
  ON "{{TENANT_SCHEMA}}".village_relief_distribution (disaster_event_id, distributed_at);

-- ---------------------------------------------------------------------------
-- Infrastruktur
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_infrastructure (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  code            VARCHAR(48) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  infra_type      VARCHAR(32) NOT NULL,
  description     TEXT,
  location_note   TEXT,
  sub_area_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_sub_area (id) ON DELETE SET NULL,
  length_m        NUMERIC(12,2),
  width_m         NUMERIC(10,2),
  built_year      INTEGER,

  -- Kondisi dan tanggal penilaiannya tidak dapat dipisahkan. Kondisi tanpa
  -- tanggal adalah pernyataan yang tidak pernah kedaluwarsa: "jalan rusak
  -- berat" akan tetap ada di RKP tiga tahun setelah jalannya diaspal, dan
  -- anggaran akan mengikuti pernyataan itu, bukan mengikuti jalannya.
  condition       VARCHAR(16),
  condition_assessed_at DATE,
  village_asset_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_asset (id) ON DELETE SET NULL,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_infra_type_valid
    CHECK (infra_type IN ('JALAN','JEMBATAN','DRAINASE','IRIGASI','AIR_BERSIH','SANITASI',
                          'LISTRIK','GEDUNG','LAINNYA')),
  CONSTRAINT village_infra_condition_valid
    CHECK (condition IS NULL OR condition IN ('BAIK','RUSAK_RINGAN','RUSAK_SEDANG','RUSAK_BERAT')),
  CONSTRAINT village_infra_condition_dated
    CHECK (condition IS NULL OR condition_assessed_at IS NOT NULL),
  CONSTRAINT village_infra_dimensions_positive
    CHECK ((length_m IS NULL OR length_m > 0) AND (width_m IS NULL OR width_m > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS village_infra_code_unique
  ON "{{TENANT_SCHEMA}}".village_infrastructure (village_unit_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_infrastructure_inspection (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  infrastructure_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".village_infrastructure (id) ON DELETE CASCADE,

  inspected_at    DATE NOT NULL,
  condition       VARCHAR(16) NOT NULL,
  finding         TEXT NOT NULL,
  recommendation  TEXT,
  estimated_cost  NUMERIC(18,2),
  inspector_name  VARCHAR(200),
  photo_path      VARCHAR(500),

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_infra_inspection_condition_valid
    CHECK (condition IN ('BAIK','RUSAK_RINGAN','RUSAK_SEDANG','RUSAK_BERAT')),
  CONSTRAINT village_infra_inspection_cost_not_negative
    CHECK (estimated_cost IS NULL OR estimated_cost >= 0)
);

CREATE INDEX IF NOT EXISTS village_infra_inspection_idx
  ON "{{TENANT_SCHEMA}}".village_infrastructure_inspection (infrastructure_id, inspected_at DESC);

-- ---------------------------------------------------------------------------
-- Bidang tanah
-- ---------------------------------------------------------------------------
-- `possessor`, bukan `owner`. Yang dicatat penguasaan fisik menurut administrasi
-- desa — bukan hak atas tanah, yang hanya dapat dinyatakan Badan Pertanahan
-- Nasional.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_land_parcel (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  parcel_code     VARCHAR(64) NOT NULL,
  -- Nomor Letter C / Persil / Kohir pada buku desa.
  letter_c_number VARCHAR(64),
  persil_number   VARCHAR(64),

  possessor_name  VARCHAR(200) NOT NULL,
  possessor_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  possession_type VARCHAR(24) NOT NULL DEFAULT 'MILIK_ADAT',

  area_m2         NUMERIC(14,2) NOT NULL,
  land_use        VARCHAR(48),
  address         TEXT,
  sub_area_id     UUID REFERENCES "{{TENANT_SCHEMA}}".village_sub_area (id) ON DELETE SET NULL,
  village_rt_id   UUID REFERENCES "{{TENANT_SCHEMA}}".village_rt (id) ON DELETE SET NULL,
  boundary_north  VARCHAR(300),
  boundary_south  VARCHAR(300),
  boundary_east   VARCHAR(300),
  boundary_west   VARCHAR(300),
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),

  certificate_status VARCHAR(24) NOT NULL DEFAULT 'BELUM_BERSERTIFIKAT',
  certificate_number VARCHAR(120),
  tax_object_number VARCHAR(64),

  note            TEXT,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_land_possession_valid
    CHECK (possession_type IN ('MILIK_ADAT','GARAPAN','SEWA','TANAH_KAS_DESA','TANAH_BENGKOK',
                               'WAKAF','LAINNYA')),
  CONSTRAINT village_land_certificate_status_valid
    CHECK (certificate_status IN ('BELUM_BERSERTIFIKAT','BERSERTIFIKAT','DALAM_PROSES')),
  CONSTRAINT village_land_area_positive CHECK (area_m2 > 0),
  -- Bertanda bersertifikat wajib menyebut nomornya, dan sebaliknya. Tanpa
  -- nomornya, catatan desa tidak dapat dicocokkan dengan data pertanahan
  -- nasional — dan pencocokan itulah satu-satunya cara perbedaan diselesaikan.
  CONSTRAINT village_land_certificate_consistent
    CHECK (
      (certificate_status = 'BERSERTIFIKAT' AND btrim(coalesce(certificate_number, '')) <> '')
      OR (certificate_status <> 'BERSERTIFIKAT' AND coalesce(btrim(certificate_number), '') = '')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS village_land_parcel_code_unique
  ON "{{TENANT_SCHEMA}}".village_land_parcel (village_unit_id, parcel_code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS village_land_possessor_idx
  ON "{{TENANT_SCHEMA}}".village_land_parcel (possessor_resident_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Riwayat peralihan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_land_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  land_parcel_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_land_parcel (id) ON DELETE RESTRICT,

  transfer_type   VARCHAR(24) NOT NULL,
  transferred_at  DATE NOT NULL,
  from_name       VARCHAR(200) NOT NULL,
  to_name         VARCHAR(200) NOT NULL,
  -- Nomor akta, kutipan Letter C, atau bukti lain. WAJIB: riwayat tanpa dasar
  -- adalah daftar nama yang berurutan — tampak seperti bukti, tetapi tidak
  -- membuktikan apa pun, dan justru bentuk itulah yang paling sering dibawa ke
  -- pengadilan.
  legal_basis     VARCHAR(300) NOT NULL,
  area_m2         NUMERIC(14,2),
  note            TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_land_transfer_type_valid
    CHECK (transfer_type IN ('JUAL_BELI','WARIS','HIBAH','TUKAR_MENUKAR','WAKAF','LAINNYA')),
  CONSTRAINT village_land_history_basis_present CHECK (btrim(legal_basis) <> ''),
  CONSTRAINT village_land_history_parties_differ CHECK (btrim(from_name) <> btrim(to_name))
);

CREATE INDEX IF NOT EXISTS village_land_history_parcel_idx
  ON "{{TENANT_SCHEMA}}".village_land_history (land_parcel_id, transferred_at DESC);

-- ---------------------------------------------------------------------------
-- Persetujuan batas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_land_boundary_consent (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  land_parcel_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_land_parcel (id) ON DELETE CASCADE,

  side            VARCHAR(16) NOT NULL,
  neighbour_name  VARCHAR(200) NOT NULL,
  neighbour_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  neighbour_parcel_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_land_parcel (id) ON DELETE SET NULL,

  consented       BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at    DATE,
  objection_note  TEXT,
  witness_name    VARCHAR(200),

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_land_consent_side_valid CHECK (side IN ('UTARA','SELATAN','TIMUR','BARAT')),
  CONSTRAINT village_land_consent_dated CHECK (NOT consented OR consented_at IS NOT NULL),
  -- Keberatan wajib diuraikan. Tetangga yang menolak tanpa keterangan tidak
  -- meninggalkan apa pun yang dapat dimusyawarahkan.
  CONSTRAINT village_land_consent_objection_explained
    CHECK (consented OR objection_note IS NULL OR length(btrim(objection_note)) >= 5),
  CONSTRAINT village_land_consent_not_self
    CHECK (neighbour_parcel_id IS NULL OR neighbour_parcel_id <> land_parcel_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_land_consent_side_unique
  ON "{{TENANT_SCHEMA}}".village_land_boundary_consent (land_parcel_id, side);

-- ---------------------------------------------------------------------------
-- Surat keterangan tanah
-- ---------------------------------------------------------------------------
-- Constraint di bawah adalah inti seluruh D-9.
--
-- Penyangkalan diperiksa pada `body_text` — teks yang akan tercetak — bukan
-- pada berkas templat. Templat yang benar tidak menjamin surat yang benar:
-- templat dapat disunting, diganti, atau dilewati oleh jalur penerbitan lain.
-- Yang dipegang warga adalah teks yang tercetak.
--
-- Dua frasa diwajibkan, dan keduanya menjawab pertanyaan yang benar-benar
-- ditanyakan orang saat memegang surat keterangan tanah: "ini bukti milik saya,
-- kan?" dan "berarti saya tidak perlu sertifikat, kan?"
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_land_statement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  land_parcel_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_land_parcel (id) ON DELETE RESTRICT,
  village_letter_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_letter (id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_service_request (id) ON DELETE SET NULL,

  statement_number VARCHAR(64) NOT NULL,
  issued_at       DATE NOT NULL,
  valid_until     DATE,

  possessor_name  VARCHAR(200) NOT NULL,
  purpose         VARCHAR(300),

  -- Dicuplik saat penerbitan. Bidang yang kemudian bersertifikat tidak membuat
  -- surat lama menjadi salah — ia membuat surat lama menjadi riwayat.
  certificate_status_at_issue VARCHAR(24) NOT NULL,
  neighbour_count INTEGER NOT NULL DEFAULT 0,
  consent_count   INTEGER NOT NULL DEFAULT 0,

  body_text       TEXT NOT NULL,

  is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at      TIMESTAMPTZ,
  revoke_reason   TEXT,

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  -- INTI D-9. Penyangkalan wajib terbaca di dalam suratnya sendiri.
  CONSTRAINT village_land_statement_disclaims_ownership
    CHECK (body_text ILIKE '%bukan bukti kepemilikan%'),
  CONSTRAINT village_land_statement_disclaims_certificate
    CHECK (body_text ILIKE '%tidak menggantikan sertifikat%'),

  -- Tanah bersertifikat tidak diberi surat keterangan desa. Sertifikatnya sudah
  -- menjawab pertanyaan yang hendak dijawab surat ini, dan dua kertas atas satu
  -- bidang adalah cara sengketa dimulai.
  CONSTRAINT village_land_statement_not_for_certified
    CHECK (certificate_status_at_issue <> 'BERSERTIFIKAT'),
  CONSTRAINT village_land_statement_cert_status_valid
    CHECK (certificate_status_at_issue IN ('BELUM_BERSERTIFIKAT','DALAM_PROSES')),

  -- Persetujuan batas wajib lengkap. Surat yang terbit tanpa persetujuan batas
  -- memindahkan sengketa dari kantor desa ke pengadilan, dengan kertas resmi di
  -- tangan satu pihak.
  CONSTRAINT village_land_statement_consent_complete
    CHECK (neighbour_count >= 0 AND consent_count >= neighbour_count),

  CONSTRAINT village_land_statement_revoke_needs_reason
    CHECK (NOT is_revoked OR length(btrim(coalesce(revoke_reason, ''))) >= 5),
  CONSTRAINT village_land_statement_validity CHECK (valid_until IS NULL OR valid_until >= issued_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_land_statement_number_unique
  ON "{{TENANT_SCHEMA}}".village_land_statement (village_unit_id, statement_number);

-- Satu bidang, satu surat yang berlaku. Dua surat yang sama-sama berlaku atas
-- bidang yang sama adalah keadaan yang tidak dapat dijelaskan kepada siapa pun.
CREATE UNIQUE INDEX IF NOT EXISTS village_land_statement_one_active
  ON "{{TENANT_SCHEMA}}".village_land_statement (land_parcel_id)
  WHERE is_revoked = FALSE;

-- ---------------------------------------------------------------------------
-- Pemicu audit
-- ---------------------------------------------------------------------------
DO $install$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi audit tidak ada; pemicu audit D-9 dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}' AND c.relkind = 'r'
       AND c.relname IN (
         'village_security_post', 'village_linmas_member', 'village_incident',
         'village_disaster_event', 'village_disaster_damage', 'village_relief_item',
         'village_relief_distribution', 'village_infrastructure',
         'village_infrastructure_inspection', 'village_land_parcel',
         'village_land_history', 'village_land_boundary_consent', 'village_land_statement'
       )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I',
      r.table_name, '{{TENANT_SCHEMA}}'
    );
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      r.table_name, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END
$install$;
