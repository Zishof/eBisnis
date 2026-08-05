import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Camera, Plus, RotateCcw, Trash2, ShieldAlert, Power, Eye } from 'lucide-react';
import { api, apiRequestPaged, formatDateTime, type PageMeta } from '../../lib/api';
import {
  Code,
  ConfirmDialog,
  DataGrid,
  PageHeader,
  Pagination,
  StatusBadge,
  StepUpDialog,
  useToast,
  type GridColumn,
} from '../../components/ui';
import { useAuth, useErrorMessage } from '../../app/auth-context';

interface MasterResourceMeta {
  resourceCode: string;
  label: string;
  menuCode: string;
  searchableFields: string[];
  sortableFields: string[];
  writableFields: string[];
  hardDeletePolicy: string;
  supportsPurge: boolean;
}

interface MasterRow extends Record<string, unknown> {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  is_sample: boolean;
  deleted_at: string | null;
  version: number;
}

interface ReferenceReport {
  canPurge: boolean;
  policy: string;
  references: Array<{ table: string; column: string; label: string; count: number; isTransactional: boolean }>;
}

export function MasterListPage({ resource }: { resource: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { stepUp } = useAuth();
  const toMessage = useErrorMessage();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [onlySample, setOnlySample] = useState(false);
  const [sortBy, setSortBy] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [confirm, setConfirm] = useState<
    | { type: 'delete' | 'purge'; row: MasterRow }
    | null
  >(null);
  const [drawer, setDrawer] = useState<{ row: MasterRow; report?: ReferenceReport } | null>(null);
  const [pendingPurge, setPendingPurge] = useState<{ row: MasterRow; reason: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [imageTarget, setImageTarget] = useState<MasterRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const resources = useQuery({
    queryKey: ['master-resources'],
    queryFn: () => api.get<MasterResourceMeta[]>('/master-resources'),
    staleTime: 10 * 60_000,
  });
  const meta = resources.data?.find((r) => r.resourceCode === resource);

  const queryKey = [
    'master',
    resource,
    page,
    search,
    includeInactive,
    includeDeleted,
    onlySample,
    sortBy,
    sortDir,
  ];

  const list = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        includeInactive: String(includeInactive),
        includeDeleted: String(includeDeleted),
        onlySample: String(onlySample),
        sortDir,
      });
      if (search) params.set('search', search);
      if (sortBy) params.set('sortBy', sortBy);
      return apiRequestPaged<MasterRow[]>(`/${resource}?${params.toString()}`);
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['master', resource] });

  const mutate = useMutation({
    mutationFn: async (input: {
      action: 'deactivate' | 'activate' | 'delete' | 'restore' | 'create';
      row?: MasterRow;
      reason?: string;
      payload?: Record<string, unknown>;
    }) => {
      switch (input.action) {
        case 'create':
          return api.post(`/${resource}`, input.payload);
        case 'deactivate':
          return api.post(`/${resource}/${input.row!.id}/deactivate`, { reason: input.reason });
        case 'activate':
          return api.post(`/${resource}/${input.row!.id}/activate`);
        case 'delete':
          return api.delete(`/${resource}/${input.row!.id}`, { reason: input.reason });
        case 'restore':
          return api.post(`/${resource}/${input.row!.id}/restore`);
      }
    },
    onSuccess: () => {
      toast.push(t('common.save'), 'success');
      setConfirm(null);
      setCreating(false);
      setForm({});
      invalidate();
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  const openReferences = useCallback(
    async (row: MasterRow) => {
      setDrawer({ row });
      try {
        const report = await api.get<ReferenceReport>(`/${resource}/${row.id}/references`);
        setDrawer({ row, report });
      } catch (error) {
        toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error');
      }
    },
    [resource, toast, toMessage, t],
  );

  // Purge memerlukan step-up authentication: kata sandi diminta melalui dialog
  // khusus (input password), bukan prompt teks biasa.
  const purge = useMutation({
    mutationFn: async (input: { row: MasterRow; reason: string; password: string }) => {
      const token = await stepUp(input.password, 'HARD_DELETE', input.reason);
      return api.post(
        `/${resource}/${input.row.id}/purge`,
        { reason: input.reason },
        { headers: { 'X-Step-Up-Token': token } },
      );
    },
    onSuccess: () => {
      setPendingPurge(null);
      toast.push(t('common.save'), 'success');
      invalidate();
    },
    onError: (error) => {
      setPendingPurge(null);
      toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error');
    },
  });

  const uploadImage = useMutation({
    mutationFn: async (input: { product: MasterRow; file: File }) => {
      const body = new FormData();
      body.append('file', input.file);
      return api.post(`/inventory/products/${input.product.id}/image`, body);
    },
    onSuccess: () => {
      toast.push('Gambar produk berhasil diperbarui.', 'success');
      setImageTarget(null);
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  const columns = useMemo<Array<GridColumn<MasterRow>>>(
    () => [
      {
        key: 'code',
        header: t('common.code'),
        sortable: true,
        render: (row) => <Code>{row.code}</Code>,
      },
      { key: 'name', header: t('common.name'), sortable: true },
      {
        key: 'status',
        header: t('common.status'),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <StatusBadge status={row.deleted_at ? 'DELETED' : row.is_active ? 'ACTIVE' : 'INACTIVE'} />
            {row.is_sample && (
              <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                {t('master.isSample')}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'updated_at',
        header: t('common.updatedAt'),
        sortable: true,
        render: (row) => formatDateTime(row.updated_at as string),
      },
      {
        key: 'actions',
        header: t('common.actions'),
        className: 'text-end',
        render: (row) => (
          <div className="flex flex-wrap justify-end gap-1">
            {resource === 'products' && !row.deleted_at ? (
              <button
                type="button"
                className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                onClick={() => setImageTarget(row)}
                title="Ganti gambar produk"
                aria-label={`Ganti gambar ${row.name}`}
              >
                <Camera className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => void openReferences(row)}
              title={t('master.references')}
              aria-label={t('master.references')}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </button>
            {row.deleted_at ? (
              <button
                type="button"
                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                onClick={() => mutate.mutate({ action: 'restore', row })}
                title={t('master.restore')}
                aria-label={t('master.restore')}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                  onClick={() =>
                    mutate.mutate({ action: row.is_active ? 'deactivate' : 'activate', row })
                  }
                  title={row.is_active ? t('master.deactivate') : t('master.activate')}
                  aria-label={row.is_active ? t('master.deactivate') : t('master.activate')}
                >
                  <Power className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                  onClick={() => setConfirm({ type: 'delete', row })}
                  title={t('master.softDelete')}
                  aria-label={t('master.softDelete')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </>
            )}
            {meta?.supportsPurge && (
              <button
                type="button"
                className="rounded p-1.5 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                onClick={() => setConfirm({ type: 'purge', row })}
                title={t('master.purge')}
                aria-label={t('master.purge')}
              >
                <ShieldAlert className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        ),
      },
    ],
    [t, meta, mutate, openReferences, resource],
  );

  const label = meta?.label ?? resource;

  return (
    <>
      <PageHeader
        title={t('master.list', { resource: label })}
        description={meta ? `Kebijakan hapus permanen: ${meta.hardDeletePolicy}` : undefined}
        breadcrumbs={[{ label: t('app.dashboard'), href: '/app' }, { label }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('master.create', { resource: label })}
          </button>
        }
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="field-label" htmlFor="master-search">
              {t('common.search')}
            </label>
            <input
              id="master-search"
              className="field-input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={meta?.searchableFields.join(', ')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            {t('master.includeInactive')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(event) => setIncludeDeleted(event.target.checked)}
            />
            {t('master.includeDeleted')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlySample}
              onChange={(event) => setOnlySample(event.target.checked)}
            />
            {t('master.onlySample')}
          </label>
        </div>
      </div>

      <DataGrid
        columns={columns}
        rows={list.data?.data ?? []}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(key) => {
          if (!meta?.sortableFields.includes(key)) return;
          setSortDir(sortBy === key && sortDir === 'asc' ? 'desc' : 'asc');
          setSortBy(key);
        }}
      />

      {list.data?.meta && (
        <Pagination
          page={(list.data.meta as PageMeta).page}
          totalPages={(list.data.meta as PageMeta).totalPages}
          total={(list.data.meta as PageMeta).total}
          onChange={setPage}
        />
      )}

      {/* Formulir tambah sederhana berbasis whitelist field resource */}
      {creating && meta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('master.create', { resource: label })}
            </h2>
            <div className="mt-4 space-y-3">
              {meta.writableFields
                .filter((field) => !field.endsWith('_id') || field === 'parent_id')
                .map((field) => (
                  <div key={field}>
                    <label className="field-label" htmlFor={`create-${field}`}>
                      {field}
                      {(field === 'code' || field === 'name') && ' *'}
                    </label>
                    <input
                      id={`create-${field}`}
                      className="field-input"
                      value={form[field] ?? ''}
                      onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                    />
                  </div>
                ))}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Field relasi (berakhiran <span className="ltr-code">_id</span>) diisi melalui halaman
              detail agar validasi referensi berjalan.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setCreating(false);
                  setForm({});
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!form.code || mutate.isPending}
                onClick={() => {
                  const payload = Object.fromEntries(
                    Object.entries(form).filter(([, value]) => value !== ''),
                  );
                  mutate.mutate({ action: 'create', payload });
                }}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {imageTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Camera className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ganti gambar produk</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{imageTarget.name}</p>
              </div>
            </div>
            <label className="mt-5 block">
              <span className="field-label">JPEG, PNG, atau WEBP (maksimum 5 MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="field-input mt-1"
                disabled={uploadImage.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadImage.mutate({ product: imageTarget, file });
                }}
              />
            </label>
            <div className="mt-5 flex justify-end">
              <button type="button" className="btn-secondary" disabled={uploadImage.isPending} onClick={() => setImageTarget(null)}>
                {uploadImage.isPending ? 'Mengunggah...' : t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Panel referensi */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('master.references')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <Code>{drawer.row.code}</Code> — {drawer.row.name}
            </p>
            {drawer.report ? (
              <>
                <p className="mt-4 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Kebijakan: </span>
                  <span className="ltr-code font-medium">{drawer.report.policy}</span>
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Dapat di-purge: </span>
                  <StatusBadge
                    status={drawer.report.canPurge ? 'YA' : 'TIDAK'}
                    tone={drawer.report.canPurge ? 'success' : 'danger'}
                  />
                </p>
                {drawer.report.references.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {drawer.report.references.map((reference) => (
                      <li
                        key={`${reference.table}.${reference.column}`}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"
                      >
                        <span>
                          {reference.label}
                          {reference.isTransactional && (
                            <span className="ms-2 badge bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              transaksi
                            </span>
                          )}
                        </span>
                        <span className="font-semibold">{reference.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    Belum ada referensi.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
            )}
            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-outline" onClick={() => setDrawer(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'purge' ? t('master.purge') : t('master.softDelete')}
        description={confirm?.type === 'purge' ? t('master.purgeConfirm') : t('master.deleteConfirm')}
        confirmLabel={confirm?.type === 'purge' ? t('master.purge') : t('master.softDelete')}
        destructive
        requireReason
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) => {
          if (!confirm) return;
          if (confirm.type === 'purge') {
            setPendingPurge({ row: confirm.row, reason: reason ?? 'Purge dari UI' });
            setConfirm(null);
          } else {
            mutate.mutate({ action: 'delete', row: confirm.row, reason });
          }
        }}
      />

      <StepUpDialog
        open={Boolean(pendingPurge)}
        title={t('master.purge')}
        pending={purge.isPending}
        onCancel={() => setPendingPurge(null)}
        onSubmit={(password) => {
          if (pendingPurge) purge.mutate({ ...pendingPurge, password });
        }}
      />
    </>
  );
}
