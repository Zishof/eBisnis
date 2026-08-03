import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, ShieldCheck, SlidersHorizontal, UserCog } from 'lucide-react';
import { api, formatDateTime } from '../../../lib/api';
import { useAuth, useErrorMessage } from '../../../app/auth-context';
import {
  Code,
  DataGrid,
  EmptyState,
  PageHeader,
  StatusBadge,
  type GridColumn,
} from '../../../components/ui';

interface TenantUser extends Record<string, unknown> {
  id: string;
  platformUserId: string;
  code: string;
  name: string;
  username: string;
  email: string | null;
  status: string;
  isOwner: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  updatedAt: string;
  roles: string[];
  roleCount: number;
}

interface MenuNode extends Record<string, unknown> {
  id: string;
  code: string;
  label: string;
  route: string | null;
  moduleCode: string | null;
  actions: string[];
  children: MenuNode[];
}

interface AuditTableRow extends Record<string, unknown> {
  tableName: string;
  inserts: number;
  updates: number;
  deletes: number;
  total: number;
  distinctEditors: number;
  lastChangeAt: string | null;
}

interface AuditActorRow extends Record<string, unknown> {
  actorUserId: string | null;
  actorUsername: string | null;
  inserts: number;
  updates: number;
  deletes: number;
  distinctTables: number;
  lastChangeAt: string | null;
}

interface AuditSummary<T> {
  sinceDays: number;
  items: T[];
}

interface SessionRow extends Record<string, unknown> {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

interface RoleRow extends Record<string, unknown> {
  roleId: string;
  code: string;
  name: string;
  permissionCount: number;
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const toMessage = useErrorMessage();
  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<TenantUser[]>('/admin/users'),
  });

  const columns: Array<GridColumn<TenantUser>> = [
    { key: 'name', header: 'Nama' },
    { key: 'username', header: 'Username', render: (row) => <Code>{row.username}</Code> },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '-' },
    {
      key: 'roles',
      header: 'Role',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.length ? row.roles.map((role) => <StatusBadge key={role} status={role} />) : '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={row.isActive ? row.status : 'INACTIVE'} />
          {row.isOwner && <StatusBadge status="OWNER" tone="brand" />}
        </div>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Login terakhir',
      render: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : '-'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Daftar pengguna yang terhubung ke tenant aktif beserta role yang sedang diberikan."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Administrasi Sistem' }]}
      />
      <DataGrid
        columns={columns}
        rows={users.data ?? []}
        loading={users.isLoading}
        error={users.isError ? toMessage(users.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void users.refetch()}
      />
    </>
  );
}

export function RolePermissionsPage() {
  const { t } = useTranslation();
  const toMessage = useErrorMessage();
  const menus = useQuery({
    queryKey: ['admin', 'role-permissions', 'menus'],
    queryFn: () => api.get<MenuNode[]>('/me/menus'),
  });
  const rows = useMemo(() => flattenMenus(menus.data ?? []), [menus.data]);

  const columns: Array<GridColumn<MenuNode>> = [
    { key: 'label', header: 'Menu' },
    { key: 'code', header: 'Kode', render: (row) => <Code>{row.code}</Code> },
    { key: 'route', header: 'Route', render: (row) => (row.route ? <Code>{row.route}</Code> : '-') },
    {
      key: 'actions',
      header: 'Aksi efektif',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.actions.map((action) => (
            <StatusBadge key={action} status={action} tone={action === 'READ' ? 'info' : 'neutral'} />
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Hak Akses Menu"
        description="Ringkasan menu dan aksi yang efektif untuk sesi saat ini. Pengaturan role detail dikelola dari halaman Role."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Administrasi Sistem' }]}
        actions={
          <Link className="btn-primary" to="/app/roles">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Kelola Role
          </Link>
        }
      />
      <DataGrid
        columns={columns}
        rows={rows}
        loading={menus.isLoading}
        error={menus.isError ? toMessage(menus.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void menus.refetch()}
      />
    </>
  );
}

export function TenantAuditPage() {
  const { t } = useTranslation();
  const toMessage = useErrorMessage();
  const tables = useQuery({
    queryKey: ['admin', 'audit', 'tables'],
    queryFn: () => api.get<AuditSummary<AuditTableRow>>('/table-audit/tables?hari=30'),
  });
  const actors = useQuery({
    queryKey: ['admin', 'audit', 'actors'],
    queryFn: () => api.get<AuditSummary<AuditActorRow>>('/table-audit/actors?hari=30'),
  });

  const tableColumns: Array<GridColumn<AuditTableRow>> = [
    { key: 'tableName', header: 'Tabel', render: (row) => <Code>{row.tableName}</Code> },
    { key: 'total', header: 'Total' },
    { key: 'inserts', header: 'Tambah' },
    { key: 'updates', header: 'Ubah' },
    { key: 'deletes', header: 'Hapus' },
    { key: 'distinctEditors', header: 'Editor' },
    { key: 'lastChangeAt', header: 'Terakhir', render: (row) => row.lastChangeAt ? formatDateTime(row.lastChangeAt) : '-' },
  ];
  const actorColumns: Array<GridColumn<AuditActorRow>> = [
    { key: 'actorUsername', header: 'Pengguna', render: (row) => row.actorUsername ?? '-' },
    { key: 'distinctTables', header: 'Tabel' },
    { key: 'inserts', header: 'Tambah' },
    { key: 'updates', header: 'Ubah' },
    { key: 'deletes', header: 'Hapus' },
    { key: 'lastChangeAt', header: 'Terakhir', render: (row) => row.lastChangeAt ? formatDateTime(row.lastChangeAt) : '-' },
  ];

  return (
    <>
      <PageHeader
        title="Audit"
        description="Ringkasan perubahan tenant selama 30 hari terakhir dari audit database."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Administrasi Sistem' }]}
      />
      <DataGrid
        columns={tableColumns}
        rows={tables.data?.items ?? []}
        loading={tables.isLoading}
        error={tables.isError ? toMessage(tables.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
        rowKey={(row) => row.tableName}
        onRetry={() => void tables.refetch()}
      />
      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Per pengguna</h2>
        <DataGrid
          columns={actorColumns}
          rows={actors.data?.items ?? []}
          loading={actors.isLoading}
          error={actors.isError ? toMessage(actors.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
          rowKey={(row) => row.actorUserId ?? row.actorUsername ?? 'unknown'}
          onRetry={() => void actors.refetch()}
        />
      </section>
    </>
  );
}

export function TenantSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toMessage = useErrorMessage();
  const sessions = useQuery({
    queryKey: ['admin', 'settings', 'sessions'],
    queryFn: () => api.get<SessionRow[]>('/me/sessions'),
  });
  const roles = useQuery({
    queryKey: ['admin', 'settings', 'roles'],
    queryFn: () => api.get<RoleRow[]>('/me/roles'),
  });

  const sessionColumns: Array<GridColumn<SessionRow>> = [
    {
      key: 'isCurrent',
      header: 'Sesi',
      render: (row) => (row.isCurrent ? <StatusBadge status="AKTIF" tone="success" /> : <StatusBadge status="LAIN" />),
    },
    { key: 'ipAddress', header: 'IP', render: (row) => row.ipAddress ? <Code>{row.ipAddress}</Code> : '-' },
    { key: 'lastSeenAt', header: 'Terakhir', render: (row) => row.lastSeenAt ? formatDateTime(row.lastSeenAt) : '-' },
    { key: 'expiresAt', header: 'Kadaluarsa', render: (row) => formatDateTime(row.expiresAt) },
  ];
  const roleColumns: Array<GridColumn<RoleRow>> = [
    { key: 'code', header: 'Kode', render: (row) => <Code>{row.code}</Code> },
    { key: 'name', header: 'Nama' },
    { key: 'permissionCount', header: 'Jumlah izin' },
  ];

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Konteks akun, tenant aktif, role sesi, dan perangkat yang sedang masuk."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Administrasi Sistem' }]}
      />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <InfoTile icon={<UserCog className="h-5 w-5" aria-hidden />} label="Pengguna" value={user?.displayName ?? '-'} detail={user?.username} />
        <InfoTile icon={<SlidersHorizontal className="h-5 w-5" aria-hidden />} label="Tenant" value={user?.tenant?.schemaName ?? '-'} detail={user?.tenant?.verticalCode ?? undefined} />
        <InfoTile icon={<KeyRound className="h-5 w-5" aria-hidden />} label="Izin aktif" value={String(user?.tenantPermissions.length ?? 0)} detail="permission tenant" />
      </div>
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Role saya</h2>
        <DataGrid
          columns={roleColumns}
          rows={roles.data ?? []}
          loading={roles.isLoading}
          error={roles.isError ? toMessage(roles.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
          rowKey={(row) => row.roleId}
          onRetry={() => void roles.refetch()}
        />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Sesi perangkat</h2>
        {(sessions.data?.length ?? 0) === 0 && !sessions.isLoading && !sessions.isError ? (
          <div className="card">
            <EmptyState title="Belum ada sesi" />
          </div>
        ) : (
          <DataGrid
            columns={sessionColumns}
            rows={sessions.data ?? []}
            loading={sessions.isLoading}
            error={sessions.isError ? toMessage(sessions.error, (key, fallback) => t(key, fallback ?? key)) : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void sessions.refetch()}
          />
        )}
      </section>
    </>
  );
}

function flattenMenus(menus: MenuNode[]): MenuNode[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.children ?? [])]);
}

function InfoTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="rounded bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
        {detail && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
      </div>
    </div>
  );
}
