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
  webRoute: webRouteForScreen(screen),
  flutterModule: 'Inventory Control',
  web,
  flutter,
});

export function webRouteForScreen(screen: number): string {
  if (screen <= 3) return '/app/master/suppliers';
  if (screen <= 6) return '/app/master/customers';
  if (screen === 7) return '/app/master/salespeople';
  if (screen === 8) return '/app/inventory/stock';
  if (screen <= 10) return '/app/inventory/stock-opnames';
  if (screen <= 19) return '/app/inventory/pricing';
  if (screen === 20) return '/app/purchasing/invoices';
  if (screen <= 27) return '/app/purchasing/payables';
  if (screen <= 29) return '/app/purchasing/reports';
  if (screen === 30) return '/app/sales/invoices';
  if (screen <= 38) return '/app/sales/receivables';
  if (screen <= 40) return '/app/sales/note-custody';
  if (screen <= 42) return '/app/sales/receivable-reports';
  if (screen <= 44) return '/app/finance/journals';
  if (screen <= 48) return '/app/finance/profit-loss';
  throw new RangeError(`Nomor layar inventory tidak valid: ${screen}`);
}

/**
 * Kontrak paritas 48 layar dari manual lama. Status hanya boleh dinaikkan bila
 * permukaan tersebut memiliki alur nyata; daftar/teks fitur saja bukan bukti.
 */
export const SALES_INVENTORY_PARITY: InventoryParityItem[] = [
  item(1, 'Data Supplier', 'MASTER', ['/suppliers'], 'OPERATIONAL', 'OPERATIONAL'),
  item(2, 'Membuka Daftar Supplier', 'MASTER', ['/suppliers', '/inventory/party-master-balances/suppliers'], 'OPERATIONAL', 'OPERATIONAL'),
  item(3, 'Menutup Daftar Supplier', 'MASTER', ['/suppliers', '/inventory/party-master-balances/suppliers'], 'OPERATIONAL', 'OPERATIONAL'),
  item(4, 'Data Customer', 'MASTER', ['/customers'], 'OPERATIONAL', 'OPERATIONAL'),
  item(5, 'Membuka Daftar Customer', 'MASTER', ['/customers', '/inventory/party-master-balances/customers'], 'OPERATIONAL', 'OPERATIONAL'),
  item(6, 'Menutup Daftar Customer', 'MASTER', ['/customers', '/inventory/party-master-balances/customers'], 'OPERATIONAL', 'OPERATIONAL'),
  item(7, 'Data Sales atau Penjual Keliling', 'MASTER', ['/salespeople', '/inventory/party-master-balances/salespeople'], 'OPERATIONAL', 'OPERATIONAL'),
  item(8, 'Data Stok Barang', 'STOCK_PRICE', ['/stock/balances', '/inventory/mobile-catalog'], 'OPERATIONAL', 'OPERATIONAL'),
  item(9, 'Laporan Opname Stok', 'STOCK_PRICE', ['/stock-opnames', '/inventory/legacy/stock-opname'], 'OPERATIONAL', 'OPERATIONAL'),
  item(10, 'Mencetak Laporan Opname Stok', 'STOCK_PRICE', ['/reports/stock-opname/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(11, 'Harga Beli dan Harga Jual', 'STOCK_PRICE', ['/inventory/legacy/price-history'], 'OPERATIONAL', 'OPERATIONAL'),
  item(12, 'Mencari Nama/Kode pada Harga Beli/Jual', 'STOCK_PRICE', ['/inventory/legacy/price-history'], 'OPERATIONAL', 'OPERATIONAL'),
  item(13, 'Mencetak Harga Jual', 'STOCK_PRICE', ['/reports/price-sale/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(14, 'Mengekspor Data Harga/Stok ke Excel', 'STOCK_PRICE', ['/reports/stock-list/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(15, 'Mencetak Daftar Stok', 'STOCK_PRICE', ['/reports/stock-list/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(16, 'Hasil Cetak Stok', 'STOCK_PRICE', ['/report-snapshots/:id'], 'OPERATIONAL', 'OPERATIONAL'),
  item(17, 'Menu Master Harga', 'STOCK_PRICE', ['/inventory/price-books', '/inventory/legacy/price-history'], 'OPERATIONAL', 'OPERATIONAL'),
  item(18, 'Master Harga Beli per Supplier', 'STOCK_PRICE', ['/inventory/price-books', '/inventory/legacy/price-history'], 'OPERATIONAL', 'OPERATIONAL'),
  item(19, 'Master Harga Jual per Customer', 'STOCK_PRICE', ['/inventory/price-books', '/inventory/legacy/price-history'], 'OPERATIONAL', 'OPERATIONAL'),
  item(20, 'Proses Pembelian Barang dari Supplier', 'PURCHASE_AP', ['/purchase-orders', '/goods-receipts'], 'OPERATIONAL', 'OPERATIONAL'),
  item(21, 'Tombol Hutang pada Pembelian', 'PURCHASE_AP', ['/inventory/legacy/payables'], 'OPERATIONAL', 'OPERATIONAL'),
  item(22, 'Data Hutang Supplier', 'PURCHASE_AP', ['/inventory/legacy/payables'], 'OPERATIONAL', 'OPERATIONAL'),
  item(23, 'Menampilkan Hutang yang Sudah Lunas', 'PURCHASE_AP', ['/inventory/legacy/payables?includeSettled=true'], 'OPERATIONAL', 'OPERATIONAL'),
  item(24, 'Pembayaran Hutang', 'PURCHASE_AP', ['/ap/payments'], 'OPERATIONAL', 'OPERATIONAL'),
  item(25, 'Melihat Pembayaran Hutang', 'PURCHASE_AP', ['/ap/payments'], 'OPERATIONAL', 'OPERATIONAL'),
  item(26, 'Mencetak Pembayaran Hutang', 'PURCHASE_AP', ['/reports/ap-payment-register/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(27, 'Analisis Hutang', 'PURCHASE_AP', ['/reports/ap-aging/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(28, 'Mencetak Faktur Pembelian Barang', 'PURCHASE_AP', ['/purchase-orders/:id', '/reports/purchase-invoice/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(29, 'Mencetak Laporan Pembelian per Periode', 'PURCHASE_AP', ['/reports/purchase-register/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(30, 'Menu Penjualan', 'SALES_AR', ['/inventory/mobile-orders', '/sales/orders'], 'OPERATIONAL', 'OPERATIONAL'),
  item(31, 'Membuka Piutang dari Menu Penjualan', 'SALES_AR', ['/inventory/legacy/receivables'], 'OPERATIONAL', 'OPERATIONAL'),
  item(32, 'Data Piutang Customer', 'SALES_AR', ['/inventory/legacy/receivables'], 'OPERATIONAL', 'OPERATIONAL'),
  item(33, 'Menampilkan Piutang yang Sudah Lunas', 'SALES_AR', ['/inventory/legacy/receivables?includeSettled=true'], 'OPERATIONAL', 'OPERATIONAL'),
  item(34, 'Pembayaran Piutang', 'SALES_AR', ['/ar/receipts'], 'OPERATIONAL', 'OPERATIONAL'),
  item(35, 'Melihat Pembayaran Piutang', 'SALES_AR', ['/ar/receipts'], 'OPERATIONAL', 'OPERATIONAL'),
  item(36, 'Mencetak Pembayaran Piutang', 'SALES_AR', ['/reports/ar-receipt-register/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(37, 'Analisis Piutang per Customer', 'SALES_AR', ['/reports/ar-aging-customer/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(38, 'Analisis Piutang per Sales', 'SALES_AR', ['/reports/ar-aging-sales/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(39, 'Sales Membawa Nota', 'SALES_AR', ['/sales-note-handovers'], 'OPERATIONAL', 'OPERATIONAL'),
  item(40, 'Nota Sales', 'SALES_AR', ['/sales-note-handovers/:id', '/reports/sales-note-handover/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(41, 'Laporan Piutang', 'SALES_AR', ['/reports/ar-outstanding/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(42, 'Mencetak Laporan Piutang', 'SALES_AR', ['/reports/ar-outstanding/snapshot', '/report-snapshots/:id'], 'OPERATIONAL', 'OPERATIONAL'),
  item(43, 'Kas dan Jurnal', 'FINANCE', ['/inventory/finance-workspace', '/inventory/journals', '/inventory/journals/:id/post', '/inventory/journals/:id/reverse'], 'OPERATIONAL', 'OPERATIONAL'),
  item(44, 'Membuat Perkiraan Baru', 'FINANCE', ['/inventory/chart-accounts'], 'OPERATIONAL', 'OPERATIONAL'),
  item(45, 'Menu Laba/Rugi', 'FINANCE', ['/reports/gross-profit/preview', '/reports/profit-loss/preview'], 'OPERATIONAL', 'OPERATIONAL'),
  item(46, 'Mencetak Laba Rugi Kotor', 'FINANCE', ['/reports/gross-profit/snapshot', '/report-snapshots/:id/print-log'], 'OPERATIONAL', 'OPERATIONAL'),
  item(47, 'Laporan Laba/Rugi', 'FINANCE', ['/reports/profit-loss/preview', '/reports/profit-loss/snapshot'], 'OPERATIONAL', 'OPERATIONAL'),
  item(48, 'Mencetak Laporan Laba/Rugi', 'FINANCE', ['/report-snapshots/:id', '/report-snapshots/:id/print-log'], 'OPERATIONAL', 'OPERATIONAL'),
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
