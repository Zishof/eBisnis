-- =========================================================================
-- VILLAGE — BERKAS UNGGAHAN (FOTO BUKTI PENGADUAN)
-- =========================================================================
--
-- ## Mengapa village punya registri berkasnya sendiri
--
-- Yang tersedia pada Core adalah `MediaAsset`, dan ia tempat yang salah untuk
-- foto pengaduan warga karena tiga hal sekaligus:
--
-- 1. Ia berada pada skema **platform**, bukan skema penyewa. Foto pengaduan
--    Desa A akan duduk pada tabel yang sama dengan Desa B — meruntuhkan
--    pemisahan skema-per-penyewa yang menjadi dasar seluruh sistem ini.
-- 2. `is_public` bawaannya benar, dan ia punya `public_url`. Foto pengaduan
--    memperlihatkan rumah, wajah, pelat nomor, dan halaman orang.
-- 3. Ia pustaka media CMS — untuk gambar hero dan testimoni.
--
-- Rinciannya pada `docs/integration-requests/village/006-file-storage.md`.
--
-- ## Metadata WAJIB sudah dibuang sebelum baris ini ada
--
--     CHECK (metadata_stripped = TRUE)
--
-- Baris yang menyatakan metadatanya belum dibuang tidak dapat disimpan. Bukan
-- sekadar dilarang layanan: jalur impor, penyuntingan langsung, dan kode yang
-- ditulis kemudian sama-sama tertahan.
--
-- Alasannya bukan kerapian. Foto dari ponsel membawa koordinat GPS tempat ia
-- diambil dan nomor seri kameranya. Warga yang memotret pembuangan sampah
-- tetangganya tidak tahu bahwa ia melampirkan koordinat rumahnya sendiri — dan
-- membiarkannya membatalkan keputusan yang sudah diambil aplikasi warga, yang
-- sengaja mengirim lokasi kejadian yang ditunjuk warga, bukan posisi ponselnya.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".village_file_object (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_unit_id UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".village_unit (id) ON DELETE RESTRICT,

  -- Kunci pada penyimpanan. Berawalan skema penyewa, sehingga berkas dua desa
  -- tidak pernah berbagi direktori.
  storage_key     VARCHAR(512) NOT NULL,
  original_name   VARCHAR(160) NOT NULL,
  mime_type       VARCHAR(64) NOT NULL,
  size_bytes      INTEGER NOT NULL,
  checksum        VARCHAR(64),

  -- INTI. Tidak dapat bernilai salah.
  metadata_stripped BOOLEAN NOT NULL DEFAULT TRUE,
  -- Ukuran sebelum pembersihan, untuk menunjukkan bahwa pembersihannya memang
  -- terjadi. Berkas yang ukurannya tidak berubah sama sekali patut ditengok.
  original_size_bytes INTEGER,

  -- Apa yang dilekati berkas ini. Foto bukti pengaduan untuk saat ini.
  subject_type    VARCHAR(24) NOT NULL DEFAULT 'PENGADUAN',
  uploaded_by     UUID,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  is_sample       BOOLEAN NOT NULL DEFAULT FALSE,
  sample_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  -- Daftar izin, bukan daftar larangan. Hanya jenis yang metadatanya dapat
  -- dibuang dengan pasti oleh kode village.
  CONSTRAINT village_file_mime_allowed CHECK (mime_type IN ('image/jpeg', 'image/png')),
  CONSTRAINT village_file_size_sane CHECK (size_bytes > 0 AND size_bytes <= 8388608),
  CONSTRAINT village_file_subject_valid CHECK (subject_type IN ('PENGADUAN')),
  -- Berkas yang metadatanya belum dibuang tidak dapat tersimpan.
  CONSTRAINT village_file_metadata_must_be_stripped CHECK (metadata_stripped = TRUE),
  -- Pembersihan tidak pernah memperbesar berkas.
  CONSTRAINT village_file_stripping_never_grows
    CHECK (original_size_bytes IS NULL OR size_bytes <= original_size_bytes)
);

CREATE UNIQUE INDEX IF NOT EXISTS village_file_storage_key_unique
  ON "{{TENANT_SCHEMA}}".village_file_object (storage_key);

CREATE INDEX IF NOT EXISTS village_file_subject_idx
  ON "{{TENANT_SCHEMA}}".village_file_object (village_unit_id, subject_type, uploaded_at DESC);

-- ---------------------------------------------------------------------------
-- Menautkan bukti pengaduan ke registri berkas
-- ---------------------------------------------------------------------------
-- `village_complaint_evidence.file_object_id` sudah ada sejak D-5, tetapi belum
-- berelasi ke mana pun — kolom UUID yang menggantung. Sekarang ia menunjuk
-- tabel yang benar-benar ada, sehingga berkas yang dihapus tidak meninggalkan
-- bukti yang menunjuk ketiadaan.
DO $tautkan$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}'
       AND t.relname = 'village_complaint_evidence'
       AND c.conname = 'village_complaint_evidence_file_fk'
  ) THEN
    ALTER TABLE "{{TENANT_SCHEMA}}".village_complaint_evidence
      ADD CONSTRAINT village_complaint_evidence_file_fk
      FOREIGN KEY (file_object_id)
      REFERENCES "{{TENANT_SCHEMA}}".village_file_object (id) ON DELETE CASCADE;
  END IF;
END
$tautkan$;

-- Satu berkas dilekatkan pada satu bukti. Dua baris bukti yang menunjuk berkas
-- yang sama akan terhitung dua foto padahal fotonya satu.
CREATE UNIQUE INDEX IF NOT EXISTS village_complaint_evidence_file_unique
  ON "{{TENANT_SCHEMA}}".village_complaint_evidence (file_object_id)
  WHERE file_object_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Pemicu audit
-- ---------------------------------------------------------------------------
-- Registri berkas diaudit: pertanyaan "siapa mengunggah foto ini, dan kapan"
-- harus dapat dijawab ketika isinya dipersoalkan.
DO $install$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi audit tidak ada; pemicu audit berkas dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}' AND c.relkind = 'r'
       AND c.relname IN ('village_file_object', 'village_complaint_evidence')
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I',
      r.table_name, '{{TENANT_SCHEMA}}'
    );
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      r.table_name, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;
END
$install$;
