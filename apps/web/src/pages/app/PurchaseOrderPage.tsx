import { useTranslation } from 'react-i18next';
import { formatDate, formatMoney } from '../../lib/api';
import { Code, StatusBadge } from '../../components/ui';
import { DocumentListPage } from './DocumentListPage';

interface PurchaseOrderRow extends Record<string, unknown> {
  id: string;
  purchase_order_number: string;
  status: string;
  supplier_name: string;
  warehouse_code: string;
  grand_total: string;
  order_date: string;
}

export function PurchaseOrderPage() {
  const { t } = useTranslation();

  return (
    <DocumentListPage<PurchaseOrderRow>
      title={t('purchasing.purchaseOrder')}
      description="Purchase Order dikonsolidasikan dari Request Order. Pemasok wajib terdaftar untuk produk yang dipesan."
      resourcePath="/purchase-orders"
      rowKey={(row) => row.id}
      columns={[
        {
          key: 'purchase_order_number',
          header: 'Nomor',
          render: (row) => <Code>{row.purchase_order_number}</Code>,
        },
        { key: 'supplier_name', header: t('purchasing.supplier') },
        { key: 'warehouse_code', header: t('inventory.warehouse') },
        {
          key: 'grand_total',
          header: t('billing.grandTotal'),
          className: 'text-end',
          render: (row) => formatMoney(row.grand_total),
        },
        { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
        { key: 'order_date', header: 'Tanggal', render: (row) => formatDate(row.order_date) },
      ]}
      actions={[
        { key: 'submit', label: t('purchasing.submit'), path: '/submit', allowedStatus: ['DRAFT'], tone: 'primary' },
        {
          key: 'approve',
          label: t('purchasing.approve'),
          path: '/approve',
          allowedStatus: ['WAITING_APPROVAL'],
          tone: 'primary',
        },
        { key: 'send', label: t('purchasing.send'), path: '/send', allowedStatus: ['APPROVED'], tone: 'primary' },
      ]}
    />
  );
}
