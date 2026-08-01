-- =========================================================================
-- VILLAGE — MEMASANG PEMICU AUDIT YANG SESUNGGUHNYA
-- =========================================================================
--
-- ## Koreksi
--
-- Migrasi D-1 sampai D-5 memuat blok pemasangan pemicu audit yang berbunyi:
--
--     IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_audit_row_change')
--
-- **Fungsi bernama itu tidak pernah ada.** Fungsi audit yang sesungguhnya
-- bernama `audit_row_trigger()` dan tinggal pada skema audit terpisah
-- (`<tenant>__audit`), sebagaimana dipasang `V008__audit_triggers.sql`.
--
-- Akibatnya: penjaga `IF EXISTS` selalu bernilai salah, seluruh blok itu
-- dilewati tanpa galat, dan **tidak satu pun tabel village yang benar-benar
-- diaudit** — meskipun komentar migrasi dan changelog menyatakan sebaliknya.
--
-- Kegagalannya senyap justru karena penjaganya. Blok yang dijaga `IF EXISTS`
-- tidak pernah mengeluh ketika syaratnya tidak terpenuhi; ia hanya diam. Itu
-- pilihan yang tepat untuk menghadapi skema uji yang tidak punya infrastruktur
-- audit, tetapi menjadi jebakan ketika nama yang dicari memang salah ketik.
--
-- Ditemukan oleh pengujian yang justru dimaksudkan membuktikan hal sebaliknya —
-- bahwa `village_proposal` diaudit sementara `village_complaint` tidak.
--
-- ## Mengapa V008 tidak memasangnya sendiri
--
-- V008 memasang pemicu dengan menelusuri seluruh tabel yang ada **pada saat ia
-- dijalankan**. Tabel village dibuat jauh sesudahnya, sehingga tidak pernah
-- masuk dalam penelusuran itu. Migrasi ini menjalankan pemasangan yang sama
-- untuk tabel berawalan `village_`.
--
-- ## Yang sengaja dikecualikan
--
-- `village_complaint` dan `village_aspiration` **tidak** dipasangi pemicu.
-- Pemicu audit menyalin nilai lama dan baru ke tabel audit, termasuk medan
-- identitas pelapor. Aduan yang pernah tersimpan terbuka lalu diubah menjadi
-- anonim akan meninggalkan salinan identitasnya di sana — dan anonimitas yang
-- bocor lewat jalur audit tetaplah bocor.
--
-- Perubahan statusnya tercatat pada `village_complaint_followup`, yang memang
-- untuk itu dan tidak pernah memuat identitas pelapor.
--
-- `village_resident_access_log` juga dikecualikan: ia sudah merupakan jejak,
-- dan mengaudit jejak menghasilkan jejak dari jejak tanpa menambah apa pun.

DO $install$
DECLARE
  r RECORD;
  dikecualikan TEXT[] := ARRAY[
    'village_complaint',
    'village_aspiration',
    'village_resident_access_log',
    'village_resident_history',
    'village_request_history',
    'village_complaint_followup',
    'village_profile_change'
  ];
BEGIN
  -- Bila skema audit belum ada — misalnya pada skema uji yang hanya memuat
  -- migrasi village — pemasangan dilewati. Kali ini penjaganya memeriksa hal
  -- yang benar-benar ada.
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Skema audit {{AUDIT_SCHEMA}} tidak ada; pemicu audit village dilewati.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'audit_row_trigger' AND n.nspname = '{{AUDIT_SCHEMA}}'
  ) THEN
    RAISE NOTICE 'Fungsi {{AUDIT_SCHEMA}}.audit_row_trigger() tidak ada; pemicu audit village dilewati.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = '{{TENANT_SCHEMA}}'
       AND c.relkind = 'r'
       AND c.relname LIKE 'village\_%'
       AND NOT (c.relname = ANY (dikecualikan))
       -- Hanya tabel yang punya kolom id; fungsi audit menyandarkan diri padanya.
       AND EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attname = 'id'
            AND a.attnum > 0 AND NOT a.attisdropped
       )
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
