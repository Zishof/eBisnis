import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { formatDateTime } from '../../lib/api';
import { Code, StatusBadge } from '../../components/ui';
import { DocumentListPage } from './DocumentListPage';

interface TransferRow extends Record<string, unknown> {
  id: string;
  transfer_number: string;
  status: string;
  source_warehouse_code: string;
  destination_warehouse_code: string;
  dispatch_date: string | null;
  received_date: string | null;
}

export function InternalTransferPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <p className="text-sm text-sky-900 dark:text-sky-100">
          Saat pengiriman, stok tersedia gudang sumber berkurang dan stok dalam perjalanan bertambah.
          Stok tujuan baru bertambah setelah penerimaan divalidasi.
        </p>
      </div>

      <DocumentListPage<TransferRow>
        title="Internal Transfer"
        description="Distribusi stok antar gudang dengan monitoring status pengiriman dan validasi penerimaan tujuan."
        resourcePath="/internal-transfers"
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'transfer_number',
            header: 'Nomor',
            render: (row) => <Code>{row.transfer_number}</Code>,
          },
          {
            key: 'source_warehouse_code',
            header: 'Dari',
            render: (row) => <Code>{row.source_warehouse_code}</Code>,
          },
          {
            key: 'destination_warehouse_code',
            header: 'Ke',
            render: (row) => <Code>{row.destination_warehouse_code}</Code>,
          },
          { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'dispatch_date',
            header: 'Dikirim',
            render: (row) => (row.dispatch_date ? formatDateTime(row.dispatch_date) : '—'),
          },
          {
            key: 'received_date',
            header: 'Diterima',
            render: (row) => (row.received_date ? formatDateTime(row.received_date) : '—'),
          },
        ]}
        actions={[
          {
            key: 'approve',
            label: t('purchasing.approve'),
            path: '/approve',
            allowedStatus: ['DRAFT', 'WAITING_APPROVAL'],
            tone: 'primary',
          },
          { key: 'allocate', label: 'Alokasikan', path: '/allocate', allowedStatus: ['APPROVED'] },
          { key: 'dispatch', label: 'Kirim', path: '/dispatch', allowedStatus: ['ALLOCATED'], tone: 'primary' },
          { key: 'arrive', label: 'Tandai Tiba', path: '/arrive', allowedStatus: ['IN_TRANSIT'] },
        ]}
      />
    </>
  );
}
