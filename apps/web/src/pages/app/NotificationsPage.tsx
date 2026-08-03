import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, Check, ExternalLink, X } from 'lucide-react';
import { api, formatDateTime } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, useToast } from '../../components/ui';

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  deep_link: string | null;
  action_required: boolean;
  acted_at: string | null;
  read_at: string | null;
  created_at: string;
  occurrence_count: number;
  last_occurred_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  group_key: string | null;
}

interface NotificationResponse {
  unreadCount: number;
  actionPendingCount: number;
  items: NotificationItem[];
}

export function NotificationsPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', 'bell'],
    queryFn: () => api.get<NotificationResponse>('/notifications?jumlah=100'),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markAllRead = useMutation({
    mutationFn: (ids: string[]) => api.post('/notifications/baca', { ids }),
    onSuccess: () => {
      toast.push('Notifikasi ditandai sudah dibaca.', 'success');
      refresh();
    },
    onError: (error) => toast.push(toMessage(error, (_, fallback) => fallback ?? 'Gagal memperbarui notifikasi.'), 'error'),
  });
  const act = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/tindaklanjuti`),
    onSuccess: () => refresh(),
    onError: (error) => toast.push(toMessage(error, (_, fallback) => fallback ?? 'Gagal memperbarui notifikasi.'), 'error'),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/tutup`),
    onSuccess: () => refresh(),
    onError: (error) => toast.push(toMessage(error, (_, fallback) => fallback ?? 'Gagal menutup notifikasi.'), 'error'),
  });

  const unreadIds = query.data?.items.filter((item) => !item.read_at).map((item) => item.id) ?? [];

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description="Pemberitahuan tenant yang belum dibaca dan yang masih menuntut tindakan."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Notifikasi' }]}
        actions={
          unreadIds.length > 0 ? (
            <button type="button" className="btn-outline" onClick={() => markAllRead.mutate(unreadIds)}>
              <Check className="h-4 w-4" aria-hidden />
              Tandai dibaca
            </button>
          ) : undefined
        }
      />

      {query.isLoading && <LoadingState />}
      {query.isError && (
        <ErrorState
          message={toMessage(query.error, (_, fallback) => fallback ?? 'Gagal memuat notifikasi.')}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Summary label="Belum dibaca" value={query.data.unreadCount} />
            <Summary label="Menunggu tindakan" value={query.data.actionPendingCount} />
          </div>
          {query.data.items.length === 0 ? (
            <div className="card">
              <EmptyState title="Tidak ada notifikasi" description="Semua pemberitahuan sudah beres." />
            </div>
          ) : (
            <div className="space-y-3">
              {query.data.items.map((item) => (
                <article key={item.id} className="card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Bell className="h-4 w-4 text-emerald-700" aria-hidden />
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h2>
                        <StatusBadge status={item.severity} />
                        {!item.read_at && <StatusBadge status="BARU" tone="info" />}
                        {item.action_required && !item.acted_at && <StatusBadge status="PERLU TINDAKAN" tone="warning" />}
                      </div>
                      {item.body && <p className="text-sm text-slate-600 dark:text-slate-300">{item.body}</p>}
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDateTime(item.last_occurred_at ?? item.created_at)}
                        {item.occurrence_count > 1 ? ` · ${item.occurrence_count} kali` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {item.deep_link && (
                        <Link className="btn-outline text-xs" to={item.deep_link}>
                          <ExternalLink className="h-4 w-4" aria-hidden />
                          Buka
                        </Link>
                      )}
                      {item.action_required && !item.acted_at && (
                        <button type="button" className="btn-primary text-xs" onClick={() => act.mutate(item.id)}>
                          <Check className="h-4 w-4" aria-hidden />
                          Selesai
                        </button>
                      )}
                      {!item.action_required && (
                        <button type="button" className="btn-outline text-xs" onClick={() => dismiss.mutate(item.id)}>
                          <X className="h-4 w-4" aria-hidden />
                          Tutup
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
