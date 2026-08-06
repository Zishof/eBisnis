-- =========================================================================
-- MitraInap (Hospitality) — MI-8: Reservation dan CRS
-- =========================================================================
--
-- Dua bagian:
--   1. hospitality_reservation -- kepala reservasi: tamu utama, sumber,
--      segmen pasar, status siklus hidup.
--   2. hospitality_reservation_room_stay -- satu baris per kamar per
--      reservasi (mendukung multi-kamar). Kamar SENGAJA belum ditunjuk
--      (room_id nullable) -- penunjukan kamar fisik adalah pekerjaan
--      front office (MI-12) saat/menjelang check-in, bukan saat reservasi
--      dibuat. Reservasi menjual TIPE kamar, bukan kamar tertentu.
--
-- ## Snapshot harga dan restriksi -- WAJIB menurut perintah master §MI-8
--
-- `rate_snapshot` dan `restriction_snapshot` (JSONB) merekam APA YANG
-- DIKETAHUI saat reservasi dibuat, dan tidak pernah berubah sesudahnya --
-- bahkan bila rate plan atau kebijakan alotmen berubah kemudian. Tanpa
-- ini, mengubah harga bulan depan diam-diam mengubah total tagihan
-- reservasi bulan lalu yang sudah dikonfirmasi.
--
-- MI-10 (Rate/Revenue Management) BELUM ada -- harga hari ini dimasukkan
-- staf secara manual (`rate_amount`), bukan dari rate plan otomatis.
-- `rate_snapshot` tetap dibuat sekarang (berisi info harga manual yang
-- sama) supaya MEKANISME penyimpanan snapshot sudah ada dan teruji --
-- begitu MI-10 membangun rate plan sungguhan, yang berubah hanya SUMBER
-- datanya, bukan mekanisme penyimpanannya.
--
-- ## Idempotensi -- WAJIB
--
-- `idempotency_key` unik per penyewa. Permintaan booking engine yang
-- diulang (mis. koneksi timeout lalu klien mencoba lagi) dengan kunci
-- yang sama TIDAK membuat reservasi kedua -- lihat
-- `hospitality-reservation.service.ts` yang memeriksa kunci ini sebelum
-- menulis baris baru.
--
-- ## Kunci optimistik -- WAJIB
--
-- Kolom `version` standar dipakai SUNGGUHAN di sini (bukan hanya
-- dinaikkan tanpa diperiksa seperti MI-5/6/7) -- setiap UPDATE pada
-- reservasi menyertakan `WHERE version = $expectedVersion`. Nol baris
-- terpengaruh berarti orang lain sudah mengubahnya lebih dulu; layanan
-- menolak dengan CONFLICT, bukan menimpa diam-diam.
--
-- ## Kondisi pacu -- kapasitas tipe kamar
--
-- Dua permintaan reservasi bersamaan untuk tipe kamar yang SAMA pada
-- tanggal yang SAMA tidak boleh sama-sama lolos melebihi kapasitas
-- (jumlah kamar + alotmen lebih, MI-6). Ini TIDAK dapat ditegakkan
-- indeks unik (kapasitas adalah HITUNGAN lintas baris, bukan
-- keunikan satu baris) -- `hospitality-reservation.service.ts` mengunci
-- baris `hospitality_room_type` (`SELECT ... FOR UPDATE`) di dalam
-- transaksi yang sama dengan penghitungan dan penulisan, sehingga
-- permintaan bersamaan untuk tipe kamar yang sama diserialkan basis
-- data -- diuji dengan permintaan bersamaan sungguhan (lihat
-- docs/changelog/hospitality.md), pola yang sama dengan kondisi pacu
-- MI-6, hanya lebih rumit sebab yang dijaga adalah HITUNGAN, bukan
-- satu pasangan kolom.
--
-- ## Waitlist -- SENGAJA BELUM ADA
--
-- Waitlist (antrean kamar yang penuh + pemberitahuan saat kosong) adalah
-- alur kerja tersendiri di luar siklus hidup reservasi inti (hold/
-- confirm/modify/cancel/no-show/reinstate) yang diminta fase ini.
-- Ditunda supaya cakupan MI-8 tetap terverifikasi penuh, bukan separuh
-- jadi. `source = 'WALK_IN'` sudah mencakup kebutuhan "walk-in" sebagai
-- nilai sumber reservasi, bukan struktur terpisah.

CREATE SEQUENCE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_reservation_code_seq;

-- ---------------------------------------------------------------------------
-- hospitality_reservation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_reservation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(24) NOT NULL
                     DEFAULT ('RES-' || LPAD(nextval('"{{TENANT_SCHEMA}}".hospitality_reservation_code_seq')::text, 6, '0')),
  property_id       UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_property (id) ON DELETE RESTRICT,
  guest_id          UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest (id) ON DELETE RESTRICT,
  status            VARCHAR(16) NOT NULL DEFAULT 'HOLD',
  source            VARCHAR(16) NOT NULL DEFAULT 'DIRECT',
  market_segment    VARCHAR(64),
  special_requests  TEXT,
  cancel_reason     TEXT,
  -- Unik per penyewa bila diisi -- penjaga idempotensi. NULL (reservasi
  -- dicatat manual oleh staf, tanpa klien yang mengulang permintaan)
  -- sengaja tidak ikut diperiksa unik.
  idempotency_key   VARCHAR(128),

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

CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_reservation_code
  ON "{{TENANT_SCHEMA}}".hospitality_reservation (code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_reservation_idempotency
  ON "{{TENANT_SCHEMA}}".hospitality_reservation (idempotency_key)
  WHERE deleted_at IS NULL AND idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_hospitality_reservation_property
  ON "{{TENANT_SCHEMA}}".hospitality_reservation (property_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS ix_hospitality_reservation_guest
  ON "{{TENANT_SCHEMA}}".hospitality_reservation (guest_id, deleted_at);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_reservation
  ADD CONSTRAINT ck_hospitality_reservation_status
  CHECK (status IN ('HOLD', 'CONFIRMED', 'CANCELLED', 'NO_SHOW'));

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_reservation
  ADD CONSTRAINT ck_hospitality_reservation_source
  CHECK (source IN ('DIRECT', 'WALK_IN', 'PHONE', 'OTA', 'WEBSITE', 'OTHER'));

-- Alasan wajib begitu status CANCELLED -- pembatalan tanpa alasan
-- tercatat tidak dapat ditinjau kelak (sama pola dengan do_not_rent MI-7).
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_reservation
  ADD CONSTRAINT ck_hospitality_reservation_cancel_alasan
  CHECK (status <> 'CANCELLED' OR cancel_reason IS NOT NULL);

-- ---------------------------------------------------------------------------
-- hospitality_reservation_room_stay
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_reservation_room_stay (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_reservation (id) ON DELETE RESTRICT,
  room_type_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room_type (id) ON DELETE RESTRICT,
  -- Kamar fisik ditunjuk belakangan (front office, MI-12) -- lihat
  -- catatan besar di atas.
  room_id         UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_room (id) ON DELETE SET NULL,
  guest_id        UUID REFERENCES "{{TENANT_SCHEMA}}".hospitality_guest (id) ON DELETE RESTRICT,
  checkin_date    DATE NOT NULL,
  checkout_date   DATE NOT NULL,
  adults          INTEGER NOT NULL DEFAULT 1,
  children        INTEGER NOT NULL DEFAULT 0,
  rate_amount     NUMERIC(14, 2) NOT NULL,
  rate_snapshot         JSONB NOT NULL,
  restriction_snapshot  JSONB,

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

CREATE INDEX IF NOT EXISTS ix_hospitality_reservation_room_stay_reservation
  ON "{{TENANT_SCHEMA}}".hospitality_reservation_room_stay (reservation_id, deleted_at);
-- Indeks penopang penghitungan kapasitas (rentang tanggal per tipe kamar) --
-- dibaca pada SETIAP percobaan reservasi baru, wajib cepat.
CREATE INDEX IF NOT EXISTS ix_hospitality_reservation_room_stay_kapasitas
  ON "{{TENANT_SCHEMA}}".hospitality_reservation_room_stay (room_type_id, checkin_date, checkout_date)
  WHERE deleted_at IS NULL;

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_reservation_room_stay
  ADD CONSTRAINT ck_hospitality_reservation_room_stay_tanggal
  CHECK (checkout_date > checkin_date);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_reservation_room_stay
  ADD CONSTRAINT ck_hospitality_reservation_room_stay_okupansi
  CHECK (adults > 0 AND children >= 0);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_reservation_room_stay
  ADD CONSTRAINT ck_hospitality_reservation_room_stay_tarif
  CHECK (rate_amount >= 0);
