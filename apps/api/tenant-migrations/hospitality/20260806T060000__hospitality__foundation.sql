-- =========================================================================
-- MitraInap (Hospitality) — Fondasi: properti, tipe kamar, dan kamar
-- =========================================================================
--
-- MI-5 pada docs/mitrainap/16-implementation-plan.md. Prasyarat mutlak
-- seluruh modul hospitality lain: ketersediaan (MI-6), reservasi (MI-8),
-- front office (MI-12), dan seterusnya tidak punya pijakan tanpa properti
-- dan kamar.
--
-- Nama tabel berawalan `hospitality_`, mengikuti pola `pesantren_` --
-- schema tetap satu per penyewa (bukan satu per modul).
--
-- Sengaja HANYA properti/tipe kamar/kamar (bukan portofolio, badan hukum,
-- gedung, lantai, zona penuh seperti disebut BRD §Property Foundation).
-- Hierarki penuh itu belum dibutuhkan satu pun layar -- menambahkannya
-- sekarang berarti tabel tanpa pemakai, persis larangan §6 perintah master
-- ("jangan membangun untuk kebutuhan hipotetis"). Kolom `alamat` menampung
-- kebutuhan properti tunggal sederhana; badan hukum/gedung/lantai/zona
-- ditambahkan saat tenant multi-properti/multi-gedung sungguhan on-board.
--
-- "Active property/role/context" (BRD) BELUM diimplementasi sebagai
-- mekanisme sesi/JWT terpisah -- untuk penyewa dengan SATU properti
-- (kasus awal), properti itu implisit aktif. Pemilih konteks multi-properti
-- menyusul saat penyewa multi-properti sungguhan ada.

-- ---------------------------------------------------------------------------
-- hospitality_property
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_property (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  timezone        VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
  -- Tanggal operasional properti. BERBEDA dari tanggal kalender -- night
  -- audit (MI-16) yang memajukannya, bukan tengah malam server. Sampai
  -- MI-16 ada, kolom ini mengikuti tanggal kalender pada zona waktu properti.
  business_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  address         TEXT,
  status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',

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
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_property_code
  ON "{{TENANT_SCHEMA}}".hospitality_property (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_hospitality_property_active
  ON "{{TENANT_SCHEMA}}".hospitality_property (is_active, deleted_at);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_property
  ADD CONSTRAINT ck_hospitality_property_status
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- ---------------------------------------------------------------------------
-- hospitality_room_type
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_room_type (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property (id) ON DELETE RESTRICT,
  code            VARCHAR(32) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  max_occupancy   INTEGER NOT NULL DEFAULT 2,
  description     TEXT,

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
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_room_type_code
  ON "{{TENANT_SCHEMA}}".hospitality_room_type (property_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_hospitality_room_type_property
  ON "{{TENANT_SCHEMA}}".hospitality_room_type (property_id, deleted_at);

-- Okupansi maksimum nol/negatif membuat kamar tipe itu tidak dapat dijual
-- sama sekali tanpa satu pun pesan galat yang menjelaskan sebabnya.
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_type
  ADD CONSTRAINT ck_hospitality_room_type_okupansi
  CHECK (max_occupancy > 0);

-- ---------------------------------------------------------------------------
-- hospitality_room
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_room (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Didenormalisasi dari room_type demi penyaringan langsung per properti
  -- (RBAC data-scope OUTLET-setara akan menunjuk kolom ini), sama seperti
  -- `pesantren_santri.unit_pendidikan_id` menunjuk unit, bukan lewat join.
  property_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property (id) ON DELETE RESTRICT,
  room_type_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room_type (id) ON DELETE RESTRICT,
  room_number     VARCHAR(16) NOT NULL,
  floor           VARCHAR(16),
  -- Status ADMINISTRATIF kamar (dapat dijual sama sekali atau tidak).
  -- BUKAN ketersediaan per tanggal -- itu ledger tersendiri, milik MI-6.
  -- Kamar berstatus AVAILABLE di sini masih bisa terisi pada tanggal
  -- tertentu; ledger MI-6 yang menjawab pertanyaan itu.
  status          VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',

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
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_room_nomor
  ON "{{TENANT_SCHEMA}}".hospitality_room (property_id, room_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_hospitality_room_type
  ON "{{TENANT_SCHEMA}}".hospitality_room (room_type_id, deleted_at);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room
  ADD CONSTRAINT ck_hospitality_room_status
  CHECK (status IN ('AVAILABLE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'BLOCKED'));
