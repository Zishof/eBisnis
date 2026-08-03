-- =========================================================================
-- V041 -- Halaman jurnal sudah tersedia
--
-- Jurnal sekarang memiliki endpoint baca-saja dan halaman detail baris.
-- Tenant lama perlu dicabut penanda placeholder-nya agar sidebar tidak lagi
-- mengarahkan pengguna ke pengalaman "Coming Soon".
-- =========================================================================

UPDATE "{{TENANT_SCHEMA}}".menu
   SET is_coming_soon = FALSE,
       updated_at = now()
 WHERE code = 'FINANCE_JOURNAL'
   AND deleted_at IS NULL;
