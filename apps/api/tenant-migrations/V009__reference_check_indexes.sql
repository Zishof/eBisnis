-- =========================================================================
-- V009 — INDEX PENDUKUNG REFERENCE CHECK SEBELUM HAPUS PERMANEN
--
-- Sebelum purge dijalankan, MasterLifecycleService memeriksa setiap tabel yang
-- mereferensikan record master (lihat MASTER_RESOURCES[].references) dengan
-- query berbentuk:
--
--   SELECT count(*) FROM <tabel_perujuk> WHERE <kolom_fk> = $1
--
-- PostgreSQL tidak membuat index otomatis pada sisi anak foreign key, sehingga
-- tanpa index di bawah ini setiap pemeriksaan referensi melakukan sequential
-- scan pada tabel transaksi yang bisa sangat besar (stock_movement, pos_sale).
-- Index yang sama juga dipakai saat menghapus induk (penegakan ON DELETE) dan
-- saat join dari sisi induk pada laporan.
--
-- Daftar ini dihasilkan dengan membandingkan MASTER_RESOURCES[].references
-- terhadap katalog index nyata; lihat docs/database/index-catalog.md bagian
-- "Foreign key tanpa index pendukung".
-- =========================================================================

-- Katalog produk -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_base_uom
  ON "{{TENANT_SCHEMA}}".product (base_uom_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_brand_ref
  ON "{{TENANT_SCHEMA}}".product (product_brand_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_tax_category
  ON "{{TENANT_SCHEMA}}".product (tax_category_id)
  WHERE deleted_at IS NULL;

-- Mitra dagang -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_supplier_group_ref
  ON "{{TENANT_SCHEMA}}".supplier (supplier_group_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_payment_term
  ON "{{TENANT_SCHEMA}}".supplier (payment_term_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_group_ref
  ON "{{TENANT_SCHEMA}}".customer (customer_group_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_payment_term
  ON "{{TENANT_SCHEMA}}".customer (payment_term_id)
  WHERE deleted_at IS NULL;

-- Organisasi ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_outlet_outlet_type
  ON "{{TENANT_SCHEMA}}".outlet (outlet_type_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_warehouse_type
  ON "{{TENANT_SCHEMA}}".warehouse (warehouse_type_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_position_department
  ON "{{TENANT_SCHEMA}}".job_position (department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_department
  ON "{{TENANT_SCHEMA}}".employee (department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_job_position
  ON "{{TENANT_SCHEMA}}".employee (job_position_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_role_assignment_role
  ON "{{TENANT_SCHEMA}}".user_role_assignment (role_id);

-- Inventori ----------------------------------------------------------------
-- stock_movement adalah ledger immutable dan bisa berukuran sangat besar;
-- index ini menjaga reference check UOM tetap konstan.
CREATE INDEX IF NOT EXISTS idx_stock_movement_uom
  ON "{{TENANT_SCHEMA}}".stock_movement (uom_id);

CREATE INDEX IF NOT EXISTS idx_stock_policy_product
  ON "{{TENANT_SCHEMA}}".stock_policy (product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_alert_stock_policy
  ON "{{TENANT_SCHEMA}}".stock_alert (stock_policy_id);

-- Pembelian ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_request_order_generated_policy
  ON "{{TENANT_SCHEMA}}".request_order (generated_by_policy_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_warehouse
  ON "{{TENANT_SCHEMA}}".purchase_order (warehouse_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_line_uom
  ON "{{TENANT_SCHEMA}}".purchase_order_line (uom_id);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_supplier
  ON "{{TENANT_SCHEMA}}".goods_receipt (supplier_id);

-- Penjualan dan POS --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pos_sale_customer
  ON "{{TENANT_SCHEMA}}".pos_sale (customer_id);

CREATE INDEX IF NOT EXISTS idx_pos_payment_payment_method
  ON "{{TENANT_SCHEMA}}".pos_payment (payment_method_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_customer
  ON "{{TENANT_SCHEMA}}".sales_order (customer_id);
