import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  Download,
  FileText,
  Landmark,
  PackageSearch,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Plus,
  Truck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { api, formatDate, formatMoney, formatNumber } from '../../lib/api';
import { downloadExcel, downloadPdf, type ExportColumn } from '../../lib/export-table';
import { Code, DataGrid, PageHeader, StatusBadge, type GridColumn } from '../../components/ui';
import { inventoryRouteContext, inventoryRouteForLegacyScreen, inventoryTabRoutes, type InventoryTabKey } from './inventory-route-context';

type TabKey = InventoryTabKey;

type MasterRow = Record<string, unknown> & {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
};

type DashboardData = {
  summary: {
    products?: number;
    customers?: number;
    suppliers?: number;
    orders_month?: number;
    revenue_month?: string;
    cogs_month?: string;
    gross_profit_month?: string;
    on_hand_qty?: string;
    expiring_lots?: number;
    expired_lots?: number;
  };
  topSales: Array<{ sales_name: string; orders: number; revenue: string; cogs: string; gross_profit: string }>;
  topProducts: Array<{ product_code: string; product_name: string; qty: string; revenue: string; cogs: string; gross_profit: string }>;
  recentOrders: Array<Record<string, unknown>>;
};

type ReconciliationData = {
  totals: {
    raw_records: number;
    files: number;
    purchase_orders: number;
    receivable_amount: string;
    payable_amount: string;
    price_history_rows: number;
    stock_opname_rows: number;
  };
  salesMap: Array<{ legacy_code: string; legacy_name: string; mapped_username: string | null; mapped_name: string | null }>;
};

type InventoryMasterData = {
  products: MasterRow[];
  customers: MasterRow[];
  suppliers: MasterRow[];
};

type LegacyReceivableRow = Record<string, unknown> & {
  id: string;
  legacy_invoice_number: string;
  transaction_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  amount: string;
  customer_id: string | null;
  salesperson_id: string | null;
  customer_name: string;
  sales_name: string;
  bank_name: string | null;
  is_settled: boolean;
  aging_bucket: string;
};

type LegacyPayableRow = Record<string, unknown> & {
  id: string;
  legacy_invoice_number: string;
  transaction_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  amount: string;
  supplier_id: string | null;
  supplier_name: string;
  bank_name: string | null;
  is_settled: boolean;
  aging_bucket: string;
};

type ParityData = {
  asOf: string;
  includeSettled: boolean;
  receivables: Record<string, string | number>;
  payables: Record<string, string | number>;
  profitBySales: Array<Record<string, unknown>>;
  profitByProduct: Array<Record<string, unknown>>;
  evidence: Record<string, string | number>;
  parity: { screens: number; mapped: number; requiresBusinessUat: string[] };
};

type ParityContract = {
  summary: {
    screens: number;
    web: { operational: number; readOnly: number; contractOnly: number };
    flutter: { operational: number; readOnly: number; contractOnly: number };
  };
  items: Array<{
    screen: number;
    legacyName: string;
    domain: string;
    api: string[];
    webRoute?: string;
    web: 'OPERATIONAL' | 'READ_ONLY' | 'CONTRACT_ONLY';
    flutter: 'OPERATIONAL' | 'READ_ONLY' | 'CONTRACT_ONLY';
  }>;
};

type LegacyPriceRow = Record<string, unknown> & {
  id: string;
  party_type: 'CUSTOMER' | 'SUPPLIER';
  party_name: string;
  product_code: string;
  product_name: string;
  effective_date: string | null;
  price: string;
};

type LegacyStockOpnameRow = Record<string, unknown> & {
  id: string;
  opname_date: string | null;
  product_code: string;
  product_name: string;
  system_qty: string;
  physical_qty: string;
  variance_qty: string;
  unit_cost: string;
};

type StockBalanceRow = Record<string, unknown> & {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
  product_code: string;
  product_name: string;
  uom_code: string;
  on_hand_qty: string;
  available_qty: string;
  reserved_qty: string;
  in_transit_qty: string;
  quarantine_qty: string;
  last_movement_at: string | null;
};

type InventoryPriceBook = {
  id: string;
  code: string;
  name: string;
  scope_type: 'TENANT' | 'CUSTOMER' | 'SUPPLIER';
  scope_id: string | null;
  valid_from: string;
  valid_until: string | null;
  approval_status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
  approval_note: string | null;
  is_active: boolean;
  item_count: number;
  minimum_price: string | null;
  maximum_price: string | null;
};

type FinanceWorkspace = {
  accounts: Array<{ id: string; code: string; name: string; account_type: string; normal_balance: string }>;
  periods: Array<{ id: string; code: string; name: string; start_date: string; end_date: string; status: string }>;
  journals: Array<{ id: string; journal_number: string; journal_date: string; description: string; status: string; total_debit: string }>;
  closeRuns: Array<{ id: string; run_number: string; status: string; validation_result: Record<string, number>; period_code: string }>;
  accountingEvents?: Array<{
    id: string;
    event_code: string;
    source_type: string;
    source_number: string | null;
    occurred_at: string;
    status: 'PENDING' | 'POSTED' | 'FAILED' | 'SKIPPED';
    failure_reason: string | null;
    retry_count: number;
    journal_entry_id: string | null;
    journal_number: string | null;
  }>;
};

type InventoryFinancialReport = {
  reportCode: string;
  title: string;
  asOfDate: string;
  rowCount: number;
  totals: Record<string, string>;
  rows: Array<Record<string, unknown>>;
};

type StockOpnameWorkspace = {
  warehouses: Array<{ id: string; code: string; name: string }>;
  sessions: Array<{
    id: string;
    opname_number: string;
    opname_date: string;
    status: 'DRAFT' | 'FROZEN' | 'COUNTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
    warehouse_code: string;
    warehouse_name: string;
    line_count: number;
    counted_count: number;
    variance_value: string;
  }>;
};

type StockOpnameDetail = StockOpnameWorkspace['sessions'][number] & {
  lines: Array<{
    id: string;
    product_code: string;
    product_name: string;
    uom_code: string;
    lot_number: string | null;
    expiry_date: string | null;
    system_qty: string;
    physical_qty: string | null;
    variance_qty: string;
    variance_value: string;
  }>;
};

const tabs: Array<{ key: TabKey; label: string; icon: ReactNode; note: string }> = [
  { key: 'suppliers', label: 'Supplier', icon: <Truck />, note: 'Pemasok, alamat, tempo, bank, saldo hutang' },
  { key: 'customers', label: 'Customer', icon: <UsersRound />, note: 'Pelanggan, wilayah, tempo, saldo piutang' },
  { key: 'sales', label: 'Sales', icon: <ShieldCheck />, note: 'Mapping sales lama ke akun lapangan' },
  { key: 'stock', label: 'Stok Barang', icon: <Boxes />, note: 'Stok, harga pokok, batch, expiry, opname' },
  { key: 'prices', label: 'Master Harga', icon: <PackageSearch />, note: 'Harga jual/beli historis per customer/supplier' },
  { key: 'purchases', label: 'Pembelian & Hutang', icon: <ClipboardList />, note: 'PO legacy, hutang supplier, pembayaran' },
  { key: 'salesOrders', label: 'Penjualan & Piutang', icon: <WalletCards />, note: 'Order sales, piutang customer, nota dibawa' },
  { key: 'cash', label: 'Kas & Jurnal', icon: <Landmark />, note: 'Jurnal harian, akun, buku besar' },
  { key: 'profit', label: 'Laba / Rugi', icon: <BarChart3 />, note: 'Margin, HPP, laba kotor per sales/barang' },
  { key: 'periodClose', label: 'Proses Akhir', icon: <RefreshCw />, note: 'Backup, re-index, tutup periode aman' },
];

const parityGroups = [
  ['Master relasi', ['Data supplier', 'Daftar supplier terbuka', 'Daftar supplier lunas', 'Data customer', 'Daftar customer terbuka', 'Daftar customer lunas', 'Data sales', 'Daftar sales']],
  ['Stok dan harga', ['Daftar stok', 'Laporan opname', 'Cetak opname', 'Analisis harga beli/jual', 'Pilih harga', 'Cetak harga jual', 'Ekspor harga/stok', 'Cetak stok', 'Pratinjau stok', 'Master harga', 'Harga supplier/customer']],
  ['Pembelian dan hutang', ['Transaksi pembelian', 'Daftar hutang', 'Hutang supplier', 'Tampilkan hutang lunas', 'Pembayaran hutang', 'Riwayat pembayaran hutang', 'Cetak pembayaran hutang', 'Aging hutang', 'Cetak faktur pembelian', 'Laporan pembelian periode']],
  ['Penjualan dan piutang', ['Transaksi penjualan', 'Daftar piutang', 'Piutang customer', 'Tampilkan piutang lunas', 'Penerimaan piutang', 'Riwayat penerimaan', 'Cetak penerimaan', 'Analisis piutang customer', 'Analisis piutang sales', 'Sales bawa nota', 'Cetak serah-terima nota', 'Laporan piutang', 'Cetak laporan piutang']],
  ['Keuangan dan periode', ['Kas dan jurnal harian', 'Buat akun perkiraan', 'Laba/rugi', 'Cetak laba kotor', 'Laporan laba/rugi', 'Proses akhir periode']],
] as const;

export function InventoryControlPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const routeContext = useMemo(
    () => inventoryRouteContext(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const [active, setActive] = useState<TabKey>(routeContext.tab);
  const [search, setSearch] = useState('');
  const [includeSettled, setIncludeSettled] = useState(false);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => setActive(routeContext.tab), [routeContext.tab]);

  const dashboard = useQuery({
    queryKey: ['inventory-control-dashboard'],
    queryFn: () => api.get<DashboardData>('/inventory/sales-dashboard'),
  });
  const reconciliation = useQuery({
    queryKey: ['inventory-control-reconciliation'],
    queryFn: () => api.get<ReconciliationData>('/inventory/legacy-import-reconciliation'),
  });
  const parity = useQuery({
    queryKey: ['inventory-control-parity', asOf, includeSettled],
    queryFn: () => api.get<ParityData>(`/inventory/parity-summary?asOf=${encodeURIComponent(asOf)}&includeSettled=${includeSettled}`),
  });
  const parityContract = useQuery({
    queryKey: ['inventory-parity-contract'],
    queryFn: () => api.get<ParityContract>('/inventory/parity-contract'),
  });
  const masterData = useQuery({
    queryKey: ['inventory-control-master-data'],
    queryFn: () => api.get<InventoryMasterData>('/inventory/master-data'),
  });
  const receivables = useQuery({
    queryKey: ['inventory-control-receivables', includeSettled],
    queryFn: () => api.get<LegacyReceivableRow[]>(`/inventory/legacy/receivables?pageSize=1000&includeSettled=${includeSettled}`),
  });
  const payables = useQuery({
    queryKey: ['inventory-control-payables', includeSettled],
    queryFn: () => api.get<LegacyPayableRow[]>(`/inventory/legacy/payables?pageSize=1000&includeSettled=${includeSettled}`),
  });
  const prices = useQuery({
    queryKey: ['inventory-control-prices'],
    queryFn: () => api.get<LegacyPriceRow[]>('/inventory/legacy/price-history?pageSize=1000'),
  });
  const opname = useQuery({
    queryKey: ['inventory-control-opname'],
    queryFn: () => api.get<LegacyStockOpnameRow[]>('/inventory/legacy/stock-opname?pageSize=1000'),
  });
  const priceBooks = useQuery({
    queryKey: ['inventory-price-books'],
    queryFn: () => api.get<InventoryPriceBook[]>('/inventory/price-books'),
    enabled: active === 'prices',
  });
  const finance = useQuery({
    queryKey: ['inventory-finance-workspace'],
    queryFn: () => api.get<FinanceWorkspace>('/inventory/finance-workspace'),
    enabled: active === 'cash' || active === 'periodClose',
  });
  const stockOpnames = useQuery({
    queryKey: ['inventory-stock-opnames'],
    queryFn: () => api.get<StockOpnameWorkspace>('/stock-opnames'),
    enabled: active === 'stock',
  });
  const stockBalances = useQuery({
    queryKey: ['inventory-stock-balances'],
    queryFn: () => api.get<StockBalanceRow[]>('/inventory/balances'),
    enabled: active === 'stock',
  });

  const view = useMemo(() => buildView(active, {
    dashboard: dashboard.data,
    reconciliation: reconciliation.data,
    parity: parity.data,
    products: masterData.data?.products ?? [],
    suppliers: masterData.data?.suppliers ?? [],
    customers: masterData.data?.customers ?? [],
    receivables: receivables.data ?? [],
    payables: payables.data ?? [],
    prices: prices.data ?? [],
    opname: opname.data ?? [],
    stockBalances: stockBalances.data ?? [],
  }), [active, dashboard.data, masterData.data, opname.data, parity.data, payables.data, prices.data, receivables.data, reconciliation.data, stockBalances.data]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return view.rows;
    return view.rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(needle)),
    );
  }, [search, view.rows]);

  const loading = dashboard.isLoading || reconciliation.isLoading || (
    active === 'suppliers' ? masterData.isLoading :
    active === 'customers' ? masterData.isLoading :
    active === 'stock' ? stockBalances.isLoading || opname.isLoading :
    active === 'prices' ? prices.isLoading :
    active === 'purchases' ? payables.isLoading :
    active === 'salesOrders' ? receivables.isLoading :
    false
  );
  const error = [dashboard.error, reconciliation.error, parity.error, parityContract.error, masterData.error, receivables.error, payables.error, prices.error, opname.error, priceBooks.error, finance.error, stockOpnames.error, stockBalances.error]
    .filter(Boolean)
    .map(errorMessage)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={routeContext.title}
        description={`Layar ${routeContext.screenRange} dari kontrak transisi Inventory & Sales. Data, command, audit, laporan, dan sinkronisasi memakai layanan tenant yang sama.`}
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Inventory & Sales', href: '/app/inventory-control' }, { label: routeContext.title }]}
        actions={
          <>
            <a href="/panduan/inventory-sales" target="_blank" rel="noreferrer" className="btn-secondary">
              <BookOpen className="h-4 w-4" aria-hidden /> Panduan
            </a>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Cetak
            </button>
            <button type="button" className="btn-secondary" onClick={() => downloadExcel(view.filename, view.exportColumns, filteredRows)}>
              <Download className="h-4 w-4" aria-hidden /> Excel
            </button>
            <button type="button" className="btn-primary" onClick={() => downloadPdf(view.filename, view.title, view.exportColumns, filteredRows)}>
              <FileText className="h-4 w-4" aria-hidden /> PDF
            </button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric icon={<Boxes />} label="SKU obat" value={formatNumber(dashboard.data?.summary.products)} note="master stok legacy" />
        <Metric icon={<UsersRound />} label="Customer" value={formatNumber(dashboard.data?.summary.customers)} note="wilayah & piutang" />
        <Metric icon={<Truck />} label="Supplier" value={formatNumber(dashboard.data?.summary.suppliers)} note="hutang & pembelian" />
        <Metric icon={<WalletCards />} label="Piutang" value={formatMoney(reconciliation.data?.totals.receivable_amount)} note="ledger legacy" />
        <Metric icon={<Banknote />} label="Hutang" value={formatMoney(reconciliation.data?.totals.payable_amount)} note="supplier aging" />
        <Metric icon={<BarChart3 />} label="Laba kotor" value={formatMoney(dashboard.data?.summary.gross_profit_month)} note="HPP faktual per baris" />
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">Paritas aplikasi Inventory Control</p>
          <p className="mt-1 text-sm text-slate-500">
            Kontrak {parityContract.data?.summary.screens ?? 48} layar diperiksa per permukaan. Operasional berarti alur nyata tersedia; baca-saja tidak dihitung sebagai transaksi selesai.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Posisi laporan
            <input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold dark:border-slate-700">
            <input type="checkbox" checked={includeSettled} onChange={(event) => setIncludeSettled(event.target.checked)} />
            Tampilkan yang lunas
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2">
          <CoverageSummary label="Web" values={parityContract.data?.summary.web} />
          <CoverageSummary label="Flutter Desktop & Android" values={parityContract.data?.summary.flutter} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-5">
          {parityGroups.map(([title, items]) => (
            <details key={title} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-bold">{title} <span className="text-slate-400">({items.length})</span></summary>
              <ol className="mt-2 space-y-1 text-xs text-slate-500">{items.map((item) => <li key={item}>{item}</li>)}</ol>
            </details>
          ))}
        </div>
        <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-700 lg:col-span-2">
          <summary className="cursor-pointer text-sm font-black">Daftar 48 layar dan route operasional</summary>
          <p className="mt-2 text-xs text-slate-500">Setiap tautan membuka workspace yang menjalankan fungsi terkait; daftar ini bukan pengganti UAT transaksi.</p>
          <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {(parityContract.data?.items ?? []).map((item) => (
              <li key={item.screen} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <span className="min-w-0 text-xs"><strong>{String(item.screen).padStart(2, '0')}</strong> — {item.legacyName}</span>
                <Link
                  aria-label={`Buka layar ${item.screen}`}
                  className="shrink-0 text-xs font-black text-brand-700 hover:underline dark:text-brand-300"
                  to={item.webRoute ?? inventoryRouteForLegacyScreen(item.screen)}
                >
                  Buka
                </Link>
              </li>
            ))}
          </ol>
        </details>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActive(tab.key);
                void navigate(inventoryTabRoutes[tab.key]);
              }}
              className={`rounded-xl border p-3 text-left transition ${
                active === tab.key
                  ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-sm dark:bg-brand-950/40 dark:text-brand-100'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="[&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>
                {tab.label}
              </span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{tab.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{view.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{view.description}</p>
          </div>
          <label className="relative min-w-0 lg:w-96">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950"
              placeholder={`Cari di ${view.title.toLowerCase()}...`}
            />
          </label>
        </div>

        {view.insights.length > 0 && (
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {view.insights.map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-slate-500">{item.note}</p>
              </div>
            ))}
          </div>
        )}

        {(active === 'purchases' || active === 'salesOrders') && (
          <SettlementWorkflowPanel
            kind={active === 'purchases' ? 'AP' : 'AR'}
            payables={payables.data ?? []}
            receivables={receivables.data ?? []}
            onChanged={() => {
              void queryClient.invalidateQueries({ queryKey: ['inventory-control-payables'] });
              void queryClient.invalidateQueries({ queryKey: ['inventory-control-receivables'] });
              void queryClient.invalidateQueries({ queryKey: ['inventory-control-parity'] });
            }}
          />
        )}

        <OperationalLinks active={active} />

        {active === 'stock' && (
          <StockOpnameWorkflowPanel
            workspace={stockOpnames.data}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ['inventory-stock-opnames'] })}
          />
        )}

        {active === 'prices' && (
          <PriceBookWorkflowPanel
            books={priceBooks.data ?? []}
            products={masterData.data?.products ?? []}
            customers={masterData.data?.customers ?? []}
            suppliers={masterData.data?.suppliers ?? []}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ['inventory-price-books'] })}
          />
        )}

        {(active === 'cash' || active === 'periodClose') && (
          <FinanceWorkflowPanel
            mode={active}
            data={finance.data}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ['inventory-finance-workspace'] })}
          />
        )}

        {active === 'profit' && <FinancialReportPanel asOf={asOf} />}

        <DataGrid
          columns={view.columns}
          rows={filteredRows}
          loading={loading}
          error={error}
          emptyTitle="Belum ada data pada modul ini"
          rowKey={(row) => rowKey(row)}
        />
      </section>
    </div>
  );
}

function OperationalLinks({ active }: { active: TabKey }) {
  const links: Record<TabKey, Array<{ label: string; href: string; note: string }>> = {
    suppliers: [{ label: 'Kelola supplier', href: '/app/suppliers', note: 'Tambah, ubah, nonaktifkan, audit' }],
    customers: [{ label: 'Kelola customer', href: '/app/customers', note: 'Identitas, wilayah, tempo, status' }],
    sales: [{ label: 'Kelola pengguna & sales', href: '/app/users', note: 'Akun, role, wilayah penugasan' }],
    stock: [
      { label: 'Master produk', href: '/app/products', note: 'SKU, satuan, batch, status jual' },
      { label: 'Pohon stok', href: '/app/stock-tree', note: 'Gudang, bin, lot, dan saldo' },
      { label: 'Mutasi stok', href: '/app/stock-movements', note: 'Jejak masuk, keluar, dan koreksi' },
    ],
    prices: [{ label: 'Master produk', href: '/app/products', note: 'Harga dasar dan identitas barang' }],
    purchases: [
      { label: 'Purchase order', href: '/app/purchase-orders', note: 'Buat, submit, approve, kirim' },
      { label: 'Penerimaan barang', href: '/app/goods-receipts', note: 'Batch, expiry, inspeksi, posting stok' },
    ],
    salesOrders: [{ label: 'Order penjualan', href: '/app/sales/orders', note: 'Order lapangan dan status pemenuhan' }],
    cash: [
      { label: 'Daftar akun', href: '/app/chart-of-accounts', note: 'Akun aset, kewajiban, modal, pendapatan, biaya' },
      { label: 'Jurnal lengkap', href: '/app/journal-entries', note: 'Riwayat jurnal dan rincian debit kredit' },
    ],
    profit: [{ label: 'Jurnal lengkap', href: '/app/journal-entries', note: 'Telusuri sumber angka laba rugi' }],
    periodClose: [{ label: 'Jurnal lengkap', href: '/app/journal-entries', note: 'Selesaikan seluruh jurnal draft sebelum tutup' }],
  };
  return (
    <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {links[active].map((link) => (
        <Link key={link.href + link.label} to={link.href} className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:bg-brand-950/20">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-slate-900 dark:text-white">{link.label}</span>
            <span className="block text-xs text-slate-500">{link.note}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function StockOpnameWorkflowPanel({
  workspace,
  onChanged,
}: {
  workspace?: StockOpnameWorkspace;
  onChanged: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const selected = workspace?.sessions.find((row) => row.id === selectedId) ?? workspace?.sessions[0];
  const detail = useQuery({
    queryKey: ['inventory-stock-opname-detail', selected?.id],
    queryFn: () => api.get<StockOpnameDetail>(`/stock-opnames/${selected?.id}`),
    enabled: Boolean(selected?.id),
  });
  const refresh = () => {
    onChanged();
    void detail.refetch();
  };
  const create = useMutation({
    mutationFn: () => {
      const target = warehouseId || workspace?.warehouses[0]?.id;
      if (!target) throw new Error('Gudang wajib dipilih.');
      return api.post<{ id: string; opnameNumber: string }>('/stock-opnames', { warehouseId: target });
    },
    onSuccess: (result) => {
      setSelectedId(result.id);
      setCounts({});
      setMessage(`Sesi ${result.opnameNumber} dibuat. Bekukan sebelum penghitungan fisik.`);
      onChanged();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const command = useMutation({
    mutationFn: async (action: 'freeze' | 'count' | 'approve' | 'post') => {
      if (!selected) throw new Error('Pilih sesi stock opname.');
      if (action === 'count') {
        const lines = Object.entries(counts)
          .filter(([, value]) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0)
          .map(([lineId, value]) => ({ lineId, physicalQty: Number(value) }));
        if (!lines.length) throw new Error('Isi minimal satu hasil hitung fisik.');
        return api.patch<{ status: string; pending: number }>(`/stock-opnames/${selected.id}`, { lines });
      }
      return api.post<{ status: string }>(`/stock-opnames/${selected.id}/${action}`);
    },
    onSuccess: (result) => {
      setCounts({});
      setMessage(`Status stock opname diperbarui menjadi ${result.status}.`);
      refresh();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  if (!workspace) {
    return <div className="mb-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-500">Memuat sesi stock opname...</div>;
  }
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="min-w-56 text-xs font-bold text-slate-700 dark:text-slate-200">
          Gudang sesi baru
          <select value={warehouseId || workspace.warehouses[0]?.id || ''} onChange={(event) => setWarehouseId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            {workspace.warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}
          </select>
        </label>
        <button type="button" className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}><Plus className="h-4 w-4" />Sesi baru</button>
        <label className="min-w-72 text-xs font-bold text-slate-700 dark:text-slate-200">
          Sesi aktif
          <select value={selected?.id ?? ''} onChange={(event) => { setSelectedId(event.target.value); setCounts({}); setMessage(''); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            {workspace.sessions.map((row) => <option key={row.id} value={row.id}>{row.opname_number} - {row.warehouse_code} - {row.status}</option>)}
          </select>
        </label>
        {selected?.status === 'DRAFT' && <button type="button" className="btn-secondary" onClick={() => command.mutate('freeze')}>Bekukan saldo</button>}
        {selected?.status === 'COUNTED' && <button type="button" className="btn-primary" onClick={() => command.mutate('approve')}>Setujui selisih</button>}
        {selected?.status === 'APPROVED' && <button type="button" className="btn-primary" onClick={() => command.mutate('post')}>Posting mutasi</button>}
      </div>
      {selected && <p className="mb-3 text-xs text-slate-500">{selected.counted_count}/{selected.line_count} baris dihitung - nilai selisih {formatMoney(selected.variance_value)}</p>}
      {selected && ['FROZEN', 'COUNTED'].includes(selected.status) && (
        <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-2">Produk</th><th className="p-2">Lot / expiry</th><th className="p-2 text-right">Sistem</th><th className="p-2">Fisik</th><th className="p-2 text-right">Selisih</th></tr></thead>
            <tbody>{(detail.data?.lines ?? []).map((line) => <tr key={line.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2"><strong>{line.product_code}</strong><br /><span className="text-xs text-slate-500">{line.product_name} ({line.uom_code})</span></td><td className="p-2 text-xs">{line.lot_number ?? '-'}<br />{line.expiry_date ? formatDate(line.expiry_date) : '-'}</td><td className="p-2 text-right font-mono">{formatNumber(line.system_qty)}</td><td className="p-2"><input aria-label={`Hitung fisik ${line.product_code}`} inputMode="decimal" value={counts[line.id] ?? line.physical_qty ?? ''} onChange={(event) => setCounts((current) => ({ ...current, [line.id]: event.target.value }))} className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right font-mono dark:border-slate-700 dark:bg-slate-950" /></td><td className="p-2 text-right font-mono">{formatNumber(line.variance_qty)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {selected && ['FROZEN', 'COUNTED'].includes(selected.status) && <div className="mt-3"><button type="button" className="btn-primary" disabled={command.isPending} onClick={() => command.mutate('count')}>Simpan hasil hitung</button></div>}
      {message && <p className="mt-3 text-sm font-bold">{message}</p>}
    </div>
  );
}

function PriceBookWorkflowPanel({
  books,
  products,
  customers,
  suppliers,
  onChanged,
}: {
  books: InventoryPriceBook[];
  products: MasterRow[];
  customers: MasterRow[];
  suppliers: MasterRow[];
  onChanged: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState<'TENANT' | 'CUSTOMER' | 'SUPPLIER'>('TENANT');
  const [scopeId, setScopeId] = useState('');
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const parties = scopeType === 'CUSTOMER' ? customers : scopeType === 'SUPPLIER' ? suppliers : [];

  const create = useMutation({
    mutationFn: async () => {
      if (!code.trim() || !name.trim() || !productId || Number(price) < 0) throw new Error('Kode, nama, produk, dan harga wajib valid.');
      if (scopeType !== 'TENANT' && !scopeId) throw new Error('Pilih customer atau supplier tujuan harga.');
      const created = await api.post<{ id: string; code: string }>('/inventory/price-books', {
        code, name, scopeType, scopeId: scopeType === 'TENANT' ? undefined : scopeId,
        lines: [{ productId, minimumQty: 1, price: Number(price) }],
      });
      await api.patch(`/inventory/price-books/${created.id}/status`, { status: 'SUBMITTED', note: 'Diajukan dari Inventory Control' });
      return created;
    },
    onSuccess: (created) => {
      setMessage(`Buku harga ${created.code} dibuat dan diajukan untuk persetujuan.`);
      setCode(''); setName(''); setProductId(''); setPrice(''); setScopeId(''); onChanged();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' | 'INACTIVE' }) =>
      api.patch(`/inventory/price-books/${id}/status`, { status, note: `Diproses dari Inventory Control: ${status}` }),
    onSuccess: () => { setMessage('Status buku harga diperbarui.'); onChanged(); },
    onError: (error) => setMessage(errorMessage(error)),
  });

  return (
    <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900 dark:bg-brand-950/20">
      <div className="mb-3 flex items-center gap-2"><Plus className="h-4 w-4" /><h3 className="text-sm font-black">Harga khusus modern dengan persetujuan</h3></div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <input aria-label="Kode buku harga" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Kode" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        <input aria-label="Nama buku harga" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama harga" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        <select aria-label="Lingkup harga" value={scopeType} onChange={(event) => { setScopeType(event.target.value as typeof scopeType); setScopeId(''); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="TENANT">Umum tenant</option><option value="CUSTOMER">Khusus customer</option><option value="SUPPLIER">Harga beli supplier</option>
        </select>
        {scopeType !== 'TENANT' ? (
          <select aria-label="Pihak tujuan" value={scopeId} onChange={(event) => setScopeId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">Pilih pihak</option>{parties.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}
          </select>
        ) : <div className="hidden xl:block" />}
        <select aria-label="Produk harga" value={productId} onChange={(event) => setProductId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="">Pilih produk</option>{products.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}
        </select>
        <div className="flex gap-2"><input aria-label="Nominal harga" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Harga" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /><button type="button" className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>Ajukan</button></div>
      </div>
      {message && <p className="mt-3 text-sm font-bold">{message}</p>}
      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {books.slice(0, 12).map((book) => (
          <div key={book.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div><p className="text-sm font-black">{book.code} - {book.name}</p><p className="text-xs text-slate-500">{book.scope_type} - {book.item_count} item - {book.approval_status}</p></div>
            <div className="flex gap-2">
              {book.approval_status === 'SUBMITTED' && <><button type="button" className="btn-primary" onClick={() => transition.mutate({ id: book.id, status: 'APPROVED' })}>Setujui</button><button type="button" className="btn-secondary" onClick={() => transition.mutate({ id: book.id, status: 'REJECTED' })}>Tolak</button></>}
              {book.approval_status === 'APPROVED' && <button type="button" className="btn-secondary" onClick={() => transition.mutate({ id: book.id, status: 'INACTIVE' })}>Nonaktifkan</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceWorkflowPanel({ mode, data, onChanged }: { mode: 'cash' | 'periodClose'; data?: FinanceWorkspace; onChanged: () => void }) {
  const openPeriods = data?.periods.filter((period) => period.status === 'OPEN') ?? [];
  const [periodId, setPeriodId] = useState('');
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const accountingEvents = data?.accountingEvents ?? [];
  const selectedPeriod = periodId || openPeriods[0]?.id || '';
  const journal = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod || !debitAccount || !creditAccount || debitAccount === creditAccount || Number(amount) <= 0 || !description.trim()) throw new Error('Periode, dua akun berbeda, nominal, dan uraian wajib diisi.');
      const created = await api.post<{ id: string; journalNumber: string }>('/inventory/journals', {
        fiscalPeriodId: selectedPeriod, description,
        lines: [{ accountId: debitAccount, debit: Number(amount), credit: 0 }, { accountId: creditAccount, debit: 0, credit: Number(amount) }],
      }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      await api.post(`/inventory/journals/${created.id}/post`);
      return created;
    },
    onSuccess: (created) => { setMessage(`Jurnal ${created.journalNumber} seimbang dan berhasil diposting.`); setAmount(''); setDescription(''); onChanged(); },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const periodCommand = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'close' | 'reopen' }) => api.post<{ status: string; validation: Record<string, number> }>(`/inventory/fiscal-periods/${id}/${action}`, { note: 'Diproses dari Inventory Control' }),
    onSuccess: (result) => { setMessage(result.status === 'BLOCKED' ? `Periode belum ditutup: ${JSON.stringify(result.validation)}` : `Periode sekarang berstatus ${result.status}.`); onChanged(); },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const processEvents = useMutation({
    mutationFn: () => api.post<{ processed: number; posted: number; failed: number }>('/accounting-events/process-pending'),
    onSuccess: (result) => {
      setMessage(`${result.processed} event diproses: ${result.posted} posted, ${result.failed} gagal.`);
      onChanged();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const retryEvent = useMutation({
    mutationFn: (id: string) => api.post<{ status: string; journalEntryId?: string }>(`/accounting-events/${id}/retry`),
    onSuccess: (result) => {
      setMessage(result.status === 'POSTED' ? 'Event berhasil dijurnal pada percobaan ulang.' : 'Event masih gagal; periksa alasan terbaru.');
      onChanged();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  if (!data) return <div className="mb-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-500">Memuat workspace keuangan...</div>;
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      {mode === 'cash' ? <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /><h3 className="text-sm font-black">Jurnal harian seimbang</h3></div>
          <button type="button" className="btn-secondary" disabled={processEvents.isPending} onClick={() => processEvents.mutate()}>
            Proses event tertunda
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <select aria-label="Periode jurnal" value={selectedPeriod} onChange={(event) => setPeriodId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">{openPeriods.map((row) => <option key={row.id} value={row.id}>{row.code}</option>)}</select>
          <select aria-label="Akun debit" value={debitAccount} onChange={(event) => setDebitAccount(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Akun debit</option>{data.accounts.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select>
          <select aria-label="Akun kredit" value={creditAccount} onChange={(event) => setCreditAccount(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Akun kredit</option>{data.accounts.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select>
          <input aria-label="Nominal jurnal" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Nominal" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input aria-label="Uraian jurnal" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Uraian" className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <button type="button" className="btn-primary" disabled={journal.isPending} onClick={() => journal.mutate()}>Simpan & posting</button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-700"><tr><th className="px-3 py-2">Event</th><th className="px-3 py-2">Sumber</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Jurnal / alasan</th><th className="px-3 py-2">Aksi</th></tr></thead>
            <tbody>
              {accountingEvents.slice(0, 20).map((event) => (
                <tr key={event.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-3 py-2 font-bold">{event.event_code}</td>
                  <td className="px-3 py-2">{event.source_number ?? event.source_type}</td>
                  <td className="px-3 py-2">{event.status}{event.retry_count > 0 ? ` (${event.retry_count}x)` : ''}</td>
                  <td className="max-w-md px-3 py-2">{event.journal_number ?? event.failure_reason ?? '-'}</td>
                  <td className="px-3 py-2">{event.status === 'FAILED' && <button type="button" className="btn-secondary" disabled={retryEvent.isPending} onClick={() => retryEvent.mutate(event.id)}>Coba ulang</button>}</td>
                </tr>
              ))}
              {!accountingEvents.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">Belum ada event akuntansi.</td></tr>}
            </tbody>
          </table>
        </div>
      </> : <>
        <h3 className="mb-3 text-sm font-black">Tutup periode dengan validasi transaksi tertunda</h3>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {data.periods.slice(0, 12).map((period) => <div key={period.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><div><p className="text-sm font-black">{period.code}</p><p className="text-xs text-slate-500">{formatDate(period.start_date)} - {formatDate(period.end_date)} - {period.status}</p></div><button type="button" className={period.status === 'OPEN' ? 'btn-primary' : 'btn-secondary'} disabled={periodCommand.isPending} onClick={() => periodCommand.mutate({ id: period.id, action: period.status === 'OPEN' ? 'close' : 'reopen' })}>{period.status === 'OPEN' ? 'Tutup' : 'Buka kembali'}</button></div>)}
        </div>
      </>}
      {message && <p className="mt-3 text-sm font-bold">{message}</p>}
    </div>
  );
}

function FinancialReportPanel({ asOf }: { asOf: string }) {
  const [report, setReport] = useState<InventoryFinancialReport>();
  const [message, setMessage] = useState('');
  const preview = useMutation({
    mutationFn: (code: 'gross-profit' | 'profit-loss') =>
      api.post<InventoryFinancialReport>(`/reports/${code}/preview`, { asOfDate: asOf, filters: {} }),
    onSuccess: (value) => { setReport(value); setMessage(''); },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const print = useMutation({
    mutationFn: async () => {
      if (!report) throw new Error('Tampilkan laporan terlebih dahulu.');
      const snapshot = await api.post<{ id: string }>(`/reports/${report.reportCode}/snapshot`, {
        asOfDate: report.asOfDate, filters: {},
      });
      const keys = Object.keys(report.rows[0] ?? {}).slice(0, 8);
      const columns = keys.map((key) => ({ key, label: key.replaceAll('_', ' ') })) as ExportColumn<Record<string, unknown>>[];
      const filename = `${report.reportCode}-${report.asOfDate}`;
      downloadPdf(filename, report.title, columns, report.rows);
      await api.post(`/report-snapshots/${snapshot.id}/print-log`, {
        format: 'PDF', documentNumber: `${filename}.pdf`,
      });
      return snapshot.id;
    },
    onSuccess: (snapshotId) => setMessage(`PDF dibuat dari snapshot ${snapshotId}; jejak cetak sudah dicatat.`),
    onError: (error) => setMessage(errorMessage(error)),
  });
  const total = report ? Object.values(report.totals)[0] ?? '0' : '0';

  return (
    <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-900 dark:bg-brand-950/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Laporan keuangan dari snapshot server</h3>
          <p className="text-xs text-slate-500">Posisi {formatDate(asOf)}; angka PDF sama dengan pratinjau dan tersimpan pada audit cetak.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled={preview.isPending} onClick={() => preview.mutate('gross-profit')}>Laba kotor</button>
          <button type="button" className="btn-secondary" disabled={preview.isPending} onClick={() => preview.mutate('profit-loss')}>Laba rugi akuntansi</button>
          <button type="button" className="btn-primary" disabled={!report || print.isPending} onClick={() => print.mutate()}><Printer className="h-4 w-4" />Cetak snapshot</button>
        </div>
      </div>
      {report && (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div><p className="font-black">{report.title}</p><p className="text-xs text-slate-500">{formatNumber(report.rowCount)} baris tervalidasi</p></div>
          <div className="rounded-lg bg-white px-4 py-2 text-right dark:bg-slate-900"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-black">{formatMoney(total)}</p></div>
        </div>
      )}
      {message && <p className="mt-3 text-sm font-bold">{message}</p>}
    </div>
  );
}

function SettlementWorkflowPanel({
  kind,
  payables,
  receivables,
  onChanged,
}: {
  kind: 'AP' | 'AR';
  payables: LegacyPayableRow[];
  receivables: LegacyReceivableRow[];
  onChanged: () => void;
}) {
  const rows = kind === 'AP'
    ? payables.filter((row) => !row.is_settled && Number(row.amount) > 0 && row.supplier_id)
    : receivables.filter((row) => !row.is_settled && Number(row.amount) > 0 && row.customer_id);
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('TRANSFER');
  const [message, setMessage] = useState('');
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  const settlement = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Pilih dokumen terlebih dahulu.');
      const total = Number(amount || selected.amount);
      if (!Number.isFinite(total) || total <= 0 || total > Number(selected.amount)) {
        throw new Error('Nominal harus lebih dari nol dan tidak melebihi tagihan.');
      }
      const path = kind === 'AP' ? '/ap/payments' : '/ar/receipts';
      const partyId = kind === 'AP'
        ? (selected as LegacyPayableRow).supplier_id
        : (selected as LegacyReceivableRow).customer_id;
      const created = await api.post<{ id: string; number: string }>(path, {
        partyId,
        method,
        allocations: [{ ledgerId: selected.id, amount: total }],
      }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      await api.post(`${path}/${created.id}/post`);
      return created;
    },
    onSuccess: (created) => {
      setMessage(`${kind === 'AP' ? 'Pembayaran' : 'Penerimaan'} ${created.number} berhasil diposting.`);
      setSelectedId('');
      setAmount('');
      onChanged();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const handover = useMutation({
    mutationFn: async () => {
      if (kind !== 'AR' || !selected || !(selected as LegacyReceivableRow).salesperson_id) {
        throw new Error('Piutang ini belum memiliki sales penanggung jawab.');
      }
      const created = await api.post<{ id: string; handover_number: string }>('/sales-note-handovers', {
        salespersonId: (selected as LegacyReceivableRow).salesperson_id,
        lines: [{ receivableLedgerId: selected.id }],
      });
      await api.post(`/sales-note-handovers/${created.id}/handover`);
      return created;
    },
    onSuccess: (created) => setMessage(`Nota ${created.handover_number} sudah diserahterimakan.`),
    onError: (error) => setMessage(errorMessage(error)),
  });

  if (!rows.length) return null;
  return (
    <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-900 dark:bg-brand-950/20">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_auto] lg:items-end">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {kind === 'AP' ? 'Faktur supplier' : 'Faktur customer'}
          <select
            value={selected?.id ?? ''}
            onChange={(event) => { setSelectedId(event.target.value); setAmount(''); setMessage(''); }}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.legacy_invoice_number} - {kind === 'AP' ? (row as LegacyPayableRow).supplier_name : (row as LegacyReceivableRow).customer_name} - {formatMoney(row.amount)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
          Nominal
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={selected?.amount ?? '0'}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
          Metode
          <select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="CASH">Tunai</option>
            <option value="TRANSFER">Transfer</option>
            <option value="GIRO">Giro</option>
            <option value="RETURN">Retur</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={settlement.isPending} onClick={() => settlement.mutate()}>
            {settlement.isPending ? 'Memproses...' : kind === 'AP' ? 'Bayar & posting' : 'Terima & posting'}
          </button>
          {kind === 'AR' && (
            <button type="button" className="btn-secondary" disabled={handover.isPending} onClick={() => handover.mutate()}>
              Bawa nota
            </button>
          )}
        </div>
      </div>
      {message && <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">{message}</p>}
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sebagian data Inventory belum dapat dimuat.';
}

function rowKey(row: Record<string, unknown>): string {
  return String(row.id ?? row.code ?? row.legacy_invoice_number ?? row.product_code ?? row.step ?? JSON.stringify(row));
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{note}</p>
        </div>
      </div>
    </div>
  );
}

function CoverageSummary({
  label,
  values,
}: {
  label: string;
  values?: { operational: number; readOnly: number; contractOnly: number };
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
      <p className="text-sm font-black text-slate-900 dark:text-white">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {values?.operational ?? 0} operasional
        </span>
        <span className="rounded-md bg-sky-100 px-2 py-1 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          {values?.readOnly ?? 0} baca-saja
        </span>
        <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {values?.contractOnly ?? 0} belum berlayar
        </span>
      </div>
    </div>
  );
}

function buildView(active: TabKey, data: {
  dashboard?: DashboardData;
  reconciliation?: ReconciliationData;
  parity?: ParityData;
  products: MasterRow[];
  suppliers: MasterRow[];
  customers: MasterRow[];
  receivables: LegacyReceivableRow[];
  payables: LegacyPayableRow[];
  prices: LegacyPriceRow[];
  opname: LegacyStockOpnameRow[];
  stockBalances: StockBalanceRow[];
}) {
  if (active === 'suppliers') {
    return simpleMasterView('Daftar Supplier', 'Supplier lama lengkap dengan kode, nama, status, dan metadata pembayaran.', data.suppliers, ['code', 'name', 'is_active']);
  }
  if (active === 'customers') {
    return simpleMasterView('Daftar Customer', 'Pelanggan dikelola dengan pencarian cepat wilayah, nama, kode, dan status aktif.', data.customers, ['code', 'name', 'is_active']);
  }
  if (active === 'sales') {
    const rows = (data.reconciliation?.salesMap ?? []).map((row) => ({ id: row.legacy_code, ...row }));
    return {
      title: 'Daftar Sales',
      description: 'Mapping sales legacy ke akun modern untuk order lapangan dan laporan per sales.',
      filename: 'cmn-sales-map',
      rows,
      insights: [
        { label: 'Sales legacy', value: formatNumber(rows.length), note: 'dipetakan ke user sistem' },
        { label: 'Top sales bulan ini', value: data.dashboard?.topSales[0]?.sales_name ?? '-', note: 'berdasarkan omzet sales-dashboard' },
        { label: 'Prinsip kontrol', value: 'Role-based', note: 'sales hanya melihat data sendiri' },
      ],
      columns: [
        col('legacy_code', 'Kode'),
        col('legacy_name', 'Nama Sales'),
        col('mapped_username', 'Username'),
        col('mapped_name', 'Nama Akun'),
      ],
      exportColumns: exportCols(['legacy_code', 'legacy_name', 'mapped_username', 'mapped_name']),
    };
  }
  if (active === 'stock') {
    const balanceRows = data.stockBalances.map((row) => ({
      ...row,
      stock_status: Number(row.available_qty) > 0 ? 'Tersedia' : Number(row.on_hand_qty) > 0 ? 'Tertahan' : 'Habis',
    }));
    return {
      title: 'Daftar Stok Barang',
      description: 'Saldo live per gudang dan produk, termasuk tersedia, reservasi, transit, dan karantina.',
      filename: 'cmn-stok-barang',
      rows: balanceRows,
      insights: [
        { label: 'Total SKU', value: formatNumber(data.dashboard?.summary.products), note: 'master obat' },
        { label: 'Saldo tersedia', value: formatNumber(balanceRows.reduce((total, row) => total + Number(row.available_qty), 0)), note: 'seluruh gudang dalam scope' },
        { label: 'Batch mendekati ED', value: formatNumber(data.dashboard?.summary.expiring_lots), note: 'perlu follow-up FEFO' },
      ],
      columns: [
        col('warehouse_code', 'Gudang', (row) => <Code>{String(row.warehouse_code)}</Code>),
        col('product_code', '#Barang', (row) => <Code>{String(row.product_code)}</Code>),
        col('product_name', 'Nama Barang'),
        col('on_hand_qty', 'On Hand', (row) => formatNumber(Number(row.on_hand_qty))),
        col('available_qty', 'Tersedia', (row) => formatNumber(Number(row.available_qty))),
        col('reserved_qty', 'Reservasi', (row) => formatNumber(Number(row.reserved_qty))),
        col('in_transit_qty', 'Transit', (row) => formatNumber(Number(row.in_transit_qty))),
        col('quarantine_qty', 'Karantina', (row) => formatNumber(Number(row.quarantine_qty))),
        col('uom_code', 'Satuan'),
        col('stock_status', 'Status', (row) => <StatusBadge status={String(row.stock_status)} tone={row.stock_status === 'Tersedia' ? 'success' : 'warning'} />),
      ],
      exportColumns: exportCols(['warehouse_code', 'warehouse_name', 'product_code', 'product_name', 'on_hand_qty', 'available_qty', 'reserved_qty', 'in_transit_qty', 'quarantine_qty', 'uom_code', 'stock_status']),
    };
  }
  if (active === 'prices') {
    return {
      title: 'Master Harga Jual dan Beli',
      description: 'Riwayat harga per customer/supplier agar sales tidak salah memberi harga dan margin tetap terpantau.',
      filename: 'cmn-master-harga',
      rows: data.prices,
      insights: [
        { label: 'Riwayat harga', value: formatNumber(data.reconciliation?.totals.price_history_rows ?? data.prices.length), note: 'jual dan beli legacy' },
        { label: 'Harga customer', value: formatNumber(data.prices.filter((r) => r.party_type === 'CUSTOMER').length), note: 'masterjl.dbf' },
        { label: 'Harga supplier', value: formatNumber(data.prices.filter((r) => r.party_type === 'SUPPLIER').length), note: 'masterbl.dbf' },
      ],
      columns: [
        col('party_type', 'Tipe', (row) => <StatusBadge status={String(row.party_type)} tone={row.party_type === 'CUSTOMER' ? 'info' : 'neutral'} />),
        col('party_name', 'Customer/Supplier'),
        col('product_code', '#Brg', (row) => <Code>{String(row.product_code)}</Code>),
        col('product_name', 'Nama Barang'),
        col('price', 'Harga', (row) => formatMoney(String(row.price))),
        col('effective_date', 'Tanggal', (row) => formatDate(String(row.effective_date ?? ''))),
      ],
      exportColumns: exportCols(['party_type', 'party_name', 'product_code', 'product_name', 'price', 'effective_date']),
    };
  }
  if (active === 'purchases') {
    return financialView('Pembelian, Hutang, dan Pembayaran Supplier', 'Daftar hutang supplier, jatuh tempo, pembayaran, dan aging untuk mengontrol cash-out.', 'cmn-hutang-supplier', data.payables, 'supplier_name');
  }
  if (active === 'salesOrders') {
    return financialView('Penjualan, Piutang, dan Nota Sales', 'Daftar piutang customer, nota yang dibawa sales, tanggal bayar, dan aging untuk penagihan lapangan.', 'cmn-piutang-customer', data.receivables, 'customer_name');
  }
  if (active === 'cash') {
    return {
      title: 'Kas, Jurnal Harian, dan Buku Besar',
      description: 'Akun legacy dipertahankan untuk rekonsiliasi kas, piutang, hutang, pendapatan, biaya, dan buku besar.',
      filename: 'cmn-kas-jurnal',
      rows: [
        { id: '102', code: '102', name: 'PIUTANG DAGANG', category: 'AKTIVA', balance: data.reconciliation?.totals.receivable_amount ?? '0' },
        { id: '202', code: '202', name: 'HUTANG DAGANG', category: 'KEWAJIBAN', balance: data.reconciliation?.totals.payable_amount ?? '0' },
        { id: '400', code: '400', name: 'PENDAPATAN PENJUALAN', category: 'PENDAPATAN', balance: data.dashboard?.summary.revenue_month ?? '0' },
      ],
      insights: [
        { label: 'Kontrol jurnal', value: 'Debit/Kredit', note: 'akun 1xx-6xx' },
        { label: 'Piutang', value: formatMoney(data.reconciliation?.totals.receivable_amount), note: 'saldo awal audit' },
        { label: 'Hutang', value: formatMoney(data.reconciliation?.totals.payable_amount), note: 'saldo awal audit' },
      ],
      columns: [col('code', 'Kode'), col('name', 'Nama Perkiraan'), col('category', 'Kategori'), col('balance', 'Saldo', (row) => formatMoney(String(row.balance)))],
      exportColumns: exportCols(['code', 'name', 'category', 'balance']),
    };
  }
  if (active === 'profit') {
    const rows = (data.parity?.profitByProduct ?? data.dashboard?.topProducts ?? []).map((row) => ({ id: String(row.product_code), ...row }));
    return {
      title: 'Laba / Rugi Kotor',
      description: 'Monitoring omzet, HPP snapshot transaksi, laba kotor, performa produk, dan kontribusi sales.',
      filename: 'cmn-laba-rugi',
      rows,
      insights: [
        { label: 'Omzet bulan ini', value: formatMoney(data.dashboard?.summary.revenue_month), note: 'sales-dashboard' },
        { label: 'HPP bulan ini', value: formatMoney(data.dashboard?.summary.cogs_month), note: 'HARGABELI per baris DBF' },
        { label: 'Laba kotor', value: formatMoney(data.dashboard?.summary.gross_profit_month), note: 'tanpa persentase rekaan' },
        { label: 'Order bulan ini', value: formatNumber(data.dashboard?.summary.orders_month), note: 'transaksi sales' },
        { label: 'Best seller', value: data.dashboard?.topProducts[0]?.product_name ?? '-', note: 'kuantitas tertinggi' },
      ],
      columns: [
        col('product_code', '#Brg', (row) => <Code>{String(row.product_code)}</Code>),
        col('product_name', 'Nama Barang'),
        col('qty', 'Qty', (row) => formatNumber(String(row.qty))),
        col('revenue', 'Omzet', (row) => formatMoney(String(row.revenue))),
        col('cogs', 'HPP', (row) => formatMoney(String(row.cogs))),
        col('gross_profit', 'Laba Kotor', (row) => formatMoney(String(row.gross_profit))),
      ],
      exportColumns: exportCols(['product_code', 'product_name', 'qty', 'revenue', 'cogs', 'gross_profit']),
    };
  }
  return {
    title: 'Proses Akhir, Backup, dan Re-index',
    description: 'Tutup periode tidak menghapus transaksi: sistem modern membuat snapshot, audit log, validasi raw vault, dan backup terlebih dahulu.',
    filename: 'cmn-proses-akhir',
    rows: [
      { id: 'backup', step: 'Backup database', owner: 'Admin', status: 'Wajib sebelum tutup periode', evidence: 'pg_dump deploy' },
      { id: 'reindex', step: 'Re-index legacy', owner: 'Admin', status: 'Validasi raw vault', evidence: `${formatNumber(data.reconciliation?.totals.raw_records)} baris` },
      { id: 'close', step: 'Tutup periode', owner: 'Pemilik + Admin', status: 'Butuh approval', evidence: 'audit log' },
      { id: 'aging', step: 'Aging piutang/hutang', owner: 'Pemilik', status: 'Dibaca harian', evidence: '0-30, 31-60, 61-90, >90' },
    ],
    insights: [
      { label: 'File DBF', value: formatNumber(data.reconciliation?.totals.files), note: 'tercatat di raw vault' },
      { label: 'Raw records', value: formatNumber(data.reconciliation?.totals.raw_records), note: 'siap audit' },
      { label: 'Prinsip baru', value: 'No destructive close', note: 'data historis tetap utuh' },
    ],
    columns: [col('step', 'Proses'), col('owner', 'Penanggung Jawab'), col('status', 'Status'), col('evidence', 'Bukti')],
    exportColumns: exportCols(['step', 'owner', 'status', 'evidence']),
  };
}

function simpleMasterView(title: string, description: string, rows: MasterRow[], keys: string[]) {
  return {
    title,
    description,
    filename: title.toLowerCase().replace(/\s+/g, '-'),
    rows,
    insights: [
      { label: 'Total data', value: formatNumber(rows.length), note: 'maksimum 1000 baris tampil' },
      { label: 'Aktif', value: formatNumber(rows.filter((row) => row.is_active !== false).length), note: 'siap transaksi' },
      { label: 'Kontrol', value: 'Audit-safe', note: 'hapus permanen dibatasi' },
    ],
    columns: [
      col('code', 'Kode', (row) => <Code>{String(row.code)}</Code>),
      col('name', 'Nama'),
      col('is_active', 'Status', (row) => <StatusBadge status={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'neutral' : 'success'} />),
    ],
    exportColumns: exportCols(keys),
  };
}

function financialView<T extends LegacyReceivableRow | LegacyPayableRow>(title: string, description: string, filename: string, rows: T[], partyKey: keyof T) {
  const open = rows.filter((row) => !row.is_settled);
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return {
    title,
    description,
    filename,
    rows,
    insights: [
      { label: 'Total baris', value: formatNumber(rows.length), note: 'ledger legacy' },
      { label: 'Belum lunas', value: formatNumber(open.length), note: 'prioritas follow-up' },
      { label: 'Total nilai', value: formatMoney(total), note: 'nominal ledger' },
    ],
    columns: [
      col('legacy_invoice_number', 'Faktur', (row) => <Code>{String(row.legacy_invoice_number)}</Code>),
      col(String(partyKey), partyKey === 'customer_name' ? 'Customer' : 'Supplier'),
      col('transaction_date', 'Tanggal', (row) => formatDate(String(row.transaction_date ?? ''))),
      col('due_date', 'Jatuh Tempo', (row) => formatDate(String(row.due_date ?? ''))),
      col('paid_at', 'Bayar', (row) => row.paid_at
        ? formatDate(String(row.paid_at))
        : row.is_settled
          ? <StatusBadge status="Lunas" tone="success" />
          : <StatusBadge status="Belum lunas" tone="warning" />),
      col('aging_bucket', 'Aging', (row) => <StatusBadge status={String(row.aging_bucket)} tone={row.is_settled ? 'success' : 'warning'} />),
      col('amount', 'Jumlah', (row) => formatMoney(String(row.amount))),
    ],
    exportColumns: exportCols(['legacy_invoice_number', String(partyKey), 'transaction_date', 'due_date', 'paid_at', 'amount']),
  };
}

function col<T extends Record<string, unknown>>(key: string, header: string, render?: (row: T) => ReactNode): GridColumn<T> {
  return { key, header, render };
}

function exportCols(keys: string[]): Array<ExportColumn<Record<string, unknown>>> {
  return keys.map((key) => ({ key, label: key.replace(/_/g, ' ').toUpperCase() }));
}
