-- =========================================================================
-- MitraInap (Hospitality) — MI-6: Room Inventory dan Availability
-- =========================================================================
--
-- Tiga bagian:
--   1. hospitality_room_block -- ledger PENGECUALIAN ketersediaan per kamar
--      per malam (stay date). Sengaja HANYA menyimpan malam yang TIDAK
--      tersedia (BLOCKED/OUT_OF_ORDER/OUT_OF_SERVICE) -- bukan satu baris
--      per kamar per malam untuk seluruh horizon (365 hari x seluruh kamar
--      akan jadi jutaan baris kosong tanpa guna). Ketiadaan baris untuk
--      kamar+tanggal tertentu berarti malam itu tersedia -- ini yang
--      dipakai `hitungKetersediaan()`.
--   2. `overbooking_limit` pada hospitality_room_type -- kebijakan alotmen:
--      berapa kamar boleh dijual MELEBIHI jumlah fisik. Disimpan sebagai
--      konfigurasi di sini; PENEGAKANNYA (menolak reservasi yang melebihi
--      limit) menyusul MI-8 begitu reservasi sungguhan ada -- MI-6 baru
--      menyediakan angkanya.
--   3. `features` pada hospitality_room -- tag bebas (aksesibilitas,
--      merokok, pemandangan, dst). Freeform TEXT[], bukan tabel katalog
--      terpisah -- BRD belum menetapkan daftar tag baku, dan tabel katalog
--      untuk daftar yang belum ada akan jadi struktur tanpa isi.
--
-- ## Kondisi pacu (concurrency) -- WAJIB menurut perintah master §MI-6
--
-- Dua permintaan blokir bersamaan untuk kamar+tanggal yang SAMA (dua staf
-- menandai kamar rusak pada saat bersamaan) TIDAK BOLEH menghasilkan dua
-- baris ledger yang tumpang tindih atau saling timpa secara diam-diam.
-- `UNIQUE (room_id, stay_date) WHERE deleted_at IS NULL` di bawah adalah
-- penjaga sesungguhnya -- bukan pemeriksaan di sisi aplikasi, yang punya
-- jendela waktu antara baca dan tulis. Sisi layanan (lihat
-- `hospitality-room-block.service.ts`) memakai
-- `INSERT ... ON CONFLICT (room_id, stay_date) DO UPDATE` di atas
-- constraint ini, sehingga permintaan kedua memperbarui baris yang sama
-- alih-alih gagal atau menduplikasi -- diuji sungguhan dengan permintaan
-- bersamaan terhadap basis data nyata (lihat catatan verifikasi MI-6 di
-- docs/changelog/hospitality.md), bukan uji tiruan yang tidak dapat
-- membuktikan perilaku basis data sesungguhnya.

-- ---------------------------------------------------------------------------
-- hospitality_room_block
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".hospitality_room_block (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".hospitality_room (id) ON DELETE RESTRICT,
  stay_date       DATE NOT NULL,
  status          VARCHAR(24) NOT NULL,
  reason          TEXT,
  -- Sumber baris: MANUAL (staf menandai lewat layar ini) hari ini;
  -- RESERVATION menyusul MI-8 begitu reservasi sungguhan dapat mengunci
  -- malam. Kolom disiapkan sekarang supaya MI-8 tidak perlu migrasi lagi
  -- hanya untuk menambah nilai enum ini.
  source          VARCHAR(24) NOT NULL DEFAULT 'MANUAL',

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

-- Penjaga kondisi pacu sesungguhnya -- lihat catatan besar di atas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_hospitality_room_block_malam
  ON "{{TENANT_SCHEMA}}".hospitality_room_block (room_id, stay_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_hospitality_room_block_tanggal
  ON "{{TENANT_SCHEMA}}".hospitality_room_block (stay_date, deleted_at);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_block
  ADD CONSTRAINT ck_hospitality_room_block_status
  CHECK (status IN ('BLOCKED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'));

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_block
  ADD CONSTRAINT ck_hospitality_room_block_source
  CHECK (source IN ('MANUAL', 'RESERVATION'));

-- ---------------------------------------------------------------------------
-- Kebijakan alotmen (room type) dan fitur/aksesibilitas (room)
-- ---------------------------------------------------------------------------
ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_type
  ADD COLUMN overbooking_limit INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room_type
  ADD CONSTRAINT ck_hospitality_room_type_overbooking
  CHECK (overbooking_limit >= 0);

ALTER TABLE "{{TENANT_SCHEMA}}".hospitality_room
  ADD COLUMN features TEXT[] NOT NULL DEFAULT '{}';
