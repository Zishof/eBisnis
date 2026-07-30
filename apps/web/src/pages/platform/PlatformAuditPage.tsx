import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, formatDateTime } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { Code, DataGrid, PageHeader, StatusBadge, type GridColumn } from '../../components/ui';

interface AuditEvent extends Record<string, unknown> {
  id: string;
  occurredAt: string;
  moduleCode: string;
  actionCode: string;
  entityType: string | null;
  entityId: string | null;
  tenantSchema: string | null;
  actorUsername: string | null;
  reason: string | null;
  result: string;
  requestId: string | null;
  supportSessionId: string | null;
}

interface SecurityEvent extends Record<string, unknown> {
  id: string;
  occurredAt: string;
  eventCode: string;
  severity: string;
  result: string;
  actorUsername: string | null;
  ipAddress: string | null;
}

export function PlatformAuditPage() {
  const { t } = useTranslation();
  const toMessage = useErrorMessage();
  const [moduleCode, setModuleCode] = useState('');
  const [actionCode, setActionCode] = useState('');

  const audit = useQuery({
    queryKey: ['platform', 'audit', moduleCode, actionCode],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (moduleCode) params.set('moduleCode', moduleCode);
      if (actionCode) params.set('actionCode', actionCode);
      return api.get<AuditEvent[]>(`/platform/audit?${params.toString()}`);
    },
  });

  const security = useQuery({
    queryKey: ['platform', 'security-events'],
    queryFn: () => api.get<SecurityEvent[]>('/platform/security-events?limit=100'),
  });

  const auditColumns: Array<GridColumn<AuditEvent>> = [
    { key: 'occurredAt', header: 'Waktu', render: (row) => formatDateTime(row.occurredAt) },
    { key: 'moduleCode', header: 'Modul', render: (row) => <Code>{row.moduleCode}</Code> },
    { key: 'actionCode', header: 'Aksi', render: (row) => <Code>{row.actionCode}</Code> },
    {
      key: 'entity',
      header: 'Entitas',
      render: (row) => (row.entityType ? <Code>{row.entityType}</Code> : '—'),
    },
    {
      key: 'tenantSchema',
      header: 'Schema',
      render: (row) => (row.tenantSchema ? <Code>{row.tenantSchema}</Code> : '—'),
    },
    { key: 'actorUsername', header: 'Aktor', render: (row) => row.actorUsername ?? '—' },
    { key: 'result', header: 'Hasil', render: (row) => <StatusBadge status={row.result} /> },
    {
      key: 'reason',
      header: 'Alasan',
      render: (row) => (
        <span className="block max-w-xs truncate" title={row.reason ?? undefined}>
          {row.reason ?? '—'}
        </span>
      ),
    },
    {
      key: 'supportSessionId',
      header: 'Support',
      render: (row) => (row.supportSessionId ? <StatusBadge status="SUPPORT" tone="warning" /> : '—'),
    },
  ];

  const securityColumns: Array<GridColumn<SecurityEvent>> = [
    { key: 'occurredAt', header: 'Waktu', render: (row) => formatDateTime(row.occurredAt) },
    { key: 'eventCode', header: 'Event', render: (row) => <Code>{row.eventCode}</Code> },
    { key: 'severity', header: 'Tingkat', render: (row) => <StatusBadge status={row.severity} /> },
    { key: 'result', header: 'Hasil', render: (row) => <StatusBadge status={row.result} /> },
    { key: 'actorUsername', header: 'Pengguna', render: (row) => row.actorUsername ?? '—' },
    { key: 'ipAddress', header: 'IP', render: (row) => (row.ipAddress ? <Code>{row.ipAddress}</Code> : '—') },
  ];

  return (
    <>
      <PageHeader
        title={t('platform.audit')}
        description="Audit control plane bersifat append-only. Payload sensitif (kata sandi, token, data kartu) sudah dimasker sebelum disimpan."
        breadcrumbs={[{ label: t('platform.dashboard'), href: '/platform' }]}
      />

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void audit.refetch();
        }}
      >
        <input
          className="field-input max-w-[200px] ltr-code"
          placeholder="moduleCode"
          value={moduleCode}
          onChange={(event) => setModuleCode(event.target.value.toUpperCase())}
          aria-label="Filter modul"
        />
        <input
          className="field-input max-w-[220px] ltr-code"
          placeholder="actionCode"
          value={actionCode}
          onChange={(event) => setActionCode(event.target.value.toUpperCase())}
          aria-label="Filter aksi"
        />
        <button type="submit" className="btn-outline">
          {t('common.filter')}
        </button>
      </form>

      <DataGrid
        columns={auditColumns}
        rows={audit.data ?? []}
        loading={audit.isLoading}
        error={audit.isError ? toMessage(audit.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void audit.refetch()}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Event keamanan</h2>
        <DataGrid
          columns={securityColumns}
          rows={security.data ?? []}
          loading={security.isLoading}
          error={
            security.isError
              ? toMessage(security.error, (key, fallback) => t(key, fallback ?? key))
              : undefined
          }
          rowKey={(row) => row.id}
          onRetry={() => void security.refetch()}
        />
      </section>
    </>
  );
}
