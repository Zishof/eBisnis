import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Boxes, ClipboardList, Database, Megaphone, PackageCheck, ReceiptText, TrendingUp, UsersRound } from 'lucide-react';
import { api, formatMoney, formatNumber } from '../../lib/api';
import { PageHeader, StatusBadge, LoadingState, Code } from '../../components/ui';
import { useAuth } from '../../app/auth-context';

interface StockTreeResponse {
  nodes: Array<{ code: string; name: string; onHand: string; available: string; inTransit: string; totalChildren: number }>;
  totals: { onHand: string; available: string; inTransit: string; quarantine: string };
}

interface StockAlert {
  id: string;
  product_code: string;
  product_name: string;
  warehouse_code: string;
  projected_qty: string;
  threshold_qty: string;
  status: string;
  request_number: string | null;
}

interface SeedReport {
  passed: boolean;
  totalResources: number;
  failingResources: number;
}

interface SalesInventoryDashboard {
  summary: {
    products?: number;
    customers?: number;
    suppliers?: number;
    orders_today?: number;
    revenue_today?: string;
    orders_month?: number;
    revenue_month?: string;
    on_hand_qty?: string;
    available_qty?: string;
    expired_lots?: number;
    expiring_lots?: number;
  };
  topSales: Array<{ sales_name: string; orders: number; revenue: string }>;
  topProducts: Array<{ product_code: string; product_name: string; qty: string; revenue: string }>;
  topCustomers: Array<{ customer_name: string; orders: number; revenue: string }>;
  expiringLots: Array<{ product_code: string; product_name: string; lot_number: string; expiry_date: string }>;
  recentOrders: Array<{
    id: string;
    order_number: string;
    order_date: string;
    status: string;
    grand_total: string;
    customer_name: string;
    sales_name: string;
  }>;
}

interface LegacyImportReconciliation {
  totals: {
    raw_records?: number;
    files?: number;
    receivable_rows?: number;
    receivable_amount?: string;
    payable_rows?: number;
    payable_amount?: string;
    price_history_rows?: number;
    stock_opname_rows?: number;
    purchase_orders?: number;
    supplier_invoices?: number;
  };
  files: Array<{
    file_name: string;
    total_records: number;
    active_records: number;
    deleted_records: number;
    raw_records: number;
    projected_records: number;
    raw_only_records: number;
  }>;
  salesMap: Array<{ legacy_code: string; legacy_name: string; mapped_username: string | null; mapped_name: string | null }>;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const tree = useQuery({
    queryKey: ['stock-tree-summary'],
    queryFn: () => api.get<StockTreeResponse>('/inventory/stock-tree'),
  });
  const alerts = useQuery({
    queryKey: ['stock-alerts-summary'],
    queryFn: () => api.get<StockAlert[]>('/stock-alerts'),
  });
  const requestOrders = useQuery({
    queryKey: ['request-orders-summary'],
    queryFn: () => api.get<Array<Record<string, unknown>>>('/request-orders?pageSize=5'),
  });
  const receipts = useQuery({
    queryKey: ['receipts-summary'],
    queryFn: () => api.get<Array<Record<string, unknown>>>('/goods-receipts?pageSize=5'),
  });
  const salesDashboard = useQuery({
    queryKey: ['inventory-sales-dashboard'],
    queryFn: () => api.get<SalesInventoryDashboard>('/inventory/sales-dashboard'),
    retry: false,
  });
  const legacyImport = useQuery({
    queryKey: ['inventory-legacy-import-reconciliation'],
    queryFn: () => api.get<LegacyImportReconciliation>('/inventory/legacy-import-reconciliation'),
    retry: false,
  });
  const seed = useQuery({
    queryKey: ['seed-verify-summary'],
    queryFn: () => api.get<SeedReport>('/sample-data/verify'),
    retry: false,
  });

  const waitingValidation = (receipts.data ?? []).filter(
    (row) => row.status === 'WAITING_VALIDATION',
  ).length;

  return (
    <>
      <PageHeader
        title={t('app.dashboard')}
        description={t('app.welcome', { name: user?.displayName ?? '' })}
      />

      {seed.data && !seed.data.passed && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              {seed.data.failingResources} master belum memenuhi minimum data contoh.
            </p>
            <Link to="/app/sample-data" className="text-amber-800 underline dark:text-amber-200">
              {t('seed.repair')}
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<ReceiptText className="h-5 w-5" aria-hidden />}
          label="Omzet hari ini"
          value={salesDashboard.data ? formatMoney(salesDashboard.data.summary.revenue_today) : '—'}
          href="/app/sales/reports"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
          label="Omzet bulan ini"
          value={salesDashboard.data ? formatMoney(salesDashboard.data.summary.revenue_month) : '—'}
          href="/app/sales/reports"
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          label="Order bulan ini"
          value={salesDashboard.data ? formatNumber(salesDashboard.data.summary.orders_month) : '—'}
          href="/app/sales/orders"
        />
        <StatCard
          icon={<UsersRound className="h-5 w-5" aria-hidden />}
          label="Pelanggan"
          value={salesDashboard.data ? formatNumber(salesDashboard.data.summary.customers) : '—'}
          href="/app/customers"
        />
        <StatCard
          icon={<Boxes className="h-5 w-5" aria-hidden />}
          label={t('inventory.onHand')}
          value={tree.data ? formatNumber(tree.data.totals.onHand) : '—'}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
          label={t('inventory.inTransit')}
          value={tree.data ? formatNumber(tree.data.totals.inTransit) : '—'}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
          label="Stok di bawah minimum"
          value={String(alerts.data?.length ?? 0)}
          href="/app/stock-alerts"
        />
        <StatCard
          icon={<PackageCheck className="h-5 w-5" aria-hidden />}
          label="Penerimaan menunggu validasi"
          value={String(waitingValidation)}
          href="/app/goods-receipts"
        />
        <StatCard
          icon={<Megaphone className="h-5 w-5" aria-hidden />}
          label="Portal pelanggan"
          value="Demo"
          href="/app/portal-pelanggan"
        />
        {legacyImport.data && (
          <StatCard
            icon={<Database className="h-5 w-5" aria-hidden />}
            label="Baris legacy masuk"
            value={formatNumber(legacyImport.data.totals.raw_records)}
          />
        )}
      </div>

      {legacyImport.data && (
        <section className="card mt-6 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <Database className="h-4 w-4" aria-hidden />
                Rekonsiliasi Legacy Caruban Medika Nusantara
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Semua DBF lama disimpan sebagai raw vault, lalu diproyeksikan bertahap ke ERP.
              </p>
            </div>
            <Code>{formatNumber(legacyImport.data.totals.files)} file DBF</Code>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <MiniMetric label="PO legacy" value={formatNumber(legacyImport.data.totals.purchase_orders)} tone="neutral" />
            <MiniMetric label="Piutang legacy" value={formatMoney(legacyImport.data.totals.receivable_amount)} tone="neutral" />
            <MiniMetric label="Hutang legacy" value={formatMoney(legacyImport.data.totals.payable_amount)} tone="neutral" />
            <MiniMetric label="Riwayat harga" value={formatNumber(legacyImport.data.totals.price_history_rows)} tone="neutral" />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 pe-3">File</th>
                    <th className="py-2 pe-3 text-end">Aktif</th>
                    <th className="py-2 pe-3 text-end">Terhapus</th>
                    <th className="py-2 pe-3 text-end">Raw</th>
                    <th className="py-2 text-end">Raw-only</th>
                  </tr>
                </thead>
                <tbody>
                  {legacyImport.data.files.slice(0, 10).map((file) => (
                    <tr key={file.file_name} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-2 pe-3 font-medium">{file.file_name}</td>
                      <td className="py-2 pe-3 text-end">{formatNumber(file.active_records)}</td>
                      <td className="py-2 pe-3 text-end">{formatNumber(file.deleted_records)}</td>
                      <td className="py-2 pe-3 text-end">{formatNumber(file.raw_records)}</td>
                      <td className="py-2 text-end">{formatNumber(file.raw_only_records)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Mapping sales</h3>
              <ul className="mt-3 space-y-2">
                {legacyImport.data.salesMap.map((row) => (
                  <li key={row.legacy_code} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{row.legacy_name}</span>
                    <Code>{row.mapped_username ?? 'belum dipetakan'}</Code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {salesDashboard.data && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Performa Sales Bulan Ini
              </h2>
              <Link to="/app/sales/reports" className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                Laporan
              </Link>
            </div>
            <div className="space-y-3">
              {salesDashboard.data.topSales.map((row) => (
                <ProgressRow
                  key={row.sales_name}
                  label={row.sales_name}
                  note={`${formatNumber(row.orders)} order`}
                  value={formatMoney(row.revenue)}
                  max={Math.max(...salesDashboard.data.topSales.map((s) => Number(s.revenue) || 0), 1)}
                  current={Number(row.revenue) || 0}
                />
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Risiko Batch & Expiry
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Batch kadaluarsa" value={formatNumber(salesDashboard.data.summary.expired_lots)} tone="danger" />
              <MiniMetric label="Akan expired 90 hari" value={formatNumber(salesDashboard.data.summary.expiring_lots)} tone="warning" />
            </div>
            <ul className="mt-4 space-y-2">
              {salesDashboard.data.expiringLots.slice(0, 6).map((lot) => (
                <li key={`${lot.product_code}-${lot.lot_number}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{lot.product_name}</span>
                    <Code>{lot.lot_number}</Code>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {lot.product_code} - ED {lot.expiry_date}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <PackageCheck className="h-4 w-4" aria-hidden />
              Produk Terlaris
            </h2>
            <div className="space-y-3">
              {salesDashboard.data.topProducts.slice(0, 8).map((row) => (
                <ProgressRow
                  key={row.product_code}
                  label={row.product_name}
                  note={`${row.product_code} - ${formatNumber(row.qty)} qty`}
                  value={formatMoney(row.revenue)}
                  max={Math.max(...salesDashboard.data.topProducts.map((p) => Number(p.revenue) || 0), 1)}
                  current={Number(row.revenue) || 0}
                />
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <UsersRound className="h-4 w-4" aria-hidden />
              Pelanggan Terbesar
            </h2>
            <div className="space-y-3">
              {salesDashboard.data.topCustomers.slice(0, 8).map((row) => (
                <ProgressRow
                  key={row.customer_name}
                  label={row.customer_name}
                  note={`${formatNumber(row.orders)} order`}
                  value={formatMoney(row.revenue)}
                  max={Math.max(...salesDashboard.data.topCustomers.map((c) => Number(c.revenue) || 0), 1)}
                  current={Number(row.revenue) || 0}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Boxes className="h-4 w-4" aria-hidden />
            {t('inventory.stockTree')}
          </h2>
          {tree.isLoading ? (
            <LoadingState />
          ) : (
            <ul className="space-y-2">
              {(tree.data?.nodes ?? []).map((node) => (
                <li
                  key={node.code}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"
                >
                  <span>
                    <Code>{node.code}</Code> {node.name}
                    <span className="ms-2 text-xs text-slate-500">
                      ({node.totalChildren} {t('inventory.warehouse').toLowerCase()})
                    </span>
                  </span>
                  <span className="font-semibold">{formatNumber(node.onHand)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/stock-tree" className="btn-outline mt-4 w-full">
            {t('inventory.stockTree')}
          </Link>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <ClipboardList className="h-4 w-4" aria-hidden />
            {t('purchasing.requestOrder')}
          </h2>
          {requestOrders.isLoading ? (
            <LoadingState />
          ) : (
            <ul className="space-y-2">
              {(requestOrders.data ?? []).slice(0, 5).map((row) => (
                <li
                  key={String(row.id)}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"
                >
                  <Code>{String(row.request_number)}</Code>
                  <StatusBadge status={String(row.status)} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/request-orders" className="btn-outline mt-4 w-full">
            {t('purchasing.requestOrder')}
          </Link>
        </section>
      </div>
    </>
  );
}

function ProgressRow({
  label,
  note,
  value,
  current,
  max,
}: {
  label: string;
  note: string;
  value: string;
  current: number;
  max: number;
}) {
  const width = max > 0 ? Math.max(4, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-white">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>
        </div>
        <span className="shrink-0 font-semibold">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: 'warning' | 'danger' | 'neutral' }) {
  const toneClass =
    tone === 'neutral'
      ? 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
      : tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-md">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}
