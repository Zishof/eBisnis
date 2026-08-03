import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Boxes, ClipboardList, Megaphone, PackageCheck, TrendingUp } from 'lucide-react';
import { api, formatNumber } from '../../lib/api';
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
      </div>

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
