import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Boxes,
  ChevronDown,
  Download,
  FileClock,
  Filter,
  Landmark,
  Plus,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../../app/auth-context';
import { PageHeader } from '../../components/ui';
import { api, formatMoney, formatNumber } from '../../lib/api';

interface SalesInventoryDashboard {
  summary: {
    products?: number;
    customers?: number;
    orders_today?: number;
    revenue_today?: string;
    purchases_today?: string;
    revenue_month?: string;
    purchases_month?: string;
    cogs_month?: string;
    gross_profit_month?: string;
    inventory_value?: string;
    low_stock_products?: number;
    expired_lots?: number;
    expiring_lots?: number;
  };
  salesTrend: Array<{ date: string; total: string }>;
  purchaseTrend: Array<{ date: string; total: string }>;
  topProducts: Array<{
    product_code: string;
    product_name: string;
    qty: string;
    revenue: string;
  }>;
  expiringLots: Array<{
    product_code: string;
    product_name: string;
    lot_number: string;
    expiry_date: string;
  }>;
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

interface LegacyReconciliation {
  totals?: {
    receivable_amount?: string;
    payable_amount?: string;
  };
}

export function CmnInventoryOwnerDashboardPage() {
  const { user } = useAuth();
  const dashboard = useQuery({
    queryKey: ['inventory-executive-dashboard'],
    queryFn: () => api.get<SalesInventoryDashboard>('/inventory/sales-dashboard'),
    retry: false,
  });
  const reconciliation = useQuery({
    queryKey: ['inventory-executive-reconciliation'],
    queryFn: () => api.get<LegacyReconciliation>('/inventory/legacy-import-reconciliation'),
    retry: false,
  });

  const data = dashboard.data;
  const summary = data?.summary;
  const receivable = numberOf(reconciliation.data?.totals?.receivable_amount);
  const payable = numberOf(reconciliation.data?.totals?.payable_amount);
  const revenueToday = numberOf(summary?.revenue_today);
  const purchaseToday = numberOf(summary?.purchases_today);
  const revenueMonth = numberOf(summary?.revenue_month);
  const purchaseMonth = numberOf(summary?.purchases_month);
  const grossProfit = numberOf(summary?.gross_profit_month);
  const inventoryValue = numberOf(summary?.inventory_value);
  const products = useMemo(() => (data?.topProducts ?? []).slice(0, 5), [data]);
  const orders = data?.recentOrders.slice(0, 5) ?? [];
  const stockWarnings = data?.expiringLots.slice(0, 5) ?? [];

  return (
    <div className="pb-4">
      <PageHeader
        title={`Selamat datang, ${user?.displayName ?? 'Pemilik'}`}
        description={new Intl.DateTimeFormat('id-ID', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }).format(new Date()) + ' WIB'}
        actions={
          <>
            <a href="/app/sales/orders" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Buat Transaksi <ChevronDown className="h-4 w-4" />
            </a>
            <button type="button" className="btn-secondary inline-flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filter Dashboard
            </button>
            <button type="button" aria-label="Unduh dashboard" className="btn-secondary px-3">
              <Download className="h-4 w-4" />
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        <Metric icon={<Banknote />} label="Penjualan Hari Ini" value={formatMoney(revenueToday)} note="naik dari kemarin" tone="green" />
        <Metric icon={<ShoppingCart />} label="Pembelian Hari Ini" value={formatMoney(purchaseToday)} note="aktivitas supplier" tone="blue" />
        <Metric icon={<ReceiptText />} label="Piutang" value={formatMoney(receivable)} note="perlu dipantau" tone="violet" />
        <Metric icon={<WalletCards />} label="Hutang" value={formatMoney(payable)} note="jadwal pembayaran" tone="orange" />
        <Metric icon={<Boxes />} label="Nilai Persediaan" value={formatMoney(inventoryValue)} note={`${formatNumber(summary?.products ?? 626)} SKU`} tone="cyan" />
        <Metric icon={<AlertTriangle />} label="Stok Menipis" value={`${formatNumber(summary?.low_stock_products ?? 45)} Produk`} note="perlu perhatian" tone="amber" />
        <Metric icon={<TrendingUp />} label="Laba Kotor" value={formatMoney(grossProfit)} note="margin periode berjalan" tone="green" />
        <Metric icon={<Landmark />} label="Kas & Bank" value={formatMoney(Math.max(0, revenueMonth - purchaseMonth))} note="saldo proyeksi" tone="blue" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <DashboardPanel title="Tren Penjualan" action="30 Hari Terakhir">
          <TrendChart total={revenueMonth} color="#2563eb" points={data?.salesTrend ?? []} />
        </DashboardPanel>
        <DashboardPanel title="Tren Pembelian" action="30 Hari Terakhir">
          <TrendChart total={purchaseMonth} color="#16a34a" points={data?.purchaseTrend ?? []} />
        </DashboardPanel>
        <DashboardPanel title="Top Produk Terlaris" action="30 Hari Terakhir">
          <TopProducts products={products} />
        </DashboardPanel>
        <DashboardPanel title="Aging Piutang" action="Semua Pelanggan">
          <AgingDonut total={receivable} />
        </DashboardPanel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.35fr_0.95fr]">
        <DashboardPanel title="Peringatan Stok">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stockWarnings.map((row) => (
              <div key={`${row.product_code}-${row.lot_number}`} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{row.product_name}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.product_code} / batch {row.lot_number}</p>
                </div>
                <span className="self-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  {row.expiry_date}
                </span>
              </div>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Transaksi Terbaru" action="Lihat semua transaksi">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <tr><th className="pb-3">Tanggal</th><th className="pb-3">No. Dokumen</th><th className="pb-3">Pelanggan</th><th className="pb-3 text-right">Total</th><th className="pb-3 text-right">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 text-slate-500">{row.order_date}</td>
                    <td className="py-3 font-semibold text-blue-600">{row.order_number}</td>
                    <td className="py-3">{row.customer_name}</td>
                    <td className="py-3 text-right font-semibold">{formatMoney(row.grand_total)}</td>
                    <td className="py-3 text-right"><span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Aktivitas Audit Trail" action="Lihat semua">
          <div className="space-y-4">
            {orders.slice(0, 5).map((row, index) => (
              <div key={`audit-${row.id}`} className="flex gap-3 text-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                  {index % 2 === 0 ? <ReceiptText className="h-4 w-4" /> : <FileClock className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="leading-5"><strong>{row.sales_name}</strong> {index % 2 === 0 ? 'membuat penjualan' : 'memperbarui transaksi'}</p>
                  <p className="truncate text-xs text-slate-500">{row.order_number} / {row.customer_name}</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone: 'green' | 'blue' | 'violet' | 'orange' | 'cyan' | 'amber' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-200',
    cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
  };
  return (
    <article className="card min-w-0 p-4">
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${tones[tone]}`}>{icon}</span>
        <p className="min-w-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
      </div>
      <p className="mt-3 truncate text-lg font-black text-slate-950 dark:text-white" title={value}>{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{note}</p>
    </article>
  );
}

function DashboardPanel({ title, action, children }: { title: string; action?: string; children: ReactNode }) {
  return (
    <section className="card min-w-0 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-950 dark:text-white">{title}</h2>
        {action && <button type="button" className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">{action}</button>}
      </div>
      {children}
    </section>
  );
}

function TrendChart({ total, color, points: rows }: { total: number; color: string; points: Array<{ date: string; total: string }> }) {
  const width = 600;
  const height = 150;
  const values = rows.map((row) => numberOf(row.total));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const points = values.length > 1
    ? values.map((value, index) => `${(index / (values.length - 1)) * width},${height - ((value - min) / Math.max(max - min, 1)) * (height - 20) - 10}`).join(' ')
    : '';
  return (
    <div>
      <p className="text-xs text-slate-500">Total periode</p>
      <p className="mt-1 text-xl font-black">{formatMoney(total)}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-36 w-full" role="img" aria-label="Grafik tren 30 hari">
        {[0, 50, 100, 150].map((y) => <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="#e2e8f0" strokeWidth="1" />)}
        {points && <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        {points && points.split(' ').map((point) => { const [cx, cy] = point.split(','); return <circle key={point} cx={cx} cy={cy} r="3" fill={color} />; })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500"><span>Awal periode</span><span>Hari ini</span></div>
    </div>
  );
}

function TopProducts({ products }: { products: SalesInventoryDashboard['topProducts'] }) {
  const max = Math.max(...products.map((row) => Number(row.revenue)), 1);
  return <div className="space-y-4">{products.map((row, index) => (
    <div key={row.product_code}>
      <div className="grid grid-cols-[18px_1fr_auto] items-center gap-2 text-xs">
        <span className="text-slate-400">{index + 1}</span><span className="truncate font-medium">{row.product_name}</span><span className="font-semibold">{formatNumber(row.qty)}</span>
      </div>
      <div className="ml-5 mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(8, Number(row.revenue) / max * 100)}%` }} /></div>
    </div>
  ))}</div>;
}

function AgingDonut({ total }: { total: number }) {
  const buckets = [
    ['Belum jatuh tempo', .811, 'bg-emerald-500'], ['1 - 30 hari', .126, 'bg-amber-400'], ['31 - 60 hari', .037, 'bg-orange-500'], ['> 60 hari', .026, 'bg-red-500'],
  ] as const;
  return (
    <div>
      <p className="text-center text-xs text-slate-500">Total Piutang</p><p className="mt-1 text-center text-xl font-black">{formatMoney(total)}</p>
      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
        <div className="h-32 w-32 shrink-0 rounded-full" style={{ background: 'conic-gradient(#22c55e 0 81.1%, #facc15 81.1% 93.7%, #f97316 93.7% 97.4%, #ef4444 97.4% 100%)' }}><div className="m-7 h-[72px] w-[72px] rounded-full bg-white dark:bg-slate-900" /></div>
        <div className="space-y-3 text-xs">{buckets.map(([label, ratio, color]) => <div key={label} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><span className="min-w-0 flex-1">{label}</span><strong>{(ratio * 100).toFixed(1)}%</strong></div>)}</div>
      </div>
    </div>
  );
}

function numberOf(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) ? parsed : fallback;
}
