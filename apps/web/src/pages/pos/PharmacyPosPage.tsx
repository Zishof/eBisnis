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
  Barcode,
  Beaker,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cloud,
  Clock3,
  ClipboardCheck,
  Factory,
  FileText,
  History,
  Loader2,
  ListRestart,
  Pause,
  Pill,
  Printer,
  PackageCheck,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  ShoppingCart,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, formatMoney } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { LoadingState, useToast } from '../../components/ui';
import { PosPaymentDialog } from './PosPaymentDialog';
import { PosShiftBar } from './PosShiftBar';
import { PharmacyLotDialog } from './PharmacyLotDialog';
import { PharmacyHeldDrawer, type TransaksiPosApotik } from './PharmacyHeldDrawer';
import type { KeranjangPos, KonteksPos, ProdukPos } from './pos-types';
import { emedikPublicBrandFor } from '../public/emedik-host';

type ModeTransaksi = 'OTC' | 'PRESCRIPTION' | 'COMPOUND' | 'PRODUCTION';

const modeTransaksi: Array<{
  key: ModeTransaksi;
  label: string;
  icon: typeof Pill;
  helper: string;
}> = [
  { key: 'OTC', label: 'OTC', icon: Pill, helper: 'Penjualan obat bebas dan produk kesehatan.' },
  { key: 'PRESCRIPTION', label: 'Resep dokter', icon: ClipboardCheck, helper: 'Wajib telaah sebelum obat diserahkan.' },
  { key: 'COMPOUND', label: 'Racikan', icon: Beaker, helper: 'Bahan, takaran, etiket, dan HPP dicatat sebagai satu formula.' },
  { key: 'PRODUCTION', label: 'Produksi farmasi', icon: Factory, helper: 'Nomor work order dan komponen disimpan bersama batch hasil jadi.' },
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
  const brand = emedikPublicBrandFor();

  const [outletId, setOutletId] = useState<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [kataKunci, setKataKunci] = useState('');
  const [pindai, setPindai] = useState('');
  const [bukaBayar, setBukaBayar] = useState(false);
  const [mode, setMode] = useState<ModeTransaksi>('PRESCRIPTION');
  const [nomorResep, setNomorResep] = useState('');
  const [namaFormula, setNamaFormula] = useState('');
  const [bentukSediaan, setBentukSediaan] = useState('');
  const [etiket, setEtiket] = useState('');
  const [nomorProduksi, setNomorProduksi] = useState('');
  const [produkPilihBatch, setProdukPilihBatch] = useState<ProdukPos | null>(null);
  const [bukaTertahan, setBukaTertahan] = useState(false);

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
    mutationFn: (v: { productId: string; quantity: number; lotId?: string | null }) =>
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

  const lanjutkan = useMutation({
    mutationFn: async (row: TransaksiPosApotik) => {
      const cart = await api.post<KeranjangPos>(`/pos/sales/${row.pos_sale_id}/resume`, {});
      return { row, cart };
    },
    onSuccess: ({ row, cart }) => {
      setSaleId(row.pos_sale_id);
      setMode(row.transaction_mode);
      setNomorResep(row.prescription_number ?? '');
      setNomorProduksi(row.reference_number ?? '');
      setNamaFormula(row.formula_name ?? '');
      setBentukSediaan(row.dosage_form ?? '');
      setEtiket(row.label_instruction ?? '');
      qc.setQueryData(['pharmacy-pos', 'sale', row.pos_sale_id], cart);
      setBukaTertahan(false);
      fokusPindai();
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

  const simpanKonteks = useMutation({
    mutationFn: async () => {
      await api.post(`/health/pharmacy/pos-sales/${saleId}/context`, {
        mode,
        prescriptionNumber: nomorResep.trim() || undefined,
        referenceNumber: nomorProduksi.trim() || undefined,
        formulaName: namaFormula.trim() || undefined,
        dosageForm: bentukSediaan.trim() || undefined,
        labelInstruction: etiket.trim() || undefined,
      });
      return api.post(`/health/pharmacy/pos-sales/${saleId}/validate`, {});
    },
    onSuccess: () => setBukaBayar(true),
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
  const butuhResep = mode === 'PRESCRIPTION' || mode === 'COMPOUND';
  const konteksKlinisTerisi = !butuhResep || nomorResep.trim().length >= 3;
  const formulaTerisi = mode !== 'COMPOUND' ||
    (namaFormula.trim().length >= 3 && etiket.trim().length >= 3);
  const produksiTerisi = mode !== 'PRODUCTION' || nomorProduksi.trim().length >= 3;
  const butuhApproval = baris.some((l) => l.requires_approval && !l.approved_by);
  const siapBayar = useMemo(
    () =>
      Boolean(saleId) &&
      baris.length > 0 &&
      Number(keranjang.data?.grand_total ?? 0) > 0 &&
      konteksKlinisTerisi &&
      formulaTerisi &&
      produksiTerisi &&
      !butuhApproval,
    [saleId, baris.length, keranjang.data, konteksKlinisTerisi, formulaTerisi, produksiTerisi, butuhApproval],
  );
  const safetyChecklist = [
    {
      label: butuhResep ? 'Nomor resep terisi' : mode === 'PRODUCTION' ? 'Nomor produksi terisi' : 'Mode OTC dipilih',
      ok: konteksKlinisTerisi,
    },
    {
      label: baris.length > 0 ? `${baris.length} item obat masuk keranjang` : 'Keranjang masih kosong',
      ok: baris.length > 0,
    },
    {
      label: butuhApproval ? 'Masih ada item butuh approval' : 'Tidak ada approval tertunda',
      ok: !butuhApproval,
    },
  ];

  if (konteks.isLoading) return <LoadingState />;

  return (
    <div className="pharmacy-pos-shell flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#f4f8f7] dark:bg-slate-950">
      <header className="bg-[#006b68] px-3 py-3 text-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex min-w-[12rem] items-center gap-3 border-white/20 pe-5 lg:border-e">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#007c75] shadow-sm">
              <Pill className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h1 className="text-base font-black leading-tight">eMedik</h1>
              <p className="text-sm text-emerald-50">POS Apotik</p>
            </div>
          </div>
          <div className="min-w-[10rem]">
            <p className="text-[11px] text-emerald-100">Apotik</p>
            <p className="text-sm font-semibold">{brand?.kind === 'apotik' ? brand.name : 'Apotik eMedik'}</p>
          </div>
          <div className="min-w-[9rem] border-white/20 lg:border-s lg:ps-5">
            <p className="text-[11px] text-emerald-100">Status operasional</p>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Cloud className="h-4 w-4 text-lime-300" aria-hidden /> Online
            </p>
          </div>
          <div className="ms-auto hidden items-center gap-5 text-xs xl:flex">
            <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-200" aria-hidden />{konteks.data?.businessDate ?? 'Hari ini'}</span>
            <span className="flex items-center gap-2"><Printer className="h-4 w-4 text-emerald-200" aria-hidden />Printer siap diperiksa</span>
            <a href="/panduan/apotik/manual-pengguna-sistem-apotik-emedik.pdf" target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold hover:text-emerald-100">
              <CircleHelp className="h-4 w-4" aria-hidden /> Bantuan
            </a>
          </div>
          <button type="button" className="ms-auto flex items-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-sm font-bold hover:bg-white/10 xl:ms-0" onClick={() => setBukaTertahan(true)}>
            <ListRestart className="h-4 w-4" /> Ditahan
          </button>
        </div>
      </header>

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

      <nav className="border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900" aria-label="Mode transaksi farmasi">
        <div className="flex gap-1 overflow-x-auto py-2">
          {modeTransaksi.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={m.key === mode
                  ? 'flex min-w-[9.5rem] flex-1 items-center justify-center gap-2 rounded-lg bg-[#007c75] px-4 py-2.5 text-sm font-bold text-white shadow-sm'
                  : 'flex min-w-[9.5rem] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}
              >
                <Icon className="h-4 w-4" aria-hidden /> {m.label}
              </button>
            );
          })}
          <Link to="/app/emedik/resep" className="flex min-w-[9.5rem] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300">
            <Stethoscope className="h-4 w-4" aria-hidden /> Antrean resep
          </Link>
          <Link to="/app/apotik/riwayat" className="flex min-w-[9.5rem] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300">
            <History className="h-4 w-4" aria-hidden /> Riwayat
          </Link>
          <Link to="/app/apotik/retur" className="flex min-w-[9.5rem] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300">
            <RotateCcw className="h-4 w-4" aria-hidden /> Retur & void
          </Link>
        </div>
      </nav>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-visible p-3 xl:grid-cols-[21rem_1fr_26rem] xl:overflow-hidden">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:min-h-0 xl:overflow-y-auto">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-[#007c75]">
              <UserRound className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-slate-500">Pasien / pelanggan</p>
              <h2 className="truncate font-black">{butuhResep ? 'Pilih pasien resep' : 'Pelanggan umum'}</h2>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-[#eaf8f4] p-3 text-[#075e59]">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" aria-hidden />
              <p className="text-sm font-black">{modeAktif.label}</p>
            </div>
            <p className="mt-1 text-xs leading-5">{modeAktif.helper}</p>
          </div>

          {butuhResep && (
            <>
              <label className="field-label mt-4" htmlFor="nomor-resep">Nomor resep</label>
              <input
                id="nomor-resep"
                value={nomorResep}
                onChange={(e) => setNomorResep(e.target.value)}
                placeholder="mis. RX-KLN01-20260806-0012"
                className={!konteksKlinisTerisi ? 'field-input border-amber-400 bg-amber-50' : 'field-input'}
              />
            </>
          )}
          {butuhResep && !konteksKlinisTerisi && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-900">
              Mode {modeAktif.label} perlu nomor resep yang sudah ditelaah sebelum pembayaran.
            </p>
          )}

          {mode === 'COMPOUND' && (
            <div className="mt-3 grid gap-2">
              <label className="field-label" htmlFor="nama-formula">Nama formula racikan</label>
              <input id="nama-formula" className="field-input" value={namaFormula} onChange={(e) => setNamaFormula(e.target.value)} placeholder="mis. Puyer batuk anak" />
              <label className="field-label" htmlFor="bentuk-sediaan">Bentuk sediaan</label>
              <input id="bentuk-sediaan" className="field-input" value={bentukSediaan} onChange={(e) => setBentukSediaan(e.target.value)} placeholder="puyer, kapsul, salep" />
              <label className="field-label" htmlFor="etiket-racikan">Instruksi etiket</label>
              <textarea id="etiket-racikan" className="field-input min-h-20" value={etiket} onChange={(e) => setEtiket(e.target.value)} placeholder="Aturan pakai pada etiket" />
            </div>
          )}

          {mode === 'PRODUCTION' && (
            <div className="mt-3">
              <label className="field-label" htmlFor="nomor-produksi">Nomor work order / batch</label>
              <input id="nomor-produksi" className="field-input" value={nomorProduksi} onChange={(e) => setNomorProduksi(e.target.value)} placeholder="mis. WO-FRM-2026-0042" />
            </div>
          )}

          <div className="mt-4 space-y-2">
            {guardrails.map((g) => (
              <p key={g} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {g}
              </p>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[24rem] flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:min-h-0">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
                placeholder="Scan barcode produk..."
                autoFocus
                disabled={!saleId}
                className="field-input h-12 w-full border-[#85cfc7] ps-10 text-base"
                aria-label="Pindai barcode obat"
              />
              <Barcode className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>
            <button type="button" className="btn-outline h-12 justify-center px-4" disabled={!saleId} onClick={fokusPindai}>
              <ScanLine className="h-4 w-4" aria-hidden /> Scan
            </button>
            <div className="relative w-full sm:col-span-2">
              <input
                value={kataKunci}
                onChange={(e) => setKataKunci(e.target.value)}
                placeholder="Cari nama obat, kandungan, merek, SKU, atau alat kesehatan"
                disabled={!saleId}
                className="field-input h-11 w-full ps-10"
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
            <div className="mt-3 grid flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 2xl:grid-cols-3">
              {(daftarProduk ?? []).map((p) => (
                <button
                  key={p.productId}
                  type="button"
                  onClick={() => setProdukPilihBatch(p)}
                  disabled={tambah.isPending}
                  className="group grid min-h-[8.5rem] grid-cols-[4.5rem_1fr] gap-3 rounded-lg border border-slate-200 p-3 text-start transition hover:border-[#56bdb4] hover:bg-[#f0faf7] dark:border-slate-700 dark:hover:bg-emerald-950/30"
                >
                  <span className="relative grid h-[4.5rem] w-[4.5rem] place-items-center overflow-hidden rounded-lg bg-emerald-50 text-[#00877e] group-hover:bg-white">
                    <PackageCheck className="h-8 w-8" aria-hidden />
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full bg-white object-contain p-1" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-bold">{p.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{p.sku ?? p.code}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">FARMASI</span>
                      {p.availableQty !== null && <span className="text-xs text-slate-500">Stok {Number(p.availableQty)}</span>}
                    </span>
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-black tabular-nums text-[#007c75]">{formatMoney(Number(p.price ?? 0), p.currencyCode ?? 'IDR')}</span>
                      <Plus className="h-6 w-6 rounded border border-emerald-200 p-1 text-[#007c75]" aria-hidden />
                    </span>
                  </span>
                </button>
              ))}
              {daftarProduk && daftarProduk.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-slate-500">Tidak ada obat yang cocok.</p>
              )}
            </div>
          )}
        </section>

        <section className="flex min-h-[24rem] flex-col rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:min-h-0">
          <header className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Keranjang
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
                    {l.lot_number && <p className="mt-1 text-[11px] font-medium text-emerald-700">Batch {l.lot_number}{l.expiry_date ? ` · ED ${l.expiry_date}` : ''}</p>}
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
            <div className="rounded-lg bg-[#f0faf7] p-3 text-xs leading-5 text-[#155e59] dark:bg-slate-800 dark:text-slate-300">
              <p className="flex gap-2">
                <FileText className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                {nomorResep.trim() ? `Konteks: ${nomorResep.trim()}` : 'Isi nomor resep/pasien bila transaksi berasal dari resep dokter.'}
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              {safetyChecklist.map((item) => (
                <p
                  key={item.label}
                  className={
                    item.ok
                      ? 'flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                  }
                >
                  {item.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />}
                  {item.label}
                </p>
              ))}
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
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn-outline justify-center py-3" disabled={!saleId || baris.length === 0} onClick={() => tahan.mutate()}>
                <Pause className="h-4 w-4" aria-hidden /> Tahan (F6)
              </button>
              <button
              type="button"
              className="btn-primary w-full justify-center bg-[#007c75] py-3 text-base hover:bg-[#006b68]"
              disabled={!siapBayar}
              onClick={() => simpanKonteks.mutate()}
            >
                <ShoppingCart className="h-5 w-5" aria-hidden /> Bayar (F9)
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </footer>
        </section>
      </div>

      {bukaBayar && saleId && keranjang.data && (
        <PosPaymentDialog
          saleId={saleId}
          total={Number(keranjang.data.grand_total)}
          currencyCode={keranjang.data.currency_code ?? 'IDR'}
          completePath={`/health/pharmacy/pos-sales/${saleId}/complete`}
          completeHeaders={{ 'X-Purpose-Of-Use': 'PAYMENT' }}
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
      {produkPilihBatch && saleId && (
        <PharmacyLotDialog
          saleId={saleId}
          product={produkPilihBatch}
          onClose={() => setProdukPilihBatch(null)}
          onSelect={(lotId) => {
            tambah.mutate({ productId: produkPilihBatch.productId, quantity: 1, lotId });
            setProdukPilihBatch(null);
          }}
        />
      )}
      {bukaTertahan && (
        <PharmacyHeldDrawer
          onClose={() => setBukaTertahan(false)}
          onResume={async (row) => { await lanjutkan.mutateAsync(row); }}
        />
      )}
    </div>
  );
}

export default PharmacyPosPage;
