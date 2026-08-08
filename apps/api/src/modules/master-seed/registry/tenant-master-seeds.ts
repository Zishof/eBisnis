import { defineMasterSeed, MasterSeedDefinition, MasterSeedRecord } from '../master-seed.types';

/**
 * Katalog seed master schema tenant.
 * Setiap master relevan memiliki minimal 10 record contoh.
 */

export const TENANT_MASTER_SEEDS: MasterSeedDefinition[] = [
  defineMasterSeed({
    resourceCode: 'OUTLET_TYPE',
    label: 'Jenis Outlet',
    table: 'outlet_type',
    scope: 'tenant',
    order: 10,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'outlet', column: 'outlet_type_id', isTransactional: false }],
    records: [
      { code: 'STORE', name: 'Toko', name_key: 'master.outletType.store', category: 'RETAIL', sort_order: 1 },
      { code: 'OUTLET', name: 'Outlet', name_key: 'master.outletType.outlet', category: 'RETAIL', sort_order: 2 },
      { code: 'CAFE', name: 'Kafe', name_key: 'master.outletType.cafe', category: 'FNB', sort_order: 3 },
      { code: 'RESTAURANT', name: 'Restoran', name_key: 'master.outletType.restaurant', category: 'FNB', sort_order: 4 },
      { code: 'KIOSK', name: 'Kios', name_key: 'master.outletType.kiosk', category: 'RETAIL', sort_order: 5 },
      { code: 'CANTEEN', name: 'Kantin', name_key: 'master.outletType.canteen', category: 'FNB', sort_order: 6 },
      { code: 'OFFICE', name: 'Kantor', name_key: 'master.outletType.office', category: 'SUPPORT', sort_order: 7 },
      { code: 'FACTORY', name: 'Pabrik', name_key: 'master.outletType.factory', category: 'PRODUCTION', sort_order: 8 },
      { code: 'CENTRAL_KITCHEN', name: 'Dapur Pusat', name_key: 'master.outletType.centralKitchen', category: 'PRODUCTION', sort_order: 9 },
      { code: 'OTHER', name: 'Lainnya', name_key: 'master.outletType.other', category: 'OTHER', sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'WAREHOUSE_TYPE',
    label: 'Jenis Gudang',
    table: 'warehouse_type',
    scope: 'tenant',
    order: 11,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'warehouse', column: 'warehouse_type_id', isTransactional: false }],
    records: [
      { code: 'CENTRAL', name: 'Gudang Pusat', name_key: 'master.warehouseType.central', allows_sale: false, sort_order: 1 },
      { code: 'OUTLET', name: 'Gudang Outlet', name_key: 'master.warehouseType.outlet', allows_sale: true, sort_order: 2 },
      { code: 'TRANSIT', name: 'Gudang Transit', name_key: 'master.warehouseType.transit', allows_sale: false, is_transit: true, sort_order: 3 },
      { code: 'RAW_MATERIAL', name: 'Gudang Bahan Baku', name_key: 'master.warehouseType.rawMaterial', allows_sale: false, allows_production: true, sort_order: 4 },
      { code: 'FINISHED_GOODS', name: 'Gudang Barang Jadi', name_key: 'master.warehouseType.finishedGoods', allows_sale: true, sort_order: 5 },
      { code: 'QUARANTINE', name: 'Gudang Karantina', name_key: 'master.warehouseType.quarantine', allows_sale: false, sort_order: 6 },
      { code: 'DAMAGED', name: 'Gudang Barang Rusak', name_key: 'master.warehouseType.damaged', allows_sale: false, sort_order: 7 },
      { code: 'CONSIGNMENT', name: 'Gudang Konsinyasi', name_key: 'master.warehouseType.consignment', allows_sale: true, sort_order: 8 },
      { code: 'PRODUCTION', name: 'Gudang Produksi', name_key: 'master.warehouseType.production', allows_sale: false, allows_production: true, sort_order: 9 },
      { code: 'OTHER', name: 'Gudang Lainnya', name_key: 'master.warehouseType.other', allows_sale: false, sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'UOM',
    label: 'Satuan (UOM)',
    table: 'uom',
    scope: 'tenant',
    order: 12,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [
      { table: 'product', column: 'base_uom_id', isTransactional: false },
      { table: 'stock_movement', column: 'uom_id', isTransactional: true },
      { table: 'purchase_order_line', column: 'uom_id', isTransactional: true },
    ],
    records: [
      { code: 'PCS', name: 'Pieces', symbol: 'pcs', dimension: 'UNIT', precision: 0, sort_order: 1 },
      { code: 'BOX', name: 'Box', symbol: 'box', dimension: 'UNIT', precision: 0, sort_order: 2 },
      { code: 'PACK', name: 'Pack', symbol: 'pack', dimension: 'UNIT', precision: 0, sort_order: 3 },
      { code: 'KG', name: 'Kilogram', symbol: 'kg', dimension: 'WEIGHT', precision: 3, allow_fraction: true, sort_order: 4 },
      { code: 'GRAM', name: 'Gram', symbol: 'g', dimension: 'WEIGHT', precision: 0, sort_order: 5 },
      { code: 'LITRE', name: 'Liter', symbol: 'L', dimension: 'VOLUME', precision: 3, allow_fraction: true, sort_order: 6 },
      { code: 'ML', name: 'Mililiter', symbol: 'ml', dimension: 'VOLUME', precision: 0, sort_order: 7 },
      { code: 'METER', name: 'Meter', symbol: 'm', dimension: 'LENGTH', precision: 2, allow_fraction: true, sort_order: 8 },
      { code: 'SET', name: 'Set', symbol: 'set', dimension: 'UNIT', precision: 0, sort_order: 9 },
      { code: 'SERVICE', name: 'Jasa', symbol: 'jasa', dimension: 'SERVICE', precision: 0, sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'TAX_CATEGORY',
    label: 'Kategori Pajak',
    table: 'tax_category',
    scope: 'tenant',
    order: 13,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'product', column: 'tax_category_id', isTransactional: false }],
    records: [
      { code: 'PPN_11', name: 'PPN 11%', tax_type: 'VAT', sort_order: 1 },
      { code: 'PPN_12', name: 'PPN 12%', tax_type: 'VAT', sort_order: 2 },
      { code: 'PPN_0', name: 'PPN 0%', tax_type: 'VAT', sort_order: 3 },
      { code: 'NON_PPN', name: 'Non-PPN', tax_type: 'NONE', sort_order: 4 },
      { code: 'PPN_DTP', name: 'PPN Ditanggung Pemerintah', tax_type: 'VAT', sort_order: 5 },
      { code: 'PB1_10', name: 'Pajak Restoran (PB1) 10%', tax_type: 'REGIONAL', sort_order: 6 },
      { code: 'PPH_22', name: 'PPh Pasal 22', tax_type: 'INCOME', sort_order: 7 },
      { code: 'PPH_23', name: 'PPh Pasal 23', tax_type: 'INCOME', sort_order: 8 },
      { code: 'PPN_EKSPOR', name: 'PPN Ekspor', tax_type: 'VAT', sort_order: 9 },
      { code: 'BEBAS_PAJAK', name: 'Bebas Pajak', tax_type: 'NONE', sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'PAYMENT_TERM',
    label: 'Termin Pembayaran',
    table: 'payment_term',
    scope: 'tenant',
    order: 14,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [
      { table: 'supplier', column: 'payment_term_id', isTransactional: false },
      { table: 'customer', column: 'payment_term_id', isTransactional: false },
    ],
    records: [
      { code: 'CASH', name: 'Tunai', due_days: 0, sort_order: 1 },
      { code: 'NET_7', name: 'Net 7 Hari', due_days: 7, sort_order: 2 },
      { code: 'NET_14', name: 'Net 14 Hari', due_days: 14, sort_order: 3 },
      { code: 'NET_21', name: 'Net 21 Hari', due_days: 21, sort_order: 4 },
      { code: 'NET_30', name: 'Net 30 Hari', due_days: 30, sort_order: 5 },
      { code: 'NET_45', name: 'Net 45 Hari', due_days: 45, sort_order: 6 },
      { code: 'NET_60', name: 'Net 60 Hari', due_days: 60, sort_order: 7 },
      { code: 'NET_90', name: 'Net 90 Hari', due_days: 90, sort_order: 8 },
      { code: 'COD', name: 'Bayar di Tempat', due_days: 0, sort_order: 9 },
      { code: 'DP_50', name: 'Uang Muka 50%', due_days: 30, sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'PAYMENT_METHOD',
    label: 'Metode Pembayaran',
    table: 'payment_method',
    scope: 'tenant',
    order: 15,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'pos_payment', column: 'payment_method_id', isTransactional: true }],
    records: [
      { code: 'CASH', name: 'Tunai', name_key: 'master.paymentMethod.cash', method_type: 'CASH', allows_change: true, sort_order: 1 },
      { code: 'BANK_TRANSFER', name: 'Transfer Bank', name_key: 'master.paymentMethod.bankTransfer', method_type: 'TRANSFER', requires_reference: true, sort_order: 2 },
      { code: 'DEBIT_CARD', name: 'Kartu Debit', name_key: 'master.paymentMethod.debitCard', method_type: 'CARD', requires_reference: true, sort_order: 3 },
      { code: 'CREDIT_CARD', name: 'Kartu Kredit', name_key: 'master.paymentMethod.creditCard', method_type: 'CARD', requires_reference: true, sort_order: 4 },
      { code: 'QRIS', name: 'QRIS', name_key: 'master.paymentMethod.qris', method_type: 'QR', requires_reference: true, sort_order: 5 },
      { code: 'VIRTUAL_ACCOUNT', name: 'Virtual Account', name_key: 'master.paymentMethod.virtualAccount', method_type: 'VA', requires_reference: true, sort_order: 6 },
      { code: 'EWALLET', name: 'Dompet Digital', name_key: 'master.paymentMethod.ewallet', method_type: 'EWALLET', requires_reference: true, sort_order: 7 },
      { code: 'DEPOSIT', name: 'Deposit Pelanggan', name_key: 'master.paymentMethod.deposit', method_type: 'DEPOSIT', sort_order: 8 },
      { code: 'CREDIT', name: 'Kredit / Piutang', name_key: 'master.paymentMethod.credit', method_type: 'CREDIT', sort_order: 9 },
      { code: 'OTHER', name: 'Lainnya', name_key: 'master.paymentMethod.other', method_type: 'OTHER', sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'PRODUCT_CATEGORY',
    label: 'Kategori Produk',
    table: 'product_category',
    scope: 'tenant',
    order: 16,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    seedKind: 'EXAMPLE',
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'product', column: 'category_id', isTransactional: false }],
    records: [
      { code: 'FOOD', name: 'Makanan', path: '/FOOD', level: 0, sort_order: 1 },
      { code: 'BEVERAGE', name: 'Minuman', path: '/BEVERAGE', level: 0, sort_order: 2 },
      { code: 'RAW_MATERIAL', name: 'Bahan Baku', path: '/RAW_MATERIAL', level: 0, sort_order: 3 },
      { code: 'PACKAGING', name: 'Kemasan', path: '/PACKAGING', level: 0, sort_order: 4 },
      { code: 'FINISHED_GOODS', name: 'Barang Jadi', path: '/FINISHED_GOODS', level: 0, sort_order: 5 },
      { code: 'SERVICE', name: 'Jasa', path: '/SERVICE', level: 0, sort_order: 6 },
      { code: 'MERCHANDISE', name: 'Merchandise', path: '/MERCHANDISE', level: 0, sort_order: 7 },
      { code: 'SPARE_PART', name: 'Suku Cadang', path: '/SPARE_PART', level: 0, sort_order: 8 },
      { code: 'OFFICE_SUPPLY', name: 'Perlengkapan Kantor', path: '/OFFICE_SUPPLY', level: 0, sort_order: 9 },
      { code: 'OTHER_CATEGORY', name: 'Kategori Lainnya', path: '/OTHER_CATEGORY', level: 0, sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'PRODUCT_BRAND',
    label: 'Merek Produk',
    table: 'product_brand',
    scope: 'tenant',
    order: 17,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    seedKind: 'EXAMPLE',
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'product', column: 'product_brand_id', isTransactional: false }],
    records: Array.from({ length: 10 }, (_, i) => ({
      code: `BRAND-${String(i + 1).padStart(2, '0')}`,
      name: `Merek Contoh ${i + 1}`,
      sort_order: i + 1,
    })),
  }),

  defineMasterSeed({
    resourceCode: 'DEPARTMENT',
    label: 'Departemen',
    table: 'department',
    scope: 'tenant',
    order: 18,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [
      { table: 'job_position', column: 'department_id', isTransactional: false },
      { table: 'employee', column: 'department_id', isTransactional: false },
    ],
    records: [
      { code: 'MANAGEMENT', name: 'Manajemen', cost_center: 'CC-MGT', sort_order: 1 },
      { code: 'FINANCE', name: 'Keuangan', cost_center: 'CC-FIN', sort_order: 2 },
      { code: 'ACCOUNTING', name: 'Akuntansi', cost_center: 'CC-ACC', sort_order: 3 },
      { code: 'SALES', name: 'Penjualan', cost_center: 'CC-SLS', sort_order: 4 },
      { code: 'PURCHASING', name: 'Pembelian', cost_center: 'CC-PUR', sort_order: 5 },
      { code: 'WAREHOUSE', name: 'Gudang', cost_center: 'CC-WHS', sort_order: 6 },
      { code: 'PRODUCTION', name: 'Produksi', cost_center: 'CC-PRD', sort_order: 7 },
      { code: 'QUALITY', name: 'Kualitas', cost_center: 'CC-QLT', sort_order: 8 },
      { code: 'HR', name: 'Sumber Daya Manusia', cost_center: 'CC-HRD', sort_order: 9 },
      { code: 'IT', name: 'Teknologi Informasi', cost_center: 'CC-ITD', sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'JOB_POSITION',
    label: 'Jabatan',
    table: 'job_position',
    scope: 'tenant',
    order: 19,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'employee', column: 'job_position_id', isTransactional: false }],
    records: async (ctx) => {
      const dept = async (code: string) => ctx.lookupId('department', code);
      return [
        { code: 'DIRECTOR', name: 'Direktur', grade_level: 9, department_id: await dept('MANAGEMENT'), sort_order: 1 },
        { code: 'MANAGER', name: 'Manajer', grade_level: 7, department_id: await dept('MANAGEMENT'), sort_order: 2 },
        { code: 'SUPERVISOR', name: 'Supervisor', grade_level: 5, department_id: await dept('MANAGEMENT'), sort_order: 3 },
        { code: 'STAFF', name: 'Staf', grade_level: 3, department_id: await dept('MANAGEMENT'), sort_order: 4 },
        { code: 'CASHIER', name: 'Kasir', grade_level: 2, department_id: await dept('SALES'), sort_order: 5 },
        { code: 'WAREHOUSE_STAFF', name: 'Staf Gudang', grade_level: 2, department_id: await dept('WAREHOUSE'), sort_order: 6 },
        { code: 'BUYER', name: 'Pembelian', grade_level: 4, department_id: await dept('PURCHASING'), sort_order: 7 },
        { code: 'ACCOUNTANT', name: 'Akuntan', grade_level: 4, department_id: await dept('ACCOUNTING'), sort_order: 8 },
        { code: 'HR_STAFF', name: 'Staf SDM', grade_level: 3, department_id: await dept('HR'), sort_order: 9 },
        { code: 'SYSTEM_ADMIN', name: 'Administrator Sistem', grade_level: 5, department_id: await dept('IT'), sort_order: 10 },
      ];
    },
  }),

  defineMasterSeed({
    resourceCode: 'LEAVE_TYPE',
    label: 'Jenis Cuti',
    table: 'leave_type',
    scope: 'tenant',
    order: 20,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    records: [
      { code: 'ANNUAL', name: 'Cuti Tahunan', name_key: 'master.leaveType.annual', default_quota_days: 12, sort_order: 1 },
      { code: 'SICK', name: 'Cuti Sakit', name_key: 'master.leaveType.sick', default_quota_days: 14, requires_attachment: true, sort_order: 2 },
      { code: 'MATERNITY', name: 'Cuti Melahirkan', name_key: 'master.leaveType.maternity', default_quota_days: 90, requires_attachment: true, sort_order: 3 },
      { code: 'PATERNITY', name: 'Cuti Ayah', name_key: 'master.leaveType.paternity', default_quota_days: 2, sort_order: 4 },
      { code: 'MARRIAGE', name: 'Cuti Menikah', name_key: 'master.leaveType.marriage', default_quota_days: 3, sort_order: 5 },
      { code: 'BEREAVEMENT', name: 'Cuti Duka', name_key: 'master.leaveType.bereavement', default_quota_days: 2, sort_order: 6 },
      { code: 'UNPAID', name: 'Cuti Tanpa Gaji', name_key: 'master.leaveType.unpaid', default_quota_days: 0, is_paid: false, sort_order: 7 },
      { code: 'STUDY', name: 'Cuti Studi', name_key: 'master.leaveType.study', default_quota_days: 0, is_paid: false, sort_order: 8 },
      { code: 'RELIGIOUS', name: 'Cuti Keagamaan', name_key: 'master.leaveType.religious', default_quota_days: 40, sort_order: 9 },
      { code: 'OTHER_LEAVE', name: 'Cuti Lainnya', name_key: 'master.leaveType.other', default_quota_days: 0, sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'VEHICLE_TYPE',
    label: 'Jenis Kendaraan',
    table: 'vehicle_type',
    scope: 'tenant',
    order: 21,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    records: [
      { code: 'MOTORCYCLE', name: 'Sepeda Motor', name_key: 'master.vehicleType.motorcycle', default_capacity_kg: 50, sort_order: 1 },
      { code: 'CAR', name: 'Mobil', name_key: 'master.vehicleType.car', default_capacity_kg: 300, sort_order: 2 },
      { code: 'VAN', name: 'Van', name_key: 'master.vehicleType.van', default_capacity_kg: 800, sort_order: 3 },
      { code: 'PICKUP', name: 'Pikap', name_key: 'master.vehicleType.pickup', default_capacity_kg: 1000, sort_order: 4 },
      { code: 'LIGHT_TRUCK', name: 'Truk Ringan', name_key: 'master.vehicleType.lightTruck', default_capacity_kg: 2000, sort_order: 5 },
      { code: 'MEDIUM_TRUCK', name: 'Truk Sedang', name_key: 'master.vehicleType.mediumTruck', default_capacity_kg: 5000, sort_order: 6 },
      { code: 'HEAVY_TRUCK', name: 'Truk Besar', name_key: 'master.vehicleType.heavyTruck', default_capacity_kg: 12000, sort_order: 7 },
      { code: 'REEFER_TRUCK', name: 'Truk Berpendingin', name_key: 'master.vehicleType.reeferTruck', default_capacity_kg: 4000, sort_order: 8 },
      { code: 'FORKLIFT', name: 'Forklift', name_key: 'master.vehicleType.forklift', default_capacity_kg: 2500, sort_order: 9 },
      { code: 'OTHER_VEHICLE', name: 'Kendaraan Lainnya', name_key: 'master.vehicleType.other', default_capacity_kg: 0, sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'ACCOUNT_TYPE',
    label: 'Tipe Akun',
    table: 'account_type',
    scope: 'tenant',
    order: 22,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'chart_of_account', column: 'account_type_id', isTransactional: false }],
    records: [
      { code: 'CURRENT_ASSET', name: 'Aset Lancar', normal_balance: 'DEBIT', category: 'ASSET', sort_order: 1 },
      { code: 'FIXED_ASSET', name: 'Aset Tetap', normal_balance: 'DEBIT', category: 'ASSET', sort_order: 2 },
      { code: 'OTHER_ASSET', name: 'Aset Lainnya', normal_balance: 'DEBIT', category: 'ASSET', sort_order: 3 },
      { code: 'CURRENT_LIABILITY', name: 'Kewajiban Lancar', normal_balance: 'CREDIT', category: 'LIABILITY', sort_order: 4 },
      { code: 'LONG_TERM_LIABILITY', name: 'Kewajiban Jangka Panjang', normal_balance: 'CREDIT', category: 'LIABILITY', sort_order: 5 },
      { code: 'EQUITY', name: 'Ekuitas', normal_balance: 'CREDIT', category: 'EQUITY', sort_order: 6 },
      { code: 'REVENUE', name: 'Pendapatan', normal_balance: 'CREDIT', category: 'REVENUE', sort_order: 7 },
      { code: 'COGS', name: 'Harga Pokok Penjualan', normal_balance: 'DEBIT', category: 'EXPENSE', sort_order: 8 },
      { code: 'OPERATING_EXPENSE', name: 'Beban Operasional', normal_balance: 'DEBIT', category: 'EXPENSE', sort_order: 9 },
      { code: 'OTHER_INCOME_EXPENSE', name: 'Pendapatan/Beban Lain', normal_balance: 'CREDIT', category: 'OTHER', sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'CHART_OF_ACCOUNT',
    label: 'Bagan Akun',
    table: 'chart_of_account',
    scope: 'tenant',
    order: 23,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'journal_entry_line', column: 'account_id', isTransactional: true }],
    records: async (ctx) => {
      const t = (code: string) => ctx.lookupId('account_type', code);
      return [
        { code: '1-1100', name: 'Kas', normal_balance: 'DEBIT', account_type_id: await t('CURRENT_ASSET'), path: '/1-1100', sort_order: 1 },
        { code: '1-1200', name: 'Bank', normal_balance: 'DEBIT', account_type_id: await t('CURRENT_ASSET'), path: '/1-1200', sort_order: 2 },
        { code: '1-1300', name: 'Piutang Usaha', normal_balance: 'DEBIT', account_type_id: await t('CURRENT_ASSET'), path: '/1-1300', sort_order: 3 },
        { code: '1-1400', name: 'Persediaan Barang', normal_balance: 'DEBIT', account_type_id: await t('CURRENT_ASSET'), path: '/1-1400', sort_order: 4 },
        { code: '1-2100', name: 'Peralatan', normal_balance: 'DEBIT', account_type_id: await t('FIXED_ASSET'), path: '/1-2100', sort_order: 5 },
        { code: '2-1100', name: 'Utang Usaha', normal_balance: 'CREDIT', account_type_id: await t('CURRENT_LIABILITY'), path: '/2-1100', sort_order: 6 },
        { code: '2-1200', name: 'Utang Pajak', normal_balance: 'CREDIT', account_type_id: await t('CURRENT_LIABILITY'), path: '/2-1200', sort_order: 7 },
        { code: '3-1100', name: 'Modal Disetor', normal_balance: 'CREDIT', account_type_id: await t('EQUITY'), path: '/3-1100', sort_order: 8 },
        { code: '4-1100', name: 'Pendapatan Penjualan', normal_balance: 'CREDIT', account_type_id: await t('REVENUE'), path: '/4-1100', sort_order: 9 },
        { code: '5-1100', name: 'Harga Pokok Penjualan', normal_balance: 'DEBIT', account_type_id: await t('COGS'), path: '/5-1100', sort_order: 10 },
        { code: '6-1100', name: 'Beban Gaji', normal_balance: 'DEBIT', account_type_id: await t('OPERATING_EXPENSE'), path: '/6-1100', sort_order: 11 },
        { code: '6-1200', name: 'Beban Sewa', normal_balance: 'DEBIT', account_type_id: await t('OPERATING_EXPENSE'), path: '/6-1200', sort_order: 12 },
        { code: '6-1300', name: 'Beban Kas dan Selisih', normal_balance: 'DEBIT', account_type_id: await t('OPERATING_EXPENSE'), path: '/6-1300', sort_order: 13 },
      ];
    },
  }),

  defineMasterSeed({
    resourceCode: 'SUPPLIER_GROUP',
    label: 'Grup Pemasok',
    table: 'supplier_group',
    scope: 'tenant',
    order: 24,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    seedKind: 'EXAMPLE',
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'supplier', column: 'supplier_group_id', isTransactional: false }],
    records: [
      { code: 'SG-FOOD', name: 'Pemasok Makanan', sort_order: 1 },
      { code: 'SG-BEVERAGE', name: 'Pemasok Minuman', sort_order: 2 },
      { code: 'SG-RAW', name: 'Pemasok Bahan Baku', sort_order: 3 },
      { code: 'SG-PACKAGING', name: 'Pemasok Kemasan', sort_order: 4 },
      { code: 'SG-EQUIPMENT', name: 'Pemasok Peralatan', sort_order: 5 },
      { code: 'SG-SERVICE', name: 'Penyedia Jasa', sort_order: 6 },
      { code: 'SG-LOGISTIC', name: 'Penyedia Logistik', sort_order: 7 },
      { code: 'SG-OFFICE', name: 'Pemasok Kantor', sort_order: 8 },
      { code: 'SG-IMPORT', name: 'Pemasok Impor', sort_order: 9 },
      { code: 'SG-OTHER', name: 'Pemasok Lainnya', sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'CUSTOMER_GROUP',
    label: 'Grup Pelanggan',
    table: 'customer_group',
    scope: 'tenant',
    order: 25,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    seedKind: 'EXAMPLE',
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [{ table: 'customer', column: 'customer_group_id', isTransactional: false }],
    records: [
      { code: 'CG-RETAIL', name: 'Pelanggan Ritel', sort_order: 1 },
      { code: 'CG-WHOLESALE', name: 'Pelanggan Grosir', sort_order: 2 },
      { code: 'CG-CORPORATE', name: 'Pelanggan Korporat', sort_order: 3 },
      { code: 'CG-MEMBER', name: 'Anggota', sort_order: 4 },
      { code: 'CG-VIP', name: 'Pelanggan VIP', sort_order: 5 },
      { code: 'CG-RESELLER', name: 'Reseller', sort_order: 6 },
      { code: 'CG-ONLINE', name: 'Pelanggan Daring', sort_order: 7 },
      { code: 'CG-GOVERNMENT', name: 'Instansi Pemerintah', sort_order: 8 },
      { code: 'CG-EMPLOYEE', name: 'Karyawan', sort_order: 9 },
      { code: 'CG-OTHER', name: 'Pelanggan Lainnya', sort_order: 10 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'PRODUCT',
    label: 'Produk',
    table: 'product',
    scope: 'tenant',
    order: 30,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    seedKind: 'EXAMPLE',
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    references: [
      { table: 'stock_movement', column: 'product_id', isTransactional: true },
      { table: 'purchase_order_line', column: 'product_id', isTransactional: true },
      { table: 'pos_sale_line', column: 'product_id', isTransactional: true },
      { table: 'request_order_line', column: 'product_id', isTransactional: true },
      { table: 'stock_policy', column: 'product_id', isTransactional: false },
    ],
    records: async (ctx) => {
      const cat = (code: string) => ctx.requireId('product_category', code);
      const uom = (code: string) => ctx.requireId('uom', code);
      const tax = (code: string) => ctx.lookupId('tax_category', code);
      const defs: Array<[string, string, string, string, string, number, number, string]> = [
        ['ROKOK-DEMO', 'Rokok Contoh', 'MERCHANDISE', 'PCS', 'PPN_11', 18000, 22000, 'GOODS'],
        ['AYAM', 'Ayam Potong', 'RAW_MATERIAL', 'KG', 'NON_PPN', 32000, 40000, 'GOODS'],
        ['MINYAK', 'Minyak Goreng', 'RAW_MATERIAL', 'LITRE', 'PPN_11', 16000, 20000, 'GOODS'],
        ['BUMBU', 'Bumbu Racik', 'RAW_MATERIAL', 'PACK', 'PPN_11', 8000, 12000, 'GOODS'],
        ['FRIED-CHICKEN', 'Ayam Goreng Siap Saji', 'FINISHED_GOODS', 'PCS', 'PB1_10', 12000, 18000, 'GOODS'],
        ['KOPI-SUSU', 'Kopi Susu', 'BEVERAGE', 'PCS', 'PB1_10', 9000, 18000, 'GOODS'],
        ['TEH-MANIS', 'Teh Manis', 'BEVERAGE', 'PCS', 'PB1_10', 3000, 8000, 'GOODS'],
        ['NASI-PUTIH', 'Nasi Putih', 'FOOD', 'PCS', 'PB1_10', 2500, 6000, 'GOODS'],
        ['BOX-KEMASAN', 'Box Kemasan Makanan', 'PACKAGING', 'BOX', 'PPN_11', 1200, 2000, 'GOODS'],
        ['GULA-PASIR', 'Gula Pasir', 'RAW_MATERIAL', 'KG', 'PPN_11', 14000, 18000, 'GOODS'],
        ['JASA-ANTAR', 'Jasa Antar Pesanan', 'SERVICE', 'SERVICE', 'NON_PPN', 0, 10000, 'SERVICE'],
        ['SPAREPART-KOMPOR', 'Suku Cadang Kompor', 'SPARE_PART', 'PCS', 'PPN_11', 75000, 110000, 'GOODS'],
      ];
      // Sekuensial: satu PoolClient tidak boleh menjalankan query bersamaan.
      const rows: MasterSeedRecord[] = [];
      for (const [i, def] of defs.entries()) {
        const [code, name, category, uomCode, taxCode, cost, price, type] = def;
        rows.push({
          code,
          name,
          sku: code,
          barcode: `899${String(1000000 + i).padStart(10, '0')}`,
          category_id: await cat(category),
          base_uom_id: await uom(uomCode),
          tax_category_id: await tax(taxCode),
          product_type: type,
          tracking_type: 'NONE',
          standard_cost: cost,
          default_sale_price: price,
          sort_order: i + 1,
        });
      }
      return rows;
    },
  }),

  defineMasterSeed({
    resourceCode: 'SUPPLIER',
    label: 'Pemasok',
    table: 'supplier',
    scope: 'tenant',
    order: 31,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    seedKind: 'EXAMPLE',
    hardDeletePolicy: 'PURGE_SAMPLE_ONLY',
    references: [
      { table: 'purchase_order', column: 'supplier_id', isTransactional: true },
      { table: 'goods_receipt', column: 'supplier_id', isTransactional: true },
      { table: 'product_supplier', column: 'supplier_id', isTransactional: false },
    ],
    records: async (ctx) => {
      const group = (code: string) => ctx.lookupId('supplier_group', code);
      const term = (code: string) => ctx.lookupId('payment_term', code);
      const defs: Array<[string, string, string, string, number]> = [
        ['SUP-A', 'PT Pemasok Utama A', 'SG-FOOD', 'NET_30', 3],
        ['SUP-B', 'PT Pemasok Utama B', 'SG-BEVERAGE', 'NET_14', 5],
        ['SUP-C', 'CV Bahan Segar Nusantara', 'SG-RAW', 'NET_7', 2],
        ['SUP-D', 'PT Kemasan Prima', 'SG-PACKAGING', 'NET_30', 7],
        ['SUP-E', 'UD Sumber Rejeki', 'SG-FOOD', 'CASH', 1],
        ['SUP-F', 'PT Peralatan Dapur Jaya', 'SG-EQUIPMENT', 'NET_45', 10],
        ['SUP-G', 'CV Logistik Cepat', 'SG-LOGISTIC', 'NET_14', 1],
        ['SUP-H', 'PT Kantor Sejahtera', 'SG-OFFICE', 'NET_30', 4],
        ['SUP-I', 'PT Impor Global Mandiri', 'SG-IMPORT', 'NET_60', 21],
        ['SUP-J', 'CV Jasa Perawatan Andal', 'SG-SERVICE', 'NET_21', 2],
      ];
      const rows: MasterSeedRecord[] = [];
      for (const [i, def] of defs.entries()) {
        const [code, name, groupCode, termCode, leadTime] = def;
        rows.push({
          code,
          name,
          supplier_number: code,
          supplier_group_id: await group(groupCode),
          payment_term_id: await term(termCode),
          contact_person: `Kontak ${name}`,
          phone: `0812${String(10000000 + i).slice(0, 8)}`,
          email: `${code.toLowerCase()}@contoh.example`,
          lead_time_days: leadTime,
          rating: 4 + (i % 2) * 0.5,
          sort_order: i + 1,
        });
      }
      return rows;
    },
  }),

  defineMasterSeed({
    resourceCode: 'CUSTOMER',
    label: 'Pelanggan',
    table: 'customer',
    scope: 'tenant',
    order: 32,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    seedKind: 'EXAMPLE',
    hardDeletePolicy: 'PURGE_SAMPLE_ONLY',
    references: [
      { table: 'pos_sale', column: 'customer_id', isTransactional: true },
      { table: 'sales_order', column: 'customer_id', isTransactional: true },
    ],
    records: async (ctx) => {
      const group = (code: string) => ctx.lookupId('customer_group', code);
      const defs: Array<[string, string, string, string]> = [
        ['CUST-001', 'Pelanggan Umum', 'CG-RETAIL', 'INDIVIDUAL'],
        ['CUST-002', 'Budi Santoso', 'CG-MEMBER', 'INDIVIDUAL'],
        ['CUST-003', 'Siti Rahayu', 'CG-MEMBER', 'INDIVIDUAL'],
        ['CUST-004', 'PT Mitra Sejahtera', 'CG-CORPORATE', 'COMPANY'],
        ['CUST-005', 'CV Warung Berkah', 'CG-WHOLESALE', 'COMPANY'],
        ['CUST-006', 'Toko Sinar Baru', 'CG-RESELLER', 'COMPANY'],
        ['CUST-007', 'Andi Pratama', 'CG-VIP', 'INDIVIDUAL'],
        ['CUST-008', 'Koperasi Karyawan', 'CG-EMPLOYEE', 'COMPANY'],
        ['CUST-009', 'Dinas Pendidikan Contoh', 'CG-GOVERNMENT', 'COMPANY'],
        ['CUST-010', 'Pembeli Daring', 'CG-ONLINE', 'INDIVIDUAL'],
      ];
      const rows: MasterSeedRecord[] = [];
      for (const [i, def] of defs.entries()) {
        const [code, name, groupCode, type] = def;
        rows.push({
          code,
          name,
          customer_number: code,
          customer_group_id: await group(groupCode),
          customer_type: type,
          phone: `0813${String(20000000 + i).slice(0, 8)}`,
          email: `${code.toLowerCase()}@contoh.example`,
          credit_limit: type === 'COMPANY' ? 25000000 : 0,
          sort_order: i + 1,
        });
      }
      return rows;
    },
  }),

  defineMasterSeed({
    resourceCode: 'PRODUCT_SUPPLIER',
    label: 'Produk Pemasok',
    table: 'product_supplier',
    scope: 'tenant',
    order: 33,
    minimumRecords: 10,
    strategy: 'INSERT_IF_MISSING',
    uniqueColumn: 'code',
    supportsSampleCleanup: true,
    seedKind: 'EXAMPLE',
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    exceptionReason:
      'Junction produk-pemasok. Tetap di-seed >= 10 agar pemilihan pemasok pada PO dapat diuji.',
    records: async (ctx) => {
      const products = ['ROKOK-DEMO', 'AYAM', 'MINYAK', 'BUMBU', 'BOX-KEMASAN', 'GULA-PASIR', 'KOPI-SUSU', 'TEH-MANIS', 'NASI-PUTIH', 'SPAREPART-KOMPOR'];
      const suppliers = ['SUP-A', 'SUP-C', 'SUP-C', 'SUP-C', 'SUP-D', 'SUP-C', 'SUP-B', 'SUP-B', 'SUP-E', 'SUP-F'];
      const alt = ['SUP-E', 'SUP-E', 'SUP-A', 'SUP-A', 'SUP-I', 'SUP-A', 'SUP-E', 'SUP-E', 'SUP-A', 'SUP-I'];
      const rows: MasterSeedRecord[] = [];
      for (let i = 0; i < products.length; i += 1) {
        const productId = await ctx.requireId('product', products[i]);
        const uomId = await ctx.requireId('uom', 'PCS');
        rows.push({
          code: `${products[i]}::${suppliers[i]}`,
          name: `${products[i]} dari ${suppliers[i]}`,
          product_id: productId,
          supplier_id: await ctx.requireId('supplier', suppliers[i]),
          purchase_uom_id: uomId,
          supplier_sku: `${suppliers[i]}-${products[i]}`,
          lead_time_days: 3,
          minimum_order_qty: 10,
          last_price: 10000 + i * 500,
          is_preferred: true,
          priority: 10,
        });
        rows.push({
          code: `${products[i]}::${alt[i]}`,
          name: `${products[i]} dari ${alt[i]}`,
          product_id: productId,
          supplier_id: await ctx.requireId('supplier', alt[i]),
          purchase_uom_id: uomId,
          supplier_sku: `${alt[i]}-${products[i]}`,
          lead_time_days: 5,
          minimum_order_qty: 5,
          last_price: 10500 + i * 500,
          is_preferred: false,
          priority: 50,
        });
      }
      return rows;
    },
  }),

  defineMasterSeed({
    resourceCode: 'NOTIFICATION_TEMPLATE',
    label: 'Template Notifikasi',
    table: 'notification_template',
    scope: 'tenant',
    order: 40,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: true,
    hardDeletePolicy: 'PURGE_IF_UNREFERENCED',
    records: [
      { code: 'STOCK_MIN_ALERT', name: 'Peringatan Stok Minimum', channel: 'IN_APP', subject_template: 'Stok {{product}} di bawah minimum', body_template: 'Stok {{product}} pada {{warehouse}} tersisa {{qty}}.', sort_order: 1 },
      { code: 'REQUEST_ORDER_CREATED', name: 'Request Order Dibuat', channel: 'IN_APP', subject_template: 'Request Order {{number}}', body_template: 'Request Order {{number}} dibuat otomatis.', sort_order: 2 },
      { code: 'REQUEST_ORDER_APPROVED', name: 'Request Order Disetujui', channel: 'IN_APP', subject_template: 'Request Order {{number}} disetujui', body_template: 'Request Order {{number}} telah disetujui.', sort_order: 3 },
      { code: 'PURCHASE_ORDER_SENT', name: 'PO Dikirim ke Pemasok', channel: 'IN_APP', subject_template: 'PO {{number}} dikirim', body_template: 'PO {{number}} dikirim kepada {{supplier}}.', sort_order: 4 },
      { code: 'GOODS_RECEIPT_WAITING', name: 'Penerimaan Menunggu Validasi', channel: 'IN_APP', subject_template: 'Penerimaan {{number}} menunggu validasi', body_template: 'Penerimaan {{number}} menunggu validasi gudang.', sort_order: 5 },
      { code: 'GOODS_RECEIPT_VALIDATED', name: 'Penerimaan Divalidasi', channel: 'IN_APP', subject_template: 'Penerimaan {{number}} divalidasi', body_template: 'Stok telah diposting untuk penerimaan {{number}}.', sort_order: 6 },
      { code: 'BACKORDER_CREATED', name: 'Backorder Dibuat', channel: 'IN_APP', subject_template: 'Backorder {{number}}', body_template: 'Backorder {{number}} dibuat karena kekurangan penerimaan.', sort_order: 7 },
      { code: 'TRANSFER_DISPATCHED', name: 'Transfer Dikirim', channel: 'IN_APP', subject_template: 'Transfer {{number}} dikirim', body_template: 'Transfer {{number}} dalam perjalanan menuju {{destination}}.', sort_order: 8 },
      { code: 'TRANSFER_RECEIVED', name: 'Transfer Diterima', channel: 'IN_APP', subject_template: 'Transfer {{number}} diterima', body_template: 'Transfer {{number}} telah divalidasi tujuan.', sort_order: 9 },
      { code: 'SUBSCRIPTION_EXPIRING', name: 'Langganan Akan Berakhir', channel: 'IN_APP', subject_template: 'Langganan berakhir {{date}}', body_template: 'Langganan perangkat {{device}} berakhir pada {{date}}.', sort_order: 10 },

      // Versi 10 — tata kelola surat.
      { code: 'SURAT_MASUK_DIDISPOSISI', name: 'Disposisi Surat Masuk', channel: 'IN_APP', subject_template: 'Disposisi surat {{agenda}}', body_template: '{{instruction}} Batas waktu: {{dueDate}}.', sort_order: 11 },
      { code: 'SURAT_MENUNGGU_PERSETUJUAN', name: 'Surat Menunggu Persetujuan', channel: 'IN_APP', subject_template: 'Surat menunggu persetujuan Anda', body_template: '{{subject}} menunggu keputusan pada langkah {{step}} ({{stepName}}).', sort_order: 12 },
      { code: 'SURAT_DISETUJUI', name: 'Surat Keluar Disetujui', channel: 'IN_APP', subject_template: 'Surat {{subject}} disetujui', body_template: 'Surat telah disetujui dan siap diterbitkan nomornya.', sort_order: 13 },
      { code: 'SURAT_DIKEMBALIKAN', name: 'Surat Keluar Dikembalikan', channel: 'IN_APP', subject_template: 'Surat {{subject}} dikembalikan', body_template: 'Alasan: {{note}}. Perbaiki lalu ajukan kembali.', sort_order: 14 },
      { code: 'SURAT_DITERBITKAN', name: 'Surat Keluar Diterbitkan', channel: 'IN_APP', subject_template: 'Surat {{number}} diterbitkan', body_template: 'Nomor resmi {{number}} telah diberikan untuk surat {{subject}}.', sort_order: 15 },
      { code: 'SURAT_SLA_TERLAMPAUI', name: 'Batas Waktu Persetujuan Terlampaui', channel: 'IN_APP', subject_template: 'Persetujuan surat terlambat {{hours}} jam', body_template: '{{subject}} menunggu keputusan pada langkah {{step}} sejak {{dueAt}}.', sort_order: 16 },
    ],
  }),

  defineMasterSeed({
    resourceCode: 'NUMBER_SEQUENCE',
    label: 'Penomoran Dokumen',
    table: 'number_sequence',
    scope: 'tenant',
    order: 5,
    minimumRecords: 10,
    strategy: 'UPSERT_BY_CODE',
    supportsSampleCleanup: false,
    hardDeletePolicy: 'NEVER_PURGE',
    records: [
      { code: 'REQUEST_ORDER', name: 'Nomor Request Order', document_type: 'REQUEST_ORDER', prefix: 'RO-', padding: 6, is_system: true, sort_order: 1 },
      { code: 'PURCHASE_ORDER', name: 'Nomor Purchase Order', document_type: 'PURCHASE_ORDER', prefix: 'PO-', padding: 6, is_system: true, sort_order: 2 },
      { code: 'GOODS_RECEIPT', name: 'Nomor Penerimaan Barang', document_type: 'GOODS_RECEIPT', prefix: 'GR-', padding: 6, is_system: true, sort_order: 3 },
      { code: 'BACKORDER', name: 'Nomor Backorder', document_type: 'BACKORDER', prefix: 'BO-', padding: 6, is_system: true, sort_order: 4 },
      { code: 'INTERNAL_TRANSFER', name: 'Nomor Internal Transfer', document_type: 'INTERNAL_TRANSFER', prefix: 'IT-', padding: 6, is_system: true, sort_order: 5 },
      { code: 'TRANSFER_RECEIPT', name: 'Nomor Penerimaan Transfer', document_type: 'TRANSFER_RECEIPT', prefix: 'ITR-', padding: 6, is_system: true, sort_order: 6 },
      { code: 'STOCK_MOVEMENT', name: 'Nomor Mutasi Stok', document_type: 'STOCK_MOVEMENT', prefix: 'MV-', padding: 8, is_system: true, sort_order: 7 },
      { code: 'POS_SALE', name: 'Nomor Struk POS', document_type: 'POS_SALE', prefix: 'ST-', padding: 6, reset_policy: 'DAILY', is_system: true, sort_order: 8 },
      { code: 'SALES_ORDER', name: 'Nomor Pesanan Penjualan', document_type: 'SALES_ORDER', prefix: 'SO-', padding: 6, is_system: true, sort_order: 9 },
      { code: 'JOURNAL_ENTRY', name: 'Nomor Jurnal', document_type: 'JOURNAL_ENTRY', prefix: 'JV-', padding: 6, is_system: true, sort_order: 10 },
      { code: 'STOCK_COUNT', name: 'Nomor Stock Opname', document_type: 'STOCK_COUNT', prefix: 'SC-', padding: 6, is_system: true, sort_order: 11 },
      { code: 'INVENTORY_ADJUSTMENT', name: 'Nomor Penyesuaian Stok', document_type: 'INVENTORY_ADJUSTMENT', prefix: 'ADJ-', padding: 6, is_system: true, sort_order: 12 },
    ],
  }),
];

/**
 * Master tenant yang secara alamiah TIDAK masuk akal memiliki 10 record.
 * Didokumentasikan pada docs/database/master-seed-exceptions.md.
 */
export const TENANT_SEED_EXCEPTIONS: Array<{
  resourceCode: string;
  table: string;
  reason: string;
}> = [
  {
    resourceCode: 'LEGAL_ENTITY',
    table: 'legal_entity',
    reason:
      'Perusahaan/badan hukum berasal dari data pendaftaran nyata. Menciptakan 10 badan hukum fiktif akan mengacaukan struktur organisasi dan laporan konsolidasi.',
  },
  {
    resourceCode: 'BRAND',
    table: 'brand',
    reason:
      'Brand default dibuat dari nama bisnis pendaftar. Jumlah brand ditentukan pemilik pada onboarding.',
  },
  {
    resourceCode: 'OUTLET',
    table: 'outlet',
    reason:
      'Outlet merepresentasikan lokasi fisik nyata dan menjadi unit penagihan langganan. Outlet fiktif akan mempengaruhi perhitungan billing.',
  },
  {
    resourceCode: 'WAREHOUSE',
    table: 'warehouse',
    reason:
      'Gudang merepresentasikan lokasi penyimpanan nyata dan menjadi dimensi saldo stok. Dibuat sesuai struktur outlet.',
  },
  {
    resourceCode: 'REGION',
    table: 'region',
    reason: 'Tree wilayah internal mengikuti struktur bisnis nyata pendaftar.',
  },
  {
    resourceCode: 'USER_SUBJECT',
    table: 'user_subject',
    reason:
      'Merupakan proyeksi pengguna nyata dari control plane. Pengguna fiktif akan menjadi risiko keamanan.',
  },
  {
    resourceCode: 'ROLE',
    table: 'role',
    reason:
      'Role di-seed dari template global (OWNER, MANAGER, dan seterusnya) sesuai kebutuhan, bukan dipaksa 10.',
  },
  {
    resourceCode: 'MENU',
    table: 'menu',
    reason:
      'Menu di-seed dari GlobalMenuTemplate secara utuh (>100 node), bukan berdasarkan aturan minimum 10.',
  },
  {
    resourceCode: 'FISCAL_PERIOD',
    table: 'fiscal_period',
    reason:
      'Periode fiskal dihasilkan otomatis mengikuti tahun buku perusahaan, bukan data contoh.',
  },
  {
    resourceCode: 'ONBOARDING_PROGRESS',
    table: 'onboarding_progress',
    reason: 'Singleton per tenant.',
  },
  {
    resourceCode: 'APP_SETTING',
    table: 'app_setting',
    reason: 'Konfigurasi bernilai tunggal per kunci; jumlah mengikuti kebutuhan fitur.',
  },
  {
    resourceCode: 'INVENTORY_LOT',
    table: 'inventory_lot',
    reason: 'Lot/batch dihasilkan oleh penerimaan barang nyata, bukan data master yang diketik.',
  },
];
