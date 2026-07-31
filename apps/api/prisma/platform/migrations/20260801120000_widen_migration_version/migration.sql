-- Melebarkan kunci versi migrasi agar id modular muat (IR-001).
--
-- Id migrasi modular berpola <timestamp>__<modul>__<keterangan>; yang pertama
-- milik koperasi panjangnya 50 aksara, sedangkan kolomnya VARCHAR(16).
--
-- Pelebaran VARCHAR tidak menulis ulang tabel dan tidak dapat membatalkan baris
-- yang sudah ada: setiap nilai yang muat pada VARCHAR(16) juga muat pada
-- VARCHAR(128). Karena kunci V001-V032 tidak berubah, tidak ada satu migrasi
-- tenant pun yang dijalankan ulang.

ALTER TABLE "platform"."schema_migration_catalog"
  ALTER COLUMN "version" TYPE VARCHAR(128);

ALTER TABLE "platform"."schema_migration_catalog"
  ALTER COLUMN "name" TYPE VARCHAR(255);

ALTER TABLE "platform"."tenant_schema_migration_history"
  ALTER COLUMN "migration_version" TYPE VARCHAR(128);
