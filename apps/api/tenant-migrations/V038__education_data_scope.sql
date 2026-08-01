-- Cakupan data pendidikan (Versi 13 §8).
--
-- `DataScopeCode` di TypeScript punya kembaran di basis data: dua CHECK
-- constraint yang mengenumerasi tingkat yang sah. Menambah nilai pada union
-- TypeScript saja membuat kode menyemai peran dengan tingkat yang ditolak
-- constraint — dan penolakannya baru muncul saat provisioning tenant, bukan
-- saat kompilasi.
--
-- Itulah yang terjadi: `CLASS_GROUP` dan `GUARDIAN_CHILD` ditambahkan ke union,
-- uji satuan hijau, lalu provisioning demo di CI berhenti dengan
-- "violates check constraint ck_role_data_scope_level".
--
-- Dua belas nilai ditambahkan sekaligus, bukan hanya dua yang dipakai eSchool.
-- Menambahkannya satu per satu saat vertical berikutnya dibangun berarti dua
-- migration lagi untuk hal yang sudah diketahui sekarang, dan setiap migration
-- constraint menyentuh tabel yang sama pada setiap tenant.
--
-- `GUARDIAN_CHILD` yang paling menentukan di antara semuanya: ia satu-satunya
-- cakupan yang dipegang orang di LUAR institusi.

ALTER TABLE "{{TENANT_SCHEMA}}".role_data_scope
  DROP CONSTRAINT IF EXISTS ck_role_data_scope_level;

ALTER TABLE "{{TENANT_SCHEMA}}".role_data_scope
  ADD CONSTRAINT ck_role_data_scope_level CHECK (scope_level IN (
    -- Versi 5-9
    'PLATFORM','TENANT','LEGAL_ENTITY','BRAND','STORE','OUTLET','OUTLET_TERMINAL',
    'WAREHOUSE','FULFILLMENT_LOCATION','DEPARTMENT','TEAM','SELF',
    'ASSIGNED_TRIP','ASSIGNED_QUEUE','OWNERSHIP','API_SCOPE',
    'PAYMENT_PROVIDER_ACCOUNT',
    -- Versi 13 - pendidikan
    'INSTITUTION','CAMPUS','FACULTY','STUDY_PROGRAM','SCHOOL_UNIT','GRADE',
    'CLASS_GROUP','PESANTREN_UNIT','DORMITORY','ROOM','LEARNER_SELF',
    'GUARDIAN_CHILD'
  ));

ALTER TABLE "{{TENANT_SCHEMA}}".user_scope_assignment
  DROP CONSTRAINT IF EXISTS ck_user_scope_type;

ALTER TABLE "{{TENANT_SCHEMA}}".user_scope_assignment
  ADD CONSTRAINT ck_user_scope_type CHECK (scope_type IN (
    -- Versi 5-9
    'PLATFORM','TENANT','LEGAL_ENTITY','BRAND','STORE','OUTLET','OUTLET_TERMINAL',
    'WAREHOUSE','FULFILLMENT_LOCATION','DEPARTMENT','TEAM','SELF',
    'ASSIGNED_TRIP','ASSIGNED_QUEUE','OWNERSHIP','API_SCOPE',
    'PAYMENT_PROVIDER_ACCOUNT',
    -- Versi 13 - pendidikan
    'INSTITUTION','CAMPUS','FACULTY','STUDY_PROGRAM','SCHOOL_UNIT','GRADE',
    'CLASS_GROUP','PESANTREN_UNIT','DORMITORY','ROOM','LEARNER_SELF',
    'GUARDIAN_CHILD'
  ));

COMMENT ON CONSTRAINT ck_role_data_scope_level
  ON "{{TENANT_SCHEMA}}".role_data_scope IS
  'Tingkat batas data yang sah. Kembaran dari DataScopeCode pada role-profile.ts — keduanya wajib diubah bersama, dan uji education-data-scope.spec.ts menjaganya.';
