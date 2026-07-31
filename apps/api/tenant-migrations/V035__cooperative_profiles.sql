-- =========================================================================
-- V035 — PROFIL HAK KOPERASI PADA CONSTRAINT ROLE
-- =========================================================================
--
-- Menyusul V012 (marketplace M1–M9) dan V025 (kasir K1–K5) yang melakukan hal
-- sama.
--
-- Profil koperasi C1–C4 dibuat tersendiri, bukan dengan menambahkan `ANALYZE`,
-- `DISBURSE`, dan `WRITE_OFF` ke P1–P12, karena profil berlaku lintas modul:
-- menambahkan DISBURSE ke profil manajer modul umum akan memberikannya pula
-- pada setiap modul lain yang kebetulan menawarkan aksi itu. Hak mencairkan
-- dana bukan sesuatu yang boleh merembes karena seseorang manajer modul di
-- tempat lain.
--
-- Yang dijaga keluarga C1–C4 adalah pemisahan yang paling menentukan pada
-- koperasi simpan pinjam:
--
--   C1 memuat ANALYZE dan TIDAK memuat APPROVE — petugas pinjaman menganalisis
--   tetapi tidak menyetujui; C2 memuat APPROVE dan DISBURSE tetapi TIDAK
--   memuat CREATE — penyetuju tidak mencatat.
--
-- Pemisahan itu karena itu tidak dijaga daftar izin yang dapat disusun keliru,
-- melainkan oleh bentuk profilnya sendiri.
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
    'K1','K2','K3','K4','K5',
    -- Profil koperasi Versi 12
    'C1','C2','C3','C4'
  ));
