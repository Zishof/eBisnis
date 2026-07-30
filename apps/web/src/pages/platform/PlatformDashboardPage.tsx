import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { api, formatNumber } from '../../lib/api';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import { Code, ErrorState, LoadingState, PageHeader, StatusBadge, useToast } from '../../components/ui';

interface PlatformDashboard {
  tenants: { total: number; active: number };
  registrations: { total: number; pendingProvisioning: number; failedProvisioning: number };
  devices: { total: number };
  subscriptions: { active: number };
  invoices: { total: number; unpaid: number };
  payments: { waiting: number };
  demo: { activeSessions: number };
  schema: { tenantMigrationVersion: string; clientCacheSize: number };
}

interface PlatformSeedReport {
  passed: boolean;
  reports: Array<{
    schemaName: string;
    scope: string;
    passed: boolean;
    totalResources: number;
    failingResources: number;
  }>;
}

export function PlatformDashboardPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();
  const { hasPlatformPermission } = useAuth();

  const dashboard = useQuery({
    queryKey: ['platform', 'dashboard'],
    queryFn: () => api.get<PlatformDashboard>('/platform/dashboard'),
  });

  const seed = useQuery({
    queryKey: ['platform', 'seed', 'verify'],
    queryFn: () => api.get<PlatformSeedReport>('/platform/seed/verify?includeTenants=true'),
    enabled: hasPlatformPermission('PLATFORM.SEED.MANAGE'),
  });

  const resetDemo = useMutation({
    mutationFn: () => api.post<{ resetRunId: string; generation: number }>('/platform/demo/reset'),
    onSuccess: (result) => {
      toast.push(`Sandbox demo direset (generasi ${result.generation}).`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) {
    return (
      <ErrorState
        message={toMessage(dashboard.error, (key, fallback) => t(key, fallback ?? key))}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  const data = dashboard.data!;

  return (
    <>
      <PageHeader
        title={t('platform.dashboard')}
        description="Ringkasan control plane: tenant, provisioning, langganan, invoice, pembayaran, dan sandbox demo."
        actions={
          hasPlatformPermission('PLATFORM.TENANT.MIGRATE') ? (
            <button
              type="button"
              className="btn-outline"
              onClick={() => resetDemo.mutate()}
              disabled={resetDemo.isPending}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset Sandbox Demo
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="platform-stats">
        <Stat label="Tenant aktif" value={`${data.tenants.active} / ${data.tenants.total}`} />
        <Stat label="Pendaftar" value={formatNumber(data.registrations.total)} />
        <Stat
          label="Provisioning berjalan"
          value={formatNumber(data.registrations.pendingProvisioning)}
          tone={data.registrations.pendingProvisioning > 0 ? 'warning' : 'neutral'}
        />
        <Stat
          label="Provisioning gagal"
          value={formatNumber(data.registrations.failedProvisioning)}
          tone={data.registrations.failedProvisioning > 0 ? 'danger' : 'neutral'}
        />
        <Stat label="Perangkat POS" value={formatNumber(data.devices.total)} />
        <Stat label="Langganan aktif" value={formatNumber(data.subscriptions.active)} />
        <Stat
          label="Invoice belum lunas"
          value={`${data.invoices.unpaid} / ${data.invoices.total}`}
          tone={data.invoices.unpaid > 0 ? 'warning' : 'neutral'}
        />
        <Stat label="Pembayaran menunggu" value={formatNumber(data.payments.waiting)} />
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
            {t('platform.schemaStatus')}
          </h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="Versi katalog migration tenant"
              value={<Code>{data.schema.tenantMigrationVersion}</Code>}
            />
            <Row label="Pool schema tenant di cache" value={formatNumber(data.schema.clientCacheSize)} />
            <Row label="Sesi demo aktif" value={formatNumber(data.demo.activeSessions)} />
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">{t('platform.seed')}</h2>
          {!hasPlatformPermission('PLATFORM.SEED.MANAGE') ? (
            <p className="text-sm text-slate-500">{t('app.noPermission')}</p>
          ) : seed.isLoading ? (
            <p className="text-sm text-slate-500">{t('common.loading')}</p>
          ) : seed.data ? (
            <>
              <p className="mb-3 text-sm">
                <StatusBadge status={seed.data.passed ? 'PASSED' : 'FAILED'} />
              </p>
              <ul className="space-y-1 text-sm">
                {seed.data.reports.map((report) => (
                  <li
                    key={`${report.scope}-${report.schemaName}`}
                    className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-1.5 dark:bg-slate-800"
                  >
                    <span>
                      <Code>{report.schemaName}</Code>{' '}
                      <span className="text-xs text-slate-500">({report.scope})</span>
                    </span>
                    <span className="text-xs">
                      {report.totalResources - report.failingResources}/{report.totalResources}{' '}
                      <StatusBadge status={report.passed ? 'OK' : 'INSUFFICIENT'} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={
          tone === 'danger'
            ? 'mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400'
            : tone === 'warning'
              ? 'mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400'
              : 'mt-1 text-2xl font-bold text-slate-900 dark:text-white'
        }
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="font-medium text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}
