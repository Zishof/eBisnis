import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Wand2 } from 'lucide-react';
import { api, formatDate } from '../../lib/api';
import { Code, StatusBadge, useToast } from '../../components/ui';
import { DocumentListPage } from './DocumentListPage';
import { useErrorMessage } from '../../app/auth-context';

interface RequestOrderRow extends Record<string, unknown> {
  id: string;
  request_number: string;
  status: string;
  request_type: string;
  priority: string;
  requesting_warehouse_code: string;
  line_count: string;
  created_at: string;
}

export function RequestOrderPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();

  const generate = useMutation({
    mutationFn: () => api.post<{ generated: unknown[]; alertsCreated: number }>('/request-orders/generate-min-stock'),
    onSuccess: (result) => {
      toast.push(
        `${result.generated.length} Request Order otomatis dibuat, ${result.alertsCreated} notifikasi baru.`,
        result.generated.length > 0 ? 'success' : 'info',
      );
      void queryClient.invalidateQueries({ queryKey: ['/request-orders'] });
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  return (
    <DocumentListPage<RequestOrderRow>
      title={t('purchasing.requestOrder')}
      description="Request Order dari toko, gudang, atau lokasi kepada gudang parent. Dapat dibuat otomatis dari kebijakan minimum stok."
      resourcePath="/request-orders"
      rowKey={(row) => row.id}
      headerActions={
        <button
          type="button"
          className="btn-primary"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          data-testid="generate-min-stock"
        >
          <Wand2 className="h-4 w-4" aria-hidden />
          {t('purchasing.generateMinStock')}
        </button>
      }
      columns={[
        {
          key: 'request_number',
          header: 'Nomor',
          render: (row) => <Code>{row.request_number}</Code>,
        },
        { key: 'requesting_warehouse_code', header: t('inventory.warehouse') },
        {
          key: 'request_type',
          header: 'Tipe',
          render: (row) => (
            <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {row.request_type}
            </span>
          ),
        },
        { key: 'line_count', header: 'Baris' },
        { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
        { key: 'created_at', header: t('common.createdAt'), render: (row) => formatDate(row.created_at) },
      ]}
      actions={[
        {
          key: 'submit',
          label: t('purchasing.submit'),
          path: '/submit',
          allowedStatus: ['DRAFT', 'AUTO_GENERATED'],
          tone: 'primary',
        },
        {
          key: 'approve',
          label: t('purchasing.approve'),
          path: '/approve',
          allowedStatus: ['SUBMITTED', 'WAITING_APPROVAL'],
          tone: 'primary',
        },
        {
          key: 'reject',
          label: t('purchasing.reject'),
          path: '/reject',
          allowedStatus: ['SUBMITTED', 'WAITING_APPROVAL'],
          requireReason: true,
          tone: 'danger',
        },
      ]}
    />
  );
}
