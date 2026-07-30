import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { formatDate } from '../../lib/api';
import { Code, StatusBadge } from '../../components/ui';
import { DocumentListPage } from './DocumentListPage';

interface GoodsReceiptRow extends Record<string, unknown> {
  id: string;
  receipt_number: string;
  status: string;
  validation_status: string;
  purchase_order_number: string | null;
  supplier_name: string | null;
  warehouse_code: string | null;
  receipt_date: string;
}

export function GoodsReceiptPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <p className="text-sm text-sky-900 dark:text-sky-100">{t('purchasing.validateHint')}</p>
      </div>

      <DocumentListPage<GoodsReceiptRow>
        title={t('purchasing.goodsReceipt')}
        description="Registrasi kedatangan dan pemeriksaan fisik belum menambah stok. Stok bertambah pada saat validasi."
        resourcePath="/goods-receipts"
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'receipt_number',
            header: 'Nomor',
            render: (row) => <Code>{row.receipt_number}</Code>,
          },
          {
            key: 'purchase_order_number',
            header: 'PO',
            render: (row) => (row.purchase_order_number ? <Code>{row.purchase_order_number}</Code> : '-'),
          },
          { key: 'supplier_name', header: t('purchasing.supplier') },
          { key: 'warehouse_code', header: t('inventory.warehouse') },
          { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'validation_status',
            header: 'Validasi',
            render: (row) => <StatusBadge status={row.validation_status} />,
          },
          { key: 'receipt_date', header: 'Tanggal', render: (row) => formatDate(row.receipt_date) },
        ]}
        actions={[
          {
            key: 'validate',
            label: t('purchasing.validate'),
            path: '/validate',
            allowedStatus: ['WAITING_VALIDATION', 'INSPECTED'],
            tone: 'primary',
          },
          {
            key: 'backorder',
            label: t('purchasing.createBackorder'),
            path: '/create-backorder',
            allowedStatus: ['STOCK_POSTED'],
          },
          {
            key: 'reverse',
            label: 'Batalkan Validasi',
            path: '/reverse-validation',
            allowedStatus: ['STOCK_POSTED'],
            requireReason: true,
            tone: 'danger',
          },
        ]}
      />
    </>
  );
}
