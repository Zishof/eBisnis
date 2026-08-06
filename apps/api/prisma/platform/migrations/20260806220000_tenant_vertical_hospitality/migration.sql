-- Menambahkan 'HOSPITALITY' ke daftar tetap `tenant.vertical_code` (MI-3).
--
-- Ditemukan lewat pendaftaran sungguhan (bukan tsc/lint/test tiruan):
-- HospitalityRegistrationService menulis vertical_code = 'HOSPITALITY' pada
-- tenant baru, dan CHECK constraint `ck_tenant_vertical_code` (dari migrasi
-- 20260802100000_registration_pesantren) menolaknya sebab daftarnya belum
-- pernah diperbarui sejak vertikal Hospitality terdaftar di
-- `portal.catalog.ts` -- tenant/schema/akun sudah SELESAI dibuat sesaat
-- sebelum baris ini gagal, sehingga tidak ditolak diam-diam melainkan
-- mengembalikan PROVISIONING_FAILED (lihat penanganan error di
-- `HospitalityRegistrationService.register()`).
--
-- Aditif murni: constraint lama di-drop lalu dibuat ulang dengan satu nilai
-- tambahan, tidak ada baris yang berubah maupun dihapus.
ALTER TABLE "platform"."tenant"
  DROP CONSTRAINT "ck_tenant_vertical_code";

ALTER TABLE "platform"."tenant"
  ADD CONSTRAINT "ck_tenant_vertical_code"
  CHECK ("vertical_code" IS NULL OR "vertical_code" IN (
    'CORE_ERP', 'PESANTREN', 'SCHOOL', 'CAMPUS', 'HEALTH', 'COOPERATIVE', 'VILLAGE_GOVERNMENT', 'HOSPITALITY'
  ));
