export type InventoryCoverage = 'OPERATIONAL' | 'READ_ONLY' | 'CONTRACT_ONLY';

export interface InventoryParityItem {
  screen: number;
  legacyName: string;
  domain: 'MASTER' | 'STOCK_PRICE' | 'PURCHASE_AP' | 'SALES_AR' | 'FINANCE';
  api: string[];
  webRoute: string;
  flutterModule: string;
  web: InventoryCoverage;
  flutter: InventoryCoverage;
}

const item = (
  screen: number,
  legacyName: string,
  domain: InventoryParityItem['domain'],
  api: string[],
  web: InventoryCoverage,
  flutter: InventoryCoverage,
): InventoryParityItem => ({
  screen,
  legacyName,
  domain,
  api,
  webRoute: '/app/inventory-control',
  flutterModule: 'Inventory Control',
  web,
  flutter,
});

/**
 * Kontrak paritas 48 layar dari manual lama. Status hanya boleh dinaikkan bila
 * permukaan tersebut memiliki alur nyata; daftar/teks fitur saja bukan bukti.
 */
export const SALES_INVENTORY_PARITY: InventoryParityItem[] = [
  item(1, 'Data Supplier', 'MASTER', ['/suppliers'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(2, 'Membuka Daftar Supplier', 'MASTER', ['/inventory/master-data'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(3, 'Menutup Daftar Supplier', 'MASTER', ['/inventory/master-data'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(4, 'Data Customer', 'MASTER', ['/customers'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(5, 'Membuka Daftar Customer', 'MASTER', ['/inventory/master-data'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(6, 'Menutup Daftar Customer', 'MASTER', ['/inventory/master-data'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(7, 'Data Sales atau Penjual Keliling', 'MASTER', ['/tenant-admin/users', '/inventory/sales-dashboard'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(8, 'Data Stok Barang', 'STOCK_PRICE', ['/stock/balances', '/inventory/mobile-catalog'], 'OPERATIONAL', 'READ_ONLY'),
  item(9, 'Laporan Opname Stok', 'STOCK_PRICE', ['/stock-opnames', '/inventory/legacy/stock-opname'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(10, 'Mencetak Laporan Opname Stok', 'STOCK_PRICE', ['/reports/stock-opname/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(11, 'Harga Beli dan Harga Jual', 'STOCK_PRICE', ['/inventory/legacy/price-history'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(12, 'Mencari Nama/Kode pada Harga Beli/Jual', 'STOCK_PRICE', ['/inventory/legacy/price-history'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(13, 'Mencetak Harga Jual', 'STOCK_PRICE', ['/reports/price-sale/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(14, 'Mengekspor Data Harga/Stok ke Excel', 'STOCK_PRICE', ['/reports/stock-list/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(15, 'Mencetak Daftar Stok', 'STOCK_PRICE', ['/reports/stock-list/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(16, 'Hasil Cetak Stok', 'STOCK_PRICE', ['/report-snapshots/:id'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(17, 'Menu Master Harga', 'STOCK_PRICE', ['/inventory/price-books', '/inventory/legacy/price-history'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(18, 'Master Harga Beli per Supplier', 'STOCK_PRICE', ['/inventory/price-books', '/inventory/legacy/price-history'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(19, 'Master Harga Jual per Customer', 'STOCK_PRICE', ['/inventory/price-books', '/inventory/legacy/price-history'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(20, 'Proses Pembelian Barang dari Supplier', 'PURCHASE_AP', ['/purchase-orders', '/goods-receipts'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(21, 'Tombol Hutang pada Pembelian', 'PURCHASE_AP', ['/inventory/legacy/payables'], 'READ_ONLY', 'READ_ONLY'),
  item(22, 'Data Hutang Supplier', 'PURCHASE_AP', ['/inventory/legacy/payables'], 'READ_ONLY', 'READ_ONLY'),
  item(23, 'Menampilkan Hutang yang Sudah Lunas', 'PURCHASE_AP', ['/inventory/legacy/payables?includeSettled=true'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(24, 'Pembayaran Hutang', 'PURCHASE_AP', ['/ap/payments'], 'OPERATIONAL', 'OPERATIONAL'),
  item(25, 'Melihat Pembayaran Hutang', 'PURCHASE_AP', ['/ap/payments'], 'READ_ONLY', 'READ_ONLY'),
  item(26, 'Mencetak Pembayaran Hutang', 'PURCHASE_AP', ['/reports/ap-payment-register/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(27, 'Analisis Hutang', 'PURCHASE_AP', ['/inventory/parity-summary'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(28, 'Mencetak Faktur Pembelian Barang', 'PURCHASE_AP', ['/reports/purchase-invoice/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(29, 'Mencetak Laporan Pembelian per Periode', 'PURCHASE_AP', ['/reports/purchase-register/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(30, 'Menu Penjualan', 'SALES_AR', ['/inventory/mobile-orders', '/sales/orders'], 'OPERATIONAL', 'OPERATIONAL'),
  item(31, 'Membuka Piutang dari Menu Penjualan', 'SALES_AR', ['/inventory/legacy/receivables'], 'READ_ONLY', 'READ_ONLY'),
  item(32, 'Data Piutang Customer', 'SALES_AR', ['/inventory/legacy/receivables'], 'READ_ONLY', 'READ_ONLY'),
  item(33, 'Menampilkan Piutang yang Sudah Lunas', 'SALES_AR', ['/inventory/legacy/receivables?includeSettled=true'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(34, 'Pembayaran Piutang', 'SALES_AR', ['/ar/receipts'], 'OPERATIONAL', 'OPERATIONAL'),
  item(35, 'Melihat Pembayaran Piutang', 'SALES_AR', ['/ar/receipts'], 'READ_ONLY', 'READ_ONLY'),
  item(36, 'Mencetak Pembayaran Piutang', 'SALES_AR', ['/reports/ar-receipt-register/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(37, 'Analisis Piutang per Customer', 'SALES_AR', ['/inventory/parity-summary'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(38, 'Analisis Piutang per Sales', 'SALES_AR', ['/inventory/parity-summary'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(39, 'Sales Membawa Nota', 'SALES_AR', ['/sales-note-handovers'], 'OPERATIONAL', 'OPERATIONAL'),
  item(40, 'Nota Sales', 'SALES_AR', ['/sales-note-handovers/:id', '/reports/sales-note-handover/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(41, 'Laporan Piutang', 'SALES_AR', ['/reports/ar-outstanding/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(42, 'Mencetak Laporan Piutang', 'SALES_AR', ['/report-snapshots/:id'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(43, 'Kas dan Jurnal', 'FINANCE', ['/journal-entries'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(44, 'Membuat Perkiraan Baru', 'FINANCE', ['/chart-of-accounts'], 'OPERATIONAL', 'CONTRACT_ONLY'),
  item(45, 'Menu Laba/Rugi', 'FINANCE', ['/inventory/parity-summary'], 'READ_ONLY', 'READ_ONLY'),
  item(46, 'Mencetak Laba Rugi Kotor', 'FINANCE', ['/reports/gross-profit/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(47, 'Laporan Laba/Rugi', 'FINANCE', ['/reports/profit-loss/snapshot'], 'READ_ONLY', 'CONTRACT_ONLY'),
  item(48, 'Mencetak Laporan Laba/Rugi', 'FINANCE', ['/report-snapshots/:id'], 'READ_ONLY', 'CONTRACT_ONLY'),
];

export function paritySummary() {
  const count = (surface: 'web' | 'flutter', coverage: InventoryCoverage) =>
    SALES_INVENTORY_PARITY.filter((entry) => entry[surface] === coverage).length;
  return {
    screens: SALES_INVENTORY_PARITY.length,
    web: {
      operational: count('web', 'OPERATIONAL'),
      readOnly: count('web', 'READ_ONLY'),
      contractOnly: count('web', 'CONTRACT_ONLY'),
    },
    flutter: {
      operational: count('flutter', 'OPERATIONAL'),
      readOnly: count('flutter', 'READ_ONLY'),
      contractOnly: count('flutter', 'CONTRACT_ONLY'),
    },
  };
}
