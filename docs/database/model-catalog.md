# Katalog Model

> Berkas ini dihasilkan otomatis oleh `pnpm docs:generate` dari hasil introspeksi
> PostgreSQL. Jangan diedit manual — perubahan akan hilang pada generate berikutnya.

- Dihasilkan: `2026-07-30T10:47:45.433Z`
- Schema control plane: `platform`, `platform__audit`
- Schema tenant contoh: `demo`, `demo__audit`

Pemetaan tabel fisik ke resource aplikasi. Kolom **Resource master** terisi bila tabel dikelola melalui engine lifecycle master generik; tabel dokumen memiliki service tersendiri.

## Schema `demo`

| Tabel | Kolom | Resource master | Seed minimum | Kebijakan hapus permanen |
| --- | --- | --- | --- | --- |
| `account_type` | 22 | — | 10 | PURGE_IF_UNREFERENCED |
| `address` | 29 | — | — | — |
| `app_setting` | 25 | — | — | — |
| `backorder_purchase_order_link` | 4 | — | — | — |
| `backorder_supplier_decision` | 8 | — | — | — |
| `bill_of_material` | 27 | — | — | — |
| `bill_of_material_item` | 11 | — | — | — |
| `brand` | 22 | — | — | — |
| `business_group` | 24 | — | — | — |
| `carrier` | 23 | — | — | — |
| `cash_drawer_movement` | 9 | — | — | — |
| `chart_of_account` | 27 | `chart-of-accounts` | 10 | PURGE_IF_UNREFERENCED |
| `customer` | 30 | `customers` | 10 | PURGE_SAMPLE_ONLY |
| `customer_group` | 20 | `customer-groups` | 10 | PURGE_IF_UNREFERENCED |
| `data_export_log` | 7 | — | — | — |
| `department` | 23 | `departments` | 10 | PURGE_IF_UNREFERENCED |
| `employee` | 31 | — | — | — |
| `entity_attachment` | 10 | — | — | — |
| `file_object` | 26 | — | — | — |
| `fiscal_period` | 22 | — | — | — |
| `goods_receipt` | 26 | — | — | — |
| `goods_receipt_allocation` | 6 | — | — | — |
| `goods_receipt_discrepancy` | 6 | — | — | — |
| `goods_receipt_inspection` | 8 | — | — | — |
| `goods_receipt_line` | 22 | — | — | — |
| `goods_receipt_validation` | 8 | — | — | — |
| `idempotency_record` | 10 | — | — | — |
| `internal_transfer` | 21 | — | — | — |
| `internal_transfer_discrepancy` | 6 | — | — | — |
| `internal_transfer_line` | 16 | — | — | — |
| `internal_transfer_receipt` | 10 | — | — | — |
| `internal_transfer_receipt_line` | 9 | — | — | — |
| `inventory_adjustment` | 12 | — | — | — |
| `inventory_adjustment_line` | 10 | — | — | — |
| `inventory_lot` | 17 | — | — | — |
| `investor_profile` | 23 | — | — | — |
| `job_execution` | 7 | — | — | — |
| `job_position` | 23 | `job-positions` | 10 | PURGE_IF_UNREFERENCED |
| `journal_entry` | 21 | — | — | — |
| `journal_entry_line` | 9 | — | — | — |
| `leave_type` | 24 | `leave-types` | 10 | PURGE_IF_UNREFERENCED |
| `legal_entity` | 30 | — | — | — |
| `menu` | 30 | — | — | — |
| `menu_action` | 6 | — | — | — |
| `notification` | 14 | — | — | — |
| `notification_template` | 23 | — | 10 | PURGE_IF_UNREFERENCED |
| `number_sequence` | 29 | — | 10 | NEVER_PURGE |
| `onboarding_progress` | 9 | — | — | — |
| `outlet` | 29 | `outlets` | — | PURGE_IF_UNREFERENCED |
| `outlet_type` | 22 | `outlet-types` | 10 | PURGE_IF_UNREFERENCED |
| `owner_profile` | 22 | — | — | — |
| `ownership_interest` | 12 | — | — | — |
| `party` | 25 | — | — | — |
| `payment_method` | 24 | `payment-methods` | 10 | PURGE_IF_UNREFERENCED |
| `payment_term` | 23 | `payment-terms` | 10 | PURGE_IF_UNREFERENCED |
| `permission_action` | 23 | — | — | — |
| `pos_payment` | 11 | — | — | — |
| `pos_sale` | 25 | — | — | — |
| `pos_sale_line` | 13 | — | — | — |
| `pos_shift` | 14 | — | — | — |
| `pos_terminal` | 24 | — | — | — |
| `price_book` | 25 | — | — | — |
| `price_book_item` | 16 | — | — | — |
| `product` | 35 | `products` | 10 | PURGE_IF_UNREFERENCED |
| `product_barcode` | 14 | — | — | — |
| `product_brand` | 20 | `product-brands` | 10 | PURGE_IF_UNREFERENCED |
| `product_category` | 23 | `product-categories` | 10 | PURGE_IF_UNREFERENCED |
| `product_supplier` | 26 | `product-suppliers` | 10 | PURGE_IF_UNREFERENCED |
| `purchase_backorder` | 21 | — | — | — |
| `purchase_backorder_line` | 14 | — | — | — |
| `purchase_order` | 30 | — | — | — |
| `purchase_order_line` | 17 | — | — | — |
| `purchase_order_request_allocation` | 5 | — | — | — |
| `region` | 24 | `regions` | — | PURGE_IF_UNREFERENCED |
| `request_order` | 26 | — | — | — |
| `request_order_consolidation` | 8 | — | — | — |
| `request_order_consolidation_line` | 6 | — | — | — |
| `request_order_line` | 15 | — | — | — |
| `role` | 21 | `roles` | — | PURGE_IF_UNREFERENCED |
| `role_menu_permission` | 10 | — | — | — |
| `role_scope` | 6 | — | — | — |
| `sales_order` | 17 | — | — | — |
| `sales_order_line` | 13 | — | — | — |
| `saved_view` | 9 | — | — | — |
| `schema_migration` | 5 | — | — | — |
| `starter_data_marker` | 8 | — | — | — |
| `step_up_challenge` | 11 | — | — | — |
| `stock_alert` | 14 | — | — | — |
| `stock_balance` | 16 | — | — | — |
| `stock_count` | 12 | — | — | — |
| `stock_count_line` | 11 | — | — | — |
| `stock_movement` | 23 | — | — | — |
| `stock_policy` | 30 | `stock-policies` | — | PURGE_IF_UNREFERENCED |
| `stock_reservation` | 13 | — | — | — |
| `supplier` | 34 | `suppliers` | 10 | PURGE_SAMPLE_ONLY |
| `supplier_group` | 21 | `supplier-groups` | 10 | PURGE_IF_UNREFERENCED |
| `supplier_invoice` | 17 | — | — | — |
| `sync_inbox` | 9 | — | — | — |
| `sync_outbox` | 10 | — | — | — |
| `tax_category` | 21 | `tax-categories` | 10 | PURGE_IF_UNREFERENCED |
| `tax_rate` | 25 | — | — | — |
| `uom` | 24 | `uoms` | 10 | PURGE_IF_UNREFERENCED |
| `uom_conversion` | 15 | — | — | — |
| `user_direct_permission` | 9 | — | — | — |
| `user_role_assignment` | 8 | — | — | — |
| `user_subject` | 26 | — | — | — |
| `vehicle_type` | 23 | `vehicle-types` | 10 | PURGE_IF_UNREFERENCED |
| `warehouse` | 29 | `warehouses` | — | PURGE_IF_UNREFERENCED |
| `warehouse_bin` | 20 | — | — | — |
| `warehouse_type` | 24 | `warehouse-types` | 10 | PURGE_IF_UNREFERENCED |
| `warehouse_zone` | 16 | — | — | — |
| `workflow_action_log` | 7 | — | — | — |
| `workflow_definition` | 24 | — | — | — |
| `workflow_instance` | 9 | — | — | — |
| `workflow_step` | 11 | — | — | — |

## Schema `demo__audit`

| Tabel | Kolom | Resource master | Seed minimum | Kebijakan hapus permanen |
| --- | --- | --- | --- | --- |
| `audit_event` | 21 | — | — | — |
| `audit_export_event` | 8 | — | — | — |
| `audit_permission_change` | 9 | — | — | — |
| `audit_posting_event` | 11 | — | — | — |
| `audit_row_change` | 11 | — | — | — |
| `audit_schema_migration` | 9 | — | — | — |
| `audit_security_event` | 11 | — | — | — |

## Schema `platform`

| Tabel | Kolom | Resource master | Seed minimum | Kebijakan hapus permanen |
| --- | --- | --- | --- | --- |
| `announcement` | 28 | — | — | — |
| `billing_credit_note` | 9 | — | — | — |
| `billing_invoice` | 24 | — | — | — |
| `billing_invoice_line` | 15 | — | — | — |
| `billing_payment_allocation` | 8 | — | — | — |
| `billing_receipt` | 7 | — | — | — |
| `call_to_action` | 20 | — | — | — |
| `cms_block` | 15 | — | — | — |
| `cms_block_translation` | 13 | — | — | — |
| `cms_footer_item` | 12 | — | — | — |
| `cms_footer_section` | 13 | — | — | — |
| `cms_navigation` | 14 | — | — | — |
| `cms_navigation_item` | 16 | — | — | — |
| `cms_page` | 26 | — | — | — |
| `cms_page_translation` | 10 | — | — | — |
| `cms_page_version` | 19 | — | — | — |
| `cms_preview_token` | 8 | — | — | — |
| `cms_publication_workflow` | 12 | — | — | — |
| `contact_message` | 15 | — | — | — |
| `contact_office` | 19 | — | — | — |
| `demo_reset_run` | 9 | — | — | — |
| `demo_session` | 11 | — | — | — |
| `device_activation` | 9 | — | — | — |
| `device_entitlement` | 14 | — | — | — |
| `discount_approval` | 8 | — | — | — |
| `discount_benefit` | 11 | — | — | — |
| `discount_condition` | 9 | — | — | — |
| `discount_condition_group` | 8 | — | — | — |
| `discount_plan_eligibility` | 5 | — | — | — |
| `discount_program` | 29 | — | — | — |
| `discount_redemption` | 9 | — | — | — |
| `discount_rule` | 10 | — | — | — |
| `discount_tenant_eligibility` | 5 | — | — | — |
| `entitlement_snapshot` | 11 | — | — | — |
| `faq_category` | 15 | — | — | — |
| `faq_item` | 17 | — | — | — |
| `feature_catalog` | 26 | — | — | — |
| `global_menu_template` | 29 | — | — | — |
| `global_permission_action` | 22 | — | — | — |
| `global_role_template` | 24 | — | — | — |
| `hero_slide` | 26 | — | — | — |
| `host_to_host_log` | 16 | — | — | — |
| `idempotency_record` | 11 | — | — | — |
| `locale` | 26 | — | — | — |
| `marketing_feature` | 21 | — | — | — |
| `media_asset` | 26 | — | — | — |
| `media_folder` | 16 | — | — | — |
| `module_catalog` | 26 | — | — | — |
| `news_article` | 29 | — | — | — |
| `news_article_tag` | 4 | — | — | — |
| `news_article_translation` | 11 | — | — | — |
| `news_article_version` | 12 | — | — | — |
| `news_category` | 23 | — | — | — |
| `news_tag` | 14 | — | — | — |
| `newsletter_subscriber` | 10 | — | — | — |
| `package_assignment` | 14 | — | — | — |
| `partner_logo` | 16 | — | — | — |
| `payment_attempt` | 13 | — | — | — |
| `payment_callback_event` | 17 | — | — | — |
| `payment_channel` | 25 | — | — | — |
| `payment_channel_legacy_config` | 8 | — | — | — |
| `payment_check_batch` | 16 | — | — | — |
| `payment_check_batch_item` | 10 | — | — | — |
| `payment_dead_letter` | 8 | — | — | — |
| `payment_inquiry_attempt` | 13 | — | — | — |
| `payment_order` | 26 | — | — | — |
| `payment_provider` | 34 | — | — | — |
| `payment_reconciliation_item` | 9 | — | — | — |
| `payment_reconciliation_run` | 13 | — | — | — |
| `payment_status_transition` | 8 | — | — | — |
| `platform_admin_saved_view` | 9 | — | — | — |
| `platform_login_attempt` | 8 | — | — | — |
| `platform_permission` | 23 | — | — | — |
| `platform_refresh_token` | 8 | — | — | — |
| `platform_role` | 22 | — | — | — |
| `platform_role_permission` | 6 | — | — | — |
| `platform_session` | 13 | — | — | — |
| `platform_setting` | 12 | — | — | — |
| `platform_step_up_challenge` | 11 | — | — | — |
| `platform_support_session` | 12 | — | — | — |
| `platform_tenant_action` | 12 | — | — | — |
| `platform_user` | 30 | — | — | — |
| `platform_user_profile` | 10 | — | — | — |
| `platform_user_role` | 7 | — | — | — |
| `pos_device` | 30 | — | — | — |
| `pricing_adjustment` | 10 | — | — | — |
| `pricing_display_section` | 18 | — | — | — |
| `pricing_quote` | 26 | — | — | — |
| `pricing_quote_line` | 14 | — | — | — |
| `promo_code` | 15 | — | — | — |
| `provider_rate_limit_state` | 7 | — | — | — |
| `provisioning_job` | 16 | — | — | — |
| `provisioning_step` | 12 | — | — | — |
| `redirect_rule` | 12 | — | — | — |
| `registration` | 29 | — | — | — |
| `registration_credential_delivery` | 6 | — | — | — |
| `schema_migration_catalog` | 12 | — | — | — |
| `schema_name_reservation` | 8 | — | — | — |
| `seo_structured_data` | 8 | — | — | — |
| `subscription` | 22 | — | — | — |
| `subscription_add_on` | 22 | — | — | — |
| `subscription_add_on_module` | 7 | — | — | — |
| `subscription_add_on_price` | 14 | — | — | — |
| `subscription_add_on_version` | 12 | — | — | — |
| `subscription_change` | 8 | — | — | — |
| `subscription_item` | 14 | — | — | — |
| `subscription_plan` | 26 | — | — | — |
| `subscription_plan_constraint` | 8 | — | — | — |
| `subscription_plan_feature` | 10 | — | — | — |
| `subscription_plan_module` | 11 | — | — | — |
| `subscription_plan_price` | 18 | — | — | — |
| `subscription_plan_price_tier` | 10 | — | — | — |
| `subscription_plan_version` | 21 | — | — | — |
| `subscription_product` | 23 | — | — | — |
| `tenant` | 29 | — | — | — |
| `tenant_membership` | 12 | — | — | — |
| `tenant_plan_contract` | 16 | — | — | — |
| `tenant_plan_feature_override` | 9 | — | — | — |
| `tenant_plan_module_override` | 9 | — | — | — |
| `tenant_price_override` | 21 | — | — | — |
| `tenant_schema_migration_history` | 10 | — | — | — |
| `tenant_schema_registry` | 13 | — | — | — |
| `tenant_translation_override` | 11 | — | — | — |
| `testimonial` | 19 | — | — | — |
| `translation_import_run` | 13 | — | — | — |
| `translation_key` | 17 | — | — | — |
| `translation_namespace` | 20 | — | — | — |
| `translation_value` | 11 | — | — | — |
| `website` | 24 | — | — | — |
| `website_domain` | 11 | — | — | — |

## Schema `platform__audit`

| Tabel | Kolom | Resource master | Seed minimum | Kebijakan hapus permanen |
| --- | --- | --- | --- | --- |
| `audit_event` | 22 | — | — | — |
| `audit_export_event` | 9 | — | — | — |
| `audit_permission_change` | 10 | — | — | — |
| `audit_row_change` | 11 | — | — | — |
| `audit_schema_migration` | 9 | — | — | — |
| `audit_security_event` | 11 | — | — | — |

## Resource master yang diekspos melalui API generik

| Resource | Label | Tabel | Field dapat ditulis | Purge |
| --- | --- | --- | --- | --- |
| `uoms` | Satuan (UOM) | `uom` | 8 | ya |
| `product-categories` | Kategori Produk | `product_category` | 5 | ya |
| `product-brands` | Merek Produk | `product_brand` | 4 | ya |
| `products` | Produk | `product` | 19 | ya |
| `suppliers` | Pemasok | `supplier` | 16 | ya |
| `customers` | Pelanggan | `customer` | 12 | ya |
| `supplier-groups` | Grup Pemasok | `supplier_group` | 5 | ya |
| `customer-groups` | Grup Pelanggan | `customer_group` | 4 | ya |
| `warehouses` | Gudang | `warehouse` | 11 | ya |
| `warehouse-types` | Jenis Gudang | `warehouse_type` | 8 | ya |
| `outlets` | Outlet | `outlet` | 13 | ya |
| `outlet-types` | Jenis Outlet | `outlet_type` | 6 | ya |
| `regions` | Wilayah | `region` | 6 | ya |
| `stock-policies` | Kebijakan Minimum Stok | `stock_policy` | 14 | ya |
| `payment-methods` | Metode Pembayaran | `payment_method` | 8 | ya |
| `payment-terms` | Termin Pembayaran | `payment_term` | 7 | ya |
| `tax-categories` | Kategori Pajak | `tax_category` | 5 | ya |
| `departments` | Departemen | `department` | 7 | ya |
| `job-positions` | Jabatan | `job_position` | 7 | ya |
| `leave-types` | Jenis Cuti | `leave_type` | 8 | ya |
| `vehicle-types` | Jenis Kendaraan | `vehicle_type` | 7 | ya |
| `product-suppliers` | Produk Pemasok | `product_supplier` | 13 | ya |
| `roles` | Role | `role` | 5 | tidak |
| `chart-of-accounts` | Bagan Akun | `chart_of_account` | 9 | ya |
