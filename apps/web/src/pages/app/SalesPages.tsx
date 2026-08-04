import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Search,
  TrendingUp,
  Truck,
  UsersRound,
} from 'lucide-react';
import { api, formatDate, formatMoney, formatNumber } from '../../lib/api';
import {
  Code,
  DataGrid,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  type GridColumn,
} from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';

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
  recentOrders: SalesOrderSummary[];
}

type SalesOrderSummary = Record<string, unknown> & {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date?: string | null;
  channel?: string;
  status: string;
  grand_total: string;
  customer_name: string;
  sales_name: string;
  line_count?: number;
  ordered_qty?: string;
  delivered_qty?: string;
};

interface SalesOrderDetail {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date?: string | null;
  channel: string;
  currency_code: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
  status: string;
  customer_name: string;
  sales_name: string;
  lines: Array<{
    id: string;
    line_no: number;
    ordered_qty: string;
    delivered_qty: string;
    unit_price: string;
    discount_amount: string;
    tax_amount: string;
    line_total: string;
    product_code: string;
    product_name: string;
    uom_code: string;
  }>;
}

export function SalesOrdersPage() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toMessage = useErrorMessage();

  const orders = useQuery({
    queryKey: ['sales-orders', search],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' });
      if (search.trim()) params.set('search', search.trim());
      return api.get<SalesOrderSummary[]>(`/sales/orders?${params.toString()}`);
    },
  });

  const detail = useQuery({
    queryKey: ['sales-orders', selectedId],
    queryFn: () => api.get<SalesOrderDetail>(`/sales/orders/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const rows = useMemo(() => orders.data ?? [], [orders.data]);
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.grand_total ?? 0), 0);
  const confirmed = rows.filter((row) => row.status === 'CONFIRMED').length;
  const deliveryRatio = useMemo(() => {
    const ordered = rows.reduce((sum, row) => sum + Number(row.ordered_qty ?? 0), 0);
    const delivered = rows.reduce((sum, row) => sum + Number(row.delivered_qty ?? 0), 0);
    return ordered > 0 ? Math.round((delivered / ordered) * 100) : 0;
  }, [rows]);

  const columns: Array<GridColumn<SalesOrderSummary>> = [
    {
      key: 'order_number',
      header: 'Order',
      render: (row) => <Code>{row.order_number}</Code>,
    },
    {
      key: 'order_date',
      header: 'Tanggal',
      render: (row) => formatDate(row.order_date),
    },
    { key: 'customer_name', header: 'Pelanggan' },
    { key: 'sales_name', header: 'Sales' },
    {
      key: 'line_count',
      header: 'Item',
      className: 'text-end',
      render: (row) => formatNumber(row.line_count ?? 0),
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (row) => <StatusBadge status={row.channel ?? 'DIRECT'} tone="info" />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'grand_total',
      header: 'Total',
      className: 'text-end',
      render: (row) => <span className="font-semibold">{formatMoney(row.grand_total)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      render: (row) => (
        <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={() => setSelectedId(row.id)}>
          Detail
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pesanan Penjualan"
        description="Pipeline order lapangan: dari input sales, konfirmasi stok, pengiriman, sampai siap ditagih."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Pesanan Penjualan' }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void orders.refetch()} disabled={orders.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat ulang
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<ClipboardList />} label="Order tampil" value={formatNumber(rows.length)} note="100 order terbaru" />
        <MetricCard icon={<TrendingUp />} label="Nilai pipeline" value={formatMoney(totalRevenue)} note="Sesuai filter saat ini" />
        <MetricCard icon={<PackageCheck />} label="Terkonfirmasi" value={formatNumber(confirmed)} note="Siap diproses gudang" />
        <MetricCard icon={<Truck />} label="Rasio terkirim" value={`${deliveryRatio}%`} note="Qty terkirim / dipesan" />
      </div>

      <section className="card mt-6 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Daftar Order</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cari nomor order, pelanggan, sales, channel, atau status.
            </p>
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <span className="sr-only">Cari pesanan</span>
            <input
              className="field-input ps-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari order, pelanggan, sales..."
            />
          </label>
        </div>
        <DataGrid
          columns={columns}
          rows={rows}
          loading={orders.isLoading}
          error={orders.isError ? toMessage(orders.error, (_key, fallback) => fallback ?? 'Gagal memuat order.') : undefined}
          rowKey={(row) => row.id}
          emptyTitle="Belum ada order penjualan."
          onRetry={() => void orders.refetch()}
        />
      </section>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[86vh] w-full max-w-4xl overflow-y-auto p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Detail Pesanan</h2>
                {detail.data && <p className="text-sm text-slate-500 dark:text-slate-400">{detail.data.order_number}</p>}
              </div>
              <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={() => setSelectedId(null)}>
                Tutup
              </button>
            </div>
            {detail.isLoading && <LoadingState />}
            {detail.isError && (
              <ErrorState
                message={toMessage(detail.error, (_key, fallback) => fallback ?? 'Gagal memuat detail.')}
                onRetry={() => void detail.refetch()}
              />
            )}
            {detail.data && <SalesOrderDetailPanel detail={detail.data} />}
          </div>
        </div>
      )}
    </>
  );
}

export function SalesReportsPage() {
  const toMessage = useErrorMessage();
  const dashboard = useQuery({
    queryKey: ['inventory-sales-dashboard-report'],
    queryFn: () => api.get<SalesInventoryDashboard>('/inventory/sales-dashboard'),
  });

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) {
    return (
      <ErrorState
        message={toMessage(dashboard.error, (_key, fallback) => fallback ?? 'Gagal memuat laporan penjualan.')}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  const data = dashboard.data;
  if (!data) return <EmptyState title="Belum ada data laporan." />;

  const maxSales = Math.max(...data.topSales.map((row) => Number(row.revenue) || 0), 1);
  const maxProduct = Math.max(...data.topProducts.map((row) => Number(row.revenue) || 0), 1);
  const maxCustomer = Math.max(...data.topCustomers.map((row) => Number(row.revenue) || 0), 1);

  return (
    <>
      <PageHeader
        title="Laporan Penjualan"
        description="Ringkasan untuk pemilik, admin, dan supervisor sales: omzet, kontribusi sales, produk laris, pelanggan terbesar, dan risiko expiry."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Laporan Penjualan' }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void dashboard.refetch()} disabled={dashboard.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat ulang
          </button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<TrendingUp />} label="Omzet hari ini" value={formatMoney(data.summary.revenue_today)} note={`${formatNumber(data.summary.orders_today)} order`} />
        <MetricCard icon={<BarChart3 />} label="Omzet bulan ini" value={formatMoney(data.summary.revenue_month)} note={`${formatNumber(data.summary.orders_month)} order`} />
        <MetricCard icon={<PackageCheck />} label="Produk aktif" value={formatNumber(data.summary.products)} note={`${formatNumber(data.summary.available_qty)} qty tersedia`} />
        <MetricCard icon={<UsersRound />} label="Pelanggan" value={formatNumber(data.summary.customers)} note={`${formatNumber(data.summary.suppliers)} pemasok`} />
        <MetricCard icon={<AlertTriangle />} label="Batch perlu cek" value={formatNumber(data.summary.expiring_lots)} note={`${formatNumber(data.summary.expired_lots)} sudah expired`} tone="warning" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Performa Sales" icon={<UsersRound />}>
          <div className="space-y-3">
            {data.topSales.map((row) => (
              <ProgressRow
                key={row.sales_name}
                label={row.sales_name}
                note={`${formatNumber(row.orders)} order bulan ini`}
                value={formatMoney(row.revenue)}
                current={Number(row.revenue) || 0}
                max={maxSales}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Order Terbaru" icon={<ClipboardList />}>
          <div className="space-y-3">
            {data.recentOrders.slice(0, 8).map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Code>{order.order_number}</Code>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{order.customer_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{order.sales_name} - {formatDate(order.order_date)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(order.grand_total)}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Produk Paling Laku" icon={<PackageCheck />}>
          <div className="space-y-3">
            {data.topProducts.map((row) => (
              <ProgressRow
                key={row.product_code}
                label={row.product_name}
                note={`${row.product_code} - ${formatNumber(row.qty)} qty`}
                value={formatMoney(row.revenue)}
                current={Number(row.revenue) || 0}
                max={maxProduct}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Pelanggan Terbesar" icon={<UsersRound />}>
          <div className="space-y-3">
            {data.topCustomers.map((row) => (
              <ProgressRow
                key={row.customer_name}
                label={row.customer_name}
                note={`${formatNumber(row.orders)} order`}
                value={formatMoney(row.revenue)}
                current={Number(row.revenue) || 0}
                max={maxCustomer}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Risiko Expiry Obat" icon={<CalendarDays />} className="xl:col-span-2">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.expiringLots.map((lot) => (
              <div key={`${lot.product_code}-${lot.lot_number}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{lot.product_name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{lot.product_code}</p>
                  </div>
                  <Code>{lot.lot_number}</Code>
                </div>
                <p className="mt-3 text-sm font-semibold text-amber-900 dark:text-amber-200">ED {formatDate(lot.expiry_date)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function SalesOrderDetailPanel({ detail }: { detail: SalesOrderDetail }) {
  const columns: Array<GridColumn<Record<string, unknown>>> = [
    { key: 'product_code', header: 'Kode', render: (row) => <Code>{String(row.product_code ?? '-')}</Code> },
    { key: 'product_name', header: 'Produk' },
    { key: 'ordered_qty', header: 'Qty', className: 'text-end', render: (row) => formatNumber(String(row.ordered_qty ?? 0)) },
    { key: 'delivered_qty', header: 'Terkirim', className: 'text-end', render: (row) => formatNumber(String(row.delivered_qty ?? 0)) },
    { key: 'unit_price', header: 'Harga', className: 'text-end', render: (row) => formatMoney(String(row.unit_price ?? 0)) },
    { key: 'line_total', header: 'Subtotal', className: 'text-end', render: (row) => formatMoney(String(row.line_total ?? 0)) },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniInfo label="Pelanggan" value={detail.customer_name} />
        <MiniInfo label="Sales" value={detail.sales_name} />
        <MiniInfo label="Tanggal" value={formatDate(detail.order_date)} />
        <MiniInfo label="Status" value={<StatusBadge status={detail.status} />} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniInfo label="Subtotal" value={formatMoney(detail.subtotal)} />
        <MiniInfo label="Diskon" value={formatMoney(detail.discount_total)} />
        <MiniInfo label="Total" value={formatMoney(detail.grand_total)} strong />
      </div>
      <DataGrid
        columns={columns}
        rows={detail.lines as unknown as Array<Record<string, unknown>>}
        rowKey={(row) => String(row.id)}
        emptyTitle="Order ini belum memiliki item."
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  tone = 'brand',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: 'brand' | 'warning';
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
        </div>
        <div
          className={
            tone === 'warning'
              ? 'rounded-lg bg-amber-100 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              : 'rounded-lg bg-brand-100 p-2 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
          }
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  className = '',
  children,
}: {
  title: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        <span className="text-brand-700 dark:text-brand-300">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
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
  const width = Math.max(4, Math.min(100, (current / max) * 100));
  return (
    <div>
      <div className="flex items-start justify-between gap-3 text-sm">
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>
        </div>
        <p className="shrink-0 font-semibold text-slate-900 dark:text-white">{value}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-700 dark:bg-brand-400" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MiniInfo({
  label,
  value,
  strong,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <div className={`mt-1 text-sm ${strong ? 'font-bold text-slate-950 dark:text-white' : 'font-medium text-slate-800 dark:text-slate-100'}`}>
        {value}
      </div>
    </div>
  );
}
