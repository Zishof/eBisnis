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

  // --- Versi 9: marketplace, fulfillment, dan pengiriman -------------------
  { code: 'PUBLISH', name: 'Terbitkan', nameKey: 'action.publish', actionType: 'WORKFLOW', sortOrder: 27 },
  { code: 'UNPUBLISH', name: 'Tarik dari Publikasi', nameKey: 'action.unpublish', actionType: 'WORKFLOW', sortOrder: 28 },
  { code: 'MODERATE', name: 'Moderasi', nameKey: 'action.moderate', actionType: 'WORKFLOW', sortOrder: 29 },
  { code: 'ASSIGN', name: 'Tugaskan', nameKey: 'action.assign', actionType: 'WORKFLOW', sortOrder: 30 },
  { code: 'RESERVE', name: 'Reservasi Stok', nameKey: 'action.reserve', actionType: 'STANDARD', sortOrder: 31 },
  { code: 'RELEASE', name: 'Lepas Reservasi', nameKey: 'action.release', actionType: 'STANDARD', sortOrder: 32 },
  { code: 'PICK', name: 'Ambil Barang', nameKey: 'action.pick', actionType: 'STANDARD', sortOrder: 33 },
  { code: 'PACK', name: 'Kemas', nameKey: 'action.pack', actionType: 'STANDARD', sortOrder: 34 },
  { code: 'SHIP', name: 'Kirim', nameKey: 'action.ship', actionType: 'STANDARD', sortOrder: 35 },
  { code: 'DELIVER', name: 'Serahkan', nameKey: 'action.deliver', actionType: 'STANDARD', sortOrder: 36 },
  { code: 'RETURN_APPROVE', name: 'Setujui Retur', nameKey: 'action.returnApprove', actionType: 'WORKFLOW', sortOrder: 37 },
  // Dua aksi berikut memindahkan uang atau membuka akses ke uang, sehingga
  // keduanya menuntut step-up sebagaimana HARD_DELETE dan CLOSE_PERIOD.
  { code: 'REFUND_APPROVE', name: 'Setujui Refund', nameKey: 'action.refundApprove', actionType: 'SENSITIVE', sortOrder: 38, requiresStepUp: true },
  { code: 'MANAGE_CREDENTIAL', name: 'Kelola Credential', nameKey: 'action.manageCredential', actionType: 'SENSITIVE', sortOrder: 39, requiresStepUp: true },
  { code: 'RECONCILE', name: 'Rekonsiliasi', nameKey: 'action.reconcile', actionType: 'SENSITIVE', sortOrder: 40 },

  // --- Aksi kasir (POS) ---------------------------------------------------
  //
  // Yang TIDAK ditambahkan di sini sama pentingnya dengan yang ditambahkan:
  //
  // - `VOID_LINE` dan `VOID_SALE` tidak dibuat. Membatalkan baris sebelum
  //   pembayaran adalah UPDATE pada keranjang; membatalkan transaksi yang sudah
  //   selesai adalah CANCEL. Keduanya sudah ada dan maknanya sudah tepat. Aksi
  //   yang artinya sama dengan aksi lain hanya membuat matriks hak akses lebih
  //   sulit dibaca — dan matriks yang sulit dibaca adalah matriks yang salah
  //   dikonfigurasi.
  // - `VIEW_OTHER_CASHIER` tidak dibuat. Itu persoalan cakupan data, dan
  //   cakupan data sudah punya mekanismenya sendiri. Menuliskannya sebagai hak
  //   akses akan menaruh aturan yang sama di dua tempat.
  { code: 'SELL', name: 'Menjual', nameKey: 'action.sell', actionType: 'STANDARD', sortOrder: 41 },
  { code: 'HOLD', name: 'Tahan Transaksi', nameKey: 'action.hold', actionType: 'STANDARD', sortOrder: 42 },
  { code: 'RESUME', name: 'Lanjutkan Transaksi', nameKey: 'action.resume', actionType: 'STANDARD', sortOrder: 43 },
  { code: 'DISCOUNT_LINE', name: 'Diskon per Baris', nameKey: 'action.discountLine', actionType: 'STANDARD', sortOrder: 44 },
  { code: 'DISCOUNT_CART', name: 'Diskon Keranjang', nameKey: 'action.discountCart', actionType: 'STANDARD', sortOrder: 45 },
  // Mengubah harga jual di luar buku harga selalu diaudit, tanpa kecuali.
  { code: 'PRICE_OVERRIDE', name: 'Ubah Harga Manual', nameKey: 'action.priceOverride', actionType: 'SENSITIVE', sortOrder: 46 },
  { code: 'OPEN_SHIFT', name: 'Buka Shift', nameKey: 'action.openShift', actionType: 'WORKFLOW', sortOrder: 47 },
  { code: 'CLOSE_SHIFT', name: 'Tutup Shift', nameKey: 'action.closeShift', actionType: 'WORKFLOW', sortOrder: 48 },
  // Satu aksi untuk kas masuk dan keluar; arahnya ada pada movement_type, dan
  // alasannya wajib diisi. Kas yang berpindah tanpa alasan tidak dapat
  // direkonsiliasi kemudian.
  { code: 'CASH_MOVE', name: 'Kas Masuk / Keluar', nameKey: 'action.cashMove', actionType: 'SENSITIVE', sortOrder: 49 },

  // --- Versi 12: aksi yang diperlukan vertikal, tetapi bukan miliknya --------
  //
  // Ketiganya diusulkan IR-004 masuk katalog INTI, bukan katalog koperasi, dan
  // usulan itu diterima: tidak satu pun khas koperasi. eMedik memerlukan
  // DISBURSE untuk pencairan klaim, ANALYZE adalah pola umum "menilai sebelum
  // memutuskan", dan WRITE_OFF diperlukan piutang usaha inti.
  //
  // Mendefinisikannya sebagai COOPERATIVE_DISBURSE akan memaksa tiap vertikal
  // berikutnya membuat kembarannya sendiri, dan layar pengaturan hak akses
  // akan memuat tiga aksi berbeda yang artinya sama.
  { code: 'ANALYZE', name: 'Analisis', nameKey: 'action.analyze', actionType: 'WORKFLOW', sortOrder: 50 },
  /*
   * DISBURSE dan WRITE_OFF menuntut pengesahan ulang.
   *
   * Keduanya memindahkan atau menghapus uang: pencairan mengeluarkan dana, dan
   * penghapusbukuan menghilangkan piutang dari neraca. Sesi yang ditinggalkan
   * terbuka di meja kerja tidak boleh cukup untuk melakukan keduanya.
   */
  { code: 'DISBURSE', name: 'Cairkan Dana', nameKey: 'action.disburse', actionType: 'SENSITIVE', sortOrder: 51, requiresStepUp: true },
  { code: 'WRITE_OFF', name: 'Hapus Buku', nameKey: 'action.writeOff', actionType: 'SENSITIVE', sortOrder: 52, requiresStepUp: true },
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

/**
 * Aksi pada layar kasir.
 *
 * `UPDATE` di sini berarti mengubah atau membatalkan baris sebelum pembayaran;
 * `CANCEL` berarti membatalkan transaksi yang sudah selesai. Keduanya sengaja
 * dibedakan, dan yang kedua hanya dimiliki supervisor ke atas.
 */
const POS_SALE_ACTIONS = [
  'READ', 'CREATE', 'UPDATE', 'CANCEL', 'PRINT',
  'SELL', 'HOLD', 'RESUME',
  'DISCOUNT_LINE', 'DISCOUNT_CART', 'PRICE_OVERRIDE',
  'APPROVE', 'REJECT',
  'VIEW_AMOUNT', 'VIEW_COST',
];

export const MENU_TREE_SEED: MenuNodeSeed[] = [
  // 01 Beranda
  { code: 'HOME', label: 'Beranda', translationKey: 'menu.home', route: '/app', icon: 'home', sortOrder: 1, actions: ['READ'] },
  { code: 'HOME_DASHBOARD', parentCode: 'HOME', label: 'Dashboard Saya', translationKey: 'menu.home.dashboard', route: '/app', icon: 'layout-dashboard', sortOrder: 1, actions: ['READ'] },
  { code: 'HOME_APPROVAL_INBOX', parentCode: 'HOME', label: 'Kotak Masuk Persetujuan', translationKey: 'menu.home.approvalInbox', route: '/app/approvals', icon: 'inbox', sortOrder: 2, actions: ['READ', 'APPROVE', 'REJECT'] },
  { code: 'HOME_NOTIFICATIONS', parentCode: 'HOME', label: 'Notifikasi', translationKey: 'menu.home.notifications', route: '/app/notifications', icon: 'bell', sortOrder: 3, actions: ['READ'] },

  // 02 Kasir / POS — langsung di root
  { code: 'POS', label: 'Kasir / POS', translationKey: 'menu.pos', route: '/app/pos', icon: 'shopping-cart', moduleCode: 'POS', sortOrder: 2, actions: ['READ'] },
  { code: 'POS_SALE', parentCode: 'POS', label: 'Kasir', translationKey: 'menu.pos.sale', route: '/app/pos/kasir', icon: 'scan-barcode', moduleCode: 'POS', sortOrder: 1, actions: POS_SALE_ACTIONS },
  { code: 'POS_PHARMACY', parentCode: 'POS', label: 'POS Apotik', translationKey: 'menu.pos.pharmacy', route: '/app/apotik/pos', icon: 'pill', moduleCode: 'POS', sortOrder: 2, actions: POS_SALE_ACTIONS },
  { code: 'POS_HELD', parentCode: 'POS', label: 'Transaksi Ditahan', translationKey: 'menu.pos.held', route: '/app/pos/ditahan', icon: 'pause-circle', moduleCode: 'POS', sortOrder: 3, actions: ['READ', 'RESUME', 'CANCEL'] },
  { code: 'POS_SHIFT', parentCode: 'POS', label: 'Shift Kasir', translationKey: 'menu.pos.shift', route: '/app/pos/shifts', icon: 'clock', moduleCode: 'POS', sortOrder: 4, actions: ['READ', 'CREATE', 'UPDATE', 'OPEN_SHIFT', 'CLOSE_SHIFT', 'APPROVE', 'PRINT', 'EXPORT'] },
  { code: 'POS_CASH', parentCode: 'POS', label: 'Kas dan Rekonsiliasi', translationKey: 'menu.pos.cash', route: '/app/pos/kas', icon: 'banknote', moduleCode: 'POS', sortOrder: 5, actions: ['READ', 'CASH_MOVE', 'RECONCILE', 'PRINT', 'EXPORT'] },
  { code: 'POS_RETURN', parentCode: 'POS', label: 'Retur dan Refund', translationKey: 'menu.pos.return', route: '/app/pos/retur', icon: 'undo-2', moduleCode: 'POS', sortOrder: 6, actions: ['READ', 'CREATE', 'RETURN', 'RETURN_APPROVE', 'REFUND_APPROVE', 'REJECT', 'PRINT', 'EXPORT'] },
  { code: 'POS_TERMINAL', parentCode: 'POS', label: 'Terminal POS', translationKey: 'menu.pos.terminal', route: '/app/pos/terminals', icon: 'monitor', moduleCode: 'POS', sortOrder: 7, actions: CRUD },
  { code: 'POS_REGISTER_ASSIGN', parentCode: 'POS', label: 'Penugasan Register', translationKey: 'menu.pos.registerAssign', route: '/app/pos/penugasan', icon: 'user-check', moduleCode: 'POS', sortOrder: 8, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'POS_PROMO', parentCode: 'POS', label: 'Aturan Diskon', translationKey: 'menu.pos.promo', route: '/app/pos/aturan-diskon', icon: 'percent', moduleCode: 'POS', sortOrder: 9, actions: CRUD },
  { code: 'POS_REPORT', parentCode: 'POS', label: 'Laporan POS', translationKey: 'menu.pos.report', route: '/app/pos/laporan', icon: 'bar-chart-3', moduleCode: 'POS', sortOrder: 10, actions: ['READ', 'PRINT', 'EXPORT', 'VIEW_AMOUNT', 'VIEW_COST', 'VIEW_PROFIT', 'AUDIT_READ'] },

  // 03 Penjualan
  { code: 'SALES', label: 'Penjualan', translationKey: 'menu.sales', icon: 'trending-up', moduleCode: 'SALES', sortOrder: 3, actions: ['READ'] },
  { code: 'SALES_ORDER', parentCode: 'SALES', label: 'Pesanan Penjualan', translationKey: 'menu.sales.order', route: '/app/sales/orders', moduleCode: 'SALES', sortOrder: 1, actions: DOC },
  { code: 'SALES_REPORT', parentCode: 'SALES', label: 'Laporan Penjualan', translationKey: 'menu.sales.report', route: '/app/sales/reports', moduleCode: 'SALES', sortOrder: 2, actions: ['READ', 'EXPORT', 'VIEW_AMOUNT', 'VIEW_PROFIT'] },

  // 04 Produk dan Harga
  { code: 'CATALOG', label: 'Produk dan Harga', translationKey: 'menu.catalog', icon: 'package', moduleCode: 'PRODUCT_PRICING', sortOrder: 4, actions: ['READ'] },
  { code: 'CATALOG_PRODUCT', parentCode: 'CATALOG', label: 'Produk', translationKey: 'menu.catalog.product', route: '/app/products', icon: 'box', moduleCode: 'PRODUCT_PRICING', sortOrder: 1, actions: [...CRUD, 'IMPORT', 'HARD_DELETE', 'RESTORE', 'VIEW_COST'] },
  { code: 'CATALOG_CATEGORY', parentCode: 'CATALOG', label: 'Kategori', translationKey: 'menu.catalog.category', route: '/app/product-categories', icon: 'folder-tree', moduleCode: 'PRODUCT_PRICING', sortOrder: 2, actions: [...CRUD, 'HARD_DELETE', 'RESTORE'] },
  { code: 'CATALOG_UOM', parentCode: 'CATALOG', label: 'Satuan (UOM)', translationKey: 'menu.catalog.uom', route: '/app/uoms', icon: 'ruler', moduleCode: 'PRODUCT_PRICING', sortOrder: 3, actions: [...CRUD, 'HARD_DELETE', 'RESTORE'] },
  { code: 'CATALOG_PRICE_BOOK', parentCode: 'CATALOG', label: 'Buku Harga', translationKey: 'menu.catalog.priceBook', route: '/app/price-books', icon: 'tag', moduleCode: 'PRODUCT_PRICING', sortOrder: 4, actions: CRUD },
  { code: 'CATALOG_TAX', parentCode: 'CATALOG', label: 'Pajak', translationKey: 'menu.catalog.tax', route: '/app/tax-categories', icon: 'percent', moduleCode: 'PRODUCT_PRICING', sortOrder: 5, actions: CRUD },

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
  { code: 'INVENTORY_STOCK_COUNT', parentCode: 'INVENTORY', label: 'Stock Opname', translationKey: 'menu.inventory.stockCount', route: '/app/stock-counts', icon: 'clipboard-check', moduleCode: 'INVENTORY', sortOrder: 7, actions: DOC },

  // 08 Produksi
  { code: 'MANUFACTURING', label: 'Produksi', translationKey: 'menu.manufacturing', icon: 'factory', moduleCode: 'MANUFACTURING', sortOrder: 8, actions: ['READ'] },
  { code: 'MANUFACTURING_BOM', parentCode: 'MANUFACTURING', label: 'Bill of Material', translationKey: 'menu.manufacturing.bom', route: '/app/boms', moduleCode: 'MANUFACTURING', sortOrder: 1, actions: CRUD },

  // 09 Quality Control
  { code: 'QUALITY', label: 'Quality Control', translationKey: 'menu.quality', icon: 'badge-check', moduleCode: 'QUALITY_CONTROL', sortOrder: 9, actions: ['READ'] },

  // 10 Distribusi dan Pengiriman
  { code: 'SHIPPING', label: 'Distribusi dan Pengiriman', translationKey: 'menu.shipping', icon: 'truck', moduleCode: 'SHIPPING', sortOrder: 10, actions: ['READ'] },
  { code: 'SHIPPING_CARRIER', parentCode: 'SHIPPING', label: 'Ekspedisi', translationKey: 'menu.shipping.carrier', route: '/app/carriers', moduleCode: 'SHIPPING', sortOrder: 1, actions: CRUD },

  // 11 Keuangan dan Akuntansi
  { code: 'FINANCE', label: 'Keuangan dan Akuntansi', translationKey: 'menu.finance', icon: 'wallet', moduleCode: 'ACCOUNTING', sortOrder: 11, actions: ['READ'] },
  { code: 'FINANCE_COA', parentCode: 'FINANCE', label: 'Bagan Akun', translationKey: 'menu.finance.coa', route: '/app/chart-of-accounts', moduleCode: 'ACCOUNTING', sortOrder: 1, actions: CRUD },
  { code: 'FINANCE_JOURNAL', parentCode: 'FINANCE', label: 'Jurnal', translationKey: 'menu.finance.journal', route: '/app/journal-entries', moduleCode: 'ACCOUNTING', sortOrder: 2, actions: [...DOC, 'POST', 'CLOSE_PERIOD', 'REOPEN'] },

  // 12 Investor dan Bagi Hasil
  { code: 'INVESTOR', label: 'Investor dan Bagi Hasil', translationKey: 'menu.investor', icon: 'handshake', moduleCode: 'INVESTOR_REVENUE_SHARE', sortOrder: 12, actions: ['READ', 'VIEW_AMOUNT'] },

  // 13 SDM dan Payroll
  { code: 'HR', label: 'SDM dan Payroll', translationKey: 'menu.hr', icon: 'id-card', moduleCode: 'HUMAN_RESOURCES', sortOrder: 13, actions: ['READ'] },
  { code: 'HR_EMPLOYEE', parentCode: 'HR', label: 'Pegawai', translationKey: 'menu.hr.employee', route: '/app/employees', moduleCode: 'HUMAN_RESOURCES', sortOrder: 1, actions: CRUD },
  { code: 'HR_DEPARTMENT', parentCode: 'HR', label: 'Departemen', translationKey: 'menu.hr.department', route: '/app/departments', moduleCode: 'HUMAN_RESOURCES', sortOrder: 2, actions: CRUD },
  { code: 'HR_POSITION', parentCode: 'HR', label: 'Jabatan', translationKey: 'menu.hr.position', route: '/app/job-positions', moduleCode: 'HUMAN_RESOURCES', sortOrder: 3, actions: CRUD },
  { code: 'HR_LEAVE_TYPE', parentCode: 'HR', label: 'Jenis Cuti', translationKey: 'menu.hr.leaveType', route: '/app/leave-types', moduleCode: 'HUMAN_RESOURCES', sortOrder: 4, actions: CRUD },

  // 14 Aset dan Pemeliharaan
  { code: 'ASSET', label: 'Aset dan Pemeliharaan', translationKey: 'menu.asset', icon: 'wrench', moduleCode: 'ASSET', sortOrder: 14, actions: ['READ'] },

  // 15 Workflow dan Persetujuan
  { code: 'WORKFLOW', label: 'Workflow dan Persetujuan', translationKey: 'menu.workflow', icon: 'git-branch', moduleCode: 'WORKFLOW', sortOrder: 15, actions: ['READ'] },

  // 16 Laporan dan Analitik
  { code: 'REPORTING', label: 'Laporan dan Analitik', translationKey: 'menu.reporting', icon: 'bar-chart-3', moduleCode: 'REPORTING_ANALYTICS', sortOrder: 16, actions: ['READ', 'EXPORT'] },

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
  { code: 'INTEGRATION', label: 'Integrasi dan API', translationKey: 'menu.integration', icon: 'plug', moduleCode: 'INTEGRATION_API', sortOrder: 19, actions: ['READ'] },

  // 20 Administrasi Sistem
  { code: 'ADMIN', label: 'Administrasi Sistem', translationKey: 'menu.admin', icon: 'settings', sortOrder: 20, actions: ['READ'] },
  { code: 'ADMIN_USER', parentCode: 'ADMIN', label: 'Pengguna', translationKey: 'menu.admin.user', route: '/app/users', icon: 'user-cog', sortOrder: 1, actions: CRUD },
  { code: 'ADMIN_ROLE', parentCode: 'ADMIN', label: 'Role', translationKey: 'menu.admin.role', route: '/app/roles', icon: 'shield', sortOrder: 2, actions: CRUD },
  { code: 'ADMIN_PERMISSION', parentCode: 'ADMIN', label: 'Hak Akses Menu', translationKey: 'menu.admin.permission', route: '/app/role-permissions', icon: 'key', sortOrder: 3, actions: ['READ', 'UPDATE'] },
  { code: 'ADMIN_AUDIT', parentCode: 'ADMIN', label: 'Audit', translationKey: 'menu.admin.audit', route: '/app/audit', icon: 'scroll-text', sortOrder: 4, actions: ['READ', 'EXPORT'] },
  { code: 'ADMIN_SETTING', parentCode: 'ADMIN', label: 'Pengaturan', translationKey: 'menu.admin.setting', route: '/app/settings', icon: 'sliders', sortOrder: 5, actions: ['READ', 'UPDATE'] },

  // 21 Bantuan dan Dukungan
  { code: 'SUPPORT', label: 'Bantuan dan Dukungan', translationKey: 'menu.support', route: '/app/support', icon: 'life-buoy', sortOrder: 21, actions: ['READ'] },

  // ==========================================================================
  // Versi 9 — Marketplace dan Toko Online
  //
  // Root baru, bukan cabang di bawah root yang ada. Katalog role menunjuk MODUL
  // (kode menu root), sehingga menempatkan marketplace di bawah SALES akan
  // membuat setiap role penjualan otomatis memperoleh hak marketplace.
  //
  // Root SHIPPING yang sudah ada TIDAK diduplikasi; ia diperluas di bawah.
  // ==========================================================================

  // 22 Beranda Marketplace
  { code: 'MARKETPLACE_HOME', label: 'Beranda Marketplace', translationKey: 'menu.marketplaceHome', route: '/app/marketplace', icon: 'store', moduleCode: 'MARKETPLACE', sortOrder: 22, actions: ['READ'] },
  { code: 'MARKETPLACE_HOME_SUMMARY', parentCode: 'MARKETPLACE_HOME', label: 'Ringkasan Penjualan Online', translationKey: 'menu.marketplaceHome.summary', route: '/app/marketplace', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'VIEW_AMOUNT'] },
  { code: 'MARKETPLACE_HOME_TODO', parentCode: 'MARKETPLACE_HOME', label: 'Perlu Diproses', translationKey: 'menu.marketplaceHome.todo', route: '/app/marketplace/todo', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ'] },

  // 23 Pusat Aktivasi Marketplace
  { code: 'MARKETPLACE_ACTIVATION', label: 'Pusat Aktivasi Marketplace', translationKey: 'menu.marketplaceActivation', route: '/app/marketplace/aktivasi', icon: 'rocket', moduleCode: 'MARKETPLACE', sortOrder: 23, actions: ['READ'] },
  { code: 'MARKETPLACE_ENROLLMENT', parentCode: 'MARKETPLACE_ACTIVATION', label: 'Pendaftaran Seller', translationKey: 'menu.marketplaceActivation.enrollment', route: '/app/marketplace/aktivasi', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'CREATE', 'UPDATE', 'SUBMIT'] },
  // Kesiapan dan checklist go-live saat ini disajikan pada halaman aktivasi.
  // Ditandai comingSoon sampai keduanya punya halaman tersendiri, supaya menu
  // tidak mengarah ke route yang belum ada.
  { code: 'MARKETPLACE_READINESS', parentCode: 'MARKETPLACE_ACTIVATION', label: 'Status Kesiapan', translationKey: 'menu.marketplaceActivation.readiness', route: '/app/marketplace/aktivasi/kesiapan', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ'] },
  { code: 'MARKETPLACE_GOLIVE', parentCode: 'MARKETPLACE_ACTIVATION', label: 'Checklist Go-Live', translationKey: 'menu.marketplaceActivation.goLive', route: '/app/marketplace/aktivasi/go-live', moduleCode: 'MARKETPLACE', sortOrder: 3, actions: ['READ', 'REVIEW', 'APPROVE'] },
  { code: 'ESMARTLINK_ACCOUNT', parentCode: 'MARKETPLACE_ACTIVATION', label: 'Akun eSmartlink', translationKey: 'menu.marketplaceActivation.esmartlink', route: '/app/marketplace/aktivasi/esmartlink', moduleCode: 'MARKETPLACE', sortOrder: 4, actions: ['READ', 'CREATE', 'MANAGE_CREDENTIAL'] },

  // 24 Pengaturan Toko Online
  { code: 'ONLINE_STORE', label: 'Pengaturan Toko Online', translationKey: 'menu.onlineStore', icon: 'store', moduleCode: 'MARKETPLACE', sortOrder: 24, actions: ['READ'] },
  { code: 'ONLINE_STORE_PROFILE', parentCode: 'ONLINE_STORE', label: 'Profil Toko', translationKey: 'menu.onlineStore.profile', route: '/app/marketplace/toko', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'UPDATE'] },
  { code: 'ONLINE_STORE_DOMAIN', parentCode: 'ONLINE_STORE', label: 'Domain Toko', translationKey: 'menu.onlineStore.domain', route: '/app/marketplace/toko/domain', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'ONLINE_STORE_POLICY', parentCode: 'ONLINE_STORE', label: 'Kebijakan Toko', translationKey: 'menu.onlineStore.policy', route: '/app/marketplace/toko/kebijakan', moduleCode: 'MARKETPLACE', sortOrder: 3, actions: ['READ', 'UPDATE', 'PUBLISH'] },

  // 25 Katalog Online
  { code: 'ONLINE_CATALOG', label: 'Katalog Online', translationKey: 'menu.onlineCatalog', icon: 'package-search', moduleCode: 'MARKETPLACE', sortOrder: 25, actions: ['READ'] },
  { code: 'ONLINE_LISTING', parentCode: 'ONLINE_CATALOG', label: 'Produk Online', translationKey: 'menu.onlineCatalog.listing', route: '/app/marketplace/listing', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: [...CRUD, 'IMPORT', 'RESTORE', 'SUBMIT', 'PUBLISH', 'UNPUBLISH'] },
  { code: 'ONLINE_LISTING_MEDIA', parentCode: 'ONLINE_CATALOG', label: 'Media Produk', translationKey: 'menu.onlineCatalog.media', route: '/app/marketplace/listing/media', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: [...CRUD, 'MODERATE'] },
  { code: 'ONLINE_LISTING_REVIEW', parentCode: 'ONLINE_CATALOG', label: 'Moderasi dan Publikasi', translationKey: 'menu.onlineCatalog.review', route: '/app/marketplace/listing/moderasi', moduleCode: 'MARKETPLACE', sortOrder: 3, actions: ['READ', 'REVIEW', 'APPROVE', 'REJECT', 'PUBLISH', 'UNPUBLISH'] },
  { code: 'ONLINE_PRICE_STOCK', parentCode: 'ONLINE_CATALOG', label: 'Harga dan Stok Online', translationKey: 'menu.onlineCatalog.priceStock', route: '/app/marketplace/listing/harga', moduleCode: 'MARKETPLACE', sortOrder: 4, actions: ['READ', 'UPDATE', 'IMPORT', 'EXPORT', 'VIEW_COST'] },

  // 26 Penjualan Online
  { code: 'ONLINE_SALES', label: 'Penjualan Online', translationKey: 'menu.onlineSales', icon: 'shopping-bag', moduleCode: 'MARKETPLACE', sortOrder: 26, actions: ['READ'] },
  { code: 'ONLINE_ORDER', parentCode: 'ONLINE_SALES', label: 'Pesanan Online', translationKey: 'menu.onlineSales.order', route: '/app/marketplace/pesanan', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'UPDATE', 'CANCEL', 'PRINT', 'EXPORT', 'VIEW_AMOUNT'] },
  { code: 'ONLINE_ORDER_GROUP', parentCode: 'ONLINE_SALES', label: 'Grup Pesanan Multi-Seller', translationKey: 'menu.onlineSales.orderGroup', route: '/app/marketplace/pesanan/grup', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ'] },

  // 27 Pembayaran Marketplace
  { code: 'MARKETPLACE_PAYMENT', label: 'Pembayaran Marketplace', translationKey: 'menu.marketplacePayment', icon: 'wallet', moduleCode: 'MARKETPLACE', sortOrder: 27, actions: ['READ'] },
  { code: 'MARKETPLACE_PAYMENT_ORDER', parentCode: 'MARKETPLACE_PAYMENT', label: 'Payment Order', translationKey: 'menu.marketplacePayment.order', route: '/app/marketplace/pembayaran', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'CREATE', 'VIEW_AMOUNT'] },
  { code: 'MARKETPLACE_RECONCILIATION', parentCode: 'MARKETPLACE_PAYMENT', label: 'Rekonsiliasi', translationKey: 'menu.marketplacePayment.reconciliation', route: '/app/marketplace/pembayaran/rekonsiliasi', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ', 'RECONCILE', 'EXPORT'] },
  { code: 'MARKETPLACE_REFUND', parentCode: 'MARKETPLACE_PAYMENT', label: 'Refund', translationKey: 'menu.marketplacePayment.refund', route: '/app/marketplace/pembayaran/refund', moduleCode: 'MARKETPLACE', sortOrder: 3, actions: ['READ', 'CREATE', 'REFUND_APPROVE', 'VIEW_AMOUNT'] },

  // 28 Reservation dan Routing
  { code: 'ALLOCATION', label: 'Reservation dan Routing', translationKey: 'menu.allocation', icon: 'git-branch', moduleCode: 'MARKETPLACE', sortOrder: 28, actions: ['READ'] },
  { code: 'ALLOCATION_RESERVATION', parentCode: 'ALLOCATION', label: 'Reservasi Stok', translationKey: 'menu.allocation.reservation', route: '/app/marketplace/reservasi', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'RESERVE', 'RELEASE'] },
  { code: 'ALLOCATION_ROUTING', parentCode: 'ALLOCATION', label: 'Aturan Routing', translationKey: 'menu.allocation.routing', route: '/app/marketplace/routing', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: [...CRUD] },

  // 29 Fulfillment Online
  { code: 'FULFILLMENT', label: 'Fulfillment Online', translationKey: 'menu.fulfillment', icon: 'boxes', moduleCode: 'MARKETPLACE', sortOrder: 29, actions: ['READ'] },
  { code: 'FULFILLMENT_ORDER', parentCode: 'FULFILLMENT', label: 'Fulfillment Order', translationKey: 'menu.fulfillment.order', route: '/app/marketplace/fulfillment', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'CREATE', 'ASSIGN'] },
  { code: 'FULFILLMENT_PICKING', parentCode: 'FULFILLMENT', label: 'Picking', translationKey: 'menu.fulfillment.picking', route: '/app/marketplace/picking', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ', 'PICK', 'PRINT'] },
  { code: 'FULFILLMENT_PACKING', parentCode: 'FULFILLMENT', label: 'Packing', translationKey: 'menu.fulfillment.packing', route: '/app/marketplace/packing', moduleCode: 'MARKETPLACE', sortOrder: 3, actions: ['READ', 'PACK', 'PRINT'] },

  // 30 Retur dan Refund
  { code: 'RETURN_REFUND', label: 'Retur dan Refund', translationKey: 'menu.returnRefund', icon: 'undo-2', moduleCode: 'MARKETPLACE', sortOrder: 30, actions: ['READ'] },
  { code: 'RETURN_REQUEST', parentCode: 'RETURN_REFUND', label: 'Permintaan Retur', translationKey: 'menu.returnRefund.request', route: '/app/marketplace/retur', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'CREATE', 'REVIEW', 'RETURN_APPROVE', 'REJECT'] },
  { code: 'RETURN_INSPECTION', parentCode: 'RETURN_REFUND', label: 'Inspeksi Retur', translationKey: 'menu.returnRefund.inspection', route: '/app/marketplace/retur/inspeksi', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ', 'CREATE', 'UPDATE'] },
  { code: 'RETURN_DISPUTE', parentCode: 'RETURN_REFUND', label: 'Sengketa', translationKey: 'menu.returnRefund.dispute', route: '/app/marketplace/sengketa', moduleCode: 'MARKETPLACE', sortOrder: 3, actions: ['READ', 'ASSIGN', 'APPROVE', 'REJECT'] },

  // 31 Promosi Marketplace
  { code: 'MARKETPLACE_PROMO', label: 'Promosi Marketplace', translationKey: 'menu.marketplacePromo', icon: 'ticket-percent', moduleCode: 'MARKETPLACE', sortOrder: 31, actions: ['READ'] },
  { code: 'MARKETPLACE_VOUCHER', parentCode: 'MARKETPLACE_PROMO', label: 'Voucher Toko', translationKey: 'menu.marketplacePromo.voucher', route: '/app/marketplace/voucher', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: [...CRUD, 'APPROVE'] },
  { code: 'MARKETPLACE_CAMPAIGN', parentCode: 'MARKETPLACE_PROMO', label: 'Kampanye dan Flash Sale', translationKey: 'menu.marketplacePromo.campaign', route: '/app/marketplace/kampanye', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: [...CRUD, 'APPROVE'] },

  // 32 Pelanggan Marketplace
  { code: 'MARKETPLACE_CUSTOMER', label: 'Pelanggan Marketplace', translationKey: 'menu.marketplaceCustomer', icon: 'messages-square', moduleCode: 'MARKETPLACE', sortOrder: 32, actions: ['READ'] },
  { code: 'MARKETPLACE_CHAT', parentCode: 'MARKETPLACE_CUSTOMER', label: 'Chat Pembeli', translationKey: 'menu.marketplaceCustomer.chat', route: '/app/marketplace/chat', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'CREATE'] },
  { code: 'MARKETPLACE_REVIEW', parentCode: 'MARKETPLACE_CUSTOMER', label: 'Ulasan Produk', translationKey: 'menu.marketplaceCustomer.review', route: '/app/marketplace/ulasan', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ', 'CREATE', 'MODERATE'] },

  // 33 Performa Toko
  { code: 'STORE_PERFORMANCE', label: 'Performa Toko', translationKey: 'menu.storePerformance', route: '/app/marketplace/performa', icon: 'trending-up', moduleCode: 'MARKETPLACE', sortOrder: 33, actions: ['READ', 'EXPORT', 'VIEW_AMOUNT', 'VIEW_PROFIT'] },

  // 34 Operasi Marketplace Platform
  { code: 'MARKETPLACE_PLATFORM', label: 'Operasi Marketplace Platform', translationKey: 'menu.marketplacePlatform', icon: 'shield-check', moduleCode: 'MARKETPLACE', sortOrder: 34, actions: ['READ'] },
  { code: 'MARKETPLACE_SELLER_ADMIN', parentCode: 'MARKETPLACE_PLATFORM', label: 'Seller dan Verifikasi', translationKey: 'menu.marketplacePlatform.seller', route: '/platform/marketplace/sellers', moduleCode: 'MARKETPLACE', sortOrder: 1, actions: ['READ', 'REVIEW', 'APPROVE', 'REJECT'] },
  { code: 'MARKETPLACE_MODERATION', parentCode: 'MARKETPLACE_PLATFORM', label: 'Moderasi', translationKey: 'menu.marketplacePlatform.moderation', route: '/platform/marketplace/moderasi', moduleCode: 'MARKETPLACE', sortOrder: 2, actions: ['READ', 'MODERATE', 'APPROVE', 'REJECT'] },
  { code: 'MARKETPLACE_FEE', parentCode: 'MARKETPLACE_PLATFORM', label: 'Fee Marketplace', translationKey: 'menu.marketplacePlatform.fee', route: '/platform/marketplace/fee', moduleCode: 'MARKETPLACE', sortOrder: 3, actions: [...CRUD, 'APPROVE', 'VIEW_AMOUNT'] },

  // 35 Tiket Dukungan
  { code: 'SUPPORT_TICKET', label: 'Tiket Dukungan', translationKey: 'menu.supportTicket', route: '/app/tiket', icon: 'ticket', moduleCode: 'SUPPORT', sortOrder: 35, actions: ['READ', 'CREATE', 'UPDATE', 'ASSIGN', 'CANCEL'] },

  // 36 Bantuan Marketplace
  { code: 'MARKETPLACE_HELP', label: 'Bantuan Marketplace', translationKey: 'menu.marketplaceHelp', route: '/app/marketplace/bantuan', icon: 'book-open', moduleCode: 'MARKETPLACE', sortOrder: 36, actions: ['READ'] },

  // --- Perluasan root SHIPPING yang SUDAH ADA ------------------------------
  // Bukan root baru. Menambah root SHIPPING kedua akan memecah hak setiap role
  // logistik menjadi dua modul yang harus dikelola terpisah.
  { code: 'SHIPPING_PROVIDER', parentCode: 'SHIPPING', label: 'Provider Pengiriman', translationKey: 'menu.shipping.provider', route: '/app/pengiriman/provider', moduleCode: 'SHIPPING', sortOrder: 10, actions: [...CRUD, 'MANAGE_CREDENTIAL'] },
  { code: 'SHIPPING_BOOKING', parentCode: 'SHIPPING', label: 'Booking dan Label', translationKey: 'menu.shipping.booking', route: '/app/pengiriman/booking', moduleCode: 'SHIPPING', sortOrder: 11, actions: ['READ', 'CREATE', 'CANCEL', 'PRINT', 'SHIP'] },
  { code: 'SHIPPING_TRACKING', parentCode: 'SHIPPING', label: 'Pelacakan Kiriman', translationKey: 'menu.shipping.tracking', route: '/app/pengiriman/tracking', moduleCode: 'SHIPPING', sortOrder: 12, actions: ['READ', 'DELIVER'] },

  // ==========================================================================
  // Versi 10 — Tata Kelola Surat
  //
  // Root tersendiri, bukan cabang di bawah ADMIN. Katalog role menunjuk MODUL
  // (kode menu root); menempatkan surat di bawah ADMIN akan membuat setiap
  // administrator sistem otomatis berhak menyetujui surat resmi, dan
  // menyetujui surat adalah wewenang jabatan, bukan wewenang teknis.
  // ==========================================================================

  { code: 'SURAT', label: 'Tata Kelola Surat', translationKey: 'menu.surat', icon: 'mail', sortOrder: 26, actions: ['READ'] },
  { code: 'SURAT_MASUK', parentCode: 'SURAT', label: 'Surat Masuk', translationKey: 'menu.surat.masuk', route: '/app/surat/masuk', icon: 'mail-open', moduleCode: 'SURAT', sortOrder: 1, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT', 'EXPORT'] },
  { code: 'SURAT_KELUAR', parentCode: 'SURAT', label: 'Surat Keluar', translationKey: 'menu.surat.keluar', route: '/app/surat/keluar', icon: 'send', moduleCode: 'SURAT', sortOrder: 2, actions: DOC },
  { code: 'SURAT_DISPOSISI', parentCode: 'SURAT', label: 'Disposisi Saya', translationKey: 'menu.surat.disposisi', route: '/app/surat/disposisi', icon: 'forward', moduleCode: 'SURAT', sortOrder: 3, actions: ['READ', 'UPDATE'] },
  { code: 'SURAT_ARSIP', parentCode: 'SURAT', label: 'Arsip Surat', translationKey: 'menu.surat.arsip', route: '/app/surat/arsip', icon: 'archive', moduleCode: 'SURAT', sortOrder: 4, actions: ['READ', 'EXPORT'] },
  { code: 'SURAT_KLASIFIKASI', parentCode: 'SURAT', label: 'Klasifikasi Surat', translationKey: 'menu.surat.klasifikasi', route: '/app/surat/klasifikasi', icon: 'tags', moduleCode: 'SURAT', sortOrder: 5, actions: CRUD },
  { code: 'SURAT_PENOMORAN', parentCode: 'SURAT', label: 'Skema Penomoran', translationKey: 'menu.surat.penomoran', route: '/app/surat/penomoran', icon: 'hash', moduleCode: 'SURAT', sortOrder: 6, actions: CRUD },
  { code: 'SURAT_ALUR', parentCode: 'SURAT', label: 'Alur Persetujuan', translationKey: 'menu.surat.alur', route: '/app/surat/alur', icon: 'git-branch', moduleCode: 'SURAT', sortOrder: 7, actions: CRUD },
  { code: 'SURAT_LOKER', parentCode: 'SURAT', label: 'Loker Arsip', translationKey: 'menu.surat.loker', route: '/app/surat/loker', icon: 'folder-tree', moduleCode: 'SURAT', sortOrder: 8, actions: CRUD },
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
