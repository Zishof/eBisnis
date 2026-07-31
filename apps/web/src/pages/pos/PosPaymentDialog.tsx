/**
 * Dialog pembayaran.
 *
 * Satu-satunya modal pada layar kasir, dan memang seharusnya begitu: menerima
 * uang menuntut perhatian penuh, dan layar yang masih menerima pindaian barcode
 * saat kasir menghitung kembalian akan menghasilkan barang yang masuk ke
 * transaksi yang sudah dibayar.
 *
 * Dua hal yang dijaga di sini:
 *
 * 1. **Idempotency-Key dibuat sekali per percobaan**, bukan per klik. Klik ganda
 *    pada layar yang lambat mengirim dua permintaan dengan kunci yang sama, dan
 *    peladen mengenalinya sebagai satu.
 * 2. **Kembalian dihitung untuk ditampilkan, bukan untuk dikirim.** Angka yang
 *    dipakai peladen tetap angkanya sendiri; yang di sini hanya membantu kasir
 *    menyiapkan uang.
 */

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Banknote, Loader2, Printer, X } from 'lucide-react';
import { api, formatMoney } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { useToast } from '../../components/ui';
import type { MetodePembayaran } from './pos-types';

/** Pecahan yang biasa diserahkan pembeli, untuk tombol cepat. */
const PECAHAN = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

export function PosPaymentDialog({
  saleId,
  total,
  currencyCode,
  onTutup,
  onSelesai,
}: {
  saleId: string;
  total: number;
  currencyCode: string;
  onTutup: () => void;
  onSelesai: (nomorStruk: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const pesanGalat = useErrorMessage();

  const [metodeId, setMetodeId] = useState<string | null>(null);
  const [diserahkan, setDiserahkan] = useState<number>(total);
  const [rujukan, setRujukan] = useState('');
  const [sudahBayar, setSudahBayar] = useState(false);

  // Kunci idempotensi dibuat sekali saat dialog dibuka. Klik ganda karena layar
  // lambat karena itu mengirim kunci yang sama, dan peladen mengenalinya
  // sebagai satu pembayaran.
  const kunciBayar = useRef(`bayar-${saleId}-${Date.now()}`);
  const kunciSelesai = useRef(`selesai-${saleId}-${Date.now()}`);

  const galat = (e: unknown) => toast.push(pesanGalat(e, (k, f) => t(k, f ?? k)), 'error');

  const metode = useQuery({
    queryKey: ['pos', 'payment-methods'],
    queryFn: () => api.get<MetodePembayaran[]>('/pos/payment-methods'),
  });

  const terpilih = useMemo(
    () => (metode.data ?? []).find((m) => m.id === metodeId) ?? null,
    [metode.data, metodeId],
  );

  const kembalian = useMemo(() => {
    if (!terpilih?.allowsChange) return 0;
    return Math.max(0, diserahkan - total);
  }, [terpilih, diserahkan, total]);

  const bayar = useMutation({
    mutationFn: () =>
      api.post<{ paymentId: string; duplicate: boolean }>(
        `/pos/sales/${saleId}/payments`,
        {
          paymentMethodId: metodeId,
          amount: total,
          tenderedAmount: terpilih?.allowsChange ? diserahkan : total,
          reference: rujukan.trim() || undefined,
        },
        { headers: { 'Idempotency-Key': kunciBayar.current } },
      ),
    onSuccess: () => setSudahBayar(true),
    onError: galat,
  });

  const selesaikan = useMutation({
    mutationFn: () =>
      api.post<{ receiptNumber: string; duplicate: boolean }>(
        `/pos/sales/${saleId}/complete`,
        {},
        { headers: { 'Idempotency-Key': kunciSelesai.current } },
      ),
    onSuccess: (h) => onSelesai(h.receiptNumber),
    onError: galat,
  });

  const kurang = terpilih && !terpilih.allowsChange ? 0 : Math.max(0, total - diserahkan);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pembayaran"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Pembayaran</h2>
            <p className="mt-0.5 text-3xl font-bold tabular-nums text-brand-700 dark:text-brand-300">
              {formatMoney(total, currencyCode)}
            </p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {!sudahBayar && (
          <>
            <fieldset className="mt-4">
              <legend className="field-label">Metode pembayaran</legend>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(metode.data ?? []).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMetodeId(m.id);
                      setDiserahkan(m.allowsChange ? total : total);
                      setRujukan('');
                    }}
                    className={
                      m.id === metodeId
                        ? 'rounded-lg border-2 border-brand-600 bg-brand-50 p-3 text-sm font-medium dark:bg-brand-950/40'
                        : 'rounded-lg border border-slate-300 p-3 text-sm hover:border-brand-400 dark:border-slate-700'
                    }
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </fieldset>

            {terpilih?.allowsChange && (
              <div className="mt-4">
                <label className="field-label" htmlFor="diserahkan">
                  Uang diterima
                </label>
                <input
                  id="diserahkan"
                  type="number"
                  inputMode="numeric"
                  value={diserahkan}
                  min={0}
                  onChange={(e) => setDiserahkan(Number(e.target.value))}
                  className="field-input text-end text-2xl tabular-nums"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700"
                    onClick={() => setDiserahkan(total)}
                  >
                    Uang pas
                  </button>
                  {PECAHAN.filter((p) => p >= total).slice(0, 4).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs tabular-nums dark:border-slate-700"
                      onClick={() => setDiserahkan(p)}
                    >
                      {formatMoney(p, currencyCode)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-between rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                  <span className="font-medium">Kembalian</span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatMoney(kembalian, currencyCode)}
                  </span>
                </div>
                {kurang > 0 && (
                  <p className="mt-2 text-sm text-rose-600">
                    Kurang {formatMoney(kurang, currencyCode)}.
                  </p>
                )}
              </div>
            )}

            {terpilih?.requiresReference && (
              <div className="mt-4">
                <label className="field-label" htmlFor="rujukan">
                  Nomor rujukan dari mesin EDC *
                </label>
                <input
                  id="rujukan"
                  value={rujukan}
                  onChange={(e) => setRujukan(e.target.value)}
                  className="field-input"
                  placeholder="mis. nomor approval"
                />
                {/*
                  Yang diminta hanya nomor rujukan. Nomor kartu dan CVV tidak
                  pernah diketik di sini dan tidak pernah disimpan di mana pun.
                */}
                <p className="mt-1 text-xs text-slate-500">
                  Cukup nomor rujukan. Jangan mengetik nomor kartu pembeli.
                </p>
              </div>
            )}

            <button
              type="button"
              className="btn-primary mt-5 w-full justify-center py-3 text-base"
              disabled={
                !metodeId ||
                bayar.isPending ||
                kurang > 0 ||
                (terpilih?.requiresReference && !rujukan.trim())
              }
              onClick={() => bayar.mutate()}
            >
              {bayar.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Banknote className="h-5 w-5" aria-hidden />
              )}
              Terima pembayaran
            </button>
          </>
        )}

        {sudahBayar && (
          <div className="mt-5">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">
                Pembayaran diterima.
              </p>
              {kembalian > 0 && (
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                  Kembalian {formatMoney(kembalian, currencyCode)}
                </p>
              )}
              <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
                Tekan Selesaikan untuk memotong stok, membentuk jurnal, dan menerbitkan struk.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary mt-4 w-full justify-center py-3 text-base"
              disabled={selesaikan.isPending}
              onClick={() => selesaikan.mutate()}
            >
              {selesaikan.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Printer className="h-5 w-5" aria-hidden />
              )}
              Selesaikan dan cetak struk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
