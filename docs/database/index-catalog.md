# Katalog Index

> Berkas ini dihasilkan otomatis oleh `pnpm docs:generate` dari hasil introspeksi
> PostgreSQL. Jangan diedit manual — perubahan akan hilang pada generate berikutnya.

- Dihasilkan: `2026-07-30T10:47:45.433Z`
- Schema control plane: `platform`, `platform__audit`
- Schema tenant contoh: `demo`, `demo__audit`

Setiap index dicantumkan beserta definisi lengkap. Kolom **Jenis** membedakan primary key, unique constraint, dan index pendukung query.

## Schema `demo`

Total 395 index pada 115 tabel.

| Tabel | Index | Jenis | Kolom | Ukuran |
| --- | --- | --- | --- | --- |
| `account_type` | `account_type_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `account_type` | `ix_account_type_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `account_type` | `ux_account_type_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `address` | `address_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `address` | `ix_address_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `address` | `ix_address_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `address` | `ux_address_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `app_setting` | `app_setting_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `app_setting` | `ix_app_setting_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `app_setting` | `ix_app_setting_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `app_setting` | `ux_app_setting_code` | UNIQUE | `(scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), code) WHER…` | 16 kB |
| `backorder_purchase_order_link` | `backorder_purchase_order_link_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `backorder_purchase_order_link` | `ux_backorder_po_link` | UNIQUE | `(backorder_id, purchase_order_id)` | 8192 bytes |
| `backorder_supplier_decision` | `backorder_supplier_decision_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `backorder_supplier_decision` | `ix_backorder_decision` | INDEX | `(backorder_id)` | 8192 bytes |
| `bill_of_material` | `bill_of_material_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `bill_of_material` | `ix_bom_product` | INDEX | `(product_id, status)` | 8192 bytes |
| `bill_of_material` | `ix_bom_sample` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `bill_of_material` | `ux_bom_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `bill_of_material_item` | `bill_of_material_item_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `bill_of_material_item` | `ix_bom_item_material` | INDEX | `(material_product_id)` | 8192 bytes |
| `bill_of_material_item` | `ux_bom_item` | UNIQUE | `(bill_of_material_id, line_no)` | 8192 bytes |
| `brand` | `brand_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `brand` | `ix_brand_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `brand` | `ix_brand_entity` | INDEX | `(legal_entity_id)` | 16 kB |
| `brand` | `ix_brand_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `brand` | `ux_brand_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `business_group` | `business_group_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `business_group` | `ix_business_group_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `business_group` | `ix_business_group_parent` | INDEX | `(parent_id, sort_order)` | 16 kB |
| `business_group` | `ix_business_group_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `business_group` | `ux_business_group_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `carrier` | `carrier_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `carrier` | `ix_carrier_sample` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `carrier` | `ux_carrier_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `cash_drawer_movement` | `cash_drawer_movement_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `cash_drawer_movement` | `ix_cash_drawer_shift` | INDEX | `(shift_id, occurred_at)` | 8192 bytes |
| `chart_of_account` | `chart_of_account_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `chart_of_account` | `ix_coa_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `chart_of_account` | `ix_coa_parent` | INDEX | `(parent_id, sort_order)` | 16 kB |
| `chart_of_account` | `ix_coa_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `chart_of_account` | `ux_coa_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `customer` | `customer_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `customer` | `idx_customer_group_ref` | INDEX | `(customer_group_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `customer` | `idx_customer_payment_term` | INDEX | `(payment_term_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `customer` | `ix_customer_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `customer` | `ix_customer_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `customer` | `ux_customer_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `customer_group` | `customer_group_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `customer_group` | `ix_customer_group_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `customer_group` | `ux_customer_group_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `data_export_log` | `data_export_log_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `data_export_log` | `ix_data_export_log_time` | INDEX | `(exported_at)` | 8192 bytes |
| `department` | `department_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `department` | `ix_department_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `department` | `ix_department_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `department` | `ux_department_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `employee` | `employee_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `employee` | `idx_employee_department` | INDEX | `(department_id) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `employee` | `idx_employee_job_position` | INDEX | `(job_position_id) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `employee` | `ix_employee_active` | INDEX | `(is_active, deleted_at)` | 8192 bytes |
| `employee` | `ix_employee_sample` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `employee` | `ux_employee_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `employee` | `ux_employee_number` | UNIQUE | `(employee_number) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `entity_attachment` | `entity_attachment_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `entity_attachment` | `ix_entity_attachment_entity` | INDEX | `(entity_type, entity_id)` | 8192 bytes |
| `file_object` | `file_object_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `file_object` | `ux_file_object_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `fiscal_period` | `fiscal_period_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `fiscal_period` | `ux_fiscal_period_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `goods_receipt` | `goods_receipt_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `goods_receipt` | `idx_goods_receipt_supplier` | INDEX | `(supplier_id)` | 8192 bytes |
| `goods_receipt` | `ix_goods_receipt_po` | INDEX | `(purchase_order_id)` | 8192 bytes |
| `goods_receipt` | `ix_goods_receipt_status` | INDEX | `(status, receipt_date)` | 8192 bytes |
| `goods_receipt` | `ux_goods_receipt_idem` | UNIQUE | `(idempotency_key) WHERE (idempotency_key IS NOT NULL)` | 8192 bytes |
| `goods_receipt` | `ux_goods_receipt_number` | UNIQUE | `(receipt_number)` | 8192 bytes |
| `goods_receipt` | `ux_goods_receipt_posting` | UNIQUE | `(posting_key) WHERE (posting_key IS NOT NULL)` | 8192 bytes |
| `goods_receipt_allocation` | `goods_receipt_allocation_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `goods_receipt_allocation` | `ux_gr_allocation` | UNIQUE | `(goods_receipt_line_id, request_order_line_id)` | 8192 bytes |
| `goods_receipt_discrepancy` | `goods_receipt_discrepancy_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `goods_receipt_discrepancy` | `ix_gr_discrepancy_line` | INDEX | `(goods_receipt_line_id)` | 8192 bytes |
| `goods_receipt_inspection` | `goods_receipt_inspection_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `goods_receipt_inspection` | `ix_gr_inspection_receipt` | INDEX | `(goods_receipt_id)` | 8192 bytes |
| `goods_receipt_line` | `goods_receipt_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `goods_receipt_line` | `ix_goods_receipt_line_po_line` | INDEX | `(purchase_order_line_id)` | 8192 bytes |
| `goods_receipt_line` | `ix_goods_receipt_line_product` | INDEX | `(product_id)` | 8192 bytes |
| `goods_receipt_line` | `ux_goods_receipt_line` | UNIQUE | `(goods_receipt_id, line_no)` | 8192 bytes |
| `goods_receipt_validation` | `goods_receipt_validation_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `goods_receipt_validation` | `ix_gr_validation_receipt` | INDEX | `(goods_receipt_id)` | 8192 bytes |
| `idempotency_record` | `idempotency_record_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `idempotency_record` | `ix_idempotency_expires` | INDEX | `(expires_at)` | 8192 bytes |
| `idempotency_record` | `ux_idempotency_key_op` | UNIQUE | `(idempotency_key, operation)` | 8192 bytes |
| `internal_transfer` | `internal_transfer_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `internal_transfer` | `ix_internal_transfer_dst` | INDEX | `(destination_warehouse_id, status)` | 8192 bytes |
| `internal_transfer` | `ix_internal_transfer_src` | INDEX | `(source_warehouse_id, status)` | 8192 bytes |
| `internal_transfer` | `ix_internal_transfer_status` | INDEX | `(status, created_at)` | 8192 bytes |
| `internal_transfer` | `ux_internal_transfer_dispatch_posting` | UNIQUE | `(dispatch_posting_key) WHERE (dispatch_posting_key IS NOT NULL)` | 8192 bytes |
| `internal_transfer` | `ux_internal_transfer_number` | UNIQUE | `(transfer_number)` | 8192 bytes |
| `internal_transfer` | `ux_internal_transfer_receipt_posting` | UNIQUE | `(receipt_posting_key) WHERE (receipt_posting_key IS NOT NULL)` | 8192 bytes |
| `internal_transfer_discrepancy` | `internal_transfer_discrepancy_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `internal_transfer_discrepancy` | `ix_transfer_discrepancy_line` | INDEX | `(internal_transfer_line_id)` | 8192 bytes |
| `internal_transfer_line` | `internal_transfer_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `internal_transfer_line` | `ix_internal_transfer_line_product` | INDEX | `(product_id)` | 8192 bytes |
| `internal_transfer_line` | `ux_internal_transfer_line` | UNIQUE | `(internal_transfer_id, line_no)` | 8192 bytes |
| `internal_transfer_receipt` | `internal_transfer_receipt_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `internal_transfer_receipt` | `ux_transfer_receipt_number` | UNIQUE | `(receipt_number)` | 8192 bytes |
| `internal_transfer_receipt_line` | `internal_transfer_receipt_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `internal_transfer_receipt_line` | `ux_transfer_receipt_line` | UNIQUE | `(transfer_receipt_id, internal_transfer_line_id)` | 8192 bytes |
| `inventory_adjustment` | `inventory_adjustment_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `inventory_adjustment` | `ux_inventory_adjustment_number` | UNIQUE | `(adjustment_number)` | 8192 bytes |
| `inventory_adjustment_line` | `inventory_adjustment_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `inventory_adjustment_line` | `ix_inventory_adjustment_line_adj` | INDEX | `(adjustment_id)` | 8192 bytes |
| `inventory_lot` | `inventory_lot_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `inventory_lot` | `ix_inventory_lot_expiry` | INDEX | `(expiry_date)` | 8192 bytes |
| `inventory_lot` | `ux_inventory_lot` | UNIQUE | `(product_id, lot_number) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `investor_profile` | `investor_profile_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `investor_profile` | `ux_investor_profile_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `job_execution` | `ix_job_execution` | INDEX | `(job_code, started_at)` | 8192 bytes |
| `job_execution` | `job_execution_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `job_position` | `idx_job_position_department` | INDEX | `(department_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `job_position` | `ix_job_position_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `job_position` | `ix_job_position_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `job_position` | `job_position_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `job_position` | `ux_job_position_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `journal_entry` | `ix_journal_date` | INDEX | `(journal_date, status)` | 8192 bytes |
| `journal_entry` | `ix_journal_source` | INDEX | `(source_type, source_id)` | 8192 bytes |
| `journal_entry` | `journal_entry_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `journal_entry` | `ux_journal_number` | UNIQUE | `(journal_number)` | 8192 bytes |
| `journal_entry` | `ux_journal_posting_key` | UNIQUE | `(posting_key)` | 8192 bytes |
| `journal_entry_line` | `ix_journal_line_account` | INDEX | `(account_id)` | 8192 bytes |
| `journal_entry_line` | `journal_entry_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `journal_entry_line` | `ux_journal_line` | UNIQUE | `(journal_entry_id, line_no)` | 8192 bytes |
| `leave_type` | `ix_leave_type_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `leave_type` | `leave_type_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `leave_type` | `ux_leave_type_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `legal_entity` | `ix_legal_entity_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `legal_entity` | `ix_legal_entity_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `legal_entity` | `legal_entity_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `legal_entity` | `ux_legal_entity_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `menu` | `ix_menu_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `menu` | `ix_menu_parent` | INDEX | `(parent_id, sort_order)` | 16 kB |
| `menu` | `menu_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `menu` | `ux_menu_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `menu_action` | `menu_action_pkey` | PRIMARY KEY | `(id)` | 32 kB |
| `menu_action` | `ux_menu_action` | UNIQUE | `(menu_id, permission_action_id)` | 40 kB |
| `notification` | `ix_notification_entity` | INDEX | `(entity_type, entity_id)` | 8192 bytes |
| `notification` | `ix_notification_recipient` | INDEX | `(recipient_subject_id, read_at, created_at)` | 8192 bytes |
| `notification` | `notification_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `notification_template` | `ix_notification_template_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `notification_template` | `notification_template_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `notification_template` | `ux_notification_template_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `number_sequence` | `ix_number_sequence_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `number_sequence` | `ix_number_sequence_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `number_sequence` | `number_sequence_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `number_sequence` | `ux_number_sequence_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `onboarding_progress` | `onboarding_progress_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `outlet` | `idx_outlet_outlet_type` | INDEX | `(outlet_type_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `outlet` | `ix_outlet_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `outlet` | `ix_outlet_entity` | INDEX | `(legal_entity_id, brand_id)` | 16 kB |
| `outlet` | `ix_outlet_region` | INDEX | `(region_id)` | 16 kB |
| `outlet` | `ix_outlet_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `outlet` | `outlet_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `outlet` | `ux_outlet_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `outlet_type` | `ix_outlet_type_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `outlet_type` | `ix_outlet_type_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `outlet_type` | `outlet_type_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `outlet_type` | `ux_outlet_type_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `owner_profile` | `owner_profile_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `owner_profile` | `ux_owner_profile_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `ownership_interest` | `ix_ownership_target` | INDEX | `(target_type, target_id)` | 8192 bytes |
| `ownership_interest` | `ownership_interest_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `party` | `ix_party_active` | INDEX | `(is_active, deleted_at)` | 8192 bytes |
| `party` | `ix_party_sample` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `party` | `party_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `party` | `ux_party_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `payment_method` | `ix_payment_method_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `payment_method` | `ix_payment_method_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `payment_method` | `payment_method_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `payment_method` | `ux_payment_method_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `payment_term` | `ix_payment_term_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `payment_term` | `payment_term_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `payment_term` | `ux_payment_term_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `permission_action` | `ix_permission_action_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `permission_action` | `permission_action_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `permission_action` | `ux_permission_action_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `pos_payment` | `idx_pos_payment_payment_method` | INDEX | `(payment_method_id)` | 8192 bytes |
| `pos_payment` | `ix_pos_payment_sale` | INDEX | `(pos_sale_id)` | 8192 bytes |
| `pos_payment` | `pos_payment_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `pos_payment` | `ux_pos_payment_idem` | UNIQUE | `(idempotency_key) WHERE (idempotency_key IS NOT NULL)` | 8192 bytes |
| `pos_sale` | `idx_pos_sale_customer` | INDEX | `(customer_id)` | 8192 bytes |
| `pos_sale` | `ix_pos_sale_date` | INDEX | `(business_date, outlet_id)` | 8192 bytes |
| `pos_sale` | `ix_pos_sale_status` | INDEX | `(status, sale_at)` | 8192 bytes |
| `pos_sale` | `pos_sale_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `pos_sale` | `ux_pos_sale_idem` | UNIQUE | `(idempotency_key) WHERE (idempotency_key IS NOT NULL)` | 8192 bytes |
| `pos_sale` | `ux_pos_sale_offline` | UNIQUE | `(offline_id) WHERE (offline_id IS NOT NULL)` | 8192 bytes |
| `pos_sale` | `ux_pos_sale_receipt` | UNIQUE | `(outlet_id, business_date, receipt_number)` | 8192 bytes |
| `pos_sale_line` | `ix_pos_sale_line_product` | INDEX | `(product_id)` | 8192 bytes |
| `pos_sale_line` | `pos_sale_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `pos_sale_line` | `ux_pos_sale_line` | UNIQUE | `(pos_sale_id, line_no)` | 8192 bytes |
| `pos_shift` | `ix_pos_shift_terminal` | INDEX | `(terminal_id, status)` | 8192 bytes |
| `pos_shift` | `pos_shift_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `pos_shift` | `ux_pos_shift_number` | UNIQUE | `(shift_number)` | 8192 bytes |
| `pos_terminal` | `ix_pos_terminal_outlet` | INDEX | `(outlet_id, is_active)` | 8192 bytes |
| `pos_terminal` | `ix_pos_terminal_sample` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `pos_terminal` | `pos_terminal_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `pos_terminal` | `ux_pos_terminal_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `price_book` | `ix_price_book_sample` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `price_book` | `price_book_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `price_book` | `ux_price_book_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `price_book_item` | `ix_price_book_item_product` | INDEX | `(product_id)` | 8192 bytes |
| `price_book_item` | `price_book_item_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `price_book_item` | `ux_price_book_item` | UNIQUE | `(price_book_id, product_id, COALESCE(uom_id, '00000000-0000-0000-0000-000000000000'::uuid…` | 8192 bytes |
| `product` | `idx_product_base_uom` | INDEX | `(base_uom_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `product` | `idx_product_brand_ref` | INDEX | `(product_brand_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `product` | `idx_product_tax_category` | INDEX | `(tax_category_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `product` | `ix_product_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `product` | `ix_product_barcode` | INDEX | `(barcode) WHERE (barcode IS NOT NULL)` | 16 kB |
| `product` | `ix_product_category` | INDEX | `(category_id)` | 16 kB |
| `product` | `ix_product_created` | INDEX | `(created_at)` | 16 kB |
| `product` | `ix_product_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `product` | `ix_product_updated` | INDEX | `(updated_at)` | 16 kB |
| `product` | `product_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `product` | `ux_product_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `product` | `ux_product_sku` | UNIQUE | `(sku) WHERE (deleted_at IS NULL)` | 16 kB |
| `product_barcode` | `product_barcode_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `product_barcode` | `ux_product_barcode_value` | UNIQUE | `(barcode) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `product_brand` | `ix_product_brand_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `product_brand` | `product_brand_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `product_brand` | `ux_product_brand_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `product_category` | `ix_product_category_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `product_category` | `ix_product_category_parent` | INDEX | `(parent_id, sort_order)` | 16 kB |
| `product_category` | `ix_product_category_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `product_category` | `product_category_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `product_category` | `ux_product_category_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `product_supplier` | `ix_product_supplier_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `product_supplier` | `ix_product_supplier_supplier` | INDEX | `(supplier_id)` | 16 kB |
| `product_supplier` | `product_supplier_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `product_supplier` | `ux_product_supplier` | UNIQUE | `(product_id, supplier_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `product_supplier` | `ux_product_supplier_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `purchase_backorder` | `ix_backorder_po` | INDEX | `(source_purchase_order_id)` | 8192 bytes |
| `purchase_backorder` | `ix_backorder_status` | INDEX | `(status, created_at)` | 8192 bytes |
| `purchase_backorder` | `purchase_backorder_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `purchase_backorder` | `ux_backorder_idem` | UNIQUE | `(idempotency_key) WHERE (idempotency_key IS NOT NULL)` | 8192 bytes |
| `purchase_backorder` | `ux_backorder_number` | UNIQUE | `(backorder_number)` | 8192 bytes |
| `purchase_backorder_line` | `ix_backorder_line_src` | INDEX | `(source_purchase_order_line_id)` | 8192 bytes |
| `purchase_backorder_line` | `purchase_backorder_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `purchase_backorder_line` | `ux_backorder_line` | UNIQUE | `(backorder_id, line_no)` | 8192 bytes |
| `purchase_order` | `idx_purchase_order_warehouse` | INDEX | `(warehouse_id)` | 8192 bytes |
| `purchase_order` | `ix_purchase_order_parent` | INDEX | `(parent_purchase_order_id)` | 8192 bytes |
| `purchase_order` | `ix_purchase_order_status` | INDEX | `(status, order_date)` | 8192 bytes |
| `purchase_order` | `ix_purchase_order_supplier` | INDEX | `(supplier_id, status)` | 8192 bytes |
| `purchase_order` | `purchase_order_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `purchase_order` | `ux_purchase_order_idem` | UNIQUE | `(idempotency_key) WHERE (idempotency_key IS NOT NULL)` | 8192 bytes |
| `purchase_order` | `ux_purchase_order_number` | UNIQUE | `(purchase_order_number)` | 8192 bytes |
| `purchase_order_line` | `idx_purchase_order_line_uom` | INDEX | `(uom_id)` | 8192 bytes |
| `purchase_order_line` | `ix_purchase_order_line_product` | INDEX | `(product_id)` | 8192 bytes |
| `purchase_order_line` | `purchase_order_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `purchase_order_line` | `ux_purchase_order_line` | UNIQUE | `(purchase_order_id, line_no)` | 8192 bytes |
| `purchase_order_request_allocation` | `purchase_order_request_allocation_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `purchase_order_request_allocation` | `ux_po_request_allocation` | UNIQUE | `(purchase_order_line_id, request_order_line_id)` | 8192 bytes |
| `region` | `ix_region_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `region` | `ix_region_parent` | INDEX | `(parent_id, sort_order)` | 16 kB |
| `region` | `ix_region_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `region` | `region_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `region` | `ux_region_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `request_order` | `idx_request_order_generated_policy` | INDEX | `(generated_by_policy_id)` | 8192 bytes |
| `request_order` | `ix_request_order_status` | INDEX | `(status, created_at)` | 8192 bytes |
| `request_order` | `ix_request_order_wh` | INDEX | `(requesting_warehouse_id, status)` | 8192 bytes |
| `request_order` | `request_order_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `request_order` | `ux_request_order_idem` | UNIQUE | `(idempotency_key) WHERE (idempotency_key IS NOT NULL)` | 8192 bytes |
| `request_order` | `ux_request_order_number` | UNIQUE | `(request_number)` | 8192 bytes |
| `request_order_consolidation` | `request_order_consolidation_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `request_order_consolidation` | `ux_ro_consolidation_number` | UNIQUE | `(consolidation_number)` | 8192 bytes |
| `request_order_consolidation_line` | `request_order_consolidation_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `request_order_consolidation_line` | `ux_ro_consolidation_line` | UNIQUE | `(consolidation_id, request_order_line_id)` | 8192 bytes |
| `request_order_line` | `ix_request_order_line_product` | INDEX | `(product_id)` | 8192 bytes |
| `request_order_line` | `request_order_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `request_order_line` | `ux_request_order_line` | UNIQUE | `(request_order_id, line_no)` | 8192 bytes |
| `role` | `ix_role_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `role` | `ix_role_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `role` | `role_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `role` | `ux_role_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `role_menu_permission` | `ix_role_menu_permission_role` | INDEX | `(role_id)` | 40 kB |
| `role_menu_permission` | `role_menu_permission_pkey` | PRIMARY KEY | `(id)` | 152 kB |
| `role_menu_permission` | `ux_role_menu_permission` | UNIQUE | `(role_id, menu_id, permission_action_id)` | 288 kB |
| `role_scope` | `role_scope_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `role_scope` | `ux_role_scope` | UNIQUE | `(role_id, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))` | 16 kB |
| `sales_order` | `idx_sales_order_customer` | INDEX | `(customer_id)` | 8192 bytes |
| `sales_order` | `sales_order_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `sales_order` | `ux_sales_order_number` | UNIQUE | `(order_number)` | 8192 bytes |
| `sales_order_line` | `sales_order_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `sales_order_line` | `ux_sales_order_line` | UNIQUE | `(sales_order_id, line_no)` | 8192 bytes |
| `saved_view` | `saved_view_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `saved_view` | `ux_saved_view` | UNIQUE | `(user_subject_id, resource_code, name)` | 8192 bytes |
| `schema_migration` | `schema_migration_pkey` | PRIMARY KEY | `(version)` | 16 kB |
| `starter_data_marker` | `ix_starter_marker_batch` | INDEX | `(sample_batch_id, removed_at)` | 16 kB |
| `starter_data_marker` | `starter_data_marker_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `starter_data_marker` | `ux_starter_marker` | UNIQUE | `(table_name, record_id)` | 40 kB |
| `step_up_challenge` | `ix_step_up_user` | INDEX | `(user_subject_id, purpose, expires_at)` | 8192 bytes |
| `step_up_challenge` | `step_up_challenge_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `stock_alert` | `idx_stock_alert_stock_policy` | INDEX | `(stock_policy_id)` | 8192 bytes |
| `stock_alert` | `ix_stock_alert_status` | INDEX | `(status, detected_at)` | 8192 bytes |
| `stock_alert` | `stock_alert_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `stock_alert` | `ux_stock_alert_open` | UNIQUE | `(warehouse_id, product_id, alert_type) WHERE ((status)::text = 'OPEN'::text)` | 8192 bytes |
| `stock_balance` | `ix_stock_balance_product` | INDEX | `(product_id)` | 16 kB |
| `stock_balance` | `ix_stock_balance_warehouse` | INDEX | `(warehouse_id)` | 16 kB |
| `stock_balance` | `stock_balance_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `stock_balance` | `ux_stock_balance` | UNIQUE | `(warehouse_id, product_id, COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)…` | 16 kB |
| `stock_count` | `stock_count_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `stock_count` | `ux_stock_count_number` | UNIQUE | `(count_number)` | 8192 bytes |
| `stock_count_line` | `ix_stock_count_line_count` | INDEX | `(stock_count_id)` | 8192 bytes |
| `stock_count_line` | `stock_count_line_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `stock_movement` | `idx_stock_movement_uom` | INDEX | `(uom_id)` | 16 kB |
| `stock_movement` | `ix_stock_movement_dst` | INDEX | `(destination_warehouse_id, occurred_at)` | 16 kB |
| `stock_movement` | `ix_stock_movement_product` | INDEX | `(product_id, occurred_at)` | 16 kB |
| `stock_movement` | `ix_stock_movement_ref` | INDEX | `(reference_type, reference_id)` | 16 kB |
| `stock_movement` | `ix_stock_movement_src` | INDEX | `(source_warehouse_id, occurred_at)` | 16 kB |
| `stock_movement` | `stock_movement_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `stock_movement` | `ux_stock_movement_number` | UNIQUE | `(movement_number)` | 16 kB |
| `stock_movement` | `ux_stock_movement_posting` | UNIQUE | `(posting_key)` | 16 kB |
| `stock_policy` | `idx_stock_policy_product` | INDEX | `(product_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `stock_policy` | `ix_stock_policy_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `stock_policy` | `ix_stock_policy_auto` | INDEX | `(auto_request_enabled, is_active)` | 16 kB |
| `stock_policy` | `ix_stock_policy_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `stock_policy` | `stock_policy_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `stock_policy` | `ux_stock_policy` | UNIQUE | `(warehouse_id, product_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `stock_policy` | `ux_stock_policy_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `stock_reservation` | `ix_stock_reservation_active` | INDEX | `(warehouse_id, product_id, status)` | 8192 bytes |
| `stock_reservation` | `ix_stock_reservation_src` | INDEX | `(source_type, source_id)` | 8192 bytes |
| `stock_reservation` | `stock_reservation_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `supplier` | `idx_supplier_group_ref` | INDEX | `(supplier_group_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `supplier` | `idx_supplier_payment_term` | INDEX | `(payment_term_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `supplier` | `ix_supplier_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `supplier` | `ix_supplier_created` | INDEX | `(created_at)` | 16 kB |
| `supplier` | `ix_supplier_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `supplier` | `supplier_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `supplier` | `ux_supplier_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `supplier_group` | `ix_supplier_group_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `supplier_group` | `supplier_group_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `supplier_group` | `ux_supplier_group_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `supplier_invoice` | `supplier_invoice_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `supplier_invoice` | `ux_supplier_invoice` | UNIQUE | `(supplier_id, invoice_number)` | 8192 bytes |
| `sync_inbox` | `sync_inbox_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `sync_inbox` | `ux_sync_inbox_event` | UNIQUE | `(event_id)` | 8192 bytes |
| `sync_outbox` | `ix_sync_outbox_status` | INDEX | `(status, sequence_no)` | 8192 bytes |
| `sync_outbox` | `sync_outbox_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `sync_outbox` | `ux_sync_outbox_event` | UNIQUE | `(event_id)` | 8192 bytes |
| `tax_category` | `ix_tax_category_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `tax_category` | `tax_category_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `tax_category` | `ux_tax_category_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `tax_rate` | `tax_rate_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `tax_rate` | `ux_tax_rate_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `uom` | `ix_uom_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `uom` | `ix_uom_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `uom` | `uom_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `uom` | `ux_uom_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `uom_conversion` | `uom_conversion_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `uom_conversion` | `ux_uom_conversion` | UNIQUE | `(COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid), from_uom_id, to_uom_…` | 8192 bytes |
| `user_direct_permission` | `user_direct_permission_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `user_direct_permission` | `ux_user_direct_permission` | UNIQUE | `(user_subject_id, menu_id, permission_action_id)` | 8192 bytes |
| `user_role_assignment` | `idx_user_role_assignment_role` | INDEX | `(role_id)` | 16 kB |
| `user_role_assignment` | `user_role_assignment_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `user_role_assignment` | `ux_user_role_assignment` | UNIQUE | `(user_subject_id, role_id)` | 16 kB |
| `user_subject` | `ix_user_subject_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `user_subject` | `user_subject_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `user_subject` | `ux_user_subject_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `user_subject` | `ux_user_subject_platform` | UNIQUE | `(platform_user_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `vehicle_type` | `ix_vehicle_type_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `vehicle_type` | `ux_vehicle_type_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `vehicle_type` | `vehicle_type_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `warehouse` | `idx_warehouse_warehouse_type` | INDEX | `(warehouse_type_id) WHERE (deleted_at IS NULL)` | 16 kB |
| `warehouse` | `ix_warehouse_active` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `warehouse` | `ix_warehouse_outlet` | INDEX | `(outlet_id)` | 16 kB |
| `warehouse` | `ix_warehouse_parent` | INDEX | `(parent_warehouse_id)` | 16 kB |
| `warehouse` | `ix_warehouse_region` | INDEX | `(region_id)` | 16 kB |
| `warehouse` | `ix_warehouse_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `warehouse` | `ux_warehouse_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `warehouse` | `warehouse_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `warehouse_bin` | `ux_warehouse_bin` | UNIQUE | `(warehouse_id, code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `warehouse_bin` | `warehouse_bin_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `warehouse_type` | `ix_warehouse_type_sample` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `warehouse_type` | `ux_warehouse_type_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 16 kB |
| `warehouse_type` | `warehouse_type_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `warehouse_zone` | `ux_warehouse_zone` | UNIQUE | `(warehouse_id, code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `warehouse_zone` | `warehouse_zone_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `workflow_action_log` | `ix_workflow_action_instance` | INDEX | `(instance_id, occurred_at)` | 8192 bytes |
| `workflow_action_log` | `workflow_action_log_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `workflow_definition` | `ix_workflow_definition_sample` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `workflow_definition` | `ux_workflow_definition_code` | UNIQUE | `(code) WHERE (deleted_at IS NULL)` | 8192 bytes |
| `workflow_definition` | `workflow_definition_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `workflow_instance` | `ix_workflow_instance_entity` | INDEX | `(entity_type, entity_id)` | 8192 bytes |
| `workflow_instance` | `ix_workflow_instance_status` | INDEX | `(status, started_at)` | 8192 bytes |
| `workflow_instance` | `workflow_instance_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `workflow_step` | `ux_workflow_step` | UNIQUE | `(workflow_id, code)` | 8192 bytes |
| `workflow_step` | `workflow_step_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |

## Schema `demo__audit`

Total 21 index pada 7 tabel.

| Tabel | Index | Jenis | Kolom | Ukuran |
| --- | --- | --- | --- | --- |
| `audit_event` | `audit_event_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `audit_event` | `ix_audit_event_action` | INDEX | `(module_code, action_code, occurred_at)` | 16 kB |
| `audit_event` | `ix_audit_event_actor` | INDEX | `(actor_user_id, occurred_at)` | 16 kB |
| `audit_event` | `ix_audit_event_entity` | INDEX | `(entity_type, entity_id)` | 16 kB |
| `audit_event` | `ix_audit_event_request` | INDEX | `(request_id)` | 16 kB |
| `audit_event` | `ix_audit_event_time` | INDEX | `(occurred_at)` | 16 kB |
| `audit_export_event` | `audit_export_event_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `audit_export_event` | `ix_audit_export_time` | INDEX | `(occurred_at)` | 8192 bytes |
| `audit_permission_change` | `audit_permission_change_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `audit_permission_change` | `ix_audit_permission_time` | INDEX | `(occurred_at)` | 8192 bytes |
| `audit_posting_event` | `audit_posting_event_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `audit_posting_event` | `ix_audit_posting_key` | INDEX | `(posting_key)` | 8192 bytes |
| `audit_posting_event` | `ix_audit_posting_time` | INDEX | `(occurred_at)` | 8192 bytes |
| `audit_row_change` | `audit_row_change_pkey` | PRIMARY KEY | `(id)` | 168 kB |
| `audit_row_change` | `ix_audit_row_event` | INDEX | `(audit_event_id)` | 56 kB |
| `audit_row_change` | `ix_audit_row_pk` | INDEX | `(row_pk)` | 712 kB |
| `audit_row_change` | `ix_audit_row_table` | INDEX | `(table_schema, table_name, statement_timestamp)` | 408 kB |
| `audit_schema_migration` | `audit_schema_migration_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `audit_schema_migration` | `ix_audit_migration_schema` | INDEX | `(schema_name, occurred_at)` | 8192 bytes |
| `audit_security_event` | `audit_security_event_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `audit_security_event` | `ix_audit_security_time` | INDEX | `(occurred_at)` | 8192 bytes |

## Schema `platform`

Total 450 index pada 130 tabel.

| Tabel | Index | Jenis | Kolom | Ukuran |
| --- | --- | --- | --- | --- |
| `announcement` | `announcement_audience_type_is_active_starts_at_idx` | INDEX | `(audience_type, is_active, starts_at)` | 16 kB |
| `announcement` | `announcement_code_key` | UNIQUE | `(code)` | 16 kB |
| `announcement` | `announcement_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `announcement` | `announcement_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `billing_credit_note` | `billing_credit_note_credit_note_number_key` | UNIQUE | `(credit_note_number)` | 8192 bytes |
| `billing_credit_note` | `billing_credit_note_invoice_id_idx` | INDEX | `(invoice_id)` | 8192 bytes |
| `billing_credit_note` | `billing_credit_note_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `billing_invoice` | `billing_invoice_due_date_status_idx` | INDEX | `(due_date, status)` | 16 kB |
| `billing_invoice` | `billing_invoice_invoice_number_key` | UNIQUE | `(invoice_number)` | 16 kB |
| `billing_invoice` | `billing_invoice_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `billing_invoice` | `billing_invoice_tenant_id_status_idx` | INDEX | `(tenant_id, status)` | 16 kB |
| `billing_invoice_line` | `billing_invoice_line_device_id_idx` | INDEX | `(device_id)` | 16 kB |
| `billing_invoice_line` | `billing_invoice_line_invoice_id_sort_order_idx` | INDEX | `(invoice_id, sort_order)` | 16 kB |
| `billing_invoice_line` | `billing_invoice_line_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `billing_payment_allocation` | `billing_payment_allocation_idempotency_key_key` | UNIQUE | `(idempotency_key)` | 8192 bytes |
| `billing_payment_allocation` | `billing_payment_allocation_invoice_id_idx` | INDEX | `(invoice_id)` | 8192 bytes |
| `billing_payment_allocation` | `billing_payment_allocation_payment_order_id_idx` | INDEX | `(payment_order_id)` | 8192 bytes |
| `billing_payment_allocation` | `billing_payment_allocation_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `billing_receipt` | `billing_receipt_invoice_id_idx` | INDEX | `(invoice_id)` | 8192 bytes |
| `billing_receipt` | `billing_receipt_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `billing_receipt` | `billing_receipt_receipt_number_key` | UNIQUE | `(receipt_number)` | 8192 bytes |
| `call_to_action` | `call_to_action_code_key` | UNIQUE | `(code)` | 16 kB |
| `call_to_action` | `call_to_action_is_active_sort_order_idx` | INDEX | `(is_active, sort_order)` | 16 kB |
| `call_to_action` | `call_to_action_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `call_to_action` | `call_to_action_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_block` | `cms_block_page_version_id_block_key_key` | UNIQUE | `(page_version_id, block_key)` | 16 kB |
| `cms_block` | `cms_block_page_version_id_sort_order_idx` | INDEX | `(page_version_id, sort_order)` | 16 kB |
| `cms_block` | `cms_block_parent_block_id_idx` | INDEX | `(parent_block_id)` | 16 kB |
| `cms_block` | `cms_block_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_block_translation` | `cms_block_translation_block_id_locale_code_key` | UNIQUE | `(block_id, locale_code)` | 16 kB |
| `cms_block_translation` | `cms_block_translation_locale_code_idx` | INDEX | `(locale_code)` | 16 kB |
| `cms_block_translation` | `cms_block_translation_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_footer_item` | `cms_footer_item_footer_section_id_sort_order_idx` | INDEX | `(footer_section_id, sort_order)` | 16 kB |
| `cms_footer_item` | `cms_footer_item_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_footer_section` | `cms_footer_section_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_footer_section` | `cms_footer_section_sort_order_idx` | INDEX | `(sort_order)` | 16 kB |
| `cms_footer_section` | `cms_footer_section_website_id_code_key` | UNIQUE | `(website_id, code)` | 16 kB |
| `cms_navigation` | `cms_navigation_location_is_active_idx` | INDEX | `(location, is_active)` | 16 kB |
| `cms_navigation` | `cms_navigation_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_navigation` | `cms_navigation_website_id_code_key` | UNIQUE | `(website_id, code)` | 16 kB |
| `cms_navigation_item` | `cms_navigation_item_navigation_id_sort_order_idx` | INDEX | `(navigation_id, sort_order)` | 16 kB |
| `cms_navigation_item` | `cms_navigation_item_parent_id_idx` | INDEX | `(parent_id)` | 16 kB |
| `cms_navigation_item` | `cms_navigation_item_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_page` | `cms_page_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `cms_page` | `cms_page_parent_id_sort_order_idx` | INDEX | `(parent_id, sort_order)` | 16 kB |
| `cms_page` | `cms_page_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_page` | `cms_page_status_is_active_deleted_at_idx` | INDEX | `(status, is_active, deleted_at)` | 16 kB |
| `cms_page` | `cms_page_website_id_code_key` | UNIQUE | `(website_id, code)` | 16 kB |
| `cms_page` | `cms_page_website_id_slug_key` | UNIQUE | `(website_id, slug)` | 16 kB |
| `cms_page_translation` | `cms_page_translation_locale_code_idx` | INDEX | `(locale_code)` | 16 kB |
| `cms_page_translation` | `cms_page_translation_page_version_id_locale_code_key` | UNIQUE | `(page_version_id, locale_code)` | 16 kB |
| `cms_page_translation` | `cms_page_translation_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_page_version` | `cms_page_version_page_id_version_number_key` | UNIQUE | `(page_id, version_number)` | 16 kB |
| `cms_page_version` | `cms_page_version_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `cms_page_version` | `cms_page_version_status_scheduled_at_idx` | INDEX | `(status, scheduled_at)` | 16 kB |
| `cms_preview_token` | `cms_preview_token_entity_type_entity_id_idx` | INDEX | `(entity_type, entity_id)` | 8192 bytes |
| `cms_preview_token` | `cms_preview_token_expires_at_idx` | INDEX | `(expires_at)` | 8192 bytes |
| `cms_preview_token` | `cms_preview_token_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `cms_preview_token` | `cms_preview_token_token_hash_key` | UNIQUE | `(token_hash)` | 8192 bytes |
| `cms_publication_workflow` | `cms_publication_workflow_entity_type_entity_id_created_at_idx` | INDEX | `(entity_type, entity_id, created_at)` | 8192 bytes |
| `cms_publication_workflow` | `cms_publication_workflow_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `contact_message` | `contact_message_email_idx` | INDEX | `(email)` | 8192 bytes |
| `contact_message` | `contact_message_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `contact_message` | `contact_message_status_created_at_idx` | INDEX | `(status, created_at)` | 8192 bytes |
| `contact_office` | `contact_office_code_key` | UNIQUE | `(code)` | 16 kB |
| `contact_office` | `contact_office_is_active_sort_order_idx` | INDEX | `(is_active, sort_order)` | 16 kB |
| `contact_office` | `contact_office_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `contact_office` | `contact_office_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `demo_reset_run` | `demo_reset_run_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `demo_reset_run` | `demo_reset_run_started_at_idx` | INDEX | `(started_at)` | 8192 bytes |
| `demo_session` | `demo_session_ip_address_started_at_idx` | INDEX | `(ip_address, started_at)` | 16 kB |
| `demo_session` | `demo_session_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `demo_session` | `demo_session_session_token_key` | UNIQUE | `(session_token)` | 16 kB |
| `demo_session` | `demo_session_status_expires_at_idx` | INDEX | `(status, expires_at)` | 16 kB |
| `device_activation` | `device_activation_activation_code_key` | UNIQUE | `(activation_code)` | 16 kB |
| `device_activation` | `device_activation_device_id_revoked_at_idx` | INDEX | `(device_id, revoked_at)` | 16 kB |
| `device_activation` | `device_activation_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `device_entitlement` | `device_entitlement_device_id_module_code_feature_code_start_key` | UNIQUE | `(device_id, module_code, feature_code, starts_at)` | 8192 bytes |
| `device_entitlement` | `device_entitlement_device_id_status_idx` | INDEX | `(device_id, status)` | 8192 bytes |
| `device_entitlement` | `device_entitlement_ends_at_idx` | INDEX | `(ends_at)` | 8192 bytes |
| `device_entitlement` | `device_entitlement_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `discount_approval` | `discount_approval_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `discount_approval` | `discount_approval_program_id_status_idx` | INDEX | `(program_id, status)` | 8192 bytes |
| `discount_benefit` | `discount_benefit_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `discount_benefit` | `discount_benefit_rule_id_sequence_idx` | INDEX | `(rule_id, sequence)` | 16 kB |
| `discount_condition` | `discount_condition_group_id_sequence_idx` | INDEX | `(group_id, sequence)` | 16 kB |
| `discount_condition` | `discount_condition_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `discount_condition_group` | `discount_condition_group_parent_group_id_idx` | INDEX | `(parent_group_id)` | 16 kB |
| `discount_condition_group` | `discount_condition_group_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `discount_condition_group` | `discount_condition_group_rule_id_sequence_idx` | INDEX | `(rule_id, sequence)` | 16 kB |
| `discount_plan_eligibility` | `discount_plan_eligibility_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `discount_plan_eligibility` | `discount_plan_eligibility_program_id_plan_id_key` | UNIQUE | `(program_id, plan_id)` | 8192 bytes |
| `discount_program` | `discount_program_code_key` | UNIQUE | `(code)` | 16 kB |
| `discount_program` | `discount_program_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `discount_program` | `discount_program_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `discount_program` | `discount_program_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `discount_program` | `discount_program_status_is_active_valid_from_idx` | INDEX | `(status, is_active, valid_from)` | 16 kB |
| `discount_redemption` | `discount_redemption_idempotency_key_key` | UNIQUE | `(idempotency_key)` | 8192 bytes |
| `discount_redemption` | `discount_redemption_occurred_at_idx` | INDEX | `(occurred_at)` | 8192 bytes |
| `discount_redemption` | `discount_redemption_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `discount_redemption` | `discount_redemption_program_id_tenant_id_idx` | INDEX | `(program_id, tenant_id)` | 8192 bytes |
| `discount_rule` | `discount_rule_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `discount_rule` | `discount_rule_program_id_code_key` | UNIQUE | `(program_id, code)` | 16 kB |
| `discount_rule` | `discount_rule_program_id_sequence_idx` | INDEX | `(program_id, sequence)` | 16 kB |
| `discount_tenant_eligibility` | `discount_tenant_eligibility_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `discount_tenant_eligibility` | `discount_tenant_eligibility_program_id_tenant_id_key` | UNIQUE | `(program_id, tenant_id)` | 8192 bytes |
| `entitlement_snapshot` | `entitlement_snapshot_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `entitlement_snapshot` | `entitlement_snapshot_tenant_id_scope_type_scope_id_generate_idx` | INDEX | `(tenant_id, scope_type, scope_id, generated_at)` | 8192 bytes |
| `faq_category` | `faq_category_code_key` | UNIQUE | `(code)` | 16 kB |
| `faq_category` | `faq_category_is_active_sort_order_idx` | INDEX | `(is_active, sort_order)` | 16 kB |
| `faq_category` | `faq_category_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `faq_category` | `faq_category_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `faq_item` | `faq_item_category_id_sort_order_idx` | INDEX | `(category_id, sort_order)` | 16 kB |
| `faq_item` | `faq_item_code_key` | UNIQUE | `(code)` | 16 kB |
| `faq_item` | `faq_item_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `faq_item` | `faq_item_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `faq_item` | `faq_item_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `feature_catalog` | `feature_catalog_code_key` | UNIQUE | `(code)` | 16 kB |
| `feature_catalog` | `feature_catalog_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `feature_catalog` | `feature_catalog_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `feature_catalog` | `feature_catalog_module_id_sort_order_idx` | INDEX | `(module_id, sort_order)` | 16 kB |
| `feature_catalog` | `feature_catalog_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `global_menu_template` | `global_menu_template_code_key` | UNIQUE | `(code)` | 16 kB |
| `global_menu_template` | `global_menu_template_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `global_menu_template` | `global_menu_template_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `global_menu_template` | `global_menu_template_parent_id_sort_order_idx` | INDEX | `(parent_id, sort_order)` | 16 kB |
| `global_menu_template` | `global_menu_template_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `global_permission_action` | `global_permission_action_code_key` | UNIQUE | `(code)` | 16 kB |
| `global_permission_action` | `global_permission_action_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `global_permission_action` | `global_permission_action_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `global_permission_action` | `global_permission_action_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `global_role_template` | `global_role_template_code_key` | UNIQUE | `(code)` | 16 kB |
| `global_role_template` | `global_role_template_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `global_role_template` | `global_role_template_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `global_role_template` | `global_role_template_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `hero_slide` | `hero_slide_is_active_sort_order_idx` | INDEX | `(is_active, sort_order)` | 16 kB |
| `hero_slide` | `hero_slide_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `hero_slide` | `hero_slide_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `hero_slide` | `hero_slide_website_id_code_key` | UNIQUE | `(website_id, code)` | 16 kB |
| `host_to_host_log` | `host_to_host_log_occurred_at_idx` | INDEX | `(occurred_at)` | 8192 bytes |
| `host_to_host_log` | `host_to_host_log_order_number_idx` | INDEX | `(order_number)` | 8192 bytes |
| `host_to_host_log` | `host_to_host_log_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `host_to_host_log` | `host_to_host_log_remote_ip_occurred_at_idx` | INDEX | `(remote_ip, occurred_at)` | 8192 bytes |
| `idempotency_record` | `idempotency_record_expires_at_idx` | INDEX | `(expires_at)` | 8192 bytes |
| `idempotency_record` | `idempotency_record_idempotency_key_operation_key` | UNIQUE | `(idempotency_key, operation)` | 8192 bytes |
| `idempotency_record` | `idempotency_record_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `locale` | `locale_code_key` | UNIQUE | `(code)` | 16 kB |
| `locale` | `locale_enabled_sort_order_idx` | INDEX | `(enabled, sort_order)` | 16 kB |
| `locale` | `locale_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `locale` | `locale_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `locale` | `locale_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `marketing_feature` | `marketing_feature_code_key` | UNIQUE | `(code)` | 16 kB |
| `marketing_feature` | `marketing_feature_group_is_active_sort_order_idx` | INDEX | `("group", is_active, sort_order)` | 16 kB |
| `marketing_feature` | `marketing_feature_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `marketing_feature` | `marketing_feature_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `media_asset` | `media_asset_code_key` | UNIQUE | `(code)` | 8192 bytes |
| `media_asset` | `media_asset_folder_id_sort_order_idx` | INDEX | `(folder_id, sort_order)` | 8192 bytes |
| `media_asset` | `media_asset_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 8192 bytes |
| `media_asset` | `media_asset_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `media_asset` | `media_asset_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `media_folder` | `media_folder_code_key` | UNIQUE | `(code)` | 16 kB |
| `media_folder` | `media_folder_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `media_folder` | `media_folder_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `media_folder` | `media_folder_parent_id_sort_order_idx` | INDEX | `(parent_id, sort_order)` | 16 kB |
| `media_folder` | `media_folder_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `module_catalog` | `module_catalog_category_sort_order_idx` | INDEX | `(category, sort_order)` | 16 kB |
| `module_catalog` | `module_catalog_code_key` | UNIQUE | `(code)` | 16 kB |
| `module_catalog` | `module_catalog_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `module_catalog` | `module_catalog_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `module_catalog` | `module_catalog_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `news_article` | `news_article_category_id_status_idx` | INDEX | `(category_id, status)` | 16 kB |
| `news_article` | `news_article_code_key` | UNIQUE | `(code)` | 16 kB |
| `news_article` | `news_article_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `news_article` | `news_article_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `news_article` | `news_article_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `news_article` | `news_article_slug_key` | UNIQUE | `(slug)` | 16 kB |
| `news_article` | `news_article_status_published_at_idx` | INDEX | `(status, published_at)` | 16 kB |
| `news_article_tag` | `news_article_tag_article_id_tag_id_key` | UNIQUE | `(article_id, tag_id)` | 16 kB |
| `news_article_tag` | `news_article_tag_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `news_article_tag` | `news_article_tag_tag_id_idx` | INDEX | `(tag_id)` | 16 kB |
| `news_article_translation` | `news_article_translation_article_version_id_locale_code_key` | UNIQUE | `(article_version_id, locale_code)` | 16 kB |
| `news_article_translation` | `news_article_translation_locale_code_idx` | INDEX | `(locale_code)` | 16 kB |
| `news_article_translation` | `news_article_translation_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `news_article_version` | `news_article_version_article_id_version_number_key` | UNIQUE | `(article_id, version_number)` | 16 kB |
| `news_article_version` | `news_article_version_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `news_article_version` | `news_article_version_status_idx` | INDEX | `(status)` | 16 kB |
| `news_category` | `news_category_code_key` | UNIQUE | `(code)` | 16 kB |
| `news_category` | `news_category_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `news_category` | `news_category_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `news_category` | `news_category_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `news_category` | `news_category_slug_key` | UNIQUE | `(slug)` | 16 kB |
| `news_tag` | `news_tag_code_key` | UNIQUE | `(code)` | 16 kB |
| `news_tag` | `news_tag_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `news_tag` | `news_tag_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `news_tag` | `news_tag_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `news_tag` | `news_tag_slug_key` | UNIQUE | `(slug)` | 16 kB |
| `newsletter_subscriber` | `newsletter_subscriber_email_key` | UNIQUE | `(email)` | 8192 bytes |
| `newsletter_subscriber` | `newsletter_subscriber_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `newsletter_subscriber` | `newsletter_subscriber_status_idx` | INDEX | `(status)` | 8192 bytes |
| `package_assignment` | `package_assignment_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `package_assignment` | `package_assignment_plan_version_id_idx` | INDEX | `(plan_version_id)` | 8192 bytes |
| `package_assignment` | `package_assignment_tenant_id_scope_type_scope_id_idx` | INDEX | `(tenant_id, scope_type, scope_id)` | 8192 bytes |
| `partner_logo` | `partner_logo_code_key` | UNIQUE | `(code)` | 16 kB |
| `partner_logo` | `partner_logo_is_active_sort_order_idx` | INDEX | `(is_active, sort_order)` | 16 kB |
| `partner_logo` | `partner_logo_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `partner_logo` | `partner_logo_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `payment_attempt` | `payment_attempt_order_id_attempt_type_occurred_at_idx` | INDEX | `(order_id, attempt_type, occurred_at)` | 16 kB |
| `payment_attempt` | `payment_attempt_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `payment_callback_event` | `payment_callback_event_order_id_processing_status_idx` | INDEX | `(order_id, processing_status)` | 8192 bytes |
| `payment_callback_event` | `payment_callback_event_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `payment_callback_event` | `payment_callback_event_provider_id_provider_transaction_id__key` | UNIQUE | `(provider_id, provider_transaction_id, payload_checksum)` | 8192 bytes |
| `payment_callback_event` | `payment_callback_event_provider_transaction_id_idx` | INDEX | `(provider_transaction_id)` | 8192 bytes |
| `payment_callback_event` | `payment_callback_event_received_at_idx` | INDEX | `(received_at)` | 8192 bytes |
| `payment_channel` | `payment_channel_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `payment_channel` | `payment_channel_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `payment_channel` | `payment_channel_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `payment_channel` | `payment_channel_provider_id_code_key` | UNIQUE | `(provider_id, code)` | 16 kB |
| `payment_channel_legacy_config` | `payment_channel_legacy_config_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `payment_channel_legacy_config` | `payment_channel_legacy_config_provider_id_imported_at_idx` | INDEX | `(provider_id, imported_at)` | 8192 bytes |
| `payment_check_batch` | `payment_check_batch_batch_number_key` | UNIQUE | `(batch_number)` | 8192 bytes |
| `payment_check_batch` | `payment_check_batch_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `payment_check_batch` | `payment_check_batch_status_created_at_idx` | INDEX | `(status, created_at)` | 8192 bytes |
| `payment_check_batch_item` | `payment_check_batch_item_batch_id_order_id_key` | UNIQUE | `(batch_id, order_id)` | 8192 bytes |
| `payment_check_batch_item` | `payment_check_batch_item_batch_id_sequence_idx` | INDEX | `(batch_id, sequence)` | 8192 bytes |
| `payment_check_batch_item` | `payment_check_batch_item_batch_id_status_idx` | INDEX | `(batch_id, status)` | 8192 bytes |
| `payment_check_batch_item` | `payment_check_batch_item_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `payment_dead_letter` | `payment_dead_letter_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `payment_dead_letter` | `payment_dead_letter_resolved_at_created_at_idx` | INDEX | `(resolved_at, created_at)` | 8192 bytes |
| `payment_inquiry_attempt` | `payment_inquiry_attempt_batch_id_idx` | INDEX | `(batch_id)` | 8192 bytes |
| `payment_inquiry_attempt` | `payment_inquiry_attempt_order_id_occurred_at_idx` | INDEX | `(order_id, occurred_at)` | 8192 bytes |
| `payment_inquiry_attempt` | `payment_inquiry_attempt_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `payment_order` | `payment_order_idempotency_key_key` | UNIQUE | `(idempotency_key)` | 16 kB |
| `payment_order` | `payment_order_invoice_id_status_idx` | INDEX | `(invoice_id, status)` | 16 kB |
| `payment_order` | `payment_order_order_number_key` | UNIQUE | `(order_number)` | 16 kB |
| `payment_order` | `payment_order_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `payment_order` | `payment_order_provider_id_provider_order_id_key` | UNIQUE | `(provider_id, provider_order_id)` | 16 kB |
| `payment_order` | `payment_order_provider_id_provider_transaction_id_key` | UNIQUE | `(provider_id, provider_transaction_id)` | 16 kB |
| `payment_order` | `payment_order_status_expires_at_idx` | INDEX | `(status, expires_at)` | 16 kB |
| `payment_provider` | `payment_provider_code_key` | UNIQUE | `(code)` | 16 kB |
| `payment_provider` | `payment_provider_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `payment_provider` | `payment_provider_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `payment_provider` | `payment_provider_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `payment_reconciliation_item` | `payment_reconciliation_item_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `payment_reconciliation_item` | `payment_reconciliation_item_run_id_order_id_key` | UNIQUE | `(run_id, order_id)` | 8192 bytes |
| `payment_reconciliation_item` | `payment_reconciliation_item_run_id_outcome_idx` | INDEX | `(run_id, outcome)` | 8192 bytes |
| `payment_reconciliation_run` | `payment_reconciliation_run_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `payment_reconciliation_run` | `payment_reconciliation_run_provider_id_period_start_idx` | INDEX | `(provider_id, period_start)` | 8192 bytes |
| `payment_reconciliation_run` | `payment_reconciliation_run_run_number_key` | UNIQUE | `(run_number)` | 8192 bytes |
| `payment_status_transition` | `payment_status_transition_order_id_occurred_at_idx` | INDEX | `(order_id, occurred_at)` | 8192 bytes |
| `payment_status_transition` | `payment_status_transition_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `platform_admin_saved_view` | `platform_admin_saved_view_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `platform_admin_saved_view` | `platform_admin_saved_view_user_id_resource_code_name_key` | UNIQUE | `(user_id, resource_code, name)` | 8192 bytes |
| `platform_login_attempt` | `platform_login_attempt_ip_address_occurred_at_idx` | INDEX | `(ip_address, occurred_at)` | 16 kB |
| `platform_login_attempt` | `platform_login_attempt_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_login_attempt` | `platform_login_attempt_username_occurred_at_idx` | INDEX | `(username, occurred_at)` | 16 kB |
| `platform_permission` | `platform_permission_code_key` | UNIQUE | `(code)` | 16 kB |
| `platform_permission` | `platform_permission_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `platform_permission` | `platform_permission_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `platform_permission` | `platform_permission_module_code_idx` | INDEX | `(module_code)` | 16 kB |
| `platform_permission` | `platform_permission_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_refresh_token` | `platform_refresh_token_expires_at_idx` | INDEX | `(expires_at)` | 16 kB |
| `platform_refresh_token` | `platform_refresh_token_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_refresh_token` | `platform_refresh_token_session_id_revoked_at_idx` | INDEX | `(session_id, revoked_at)` | 16 kB |
| `platform_refresh_token` | `platform_refresh_token_token_hash_key` | UNIQUE | `(token_hash)` | 16 kB |
| `platform_role` | `platform_role_code_key` | UNIQUE | `(code)` | 16 kB |
| `platform_role` | `platform_role_created_at_idx` | INDEX | `(created_at)` | 16 kB |
| `platform_role` | `platform_role_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `platform_role` | `platform_role_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `platform_role` | `platform_role_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_role` | `platform_role_updated_at_idx` | INDEX | `(updated_at)` | 16 kB |
| `platform_role_permission` | `platform_role_permission_permission_id_idx` | INDEX | `(permission_id)` | 16 kB |
| `platform_role_permission` | `platform_role_permission_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_role_permission` | `platform_role_permission_role_id_permission_id_key` | UNIQUE | `(role_id, permission_id)` | 16 kB |
| `platform_session` | `platform_session_expires_at_idx` | INDEX | `(expires_at)` | 16 kB |
| `platform_session` | `platform_session_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_session` | `platform_session_token_family_id_idx` | INDEX | `(token_family_id)` | 16 kB |
| `platform_session` | `platform_session_user_id_revoked_at_idx` | INDEX | `(user_id, revoked_at)` | 16 kB |
| `platform_setting` | `platform_setting_key_key` | UNIQUE | `(key)` | 16 kB |
| `platform_setting` | `platform_setting_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_step_up_challenge` | `platform_step_up_challenge_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_step_up_challenge` | `platform_step_up_challenge_user_id_purpose_expires_at_idx` | INDEX | `(user_id, purpose, expires_at)` | 16 kB |
| `platform_support_session` | `platform_support_session_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `platform_support_session` | `platform_support_session_requested_by_id_idx` | INDEX | `(requested_by_id)` | 8192 bytes |
| `platform_support_session` | `platform_support_session_tenant_id_expires_at_idx` | INDEX | `(tenant_id, expires_at)` | 8192 bytes |
| `platform_tenant_action` | `platform_tenant_action_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `platform_tenant_action` | `platform_tenant_action_status_idx` | INDEX | `(status)` | 8192 bytes |
| `platform_tenant_action` | `platform_tenant_action_tenant_id_action_code_idx` | INDEX | `(tenant_id, action_code)` | 8192 bytes |
| `platform_user` | `platform_user_created_at_idx` | INDEX | `(created_at)` | 16 kB |
| `platform_user` | `platform_user_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `platform_user` | `platform_user_normalized_email_key` | UNIQUE | `(normalized_email)` | 16 kB |
| `platform_user` | `platform_user_normalized_username_key` | UNIQUE | `(normalized_username)` | 16 kB |
| `platform_user` | `platform_user_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_user` | `platform_user_status_is_active_deleted_at_idx` | INDEX | `(status, is_active, deleted_at)` | 16 kB |
| `platform_user` | `platform_user_updated_at_idx` | INDEX | `(updated_at)` | 16 kB |
| `platform_user_profile` | `platform_user_profile_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_user_profile` | `platform_user_profile_platform_user_id_key` | UNIQUE | `(platform_user_id)` | 16 kB |
| `platform_user_role` | `platform_user_role_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `platform_user_role` | `platform_user_role_role_id_idx` | INDEX | `(role_id)` | 16 kB |
| `platform_user_role` | `platform_user_role_user_id_role_id_key` | UNIQUE | `(user_id, role_id)` | 16 kB |
| `pos_device` | `pos_device_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `pos_device` | `pos_device_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `pos_device` | `pos_device_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `pos_device` | `pos_device_tenant_id_code_key` | UNIQUE | `(tenant_id, code)` | 16 kB |
| `pos_device` | `pos_device_tenant_id_status_is_billable_idx` | INDEX | `(tenant_id, status, is_billable)` | 16 kB |
| `pricing_adjustment` | `pricing_adjustment_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `pricing_adjustment` | `pricing_adjustment_quote_id_sequence_idx` | INDEX | `(quote_id, sequence)` | 16 kB |
| `pricing_display_section` | `pricing_display_section_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `pricing_display_section` | `pricing_display_section_website_id_code_key` | UNIQUE | `(website_id, code)` | 16 kB |
| `pricing_quote` | `pricing_quote_expires_at_idx` | INDEX | `(expires_at)` | 16 kB |
| `pricing_quote` | `pricing_quote_idempotency_key_key` | UNIQUE | `(idempotency_key)` | 16 kB |
| `pricing_quote` | `pricing_quote_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `pricing_quote` | `pricing_quote_quote_number_key` | UNIQUE | `(quote_number)` | 16 kB |
| `pricing_quote` | `pricing_quote_tenant_id_status_idx` | INDEX | `(tenant_id, status)` | 16 kB |
| `pricing_quote_line` | `pricing_quote_line_device_id_idx` | INDEX | `(device_id)` | 16 kB |
| `pricing_quote_line` | `pricing_quote_line_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `pricing_quote_line` | `pricing_quote_line_quote_id_sort_order_idx` | INDEX | `(quote_id, sort_order)` | 16 kB |
| `promo_code` | `promo_code_code_key` | UNIQUE | `(code)` | 8192 bytes |
| `promo_code` | `promo_code_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `promo_code` | `promo_code_program_id_is_active_idx` | INDEX | `(program_id, is_active)` | 8192 bytes |
| `provider_rate_limit_state` | `provider_rate_limit_state_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `provider_rate_limit_state` | `provider_rate_limit_state_provider_id_window_start_key` | UNIQUE | `(provider_id, window_start)` | 8192 bytes |
| `provisioning_job` | `provisioning_job_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `provisioning_job` | `provisioning_job_schema_name_idx` | INDEX | `(schema_name)` | 16 kB |
| `provisioning_job` | `provisioning_job_status_retry_at_idx` | INDEX | `(status, retry_at)` | 16 kB |
| `provisioning_job` | `provisioning_job_tenant_id_idx` | INDEX | `(tenant_id)` | 16 kB |
| `provisioning_step` | `provisioning_step_job_id_sequence_key` | UNIQUE | `(job_id, sequence)` | 16 kB |
| `provisioning_step` | `provisioning_step_job_id_status_idx` | INDEX | `(job_id, status)` | 16 kB |
| `provisioning_step` | `provisioning_step_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `redirect_rule` | `redirect_rule_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `redirect_rule` | `redirect_rule_website_id_source_path_key` | UNIQUE | `(website_id, source_path)` | 8192 bytes |
| `registration` | `registration_email_idx` | INDEX | `(email)` | 16 kB |
| `registration` | `registration_normalized_username_idx` | INDEX | `(normalized_username)` | 16 kB |
| `registration` | `registration_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `registration` | `registration_registration_code_key` | UNIQUE | `(registration_code)` | 16 kB |
| `registration` | `registration_status_created_at_idx` | INDEX | `(status, created_at)` | 16 kB |
| `registration_credential_delivery` | `registration_credential_delivery_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `registration_credential_delivery` | `registration_credential_delivery_registration_id_idx` | INDEX | `(registration_id)` | 16 kB |
| `schema_migration_catalog` | `schema_migration_catalog_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `schema_migration_catalog` | `schema_migration_catalog_sequence_key` | UNIQUE | `(sequence)` | 16 kB |
| `schema_migration_catalog` | `schema_migration_catalog_version_key` | UNIQUE | `(version)` | 16 kB |
| `schema_name_reservation` | `schema_name_reservation_expires_at_idx` | INDEX | `(expires_at)` | 16 kB |
| `schema_name_reservation` | `schema_name_reservation_normalized_name_key` | UNIQUE | `(normalized_name)` | 16 kB |
| `schema_name_reservation` | `schema_name_reservation_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `schema_name_reservation` | `schema_name_reservation_registration_id_key` | UNIQUE | `(registration_id)` | 16 kB |
| `seo_structured_data` | `seo_structured_data_page_id_schema_type_key` | UNIQUE | `(page_id, schema_type)` | 16 kB |
| `seo_structured_data` | `seo_structured_data_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription` | `subscription_current_period_end_idx` | INDEX | `(current_period_end)` | 16 kB |
| `subscription` | `subscription_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription` | `subscription_subscription_number_key` | UNIQUE | `(subscription_number)` | 16 kB |
| `subscription` | `subscription_tenant_id_status_idx` | INDEX | `(tenant_id, status)` | 16 kB |
| `subscription_add_on` | `subscription_add_on_code_key` | UNIQUE | `(code)` | 16 kB |
| `subscription_add_on` | `subscription_add_on_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `subscription_add_on` | `subscription_add_on_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `subscription_add_on` | `subscription_add_on_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_add_on_module` | `subscription_add_on_module_add_on_version_id_module_id_key` | UNIQUE | `(add_on_version_id, module_id)` | 16 kB |
| `subscription_add_on_module` | `subscription_add_on_module_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_add_on_price` | `subscription_add_on_price_add_on_version_id_currency_code_b_key` | UNIQUE | `(add_on_version_id, currency_code, billing_interval, interval_count, effective_from)` | 16 kB |
| `subscription_add_on_price` | `subscription_add_on_price_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_add_on_version` | `subscription_add_on_version_add_on_id_version_number_key` | UNIQUE | `(add_on_id, version_number)` | 16 kB |
| `subscription_add_on_version` | `subscription_add_on_version_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_add_on_version` | `subscription_add_on_version_status_effective_from_idx` | INDEX | `(status, effective_from)` | 16 kB |
| `subscription_change` | `subscription_change_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `subscription_change` | `subscription_change_subscription_id_effective_at_idx` | INDEX | `(subscription_id, effective_at)` | 8192 bytes |
| `subscription_item` | `subscription_item_device_id_idx` | INDEX | `(device_id)` | 16 kB |
| `subscription_item` | `subscription_item_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_item` | `subscription_item_subscription_id_status_idx` | INDEX | `(subscription_id, status)` | 16 kB |
| `subscription_plan` | `subscription_plan_code_key` | UNIQUE | `(code)` | 16 kB |
| `subscription_plan` | `subscription_plan_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `subscription_plan` | `subscription_plan_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `subscription_plan` | `subscription_plan_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_plan` | `subscription_plan_status_is_public_sort_order_idx` | INDEX | `(status, is_public, sort_order)` | 16 kB |
| `subscription_plan_constraint` | `subscription_plan_constraint_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_plan_constraint` | `subscription_plan_constraint_plan_version_id_constraint_typ_key` | UNIQUE | `(plan_version_id, constraint_type)` | 16 kB |
| `subscription_plan_feature` | `subscription_plan_feature_feature_id_idx` | INDEX | `(feature_id)` | 16 kB |
| `subscription_plan_feature` | `subscription_plan_feature_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_plan_feature` | `subscription_plan_feature_plan_version_id_feature_id_key` | UNIQUE | `(plan_version_id, feature_id)` | 16 kB |
| `subscription_plan_module` | `subscription_plan_module_module_id_idx` | INDEX | `(module_id)` | 16 kB |
| `subscription_plan_module` | `subscription_plan_module_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_plan_module` | `subscription_plan_module_plan_version_id_module_id_key` | UNIQUE | `(plan_version_id, module_id)` | 16 kB |
| `subscription_plan_price` | `subscription_plan_price_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_plan_price` | `subscription_plan_price_plan_version_id_currency_code_billi_key` | UNIQUE | `(plan_version_id, currency_code, billing_metric, billing_interval, interval_count, effect…` | 16 kB |
| `subscription_plan_price` | `subscription_plan_price_plan_version_id_is_active_idx` | INDEX | `(plan_version_id, is_active)` | 16 kB |
| `subscription_plan_price_tier` | `subscription_plan_price_tier_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_plan_price_tier` | `subscription_plan_price_tier_price_id_min_quantity_key` | UNIQUE | `(price_id, min_quantity)` | 16 kB |
| `subscription_plan_price_tier` | `subscription_plan_price_tier_price_id_sort_order_idx` | INDEX | `(price_id, sort_order)` | 16 kB |
| `subscription_plan_version` | `subscription_plan_version_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `subscription_plan_version` | `subscription_plan_version_plan_id_status_idx` | INDEX | `(plan_id, status)` | 16 kB |
| `subscription_plan_version` | `subscription_plan_version_plan_id_version_number_key` | UNIQUE | `(plan_id, version_number)` | 16 kB |
| `subscription_plan_version` | `subscription_plan_version_status_effective_from_idx` | INDEX | `(status, effective_from)` | 16 kB |
| `subscription_product` | `subscription_product_code_key` | UNIQUE | `(code)` | 16 kB |
| `subscription_product` | `subscription_product_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `subscription_product` | `subscription_product_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `subscription_product` | `subscription_product_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `tenant` | `tenant_code_key` | UNIQUE | `(code)` | 16 kB |
| `tenant` | `tenant_created_at_idx` | INDEX | `(created_at)` | 16 kB |
| `tenant` | `tenant_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `tenant` | `tenant_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `tenant` | `tenant_registration_id_key` | UNIQUE | `(registration_id)` | 16 kB |
| `tenant` | `tenant_slug_key` | UNIQUE | `(slug)` | 16 kB |
| `tenant` | `tenant_status_is_active_deleted_at_idx` | INDEX | `(status, is_active, deleted_at)` | 16 kB |
| `tenant_membership` | `tenant_membership_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `tenant_membership` | `tenant_membership_platform_user_id_idx` | INDEX | `(platform_user_id)` | 16 kB |
| `tenant_membership` | `tenant_membership_tenant_id_platform_user_id_key` | UNIQUE | `(tenant_id, platform_user_id)` | 16 kB |
| `tenant_plan_contract` | `tenant_plan_contract_contract_number_key` | UNIQUE | `(contract_number)` | 8192 bytes |
| `tenant_plan_contract` | `tenant_plan_contract_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `tenant_plan_contract` | `tenant_plan_contract_tenant_id_status_idx` | INDEX | `(tenant_id, status)` | 8192 bytes |
| `tenant_plan_feature_override` | `tenant_plan_feature_override_contract_id_feature_id_key` | UNIQUE | `(contract_id, feature_id)` | 8192 bytes |
| `tenant_plan_feature_override` | `tenant_plan_feature_override_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `tenant_plan_module_override` | `tenant_plan_module_override_contract_id_module_id_key` | UNIQUE | `(contract_id, module_id)` | 8192 bytes |
| `tenant_plan_module_override` | `tenant_plan_module_override_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `tenant_price_override` | `tenant_price_override_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `tenant_price_override` | `tenant_price_override_plan_version_id_idx` | INDEX | `(plan_version_id)` | 8192 bytes |
| `tenant_price_override` | `tenant_price_override_tenant_id_is_active_effective_from_idx` | INDEX | `(tenant_id, is_active, effective_from)` | 8192 bytes |
| `tenant_schema_migration_history` | `tenant_schema_migration_history_applied_at_idx` | INDEX | `(applied_at)` | 16 kB |
| `tenant_schema_migration_history` | `tenant_schema_migration_history_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `tenant_schema_migration_history` | `tenant_schema_migration_history_schema_name_migration_versi_key` | UNIQUE | `(schema_name, migration_version)` | 16 kB |
| `tenant_schema_migration_history` | `tenant_schema_migration_history_tenant_id_idx` | INDEX | `(tenant_id)` | 16 kB |
| `tenant_schema_registry` | `tenant_schema_registry_audit_schema_name_key` | UNIQUE | `(audit_schema_name)` | 16 kB |
| `tenant_schema_registry` | `tenant_schema_registry_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `tenant_schema_registry` | `tenant_schema_registry_schema_name_key` | UNIQUE | `(schema_name)` | 16 kB |
| `tenant_schema_registry` | `tenant_schema_registry_status_idx` | INDEX | `(status)` | 16 kB |
| `tenant_schema_registry` | `tenant_schema_registry_tenant_id_key` | UNIQUE | `(tenant_id)` | 16 kB |
| `tenant_schema_registry` | `tenant_schema_registry_username_key` | UNIQUE | `(username)` | 16 kB |
| `tenant_translation_override` | `tenant_translation_override_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `tenant_translation_override` | `tenant_translation_override_tenant_id_key_id_locale_code_key` | UNIQUE | `(tenant_id, key_id, locale_code)` | 8192 bytes |
| `tenant_translation_override` | `tenant_translation_override_tenant_id_locale_code_idx` | INDEX | `(tenant_id, locale_code)` | 8192 bytes |
| `testimonial` | `testimonial_code_key` | UNIQUE | `(code)` | 16 kB |
| `testimonial` | `testimonial_is_active_sort_order_idx` | INDEX | `(is_active, sort_order)` | 16 kB |
| `testimonial` | `testimonial_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `testimonial` | `testimonial_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `translation_import_run` | `translation_import_run_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `translation_import_run` | `translation_import_run_started_at_idx` | INDEX | `(started_at)` | 8192 bytes |
| `translation_key` | `translation_key_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 8192 bytes |
| `translation_key` | `translation_key_key_idx` | INDEX | `(key)` | 8192 bytes |
| `translation_key` | `translation_key_namespace_id_key_key` | UNIQUE | `(namespace_id, key)` | 8192 bytes |
| `translation_key` | `translation_key_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `translation_namespace` | `translation_namespace_code_key` | UNIQUE | `(code)` | 16 kB |
| `translation_namespace` | `translation_namespace_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `translation_namespace` | `translation_namespace_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `translation_namespace` | `translation_namespace_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `translation_value` | `translation_value_key_id_locale_code_key` | UNIQUE | `(key_id, locale_code)` | 8192 bytes |
| `translation_value` | `translation_value_locale_code_idx` | INDEX | `(locale_code)` | 8192 bytes |
| `translation_value` | `translation_value_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `website` | `website_code_key` | UNIQUE | `(code)` | 16 kB |
| `website` | `website_is_active_deleted_at_idx` | INDEX | `(is_active, deleted_at)` | 16 kB |
| `website` | `website_is_sample_sample_batch_id_idx` | INDEX | `(is_sample, sample_batch_id)` | 16 kB |
| `website` | `website_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `website_domain` | `website_domain_domain_key` | UNIQUE | `(domain)` | 8192 bytes |
| `website_domain` | `website_domain_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `website_domain` | `website_domain_website_id_is_primary_idx` | INDEX | `(website_id, is_primary)` | 8192 bytes |

## Schema `platform__audit`

Total 22 index pada 6 tabel.

| Tabel | Index | Jenis | Kolom | Ukuran |
| --- | --- | --- | --- | --- |
| `audit_event` | `audit_event_actor_user_id_occurred_at_idx` | INDEX | `(actor_user_id, occurred_at)` | 32 kB |
| `audit_event` | `audit_event_entity_type_entity_id_idx` | INDEX | `(entity_type, entity_id)` | 40 kB |
| `audit_event` | `audit_event_module_code_action_code_occurred_at_idx` | INDEX | `(module_code, action_code, occurred_at)` | 40 kB |
| `audit_event` | `audit_event_occurred_at_idx` | INDEX | `(occurred_at)` | 16 kB |
| `audit_event` | `audit_event_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `audit_event` | `audit_event_request_id_idx` | INDEX | `(request_id)` | 40 kB |
| `audit_event` | `audit_event_tenant_id_occurred_at_idx` | INDEX | `(tenant_id, occurred_at)` | 40 kB |
| `audit_export_event` | `audit_export_event_actor_user_id_occurred_at_idx` | INDEX | `(actor_user_id, occurred_at)` | 8192 bytes |
| `audit_export_event` | `audit_export_event_occurred_at_idx` | INDEX | `(occurred_at)` | 8192 bytes |
| `audit_export_event` | `audit_export_event_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `audit_permission_change` | `audit_permission_change_occurred_at_idx` | INDEX | `(occurred_at)` | 8192 bytes |
| `audit_permission_change` | `audit_permission_change_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `audit_permission_change` | `audit_permission_change_target_type_target_id_idx` | INDEX | `(target_type, target_id)` | 8192 bytes |
| `audit_row_change` | `audit_row_change_audit_event_id_idx` | INDEX | `(audit_event_id)` | 8192 bytes |
| `audit_row_change` | `audit_row_change_pkey` | PRIMARY KEY | `(id)` | 8192 bytes |
| `audit_row_change` | `audit_row_change_table_schema_table_name_statement_timestam_idx` | INDEX | `(table_schema, table_name, statement_timestamp)` | 8192 bytes |
| `audit_schema_migration` | `audit_schema_migration_pkey` | PRIMARY KEY | `(id)` | 16 kB |
| `audit_schema_migration` | `audit_schema_migration_schema_name_occurred_at_idx` | INDEX | `(schema_name, occurred_at)` | 16 kB |
| `audit_security_event` | `audit_security_event_actor_user_id_occurred_at_idx` | INDEX | `(actor_user_id, occurred_at)` | 16 kB |
| `audit_security_event` | `audit_security_event_event_code_occurred_at_idx` | INDEX | `(event_code, occurred_at)` | 16 kB |
| `audit_security_event` | `audit_security_event_occurred_at_idx` | INDEX | `(occurred_at)` | 16 kB |
| `audit_security_event` | `audit_security_event_pkey` | PRIMARY KEY | `(id)` | 16 kB |

## Tabel tanpa index sekunder

Tabel berikut hanya memiliki primary key. Ini wajar untuk tabel referensi kecil, tetapi
perlu ditinjau bila tabel tersebut sering difilter pada query pelaporan.

- `demo.onboarding_progress`
- `demo.schema_migration`

## Foreign key tanpa index pendukung

PostgreSQL tidak membuat index otomatis pada sisi anak foreign key. Kolom berikut akan
melakukan sequential scan saat induknya dihapus atau saat join dilakukan dari sisi induk.

| Tabel | Kolom | Induk |
| --- | --- | --- |
| `demo.backorder_purchase_order_link` | `purchase_order_id` | `purchase_order` |
| `demo.backorder_supplier_decision` | `from_supplier_id` | `supplier` |
| `demo.backorder_supplier_decision` | `to_supplier_id` | `supplier` |
| `demo.bill_of_material` | `output_uom_id` | `uom` |
| `demo.bill_of_material_item` | `uom_id` | `uom` |
| `demo.brand` | `logo_file_id` | `file_object` |
| `demo.carrier` | `party_id` | `party` |
| `demo.chart_of_account` | `account_type_id` | `account_type` |
| `demo.chart_of_account` | `legal_entity_id` | `legal_entity` |
| `demo.customer` | `address_id` | `address` |
| `demo.customer` | `party_id` | `party` |
| `demo.data_export_log` | `user_subject_id` | `user_subject` |
| `demo.department` | `legal_entity_id` | `legal_entity` |
| `demo.department` | `parent_id` | `department` |
| `demo.employee` | `legal_entity_id` | `legal_entity` |
| `demo.employee` | `party_id` | `party` |
| `demo.employee` | `user_subject_id` | `user_subject` |
| `demo.entity_attachment` | `file_id` | `file_object` |
| `demo.fiscal_period` | `legal_entity_id` | `legal_entity` |
| `demo.goods_receipt` | `backorder_id` | `purchase_backorder` |
| `demo.goods_receipt` | `warehouse_id` | `warehouse` |
| `demo.goods_receipt_allocation` | `request_order_line_id` | `request_order_line` |
| `demo.goods_receipt_line` | `bin_id` | `warehouse_bin` |
| `demo.goods_receipt_line` | `lot_id` | `inventory_lot` |
| `demo.goods_receipt_line` | `uom_id` | `uom` |
| `demo.internal_transfer` | `request_order_id` | `request_order` |
| `demo.internal_transfer_line` | `lot_id` | `inventory_lot` |
| `demo.internal_transfer_line` | `uom_id` | `uom` |
| `demo.internal_transfer_receipt` | `internal_transfer_id` | `internal_transfer` |
| `demo.internal_transfer_receipt_line` | `internal_transfer_line_id` | `internal_transfer_line` |
| `demo.inventory_adjustment` | `stock_count_id` | `stock_count` |
| `demo.inventory_adjustment` | `warehouse_id` | `warehouse` |
| `demo.inventory_adjustment_line` | `bin_id` | `warehouse_bin` |
| `demo.inventory_adjustment_line` | `lot_id` | `inventory_lot` |
| `demo.inventory_adjustment_line` | `product_id` | `product` |
| `demo.inventory_lot` | `supplier_id` | `supplier` |
| `demo.investor_profile` | `party_id` | `party` |
| `demo.job_position` | `legal_entity_id` | `legal_entity` |
| `demo.journal_entry` | `fiscal_period_id` | `fiscal_period` |
| `demo.journal_entry` | `legal_entity_id` | `legal_entity` |
| `demo.journal_entry` | `reversal_of_id` | `journal_entry` |
| `demo.legal_entity` | `address_id` | `address` |
| `demo.legal_entity` | `business_group_id` | `business_group` |
| `demo.menu_action` | `permission_action_id` | `permission_action` |
| `demo.notification` | `template_id` | `notification_template` |
| `demo.outlet` | `address_id` | `address` |
| `demo.outlet` | `brand_id` | `brand` |
| `demo.owner_profile` | `party_id` | `party` |
| `demo.ownership_interest` | `party_id` | `party` |
| `demo.party` | `address_id` | `address` |
| `demo.pos_sale` | `shift_id` | `pos_shift` |
| `demo.pos_sale` | `terminal_id` | `pos_terminal` |
| `demo.pos_sale` | `warehouse_id` | `warehouse` |
| `demo.pos_sale_line` | `uom_id` | `uom` |
| `demo.pos_shift` | `cashier_id` | `user_subject` |
| `demo.product_barcode` | `product_id` | `product` |
| `demo.product_barcode` | `uom_id` | `uom` |
| `demo.product_supplier` | `purchase_uom_id` | `uom` |
| `demo.purchase_backorder` | `original_supplier_id` | `supplier` |
| `demo.purchase_backorder` | `replacement_supplier_id` | `supplier` |
| `demo.purchase_backorder` | `source_goods_receipt_id` | `goods_receipt` |
| `demo.purchase_backorder` | `warehouse_id` | `warehouse` |
| `demo.purchase_backorder_line` | `product_id` | `product` |
| `demo.purchase_backorder_line` | `target_supplier_id` | `supplier` |
| `demo.purchase_backorder_line` | `uom_id` | `uom` |
| `demo.purchase_order` | `source_backorder_id` | `purchase_backorder` |
| `demo.purchase_order` | `legal_entity_id` | `legal_entity` |
| `demo.purchase_order_request_allocation` | `request_order_line_id` | `request_order_line` |
| `demo.request_order` | `outlet_id` | `outlet` |
| `demo.request_order` | `parent_warehouse_id` | `warehouse` |
| `demo.request_order` | `source_alert_id` | `stock_alert` |
| `demo.request_order_consolidation` | `parent_warehouse_id` | `warehouse` |
| `demo.request_order_consolidation_line` | `product_id` | `product` |
| `demo.request_order_consolidation_line` | `request_order_line_id` | `request_order_line` |
| `demo.request_order_line` | `source_stock_policy_id` | `stock_policy` |
| `demo.request_order_line` | `uom_id` | `uom` |
| `demo.role_menu_permission` | `menu_id` | `menu` |
| `demo.role_menu_permission` | `permission_action_id` | `permission_action` |
| `demo.sales_order` | `outlet_id` | `outlet` |
| `demo.sales_order_line` | `product_id` | `product` |
| `demo.sales_order_line` | `uom_id` | `uom` |
| `demo.stock_alert` | `request_order_id` | `request_order` |
| `demo.stock_alert` | `product_id` | `product` |
| `demo.stock_count` | `warehouse_id` | `warehouse` |
| `demo.stock_count_line` | `bin_id` | `warehouse_bin` |
| `demo.stock_count_line` | `lot_id` | `inventory_lot` |
| `demo.stock_count_line` | `product_id` | `product` |
| `demo.stock_movement` | `destination_bin_id` | `warehouse_bin` |
| `demo.stock_movement` | `lot_id` | `inventory_lot` |
| `demo.stock_movement` | `source_bin_id` | `warehouse_bin` |
| `demo.stock_policy` | `uom_id` | `uom` |
| `demo.stock_reservation` | `lot_id` | `inventory_lot` |
| `demo.stock_reservation` | `product_id` | `product` |
| `demo.supplier` | `address_id` | `address` |
| `demo.supplier` | `party_id` | `party` |
| `demo.supplier_group` | `payment_term_id` | `payment_term` |
| `demo.supplier_invoice` | `purchase_order_id` | `purchase_order` |
| `demo.tax_rate` | `tax_category_id` | `tax_category` |
| `demo.uom_conversion` | `from_uom_id` | `uom` |
| `demo.uom_conversion` | `to_uom_id` | `uom` |
| `demo.user_direct_permission` | `menu_id` | `menu` |
| `demo.user_direct_permission` | `permission_action_id` | `permission_action` |
| `demo.warehouse` | `address_id` | `address` |
| `demo.warehouse` | `legal_entity_id` | `legal_entity` |
| `demo.warehouse_bin` | `zone_id` | `warehouse_zone` |
| `demo.workflow_action_log` | `step_id` | `workflow_step` |
| `demo.workflow_instance` | `current_step_id` | `workflow_step` |
| `demo.workflow_instance` | `workflow_id` | `workflow_definition` |
| `platform.billing_invoice` | `quote_id` | `pricing_quote` |
| `platform.billing_invoice` | `subscription_id` | `subscription` |
| `platform.billing_payment_allocation` | `callback_event_id` | `payment_callback_event` |
| `platform.billing_payment_allocation` | `invoice_line_id` | `billing_invoice_line` |
| `platform.cms_navigation_item` | `page_id` | `cms_page` |
| `platform.discount_plan_eligibility` | `plan_id` | `subscription_plan` |
| `platform.discount_redemption` | `promo_code_id` | `promo_code` |
| `platform.discount_redemption` | `tenant_id` | `tenant` |
| `platform.discount_tenant_eligibility` | `tenant_id` | `tenant` |
| `platform.hero_slide` | `background_asset_id` | `media_asset` |
| `platform.host_to_host_log` | `provider_id` | `payment_provider` |
| `platform.marketing_feature` | `image_asset_id` | `media_asset` |
| `platform.marketing_feature` | `module_id` | `module_catalog` |
| `platform.news_article` | `author_user_id` | `platform_user` |
| `platform.news_article` | `featured_image_id` | `media_asset` |
| `platform.news_category` | `parent_id` | `news_category` |
| `platform.partner_logo` | `logo_asset_id` | `media_asset` |
| `platform.payment_check_batch_item` | `order_id` | `payment_order` |
| `platform.payment_dead_letter` | `callback_event_id` | `payment_callback_event` |
| `platform.payment_order` | `selected_channel_id` | `payment_channel` |
| `platform.payment_reconciliation_item` | `order_id` | `payment_order` |
| `platform.platform_user` | `preferred_locale_code` | `locale` |
| `platform.pricing_quote` | `plan_version_id` | `subscription_plan_version` |
| `platform.provisioning_job` | `registration_id` | `registration` |
| `platform.subscription` | `plan_version_id` | `subscription_plan_version` |
| `platform.subscription_add_on_module` | `module_id` | `module_catalog` |
| `platform.subscription_item` | `add_on_version_id` | `subscription_add_on_version` |
| `platform.subscription_plan` | `product_id` | `subscription_product` |
| `platform.tenant_plan_contract` | `plan_version_id` | `subscription_plan_version` |
| `platform.tenant_plan_feature_override` | `feature_id` | `feature_catalog` |
| `platform.tenant_plan_module_override` | `module_id` | `module_catalog` |
| `platform.tenant_schema_migration_history` | `catalog_id` | `schema_migration_catalog` |
| `platform.tenant_translation_override` | `key_id` | `translation_key` |
| `platform.tenant_translation_override` | `locale_code` | `locale` |
| `platform.testimonial` | `avatar_asset_id` | `media_asset` |
