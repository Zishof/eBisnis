export type InventoryTabKey =
  | 'suppliers'
  | 'customers'
  | 'sales'
  | 'stock'
  | 'prices'
  | 'purchases'
  | 'salesOrders'
  | 'cash'
  | 'profit'
  | 'periodClose';

export interface InventoryRouteContext {
  tab: InventoryTabKey;
  title: string;
  screenRange: string;
  route: string;
}

export const inventoryTabRoutes: Record<InventoryTabKey, string> = {
  suppliers: '/app/master/suppliers',
  customers: '/app/master/customers',
  sales: '/app/master/salespeople',
  stock: '/app/inventory/stock',
  prices: '/app/inventory/pricing',
  purchases: '/app/purchasing/invoices',
  salesOrders: '/app/sales/invoices',
  cash: '/app/finance/journals',
  profit: '/app/finance/profit-loss',
  periodClose: '/app/finance/profit-loss?panel=period-close',
};

export function inventoryRouteForLegacyScreen(screen: number): string {
  if (!Number.isInteger(screen) || screen < 1 || screen > 48) {
    throw new RangeError(`Nomor layar inventory tidak valid: ${screen}`);
  }
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
  return '/app/finance/profit-loss';
}

const contexts: Array<[string, InventoryRouteContext]> = [
  ['/app/master/suppliers', { tab: 'suppliers', title: 'Master Supplier', screenRange: '01-03', route: '/app/master/suppliers' }],
  ['/app/master/customers', { tab: 'customers', title: 'Master Customer', screenRange: '04-06', route: '/app/master/customers' }],
  ['/app/master/salespeople', { tab: 'sales', title: 'Master Sales', screenRange: '07', route: '/app/master/salespeople' }],
  ['/app/inventory/stock-opnames', { tab: 'stock', title: 'Stock Opname', screenRange: '09-10', route: '/app/inventory/stock-opnames' }],
  ['/app/inventory/stock', { tab: 'stock', title: 'Persediaan', screenRange: '08', route: '/app/inventory/stock' }],
  ['/app/inventory/pricing', { tab: 'prices', title: 'Harga dan Margin', screenRange: '11-19', route: '/app/inventory/pricing' }],
  ['/app/purchasing/payables', { tab: 'purchases', title: 'Hutang Supplier', screenRange: '21-27', route: '/app/purchasing/payables' }],
  ['/app/purchasing/reports', { tab: 'purchases', title: 'Laporan Pembelian', screenRange: '28-29', route: '/app/purchasing/reports' }],
  ['/app/purchasing/invoices', { tab: 'purchases', title: 'Pembelian', screenRange: '20', route: '/app/purchasing/invoices' }],
  ['/app/sales/receivables', { tab: 'salesOrders', title: 'Piutang Customer', screenRange: '31-38', route: '/app/sales/receivables' }],
  ['/app/sales/note-custody', { tab: 'salesOrders', title: 'Serah-terima Nota', screenRange: '39-40', route: '/app/sales/note-custody' }],
  ['/app/sales/receivable-reports', { tab: 'salesOrders', title: 'Laporan Piutang', screenRange: '41-42', route: '/app/sales/receivable-reports' }],
  ['/app/sales/invoices', { tab: 'salesOrders', title: 'Penjualan', screenRange: '30', route: '/app/sales/invoices' }],
  ['/app/finance/journals', { tab: 'cash', title: 'Kas, Jurnal, dan Akun', screenRange: '43-44', route: '/app/finance/journals' }],
  ['/app/finance/profit-loss', { tab: 'profit', title: 'Laba Rugi', screenRange: '45-48', route: '/app/finance/profit-loss' }],
];

export function inventoryRouteContext(pathname: string, search = ''): InventoryRouteContext {
  if (pathname === '/app/inventory-control') {
    return { tab: 'stock', title: 'Inventory & Sales', screenRange: '01-48', route: pathname };
  }
  const match = contexts.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const context = match?.[1] ?? { tab: 'stock', title: 'Inventory & Sales', screenRange: '01-48', route: '/app/inventory-control' };
  if (context.route === '/app/finance/profit-loss' && new URLSearchParams(search).get('panel') === 'period-close') {
    return { ...context, tab: 'periodClose', title: 'Proses Akhir Periode' };
  }
  return context;
}
