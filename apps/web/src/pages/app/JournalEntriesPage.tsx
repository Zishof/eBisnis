import { DocumentListPage, DefaultDetail } from './DocumentListPage';
import { Code, StatusBadge, type GridColumn } from '../../components/ui';
import { formatDate, formatDateTime, formatMoney } from '../../lib/api';

interface JournalEntryRow extends Record<string, unknown> {
  id: string;
  journal_number: string;
  journal_date: string;
  source_type: string;
  description: string | null;
  currency_code: string;
  total_debit: string;
  total_credit: string;
  status: string;
  posted_at: string | null;
  created_at: string;
  fiscal_period_code: string | null;
}

const columns: Array<GridColumn<JournalEntryRow>> = [
  {
    key: 'journal_number',
    header: 'Nomor',
    render: (row) => <Code>{row.journal_number}</Code>,
  },
  { key: 'journal_date', header: 'Tanggal', render: (row) => formatDate(row.journal_date) },
  { key: 'source_type', header: 'Sumber' },
  { key: 'description', header: 'Keterangan', render: (row) => row.description ?? '-' },
  { key: 'total_debit', header: 'Debit', render: (row) => formatMoney(row.total_debit, row.currency_code) },
  { key: 'total_credit', header: 'Kredit', render: (row) => formatMoney(row.total_credit, row.currency_code) },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'posted_at', header: 'Posting', render: (row) => (row.posted_at ? formatDateTime(row.posted_at) : '-') },
];

export function JournalEntriesPage() {
  return (
    <DocumentListPage<JournalEntryRow>
      title="Jurnal"
      description="Daftar jurnal akuntansi dari transaksi tenant, termasuk detail baris debit dan kredit."
      resourcePath="/journal-entries"
      columns={columns}
      rowKey={(row) => row.id}
      detailRenderer={(detail) => <DefaultDetail detail={detail} />}
    />
  );
}
