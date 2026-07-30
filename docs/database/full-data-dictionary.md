# Kamus Data Lengkap

> Berkas ini dihasilkan otomatis oleh `pnpm docs:generate` dari hasil introspeksi
> PostgreSQL. Jangan diedit manual — perubahan akan hilang pada generate berikutnya.

- Dihasilkan: `2026-07-30T10:47:45.433Z`
- Schema control plane: `platform`, `platform__audit`
- Schema tenant contoh: `demo`, `demo__audit`

Setiap tabel dicantumkan beserta seluruh kolom, tipe fisik, nullability, nilai bawaan, kunci, dan relasi keluar. Kolom bertanda **PK** adalah primary key, **FK** foreign key, dan **U** bagian dari unique constraint.

## Ringkasan

| Schema | Jumlah tabel | Jumlah kolom | Foreign key | Index |
| --- | --- | --- | --- | --- |
| `demo` | 115 | 2028 | 215 | 395 |
| `demo__audit` | 7 | 80 | 1 | 21 |
| `platform` | 130 | 1962 | 150 | 450 |
| `platform__audit` | 6 | 72 | 1 | 22 |

## Schema `demo`

### `demo.account_type`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `normal_balance` | `varchar(8)` | tidak | `'DEBIT'::character varying` | — | — |
| 6 | `category` | `varchar(32)` | tidak | `'ASSET'::character varying` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_system` | `bool` | tidak | `false` | — | — |
| 9 | `is_sample` | `bool` | tidak | `false` | — | — |
| 10 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `metadata` | `jsonb` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `created_by` | `uuid` | ya | — | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `updated_by` | `uuid` | ya | — | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deactivated_by` | `uuid` | ya | — | — | — |
| 19 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 20 | `deleted_by` | `uuid` | ya | — | — | — |
| 21 | `delete_reason` | `text` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_account_type` — AFTER DELETE/INSERT/UPDATE

### `demo.address`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(64)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `address_line1` | `varchar(255)` | tidak | `''::character varying` | — | — |
| 6 | `address_line2` | `varchar(255)` | ya | — | — | — |
| 7 | `district` | `varchar(100)` | ya | — | — | — |
| 8 | `city_regency` | `varchar(100)` | ya | — | — | — |
| 9 | `province` | `varchar(100)` | ya | — | — | — |
| 10 | `postal_code` | `varchar(20)` | ya | — | — | — |
| 11 | `country` | `varchar(100)` | tidak | `'Indonesia'::character varying` | — | — |
| 12 | `latitude` | `numeric(12,8)` | ya | — | — | — |
| 13 | `longitude` | `numeric(12,8)` | ya | — | — | — |
| 14 | `is_active` | `bool` | tidak | `true` | — | — |
| 15 | `is_system` | `bool` | tidak | `false` | — | — |
| 16 | `is_sample` | `bool` | tidak | `false` | — | — |
| 17 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 18 | `sort_order` | `int4` | tidak | `0` | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 23 | `updated_by` | `uuid` | ya | — | — | — |
| 24 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 25 | `deactivated_by` | `uuid` | ya | — | — | — |
| 26 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 27 | `deleted_by` | `uuid` | ya | — | — | — |
| 28 | `delete_reason` | `text` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_address` — AFTER DELETE/INSERT/UPDATE

### `demo.app_setting`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `scope_type` | `varchar(32)` | tidak | `'TENANT'::character varying` | — | — |
| 3 | `scope_id` | `uuid` | ya | — | — | — |
| 4 | `code` | `varchar(96)` | tidak | — | — | — |
| 5 | `name` | `varchar(160)` | tidak | — | — | — |
| 6 | `description` | `text` | ya | — | — | — |
| 7 | `value_type` | `varchar(24)` | tidak | `'STRING'::character varying` | — | — |
| 8 | `value_json` | `jsonb` | tidak | `'{}'::jsonb` | — | — |
| 9 | `is_encrypted` | `bool` | tidak | `false` | — | — |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `is_system` | `bool` | tidak | `false` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `sort_order` | `int4` | tidak | `0` | — | — |
| 15 | `metadata` | `jsonb` | ya | — | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 21 | `deactivated_by` | `uuid` | ya | — | — | — |
| 22 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 23 | `deleted_by` | `uuid` | ya | — | — | — |
| 24 | `delete_reason` | `text` | ya | — | — | — |
| 25 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_app_setting` — AFTER DELETE/INSERT/UPDATE

### `demo.backorder_purchase_order_link`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `backorder_id` | `uuid` | tidak | — | FK | `purchase_backorder.id` (ON DELETE CASCADE) |
| 3 | `purchase_order_id` | `uuid` | tidak | — | FK | `purchase_order.id` (ON DELETE RESTRICT) |
| 4 | `created_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_backorder_purchase_order_link` — AFTER DELETE/INSERT/UPDATE

### `demo.backorder_supplier_decision`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `backorder_id` | `uuid` | tidak | — | FK | `purchase_backorder.id` (ON DELETE CASCADE) |
| 3 | `decision` | `varchar(32)` | tidak | — | — | — |
| 4 | `from_supplier_id` | `uuid` | ya | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 5 | `to_supplier_id` | `uuid` | ya | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 6 | `reason` | `text` | ya | — | — | — |
| 7 | `approved_by` | `uuid` | ya | — | — | — |
| 8 | `decided_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_backorder_supplier_decision` — AFTER DELETE/INSERT/UPDATE

### `demo.bill_of_material`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 3 | `output_uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 4 | `code` | `varchar(64)` | tidak | — | — | — |
| 5 | `name` | `varchar(160)` | tidak | — | — | — |
| 6 | `description` | `text` | ya | — | — | — |
| 7 | `bom_version` | `int4` | tidak | `1` | — | — |
| 8 | `output_qty` | `numeric(19,6)` | tidak | `1` | — | — |
| 9 | `effective_from` | `date` | tidak | `CURRENT_DATE` | — | — |
| 10 | `effective_until` | `date` | ya | — | — | — |
| 11 | `status` | `varchar(24)` | tidak | `'DRAFT'::character varying` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_system` | `bool` | tidak | `false` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `sort_order` | `int4` | tidak | `0` | — | — |
| 17 | `metadata` | `jsonb` | ya | — | — | — |
| 18 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `created_by` | `uuid` | ya | — | — | — |
| 20 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `updated_by` | `uuid` | ya | — | — | — |
| 22 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 23 | `deactivated_by` | `uuid` | ya | — | — | — |
| 24 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 25 | `deleted_by` | `uuid` | ya | — | — | — |
| 26 | `delete_reason` | `text` | ya | — | — | — |
| 27 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_bill_of_material` — AFTER DELETE/INSERT/UPDATE

### `demo.bill_of_material_item`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `bill_of_material_id` | `uuid` | tidak | — | FK | `bill_of_material.id` (ON DELETE CASCADE) |
| 3 | `material_product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `line_no` | `int4` | tidak | `1` | — | — |
| 6 | `required_qty` | `numeric(19,6)` | tidak | — | — | — |
| 7 | `waste_tolerance_pct` | `numeric(9,4)` | tidak | `0` | — | — |
| 8 | `is_mandatory` | `bool` | tidak | `true` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_bill_of_material_item` — AFTER DELETE/INSERT/UPDATE

### `demo.brand`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `legal_entity_id` | `uuid` | tidak | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `logo_file_id` | `uuid` | ya | — | FK | `file_object.id` (ON DELETE SET NULL) |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_system` | `bool` | tidak | `false` | — | — |
| 9 | `is_sample` | `bool` | tidak | `false` | — | — |
| 10 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `metadata` | `jsonb` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `created_by` | `uuid` | ya | — | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `updated_by` | `uuid` | ya | — | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deactivated_by` | `uuid` | ya | — | — | — |
| 19 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 20 | `deleted_by` | `uuid` | ya | — | — | — |
| 21 | `delete_reason` | `text` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_brand` — AFTER DELETE/INSERT/UPDATE

### `demo.business_group`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `parent_id` | `uuid` | ya | — | FK | `business_group.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `path` | `varchar(512)` | tidak | `''::character varying` | — | — |
| 7 | `level` | `int4` | tidak | `0` | — | — |
| 8 | `status` | `varchar(24)` | tidak | `'ACTIVE'::character varying` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_business_group` — AFTER DELETE/INSERT/UPDATE

### `demo.carrier`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `party_id` | `uuid` | ya | — | FK | `party.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `service_area` | `varchar(160)` | ya | — | — | — |
| 7 | `tracking_url_template` | `varchar(500)` | ya | — | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_carrier` — AFTER DELETE/INSERT/UPDATE

### `demo.cash_drawer_movement`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `shift_id` | `uuid` | tidak | — | FK | `pos_shift.id` (ON DELETE RESTRICT) |
| 3 | `movement_type` | `varchar(24)` | tidak | — | — | — |
| 4 | `amount` | `numeric(19,4)` | tidak | — | — | — |
| 5 | `reason` | `text` | ya | — | — | — |
| 6 | `source_type` | `varchar(48)` | ya | — | — | — |
| 7 | `source_id` | `uuid` | ya | — | — | — |
| 8 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |
| 9 | `created_by` | `uuid` | ya | — | — | — |

Trigger:

- `trg_audit_cash_drawer_movement` — AFTER DELETE/INSERT/UPDATE

### `demo.chart_of_account`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `legal_entity_id` | `uuid` | ya | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 3 | `parent_id` | `uuid` | ya | — | FK | `chart_of_account.id` (ON DELETE RESTRICT) |
| 4 | `account_type_id` | `uuid` | ya | — | FK | `account_type.id` (ON DELETE RESTRICT) |
| 5 | `code` | `varchar(48)` | tidak | — | — | — |
| 6 | `name` | `varchar(160)` | tidak | — | — | — |
| 7 | `description` | `text` | ya | — | — | — |
| 8 | `normal_balance` | `varchar(8)` | tidak | `'DEBIT'::character varying` | — | — |
| 9 | `allow_posting` | `bool` | tidak | `true` | — | — |
| 10 | `path` | `varchar(512)` | tidak | `''::character varying` | — | — |
| 11 | `level` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_system` | `bool` | tidak | `false` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `sort_order` | `int4` | tidak | `0` | — | — |
| 17 | `metadata` | `jsonb` | ya | — | — | — |
| 18 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `created_by` | `uuid` | ya | — | — | — |
| 20 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `updated_by` | `uuid` | ya | — | — | — |
| 22 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 23 | `deactivated_by` | `uuid` | ya | — | — | — |
| 24 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 25 | `deleted_by` | `uuid` | ya | — | — | — |
| 26 | `delete_reason` | `text` | ya | — | — | — |
| 27 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_chart_of_account` — AFTER DELETE/INSERT/UPDATE

### `demo.customer`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `party_id` | `uuid` | ya | — | FK | `party.id` (ON DELETE RESTRICT) |
| 3 | `customer_group_id` | `uuid` | ya | — | FK | `customer_group.id` (ON DELETE RESTRICT) |
| 4 | `payment_term_id` | `uuid` | ya | — | FK | `payment_term.id` (ON DELETE RESTRICT) |
| 5 | `address_id` | `uuid` | ya | — | FK | `address.id` (ON DELETE RESTRICT) |
| 6 | `code` | `varchar(64)` | tidak | — | — | — |
| 7 | `name` | `varchar(255)` | tidak | — | — | — |
| 8 | `description` | `text` | ya | — | — | — |
| 9 | `customer_number` | `varchar(48)` | ya | — | — | — |
| 10 | `customer_type` | `varchar(24)` | tidak | `'INDIVIDUAL'::character varying` | — | — |
| 11 | `tax_number` | `varchar(64)` | ya | — | — | — |
| 12 | `phone` | `varchar(50)` | ya | — | — | — |
| 13 | `email` | `varchar(160)` | ya | — | — | — |
| 14 | `credit_limit` | `numeric(19,4)` | tidak | `0` | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_system` | `bool` | tidak | `false` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `sort_order` | `int4` | tidak | `0` | — | — |
| 20 | `metadata` | `jsonb` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 24 | `updated_by` | `uuid` | ya | — | — | — |
| 25 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 26 | `deactivated_by` | `uuid` | ya | — | — | — |
| 27 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 28 | `deleted_by` | `uuid` | ya | — | — | — |
| 29 | `delete_reason` | `text` | ya | — | — | — |
| 30 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_customer` — AFTER DELETE/INSERT/UPDATE

### `demo.customer_group`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `is_active` | `bool` | tidak | `true` | — | — |
| 6 | `is_system` | `bool` | tidak | `false` | — | — |
| 7 | `is_sample` | `bool` | tidak | `false` | — | — |
| 8 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 9 | `sort_order` | `int4` | tidak | `0` | — | — |
| 10 | `metadata` | `jsonb` | ya | — | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 12 | `created_by` | `uuid` | ya | — | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `updated_by` | `uuid` | ya | — | — | — |
| 15 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 16 | `deactivated_by` | `uuid` | ya | — | — | — |
| 17 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 18 | `deleted_by` | `uuid` | ya | — | — | — |
| 19 | `delete_reason` | `text` | ya | — | — | — |
| 20 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_customer_group` — AFTER DELETE/INSERT/UPDATE

### `demo.data_export_log`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `user_subject_id` | `uuid` | ya | — | FK | `user_subject.id` (ON DELETE SET NULL) |
| 3 | `resource_code` | `varchar(64)` | tidak | — | — | — |
| 4 | `filter_snapshot` | `jsonb` | ya | — | — | — |
| 5 | `row_count` | `int4` | tidak | `0` | — | — |
| 6 | `format` | `varchar(16)` | tidak | `'CSV'::character varying` | — | — |
| 7 | `exported_at` | `timestamptz` | tidak | `now()` | — | — |

### `demo.department`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `legal_entity_id` | `uuid` | ya | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 3 | `parent_id` | `uuid` | ya | — | FK | `department.id` (ON DELETE RESTRICT) |
| 4 | `code` | `varchar(48)` | tidak | — | — | — |
| 5 | `name` | `varchar(120)` | tidak | — | — | — |
| 6 | `description` | `text` | ya | — | — | — |
| 7 | `cost_center` | `varchar(48)` | ya | — | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_department` — AFTER DELETE/INSERT/UPDATE

### `demo.employee`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `party_id` | `uuid` | ya | — | FK | `party.id` (ON DELETE RESTRICT) |
| 3 | `legal_entity_id` | `uuid` | ya | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 4 | `department_id` | `uuid` | ya | — | FK | `department.id` (ON DELETE RESTRICT) |
| 5 | `job_position_id` | `uuid` | ya | — | FK | `job_position.id` (ON DELETE RESTRICT) |
| 6 | `user_subject_id` | `uuid` | ya | — | FK | `user_subject.id` (ON DELETE SET NULL) |
| 7 | `code` | `varchar(64)` | tidak | — | — | — |
| 8 | `name` | `varchar(160)` | tidak | — | — | — |
| 9 | `description` | `text` | ya | — | — | — |
| 10 | `employee_number` | `varchar(48)` | tidak | — | — | — |
| 11 | `employment_status` | `varchar(32)` | tidak | `'PERMANENT'::character varying` | — | — |
| 12 | `hire_date` | `date` | ya | — | — | — |
| 13 | `termination_date` | `date` | ya | — | — | — |
| 14 | `email` | `varchar(160)` | ya | — | — | — |
| 15 | `phone` | `varchar(50)` | ya | — | — | — |
| 16 | `is_active` | `bool` | tidak | `true` | — | — |
| 17 | `is_system` | `bool` | tidak | `false` | — | — |
| 18 | `is_sample` | `bool` | tidak | `false` | — | — |
| 19 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 20 | `sort_order` | `int4` | tidak | `0` | — | — |
| 21 | `metadata` | `jsonb` | ya | — | — | — |
| 22 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 23 | `created_by` | `uuid` | ya | — | — | — |
| 24 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 25 | `updated_by` | `uuid` | ya | — | — | — |
| 26 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 27 | `deactivated_by` | `uuid` | ya | — | — | — |
| 28 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 29 | `deleted_by` | `uuid` | ya | — | — | — |
| 30 | `delete_reason` | `text` | ya | — | — | — |
| 31 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_employee` — AFTER DELETE/INSERT/UPDATE

### `demo.entity_attachment`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `entity_type` | `varchar(96)` | tidak | — | — | — |
| 3 | `entity_id` | `uuid` | tidak | — | — | — |
| 4 | `file_id` | `uuid` | tidak | — | FK | `file_object.id` (ON DELETE RESTRICT) |
| 5 | `category` | `varchar(48)` | tidak | `'GENERAL'::character varying` | — | — |
| 6 | `sort_order` | `int4` | tidak | `0` | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 8 | `created_by` | `uuid` | ya | — | — | — |
| 9 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_entity_attachment` — AFTER DELETE/INSERT/UPDATE

### `demo.file_object`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(96)` | tidak | — | — | — |
| 3 | `name` | `varchar(255)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `storage_key` | `varchar(512)` | tidak | — | — | — |
| 6 | `filename` | `varchar(255)` | tidak | — | — | — |
| 7 | `mime_type` | `varchar(128)` | tidak | — | — | — |
| 8 | `size_bytes` | `int8` | tidak | `0` | — | — |
| 9 | `checksum` | `varchar(64)` | ya | — | — | — |
| 10 | `owner_subject_id` | `uuid` | ya | — | — | — |
| 11 | `is_active` | `bool` | tidak | `true` | — | — |
| 12 | `is_system` | `bool` | tidak | `false` | — | — |
| 13 | `is_sample` | `bool` | tidak | `false` | — | — |
| 14 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 15 | `sort_order` | `int4` | tidak | `0` | — | — |
| 16 | `metadata` | `jsonb` | ya | — | — | — |
| 17 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `created_by` | `uuid` | ya | — | — | — |
| 19 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 20 | `updated_by` | `uuid` | ya | — | — | — |
| 21 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 22 | `deactivated_by` | `uuid` | ya | — | — | — |
| 23 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_by` | `uuid` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_file_object` — AFTER DELETE/INSERT/UPDATE

### `demo.fiscal_period`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `legal_entity_id` | `uuid` | ya | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `fiscal_year` | `int4` | tidak | — | — | — |
| 6 | `period_no` | `int4` | tidak | — | — | — |
| 7 | `start_date` | `date` | tidak | — | — | — |
| 8 | `end_date` | `date` | tidak | — | — | — |
| 9 | `status` | `varchar(24)` | tidak | `'OPEN'::character varying` | — | — |
| 10 | `closed_at` | `timestamptz` | ya | — | — | — |
| 11 | `closed_by` | `uuid` | ya | — | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_system` | `bool` | tidak | `false` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `sort_order` | `int4` | tidak | `0` | — | — |
| 17 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `delete_reason` | `text` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_fiscal_period` — AFTER DELETE/INSERT/UPDATE

### `demo.goods_receipt`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `receipt_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `purchase_order_id` | `uuid` | ya | — | FK | `purchase_order.id` (ON DELETE RESTRICT) |
| 4 | `supplier_id` | `uuid` | ya | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 5 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 6 | `backorder_id` | `uuid` | ya | — | FK | `purchase_backorder.id` (ON DELETE RESTRICT) |
| 7 | `arrival_date` | `date` | ya | — | — | — |
| 8 | `receipt_date` | `date` | tidak | `CURRENT_DATE` | — | — |
| 9 | `supplier_do_number` | `varchar(64)` | ya | — | — | — |
| 10 | `status` | `varchar(40)` | tidak | `'DRAFT'::character varying` | — | — |
| 11 | `validation_status` | `varchar(32)` | tidak | `'PENDING'::character varying` | — | — |
| 12 | `inspected_at` | `timestamptz` | ya | — | — | — |
| 13 | `inspected_by` | `uuid` | ya | — | — | — |
| 14 | `validated_at` | `timestamptz` | ya | — | — | — |
| 15 | `validated_by` | `uuid` | ya | — | — | — |
| 16 | `posting_key` | `varchar(96)` | ya | — | — | — |
| 17 | `reversed_at` | `timestamptz` | ya | — | — | — |
| 18 | `reverse_reason` | `text` | ya | — | — | — |
| 19 | `note` | `text` | ya | — | — | — |
| 20 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 24 | `updated_by` | `uuid` | ya | — | — | — |
| 25 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_goods_receipt` — AFTER DELETE/INSERT/UPDATE

### `demo.goods_receipt_allocation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `goods_receipt_line_id` | `uuid` | tidak | — | FK | `goods_receipt_line.id` (ON DELETE CASCADE) |
| 3 | `request_order_line_id` | `uuid` | tidak | — | FK | `request_order_line.id` (ON DELETE RESTRICT) |
| 4 | `allocated_qty` | `numeric(19,6)` | tidak | — | — | — |
| 5 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 6 | `created_by` | `uuid` | ya | — | — | — |

Trigger:

- `trg_audit_goods_receipt_allocation` — AFTER DELETE/INSERT/UPDATE

### `demo.goods_receipt_discrepancy`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `goods_receipt_line_id` | `uuid` | tidak | — | FK | `goods_receipt_line.id` (ON DELETE CASCADE) |
| 3 | `discrepancy_type` | `varchar(32)` | tidak | — | — | — |
| 4 | `quantity` | `numeric(19,6)` | tidak | `0` | — | — |
| 5 | `note` | `text` | ya | — | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_goods_receipt_discrepancy` — AFTER DELETE/INSERT/UPDATE

### `demo.goods_receipt_inspection`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `goods_receipt_id` | `uuid` | tidak | — | FK | `goods_receipt.id` (ON DELETE CASCADE) |
| 3 | `inspector_id` | `uuid` | ya | — | — | — |
| 4 | `inspected_at` | `timestamptz` | tidak | `now()` | — | — |
| 5 | `result` | `varchar(24)` | tidak | `'PASS'::character varying` | — | — |
| 6 | `notes` | `text` | ya | — | — | — |
| 7 | `detail` | `jsonb` | ya | — | — | — |
| 8 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_goods_receipt_inspection` — AFTER DELETE/INSERT/UPDATE

### `demo.goods_receipt_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `goods_receipt_id` | `uuid` | tidak | — | FK | `goods_receipt.id` (ON DELETE CASCADE) |
| 3 | `purchase_order_line_id` | `uuid` | ya | — | FK | `purchase_order_line.id` (ON DELETE RESTRICT) |
| 4 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 5 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 6 | `lot_id` | `uuid` | ya | — | FK | `inventory_lot.id` (ON DELETE RESTRICT) |
| 7 | `bin_id` | `uuid` | ya | — | FK | `warehouse_bin.id` (ON DELETE RESTRICT) |
| 8 | `line_no` | `int4` | tidak | `1` | — | — |
| 9 | `ordered_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 10 | `previously_received_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 11 | `received_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 12 | `accepted_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 13 | `rejected_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 14 | `backorder_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 15 | `unit_cost` | `numeric(19,4)` | tidak | `0` | — | — |
| 16 | `batch_number` | `varchar(64)` | ya | — | — | — |
| 17 | `expiry_date` | `date` | ya | — | — | — |
| 18 | `quality_status` | `varchar(24)` | tidak | `'PENDING'::character varying` | — | — |
| 19 | `note` | `text` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

Check constraint:

- `ck_gr_line_qty`

Trigger:

- `trg_audit_goods_receipt_line` — AFTER DELETE/INSERT/UPDATE

### `demo.goods_receipt_validation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `goods_receipt_id` | `uuid` | tidak | — | FK | `goods_receipt.id` (ON DELETE CASCADE) |
| 3 | `validator_id` | `uuid` | ya | — | — | — |
| 4 | `validated_at` | `timestamptz` | tidak | `now()` | — | — |
| 5 | `posting_key` | `varchar(96)` | tidak | — | — | — |
| 6 | `action` | `varchar(24)` | tidak | `'VALIDATE'::character varying` | — | — |
| 7 | `reason` | `text` | ya | — | — | — |
| 8 | `detail` | `jsonb` | ya | — | — | — |

Trigger:

- `trg_audit_goods_receipt_validation` — AFTER DELETE/INSERT/UPDATE

### `demo.idempotency_record`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `idempotency_key` | `varchar(96)` | tidak | — | — | — |
| 3 | `operation` | `varchar(96)` | tidak | — | — | — |
| 4 | `request_hash` | `varchar(64)` | tidak | — | — | — |
| 5 | `response_status` | `int4` | tidak | — | — | — |
| 6 | `response_body` | `jsonb` | ya | — | — | — |
| 7 | `resource_type` | `varchar(64)` | ya | — | — | — |
| 8 | `resource_id` | `varchar(64)` | ya | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `expires_at` | `timestamptz` | tidak | — | — | — |

### `demo.internal_transfer`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `transfer_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `source_warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 4 | `destination_warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 5 | `request_order_id` | `uuid` | ya | — | FK | `request_order.id` (ON DELETE RESTRICT) |
| 6 | `status` | `varchar(48)` | tidak | `'DRAFT'::character varying` | — | — |
| 7 | `dispatch_date` | `timestamptz` | ya | — | — | — |
| 8 | `arrival_date` | `timestamptz` | ya | — | — | — |
| 9 | `received_date` | `timestamptz` | ya | — | — | — |
| 10 | `approved_at` | `timestamptz` | ya | — | — | — |
| 11 | `approved_by` | `uuid` | ya | — | — | — |
| 12 | `dispatch_posting_key` | `varchar(96)` | ya | — | — | — |
| 13 | `receipt_posting_key` | `varchar(96)` | ya | — | — | — |
| 14 | `note` | `text` | ya | — | — | — |
| 15 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

Check constraint:

- `ck_transfer_diff_warehouse`

Trigger:

- `trg_audit_internal_transfer` — AFTER DELETE/INSERT/UPDATE

### `demo.internal_transfer_discrepancy`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `internal_transfer_line_id` | `uuid` | tidak | — | FK | `internal_transfer_line.id` (ON DELETE CASCADE) |
| 3 | `discrepancy_type` | `varchar(32)` | tidak | — | — | — |
| 4 | `quantity` | `numeric(19,6)` | tidak | `0` | — | — |
| 5 | `note` | `text` | ya | — | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_internal_transfer_discrepancy` — AFTER DELETE/INSERT/UPDATE

### `demo.internal_transfer_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `internal_transfer_id` | `uuid` | tidak | — | FK | `internal_transfer.id` (ON DELETE CASCADE) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `lot_id` | `uuid` | ya | — | FK | `inventory_lot.id` (ON DELETE RESTRICT) |
| 6 | `line_no` | `int4` | tidak | `1` | — | — |
| 7 | `requested_qty` | `numeric(19,6)` | tidak | — | — | — |
| 8 | `allocated_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 9 | `dispatched_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 10 | `received_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 11 | `rejected_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 12 | `unit_cost` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `note` | `text` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_internal_transfer_line` — AFTER DELETE/INSERT/UPDATE

### `demo.internal_transfer_receipt`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `internal_transfer_id` | `uuid` | tidak | — | FK | `internal_transfer.id` (ON DELETE CASCADE) |
| 3 | `receipt_number` | `varchar(48)` | tidak | — | — | — |
| 4 | `arrived_at` | `timestamptz` | ya | — | — | — |
| 5 | `validated_at` | `timestamptz` | ya | — | — | — |
| 6 | `validated_by` | `uuid` | ya | — | — | — |
| 7 | `status` | `varchar(32)` | tidak | `'DRAFT'::character varying` | — | — |
| 8 | `note` | `text` | ya | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_internal_transfer_receipt` — AFTER DELETE/INSERT/UPDATE

### `demo.internal_transfer_receipt_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `transfer_receipt_id` | `uuid` | tidak | — | FK | `internal_transfer_receipt.id` (ON DELETE CASCADE) |
| 3 | `internal_transfer_line_id` | `uuid` | tidak | — | FK | `internal_transfer_line.id` (ON DELETE RESTRICT) |
| 4 | `received_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 5 | `accepted_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 6 | `rejected_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 7 | `discrepancy_type` | `varchar(32)` | ya | — | — | — |
| 8 | `note` | `text` | ya | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_internal_transfer_receipt_line` — AFTER DELETE/INSERT/UPDATE

### `demo.inventory_adjustment`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 3 | `stock_count_id` | `uuid` | ya | — | FK | `stock_count.id` (ON DELETE RESTRICT) |
| 4 | `adjustment_number` | `varchar(48)` | tidak | — | — | — |
| 5 | `adjustment_date` | `date` | tidak | `CURRENT_DATE` | — | — |
| 6 | `reason` | `text` | tidak | — | — | — |
| 7 | `status` | `varchar(32)` | tidak | `'DRAFT'::character varying` | — | — |
| 8 | `posted_at` | `timestamptz` | ya | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `created_by` | `uuid` | ya | — | — | — |
| 11 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_inventory_adjustment` — AFTER DELETE/INSERT/UPDATE

### `demo.inventory_adjustment_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `adjustment_id` | `uuid` | tidak | — | FK | `inventory_adjustment.id` (ON DELETE CASCADE) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `lot_id` | `uuid` | ya | — | FK | `inventory_lot.id` (ON DELETE RESTRICT) |
| 5 | `bin_id` | `uuid` | ya | — | FK | `warehouse_bin.id` (ON DELETE RESTRICT) |
| 6 | `quantity` | `numeric(19,6)` | tidak | — | — | — |
| 7 | `direction` | `varchar(8)` | tidak | `'IN'::character varying` | — | — |
| 8 | `unit_cost` | `numeric(19,4)` | tidak | `0` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_inventory_adjustment_line` — AFTER DELETE/INSERT/UPDATE

### `demo.inventory_lot`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 3 | `supplier_id` | `uuid` | ya | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 4 | `code` | `varchar(64)` | tidak | — | — | — |
| 5 | `name` | `varchar(160)` | tidak | — | — | — |
| 6 | `lot_number` | `varchar(64)` | tidak | — | — | — |
| 7 | `production_date` | `date` | ya | — | — | — |
| 8 | `expiry_date` | `date` | ya | — | — | — |
| 9 | `quality_status` | `varchar(24)` | tidak | `'GOOD'::character varying` | — | — |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 16 | `delete_reason` | `text` | ya | — | — | — |
| 17 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_inventory_lot` — AFTER DELETE/INSERT/UPDATE

### `demo.investor_profile`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `party_id` | `uuid` | tidak | — | FK | `party.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `investor_number` | `varchar(48)` | ya | — | — | — |
| 7 | `bank_account` | `varchar(64)` | ya | — | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_investor_profile` — AFTER DELETE/INSERT/UPDATE

### `demo.job_execution`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `job_code` | `varchar(64)` | tidak | — | — | — |
| 3 | `status` | `varchar(24)` | tidak | `'RUNNING'::character varying` | — | — |
| 4 | `started_at` | `timestamptz` | tidak | `now()` | — | — |
| 5 | `finished_at` | `timestamptz` | ya | — | — | — |
| 6 | `result` | `jsonb` | ya | — | — | — |
| 7 | `error_message` | `text` | ya | — | — | — |

### `demo.job_position`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `legal_entity_id` | `uuid` | ya | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 3 | `department_id` | `uuid` | ya | — | FK | `department.id` (ON DELETE RESTRICT) |
| 4 | `code` | `varchar(48)` | tidak | — | — | — |
| 5 | `name` | `varchar(120)` | tidak | — | — | — |
| 6 | `description` | `text` | ya | — | — | — |
| 7 | `grade_level` | `int4` | tidak | `1` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_job_position` — AFTER DELETE/INSERT/UPDATE

### `demo.journal_entry`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `legal_entity_id` | `uuid` | ya | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 3 | `fiscal_period_id` | `uuid` | ya | — | FK | `fiscal_period.id` (ON DELETE RESTRICT) |
| 4 | `journal_number` | `varchar(48)` | tidak | — | — | — |
| 5 | `journal_date` | `date` | tidak | `CURRENT_DATE` | — | — |
| 6 | `source_type` | `varchar(48)` | tidak | — | — | — |
| 7 | `source_id` | `uuid` | ya | — | — | — |
| 8 | `posting_key` | `varchar(96)` | tidak | — | — | — |
| 9 | `description` | `text` | ya | — | — | — |
| 10 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 11 | `exchange_rate` | `numeric(19,8)` | tidak | `1` | — | — |
| 12 | `total_debit` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `total_credit` | `numeric(19,4)` | tidak | `0` | — | — |
| 14 | `status` | `varchar(24)` | tidak | `'DRAFT'::character varying` | — | — |
| 15 | `posted_at` | `timestamptz` | ya | — | — | — |
| 16 | `posted_by` | `uuid` | ya | — | — | — |
| 17 | `reversal_of_id` | `uuid` | ya | — | FK | `journal_entry.id` (ON DELETE RESTRICT) |
| 18 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `created_by` | `uuid` | ya | — | — | — |
| 20 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

Check constraint:

- `ck_journal_balanced`

Trigger:

- `trg_audit_journal_entry` — AFTER DELETE/INSERT/UPDATE
- `trg_journal_immutable` — BEFORE DELETE/UPDATE

### `demo.journal_entry_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `journal_entry_id` | `uuid` | tidak | — | FK | `journal_entry.id` (ON DELETE CASCADE) |
| 3 | `account_id` | `uuid` | tidak | — | FK | `chart_of_account.id` (ON DELETE RESTRICT) |
| 4 | `line_no` | `int4` | tidak | `1` | — | — |
| 5 | `debit` | `numeric(19,4)` | tidak | `0` | — | — |
| 6 | `credit` | `numeric(19,4)` | tidak | `0` | — | — |
| 7 | `description` | `text` | ya | — | — | — |
| 8 | `dimensions` | `jsonb` | ya | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_journal_entry_line` — AFTER DELETE/INSERT/UPDATE

### `demo.leave_type`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `name_key` | `varchar(160)` | tidak | `''::character varying` | — | — |
| 6 | `default_quota_days` | `int4` | tidak | `0` | — | — |
| 7 | `is_paid` | `bool` | tidak | `true` | — | — |
| 8 | `requires_attachment` | `bool` | tidak | `false` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_leave_type` — AFTER DELETE/INSERT/UPDATE

### `demo.legal_entity`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `business_group_id` | `uuid` | ya | — | FK | `business_group.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `legal_name` | `varchar(255)` | tidak | — | — | — |
| 7 | `trade_name` | `varchar(255)` | ya | — | — | — |
| 8 | `legal_form` | `varchar(64)` | ya | — | — | — |
| 9 | `tax_number` | `varchar(64)` | ya | — | — | — |
| 10 | `registration_number` | `varchar(64)` | ya | — | — | — |
| 11 | `address_id` | `uuid` | ya | — | FK | `address.id` (ON DELETE RESTRICT) |
| 12 | `fiscal_year_start_month` | `int4` | tidak | `1` | — | — |
| 13 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 14 | `timezone` | `varchar(64)` | tidak | `'Asia/Jakarta'::character varying` | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_system` | `bool` | tidak | `false` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `sort_order` | `int4` | tidak | `0` | — | — |
| 20 | `metadata` | `jsonb` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 24 | `updated_by` | `uuid` | ya | — | — | — |
| 25 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 26 | `deactivated_by` | `uuid` | ya | — | — | — |
| 27 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 28 | `deleted_by` | `uuid` | ya | — | — | — |
| 29 | `delete_reason` | `text` | ya | — | — | — |
| 30 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_legal_entity` — AFTER DELETE/INSERT/UPDATE

### `demo.menu`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `parent_id` | `uuid` | ya | — | FK | `menu.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `translation_key` | `varchar(160)` | tidak | — | — | — |
| 7 | `route` | `varchar(160)` | ya | — | — | — |
| 8 | `icon` | `varchar(64)` | ya | — | — | — |
| 9 | `module_code` | `varchar(48)` | ya | — | — | — |
| 10 | `platform_target` | `varchar(24)` | tidak | `'WEB'::character varying` | — | — |
| 11 | `path` | `varchar(512)` | tidak | `''::character varying` | — | — |
| 12 | `level` | `int4` | tidak | `0` | — | — |
| 13 | `is_coming_soon` | `bool` | tidak | `false` | — | — |
| 14 | `requires_entitlement` | `bool` | tidak | `false` | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_system` | `bool` | tidak | `true` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `sort_order` | `int4` | tidak | `0` | — | — |
| 20 | `metadata` | `jsonb` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 24 | `updated_by` | `uuid` | ya | — | — | — |
| 25 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 26 | `deactivated_by` | `uuid` | ya | — | — | — |
| 27 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 28 | `deleted_by` | `uuid` | ya | — | — | — |
| 29 | `delete_reason` | `text` | ya | — | — | — |
| 30 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_menu` — AFTER DELETE/INSERT/UPDATE

### `demo.menu_action`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `menu_id` | `uuid` | tidak | — | FK | `menu.id` (ON DELETE CASCADE) |
| 3 | `permission_action_id` | `uuid` | tidak | — | FK | `permission_action.id` (ON DELETE RESTRICT) |
| 4 | `sort_order` | `int4` | tidak | `0` | — | — |
| 5 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 6 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_menu_action` — AFTER DELETE/INSERT/UPDATE

### `demo.notification`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `template_id` | `uuid` | ya | — | FK | `notification_template.id` (ON DELETE SET NULL) |
| 3 | `recipient_subject_id` | `uuid` | ya | — | FK | `user_subject.id` (ON DELETE CASCADE) |
| 4 | `channel` | `varchar(24)` | tidak | `'IN_APP'::character varying` | — | — |
| 5 | `title` | `varchar(255)` | tidak | — | — | — |
| 6 | `body` | `text` | tidak | — | — | — |
| 7 | `payload` | `jsonb` | ya | — | — | — |
| 8 | `entity_type` | `varchar(96)` | ya | — | — | — |
| 9 | `entity_id` | `uuid` | ya | — | — | — |
| 10 | `severity` | `varchar(16)` | tidak | `'INFO'::character varying` | — | — |
| 11 | `read_at` | `timestamptz` | ya | — | — | — |
| 12 | `sent_at` | `timestamptz` | ya | — | — | — |
| 13 | `status` | `varchar(24)` | tidak | `'PENDING'::character varying` | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |

### `demo.notification_template`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(64)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `channel` | `varchar(24)` | tidak | `'IN_APP'::character varying` | — | — |
| 6 | `subject_template` | `text` | ya | — | — | — |
| 7 | `body_template` | `text` | tidak | — | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_notification_template` — AFTER DELETE/INSERT/UPDATE

### `demo.number_sequence`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(64)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `document_type` | `varchar(64)` | tidak | — | — | — |
| 6 | `scope_type` | `varchar(32)` | tidak | `'TENANT'::character varying` | — | — |
| 7 | `scope_id` | `uuid` | ya | — | — | — |
| 8 | `prefix` | `varchar(32)` | tidak | `''::character varying` | — | — |
| 9 | `suffix` | `varchar(32)` | tidak | `''::character varying` | — | — |
| 10 | `padding` | `int4` | tidak | `5` | — | — |
| 11 | `next_number` | `int8` | tidak | `1` | — | — |
| 12 | `reset_policy` | `varchar(24)` | tidak | `'NEVER'::character varying` | — | — |
| 13 | `last_reset_at` | `timestamptz` | ya | — | — | — |
| 14 | `is_active` | `bool` | tidak | `true` | — | — |
| 15 | `is_system` | `bool` | tidak | `false` | — | — |
| 16 | `is_sample` | `bool` | tidak | `false` | — | — |
| 17 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 18 | `sort_order` | `int4` | tidak | `0` | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 23 | `updated_by` | `uuid` | ya | — | — | — |
| 24 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 25 | `deactivated_by` | `uuid` | ya | — | — | — |
| 26 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 27 | `deleted_by` | `uuid` | ya | — | — | — |
| 28 | `delete_reason` | `text` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_number_sequence` — AFTER DELETE/INSERT/UPDATE

### `demo.onboarding_progress`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `current_step` | `int4` | tidak | `1` | — | — |
| 3 | `completed_steps` | `jsonb` | tidak | `'[]'::jsonb` | — | — |
| 4 | `step_payloads` | `jsonb` | tidak | `'{}'::jsonb` | — | — |
| 5 | `is_completed` | `bool` | tidak | `false` | — | — |
| 6 | `completed_at` | `timestamptz` | ya | — | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 9 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_onboarding_progress` — AFTER DELETE/INSERT/UPDATE

### `demo.outlet`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `legal_entity_id` | `uuid` | tidak | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 3 | `brand_id` | `uuid` | ya | — | FK | `brand.id` (ON DELETE RESTRICT) |
| 4 | `region_id` | `uuid` | ya | — | FK | `region.id` (ON DELETE RESTRICT) |
| 5 | `outlet_type_id` | `uuid` | ya | — | FK | `outlet_type.id` (ON DELETE RESTRICT) |
| 6 | `address_id` | `uuid` | ya | — | FK | `address.id` (ON DELETE RESTRICT) |
| 7 | `code` | `varchar(64)` | tidak | — | — | — |
| 8 | `name` | `varchar(160)` | tidak | — | — | — |
| 9 | `description` | `text` | ya | — | — | — |
| 10 | `phone` | `varchar(50)` | ya | — | — | — |
| 11 | `email` | `varchar(160)` | ya | — | — | — |
| 12 | `timezone` | `varchar(64)` | tidak | `'Asia/Jakarta'::character varying` | — | — |
| 13 | `opening_date` | `date` | ya | — | — | — |
| 14 | `is_active` | `bool` | tidak | `true` | — | — |
| 15 | `is_system` | `bool` | tidak | `false` | — | — |
| 16 | `is_sample` | `bool` | tidak | `false` | — | — |
| 17 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 18 | `sort_order` | `int4` | tidak | `0` | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 23 | `updated_by` | `uuid` | ya | — | — | — |
| 24 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 25 | `deactivated_by` | `uuid` | ya | — | — | — |
| 26 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 27 | `deleted_by` | `uuid` | ya | — | — | — |
| 28 | `delete_reason` | `text` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_outlet` — AFTER DELETE/INSERT/UPDATE

### `demo.outlet_type`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `name_key` | `varchar(160)` | tidak | `''::character varying` | — | — |
| 6 | `category` | `varchar(48)` | tidak | `'RETAIL'::character varying` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_system` | `bool` | tidak | `false` | — | — |
| 9 | `is_sample` | `bool` | tidak | `false` | — | — |
| 10 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `metadata` | `jsonb` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `created_by` | `uuid` | ya | — | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `updated_by` | `uuid` | ya | — | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deactivated_by` | `uuid` | ya | — | — | — |
| 19 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 20 | `deleted_by` | `uuid` | ya | — | — | — |
| 21 | `delete_reason` | `text` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_outlet_type` — AFTER DELETE/INSERT/UPDATE

### `demo.owner_profile`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `party_id` | `uuid` | tidak | — | FK | `party.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `bank_account` | `varchar(64)` | ya | — | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_system` | `bool` | tidak | `false` | — | — |
| 9 | `is_sample` | `bool` | tidak | `false` | — | — |
| 10 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `metadata` | `jsonb` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `created_by` | `uuid` | ya | — | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `updated_by` | `uuid` | ya | — | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deactivated_by` | `uuid` | ya | — | — | — |
| 19 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 20 | `deleted_by` | `uuid` | ya | — | — | — |
| 21 | `delete_reason` | `text` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_owner_profile` — AFTER DELETE/INSERT/UPDATE

### `demo.ownership_interest`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `party_id` | `uuid` | tidak | — | FK | `party.id` (ON DELETE RESTRICT) |
| 3 | `target_type` | `varchar(32)` | tidak | — | — | — |
| 4 | `target_id` | `uuid` | tidak | — | — | — |
| 5 | `percentage` | `numeric(9,4)` | tidak | `0` | — | — |
| 6 | `effective_from` | `date` | tidak | `CURRENT_DATE` | — | — |
| 7 | `effective_until` | `date` | ya | — | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 9 | `created_by` | `uuid` | ya | — | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 11 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_ownership_interest` — AFTER DELETE/INSERT/UPDATE

### `demo.party`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `party_type` | `varchar(24)` | tidak | `'PERSON'::character varying` | — | — |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(255)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `tax_number` | `varchar(64)` | ya | — | — | — |
| 7 | `email` | `varchar(255)` | ya | — | — | — |
| 8 | `phone` | `varchar(50)` | ya | — | — | — |
| 9 | `address_id` | `uuid` | ya | — | FK | `address.id` (ON DELETE RESTRICT) |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `is_system` | `bool` | tidak | `false` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `sort_order` | `int4` | tidak | `0` | — | — |
| 15 | `metadata` | `jsonb` | ya | — | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 21 | `deactivated_by` | `uuid` | ya | — | — | — |
| 22 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 23 | `deleted_by` | `uuid` | ya | — | — | — |
| 24 | `delete_reason` | `text` | ya | — | — | — |
| 25 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_party` — AFTER DELETE/INSERT/UPDATE

### `demo.payment_method`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `name_key` | `varchar(160)` | tidak | `''::character varying` | — | — |
| 6 | `method_type` | `varchar(32)` | tidak | `'CASH'::character varying` | — | — |
| 7 | `requires_reference` | `bool` | tidak | `false` | — | — |
| 8 | `allows_change` | `bool` | tidak | `false` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_payment_method` — AFTER DELETE/INSERT/UPDATE

### `demo.payment_term`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `due_days` | `int4` | tidak | `0` | — | — |
| 6 | `discount_days` | `int4` | ya | — | — | — |
| 7 | `discount_percent` | `numeric(9,4)` | ya | — | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_payment_term` — AFTER DELETE/INSERT/UPDATE

### `demo.permission_action`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `name_key` | `varchar(160)` | tidak | `''::character varying` | — | — |
| 6 | `action_type` | `varchar(24)` | tidak | `'STANDARD'::character varying` | — | — |
| 7 | `requires_step_up` | `bool` | tidak | `false` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `true` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_permission_action` — AFTER DELETE/INSERT/UPDATE

### `demo.pos_payment`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `pos_sale_id` | `uuid` | tidak | — | FK | `pos_sale.id` (ON DELETE CASCADE) |
| 3 | `payment_method_id` | `uuid` | tidak | — | FK | `payment_method.id` (ON DELETE RESTRICT) |
| 4 | `amount` | `numeric(19,4)` | tidak | — | — | — |
| 5 | `tendered_amount` | `numeric(19,4)` | ya | — | — | — |
| 6 | `change_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 7 | `reference` | `varchar(96)` | ya | — | — | — |
| 8 | `status` | `varchar(24)` | tidak | `'PAID'::character varying` | — | — |
| 9 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_pos_payment` — AFTER DELETE/INSERT/UPDATE

### `demo.pos_sale`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `shift_id` | `uuid` | ya | — | FK | `pos_shift.id` (ON DELETE RESTRICT) |
| 3 | `outlet_id` | `uuid` | tidak | — | FK | `outlet.id` (ON DELETE RESTRICT) |
| 4 | `terminal_id` | `uuid` | ya | — | FK | `pos_terminal.id` (ON DELETE RESTRICT) |
| 5 | `customer_id` | `uuid` | ya | — | FK | `customer.id` (ON DELETE RESTRICT) |
| 6 | `warehouse_id` | `uuid` | ya | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 7 | `receipt_number` | `varchar(64)` | tidak | — | — | — |
| 8 | `business_date` | `date` | tidak | `CURRENT_DATE` | — | — |
| 9 | `sale_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 11 | `subtotal` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `discount_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `tax_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 14 | `grand_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 15 | `paid_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 16 | `change_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 17 | `status` | `varchar(32)` | tidak | `'DRAFT'::character varying` | — | — |
| 18 | `offline_id` | `varchar(96)` | ya | — | — | — |
| 19 | `sync_status` | `varchar(24)` | tidak | `'SYNCED'::character varying` | — | — |
| 20 | `posting_key` | `varchar(96)` | ya | — | — | — |
| 21 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 22 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 23 | `created_by` | `uuid` | ya | — | — | — |
| 24 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 25 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_pos_sale` — AFTER DELETE/INSERT/UPDATE

### `demo.pos_sale_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `pos_sale_id` | `uuid` | tidak | — | FK | `pos_sale.id` (ON DELETE CASCADE) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `line_no` | `int4` | tidak | `1` | — | — |
| 6 | `quantity` | `numeric(19,6)` | tidak | — | — | — |
| 7 | `unit_price` | `numeric(19,4)` | tidak | `0` | — | — |
| 8 | `discount_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 9 | `tax_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 10 | `line_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `cost_snapshot` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_pos_sale_line` — AFTER DELETE/INSERT/UPDATE

### `demo.pos_shift`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `terminal_id` | `uuid` | tidak | — | FK | `pos_terminal.id` (ON DELETE RESTRICT) |
| 3 | `cashier_id` | `uuid` | ya | — | FK | `user_subject.id` (ON DELETE RESTRICT) |
| 4 | `shift_number` | `varchar(48)` | tidak | — | — | — |
| 5 | `opened_at` | `timestamptz` | tidak | `now()` | — | — |
| 6 | `opening_cash` | `numeric(19,4)` | tidak | `0` | — | — |
| 7 | `closed_at` | `timestamptz` | ya | — | — | — |
| 8 | `closing_cash` | `numeric(19,4)` | ya | — | — | — |
| 9 | `expected_cash` | `numeric(19,4)` | ya | — | — | — |
| 10 | `variance` | `numeric(19,4)` | ya | — | — | — |
| 11 | `status` | `varchar(24)` | tidak | `'OPEN'::character varying` | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_pos_shift` — AFTER DELETE/INSERT/UPDATE

### `demo.pos_terminal`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `outlet_id` | `uuid` | tidak | — | FK | `outlet.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `platform_device_id` | `uuid` | ya | — | — | — |
| 7 | `printer_config` | `jsonb` | ya | — | — | — |
| 8 | `status` | `varchar(24)` | tidak | `'ACTIVE'::character varying` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_pos_terminal` — AFTER DELETE/INSERT/UPDATE

### `demo.price_book`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `scope_type` | `varchar(32)` | tidak | `'TENANT'::character varying` | — | — |
| 6 | `scope_id` | `uuid` | ya | — | — | — |
| 7 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 8 | `valid_from` | `date` | tidak | `CURRENT_DATE` | — | — |
| 9 | `valid_until` | `date` | ya | — | — | — |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `is_system` | `bool` | tidak | `false` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `sort_order` | `int4` | tidak | `0` | — | — |
| 15 | `metadata` | `jsonb` | ya | — | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 21 | `deactivated_by` | `uuid` | ya | — | — | — |
| 22 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 23 | `deleted_by` | `uuid` | ya | — | — | — |
| 24 | `delete_reason` | `text` | ya | — | — | — |
| 25 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_price_book` — AFTER DELETE/INSERT/UPDATE

### `demo.price_book_item`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `price_book_id` | `uuid` | tidak | — | FK | `price_book.id` (ON DELETE CASCADE) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `uom_id` | `uuid` | ya | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `minimum_qty` | `numeric(19,6)` | tidak | `1` | — | — |
| 6 | `price` | `numeric(19,4)` | tidak | — | — | — |
| 7 | `valid_from` | `date` | tidak | `CURRENT_DATE` | — | — |
| 8 | `valid_until` | `date` | ya | — | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 15 | `delete_reason` | `text` | ya | — | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_price_book_item` — AFTER DELETE/INSERT/UPDATE

### `demo.product`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `category_id` | `uuid` | tidak | — | FK | `product_category.id` (ON DELETE RESTRICT) |
| 3 | `product_brand_id` | `uuid` | ya | — | FK | `product_brand.id` (ON DELETE RESTRICT) |
| 4 | `base_uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `tax_category_id` | `uuid` | ya | — | FK | `tax_category.id` (ON DELETE RESTRICT) |
| 6 | `code` | `varchar(64)` | tidak | — | — | — |
| 7 | `name` | `varchar(255)` | tidak | — | — | — |
| 8 | `description` | `text` | ya | — | — | — |
| 9 | `sku` | `varchar(64)` | tidak | — | — | — |
| 10 | `barcode` | `varchar(64)` | ya | — | — | — |
| 11 | `gtin` | `varchar(64)` | ya | — | — | — |
| 12 | `product_type` | `varchar(32)` | tidak | `'GOODS'::character varying` | — | — |
| 13 | `tracking_type` | `varchar(24)` | tidak | `'NONE'::character varying` | — | — |
| 14 | `shelf_life_days` | `int4` | ya | — | — | — |
| 15 | `allow_negative_stock` | `bool` | tidak | `false` | — | — |
| 16 | `standard_cost` | `numeric(19,4)` | tidak | `0` | — | — |
| 17 | `default_sale_price` | `numeric(19,4)` | tidak | `0` | — | — |
| 18 | `is_purchasable` | `bool` | tidak | `true` | — | — |
| 19 | `is_sellable` | `bool` | tidak | `true` | — | — |
| 20 | `is_active` | `bool` | tidak | `true` | — | — |
| 21 | `is_system` | `bool` | tidak | `false` | — | — |
| 22 | `is_sample` | `bool` | tidak | `false` | — | — |
| 23 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 24 | `sort_order` | `int4` | tidak | `0` | — | — |
| 25 | `metadata` | `jsonb` | ya | — | — | — |
| 26 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 27 | `created_by` | `uuid` | ya | — | — | — |
| 28 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 29 | `updated_by` | `uuid` | ya | — | — | — |
| 30 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 31 | `deactivated_by` | `uuid` | ya | — | — | — |
| 32 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 33 | `deleted_by` | `uuid` | ya | — | — | — |
| 34 | `delete_reason` | `text` | ya | — | — | — |
| 35 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_product` — AFTER DELETE/INSERT/UPDATE

### `demo.product_barcode`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 3 | `uom_id` | `uuid` | ya | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 4 | `barcode` | `varchar(64)` | tidak | — | — | — |
| 5 | `barcode_type` | `varchar(24)` | tidak | `'EAN13'::character varying` | — | — |
| 6 | `is_primary` | `bool` | tidak | `false` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 11 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 12 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 13 | `delete_reason` | `text` | ya | — | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_product_barcode` — AFTER DELETE/INSERT/UPDATE

### `demo.product_brand`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `is_active` | `bool` | tidak | `true` | — | — |
| 6 | `is_system` | `bool` | tidak | `false` | — | — |
| 7 | `is_sample` | `bool` | tidak | `false` | — | — |
| 8 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 9 | `sort_order` | `int4` | tidak | `0` | — | — |
| 10 | `metadata` | `jsonb` | ya | — | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 12 | `created_by` | `uuid` | ya | — | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `updated_by` | `uuid` | ya | — | — | — |
| 15 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 16 | `deactivated_by` | `uuid` | ya | — | — | — |
| 17 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 18 | `deleted_by` | `uuid` | ya | — | — | — |
| 19 | `delete_reason` | `text` | ya | — | — | — |
| 20 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_product_brand` — AFTER DELETE/INSERT/UPDATE

### `demo.product_category`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `parent_id` | `uuid` | ya | — | FK | `product_category.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `path` | `varchar(512)` | tidak | `''::character varying` | — | — |
| 7 | `level` | `int4` | tidak | `0` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_product_category` — AFTER DELETE/INSERT/UPDATE

### `demo.product_supplier`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(160)` | tidak | — | — | — |
| 3 | `name` | `varchar(255)` | tidak | `''::character varying` | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 6 | `supplier_id` | `uuid` | tidak | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 7 | `purchase_uom_id` | `uuid` | ya | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 8 | `supplier_sku` | `varchar(64)` | ya | — | — | — |
| 9 | `lead_time_days` | `int4` | tidak | `3` | — | — |
| 10 | `minimum_order_qty` | `numeric(19,6)` | tidak | `1` | — | — |
| 11 | `last_price` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 13 | `is_preferred` | `bool` | tidak | `false` | — | — |
| 14 | `priority` | `int4` | tidak | `100` | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_sample` | `bool` | tidak | `false` | — | — |
| 17 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 18 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `created_by` | `uuid` | ya | — | — | — |
| 20 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `updated_by` | `uuid` | ya | — | — | — |
| 22 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 23 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_by` | `uuid` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_product_supplier` — AFTER DELETE/INSERT/UPDATE

### `demo.purchase_backorder`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `backorder_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `source_purchase_order_id` | `uuid` | tidak | — | FK | `purchase_order.id` (ON DELETE RESTRICT) |
| 4 | `source_goods_receipt_id` | `uuid` | ya | — | FK | `goods_receipt.id` (ON DELETE RESTRICT) |
| 5 | `original_supplier_id` | `uuid` | tidak | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 6 | `replacement_supplier_id` | `uuid` | ya | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 7 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 8 | `status` | `varchar(48)` | tidak | `'DRAFT'::character varying` | — | — |
| 9 | `due_date` | `date` | ya | — | — | — |
| 10 | `redirect_reason` | `text` | ya | — | — | — |
| 11 | `note` | `text` | ya | — | — | — |
| 12 | `approved_at` | `timestamptz` | ya | — | — | — |
| 13 | `approved_by` | `uuid` | ya | — | — | — |
| 14 | `closed_at` | `timestamptz` | ya | — | — | — |
| 15 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_purchase_backorder` — AFTER DELETE/INSERT/UPDATE

### `demo.purchase_backorder_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `backorder_id` | `uuid` | tidak | — | FK | `purchase_backorder.id` (ON DELETE CASCADE) |
| 3 | `source_purchase_order_line_id` | `uuid` | tidak | — | FK | `purchase_order_line.id` (ON DELETE RESTRICT) |
| 4 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 5 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 6 | `line_no` | `int4` | tidak | `1` | — | — |
| 7 | `shortage_qty` | `numeric(19,6)` | tidak | — | — | — |
| 8 | `fulfilled_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 9 | `remaining_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 10 | `cancelled_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 11 | `target_supplier_id` | `uuid` | ya | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 12 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_purchase_backorder_line` — AFTER DELETE/INSERT/UPDATE

### `demo.purchase_order`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `purchase_order_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `supplier_id` | `uuid` | tidak | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 4 | `legal_entity_id` | `uuid` | ya | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 5 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 6 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 7 | `order_date` | `date` | tidak | `CURRENT_DATE` | — | — |
| 8 | `expected_date` | `date` | ya | — | — | — |
| 9 | `subtotal` | `numeric(19,4)` | tidak | `0` | — | — |
| 10 | `discount_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `tax_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `grand_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `status` | `varchar(40)` | tidak | `'DRAFT'::character varying` | — | — |
| 14 | `source_type` | `varchar(48)` | ya | — | — | — |
| 15 | `source_id` | `uuid` | ya | — | — | — |
| 16 | `parent_purchase_order_id` | `uuid` | ya | — | FK | `purchase_order.id` (ON DELETE RESTRICT) |
| 17 | `source_backorder_id` | `uuid` | ya | — | FK | `purchase_backorder.id` (ON DELETE RESTRICT) |
| 18 | `note` | `text` | ya | — | — | — |
| 19 | `submitted_at` | `timestamptz` | ya | — | — | — |
| 20 | `approved_at` | `timestamptz` | ya | — | — | — |
| 21 | `approved_by` | `uuid` | ya | — | — | — |
| 22 | `sent_at` | `timestamptz` | ya | — | — | — |
| 23 | `closed_at` | `timestamptz` | ya | — | — | — |
| 24 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 25 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 26 | `created_by` | `uuid` | ya | — | — | — |
| 27 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 28 | `updated_by` | `uuid` | ya | — | — | — |
| 29 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 30 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_purchase_order` — AFTER DELETE/INSERT/UPDATE

### `demo.purchase_order_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `purchase_order_id` | `uuid` | tidak | — | FK | `purchase_order.id` (ON DELETE CASCADE) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `line_no` | `int4` | tidak | `1` | — | — |
| 6 | `ordered_qty` | `numeric(19,6)` | tidak | — | — | — |
| 7 | `received_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 8 | `cancelled_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 9 | `backordered_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 10 | `unit_price` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `discount_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `tax_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `line_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 14 | `note` | `text` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_purchase_order_line` — AFTER DELETE/INSERT/UPDATE

### `demo.purchase_order_request_allocation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `purchase_order_line_id` | `uuid` | tidak | — | FK | `purchase_order_line.id` (ON DELETE CASCADE) |
| 3 | `request_order_line_id` | `uuid` | tidak | — | FK | `request_order_line.id` (ON DELETE RESTRICT) |
| 4 | `allocated_qty` | `numeric(19,6)` | tidak | — | — | — |
| 5 | `created_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_purchase_order_request_allocation` — AFTER DELETE/INSERT/UPDATE

### `demo.region`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `parent_id` | `uuid` | ya | — | FK | `region.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `region_type` | `varchar(32)` | tidak | `'AREA'::character varying` | — | — |
| 7 | `path` | `varchar(512)` | tidak | `''::character varying` | — | — |
| 8 | `level` | `int4` | tidak | `0` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_region` — AFTER DELETE/INSERT/UPDATE

### `demo.request_order`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `request_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `requesting_warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 4 | `parent_warehouse_id` | `uuid` | ya | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 5 | `outlet_id` | `uuid` | ya | — | FK | `outlet.id` (ON DELETE RESTRICT) |
| 6 | `request_type` | `varchar(24)` | tidak | `'MANUAL'::character varying` | — | — |
| 7 | `priority` | `varchar(16)` | tidak | `'NORMAL'::character varying` | — | — |
| 8 | `needed_at` | `date` | ya | — | — | — |
| 9 | `status` | `varchar(40)` | tidak | `'DRAFT'::character varying` | — | — |
| 10 | `generated_by_policy_id` | `uuid` | ya | — | FK | `stock_policy.id` (ON DELETE SET NULL) |
| 11 | `source_alert_id` | `uuid` | ya | — | FK | `stock_alert.id` (ON DELETE SET NULL) |
| 12 | `note` | `text` | ya | — | — | — |
| 13 | `submitted_at` | `timestamptz` | ya | — | — | — |
| 14 | `submitted_by` | `uuid` | ya | — | — | — |
| 15 | `approved_at` | `timestamptz` | ya | — | — | — |
| 16 | `approved_by` | `uuid` | ya | — | — | — |
| 17 | `rejected_at` | `timestamptz` | ya | — | — | — |
| 18 | `reject_reason` | `text` | ya | — | — | — |
| 19 | `closed_at` | `timestamptz` | ya | — | — | — |
| 20 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 24 | `updated_by` | `uuid` | ya | — | — | — |
| 25 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_request_order` — AFTER DELETE/INSERT/UPDATE

### `demo.request_order_consolidation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `consolidation_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `parent_warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 4 | `status` | `varchar(32)` | tidak | `'DRAFT'::character varying` | — | — |
| 5 | `consolidated_at` | `timestamptz` | tidak | `now()` | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 7 | `created_by` | `uuid` | ya | — | — | — |
| 8 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_request_order_consolidation` — AFTER DELETE/INSERT/UPDATE

### `demo.request_order_consolidation_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `consolidation_id` | `uuid` | tidak | — | FK | `request_order_consolidation.id` (ON DELETE CASCADE) |
| 3 | `request_order_line_id` | `uuid` | tidak | — | FK | `request_order_line.id` (ON DELETE RESTRICT) |
| 4 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 5 | `quantity` | `numeric(19,6)` | tidak | — | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_request_order_consolidation_line` — AFTER DELETE/INSERT/UPDATE

### `demo.request_order_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `request_order_id` | `uuid` | tidak | — | FK | `request_order.id` (ON DELETE CASCADE) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `requested_qty` | `numeric(19,6)` | tidak | — | — | — |
| 6 | `approved_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 7 | `fulfilled_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 8 | `remaining_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 9 | `stock_snapshot` | `jsonb` | ya | — | — | — |
| 10 | `source_stock_policy_id` | `uuid` | ya | — | FK | `stock_policy.id` (ON DELETE SET NULL) |
| 11 | `line_no` | `int4` | tidak | `1` | — | — |
| 12 | `note` | `text` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 14 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_request_order_line` — AFTER DELETE/INSERT/UPDATE

### `demo.role`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(64)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `role_type` | `varchar(32)` | tidak | `'CUSTOM'::character varying` | — | — |
| 6 | `is_active` | `bool` | tidak | `true` | — | — |
| 7 | `is_system` | `bool` | tidak | `false` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `sort_order` | `int4` | tidak | `0` | — | — |
| 11 | `metadata` | `jsonb` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `created_by` | `uuid` | ya | — | — | — |
| 14 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `updated_by` | `uuid` | ya | — | — | — |
| 16 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 17 | `deactivated_by` | `uuid` | ya | — | — | — |
| 18 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 19 | `deleted_by` | `uuid` | ya | — | — | — |
| 20 | `delete_reason` | `text` | ya | — | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_role` — AFTER DELETE/INSERT/UPDATE

### `demo.role_menu_permission`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `role_id` | `uuid` | tidak | — | FK | `role.id` (ON DELETE CASCADE) |
| 3 | `menu_id` | `uuid` | tidak | — | FK | `menu.id` (ON DELETE CASCADE) |
| 4 | `permission_action_id` | `uuid` | tidak | — | FK | `permission_action.id` (ON DELETE RESTRICT) |
| 5 | `effect` | `varchar(16)` | tidak | `'ALLOW'::character varying` | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 7 | `created_by` | `uuid` | ya | — | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 9 | `updated_by` | `uuid` | ya | — | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_role_menu_permission` — AFTER DELETE/INSERT/UPDATE

### `demo.role_scope`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `role_id` | `uuid` | tidak | — | FK | `role.id` (ON DELETE CASCADE) |
| 3 | `scope_type` | `varchar(32)` | tidak | — | — | — |
| 4 | `scope_id` | `uuid` | ya | — | — | — |
| 5 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 6 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_role_scope` — AFTER DELETE/INSERT/UPDATE

### `demo.sales_order`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `customer_id` | `uuid` | ya | — | FK | `customer.id` (ON DELETE RESTRICT) |
| 3 | `outlet_id` | `uuid` | ya | — | FK | `outlet.id` (ON DELETE RESTRICT) |
| 4 | `order_number` | `varchar(48)` | tidak | — | — | — |
| 5 | `order_date` | `date` | tidak | `CURRENT_DATE` | — | — |
| 6 | `delivery_date` | `date` | ya | — | — | — |
| 7 | `channel` | `varchar(32)` | tidak | `'DIRECT'::character varying` | — | — |
| 8 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 9 | `subtotal` | `numeric(19,4)` | tidak | `0` | — | — |
| 10 | `discount_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `tax_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `grand_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `status` | `varchar(32)` | tidak | `'DRAFT'::character varying` | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_sales_order` — AFTER DELETE/INSERT/UPDATE

### `demo.sales_order_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `sales_order_id` | `uuid` | tidak | — | FK | `sales_order.id` (ON DELETE CASCADE) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `line_no` | `int4` | tidak | `1` | — | — |
| 6 | `ordered_qty` | `numeric(19,6)` | tidak | — | — | — |
| 7 | `delivered_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 8 | `unit_price` | `numeric(19,4)` | tidak | `0` | — | — |
| 9 | `discount_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 10 | `tax_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `line_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_sales_order_line` — AFTER DELETE/INSERT/UPDATE

### `demo.saved_view`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `user_subject_id` | `uuid` | tidak | — | FK | `user_subject.id` (ON DELETE CASCADE) |
| 3 | `resource_code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `definition` | `jsonb` | tidak | — | — | — |
| 6 | `is_default` | `bool` | tidak | `false` | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 9 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_saved_view` — AFTER DELETE/INSERT/UPDATE

### `demo.schema_migration`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `version` | `varchar(16)` | tidak | — | PK | — |
| 2 | `name` | `varchar(160)` | tidak | — | — | — |
| 3 | `checksum` | `varchar(64)` | tidak | — | — | — |
| 4 | `applied_at` | `timestamptz` | tidak | `now()` | — | — |
| 5 | `duration_ms` | `int4` | tidak | `0` | — | — |

### `demo.starter_data_marker`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `resource_code` | `varchar(64)` | tidak | — | — | — |
| 3 | `table_name` | `varchar(96)` | tidak | — | — | — |
| 4 | `record_id` | `uuid` | tidak | — | — | — |
| 5 | `record_code` | `varchar(96)` | ya | — | — | — |
| 6 | `sample_batch_id` | `uuid` | tidak | — | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 8 | `removed_at` | `timestamptz` | ya | — | — | — |

### `demo.step_up_challenge`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `user_subject_id` | `uuid` | tidak | — | FK | `user_subject.id` (ON DELETE CASCADE) |
| 3 | `purpose` | `varchar(48)` | tidak | — | — | — |
| 4 | `challenge_hash` | `varchar(128)` | tidak | — | — | — |
| 5 | `target_type` | `varchar(64)` | ya | — | — | — |
| 6 | `target_id` | `varchar(64)` | ya | — | — | — |
| 7 | `reason` | `text` | ya | — | — | — |
| 8 | `issued_at` | `timestamptz` | tidak | `now()` | — | — |
| 9 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 10 | `verified_at` | `timestamptz` | ya | — | — | — |
| 11 | `consumed_at` | `timestamptz` | ya | — | — | — |

Trigger:

- `trg_audit_step_up_challenge` — AFTER DELETE/INSERT/UPDATE

### `demo.stock_alert`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `stock_policy_id` | `uuid` | tidak | — | FK | `stock_policy.id` (ON DELETE RESTRICT) |
| 3 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 4 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 5 | `alert_type` | `varchar(32)` | tidak | `'MIN_STOCK'::character varying` | — | — |
| 6 | `projected_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 7 | `threshold_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 8 | `recommended_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 9 | `status` | `varchar(24)` | tidak | `'OPEN'::character varying` | — | — |
| 10 | `request_order_id` | `uuid` | ya | — | FK | `request_order.id` (ON DELETE SET NULL) |
| 11 | `detected_at` | `timestamptz` | tidak | `now()` | — | — |
| 12 | `resolved_at` | `timestamptz` | ya | — | — | — |
| 13 | `resolved_reason` | `text` | ya | — | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_stock_alert` — AFTER DELETE/INSERT/UPDATE

### `demo.stock_balance`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `lot_id` | `uuid` | ya | — | FK | `inventory_lot.id` (ON DELETE RESTRICT) |
| 5 | `bin_id` | `uuid` | ya | — | FK | `warehouse_bin.id` (ON DELETE RESTRICT) |
| 6 | `on_hand_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 7 | `reserved_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 8 | `available_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 9 | `in_transit_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 10 | `quarantine_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 11 | `damaged_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 12 | `average_cost` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `last_movement_at` | `timestamptz` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_stock_balance` — AFTER DELETE/INSERT/UPDATE

### `demo.stock_count`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 3 | `count_number` | `varchar(48)` | tidak | — | — | — |
| 4 | `count_type` | `varchar(24)` | tidak | `'FULL'::character varying` | — | — |
| 5 | `scheduled_at` | `timestamptz` | ya | — | — | — |
| 6 | `started_at` | `timestamptz` | ya | — | — | — |
| 7 | `completed_at` | `timestamptz` | ya | — | — | — |
| 8 | `status` | `varchar(32)` | tidak | `'DRAFT'::character varying` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `created_by` | `uuid` | ya | — | — | — |
| 11 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_stock_count` — AFTER DELETE/INSERT/UPDATE

### `demo.stock_count_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `stock_count_id` | `uuid` | tidak | — | FK | `stock_count.id` (ON DELETE CASCADE) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `lot_id` | `uuid` | ya | — | FK | `inventory_lot.id` (ON DELETE RESTRICT) |
| 5 | `bin_id` | `uuid` | ya | — | FK | `warehouse_bin.id` (ON DELETE RESTRICT) |
| 6 | `system_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 7 | `counted_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 8 | `variance_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 9 | `reason` | `text` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_stock_count_line` — AFTER DELETE/INSERT/UPDATE

### `demo.stock_movement`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `movement_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `movement_type` | `varchar(48)` | tidak | — | — | — |
| 4 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 5 | `uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 6 | `lot_id` | `uuid` | ya | — | FK | `inventory_lot.id` (ON DELETE RESTRICT) |
| 7 | `quantity` | `numeric(19,6)` | tidak | — | — | — |
| 8 | `unit_cost` | `numeric(19,4)` | tidak | `0` | — | — |
| 9 | `source_warehouse_id` | `uuid` | ya | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 10 | `source_bin_id` | `uuid` | ya | — | FK | `warehouse_bin.id` (ON DELETE RESTRICT) |
| 11 | `destination_warehouse_id` | `uuid` | ya | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 12 | `destination_bin_id` | `uuid` | ya | — | FK | `warehouse_bin.id` (ON DELETE RESTRICT) |
| 13 | `bucket_from` | `varchar(24)` | ya | — | — | — |
| 14 | `bucket_to` | `varchar(24)` | ya | — | — | — |
| 15 | `reference_type` | `varchar(64)` | tidak | — | — | — |
| 16 | `reference_id` | `uuid` | ya | — | — | — |
| 17 | `reference_number` | `varchar(64)` | ya | — | — | — |
| 18 | `posting_key` | `varchar(96)` | tidak | — | — | — |
| 19 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 20 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `note` | `text` | ya | — | — | — |

Trigger:

- `trg_audit_stock_movement` — AFTER DELETE/INSERT/UPDATE
- `trg_stock_movement_immutable` — BEFORE DELETE/UPDATE

### `demo.stock_policy`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `uom_id` | `uuid` | ya | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `code` | `varchar(96)` | tidak | — | — | — |
| 6 | `name` | `varchar(255)` | tidak | — | — | — |
| 7 | `description` | `text` | ya | — | — | — |
| 8 | `minimum_stock` | `numeric(19,6)` | tidak | `0` | — | — |
| 9 | `maximum_stock` | `numeric(19,6)` | ya | — | — | — |
| 10 | `reorder_point` | `numeric(19,6)` | tidak | `0` | — | — |
| 11 | `safety_stock` | `numeric(19,6)` | tidak | `0` | — | — |
| 12 | `lead_time_days` | `int4` | tidak | `3` | — | — |
| 13 | `recommended_order_qty` | `numeric(19,6)` | tidak | `0` | — | — |
| 14 | `auto_request_enabled` | `bool` | tidak | `true` | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_system` | `bool` | tidak | `false` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `sort_order` | `int4` | tidak | `0` | — | — |
| 20 | `metadata` | `jsonb` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 24 | `updated_by` | `uuid` | ya | — | — | — |
| 25 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 26 | `deactivated_by` | `uuid` | ya | — | — | — |
| 27 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 28 | `deleted_by` | `uuid` | ya | — | — | — |
| 29 | `delete_reason` | `text` | ya | — | — | — |
| 30 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_stock_policy` — AFTER DELETE/INSERT/UPDATE

### `demo.stock_reservation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 3 | `product_id` | `uuid` | tidak | — | FK | `product.id` (ON DELETE RESTRICT) |
| 4 | `lot_id` | `uuid` | ya | — | FK | `inventory_lot.id` (ON DELETE RESTRICT) |
| 5 | `source_type` | `varchar(64)` | tidak | — | — | — |
| 6 | `source_id` | `uuid` | ya | — | — | — |
| 7 | `quantity` | `numeric(19,6)` | tidak | — | — | — |
| 8 | `status` | `varchar(24)` | tidak | `'ACTIVE'::character varying` | — | — |
| 9 | `expires_at` | `timestamptz` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 11 | `created_by` | `uuid` | ya | — | — | — |
| 12 | `released_at` | `timestamptz` | ya | — | — | — |
| 13 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_stock_reservation` — AFTER DELETE/INSERT/UPDATE

### `demo.supplier`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `party_id` | `uuid` | ya | — | FK | `party.id` (ON DELETE RESTRICT) |
| 3 | `supplier_group_id` | `uuid` | ya | — | FK | `supplier_group.id` (ON DELETE RESTRICT) |
| 4 | `payment_term_id` | `uuid` | ya | — | FK | `payment_term.id` (ON DELETE RESTRICT) |
| 5 | `address_id` | `uuid` | ya | — | FK | `address.id` (ON DELETE RESTRICT) |
| 6 | `code` | `varchar(64)` | tidak | — | — | — |
| 7 | `name` | `varchar(255)` | tidak | — | — | — |
| 8 | `description` | `text` | ya | — | — | — |
| 9 | `supplier_number` | `varchar(48)` | ya | — | — | — |
| 10 | `tax_number` | `varchar(64)` | ya | — | — | — |
| 11 | `contact_person` | `varchar(160)` | ya | — | — | — |
| 12 | `phone` | `varchar(50)` | ya | — | — | — |
| 13 | `email` | `varchar(160)` | ya | — | — | — |
| 14 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 15 | `lead_time_days` | `int4` | tidak | `3` | — | — |
| 16 | `rating` | `numeric(5,2)` | tidak | `0` | — | — |
| 17 | `is_blacklisted` | `bool` | tidak | `false` | — | — |
| 18 | `blacklist_reason` | `text` | ya | — | — | — |
| 19 | `is_active` | `bool` | tidak | `true` | — | — |
| 20 | `is_system` | `bool` | tidak | `false` | — | — |
| 21 | `is_sample` | `bool` | tidak | `false` | — | — |
| 22 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 23 | `sort_order` | `int4` | tidak | `0` | — | — |
| 24 | `metadata` | `jsonb` | ya | — | — | — |
| 25 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 26 | `created_by` | `uuid` | ya | — | — | — |
| 27 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 28 | `updated_by` | `uuid` | ya | — | — | — |
| 29 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 30 | `deactivated_by` | `uuid` | ya | — | — | — |
| 31 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 32 | `deleted_by` | `uuid` | ya | — | — | — |
| 33 | `delete_reason` | `text` | ya | — | — | — |
| 34 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_supplier` — AFTER DELETE/INSERT/UPDATE

### `demo.supplier_group`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `payment_term_id` | `uuid` | ya | — | FK | `payment_term.id` (ON DELETE RESTRICT) |
| 6 | `is_active` | `bool` | tidak | `true` | — | — |
| 7 | `is_system` | `bool` | tidak | `false` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `sort_order` | `int4` | tidak | `0` | — | — |
| 11 | `metadata` | `jsonb` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `created_by` | `uuid` | ya | — | — | — |
| 14 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `updated_by` | `uuid` | ya | — | — | — |
| 16 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 17 | `deactivated_by` | `uuid` | ya | — | — | — |
| 18 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 19 | `deleted_by` | `uuid` | ya | — | — | — |
| 20 | `delete_reason` | `text` | ya | — | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_supplier_group` — AFTER DELETE/INSERT/UPDATE

### `demo.supplier_invoice`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `supplier_id` | `uuid` | tidak | — | FK | `supplier.id` (ON DELETE RESTRICT) |
| 3 | `purchase_order_id` | `uuid` | ya | — | FK | `purchase_order.id` (ON DELETE RESTRICT) |
| 4 | `invoice_number` | `varchar(64)` | tidak | — | — | — |
| 5 | `invoice_date` | `date` | tidak | `CURRENT_DATE` | — | — |
| 6 | `due_date` | `date` | ya | — | — | — |
| 7 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 8 | `subtotal` | `numeric(19,4)` | tidak | `0` | — | — |
| 9 | `tax_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 10 | `grand_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `paid_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `match_status` | `varchar(24)` | tidak | `'UNMATCHED'::character varying` | — | — |
| 13 | `status` | `varchar(32)` | tidak | `'DRAFT'::character varying` | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_supplier_invoice` — AFTER DELETE/INSERT/UPDATE

### `demo.sync_inbox`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `event_id` | `varchar(96)` | tidak | — | — | — |
| 3 | `device_id` | `uuid` | ya | — | — | — |
| 4 | `sequence_no` | `int8` | ya | — | — | — |
| 5 | `checksum` | `varchar(64)` | ya | — | — | — |
| 6 | `status` | `varchar(24)` | tidak | `'RECEIVED'::character varying` | — | — |
| 7 | `result` | `jsonb` | ya | — | — | — |
| 8 | `received_at` | `timestamptz` | tidak | `now()` | — | — |
| 9 | `processed_at` | `timestamptz` | ya | — | — | — |

### `demo.sync_outbox`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `event_id` | `varchar(96)` | tidak | — | — | — |
| 3 | `entity_type` | `varchar(96)` | tidak | — | — | — |
| 4 | `entity_id` | `uuid` | ya | — | — | — |
| 5 | `operation` | `varchar(16)` | tidak | — | — | — |
| 6 | `payload` | `jsonb` | tidak | — | — | — |
| 7 | `sequence_no` | `int8` | tidak | `nextval('demo.sync_outbox_sequence_no_seq'::reg…` | — | — |
| 8 | `status` | `varchar(24)` | tidak | `'PENDING'::character varying` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `dispatched_at` | `timestamptz` | ya | — | — | — |

### `demo.tax_category`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `tax_type` | `varchar(32)` | tidak | `'VAT'::character varying` | — | — |
| 6 | `is_active` | `bool` | tidak | `true` | — | — |
| 7 | `is_system` | `bool` | tidak | `false` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `sort_order` | `int4` | tidak | `0` | — | — |
| 11 | `metadata` | `jsonb` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `created_by` | `uuid` | ya | — | — | — |
| 14 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `updated_by` | `uuid` | ya | — | — | — |
| 16 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 17 | `deactivated_by` | `uuid` | ya | — | — | — |
| 18 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 19 | `deleted_by` | `uuid` | ya | — | — | — |
| 20 | `delete_reason` | `text` | ya | — | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_tax_category` — AFTER DELETE/INSERT/UPDATE

### `demo.tax_rate`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `tax_category_id` | `uuid` | tidak | — | FK | `tax_category.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `rate` | `numeric(9,4)` | tidak | `0` | — | — |
| 7 | `is_inclusive` | `bool` | tidak | `false` | — | — |
| 8 | `effective_from` | `date` | tidak | `CURRENT_DATE` | — | — |
| 9 | `effective_until` | `date` | ya | — | — | — |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `is_system` | `bool` | tidak | `false` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `sort_order` | `int4` | tidak | `0` | — | — |
| 15 | `metadata` | `jsonb` | ya | — | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 21 | `deactivated_by` | `uuid` | ya | — | — | — |
| 22 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 23 | `deleted_by` | `uuid` | ya | — | — | — |
| 24 | `delete_reason` | `text` | ya | — | — | — |
| 25 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_tax_rate` — AFTER DELETE/INSERT/UPDATE

### `demo.uom`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(32)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `symbol` | `varchar(16)` | ya | — | — | — |
| 6 | `dimension` | `varchar(32)` | tidak | `'UNIT'::character varying` | — | — |
| 7 | `precision` | `int4` | tidak | `0` | — | — |
| 8 | `allow_fraction` | `bool` | tidak | `false` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_uom` — AFTER DELETE/INSERT/UPDATE

### `demo.uom_conversion`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `product_id` | `uuid` | ya | — | — | — |
| 3 | `from_uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 4 | `to_uom_id` | `uuid` | tidak | — | FK | `uom.id` (ON DELETE RESTRICT) |
| 5 | `factor` | `numeric(19,8)` | tidak | — | — | — |
| 6 | `rounding_mode` | `varchar(24)` | tidak | `'HALF_UP'::character varying` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 11 | `created_by` | `uuid` | ya | — | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 14 | `delete_reason` | `text` | ya | — | — | — |
| 15 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_uom_conversion` — AFTER DELETE/INSERT/UPDATE

### `demo.user_direct_permission`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `user_subject_id` | `uuid` | tidak | — | FK | `user_subject.id` (ON DELETE CASCADE) |
| 3 | `menu_id` | `uuid` | tidak | — | FK | `menu.id` (ON DELETE CASCADE) |
| 4 | `permission_action_id` | `uuid` | tidak | — | FK | `permission_action.id` (ON DELETE RESTRICT) |
| 5 | `effect` | `varchar(16)` | tidak | `'ALLOW'::character varying` | — | — |
| 6 | `reason` | `text` | ya | — | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 8 | `created_by` | `uuid` | ya | — | — | — |
| 9 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_user_direct_permission` — AFTER DELETE/INSERT/UPDATE

### `demo.user_role_assignment`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `user_subject_id` | `uuid` | tidak | — | FK | `user_subject.id` (ON DELETE CASCADE) |
| 3 | `role_id` | `uuid` | tidak | — | FK | `role.id` (ON DELETE RESTRICT) |
| 4 | `valid_from` | `timestamptz` | tidak | `now()` | — | — |
| 5 | `valid_until` | `timestamptz` | ya | — | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 7 | `created_by` | `uuid` | ya | — | — | — |
| 8 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_user_role_assignment` — AFTER DELETE/INSERT/UPDATE

### `demo.user_subject`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `platform_user_id` | `uuid` | tidak | — | — | — |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `username_snapshot` | `varchar(64)` | tidak | — | — | — |
| 7 | `email_snapshot` | `varchar(255)` | ya | — | — | — |
| 8 | `is_owner` | `bool` | tidak | `false` | — | — |
| 9 | `status` | `varchar(24)` | tidak | `'ACTIVE'::character varying` | — | — |
| 10 | `last_login_at` | `timestamptz` | ya | — | — | — |
| 11 | `is_active` | `bool` | tidak | `true` | — | — |
| 12 | `is_system` | `bool` | tidak | `false` | — | — |
| 13 | `is_sample` | `bool` | tidak | `false` | — | — |
| 14 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 15 | `sort_order` | `int4` | tidak | `0` | — | — |
| 16 | `metadata` | `jsonb` | ya | — | — | — |
| 17 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `created_by` | `uuid` | ya | — | — | — |
| 19 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 20 | `updated_by` | `uuid` | ya | — | — | — |
| 21 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 22 | `deactivated_by` | `uuid` | ya | — | — | — |
| 23 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_by` | `uuid` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_user_subject` — AFTER DELETE/INSERT/UPDATE

### `demo.vehicle_type`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `name_key` | `varchar(160)` | tidak | `''::character varying` | — | — |
| 6 | `default_capacity_kg` | `numeric(19,4)` | tidak | `0` | — | — |
| 7 | `default_capacity_m3` | `numeric(19,4)` | tidak | `0` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_vehicle_type` — AFTER DELETE/INSERT/UPDATE

### `demo.warehouse`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `legal_entity_id` | `uuid` | ya | — | FK | `legal_entity.id` (ON DELETE RESTRICT) |
| 3 | `outlet_id` | `uuid` | ya | — | FK | `outlet.id` (ON DELETE RESTRICT) |
| 4 | `region_id` | `uuid` | ya | — | FK | `region.id` (ON DELETE RESTRICT) |
| 5 | `parent_warehouse_id` | `uuid` | ya | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 6 | `warehouse_type_id` | `uuid` | ya | — | FK | `warehouse_type.id` (ON DELETE RESTRICT) |
| 7 | `address_id` | `uuid` | ya | — | FK | `address.id` (ON DELETE RESTRICT) |
| 8 | `code` | `varchar(64)` | tidak | — | — | — |
| 9 | `name` | `varchar(160)` | tidak | — | — | — |
| 10 | `description` | `text` | ya | — | — | — |
| 11 | `is_parent` | `bool` | tidak | `false` | — | — |
| 12 | `path` | `varchar(512)` | tidak | `''::character varying` | — | — |
| 13 | `level` | `int4` | tidak | `0` | — | — |
| 14 | `is_active` | `bool` | tidak | `true` | — | — |
| 15 | `is_system` | `bool` | tidak | `false` | — | — |
| 16 | `is_sample` | `bool` | tidak | `false` | — | — |
| 17 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 18 | `sort_order` | `int4` | tidak | `0` | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 23 | `updated_by` | `uuid` | ya | — | — | — |
| 24 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 25 | `deactivated_by` | `uuid` | ya | — | — | — |
| 26 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 27 | `deleted_by` | `uuid` | ya | — | — | — |
| 28 | `delete_reason` | `text` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_warehouse` — AFTER DELETE/INSERT/UPDATE

### `demo.warehouse_bin`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 3 | `zone_id` | `uuid` | ya | — | FK | `warehouse_zone.id` (ON DELETE RESTRICT) |
| 4 | `code` | `varchar(48)` | tidak | — | — | — |
| 5 | `name` | `varchar(120)` | tidak | — | — | — |
| 6 | `description` | `text` | ya | — | — | — |
| 7 | `aisle` | `varchar(32)` | ya | — | — | — |
| 8 | `rack` | `varchar(32)` | ya | — | — | — |
| 9 | `capacity` | `numeric(19,6)` | ya | — | — | — |
| 10 | `pick_priority` | `int4` | tidak | `100` | — | — |
| 11 | `is_active` | `bool` | tidak | `true` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `sort_order` | `int4` | tidak | `0` | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 19 | `delete_reason` | `text` | ya | — | — | — |
| 20 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_warehouse_bin` — AFTER DELETE/INSERT/UPDATE

### `demo.warehouse_type`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `name_key` | `varchar(160)` | tidak | `''::character varying` | — | — |
| 6 | `allows_sale` | `bool` | tidak | `true` | — | — |
| 7 | `allows_production` | `bool` | tidak | `false` | — | — |
| 8 | `is_transit` | `bool` | tidak | `false` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_warehouse_type` — AFTER DELETE/INSERT/UPDATE

### `demo.warehouse_zone`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `warehouse_id` | `uuid` | tidak | — | FK | `warehouse.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `zone_type` | `varchar(32)` | tidak | `'STORAGE'::character varying` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `sort_order` | `int4` | tidak | `0` | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 13 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 14 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 15 | `delete_reason` | `text` | ya | — | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_warehouse_zone` — AFTER DELETE/INSERT/UPDATE

### `demo.workflow_action_log`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `instance_id` | `uuid` | tidak | — | FK | `workflow_instance.id` (ON DELETE CASCADE) |
| 3 | `step_id` | `uuid` | ya | — | FK | `workflow_step.id` (ON DELETE SET NULL) |
| 4 | `action` | `varchar(32)` | tidak | — | — | — |
| 5 | `actor_id` | `uuid` | ya | — | — | — |
| 6 | `comment` | `text` | ya | — | — | — |
| 7 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |

Trigger:

- `trg_audit_workflow_action_log` — AFTER DELETE/INSERT/UPDATE

### `demo.workflow_definition`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `code` | `varchar(64)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `module_code` | `varchar(48)` | ya | — | — | — |
| 6 | `entity_type` | `varchar(96)` | tidak | — | — | — |
| 7 | `definition_version` | `int4` | tidak | `1` | — | — |
| 8 | `status` | `varchar(24)` | tidak | `'DRAFT'::character varying` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_workflow_definition` — AFTER DELETE/INSERT/UPDATE

### `demo.workflow_instance`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `workflow_id` | `uuid` | tidak | — | FK | `workflow_definition.id` (ON DELETE RESTRICT) |
| 3 | `entity_type` | `varchar(96)` | tidak | — | — | — |
| 4 | `entity_id` | `uuid` | tidak | — | — | — |
| 5 | `current_step_id` | `uuid` | ya | — | FK | `workflow_step.id` (ON DELETE SET NULL) |
| 6 | `status` | `varchar(24)` | tidak | `'RUNNING'::character varying` | — | — |
| 7 | `started_at` | `timestamptz` | tidak | `now()` | — | — |
| 8 | `finished_at` | `timestamptz` | ya | — | — | — |
| 9 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_workflow_instance` — AFTER DELETE/INSERT/UPDATE

### `demo.workflow_step`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `workflow_id` | `uuid` | tidak | — | FK | `workflow_definition.id` (ON DELETE CASCADE) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `sequence` | `int4` | tidak | `1` | — | — |
| 6 | `step_type` | `varchar(24)` | tidak | `'APPROVAL'::character varying` | — | — |
| 7 | `assignee_rule` | `jsonb` | ya | — | — | — |
| 8 | `sla_hours` | `int4` | ya | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `now()` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | `now()` | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

Trigger:

- `trg_audit_workflow_step` — AFTER DELETE/INSERT/UPDATE

## Schema `demo__audit`

### `demo__audit.audit_event`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |
| 3 | `tenant_schema` | `varchar(64)` | tidak | `'demo'::character varying` | — | — |
| 4 | `request_id` | `varchar(64)` | ya | — | — | — |
| 5 | `correlation_id` | `varchar(64)` | ya | — | — | — |
| 6 | `actor_user_id` | `uuid` | ya | — | — | — |
| 7 | `actor_username` | `varchar(64)` | ya | — | — | — |
| 8 | `actor_role_codes` | `jsonb` | ya | — | — | — |
| 9 | `session_id` | `uuid` | ya | — | — | — |
| 10 | `support_session_id` | `uuid` | ya | — | — | — |
| 11 | `device_id` | `uuid` | ya | — | — | — |
| 12 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 13 | `user_agent` | `text` | ya | — | — | — |
| 14 | `module_code` | `varchar(48)` | tidak | `'SYSTEM'::character varying` | — | — |
| 15 | `action_code` | `varchar(48)` | tidak | `'UNKNOWN'::character varying` | — | — |
| 16 | `entity_type` | `varchar(96)` | ya | — | — | — |
| 17 | `entity_id` | `varchar(96)` | ya | — | — | — |
| 18 | `document_number` | `varchar(96)` | ya | — | — | — |
| 19 | `result` | `varchar(16)` | tidak | `'SUCCESS'::character varying` | — | — |
| 20 | `reason` | `text` | ya | — | — | — |
| 21 | `metadata` | `jsonb` | ya | — | — | — |

### `demo__audit.audit_export_event`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |
| 3 | `actor_user_id` | `uuid` | ya | — | — | — |
| 4 | `resource_code` | `varchar(64)` | tidak | — | — | — |
| 5 | `filter_snapshot` | `jsonb` | ya | — | — | — |
| 6 | `row_count` | `int4` | tidak | `0` | — | — |
| 7 | `format` | `varchar(16)` | tidak | `'CSV'::character varying` | — | — |
| 8 | `request_id` | `varchar(64)` | ya | — | — | — |

### `demo__audit.audit_permission_change`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |
| 3 | `actor_user_id` | `uuid` | ya | — | — | — |
| 4 | `target_type` | `varchar(48)` | tidak | — | — | — |
| 5 | `target_id` | `varchar(96)` | tidak | — | — | — |
| 6 | `before_snapshot` | `jsonb` | ya | — | — | — |
| 7 | `after_snapshot` | `jsonb` | ya | — | — | — |
| 8 | `reason` | `text` | ya | — | — | — |
| 9 | `request_id` | `varchar(64)` | ya | — | — | — |

### `demo__audit.audit_posting_event`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |
| 3 | `actor_user_id` | `uuid` | ya | — | — | — |
| 4 | `posting_type` | `varchar(48)` | tidak | — | — | — |
| 5 | `posting_key` | `varchar(96)` | tidak | — | — | — |
| 6 | `document_type` | `varchar(64)` | ya | — | — | — |
| 7 | `document_id` | `uuid` | ya | — | — | — |
| 8 | `document_number` | `varchar(96)` | ya | — | — | — |
| 9 | `is_reversal` | `bool` | tidak | `false` | — | — |
| 10 | `detail` | `jsonb` | ya | — | — | — |
| 11 | `request_id` | `varchar(64)` | ya | — | — | — |

### `demo__audit.audit_row_change`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `audit_event_id` | `uuid` | ya | — | FK | `audit_event.id` (ON DELETE RESTRICT) |
| 3 | `table_schema` | `varchar(64)` | tidak | — | — | — |
| 4 | `table_name` | `varchar(96)` | tidak | — | — | — |
| 5 | `row_pk` | `jsonb` | tidak | — | — | — |
| 6 | `operation` | `varchar(8)` | tidak | — | — | — |
| 7 | `old_data` | `jsonb` | ya | — | — | — |
| 8 | `new_data` | `jsonb` | ya | — | — | — |
| 9 | `changed_columns` | `jsonb` | ya | — | — | — |
| 10 | `transaction_id` | `int8` | ya | — | — | — |
| 11 | `statement_timestamp` | `timestamptz` | tidak | `statement_timestamp()` | — | — |

### `demo__audit.audit_schema_migration`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |
| 3 | `schema_name` | `varchar(64)` | tidak | — | — | — |
| 4 | `migration_version` | `varchar(16)` | tidak | — | — | — |
| 5 | `checksum` | `varchar(64)` | tidak | — | — | — |
| 6 | `status` | `varchar(24)` | tidak | — | — | — |
| 7 | `duration_ms` | `int4` | tidak | `0` | — | — |
| 8 | `actor_user_id` | `uuid` | ya | — | — | — |
| 9 | `error_message` | `text` | ya | — | — | — |

### `demo__audit.audit_security_event`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `now()` | — | — |
| 3 | `event_code` | `varchar(64)` | tidak | — | — | — |
| 4 | `severity` | `varchar(16)` | tidak | `'INFO'::character varying` | — | — |
| 5 | `actor_user_id` | `uuid` | ya | — | — | — |
| 6 | `actor_username` | `varchar(64)` | ya | — | — | — |
| 7 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 8 | `user_agent` | `text` | ya | — | — | — |
| 9 | `request_id` | `varchar(64)` | ya | — | — | — |
| 10 | `result` | `varchar(16)` | tidak | `'FAILURE'::character varying` | — | — |
| 11 | `detail` | `jsonb` | ya | — | — | — |

## Schema `platform`

### `platform.announcement`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `title_key` | `varchar(160)` | tidak | — | — | — |
| 4 | `default_title` | `varchar(255)` | tidak | — | — | — |
| 5 | `body_key` | `varchar(160)` | tidak | — | — | — |
| 6 | `default_body` | `text` | tidak | — | — | — |
| 7 | `severity` | `AnnouncementSeverity` | tidak | `'INFO'::platform."AnnouncementSeverity"` | — | — |
| 8 | `audience_type` | `AnnouncementAudience` | tidak | `'PUBLIC'::platform."AnnouncementAudience"` | — | — |
| 9 | `starts_at` | `timestamptz` | tidak | — | — | — |
| 10 | `ends_at` | `timestamptz` | ya | — | — | — |
| 11 | `is_dismissible` | `bool` | tidak | `true` | — | — |
| 12 | `link_url` | `varchar(500)` | ya | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `is_active` | `bool` | tidak | `true` | — | — |
| 15 | `is_system` | `bool` | tidak | `false` | — | — |
| 16 | `is_sample` | `bool` | tidak | `false` | — | — |
| 17 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 18 | `metadata` | `jsonb` | ya | — | — | — |
| 19 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 20 | `created_by` | `uuid` | ya | — | — | — |
| 21 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 22 | `updated_by` | `uuid` | ya | — | — | — |
| 23 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 24 | `deactivated_by` | `uuid` | ya | — | — | — |
| 25 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 26 | `deleted_by` | `uuid` | ya | — | — | — |
| 27 | `delete_reason` | `text` | ya | — | — | — |
| 28 | `version` | `int4` | tidak | `1` | — | — |

### `platform.billing_credit_note`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `credit_note_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `invoice_id` | `uuid` | tidak | — | FK | `billing_invoice.id` (ON DELETE RESTRICT) |
| 4 | `issue_date` | `timestamptz` | tidak | — | — | — |
| 5 | `reason` | `text` | tidak | — | — | — |
| 6 | `amount` | `numeric(19,4)` | tidak | — | — | — |
| 7 | `status` | `varchar(24)` | tidak | `'ISSUED'::character varying` | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `created_by` | `uuid` | ya | — | — | — |

### `platform.billing_invoice`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `invoice_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE RESTRICT) |
| 4 | `subscription_id` | `uuid` | ya | — | FK | `subscription.id` (ON DELETE SET NULL) |
| 5 | `quote_id` | `uuid` | ya | — | FK | `pricing_quote.id` (ON DELETE SET NULL) |
| 6 | `status` | `InvoiceStatus` | tidak | `'DRAFT'::platform."InvoiceStatus"` | — | — |
| 7 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 8 | `issue_date` | `timestamptz` | tidak | — | — | — |
| 9 | `due_date` | `timestamptz` | tidak | — | — | — |
| 10 | `subtotal` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `discount_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `tax_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `admin_fee_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 14 | `grand_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 15 | `paid_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 16 | `paid_at` | `timestamptz` | ya | — | — | — |
| 17 | `issued_at` | `timestamptz` | ya | — | — | — |
| 18 | `voided_at` | `timestamptz` | ya | — | — | — |
| 19 | `void_reason` | `text` | ya | — | — | — |
| 20 | `locale_snapshot` | `varchar(16)` | tidak | `'id'::character varying` | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

### `platform.billing_invoice_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `invoice_id` | `uuid` | tidak | — | FK | `billing_invoice.id` (ON DELETE CASCADE) |
| 3 | `line_type` | `InvoiceLineType` | tidak | `'PACKAGE'::platform."InvoiceLineType"` | — | — |
| 4 | `device_id` | `uuid` | ya | — | FK | `pos_device.id` (ON DELETE SET NULL) |
| 5 | `module_code` | `varchar(48)` | ya | — | — | — |
| 6 | `feature_code` | `varchar(64)` | ya | — | — | — |
| 7 | `description` | `varchar(255)` | tidak | — | — | — |
| 8 | `snapshot` | `jsonb` | tidak | — | — | — |
| 9 | `quantity` | `int4` | tidak | `1` | — | — |
| 10 | `unit_price` | `numeric(19,4)` | tidak | — | — | — |
| 11 | `discount_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `tax_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `line_total` | `numeric(19,4)` | tidak | — | — | — |
| 14 | `sort_order` | `int4` | tidak | `0` | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.billing_payment_allocation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `invoice_id` | `uuid` | tidak | — | FK | `billing_invoice.id` (ON DELETE RESTRICT) |
| 3 | `invoice_line_id` | `uuid` | ya | — | FK | `billing_invoice_line.id` (ON DELETE SET NULL) |
| 4 | `callback_event_id` | `uuid` | ya | — | FK | `payment_callback_event.id` (ON DELETE SET NULL) |
| 5 | `payment_order_id` | `uuid` | ya | — | FK | `payment_order.id` (ON DELETE SET NULL) |
| 6 | `amount` | `numeric(19,4)` | tidak | — | — | — |
| 7 | `allocated_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `idempotency_key` | `varchar(96)` | tidak | — | — | — |

### `platform.billing_receipt`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `receipt_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `invoice_id` | `uuid` | tidak | — | FK | `billing_invoice.id` (ON DELETE RESTRICT) |
| 4 | `paid_at` | `timestamptz` | tidak | — | — | — |
| 5 | `amount` | `numeric(19,4)` | tidak | — | — | — |
| 6 | `channel_code` | `varchar(48)` | ya | — | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.call_to_action`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `title_key` | `varchar(160)` | tidak | — | — | — |
| 4 | `default_title` | `varchar(255)` | tidak | — | — | — |
| 5 | `body_key` | `varchar(160)` | ya | — | — | — |
| 6 | `default_body` | `text` | ya | — | — | — |
| 7 | `button_key` | `varchar(160)` | tidak | — | — | — |
| 8 | `default_button` | `varchar(160)` | tidak | — | — | — |
| 9 | `url` | `varchar(500)` | tidak | — | — | — |
| 10 | `style` | `varchar(32)` | tidak | `'primary'::character varying` | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_sample` | `bool` | tidak | `false` | — | — |
| 14 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 19 | `delete_reason` | `text` | ya | — | — | — |
| 20 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_block`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `page_version_id` | `uuid` | tidak | — | FK | `cms_page_version.id` (ON DELETE CASCADE) |
| 3 | `parent_block_id` | `uuid` | ya | — | FK | `cms_block.id` (ON DELETE CASCADE) |
| 4 | `block_type` | `varchar(48)` | tidak | — | — | — |
| 5 | `block_key` | `varchar(64)` | tidak | — | — | — |
| 6 | `layout` | `varchar(48)` | tidak | `'default'::character varying` | — | — |
| 7 | `settings` | `jsonb` | ya | — | — | — |
| 8 | `sort_order` | `int4` | tidak | `0` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `created_by` | `uuid` | ya | — | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `updated_by` | `uuid` | ya | — | — | — |
| 14 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 15 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_block_translation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `block_id` | `uuid` | tidak | — | FK | `cms_block.id` (ON DELETE CASCADE) |
| 3 | `locale_code` | `varchar(16)` | tidak | — | FK | `locale.code` (ON DELETE RESTRICT) |
| 4 | `eyebrow` | `varchar(255)` | ya | — | — | — |
| 5 | `heading` | `varchar(500)` | ya | — | — | — |
| 6 | `subheading` | `text` | ya | — | — | — |
| 7 | `body` | `text` | ya | — | — | — |
| 8 | `button_label` | `varchar(160)` | ya | — | — | — |
| 9 | `button_url` | `varchar(500)` | ya | — | — | — |
| 10 | `content_json` | `jsonb` | ya | — | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_footer_item`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `footer_section_id` | `uuid` | tidak | — | FK | `cms_footer_section.id` (ON DELETE CASCADE) |
| 3 | `label_key` | `varchar(160)` | tidak | — | — | — |
| 4 | `default_label` | `varchar(160)` | tidak | — | — | — |
| 5 | `url` | `varchar(500)` | tidak | — | — | — |
| 6 | `icon` | `varchar(64)` | ya | — | — | — |
| 7 | `sort_order` | `int4` | tidak | `0` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_footer_section`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `website_id` | `uuid` | tidak | — | FK | `website.id` (ON DELETE CASCADE) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `title_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `default_title` | `varchar(160)` | tidak | — | — | — |
| 6 | `sort_order` | `int4` | tidak | `0` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 12 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 13 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_navigation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `website_id` | `uuid` | tidak | — | FK | `website.id` (ON DELETE CASCADE) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `location` | `CmsNavigationLocation` | tidak | `'HEADER'::platform."CmsNavigationLocation"` | — | — |
| 6 | `sort_order` | `int4` | tidak | `0` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_system` | `bool` | tidak | `false` | — | — |
| 9 | `is_sample` | `bool` | tidak | `false` | — | — |
| 10 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_navigation_item`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `navigation_id` | `uuid` | tidak | — | FK | `cms_navigation.id` (ON DELETE CASCADE) |
| 3 | `parent_id` | `uuid` | ya | — | FK | `cms_navigation_item.id` (ON DELETE CASCADE) |
| 4 | `label_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `default_label` | `varchar(160)` | tidak | — | — | — |
| 6 | `page_id` | `uuid` | ya | — | FK | `cms_page.id` (ON DELETE SET NULL) |
| 7 | `external_url` | `varchar(500)` | ya | — | — | — |
| 8 | `anchor` | `varchar(96)` | ya | — | — | — |
| 9 | `icon` | `varchar(64)` | ya | — | — | — |
| 10 | `target` | `varchar(16)` | tidak | `'_self'::character varying` | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 14 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 15 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_page`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `website_id` | `uuid` | tidak | — | FK | `website.id` (ON DELETE CASCADE) |
| 3 | `parent_id` | `uuid` | ya | — | FK | `cms_page.id` (ON DELETE RESTRICT) |
| 4 | `slug` | `varchar(160)` | tidak | — | — | — |
| 5 | `code` | `varchar(64)` | tidak | — | — | — |
| 6 | `page_type` | `CmsPageType` | tidak | `'STANDARD'::platform."CmsPageType"` | — | — |
| 7 | `template_code` | `varchar(48)` | tidak | `'default'::character varying` | — | — |
| 8 | `status` | `CmsStatus` | tidak | `'DRAFT'::platform."CmsStatus"` | — | — |
| 9 | `published_version_id` | `uuid` | ya | — | — | — |
| 10 | `show_in_navigation` | `bool` | tidak | `false` | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_system` | `bool` | tidak | `false` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `metadata` | `jsonb` | ya | — | — | — |
| 17 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 18 | `created_by` | `uuid` | ya | — | — | — |
| 19 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 20 | `updated_by` | `uuid` | ya | — | — | — |
| 21 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 22 | `deactivated_by` | `uuid` | ya | — | — | — |
| 23 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_by` | `uuid` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_page_translation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `page_version_id` | `uuid` | tidak | — | FK | `cms_page_version.id` (ON DELETE CASCADE) |
| 3 | `locale_code` | `varchar(16)` | tidak | — | FK | `locale.code` (ON DELETE RESTRICT) |
| 4 | `title` | `varchar(255)` | tidak | — | — | — |
| 5 | `summary` | `text` | ya | — | — | — |
| 6 | `seo_title` | `varchar(255)` | ya | — | — | — |
| 7 | `seo_description` | `text` | ya | — | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_page_version`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `page_id` | `uuid` | tidak | — | FK | `cms_page.id` (ON DELETE CASCADE) |
| 3 | `version_number` | `int4` | tidak | — | — | — |
| 4 | `title` | `varchar(255)` | tidak | — | — | — |
| 5 | `summary` | `text` | ya | — | — | — |
| 6 | `seo_title` | `varchar(255)` | ya | — | — | — |
| 7 | `seo_description` | `text` | ya | — | — | — |
| 8 | `seo_keywords` | `varchar(500)` | ya | — | — | — |
| 9 | `og_image_asset_id` | `uuid` | ya | — | — | — |
| 10 | `status` | `CmsStatus` | tidak | `'DRAFT'::platform."CmsStatus"` | — | — |
| 11 | `scheduled_at` | `timestamptz` | ya | — | — | — |
| 12 | `published_at` | `timestamptz` | ya | — | — | — |
| 13 | `published_by` | `uuid` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 19 | `version` | `int4` | tidak | `1` | — | — |

### `platform.cms_preview_token`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `entity_type` | `varchar(48)` | tidak | — | — | — |
| 3 | `entity_id` | `uuid` | tidak | — | — | — |
| 4 | `token_hash` | `varchar(128)` | tidak | — | — | — |
| 5 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 6 | `created_by_id` | `uuid` | ya | — | — | — |
| 7 | `used_at` | `timestamptz` | ya | — | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.cms_publication_workflow`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `entity_type` | `varchar(48)` | tidak | — | — | — |
| 3 | `entity_id` | `uuid` | tidak | — | — | — |
| 4 | `status` | `CmsStatus` | tidak | `'DRAFT'::platform."CmsStatus"` | — | — |
| 5 | `submitted_by_id` | `uuid` | ya | — | — | — |
| 6 | `submitted_at` | `timestamptz` | ya | — | — | — |
| 7 | `reviewed_by_id` | `uuid` | ya | — | — | — |
| 8 | `reviewed_at` | `timestamptz` | ya | — | — | — |
| 9 | `published_by_id` | `uuid` | ya | — | — | — |
| 10 | `published_at` | `timestamptz` | ya | — | — | — |
| 11 | `comment` | `text` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.contact_message`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `name` | `varchar(160)` | tidak | — | — | — |
| 3 | `email` | `varchar(255)` | tidak | — | — | — |
| 4 | `phone` | `varchar(64)` | ya | — | — | — |
| 5 | `subject` | `varchar(255)` | tidak | — | — | — |
| 6 | `message` | `text` | tidak | — | — | — |
| 7 | `status` | `ContactMessageStatus` | tidak | `'NEW'::platform."ContactMessageStatus"` | — | — |
| 8 | `assigned_to_id` | `uuid` | ya | — | — | — |
| 9 | `responded_at` | `timestamptz` | ya | — | — | — |
| 10 | `locale_code` | `varchar(16)` | tidak | `'id'::character varying` | — | — |
| 11 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 14 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 15 | `version` | `int4` | tidak | `1` | — | — |

### `platform.contact_office`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `address` | `text` | tidak | — | — | — |
| 5 | `phone` | `varchar(64)` | ya | — | — | — |
| 6 | `email` | `varchar(160)` | ya | — | — | — |
| 7 | `map_url` | `varchar(500)` | ya | — | — | — |
| 8 | `opening_hours` | `varchar(255)` | ya | — | — | — |
| 9 | `is_primary` | `bool` | tidak | `false` | — | — |
| 10 | `sort_order` | `int4` | tidak | `0` | — | — |
| 11 | `is_active` | `bool` | tidak | `true` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 16 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 17 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 18 | `delete_reason` | `text` | ya | — | — | — |
| 19 | `version` | `int4` | tidak | `1` | — | — |

### `platform.demo_reset_run`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `generation` | `int4` | tidak | — | — | — |
| 3 | `triggered_by` | `varchar(48)` | tidak | `'SCHEDULER'::character varying` | — | — |
| 4 | `triggered_by_id` | `uuid` | ya | — | — | — |
| 5 | `started_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 6 | `finished_at` | `timestamptz` | ya | — | — | — |
| 7 | `status` | `varchar(24)` | tidak | `'RUNNING'::character varying` | — | — |
| 8 | `tables_truncated` | `int4` | tidak | `0` | — | — |
| 9 | `error_message` | `text` | ya | — | — | — |

### `platform.demo_session`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `session_token` | `varchar(128)` | tidak | — | — | — |
| 3 | `schema_name` | `varchar(64)` | tidak | `'demo'::character varying` | — | — |
| 4 | `status` | `DemoSessionStatus` | tidak | `'ACTIVE'::platform."DemoSessionStatus"` | — | — |
| 5 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 6 | `user_agent` | `text` | ya | — | — | — |
| 7 | `locale_code` | `varchar(16)` | tidak | `'id'::character varying` | — | — |
| 8 | `reset_generation` | `int4` | tidak | `0` | — | — |
| 9 | `started_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 11 | `ended_at` | `timestamptz` | ya | — | — | — |

### `platform.device_activation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `device_id` | `uuid` | tidak | — | FK | `pos_device.id` (ON DELETE CASCADE) |
| 3 | `activation_code` | `varchar(64)` | tidak | — | — | — |
| 4 | `fingerprint_hash` | `varchar(128)` | ya | — | — | — |
| 5 | `activated_at` | `timestamptz` | ya | — | — | — |
| 6 | `revoked_at` | `timestamptz` | ya | — | — | — |
| 7 | `revoke_reason` | `text` | ya | — | — | — |
| 8 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.device_entitlement`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `device_id` | `uuid` | tidak | — | FK | `pos_device.id` (ON DELETE CASCADE) |
| 3 | `module_code` | `varchar(48)` | tidak | — | — | — |
| 4 | `feature_code` | `varchar(64)` | ya | — | — | — |
| 5 | `status` | `DeviceEntitlementStatus` | tidak | `'TRIAL'::platform."DeviceEntitlementStatus"` | — | — |
| 6 | `starts_at` | `timestamptz` | tidak | — | — | — |
| 7 | `ends_at` | `timestamptz` | ya | — | — | — |
| 8 | `grace_ends_at` | `timestamptz` | ya | — | — | — |
| 9 | `source_type` | `varchar(48)` | tidak | — | — | — |
| 10 | `source_id` | `uuid` | ya | — | — | — |
| 11 | `source_snapshot` | `jsonb` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

### `platform.discount_approval`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `program_id` | `uuid` | tidak | — | FK | `discount_program.id` (ON DELETE CASCADE) |
| 3 | `requested_by_id` | `uuid` | tidak | — | — | — |
| 4 | `approved_by_id` | `uuid` | ya | — | — | — |
| 5 | `status` | `varchar(24)` | tidak | `'PENDING'::character varying` | — | — |
| 6 | `reason` | `text` | ya | — | — | — |
| 7 | `requested_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `decided_at` | `timestamptz` | ya | — | — | — |

### `platform.discount_benefit`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `rule_id` | `uuid` | tidak | — | FK | `discount_rule.id` (ON DELETE CASCADE) |
| 3 | `benefit_type` | `DiscountBenefitType` | tidak | — | — | — |
| 4 | `numeric_value` | `numeric(19,4)` | tidak | — | — | — |
| 5 | `currency_code` | `varchar(8)` | ya | — | — | — |
| 6 | `max_amount` | `numeric(19,4)` | ya | — | — | — |
| 7 | `label_key` | `varchar(160)` | ya | — | — | — |
| 8 | `sequence` | `int4` | tidak | `0` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

### `platform.discount_condition`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `group_id` | `uuid` | tidak | — | FK | `discount_condition_group.id` (ON DELETE CASCADE) |
| 3 | `field` | `DiscountConditionField` | tidak | — | — | — |
| 4 | `operator` | `DiscountOperator` | tidak | — | — | — |
| 5 | `value_json` | `jsonb` | tidak | — | — | — |
| 6 | `sequence` | `int4` | tidak | `0` | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 9 | `version` | `int4` | tidak | `1` | — | — |

### `platform.discount_condition_group`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `rule_id` | `uuid` | tidak | — | FK | `discount_rule.id` (ON DELETE CASCADE) |
| 3 | `parent_group_id` | `uuid` | ya | — | FK | `discount_condition_group.id` (ON DELETE CASCADE) |
| 4 | `operator` | `ConditionGroupOperator` | tidak | `'AND'::platform."ConditionGroupOperator"` | — | — |
| 5 | `sequence` | `int4` | tidak | `0` | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 7 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 8 | `version` | `int4` | tidak | `1` | — | — |

### `platform.discount_plan_eligibility`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `program_id` | `uuid` | tidak | — | FK | `discount_program.id` (ON DELETE CASCADE) |
| 3 | `plan_id` | `uuid` | tidak | — | FK | `subscription_plan.id` (ON DELETE CASCADE) |
| 4 | `included` | `bool` | tidak | `true` | — | — |
| 5 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.discount_program`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `priority` | `int4` | tidak | `100` | — | — |
| 7 | `stack_policy` | `DiscountStackPolicy` | tidak | `'EXCLUSIVE'::platform."DiscountStackPolicy"` | — | — |
| 8 | `max_discount_amount` | `numeric(19,4)` | ya | — | — | — |
| 9 | `max_redemptions` | `int4` | ya | — | — | — |
| 10 | `max_per_tenant` | `int4` | ya | — | — | — |
| 11 | `valid_from` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `valid_until` | `timestamptz` | ya | — | — | — |
| 13 | `status` | `varchar(24)` | tidak | `'DRAFT'::character varying` | — | — |
| 14 | `requires_promo_code` | `bool` | tidak | `false` | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_system` | `bool` | tidak | `false` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 23 | `updated_by` | `uuid` | ya | — | — | — |
| 24 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 25 | `deactivated_by` | `uuid` | ya | — | — | — |
| 26 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 27 | `deleted_by` | `uuid` | ya | — | — | — |
| 28 | `delete_reason` | `text` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

### `platform.discount_redemption`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `program_id` | `uuid` | tidak | — | FK | `discount_program.id` (ON DELETE RESTRICT) |
| 3 | `promo_code_id` | `uuid` | ya | — | FK | `promo_code.id` (ON DELETE SET NULL) |
| 4 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE RESTRICT) |
| 5 | `quote_id` | `uuid` | ya | — | — | — |
| 6 | `invoice_id` | `uuid` | ya | — | — | — |
| 7 | `amount` | `numeric(19,4)` | tidak | — | — | — |
| 8 | `idempotency_key` | `varchar(96)` | tidak | — | — | — |
| 9 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.discount_rule`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `program_id` | `uuid` | tidak | — | FK | `discount_program.id` (ON DELETE CASCADE) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `sequence` | `int4` | tidak | `0` | — | — |
| 6 | `is_active` | `bool` | tidak | `true` | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 9 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

### `platform.discount_tenant_eligibility`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `program_id` | `uuid` | tidak | — | FK | `discount_program.id` (ON DELETE CASCADE) |
| 3 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 4 | `included` | `bool` | tidak | `true` | — | — |
| 5 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.entitlement_snapshot`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `source_type` | `varchar(48)` | tidak | — | — | — |
| 4 | `source_id` | `uuid` | ya | — | — | — |
| 5 | `scope_type` | `EntitlementScope` | tidak | `'TENANT_WIDE'::platform."EntitlementScope"` | — | — |
| 6 | `scope_id` | `uuid` | ya | — | — | — |
| 7 | `modules` | `jsonb` | tidak | — | — | — |
| 8 | `features` | `jsonb` | tidak | — | — | — |
| 9 | `generated_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `valid_until` | `timestamptz` | ya | — | — | — |
| 11 | `checksum` | `varchar(64)` | tidak | — | — | — |

### `platform.faq_category`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 4 | `default_name` | `varchar(160)` | tidak | — | — | — |
| 5 | `sort_order` | `int4` | tidak | `0` | — | — |
| 6 | `is_active` | `bool` | tidak | `true` | — | — |
| 7 | `is_system` | `bool` | tidak | `false` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 12 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 13 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 14 | `delete_reason` | `text` | ya | — | — | — |
| 15 | `version` | `int4` | tidak | `1` | — | — |

### `platform.faq_item`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `category_id` | `uuid` | tidak | — | FK | `faq_category.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `question_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `default_question` | `varchar(500)` | tidak | — | — | — |
| 6 | `answer_key` | `varchar(160)` | tidak | — | — | — |
| 7 | `default_answer` | `text` | tidak | — | — | — |
| 8 | `sort_order` | `int4` | tidak | `0` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 14 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 15 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 16 | `delete_reason` | `text` | ya | — | — | — |
| 17 | `version` | `int4` | tidak | `1` | — | — |

### `platform.feature_catalog`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `module_id` | `uuid` | tidak | — | FK | `module_catalog.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 6 | `description` | `text` | ya | — | — | — |
| 7 | `feature_type` | `FeatureType` | tidak | `'BOOLEAN'::platform."FeatureType"` | — | — |
| 8 | `default_limit` | `int4` | ya | — | — | — |
| 9 | `unit` | `varchar(32)` | ya | — | — | — |
| 10 | `status` | `CatalogStatus` | tidak | `'ACTIVE'::platform."CatalogStatus"` | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_system` | `bool` | tidak | `true` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `metadata` | `jsonb` | ya | — | — | — |
| 17 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 18 | `created_by` | `uuid` | ya | — | — | — |
| 19 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 20 | `updated_by` | `uuid` | ya | — | — | — |
| 21 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 22 | `deactivated_by` | `uuid` | ya | — | — | — |
| 23 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_by` | `uuid` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.global_menu_template`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `parent_id` | `uuid` | ya | — | FK | `global_menu_template.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `translation_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `default_label` | `varchar(160)` | tidak | — | — | — |
| 6 | `route` | `varchar(160)` | ya | — | — | — |
| 7 | `icon` | `varchar(64)` | ya | — | — | — |
| 8 | `module_code` | `varchar(48)` | ya | — | — | — |
| 9 | `platform_target` | `varchar(24)` | tidak | `'WEB'::character varying` | — | — |
| 10 | `level` | `int4` | tidak | `0` | — | — |
| 11 | `path` | `varchar(512)` | tidak | — | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `is_coming_soon` | `bool` | tidak | `false` | — | — |
| 14 | `action_codes` | `jsonb` | ya | — | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_system` | `bool` | tidak | `true` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 23 | `updated_by` | `uuid` | ya | — | — | — |
| 24 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 25 | `deactivated_by` | `uuid` | ya | — | — | — |
| 26 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 27 | `deleted_by` | `uuid` | ya | — | — | — |
| 28 | `delete_reason` | `text` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

### `platform.global_permission_action`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(120)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `action_type` | `varchar(24)` | tidak | `'STANDARD'::character varying` | — | — |
| 7 | `sort_order` | `int4` | tidak | `0` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `true` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `metadata` | `jsonb` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 14 | `created_by` | `uuid` | ya | — | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 16 | `updated_by` | `uuid` | ya | — | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deactivated_by` | `uuid` | ya | — | — | — |
| 19 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 20 | `deleted_by` | `uuid` | ya | — | — | — |
| 21 | `delete_reason` | `text` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

### `platform.global_role_template`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(64)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(120)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `role_type` | `varchar(24)` | tidak | `'TENANT'::character varying` | — | — |
| 7 | `is_default` | `bool` | tidak | `false` | — | — |
| 8 | `permissions` | `jsonb` | tidak | — | — | — |
| 9 | `sort_order` | `int4` | tidak | `0` | — | — |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `is_system` | `bool` | tidak | `true` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

### `platform.hero_slide`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `website_id` | `uuid` | tidak | — | FK | `website.id` (ON DELETE CASCADE) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `eyebrow_key` | `varchar(160)` | ya | — | — | — |
| 5 | `default_eyebrow` | `varchar(255)` | ya | — | — | — |
| 6 | `title_key` | `varchar(160)` | tidak | — | — | — |
| 7 | `default_title` | `varchar(500)` | tidak | — | — | — |
| 8 | `subtitle_key` | `varchar(160)` | ya | — | — | — |
| 9 | `default_subtitle` | `text` | ya | — | — | — |
| 10 | `background_asset_id` | `uuid` | ya | — | FK | `media_asset.id` (ON DELETE SET NULL) |
| 11 | `primary_cta_label_key` | `varchar(160)` | ya | — | — | — |
| 12 | `primary_cta_label` | `varchar(160)` | ya | — | — | — |
| 13 | `primary_cta_url` | `varchar(500)` | ya | — | — | — |
| 14 | `secondary_cta_label_key` | `varchar(160)` | ya | — | — | — |
| 15 | `secondary_cta_label` | `varchar(160)` | ya | — | — | — |
| 16 | `secondary_cta_url` | `varchar(500)` | ya | — | — | — |
| 17 | `sort_order` | `int4` | tidak | `0` | — | — |
| 18 | `is_active` | `bool` | tidak | `true` | — | — |
| 19 | `is_sample` | `bool` | tidak | `false` | — | — |
| 20 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 23 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.host_to_host_log`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `provider_id` | `uuid` | ya | — | FK | `payment_provider.id` (ON DELETE SET NULL) |
| 3 | `direction` | `varchar(16)` | tidak | `'INBOUND'::character varying` | — | — |
| 4 | `endpoint` | `varchar(160)` | tidak | — | — | — |
| 5 | `remote_ip` | `varchar(64)` | ya | — | — | — |
| 6 | `headers_masked` | `jsonb` | ya | — | — | — |
| 7 | `payload_masked` | `text` | ya | — | — | — |
| 8 | `order_number` | `varchar(64)` | ya | — | — | — |
| 9 | `provider_transaction_id` | `varchar(96)` | ya | — | — | — |
| 10 | `amount` | `numeric(19,4)` | ya | — | — | — |
| 11 | `result` | `varchar(24)` | tidak | `'OK'::character varying` | — | — |
| 12 | `result_detail` | `text` | ya | — | — | — |
| 13 | `stack_trace` | `text` | ya | — | — | — |
| 14 | `http_status` | `int4` | ya | — | — | — |
| 15 | `duration_ms` | `int4` | ya | — | — | — |
| 16 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.idempotency_record`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | ya | — | — | — |
| 3 | `idempotency_key` | `varchar(96)` | tidak | — | — | — |
| 4 | `operation` | `varchar(96)` | tidak | — | — | — |
| 5 | `request_hash` | `varchar(64)` | tidak | — | — | — |
| 6 | `response_status` | `int4` | tidak | — | — | — |
| 7 | `response_body` | `jsonb` | ya | — | — | — |
| 8 | `resource_type` | `varchar(64)` | ya | — | — | — |
| 9 | `resource_id` | `varchar(64)` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `expires_at` | `timestamptz` | tidak | — | — | — |

### `platform.locale`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(16)` | tidak | — | — | — |
| 3 | `name` | `varchar(96)` | tidak | — | — | — |
| 4 | `native_name` | `varchar(96)` | tidak | — | — | — |
| 5 | `direction` | `LocaleDirection` | tidak | `'LTR'::platform."LocaleDirection"` | — | — |
| 6 | `fallback_code` | `varchar(16)` | ya | — | — | — |
| 7 | `is_default` | `bool` | tidak | `false` | — | — |
| 8 | `enabled` | `bool` | tidak | `false` | — | — |
| 9 | `number_format` | `varchar(32)` | tidak | `'id-ID'::character varying` | — | — |
| 10 | `date_format` | `varchar(32)` | tidak | `'dd/MM/yyyy'::character varying` | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_system` | `bool` | tidak | `false` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `metadata` | `jsonb` | ya | — | — | — |
| 17 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 18 | `created_by` | `uuid` | ya | — | — | — |
| 19 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 20 | `updated_by` | `uuid` | ya | — | — | — |
| 21 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 22 | `deactivated_by` | `uuid` | ya | — | — | — |
| 23 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_by` | `uuid` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.marketing_feature`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `module_id` | `uuid` | ya | — | FK | `module_catalog.id` (ON DELETE SET NULL) |
| 4 | `module_code` | `varchar(48)` | ya | — | — | — |
| 5 | `title_key` | `varchar(160)` | tidak | — | — | — |
| 6 | `default_title` | `varchar(255)` | tidak | — | — | — |
| 7 | `description_key` | `varchar(160)` | ya | — | — | — |
| 8 | `default_description` | `text` | ya | — | — | — |
| 9 | `icon` | `varchar(64)` | ya | — | — | — |
| 10 | `image_asset_id` | `uuid` | ya | — | FK | `media_asset.id` (ON DELETE SET NULL) |
| 11 | `group` | `varchar(32)` | tidak | `'FEATURE'::character varying` | — | — |
| 12 | `sort_order` | `int4` | tidak | `0` | — | — |
| 13 | `is_active` | `bool` | tidak | `true` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 20 | `delete_reason` | `text` | ya | — | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

### `platform.media_asset`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `folder_id` | `uuid` | ya | — | FK | `media_folder.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(96)` | tidak | — | — | — |
| 4 | `storage_key` | `varchar(512)` | tidak | — | — | — |
| 5 | `public_url` | `varchar(500)` | ya | — | — | — |
| 6 | `filename` | `varchar(255)` | tidak | — | — | — |
| 7 | `mime_type` | `varchar(128)` | tidak | — | — | — |
| 8 | `size_bytes` | `int4` | tidak | `0` | — | — |
| 9 | `checksum` | `varchar(64)` | ya | — | — | — |
| 10 | `width` | `int4` | ya | — | — | — |
| 11 | `height` | `int4` | ya | — | — | — |
| 12 | `alt_key` | `varchar(160)` | ya | — | — | — |
| 13 | `default_alt` | `varchar(255)` | ya | — | — | — |
| 14 | `is_public` | `bool` | tidak | `true` | — | — |
| 15 | `sort_order` | `int4` | tidak | `0` | — | — |
| 16 | `is_active` | `bool` | tidak | `true` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 23 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.media_folder`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `parent_id` | `uuid` | ya | — | FK | `media_folder.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(160)` | tidak | — | — | — |
| 5 | `path` | `varchar(512)` | tidak | — | — | — |
| 6 | `sort_order` | `int4` | tidak | `0` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_system` | `bool` | tidak | `false` | — | — |
| 9 | `is_sample` | `bool` | tidak | `false` | — | — |
| 10 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 14 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 15 | `delete_reason` | `text` | ya | — | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

### `platform.module_catalog`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `description_key` | `varchar(160)` | ya | — | — | — |
| 6 | `description` | `text` | ya | — | — | — |
| 7 | `category` | `ModuleCategory` | tidak | `'OPERATIONS'::platform."ModuleCategory"` | — | — |
| 8 | `status` | `CatalogStatus` | tidak | `'ACTIVE'::platform."CatalogStatus"` | — | — |
| 9 | `icon` | `varchar(64)` | ya | — | — | — |
| 10 | `depends_on` | `jsonb` | ya | — | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_system` | `bool` | tidak | `true` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `metadata` | `jsonb` | ya | — | — | — |
| 17 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 18 | `created_by` | `uuid` | ya | — | — | — |
| 19 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 20 | `updated_by` | `uuid` | ya | — | — | — |
| 21 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 22 | `deactivated_by` | `uuid` | ya | — | — | — |
| 23 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_by` | `uuid` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.news_article`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `category_id` | `uuid` | tidak | — | FK | `news_category.id` (ON DELETE RESTRICT) |
| 3 | `author_user_id` | `uuid` | ya | — | FK | `platform_user.id` (ON DELETE SET NULL) |
| 4 | `slug` | `varchar(160)` | tidak | — | — | — |
| 5 | `code` | `varchar(64)` | tidak | — | — | — |
| 6 | `status` | `CmsStatus` | tidak | `'DRAFT'::platform."CmsStatus"` | — | — |
| 7 | `featured_image_id` | `uuid` | ya | — | FK | `media_asset.id` (ON DELETE SET NULL) |
| 8 | `published_at` | `timestamptz` | ya | — | — | — |
| 9 | `expired_at` | `timestamptz` | ya | — | — | — |
| 10 | `is_featured` | `bool` | tidak | `false` | — | — |
| 11 | `is_pinned` | `bool` | tidak | `false` | — | — |
| 12 | `view_count` | `int4` | tidak | `0` | — | — |
| 13 | `published_version_id` | `uuid` | ya | — | — | — |
| 14 | `sort_order` | `int4` | tidak | `0` | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_system` | `bool` | tidak | `false` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 23 | `updated_by` | `uuid` | ya | — | — | — |
| 24 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 25 | `deactivated_by` | `uuid` | ya | — | — | — |
| 26 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 27 | `deleted_by` | `uuid` | ya | — | — | — |
| 28 | `delete_reason` | `text` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

### `platform.news_article_tag`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `article_id` | `uuid` | tidak | — | FK | `news_article.id` (ON DELETE CASCADE) |
| 3 | `tag_id` | `uuid` | tidak | — | FK | `news_tag.id` (ON DELETE CASCADE) |
| 4 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.news_article_translation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `article_version_id` | `uuid` | tidak | — | FK | `news_article_version.id` (ON DELETE CASCADE) |
| 3 | `locale_code` | `varchar(16)` | tidak | — | FK | `locale.code` (ON DELETE RESTRICT) |
| 4 | `title` | `varchar(255)` | tidak | — | — | — |
| 5 | `summary` | `text` | ya | — | — | — |
| 6 | `content` | `text` | tidak | — | — | — |
| 7 | `seo_title` | `varchar(255)` | ya | — | — | — |
| 8 | `seo_description` | `text` | ya | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

### `platform.news_article_version`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `article_id` | `uuid` | tidak | — | FK | `news_article.id` (ON DELETE CASCADE) |
| 3 | `version_number` | `int4` | tidak | — | — | — |
| 4 | `title` | `varchar(255)` | tidak | — | — | — |
| 5 | `summary` | `text` | ya | — | — | — |
| 6 | `content` | `text` | tidak | — | — | — |
| 7 | `status` | `CmsStatus` | tidak | `'DRAFT'::platform."CmsStatus"` | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `created_by` | `uuid` | ya | — | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

### `platform.news_category`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `parent_id` | `uuid` | ya | — | FK | `news_category.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `default_name` | `varchar(160)` | tidak | — | — | — |
| 6 | `slug` | `varchar(96)` | tidak | — | — | — |
| 7 | `description` | `text` | ya | — | — | — |
| 8 | `sort_order` | `int4` | tidak | `0` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `false` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

### `platform.news_tag`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 4 | `default_name` | `varchar(160)` | tidak | — | — | — |
| 5 | `slug` | `varchar(96)` | tidak | — | — | — |
| 6 | `sort_order` | `int4` | tidak | `0` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 12 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 13 | `delete_reason` | `text` | ya | — | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

### `platform.newsletter_subscriber`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `email` | `varchar(255)` | tidak | — | — | — |
| 3 | `locale_code` | `varchar(16)` | tidak | `'id'::character varying` | — | — |
| 4 | `status` | `NewsletterStatus` | tidak | `'PENDING'::platform."NewsletterStatus"` | — | — |
| 5 | `subscribed_at` | `timestamptz` | ya | — | — | — |
| 6 | `unsubscribed_at` | `timestamptz` | ya | — | — | — |
| 7 | `confirm_token` | `varchar(96)` | ya | — | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

### `platform.package_assignment`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `scope_type` | `AssignmentScope` | tidak | `'TENANT'::platform."AssignmentScope"` | — | — |
| 4 | `scope_id` | `uuid` | ya | — | — | — |
| 5 | `plan_version_id` | `uuid` | tidak | — | FK | `subscription_plan_version.id` (ON DELETE RESTRICT) |
| 6 | `starts_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 7 | `ends_at` | `timestamptz` | ya | — | — | — |
| 8 | `status` | `varchar(24)` | tidak | `'ACTIVE'::character varying` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `created_by` | `uuid` | ya | — | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

### `platform.partner_logo`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `website_url` | `varchar(500)` | ya | — | — | — |
| 5 | `logo_asset_id` | `uuid` | ya | — | FK | `media_asset.id` (ON DELETE SET NULL) |
| 6 | `logo_url` | `varchar(500)` | ya | — | — | — |
| 7 | `sort_order` | `int4` | tidak | `0` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_sample` | `bool` | tidak | `false` | — | — |
| 10 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 14 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 15 | `delete_reason` | `text` | ya | — | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

### `platform.payment_attempt`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `order_id` | `uuid` | tidak | — | FK | `payment_order.id` (ON DELETE CASCADE) |
| 3 | `attempt_type` | `PaymentAttemptType` | tidak | — | — | — |
| 4 | `status` | `PaymentAttemptStatus` | tidak | `'PENDING'::platform."PaymentAttemptStatus"` | — | — |
| 5 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 6 | `request_payload_masked` | `jsonb` | ya | — | — | — |
| 7 | `response_payload_masked` | `jsonb` | ya | — | — | — |
| 8 | `http_status` | `int4` | ya | — | — | — |
| 9 | `provider_code` | `varchar(32)` | ya | — | — | — |
| 10 | `provider_message` | `text` | ya | — | — | — |
| 11 | `duration_ms` | `int4` | ya | — | — | — |
| 12 | `error_message` | `text` | ya | — | — | — |
| 13 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.payment_callback_event`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `provider_id` | `uuid` | tidak | — | FK | `payment_provider.id` (ON DELETE RESTRICT) |
| 3 | `order_id` | `uuid` | ya | — | FK | `payment_order.id` (ON DELETE SET NULL) |
| 4 | `provider_transaction_id` | `varchar(96)` | tidak | — | — | — |
| 5 | `provider_order_id` | `varchar(96)` | ya | — | — | — |
| 6 | `raw_status` | `varchar(48)` | tidak | — | — | — |
| 7 | `normalized_status` | `NormalizedPaymentStatus` | tidak | `'UNKNOWN'::platform."NormalizedPaymentStatus"` | — | — |
| 8 | `amount` | `numeric(19,4)` | ya | — | — | — |
| 9 | `transaction_time` | `timestamptz` | ya | — | — | — |
| 10 | `payload_masked` | `jsonb` | tidak | — | — | — |
| 11 | `payload_checksum` | `varchar(64)` | tidak | — | — | — |
| 12 | `processing_status` | `CallbackProcessingStatus` | tidak | `'RECEIVED'::platform."CallbackProcessingStatus"` | — | — |
| 13 | `processing_message` | `text` | ya | — | — | — |
| 14 | `remote_ip` | `varchar(64)` | ya | — | — | — |
| 15 | `received_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 16 | `processed_at` | `timestamptz` | ya | — | — | — |
| 17 | `ack_body` | `varchar(64)` | ya | — | — | — |

### `platform.payment_channel`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `provider_id` | `uuid` | tidak | — | FK | `payment_provider.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `label_key` | `varchar(160)` | tidak | — | — | — |
| 6 | `admin_fee_type` | `AdminFeeType` | tidak | `'FIXED'::platform."AdminFeeType"` | — | — |
| 7 | `admin_fee_value` | `numeric(19,4)` | tidak | `0` | — | — |
| 8 | `expiry_options` | `jsonb` | ya | — | — | — |
| 9 | `secret_reference` | `varchar(160)` | ya | — | — | — |
| 10 | `sort_order` | `int4` | tidak | `0` | — | — |
| 11 | `is_active` | `bool` | tidak | `true` | — | — |
| 12 | `is_system` | `bool` | tidak | `false` | — | — |
| 13 | `is_sample` | `bool` | tidak | `false` | — | — |
| 14 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 15 | `metadata` | `jsonb` | ya | — | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 21 | `deactivated_by` | `uuid` | ya | — | — | — |
| 22 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 23 | `deleted_by` | `uuid` | ya | — | — | — |
| 24 | `delete_reason` | `text` | ya | — | — | — |
| 25 | `version` | `int4` | tidak | `1` | — | — |

### `platform.payment_channel_legacy_config`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `provider_id` | `uuid` | tidak | — | FK | `payment_provider.id` (ON DELETE CASCADE) |
| 3 | `raw_config` | `text` | tidak | — | — | — |
| 4 | `parsed_count` | `int4` | tidak | `0` | — | — |
| 5 | `skipped_count` | `int4` | tidak | `0` | — | — |
| 6 | `parsed_result` | `jsonb` | ya | — | — | — |
| 7 | `imported_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `imported_by` | `uuid` | ya | — | — | — |

### `platform.payment_check_batch`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `batch_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `source` | `PaymentInquirySource` | tidak | `'MANUAL_BATCH'::platform."PaymentInquirySource"` | — | — |
| 4 | `requested_by_id` | `uuid` | ya | — | — | — |
| 5 | `total_items` | `int4` | tidak | `0` | — | — |
| 6 | `processed_items` | `int4` | tidak | `0` | — | — |
| 7 | `success_items` | `int4` | tidak | `0` | — | — |
| 8 | `failure_items` | `int4` | tidak | `0` | — | — |
| 9 | `status` | `BatchRunStatus` | tidak | `'PENDING'::platform."BatchRunStatus"` | — | — |
| 10 | `concurrency` | `int4` | tidak | `4` | — | — |
| 11 | `error_message` | `text` | ya | — | — | — |
| 12 | `started_at` | `timestamptz` | ya | — | — | — |
| 13 | `finished_at` | `timestamptz` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

### `platform.payment_check_batch_item`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `batch_id` | `uuid` | tidak | — | FK | `payment_check_batch.id` (ON DELETE CASCADE) |
| 3 | `order_id` | `uuid` | tidak | — | FK | `payment_order.id` (ON DELETE RESTRICT) |
| 4 | `sequence` | `int4` | tidak | — | — | — |
| 5 | `status` | `BatchRunStatus` | tidak | `'PENDING'::platform."BatchRunStatus"` | — | — |
| 6 | `result_code` | `varchar(48)` | ya | — | — | — |
| 7 | `result_message` | `text` | ya | — | — | — |
| 8 | `normalized_status` | `NormalizedPaymentStatus` | tidak | `'UNKNOWN'::platform."NormalizedPaymentStatus"` | — | — |
| 9 | `started_at` | `timestamptz` | ya | — | — | — |
| 10 | `finished_at` | `timestamptz` | ya | — | — | — |

### `platform.payment_dead_letter`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `callback_event_id` | `uuid` | ya | — | FK | `payment_callback_event.id` (ON DELETE SET NULL) |
| 3 | `reason` | `text` | tidak | — | — | — |
| 4 | `payload_masked` | `jsonb` | ya | — | — | — |
| 5 | `retry_count` | `int4` | tidak | `0` | — | — |
| 6 | `last_retry_at` | `timestamptz` | ya | — | — | — |
| 7 | `resolved_at` | `timestamptz` | ya | — | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.payment_inquiry_attempt`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `order_id` | `uuid` | tidak | — | FK | `payment_order.id` (ON DELETE CASCADE) |
| 3 | `source` | `PaymentInquirySource` | tidak | `'MANUAL_SINGLE'::platform."PaymentInquirySource"` | — | — |
| 4 | `batch_id` | `uuid` | ya | — | — | — |
| 5 | `request_url_masked` | `text` | ya | — | — | — |
| 6 | `response_payload_masked` | `jsonb` | ya | — | — | — |
| 7 | `raw_status` | `varchar(48)` | ya | — | — | — |
| 8 | `normalized_status` | `NormalizedPaymentStatus` | tidak | `'UNKNOWN'::platform."NormalizedPaymentStatus"` | — | — |
| 9 | `http_status` | `int4` | ya | — | — | — |
| 10 | `duration_ms` | `int4` | ya | — | — | — |
| 11 | `error_message` | `text` | ya | — | — | — |
| 12 | `actor_user_id` | `uuid` | ya | — | — | — |
| 13 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.payment_order`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `provider_id` | `uuid` | tidak | — | FK | `payment_provider.id` (ON DELETE RESTRICT) |
| 3 | `invoice_id` | `uuid` | tidak | — | FK | `billing_invoice.id` (ON DELETE RESTRICT) |
| 4 | `selected_channel_id` | `uuid` | ya | — | FK | `payment_channel.id` (ON DELETE SET NULL) |
| 5 | `order_number` | `varchar(64)` | tidak | — | — | — |
| 6 | `provider_order_id` | `varchar(96)` | ya | — | — | — |
| 7 | `provider_transaction_id` | `varchar(96)` | ya | — | — | — |
| 8 | `payment_url` | `text` | ya | — | — | — |
| 9 | `virtual_account` | `varchar(64)` | ya | — | — | — |
| 10 | `amount` | `numeric(19,4)` | tidak | — | — | — |
| 11 | `admin_fee` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `total_amount` | `numeric(19,4)` | tidak | — | — | — |
| 13 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 14 | `status` | `PaymentOrderStatus` | tidak | `'DRAFT'::platform."PaymentOrderStatus"` | — | — |
| 15 | `expires_at` | `timestamptz` | ya | — | — | — |
| 16 | `paid_at` | `timestamptz` | ya | — | — | — |
| 17 | `request_snapshot` | `jsonb` | ya | — | — | — |
| 18 | `response_snapshot` | `jsonb` | ya | — | — | — |
| 19 | `idempotency_key` | `varchar(96)` | tidak | — | — | — |
| 20 | `replaced_by_order_id` | `uuid` | ya | — | — | — |
| 21 | `failure_code` | `varchar(64)` | ya | — | — | — |
| 22 | `failure_message` | `text` | ya | — | — | — |
| 23 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 24 | `created_by` | `uuid` | ya | — | — | — |
| 25 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.payment_provider`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `environment` | `varchar(24)` | tidak | `'SANDBOX'::character varying` | — | — |
| 5 | `status` | `PaymentProviderStatus` | tidak | `'DISABLED'::platform."PaymentProviderStatus"` | — | — |
| 6 | `base_url` | `varchar(255)` | ya | — | — | — |
| 7 | `create_order_path` | `varchar(160)` | tidak | `'api/payment/create-order'::character varying` | — | — |
| 8 | `inquiry_order_path` | `varchar(160)` | tidak | `'api/payment/inquiry-order/'::character varying` | — | — |
| 9 | `callback_url` | `varchar(255)` | ya | — | — | — |
| 10 | `success_redirect_url` | `varchar(255)` | ya | — | — | — |
| 11 | `failed_redirect_url` | `varchar(255)` | ya | — | — | — |
| 12 | `secret_reference` | `varchar(160)` | ya | — | — | — |
| 13 | `allowed_ips` | `text` | ya | — | — | — |
| 14 | `trust_proxy` | `bool` | tidak | `false` | — | — |
| 15 | `ack_success` | `varchar(32)` | tidak | `'OK'::character varying` | — | — |
| 16 | `ack_error` | `varchar(32)` | tidak | `'ERROR'::character varying` | — | — |
| 17 | `raw_payload_retention_days` | `int4` | tidak | `90` | — | — |
| 18 | `default_channel_codes` | `varchar(255)` | ya | — | — | — |
| 19 | `status_mapping` | `jsonb` | ya | — | — | — |
| 20 | `is_active` | `bool` | tidak | `true` | — | — |
| 21 | `is_system` | `bool` | tidak | `true` | — | — |
| 22 | `is_sample` | `bool` | tidak | `false` | — | — |
| 23 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 24 | `metadata` | `jsonb` | ya | — | — | — |
| 25 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 26 | `created_by` | `uuid` | ya | — | — | — |
| 27 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 28 | `updated_by` | `uuid` | ya | — | — | — |
| 29 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 30 | `deactivated_by` | `uuid` | ya | — | — | — |
| 31 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 32 | `deleted_by` | `uuid` | ya | — | — | — |
| 33 | `delete_reason` | `text` | ya | — | — | — |
| 34 | `version` | `int4` | tidak | `1` | — | — |

### `platform.payment_reconciliation_item`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `run_id` | `uuid` | tidak | — | FK | `payment_reconciliation_run.id` (ON DELETE CASCADE) |
| 3 | `order_id` | `uuid` | tidak | — | FK | `payment_order.id` (ON DELETE RESTRICT) |
| 4 | `provider_status` | `varchar(48)` | ya | — | — | — |
| 5 | `local_status` | `PaymentOrderStatus` | tidak | — | — | — |
| 6 | `outcome` | `ReconciliationOutcome` | tidak | `'MATCHED'::platform."ReconciliationOutcome"` | — | — |
| 7 | `discrepancy_note` | `text` | ya | — | — | — |
| 8 | `action_taken` | `varchar(96)` | ya | — | — | — |
| 9 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.payment_reconciliation_run`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `run_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `provider_id` | `uuid` | tidak | — | FK | `payment_provider.id` (ON DELETE RESTRICT) |
| 4 | `period_start` | `timestamptz` | tidak | — | — | — |
| 5 | `period_end` | `timestamptz` | tidak | — | — | — |
| 6 | `status` | `BatchRunStatus` | tidak | `'PENDING'::platform."BatchRunStatus"` | — | — |
| 7 | `total_orders` | `int4` | tidak | `0` | — | — |
| 8 | `matched_count` | `int4` | tidak | `0` | — | — |
| 9 | `discrepancy_count` | `int4` | tidak | `0` | — | — |
| 10 | `error_count` | `int4` | tidak | `0` | — | — |
| 11 | `started_at` | `timestamptz` | ya | — | — | — |
| 12 | `finished_at` | `timestamptz` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.payment_status_transition`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `order_id` | `uuid` | tidak | — | FK | `payment_order.id` (ON DELETE CASCADE) |
| 3 | `from_status` | `PaymentOrderStatus` | tidak | — | — | — |
| 4 | `to_status` | `PaymentOrderStatus` | tidak | — | — | — |
| 5 | `source_type` | `varchar(48)` | tidak | — | — | — |
| 6 | `source_id` | `uuid` | ya | — | — | — |
| 7 | `reason` | `text` | ya | — | — | — |
| 8 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.platform_admin_saved_view`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `user_id` | `uuid` | tidak | — | FK | `platform_user.id` (ON DELETE CASCADE) |
| 3 | `resource_code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `definition` | `jsonb` | tidak | — | — | — |
| 6 | `is_default` | `bool` | tidak | `false` | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 9 | `version` | `int4` | tidak | `1` | — | — |

### `platform.platform_login_attempt`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `username` | `varchar(64)` | tidak | — | — | — |
| 3 | `user_id` | `uuid` | ya | — | — | — |
| 4 | `success` | `bool` | tidak | — | — | — |
| 5 | `failure_code` | `varchar(64)` | ya | — | — | — |
| 6 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 7 | `user_agent` | `text` | ya | — | — | — |
| 8 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.platform_permission`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(96)` | tidak | — | — | — |
| 3 | `module_code` | `varchar(48)` | tidak | — | — | — |
| 4 | `action_code` | `varchar(48)` | tidak | — | — | — |
| 5 | `name` | `varchar(160)` | tidak | — | — | — |
| 6 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 7 | `description` | `text` | ya | — | — | — |
| 8 | `sort_order` | `int4` | tidak | `0` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `true` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

### `platform.platform_refresh_token`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `session_id` | `uuid` | tidak | — | FK | `platform_session.id` (ON DELETE CASCADE) |
| 3 | `token_hash` | `varchar(128)` | tidak | — | — | — |
| 4 | `parent_token_id` | `uuid` | ya | — | — | — |
| 5 | `issued_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 6 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 7 | `used_at` | `timestamptz` | ya | — | — | — |
| 8 | `revoked_at` | `timestamptz` | ya | — | — | — |

### `platform.platform_role`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(64)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `role_type` | `PlatformRoleType` | tidak | `'CUSTOM'::platform."PlatformRoleType"` | — | — |
| 7 | `sort_order` | `int4` | tidak | `0` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `metadata` | `jsonb` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 14 | `created_by` | `uuid` | ya | — | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 16 | `updated_by` | `uuid` | ya | — | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deactivated_by` | `uuid` | ya | — | — | — |
| 19 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 20 | `deleted_by` | `uuid` | ya | — | — | — |
| 21 | `delete_reason` | `text` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

### `platform.platform_role_permission`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `role_id` | `uuid` | tidak | — | FK | `platform_role.id` (ON DELETE CASCADE) |
| 3 | `permission_id` | `uuid` | tidak | — | FK | `platform_permission.id` (ON DELETE RESTRICT) |
| 4 | `effect` | `PermissionEffect` | tidak | `'ALLOW'::platform."PermissionEffect"` | — | — |
| 5 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 6 | `created_by` | `uuid` | ya | — | — | — |

### `platform.platform_session`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `user_id` | `uuid` | tidak | — | FK | `platform_user.id` (ON DELETE CASCADE) |
| 3 | `token_family_id` | `uuid` | tidak | — | — | — |
| 4 | `tenant_id` | `uuid` | ya | — | — | — |
| 5 | `schema_name` | `varchar(64)` | ya | — | — | — |
| 6 | `is_demo` | `bool` | tidak | `false` | — | — |
| 7 | `issued_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 9 | `revoked_at` | `timestamptz` | ya | — | — | — |
| 10 | `revoked_reason` | `varchar(96)` | ya | — | — | — |
| 11 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 12 | `user_agent` | `text` | ya | — | — | — |
| 13 | `last_seen_at` | `timestamptz` | ya | — | — | — |

### `platform.platform_setting`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `key` | `varchar(96)` | tidak | — | — | — |
| 3 | `value_type` | `varchar(24)` | tidak | — | — | — |
| 4 | `value` | `jsonb` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `is_secret` | `bool` | tidak | `false` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `is_system` | `bool` | tidak | `true` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `updated_by` | `uuid` | ya | — | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

### `platform.platform_step_up_challenge`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `user_id` | `uuid` | tidak | — | FK | `platform_user.id` (ON DELETE CASCADE) |
| 3 | `purpose` | `StepUpPurpose` | tidak | — | — | — |
| 4 | `challenge_hash` | `varchar(128)` | tidak | — | — | — |
| 5 | `reason` | `text` | ya | — | — | — |
| 6 | `target_type` | `varchar(64)` | ya | — | — | — |
| 7 | `target_id` | `varchar(64)` | ya | — | — | — |
| 8 | `issued_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 10 | `verified_at` | `timestamptz` | ya | — | — | — |
| 11 | `consumed_at` | `timestamptz` | ya | — | — | — |

### `platform.platform_support_session`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `schema_name_snapshot` | `varchar(64)` | tidak | — | — | — |
| 4 | `requested_by_id` | `uuid` | tidak | — | FK | `platform_user.id` (ON DELETE RESTRICT) |
| 5 | `reason` | `text` | tidak | — | — | — |
| 6 | `access_mode` | `SupportAccessMode` | tidak | `'READ_ONLY'::platform."SupportAccessMode"` | — | — |
| 7 | `step_up_verified_at` | `timestamptz` | ya | — | — | — |
| 8 | `started_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 10 | `ended_at` | `timestamptz` | ya | — | — | — |
| 11 | `read_count` | `int4` | tidak | `0` | — | — |
| 12 | `write_count` | `int4` | tidak | `0` | — | — |

### `platform.platform_tenant_action`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `action_code` | `varchar(48)` | tidak | — | — | — |
| 4 | `requested_by_id` | `uuid` | tidak | — | — | — |
| 5 | `reason` | `text` | ya | — | — | — |
| 6 | `parameters` | `jsonb` | ya | — | — | — |
| 7 | `status` | `varchar(24)` | tidak | `'PENDING'::character varying` | — | — |
| 8 | `result` | `jsonb` | ya | — | — | — |
| 9 | `error_message` | `text` | ya | — | — | — |
| 10 | `started_at` | `timestamptz` | ya | — | — | — |
| 11 | `finished_at` | `timestamptz` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.platform_user`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `username` | `varchar(64)` | tidak | — | — | — |
| 3 | `normalized_username` | `varchar(64)` | tidak | — | — | — |
| 4 | `email` | `varchar(255)` | ya | — | — | — |
| 5 | `normalized_email` | `varchar(255)` | ya | — | — | — |
| 6 | `phone` | `varchar(32)` | ya | — | — | — |
| 7 | `display_name` | `varchar(160)` | tidak | — | — | — |
| 8 | `password_hash` | `text` | tidak | — | — | — |
| 9 | `status` | `PlatformUserStatus` | tidak | `'ACTIVE'::platform."PlatformUserStatus"` | — | — |
| 10 | `must_change_password` | `bool` | tidak | `false` | — | — |
| 11 | `is_platform_staff` | `bool` | tidak | `false` | — | — |
| 12 | `preferred_locale_code` | `varchar(16)` | ya | — | FK | `locale.code` (ON DELETE SET NULL) |
| 13 | `last_login_at` | `timestamptz` | ya | — | — | — |
| 14 | `failed_login_count` | `int4` | tidak | `0` | — | — |
| 15 | `locked_until` | `timestamptz` | ya | — | — | — |
| 16 | `is_active` | `bool` | tidak | `true` | — | — |
| 17 | `is_system` | `bool` | tidak | `false` | — | — |
| 18 | `is_sample` | `bool` | tidak | `false` | — | — |
| 19 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 20 | `metadata` | `jsonb` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 24 | `updated_by` | `uuid` | ya | — | — | — |
| 25 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 26 | `deactivated_by` | `uuid` | ya | — | — | — |
| 27 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 28 | `deleted_by` | `uuid` | ya | — | — | — |
| 29 | `delete_reason` | `text` | ya | — | — | — |
| 30 | `version` | `int4` | tidak | `1` | — | — |

### `platform.platform_user_profile`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `platform_user_id` | `uuid` | tidak | — | FK | `platform_user.id` (ON DELETE CASCADE) |
| 3 | `full_name` | `varchar(160)` | ya | — | — | — |
| 4 | `avatar_url` | `text` | ya | — | — | — |
| 5 | `timezone` | `varchar(64)` | tidak | `'Asia/Jakarta'::character varying` | — | — |
| 6 | `date_format` | `varchar(32)` | tidak | `'dd/MM/yyyy'::character varying` | — | — |
| 7 | `number_format` | `varchar(32)` | tidak | `'id-ID'::character varying` | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

### `platform.platform_user_role`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `user_id` | `uuid` | tidak | — | FK | `platform_user.id` (ON DELETE CASCADE) |
| 3 | `role_id` | `uuid` | tidak | — | FK | `platform_role.id` (ON DELETE RESTRICT) |
| 4 | `valid_from` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 5 | `valid_until` | `timestamptz` | ya | — | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 7 | `created_by` | `uuid` | ya | — | — | — |

### `platform.pos_device`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `outlet_id` | `uuid` | ya | — | — | — |
| 4 | `outlet_code` | `varchar(64)` | ya | — | — | — |
| 5 | `code` | `varchar(48)` | tidak | — | — | — |
| 6 | `label` | `varchar(120)` | tidak | — | — | — |
| 7 | `fingerprint_hash` | `varchar(128)` | ya | — | — | — |
| 8 | `status` | `PosDeviceStatus` | tidak | `'REGISTERED'::platform."PosDeviceStatus"` | — | — |
| 9 | `is_billable` | `bool` | tidak | `true` | — | — |
| 10 | `trial_started_at` | `timestamptz` | ya | — | — | — |
| 11 | `trial_ends_at` | `timestamptz` | ya | — | — | — |
| 12 | `activated_at` | `timestamptz` | ya | — | — | — |
| 13 | `revoked_at` | `timestamptz` | ya | — | — | — |
| 14 | `replaced_by_device_id` | `uuid` | ya | — | — | — |
| 15 | `last_seen_at` | `timestamptz` | ya | — | — | — |
| 16 | `is_active` | `bool` | tidak | `true` | — | — |
| 17 | `is_system` | `bool` | tidak | `false` | — | — |
| 18 | `is_sample` | `bool` | tidak | `false` | — | — |
| 19 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 20 | `metadata` | `jsonb` | ya | — | — | — |
| 21 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 22 | `created_by` | `uuid` | ya | — | — | — |
| 23 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 24 | `updated_by` | `uuid` | ya | — | — | — |
| 25 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 26 | `deactivated_by` | `uuid` | ya | — | — | — |
| 27 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 28 | `deleted_by` | `uuid` | ya | — | — | — |
| 29 | `delete_reason` | `text` | ya | — | — | — |
| 30 | `version` | `int4` | tidak | `1` | — | — |

### `platform.pricing_adjustment`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `quote_id` | `uuid` | tidak | — | FK | `pricing_quote.id` (ON DELETE CASCADE) |
| 3 | `source_type` | `varchar(48)` | tidak | — | — | — |
| 4 | `source_id` | `uuid` | ya | — | — | — |
| 5 | `label` | `varchar(255)` | tidak | — | — | — |
| 6 | `label_key` | `varchar(160)` | ya | — | — | — |
| 7 | `amount` | `numeric(19,4)` | tidak | — | — | — |
| 8 | `rule_snapshot` | `jsonb` | tidak | — | — | — |
| 9 | `sequence` | `int4` | tidak | `0` | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.pricing_display_section`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `website_id` | `uuid` | tidak | — | FK | `website.id` (ON DELETE CASCADE) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `title_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `default_title` | `varchar(255)` | tidak | — | — | — |
| 6 | `description_key` | `varchar(160)` | ya | — | — | — |
| 7 | `default_description` | `text` | ya | — | — | — |
| 8 | `display_mode` | `varchar(24)` | tidak | `'CARDS'::character varying` | — | — |
| 9 | `footnote_key` | `varchar(160)` | ya | — | — | — |
| 10 | `default_footnote` | `text` | ya | — | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_sample` | `bool` | tidak | `false` | — | — |
| 14 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 17 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 18 | `version` | `int4` | tidak | `1` | — | — |

### `platform.pricing_quote`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `quote_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE RESTRICT) |
| 4 | `plan_version_id` | `uuid` | tidak | — | FK | `subscription_plan_version.id` (ON DELETE RESTRICT) |
| 5 | `payment_mode` | `SubscriptionPaymentMode` | tidak | `'CONSOLIDATED_ALL_DEVICES'::platform."Subscript…` | — | — |
| 6 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 7 | `billing_interval` | `BillingInterval` | tidak | `'MONTH'::platform."BillingInterval"` | — | — |
| 8 | `interval_count` | `int4` | tidak | `1` | — | — |
| 9 | `quantity` | `int4` | tidak | `1` | — | — |
| 10 | `subtotal` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `discount_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `tax_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 13 | `admin_fee_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 14 | `grand_total` | `numeric(19,4)` | tidak | `0` | — | — |
| 15 | `promo_code` | `varchar(48)` | ya | — | — | — |
| 16 | `status` | `QuoteStatus` | tidak | `'DRAFT'::platform."QuoteStatus"` | — | — |
| 17 | `calculation_trace` | `jsonb` | tidak | — | — | — |
| 18 | `input_snapshot` | `jsonb` | tidak | — | — | — |
| 19 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 20 | `accepted_at` | `timestamptz` | ya | — | — | — |
| 21 | `accepted_by` | `uuid` | ya | — | — | — |
| 22 | `idempotency_key` | `varchar(96)` | ya | — | — | — |
| 23 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 24 | `created_by` | `uuid` | ya | — | — | — |
| 25 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.pricing_quote_line`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `quote_id` | `uuid` | tidak | — | FK | `pricing_quote.id` (ON DELETE CASCADE) |
| 3 | `device_id` | `uuid` | ya | — | FK | `pos_device.id` (ON DELETE SET NULL) |
| 4 | `scope_type` | `AssignmentScope` | tidak | `'DEVICE'::platform."AssignmentScope"` | — | — |
| 5 | `scope_id` | `uuid` | ya | — | — | — |
| 6 | `description` | `varchar(255)` | tidak | — | — | — |
| 7 | `quantity` | `int4` | tidak | `1` | — | — |
| 8 | `base_price` | `numeric(19,4)` | tidak | — | — | — |
| 9 | `effective_unit_price` | `numeric(19,4)` | tidak | — | — | — |
| 10 | `discount_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 11 | `tax_amount` | `numeric(19,4)` | tidak | `0` | — | — |
| 12 | `line_total` | `numeric(19,4)` | tidak | — | — | — |
| 13 | `sort_order` | `int4` | tidak | `0` | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.promo_code`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `program_id` | `uuid` | tidak | — | FK | `discount_program.id` (ON DELETE CASCADE) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `max_redemptions` | `int4` | ya | — | — | — |
| 5 | `used_count` | `int4` | tidak | `0` | — | — |
| 6 | `per_tenant_limit` | `int4` | ya | — | — | — |
| 7 | `valid_from` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `valid_until` | `timestamptz` | ya | — | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 14 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 15 | `version` | `int4` | tidak | `1` | — | — |

### `platform.provider_rate_limit_state`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `provider_id` | `uuid` | tidak | — | FK | `payment_provider.id` (ON DELETE CASCADE) |
| 3 | `window_start` | `timestamptz` | tidak | — | — | — |
| 4 | `request_count` | `int4` | tidak | `0` | — | — |
| 5 | `throttled_until` | `timestamptz` | ya | — | — | — |
| 6 | `backoff_ms` | `int4` | tidak | `0` | — | — |
| 7 | `updated_at` | `timestamptz` | tidak | — | — | — |

### `platform.provisioning_job`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `registration_id` | `uuid` | ya | — | FK | `registration.id` (ON DELETE SET NULL) |
| 3 | `tenant_id` | `uuid` | ya | — | FK | `tenant.id` (ON DELETE SET NULL) |
| 4 | `schema_name` | `varchar(64)` | tidak | — | — | — |
| 5 | `status` | `ProvisioningStatus` | tidak | `'PENDING'::platform."ProvisioningStatus"` | — | — |
| 6 | `current_stage` | `ProvisioningStage` | tidak | `'REQUESTED'::platform."ProvisioningStage"` | — | — |
| 7 | `attempt` | `int4` | tidak | `1` | — | — |
| 8 | `max_attempts` | `int4` | tidak | `3` | — | — |
| 9 | `error_code` | `varchar(64)` | ya | — | — | — |
| 10 | `error_message` | `text` | ya | — | — | — |
| 11 | `retry_at` | `timestamptz` | ya | — | — | — |
| 12 | `started_at` | `timestamptz` | ya | — | — | — |
| 13 | `finished_at` | `timestamptz` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

### `platform.provisioning_step`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `job_id` | `uuid` | tidak | — | FK | `provisioning_job.id` (ON DELETE CASCADE) |
| 3 | `stage` | `ProvisioningStage` | tidak | — | — | — |
| 4 | `sequence` | `int4` | tidak | — | — | — |
| 5 | `status` | `ProvisioningStepStatus` | tidak | `'PENDING'::platform."ProvisioningStepStatus"` | — | — |
| 6 | `checksum` | `varchar(64)` | ya | — | — | — |
| 7 | `detail` | `jsonb` | ya | — | — | — |
| 8 | `error_message` | `text` | ya | — | — | — |
| 9 | `started_at` | `timestamptz` | ya | — | — | — |
| 10 | `finished_at` | `timestamptz` | ya | — | — | — |
| 11 | `duration_ms` | `int4` | ya | — | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform.redirect_rule`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `website_id` | `uuid` | tidak | — | FK | `website.id` (ON DELETE CASCADE) |
| 3 | `source_path` | `varchar(500)` | tidak | — | — | — |
| 4 | `target_url` | `varchar(500)` | tidak | — | — | — |
| 5 | `http_status` | `int4` | tidak | `301` | — | — |
| 6 | `valid_from` | `timestamptz` | ya | — | — | — |
| 7 | `valid_until` | `timestamptz` | ya | — | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

### `platform.registration`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `registration_code` | `varchar(32)` | tidak | — | — | — |
| 3 | `business_name` | `varchar(255)` | tidak | — | — | — |
| 4 | `business_type` | `varchar(255)` | ya | — | — | — |
| 5 | `country` | `varchar(100)` | tidak | `'Indonesia'::character varying` | — | — |
| 6 | `province` | `varchar(100)` | ya | — | — | — |
| 7 | `city_regency` | `varchar(100)` | ya | — | — | — |
| 8 | `district` | `varchar(100)` | ya | — | — | — |
| 9 | `address` | `varchar(255)` | ya | — | — | — |
| 10 | `contact_person` | `varchar(255)` | ya | — | — | — |
| 11 | `contact_phone` | `varchar(50)` | ya | — | — | — |
| 12 | `business_phone` | `varchar(50)` | ya | — | — | — |
| 13 | `email` | `varchar(255)` | tidak | — | — | — |
| 14 | `desired_username` | `varchar(64)` | tidak | — | — | — |
| 15 | `normalized_username` | `varchar(64)` | tidak | — | — | — |
| 16 | `generate_password` | `bool` | tidak | `true` | — | — |
| 17 | `status` | `RegistrationStatus` | tidak | `'DRAFT'::platform."RegistrationStatus"` | — | — |
| 18 | `source` | `varchar(48)` | tidak | `'PUBLIC_WEB'::character varying` | — | — |
| 19 | `locale_code` | `varchar(16)` | tidak | `'id'::character varying` | — | — |
| 20 | `terms_accepted_at` | `timestamptz` | ya | — | — | — |
| 21 | `privacy_accepted_at` | `timestamptz` | ya | — | — | — |
| 22 | `failure_code` | `varchar(64)` | ya | — | — | — |
| 23 | `failure_message` | `text` | ya | — | — | — |
| 24 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 25 | `user_agent` | `text` | ya | — | — | — |
| 26 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 27 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 28 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

### `platform.registration_credential_delivery`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `registration_id` | `uuid` | tidak | — | FK | `registration.id` (ON DELETE CASCADE) |
| 3 | `channel` | `varchar(48)` | tidak | `'API_RESPONSE'::character varying` | — | — |
| 4 | `delivered_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 5 | `acknowledged_at` | `timestamptz` | ya | — | — | — |
| 6 | `fingerprint` | `varchar(64)` | tidak | — | — | — |

### `platform.schema_migration_catalog`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `version` | `varchar(16)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `checksum` | `varchar(64)` | tidak | — | — | — |
| 5 | `script_path` | `varchar(255)` | tidak | — | — | — |
| 6 | `description` | `text` | ya | — | — | — |
| 7 | `sequence` | `int4` | tidak | — | — | — |
| 8 | `released_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 12 | `version_no` | `int4` | tidak | `1` | — | — |

### `platform.schema_name_reservation`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `normalized_name` | `varchar(64)` | tidak | — | — | — |
| 3 | `audit_name` | `varchar(72)` | tidak | — | — | — |
| 4 | `registration_id` | `uuid` | ya | — | FK | `registration.id` (ON DELETE SET NULL) |
| 5 | `reserved_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 6 | `expires_at` | `timestamptz` | tidak | — | — | — |
| 7 | `consumed_at` | `timestamptz` | ya | — | — | — |
| 8 | `released_at` | `timestamptz` | ya | — | — | — |

### `platform.seo_structured_data`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `page_id` | `uuid` | tidak | — | FK | `cms_page.id` (ON DELETE CASCADE) |
| 3 | `schema_type` | `varchar(64)` | tidak | — | — | — |
| 4 | `json_data` | `jsonb` | tidak | — | — | — |
| 5 | `is_active` | `bool` | tidak | `true` | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 7 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 8 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `subscription_number` | `varchar(48)` | tidak | — | — | — |
| 3 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE RESTRICT) |
| 4 | `plan_version_id` | `uuid` | tidak | — | FK | `subscription_plan_version.id` (ON DELETE RESTRICT) |
| 5 | `status` | `SubscriptionStatus` | tidak | `'DRAFT'::platform."SubscriptionStatus"` | — | — |
| 6 | `payment_mode` | `SubscriptionPaymentMode` | tidak | `'CONSOLIDATED_ALL_DEVICES'::platform."Subscript…` | — | — |
| 7 | `billing_interval` | `BillingInterval` | tidak | `'MONTH'::platform."BillingInterval"` | — | — |
| 8 | `interval_count` | `int4` | tidak | `1` | — | — |
| 9 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 10 | `starts_at` | `timestamptz` | tidak | — | — | — |
| 11 | `ends_at` | `timestamptz` | ya | — | — | — |
| 12 | `current_period_start` | `timestamptz` | ya | — | — | — |
| 13 | `current_period_end` | `timestamptz` | ya | — | — | — |
| 14 | `auto_renew` | `bool` | tidak | `true` | — | — |
| 15 | `cancelled_at` | `timestamptz` | ya | — | — | — |
| 16 | `cancel_reason` | `text` | ya | — | — | — |
| 17 | `is_active` | `bool` | tidak | `true` | — | — |
| 18 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 19 | `created_by` | `uuid` | ya | — | — | — |
| 20 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_add_on`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `description_key` | `varchar(160)` | ya | — | — | — |
| 6 | `status` | `CatalogStatus` | tidak | `'ACTIVE'::platform."CatalogStatus"` | — | — |
| 7 | `sort_order` | `int4` | tidak | `0` | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `is_system` | `bool` | tidak | `false` | — | — |
| 10 | `is_sample` | `bool` | tidak | `false` | — | — |
| 11 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 12 | `metadata` | `jsonb` | ya | — | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 14 | `created_by` | `uuid` | ya | — | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 16 | `updated_by` | `uuid` | ya | — | — | — |
| 17 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 18 | `deactivated_by` | `uuid` | ya | — | — | — |
| 19 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 20 | `deleted_by` | `uuid` | ya | — | — | — |
| 21 | `delete_reason` | `text` | ya | — | — | — |
| 22 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_add_on_module`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `add_on_version_id` | `uuid` | tidak | — | FK | `subscription_add_on_version.id` (ON DELETE CASCADE) |
| 3 | `module_id` | `uuid` | tidak | — | FK | `module_catalog.id` (ON DELETE RESTRICT) |
| 4 | `entitlement_scope` | `EntitlementScope` | tidak | `'TENANT_WIDE'::platform."EntitlementScope"` | — | — |
| 5 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 6 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 7 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_add_on_price`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `add_on_version_id` | `uuid` | tidak | — | FK | `subscription_add_on_version.id` (ON DELETE CASCADE) |
| 3 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 4 | `billing_metric` | `BillingMetric` | tidak | `'FLAT_TENANT'::platform."BillingMetric"` | — | — |
| 5 | `billing_interval` | `BillingInterval` | tidak | `'MONTH'::platform."BillingInterval"` | — | — |
| 6 | `interval_count` | `int4` | tidak | `1` | — | — |
| 7 | `unit_price` | `numeric(19,4)` | tidak | — | — | — |
| 8 | `effective_from` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `effective_until` | `timestamptz` | ya | — | — | — |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_add_on_version`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `add_on_id` | `uuid` | tidak | — | FK | `subscription_add_on.id` (ON DELETE CASCADE) |
| 3 | `version_number` | `int4` | tidak | — | — | — |
| 4 | `status` | `PlanVersionStatus` | tidak | `'DRAFT'::platform."PlanVersionStatus"` | — | — |
| 5 | `effective_from` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 6 | `effective_until` | `timestamptz` | ya | — | — | — |
| 7 | `published_at` | `timestamptz` | ya | — | — | — |
| 8 | `is_active` | `bool` | tidak | `true` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_change`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `subscription_id` | `uuid` | tidak | — | FK | `subscription.id` (ON DELETE CASCADE) |
| 3 | `change_type` | `varchar(48)` | tidak | — | — | — |
| 4 | `payload` | `jsonb` | tidak | — | — | — |
| 5 | `effective_at` | `timestamptz` | tidak | — | — | — |
| 6 | `reason` | `text` | ya | — | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `created_by` | `uuid` | ya | — | — | — |

### `platform.subscription_item`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `subscription_id` | `uuid` | tidak | — | FK | `subscription.id` (ON DELETE CASCADE) |
| 3 | `item_type` | `varchar(32)` | tidak | `'PACKAGE'::character varying` | — | — |
| 4 | `device_id` | `uuid` | ya | — | FK | `pos_device.id` (ON DELETE SET NULL) |
| 5 | `add_on_version_id` | `uuid` | ya | — | FK | `subscription_add_on_version.id` (ON DELETE SET NULL) |
| 6 | `quantity` | `int4` | tidak | `1` | — | — |
| 7 | `unit_price` | `numeric(19,4)` | tidak | — | — | — |
| 8 | `entitlement_scope` | `EntitlementScope` | tidak | `'DEVICE'::platform."EntitlementScope"` | — | — |
| 9 | `starts_at` | `timestamptz` | tidak | — | — | — |
| 10 | `ends_at` | `timestamptz` | ya | — | — | — |
| 11 | `status` | `varchar(24)` | tidak | `'ACTIVE'::character varying` | — | — |
| 12 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 14 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_plan`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `product_id` | `uuid` | tidak | — | FK | `subscription_product.id` (ON DELETE RESTRICT) |
| 3 | `code` | `varchar(48)` | tidak | — | — | — |
| 4 | `name` | `varchar(120)` | tidak | — | — | — |
| 5 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 6 | `description_key` | `varchar(160)` | ya | — | — | — |
| 7 | `market_segment` | `varchar(48)` | tidak | `'GENERAL'::character varying` | — | — |
| 8 | `status` | `PlanStatus` | tidak | `'DRAFT'::platform."PlanStatus"` | — | — |
| 9 | `is_public` | `bool` | tidak | `true` | — | — |
| 10 | `is_recommended` | `bool` | tidak | `false` | — | — |
| 11 | `sort_order` | `int4` | tidak | `0` | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `is_system` | `bool` | tidak | `false` | — | — |
| 14 | `is_sample` | `bool` | tidak | `false` | — | — |
| 15 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 16 | `metadata` | `jsonb` | ya | — | — | — |
| 17 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 18 | `created_by` | `uuid` | ya | — | — | — |
| 19 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 20 | `updated_by` | `uuid` | ya | — | — | — |
| 21 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 22 | `deactivated_by` | `uuid` | ya | — | — | — |
| 23 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 24 | `deleted_by` | `uuid` | ya | — | — | — |
| 25 | `delete_reason` | `text` | ya | — | — | — |
| 26 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_plan_constraint`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `plan_version_id` | `uuid` | tidak | — | FK | `subscription_plan_version.id` (ON DELETE CASCADE) |
| 3 | `constraint_type` | `PlanConstraintType` | tidak | — | — | — |
| 4 | `numeric_value` | `int4` | ya | — | — | — |
| 5 | `note` | `text` | ya | — | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 7 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 8 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_plan_feature`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `plan_version_id` | `uuid` | tidak | — | FK | `subscription_plan_version.id` (ON DELETE CASCADE) |
| 3 | `feature_id` | `uuid` | tidak | — | FK | `feature_catalog.id` (ON DELETE RESTRICT) |
| 4 | `included` | `bool` | tidak | `true` | — | — |
| 5 | `limit_value` | `int4` | ya | — | — | — |
| 6 | `unit` | `varchar(32)` | ya | — | — | — |
| 7 | `entitlement_scope` | `EntitlementScope` | tidak | `'TENANT_WIDE'::platform."EntitlementScope"` | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_plan_module`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `plan_version_id` | `uuid` | tidak | — | FK | `subscription_plan_version.id` (ON DELETE CASCADE) |
| 3 | `module_id` | `uuid` | tidak | — | FK | `module_catalog.id` (ON DELETE RESTRICT) |
| 4 | `entitlement_scope` | `EntitlementScope` | tidak | `'DEVICE'::platform."EntitlementScope"` | — | — |
| 5 | `included` | `bool` | tidak | `true` | — | — |
| 6 | `is_add_on_only` | `bool` | tidak | `false` | — | — |
| 7 | `usage_policy` | `varchar(48)` | ya | — | — | — |
| 8 | `sort_order` | `int4` | tidak | `0` | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_plan_price`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `plan_version_id` | `uuid` | tidak | — | FK | `subscription_plan_version.id` (ON DELETE CASCADE) |
| 3 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 4 | `billing_metric` | `BillingMetric` | tidak | `'PER_POS_DEVICE'::platform."BillingMetric"` | — | — |
| 5 | `billing_interval` | `BillingInterval` | tidak | `'MONTH'::platform."BillingInterval"` | — | — |
| 6 | `interval_count` | `int4` | tidak | `1` | — | — |
| 7 | `unit_price` | `numeric(19,4)` | tidak | — | — | — |
| 8 | `minimum_qty` | `int4` | tidak | `1` | — | — |
| 9 | `tax_inclusive` | `bool` | tidak | `false` | — | — |
| 10 | `effective_from` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `effective_until` | `timestamptz` | ya | — | — | — |
| 12 | `is_active` | `bool` | tidak | `true` | — | — |
| 13 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 14 | `created_by` | `uuid` | ya | — | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 16 | `updated_by` | `uuid` | ya | — | — | — |
| 17 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 18 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_plan_price_tier`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `price_id` | `uuid` | tidak | — | FK | `subscription_plan_price.id` (ON DELETE CASCADE) |
| 3 | `min_quantity` | `int4` | tidak | — | — | — |
| 4 | `max_quantity` | `int4` | ya | — | — | — |
| 5 | `unit_price` | `numeric(19,4)` | ya | — | — | — |
| 6 | `flat_amount` | `numeric(19,4)` | ya | — | — | — |
| 7 | `sort_order` | `int4` | tidak | `0` | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 10 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_plan_version`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `plan_id` | `uuid` | tidak | — | FK | `subscription_plan.id` (ON DELETE RESTRICT) |
| 3 | `version_number` | `int4` | tidak | — | — | — |
| 4 | `status` | `PlanVersionStatus` | tidak | `'DRAFT'::platform."PlanVersionStatus"` | — | — |
| 5 | `effective_from` | `timestamptz` | tidak | — | — | — |
| 6 | `effective_until` | `timestamptz` | ya | — | — | — |
| 7 | `future_module_policy` | `FutureModulePolicy` | tidak | `'SNAPSHOT_AT_VERSION'::platform."FutureModulePo…` | — | — |
| 8 | `tenant_wide_policy` | `TenantWidePolicy` | tidak | `'ANY_ACTIVE_ITEM'::platform."TenantWidePolicy"` | — | — |
| 9 | `trial_days` | `int4` | tidak | `30` | — | — |
| 10 | `grace_period_days` | `int4` | tidak | `7` | — | — |
| 11 | `change_note` | `text` | ya | — | — | — |
| 12 | `published_at` | `timestamptz` | ya | — | — | — |
| 13 | `published_by` | `uuid` | ya | — | — | — |
| 14 | `retired_at` | `timestamptz` | ya | — | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

### `platform.subscription_product`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `name_key` | `varchar(160)` | tidak | — | — | — |
| 5 | `product_type` | `varchar(32)` | tidak | `'LICENSE'::character varying` | — | — |
| 6 | `default_trial_days` | `int4` | tidak | `30` | — | — |
| 7 | `status` | `CatalogStatus` | tidak | `'ACTIVE'::platform."CatalogStatus"` | — | — |
| 8 | `sort_order` | `int4` | tidak | `0` | — | — |
| 9 | `is_active` | `bool` | tidak | `true` | — | — |
| 10 | `is_system` | `bool` | tidak | `true` | — | — |
| 11 | `is_sample` | `bool` | tidak | `false` | — | — |
| 12 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 13 | `metadata` | `jsonb` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 15 | `created_by` | `uuid` | ya | — | — | — |
| 16 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 17 | `updated_by` | `uuid` | ya | — | — | — |
| 18 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 19 | `deactivated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `deleted_by` | `uuid` | ya | — | — | — |
| 22 | `delete_reason` | `text` | ya | — | — | — |
| 23 | `version` | `int4` | tidak | `1` | — | — |

### `platform.tenant`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `registration_id` | `uuid` | ya | — | FK | `registration.id` (ON DELETE SET NULL) |
| 3 | `code` | `varchar(64)` | tidak | — | — | — |
| 4 | `name` | `varchar(255)` | tidak | — | — | — |
| 5 | `slug` | `varchar(64)` | tidak | — | — | — |
| 6 | `status` | `TenantStatus` | tidak | `'PENDING'::platform."TenantStatus"` | — | — |
| 7 | `is_demo` | `bool` | tidak | `false` | — | — |
| 8 | `locale_code` | `varchar(16)` | tidak | `'id'::character varying` | — | — |
| 9 | `timezone` | `varchar(64)` | tidak | `'Asia/Jakarta'::character varying` | — | — |
| 10 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 11 | `trial_ends_at` | `timestamptz` | ya | — | — | — |
| 12 | `activated_at` | `timestamptz` | ya | — | — | — |
| 13 | `suspended_at` | `timestamptz` | ya | — | — | — |
| 14 | `suspend_reason` | `text` | ya | — | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `is_system` | `bool` | tidak | `false` | — | — |
| 17 | `is_sample` | `bool` | tidak | `false` | — | — |
| 18 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 19 | `metadata` | `jsonb` | ya | — | — | — |
| 20 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 21 | `created_by` | `uuid` | ya | — | — | — |
| 22 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 23 | `updated_by` | `uuid` | ya | — | — | — |
| 24 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 25 | `deactivated_by` | `uuid` | ya | — | — | — |
| 26 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 27 | `deleted_by` | `uuid` | ya | — | — | — |
| 28 | `delete_reason` | `text` | ya | — | — | — |
| 29 | `version` | `int4` | tidak | `1` | — | — |

### `platform.tenant_membership`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `platform_user_id` | `uuid` | tidak | — | FK | `platform_user.id` (ON DELETE CASCADE) |
| 4 | `tenant_subject_id` | `uuid` | ya | — | — | — |
| 5 | `is_owner` | `bool` | tidak | `false` | — | — |
| 6 | `status` | `varchar(24)` | tidak | `'ACTIVE'::character varying` | — | — |
| 7 | `invited_at` | `timestamptz` | ya | — | — | — |
| 8 | `joined_at` | `timestamptz` | ya | — | — | — |
| 9 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 10 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 11 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 12 | `version` | `int4` | tidak | `1` | — | — |

### `platform.tenant_plan_contract`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `plan_version_id` | `uuid` | tidak | — | FK | `subscription_plan_version.id` (ON DELETE RESTRICT) |
| 4 | `contract_number` | `varchar(48)` | tidak | — | — | — |
| 5 | `package_mode` | `PackageMode` | tidak | `'UNIFORM_TENANT_PACKAGE'::platform."PackageMode"` | — | — |
| 6 | `starts_at` | `timestamptz` | tidak | — | — | — |
| 7 | `ends_at` | `timestamptz` | ya | — | — | — |
| 8 | `status` | `varchar(24)` | tidak | `'ACTIVE'::character varying` | — | — |
| 9 | `note` | `text` | ya | — | — | — |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `created_by` | `uuid` | ya | — | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 14 | `updated_by` | `uuid` | ya | — | — | — |
| 15 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 16 | `version` | `int4` | tidak | `1` | — | — |

### `platform.tenant_plan_feature_override`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `contract_id` | `uuid` | tidak | — | FK | `tenant_plan_contract.id` (ON DELETE CASCADE) |
| 3 | `feature_id` | `uuid` | tidak | — | FK | `feature_catalog.id` (ON DELETE RESTRICT) |
| 4 | `included` | `bool` | tidak | `true` | — | — |
| 5 | `limit_value` | `int4` | ya | — | — | — |
| 6 | `reason` | `text` | ya | — | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 9 | `version` | `int4` | tidak | `1` | — | — |

### `platform.tenant_plan_module_override`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `contract_id` | `uuid` | tidak | — | FK | `tenant_plan_contract.id` (ON DELETE CASCADE) |
| 3 | `module_id` | `uuid` | tidak | — | FK | `module_catalog.id` (ON DELETE RESTRICT) |
| 4 | `included` | `bool` | tidak | `true` | — | — |
| 5 | `entitlement_scope` | `EntitlementScope` | tidak | `'TENANT_WIDE'::platform."EntitlementScope"` | — | — |
| 6 | `reason` | `text` | ya | — | — | — |
| 7 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 9 | `version` | `int4` | tidak | `1` | — | — |

### `platform.tenant_price_override`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `plan_version_id` | `uuid` | ya | — | FK | `subscription_plan_version.id` (ON DELETE RESTRICT) |
| 4 | `override_type` | `PriceOverrideType` | tidak | `'REPLACE_BASE_PRICE'::platform."PriceOverrideTy…` | — | — |
| 5 | `currency_code` | `varchar(8)` | tidak | `'IDR'::character varying` | — | — |
| 6 | `amount` | `numeric(19,4)` | ya | — | — | — |
| 7 | `percent` | `numeric(9,4)` | ya | — | — | — |
| 8 | `structured_formula` | `jsonb` | ya | — | — | — |
| 9 | `priority` | `int4` | tidak | `100` | — | — |
| 10 | `effective_from` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `effective_until` | `timestamptz` | ya | — | — | — |
| 12 | `reason` | `text` | tidak | — | — | — |
| 13 | `approved_by_id` | `uuid` | ya | — | — | — |
| 14 | `approved_at` | `timestamptz` | ya | — | — | — |
| 15 | `is_active` | `bool` | tidak | `true` | — | — |
| 16 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 17 | `created_by` | `uuid` | ya | — | — | — |
| 18 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 19 | `updated_by` | `uuid` | ya | — | — | — |
| 20 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 21 | `version` | `int4` | tidak | `1` | — | — |

### `platform.tenant_schema_migration_history`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | ya | — | FK | `tenant.id` (ON DELETE SET NULL) |
| 3 | `schema_name` | `varchar(64)` | tidak | — | — | — |
| 4 | `migration_version` | `varchar(16)` | tidak | — | — | — |
| 5 | `catalog_id` | `uuid` | ya | — | FK | `schema_migration_catalog.id` (ON DELETE SET NULL) |
| 6 | `checksum` | `varchar(64)` | tidak | — | — | — |
| 7 | `applied_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 8 | `duration_ms` | `int4` | tidak | `0` | — | — |
| 9 | `status` | `varchar(24)` | tidak | `'SUCCEEDED'::character varying` | — | — |
| 10 | `error_message` | `text` | ya | — | — | — |

### `platform.tenant_schema_registry`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `username` | `varchar(64)` | tidak | — | — | — |
| 4 | `schema_name` | `varchar(64)` | tidak | — | — | — |
| 5 | `audit_schema_name` | `varchar(72)` | tidak | — | — | — |
| 6 | `schema_version` | `varchar(16)` | tidak | `'V000'::character varying` | — | — |
| 7 | `status` | `TenantSchemaStatus` | tidak | `'RESERVED'::platform."TenantSchemaStatus"` | — | — |
| 8 | `provisioned_at` | `timestamptz` | ya | — | — | — |
| 9 | `last_migrated_at` | `timestamptz` | ya | — | — | — |
| 10 | `last_verified_at` | `timestamptz` | ya | — | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `version` | `int4` | tidak | `1` | — | — |

### `platform.tenant_translation_override`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `tenant_id` | `uuid` | tidak | — | FK | `tenant.id` (ON DELETE CASCADE) |
| 3 | `key_id` | `uuid` | tidak | — | FK | `translation_key.id` (ON DELETE CASCADE) |
| 4 | `locale_code` | `varchar(16)` | tidak | — | FK | `locale.code` (ON DELETE RESTRICT) |
| 5 | `value` | `text` | tidak | — | — | — |
| 6 | `effective_from` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 7 | `effective_until` | `timestamptz` | ya | — | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 10 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

### `platform.testimonial`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `person_name` | `varchar(160)` | tidak | — | — | — |
| 4 | `organization` | `varchar(160)` | ya | — | — | — |
| 5 | `role_title` | `varchar(160)` | ya | — | — | — |
| 6 | `quote_key` | `varchar(160)` | tidak | — | — | — |
| 7 | `default_quote` | `text` | tidak | — | — | — |
| 8 | `avatar_asset_id` | `uuid` | ya | — | FK | `media_asset.id` (ON DELETE SET NULL) |
| 9 | `rating` | `int4` | tidak | `5` | — | — |
| 10 | `sort_order` | `int4` | tidak | `0` | — | — |
| 11 | `is_active` | `bool` | tidak | `true` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 15 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 16 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 17 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 18 | `delete_reason` | `text` | ya | — | — | — |
| 19 | `version` | `int4` | tidak | `1` | — | — |

### `platform.translation_import_run`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `direction` | `varchar(16)` | tidak | — | — | — |
| 3 | `locale_code` | `varchar(16)` | ya | — | — | — |
| 4 | `file_name` | `varchar(255)` | ya | — | — | — |
| 5 | `total_keys` | `int4` | tidak | `0` | — | — |
| 6 | `created_keys` | `int4` | tidak | `0` | — | — |
| 7 | `updated_keys` | `int4` | tidak | `0` | — | — |
| 8 | `skipped_keys` | `int4` | tidak | `0` | — | — |
| 9 | `status` | `varchar(24)` | tidak | `'RUNNING'::character varying` | — | — |
| 10 | `error_message` | `text` | ya | — | — | — |
| 11 | `executed_by_id` | `uuid` | ya | — | — | — |
| 12 | `started_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 13 | `finished_at` | `timestamptz` | ya | — | — | — |

### `platform.translation_key`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `namespace_id` | `uuid` | tidak | — | FK | `translation_namespace.id` (ON DELETE RESTRICT) |
| 3 | `key` | `varchar(255)` | tidak | — | — | — |
| 4 | `default_text` | `text` | tidak | — | — | — |
| 5 | `description` | `text` | ya | — | — | — |
| 6 | `is_active` | `bool` | tidak | `true` | — | — |
| 7 | `is_system` | `bool` | tidak | `false` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 11 | `created_by` | `uuid` | ya | — | — | — |
| 12 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 13 | `updated_by` | `uuid` | ya | — | — | — |
| 14 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 15 | `deleted_by` | `uuid` | ya | — | — | — |
| 16 | `delete_reason` | `text` | ya | — | — | — |
| 17 | `version` | `int4` | tidak | `1` | — | — |

### `platform.translation_namespace`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(120)` | tidak | — | — | — |
| 4 | `description` | `text` | ya | — | — | — |
| 5 | `sort_order` | `int4` | tidak | `0` | — | — |
| 6 | `is_active` | `bool` | tidak | `true` | — | — |
| 7 | `is_system` | `bool` | tidak | `true` | — | — |
| 8 | `is_sample` | `bool` | tidak | `false` | — | — |
| 9 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 10 | `metadata` | `jsonb` | ya | — | — | — |
| 11 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 12 | `created_by` | `uuid` | ya | — | — | — |
| 13 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 14 | `updated_by` | `uuid` | ya | — | — | — |
| 15 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 16 | `deactivated_by` | `uuid` | ya | — | — | — |
| 17 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 18 | `deleted_by` | `uuid` | ya | — | — | — |
| 19 | `delete_reason` | `text` | ya | — | — | — |
| 20 | `version` | `int4` | tidak | `1` | — | — |

### `platform.translation_value`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `key_id` | `uuid` | tidak | — | FK | `translation_key.id` (ON DELETE CASCADE) |
| 3 | `locale_code` | `varchar(16)` | tidak | — | FK | `locale.code` (ON DELETE RESTRICT) |
| 4 | `value` | `text` | tidak | — | — | — |
| 5 | `review_status` | `TranslationReviewStatus` | tidak | `'DRAFT'::platform."TranslationReviewStatus"` | — | — |
| 6 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 7 | `created_by` | `uuid` | ya | — | — | — |
| 8 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 9 | `updated_by` | `uuid` | ya | — | — | — |
| 10 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

### `platform.website`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `code` | `varchar(48)` | tidak | — | — | — |
| 3 | `name` | `varchar(160)` | tidak | — | — | — |
| 4 | `primary_domain` | `varchar(255)` | tidak | — | — | — |
| 5 | `default_locale_code` | `varchar(16)` | tidak | `'id'::character varying` | — | — |
| 6 | `theme_code` | `varchar(48)` | tidak | `'default'::character varying` | — | — |
| 7 | `logo_asset_id` | `uuid` | ya | — | — | — |
| 8 | `favicon_asset_id` | `uuid` | ya | — | — | — |
| 9 | `sort_order` | `int4` | tidak | `0` | — | — |
| 10 | `is_active` | `bool` | tidak | `true` | — | — |
| 11 | `is_system` | `bool` | tidak | `true` | — | — |
| 12 | `is_sample` | `bool` | tidak | `false` | — | — |
| 13 | `sample_batch_id` | `uuid` | ya | — | — | — |
| 14 | `metadata` | `jsonb` | ya | — | — | — |
| 15 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 16 | `created_by` | `uuid` | ya | — | — | — |
| 17 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 18 | `updated_by` | `uuid` | ya | — | — | — |
| 19 | `deactivated_at` | `timestamptz` | ya | — | — | — |
| 20 | `deactivated_by` | `uuid` | ya | — | — | — |
| 21 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 22 | `deleted_by` | `uuid` | ya | — | — | — |
| 23 | `delete_reason` | `text` | ya | — | — | — |
| 24 | `version` | `int4` | tidak | `1` | — | — |

### `platform.website_domain`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `website_id` | `uuid` | tidak | — | FK | `website.id` (ON DELETE CASCADE) |
| 3 | `domain` | `varchar(255)` | tidak | — | — | — |
| 4 | `is_primary` | `bool` | tidak | `false` | — | — |
| 5 | `ssl_required` | `bool` | tidak | `true` | — | — |
| 6 | `redirect_to_primary` | `bool` | tidak | `false` | — | — |
| 7 | `is_active` | `bool` | tidak | `true` | — | — |
| 8 | `created_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 9 | `updated_at` | `timestamptz` | tidak | — | — | — |
| 10 | `deleted_at` | `timestamptz` | ya | — | — | — |
| 11 | `version` | `int4` | tidak | `1` | — | — |

## Schema `platform__audit`

### `platform__audit.audit_event`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 3 | `tenant_id` | `uuid` | ya | — | — | — |
| 4 | `tenant_schema` | `varchar(64)` | ya | — | — | — |
| 5 | `request_id` | `varchar(64)` | ya | — | — | — |
| 6 | `correlation_id` | `varchar(64)` | ya | — | — | — |
| 7 | `actor_user_id` | `uuid` | ya | — | — | — |
| 8 | `actor_username` | `varchar(64)` | ya | — | — | — |
| 9 | `actor_role_codes` | `jsonb` | ya | — | — | — |
| 10 | `session_id` | `uuid` | ya | — | — | — |
| 11 | `support_session_id` | `uuid` | ya | — | — | — |
| 12 | `device_id` | `uuid` | ya | — | — | — |
| 13 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 14 | `user_agent` | `text` | ya | — | — | — |
| 15 | `module_code` | `varchar(48)` | tidak | — | — | — |
| 16 | `action_code` | `varchar(48)` | tidak | — | — | — |
| 17 | `entity_type` | `varchar(96)` | ya | — | — | — |
| 18 | `entity_id` | `varchar(96)` | ya | — | — | — |
| 19 | `document_number` | `varchar(96)` | ya | — | — | — |
| 20 | `result` | `AuditResult` | tidak | `'SUCCESS'::platform__audit."AuditResult"` | — | — |
| 21 | `reason` | `text` | ya | — | — | — |
| 22 | `metadata` | `jsonb` | ya | — | — | — |

### `platform__audit.audit_export_event`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 3 | `actor_user_id` | `uuid` | ya | — | — | — |
| 4 | `tenant_id` | `uuid` | ya | — | — | — |
| 5 | `resource_code` | `varchar(64)` | tidak | — | — | — |
| 6 | `filter_snapshot` | `jsonb` | ya | — | — | — |
| 7 | `row_count` | `int4` | tidak | `0` | — | — |
| 8 | `format` | `varchar(16)` | tidak | `'CSV'::character varying` | — | — |
| 9 | `request_id` | `varchar(64)` | ya | — | — | — |

### `platform__audit.audit_permission_change`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 3 | `actor_user_id` | `uuid` | ya | — | — | — |
| 4 | `target_type` | `varchar(48)` | tidak | — | — | — |
| 5 | `target_id` | `varchar(96)` | tidak | — | — | — |
| 6 | `tenant_id` | `uuid` | ya | — | — | — |
| 7 | `before_snapshot` | `jsonb` | ya | — | — | — |
| 8 | `after_snapshot` | `jsonb` | ya | — | — | — |
| 9 | `reason` | `text` | ya | — | — | — |
| 10 | `request_id` | `varchar(64)` | ya | — | — | — |

### `platform__audit.audit_row_change`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `audit_event_id` | `uuid` | tidak | — | FK | `audit_event.id` (ON DELETE RESTRICT) |
| 3 | `table_schema` | `varchar(64)` | tidak | — | — | — |
| 4 | `table_name` | `varchar(96)` | tidak | — | — | — |
| 5 | `row_pk` | `jsonb` | tidak | — | — | — |
| 6 | `operation` | `AuditOperation` | tidak | — | — | — |
| 7 | `old_data` | `jsonb` | ya | — | — | — |
| 8 | `new_data` | `jsonb` | ya | — | — | — |
| 9 | `changed_columns` | `jsonb` | ya | — | — | — |
| 10 | `transaction_id` | `int8` | ya | — | — | — |
| 11 | `statement_timestamp` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |

### `platform__audit.audit_schema_migration`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 3 | `schema_name` | `varchar(64)` | tidak | — | — | — |
| 4 | `migration_version` | `varchar(16)` | tidak | — | — | — |
| 5 | `checksum` | `varchar(64)` | tidak | — | — | — |
| 6 | `status` | `varchar(24)` | tidak | — | — | — |
| 7 | `duration_ms` | `int4` | tidak | `0` | — | — |
| 8 | `actor_user_id` | `uuid` | ya | — | — | — |
| 9 | `error_message` | `text` | ya | — | — | — |

### `platform__audit.audit_security_event`

| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `uuid` | tidak | — | PK | — |
| 2 | `occurred_at` | `timestamptz` | tidak | `CURRENT_TIMESTAMP` | — | — |
| 3 | `event_code` | `varchar(64)` | tidak | — | — | — |
| 4 | `severity` | `varchar(16)` | tidak | `'INFO'::character varying` | — | — |
| 5 | `actor_user_id` | `uuid` | ya | — | — | — |
| 6 | `actor_username` | `varchar(64)` | ya | — | — | — |
| 7 | `ip_address` | `varchar(64)` | ya | — | — | — |
| 8 | `user_agent` | `text` | ya | — | — | — |
| 9 | `request_id` | `varchar(64)` | ya | — | — | — |
| 10 | `result` | `AuditResult` | tidak | `'FAILURE'::platform__audit."AuditResult"` | — | — |
| 11 | `detail` | `jsonb` | ya | — | — | — |
