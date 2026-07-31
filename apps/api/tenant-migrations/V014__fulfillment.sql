-- =========================================================================
-- V014 — PEMENUHAN PESANAN: PICKING, PACKING, PAKET, DAN PENGIRIMAN
--
-- Pemenuhan tinggal di schema tenant karena barangnya ada di gudang tenant.
-- Pesanan tinggal di schema platform karena dibaca pembeli yang tidak punya
-- tenant. Penghubungnya satu kolom: `marketplace_order_id`.
--
-- Tidak diberi foreign key lintas schema — PostgreSQL tidak mendukungnya, dan
-- memaksakannya lewat trigger akan membuat setiap penulisan pesanan menyentuh
-- setiap schema tenant.
--
-- CATATAN TENTANG EKSPEDISI INTERNAL
--
-- Blueprint menyebut integrasi dengan armada internal, trip, GPS, dan POD.
-- Audit menunjukkan tabel-tabel itu TIDAK ADA pada schema tenant mana pun;
-- yang tersedia hanya `vehicle_type` dan `carrier` sebagai tabel referensi.
-- Karena itu tidak ada armada kedua yang dibuat di sini, dan tidak ada pula
-- klaim integrasi. `shipment` menyimpan `carrier_id` yang menunjuk tabel yang
-- memang ada; armada internal menyusul bersama modul ekspedisi.
--
-- Additive. Tidak ada tabel maupun kolom lama yang diubah.
-- =========================================================================

-- Perintah pemenuhan --------------------------------------------------------
--
-- Satu pesanan marketplace menghasilkan satu perintah pemenuhan per gudang.
-- Pesanan yang barangnya tersebar di dua gudang menghasilkan dua perintah,
-- dan pembeli menerima dua paket — itu kenyataan yang lebih baik dinyatakan
-- daripada disembunyikan.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fulfillment_order (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(64) NOT NULL,

  -- Penunjuk ke pesanan pada schema platform. Tanpa foreign key; lihat catatan
  -- di kepala berkas.
  marketplace_order_id UUID NOT NULL,
  marketplace_order_number VARCHAR(32),

  warehouse_id  UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse (id) ON DELETE RESTRICT,

  status        VARCHAR(24) NOT NULL DEFAULT 'NEW',
  priority      INTEGER NOT NULL DEFAULT 0,

  -- Alamat tujuan disalin dari pesanan. Petugas gudang tidak boleh perlu
  -- menembus schema platform hanya untuk mencetak label.
  ship_to_snapshot JSONB NOT NULL,

  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_at     TIMESTAMPTZ,
  packed_at     TIMESTAMPTZ,
  shipped_at    TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,

  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample     BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_fulfillment_order_status CHECK (status IN (
    'NEW','ALLOCATED','PICKING','PICKED','PACKING','PACKED',
    'READY_TO_SHIP','SHIPPED','DELIVERED','CANCELLED','ON_HOLD'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fulfillment_order_code
  ON "{{TENANT_SCHEMA}}".fulfillment_order (code) WHERE deleted_at IS NULL;

-- Satu pesanan marketplace tidak boleh menghasilkan dua perintah pada gudang
-- yang sama. Tanpa ini, permintaan yang diulang menggandakan pekerjaan gudang.
CREATE UNIQUE INDEX IF NOT EXISTS ux_fulfillment_order_source
  ON "{{TENANT_SCHEMA}}".fulfillment_order (marketplace_order_id, warehouse_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fulfillment_order_status
  ON "{{TENANT_SCHEMA}}".fulfillment_order (status, requested_at)
  WHERE deleted_at IS NULL;

-- Baris pemenuhan -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".fulfillment_order_line (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_order_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".fulfillment_order (id) ON DELETE CASCADE,

  listing_id    UUID REFERENCES "{{TENANT_SCHEMA}}".online_listing (id) ON DELETE RESTRICT,
  variant_id    UUID REFERENCES "{{TENANT_SCHEMA}}".online_listing_variant (id) ON DELETE RESTRICT,
  product_id    UUID REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,

  sku           VARCHAR(64),
  description   VARCHAR(255),

  ordered_qty   NUMERIC(19,6) NOT NULL,
  -- Berapa yang benar-benar diambil. Berbeda dari yang dipesan bila barangnya
  -- kurang di rak — dan selisih itu harus terlihat, bukan disamakan.
  picked_qty    NUMERIC(19,6) NOT NULL DEFAULT 0,
  packed_qty    NUMERIC(19,6) NOT NULL DEFAULT 0,

  weight_gram   INTEGER,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_fulfillment_line_qty CHECK (
    ordered_qty > 0 AND picked_qty >= 0 AND packed_qty >= 0
    -- Tidak boleh mengemas lebih banyak daripada yang diambil.
    AND packed_qty <= picked_qty
  )
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_line_order
  ON "{{TENANT_SCHEMA}}".fulfillment_order_line (fulfillment_order_id)
  WHERE deleted_at IS NULL;

-- Tugas pengambilan ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pick_task (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(64) NOT NULL,
  fulfillment_order_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".fulfillment_order (id) ON DELETE CASCADE,
  fulfillment_order_line_id UUID
    REFERENCES "{{TENANT_SCHEMA}}".fulfillment_order_line (id) ON DELETE CASCADE,

  bin_id        UUID REFERENCES "{{TENANT_SCHEMA}}".warehouse_bin (id) ON DELETE SET NULL,
  lot_id        UUID REFERENCES "{{TENANT_SCHEMA}}".inventory_lot (id) ON DELETE SET NULL,

  requested_qty NUMERIC(19,6) NOT NULL,
  picked_qty    NUMERIC(19,6) NOT NULL DEFAULT 0,

  status        VARCHAR(24) NOT NULL DEFAULT 'OPEN',

  -- Petugas yang mengambil. Diisi saat tugas diambil, bukan saat dibuat —
  -- penugasan di muka membuat tugas menganggur ketika orangnya tidak masuk.
  assigned_to   UUID,
  assigned_at   TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,

  -- Selisih antara yang diminta dan yang diambil, beserta alasannya.
  discrepancy_reason VARCHAR(48),
  note          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_pick_task_status CHECK (status IN (
    'OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','SHORT','CANCELLED'
  )),
  CONSTRAINT ck_pick_task_qty CHECK (requested_qty > 0 AND picked_qty >= 0),
  -- Selisih wajib punya alasan. Tanpa syarat ini, kekurangan stok tercatat
  -- sebagai angka tanpa penjelasan dan tidak dapat ditindaklanjuti.
  CONSTRAINT ck_pick_task_discrepancy CHECK (
    picked_qty >= requested_qty OR status <> 'SHORT' OR discrepancy_reason IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pick_task_code
  ON "{{TENANT_SCHEMA}}".pick_task (code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pick_task_status
  ON "{{TENANT_SCHEMA}}".pick_task (status, created_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pick_task_assignee
  ON "{{TENANT_SCHEMA}}".pick_task (assigned_to, status) WHERE deleted_at IS NULL;

-- Paket ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".package (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(64) NOT NULL,
  fulfillment_order_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".fulfillment_order (id) ON DELETE CASCADE,

  -- Dimensi dan berat sesungguhnya setelah dikemas, bukan hasil penjumlahan
  -- berat barang. Kemasan dan pengisi ikut berbobot, dan ekspedisi menagih
  -- berdasarkan yang ditimbang.
  weight_gram   INTEGER,
  length_mm     INTEGER,
  width_mm      INTEGER,
  height_mm     INTEGER,

  packaging_note TEXT,
  status        VARCHAR(24) NOT NULL DEFAULT 'OPEN',

  packed_by     UUID,
  packed_at     TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_package_status CHECK (status IN ('OPEN','SEALED','LABELED','SHIPPED','CANCELLED')),
  CONSTRAINT ck_package_dimension CHECK (
    (weight_gram IS NULL OR weight_gram > 0)
    AND (length_mm IS NULL OR length_mm > 0)
    AND (width_mm  IS NULL OR width_mm  > 0)
    AND (height_mm IS NULL OR height_mm > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_package_code
  ON "{{TENANT_SCHEMA}}".package (code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_package_order
  ON "{{TENANT_SCHEMA}}".package (fulfillment_order_id) WHERE deleted_at IS NULL;

-- Isi paket -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".package_line (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".package (id) ON DELETE CASCADE,
  fulfillment_order_line_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".fulfillment_order_line (id) ON DELETE RESTRICT,

  quantity      NUMERIC(19,6) NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,

  CONSTRAINT ck_package_line_qty CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_package_line_package
  ON "{{TENANT_SCHEMA}}".package_line (package_id);

-- Pengiriman ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".shipment (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(64) NOT NULL,
  fulfillment_order_id UUID NOT NULL
    REFERENCES "{{TENANT_SCHEMA}}".fulfillment_order (id) ON DELETE CASCADE,

  -- Menunjuk tabel `carrier` yang memang sudah ada. Armada internal belum
  -- dibangun; lihat catatan di kepala berkas.
  carrier_id    UUID REFERENCES "{{TENANT_SCHEMA}}".carrier (id) ON DELETE RESTRICT,
  service_code  VARCHAR(48),

  -- Nomor resi dari ekspedisi. Kosong sampai pemesanan kurir berhasil; nomor
  -- yang dikarang membuat pembeli melacak ke halaman yang tidak ada.
  tracking_number VARCHAR(96),
  tracking_url  VARCHAR(512),

  shipping_cost NUMERIC(19,4),
  currency_code VARCHAR(8) NOT NULL DEFAULT 'IDR',

  status        VARCHAR(24) NOT NULL DEFAULT 'DRAFT',

  booked_at     TIMESTAMPTZ,
  picked_up_at  TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  -- Bukti terima: siapa yang menerima dan kapan.
  received_by   VARCHAR(160),
  proof_file_object_id UUID REFERENCES "{{TENANT_SCHEMA}}".file_object (id) ON DELETE SET NULL,

  failure_reason TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT ck_shipment_status CHECK (status IN (
    'DRAFT','BOOKED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY',
    'DELIVERED','FAILED','RETURNED','CANCELLED'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_shipment_code
  ON "{{TENANT_SCHEMA}}".shipment (code) WHERE deleted_at IS NULL;

-- Nomor resi tidak boleh dipakai dua kali. Resi ganda membuat dua pesanan
-- terlihat sebagai satu kiriman.
CREATE UNIQUE INDEX IF NOT EXISTS ux_shipment_tracking
  ON "{{TENANT_SCHEMA}}".shipment (carrier_id, tracking_number)
  WHERE tracking_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_status
  ON "{{TENANT_SCHEMA}}".shipment (status, created_at) WHERE deleted_at IS NULL;

-- Riwayat pelacakan ---------------------------------------------------------
--
-- Append-only. Peristiwa yang sama dari ekspedisi dapat datang berulang, dan
-- kunci uniknya memastikan pengulangan tidak menambah baris.
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".shipment_tracking_event (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".shipment (id) ON DELETE CASCADE,

  event_code    VARCHAR(48) NOT NULL,
  description   VARCHAR(512),
  location      VARCHAR(255),
  occurred_at   TIMESTAMPTZ NOT NULL,

  -- Sidik peristiwa dari ekspedisi, untuk menolak kiriman ulang.
  source_event_id VARCHAR(128),
  raw_payload   JSONB,

  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_shipment_event_source
  ON "{{TENANT_SCHEMA}}".shipment_tracking_event (shipment_id, source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_event_time
  ON "{{TENANT_SCHEMA}}".shipment_tracking_event (shipment_id, occurred_at DESC);

-- Audit ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fulfillment_order', 'fulfillment_order_line', 'pick_task',
    'package', 'package_line', 'shipment'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
