# Matriks Referensi Hapus Permanen

> Berkas ini dihasilkan otomatis oleh `pnpm docs:generate` dari hasil introspeksi
> PostgreSQL. Jangan diedit manual — perubahan akan hilang pada generate berikutnya.

- Dihasilkan: `2026-07-30T10:47:45.433Z`
- Schema control plane: `platform`, `platform__audit`
- Schema tenant contoh: `demo`, `demo__audit`

Sebelum purge dijalankan, engine lifecycle memeriksa seluruh tabel yang mereferensikan record. Bila salah satu referensi berasal dari tabel transaksi, purge selalu ditolak dan pengguna diarahkan memakai hapus sementara.

## `uoms` — Satuan (UOM)

- Tabel: `uom`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `product` | `base_uom_id` | master | ya |
| `stock_movement` | `uom_id` | **transaksi** | ya |
| `purchase_order_line` | `uom_id` | **transaksi** | ya |

## `product-categories` — Kategori Produk

- Tabel: `product_category`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `product` | `category_id` | master | ya |

## `product-brands` — Merek Produk

- Tabel: `product_brand`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `product` | `product_brand_id` | master | ya |

## `products` — Produk

- Tabel: `product`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `stock_movement` | `product_id` | **transaksi** | ya |
| `purchase_order_line` | `product_id` | **transaksi** | ya |
| `request_order_line` | `product_id` | **transaksi** | ya |
| `pos_sale_line` | `product_id` | **transaksi** | ya |
| `stock_policy` | `product_id` | master | ya |
| `product_supplier` | `product_id` | master | ya |

## `suppliers` — Pemasok

- Tabel: `supplier`
- Kebijakan: `PURGE_SAMPLE_ONLY`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `purchase_order` | `supplier_id` | **transaksi** | ya |
| `goods_receipt` | `supplier_id` | **transaksi** | ya |
| `product_supplier` | `supplier_id` | master | ya |

## `customers` — Pelanggan

- Tabel: `customer`
- Kebijakan: `PURGE_SAMPLE_ONLY`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `pos_sale` | `customer_id` | **transaksi** | ya |
| `sales_order` | `customer_id` | **transaksi** | ya |

## `supplier-groups` — Grup Pemasok

- Tabel: `supplier_group`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `supplier` | `supplier_group_id` | master | ya |

## `customer-groups` — Grup Pelanggan

- Tabel: `customer_group`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `customer` | `customer_group_id` | master | ya |

## `warehouses` — Gudang

- Tabel: `warehouse`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `stock_movement` | `source_warehouse_id` | **transaksi** | ya |
| `stock_balance` | `warehouse_id` | **transaksi** | ya |
| `stock_policy` | `warehouse_id` | master | ya |
| `purchase_order` | `warehouse_id` | **transaksi** | ya |
| `request_order` | `requesting_warehouse_id` | **transaksi** | ya |

## `warehouse-types` — Jenis Gudang

- Tabel: `warehouse_type`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `warehouse` | `warehouse_type_id` | master | ya |

## `outlets` — Outlet

- Tabel: `outlet`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `warehouse` | `outlet_id` | master | ya |
| `pos_sale` | `outlet_id` | **transaksi** | ya |
| `pos_terminal` | `outlet_id` | master | ya |

## `outlet-types` — Jenis Outlet

- Tabel: `outlet_type`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `outlet` | `outlet_type_id` | master | ya |

## `regions` — Wilayah

- Tabel: `region`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `outlet` | `region_id` | master | ya |
| `warehouse` | `region_id` | master | ya |

## `stock-policies` — Kebijakan Minimum Stok

- Tabel: `stock_policy`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `stock_alert` | `stock_policy_id` | master | ya |
| `request_order` | `generated_by_policy_id` | **transaksi** | ya |

## `payment-methods` — Metode Pembayaran

- Tabel: `payment_method`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `pos_payment` | `payment_method_id` | **transaksi** | ya |

## `payment-terms` — Termin Pembayaran

- Tabel: `payment_term`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `supplier` | `payment_term_id` | master | ya |
| `customer` | `payment_term_id` | master | ya |

## `tax-categories` — Kategori Pajak

- Tabel: `tax_category`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `product` | `tax_category_id` | master | ya |

## `departments` — Departemen

- Tabel: `department`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `job_position` | `department_id` | master | ya |
| `employee` | `department_id` | master | ya |

## `job-positions` — Jabatan

- Tabel: `job_position`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `employee` | `job_position_id` | master | ya |

## `leave-types` — Jenis Cuti

- Tabel: `leave_type`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

Tidak ada tabel yang mereferensikan resource ini.

## `vehicle-types` — Jenis Kendaraan

- Tabel: `vehicle_type`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

Tidak ada tabel yang mereferensikan resource ini.

## `product-suppliers` — Produk Pemasok

- Tabel: `product_supplier`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

Tidak ada tabel yang mereferensikan resource ini.

## `roles` — Role

- Tabel: `role`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: tidak

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `user_role_assignment` | `role_id` | master | ya |
| `role_menu_permission` | `role_id` | master | ya |

## `chart-of-accounts` — Bagan Akun

- Tabel: `chart_of_account`
- Kebijakan: `PURGE_IF_UNREFERENCED`
- Purge diizinkan: ya, bila tidak ada referensi

| Tabel perujuk | Kolom | Jenis | Terpasang di database |
| --- | --- | --- | --- |
| `journal_entry_line` | `account_id` | **transaksi** | ya |

## Validasi registry terhadap database

Seluruh referensi yang terdaftar pada registry benar-benar ada sebagai kolom di schema tenant.

