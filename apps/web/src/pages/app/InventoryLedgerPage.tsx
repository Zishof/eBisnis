import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, formatDateTime, formatNumber } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { Code, DataGrid, PageHeader, StatusBadge, type GridColumn } from '../../components/ui';

interface StockMovement extends Record<string, unknown> {
  id: string;
  movement_number: string;
  movement_type: string;
  quantity: string;
  occurred_at: string;
  reference_type: string | null;
  reference_number: string | null;
  bucket_from: string | null;
  bucket_to: string | null;
  product_code: string;
  product_name: string;
  source_warehouse_code: string | null;
  destination_warehouse_code: string | null;
}

interface StockAlert extends Record<string, unknown> {
  id: string;
  alert_type: string;
  status: string;
  projected_qty: string;
  threshold_qty: string;
  recommended_qty: string;
  detected_at: string;
  request_order_id: string | null;
  warehouse_code: string;
  warehouse_name: string;
  product_code: string;
  product_name: string;
  request_number: string | null;
}

export function StockMovementsPage() {
  const toMessage = useErrorMessage();
  const movements = useQuery({
    queryKey: ['inventory', 'movements'],
    queryFn: () => api.get<StockMovement[]>('/inventory/movements?limit=200'),
  });

  const columns: Array<GridColumn<StockMovement>> = [
    { key: 'occurred_at', header: 'Waktu', render: (row) => formatDateTime(row.occurred_at) },
    { key: 'movement_number', header: 'Nomor', render: (row) => <Code>{row.movement_number}</Code> },
    { key: 'movement_type', header: 'Jenis', render: (row) => <StatusBadge status={row.movement_type} /> },
    {
      key: 'product',
      header: 'Produk',
      render: (row) => (
        <span>
          <Code>{row.product_code}</Code> {row.product_name}
        </span>
      ),
    },
    {
      key: 'warehouse',
      header: 'Gudang',
      render: (row) => [row.source_warehouse_code, row.destination_warehouse_code].filter(Boolean).join(' -> ') || '-',
    },
    { key: 'quantity', header: 'Qty', className: 'text-end', render: (row) => formatNumber(row.quantity) },
    {
      key: 'reference',
      header: 'Referensi',
      render: (row) => row.reference_number ? <Code>{row.reference_number}</Code> : row.reference_type ?? '-',
    },
  ];

  return (
    <>
      <PageHeader
        title="Kartu Stok"
        description="Ledger mutasi stok terbaru. Baris yang sudah dibukukan bersifat immutable."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Kartu Stok' }]}
      />
      <DataGrid
        columns={columns}
        rows={movements.data ?? []}
        loading={movements.isLoading}
        error={movements.isError ? toMessage(movements.error, (_, fallback) => fallback ?? 'Gagal memuat mutasi stok.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void movements.refetch()}
      />
    </>
  );
}

export function StockAlertsPage() {
  const toMessage = useErrorMessage();
  const [status, setStatus] = useState('OPEN');
  const alerts = useQuery({
    queryKey: ['inventory', 'alerts', status],
    queryFn: () => api.get<StockAlert[]>(`/stock-alerts?status=${status}`),
  });

  const columns: Array<GridColumn<StockAlert>> = [
    { key: 'detected_at', header: 'Terdeteksi', render: (row) => formatDateTime(row.detected_at) },
    { key: 'alert_type', header: 'Jenis', render: (row) => <StatusBadge status={row.alert_type} tone="warning" /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'product',
      header: 'Produk',
      render: (row) => (
        <span>
          <Code>{row.product_code}</Code> {row.product_name}
        </span>
      ),
    },
    { key: 'warehouse_code', header: 'Gudang', render: (row) => <Code>{row.warehouse_code}</Code> },
    { key: 'projected_qty', header: 'Proyeksi', className: 'text-end', render: (row) => formatNumber(row.projected_qty) },
    { key: 'threshold_qty', header: 'Ambang', className: 'text-end', render: (row) => formatNumber(row.threshold_qty) },
    { key: 'recommended_qty', header: 'Rekomendasi', className: 'text-end', render: (row) => formatNumber(row.recommended_qty) },
    { key: 'request_number', header: 'Request Order', render: (row) => row.request_number ? <Code>{row.request_number}</Code> : '-' },
  ];

  return (
    <>
      <PageHeader
        title="Notifikasi Stok Minimum"
        description="Peringatan stok yang masih terbuka atau sudah ditindaklanjuti."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Notifikasi Stok Minimum' }]}
        actions={
          <select className="field-input w-40" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="OPEN">OPEN</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
        }
      />
      <DataGrid
        columns={columns}
        rows={alerts.data ?? []}
        loading={alerts.isLoading}
        error={alerts.isError ? toMessage(alerts.error, (_, fallback) => fallback ?? 'Gagal memuat peringatan stok.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void alerts.refetch()}
      />
    </>
  );
}
