/**
 * Layar kasir.
 *
 * Dirancang untuk dipakai berdiri, dengan satu tangan memegang barang dan mata
 * pada antrean — bukan untuk dibaca dengan tenang. Yang menentukan bentuknya:
 *
 * - **Fokus selalu kembali ke kotak pindai.** Pemindai barcode mengetik lalu
 *   menekan Enter; bila fokus berpindah, pindaian berikutnya masuk ke tempat
 *   yang salah dan kasir baru menyadarinya beberapa barang kemudian.
 * - **Keranjang selalu terlihat.** Tidak ada modal yang menutupinya kecuali
 *   pembayaran, yang memang menuntut perhatian penuh.
 * - **Angka datang dari peladen.** Layar ini tidak pernah menghitung total
 *   sendiri, bahkan untuk tampilan sementara — angka sementara yang berbeda
 *   dari angka sebenarnya lebih buruk daripada jeda sesaat.
 * - **Setiap penolakan ditampilkan apa adanya.** Pesan dari peladen sudah
 *   ditulis untuk dibaca kasir.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Banknote,
  Loader2,
  Pause,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { api, formatMoney } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { LoadingState, useToast } from '../../components/ui';
import { PosShiftBar } from './PosShiftBar';
import { PosPaymentDialog } from './PosPaymentDialog';
import type { KeranjangPos, KonteksPos, ProdukPos } from './pos-types';

export function PosPage() {
  const { t } = useTranslation();
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

  const galat = useCallback(
    (e: unknown) => toast.push(pesanGalat(e, (k, f) => t(k, f ?? k)), 'error'),
    [toast, pesanGalat, t],
  );

  /** Mengembalikan fokus ke kotak pindai — dipanggil sesudah setiap tindakan. */
  const fokusPindai = useCallback(() => {
    window.setTimeout(() => kotakPindai.current?.focus(), 0);
  }, []);

  const konteks = useQuery({
    queryKey: ['pos', 'context'],
    queryFn: () => api.get<KonteksPos>('/pos/context'),
  });

  // Outlet dan register dipilih otomatis bila hanya ada satu. Kasir yang setiap
  // pagi memilih dari daftar berisi satu pilihan hanya diperlambat.
  useEffect(() => {
    const d = konteks.data;
    if (!d) return;
    if (!outletId && d.outlets.length >= 1) setOutletId(d.outlets[0].outletId);
    if (!terminalId && d.registers.length >= 1) setTerminalId(d.registers[0].terminalId);
    if (d.openShift) {
      setShiftId(d.openShift.shiftId);
      setTerminalId(d.openShift.terminalId);
    }
  }, [konteks.data, outletId, terminalId]);

  const keranjang = useQuery({
    queryKey: ['pos', 'sale', saleId],
    queryFn: () => api.get<KeranjangPos>(`/pos/sales/${saleId}`),
    enabled: Boolean(saleId),
  });

  const cari = useQuery({
    queryKey: ['pos', 'catalog', outletId, kataKunci],
    queryFn: () =>
      api.get<ProdukPos[]>(
        `/pos/catalog/search?outletId=${outletId}&q=${encodeURIComponent(kataKunci)}&limit=24`,
      ),
    enabled: Boolean(outletId) && kataKunci.trim().length >= 2,
  });

  const favorit = useQuery({
    queryKey: ['pos', 'catalog', outletId, 'favorit'],
    queryFn: () => api.get<ProdukPos[]>(`/pos/catalog/search?outletId=${outletId}&limit=18`),
    enabled: Boolean(outletId),
  });

  const bukaKeranjang = useMutation({
    mutationFn: () =>
      api.post<KeranjangPos>('/pos/sales', { outletId, terminalId, shiftId }),
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
      qc.setQueryData(['pos', 'sale', saleId], k);
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
      api.patch<KeranjangPos>(`/pos/sales/${saleId}/items/${v.lineId}`, {
        quantity: v.quantity,
      }),
    onSuccess: (k) => qc.setQueryData(['pos', 'sale', saleId], k),
    onError: galat,
  });

  const hapusBaris = useMutation({
    mutationFn: (lineId: string) => api.delete<KeranjangPos>(`/pos/sales/${saleId}/items/${lineId}`),
    onSuccess: (k) => {
      qc.setQueryData(['pos', 'sale', saleId], k);
      fokusPindai();
    },
    onError: galat,
  });

  const tahan = useMutation({
    mutationFn: () => api.post<KeranjangPos>(`/pos/sales/${saleId}/hold`, {}),
    onSuccess: () => {
      toast.push('Keranjang ditahan. Buka keranjang baru untuk melayani pembeli berikutnya.', 'success');
      setSaleId(null);
    },
    onError: galat,
  });

  const batal = useMutation({
    mutationFn: () => api.post<KeranjangPos>(`/pos/sales/${saleId}/cancel`, {}),
    onSuccess: () => {
      toast.push('Keranjang dibatalkan, stok dilepaskan.', 'info');
      setSaleId(null);
    },
    onError: galat,
  });

  /** Pindaian barcode: cari produknya, lalu masukkan ke keranjang. */
  const denganBarcode = useMutation({
    mutationFn: async (kode: string) => {
      const p = await api.get<ProdukPos>(
        `/pos/products/by-barcode?code=${encodeURIComponent(kode)}`,
      );
      return api.post<KeranjangPos>(`/pos/sales/${saleId}/items`, {
        productId: p.productId,
        quantity: 1,
      });
    },
    onSuccess: (k) => {
      qc.setQueryData(['pos', 'sale', saleId], k);
      setPindai('');
      fokusPindai();
    },
    onError: (e) => {
      galat(e);
      setPindai('');
      fokusPindai();
    },
  });

  // Pintasan papan ketik. F9 membayar, F6 menahan, Esc menutup dialog.
  useEffect(() => {
    const pada = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        kotakPindai.current?.focus();
      } else if (e.key === 'F6' && saleId) {
        e.preventDefault();
        tahan.mutate();
      } else if (e.key === 'F9' && saleId) {
        e.preventDefault();
        setBukaBayar(true);
      }
    };
    window.addEventListener('keydown', pada);
    return () => window.removeEventListener('keydown', pada);
  }, [saleId, tahan]);

  const baris = keranjang.data?.lines ?? [];
  const daftarProduk = kataKunci.trim().length >= 2 ? cari.data : favorit.data;
  const siapBayar = useMemo(
    () => Boolean(saleId) && baris.length > 0 && Number(keranjang.data?.grand_total ?? 0) > 0,
    [saleId, baris.length, keranjang.data],
  );

  if (konteks.isLoading) return <LoadingState />;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-slate-100 dark:bg-slate-950">
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

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[1fr_26rem]">
        {/* --- Katalog ------------------------------------------------------ */}
        <section className="flex min-h-0 flex-col rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[14rem]">
              {/*
                Kotak pindai dan kotak cari sengaja dipisah. Pemindai mengirim
                seluruh kode lalu Enter; menggabungkannya dengan pencarian
                bebas membuat pindaian tersangkut pada hasil pencarian yang
                kebetulan cocok sebagian.
              */}
              <input
                ref={kotakPindai}
                value={pindai}
                onChange={(e) => setPindai(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pindai.trim() && saleId) {
                    e.preventDefault();
                    denganBarcode.mutate(pindai.trim());
                  }
                }}
                placeholder="Pindai barcode di sini (F2)"
                autoFocus
                disabled={!saleId}
                className="field-input w-full ps-9 text-lg"
                aria-label="Kotak pindai barcode"
              />
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>
            <input
              value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
              placeholder="Cari nama atau SKU"
              disabled={!saleId}
              className="field-input w-56"
              aria-label="Cari produk"
            />
          </div>

          {!saleId && (
            <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <ShoppingCart className="h-10 w-10 text-slate-300" aria-hidden />
              <p className="text-slate-500 dark:text-slate-400">
                {shiftId
                  ? 'Buka keranjang untuk mulai melayani pembeli.'
                  : 'Buka shift terlebih dahulu pada batang di atas.'}
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={!shiftId || !outletId || !terminalId || bukaKeranjang.isPending}
                onClick={() => bukaKeranjang.mutate()}
              >
                {bukaKeranjang.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden />
                )}
                Keranjang baru
              </button>
            </div>
          )}

          {saleId && (
            <div className="mt-3 grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
              {(daftarProduk ?? []).map((p) => (
                <button
                  key={p.productId}
                  type="button"
                  onClick={() => tambah.mutate({ productId: p.productId, quantity: 1 })}
                  disabled={tambah.isPending}
                  className="flex min-h-[5.5rem] flex-col justify-between rounded-lg border border-slate-200 p-3 text-start transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-brand-950/30"
                >
                  <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                  <span className="mt-1 text-xs text-slate-500">{p.sku}</span>
                  <span className="mt-1 font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                    {formatMoney(Number(p.price ?? 0), p.currencyCode ?? 'IDR')}
                  </span>
                </button>
              ))}
              {daftarProduk && daftarProduk.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-slate-500">
                  Tidak ada produk yang cocok.
                </p>
              )}
            </div>
          )}
        </section>

        {/* --- Keranjang ---------------------------------------------------- */}
        <section className="flex min-h-0 flex-col rounded-xl bg-white shadow-sm dark:bg-slate-900">
          <header className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Keranjang
              {baris.length > 0 && (
                <span className="badge bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                  {baris.length}
                </span>
              )}
            </h2>
            {saleId && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => tahan.mutate()}
                  disabled={tahan.isPending || baris.length === 0}
                  title="Tahan keranjang (F6)"
                >
                  <Pause className="h-3.5 w-3.5" aria-hidden />
                  Tahan
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs text-rose-600"
                  onClick={() => batal.mutate()}
                  disabled={batal.isPending}
                  title="Batalkan keranjang"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Batal
                </button>
              </div>
            )}
          </header>

          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {baris.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">Belum ada barang.</p>
            )}
            {baris.map((l) => (
              <article key={l.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.product_name}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {formatMoney(Number(l.unit_price), keranjang.data?.currency_code ?? 'IDR')}
                      {Number(l.discount_amount) > 0 && (
                        <span className="ms-1 text-emerald-600">
                          − {formatMoney(Number(l.discount_amount), keranjang.data?.currency_code ?? 'IDR')}
                        </span>
                      )}
                    </p>
                    {l.requires_approval && !l.approved_by && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Menunggu persetujuan supervisor
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
                      onClick={() =>
                        ubahJumlah.mutate({ lineId: l.id, quantity: Math.max(1, Number(l.quantity) - 1) })
                      }
                      disabled={ubahJumlah.isPending || Number(l.quantity) <= 1}
                      aria-label="Kurangi"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-medium tabular-nums">{Number(l.quantity)}</span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded border border-slate-300 text-lg leading-none dark:border-slate-700"
                      onClick={() => ubahJumlah.mutate({ lineId: l.id, quantity: Number(l.quantity) + 1 })}
                      disabled={ubahJumlah.isPending}
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
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="tabular-nums">
                  {formatMoney(Number(keranjang.data?.subtotal ?? 0), keranjang.data?.currency_code ?? 'IDR')}
                </dd>
              </div>
              {Number(keranjang.data?.discount_total ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <dt>Diskon</dt>
                  <dd className="tabular-nums">
                    − {formatMoney(Number(keranjang.data?.discount_total), keranjang.data?.currency_code ?? 'IDR')}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Pajak</dt>
                <dd className="tabular-nums">
                  {formatMoney(Number(keranjang.data?.tax_total ?? 0), keranjang.data?.currency_code ?? 'IDR')}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold dark:border-slate-800">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {formatMoney(Number(keranjang.data?.grand_total ?? 0), keranjang.data?.currency_code ?? 'IDR')}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              className="btn-primary mt-3 w-full justify-center py-3 text-base"
              disabled={!siapBayar}
              onClick={() => setBukaBayar(true)}
            >
              <Banknote className="h-5 w-5" aria-hidden />
              Bayar (F9)
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
            toast.push(`Transaksi selesai. Struk ${nomorStruk}.`, 'success');
            fokusPindai();
          }}
        />
      )}
    </div>
  );
}
