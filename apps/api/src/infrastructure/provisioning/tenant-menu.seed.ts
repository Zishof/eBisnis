/**
 * Katalog menu tenant, permission action, dan role template.
 * Menu memakai `translationKey` sebagai sumber kebenaran label, bukan teks tunggal.
 * Menu yang belum diimplementasikan penuh ditandai `comingSoon` — tetap ter-seed
 * dan permission-nya dapat diatur, tetapi route menampilkan halaman status.
 */

export interface PermissionActionSeed {
  code: string;
  name: string;
  nameKey: string;
  actionType: string;
  sortOrder: number;
  requiresStepUp?: boolean;
}

export const PERMISSION_ACTIONS_SEED: PermissionActionSeed[] = [
  { code: 'READ', name: 'Lihat', nameKey: 'action.read', actionType: 'STANDARD', sortOrder: 1 },
  { code: 'CREATE', name: 'Buat', nameKey: 'action.create', actionType: 'STANDARD', sortOrder: 2 },
  { code: 'UPDATE', name: 'Ubah', nameKey: 'action.update', actionType: 'STANDARD', sortOrder: 3 },
  { code: 'DELETE', name: 'Hapus', nameKey: 'action.delete', actionType: 'STANDARD', sortOrder: 4 },
  { code: 'SUBMIT', name: 'Ajukan', nameKey: 'action.submit', actionType: 'WORKFLOW', sortOrder: 5 },
  { code: 'REVIEW', name: 'Tinjau', nameKey: 'action.review', actionType: 'WORKFLOW', sortOrder: 6 },
  { code: 'APPROVE', name: 'Setujui', nameKey: 'action.approve', actionType: 'WORKFLOW', sortOrder: 7 },
  { code: 'REJECT', name: 'Tolak', nameKey: 'action.reject', actionType: 'WORKFLOW', sortOrder: 8 },
  { code: 'CANCEL', name: 'Batalkan', nameKey: 'action.cancel', actionType: 'WORKFLOW', sortOrder: 9 },
  { code: 'PRINT', name: 'Cetak', nameKey: 'action.print', actionType: 'OUTPUT', sortOrder: 10 },
  { code: 'EXPORT', name: 'Ekspor', nameKey: 'action.export', actionType: 'OUTPUT', sortOrder: 11 },
  { code: 'IMPORT', name: 'Impor', nameKey: 'action.import', actionType: 'DATA', sortOrder: 12 },
  { code: 'POST', name: 'Posting', nameKey: 'action.post', actionType: 'POSTING', sortOrder: 13 },
  { code: 'CLOSE_PERIOD', name: 'Tutup Periode', nameKey: 'action.closePeriod', actionType: 'POSTING', sortOrder: 14, requiresStepUp: true },
  { code: 'REOPEN', name: 'Buka Kembali Periode', nameKey: 'action.reopen', actionType: 'POSTING', sortOrder: 15, requiresStepUp: true },
  { code: 'VIEW_AMOUNT', name: 'Lihat Nominal', nameKey: 'action.viewAmount', actionType: 'SENSITIVE', sortOrder: 16 },
  { code: 'VIEW_COST', name: 'Lihat HPP', nameKey: 'action.viewCost', actionType: 'SENSITIVE', sortOrder: 17 },
  { code: 'VIEW_PROFIT', name: 'Lihat Laba', nameKey: 'action.viewProfit', actionType: 'SENSITIVE', sortOrder: 18 },
  { code: 'MANAGE_DEVICE', name: 'Kelola Perangkat', nameKey: 'action.manageDevice', actionType: 'SENSITIVE', sortOrder: 19 },
  { code: 'CHECK_ALL', name: 'Cek Massal', nameKey: 'action.checkAll', actionType: 'BATCH', sortOrder: 20 },
  { code: 'HARD_DELETE', name: 'Hapus Permanen', nameKey: 'action.hardDelete', actionType: 'SENSITIVE', sortOrder: 21, requiresStepUp: true },
  { code: 'RESTORE', name: 'Pulihkan', nameKey: 'action.restore', actionType: 'STANDARD', sortOrder: 22 },
  // Empat aksi berikut dituntut profil P0–P12 Versi 8 dan belum ada sebelumnya.
  // RETURN dan DELEGATE juga dibutuhkan mesin workflow Versi 6: tanpa keduanya
  // "kembalikan ke pengaju" dan "delegasikan tugas" tidak dapat dinyatakan
  // sebagai hak, hanya sebagai perilaku yang tersembunyi di dalam kode.
  { code: 'RETURN', name: 'Kembalikan', nameKey: 'action.return', actionType: 'WORKFLOW', sortOrder: 23 },
  { code: 'DELEGATE', name: 'Delegasikan', nameKey: 'action.delegate', actionType: 'WORKFLOW', sortOrder: 24 },
  { code: 'REVERSE', name: 'Jurnal Balik', nameKey: 'action.reverse', actionType: 'POSTING', sortOrder: 25, requiresStepUp: true },
  { code: 'AUDIT_READ', name: 'Baca Audit', nameKey: 'action.auditRead', actionType: 'SENSITIVE', sortOrder: 26 },
];

export interface MenuNodeSeed {
  code: string;
  parentCode?: string;
  label: string;
  translationKey: string;
  route?: string;
  icon?: string;
  moduleCode?: string;
  sortOrder: number;
  actions?: string[];
  comingSoon?: boolean;
}

const CRUD = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'];
const DOC = ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'CANCEL', 'PRINT', 'EXPORT'];

export const MENU_TREE_SEED: MenuNodeSeed[] = [
  // 01 Beranda
  { code: 'HOME', label: 'Beranda', translationKey: 'menu.home', route: '/app', icon: 'home', sortOrder: 1, actions: ['READ'] },
  { code: 'HOME_DASHBOARD', parentCode: 'HOME', label: 'Dashboard Saya', translationKey: 'menu.home.dashboard', route: '/app', icon: 'layout-dashboard', sortOrder: 1, actions: ['READ'] },
  { code: 'HOME_APPROVAL_INBOX', parentCode: 'HOME', label: 'Kotak Masuk Persetujuan', translationKey: 'menu.home.approvalInbox', route: '/app/approvals', icon: 'inbox', sortOrder: 2, actions: ['READ', 'APPROVE', 'REJECT'], comingSoon: true },
  { code: 'HOME_NOTIFICATIONS', parentCode: 'HOME', label: 'Notifikasi', translationKey: 'menu.home.notifications', route: '/app/notifications', icon: 'bell', sortOrder: 3, actions: ['READ'] },

  // 02 Kasir / POS — langsung di root
  { code: 'POS', label: 'Kasir / POS', translationKey: 'menu.pos', route: '/app/pos', icon: 'shopping-cart', moduleCode: 'POS', sortOrder: 2, actions: ['READ', 'CREATE', 'PRINT', 'CANCEL'], comingSoon: true },
  { code: 'POS_TERMINAL', parentCode: 'POS', label: 'Terminal POS', translationKey: 'menu.pos.terminal', route: '/app/pos/terminals', icon: 'monitor', moduleCode: 'POS', sortOrder: 1, actions: CRUD, comingSoon: true },
  { code: 'POS_SHIFT', parentCode: 'POS', label: 'Shift Kasir', translationKey: 'menu.pos.shift', route: '/app/pos/shifts', icon: 'clock', moduleCode: 'POS', sortOrder: 2, actions: ['READ', 'CREATE', 'UPDATE'], comingSoon: true },

  // 03 Penjualan
  { code: 'SALES', label: 'Penjualan', translationKey: 'menu.sales', icon: 'trending-up', moduleCode: 'SALES', sortOrder: 3, actions: ['READ'], comingSoon: true },
  { code: 'SALES_ORDER', parentCode: 'SALES', label: 'Pesanan Penjualan', translationKey: 'menu.sales.order', route: '/app/sales/orders', moduleCode: 'SALES', sortOrder: 1, actions: DOC, comingSoon: true },
  { code: 'SALES_REPORT', parentCode: 'SALES', label: 'Laporan Penjualan', translationKey: 'menu.sales.report', route: '/app/sales/reports', moduleCode: 'SALES', sortOrder: 2, actions: ['READ', 'EXPORT', 'VIEW_AMOUNT', 'VIEW_PROFIT'], comingSoon: true },

  // 04 Produk dan Harga
  { code: 'CATALOG', label: 'Produk dan Harga', translationKey: 'menu.catalog', icon: 'package', moduleCode: 'PRODUCT_PRICING', sortOrder: 4, actions: ['READ'] },
  { code: 'CATALOG_PRODUCT', parentCode: 'CATALOG', label: 'Produk', translationKey: 'menu.catalog.product', route: '/app/products', icon: 'box', moduleCode: 'PRODUCT_PRICING', sortOrder: 1, actions: [...CRUD, 'IMPORT', 'HARD_DELETE', 'RESTORE', 'VIEW_COST'] },
  { code: 'CATALOG_CATEGORY', parentCode: 'CATALOG', label: 'Kategori', translationKey: 'menu.catalog.category', route: '/app/product-categories', icon: 'folder-tree', moduleCode: 'PRODUCT_PRICING', sortOrder: 2, actions: [...CRUD, 'HARD_DELETE', 'RESTORE'] },
  { code: 'CATALOG_UOM', parentCode: 'CATALOG', label: 'Satuan (UOM)', translationKey: 'menu.catalog.uom', route: '/app/uoms', icon: 'ruler', moduleCode: 'PRODUCT_PRICING', sortOrder: 3, actions: [...CRUD, 'HARD_DELETE', 'RESTORE'] },
  { code: 'CATALOG_PRICE_BOOK', parentCode: 'CATALOG', label: 'Buku Harga', translationKey: 'menu.catalog.priceBook', route: '/app/price-books', icon: 'tag', moduleCode: 'PRODUCT_PRICING', sortOrder: 4, actions: CRUD, comingSoon: true },
  { code: 'CATALOG_TAX', parentCode: 'CATALOG', label: 'Pajak', translationKey: 'menu.catalog.tax', route: '/app/tax-categories', icon: 'percent', moduleCode: 'PRODUCT_PRICING', sortOrder: 5, actions: CRUD, comingSoon: true },

  // 05 Pelanggan dan CRM
  { code: 'CRM', label: 'Pelanggan dan CRM', translationKey: 'menu.crm', icon: 'users', moduleCode: 'CRM', sortOrder: 5, actions: ['READ'] },
  { code: 'CRM_CUSTOMER', parentCode: 'CRM', label: 'Pelanggan', translationKey: 'menu.crm.customer', route: '/app/customers', icon: 'user', moduleCode: 'CRM', sortOrder: 1, actions: [...CRUD, 'HARD_DELETE', 'RESTORE'] },
  { code: 'CRM_GROUP', parentCode: 'CRM', label: 'Grup Pelanggan', translationKey: 'menu.crm.group', route: '/app/customer-groups', icon: 'users-round', moduleCode: 'CRM', sortOrder: 2, actions: CRUD },

  // 06 Pembelian
  { code: 'PURCHASING', label: 'Pembelian', translationKey: 'menu.purchasing', icon: 'shopping-bag', moduleCode: 'PURCHASING', sortOrder: 6, actions: ['READ'] },
  { code: 'PURCHASING_REQUEST_ORDER', parentCode: 'PURCHASING', label: 'Request Order', translationKey: 'menu.purchasing.requestOrder', route: '/app/request-orders', icon: 'clipboard-list', moduleCode: 'PURCHASING', sortOrder: 1, actions: DOC },
  { code: 'PURCHASING_PO', parentCode: 'PURCHASING', label: 'Purchase Order', translationKey: 'menu.purchasing.purchaseOrder', route: '/app/purchase-orders', icon: 'file-text', moduleCode: 'PURCHASING', sortOrder: 2, actions: [...DOC, 'VIEW_AMOUNT'] },
  { code: 'PURCHASING_RECEIPT', parentCode: 'PURCHASING', label: 'Penerimaan Barang', translationKey: 'menu.purchasing.goodsReceipt', route: '/app/goods-receipts', icon: 'package-check', moduleCode: 'PURCHASING', sortOrder: 3, actions: [...DOC, 'POST', 'REVIEW'] },
  { code: 'PURCHASING_BACKORDER', parentCode: 'PURCHASING', label: 'Backorder', translationKey: 'menu.purchasing.backorder', route: '/app/backorders', icon: 'package-x', moduleCode: 'PURCHASING', sortOrder: 4, actions: DOC },
  { code: 'PURCHASING_SUPPLIER', parentCode: 'PURCHASING', label: 'Pemasok', translationKey: 'menu.purchasing.supplier', route: '/app/suppliers', icon: 'truck', moduleCode: 'PURCHASING', sortOrder: 5, actions: [...CRUD, 'HARD_DELETE', 'RESTORE'] },
  { code: 'PURCHASING_PRODUCT_SUPPLIER', parentCode: 'PURCHASING', label: 'Produk Pemasok', translationKey: 'menu.purchasing.productSupplier', route: '/app/product-suppliers', icon: 'link', moduleCode: 'PURCHASING', sortOrder: 6, actions: CRUD },

  // 07 Gudang dan Persediaan
  { code: 'INVENTORY', label: 'Gudang dan Persediaan', translationKey: 'menu.inventory', icon: 'warehouse', moduleCode: 'INVENTORY', sortOrder: 7, actions: ['READ'] },
  { code: 'INVENTORY_WAREHOUSE', parentCode: 'INVENTORY', label: 'Gudang', translationKey: 'menu.inventory.warehouse', route: '/app/warehouses', icon: 'building', moduleCode: 'WAREHOUSE', sortOrder: 1, actions: [...CRUD, 'HARD_DELETE', 'RESTORE'] },
  { code: 'INVENTORY_STOCK_POLICY', parentCode: 'INVENTORY', label: 'Minimum Stok', translationKey: 'menu.inventory.stockPolicy', route: '/app/stock-policies', icon: 'gauge', moduleCode: 'INVENTORY', sortOrder: 2, actions: CRUD },
  { code: 'INVENTORY_TRANSFER', parentCode: 'INVENTORY', label: 'Internal Transfer', translationKey: 'menu.inventory.internalTransfer', route: '/app/internal-transfers', icon: 'arrow-left-right', moduleCode: 'INVENTORY', sortOrder: 3, actions: [...DOC, 'POST'] },
  { code: 'INVENTORY_STOCK_TREE', parentCode: 'INVENTORY', label: 'Monitoring Stok', translationKey: 'menu.inventory.stockTree', route: '/app/stock-tree', icon: 'network', moduleCode: 'INVENTORY', sortOrder: 4, actions: ['READ', 'EXPORT'] },
  { code: 'INVENTORY_MOVEMENT', parentCode: 'INVENTORY', label: 'Kartu Stok', translationKey: 'menu.inventory.movement', route: '/app/stock-movements', icon: 'list', moduleCode: 'INVENTORY', sortOrder: 5, actions: ['READ', 'EXPORT'] },
  { code: 'INVENTORY_ALERT', parentCode: 'INVENTORY', label: 'Notifikasi Stok Minimum', translationKey: 'menu.inventory.alert', route: '/app/stock-alerts', icon: 'alert-triangle', moduleCode: 'INVENTORY', sortOrder: 6, actions: ['READ', 'UPDATE'] },
  { code: 'INVENTORY_STOCK_COUNT', parentCode: 'INVENTORY', label: 'Stock Opname', translationKey: 'menu.inventory.stockCount', route: '/app/stock-counts', icon: 'clipboard-check', moduleCode: 'INVENTORY', sortOrder: 7, actions: DOC, comingSoon: true },

  // 08 Produksi
  { code: 'MANUFACTURING', label: 'Produksi', translationKey: 'menu.manufacturing', icon: 'factory', moduleCode: 'MANUFACTURING', sortOrder: 8, actions: ['READ'], comingSoon: true },
  { code: 'MANUFACTURING_BOM', parentCode: 'MANUFACTURING', label: 'Bill of Material', translationKey: 'menu.manufacturing.bom', route: '/app/boms', moduleCode: 'MANUFACTURING', sortOrder: 1, actions: CRUD, comingSoon: true },

  // 09 Quality Control
  { code: 'QUALITY', label: 'Quality Control', translationKey: 'menu.quality', icon: 'badge-check', moduleCode: 'QUALITY_CONTROL', sortOrder: 9, actions: ['READ'], comingSoon: true },

  // 10 Distribusi dan Pengiriman
  { code: 'SHIPPING', label: 'Distribusi dan Pengiriman', translationKey: 'menu.shipping', icon: 'truck', moduleCode: 'SHIPPING', sortOrder: 10, actions: ['READ'], comingSoon: true },
  { code: 'SHIPPING_CARRIER', parentCode: 'SHIPPING', label: 'Ekspedisi', translationKey: 'menu.shipping.carrier', route: '/app/carriers', moduleCode: 'SHIPPING', sortOrder: 1, actions: CRUD, comingSoon: true },

  // 11 Keuangan dan Akuntansi
  { code: 'FINANCE', label: 'Keuangan dan Akuntansi', translationKey: 'menu.finance', icon: 'wallet', moduleCode: 'ACCOUNTING', sortOrder: 11, actions: ['READ'], comingSoon: true },
  { code: 'FINANCE_COA', parentCode: 'FINANCE', label: 'Bagan Akun', translationKey: 'menu.finance.coa', route: '/app/chart-of-accounts', moduleCode: 'ACCOUNTING', sortOrder: 1, actions: CRUD, comingSoon: true },
  { code: 'FINANCE_JOURNAL', parentCode: 'FINANCE', label: 'Jurnal', translationKey: 'menu.finance.journal', route: '/app/journal-entries', moduleCode: 'ACCOUNTING', sortOrder: 2, actions: [...DOC, 'POST', 'CLOSE_PERIOD', 'REOPEN'], comingSoon: true },

  // 12 Investor dan Bagi Hasil
  { code: 'INVESTOR', label: 'Investor dan Bagi Hasil', translationKey: 'menu.investor', icon: 'handshake', moduleCode: 'INVESTOR_REVENUE_SHARE', sortOrder: 12, actions: ['READ', 'VIEW_AMOUNT'], comingSoon: true },

  // 13 SDM dan Payroll
  { code: 'HR', label: 'SDM dan Payroll', translationKey: 'menu.hr', icon: 'id-card', moduleCode: 'HUMAN_RESOURCES', sortOrder: 13, actions: ['READ'], comingSoon: true },
  { code: 'HR_EMPLOYEE', parentCode: 'HR', label: 'Pegawai', translationKey: 'menu.hr.employee', route: '/app/employees', moduleCode: 'HUMAN_RESOURCES', sortOrder: 1, actions: CRUD, comingSoon: true },
  { code: 'HR_DEPARTMENT', parentCode: 'HR', label: 'Departemen', translationKey: 'menu.hr.department', route: '/app/departments', moduleCode: 'HUMAN_RESOURCES', sortOrder: 2, actions: CRUD },
  { code: 'HR_POSITION', parentCode: 'HR', label: 'Jabatan', translationKey: 'menu.hr.position', route: '/app/job-positions', moduleCode: 'HUMAN_RESOURCES', sortOrder: 3, actions: CRUD },
  { code: 'HR_LEAVE_TYPE', parentCode: 'HR', label: 'Jenis Cuti', translationKey: 'menu.hr.leaveType', route: '/app/leave-types', moduleCode: 'HUMAN_RESOURCES', sortOrder: 4, actions: CRUD },

  // 14 Aset dan Pemeliharaan
  { code: 'ASSET', label: 'Aset dan Pemeliharaan', translationKey: 'menu.asset', icon: 'wrench', moduleCode: 'ASSET', sortOrder: 14, actions: ['READ'], comingSoon: true },

  // 15 Workflow dan Persetujuan
  { code: 'WORKFLOW', label: 'Workflow dan Persetujuan', translationKey: 'menu.workflow', icon: 'git-branch', moduleCode: 'WORKFLOW', sortOrder: 15, actions: ['READ'], comingSoon: true },

  // 16 Laporan dan Analitik
  { code: 'REPORTING', label: 'Laporan dan Analitik', translationKey: 'menu.reporting', icon: 'bar-chart-3', moduleCode: 'REPORTING_ANALYTICS', sortOrder: 16, actions: ['READ', 'EXPORT'], comingSoon: true },

  // 17 Langganan dan Perangkat
  { code: 'SUBSCRIPTION', label: 'Langganan dan Perangkat', translationKey: 'menu.subscription', icon: 'credit-card', sortOrder: 17, actions: ['READ'] },
  { code: 'SUBSCRIPTION_DEVICE', parentCode: 'SUBSCRIPTION', label: 'Perangkat POS', translationKey: 'menu.subscription.device', route: '/app/devices', icon: 'smartphone', sortOrder: 1, actions: ['READ', 'CREATE', 'UPDATE', 'MANAGE_DEVICE'] },
  { code: 'SUBSCRIPTION_CHECKOUT', parentCode: 'SUBSCRIPTION', label: 'Berlangganan', translationKey: 'menu.subscription.checkout', route: '/app/subscription/checkout', icon: 'shopping-cart', sortOrder: 2, actions: ['READ', 'CREATE', 'VIEW_AMOUNT'] },
  { code: 'SUBSCRIPTION_INVOICE', parentCode: 'SUBSCRIPTION', label: 'Invoice Langganan', translationKey: 'menu.subscription.invoice', route: '/app/subscription/invoices', icon: 'receipt', sortOrder: 3, actions: ['READ', 'PRINT', 'VIEW_AMOUNT'] },

  // 18 Master Data
  { code: 'MASTER_DATA', label: 'Master Data', translationKey: 'menu.masterData', icon: 'database', sortOrder: 18, actions: ['READ'] },
  { code: 'MASTER_OUTLET', parentCode: 'MASTER_DATA', label: 'Outlet', translationKey: 'menu.masterData.outlet', route: '/app/outlets', icon: 'store', sortOrder: 1, actions: CRUD },
  { code: 'MASTER_REGION', parentCode: 'MASTER_DATA', label: 'Wilayah', translationKey: 'menu.masterData.region', route: '/app/regions', icon: 'map', sortOrder: 2, actions: CRUD },
  { code: 'MASTER_OUTLET_TYPE', parentCode: 'MASTER_DATA', label: 'Jenis Outlet', translationKey: 'menu.masterData.outletType', route: '/app/outlet-types', icon: 'tags', sortOrder: 3, actions: CRUD },
  { code: 'MASTER_WAREHOUSE_TYPE', parentCode: 'MASTER_DATA', label: 'Jenis Gudang', translationKey: 'menu.masterData.warehouseType', route: '/app/warehouse-types', icon: 'tags', sortOrder: 4, actions: CRUD },
  { code: 'MASTER_PAYMENT_METHOD', parentCode: 'MASTER_DATA', label: 'Metode Pembayaran', translationKey: 'menu.masterData.paymentMethod', route: '/app/payment-methods', icon: 'credit-card', sortOrder: 5, actions: CRUD },
  { code: 'MASTER_PAYMENT_TERM', parentCode: 'MASTER_DATA', label: 'Termin Pembayaran', translationKey: 'menu.masterData.paymentTerm', route: '/app/payment-terms', icon: 'calendar', sortOrder: 6, actions: CRUD },
  { code: 'MASTER_SUPPLIER_GROUP', parentCode: 'MASTER_DATA', label: 'Grup Pemasok', translationKey: 'menu.masterData.supplierGroup', route: '/app/supplier-groups', icon: 'boxes', sortOrder: 7, actions: CRUD },
  { code: 'MASTER_VEHICLE_TYPE', parentCode: 'MASTER_DATA', label: 'Jenis Kendaraan', translationKey: 'menu.masterData.vehicleType', route: '/app/vehicle-types', icon: 'car', sortOrder: 8, actions: CRUD },
  { code: 'MASTER_SEED_TOOLS', parentCode: 'MASTER_DATA', label: 'Data Contoh', translationKey: 'menu.masterData.sampleData', route: '/app/sample-data', icon: 'sparkles', sortOrder: 9, actions: ['READ', 'CREATE', 'DELETE', 'RESTORE'] },

  // 19 Integrasi dan API
  { code: 'INTEGRATION', label: 'Integrasi dan API', translationKey: 'menu.integration', icon: 'plug', moduleCode: 'INTEGRATION_API', sortOrder: 19, actions: ['READ'], comingSoon: true },

  // 20 Administrasi Sistem
  { code: 'ADMIN', label: 'Administrasi Sistem', translationKey: 'menu.admin', icon: 'settings', sortOrder: 20, actions: ['READ'] },
  { code: 'ADMIN_USER', parentCode: 'ADMIN', label: 'Pengguna', translationKey: 'menu.admin.user', route: '/app/users', icon: 'user-cog', sortOrder: 1, actions: CRUD },
  { code: 'ADMIN_ROLE', parentCode: 'ADMIN', label: 'Role', translationKey: 'menu.admin.role', route: '/app/roles', icon: 'shield', sortOrder: 2, actions: CRUD },
  { code: 'ADMIN_PERMISSION', parentCode: 'ADMIN', label: 'Hak Akses Menu', translationKey: 'menu.admin.permission', route: '/app/role-permissions', icon: 'key', sortOrder: 3, actions: ['READ', 'UPDATE'] },
  { code: 'ADMIN_AUDIT', parentCode: 'ADMIN', label: 'Audit', translationKey: 'menu.admin.audit', route: '/app/audit', icon: 'scroll-text', sortOrder: 4, actions: ['READ', 'EXPORT'] },
  { code: 'ADMIN_SETTING', parentCode: 'ADMIN', label: 'Pengaturan', translationKey: 'menu.admin.setting', route: '/app/settings', icon: 'sliders', sortOrder: 5, actions: ['READ', 'UPDATE'] },

  // 21 Bantuan dan Dukungan
  { code: 'SUPPORT', label: 'Bantuan dan Dukungan', translationKey: 'menu.support', icon: 'life-buoy', sortOrder: 21, actions: ['READ'], comingSoon: true },
];

export interface RoleTemplateSeed {
  code: string;
  name: string;
  description: string;
  roleType: string;
  sortOrder: number;
  /** menuCode -> daftar action, atau '*' untuk seluruh action. */
  permissions: Record<string, string[] | '*'>;
}

const ALL_MENU_CODES = MENU_TREE_SEED.map((m) => m.code);

export const ROLE_TEMPLATES_SEED: RoleTemplateSeed[] = [
  {
    code: 'OWNER',
    name: 'Pemilik',
    description: 'Akses penuh terhadap seluruh modul tenant.',
    roleType: 'SYSTEM',
    sortOrder: 1,
    permissions: Object.fromEntries(ALL_MENU_CODES.map((code) => [code, '*'])) as Record<
      string,
      '*'
    >,
  },
  {
    code: 'MANAGER',
    name: 'Manajer',
    description: 'Mengelola operasional harian tanpa hak hapus permanen.',
    roleType: 'SYSTEM',
    sortOrder: 2,
    permissions: Object.fromEntries(
      ALL_MENU_CODES.map((code) => [
        code,
        ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'CANCEL', 'PRINT', 'EXPORT', 'POST', 'VIEW_AMOUNT', 'VIEW_COST'],
      ]),
    ) as Record<string, string[]>,
  },
  {
    code: 'WAREHOUSE_STAFF',
    name: 'Staf Gudang',
    description: 'Penerimaan barang, transfer, dan monitoring stok.',
    roleType: 'SYSTEM',
    sortOrder: 3,
    permissions: {
      HOME: ['READ'],
      HOME_DASHBOARD: ['READ'],
      HOME_NOTIFICATIONS: ['READ'],
      INVENTORY: ['READ'],
      INVENTORY_WAREHOUSE: ['READ'],
      INVENTORY_STOCK_POLICY: ['READ', 'UPDATE'],
      INVENTORY_TRANSFER: ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'POST'],
      INVENTORY_STOCK_TREE: ['READ'],
      INVENTORY_MOVEMENT: ['READ'],
      INVENTORY_ALERT: ['READ', 'UPDATE'],
      PURCHASING: ['READ'],
      PURCHASING_REQUEST_ORDER: ['READ', 'CREATE', 'UPDATE', 'SUBMIT'],
      PURCHASING_RECEIPT: ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'REVIEW', 'POST'],
      PURCHASING_BACKORDER: ['READ', 'CREATE'],
      CATALOG: ['READ'],
      CATALOG_PRODUCT: ['READ'],
    },
  },
  {
    code: 'PURCHASING_STAFF',
    name: 'Staf Pembelian',
    description: 'Konsolidasi kebutuhan dan pembuatan Purchase Order.',
    roleType: 'SYSTEM',
    sortOrder: 4,
    permissions: {
      HOME: ['READ'],
      HOME_DASHBOARD: ['READ'],
      PURCHASING: ['READ'],
      PURCHASING_REQUEST_ORDER: ['READ', 'APPROVE', 'REJECT'],
      PURCHASING_PO: ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'PRINT', 'VIEW_AMOUNT'],
      PURCHASING_BACKORDER: ['READ', 'CREATE', 'UPDATE', 'SUBMIT'],
      PURCHASING_SUPPLIER: ['READ', 'CREATE', 'UPDATE'],
      PURCHASING_PRODUCT_SUPPLIER: ['READ', 'CREATE', 'UPDATE'],
      CATALOG: ['READ'],
      CATALOG_PRODUCT: ['READ'],
      INVENTORY: ['READ'],
      INVENTORY_STOCK_TREE: ['READ'],
    },
  },
  {
    code: 'CASHIER',
    name: 'Kasir',
    description: 'Transaksi POS dan shift kasir.',
    roleType: 'SYSTEM',
    sortOrder: 5,
    permissions: {
      HOME: ['READ'],
      HOME_DASHBOARD: ['READ'],
      POS: ['READ', 'CREATE', 'PRINT'],
      POS_SHIFT: ['READ', 'CREATE', 'UPDATE'],
      CATALOG: ['READ'],
      CATALOG_PRODUCT: ['READ'],
      CRM: ['READ'],
      CRM_CUSTOMER: ['READ', 'CREATE'],
    },
  },
  {
    code: 'DEMO_USER',
    name: 'Pengguna Demo',
    description: 'Akses baca dan simulasi pada sandbox demo. Aksi sensitif dinonaktifkan.',
    roleType: 'SYSTEM',
    sortOrder: 6,
    permissions: Object.fromEntries(
      ALL_MENU_CODES.map((code) => [code, ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'POST']]),
    ) as Record<string, string[]>,
  },
];
