import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Beaker, PackageCheck, RefreshCw, Search, ShoppingCart, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatDateTime, formatMoney } from '../../lib/api';
import { DataGrid, PageHeader, StatusBadge, type GridColumn } from '../../components/ui';

type Area = 'sales' | 'purchasing' | 'compound';

interface PharmacySale extends Record<string, unknown> {
  pos_sale_id: string;
  transaction_mode: string;
  prescription_number: string | null;
  reference_number: string | null;
  formula_name: string | null;
  workflow_status: string;
  sale_status: string;
  receipt_number: string | null;
  business_date: string;
  grand_total: string;
  currency_code: string;
  line_count: number;
  updated_at: string;
}

interface PurchaseOrder extends Record<string, unknown> {
  id: string;
  purchase_order_number: string;
  supplier_name: string;
  warehouse_code: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  grand_total: string;
}

interface GoodsReceipt extends Record<string, unknown> {
  id: string;
  receipt_number: string;
  purchase_order_number: string | null;
  supplier_name: string | null;
  warehouse_code: string | null;
  status: string;
  validation_status: string;
  receipt_date: string;
}

const copy = {
  sales: {
    title: 'Penjualan Obat',
    description: 'Transaksi obat bebas, resep, racikan, pembayaran, stok keluar, jurnal, dan struk dalam satu jejak.',
    icon: ShoppingCart,
  },
  purchasing: {
    title: 'Pembelian PBF',
    description: 'PO pemasok, penerimaan, inspeksi, batch, kedaluwarsa, validasi stok, dan backorder.',
    icon: Truck,
  },
  compound: {
    title: 'Racikan dan Produksi Farmasi',
    description: 'Formula, etiket, work order, dan snapshot komponen yang dapat ditelusuri sampai transaksi.',
    icon: Beaker,
  },
} satisfies Record<Area, { title: string; description: string; icon: typeof Beaker }>;

export function PharmacyTradePage({ area }: { area: Area }) {
  const [search, setSearch] = useState('');
  const info = copy[area];
  const Icon = info.icon;

  const sales = useQuery({
    queryKey: ['pharmacy-trade', area],
    queryFn: () => api.get<PharmacySale[]>('/health/pharmacy/pos-sales?limit=200'),
    enabled: area !== 'purchasing',
  });
  const orders = useQuery({
    queryKey: ['pharmacy-trade', 'purchase-orders'],
    queryFn: () => api.get<PurchaseOrder[]>('/purchase-orders?pageSize=200'),
    enabled: area === 'purchasing',
  });
  const receipts = useQuery({
    queryKey: ['pharmacy-trade', 'goods-receipts'],
    queryFn: () => api.get<GoodsReceipt[]>('/goods-receipts?pageSize=200'),
    enabled: area === 'purchasing',
  });

  const q = search.trim().toLowerCase();
  const saleRows = useMemo(() => (sales.data ?? [])
    .filter((row) => area !== 'compound' || ['COMPOUND', 'PRODUCTION'].includes(row.transaction_mode))
    .filter((row) => !q || [row.receipt_number, row.prescription_number, row.reference_number, row.formula_name, row.transaction_mode]
      .some((value) => value?.toLowerCase().includes(q))), [sales.data, q, area]);
  const orderRows = useMemo(() => (orders.data ?? []).filter((row) =>
    !q || [row.purchase_order_number, row.supplier_name, row.warehouse_code, row.status]
      .some((value) => value?.toLowerCase().includes(q))), [orders.data, q]);

  const saleColumns: Array<GridColumn<PharmacySale>> = [
    { key: 'reference', header: 'Referensi', render: (row) => (
      <div><p className="font-mono text-xs font-semibold">{row.receipt_number ?? row.pos_sale_id.slice(0, 8)}</p>
      <p className="text-xs text-slate-500">{row.prescription_number ?? row.reference_number ?? 'Tanpa resep'}</p></div>
    ) },
    { key: 'mode', header: 'Alur', render: (row) => <StatusBadge status={row.transaction_mode} tone="info" /> },
    { key: 'formula', header: 'Formula / item', render: (row) => row.formula_name ?? `${row.line_count} item` },
    { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.business_date) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.workflow_status} /> },
    { key: 'total', header: 'Total', className: 'text-end', render: (row) => formatMoney(row.grand_total, row.currency_code) },
  ];
  const orderColumns: Array<GridColumn<PurchaseOrder>> = [
    { key: 'number', header: 'Purchase Order', render: (row) => <span className="font-mono text-xs font-semibold">{row.purchase_order_number}</span> },
    { key: 'supplier', header: 'PBF / pemasok', render: (row) => row.supplier_name },
    { key: 'warehouse', header: 'Gudang', render: (row) => row.warehouse_code || '-' },
    { key: 'date', header: 'Pesan / estimasi', render: (row) => <div>{formatDate(row.order_date)}<p className="text-xs text-slate-500">{formatDate(row.expected_date)}</p></div> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'total', header: 'Total', className: 'text-end', render: (row) => formatMoney(row.grand_total) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={info.title}
        description={info.description}
        breadcrumbs={[{ label: 'Apotik', href: '/app/apotik/pos' }, { label: info.title }]}
        actions={<div className="flex flex-wrap gap-2">
          <Link className="btn-outline" to="/app/apotik/penjualan"><ShoppingCart className="h-4 w-4" />Penjualan</Link>
          <Link className="btn-outline" to="/app/apotik/pembelian"><Truck className="h-4 w-4" />Pembelian</Link>
          <Link className="btn-outline" to="/app/apotik/racikan"><Beaker className="h-4 w-4" />Racikan</Link>
          <Link className="btn-primary" to="/app/apotik/pos"><Icon className="h-4 w-4" />Buka POS Apotik</Link>
        </div>}
      />

      <div className="flex flex-col gap-3 border-y border-slate-200 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <label className="relative block w-full sm:max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Cari transaksi</span>
          <input className="field-input ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor, resep, formula, PBF, atau status" />
        </label>
        <button className="btn-outline" type="button" onClick={() => void (area === 'purchasing' ? Promise.all([orders.refetch(), receipts.refetch()]) : sales.refetch())}>
          <RefreshCw className="h-4 w-4" />Muat ulang
        </button>
      </div>

      {area === 'purchasing' ? (
        <>
          <section>
            <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-semibold">Purchase Order PBF</h2><p className="text-sm text-slate-500">Draft, persetujuan, pengiriman ke pemasok, dan nilai pesanan.</p></div><Link className="btn-outline" to="/app/purchase-orders">Kelola PO</Link></div>
            <DataGrid columns={orderColumns} rows={orderRows} rowKey={(row) => row.id} loading={orders.isLoading} emptyTitle="Belum ada purchase order." />
          </section>
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
            <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-semibold">Penerimaan dan kontrol batch</h2><p className="text-sm text-slate-500">Stok baru bertambah setelah penerimaan diperiksa dan divalidasi.</p></div><Link className="btn-outline" to="/app/goods-receipts"><PackageCheck className="h-4 w-4" />Kelola penerimaan</Link></div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(receipts.data ?? []).slice(0, 9).map((row) => <article key={row.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-2"><p className="font-mono text-xs font-semibold">{row.receipt_number}</p><StatusBadge status={row.validation_status} /></div><p className="mt-2 text-sm font-medium">{row.supplier_name ?? 'Pemasok belum terisi'}</p><p className="mt-1 text-xs text-slate-500">{row.purchase_order_number ?? 'Tanpa PO'} · {row.warehouse_code ?? '-'} · {formatDate(row.receipt_date)}</p></article>)}
            </div>
          </section>
        </>
      ) : (
        <section>
          <div className="mb-3"><h2 className="font-semibold">Jejak transaksi farmasi</h2><p className="text-sm text-slate-500">Konteks disimpan di peladen; perubahan mode pada layar tidak dapat menghapus jejak resep atau formula.</p></div>
          <DataGrid columns={saleColumns} rows={saleRows} rowKey={(row) => row.pos_sale_id} loading={sales.isLoading} emptyTitle="Belum ada transaksi pada alur ini." />
          {saleRows[0] && <p className="mt-2 text-xs text-slate-500">Terakhir diperbarui {formatDateTime(saleRows[0].updated_at)}.</p>}
        </section>
      )}
    </div>
  );
}

export default PharmacyTradePage;
