-- =========================================================================
-- V040 -- Flag menu yang sudah punya halaman
--
-- Beberapa menu diberi route dan halaman sesudah tenant dibuat, tetapi baris
-- lama masih menyimpan is_coming_soon = TRUE. Ini membuat sidebar tetap
-- menampilkan penanda placeholder walaupun rutenya sudah berjalan.
-- =========================================================================

UPDATE "{{TENANT_SCHEMA}}".menu
   SET is_coming_soon = FALSE,
       updated_at = now()
 WHERE code IN (
   'HOME_APPROVAL_INBOX',
   'CATALOG_TAX',
   'FINANCE_COA',
   'SUPPORT_TICKET'
 )
   AND deleted_at IS NULL;
