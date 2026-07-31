-- =========================================================================
-- V029 — SIAPA YANG MENERIMA PEMBAYARAN
-- =========================================================================
--
-- `pos_payment` mencatat berapa, dengan apa, dan kapan — tetapi tidak mencatat
-- SIAPA. Selama ini penerimanya disimpulkan dari `pos_sale.cashier_id`.
--
-- Kesimpulan itu benar pada keadaan biasa dan salah pada keadaan yang justru
-- paling perlu dijawab: supervisor yang mengambil alih di tengah transaksi
-- untuk menyetujui diskon lalu sekalian menerima uangnya, atau kasir pengganti
-- yang masuk saat kasir pertama izin keluar. Ketika kas akhir shift selisih,
-- pertanyaan pertama adalah "siapa yang memegang uang ini", dan menjawabnya
-- dengan tebakan bukan jawaban.
--
-- Nullable dengan sengaja: baris pembayaran yang sudah ada tidak diisi mundur.
-- Penerima yang tidak pernah tercatat tidak boleh dikarang, sebab catatan
-- karangan pada jalur uang lebih berbahaya daripada kolom kosong.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".pos_payment
  ADD COLUMN IF NOT EXISTS received_by UUID,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS pos_payment_received_by_idx
  ON "{{TENANT_SCHEMA}}".pos_payment (received_by, received_at DESC);

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".pos_payment.received_by IS
  'Pengguna tenant yang benar-benar menerima pembayaran ini. Belum tentu sama dengan pos_sale.cashier_id: supervisor dapat mengambil alih di tengah transaksi. Kosong pada baris sebelum V029 — tidak diisi mundur karena penerima yang tidak tercatat tidak boleh dikarang.';
