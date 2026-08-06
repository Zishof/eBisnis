import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArchiveRestore, Ban, Boxes, CheckCircle2, Cloud, History,
  PackageCheck, Pill, Printer, RefreshCw, RotateCcw, ShieldCheck, Store,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, formatDateTime, formatMoney } from '../../lib/api';
import { PageHeader, StatusBadge, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';

export type PharmacyOperationArea = 'history' | 'return' | 'void' | 'devices' | 'shift';

interface SaleSummary {
  pos_sale_id: string;
  transaction_mode: string;
  sale_status: string;
  receipt_number: string | null;
  grand_total: string;
  currency_code: string;
  line_count: number;
  updated_at: string;
}

interface SaleLine {
  id: string;
  product_name: string;
  lot_number?: string | null;
  expiry_date?: string | null;
  quantity: string | number;
  returned_quantity?: string | number;
  line_total?: string | number;
}

interface SaleDetail extends Record<string, unknown> {
  id: string;
  receipt_number?: string | null;
  status?: string;
  grand_total?: string | number;
  lines?: SaleLine[];
}

interface PosContext {
  businessDate: string;
  currency: string;
  outlets: Array<{ id: string; name: string; code?: string }>;
  registers: Array<{ terminalId: string; outletId: string; name?: string; code?: string; isPrimary?: boolean }>;
  openShift?: { shiftId: string; terminalId: string; shiftNumber?: string; openingCash?: string } | null;
}

const navigation = [
  ['/app/apotik/pos', 'POS', Pill],
  ['/app/apotik/riwayat', 'Riwayat', History],
  ['/app/apotik/retur', 'Retur', RotateCcw],
  ['/app/apotik/void', 'Void', Ban],
  ['/app/products', 'Master obat', Boxes],
  ['/app/goods-receipts', 'Penerimaan PBF', PackageCheck],
  ['/app/inventory/stock-opnames', 'Stok opname', ArchiveRestore],
  ['/app/apotik/perangkat', 'Perangkat', Activity],
  ['/app/apotik/shift', 'Shift', Store],
] as const;

const areaCopy = {
  history: ['Riwayat Transaksi POS Apotik', 'Telusuri transaksi, periksa batch, dan cetak ulang struk dengan jejak audit.'],
  return: ['Retur Penjualan Apotik', 'Retur hanya diproses dari transaksi selesai, per item, dan dengan disposisi stok yang jelas.'],
  void: ['Void / Pembatalan Transaksi', 'Pembatalan transaksi selesai memerlukan alasan dan persetujuan pengguna yang berbeda.'],
  devices: ['Sinkronisasi & Status Perangkat', 'Pantau koneksi layanan, outlet, terminal, shift, printer, dan status browser kasir.'],
  shift: ['Buka & Kendalikan Shift Kasir', 'Tetapkan terminal dan saldo awal sebelum transaksi apotik dimulai.'],
} satisfies Record<PharmacyOperationArea, [string, string]>;

export function PharmacyOperationsPage({ area }: { area: PharmacyOperationArea }) {
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [disposition, setDisposition] = useState<'RESTOCK' | 'DAMAGED' | 'DISPOSED'>('RESTOCK');
  const [terminalId, setTerminalId] = useState('');
  const [openingCash, setOpeningCash] = useState('0');

  const sales = useQuery({
    queryKey: ['pharmacy-operations', 'sales'],
    queryFn: () => api.get<SaleSummary[]>('/health/pharmacy/pos-sales?limit=200'),
    enabled: ['history', 'return', 'void'].includes(area),
  });
  const context = useQuery({
    queryKey: ['pharmacy-operations', 'context'],
    queryFn: () => api.get<PosContext>('/pos/context'),
    enabled: ['devices', 'shift'].includes(area),
    refetchInterval: area === 'devices' ? 15_000 : false,
  });
  const detail = useQuery({
    queryKey: ['pharmacy-operations', 'sale', selectedId],
    queryFn: () => api.get<SaleDetail>(`/pos/sales/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    if (!selectedId && sales.data?.[0]) setSelectedId(sales.data[0].pos_sale_id);
  }, [sales.data, selectedId]);
  useEffect(() => {
    if (!terminalId && context.data?.registers[0]) setTerminalId(context.data.registers[0].terminalId);
  }, [context.data, terminalId]);
  useEffect(() => setReturnQty({}), [selectedId]);

  const fail = (error: unknown) => toast.push(errorMessage(error, (_key, fallback) => fallback ?? 'Operasi gagal.'), 'error');
  const reprint = useMutation({
    mutationFn: () => api.post(`/pos/sales/${selectedId}/receipt/reprint`, { reason: reason.trim() || 'Cetak ulang dari riwayat POS Apotik' }),
    onSuccess: () => toast.push('Permintaan cetak ulang tercatat pada audit.', 'success'), onError: fail,
  });
  const voidSale = useMutation({
    mutationFn: (approve: boolean) => api.post(`/pos/sales/${selectedId}/${approve ? 'void-approve' : 'void-request'}`, { reason: reason.trim() }),
    onSuccess: (_data, approve) => { toast.push(approve ? 'Void disetujui dan pembalik stok dibentuk.' : 'Permintaan void dikirim untuk persetujuan.', 'success'); void qc.invalidateQueries({ queryKey: ['pharmacy-operations'] }); },
    onError: fail,
  });
  const submitReturn = useMutation({
    mutationFn: () => {
      const lines = Object.entries(returnQty).filter(([, qty]) => qty > 0).map(([saleLineId, quantity]) => ({ saleLineId, quantity, disposition }));
      return api.post(`/pos/sales/${selectedId}/returns`, { reason: reason.trim(), lines }, { headers: { 'Idempotency-Key': `web-return-${selectedId}-${Date.now()}` } });
    },
    onSuccess: () => { toast.push('Retur diajukan. Persetujuan harus dilakukan oleh petugas berwenang.', 'success'); setReturnQty({}); }, onError: fail,
  });
  const openShift = useMutation({
    mutationFn: () => api.post('/pos/shifts/open', { terminalId, openingCash: Number(openingCash || 0), note: 'Dibuka dari workspace POS Apotik' }),
    onSuccess: () => { toast.push('Shift kasir dibuka dan siap dipakai.', 'success'); void context.refetch(); }, onError: fail,
  });

  const rows = useMemo(() => sales.data ?? [], [sales.data]);
  const selectedSummary = rows.find((row) => row.pos_sale_id === selectedId);
  const [title, description] = areaCopy[area];

  return <div className="space-y-5">
    <PageHeader title={title} description={description} breadcrumbs={[{ label: 'Apotik', href: '/app/apotik/pos' }, { label: title }]} />
    <nav className="flex gap-2 overflow-x-auto border-y border-slate-200 py-3 dark:border-slate-800" aria-label="Operasional POS Apotik">
      {navigation.map(([to, label, Icon]) => <Link key={to} to={to} className="btn-outline shrink-0"><Icon className="h-4 w-4" />{label}</Link>)}
    </nav>

    {['history', 'return', 'void'].includes(area) && <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Transaksi farmasi</h2><p className="text-sm text-slate-500">{rows.length} transaksi terbaru dari server tenant.</p></div><button className="btn-outline" onClick={() => void sales.refetch()}><RefreshCw className="h-4 w-4" />Muat ulang</button></div>
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="p-3">Struk</th><th className="p-3">Waktu</th><th className="p-3">Mode</th><th className="p-3">Item</th><th className="p-3">Total</th><th className="p-3">Status</th></tr></thead><tbody>
            {rows.map((row) => <tr key={row.pos_sale_id} onClick={() => setSelectedId(row.pos_sale_id)} className={`cursor-pointer border-t border-slate-200 dark:border-slate-800 ${selectedId === row.pos_sale_id ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}><td className="p-3 font-mono text-xs font-semibold">{row.receipt_number ?? row.pos_sale_id.slice(0, 10)}</td><td className="p-3">{formatDateTime(row.updated_at)}</td><td className="p-3"><StatusBadge status={row.transaction_mode} tone="info" /></td><td className="p-3">{row.line_count}</td><td className="p-3 font-semibold">{formatMoney(row.grand_total, row.currency_code)}</td><td className="p-3"><StatusBadge status={row.sale_status} /></td></tr>)}
          </tbody></table>
        </div>
      </section>

      <aside className="min-w-0 border-l-0 border-slate-200 xl:border-l xl:pl-5 dark:border-slate-800">
        <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs uppercase text-slate-500">Detail transaksi</p><h2 className="font-mono text-lg font-bold">{selectedSummary?.receipt_number ?? selectedId?.slice(0, 12) ?? '-'}</h2></div>{selectedSummary && <StatusBadge status={selectedSummary.sale_status} />}</div>
        {detail.isLoading ? <p className="text-sm text-slate-500">Memuat detail...</p> : <div className="space-y-3">
          {(detail.data?.lines ?? []).map((line) => {
            const available = Math.max(0, Number(line.quantity) - Number(line.returned_quantity ?? 0));
            return <div key={line.id} className="border-b border-slate-200 pb-3 text-sm dark:border-slate-800"><div className="flex justify-between gap-3"><div><p className="font-semibold">{line.product_name}</p><p className="text-xs text-slate-500">Batch {line.lot_number ?? '-'} · ED {line.expiry_date ?? '-'}</p></div><p>{line.quantity} unit</p></div>{area === 'return' && <label className="mt-2 flex items-center justify-between gap-3 text-xs"><span>Jumlah retur (maks. {available})</span><input className="field-input w-24" type="number" min={0} max={available} value={returnQty[line.id] ?? 0} onChange={(e) => setReturnQty((old) => ({ ...old, [line.id]: Math.min(available, Math.max(0, Number(e.target.value))) }))} /></label>}</div>;
          })}
          <label className="block text-sm"><span className="mb-1 block font-medium">Alasan operasional</span><textarea className="field-input min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan alasan secara lengkap untuk audit" /></label>
          {area === 'history' && <button className="btn-primary w-full" disabled={!selectedId || reprint.isPending} onClick={() => reprint.mutate()}><Printer className="h-4 w-4" />Cetak ulang struk</button>}
          {area === 'return' && <><label className="block text-sm"><span className="mb-1 block font-medium">Disposisi stok</span><select className="field-input" value={disposition} onChange={(e) => setDisposition(e.target.value as typeof disposition)}><option value="RESTOCK">Kembali ke stok</option><option value="DAMAGED">Rusak / karantina</option><option value="DISPOSED">Dimusnahkan</option></select></label><button className="btn-primary w-full" disabled={!selectedId || !reason.trim() || !Object.values(returnQty).some((qty) => qty > 0) || submitReturn.isPending} onClick={() => submitReturn.mutate()}><RotateCcw className="h-4 w-4" />Ajukan retur</button></>}
          {area === 'void' && <div className="grid gap-2 sm:grid-cols-2"><button className="btn-outline" disabled={!selectedId || !reason.trim()} onClick={() => voidSale.mutate(false)}><Ban className="h-4 w-4" />Ajukan void</button><button className="btn-primary" disabled={!selectedId || !reason.trim()} onClick={() => voidSale.mutate(true)}><ShieldCheck className="h-4 w-4" />Setujui void</button><p className="sm:col-span-2 text-xs text-amber-700">Pemohon dan penyetuju wajib akun berbeda. Semua tindakan masuk audit trail.</p></div>}
        </div>}
      </aside>
    </div>}

    {area === 'devices' && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatusCard icon={Cloud} title="Internet & API" value={navigator.onLine && context.isSuccess ? 'Online' : 'Perlu diperiksa'} ok={navigator.onLine && context.isSuccess} detail={context.isFetching ? 'Sedang menyegarkan...' : `Diperbarui ${new Date().toLocaleTimeString('id-ID')}`} />
      <StatusCard icon={Store} title="Outlet tenant" value={`${context.data?.outlets.length ?? 0} outlet`} ok={(context.data?.outlets.length ?? 0) > 0} detail={context.data?.outlets.map((x) => x.name).join(', ') || 'Belum tersedia'} />
      <StatusCard icon={Activity} title="Terminal POS" value={`${context.data?.registers.length ?? 0} terminal`} ok={(context.data?.registers.length ?? 0) > 0} detail={context.data?.registers.map((x) => x.name ?? x.code).join(', ') || 'Belum tersedia'} />
      <StatusCard icon={CheckCircle2} title="Shift aktif" value={context.data?.openShift ? 'Terbuka' : 'Belum dibuka'} ok={Boolean(context.data?.openShift)} detail={context.data?.openShift?.shiftNumber ?? context.data?.businessDate ?? '-'} />
      <div className="sm:col-span-2 xl:col-span-4 flex justify-end"><button className="btn-primary" onClick={() => void context.refetch()}><RefreshCw className="h-4 w-4" />Perbarui status</button></div>
    </section>}

    {area === 'shift' && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div><h2 className="text-lg font-semibold">{context.data?.openShift ? 'Shift sedang aktif' : 'Persiapan buka shift'}</h2><p className="mt-1 text-sm text-slate-500">Saldo awal dan terminal dicatat pada server tenant. Pastikan laci kas, printer, pemindai, dan koneksi siap.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm"><span className="mb-1 block font-medium">Terminal</span><select className="field-input" value={terminalId} onChange={(e) => setTerminalId(e.target.value)} disabled={Boolean(context.data?.openShift)}>{context.data?.registers.map((r) => <option key={r.terminalId} value={r.terminalId}>{r.name ?? r.code ?? r.terminalId}</option>)}</select></label><label className="text-sm"><span className="mb-1 block font-medium">Saldo awal laci kas</span><input className="field-input" inputMode="numeric" value={openingCash} onChange={(e) => setOpeningCash(e.target.value.replace(/[^0-9]/g, ''))} disabled={Boolean(context.data?.openShift)} /></label></div><div className="mt-5 flex flex-wrap gap-2">{['Kas dihitung', 'Printer siap', 'Scanner siap', 'Koneksi stabil', 'Area kerja bersih'].map((x) => <span key={x} className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />{x}</span>)}</div></div>
      <aside className="rounded-md border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs uppercase text-slate-500">Ringkasan shift</p><p className="mt-2 text-lg font-bold">{context.data?.openShift?.shiftNumber ?? 'Belum ada shift aktif'}</p><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><dt>Tanggal usaha</dt><dd>{context.data?.businessDate ?? '-'}</dd></div><div className="flex justify-between"><dt>Mata uang</dt><dd>{context.data?.currency ?? '-'}</dd></div><div className="flex justify-between"><dt>Saldo awal</dt><dd>{formatMoney(context.data?.openShift?.openingCash ?? openingCash, context.data?.currency)}</dd></div></dl>{context.data?.openShift ? <Link className="btn-primary mt-5 w-full" to="/app/apotik/pos">Mulai transaksi</Link> : <button className="btn-primary mt-5 w-full" disabled={!terminalId || openShift.isPending} onClick={() => openShift.mutate()}><Store className="h-4 w-4" />Buka shift</button>}</aside>
    </section>}
  </div>;
}

function StatusCard({ icon: Icon, title, value, detail, ok }: { icon: typeof Activity; title: string; value: string; detail: string; ok: boolean }) {
  return <article className="rounded-md border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-start justify-between"><Icon className={`h-6 w-6 ${ok ? 'text-emerald-600' : 'text-amber-600'}`} /><StatusBadge status={ok ? 'Siap' : 'Perhatian'} tone={ok ? 'success' : 'warning'} /></div><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></article>;
}

export default PharmacyOperationsPage;
