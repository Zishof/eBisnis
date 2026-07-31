-- =========================================================================
-- V037 — PENJUALAN LURING: JATAH NOMOR STRUK DAN KARANTINA
-- =========================================================================
--
-- Mesin kasir yang kehilangan internet harus tetap dapat melayani pembeli, dan
-- transaksinya harus dapat dibukukan begitu peladen kembali. Dua hal yang
-- diperlukan untuk itu belum ada.
--
-- ## 1. Jatah nomor struk (`pos_receipt_block`)
--
-- Nomor struk harus unik di seluruh tenant. Ketika daring, peladen membagikannya
-- satu per satu dari `number_sequence` dengan barisnya dikunci, sehingga dua
-- mesin tidak mungkin mendapat nomor yang sama.
--
-- Saat luring, mesin kasir tidak dapat bertanya. Bila ia menerka — memakai nomor
-- urut lokalnya sendiri, misalnya — dua register yang sama-sama luring akan
-- mencetak nomor struk yang sama, dan benturannya baru ketahuan ketika kedua
-- struk sudah berada di tangan dua pembeli berbeda.
--
-- Karena itu register memesan jatah selagi masih daring: `number_sequence`
-- dimajukan sejauh ukuran jatah, dan rentangnya dicatat di sini sebagai milik
-- register tersebut. Karena urutannya sudah terlanjur maju, penjualan daring
-- tidak akan pernah menyentuh nomor di dalam rentang itu. **Tidak ada sumber
-- penomoran kedua** — hanya potongan yang dipesan dari sumber yang sudah ada.
--
-- ## 2. Karantina (`pos_offline_quarantine`)
--
-- Transaksi luring dihitung dari harga yang dibekukan pada salinan katalog.
-- Ketika dikirim, peladen menghitung ulang. Bila angkanya berbeda, ada tiga
-- kemungkinan tindakan, dan dua di antaranya salah:
--
-- - **Menolak transaksinya.** Pembeli sudah membayar dan pulang. Menolak tidak
--   membuat transaksinya tidak pernah terjadi; ia hanya membuat pembukuan tidak
--   menunjukkannya.
-- - **Menerima diam-diam dengan angka peladen.** Struk di tangan pembeli
--   menyebut angka lain. Tidak ada galat, tidak ada yang tahu, dan selisihnya
--   muncul sebagai kas yang tidak cocok tanpa sebab yang dapat ditelusuri.
-- - **Menahan untuk diperiksa manusia.** Transaksinya tersimpan utuh beserta
--   alasan dan kedua angkanya, menunggu keputusan.
--
-- Yang ketiga yang dipilih. Selisih harga saat luring menyangkut uang yang sudah
-- berpindah tangan, dan keputusannya bukan milik perangkat lunak.
--
-- Karantina juga menampung sebab lain yang sama tidak enaknya untuk diputuskan
-- otomatis: stok yang tidak mencukupi, shift yang sudah tertutup, produk yang
-- sudah dinonaktifkan, dan nomor struk yang tidak sesuai jatah.
--
-- ## Saklar
--
-- `POS_OFFLINE_SALE_ENABLED` bawaannya **mati**. Kemampuan ini dibangun lebih
-- dahulu; kapan dinyalakan adalah keputusan usaha, bukan keputusan penerapan.
-- =========================================================================

-- --- Jatah nomor struk ---------------------------------------------------

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_receipt_block (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id         UUID NOT NULL,
  terminal_id       UUID NOT NULL,
  -- Awalan dan padding disalin dari `number_sequence` saat jatah dibuat, supaya
  -- nomor luring terbaca persis sama dengan nomor daring. Kasir dan pembeli
  -- tidak seharusnya dapat membedakan mana struk yang dibuat saat internet mati.
  prefix            VARCHAR(32) NOT NULL DEFAULT '',
  padding           INTEGER NOT NULL DEFAULT 6,
  from_number       BIGINT NOT NULL,
  to_number         BIGINT NOT NULL,
  -- Nomor berikutnya yang belum terpakai menurut peladen. Mesin kasir memegang
  -- angkanya sendiri; keduanya diadu saat transaksi dikirim.
  next_number       BIGINT NOT NULL,
  business_date     DATE,
  status            VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  allocated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  allocated_by      UUID,
  released_at       TIMESTAMPTZ,
  released_by       UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pos_receipt_block_status_chk
    CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'RELEASED')),
  -- Rentang yang terbalik atau kosong akan menerbitkan nomor di luar jatah.
  CONSTRAINT pos_receipt_block_range_chk CHECK (to_number >= from_number),
  CONSTRAINT pos_receipt_block_next_chk
    CHECK (next_number >= from_number AND next_number <= to_number + 1)
);

-- Satu register hanya boleh memegang satu jatah aktif. Dua jatah aktif berarti
-- mesin kasir dapat memilih, dan pilihan yang salah menerbitkan nomor kembar.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_receipt_block_active
  ON "{{TENANT_SCHEMA}}".pos_receipt_block (terminal_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS ix_pos_receipt_block_outlet
  ON "{{TENANT_SCHEMA}}".pos_receipt_block (outlet_id, status);

-- --- Karantina transaksi luring ------------------------------------------

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".pos_offline_quarantine (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offline_id        VARCHAR(64) NOT NULL,
  outlet_id         UUID NOT NULL,
  terminal_id       UUID NOT NULL,
  shift_id          UUID,
  business_date     DATE NOT NULL,
  receipt_number    VARCHAR(64),
  reason_code       VARCHAR(32) NOT NULL,
  reason            TEXT NOT NULL,
  -- Kedua angka disimpan berdampingan. "Tidak cocok" tanpa menyebut keduanya
  -- memaksa pemeriksa mencari sendiri angka pembandingnya, dan pencarian itu
  -- yang membuat pemeriksaan tidak pernah dikerjakan.
  local_total       NUMERIC(18, 4),
  server_total      NUMERIC(18, 4),
  -- Muatan lengkap sebagaimana dicatat mesin kasir, beserta hash rantainya.
  -- Disimpan utuh supaya transaksi dapat diputar ulang setelah sebabnya
  -- diselesaikan, tanpa meminta kasir mengetik ulang apa pun.
  payload           JSONB NOT NULL,
  local_hash        VARCHAR(64),
  status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID,
  resolution_note   TEXT,
  resolved_sale_id  UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pos_offline_quarantine_status_chk
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  CONSTRAINT pos_offline_quarantine_reason_chk
    CHECK (reason_code IN (
      'PRICE_MISMATCH', 'STOCK_SHORT', 'SHIFT_CLOSED', 'PRODUCT_INACTIVE',
      'RECEIPT_OUT_OF_BLOCK', 'PAYMENT_MISMATCH', 'REPLAY_FAILED'
    ))
);

-- Pengiriman ulang dari mesin kasir tidak boleh menumpuk baris karantina baru
-- untuk transaksi yang sama. Antrean luring memang mengirim ulang sampai
-- jawabannya jelas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_offline_quarantine_offline_id
  ON "{{TENANT_SCHEMA}}".pos_offline_quarantine (offline_id);

CREATE INDEX IF NOT EXISTS ix_pos_offline_quarantine_pending
  ON "{{TENANT_SCHEMA}}".pos_offline_quarantine (business_date DESC, outlet_id)
  WHERE status = 'PENDING';

-- --- Kolom penelusuran pada penjualan ------------------------------------
--
-- `pos_sale.offline_id` dan `sync_status` sudah ada sejak V006. Yang belum ada
-- adalah jejak KAPAN transaksi luring diterima dan dari jatah mana nomornya —
-- keduanya yang ditanyakan ketika satu nomor struk dipersoalkan.

ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale
  ADD COLUMN IF NOT EXISTS offline_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_block_id    UUID,
  ADD COLUMN IF NOT EXISTS offline_local_hash  VARCHAR(64);

CREATE INDEX IF NOT EXISTS ix_pos_sale_offline_received
  ON "{{TENANT_SCHEMA}}".pos_sale (offline_received_at DESC)
  WHERE offline_received_at IS NOT NULL;

-- --- Setelan -------------------------------------------------------------

-- Disisipkan lewat `WHERE NOT EXISTS`, bukan `ON CONFLICT (code)`.
--
-- Indeks uniknya adalah `(scope_type, COALESCE(scope_id, ...), code) WHERE
-- deleted_at IS NULL` — indeks parsial atas ekspresi. `ON CONFLICT` hanya cocok
-- bila seluruh ekspresi beserta klausa WHERE-nya ditulis ulang persis, dan
-- tulisan yang harus persis seperti itu akan diam-diam salah begitu indeksnya
-- berubah. Yang terjadi lalu bukan galat, melainkan setelan ganda.
INSERT INTO "{{TENANT_SCHEMA}}".app_setting
  (code, name, value_type, value_json, description, is_system)
SELECT v.code, v.name, v.value_type, v.value_json::jsonb, v.description, TRUE
  FROM (VALUES
    (
      'POS_OFFLINE_SALE_ENABLED',
      'Izinkan penjualan saat luring',
      'BOOLEAN',
      '{"value": false}',
      'Mati secara bawaan. Menyalakannya berarti kasir boleh menyelesaikan transaksi tanpa peladen, memakai harga yang dibekukan pada salinan katalog. Nyalakan hanya setelah kebijakan stok, jatah nomor struk, dan penanganan selisih harga disepakati.'
    ),
    (
      'POS_OFFLINE_RECEIPT_BLOCK_SIZE',
      'Ukuran jatah nomor struk luring',
      'NUMBER',
      '{"value": 200}',
      'Berapa nomor struk yang dipesan satu register untuk dipakai saat luring. Terlalu kecil membuat jatah habis di tengah gangguan; terlalu besar membuat banyak nomor terlewat bila jatahnya tidak terpakai.'
    ),
    (
      'POS_OFFLINE_MAX_AGE_HOURS',
      'Batas umur transaksi luring yang masih diterima',
      'NUMBER',
      '{"value": 72}',
      'Transaksi luring yang dikirim lebih lambat daripada ini tetap diterima tetapi masuk karantina. Transaksi yang muncul berhari-hari kemudian perlu dilihat manusia, bukan dibukukan diam-diam ke tanggal usaha yang sudah ditutup.'
    )
  ) AS v(code, name, value_type, value_json, description)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".app_setting a
    WHERE a.code = v.code AND a.scope_type = 'TENANT' AND a.scope_id IS NULL
      AND a.deleted_at IS NULL
 );
