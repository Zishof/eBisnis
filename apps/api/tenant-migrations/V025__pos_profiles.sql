-- =========================================================================
-- V025 — PROFIL HAK KASIR PADA CONSTRAINT ROLE
-- =========================================================================
--
-- Menyusul V012 yang melakukan hal sama untuk profil marketplace M1–M9.
--
-- Profil kasir K1–K5 dibuat tersendiri, bukan dengan menambahkan aksi POS ke
-- P1–P12, karena profil berlaku lintas modul: menambahkan REFUND_APPROVE atau
-- CASH_MOVE ke profil manajer modul umum akan memberikannya pula pada modul
-- lain yang kebetulan menawarkan aksi itu. Hak menyetujui refund bukan sesuatu
-- yang boleh merembes karena seseorang manajer modul di tempat lain.
--
-- Additive. Tidak ada baris yang berubah; hanya daftar nilai yang sah
-- diperluas, dan perluasan tidak pernah membatalkan baris yang sudah ada.
-- =========================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".role_module_profile
  DROP CONSTRAINT IF EXISTS ck_role_module_profile_code;

ALTER TABLE "{{TENANT_SCHEMA}}".role_module_profile
  ADD CONSTRAINT ck_role_module_profile_code CHECK (profile_code IN (
    -- Profil umum Versi 8
    'P0','P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12',
    -- Profil marketplace Versi 9
    'M1','M2','M3','M4','M5','M6','M7','M8','M9',
    -- Profil kasir POS
    'K1','K2','K3','K4','K5'
  ));

COMMENT ON COLUMN "{{TENANT_SCHEMA}}".role_module_profile.profile_code IS
  'Profil hak: P0-P12 umum, M1-M9 marketplace, K1-K5 kasir. K1 kasir, K2 supervisor kasir, K3 kepala toko, K4 auditor POS, K5 administrator master POS. M9 khusus pemegang credential pembayaran dan menuntut step-up.';
