import { useTranslation } from 'react-i18next';
import { formatDate } from '../../lib/api';
import { Code, StatusBadge } from '../../components/ui';
import { DocumentListPage } from './DocumentListPage';

interface BackorderRow extends Record<string, unknown> {
  id: string;
  backorder_number: string;
  status: string;
  source_purchase_order_number: string | null;
  source_receipt_number: string | null;
  original_supplier_name: string | null;
  replacement_supplier_name: string | null;
  created_at: string;
}

export function BackorderPage() {
  const { t } = useTranslation();

  return (
    <DocumentListPage<BackorderRow>
      title={t('purchasing.backorder')}
      description="Kekurangan penerimaan dapat tetap dipenuhi pemasok awal atau dialihkan ke pemasok pengganti. Jejak dokumen tetap tertelusur ke PO dan penerimaan sumber."
      resourcePath="/backorders"
      rowKey={(row) => row.id}
      columns={[
        {
          key: 'backorder_number',
          header: 'Nomor',
          render: (row) => <Code>{row.backorder_number}</Code>,
        },
        {
          key: 'source_purchase_order_number',
          header: 'PO Sumber',
          render: (row) =>
            row.source_purchase_order_number ? <Code>{row.source_purchase_order_number}</Code> : '-',
        },
        {
          key: 'source_receipt_number',
          header: 'Penerimaan Sumber',
          render: (row) => (row.source_receipt_number ? <Code>{row.source_receipt_number}</Code> : '-'),
        },
        { key: 'original_supplier_name', header: 'Pemasok Awal' },
        {
          key: 'replacement_supplier_name',
          header: 'Pemasok Pengganti',
          render: (row) => row.replacement_supplier_name ?? '—',
        },
        { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
        { key: 'created_at', header: t('common.createdAt'), render: (row) => formatDate(row.created_at) },
      ]}
      actions={[
        {
          key: 'create-po',
          label: 'Buat PO Lanjutan',
          path: '/create-purchase-order',
          allowedStatus: ['DRAFT', 'APPROVED', 'REDIRECTED_TO_OTHER_SUPPLIER', 'CONFIRMED'],
          tone: 'primary',
        },
      ]}
    />
  );
}
