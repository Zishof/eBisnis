-- =========================================================================
-- V055 — LARANGAN PERSETUJUAN BUKU HARGA OLEH PENGAJU SENDIRI
-- =========================================================================
--
-- `transitionInventoryPriceBook` (sales-inventory-operations.controller.ts)
-- menegakkan tabel transisi status (DRAFT→SUBMITTED→APPROVED/REJECTED→
-- INACTIVE) tetapi TIDAK PERNAH memeriksa siapa yang mengajukan lawan siapa
-- yang menyetujui -- gerbangnya hanya permission CRUD generik
-- (`CATALOG_PRICE_BOOK.UPDATE`). Siapa pun dengan permission itu dapat
-- mengajukan lalu langsung menyetujui perubahan harganya sendiri. Ini
-- satu-satunya alur persetujuan di seluruh codebase yang ditemukan begitu --
-- pembatalan POS, refund POS, tutup shift, dan persetujuan baris kasir
-- (V052) semuanya menegakkan larangan ini secara konsisten.
--
-- `price_book` sebelumnya hanya punya `approved_by`/`rejected_by`, tanpa
-- kolom yang membekukan SIAPA yang mengajukan. Tanpa kolom itu, larangan
-- self-approval tidak dapat ditegakkan lewat CHECK constraint: `updated_by`
-- yang ada berubah pada SETIAP transisi termasuk transisi persetujuan itu
-- sendiri, sehingga membandingkannya dengan `approved_by` pada baris yang
-- sama akan SELALU menolak persetujuan yang sah sekalipun.
--
-- Pola yang sama dengan V030 (`pos_sale_no_self_void_approval`): kolom
-- pembeku pemohon + CHECK constraint pada tabel yang sama. Layanan sudah
-- diperbarui memeriksanya lebih dahulu (pesan yang jelas); constraint ini
-- adalah lapisan kedua yang tetap berlaku bila jalan keempat menuju tabel
-- ini kelak lupa memeriksanya.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".price_book
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES "{{TENANT_SCHEMA}}".user_subject (id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'price_book_no_self_approval'
       AND conrelid = '"{{TENANT_SCHEMA}}".price_book'::regclass
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".price_book
      ADD CONSTRAINT price_book_no_self_approval
      CHECK (approved_by IS NULL OR submitted_by IS NULL OR approved_by <> submitted_by);
  END IF;
END $$;

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".price_book.submitted_by IS
  'Pengaju SUBMITTED. Dibekukan terpisah dari updated_by (yang berubah pada setiap transisi) supaya larangan menyetujui pengajuan sendiri dapat ditegakkan CHECK constraint, bukan hanya kode layanan.';
