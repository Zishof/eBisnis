-- =========================================================================
-- V042 -- Bersihkan seluruh flag Coming Soon menu
--
-- Web sekarang menyediakan halaman kerja demo untuk route aplikasi yang belum
-- punya layar transaksi penuh. Karena tidak ada lagi route mati, tenant lama
-- tidak perlu melihat penanda "Coming Soon" pada sidebar.
-- =========================================================================

UPDATE "{{TENANT_SCHEMA}}".menu
   SET is_coming_soon = FALSE,
       updated_at = now()
 WHERE is_coming_soon = TRUE
   AND deleted_at IS NULL;
