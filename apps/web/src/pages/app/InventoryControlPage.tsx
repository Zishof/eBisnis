import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  BarChart3,
  Boxes,
  ClipboardList,
  Download,
  FileText,
  Landmark,
  PackageSearch,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { api, apiRequestPaged, formatDate, formatMoney, formatNumber } from '../../lib/api';
import { downloadExcel, downloadPdf, type ExportColumn } from '../../lib/export-table';
import { Code, DataGrid, PageHeader, StatusBadge, type GridColumn } from '../../components/ui';

type TabKey =
  | 'suppliers'
  | 'customers'
  | 'sales'
  | 'stock'
  | 'prices'
  | 'purchases'
  | 'salesOrders'
  | 'cash'
  | 'profit'
  | 'periodClose';

type MasterRow = Record<string, unknown> & {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
};

type DashboardData = {
  summary: {
    products?: number;
    customers?: number;
    suppliers?: number;
    orders_month?: number;
    revenue_month?: string;
    on_hand_qty?: string;
    expiring_lots?: number;
    expired_lots?: number;
  };
  topSales: Array<{ sales_name: string; orders: number; revenue: string }>;
  topProducts: Array<{ product_code: string; product_name: string; qty: string; revenue: string }>;
  recentOrders: Array<Record<string, unknown>>;
};

type ReconciliationData = {
  totals: {
    raw_records: number;
    files: number;
    purchase_orders: number;
    receivable_amount: string;
    payable_amount: string;
    price_history_rows: number;
    stock_opname_rows: number;
  };
  salesMap: Array<{ legacy_code: string; legacy_name: string; mapped_username: string | null; mapped_name: string | null }>;
};

type LegacyReceivableRow = Record<string, unknown> & {
  id: string;
  legacy_invoice_number: string;
  transaction_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  amount: string;
  customer_name: string;
  sales_name: string;
  bank_name: string | null;
};

type LegacyPayableRow = Record<string, unknown> & {
  id: string;
  legacy_invoice_number: string;
  transaction_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  amount: string;
  supplier_name: string;
  bank_name: string | null;
};

type LegacyPriceRow = Record<string, unknown> & {
  id: string;
  party_type: 'CUSTOMER' | 'SUPPLIER';
  party_name: string;
  product_code: string;
  product_name: string;
  effective_date: string | null;
  price: string;
};

type LegacyStockOpnameRow = Record<string, unknown> & {
  id: string;
  opname_date: string | null;
  product_code: string;
  product_name: string;
  system_qty: string;
  physical_qty: string;
  variance_qty: string;
  unit_cost: string;
};

const tabs: Array<{ key: TabKey; label: string; icon: ReactNode; note: string }> = [
  { key: 'suppliers', label: 'Supplier', icon: <Truck />, note: 'Pemasok, alamat, tempo, bank, saldo hutang' },
  { key: 'customers', label: 'Customer', icon: <UsersRound />, note: 'Pelanggan, wilayah, tempo, saldo piutang' },
  { key: 'sales', label: 'Sales', icon: <ShieldCheck />, note: 'Mapping sales lama ke akun lapangan' },
  { key: 'stock', label: 'Stok Barang', icon: <Boxes />, note: 'Stok, harga pokok, batch, expiry, opname' },
  { key: 'prices', label: 'Master Harga', icon: <PackageSearch />, note: 'Harga jual/beli historis per customer/supplier' },
  { key: 'purchases', label: 'Pembelian & Hutang', icon: <ClipboardList />, note: 'PO legacy, hutang supplier, pembayaran' },
  { key: 'salesOrders', label: 'Penjualan & Piutang', icon: <WalletCards />, note: 'Order sales, piutang customer, nota dibawa' },
  { key: 'cash', label: 'Kas & Jurnal', icon: <Landmark />, note: 'Jurnal harian, akun, buku besar' },
  { key: 'profit', label: 'Laba / Rugi', icon: <BarChart3 />, note: 'Margin, HPP, laba kotor per sales/barang' },
  { key: 'periodClose', label: 'Proses Akhir', icon: <RefreshCw />, note: 'Backup, re-index, tutup periode aman' },
];

export function InventoryControlPage() {
  const [active, setActive] = useState<TabKey>('stock');
  const [search, setSearch] = useState('');

  const dashboard = useQuery({
    queryKey: ['inventory-control-dashboard'],
    queryFn: () => api.get<DashboardData>('/inventory/sales-dashboard'),
  });
  const reconciliation = useQuery({
    queryKey: ['inventory-control-reconciliation'],
    queryFn: () => api.get<ReconciliationData>('/inventory/legacy-import-reconciliation'),
  });
  const products = useQuery({
    queryKey: ['inventory-control-products'],
    queryFn: () => apiRequestPaged<MasterRow[]>('/products?pageSize=1000&sortBy=name&sortDir=asc'),
  });
  const suppliers = useQuery({
    queryKey: ['inventory-control-suppliers'],
    queryFn: () => apiRequestPaged<MasterRow[]>('/suppliers?pageSize=1000&sortBy=name&sortDir=asc'),
  });
  const customers = useQuery({
    queryKey: ['inventory-control-customers'],
    queryFn: () => apiRequestPaged<MasterRow[]>('/customers?pageSize=1000&sortBy=name&sortDir=asc'),
  });
  const receivables = useQuery({
    queryKey: ['inventory-control-receivables'],
    queryFn: () => api.get<LegacyReceivableRow[]>('/inventory/legacy/receivables?pageSize=1000'),
  });
  const payables = useQuery({
    queryKey: ['inventory-control-payables'],
    queryFn: () => api.get<LegacyPayableRow[]>('/inventory/legacy/payables?pageSize=1000'),
  });
  const prices = useQuery({
    queryKey: ['inventory-control-prices'],
    queryFn: () => api.get<LegacyPriceRow[]>('/inventory/legacy/price-history?pageSize=1000'),
  });
  const opname = useQuery({
    queryKey: ['inventory-control-opname'],
    queryFn: () => api.get<LegacyStockOpnameRow[]>('/inventory/legacy/stock-opname?pageSize=1000'),
  });

  const view = useMemo(() => buildView(active, {
    dashboard: dashboard.data,
    reconciliation: reconciliation.data,
    products: products.data?.data ?? [],
    suppliers: suppliers.data?.data ?? [],
    customers: customers.data?.data ?? [],
    receivables: receivables.data ?? [],
    payables: payables.data ?? [],
    prices: prices.data ?? [],
    opname: opname.data ?? [],
  }), [active, customers.data, dashboard.data, opname.data, payables.data, prices.data, products.data, receivables.data, reconciliation.data, suppliers.data]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return view.rows;
    return view.rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(needle)),
    );
  }, [search, view.rows]);

  const loading = dashboard.isLoading || reconciliation.isLoading || (
    active === 'suppliers' ? suppliers.isLoading :
    active === 'customers' ? customers.isLoading :
    active === 'stock' ? products.isLoading || opname.isLoading :
    active === 'prices' ? prices.isLoading :
    active === 'purchases' ? payables.isLoading :
    active === 'salesOrders' ? receivables.isLoading :
    false
  );
  const error = [dashboard.error, reconciliation.error, products.error, suppliers.error, customers.error, receivables.error, payables.error, prices.error, opname.error]
    .filter(Boolean)
    .map(errorMessage)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Control CMN"
        description="Seluruh fungsi aplikasi Inventory lama disusun ulang menjadi workspace modern: cepat dicari, bisa diekspor, responsif, dan siap audit."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Inventory Control' }]}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Cetak
            </button>
            <button type="button" className="btn-secondary" onClick={() => downloadExcel(view.filename, view.exportColumns, filteredRows)}>
              <Download className="h-4 w-4" aria-hidden /> Excel
            </button>
            <button type="button" className="btn-primary" onClick={() => downloadPdf(view.filename, view.title, view.exportColumns, filteredRows)}>
              <FileText className="h-4 w-4" aria-hidden /> PDF
            </button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Boxes />} label="SKU obat" value={formatNumber(dashboard.data?.summary.products)} note="master stok legacy" />
        <Metric icon={<UsersRound />} label="Customer" value={formatNumber(dashboard.data?.summary.customers)} note="wilayah & piutang" />
        <Metric icon={<Truck />} label="Supplier" value={formatNumber(dashboard.data?.summary.suppliers)} note="hutang & pembelian" />
        <Metric icon={<WalletCards />} label="Piutang" value={formatMoney(reconciliation.data?.totals.receivable_amount)} note="ledger legacy" />
        <Metric icon={<Banknote />} label="Hutang" value={formatMoney(reconciliation.data?.totals.payable_amount)} note="supplier aging" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`rounded-xl border p-3 text-left transition ${
                active === tab.key
                  ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-sm dark:bg-brand-950/40 dark:text-brand-100'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="[&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>
                {tab.label}
              </span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{tab.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{view.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{view.description}</p>
          </div>
          <label className="relative min-w-0 lg:w-96">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950"
              placeholder={`Cari di ${view.title.toLowerCase()}...`}
            />
          </label>
        </div>

        {view.insights.length > 0 && (
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {view.insights.map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-slate-500">{item.note}</p>
              </div>
            ))}
          </div>
        )}

        <DataGrid
          columns={view.columns}
          rows={filteredRows}
          loading={loading}
          error={error}
          emptyTitle="Belum ada data pada modul ini"
          rowKey={(row) => rowKey(row)}
        />
      </section>
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sebagian data Inventory belum dapat dimuat.';
}

function rowKey(row: Record<string, unknown>): string {
  return String(row.id ?? row.code ?? row.legacy_invoice_number ?? row.product_code ?? row.step ?? JSON.stringify(row));
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{note}</p>
        </div>
      </div>
    </div>
  );
}

function buildView(active: TabKey, data: {
  dashboard?: DashboardData;
  reconciliation?: ReconciliationData;
  products: MasterRow[];
  suppliers: MasterRow[];
  customers: MasterRow[];
  receivables: LegacyReceivableRow[];
  payables: LegacyPayableRow[];
  prices: LegacyPriceRow[];
  opname: LegacyStockOpnameRow[];
}) {
  if (active === 'suppliers') {
    return simpleMasterView('Daftar Supplier', 'Supplier lama lengkap dengan kode, nama, status, dan metadata pembayaran.', data.suppliers, ['code', 'name', 'is_active']);
  }
  if (active === 'customers') {
    return simpleMasterView('Daftar Customer', 'Pelanggan dikelola dengan pencarian cepat wilayah, nama, kode, dan status aktif.', data.customers, ['code', 'name', 'is_active']);
  }
  if (active === 'sales') {
    const rows = (data.reconciliation?.salesMap ?? []).map((row) => ({ id: row.legacy_code, ...row }));
    return {
      title: 'Daftar Sales',
      description: 'Mapping sales legacy ke akun modern untuk order lapangan dan laporan per sales.',
      filename: 'cmn-sales-map',
      rows,
      insights: [
        { label: 'Sales legacy', value: formatNumber(rows.length), note: 'dipetakan ke user sistem' },
        { label: 'Top sales bulan ini', value: data.dashboard?.topSales[0]?.sales_name ?? '-', note: 'berdasarkan omzet sales-dashboard' },
        { label: 'Prinsip kontrol', value: 'Role-based', note: 'sales hanya melihat data sendiri' },
      ],
      columns: [
        col('legacy_code', 'Kode'),
        col('legacy_name', 'Nama Sales'),
        col('mapped_username', 'Username'),
        col('mapped_name', 'Nama Akun'),
      ],
      exportColumns: exportCols(['legacy_code', 'legacy_name', 'mapped_username', 'mapped_name']),
    };
  }
  if (active === 'stock') {
    const productRows = data.products.map((row) => ({
      ...row,
      stock_status: stockStatus(row, data.opname),
    }));
    return {
      title: 'Daftar Stok Barang',
      description: 'Kontrol obat menggunakan batch/expiry dan prinsip FEFO: stok yang lebih dekat kedaluwarsa diprioritaskan.',
      filename: 'cmn-stok-barang',
      rows: productRows,
      insights: [
        { label: 'Total SKU', value: formatNumber(data.dashboard?.summary.products ?? productRows.length), note: 'master obat' },
        { label: 'Batch mendekati ED', value: formatNumber(data.dashboard?.summary.expiring_lots), note: 'perlu follow-up FEFO' },
        { label: 'Baris opname', value: formatNumber(data.reconciliation?.totals.stock_opname_rows), note: 'hasil import dataopn.dbf' },
      ],
      columns: [
        col('code', '#Barang', (row) => <Code>{String(row.code)}</Code>),
        col('name', 'Nama Barang'),
        col('stock_status', 'Status', (row) => <StatusBadge status={String(row.stock_status)} tone={row.stock_status === 'Perlu opname' ? 'warning' : 'success'} />),
      ],
      exportColumns: exportCols(['code', 'name', 'stock_status']),
    };
  }
  if (active === 'prices') {
    return {
      title: 'Master Harga Jual dan Beli',
      description: 'Riwayat harga per customer/supplier agar sales tidak salah memberi harga dan margin tetap terpantau.',
      filename: 'cmn-master-harga',
      rows: data.prices,
      insights: [
        { label: 'Riwayat harga', value: formatNumber(data.reconciliation?.totals.price_history_rows ?? data.prices.length), note: 'jual dan beli legacy' },
        { label: 'Harga customer', value: formatNumber(data.prices.filter((r) => r.party_type === 'CUSTOMER').length), note: 'masterjl.dbf' },
        { label: 'Harga supplier', value: formatNumber(data.prices.filter((r) => r.party_type === 'SUPPLIER').length), note: 'masterbl.dbf' },
      ],
      columns: [
        col('party_type', 'Tipe', (row) => <StatusBadge status={String(row.party_type)} tone={row.party_type === 'CUSTOMER' ? 'info' : 'neutral'} />),
        col('party_name', 'Customer/Supplier'),
        col('product_code', '#Brg', (row) => <Code>{String(row.product_code)}</Code>),
        col('product_name', 'Nama Barang'),
        col('price', 'Harga', (row) => formatMoney(String(row.price))),
        col('effective_date', 'Tanggal', (row) => formatDate(String(row.effective_date ?? ''))),
      ],
      exportColumns: exportCols(['party_type', 'party_name', 'product_code', 'product_name', 'price', 'effective_date']),
    };
  }
  if (active === 'purchases') {
    return financialView('Pembelian, Hutang, dan Pembayaran Supplier', 'Daftar hutang supplier, jatuh tempo, pembayaran, dan aging untuk mengontrol cash-out.', 'cmn-hutang-supplier', data.payables, 'supplier_name');
  }
  if (active === 'salesOrders') {
    return financialView('Penjualan, Piutang, dan Nota Sales', 'Daftar piutang customer, nota yang dibawa sales, tanggal bayar, dan aging untuk penagihan lapangan.', 'cmn-piutang-customer', data.receivables, 'customer_name');
  }
  if (active === 'cash') {
    return {
      title: 'Kas, Jurnal Harian, dan Buku Besar',
      description: 'Akun legacy dipertahankan untuk rekonsiliasi kas, piutang, hutang, pendapatan, biaya, dan buku besar.',
      filename: 'cmn-kas-jurnal',
      rows: [
        { id: '102', code: '102', name: 'PIUTANG DAGANG', category: 'AKTIVA', balance: data.reconciliation?.totals.receivable_amount ?? '0' },
        { id: '202', code: '202', name: 'HUTANG DAGANG', category: 'KEWAJIBAN', balance: data.reconciliation?.totals.payable_amount ?? '0' },
        { id: '400', code: '400', name: 'PENDAPATAN PENJUALAN', category: 'PENDAPATAN', balance: data.dashboard?.summary.revenue_month ?? '0' },
      ],
      insights: [
        { label: 'Kontrol jurnal', value: 'Debit/Kredit', note: 'akun 1xx-6xx' },
        { label: 'Piutang', value: formatMoney(data.reconciliation?.totals.receivable_amount), note: 'saldo awal audit' },
        { label: 'Hutang', value: formatMoney(data.reconciliation?.totals.payable_amount), note: 'saldo awal audit' },
      ],
      columns: [col('code', 'Kode'), col('name', 'Nama Perkiraan'), col('category', 'Kategori'), col('balance', 'Saldo', (row) => formatMoney(String(row.balance)))],
      exportColumns: exportCols(['code', 'name', 'category', 'balance']),
    };
  }
  if (active === 'profit') {
    const rows = (data.dashboard?.topProducts ?? []).map((row) => ({
      id: row.product_code,
      ...row,
      estimated_margin: Number(row.revenue || 0) * 0.18,
    }));
    return {
      title: 'Laba / Rugi Kotor',
      description: 'Monitoring omzet, HPP estimasi, margin, performa produk, dan kontribusi sales.',
      filename: 'cmn-laba-rugi',
      rows,
      insights: [
        { label: 'Omzet bulan ini', value: formatMoney(data.dashboard?.summary.revenue_month), note: 'sales-dashboard' },
        { label: 'Order bulan ini', value: formatNumber(data.dashboard?.summary.orders_month), note: 'transaksi sales' },
        { label: 'Best seller', value: data.dashboard?.topProducts[0]?.product_name ?? '-', note: 'kuantitas tertinggi' },
      ],
      columns: [
        col('product_code', '#Brg', (row) => <Code>{String(row.product_code)}</Code>),
        col('product_name', 'Nama Barang'),
        col('qty', 'Qty', (row) => formatNumber(String(row.qty))),
        col('revenue', 'Omzet', (row) => formatMoney(String(row.revenue))),
        col('estimated_margin', 'Estimasi Margin', (row) => formatMoney(Number(row.estimated_margin))),
      ],
      exportColumns: exportCols(['product_code', 'product_name', 'qty', 'revenue', 'estimated_margin']),
    };
  }
  return {
    title: 'Proses Akhir, Backup, dan Re-index',
    description: 'Tutup periode tidak menghapus transaksi: sistem modern membuat snapshot, audit log, validasi raw vault, dan backup terlebih dahulu.',
    filename: 'cmn-proses-akhir',
    rows: [
      { id: 'backup', step: 'Backup database', owner: 'Admin', status: 'Wajib sebelum tutup periode', evidence: 'pg_dump deploy' },
      { id: 'reindex', step: 'Re-index legacy', owner: 'Admin', status: 'Validasi raw vault', evidence: `${formatNumber(data.reconciliation?.totals.raw_records)} baris` },
      { id: 'close', step: 'Tutup periode', owner: 'Pemilik + Admin', status: 'Butuh approval', evidence: 'audit log' },
      { id: 'aging', step: 'Aging piutang/hutang', owner: 'Pemilik', status: 'Dibaca harian', evidence: '0-30, 31-60, 61-90, >90' },
    ],
    insights: [
      { label: 'File DBF', value: formatNumber(data.reconciliation?.totals.files), note: 'tercatat di raw vault' },
      { label: 'Raw records', value: formatNumber(data.reconciliation?.totals.raw_records), note: 'siap audit' },
      { label: 'Prinsip baru', value: 'No destructive close', note: 'data historis tetap utuh' },
    ],
    columns: [col('step', 'Proses'), col('owner', 'Penanggung Jawab'), col('status', 'Status'), col('evidence', 'Bukti')],
    exportColumns: exportCols(['step', 'owner', 'status', 'evidence']),
  };
}

function simpleMasterView(title: string, description: string, rows: MasterRow[], keys: string[]) {
  return {
    title,
    description,
    filename: title.toLowerCase().replace(/\s+/g, '-'),
    rows,
    insights: [
      { label: 'Total data', value: formatNumber(rows.length), note: 'maksimum 1000 baris tampil' },
      { label: 'Aktif', value: formatNumber(rows.filter((row) => row.is_active !== false).length), note: 'siap transaksi' },
      { label: 'Kontrol', value: 'Audit-safe', note: 'hapus permanen dibatasi' },
    ],
    columns: [
      col('code', 'Kode', (row) => <Code>{String(row.code)}</Code>),
      col('name', 'Nama'),
      col('is_active', 'Status', (row) => <StatusBadge status={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'neutral' : 'success'} />),
    ],
    exportColumns: exportCols(keys),
  };
}

function financialView<T extends LegacyReceivableRow | LegacyPayableRow>(title: string, description: string, filename: string, rows: T[], partyKey: keyof T) {
  const open = rows.filter((row) => !row.paid_at);
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return {
    title,
    description,
    filename,
    rows,
    insights: [
      { label: 'Total baris', value: formatNumber(rows.length), note: 'ledger legacy' },
      { label: 'Belum lunas', value: formatNumber(open.length), note: 'prioritas follow-up' },
      { label: 'Total nilai', value: formatMoney(total), note: 'nominal ledger' },
    ],
    columns: [
      col('legacy_invoice_number', 'Faktur', (row) => <Code>{String(row.legacy_invoice_number)}</Code>),
      col(String(partyKey), partyKey === 'customer_name' ? 'Customer' : 'Supplier'),
      col('transaction_date', 'Tanggal', (row) => formatDate(String(row.transaction_date ?? ''))),
      col('due_date', 'Jatuh Tempo', (row) => formatDate(String(row.due_date ?? ''))),
      col('paid_at', 'Bayar', (row) => row.paid_at ? formatDate(String(row.paid_at)) : <StatusBadge status="Belum lunas" tone="warning" />),
      col('amount', 'Jumlah', (row) => formatMoney(String(row.amount))),
    ],
    exportColumns: exportCols(['legacy_invoice_number', String(partyKey), 'transaction_date', 'due_date', 'paid_at', 'amount']),
  };
}

function stockStatus(row: MasterRow, opname: LegacyStockOpnameRow[]) {
  return opname.some((item) => item.product_code === row.code && Number(item.variance_qty) !== 0)
    ? 'Perlu opname'
    : 'Terkendali';
}

function col<T extends Record<string, unknown>>(key: string, header: string, render?: (row: T) => ReactNode): GridColumn<T> {
  return { key, header, render };
}

function exportCols(keys: string[]): Array<ExportColumn<Record<string, unknown>>> {
  return keys.map((key) => ({ key, label: key.replace(/_/g, ' ').toUpperCase() }));
}
