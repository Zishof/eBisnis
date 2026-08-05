import { HardDeletePolicy } from '../master-seed/master-seed.types';

/**
 * Registry resource master tenant untuk CRUD generik + lifecycle.
 *
 * Generic CRUD HANYA untuk master sederhana. Posting stok, penerimaan,
 * backorder, transfer, sale, journal, payroll, dan produksi TIDAK memakai
 * engine ini — masing-masing memiliki service dokumen tersendiri.
 */
export interface MasterResourceDefinition {
  resourceCode: string;
  label: string;
  table: string;
  menuCode: string;
  /** Field yang boleh dicari — whitelist. */
  searchableFields: string[];
  /** Field yang boleh dipakai sorting — whitelist. */
  sortableFields: string[];
  /** Field yang boleh ditulis melalui create/update — whitelist. */
  writableFields: string[];
  /** Field yang dikembalikan pada list. */
  selectFields: string[];
  /** Relasi FK yang divalidasi ada sebelum ditulis: field -> tabel referensi. */
  foreignKeys?: Record<string, string>;
  /** Tabel yang mereferensikan resource ini, dipakai reference check sebelum purge. */
  references: Array<{ table: string; column: string; isTransactional: boolean; label: string }>;
  hardDeletePolicy: HardDeletePolicy;
  supportsPurge: boolean;
  defaultSort: string;
}

const LIFECYCLE_SELECT = [
  'id',
  'code',
  'name',
  'description',
  'is_active',
  'is_system',
  'is_sample',
  'sample_batch_id',
  'sort_order',
  'created_at',
  'updated_at',
  'deactivated_at',
  'deleted_at',
  'delete_reason',
  'version',
];

function define(
  partial: Omit<MasterResourceDefinition, 'selectFields' | 'defaultSort'> &
    Partial<Pick<MasterResourceDefinition, 'selectFields' | 'defaultSort'>>,
): MasterResourceDefinition {
  return {
    ...partial,
    selectFields: partial.selectFields ?? [...LIFECYCLE_SELECT, ...partial.writableFields].filter(
      (field, index, all) => all.indexOf(field) === index,
    ),
    defaultSort: partial.defaultSort ?? 'sort_order',
  };
}

export const MASTER_RESOURCES: MasterResourceDefinition[] = [
  define({
    resourceCode: 'uoms',
    label: 'Satuan (UOM)',
    table: 'uom',
    menuCode: 'CATALOG_UOM',
    searchableFields: ['code', 'name', 'symbol'],
    sortableFields: ['code', 'name', 'sort_order', 'created_at', 'updated_at'],
    writableFields: ['code', 'name', 'description', 'symbol', 'dimension', 'precision', 'allow_fraction', 'sort_order'],
    references: [
      { table: 'product', column: 'base_uom_id', isTransactional: false, label: 'Produk' },
      { table: 'stock_movement', column: 'uom_id', isTransactional: true, label: 'Mutasi stok' },
      { table: 'purchase_order_line', column: 'uom_id', isTransactional: true, label: 'Baris PO' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'product-categories',
    label: 'Kategori Produk',
    table: 'product_category',
    menuCode: 'CATALOG_CATEGORY',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order', 'created_at'],
    writableFields: ['code', 'name', 'description', 'parent_id', 'sort_order'],
    foreignKeys: { parent_id: 'product_category' },
    references: [{ table: 'product', column: 'category_id', isTransactional: false, label: 'Produk' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'product-brands',
    label: 'Merek Produk',
    table: 'product_brand',
    menuCode: 'CATALOG_PRODUCT',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'sort_order'],
    references: [{ table: 'product', column: 'product_brand_id', isTransactional: false, label: 'Produk' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'products',
    label: 'Produk',
    table: 'product',
    menuCode: 'CATALOG_PRODUCT',
    searchableFields: ['code', 'name', 'sku', 'barcode'],
    sortableFields: ['code', 'name', 'sku', 'sort_order', 'created_at', 'updated_at'],
    writableFields: [
      'code', 'name', 'description', 'sku', 'barcode', 'gtin', 'category_id', 'product_brand_id',
      'base_uom_id', 'tax_category_id', 'product_type', 'tracking_type', 'shelf_life_days',
      'allow_negative_stock', 'standard_cost', 'default_sale_price', 'is_purchasable', 'is_sellable', 'sort_order',
    ],
    foreignKeys: {
      category_id: 'product_category',
      product_brand_id: 'product_brand',
      base_uom_id: 'uom',
      tax_category_id: 'tax_category',
    },
    references: [
      { table: 'stock_movement', column: 'product_id', isTransactional: true, label: 'Mutasi stok' },
      { table: 'purchase_order_line', column: 'product_id', isTransactional: true, label: 'Baris PO' },
      { table: 'request_order_line', column: 'product_id', isTransactional: true, label: 'Baris Request Order' },
      { table: 'pos_sale_line', column: 'product_id', isTransactional: true, label: 'Baris penjualan POS' },
      { table: 'stock_policy', column: 'product_id', isTransactional: false, label: 'Kebijakan stok' },
      { table: 'product_supplier', column: 'product_id', isTransactional: false, label: 'Produk pemasok' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
    defaultSort: 'name',
  }),
  define({
    resourceCode: 'suppliers',
    label: 'Pemasok',
    table: 'supplier',
    menuCode: 'PURCHASING_SUPPLIER',
    searchableFields: ['code', 'name', 'supplier_number', 'tax_number', 'email'],
    sortableFields: ['code', 'name', 'rating', 'created_at', 'updated_at'],
    writableFields: [
      'code', 'name', 'description', 'supplier_number', 'supplier_group_id', 'payment_term_id',
      'tax_number', 'contact_person', 'phone', 'email', 'currency_code', 'lead_time_days',
      'rating', 'is_blacklisted', 'blacklist_reason', 'legacy_payment_days', 'address_text',
      'region_name', 'bank_account_number', 'bank_account_name', 'bank_name', 'bank_address',
      'sort_order',
    ],
    foreignKeys: { supplier_group_id: 'supplier_group', payment_term_id: 'payment_term' },
    references: [
      { table: 'purchase_order', column: 'supplier_id', isTransactional: true, label: 'Purchase Order' },
      { table: 'goods_receipt', column: 'supplier_id', isTransactional: true, label: 'Penerimaan barang' },
      { table: 'product_supplier', column: 'supplier_id', isTransactional: false, label: 'Produk pemasok' },
    ],
    hardDeletePolicy: 'PURGE_SAMPLE_ONLY',
    supportsPurge: true,
    defaultSort: 'name',
  }),
  define({
    resourceCode: 'customers',
    label: 'Pelanggan',
    table: 'customer',
    menuCode: 'CRM_CUSTOMER',
    searchableFields: ['code', 'name', 'customer_number', 'email', 'phone'],
    sortableFields: ['code', 'name', 'created_at'],
    writableFields: [
      'code', 'name', 'description', 'customer_number', 'customer_group_id', 'payment_term_id',
      'customer_type', 'tax_number', 'phone', 'email', 'credit_limit', 'legacy_payment_days',
      'address_text', 'region_name', 'default_discount_percent', 'bank_account_number',
      'bank_account_name', 'bank_name', 'bank_address', 'sort_order',
    ],
    foreignKeys: { customer_group_id: 'customer_group', payment_term_id: 'payment_term' },
    references: [
      { table: 'pos_sale', column: 'customer_id', isTransactional: true, label: 'Penjualan POS' },
      { table: 'sales_order', column: 'customer_id', isTransactional: true, label: 'Pesanan penjualan' },
    ],
    hardDeletePolicy: 'PURGE_SAMPLE_ONLY',
    supportsPurge: true,
    defaultSort: 'name',
  }),
  define({
    resourceCode: 'salespeople',
    label: 'Sales',
    table: 'inventory_salesperson_profile',
    menuCode: 'SALES',
    searchableFields: ['code', 'name', 'account_number', 'territory', 'phone', 'email'],
    sortableFields: ['code', 'name', 'territory', 'monthly_target', 'created_at', 'updated_at'],
    writableFields: [
      'code', 'name', 'description', 'user_subject_id', 'account_number', 'territory',
      'monthly_target', 'phone', 'email', 'sort_order',
    ],
    foreignKeys: { user_subject_id: 'user_subject' },
    references: [],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
    defaultSort: 'name',
  }),
  define({
    resourceCode: 'supplier-groups',
    label: 'Grup Pemasok',
    table: 'supplier_group',
    menuCode: 'MASTER_SUPPLIER_GROUP',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'payment_term_id', 'sort_order'],
    foreignKeys: { payment_term_id: 'payment_term' },
    references: [{ table: 'supplier', column: 'supplier_group_id', isTransactional: false, label: 'Pemasok' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'customer-groups',
    label: 'Grup Pelanggan',
    table: 'customer_group',
    menuCode: 'CRM_GROUP',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'sort_order'],
    references: [{ table: 'customer', column: 'customer_group_id', isTransactional: false, label: 'Pelanggan' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'warehouses',
    label: 'Gudang',
    table: 'warehouse',
    menuCode: 'INVENTORY_WAREHOUSE',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'level', 'sort_order'],
    writableFields: [
      'code', 'name', 'description', 'legal_entity_id', 'outlet_id', 'region_id',
      'parent_warehouse_id', 'warehouse_type_id', 'address_id', 'is_parent', 'sort_order',
    ],
    foreignKeys: {
      legal_entity_id: 'legal_entity',
      outlet_id: 'outlet',
      region_id: 'region',
      parent_warehouse_id: 'warehouse',
      warehouse_type_id: 'warehouse_type',
    },
    references: [
      { table: 'stock_movement', column: 'source_warehouse_id', isTransactional: true, label: 'Mutasi stok' },
      { table: 'stock_balance', column: 'warehouse_id', isTransactional: true, label: 'Saldo stok' },
      { table: 'stock_policy', column: 'warehouse_id', isTransactional: false, label: 'Kebijakan stok' },
      { table: 'purchase_order', column: 'warehouse_id', isTransactional: true, label: 'Purchase Order' },
      { table: 'request_order', column: 'requesting_warehouse_id', isTransactional: true, label: 'Request Order' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'warehouse-types',
    label: 'Jenis Gudang',
    table: 'warehouse_type',
    menuCode: 'MASTER_WAREHOUSE_TYPE',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'name_key', 'allows_sale', 'allows_production', 'is_transit', 'sort_order'],
    references: [{ table: 'warehouse', column: 'warehouse_type_id', isTransactional: false, label: 'Gudang' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'outlets',
    label: 'Outlet',
    table: 'outlet',
    menuCode: 'MASTER_OUTLET',
    searchableFields: ['code', 'name', 'phone', 'email'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: [
      'code', 'name', 'description', 'legal_entity_id', 'brand_id', 'region_id',
      'outlet_type_id', 'address_id', 'phone', 'email', 'timezone', 'opening_date', 'sort_order',
    ],
    foreignKeys: {
      legal_entity_id: 'legal_entity',
      brand_id: 'brand',
      region_id: 'region',
      outlet_type_id: 'outlet_type',
      address_id: 'address',
    },
    references: [
      { table: 'warehouse', column: 'outlet_id', isTransactional: false, label: 'Gudang' },
      { table: 'pos_sale', column: 'outlet_id', isTransactional: true, label: 'Penjualan POS' },
      { table: 'pos_terminal', column: 'outlet_id', isTransactional: false, label: 'Terminal POS' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'outlet-types',
    label: 'Jenis Outlet',
    table: 'outlet_type',
    menuCode: 'MASTER_OUTLET_TYPE',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'name_key', 'category', 'sort_order'],
    references: [{ table: 'outlet', column: 'outlet_type_id', isTransactional: false, label: 'Outlet' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'regions',
    label: 'Wilayah',
    table: 'region',
    menuCode: 'MASTER_REGION',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'level', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'parent_id', 'region_type', 'sort_order'],
    foreignKeys: { parent_id: 'region' },
    references: [
      { table: 'outlet', column: 'region_id', isTransactional: false, label: 'Outlet' },
      { table: 'warehouse', column: 'region_id', isTransactional: false, label: 'Gudang' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'stock-policies',
    label: 'Kebijakan Minimum Stok',
    table: 'stock_policy',
    menuCode: 'INVENTORY_STOCK_POLICY',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'minimum_stock', 'reorder_point', 'updated_at'],
    writableFields: [
      'code', 'name', 'description', 'warehouse_id', 'product_id', 'uom_id',
      'minimum_stock', 'maximum_stock', 'reorder_point', 'safety_stock',
      'lead_time_days', 'recommended_order_qty', 'auto_request_enabled', 'sort_order',
    ],
    foreignKeys: { warehouse_id: 'warehouse', product_id: 'product', uom_id: 'uom' },
    references: [
      { table: 'stock_alert', column: 'stock_policy_id', isTransactional: false, label: 'Notifikasi stok' },
      { table: 'request_order', column: 'generated_by_policy_id', isTransactional: true, label: 'Request Order' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
    defaultSort: 'code',
  }),
  define({
    resourceCode: 'payment-methods',
    label: 'Metode Pembayaran',
    table: 'payment_method',
    menuCode: 'MASTER_PAYMENT_METHOD',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'name_key', 'method_type', 'requires_reference', 'allows_change', 'sort_order'],
    references: [{ table: 'pos_payment', column: 'payment_method_id', isTransactional: true, label: 'Pembayaran POS' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'payment-terms',
    label: 'Termin Pembayaran',
    table: 'payment_term',
    menuCode: 'MASTER_PAYMENT_TERM',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'due_days', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'due_days', 'discount_days', 'discount_percent', 'sort_order'],
    references: [
      { table: 'supplier', column: 'payment_term_id', isTransactional: false, label: 'Pemasok' },
      { table: 'customer', column: 'payment_term_id', isTransactional: false, label: 'Pelanggan' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'tax-categories',
    label: 'Kategori Pajak',
    table: 'tax_category',
    menuCode: 'CATALOG_TAX',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'tax_type', 'sort_order'],
    references: [{ table: 'product', column: 'tax_category_id', isTransactional: false, label: 'Produk' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'departments',
    label: 'Departemen',
    table: 'department',
    menuCode: 'HR_DEPARTMENT',
    searchableFields: ['code', 'name', 'cost_center'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'legal_entity_id', 'parent_id', 'cost_center', 'sort_order'],
    foreignKeys: { legal_entity_id: 'legal_entity', parent_id: 'department' },
    references: [
      { table: 'job_position', column: 'department_id', isTransactional: false, label: 'Jabatan' },
      { table: 'employee', column: 'department_id', isTransactional: false, label: 'Pegawai' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'job-positions',
    label: 'Jabatan',
    table: 'job_position',
    menuCode: 'HR_POSITION',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'grade_level', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'legal_entity_id', 'department_id', 'grade_level', 'sort_order'],
    foreignKeys: { legal_entity_id: 'legal_entity', department_id: 'department' },
    references: [{ table: 'employee', column: 'job_position_id', isTransactional: false, label: 'Pegawai' }],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'leave-types',
    label: 'Jenis Cuti',
    table: 'leave_type',
    menuCode: 'HR_LEAVE_TYPE',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'name_key', 'default_quota_days', 'is_paid', 'requires_attachment', 'sort_order'],
    references: [],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'vehicle-types',
    label: 'Jenis Kendaraan',
    table: 'vehicle_type',
    menuCode: 'MASTER_VEHICLE_TYPE',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'name_key', 'default_capacity_kg', 'default_capacity_m3', 'sort_order'],
    references: [],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
  }),
  define({
    resourceCode: 'product-suppliers',
    label: 'Produk Pemasok',
    table: 'product_supplier',
    menuCode: 'PURCHASING_PRODUCT_SUPPLIER',
    searchableFields: ['code', 'supplier_sku'],
    sortableFields: ['code', 'priority', 'last_price'],
    writableFields: [
      'code', 'name', 'description', 'product_id', 'supplier_id', 'purchase_uom_id',
      'supplier_sku', 'lead_time_days', 'minimum_order_qty', 'last_price', 'currency_code',
      'is_preferred', 'priority',
    ],
    foreignKeys: { product_id: 'product', supplier_id: 'supplier', purchase_uom_id: 'uom' },
    references: [],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
    defaultSort: 'code',
  }),
  define({
    resourceCode: 'roles',
    label: 'Role',
    table: 'role',
    menuCode: 'ADMIN_ROLE',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'sort_order'],
    writableFields: ['code', 'name', 'description', 'role_type', 'sort_order'],
    references: [
      { table: 'user_role_assignment', column: 'role_id', isTransactional: false, label: 'Penugasan role' },
      { table: 'role_menu_permission', column: 'role_id', isTransactional: false, label: 'Permission role' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: false,
  }),
  define({
    resourceCode: 'chart-of-accounts',
    label: 'Bagan Akun',
    table: 'chart_of_account',
    menuCode: 'FINANCE_COA',
    searchableFields: ['code', 'name'],
    sortableFields: ['code', 'name', 'level', 'sort_order'],
    writableFields: [
      'code', 'name', 'description', 'legal_entity_id', 'parent_id', 'account_type_id',
      'normal_balance', 'allow_posting', 'sort_order',
    ],
    foreignKeys: { legal_entity_id: 'legal_entity', parent_id: 'chart_of_account', account_type_id: 'account_type' },
    references: [
      { table: 'journal_entry_line', column: 'account_id', isTransactional: true, label: 'Baris jurnal' },
    ],
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    supportsPurge: true,
    defaultSort: 'code',
  }),
];

export function findMasterResource(resourceCode: string): MasterResourceDefinition | undefined {
  return MASTER_RESOURCES.find((resource) => resource.resourceCode === resourceCode);
}

/**
 * Pola path-to-regexp untuk parameter `:resource`.
 *
 * Route master bersifat generik (`/uoms`, `/products`, …). Tanpa pembatasan,
 * pola `:resource` akan menelan route spesifik seperti `/devices` dan
 * `/sample-data/verify`. Pola ini memastikan hanya resource terdaftar yang
 * dicocokkan sehingga tidak ada route lain yang tertutup.
 */
export const MASTER_RESOURCE_PATTERN = MASTER_RESOURCES.map((r) => r.resourceCode).join('|');
