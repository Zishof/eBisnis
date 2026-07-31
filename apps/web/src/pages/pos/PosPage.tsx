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
import { useAuth, useErrorMessage } from '../../app/auth-context';
import { LoadingState, useToast } from '../../components/ui';
import { PosShiftBar } from './PosShiftBar';
import { PosPaymentDialog } from './PosPaymentDialog';
import { PosStatusLuring } from '../../pos-offline/PosStatusLuring';
import { useKatalogLuring } from '../../pos-offline/useKatalogLuring';
import { useKoneksi } from '../../pos-offline/useKoneksi';
import { useServiceWorker } from '../../pos-offline/useServiceWorker';
import { useBukuLokal } from '../../pos-offline/useBukuLokal';
import { PosLuringPanel, type Pindaian } from '../../pos-offline/PosLuringPanel';
import type { KeranjangPos, KonteksPos, ProdukPos } from './pos-types';

/**
 * Medan yang dibutuhkan satu ubin produk.
 *
 * Dipakai supaya hasil dari peladen dan hasil dari salinan lokal dapat mengisi
 * kisi yang sama tanpa salah satunya dipaksa menyerupai yang lain — keduanya
 * memang membawa medan yang berbeda, dan menyamakannya hanya akan menyembunyikan
 * perbedaan yang justru penting (salinan lokal tidak tahu sisa stok).
 */
type UbinProduk = Pick<ProdukPos, 'productId' | 'name' | 'sku' | 'price' | 'currencyCode'>;

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
  /** Peristiwa pindaian untuk keranjang luring; token berubah tiap kali. */
  const [pindaian, setPindaian] = useState<Pindaian | null>(null);

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

  // --- Luring --------------------------------------------------------------
  const { user } = useAuth();
  const koneksi = useKoneksi();
  const daring = koneksi.state === 'DARING';
  const katalog = useKatalogLuring({
    tenantId: user?.tenant?.tenantId ?? null,
    daring,
    aktif: true,
  });
  const buku = useBukuLokal({
    konteks:
      outletId && terminalId && shiftId && konteks.data
        ? {
            outletId,
            terminalId,
            shiftId,
            businessDate: konteks.data.businessDate,
          }
        : null,
    daring,
    diizinkan: katalog.salinan?.offlineSaleEnabled === true,
  });

  const pakaiLokal = !daring && Boolean(katalog.salinan) && katalog.siap;

  /*
   * Menjual saat luring: hanya bila tenant mengizinkannya DAN register ini
   * memegang jatah nomor struk yang masih ada isinya. Keduanya harus benar —
   * izin tanpa jatah berarti struk tanpa nomor, dan jatah tanpa izin berarti
   * kebijakan usahanya belum disepakati.
   */
  const jualLuring = pakaiLokal && buku.bolehJualLuring;

  const sw = useServiceWorker({
    keranjangTerbuka: Boolean(saleId),
    // Antrean yang belum terkirim menunda pembaruan aplikasi: yang tahu cara
    // membaca antrean itu adalah versi yang menulisnya.
    antreanBelumTerkirim: buku.pending,
  });

  // Outlet dan register dipilih otomatis bila hanya ada satu. Kasir yang setiap
  // pagi memilih dari daftar berisi satu pilihan hanya diperlambat.
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
      /*
       * Pesan peladen ditampilkan apa adanya, bukan terjemahan umum dari kode
       * galatnya.
       *
       * `useErrorMessage` mendahulukan terjemahan `error.NOT_FOUND`, yang
       * berbunyi "Data tidak ditemukan." Bagi kasir yang barusan memindai,
       * kalimat itu tidak memberitahu apa pun — sedangkan peladen sudah
       * mengirim "Barcode 899… tidak dikenali. Cari produk menurut namanya,
       * atau daftarkan barcode ini pada master produk," yang menyebutkan apa
       * yang harus dilakukan berikutnya.
       */
      const pesan = (e as { message?: string })?.message;
      toast.push(pesan || pesanGalat(e, (k, f) => t(k, f ?? k)), 'error');
      setPindai('');
      fokusPindai();
    },
  });

  /**
   * Pindaian saat peladen tidak menjawab.
   *
   * Tidak mencoba mengirim permintaan yang sudah pasti gagal. Kasir mendapat
   * nama dan harga barangnya dari salinan lokal — itu yang sebenarnya sering
   * ditanyakan pembeli — beserta kalimat yang menyebutkan bahwa barangnya belum
   * masuk keranjang, supaya tidak ada yang mengira transaksinya sudah tercatat.
   */
  const pindaiLokal = useCallback(
    (kode: string) => {
      const p = katalog.barcodeLokal(kode);
      if (p) {
        if (jualLuring) {
          // Penjualan luring aktif: barangnya benar-benar masuk keranjang luring.
          setPindaian({ produk: p, token: Date.now() + Math.random() });
          setPindai('');
          fokusPindai();
          return;
        }
        toast.push(
          `${p.name} — ${formatMoney(Number(p.price ?? 0), p.currencyCode ?? 'IDR')}. ` +
            'Peladen belum menjawab, jadi barang ini BELUM masuk keranjang.',
          'info',
        );
      } else {
        toast.push(
          `Barcode ${kode} tidak ada pada salinan di mesin ini. Bisa jadi barangnya ada di ` +
            'peladen tetapi belum tersalin; coba lagi setelah peladen menjawab.',
          'error',
        );
      }
      setPindai('');
      fokusPindai();
    },
    [katalog, toast, fokusPindai, jualLuring],
  );

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

  /*
   * Salinan lokal dipakai **hanya** ketika peladen tidak menjawab. Selama
   * daring, peladen tetap satu-satunya sumber: harga yang terlihat kasir harus
   * harga yang berlaku, bukan harga yang kebetulan tersalin pagi tadi.
   *
   * Salinan yang sudah melewati batas umurnya tidak dipakai sama sekali. Lebih
   * baik layar mengatakan katalognya basi daripada menampilkan angka yang tidak
   * dapat dipertanggungjawabkan — angka yang salah tidak menimbulkan galat apa
   * pun, dan itulah yang membuatnya berbahaya.
   */

  /*
   * Katalog boleh dicari tanpa keranjang terbuka ketika salinan lokal yang
   * dipakai.
   *
   * Semula seluruh area katalog terkunci di balik keranjang, dan itu masuk akal
   * selama segalanya menuntut peladen. Dengan salinan lokal ia tidak lagi masuk
   * akal — dan akibatnya justru terbalik: ketika peladen mati, keranjang tidak
   * dapat dibuka, sehingga kasir bahkan tidak dapat menjawab "berapa harga ini?"
   * padahal jawabannya ada di mesin di depannya. Pertanyaan itulah yang paling
   * sering datang justru saat sistemnya sedang bermasalah.
   */
  const bolehCari = Boolean(saleId) || pakaiLokal;
  const adaKunci = kataKunci.trim().length >= 2;
  const daftarProduk: UbinProduk[] | undefined = pakaiLokal
    ? adaKunci
      ? katalog.cariLokal(kataKunci)
      : (katalog.salinan?.produk ?? []).slice(0, 18)
    : adaKunci
      ? cari.data
      : favorit.data;
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

      <div className="border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <PosStatusLuring koneksi={koneksi} katalog={katalog} sw={sw} buku={buku} />
      </div>

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
                  if (e.key !== 'Enter' || !pindai.trim()) return;
                  e.preventDefault();
                  if (pakaiLokal) pindaiLokal(pindai.trim());
                  else if (saleId) denganBarcode.mutate(pindai.trim());
                }}
                placeholder="Pindai barcode di sini (F2)"
                autoFocus
                disabled={!bolehCari}
                className="field-input w-full ps-9 text-lg"
                aria-label="Kotak pindai barcode"
              />
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>
            <input
              value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
              placeholder="Cari nama atau SKU"
              disabled={!bolehCari}
              className="field-input w-56"
              aria-label="Cari produk"
            />
          </div>

          {!saleId && !pakaiLokal && (
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

          {pakaiLokal && (
            /*
              Disebutkan terang-terangan dari mana daftar ini berasal, dan apa
              yang boleh dilakukan dengannya. Kasir yang mengetuk ubin lalu tidak
              terjadi apa-apa akan mengira layarnya rusak; kalimat ini mendahului
              kebingungan itu.
            */
            <p className="mt-3 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Daftar ini dari salinan di mesin ini.{' '}
              {jualLuring
                ? 'Penjualan luring aktif — barang masuk ke keranjang luring di sebelah kanan.'
                : saleId
                  ? 'Memasukkannya ke keranjang masih memerlukan peladen.'
                  : 'Keranjang baru belum dapat dibuka selama peladen tidak menjawab.'}
            </p>
          )}

          {!daring && !pakaiLokal && (
            <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Peladen tidak menjawab dan salinan katalog di mesin ini belum dapat dipakai.
              Lihat keterangannya pada batang status di atas.
            </p>
          )}

          {bolehCari && (
            <div className="mt-3 grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
              {(daftarProduk ?? []).map((p) => (
                <button
                  key={p.productId}
                  type="button"
                  onClick={() => {
                    if (jualLuring) {
                      const lokal = (katalog.salinan?.produk ?? []).find(
                        (x) => x.productId === p.productId,
                      );
                      if (lokal) setPindaian({ produk: lokal, token: Date.now() + Math.random() });
                      return;
                    }
                    tambah.mutate({ productId: p.productId, quantity: 1 });
                  }}
                  disabled={tambah.isPending || (pakaiLokal && !jualLuring)}
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

        {/*
          --- Keranjang ------------------------------------------------------

          Saat penjualan luring aktif, keranjang peladen digantikan seluruhnya
          oleh keranjang luring — bukan ditampilkan berdampingan. Dua keranjang
          yang terlihat bersamaan akan membuat kasir memasukkan barang ke yang
          salah, dan salahnya baru ketahuan saat menagih.
        */}
        {jualLuring && katalog.salinan ? (
          <PosLuringPanel
            salinan={katalog.salinan}
            buku={buku}
            pindaian={pindaian}
            onSelesai={(struk) => {
              toast.push(
                `Struk ${struk.receiptNumber} tercatat di mesin ini. Kembalian ` +
                  `${formatMoney(Number(struk.change), katalog.salinan?.currency ?? 'IDR')}. ` +
                  'Akan dikirim ke peladen otomatis begitu tersambung.',
                'success',
              );
              setPindaian(null);
              fokusPindai();
            }}
          />
        ) : (
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
        )}
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
