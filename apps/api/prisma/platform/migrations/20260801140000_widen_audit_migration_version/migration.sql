-- Kolom ketiga yang menyimpan versi migrasi, terlewat dari pelebaran V033.
--
-- platform__audit.audit_schema_migration menerima jejak setiap migrasi yang
-- berhasil. Selama kolomnya VARCHAR(16), migrasi modul pertama pada penyewa
-- baru berhasil diterapkan lalu gagal saat dicatat — dan seluruh provisioning
-- batal.

ALTER TABLE "platform__audit"."audit_schema_migration"
  ALTER COLUMN "migration_version" TYPE VARCHAR(128);
