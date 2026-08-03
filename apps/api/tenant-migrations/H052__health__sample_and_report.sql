-- =========================================================================
-- H052 — DATA CONTOH, PEMBERSIHANNYA, DAN LAPORAN
-- =========================================================================
--
-- Fase H-11. Aditif seluruhnya.
--
-- ## Dua larangan yang menentukan seluruh migrasi ini
--
-- > **Jangan hard-delete sample data. Jangan menghapus data real saat cleanup
-- > sample.**
--
-- Keduanya terdengar mirip dan keduanya berbeda sama sekali.
--
-- Yang pertama tentang **cara**: data contoh disembunyikan, bukan dihapus.
-- Penghapusan keras menghilangkan pula jejak audit yang menunjuknya.
--
-- Yang kedua tentang **sasaran**, dan ia jauh lebih berbahaya: pembersihan yang
-- salah sasaran menghapus rekam medis sungguhan. Ia tidak menimbulkan galat,
-- tidak terlihat pada pengujian mana pun yang memakai basis data kosong, dan
-- ditemukan oleh perawat yang mencari catatan pasiennya.
--
-- Karena itu migrasi ini memasang **daftar izin tabel** sebagai baris basis
-- data, bukan sebagai tetapan pada kode: daftar yang ada di kode dapat diubah
-- seseorang bersamaan dengan mengubah kueri pembersihnya, dan keduanya akan
-- lolos telaah sebagai satu perubahan yang tampak wajar.

-- ---------------------------------------------------------------------------
-- Kumpulan penyemaian
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_sample_run (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  run_code        VARCHAR(64) NOT NULL,
  profile         VARCHAR(16) NOT NULL,
  /*
   * BENIH, DAN IA WAJIB.
   *
   * Data contoh yang berbeda setiap kali disemai tidak dapat dipakai
   * mendemonstrasikan apa pun dua kali — dan yang mendemonstrasikannya akan
   * berkata "kemarin angkanya lain" di depan calon penggunanya.
   */
  seed            VARCHAR(64) NOT NULL,

  row_total       INTEGER NOT NULL DEFAULT 0,
  table_count     INTEGER NOT NULL DEFAULT 0,

  seeded_by       UUID,
  seeded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  /*
   * DIBERSIHKAN = DISEMBUNYIKAN.
   *
   * Perhatikan namanya: `hidden_at`, bukan `deleted_at`. Nama kolom adalah
   * dokumentasi yang tidak dapat kedaluwarsa.
   */
  hidden_at       TIMESTAMPTZ,
  hidden_by       UUID,
  hide_reason     TEXT,
  hidden_row_count INTEGER,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT sample_run_profile_valid CHECK (profile IN ('MINIMAL', 'STANDARD', 'RICH')),
  CONSTRAINT sample_run_seed_meaningful CHECK (length(trim(seed)) >= 4),
  CONSTRAINT sample_run_counts_nonneg CHECK (row_total >= 0 AND table_count >= 0),
  CONSTRAINT sample_run_hide_complete CHECK (
    hidden_at IS NULL
    OR (hidden_by IS NOT NULL AND hide_reason IS NOT NULL AND length(trim(hide_reason)) >= 10)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sample_run_code
  ON "{{TENANT_SCHEMA}}".health_sample_run (run_code);

/*
 * KUMPULAN PENYEMAIAN TIDAK DAPAT DIHAPUS.
 *
 * Ia satu-satunya catatan tentang baris mana yang contoh. Menghapusnya membuat
 * seluruh baris bertanda contoh menjadi yatim — dan yang yatim akan disangka
 * sungguhan oleh orang berikutnya.
 */
DROP TRIGGER IF EXISTS trg_sample_run_no_delete ON "{{TENANT_SCHEMA}}".health_sample_run;
CREATE TRIGGER trg_sample_run_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".health_sample_run
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Daftar izin tabel — SEBAGAI BARIS, BUKAN TETAPAN PADA KODE
-- ---------------------------------------------------------------------------
/*
 * Mengapa sebagai baris?
 *
 * Daftar yang ada di kode dapat diubah seseorang BERSAMAAN dengan mengubah
 * kueri pembersihnya, dan keduanya akan lolos telaah sebagai satu perubahan
 * yang tampak wajar. Daftar yang ada di basis data menuntut migrasi tersendiri
 * — dan migrasi tersendiri dibaca orang lain.
 *
 * Setiap barisnya menyebutkan KOLOM PENANDANYA, sebab tabel-tabel ini tidak
 * seragam: sebagian memakai `is_sample`, sebagian `is_sample_data`. Menebak
 * yang mana akan menghasilkan kueri yang menyentuh seluruh barisnya.
 */
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_sample_table (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      VARCHAR(120) NOT NULL,
  sample_flag_column VARCHAR(64) NOT NULL,
  clean_order     INTEGER NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sample_table_flag_valid CHECK (
    sample_flag_column IN ('is_sample', 'is_sample_data')
  ),
  CONSTRAINT sample_table_order_positive CHECK (clean_order >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sample_table_name
  ON "{{TENANT_SCHEMA}}".health_sample_table (table_name);

-- Diisi menurut kolom penanda yang BENAR-BENAR ADA pada tiap tabel — dibaca
-- dari information_schema, bukan ditebak.
DO $$
DECLARE
  t RECORD;
  urutan INTEGER := 0;
BEGIN
  FOR t IN
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
     WHERE c.table_schema = '{{TENANT_SCHEMA}}'
       AND c.column_name IN ('is_sample', 'is_sample_data')
       AND (c.table_name LIKE 'health\_%' OR c.table_name IN
            ('patient', 'lab_result', 'lab_order', 'rx_prescription', 'rx_dispensing'))
     ORDER BY c.table_name
  LOOP
    urutan := urutan + 1;
    INSERT INTO "{{TENANT_SCHEMA}}".health_sample_table
      (table_name, sample_flag_column, clean_order, note)
    VALUES (t.table_name, t.column_name, urutan,
            'Kolom penanda dibaca dari information_schema, bukan ditebak.')
    ON CONFLICT (table_name) DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Hitungan per tabel pada tiap penyemaian
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".health_sample_row_count (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_run_id   UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_sample_run (id) ON DELETE RESTRICT,
  table_name      VARCHAR(120) NOT NULL,

  sample_rows     INTEGER NOT NULL DEFAULT 0,
  /*
   * BARIS SUNGGUHAN, DICATAT SEBELUM DAN SESUDAH.
   *
   * Inilah saksi yang tidak dapat dibantah. Bila keduanya berbeda, pembersihan
   * menyentuh data sungguhan — dan itu bukan cacat yang dapat ditunda.
   */
  real_rows_before INTEGER,
  real_rows_after INTEGER,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sample_count_nonneg CHECK (
    sample_rows >= 0
    AND (real_rows_before IS NULL OR real_rows_before >= 0)
    AND (real_rows_after IS NULL OR real_rows_after >= 0)
  ),
  /*
   * BARIS SUNGGUHAN TIDAK BOLEH BERUBAH.
   *
   * Ditegakkan basis data, bukan hanya diperiksa program. Program yang
   * memeriksanya dapat dilewati dengan memanggil kuerinya langsung; constraint
   * ini tidak.
   */
  CONSTRAINT sample_count_real_unchanged CHECK (
    real_rows_before IS NULL OR real_rows_after IS NULL
    OR real_rows_before = real_rows_after
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sample_count
  ON "{{TENANT_SCHEMA}}".health_sample_row_count (sample_run_id, table_name);

DROP TRIGGER IF EXISTS trg_sample_count_no_delete ON "{{TENANT_SCHEMA}}".health_sample_row_count;
CREATE TRIGGER trg_sample_count_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".health_sample_row_count
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK ADA
-- ---------------------------------------------------------------------------
/*
 * Tidak ada fungsi, prosedur, maupun trigger yang menjalankan DELETE pada tabel
 * klinis mana pun.
 *
 * Pembersihan data contoh dilakukan lapisan layanan dengan UPDATE — mengubah
 * penanda, bukan menghapus baris — dan setiap kueri pembersihnya menyertakan
 * syarat penanda contoh yang dibaca dari `health_sample_table`.
 *
 * Menaruh pembersihnya di sini sebagai fungsi basis data akan membuatnya dapat
 * dipanggil siapa pun yang memegang koneksi, tanpa melewati satu pun
 * pemeriksaan hak akses — dan yang memegang koneksi pada malam hari biasanya
 * sedang menyelesaikan masalah lain dengan tergesa.
 */

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_sample_run', 'health_sample_table',
                           'health_sample_row_count'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
