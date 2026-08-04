/**
 * POS Apotik.
 *
 * Mesin transaksi tetap POS yang sama: membuka sale, menambah item, membayar,
 * dan menyelesaikan struk memakai endpoint `/pos/**`. Yang dipisahkan adalah
 * layar kerjanya, karena apotik memiliki risiko yang tidak ada pada retail
 * umum: resep dokter, racikan, batch-expiry, substitusi, obat terkendali, dan
 * telaah apoteker.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Barcode,
  Beaker,
  ClipboardCheck,
  Factory,
  FileText,
  Loader2,
  Pause,
  Pill,
  Plus,
  ScanLine,
  Search,
  ShieldAlert,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, formatMoney } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { LoadingState, useToast } from '../../components/ui';
import { PosPaymentDialog } from './PosPaymentDialog';
import { PosShiftBar } from './PosShiftBar';
import type { KeranjangPos, KonteksPos, ProdukPos } from './pos-types';

type ModeTransaksi = 'OTC' | 'RESEP' | 'RACIKAN' | 'PRODUKSI';

const modeTransaksi: Array<{
  key: ModeTransaksi;
  label: string;
  icon: typeof Pill;
  helper: string;
}> = [
  { key: 'OTC', label: 'OTC', icon: Pill, helper: 'Penjualan obat bebas dan produk kesehatan.' },
  { key: 'RESEP', label: 'Resep dokter', icon: ClipboardCheck, helper: 'Wajib telaah sebelum obat diserahkan.' },
  { key: 'RACIKAN', label: 'Racikan', icon: Beaker, helper: 'Bahan, takaran, etiket, dan HPP perlu dicatat.' },
  { key: 'PRODUKSI', label: 'Produksi farmasi', icon: Factory, helper: 'Gunakan BOM/work order untuk hasil jadi dan batch.' },
];

const guardrails = [
  'Scan barcode obat sebelum masuk keranjang.',
  'Cek batch dan expiry untuk item farmasi.',
  'Resep high-alert atau controlled drug jangan dibayar sebelum telaah.',
  'Racikan harus punya bahan, takaran, etiket, dan penanggung jawab.',
];

export function PharmacyPosPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const pesanGalat = useErrorMessage();
  const kotakPindai = useRef<HTMLInputElement>(null);

  const [outletId, setOutletId] = useState<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [kataKunci, setKataKunci] = useState('');
  const [pindai, setPindai] = useState('');
  const [bukaBayar, setBukaBayar] = useState(false);
  const [mode, setMode] = useState<ModeTransaksi>('RESEP');
  const [nomorResep, setNomorResep] = useState('');

  const galat = useCallback((e: unknown) => toast.push(pesanGalat(e, (k, f) => f ?? k), 'error'), [toast, pesanGalat]);
  const fokusPindai = useCallback(() => window.setTimeout(() => kotakPindai.current?.focus(), 0), []);

  const konteks = useQuery({
    queryKey: ['pharmacy-pos', 'context'],
    queryFn: () => api.get<KonteksPos>('/pos/context'),
  });

  useEffect(() => {
    const d = konteks.data;
    if (!d) return;
    if (!outletId && d.outlets.length >= 1) setOutletId(d.outlets[0].id);
    if (!terminalId && d.registers.length >= 1) setTerminalId(d.registers[0].terminalId);
    if (d.openShift) {
      setShiftId(d.openShift.shiftId);
      setTerminalId(d.openShift.terminalId);
    }
  }, [konteks.data, outletId, terminalId]);

  const keranjang = useQuery({
    queryKey: ['pharmacy-pos', 'sale', saleId],
    queryFn: () => api.get<KeranjangPos>(`/pos/sales/${saleId}`),
    enabled: Boolean(saleId),
  });

  const cari = useQuery({
    queryKey: ['pharmacy-pos', 'catalog', outletId, kataKunci],
    queryFn: () =>
      api.get<ProdukPos[]>(
        `/pos/catalog/search?outletId=${outletId}&q=${encodeURIComponent(kataKunci)}&limit=24`,
      ),
    enabled: Boolean(outletId) && kataKunci.trim().length >= 2,
  });

  const favorit = useQuery({
    queryKey: ['pharmacy-pos', 'catalog', outletId, 'favorit'],
    queryFn: () => api.get<ProdukPos[]>(`/pos/catalog/search?outletId=${outletId}&limit=18`),
    enabled: Boolean(outletId),
  });

  const bukaKeranjang = useMutation({
    mutationFn: () => api.post<KeranjangPos>('/pos/sales', { outletId, terminalId, shiftId }),
    onSuccess: (k) => {
      setSaleId(k.id);
      fokusPindai();
    },
    onError: galat,
  });

  const tambah = useMutation({
    mutationFn: (v: { productId: string; quantity: number }) =>
      api.post<KeranjangPos>(`/pos/sales/${saleId}/items`, v),
    onSuccess: (k) => {
      qc.setQueryData(['pharmacy-pos', 'sale', saleId], k);
      setPindai('');
      setKataKunci('');
      fokusPindai();
    },
    onError: (e) => {
      galat(e);
      setPindai('');
      fokusPindai();
    },
  });

  const ubahJumlah = useMutation({
    mutationFn: (v: { lineId: string; quantity: number }) =>
      api.patch<KeranjangPos>(`/pos/sales/${saleId}/items/${v.lineId}`, { quantity: v.quantity }),
    onSuccess: (k) => qc.setQueryData(['pharmacy-pos', 'sale', saleId], k),
    onError: galat,
  });

  const hapusBaris = useMutation({
    mutationFn: (lineId: string) => api.delete<KeranjangPos>(`/pos/sales/${saleId}/items/${lineId}`),
    onSuccess: (k) => {
      qc.setQueryData(['pharmacy-pos', 'sale', saleId], k);
      fokusPindai();
    },
    onError: galat,
  });

  const tahan = useMutation({
    mutationFn: () => api.post<KeranjangPos>(`/pos/sales/${saleId}/hold`, {}),
    onSuccess: () => {
      toast.push('Transaksi apotik ditahan. Resep atau racikan dapat dilanjutkan dari daftar tertahan.', 'success');
      setSaleId(null);
    },
    onError: galat,
  });

  const batal = useMutation({
    mutationFn: () => api.post<KeranjangPos>(`/pos/sales/${saleId}/cancel`, {}),
    onSuccess: () => {
      toast.push('Transaksi apotik dibatalkan, stok dilepaskan.', 'info');
      setSaleId(null);
    },
    onError: galat,
  });

  const denganBarcode = useMutation({
    mutationFn: async (kode: string) => {
      const p = await api.get<ProdukPos>(`/pos/products/by-barcode?code=${encodeURIComponent(kode)}`);
      return api.post<KeranjangPos>(`/pos/sales/${saleId}/items`, { productId: p.productId, quantity: 1 });
    },
    onSuccess: (k) => {
      qc.setQueryData(['pharmacy-pos', 'sale', saleId], k);
      setPindai('');
      fokusPindai();
    },
    onError: (e) => {
      const pesan = (e as { message?: string })?.message;
      toast.push(pesan || pesanGalat(e, (k, f) => f ?? k), 'error');
      setPindai('');
      fokusPindai();
    },
  });

  const baris = keranjang.data?.lines ?? [];
  const daftarProduk = kataKunci.trim().length >= 2 ? cari.data : favorit.data;
  const modeAktif = modeTransaksi.find((m) => m.key === mode)!;
  const siapBayar = useMemo(
    () => Boolean(saleId) && baris.length > 0 && Number(keranjang.data?.grand_total ?? 0) > 0,
    [saleId, baris.length, keranjang.data],
  );

  if (konteks.isLoading) return <LoadingState />;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-emerald-50 dark:bg-slate-950">
      <PosShiftBar
        konteks={konteks.data}
        outletId={outletId}
        terminalId={terminalId}
        shiftId={shiftId}
        onPilihOutlet={setOutletId}
        onPilihTerminal={setTerminalId}
        onShiftBerubah={(id) => {
          setShiftId(id);
          if (!id) setSaleId(null);
          void konteks.refetch();
        }}
      />

      <header className="border-b border-emerald-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">POS Apotik</p>
            <h1 className="text-lg font-black">Kasir obat, resep, racikan, dan produksi farmasi</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/pos/kasir" className="btn-outline px-3 py-2 text-xs">
              POS penjualan biasa
            </Link>
            <Link to="/app/emedik/resep" className="btn-outline px-3 py-2 text-xs">
              Resep dokter
            </Link>
            <Link to="/app/boms" className="btn-outline px-3 py-2 text-xs">
              BOM racikan
            </Link>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 xl:grid-cols-[21rem_1fr_26rem]">
        <aside className="min-h-0 overflow-y-auto rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900">
          <div className="rounded-lg bg-emerald-950 p-4 text-white">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-7 w-7 text-emerald-200" aria-hidden />
              <div>
                <p className="text-sm text-emerald-200">Mode farmasi</p>
                <h2 className="font-black">{modeAktif.label}</h2>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-emerald-50">{modeAktif.helper}</p>
          </div>

          <div className="mt-3 grid gap-2">
            {modeTransaksi.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={
                    m.key === mode
                      ? 'flex items-center gap-3 rounded-lg border-2 border-emerald-600 bg-emerald-50 p-3 text-start'
                      : 'flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-start hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                  }
                >
                  <Icon className="h-5 w-5 text-emerald-700" aria-hidden />
                  <span className="text-sm font-bold">{m.label}</span>
                </button>
              );
            })}
          </div>

          <label className="field-label mt-4" htmlFor="nomor-resep">
            Nomor resep / pasien
          </label>
          <input
            id="nomor-resep"
            value={nomorResep}
            onChange={(e) => setNomorResep(e.target.value)}
            placeholder="mis. RSP-0826-0142"
            className="field-input"
          />

          <div className="mt-4 space-y-2">
            {guardrails.map((g) => (
              <p key={g} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {g}
              </p>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[15rem] flex-1">
              <input
                ref={kotakPindai}
                value={pindai}
                onChange={(e) => setPindai(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !pindai.trim() || !saleId) return;
                  e.preventDefault();
                  denganBarcode.mutate(pindai.trim());
                }}
                placeholder="Pindai barcode obat"
                autoFocus
                disabled={!saleId}
                className="field-input w-full ps-9 text-lg"
                aria-label="Pindai barcode obat"
              />
              <Barcode className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>
            <div className="relative w-full sm:w-72">
              <input
                value={kataKunci}
                onChange={(e) => setKataKunci(e.target.value)}
                placeholder="Cari obat, SKU, atau alat kesehatan"
                disabled={!saleId}
                className="field-input w-full ps-9"
                aria-label="Cari obat"
              />
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>
          </div>

          {!saleId ? (
            <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <ScanLine className="h-12 w-12 text-emerald-300" aria-hidden />
              <p className="max-w-md text-slate-500 dark:text-slate-400">
                Buka transaksi POS Apotik. Setelah terbuka, scan obat OTC, tarik item resep,
                atau masukkan hasil racikan yang sudah disiapkan.
              </p>
              <button
                type="button"
                className="btn-primary bg-emerald-700 hover:bg-emerald-800"
                disabled={!shiftId || !outletId || !terminalId || bukaKeranjang.isPending}
                onClick={() => bukaKeranjang.mutate()}
              >
                {bukaKeranjang.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Transaksi apotik baru
              </button>
            </div>
          ) : (
            <div className="mt-3 grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto md:grid-cols-3 2xl:grid-cols-4">
              {(daftarProduk ?? []).map((p) => (
                <button
                  key={p.productId}
                  type="button"
                  onClick={() => tambah.mutate({ productId: p.productId, quantity: 1 })}
                  disabled={tambah.isPending}
                  className="flex min-h-[6.25rem] flex-col justify-between rounded-lg border border-slate-200 p-3 text-start transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:hover:bg-emerald-950/30"
                >
                  <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
                  <span className="mt-1 text-xs text-slate-500">{p.sku ?? p.code}</span>
                  <span className="mt-1 font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatMoney(Number(p.price ?? 0), p.currencyCode ?? 'IDR')}
                  </span>
                  {p.availableQty !== null && (
                    <span className="mt-1 text-xs text-slate-500">Stok {Number(p.availableQty)}</span>
                  )}
                </button>
              ))}
              {daftarProduk && daftarProduk.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-slate-500">Tidak ada obat yang cocok.</p>
              )}
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col rounded-xl bg-white shadow-sm dark:bg-slate-900">
          <header className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Keranjang Apotik
              {baris.length > 0 && <span className="badge bg-emerald-100 text-emerald-800">{baris.length}</span>}
            </h2>
            {saleId && (
              <div className="flex gap-1">
                <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => tahan.mutate()} disabled={baris.length === 0}>
                  <Pause className="h-3.5 w-3.5" aria-hidden />
                  Tahan
                </button>
                <button type="button" className="btn-ghost px-2 py-1 text-xs text-rose-600" onClick={() => batal.mutate()}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Batal
                </button>
              </div>
            )}
          </header>

          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {baris.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Belum ada obat.</p>}
            {baris.map((l) => (
              <article key={l.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{l.product_name}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {formatMoney(Number(l.unit_price), keranjang.data?.currency_code ?? 'IDR')}
                    </p>
                    {l.requires_approval && !l.approved_by && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <ShieldAlert className="h-3 w-3" aria-hidden />
                        Butuh persetujuan sebelum dibayar
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => hapusBaris.mutate(l.id)}
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Hapus ${l.product_name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="h-8 w-8 rounded border border-slate-300 text-lg leading-none dark:border-slate-700"
                      onClick={() => ubahJumlah.mutate({ lineId: l.id, quantity: Math.max(1, Number(l.quantity) - 1) })}
                      disabled={Number(l.quantity) <= 1}
                      aria-label="Kurangi"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-medium tabular-nums">{Number(l.quantity)}</span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded border border-slate-300 text-lg leading-none dark:border-slate-700"
                      onClick={() => ubahJumlah.mutate({ lineId: l.id, quantity: Number(l.quantity) + 1 })}
                      aria-label="Tambah"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(Number(l.line_total), keranjang.data?.currency_code ?? 'IDR')}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <footer className="border-t border-slate-200 p-3 dark:border-slate-800">
            <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <p className="flex gap-2">
                <FileText className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                {nomorResep.trim() ? `Konteks: ${nomorResep.trim()}` : 'Isi nomor resep/pasien bila transaksi berasal dari resep dokter.'}
              </p>
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(Number(keranjang.data?.subtotal ?? 0), keranjang.data?.currency_code ?? 'IDR')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Pajak</dt>
                <dd className="tabular-nums">{formatMoney(Number(keranjang.data?.tax_total ?? 0), keranjang.data?.currency_code ?? 'IDR')}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold dark:border-slate-800">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(Number(keranjang.data?.grand_total ?? 0), keranjang.data?.currency_code ?? 'IDR')}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="btn-primary mt-3 w-full justify-center bg-emerald-700 py-3 text-base hover:bg-emerald-800"
              disabled={!siapBayar}
              onClick={() => setBukaBayar(true)}
            >
              <Banknote className="h-5 w-5" aria-hidden />
              Bayar POS Apotik
            </button>
          </footer>
        </section>
      </div>

      {bukaBayar && saleId && keranjang.data && (
        <PosPaymentDialog
          saleId={saleId}
          total={Number(keranjang.data.grand_total)}
          currencyCode={keranjang.data.currency_code ?? 'IDR'}
          onTutup={() => {
            setBukaBayar(false);
            fokusPindai();
          }}
          onSelesai={(nomorStruk) => {
            setBukaBayar(false);
            setSaleId(null);
            toast.push(`Transaksi apotik selesai. Struk ${nomorStruk}.`, 'success');
            fokusPindai();
          }}
        />
      )}
    </div>
  );
}

export default PharmacyPosPage;
