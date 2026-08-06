-- =========================================================================
-- MitraInap (Hospitality) — MI-10: Rate, Restriction, dan Revenue Management
-- =========================================================================
--
-- Dua bagian:
--   1. hospitality_rate_plan -- rencana harga bernama per tipe kamar
--      (mis. "Best Flexible Rate", "Non-Refundable", "Corporate Rate").
--      Satu tipe kamar boleh punya beberapa rate plan.
--   2. hospitality_rate_calendar -- harga DAN restriksi (MinLOS/MaxLOS/
--      CTA/CTD/stop-sell) SATU baris per rate plan per malam. Digabung
--      jadi satu tabel (bukan dua) sebab keduanya selalu dibaca dan
--      ditulis bersamaan sebagai satu "kalender" -- memisahkannya
--      berarti dua tabel yang harus selalu sinkron per tanggal tanpa
--      penjamin apa pun bahwa keduanya benar-benar sinkron.
--
-- ## Publish approval (status DRAFT/PUBLISHED)
--
-- Baris kalender dibuat DRAFT secara bawaan -- staf dapat menyusun harga
-- untuk periode mendatang tanpa langsung memengaruhi apa yang dilihat
-- pemesan. Booking engine publik (MI-9) HANYA membaca baris berstatus
-- PUBLISHED. `terbitkan()`/`tarik()` (lihat hospitality-rate.service.ts)
-- adalah satu-satunya jalan pindah status. Peran approval TERPISAH
-- (revenue manager berbeda dari yang menyusun draft) SENGAJA belum ada
-- -- HOSPITALITY_ADMIN memegang keduanya untuk saat ini, sama seperti
-- pola "peran sempit menyusul modulnya sendiri" di seluruh vertikal ini.
--
-- ## Mengapa BUKAN rate BERUNTUN (derived rate) yang dihitung otomatis
--
-- BRD meminta "BAR/derived rate" -- harga turunan yang dihitung otomatis
-- dari rate plan lain (mis. Non-Refundable = BAR - 10%). Mesin formula
-- semacam itu adalah fitur tersendiri yang bisa dibangun DI ATAS tabel
-- ini kapan saja (rate plan lain hanya perlu tahu rate plan mana yang
-- jadi rujukan dan formulanya) tanpa migrasi ulang -- staf sekarang
-- mengisi harga tiap rate plan secara langsung, bukan tergantung mesin
-- formula yang belum ada.
--
-- ## Sengaja BELUM ADA: pickup/pace/forecast, rekomendasi
--
-- Keduanya kebutuhan ANALITIK atas volume reservasi historis. Penyewa
-- percontohan hari ini baru punya segelintir reservasi uji -- membangun
-- mesin ramalan permintaan di atas data sebanyak itu akan menghasilkan
-- angka yang terlihat sah tapi sebenarnya rekaan. Ditunda sampai ada
-- volume data sungguhan untuk dianalisis, pola yang sama dengan waitlist
-- (MI-8) dan alur pemulihan keranjang (MI-9) yang ditunda karena alasan
-- serupa.

-- ---------------------------------------------------------------------------
-- hospitality_rate_plan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_rate_plan (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id          UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room_type (id) ON DELETE RESTRICT,
  code                  VARCHAR(32) NOT NULL,
  name                  VARCHAR(120) NOT NULL,
  description           TEXT,
  is_refundable         BOOLEAN NOT NULL DEFAULT TRUE,
  extra_person_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  default_min_los       INTEGER NOT NULL DEFAULT 1,
  default_max_los       INTEGER,
  status                VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',

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

CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_rate_plan_code
  ON "{{TENANT_SCHEMA}}".hospitality_rate_plan (room_type_id, code) WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_rate_plan
  ADD CONSTRAINT ck_hospitality_rate_plan_status
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_rate_plan
  ADD CONSTRAINT ck_hospitality_rate_plan_los
  CHECK (default_min_los > 0 AND (default_max_los IS NULL OR default_max_los >= default_min_los));

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_rate_plan
  ADD CONSTRAINT ck_hospitality_rate_plan_extra_person
  CHECK (extra_person_amount >= 0);

-- ---------------------------------------------------------------------------
-- hospitality_rate_calendar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_rate_calendar (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id        UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_rate_plan (id) ON DELETE RESTRICT,
  stay_date           DATE NOT NULL,
  amount              NUMERIC(14, 2) NOT NULL,
  min_los             INTEGER,
  max_los             INTEGER,
  closed_to_arrival   BOOLEAN NOT NULL DEFAULT FALSE,
  closed_to_departure BOOLEAN NOT NULL DEFAULT FALSE,
  stop_sell           BOOLEAN NOT NULL DEFAULT FALSE,
  status              VARCHAR(16) NOT NULL DEFAULT 'DRAFT',

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

CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_rate_calendar_malam
  ON "{{TENANT_SCHEMA}}".hospitality_rate_calendar (rate_plan_id, stay_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_hospitality_rate_calendar_status
  ON "{{TENANT_SCHEMA}}".hospitality_rate_calendar (rate_plan_id, status, stay_date) WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_rate_calendar
  ADD CONSTRAINT ck_hospitality_rate_calendar_amount
  CHECK (amount >= 0);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_rate_calendar
  ADD CONSTRAINT ck_hospitality_rate_calendar_los
  CHECK (min_los IS NULL OR min_los > 0);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_rate_calendar
  ADD CONSTRAINT ck_hospitality_rate_calendar_status
  CHECK (status IN ('DRAFT', 'PUBLISHED'));
