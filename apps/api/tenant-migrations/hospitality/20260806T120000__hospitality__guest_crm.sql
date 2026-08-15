-- =========================================================================
-- MitraInap (Hospitality) — MI-7: Guest Identity, CRM, Consent, Privacy
-- =========================================================================
--
-- Dua bagian:
--   1. hospitality_guest -- profil tunggal ("golden profile") tamu:
--      identitas, kontak, alamat, preferensi, consent pemasaran, dan
--      status do-not-rent (larangan menginap, mis. insiden keamanan).
--   2. hospitality_guest_privacy_request -- catatan permintaan privasi
--      (ekspor data / penghapusan) dan status penyelesaiannya. WAJIB ada
--      jejak permintaan sebelum data benar-benar diubah/dihapus -- tanpa
--      catatan ini, "kami menghapus data atas permintaan Anda" tidak
--      dapat dibuktikan kepada siapa pun, termasuk tamu itu sendiri.
--
-- Sengaja BELUM ADA pada migrasi ini: companion/relationship (tabel
-- pendamping tamu) dan tautan perusahaan/travel agent -- keduanya baru
-- berguna begitu reservasi grup/korporat (MI-18) ada tempat memakainya.
-- Membangunnya sekarang berarti tabel tanpa satu pun pemakai.
--
-- ## Deteksi duplikat
--
-- Dokumen identitas (identifier_type + identifier_number) diberi indeks
-- unik parsial -- ini penjaga KERAS untuk kasus paling jelas (KTP yang
-- sama terdaftar dua kali). Kemiripan nama/telepon TANPA nomor identitas
-- yang sama tidak dapat ditegakkan CHECK/indeks -- itu urusan pencarian
-- di sisi layanan (`cariKemiripan()`, lihat hospitality-guest.service.ts),
-- bukan basis data.
--
-- ## Penggabungan (merge)
--
-- `merged_into_id` menunjuk profil tamu yang menjadi hasil gabungan.
-- Baris sumber TETAP ADA (soft-delete, bukan dihapus fisik) -- riwayat
-- (nanti reservasi, folio) yang pernah menunjuk profil lama tidak boleh
-- kehilangan tempat berpijak begitu saja.

-- ---------------------------------------------------------------------------
-- hospitality_guest
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_guest_code_seq;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_guest (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(24) NOT NULL
                       DEFAULT ('GST-' || LPAD(nextval('"{{TENANT_SCHEMA}}".hospitality_guest_code_seq')::text, 6, '0')),
  full_name           VARCHAR(160) NOT NULL,
  identifier_type     VARCHAR(16),
  identifier_number   VARCHAR(64),
  email               VARCHAR(160),
  phone               VARCHAR(32),
  address             TEXT,
  nationality         VARCHAR(64),
  date_of_birth       DATE,
  preferences         TEXT,

  marketing_consent      BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent_at   TIMESTAMPTZ,

  do_not_rent         BOOLEAN NOT NULL DEFAULT FALSE,
  do_not_rent_reason  TEXT,

  -- Menunjuk profil hasil gabungan bila baris ini sudah digabung ke sana.
  -- NULL berarti profil ini masih berdiri sendiri (belum pernah digabung).
  merged_into_id      UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest (id) ON DELETE SET NULL,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_guest_code
  ON "{{TENANT_SCHEMA}}".hospitality_guest (code) WHERE deleted_at IS NULL;

-- Penjaga duplikat KERAS: satu nomor identitas hanya satu profil tamu
-- aktif. NULL (tamu tanpa nomor identitas tercatat, mis. anak-anak pada
-- companion) sengaja tidak ikut diperiksa -- indeks unik mengabaikan NULL.
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_guest_identitas
  ON "{{TENANT_SCHEMA}}".hospitality_guest (identifier_type, identifier_number)
  WHERE deleted_at IS NULL AND identifier_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_hospitality_guest_nama
  ON "{{TENANT_SCHEMA}}".hospitality_guest (full_name, deleted_at);
CREATE INDEX IF NOT EXISTS ix_hospitality_guest_telepon
  ON "{{TENANT_SCHEMA}}".hospitality_guest (phone) WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_guest
  ADD CONSTRAINT ck_hospitality_guest_identifier_type
  CHECK (identifier_type IS NULL OR identifier_type IN ('KTP', 'PASSPORT', 'SIM', 'KITAS', 'OTHER'));

-- Alasan wajib begitu do_not_rent diaktifkan -- larangan menginap tanpa
-- alasan tercatat tidak dapat ditinjau atau dipertanggungjawabkan kelak.
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_guest
  ADD CONSTRAINT ck_hospitality_guest_do_not_rent_alasan
  CHECK (do_not_rent = FALSE OR do_not_rent_reason IS NOT NULL);

-- Profil tidak boleh menggabung ke dirinya sendiri.
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_guest
  ADD CONSTRAINT ck_hospitality_guest_merge_bukan_diri_sendiri
  CHECK (merged_into_id IS NULL OR merged_into_id <> id);

-- ---------------------------------------------------------------------------
-- hospitality_guest_privacy_request
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_guest_privacy_request (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest (id) ON DELETE RESTRICT,
  request_type    VARCHAR(16) NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  notes           TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  delete_reason   TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_hospitality_guest_privacy_request_guest
  ON "{{TENANT_SCHEMA}}".hospitality_guest_privacy_request (guest_id, deleted_at);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_guest_privacy_request
  ADD CONSTRAINT ck_hospitality_guest_privacy_request_type
  CHECK (request_type IN ('EXPORT', 'ERASURE'));

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_guest_privacy_request
  ADD CONSTRAINT ck_hospitality_guest_privacy_request_status
  CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED'));

-- Selesai (atau ditolak) wajib punya waktu penyelesaian; masih tertunda
-- wajib TIDAK punya -- dua kolom yang dapat berselisih tanpa CHECK ini.
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_guest_privacy_request
  ADD CONSTRAINT ck_hospitality_guest_privacy_request_selesai
  CHECK ((status = 'PENDING') = (completed_at IS NULL));
