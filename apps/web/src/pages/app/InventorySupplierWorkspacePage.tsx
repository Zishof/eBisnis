import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Building2,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  History,
  PackageCheck,
  Pencil,
  Search,
  ShieldCheck,
  Truck,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { PageHeader, StatusBadge } from '../../components/ui';

type SupplierTab = 'LIST' | 'DETAIL' | 'PURCHASES' | 'LEDGER' | 'ANALYTICS';

interface SupplierSummary {
  total: number;
  active: number;
  inactive: number;
  withPayables: number;
  outstanding: string;
  purchasesMonth: string;
  paymentsMonth: string;
}

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  tax_number?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  legacy_payment_days?: number | null;
  address_text?: string | null;
  region_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  bank_name?: string | null;
  lead_time_days?: number | null;
  rating?: string | null;
  is_blacklisted: boolean;
  is_active: boolean;
  payable_balance: string;
  payable_document_count: number;
  purchase_count: number;
  purchase_ytd: string;
  payment_ytd: string;
  last_purchase?: string | null;
}

interface PurchaseRow {
  id: string;
  supplier_id: string;
  purchase_order_number: string;
  order_date: string;
  expected_date?: string | null;
  grand_total: string;
  discount_total: string;
  tax_total: string;
  status: string;
  warehouse_name: string;
}

interface PayableRow {
  id: string;
  supplier_id: string;
  legacy_invoice_number: string;
  transaction_date?: string | null;
  due_date?: string | null;
  original_amount: string;
  outstanding_amount: string;
  aging_bucket: string;
  age_days?: number | null;
}

interface PaymentRow {
  id: string;
  supplier_id: string;
  payment_number: string;
  payment_date: string;
  method: string;
  total_amount: string;
  status: string;
}

interface ProductRow {
  supplier_id: string;
  product_code: string;
  product_name: string;
  uom: string;
  total_qty: string;
  total_value: string;
}

interface SupplierWorkspace {
  generatedAt: string;
  summary: SupplierSummary;
  suppliers: SupplierRow[];
  purchases: PurchaseRow[];
  payables: PayableRow[];
  payments: PaymentRow[];
  topProducts: ProductRow[];
}

const TABS: Array<{ id: SupplierTab; label: string; icon: typeof Users }> = [
  { id: 'LIST', label: 'Daftar Supplier', icon: Users },
  { id: 'DETAIL', label: 'Detail', icon: Building2 },
  { id: 'PURCHASES', label: 'Riwayat Pembelian', icon: History },
  { id: 'LEDGER', label: 'Ledger & Hutang', icon: WalletCards },
  { id: 'ANALYTICS', label: 'Analisis Kinerja', icon: BarChart3 },
];

const money = (value: string | number | undefined) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value ?? 0));
const date = (value?: string | null) => value
  ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '-';

export function InventorySupplierWorkspacePage() {
  const [tab, setTab] = useState<SupplierTab>('LIST');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'PAYABLE'>('ALL');
  const query = useQuery({
    queryKey: ['inventory-supplier-workspace'],
    queryFn: () => api.get<SupplierWorkspace>('/inventory/supplier-workspace'),
  });
  const data = query.data;
  const suppliers = data?.suppliers ?? [];
  const selected = suppliers.find((row) => row.id === selectedId) ?? suppliers[0] ?? null;
  const visible = useMemo(() => suppliers.filter((row) => {
    const needle = search.trim().toLowerCase();
    const matches = !needle || [row.code, row.name, row.contact_person, row.phone, row.region_name]
      .some((value) => String(value ?? '').toLowerCase().includes(needle));
    const matchesStatus = status === 'ALL'
      || (status === 'ACTIVE' && row.is_active)
      || (status === 'INACTIVE' && !row.is_active)
      || (status === 'PAYABLE' && Number(row.payable_balance) > 0);
    return matches && matchesStatus;
  }), [suppliers, search, status]);

  const choose = (row: SupplierRow, next: SupplierTab = 'DETAIL') => {
    setSelectedId(row.id);
    setTab(next);
  };

  return (
    <>
      <PageHeader
        title="Master Supplier"
        description="Profil, pembelian, hutang, pembayaran, dan kinerja supplier dalam satu ruang kerja."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Master Data' }, { label: 'Supplier' }]}
        actions={(
          <Link className="btn-primary" to="/app/master/suppliers/manage">
            <Pencil className="h-4 w-4" /> Kelola data
          </Link>
        )}
      />

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700" aria-label="Area supplier">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              className={`flex min-w-max items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${tab === item.id ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
              <Icon className="h-4 w-4" />{item.label}
            </button>
          );
        })}
      </nav>

      {query.isLoading && <div className="py-20 text-center text-slate-500">Memuat workspace supplier...</div>}
      {query.isError && <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">Data supplier belum dapat dimuat.</div>}
      {data && tab === 'LIST' && (
        <SupplierList data={data} rows={visible} search={search} setSearch={setSearch} status={status} setStatus={setStatus} choose={choose} />
      )}
      {data && tab === 'DETAIL' && <SupplierDetail row={selected} onHistory={() => setTab('PURCHASES')} />}
      {data && tab === 'PURCHASES' && <PurchaseHistory row={selected} purchases={data.purchases} products={data.topProducts} />}
      {data && tab === 'LEDGER' && <SupplierLedger row={selected} payables={data.payables} payments={data.payments} />}
      {data && tab === 'ANALYTICS' && <SupplierAnalytics data={data} choose={choose} />}
    </>
  );
}

function SupplierList({ data, rows, search, setSearch, status, setStatus, choose }: {
  data: SupplierWorkspace;
  rows: SupplierRow[];
  search: string;
  setSearch: (value: string) => void;
  status: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'PAYABLE';
  setStatus: (value: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'PAYABLE') => void;
  choose: (row: SupplierRow, next?: SupplierTab) => void;
}) {
  const metrics = [
    ['Total Supplier', data.summary.total, 'Terdaftar', Users],
    ['Supplier Aktif', data.summary.active, 'Siap transaksi', ShieldCheck],
    ['Supplier Nonaktif', data.summary.inactive, 'Perlu evaluasi', CalendarClock],
    ['Dengan Hutang', data.summary.withPayables, money(data.summary.outstanding), WalletCards],
    ['Pembelian Bulan Ini', money(data.summary.purchasesMonth), 'Transaksi berjalan', PackageCheck],
  ] as const;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value, note, Icon]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase text-slate-500">{label}</span><Icon className="h-5 w-5 text-blue-600" /></div>
            <strong className="block text-xl text-slate-950 dark:text-white">{value}</strong>
            <span className="text-xs text-slate-500">{note}</span>
          </div>
        ))}
      </section>
      <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(260px,1fr)_auto] dark:border-slate-700">
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input w-full pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, kode, kontak, telepon, atau kota" /></label>
          <div className="flex gap-2 overflow-x-auto">
            {([['ALL', 'Semua'], ['ACTIVE', 'Aktif'], ['INACTIVE', 'Nonaktif'], ['PAYABLE', 'Ada hutang']] as const).map(([id, label]) => (
              <button key={id} type="button" className={status === id ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatus(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{['Kode', 'Nama Supplier', 'Kontak', 'Kota', 'Termin', 'Status', 'Hutang', 'Pembelian YTD', 'Terakhir', ''].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((row) => (
              <tr key={row.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800">
                <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-300">{row.code}</td><td className="px-4 py-3 font-semibold">{row.name}</td>
                <td className="px-4 py-3"><div>{row.contact_person || '-'}</div><div className="text-xs text-slate-500">{row.phone || row.email || '-'}</div></td>
                <td className="px-4 py-3">{row.region_name || '-'}</td><td className="px-4 py-3">{row.legacy_payment_days ?? 0} hari</td>
                <td className="px-4 py-3"><StatusBadge status={row.is_active ? 'Aktif' : 'Nonaktif'} tone={row.is_active ? 'success' : 'neutral'} /></td>
                <td className="px-4 py-3 font-semibold text-red-600">{money(row.payable_balance)}</td><td className="px-4 py-3">{money(row.purchase_ytd)}</td><td className="px-4 py-3">{date(row.last_purchase)}</td>
                <td className="px-4 py-3"><button type="button" onClick={() => choose(row)} className="rounded p-2 text-blue-600 hover:bg-blue-100" aria-label={`Buka ${row.name}`}><ChevronRight className="h-4 w-4" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 lg:hidden dark:divide-slate-800">{rows.map((row) => (
          <button key={row.id} type="button" onClick={() => choose(row)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
            <span><strong className="block">{row.name}</strong><span className="text-xs text-slate-500">{row.code} · {row.region_name || 'Wilayah belum diisi'} · {row.legacy_payment_days ?? 0} hari</span><span className="mt-2 block text-sm font-semibold text-red-600">Hutang {money(row.payable_balance)}</span></span>
            <ChevronRight className="mt-1 h-5 w-5 text-slate-400" />
          </button>
        ))}</div>
      </section>
    </div>
  );
}

function SupplierDetail({ row, onHistory }: { row: SupplierRow | null; onHistory: () => void }) {
  if (!row) return <EmptySupplier />;
  const fields = [
    ['Kode supplier', row.code], ['Nama supplier', row.name], ['NPWP', row.tax_number], ['Kontak utama', row.contact_person],
    ['Telepon', row.phone], ['Email', row.email], ['Wilayah', row.region_name], ['Alamat', row.address_text],
    ['Termin pembayaran', `${row.legacy_payment_days ?? 0} hari`], ['Lead time', `${row.lead_time_days ?? 0} hari`],
    ['Bank', row.bank_name], ['Nomor rekening', row.bank_account_number], ['Atas nama', row.bank_account_name],
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr_300px]">
      <aside className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-lg bg-blue-50 text-blue-700"><Building2 className="h-7 w-7" /></div><div><StatusBadge status={row.is_active ? 'Aktif' : 'Nonaktif'} tone={row.is_active ? 'success' : 'neutral'} /><h2 className="mt-2 font-bold">{row.name}</h2><p className="font-mono text-xs text-slate-500">{row.code}</p></div></div>
        <dl className="space-y-3 text-sm">{[['Saldo hutang', money(row.payable_balance)], ['Total pembelian YTD', money(row.purchase_ytd)], ['Pembayaran YTD', money(row.payment_ytd)], ['Transaksi pembelian', row.purchase_count], ['Dokumen terbuka', row.payable_document_count]].map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{key}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
      </aside>
      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Informasi supplier</h2><p className="text-sm text-slate-500">Data legal, kontak, termin, dan pembayaran.</p></div><Link className="btn-secondary" to="/app/master/suppliers/manage"><Pencil className="h-4 w-4" />Ubah</Link></div>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{fields.map(([key, value]) => <div key={key}><dt className="text-xs font-semibold uppercase text-slate-500">{key}</dt><dd className="mt-1 break-words text-sm font-medium">{value || '-'}</dd></div>)}</dl>
      </section>
      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h3 className="mb-4 font-bold">Kesehatan relasi</h3><Metric label="Status" value={row.is_blacklisted ? 'Perlu pemeriksaan' : 'Baik'} /><Metric label="Rating" value={row.rating ? `${Number(row.rating).toFixed(1)} / 5` : 'Belum dinilai'} /><Metric label="Pembelian terakhir" value={date(row.last_purchase)} /></div>
        <button type="button" className="btn-primary w-full justify-center" onClick={onHistory}><History className="h-4 w-4" />Lihat riwayat pembelian</button>
      </aside>
    </div>
  );
}

function PurchaseHistory({ row, purchases, products }: { row: SupplierRow | null; purchases: PurchaseRow[]; products: ProductRow[] }) {
  if (!row) return <EmptySupplier />;
  const rows = purchases.filter((item) => item.supplier_id === row.id);
  const favorites = products.filter((item) => item.supplier_id === row.id).slice(0, 8);
  return <div className="space-y-4"><SupplierStrip row={row} />
    <DataTable headers={['Tanggal', 'No. Pembelian', 'Gudang', 'Diskon', 'Pajak', 'Grand Total', 'Status']} rows={rows.map((item) => [date(item.order_date), item.purchase_order_number, item.warehouse_name, money(item.discount_total), money(item.tax_total), money(item.grand_total), item.status])} />
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h3 className="mb-4 font-bold">Produk yang sering dibeli</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{favorites.map((item) => <div key={item.product_code} className="border-l-2 border-blue-500 pl-3"><strong className="block text-sm">{item.product_name}</strong><span className="text-xs text-slate-500">{Number(item.total_qty).toLocaleString('id-ID')} {item.uom} · {money(item.total_value)}</span></div>)}</div></section>
  </div>;
}

function SupplierLedger({ row, payables, payments }: { row: SupplierRow | null; payables: PayableRow[]; payments: PaymentRow[] }) {
  if (!row) return <EmptySupplier />;
  const debts = payables.filter((item) => item.supplier_id === row.id);
  const paid = payments.filter((item) => item.supplier_id === row.id);
  const bucket = (name: string) => debts.filter((item) => item.aging_bucket === name).reduce((sum, item) => sum + Number(item.outstanding_amount), 0);
  return <div className="space-y-4"><SupplierStrip row={row} />
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{['BELUM JATUH TEMPO', '1-30 HARI', '31-60 HARI', '> 60 HARI'].map((name) => <div key={name} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><span className="text-xs font-semibold text-slate-500">{name}</span><strong className="mt-2 block text-lg">{money(bucket(name))}</strong></div>)}</section>
    <DataTable headers={['Tanggal', 'Referensi', 'Jatuh Tempo', 'Nilai Faktur', 'Sisa Hutang', 'Umur', 'Status']} rows={debts.map((item) => [date(item.transaction_date), item.legacy_invoice_number, date(item.due_date), money(item.original_amount), money(item.outstanding_amount), item.age_days == null ? '-' : `${item.age_days} hari`, item.aging_bucket])} />
    <section><h3 className="mb-3 font-bold">Pembayaran supplier</h3><DataTable headers={['Tanggal', 'No. Pembayaran', 'Metode', 'Jumlah', 'Status']} rows={paid.map((item) => [date(item.payment_date), item.payment_number, item.method, money(item.total_amount), item.status])} /></section>
  </div>;
}

function SupplierAnalytics({ data, choose }: { data: SupplierWorkspace; choose: (row: SupplierRow, next?: SupplierTab) => void }) {
  const ranked = [...data.suppliers].sort((a, b) => Number(b.purchase_ytd) - Number(a.purchase_ytd));
  const max = Math.max(...ranked.map((row) => Number(row.purchase_ytd)), 1);
  return <div className="space-y-4">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi icon={Truck} label="Supplier aktif" value={String(data.summary.active)} note={`${data.summary.total} total supplier`} /><Kpi icon={PackageCheck} label="Pembelian bulan ini" value={money(data.summary.purchasesMonth)} note="berdasarkan purchase order" /><Kpi icon={CircleDollarSign} label="Pembayaran bulan ini" value={money(data.summary.paymentsMonth)} note="pembayaran berstatus posted" /><Kpi icon={WalletCards} label="Outstanding hutang" value={money(data.summary.outstanding)} note={`${data.summary.withPayables} supplier`} /></section>
    <section className="grid gap-4 xl:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h3 className="mb-5 font-bold">Top supplier berdasarkan pembelian YTD</h3><div className="space-y-4">{ranked.slice(0, 10).map((row, index) => <button key={row.id} type="button" onClick={() => choose(row, 'DETAIL')} className="grid w-full grid-cols-[28px_minmax(100px,1fr)_minmax(100px,2fr)_auto] items-center gap-3 text-left text-sm"><span className="text-slate-400">{index + 1}</span><span className="truncate font-semibold">{row.name}</span><span className="h-2 overflow-hidden rounded bg-slate-100 dark:bg-slate-800"><span className="block h-full bg-blue-600" style={{ width: `${Math.max(2, Number(row.purchase_ytd) / max * 100)}%` }} /></span><span>{money(row.purchase_ytd)}</span></button>)}</div></div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h3 className="mb-5 font-bold">Kontrol hutang supplier</h3><div className="space-y-3">{[...data.suppliers].sort((a, b) => Number(b.payable_balance) - Number(a.payable_balance)).slice(0, 10).map((row) => <button key={row.id} type="button" onClick={() => choose(row, 'LEDGER')} className="flex w-full items-center justify-between border-b border-slate-100 pb-3 text-left text-sm dark:border-slate-800"><span><strong className="block">{row.name}</strong><span className="text-xs text-slate-500">{row.payable_document_count} dokumen terbuka</span></span><span className="font-semibold text-red-600">{money(row.payable_balance)}</span></button>)}</div></div></section>
  </div>;
}

function SupplierStrip({ row }: { row: SupplierRow }) { return <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[1fr_repeat(3,minmax(150px,auto))] dark:border-slate-700 dark:bg-slate-900"><div><span className="text-xs font-mono text-blue-600">{row.code}</span><h2 className="text-lg font-bold">{row.name}</h2><p className="text-sm text-slate-500">{row.region_name || '-'} · {row.legacy_payment_days ?? 0} hari</p></div><Metric label="Saldo hutang" value={money(row.payable_balance)} /><Metric label="Pembelian YTD" value={money(row.purchase_ytd)} /><Metric label="Pembelian terakhir" value={date(row.last_purchase)} /></section>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>; }
function Kpi({ icon: Icon, label, value, note }: { icon: typeof Truck; label: string; value: string; note: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase text-slate-500">{label}</span><Icon className="h-5 w-5 text-blue-600" /></div><strong className="block text-xl">{value}</strong><span className="text-xs text-slate-500">{note}</span></div>; }
function EmptySupplier() { return <div className="rounded-lg border border-slate-200 bg-white py-20 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">Pilih supplier dari tab daftar.</div>; }
function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) { return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{headers.map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, index) => <td key={`${rowIndex}-${headers[index]}`} className="px-4 py-3">{value}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-slate-500">Belum ada data untuk supplier ini.</p>}</div></section>; }
