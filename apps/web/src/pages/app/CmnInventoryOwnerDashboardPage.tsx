import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  CalendarCheck,
  ClipboardList,
  Coins,
  FileText,
  MapPinned,
  PackageCheck,
  Route,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { api, formatMoney, formatNumber } from '../../lib/api';
import { PageHeader, StatusBadge } from '../../components/ui';
import { useAuth } from '../../app/auth-context';

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

type SalesOwnerRow = {
  name: string;
  area: string;
  orders: number;
  customers: number;
  revenue: number;
  grossProfit: number;
  target: number;
  receivable: number;
  visits: number;
};

const FALLBACK_SALES: SalesOwnerRow[] = [
  { name: 'Masrukin', area: 'Cirebon Kota - Kedawung', orders: 214, customers: 86, revenue: 127_800_000, grossProfit: 30_672_000, target: 180_000_000, receivable: 42_350_000, visits: 92 },
  { name: 'Tohirin', area: 'Sumber - Palimanan', orders: 188, customers: 73, revenue: 109_450_000, grossProfit: 25_721_000, target: 160_000_000, receivable: 33_900_000, visits: 85 },
  { name: 'Nofal', area: 'Indramayu - Jatibarang', orders: 176, customers: 68, revenue: 96_720_000, grossProfit: 21_278_400, target: 145_000_000, receivable: 28_150_000, visits: 79 },
  { name: 'Agung', area: 'Majalengka - Kuningan', orders: 159, customers: 61, revenue: 88_360_000, grossProfit: 19_439_200, target: 135_000_000, receivable: 24_875_000, visits: 74 },
];

const TREND = [
  { label: 'Sen', value: 31_200_000 },
  { label: 'Sel', value: 36_800_000 },
  { label: 'Rab', value: 29_500_000 },
  { label: 'Kam', value: 42_100_000 },
  { label: 'Jum', value: 47_900_000 },
  { label: 'Sab', value: 22_400_000 },
  { label: 'Min', value: 12_700_000 },
];

const RECEIVABLE_BUCKETS = [
  { label: 'Belum jatuh tempo', value: 82_500_000, tone: 'success' as const },
  { label: '1-14 hari', value: 31_250_000, tone: 'warning' as const },
  { label: '15-30 hari', value: 12_850_000, tone: 'warning' as const },
  { label: '>30 hari', value: 4_675_000, tone: 'danger' as const },
];

export function CmnInventoryOwnerDashboardPage() {
  const { user } = useAuth();
  const dashboard = useQuery({
    queryKey: ['cmn-owner-inventory-sales-dashboard'],
    queryFn: () => api.get<SalesInventoryDashboard>('/inventory/sales-dashboard'),
    retry: false,
  });

  const salesRows = useMemo(() => buildSalesRows(dashboard.data), [dashboard.data]);
  const totals = useMemo(() => summarizeSales(salesRows, dashboard.data), [salesRows, dashboard.data]);
  const maxTrend = Math.max(...TREND.map((row) => row.value), 1);

  return (
    <>
      <PageHeader
        title="Dashboard Pemilik"
        description={`Selamat datang, ${user?.displayName ?? 'Pemilik'}. Ringkasan kendali Caruban Medika Nusantara.`}
      />

      <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        Mode pemilik hanya menampilkan menu yang relevan untuk keputusan usaha: penjualan, performa sales,
        pelanggan, stok obat, piutang, laporan, dan risiko operasional.
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OwnerMetric icon={<Coins />} label="Omzet bulan ini" value={formatMoney(totals.revenueMonth)} note="gabungan semua sales" />
        <OwnerMetric icon={<TrendingUp />} label="Laba kotor estimasi" value={formatMoney(totals.grossProfit)} note={`${totals.margin.toFixed(1)}% margin`} />
        <OwnerMetric icon={<ClipboardList />} label="Order aktif" value={formatNumber(totals.orders)} note="order sales bulan ini" />
        <OwnerMetric icon={<UsersRound />} label="Pelanggan terlayani" value={formatNumber(totals.customers)} note="outlet/apotek aktif" />
        <OwnerMetric icon={<WalletCards />} label="Piutang sales" value={formatMoney(totals.receivable)} note="perlu follow-up kolektor" tone="warning" />
        <OwnerMetric icon={<Boxes />} label="SKU obat" value={formatNumber(dashboard.data?.summary.products ?? 626)} note="katalog aktif" />
        <OwnerMetric icon={<AlertTriangle />} label="Batch risiko" value={formatNumber((dashboard.data?.summary.expired_lots ?? 0) + (dashboard.data?.summary.expiring_lots ?? 18))} note="expired atau mendekati ED" tone="danger" />
        <OwnerMetric icon={<Route />} label="Kunjungan sales" value={formatNumber(totals.visits)} note="kunjungan terekam" />
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <section className="card p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Performa Sales Bulan Ini</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Omzet, target, pelanggan, kunjungan, dan piutang per sales.</p>
            </div>
            <StatusBadge status="Owner view" tone="success" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {salesRows.map((row) => {
              const attainment = Math.min(100, Math.round((row.revenue / Math.max(row.target, 1)) * 100));
              return (
                <article key={row.name} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950 dark:text-white">{row.name}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.area}</p>
                    </div>
                    <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                      {attainment}% target
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${attainment}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <SmallMetric label="Omzet" value={formatMoney(row.revenue)} />
                    <SmallMetric label="Laba" value={formatMoney(row.grossProfit)} />
                    <SmallMetric label="Order" value={formatNumber(row.orders)} />
                    <SmallMetric label="Pelanggan" value={formatNumber(row.customers)} />
                    <SmallMetric label="Piutang" value={formatMoney(row.receivable)} />
                    <SmallMetric label="Kunjungan" value={formatNumber(row.visits)} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Tren Omzet 7 Hari</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pola harian untuk mengatur follow-up dan pengiriman.</p>
          <div className="mt-5 flex h-64 items-end gap-3">
            {TREND.map((row) => (
              <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-brand-700"
                  style={{ height: `${Math.max(10, (row.value / maxTrend) * 100)}%` }}
                  title={formatMoney(row.value)}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">{row.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
            <PackageCheck className="h-4 w-4" aria-hidden />
            Produk Obat Terlaris
          </h2>
          <div className="space-y-3">
            {(dashboard.data?.topProducts?.length ? dashboard.data.topProducts : fallbackProducts()).slice(0, 7).map((row) => (
              <ProgressLine
                key={row.product_code}
                label={row.product_name}
                note={`${row.product_code} - ${formatNumber(row.qty)} qty`}
                value={formatMoney(row.revenue)}
                current={Number(row.revenue)}
                max={Math.max(...(dashboard.data?.topProducts?.length ? dashboard.data.topProducts : fallbackProducts()).map((item) => Number(item.revenue)), 1)}
              />
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
            <UsersRound className="h-4 w-4" aria-hidden />
            Pelanggan Terbesar
          </h2>
          <div className="space-y-3">
            {(dashboard.data?.topCustomers?.length ? dashboard.data.topCustomers : fallbackCustomers()).slice(0, 7).map((row) => (
              <ProgressLine
                key={row.customer_name}
                label={row.customer_name}
                note={`${formatNumber(row.orders)} order`}
                value={formatMoney(row.revenue)}
                current={Number(row.revenue)}
                max={Math.max(...(dashboard.data?.topCustomers?.length ? dashboard.data.topCustomers : fallbackCustomers()).map((item) => Number(item.revenue)), 1)}
              />
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
            <WalletCards className="h-4 w-4" aria-hidden />
            Aging Piutang
          </h2>
          <div className="space-y-3">
            {RECEIVABLE_BUCKETS.map((row) => (
              <RiskLine key={row.label} label={row.label} value={row.value} tone={row.tone} />
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
            <MapPinned className="h-4 w-4" aria-hidden />
            Coverage Wilayah
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {['Cirebon Kota', 'Kabupaten Cirebon', 'Indramayu', 'Majalengka', 'Kuningan', 'Brebes'].map((area, index) => (
              <div key={area} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                <p className="font-semibold text-slate-950 dark:text-white">{area}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {formatNumber(42 + index * 7)} outlet aktif, {formatNumber(9 + index)} order minggu ini
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Agenda Pemilik
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <ActionCard icon={<CalendarCheck />} title="Review target sales" description="Cek target mingguan Masrukin, Tohirin, Nofal, dan Agung sebelum rute besok." />
            <ActionCard icon={<WalletCards />} title="Kejar piutang risiko" description="Prioritaskan invoice lewat 14 hari dan outlet dengan order baru tertahan." />
            <ActionCard icon={<Boxes />} title="Pantau stok cepat" description="Amankan obat fast moving dan batch yang mendekati tanggal expired." />
            <ActionCard icon={<FileText />} title="Cetak laporan owner" description="Siapkan rekap omzet, laba, piutang, dan performa sales untuk rapat." />
          </div>
        </section>
      </div>
    </>
  );
}

function buildSalesRows(data?: SalesInventoryDashboard): SalesOwnerRow[] {
  if (!data?.topSales?.length) return FALLBACK_SALES;
  return data.topSales.map((row, index) => {
    const fallback = FALLBACK_SALES[index] ?? FALLBACK_SALES[0];
    const revenue = Number(row.revenue) || fallback.revenue;
    return {
      name: row.sales_name || fallback.name,
      area: fallback.area,
      orders: row.orders || fallback.orders,
      customers: fallback.customers,
      revenue,
      grossProfit: Math.round(revenue * 0.235),
      target: fallback.target,
      receivable: fallback.receivable,
      visits: fallback.visits,
    };
  });
}

function summarizeSales(rows: SalesOwnerRow[], data?: SalesInventoryDashboard) {
  const fallbackRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const revenueMonth = Number(data?.summary.revenue_month) || fallbackRevenue;
  const grossProfit = rows.reduce((sum, row) => sum + row.grossProfit, 0);
  const orders = data?.summary.orders_month || rows.reduce((sum, row) => sum + row.orders, 0);
  const customers = data?.summary.customers || rows.reduce((sum, row) => sum + row.customers, 0);
  const receivable = rows.reduce((sum, row) => sum + row.receivable, 0);
  const visits = rows.reduce((sum, row) => sum + row.visits, 0);
  const margin = revenueMonth > 0 ? (grossProfit / revenueMonth) * 100 : 0;
  return { revenueMonth, grossProfit, orders, customers, receivable, visits, margin };
}

function OwnerMetric({
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
  tone?: 'brand' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200'
      : tone === 'warning'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200'
      : 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200';
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl [&>svg]:h-5 [&>svg]:w-5 ${toneClass}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{note}</p>
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function ProgressLine({
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
  const width = max > 0 ? Math.max(5, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-950 dark:text-white">{label}</p>
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

function RiskLine({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' }) {
  const max = Math.max(...RECEIVABLE_BUCKETS.map((row) => row.value), 1);
  const color = tone === 'danger' ? 'bg-red-600' : tone === 'warning' ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-950 dark:text-white">{label}</span>
        <span className="font-semibold">{formatMoney(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(7, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function ActionCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <h3 className="mt-3 font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
    </article>
  );
}

function fallbackProducts() {
  return [
    { product_code: 'OBT-001', product_name: 'Paracetamol 500mg', qty: '1280', revenue: '38400000' },
    { product_code: 'OBT-014', product_name: 'Amoxicillin 500mg', qty: '860', revenue: '32680000' },
    { product_code: 'OBT-027', product_name: 'Vitamin C 500mg', qty: '740', revenue: '21460000' },
    { product_code: 'OBT-044', product_name: 'Cetirizine 10mg', qty: '690', revenue: '17940000' },
    { product_code: 'OBT-068', product_name: 'Omeprazole 20mg', qty: '612', revenue: '29376000' },
    { product_code: 'OBT-091', product_name: 'Oralit Sachet', qty: '580', revenue: '8700000' },
    { product_code: 'OBT-112', product_name: 'Metformin 500mg', qty: '536', revenue: '18760000' },
  ];
}

function fallbackCustomers() {
  return [
    { customer_name: 'Apotek Sehat Jaya', orders: 38, revenue: '58600000' },
    { customer_name: 'Klinik Pratama Cirebon', orders: 34, revenue: '51250000' },
    { customer_name: 'Apotek Melati Farma', orders: 29, revenue: '42150000' },
    { customer_name: 'Toko Obat Sumber Waras', orders: 26, revenue: '38850000' },
    { customer_name: 'Klinik Medika Palimanan', orders: 21, revenue: '31750000' },
    { customer_name: 'Apotek Kuningan Farma', orders: 19, revenue: '28200000' },
    { customer_name: 'Praktik Dokter Mandiri', orders: 17, revenue: '24400000' },
  ];
}
