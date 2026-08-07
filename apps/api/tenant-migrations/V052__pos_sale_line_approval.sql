-- =========================================================================
-- V052 — WAKTU PERSETUJUAN BARIS KASIR
-- =========================================================================
--
-- `pos_sale_line.approved_by` sudah ada sejak V027 (lihat `requires_approval`
-- pada migrasi yang sama), tetapi tidak pernah ada jalan menuliskannya --
-- baris yang menuntut persetujuan (mis. dari pelampauan harga di bawah HPP)
-- memblokir `selesaikan()` untuk selamanya begitu ditandai, sebab tidak ada
-- endpoint yang pernah menuliskan `approved_by`. `approved_at` ditambahkan
-- berpasangan dengan pola yang sama dipakai `pos_sale.void_approved_at`
-- (V030) dan `pos_shift.approved_at` (V031): siapa saja tanpa kapan adalah
-- jejak audit yang tidak lengkap.
--
-- TIDAK ADA constraint anti-persetujuan-sendiri pada tabel ini: pemohonnya
-- (kasir yang membuat baris) tercatat pada `pos_sale.cashier_id`, tabel yang
-- berbeda -- CHECK constraint hanya berlaku dalam satu baris/tabel yang sama.
-- Larangan menyetujui baris sendiri ditegakkan pada lapisan layanan
-- (`bolehMenyetujui`, sama seperti dipakai pembatalan dan refund), bukan
-- diam-diam dilewatkan karena constraint basis data tidak dapat menjangkaunya.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".pos_sale_line
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS pos_sale_line_pending_approval_idx
  ON "{{TENANT_SCHEMA}}".pos_sale_line (pos_sale_id)
  WHERE requires_approval = TRUE AND approved_by IS NULL;

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".pos_sale_line.approved_at IS
  'Kapan requires_approval dipenuhi. NULL berarti masih menunggu, atau tidak pernah menuntut persetujuan.';
