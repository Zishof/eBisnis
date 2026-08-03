-- =========================================================================
-- V039 -- Route Bantuan dan Dukungan
--
-- Menu SUPPORT sudah ter-seed sejak awal, tetapi hanya sebagai root coming soon
-- tanpa route. Setelah halaman dukungan tenant tersedia, tenant lama perlu
-- menerima route yang sama; mengubah seed saja hanya berdampak pada tenant baru
-- atau repair seed.
-- =========================================================================

UPDATE "{{TENANT_SCHEMA}}".menu
   SET route = '/app/support',
       is_coming_soon = FALSE,
       updated_at = now()
 WHERE code = 'SUPPORT'
   AND deleted_at IS NULL;
