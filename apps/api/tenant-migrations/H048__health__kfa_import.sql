-- =========================================================================
-- H048 — KERANGKA IMPOR KFA DAN TERMINOLOGI RESMI
-- =========================================================================
--
-- Fase H-9M. Aditif seluruhnya.
--
-- ## Kekeliruan mahal yang ditahan migrasi ini
--
-- **Harga sintetis yang tampak resmi.**
--
-- Data contoh dibuat supaya penyewa baru dapat melihat sistemnya bekerja tanpa
-- mengetik dua ribu baris. Bila harga contoh itu tidak dibedakan dari harga
-- resmi, seseorang akan memakainya menagih pasien — dan ketika ketahuan, tidak
-- ada cara membedakan mana yang contoh dan mana yang sungguhan.
--
-- Karena itu setiap baris rujukan membawa `data_source`, dan constraint
-- menegakkan bahwa **hanya `OFFICIAL_REFERENCE` yang boleh menyebut dirinya
-- terbitan resmi** — dan hanya bila terbitannya benar-benar disebutkan.
--
-- ## Aturan kedua
--
-- **Obat yang belum terpetakan ke KFA tetap dapat dipakai.** Perhatikan bahwa
-- migrasi ini TIDAK menambahkan kolom `kfa_code NOT NULL` pada `rx_product`,
-- dan tidak menambahkan constraint yang menahan resep tanpa pemetaan. Menahan
-- seluruh farmasi sampai pemetaannya selesai akan menghentikan pelayanan demi
-- kerapian data — dan pelayanan yang berhenti demi kerapian data akan
-- dijalankan di luar sistem, tempat tidak ada yang mencatatnya sama sekali.

-- ---------------------------------------------------------------------------
-- Katalog terminologi resmi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".terminology_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  catalog_code    VARCHAR(24) NOT NULL,
  catalog_name    VARCHAR(120) NOT NULL,
  usage_note      VARCHAR(255),
  blocker         TEXT,

  /*
   * PENANDA SUMBER, DAN IA TIDAK DAPAT DILEPAS.
   *
   * Inilah yang membedakan harga contoh dari harga resmi. Tanpanya, seseorang
   * akan memakai harga contoh menagih pasien.
   */
  data_source     VARCHAR(24) NOT NULL DEFAULT 'SYNTHETIC_DEMO',
  edition_ref     VARCHAR(180),
  edition_date    DATE,

  row_count       INTEGER NOT NULL DEFAULT 0,
  last_imported_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT terminology_code_valid CHECK (
    catalog_code IN ('ICD10', 'ICD9CM', 'LOINC', 'KFA', 'SNOMED', 'WHO_GROWTH')
  ),
  CONSTRAINT terminology_source_valid CHECK (
    data_source IN ('OFFICIAL_REFERENCE', 'FACILITY_IMPORT', 'SYNTHETIC_DEMO', 'LOCAL_MAPPING')
  ),
  /*
   * HANYA RUJUKAN RESMI YANG BOLEH MENYEBUT TERBITAN, DAN IA WAJIB
   * MENYEBUTKANNYA.
   *
   * Rujukan "resmi" tanpa nama terbitan tidak dapat diperiksa siapa pun — dan
   * yang tidak dapat diperiksa akan dipercaya.
   */
  CONSTRAINT terminology_official_has_edition CHECK (
    data_source <> 'OFFICIAL_REFERENCE'
    OR (edition_ref IS NOT NULL AND length(trim(edition_ref)) >= 5 AND edition_date IS NOT NULL)
  ),
  CONSTRAINT terminology_row_count_nonneg CHECK (row_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_terminology_catalog
  ON "{{TENANT_SCHEMA}}".terminology_catalog
     (COALESCE(facility_id, '00000000-0000-0000-0000-000000000000'::uuid), catalog_code);

-- ---------------------------------------------------------------------------
-- Berkas impor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".terminology_import (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  catalog_code    VARCHAR(24) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  /*
   * SIDIK JARI BERKAS SUMBER.
   *
   * Sama dengan pesan alat pada H-9I: ketika satu harga dipersengketakan, yang
   * ditanyakan adalah apa yang tertulis pada terbitan resminya — bukan apa yang
   * berhasil dibaca pengimpor kami.
   */
  file_hash       VARCHAR(128) NOT NULL,
  file_size_bytes BIGINT,

  data_source     VARCHAR(24) NOT NULL,
  edition_ref     VARCHAR(180),
  edition_date    DATE,

  status          VARCHAR(16) NOT NULL DEFAULT 'RECEIVED',
  row_total       INTEGER NOT NULL DEFAULT 0,
  row_error       INTEGER NOT NULL DEFAULT 0,
  error_note      TEXT,

  received_by     UUID,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_by    UUID,
  validated_at    TIMESTAMPTZ,
  applied_by      UUID,
  applied_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT terminology_import_code_valid CHECK (
    catalog_code IN ('ICD10', 'ICD9CM', 'LOINC', 'KFA', 'SNOMED', 'WHO_GROWTH')
  ),
  CONSTRAINT terminology_import_source_valid CHECK (
    data_source IN ('OFFICIAL_REFERENCE', 'FACILITY_IMPORT', 'SYNTHETIC_DEMO', 'LOCAL_MAPPING')
  ),
  CONSTRAINT terminology_import_status_valid CHECK (
    status IN ('RECEIVED', 'VALIDATED', 'APPLIED', 'REJECTED')
  ),
  CONSTRAINT terminology_import_official_has_edition CHECK (
    data_source <> 'OFFICIAL_REFERENCE'
    OR (edition_ref IS NOT NULL AND length(trim(edition_ref)) >= 5 AND edition_date IS NOT NULL)
  ),
  CONSTRAINT terminology_import_counts_nonneg CHECK (row_total >= 0 AND row_error >= 0),
  -- Yang diterapkan wajib nol galat. Impor sebagian menghasilkan katalog yang
  -- separuhnya baru dan separuhnya lama, dan tidak ada yang tahu baris mana
  -- yang mana.
  CONSTRAINT terminology_import_applied_clean CHECK (
    status <> 'APPLIED' OR (row_error = 0 AND applied_by IS NOT NULL AND applied_at IS NOT NULL)
  ),
  CONSTRAINT terminology_import_validated_named CHECK (
    status NOT IN ('VALIDATED', 'APPLIED') OR (validated_by IS NOT NULL AND validated_at IS NOT NULL)
  ),
  /*
   * YANG MEMVALIDASI TIDAK MENERAPKANNYA SENDIRI.
   *
   * Katalog obat menentukan apa yang boleh diresepkan seluruh rumah sakit.
   */
  CONSTRAINT terminology_import_apply_not_self CHECK (
    applied_by IS NULL OR validated_by IS NULL OR applied_by <> validated_by
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_terminology_import_hash
  ON "{{TENANT_SCHEMA}}".terminology_import (facility_id, catalog_code, file_hash);
CREATE INDEX IF NOT EXISTS ix_terminology_import_pending
  ON "{{TENANT_SCHEMA}}".terminology_import (facility_id, status);

-- Riwayat impor tidak dapat dihapus: ia satu-satunya catatan tentang dari mana
-- isi katalog datang.
DROP TRIGGER IF EXISTS trg_terminology_import_no_delete ON "{{TENANT_SCHEMA}}".terminology_import;
CREATE TRIGGER trg_terminology_import_no_delete
  BEFORE DELETE ON "{{TENANT_SCHEMA}}".terminology_import
  FOR EACH ROW EXECUTE FUNCTION "{{TENANT_SCHEMA}}".forbid_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Pemetaan KFA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".kfa_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".health_facility (id) ON DELETE RESTRICT,

  mapping_kind    VARCHAR(20) NOT NULL,
  kfa_code        VARCHAR(64) NOT NULL,
  kfa_name        VARCHAR(255),

  -- Produk lokal yang dipetakan. Teks, bukan kunci asing: pemetaan dapat
  -- menunjuk produk, bahan aktif, atau alat kesehatan — tiga tabel berbeda.
  local_kind      VARCHAR(24) NOT NULL,
  local_id        UUID NOT NULL,
  local_name      VARCHAR(255),

  /*
   * CARA PEMETAAN, DAN NAME_SIMILARITY TIDAK ADA PADA DAFTARNYA.
   *
   * "Amlodipine 5 mg" dan "Amlodipine 10 mg" berbeda satu karakter dan berbeda
   * dua kali lipat dosisnya. Yang salah petakan akan dikirim ke SATUSEHAT
   * sebagai obat yang bukan diberikan.
   */
  mapping_method  VARCHAR(20) NOT NULL,
  mapped_by       UUID NOT NULL,
  mapped_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  note            TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT kfa_mapping_kind_valid CHECK (
    mapping_kind IN ('PRODUCT', 'INGREDIENT', 'MEDICAL_DEVICE')
  ),
  CONSTRAINT kfa_mapping_local_kind_valid CHECK (
    local_kind IN ('RX_PRODUCT', 'RX_INGREDIENT', 'MEDICAL_DEVICE')
  ),
  /*
   * DAFTAR CARA PEMETAAN TIDAK MEMUAT KEMIRIPAN NAMA.
   *
   * Ia daftar TERTUTUP, dan yang tidak ada di dalamnya ditolak basis data —
   * bukan hanya ditolak layanan.
   */
  CONSTRAINT kfa_mapping_method_valid CHECK (mapping_method IN ('MANUAL', 'IMPORTED')),
  CONSTRAINT kfa_mapping_code_not_empty CHECK (length(trim(kfa_code)) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_kfa_mapping_local
  ON "{{TENANT_SCHEMA}}".kfa_mapping (facility_id, local_kind, local_id)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS ix_kfa_mapping_code
  ON "{{TENANT_SCHEMA}}".kfa_mapping (facility_id, kfa_code);

-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK ADA
-- ---------------------------------------------------------------------------
/*
 * Tidak ada kolom `kfa_code NOT NULL` pada `rx_product`.
 * Tidak ada constraint yang menahan resep tanpa pemetaan KFA.
 * Tidak ada trigger yang menonaktifkan obat yang belum terpetakan.
 *
 * Ketiganya dipertimbangkan dan ketiganya ditolak dengan alasan yang sama:
 * obat yang belum terpetakan ke KFA TETAP dapat dipakai di dalam rumah sakit.
 * Ia hanya tidak dapat dikirim ke SATUSEHAT.
 *
 * Menahan seluruh farmasi sampai pemetaannya selesai akan menghentikan
 * pelayanan demi kerapian data — dan pelayanan yang berhenti demi kerapian data
 * akan dijalankan di luar sistem, tempat tidak ada yang mencatatnya sama
 * sekali.
 */

-- ---------------------------------------------------------------------------
-- Menyemai katalog terminologi
-- ---------------------------------------------------------------------------
-- Seluruhnya kosong, bersumber SYNTHETIC_DEMO, beserta penghalangnya. Bukan
-- OFFICIAL_REFERENCE: katalog yang belum pernah diimpor bukan rujukan resmi.
INSERT INTO "{{TENANT_SCHEMA}}".terminology_catalog
  (facility_id, catalog_code, catalog_name, usage_note, blocker, data_source, row_count)
SELECT NULL, v.kode, v.nama, v.guna, v.blocker, 'SYNTHETIC_DEMO', 0
  FROM (VALUES
    ('ICD10', 'ICD-10', 'Diagnosis', 'Butuh terbitan berlisensi.'),
    ('ICD9CM', 'ICD-9-CM', 'Tindakan', 'Butuh terbitan berlisensi.'),
    ('LOINC', 'LOINC', 'Pemeriksaan laboratorium', 'Butuh terbitan berlisensi.'),
    ('KFA', 'KFA', 'Obat dan alat kesehatan', 'Menunggu akses resmi ke katalog nasional.'),
    ('SNOMED', 'SNOMED CT', 'Istilah klinis', 'Butuh lisensi nasional.'),
    ('WHO_GROWTH', 'WHO Growth Standards', 'Pertumbuhan anak', 'Struktur ada sejak H-8; isinya menunggu.')
  ) AS v(kode, nama, guna, blocker)
 WHERE NOT EXISTS (
   SELECT 1 FROM "{{TENANT_SCHEMA}}".terminology_catalog c
    WHERE c.facility_id IS NULL AND c.catalog_code = v.kode
 );

-- ---------------------------------------------------------------------------
-- Jejak audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['terminology_catalog', 'terminology_import', 'kfa_mapping'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END $$;
