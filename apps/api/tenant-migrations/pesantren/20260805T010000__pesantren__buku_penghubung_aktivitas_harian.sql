-- =========================================================================
-- ePesantren: Buku penghubung untuk aktivitas dan materi harian
-- =========================================================================
--
-- Menutup bagian AIS lama:
-- - AktiftasHarianSiswaAction.java
-- - DaftarAktifitasHarianSiswaAction.java
-- - DashboardAktifitasHarianSiswaAction.java
-- - CatatanOrangTuaAktiftasHarianAction.java
-- - JenisAktiftasHarianDefaultAction.java
-- - JenisMateriHarianDefaultAction.java
--
-- Bentuknya tidak dibuat sebagai menu skeleton baru. Aktivitas harian dan
-- materi harian adalah catatan naratif per santri yang wajar dibaca wali,
-- sehingga paling dekat dengan buku penghubung yang sudah punya notifikasi
-- wali, status tindak lanjut, dan filter santri.

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_buku_penghubung
  DROP CONSTRAINT IF EXISTS ck_pesantren_buku_penghubung_jenis;

ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_buku_penghubung
  ADD CONSTRAINT ck_pesantren_buku_penghubung_jenis
  CHECK (jenis IN (
    'AKADEMIK',
    'KESEHATAN',
    'KEDISIPLINAN',
    'IBADAH',
    'ASRAMA',
    'AKTIVITAS_HARIAN',
    'MATERI_HARIAN',
    'WALI',
    'LAINNYA'
  ));
