-- =========================================================================
-- V032 — PENANDA DATA CONTOH PADA TABEL TRANSAKSI KASIR
-- =========================================================================
--
-- Seluruh tabel MASTER sudah punya `is_sample` dan `sample_batch_id` sejak
-- awal. Tabel TRANSAKSI tidak — dan itu keputusan yang masuk akal ketika
-- transaksi hanya dibuat oleh pemakaian sungguhan.
--
-- Data contoh POS mengubah keadaan itu. Profil demo membuat penjualan yang
-- sudah selesai supaya penyewa baru dapat membuka laporan dan melihat angka
-- alih-alih layar kosong. Penjualan itu harus dapat dikenali dan dihapus.
--
-- Tanpa penanda ini, pembersihan data contoh akan melewatkannya, dan penyewa
-- yang mengira sudah membersihkan ruang kerjanya akan menemukan penjualan
-- karangan pada laporan keuangannya berbulan-bulan kemudian — pada saat
-- asal-usulnya sudah tidak dapat ditelusuri siapa pun.
--
-- Bawaannya FALSE. Baris transaksi yang sudah ada adalah transaksi sungguhan,
-- dan menandainya sebagai contoh akan membuatnya terhapus pada pembersihan
-- berikutnya.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale
  ADD COLUMN IF NOT EXISTS is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sample_batch_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_reason   TEXT;

ALTER TABLE "{{TENANT_SCHEMA}}".pos_shift
  ADD COLUMN IF NOT EXISTS is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sample_batch_id UUID;

ALTER TABLE "{{TENANT_SCHEMA}}".pos_return
  ADD COLUMN IF NOT EXISTS is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sample_batch_id UUID;

ALTER TABLE "{{TENANT_SCHEMA}}".pos_refund
  ADD COLUMN IF NOT EXISTS is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sample_batch_id UUID;

-- Indeks parsial: pembersihan hanya pernah mencari baris bertanda contoh, dan
-- pada ruang kerja sungguhan baris itu adalah bagian yang sangat kecil.
CREATE INDEX IF NOT EXISTS pos_sale_sample_idx
  ON "{{TENANT_SCHEMA}}".pos_sale (sample_batch_id)
  WHERE is_sample = TRUE;

CREATE INDEX IF NOT EXISTS pos_shift_sample_idx
  ON "{{TENANT_SCHEMA}}".pos_shift (sample_batch_id)
  WHERE is_sample = TRUE;

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".pos_sale.is_sample IS
  'Penjualan buatan pabrik data contoh POS. Bawaannya FALSE — penjualan yang tercatat lewat kasir selalu penjualan sungguhan.';
