import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FileClock,
  FileText,
  History,
  Package,
  Printer,
  Plus,
  QrCode,
  Save,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UserRound,
  Warehouse,
} from 'lucide-react';
import { api, formatMoney } from '../../lib/api';
import { ErrorState, LoadingState } from '../../components/ui';

type Mode = 'sales' | 'purchase';
type Party = { id: string; code: string; name: string; metadata?: Record<string, unknown> };
type Product = {
  id: string;
  code: string;
  name: string;
  uom_id: string;
  price: string;
  available_qty: string;
  image_url?: string;
};
type Catalog = { customers: Party[]; products: Product[] };
type MasterData = { suppliers: Party[] };
type StockWorkspace = { warehouses: Array<{ id: string; code: string; name: string }> };
type Line = Product & { qty: number; unitPrice: number; discount: number; batch: string; expiry: string };

const steps: Record<Mode, string[]> = {
  sales: ['Pilih Customer', 'Cari Barang', 'Tambahkan ke Keranjang', 'Review & Kirim'],
  purchase: ['Pilih Supplier', 'Cari / Tambah Barang', 'Review Pembelian', 'Simpan / Ajukan'],
};

export function InventoryTransactionWorkspacePage({ mode }: { mode: Mode }) {
  const [partyId, setPartyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('Semua');
  const [lines, setLines] = useState<Line[]>([]);
  const [taxPercent, setTaxPercent] = useState(11);
  const [paymentTerm, setPaymentTerm] = useState('Kredit 30 hari');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const raw = window.sessionStorage.getItem(`inventory-${mode}-draft`);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        partyId?: string;
        warehouseId?: string;
        lines?: Line[];
        taxPercent?: number;
        paymentTerm?: string;
        note?: string;
      };
      setPartyId(draft.partyId ?? '');
      setWarehouseId(draft.warehouseId ?? '');
      setLines(Array.isArray(draft.lines) ? draft.lines : []);
      setTaxPercent(draft.taxPercent ?? 11);
      setPaymentTerm(draft.paymentTerm ?? 'Kredit 30 hari');
      setNote(draft.note ?? '');
      setMessage('Draft pada sesi ini berhasil dipulihkan.');
    } catch {
      window.sessionStorage.removeItem(`inventory-${mode}-draft`);
    }
  }, [mode]);

  const catalog = useQuery({ queryKey: ['inventory-transaction-catalog'], queryFn: () => api.get<Catalog>('/inventory/mobile-catalog') });
  const masters = useQuery({
    queryKey: ['inventory-transaction-master'],
    queryFn: () => api.get<MasterData>('/inventory/master-data'),
    enabled: mode === 'purchase',
  });
  const stock = useQuery({
    queryKey: ['inventory-transaction-warehouses'],
    queryFn: () => api.get<StockWorkspace>('/stock-opnames'),
    enabled: mode === 'purchase',
  });

  const parties = mode === 'sales' ? catalog.data?.customers ?? [] : masters.data?.suppliers ?? [];
  const products = useMemo(() => catalog.data?.products ?? [], [catalog.data?.products]);
  const selectedPartyId = partyId || parties[0]?.id || '';
  const selectedWarehouseId = warehouseId || stock.data?.warehouses[0]?.id || '';
  const party = parties.find((row) => row.id === selectedPartyId);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((row) => {
      const matchesSearch = !q || row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q);
      const stock = Number(row.available_qty);
      const matchesFilter = productFilter !== 'Stok Tersedia' || stock > 0;
      const matchesLowStock = productFilter !== 'Stok Menipis' || (stock > 0 && stock <= 10);
      return matchesSearch && matchesFilter && matchesLowStock;
    }).slice(0, 24);
  }, [products, search, productFilter]);
  const gross = lines.reduce((sum, row) => sum + row.qty * row.unitPrice, 0);
  const subtotal = lines.reduce((sum, row) => sum + row.qty * row.unitPrice * (1 - row.discount / 100), 0);
  const discount = gross - subtotal;
  const tax = subtotal * taxPercent / 100;
  const total = subtotal + tax;

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedPartyId || lines.length === 0) throw new Error('Pihak dan item transaksi harus dipilih.');
      if (mode === 'sales') {
        return api.post<{ order_number: string }>('/inventory/mobile-orders', {
          deviceId: 'web-inventory',
          deviceEventId: `WEB_${Date.now()}_${lines.length}`,
          customerId: selectedPartyId,
          taxPercent,
          paymentTerm,
          note,
          lines: lines.map((row) => ({
            productId: row.id, uomId: row.uom_id, qty: row.qty,
            unitPrice: row.unitPrice, discountPercent: row.discount,
          })),
        });
      }
      if (!selectedWarehouseId) throw new Error('Gudang tujuan harus dipilih.');
      return api.post<{ purchase_order_number: string }>('/purchase-orders', {
        supplierId: selectedPartyId,
        warehouseId: selectedWarehouseId,
        expectedDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
        note: note || 'Dibuat dari workspace Inventory Web',
        taxPercent,
        lines: lines.map((row) => ({
          productId: row.id, uomId: row.uom_id, orderedQty: row.qty,
          unitPrice: row.unitPrice, discountPercent: row.discount,
          batchNumber: row.batch || undefined, expiryDate: row.expiry || undefined,
        })),
      });
    },
    onSuccess: (data) => {
      const number = 'order_number' in data ? data.order_number : data.purchase_order_number;
      setMessage(`${mode === 'sales' ? 'Order' : 'Purchase order'} ${number} berhasil disimpan.`);
      setLines([]);
      setNote('');
      window.sessionStorage.removeItem(`inventory-${mode}-draft`);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Transaksi belum tersimpan.'),
  });

  function addProduct(product: Product) {
    setLines((current) => {
      const found = current.find((row) => row.id === product.id);
      if (found) return current.map((row) => row.id === product.id ? { ...row, qty: row.qty + 1 } : row);
      return [...current, { ...product, qty: 1, unitPrice: Number(product.price), discount: 0, batch: '', expiry: '' }];
    });
    setMessage('');
  }

  function patchLine(id: string, patch: Partial<Line>) {
    setLines((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function saveDraft() {
    window.sessionStorage.setItem(`inventory-${mode}-draft`, JSON.stringify({ partyId: selectedPartyId, warehouseId: selectedWarehouseId, lines, taxPercent, paymentTerm, note }));
    setMessage('Draft tersimpan pada perangkat ini.');
  }

  function inspectDraft() {
    const raw = window.sessionStorage.getItem(`inventory-${mode}-draft`);
    setMessage(raw ? 'Draft lokal tersedia dan sudah dimuat ke workspace ini.' : 'Belum ada draft lokal untuk transaksi ini.');
  }

  async function synchronizeWorkspace() {
    setMessage('Menyinkronkan katalog dan data transaksi...');
    try {
      await Promise.all([
        catalog.refetch(),
        mode === 'purchase' ? masters.refetch() : Promise.resolve(),
        mode === 'purchase' ? stock.refetch() : Promise.resolve(),
      ]);
      setMessage('Katalog, pihak transaksi, dan stok berhasil disinkronkan.');
    } catch {
      setMessage('Sinkronisasi belum berhasil. Data lokal tetap dapat digunakan.');
    }
  }

  function exportLines() {
    if (lines.length === 0) {
      setMessage('Tambahkan item sebelum mengekspor transaksi.');
      return;
    }
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ['Kode', 'Produk', 'Qty', 'Harga', 'Diskon (%)', 'Batch', 'Expiry', 'Subtotal'],
      ...lines.map((row) => [
        row.code,
        row.name,
        row.qty,
        row.unitPrice,
        row.discount,
        row.batch,
        row.expiry,
        row.qty * row.unitPrice * (1 - row.discount / 100),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `inventory-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Data transaksi berhasil diekspor ke CSV.');
  }

  function showAuditTrail() {
    setMessage(lines.length > 0
      ? 'Perubahan draft tercatat di perangkat. Audit permanen tersedia setelah transaksi diposting.'
      : 'Audit trail transaksi tersedia setelah dokumen disimpan atau diposting.');
  }

  if (catalog.isLoading || (mode === 'purchase' && (masters.isLoading || stock.isLoading))) return <LoadingState />;
  if (catalog.error || masters.error || stock.error) return <ErrorState message="Data transaksi belum dapat dimuat." />;

  const title = mode === 'sales' ? 'Sales Order' : 'Transaksi Pembelian';
  const description = mode === 'sales' ? 'Buat order lapangan dengan cepat dan mudah' : 'Input pembelian dari supplier dengan cepat dan akurat';

  return (
    <div className="space-y-4 pb-10">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div><h1 className="text-2xl font-black text-slate-950 dark:text-white">{title}</h1><p className="text-sm text-slate-500">{description}</p></div>
        <div className="flex flex-wrap gap-2">
          {mode === 'sales' ? <>
            <button className="btn-secondary" onClick={inspectDraft}><FileClock className="h-4 w-4" /> Riwayat Draft</button>
            <button className="btn-secondary" onClick={() => void synchronizeWorkspace()}><History className="h-4 w-4" /> Sinkronkan</button>
          </> : <>
            <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak</button>
            <button className="btn-secondary" onClick={exportLines}><Download className="h-4 w-4" /> Export</button>
            <button className="btn-secondary" onClick={showAuditTrail}><FileText className="h-4 w-4" /> Audit Trail</button>
          </>}
          <button className="btn-secondary" onClick={saveDraft}><Save className="h-4 w-4" /> Simpan Draft</button>
          <button className="btn-primary" disabled={!selectedPartyId || lines.length === 0 || save.isPending} onClick={() => save.mutate()}>
            <Send className="h-4 w-4" /> {save.isPending ? 'Menyimpan...' : mode === 'sales' ? 'Kirim Order' : 'Simpan Pembelian'}
          </button>
        </div>
      </header>

      <div className="grid gap-2 overflow-x-auto sm:grid-cols-2 xl:grid-cols-4">
        {steps[mode].map((step, index) => <div key={step} className={`flex min-w-48 items-center gap-3 rounded-lg border px-3 py-3 ${index === 0 ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900'}`}>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-white ${index === 0 ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>{index + 1}</span>
          <span className="text-sm font-bold">{step}</span>{index < 3 && <ChevronRight className="ml-auto h-4 w-4" />}
        </div>)}
      </div>

      <section className="panel p-4">
        <h2 className="mb-3 font-black">{mode === 'sales' ? 'Pilih Customer' : 'Pilih Supplier'}</h2>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)]">
          <div className="space-y-2">
            <select className="input w-full" value={selectedPartyId} onChange={(event) => setPartyId(event.target.value)}>
              {parties.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}
            </select>
            {party && <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><div className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-blue-700"><UserRound className="h-5 w-5" /></div><div><strong className="block">{party.name}</strong><span className="text-xs text-slate-500">{party.code} • Aktif</span></div></div>}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric label={mode === 'sales' ? 'Limit Kredit' : 'Saldo Hutang'} value={formatMoney(Number(party?.metadata?.credit_limit ?? party?.metadata?.balance ?? 0))} />
            <Metric label={mode === 'sales' ? 'Saldo Piutang' : 'Termin'} value={mode === 'sales' ? formatMoney(Number(party?.metadata?.receivable ?? party?.metadata?.balance ?? 0)) : `${Number(party?.metadata?.payment_term_days ?? 30)} hari`} warning />
            <Metric label={mode === 'sales' ? 'Sisa Kredit' : 'Peringkat'} value={mode === 'sales' ? formatMoney(Math.max(0, Number(party?.metadata?.credit_limit ?? 0) - Number(party?.metadata?.receivable ?? party?.metadata?.balance ?? 0))) : 'Terverifikasi'} success />
            <Metric label="Status" value="Aktif" success />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-4">
          {mode === 'purchase' && <PurchaseMeta warehouses={stock.data?.warehouses ?? []} warehouseId={selectedWarehouseId} onWarehouse={setWarehouseId} taxPercent={taxPercent} onTax={setTaxPercent} note={note} onNote={setNote} />}
          <div className={`grid gap-4 ${mode === 'sales' ? 'lg:grid-cols-2' : ''}`}>
            <ProductPicker products={filtered} selected={lines} search={search} onSearch={setSearch} onAdd={addProduct} horizontal={mode === 'purchase'} filter={productFilter} onFilter={setProductFilter} onNotice={setMessage} />
            <LineEditor lines={lines} purchase={mode === 'purchase'} onPatch={patchLine} onDelete={(id) => setLines((current) => current.filter((row) => row.id !== id))} />
          </div>
        </main>
        <Summary mode={mode} party={party} lines={lines} discount={discount} subtotal={subtotal} tax={tax} total={total} taxPercent={taxPercent} onTax={setTaxPercent} paymentTerm={paymentTerm} onPaymentTerm={setPaymentTerm} note={note} onNote={setNote} warehouses={stock.data?.warehouses ?? []} warehouseId={selectedWarehouseId} onWarehouse={setWarehouseId} message={message} pending={save.isPending} onSubmit={() => save.mutate()} onDraft={saveDraft} />
      </div>

      {mode === 'purchase' && <PurchaseSupport />}
    </div>
  );
}

function Metric({ label, value, warning, success }: { label: string; value: string; warning?: boolean; success?: boolean }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><span className="text-xs text-slate-500">{label}</span><strong className={`mt-1 block text-sm ${warning ? 'text-orange-600' : success ? 'text-emerald-600' : ''}`}>{value}</strong></div>;
}

function ProductPicker({ products, selected, search, onSearch, onAdd, horizontal, filter, onFilter, onNotice }: {
  products: Product[]; search: string; onSearch: (value: string) => void;
  selected: Line[]; onAdd: (product: Product) => void; horizontal: boolean;
  filter: string; onFilter: (value: string) => void; onNotice: (value: string) => void;
}) {
  return <section className="panel p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-black">Cari Barang</h2>{horizontal && <div className="flex gap-2"><button className="btn-secondary text-xs" onClick={() => onNotice('Riwayat supplier tersedia setelah supplier dipilih dan transaksi tersinkronisasi.')}><History className="h-4 w-4" /> Riwayat Supplier</button><button className="btn-secondary text-xs" onClick={() => onNotice('Katalog supplier mengikuti produk yang dipasok oleh supplier terpilih.')}><FileText className="h-4 w-4" /> Katalog Supplier</button></div>}</div>
    <div className="relative mb-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input w-full pl-9 pr-10" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Cari barang / SKU / barcode..." /><QrCode className="absolute right-3 top-2.5 h-4 w-4 text-blue-600" /></div>
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
      {['Semua', 'Favorit', 'Stok Tersedia', 'Stok Menipis', 'Promo', 'Sering Dibeli'].map((value) => <button key={value} onClick={() => onFilter(value)} className={`whitespace-nowrap rounded-md border px-3 py-2 text-xs font-bold ${filter === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900'}`}>{value}</button>)}
    </div>
    {selected.length > 0 && <div className="mb-4"><div className="mb-2 flex items-center justify-between"><strong className="text-sm">Terakhir Dipilih</strong><span className="text-xs text-blue-600">{selected.length} item</span></div><div className="flex gap-2 overflow-x-auto">{selected.slice(-3).reverse().map((product) => <button key={product.id} onClick={() => onAdd(product)} className="flex min-w-52 items-center gap-2 rounded-lg border border-slate-200 p-2 text-left dark:border-slate-700"><ProductImage product={product} /><span className="min-w-0"><strong className="block truncate text-xs">{product.name}</strong><span className="text-[11px] text-slate-500">Stok {Number(product.available_qty).toLocaleString('id-ID')}</span></span></button>)}</div></div>}
    <h3 className="mb-2 text-sm font-black">Rekomendasi Produk</h3>
    <div className={horizontal ? 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3' : 'max-h-[430px] divide-y divide-slate-100 overflow-auto dark:divide-slate-800'}>
      {products.map((product) => <article key={product.id} className={`flex items-center gap-3 ${horizontal ? 'rounded-lg border border-slate-200 p-3 dark:border-slate-700' : 'py-3'}`}>
        <ProductImage product={product} />
        <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{product.name}</strong><span className="block text-xs text-slate-500">{product.code} • Stok {Number(product.available_qty).toLocaleString('id-ID')}</span><strong className="text-xs text-emerald-700">{formatMoney(product.price)}</strong></div>
        <button className="icon-btn text-blue-600" disabled={Number(product.available_qty) <= 0} onClick={() => onAdd(product)} title="Tambah item"><Plus className="h-4 w-4" /></button>
      </article>)}
      {products.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Produk tidak ditemukan.</p>}
    </div>
  </section>;
}

function ProductImage({ product }: { product: Product }) {
  const src = product.image_url || '';
  return src ? <img className="h-11 w-11 rounded-md border border-slate-100 object-cover" src={src} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40"><Package className="h-5 w-5" /></span>;
}

function LineEditor({ lines, purchase, onPatch, onDelete }: {
  lines: Line[]; purchase: boolean; onPatch: (id: string, patch: Partial<Line>) => void; onDelete: (id: string) => void;
}) {
  return <section className="panel p-4">
    <div className="mb-3 flex items-center justify-between"><h2 className="font-black">{purchase ? 'Item Pembelian' : 'Item Order'} ({lines.length})</h2><ShoppingCart className="h-5 w-5 text-blue-600" /></div>
    {lines.length === 0 ? <div className="grid min-h-56 place-items-center text-center text-sm text-slate-500"><div><ShoppingCart className="mx-auto mb-2 h-9 w-9 text-slate-300" />Pilih produk untuk mulai transaksi.</div></div> : <div className="max-h-[520px] space-y-2 overflow-auto">
      {lines.map((row) => <article key={row.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="mb-2 flex items-center gap-2"><ProductImage product={row} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{row.name}</strong><span className="text-xs text-slate-500">{row.code}</span></div><button className="icon-btn text-red-600" onClick={() => onDelete(row.id)} title="Hapus"><Trash2 className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-3 gap-2">
          <QtyField value={row.qty} uom={row.uom_id ? 'Unit' : 'Pcs'} onChange={(value) => onPatch(row.id, { qty: Math.max(1, value) })} />
          <Field label={purchase ? 'Harga Beli' : 'Harga'} value={row.unitPrice} onChange={(value) => onPatch(row.id, { unitPrice: Math.max(0, value) })} />
          <Field label="Diskon %" value={row.discount} onChange={(value) => onPatch(row.id, { discount: Math.min(100, Math.max(0, value)) })} />
        </div>
        {purchase && <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Batch<input className="input mt-1 w-full" value={row.batch} onChange={(event) => onPatch(row.id, { batch: event.target.value })} /></label><label className="text-xs text-slate-500">Expiry<input type="date" className="input mt-1 w-full" value={row.expiry} onChange={(event) => onPatch(row.id, { expiry: event.target.value })} /></label></div>}
        <strong className="mt-2 block text-right text-sm">Subtotal {formatMoney(row.qty * row.unitPrice * (1 - row.discount / 100))}</strong>
      </article>)}
    </div>}
  </section>;
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-xs text-slate-500">{label}<input type="number" min="0" className="input mt-1 w-full" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function QtyField({ value, uom, onChange }: { value: number; uom: string; onChange: (value: number) => void }) {
  return <label className="text-xs text-slate-500">Qty ({uom})<span className="mt-1 flex overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><button type="button" className="w-8 text-blue-600" onClick={() => onChange(Math.max(1, value - 1))}>-</button><input type="number" min="1" className="min-w-0 flex-1 border-x border-slate-200 bg-transparent px-2 text-center dark:border-slate-700" value={value} onChange={(event) => onChange(Number(event.target.value))} /><button type="button" className="w-8 text-blue-600" onClick={() => onChange(value + 1)}>+</button></span></label>;
}

function PurchaseMeta({ warehouses, warehouseId, onWarehouse, taxPercent, onTax, note, onNote }: {
  warehouses: StockWorkspace['warehouses']; warehouseId: string; onWarehouse: (value: string) => void;
  taxPercent: number; onTax: (value: number) => void; note: string; onNote: (value: string) => void;
}) {
  const due = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  return <section className="panel p-4">
    <h2 className="mb-3 font-black">Informasi Transaksi</h2>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-slate-500">No. Pembelian<input className="input mt-1 w-full" value="Otomatis saat posting" readOnly /></label>
      <label className="text-xs text-slate-500">No. Faktur Supplier<input className="input mt-1 w-full" placeholder="Masukkan nomor faktur" /></label>
      <label className="text-xs text-slate-500">Gudang<select className="input mt-1 w-full" value={warehouseId} onChange={(event) => onWarehouse(event.target.value)}>{warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select></label>
      <label className="text-xs text-slate-500">Tanggal Jatuh Tempo<input type="date" className="input mt-1 w-full" defaultValue={due} /></label>
      <label className="text-xs text-slate-500">Mata Uang<input className="input mt-1 w-full" value="IDR - Rupiah" readOnly /></label>
      <label className="text-xs text-slate-500">Pajak<select className="input mt-1 w-full" value={taxPercent} onChange={(event) => onTax(Number(event.target.value))}><option value="0">Tanpa pajak</option><option value="11">PPN 11%</option></select></label>
      <label className="text-xs text-slate-500 sm:col-span-2">Referensi / Catatan<input className="input mt-1 w-full" value={note} onChange={(event) => onNote(event.target.value)} placeholder="No. PO, termin, FOB/ongkir, atau catatan" /></label>
    </div>
  </section>;
}

function PurchaseSupport() {
  const [files, setFiles] = useState<string[]>([]);
  return <section className="grid gap-4 xl:grid-cols-3">
    <article className="panel p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">Lampiran</h2><label className="btn-secondary cursor-pointer text-xs"><Plus className="h-4 w-4" /> Pilih File<input className="sr-only" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles(Array.from(event.target.files ?? []).map((file) => file.name))} /></label></div>{files.length > 0 ? <ul className="space-y-2 text-sm">{files.map((file) => <li key={file} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">{file}</li>)}</ul> : <p className="text-sm text-slate-500">PDF, JPG, atau PNG dapat dipilih sekarang dan diunggah setelah nomor pembelian terbentuk.</p>}</article>
    <article className="panel p-4"><h2 className="mb-3 font-black">Riwayat Pembelian Supplier</h2><div className="flex min-h-16 items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800"><Clock3 className="h-5 w-5" /> Riwayat tampil dari transaksi supplier yang telah diposting.</div></article>
    <article className="panel p-4"><h2 className="mb-3 font-black">Ringkasan Supplier YTD</h2><p className="text-sm text-slate-500">Nilai YTD mengikuti transaksi supplier yang telah diposting dan tersinkronisasi.</p></article>
  </section>;
}

function Summary({ mode, party, lines, discount, subtotal, tax, total, taxPercent, onTax, paymentTerm, onPaymentTerm, note, onNote, warehouses, warehouseId, onWarehouse, message, pending, onSubmit, onDraft }: {
  mode: Mode; party?: Party; lines: Line[]; discount: number; subtotal: number; tax: number; total: number;
  taxPercent: number; onTax: (value: number) => void; paymentTerm: string; onPaymentTerm: (value: string) => void;
  note: string; onNote: (value: string) => void; warehouses: StockWorkspace['warehouses']; warehouseId: string;
  onWarehouse: (value: string) => void; message: string; pending: boolean; onSubmit: () => void; onDraft: () => void;
}) {
  return <aside className="panel sticky top-3 p-4">
    <h2 className="mb-4 font-black">Ringkasan {mode === 'sales' ? 'Order' : 'Pembelian'}</h2>
    <SummaryRow label={mode === 'sales' ? 'Customer' : 'Supplier'} value={party?.name ?? '-'} />
    <hr className="my-3 border-slate-200 dark:border-slate-700" />
    <SummaryRow label="Total Item" value={`${lines.length} item`} />
    <SummaryRow label="Diskon Total" value={formatMoney(discount)} />
    <SummaryRow label="Subtotal" value={formatMoney(subtotal)} />
    <div className="my-2 flex items-center justify-between gap-3"><span className="text-sm text-slate-500">Pajak</span><select className="input w-32" value={taxPercent} onChange={(event) => onTax(Number(event.target.value))}><option value="0">Tanpa pajak</option><option value="11">PPN 11%</option></select></div>
    <SummaryRow label="Nilai Pajak" value={formatMoney(tax)} />
    <hr className="my-3 border-slate-200 dark:border-slate-700" />
    <SummaryRow label={mode === 'sales' ? 'Total Order' : 'Grand Total'} value={formatMoney(total)} strong />
    {mode === 'purchase' && <><SummaryRow label="Uang Muka / Pembayaran" value={formatMoney(0)} /><SummaryRow label="Sisa Hutang" value={formatMoney(total)} /></>}
    {mode === 'sales' ? <><label className="mt-4 block text-xs text-slate-500">Pembayaran & Termin<select className="input mt-1 w-full" value={paymentTerm} onChange={(event) => onPaymentTerm(event.target.value)}><option>Tunai</option><option>Kredit 7 hari</option><option>Kredit 14 hari</option><option>Kredit 30 hari</option></select></label><label className="mt-3 block text-xs text-slate-500">Metode Bayar<select className="input mt-1 w-full" defaultValue="Belum ditentukan"><option>Belum ditentukan</option><option>Tunai</option><option>Transfer Bank</option><option>Giro</option></select></label></> : <><label className="mt-4 block text-xs text-slate-500">Gudang Tujuan<select className="input mt-1 w-full" value={warehouseId} onChange={(event) => onWarehouse(event.target.value)}>{warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select></label><label className="mt-3 block text-xs text-slate-500">Metode Pembayaran<select className="input mt-1 w-full" defaultValue="Belum dibayar"><option>Belum dibayar</option><option>Tunai</option><option>Transfer Bank</option><option>Giro</option></select></label></>}
    <label className="mt-3 block text-xs text-slate-500">Catatan<textarea className="input mt-1 min-h-20 w-full" value={note} onChange={(event) => onNote(event.target.value)} placeholder="Catatan transaksi (opsional)" /></label>
    <button className="btn-primary mt-4 w-full justify-center" disabled={!party || lines.length === 0 || pending} onClick={onSubmit}><Send className="h-4 w-4" /> {pending ? 'Menyimpan...' : mode === 'sales' ? 'Kirim Order' : 'Simpan Pembelian'}</button>
    <button className="btn-secondary mt-2 w-full justify-center" disabled={lines.length === 0} onClick={onDraft}><Save className="h-4 w-4" /> Simpan Draft</button>
    {message && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40">{message}</p>}
    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500"><span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" /> Audit aktif</span><span className="flex items-center gap-1"><Warehouse className="h-3 w-3 text-blue-600" /> Stok real-time</span><span className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-orange-600" /> Jatuh tempo</span><span className="flex items-center gap-1"><Save className="h-3 w-3 text-violet-600" /> Draft lokal</span></div>
  </aside>;
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-3 py-1.5"><span className={`${strong ? 'font-black text-slate-900 dark:text-white' : 'text-sm text-slate-500'}`}>{label}</span><strong className={`text-right ${strong ? 'text-xl text-blue-600' : 'text-sm'}`}>{value}</strong></div>;
}
