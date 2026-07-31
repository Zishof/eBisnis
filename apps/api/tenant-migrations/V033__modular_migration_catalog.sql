-- =============================================================================
-- V033 · Menyiapkan katalog migrasi modular
-- =============================================================================
--
-- Menjawab IR-001 dari sesi eKoperasi.
--
-- ## Yang diperbaiki
--
-- `schema_migration.version` bertipe `VARCHAR(16)`, dipilih ketika satu-satunya
-- bentuk versi yang ada adalah `V001`…`V0NN`. Katalog modular menuntut id yang
-- bertimestamp dan bernama modul supaya tabrakan antarvertikal mustahil:
--
--     20260731T160000__cooperative__profile_and_legality
--
-- Panjangnya 50 aksara. Kolomnya secara struktural tidak dapat menampungnya:
--
--     error: value too long for type character varying(16)
--
-- Tanpa pelebaran ini, katalog modular tidak dapat berjalan sama sekali —
-- sebaik apa pun rancangan penggabungan manifestnya.
--
-- ## Mengapa aman diterapkan pada skema yang sudah berisi data
--
-- Pelebaran `VARCHAR` tidak menulis ulang tabel dan tidak dapat membatalkan
-- baris yang sudah ada; setiap nilai yang muat pada `VARCHAR(16)` juga muat
-- pada `VARCHAR(128)`. Baris `V001`…`V032` yang sudah tercatat pada belasan
-- skema tetap apa adanya, dan karena kuncinya tidak berubah, tidak ada satu
-- migrasi pun yang dijalankan ulang.
--
-- Batas 128 sama dengan `MAX_MIGRATION_ID_LENGTH` pada `migration-catalog.ts`,
-- yang menolak id lebih panjang **saat pemuatan** — sebelum satu skema pun
-- disentuh.
-- =============================================================================

ALTER TABLE "{{TENANT_SCHEMA}}".schema_migration
  ALTER COLUMN version TYPE VARCHAR(128);

/*
 * Nama migrasi modul memuat nama modulnya, jadi 160 aksara mulai terasa sempit
 * bagi keterangan yang berarti. Dilebarkan sekalian, dengan alasan yang sama:
 * pelebaran tidak pernah membatalkan baris yang ada.
 */
ALTER TABLE "{{TENANT_SCHEMA}}".schema_migration
  ALTER COLUMN name TYPE VARCHAR(255);

/*
 * Kolom penanda modul, agar sebuah skema dapat menjawab "vertikal apa saja
 * yang terpasang di sini" tanpa mencocokkan pola pada teks versinya.
 *
 * Boleh kosong: itulah tanda migrasi inti. Menuliskan 'core' pada 32 baris
 * yang sudah ada berarti menulis ke tabel pembukuan migrasi dari dalam sebuah
 * migrasi, dan pembukuan yang menulis dirinya sendiri sulit dijelaskan bila
 * kelak ada yang tidak cocok.
 */
ALTER TABLE "{{TENANT_SCHEMA}}".schema_migration
  ADD COLUMN IF NOT EXISTS module VARCHAR(32);

CREATE INDEX IF NOT EXISTS ix_schema_migration_module
  ON "{{TENANT_SCHEMA}}".schema_migration (module)
  WHERE module IS NOT NULL;
