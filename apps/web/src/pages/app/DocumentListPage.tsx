import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import {
  Code,
  ConfirmDialog,
  DataGrid,
  PageHeader,
  StatusBadge,
  useToast,
  type GridColumn,
} from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';

export interface DocumentAction {
  key: string;
  label: string;
  /** Endpoint relatif terhadap dokumen, mis. `/submit`. */
  path: string;
  method?: 'POST';
  requireReason?: boolean;
  /** Status dokumen yang mengizinkan aksi ini. */
  allowedStatus?: string[];
  body?: Record<string, unknown>;
  tone?: 'primary' | 'outline' | 'danger';
}

/**
 * Halaman dokumen header-line reusable: daftar, detail baris, dan aksi
 * berdasarkan status serta hak akses.
 */
export function DocumentListPage<TRow extends Record<string, unknown>>({
  title,
  description,
  resourcePath,
  columns,
  actions = [],
  rowKey,
  detailRenderer,
  headerActions,
}: {
  title: string;
  description?: string;
  resourcePath: string;
  columns: Array<GridColumn<TRow>>;
  actions?: DocumentAction[];
  rowKey: (row: TRow) => string;
  detailRenderer?: (detail: Record<string, unknown>) => ReactNode;
  headerActions?: ReactNode;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: DocumentAction; id: string } | null>(null);

  const list = useQuery({
    queryKey: [resourcePath, 'list'],
    queryFn: () => api.get<TRow[]>(`${resourcePath}?pageSize=50`),
  });

  const detail = useQuery({
    queryKey: [resourcePath, 'detail', selected],
    queryFn: () => api.get<Record<string, unknown>>(`${resourcePath}/${selected}`),
    enabled: Boolean(selected),
  });

  const run = useMutation({
    mutationFn: (input: { action: DocumentAction; id: string; reason?: string }) =>
      api.post(`${resourcePath}/${input.id}${input.action.path}`, {
        ...(input.action.body ?? {}),
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    onSuccess: () => {
      toast.push(t('common.save'), 'success');
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: [resourcePath] });
      void queryClient.invalidateQueries({ queryKey: ['stock-tree'] });
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  const allColumns: Array<GridColumn<TRow>> = [
    ...columns,
    {
      key: 'row-actions',
      header: t('common.actions'),
      className: 'text-end',
      render: (row) => {
        const id = rowKey(row);
        const status = String(row.status ?? '');
        const available = actions.filter(
          (action) => !action.allowedStatus || action.allowedStatus.includes(status),
        );
        return (
          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              className="btn-outline px-2 py-1 text-xs"
              onClick={() => setSelected(id)}
            >
              Detail
            </button>
            {available.map((action) => (
              <button
                key={action.key}
                type="button"
                className={
                  action.tone === 'danger'
                    ? 'btn px-2 py-1 text-xs bg-rose-600 text-white hover:bg-rose-700'
                    : action.tone === 'primary'
                      ? 'btn-primary px-2 py-1 text-xs'
                      : 'btn-outline px-2 py-1 text-xs'
                }
                disabled={run.isPending}
                onClick={() => {
                  if (action.requireReason) setConfirm({ action, id });
                  else run.mutate({ action, id });
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: t('app.dashboard'), href: '/app' }, { label: title }]}
        actions={headerActions}
      />

      <DataGrid
        columns={allColumns}
        rows={list.data ?? []}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
        rowKey={rowKey}
        onRetry={() => void list.refetch()}
      />

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-3xl overflow-y-auto p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Detail Dokumen</h2>
              <button type="button" className="btn-ghost px-2 py-1" onClick={() => setSelected(null)}>
                {t('common.close')}
              </button>
            </div>
            {detail.isLoading ? (
              <p className="text-sm text-slate-500">{t('common.loading')}</p>
            ) : detail.data ? (
              detailRenderer ? (
                detailRenderer(detail.data)
              ) : (
                <DefaultDetail detail={detail.data} />
              )
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action.label ?? ''}
        requireReason
        destructive={confirm?.action.tone === 'danger'}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) => {
          if (confirm) run.mutate({ action: confirm.action, id: confirm.id, reason });
        }}
      />
    </>
  );
}

export function DefaultDetail({ detail }: { detail: Record<string, unknown> }) {
  const lines = (detail.lines as Array<Record<string, unknown>> | undefined) ?? [];
  const headerEntries = Object.entries(detail).filter(
    ([key, value]) => key !== 'lines' && value !== null && typeof value !== 'object',
  );

  return (
    <>
      <dl className="grid gap-2 sm:grid-cols-2">
        {headerEntries.slice(0, 16).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 rounded bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800">
            <dt className="text-slate-500 dark:text-slate-400">{key}</dt>
            <dd className="text-end font-medium text-slate-800 dark:text-slate-100">
              {key === 'status' ? <StatusBadge status={String(value)} /> : String(value)}
            </dd>
          </div>
        ))}
      </dl>

      {lines.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="table-grid">
            <thead>
              <tr>
                {Object.keys(lines[0])
                  .filter((key) => !key.endsWith('_id') && key !== 'id')
                  .slice(0, 8)
                  .map((key) => (
                    <th key={key} scope="col">
                      {key}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={String(line.id ?? index)}>
                  {Object.keys(lines[0])
                    .filter((key) => !key.endsWith('_id') && key !== 'id')
                    .slice(0, 8)
                    .map((key) => (
                      <td key={key}>
                        {key.includes('code') ? <Code>{String(line[key] ?? '-')}</Code> : String(line[key] ?? '-')}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
