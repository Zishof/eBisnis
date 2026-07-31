/**
 * Keranjang kasir saat peladen tidak terjangkau.
 *
 * ## Mengapa keranjangnya terpisah dari keranjang biasa
 *
 * Keranjang daring hidup di peladen: setiap barang yang dipindai menjadi baris
 * pada `pos_sale`, dan angkanya selalu datang dari sana. Keranjang luring hidup
 * di memori peramban dan hanya berpindah ke buku besar lokal ketika transaksinya
 * selesai.
 *
 * Menyatukan keduanya dalam satu keadaan akan menghasilkan satu golongan cacat
 * yang sulit dilihat: baris luring yang tanpa sengaja terkirim ke jalur daring,
 * atau sebaliknya keranjang peladen yang diam-diam ditimpa angka hasil hitungan
 * peramban. Karena itu keduanya dipisah, dan hanya satu yang aktif pada satu saat.
 *
 * ## Yang sengaja tidak ada di sini
 *
 * Diskon manual dan penggantian harga **tidak tersedia saat luring**. Keduanya
 * menuntut persetujuan dan perhitungan kebijakan yang hanya ada di peladen;
 * menirunya di peramban berarti menulis aturan uang untuk kedua kalinya. Kasir
 * yang memerlukannya menunggu peladen kembali — dan layar mengatakannya.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Minus, Plus, Receipt, Trash2 } from 'lucide-react';
import { formatMoney } from '../lib/api';
import {
  hitungKembalian,
  hitungKeranjangLuring,
  type BarisLuring,
  type TarifLuring,
} from './harga-luring';
import type { MuatanTransaksi } from './ledger';
import type { MetodeLokal, SalinanKatalog } from './katalog-store';
import type { ProdukLokal } from './katalog';
import type { HasilBukuLokal } from './useBukuLokal';

/**
 * Satu peristiwa pindaian atau ketukan.
 *
 * Membawa `token` yang berubah setiap kali, bukan hanya produknya. Tanpa itu,
 * penanda "sudah ditambahkan" harus memakai `productId` — dan pindaian KEDUA
 * untuk barang yang sama akan diabaikan. Membeli dua barang yang sama adalah
 * kejadian paling biasa di kasir, dan kasir baru menyadarinya saat menghitung
 * ulang belanjaan di depan antrean.
 */
export interface Pindaian {
  produk: ProdukLokal;
  token: number;
}

export function PosLuringPanel({
  salinan,
  buku,
  pindaian,
  onSelesai,
}: {
  salinan: SalinanKatalog;
  buku: HasilBukuLokal;
  pindaian: Pindaian | null;
  onSelesai: (struk: { receiptNumber: string; grandTotal: string; change: string }) => void;
}) {
  const [baris, setBaris] = useState<BarisLuring[]>([]);
  const [bukaBayar, setBukaBayar] = useState(false);
  const [metodeId, setMetodeId] = useState<string>('');
  const [diserahkan, setDiserahkan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [terakhirDitambah, setTerakhirDitambah] = useState<number | null>(null);

  const tarif: TarifLuring[] = useMemo(
    () =>
      salinan.taxRates.map((t) => ({
        taxRateId: t.taxRateId,
        code: t.code,
        rate: t.rate,
        isInclusive: t.isInclusive,
      })),
    [salinan.taxRates],
  );

  /*
   * Ditambahkan lewat efek, bukan saat render.
   *
   * Menambah barang di dalam badan komponen berarti mengubah keadaan selama
   * penggambaran — yang pada mode ketat React dijalankan dua kali, sehingga
   * satu pindaian menjadi dua barang. Kasir tidak akan menghubungkan kelebihan
   * itu dengan apa pun; ia hanya akan melihat jumlahnya salah.
   */
  useEffect(() => {
    if (!pindaian || pindaian.token === terakhirDitambah) return;
    setTerakhirDitambah(pindaian.token);
    tambah(pindaian.produk);
    // `tambah` hanya memakai `setBaris` yang stabil, jadi tidak perlu ikut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pindaian, terakhirDitambah]);

  function tambah(p: ProdukLokal) {
    setBaris((lama) => {
      const ada = lama.findIndex((b) => b.productId === p.productId);
      if (ada >= 0) {
        const salin = [...lama];
        salin[ada] = { ...salin[ada], quantity: salin[ada].quantity + 1 };
        return salin;
      }
      return [
        ...lama,
        {
          productId: p.productId,
          name: p.name,
          uomId: p.uomId,
          quantity: 1,
          unitPrice: p.price ?? '0',
          taxRateId: null,
        },
      ];
    });
  }

  const total = useMemo(
    () => hitungKeranjangLuring(baris, tarif, salinan.currency),
    [baris, tarif, salinan.currency],
  );

  const metode: MetodeLokal[] = salinan.paymentMethods ?? [];
  const metodeDipakai = metode.find((m) => m.id === metodeId) ?? metode[0];
  const kembalian = hitungKembalian(total.grandTotal, diserahkan || '0', salinan.currency);

  const uang = (n: string) => formatMoney(Number(n), salinan.currency);

  async function selesaikan() {
    if (!metodeDipakai) return;
    setMenyimpan(true);
    try {
      const muatan: MuatanTransaksi = {
        lines: total.lines.map((l) => ({
          productId: l.productId,
          uomId: l.uomId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineSubtotal: l.lineSubtotal,
          taxAmount: l.taxAmount,
          lineTotal: l.lineTotal,
          taxRateId: l.taxRateId,
        })),
        payments: [
          {
            paymentMethodId: metodeDipakai.id,
            amount: total.grandTotal,
            tenderedAmount: metodeDipakai.allowsChange ? diserahkan || total.grandTotal : null,
            reference: null,
          },
        ],
        subtotal: total.subtotal,
        taxTotal: total.taxTotal,
        changeTotal: kembalian.change,
        currencyCode: salinan.currency,
        catalogSyncedAt: new Date(salinan.syncedAt).toISOString(),
      };

      /*
       * Dicatat DAHULU, baru strukya dianggap terbit.
       *
       * Struk yang tercetak untuk transaksi yang belum tersimpan adalah
       * transaksi yang hilang bila listrik padam sedetik kemudian — dan
       * pembelinya sudah membawa barangnya pulang.
       */
      const hasil = await buku.simpanTransaksi({
        grandTotal: total.grandTotal,
        itemCount: total.itemCount,
        payload: muatan,
      });
      if (!hasil) return;

      onSelesai({
        receiptNumber: hasil.receiptNumber,
        grandTotal: total.grandTotal,
        change: kembalian.change,
      });
      setBaris([]);
      setBukaBayar(false);
      setDiserahkan('');
      setTerakhirDitambah(null);
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-col rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900">
      <header className="mb-2 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-amber-600" aria-hidden />
        <h2 className="text-sm font-semibold">Keranjang luring</h2>
        <span className="ms-auto text-xs text-slate-500">
          Sisa jatah nomor: <strong className="tabular-nums">{buku.penilaianBlok.remaining}</strong>
        </span>
      </header>

      <p className="mb-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        Harga dari salinan katalog{' '}
        {new Date(salinan.syncedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}.
        Diskon dan promosi tidak dihitung selama luring.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {baris.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Pindai barcode atau ketuk produk untuk mulai.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {total.lines.map((l, i) => (
              <li key={l.productId} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {l.quantity} × {uang(l.unitPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Kurangi ${l.name}`}
                    className="btn-outline h-7 w-7 p-0"
                    onClick={() =>
                      setBaris((lama) =>
                        lama
                          .map((b, j) => (j === i ? { ...b, quantity: b.quantity - 1 } : b))
                          .filter((b) => b.quantity > 0),
                      )
                    }
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Tambah ${l.name}`}
                    className="btn-outline h-7 w-7 p-0"
                    onClick={() =>
                      setBaris((lama) =>
                        lama.map((b, j) => (j === i ? { ...b, quantity: b.quantity + 1 } : b)),
                      )
                    }
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${l.name}`}
                    className="btn-outline h-7 w-7 p-0"
                    onClick={() => setBaris((lama) => lama.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <span className="w-24 text-end text-sm font-semibold tabular-nums">
                  {uang(l.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{uang(total.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <dt>Pajak</dt>
            <dd className="tabular-nums">{uang(total.taxTotal)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{uang(total.grandTotal)}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="btn-primary mt-2 w-full"
          disabled={baris.length === 0 || !buku.bolehJualLuring}
          onClick={() => setBukaBayar(true)}
        >
          Bayar (luring)
        </button>

        {!buku.bolehJualLuring && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{buku.penilaianBlok.message}</span>
          </p>
        )}
      </footer>

      {bukaBayar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pembayaran luring"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <h3 className="mb-3 text-lg font-semibold">Pembayaran luring</h3>

            <p className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
              Total <strong className="tabular-nums">{uang(total.grandTotal)}</strong>
            </p>

            <label className="field-label" htmlFor="metode-luring">
              Metode
            </label>
            <select
              id="metode-luring"
              className="field-input mb-3"
              value={metodeDipakai?.id ?? ''}
              onChange={(e) => setMetodeId(e.target.value)}
            >
              {metode.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {metodeDipakai?.allowsChange && (
              <>
                <label className="field-label" htmlFor="uang-luring">
                  Uang diserahkan
                </label>
                <input
                  id="uang-luring"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="field-input mb-2 text-end tabular-nums"
                  value={diserahkan}
                  onChange={(e) => setDiserahkan(e.target.value)}
                  autoFocus
                />
                <p className="mb-3 text-sm">
                  {kembalian.cukup ? (
                    <>
                      Kembalian{' '}
                      <strong className="tabular-nums">{uang(kembalian.change)}</strong>
                    </>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-300">
                      Kurang <strong className="tabular-nums">{uang(kembalian.kurang)}</strong>
                    </span>
                  )}
                </p>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setBukaBayar(false)}>
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={menyimpan || !metodeDipakai || (metodeDipakai.allowsChange && !kembalian.cukup)}
                onClick={selesaikan}
              >
                {menyimpan && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Selesaikan
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
