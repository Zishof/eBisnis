import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShieldAlert, Trash2, Undo2, Wrench } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import {
  Code,
  ConfirmDialog,
  DataGrid,
  PageHeader,
  StatusBadge,
  useToast,
  type GridColumn,
} from '../../components/ui';

interface VerifyRow extends Record<string, unknown> {
  resourceCode: string;
  label: string;
  requiredMinimum: number;
  activeCount: number;
  sampleCount: number;
  status: 'OK' | 'INSUFFICIENT' | 'EXEMPT' | 'MISSING_TABLE';
  missingCodes: string[];
}

interface VerifyReport {
  schemaName: string;
  scope: string;
  checkedAt: string;
  passed: boolean;
  totalResources: number;
  failingResources: number;
  rows: VerifyRow[];
}

interface CleanupSummary {
  schemaName: string;
  removed: Array<{ resourceCode: string; count: number }>;
  blocked: Array<{ resourceCode: string; code: string; reason: string }>;
  totalRemoved: number;
}

interface SeedException {
  resourceCode: string;
  reason: string;
}

export function SampleDataPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();
  const { user } = useAuth();
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const verify = useQuery({
    queryKey: ['sample-data', 'verify'],
    queryFn: () => api.get<VerifyReport>('/sample-data/verify'),
  });

  const exceptions = useQuery({
    queryKey: ['sample-data', 'exceptions'],
    queryFn: () => api.get<SeedException[]>('/sample-data/exceptions'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['sample-data'] });
    void queryClient.invalidateQueries({ queryKey: ['stock-tree'] });
  };

  const failure = (error: unknown) =>
    toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error');

  const repair = useMutation({
    mutationFn: () => api.post<{ totalInserted: number; totalUpdated: number }>('/sample-data/repair'),
    onSuccess: (result) => {
      toast.push(
        `${result.totalInserted} record ditambahkan, ${result.totalUpdated} diperbarui.`,
        'success',
      );
      invalidate();
    },
    onError: failure,
  });

  const cleanup = useMutation({
    mutationFn: (reason: string) => api.post<CleanupSummary>('/sample-data/cleanup', { reason }),
    onSuccess: (result) => {
      setConfirmCleanup(false);
      toast.push(
        `${result.totalRemoved} data contoh dihapus. ${result.blocked.length} terblokir karena sudah dipakai transaksi.`,
        result.blocked.length > 0 ? 'info' : 'success',
      );
      queryClient.setQueryData(['sample-data', 'cleanup-result'], result);
      invalidate();
    },
    onError: (error) => {
      setConfirmCleanup(false);
      failure(error);
    },
  });

  const restore = useMutation({
    mutationFn: () => api.post<{ restored: number }>('/sample-data/restore'),
    onSuccess: (result) => {
      toast.push(`${result.restored} data contoh dipulihkan.`, 'success');
      invalidate();
    },
    onError: failure,
  });

  const lastCleanup = queryClient.getQueryData<CleanupSummary>(['sample-data', 'cleanup-result']);
  const readOnly = Boolean(user?.isDemo);

  const columns: Array<GridColumn<VerifyRow>> = [
    { key: 'label', header: t('common.name') },
    {
      key: 'resourceCode',
      header: t('seed.resourceCode'),
      render: (row) => <Code>{row.resourceCode}</Code>,
    },
    { key: 'requiredMinimum', header: t('seed.requiredMinimum'), className: 'text-end' },
    { key: 'activeCount', header: t('seed.activeCount'), className: 'text-end' },
    { key: 'sampleCount', header: t('seed.sampleCount'), className: 'text-end' },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'missingCodes',
      header: t('seed.missingCodes'),
      render: (row) =>
        row.missingCodes.length === 0 ? (
          '—'
        ) : (
          <span className="text-xs text-rose-700 dark:text-rose-300">
            <Code>{row.missingCodes.slice(0, 4).join(', ')}</Code>
            {row.missingCodes.length > 4 && ` +${row.missingCodes.length - 4}`}
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('seed.title')}
        description={t('seed.subtitle')}
        breadcrumbs={[{ label: t('app.dashboard'), href: '/app' }, { label: t('seed.title') }]}
        actions={
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => void verify.refetch()}
              disabled={verify.isFetching}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t('seed.verify')}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => repair.mutate()}
              disabled={repair.isPending || readOnly}
              data-testid="seed-repair"
            >
              <Wrench className="h-4 w-4" aria-hidden />
              {t('seed.repair')}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => restore.mutate()}
              disabled={restore.isPending || readOnly}
            >
              <Undo2 className="h-4 w-4" aria-hidden />
              {t('seed.restore')}
            </button>
            <button
              type="button"
              className="btn bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => setConfirmCleanup(true)}
              disabled={cleanup.isPending || readOnly}
              data-testid="seed-cleanup"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t('seed.cleanup')}
            </button>
          </>
        }
      />

      {verify.data && (
        <div
          className={
            verify.data.passed
              ? 'mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40'
          }
          data-testid="seed-verify-summary"
        >
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {verify.data.passed ? t('seed.passed') : t('seed.failed')} — {verify.data.totalResources} resource,{' '}
            {verify.data.failingResources} belum memenuhi minimum. Schema:{' '}
            <Code>{verify.data.schemaName}</Code>
          </p>
        </div>
      )}

      <DataGrid
        columns={columns}
        rows={verify.data?.rows ?? []}
        loading={verify.isLoading}
        error={
          verify.isError ? toMessage(verify.error, (key, fallback) => t(key, fallback ?? key)) : undefined
        }
        rowKey={(row) => row.resourceCode}
        onRetry={() => void verify.refetch()}
      />

      {lastCleanup && lastCleanup.blocked.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
            {t('seed.blocked')}
          </h2>
          <div className="card divide-y divide-slate-200 dark:divide-slate-800">
            {lastCleanup.blocked.map((item) => (
              <p key={`${item.resourceCode}-${item.code}`} className="px-4 py-2 text-sm">
                <Code>{item.resourceCode}</Code> · <Code>{item.code}</Code> — {item.reason}
              </p>
            ))}
          </div>
        </section>
      )}

      {exceptions.data && exceptions.data.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Master yang dikecualikan dari aturan minimum 10 record
          </h2>
          <div className="card divide-y divide-slate-200 dark:divide-slate-800">
            {exceptions.data.map((item) => (
              <p key={item.resourceCode} className="px-4 py-2 text-sm">
                <Code>{item.resourceCode}</Code> — {item.reason}
              </p>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmCleanup}
        title={t('seed.cleanup')}
        description="Data contoh yang sudah direferensikan transaksi nyata tidak akan dihapus dan akan dilaporkan sebagai terblokir."
        destructive
        requireReason
        onCancel={() => setConfirmCleanup(false)}
        onConfirm={(reason) => cleanup.mutate(reason ?? 'Hapus data contoh')}
      />
    </>
  );
}
