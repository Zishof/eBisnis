-- =========================================================================
-- H054 — PERBAIKAN: HANYA TABEL YANG BENAR-BENAR DAPAT DISEMBUNYIKAN
-- =========================================================================
--
-- Fase H-11. Aditif seluruhnya; H052 tidak disunting.
--
-- ## Cacat yang diperbaiki
--
-- H052 mengisi `health_sample_table` dengan **setiap** tabel yang punya kolom
-- penanda contoh — tiga puluh empat tabel. Tetapi "membersihkan" pada fase ini
-- berarti **menyembunyikan**, dan menyembunyikan menuntut kolom `deleted_at`.
--
-- Hanya sepuluh dari ketiga puluh empat tabel itu punya `deleted_at`.
--
-- Akibatnya bukan galat. Pembersihan pada dua puluh empat tabel sisanya akan
-- berjalan, melaporkan keberhasilan, dan **tidak menyembunyikan apa pun** —
-- jenis kegagalan yang paling buruk, sebab ia menghasilkan laporan yang
-- berkata "selesai" dan keadaan yang tidak berubah. Orang yang membacanya akan
-- menyerahkan sistemnya kepada penggunanya dengan data contoh masih di
-- dalamnya.
--
-- ## Perbaikannya, dan mengapa bukan menambahkan kolom
--
-- Menambahkan `deleted_at` pada dua puluh empat tabel klinis adalah perubahan
-- yang jauh lebih besar daripada yang dituntut H-11, dan ia menyentuh tabel
-- yang dipakai setiap modul sejak H-2. Perubahan sebesar itu tidak boleh
-- diselipkan ke dalam fase data contoh.
--
-- Yang dilakukan sebagai gantinya: **daftar izinnya dipersempit kepada yang
-- benar-benar dapat disembunyikan**, dan sisanya dicatat sebagai keterbatasan
-- yang dinyatakan — bukan sebagai kemampuan yang berpura-pura ada.

ALTER TABLE "{{TENANT_SCHEMA}}".health_sample_table
  ADD COLUMN IF NOT EXISTS hideable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS not_hideable_reason TEXT;

/*
 * Menandai yang TIDAK dapat disembunyikan, beserta sebabnya — dibaca dari
 * information_schema, bukan didaftar tangan.
 */
UPDATE "{{TENANT_SCHEMA}}".health_sample_table st
   SET hideable = FALSE,
       not_hideable_reason =
         'Tabel ini tidak punya kolom deleted_at, sehingga barisnya tidak dapat disembunyikan '
         || 'tanpa menghapusnya. Menghapusnya dilarang; menambahkan kolomnya adalah perubahan '
         || 'yang menyentuh setiap modul sejak H-2 dan tidak boleh diselipkan ke dalam fase '
         || 'data contoh. Data contoh pada tabel ini tetap bertanda dan tetap dapat disaring '
         || 'kueri mana pun yang memeriksa penandanya.'
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = '{{TENANT_SCHEMA}}'
      AND c.table_name = st.table_name
      AND c.column_name = 'deleted_at'
 );

/*
 * DAFTAR IZIN PEMBERSIHAN HANYA MEMUAT YANG HIDEABLE.
 *
 * Ditegakkan tampilan tersendiri supaya kueri pembersih tidak dapat keliru
 * membaca tabel yang lengkap. Nama tampilannya sengaja panjang dan menyebutkan
 * syaratnya.
 */
CREATE OR REPLACE VIEW "{{TENANT_SCHEMA}}".health_sample_table_cleanable AS
SELECT id, table_name, sample_flag_column, clean_order, note
  FROM "{{TENANT_SCHEMA}}".health_sample_table
 WHERE hideable = TRUE;

COMMENT ON VIEW "{{TENANT_SCHEMA}}".health_sample_table_cleanable IS
  'Hanya tabel yang benar-benar dapat disembunyikan. Pembersihan yang berjalan pada tabel tanpa '
  'deleted_at akan melaporkan keberhasilan dan tidak menyembunyikan apa pun — laporan yang '
  'berkata selesai dengan keadaan yang tidak berubah.';
