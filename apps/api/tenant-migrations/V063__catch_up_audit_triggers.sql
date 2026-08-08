-- =========================================================================
-- V063 — MELENGKAPI TRIGGER AUDIT PADA TABEL YANG DIBUAT SETELAH V008
-- =========================================================================
--
-- V008 memasang trg_audit_<table> pada SETIAP tabel tenant yang punya kolom
-- id, TETAPI hanya sekali -- pada tabel yang sudah ada SAAT V008 dijalankan.
-- Setiap tabel yang dibuat migrasi SESUDAH V008 (mis. inventory_ap_payment,
-- inventory_ar_receipt dari V047) tidak pernah tertangkap DO block itu, dan
-- kecuali migrasinya sendiri secara eksplisit menambah trigger audit (pola
-- yang TIDAK konsisten diikuti), tabel itu diam-diam tidak punya jejak audit
-- sama sekali -- walau kode aplikasi (`auditOf()`) menyiratkan seharusnya
-- ada, karena mekanismenya berbasis trigger DB yang membaca `SET LOCAL
-- app.module_code/app.action_code`, bukan penulisan langsung dari kode.
--
-- Ditemukan lewat UAT nyata: `inventory_ap_payment` (create/post/reverse)
-- tidak menghasilkan satu pun baris `audit_event`, sementara `purchase_order`
-- dan `goods_receipt` (tabel dari sebelum V008) pada alur kerja YANG SAMA
-- tercatat benar. Lihat docs/pos-inventory-parity/evidence/screen-24/uat.md.
--
-- Migrasi ini MENGULANG blok instalasi V008 apa adanya -- aman dijalankan
-- ulang (DROP TRIGGER IF EXISTS + CREATE TRIGGER) bahkan pada tabel yang
-- sudah punya triggernya; efeknya hanya melengkapi tabel yang selama ini
-- terlewat, tanpa mengubah perilaku tabel yang sudah benar.
-- =========================================================================

DO $install$
DECLARE
  r RECORD;
  excluded TEXT[] := ARRAY[
    'schema_migration', 'idempotency_record', 'sync_outbox', 'sync_inbox',
    'job_execution', 'data_export_log', 'notification', 'starter_data_marker'
  ];
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '{{TENANT_SCHEMA}}'
      AND c.relkind = 'r'
      AND NOT (c.relname = ANY (excluded))
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped
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
END;
$install$;
