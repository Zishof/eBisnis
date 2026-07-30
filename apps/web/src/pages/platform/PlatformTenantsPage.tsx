import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, formatDate, formatDateTime } from '../../lib/api';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import {
  Code,
  ConfirmDialog,
  DataGrid,
  PageHeader,
  StatusBadge,
  StepUpDialog,
  useToast,
  type GridColumn,
} from '../../components/ui';

interface TenantRow extends Record<string, unknown> {
  id: string;
  code: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  schemaRegistry: {
    schemaName: string;
    auditSchemaName: string;
    status: string;
    schemaVersion: string;
  } | null;
  _count: { memberships: number; devices: number; subscriptions: number };
}

interface RegistrationRow extends Record<string, unknown> {
  id: string;
  businessName: string;
  email: string;
  normalizedUsername: string;
  status: string;
  createdAt: string;
  tenant: { id: string; name: string; schemaRegistry: { schemaName: string; status: string } | null } | null;
}

interface SchemaStatus {
  registry: {
    schemaName: string;
    auditSchemaName: string;
    status: string;
    schemaVersion: string;
    provisionedAt: string | null;
  };
  latestCatalogVersion: string;
  upToDate: boolean;
  verification: { ok: boolean; missingTables: string[]; auditTriggersInstalled: number; tableCount: number };
  history: Array<{ version: string; appliedAt: string; checksum: string }>;
}

export function PlatformTenantsPage({ tab = 'tenants' }: { tab?: 'tenants' | 'registrations' }) {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title={tab === 'tenants' ? t('platform.tenants') : t('platform.registrations')}
        description={
          tab === 'tenants'
            ? 'Setiap tenant memiliki schema data dan schema audit terpisah. Nama schema hanya berasal dari platform.tenant_schema_registry.'
            : 'Riwayat pendaftaran beserta status provisioning schema.'
        }
        breadcrumbs={[{ label: t('platform.dashboard'), href: '/platform' }]}
      />

      <nav className="mb-6 flex gap-2">
        <Link
          to="/platform/tenants"
          className={tab === 'tenants' ? 'btn-primary px-3 py-1.5 text-sm' : 'btn-outline px-3 py-1.5 text-sm'}
        >
          {t('platform.tenants')}
        </Link>
        <Link
          to="/platform/registrations"
          className={
            tab === 'registrations' ? 'btn-primary px-3 py-1.5 text-sm' : 'btn-outline px-3 py-1.5 text-sm'
          }
        >
          {t('platform.registrations')}
        </Link>
      </nav>

      {tab === 'tenants' ? <TenantsTable /> : <RegistrationsTable />}
    </>
  );
}

function TenantsTable() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();
  const { hasPlatformPermission, stepUp } = useAuth();
  const [search, setSearch] = useState('');
  const [inspecting, setInspecting] = useState<TenantRow | null>(null);
  const [suspending, setSuspending] = useState<TenantRow | null>(null);
  const [pendingSuspend, setPendingSuspend] = useState<{ tenantId: string; reason: string } | null>(null);

  const tenants = useQuery({
    queryKey: ['platform', 'tenants', search],
    queryFn: () =>
      api.get<TenantRow[]>(`/platform/tenants?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  const schemaStatus = useQuery({
    queryKey: ['platform', 'schema-status', inspecting?.id],
    queryFn: () => api.get<SchemaStatus>(`/platform/tenants/${inspecting!.id}/schema-status`),
    enabled: Boolean(inspecting) && hasPlatformPermission('PLATFORM.TENANT.SCHEMA_STATUS'),
  });

  const failure = (error: unknown) =>
    toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error');

  const migrate = useMutation({
    mutationFn: (tenantId: string) =>
      api.post<{ schemaName: string; applied: string[] }>(`/platform/tenants/${tenantId}/migrate`),
    onSuccess: (result) => {
      toast.push(
        result.applied.length > 0
          ? `${result.applied.length} migration diterapkan ke ${result.schemaName}.`
          : `Schema ${result.schemaName} sudah pada versi terbaru.`,
        'success',
      );
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: failure,
  });

  const activate = useMutation({
    mutationFn: (tenantId: string) => api.post(`/platform/tenants/${tenantId}/activate`, {}),
    onSuccess: () => {
      toast.push('Tenant diaktifkan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
    },
    onError: failure,
  });

  const suspend = useMutation({
    mutationFn: async (input: { tenantId: string; reason: string; password: string }) => {
      // Penangguhan tenant sensitif: memerlukan step-up authentication.
      const token = await stepUp(input.password, 'TENANT_SUSPEND', input.reason);
      return api.post(
        `/platform/tenants/${input.tenantId}/suspend`,
        { reason: input.reason },
        { headers: { 'X-Step-Up-Token': token } },
      );
    },
    onSuccess: () => {
      setPendingSuspend(null);
      toast.push('Tenant ditangguhkan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
    },
    onError: (error) => {
      setPendingSuspend(null);
      failure(error);
    },
  });

  const columns: Array<GridColumn<TenantRow>> = [
    { key: 'code', header: t('common.code'), render: (row) => <Code>{row.code}</Code> },
    { key: 'name', header: t('common.name') },
    {
      key: 'schema',
      header: 'Schema',
      render: (row) =>
        row.schemaRegistry ? (
          <span className="flex flex-col">
            <Code>{row.schemaRegistry.schemaName}</Code>
            <Code>{row.schemaRegistry.auditSchemaName}</Code>
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'schemaVersion',
      header: 'Versi',
      render: (row) => (row.schemaRegistry ? <Code>{row.schemaRegistry.schemaVersion}</Code> : '—'),
    },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'counts',
      header: 'Pengguna / Perangkat',
      className: 'text-end',
      render: (row) => `${row._count.memberships} / ${row._count.devices}`,
    },
    { key: 'createdAt', header: t('common.createdAt'), render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions',
      header: t('common.actions'),
      className: 'text-end',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <button
            type="button"
            className="btn-outline px-2 py-1 text-xs"
            onClick={() => setInspecting(row)}
          >
            {t('platform.schemaStatus')}
          </button>
          {hasPlatformPermission('PLATFORM.TENANT.MIGRATE') && (
            <button
              type="button"
              className="btn-outline px-2 py-1 text-xs"
              disabled={migrate.isPending}
              onClick={() => migrate.mutate(row.id)}
            >
              {t('platform.migrate')}
            </button>
          )}
          {hasPlatformPermission('PLATFORM.TENANT.ACTIVATE') && row.status !== 'ACTIVE' && (
            <button
              type="button"
              className="btn-primary px-2 py-1 text-xs"
              disabled={activate.isPending}
              onClick={() => activate.mutate(row.id)}
            >
              Aktifkan
            </button>
          )}
          {hasPlatformPermission('PLATFORM.TENANT.SUSPEND') && row.status === 'ACTIVE' && (
            <button
              type="button"
              className="btn bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700"
              onClick={() => setSuspending(row)}
            >
              Tangguhkan
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void tenants.refetch();
        }}
      >
        <input
          className="field-input max-w-sm"
          placeholder={t('common.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t('common.search')}
        />
        <button type="submit" className="btn-outline">
          {t('common.search')}
        </button>
      </form>

      <DataGrid
        columns={columns}
        rows={tenants.data ?? []}
        loading={tenants.isLoading}
        error={
          tenants.isError ? toMessage(tenants.error, (key, fallback) => t(key, fallback ?? key)) : undefined
        }
        rowKey={(row) => row.id}
        onRetry={() => void tenants.refetch()}
      />

      {inspecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('platform.schemaStatus')} — {inspecting.name}
              </h2>
              <button type="button" className="btn-ghost px-2 py-1" onClick={() => setInspecting(null)}>
                {t('common.close')}
              </button>
            </div>
            {schemaStatus.isLoading ? (
              <p className="text-sm text-slate-500">{t('common.loading')}</p>
            ) : schemaStatus.data ? (
              <div className="space-y-4 text-sm">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <Field label="Schema data" value={<Code>{schemaStatus.data.registry.schemaName}</Code>} />
                  <Field label="Schema audit" value={<Code>{schemaStatus.data.registry.auditSchemaName}</Code>} />
                  <Field label="Status" value={<StatusBadge status={schemaStatus.data.registry.status} />} />
                  <Field label="Versi schema" value={<Code>{schemaStatus.data.registry.schemaVersion}</Code>} />
                  <Field label="Versi katalog" value={<Code>{schemaStatus.data.latestCatalogVersion}</Code>} />
                  <Field
                    label="Sinkron"
                    value={<StatusBadge status={schemaStatus.data.upToDate ? 'OK' : 'INSUFFICIENT'} />}
                  />
                  <Field label="Jumlah tabel" value={String(schemaStatus.data.verification.tableCount)} />
                  <Field
                    label="Trigger audit terpasang"
                    value={String(schemaStatus.data.verification.auditTriggersInstalled)}
                  />
                </dl>

                {schemaStatus.data.verification.missingTables.length > 0 && (
                  <div className="rounded border border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/40">
                    <p className="font-medium text-rose-900 dark:text-rose-100">Tabel belum ada:</p>
                    <p className="mt-1 text-xs">
                      <Code>{schemaStatus.data.verification.missingTables.join(', ')}</Code>
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">Riwayat migration</h3>
                  <ul className="space-y-1">
                    {schemaStatus.data.history.map((item) => (
                      <li
                        key={item.version}
                        className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-1.5 text-xs dark:bg-slate-800"
                      >
                        <Code>{item.version}</Code>
                        <span>{formatDateTime(item.appliedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('app.noPermission')}</p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(suspending)}
        title={`Tangguhkan ${suspending?.name ?? ''}`}
        description="Tenant yang ditangguhkan tidak dapat mengakses aplikasi. Aksi ini memerlukan verifikasi ulang kata sandi."
        destructive
        requireReason
        onCancel={() => setSuspending(null)}
        onConfirm={(reason) => {
          if (suspending) {
            setPendingSuspend({ tenantId: suspending.id, reason: reason ?? 'Ditangguhkan admin' });
            setSuspending(null);
          }
        }}
      />

      <StepUpDialog
        open={Boolean(pendingSuspend)}
        pending={suspend.isPending}
        onCancel={() => setPendingSuspend(null)}
        onSubmit={(password) => {
          if (pendingSuspend) suspend.mutate({ ...pendingSuspend, password });
        }}
      />
    </>
  );
}

function RegistrationsTable() {
  const { t } = useTranslation();
  const toMessage = useErrorMessage();

  const registrations = useQuery({
    queryKey: ['platform', 'registrations'],
    queryFn: () => api.get<RegistrationRow[]>('/platform/registrations?pageSize=50'),
  });

  const columns: Array<GridColumn<RegistrationRow>> = [
    { key: 'businessName', header: 'Nama bisnis' },
    { key: 'email', header: 'Surel' },
    {
      key: 'normalizedUsername',
      header: 'Nama pengguna / schema',
      render: (row) => <Code>{row.normalizedUsername}</Code>,
    },
    {
      key: 'schemaStatus',
      header: 'Status schema',
      render: (row) =>
        row.tenant?.schemaRegistry ? <StatusBadge status={row.tenant.schemaRegistry.status} /> : '—',
    },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: t('common.createdAt'), render: (row) => formatDateTime(row.createdAt) },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={registrations.data ?? []}
      loading={registrations.isLoading}
      error={
        registrations.isError
          ? toMessage(registrations.error, (key, fallback) => t(key, fallback ?? key))
          : undefined
      }
      rowKey={(row) => row.id}
      onRetry={() => void registrations.refetch()}
    />
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 rounded bg-slate-50 px-3 py-1.5 dark:bg-slate-800">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-end font-medium text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}
