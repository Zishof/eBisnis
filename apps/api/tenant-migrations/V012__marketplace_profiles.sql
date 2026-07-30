-- =========================================================================
-- V012 — PROFIL HAK MARKETPLACE PADA CONSTRAINT ROLE
--
-- V010 membatasi role_module_profile.profile_code pada P0–P12. Versi 9
-- menambahkan profil marketplace M1–M9, sehingga constraint lama menolak
-- seluruh role marketplace saat disemai.
--
-- Kegagalan itu justru yang diinginkan: basis data menolak nilai yang tidak
-- dikenal alih-alih menerimanya diam-diam. Yang perlu dilakukan adalah
-- memperluas daftar yang sah, bukan melonggarkan pemeriksaannya.
--
-- Additive. Tidak ada baris yang berubah; hanya daftar nilai yang sah diperluas.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".role_module_profile
  DROP CONSTRAINT IF EXISTS ck_role_module_profile_code;

ALTER TABLE "{{TENANT_SCHEMA}}".role_module_profile
  ADD CONSTRAINT ck_role_module_profile_code CHECK (profile_code IN (
    -- Profil umum Versi 8
    'P0','P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12',
    -- Profil marketplace Versi 9
    'M1','M2','M3','M4','M5','M6','M7','M8','M9'
  ));

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".role_module_profile.profile_code IS
  'Profil hak: P0-P12 umum, M1-M9 marketplace. M9 khusus pemegang credential pembayaran dan menuntut step-up.';
