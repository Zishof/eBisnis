# Kebijakan Lifecycle Tabel

> Berkas ini dihasilkan otomatis oleh `pnpm docs:generate` dari hasil introspeksi
> PostgreSQL. Jangan diedit manual — perubahan akan hilang pada generate berikutnya.

- Dihasilkan: `2026-07-30T10:47:45.433Z`
- Schema control plane: `platform`, `platform__audit`
- Schema tenant contoh: `demo`, `demo__audit`

Lifecycle master Versi 5 memakai tiga tingkat: nonaktifkan (`is_active = false`), hapus sementara (`deleted_at` terisi), dan hapus permanen (purge) yang memerlukan permission `HARD_DELETE`, step-up authentication, alasan, dan reference check.

## Schema `demo`

| Tabel | `is_active` | `is_system` | `is_sample` | `sample_batch_id` | `deactivated_at` | `deleted_at` | `delete_reason` | `version` | Tingkat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `account_type` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `address` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `app_setting` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `backorder_purchase_order_link` | — | — | — | — | — | — | — | — | immutable / ledger |
| `backorder_supplier_decision` | — | — | — | — | — | — | — | — | immutable / ledger |
| `bill_of_material` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `bill_of_material_item` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `brand` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `business_group` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `carrier` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `cash_drawer_movement` | — | — | — | — | — | — | — | — | immutable / ledger |
| `chart_of_account` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `customer` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `customer_group` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `data_export_log` | — | — | — | — | — | — | — | — | immutable / ledger |
| `department` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `employee` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `entity_attachment` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `file_object` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `fiscal_period` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `goods_receipt` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `goods_receipt_allocation` | — | — | — | — | — | — | — | — | immutable / ledger |
| `goods_receipt_discrepancy` | — | — | — | — | — | — | — | — | immutable / ledger |
| `goods_receipt_inspection` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `goods_receipt_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `goods_receipt_validation` | — | — | — | — | — | — | — | — | immutable / ledger |
| `idempotency_record` | — | — | — | — | — | — | — | — | immutable / ledger |
| `internal_transfer` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `internal_transfer_discrepancy` | — | — | — | — | — | — | — | — | immutable / ledger |
| `internal_transfer_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `internal_transfer_receipt` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `internal_transfer_receipt_line` | — | — | — | — | — | — | — | — | immutable / ledger |
| `inventory_adjustment` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `inventory_adjustment_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `inventory_lot` | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `investor_profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `job_execution` | — | — | — | — | — | — | — | — | immutable / ledger |
| `job_position` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `journal_entry` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `journal_entry_line` | — | — | — | — | — | — | — | — | immutable / ledger |
| `leave_type` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `legal_entity` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `menu` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `menu_action` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `notification` | — | — | — | — | — | — | — | — | immutable / ledger |
| `notification_template` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `number_sequence` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `onboarding_progress` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `outlet` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `outlet_type` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `owner_profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `ownership_interest` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `party` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `payment_method` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `payment_term` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `permission_action` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `pos_payment` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `pos_sale` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `pos_sale_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `pos_shift` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `pos_terminal` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `price_book` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `price_book_item` | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `product` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `product_barcode` | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `product_brand` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `product_category` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `product_supplier` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `purchase_backorder` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `purchase_backorder_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `purchase_order` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `purchase_order_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `purchase_order_request_allocation` | — | — | — | — | — | — | — | — | immutable / ledger |
| `region` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `request_order` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `request_order_consolidation` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `request_order_consolidation_line` | — | — | — | — | — | — | — | — | immutable / ledger |
| `request_order_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `role` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `role_menu_permission` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `role_scope` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `sales_order` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `sales_order_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `saved_view` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `schema_migration` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `starter_data_marker` | — | — | — | ✓ | — | — | — | — | immutable / ledger |
| `step_up_challenge` | — | — | — | — | — | — | — | — | immutable / ledger |
| `stock_alert` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `stock_balance` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `stock_count` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `stock_count_line` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `stock_movement` | — | — | — | — | — | — | — | — | immutable / ledger |
| `stock_policy` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `stock_reservation` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `supplier` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `supplier_group` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `supplier_invoice` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `sync_inbox` | — | — | — | — | — | — | — | — | immutable / ledger |
| `sync_outbox` | — | — | — | — | — | — | — | — | immutable / ledger |
| `tax_category` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `tax_rate` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `uom` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `uom_conversion` | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `user_direct_permission` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `user_role_assignment` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `user_subject` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `vehicle_type` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `warehouse` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `warehouse_bin` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `warehouse_type` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `warehouse_zone` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `workflow_action_log` | — | — | — | — | — | — | — | — | immutable / ledger |
| `workflow_definition` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `workflow_instance` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `workflow_step` | — | — | — | — | — | — | — | ✓ | immutable / ledger |

## Schema `demo__audit`

| Tabel | `is_active` | `is_system` | `is_sample` | `sample_batch_id` | `deactivated_at` | `deleted_at` | `delete_reason` | `version` | Tingkat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `audit_event` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_export_event` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_permission_change` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_posting_event` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_row_change` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_schema_migration` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_security_event` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |

## Schema `platform`

| Tabel | `is_active` | `is_system` | `is_sample` | `sample_batch_id` | `deactivated_at` | `deleted_at` | `delete_reason` | `version` | Tingkat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `announcement` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `billing_credit_note` | — | — | — | — | — | — | — | — | immutable / ledger |
| `billing_invoice` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `billing_invoice_line` | — | — | — | — | — | — | — | — | immutable / ledger |
| `billing_payment_allocation` | — | — | — | — | — | — | — | — | immutable / ledger |
| `billing_receipt` | — | — | — | — | — | — | — | — | immutable / ledger |
| `call_to_action` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `cms_block` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `cms_block_translation` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `cms_footer_item` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `cms_footer_section` | ✓ | — | ✓ | ✓ | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `cms_navigation` | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `cms_navigation_item` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `cms_page` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `cms_page_translation` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `cms_page_version` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `cms_preview_token` | — | — | — | — | — | — | — | — | immutable / ledger |
| `cms_publication_workflow` | — | — | — | — | — | — | — | — | immutable / ledger |
| `contact_message` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `contact_office` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `demo_reset_run` | — | — | — | — | — | — | — | — | immutable / ledger |
| `demo_session` | — | — | — | — | — | — | — | — | immutable / ledger |
| `device_activation` | — | — | — | — | — | — | — | — | immutable / ledger |
| `device_entitlement` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `discount_approval` | — | — | — | — | — | — | — | — | immutable / ledger |
| `discount_benefit` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `discount_condition` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `discount_condition_group` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `discount_plan_eligibility` | — | — | — | — | — | — | — | — | immutable / ledger |
| `discount_program` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `discount_redemption` | — | — | — | — | — | — | — | — | immutable / ledger |
| `discount_rule` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `discount_tenant_eligibility` | — | — | — | — | — | — | — | — | immutable / ledger |
| `entitlement_snapshot` | — | — | — | — | — | — | — | — | immutable / ledger |
| `faq_category` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `faq_item` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `feature_catalog` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `global_menu_template` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `global_permission_action` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `global_role_template` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `hero_slide` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `host_to_host_log` | — | — | — | — | — | — | — | — | immutable / ledger |
| `idempotency_record` | — | — | — | — | — | — | — | — | immutable / ledger |
| `locale` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `marketing_feature` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `media_asset` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `media_folder` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `module_catalog` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `news_article` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `news_article_tag` | — | — | — | — | — | — | — | — | immutable / ledger |
| `news_article_translation` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `news_article_version` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `news_category` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `news_tag` | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `newsletter_subscriber` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `package_assignment` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `partner_logo` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `payment_attempt` | — | — | — | — | — | — | — | — | immutable / ledger |
| `payment_callback_event` | — | — | — | — | — | — | — | — | immutable / ledger |
| `payment_channel` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `payment_channel_legacy_config` | — | — | — | — | — | — | — | — | immutable / ledger |
| `payment_check_batch` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `payment_check_batch_item` | — | — | — | — | — | — | — | — | immutable / ledger |
| `payment_dead_letter` | — | — | — | — | — | — | — | — | immutable / ledger |
| `payment_inquiry_attempt` | — | — | — | — | — | — | — | — | immutable / ledger |
| `payment_order` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `payment_provider` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `payment_reconciliation_item` | — | — | — | — | — | — | — | — | immutable / ledger |
| `payment_reconciliation_run` | — | — | — | — | — | — | — | — | immutable / ledger |
| `payment_status_transition` | — | — | — | — | — | — | — | — | immutable / ledger |
| `platform_admin_saved_view` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `platform_login_attempt` | — | — | — | — | — | — | — | — | immutable / ledger |
| `platform_permission` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `platform_refresh_token` | — | — | — | — | — | — | — | — | immutable / ledger |
| `platform_role` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `platform_role_permission` | — | — | — | — | — | — | — | — | immutable / ledger |
| `platform_session` | — | — | — | — | — | — | — | — | immutable / ledger |
| `platform_setting` | ✓ | ✓ | — | — | — | — | — | ✓ | immutable / ledger |
| `platform_step_up_challenge` | — | — | — | — | — | — | — | — | immutable / ledger |
| `platform_support_session` | — | — | — | — | — | — | — | — | immutable / ledger |
| `platform_tenant_action` | — | — | — | — | — | — | — | — | immutable / ledger |
| `platform_user` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `platform_user_profile` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `platform_user_role` | — | — | — | — | — | — | — | — | immutable / ledger |
| `pos_device` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `pricing_adjustment` | — | — | — | — | — | — | — | — | immutable / ledger |
| `pricing_display_section` | ✓ | — | ✓ | ✓ | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `pricing_quote` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `pricing_quote_line` | — | — | — | — | — | — | — | — | immutable / ledger |
| `promo_code` | ✓ | — | ✓ | ✓ | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `provider_rate_limit_state` | — | — | — | — | — | — | — | — | immutable / ledger |
| `provisioning_job` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `provisioning_step` | — | — | — | — | — | — | — | — | immutable / ledger |
| `redirect_rule` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `registration` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `registration_credential_delivery` | — | — | — | — | — | — | — | — | immutable / ledger |
| `schema_migration_catalog` | ✓ | — | — | — | — | — | — | ✓ | immutable / ledger |
| `schema_name_reservation` | — | — | — | — | — | — | — | — | immutable / ledger |
| `seo_structured_data` | ✓ | — | — | — | — | — | — | ✓ | immutable / ledger |
| `subscription` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `subscription_add_on` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `subscription_add_on_module` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `subscription_add_on_price` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `subscription_add_on_version` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `subscription_change` | — | — | — | — | — | — | — | — | immutable / ledger |
| `subscription_item` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `subscription_plan` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `subscription_plan_constraint` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `subscription_plan_feature` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `subscription_plan_module` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `subscription_plan_price` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `subscription_plan_price_tier` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `subscription_plan_version` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `subscription_product` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `tenant` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `tenant_membership` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `tenant_plan_contract` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `tenant_plan_feature_override` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `tenant_plan_module_override` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `tenant_price_override` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |
| `tenant_schema_migration_history` | — | — | — | — | — | — | — | — | immutable / ledger |
| `tenant_schema_registry` | — | — | — | — | — | — | — | ✓ | immutable / ledger |
| `tenant_translation_override` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `testimonial` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `translation_import_run` | — | — | — | — | — | — | — | — | immutable / ledger |
| `translation_key` | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `translation_namespace` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `translation_value` | — | — | — | — | — | ✓ | — | ✓ | soft delete |
| `website` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nonaktif + soft delete + purge terkontrol |
| `website_domain` | ✓ | — | — | — | — | ✓ | — | ✓ | nonaktif + soft delete + purge terkontrol |

## Schema `platform__audit`

| Tabel | `is_active` | `is_system` | `is_sample` | `sample_batch_id` | `deactivated_at` | `deleted_at` | `delete_reason` | `version` | Tingkat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `audit_event` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_export_event` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_permission_change` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_row_change` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_schema_migration` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |
| `audit_security_event` | — | — | — | — | — | — | — | — | append-only (tidak pernah dihapus) |

## Tabel append-only dan immutable

Tabel berikut tidak boleh di-UPDATE atau DELETE oleh role runtime. Pembatasan ditegakkan
oleh trigger database, bukan hanya oleh kode aplikasi.

| Schema | Tabel | Trigger penegak |
| --- | --- | --- |
| `demo` | `journal_entry` | `trg_journal_immutable` (BEFORE DELETE/UPDATE) |
| `demo` | `stock_movement` | `trg_stock_movement_immutable` (BEFORE DELETE/UPDATE) |

## Trigger audit DML

Setiap tabel data tenant memiliki trigger audit generik yang menulis perubahan baris ke
schema audit tenant beserta konteks permintaan.

Total trigger audit terpasang: 107 pada 107 tabel.
