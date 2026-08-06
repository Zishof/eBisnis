import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Package,
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
    return products.filter((row) => !q || row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q)).slice(0, 24);
  }, [products, search]);
  const subtotal = lines.reduce((sum, row) => sum + row.qty * row.unitPrice * (1 - row.discount / 100), 0);
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

  if (catalog.isLoading || (mode === 'purchase' && (masters.isLoading || stock.isLoading))) return <LoadingState />;
  if (catalog.error || masters.error || stock.error) return <ErrorState message="Data transaksi belum dapat dimuat." />;

  const title = mode === 'sales' ? 'Sales Order' : 'Transaksi Pembelian';
  const description = mode === 'sales' ? 'Buat order lapangan dengan cepat dan mudah' : 'Input pembelian dari supplier dengan cepat dan akurat';

  return (
    <div className="space-y-4 pb-10">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div><h1 className="text-2xl font-black text-slate-950 dark:text-white">{title}</h1><p className="text-sm text-slate-500">{description}</p></div>
        <div className="flex flex-wrap gap-2">
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
            <Metric label={mode === 'sales' ? 'Limit Kredit' : 'Saldo Hutang'} value={formatMoney(Number(party?.metadata?.balance ?? 0))} />
            <Metric label={mode === 'sales' ? 'Saldo Piutang' : 'Termin'} value={mode === 'sales' ? formatMoney(Number(party?.metadata?.receivable ?? 0)) : '30 hari'} warning />
            <Metric label={mode === 'sales' ? 'Sales' : 'Pembelian YTD'} value={mode === 'sales' ? 'Sales login' : formatMoney(0)} />
            <Metric label="Status" value="Aktif" success />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-4">
          <div className={`grid gap-4 ${mode === 'sales' ? 'lg:grid-cols-2' : ''}`}>
            <ProductPicker products={filtered} search={search} onSearch={setSearch} onAdd={addProduct} horizontal={mode === 'purchase'} />
            <LineEditor lines={lines} purchase={mode === 'purchase'} onPatch={patchLine} onDelete={(id) => setLines((current) => current.filter((row) => row.id !== id))} />
          </div>
        </main>
        <Summary mode={mode} party={party} lines={lines} subtotal={subtotal} tax={tax} total={total} taxPercent={taxPercent} onTax={setTaxPercent} paymentTerm={paymentTerm} onPaymentTerm={setPaymentTerm} note={note} onNote={setNote} warehouses={stock.data?.warehouses ?? []} warehouseId={selectedWarehouseId} onWarehouse={setWarehouseId} message={message} pending={save.isPending} onSubmit={() => save.mutate()} onDraft={saveDraft} />
      </div>
    </div>
  );
}

function Metric({ label, value, warning, success }: { label: string; value: string; warning?: boolean; success?: boolean }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><span className="text-xs text-slate-500">{label}</span><strong className={`mt-1 block text-sm ${warning ? 'text-orange-600' : success ? 'text-emerald-600' : ''}`}>{value}</strong></div>;
}

function ProductPicker({ products, search, onSearch, onAdd, horizontal }: {
  products: Product[]; search: string; onSearch: (value: string) => void;
  onAdd: (product: Product) => void; horizontal: boolean;
}) {
  return <section className="panel p-4">
    <h2 className="mb-3 font-black">Cari Barang</h2>
    <div className="relative mb-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input w-full pl-9 pr-10" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Cari barang / SKU / barcode..." /><QrCode className="absolute right-3 top-2.5 h-4 w-4 text-blue-600" /></div>
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
          <Field label="Qty" value={row.qty} onChange={(value) => onPatch(row.id, { qty: Math.max(1, value) })} />
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

function Summary({ mode, party, lines, subtotal, tax, total, taxPercent, onTax, paymentTerm, onPaymentTerm, note, onNote, warehouses, warehouseId, onWarehouse, message, pending, onSubmit, onDraft }: {
  mode: Mode; party?: Party; lines: Line[]; subtotal: number; tax: number; total: number;
  taxPercent: number; onTax: (value: number) => void; paymentTerm: string; onPaymentTerm: (value: string) => void;
  note: string; onNote: (value: string) => void; warehouses: StockWorkspace['warehouses']; warehouseId: string;
  onWarehouse: (value: string) => void; message: string; pending: boolean; onSubmit: () => void; onDraft: () => void;
}) {
  return <aside className="panel sticky top-3 p-4">
    <h2 className="mb-4 font-black">Ringkasan {mode === 'sales' ? 'Order' : 'Pembelian'}</h2>
    <SummaryRow label={mode === 'sales' ? 'Customer' : 'Supplier'} value={party?.name ?? '-'} />
    <hr className="my-3 border-slate-200 dark:border-slate-700" />
    <SummaryRow label="Total Item" value={`${lines.length} item`} />
    <SummaryRow label="Subtotal" value={formatMoney(subtotal)} />
    <div className="my-2 flex items-center justify-between gap-3"><span className="text-sm text-slate-500">Pajak</span><select className="input w-32" value={taxPercent} onChange={(event) => onTax(Number(event.target.value))}><option value="0">Tanpa pajak</option><option value="11">PPN 11%</option></select></div>
    <SummaryRow label="Nilai Pajak" value={formatMoney(tax)} />
    <hr className="my-3 border-slate-200 dark:border-slate-700" />
    <SummaryRow label={mode === 'sales' ? 'Total Order' : 'Grand Total'} value={formatMoney(total)} strong />
    {mode === 'sales' ? <label className="mt-4 block text-xs text-slate-500">Pembayaran & Termin<select className="input mt-1 w-full" value={paymentTerm} onChange={(event) => onPaymentTerm(event.target.value)}><option>Tunai</option><option>Kredit 7 hari</option><option>Kredit 14 hari</option><option>Kredit 30 hari</option></select></label> : <label className="mt-4 block text-xs text-slate-500">Gudang Tujuan<select className="input mt-1 w-full" value={warehouseId} onChange={(event) => onWarehouse(event.target.value)}>{warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select></label>}
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
