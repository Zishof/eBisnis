-- =========================================================================
-- VILLAGE D-3 — APARATUR, MASA JABATAN, REGISTER, DAN CAKUPAN DATA
-- =========================================================================
--
-- Fase ini menutup celah yang disebut terbuka pada D-2: cakupan data belum
-- tersambung, sehingga Ketua RT masih melihat seluruh desa.
--
-- ## Mengapa ada `village_scope_assignment` tersendiri
--
-- Core sudah punya `user_scope_assignment`, dan village lebih suka memakainya.
-- Tetapi `ck_user_scope_type` membatasi jenis cakupan pada daftar tertutup:
--
--   PLATFORM, TENANT, LEGAL_ENTITY, BRAND, STORE, OUTLET, OUTLET_TERMINAL,
--   WAREHOUSE, FULFILLMENT_LOCATION, DEPARTMENT, TEAM, SELF, ASSIGNED_TRIP,
--   ASSIGNED_QUEUE, OWNERSHIP, API_SCOPE, PAYMENT_PROVIDER_ACCOUNT
--
-- Tidak ada dusun, RW, maupun RT — dan memang tidak seharusnya ada: itu
-- kosakata pemerintahan desa, bukan kosakata perdagangan. Menambahkannya
-- berarti mengubah constraint pada tabel bersama, yang perintah §3 larang
-- dilakukan langsung dari cabang vertikal.
--
-- Village karena itu memakai tabelnya sendiri, dengan bentuk yang sengaja
-- dibuat sama persis supaya penggabungannya kelak murah. Integration request
-- 003 meminta Core memperluas constraint-nya, persis seperti V012 dahulu
-- memperluas `ck_role_module_profile_code` untuk marketplace.

-- ---------------------------------------------------------------------------
-- Aparatur
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_officer (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  -- Aparatur adalah penduduk. Tidak menyalin nama dan NIK-nya ke sini: data
  -- yang disalin akan berbeda dari sumbernya begitu salah satunya diperbarui.
  village_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  -- Untuk aparatur yang bukan penduduk desa ini — Lurah kerap demikian, sebab
  -- ia pegawai negeri yang ditugaskan, bukan warga yang dipilih.
  external_name       VARCHAR(200),
  external_id_number  VARCHAR(24),

  user_subject_id     UUID,
  position_code       VARCHAR(48) NOT NULL,
  position_name       VARCHAR(160) NOT NULL,
  employment_type     VARCHAR(24) NOT NULL DEFAULT 'PERANGKAT',
  echelon             INTEGER,
  phone               VARCHAR(40),
  email               VARCHAR(160),
  photo_file_id       UUID,

  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID,
  delete_reason       TEXT,
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_officer_employment_valid
    CHECK (employment_type IN ('PERANGKAT', 'PNS_DITUGASKAN', 'BPD', 'RT_RW', 'LINMAS', 'KADER', 'LAINNYA')),
  -- Harus jelas siapa orangnya: penduduk terdaftar, atau nama yang dituliskan.
  -- Aparatur tanpa identitas adalah baris yang tidak dapat dipertanggungjawabkan.
  CONSTRAINT village_officer_identity_present
    CHECK (village_resident_id IS NOT NULL OR external_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS village_officer_unit_idx
  ON "{{TENANT_SCHEMA}}".village_officer (village_unit_id, position_code);
CREATE INDEX IF NOT EXISTS village_officer_subject_idx
  ON "{{TENANT_SCHEMA}}".village_officer (user_subject_id) WHERE user_subject_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Masa jabatan
-- ---------------------------------------------------------------------------
-- Terpisah dari `village_officer` dengan sengaja. Satu orang dapat menjabat
-- lebih dari sekali, dan riwayat jabatannya adalah bagian dari arsip desa.
-- Menyimpannya sebagai kolom pada aparatur akan menghapus periode sebelumnya
-- setiap kali ia dilantik kembali.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_officer_term (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_officer_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE CASCADE,
  term_number         INTEGER,
  start_date          DATE NOT NULL,
  end_date            DATE,
  appointment_decree  VARCHAR(160),
  appointment_date    DATE,
  dismissal_decree    VARCHAR(160),
  dismissal_reason    TEXT,
  status              VARCHAR(24) NOT NULL DEFAULT 'AKTIF',
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_officer_term_status_valid
    CHECK (status IN ('AKTIF', 'BERAKHIR', 'DIBERHENTIKAN', 'CUTI')),
  CONSTRAINT village_officer_term_period CHECK (end_date IS NULL OR end_date >= start_date),
  -- Pemberhentian wajib menyebutkan sebabnya. Aparatur yang berhenti tanpa
  -- keterangan meninggalkan pertanyaan yang tidak dapat dijawab arsip desa.
  CONSTRAINT village_officer_term_dismissal_needs_reason
    CHECK (status <> 'DIBERHENTIKAN' OR dismissal_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS village_officer_term_officer_idx
  ON "{{TENANT_SCHEMA}}".village_officer_term (village_officer_id, start_date DESC);

-- Satu jabatan aktif per aparatur pada satu waktu.
CREATE UNIQUE INDEX IF NOT EXISTS village_officer_term_active_unique
  ON "{{TENANT_SCHEMA}}".village_officer_term (village_officer_id)
  WHERE status = 'AKTIF';

-- ---------------------------------------------------------------------------
-- BPD
-- ---------------------------------------------------------------------------
-- Hanya bermakna bagi profil DESA. Kelayakannya ditegakkan layanan; tabelnya
-- tetap dibuat pada kedua profil supaya migrasi tidak bercabang — skema yang
-- bercabang menurut data adalah skema yang tidak dapat diperiksa sebagai satu.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_bpd_member (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  village_officer_id  UUID REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE SET NULL,
  village_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  member_name         VARCHAR(200) NOT NULL,
  bpd_position        VARCHAR(48) NOT NULL DEFAULT 'ANGGOTA',
  representing_area   VARCHAR(160),
  start_date          DATE NOT NULL,
  end_date            DATE,
  decree_number       VARCHAR(160),
  status              VARCHAR(24) NOT NULL DEFAULT 'AKTIF',
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  version             INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_bpd_position_valid
    CHECK (bpd_position IN ('KETUA', 'WAKIL_KETUA', 'SEKRETARIS', 'ANGGOTA')),
  CONSTRAINT village_bpd_status_valid CHECK (status IN ('AKTIF', 'BERAKHIR', 'DIBERHENTIKAN'))
);

-- Satu ketua BPD pada satu waktu.
CREATE UNIQUE INDEX IF NOT EXISTS village_bpd_chair_unique
  ON "{{TENANT_SCHEMA}}".village_bpd_member (village_unit_id)
  WHERE bpd_position = 'KETUA' AND status = 'AKTIF' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Struktur organisasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_org_node (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  parent_id           UUID REFERENCES "{{TENANT_SCHEMA}}".village_org_node (id) ON DELETE RESTRICT,
  code                VARCHAR(48) NOT NULL,
  name                VARCHAR(160) NOT NULL,
  node_type           VARCHAR(24) NOT NULL DEFAULT 'SEKSI',
  village_officer_id  UUID REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE SET NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  version             INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_org_node_type_valid
    CHECK (node_type IN ('PIMPINAN', 'SEKRETARIAT', 'SEKSI', 'URUSAN', 'KEWILAYAHAN', 'LEMBAGA')),
  -- Simpul tidak boleh menjadi induknya sendiri. Lingkaran yang lebih panjang
  -- diperiksa layanan; yang sepanjang satu ini dapat ditolak di sini.
  CONSTRAINT village_org_node_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_org_node_code_unique
  ON "{{TENANT_SCHEMA}}".village_org_node (village_unit_id, code) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Pelimpahan wewenang
-- ---------------------------------------------------------------------------
-- Kepala Desa cuti, dan sekretaris menandatangani surat atas namanya. Ini
-- terjadi setiap bulan di setiap desa, dan tanpa pencatatan resmi tidak ada
-- yang dapat menjelaskan mengapa surat itu ditandatangani orang lain.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_delegation (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  from_officer_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE RESTRICT,
  to_officer_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_officer (id) ON DELETE RESTRICT,
  scope_note          TEXT NOT NULL,
  decree_number       VARCHAR(160),
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  status              VARCHAR(24) NOT NULL DEFAULT 'AKTIF',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID,
  version             INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT village_delegation_status_valid CHECK (status IN ('AKTIF', 'BERAKHIR', 'DICABUT')),
  -- Pelimpahan wajib berbatas waktu. Yang tidak berujung bukan pelimpahan
  -- melainkan pergantian jabatan, dan itu prosedur yang berbeda.
  CONSTRAINT village_delegation_period CHECK (end_date >= start_date),
  CONSTRAINT village_delegation_not_self CHECK (from_officer_id <> to_officer_id)
);

CREATE INDEX IF NOT EXISTS village_delegation_active_idx
  ON "{{TENANT_SCHEMA}}".village_delegation (village_unit_id, status, start_date, end_date);

-- ---------------------------------------------------------------------------
-- Cakupan data village
-- ---------------------------------------------------------------------------
-- Bentuknya sengaja dibuat sama dengan `user_scope_assignment` milik Core,
-- supaya penggabungannya kelak hanya memindahkan baris. Yang berbeda hanyalah
-- daftar `scope_type` — dusun, RW, dan RT tidak ada pada kosakata Core.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_scope_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subject_id UUID NOT NULL,
  scope_type      VARCHAR(32) NOT NULL,
  -- Menunjuk village_unit, village_sub_area, village_rw, village_rt, atau
  -- village_resident bergantung scope_type. Tanpa foreign key karena satu kolom
  -- menunjuk tabel yang berbeda-beda — sama alasannya dengan Core.
  scope_id        UUID,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID,
  revoke_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_scope_type_valid CHECK (scope_type IN (
    'VILLAGE_UNIT', 'VILLAGE_SUB_AREA', 'VILLAGE_RW', 'VILLAGE_RT',
    'VILLAGE_SELF', 'VILLAGE_AGGREGATE_ONLY', 'VILLAGE_NONE'
  )),
  CONSTRAINT village_scope_period CHECK (valid_until IS NULL OR valid_until > valid_from),
  -- Cakupan yang menunjuk objek wajib menyebutkan objeknya. UNIT, SELF,
  -- AGGREGATE_ONLY, dan NONE tidak memerlukannya.
  CONSTRAINT village_scope_id_required CHECK (
    scope_type IN ('VILLAGE_UNIT', 'VILLAGE_AGGREGATE_ONLY', 'VILLAGE_NONE')
    OR scope_id IS NOT NULL
  )
);

-- Satu penugasan aktif per (pengguna, jenis, objek).
CREATE UNIQUE INDEX IF NOT EXISTS village_scope_active_unique
  ON "{{TENANT_SCHEMA}}".village_scope_assignment
     (user_subject_id, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS village_scope_subject_idx
  ON "{{TENANT_SCHEMA}}".village_scope_assignment (user_subject_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Buku register
-- ---------------------------------------------------------------------------
-- Sebelas jenis register pada spesifikasi §6 memakai satu tabel, dibedakan
-- `register_type`. Sebelas tabel berbentuk sama hanya memperbanyak kode, dan
-- pencarian lintas register menjadi sebelas kueri yang digabung.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_register_entry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,
  register_type       VARCHAR(32) NOT NULL,
  entry_number        VARCHAR(64),
  entry_date          DATE NOT NULL,
  subject             VARCHAR(300) NOT NULL,
  description         TEXT,
  -- Menunjuk dokumen sumbernya bila ada: permohonan layanan, peristiwa
  -- kependudukan, aset, dan seterusnya.
  source_type         VARCHAR(48),
  source_id           UUID,
  village_resident_id UUID REFERENCES "{{TENANT_SCHEMA}}".village_resident (id) ON DELETE SET NULL,
  amount              NUMERIC(18,2),
  note                TEXT,
  recorded_by         UUID,
  is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  delete_reason       TEXT,
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT village_register_type_valid CHECK (register_type IN (
    'UMUM', 'PENDUDUK', 'SURAT_MASUK', 'SURAT_KELUAR', 'KEPUTUSAN',
    'PERATURAN', 'ASET', 'TANAH', 'PEMBANGUNAN', 'BANTUAN', 'TAMU'
  ))
);

CREATE INDEX IF NOT EXISTS village_register_type_idx
  ON "{{TENANT_SCHEMA}}".village_register_entry (village_unit_id, register_type, entry_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS village_register_number_unique
  ON "{{TENANT_SCHEMA}}".village_register_entry (village_unit_id, register_type, entry_number)
  WHERE entry_number IS NOT NULL AND deleted_at IS NULL;

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
