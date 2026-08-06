/**
 * Batang konteks kasir: outlet, register, shift, dan kas.
 *
 * Selalu terlihat di atas layar karena ketiganya menentukan setiap transaksi
 * yang dibuat di bawahnya. Kasir yang tidak dapat melihat register mana yang
 * sedang dipakainya akan mengetahuinya dari struk yang salah cetak.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2, LockKeyhole, Store, Unlock } from 'lucide-react';
import { api, formatMoney } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { useToast } from '../../components/ui';
import type { KonteksPos } from './pos-types';

export function PosShiftBar({
  konteks,
  outletId,
  terminalId,
  shiftId,
  onPilihOutlet,
  onPilihTerminal,
  onShiftBerubah,
}: {
  konteks?: KonteksPos;
  outletId: string | null;
  terminalId: string | null;
  shiftId: string | null;
  onPilihOutlet: (id: string) => void;
  onPilihTerminal: (id: string) => void;
  onShiftBerubah: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const pesanGalat = useErrorMessage();
  const [kasAwal, setKasAwal] = useState<number>(0);
  const [kasAkhir, setKasAkhir] = useState<number>(0);
  const [bukaTutup, setBukaTutup] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [pecahan, setPecahan] = useState<Record<number, number>>({});

  const galat = (e: unknown) => toast.push(pesanGalat(e, (k, f) => t(k, f ?? k)), 'error');
  const mata = konteks?.currency ?? 'IDR';

  const bukaShift = useMutation({
    mutationFn: () =>
      api.post<{ shiftId: string; shiftNumber: string }>('/pos/shifts/open', {
        terminalId,
        openingCash: kasAwal,
      }),
    onSuccess: (h) => {
      toast.push(`Shift ${h.shiftNumber} dibuka.`, 'success');
      onShiftBerubah(h.shiftId);
    },
    onError: galat,
  });

  const tutupShift = useMutation({
    mutationFn: () =>
      api.post<{ expectedCash: string; countedCash: string; variance: string }>(
        `/pos/shifts/${shiftId}/close`,
        {
          countedCash: kasAkhir,
          note: catatan.trim() || undefined,
          denominations: Object.entries(pecahan).filter(([, qty]) => qty > 0).map(([value, qty]) => ({ value: Number(value), qty })),
        },
      ),
    onSuccess: (h) => {
      const selisih = Number(h.variance);
      toast.push(
        selisih === 0
          ? 'Shift ditutup, kas cocok.'
          : `Shift ditutup dengan selisih ${formatMoney(selisih, mata)}. Selisih ini tercatat dan perlu dijelaskan.`,
        selisih === 0 ? 'success' : 'info',
      );
      setBukaTutup(false);
      onShiftBerubah(null);
    },
    onError: galat,
  });

  const ringkasan = useQuery({
    queryKey: ['pos', 'shift', shiftId, 'cash-summary'],
    queryFn: () => api.get<{
      openingCash: string; cashSales: string; cashIn: string; cashOut: string;
      changeGiven: string; expectedCash: string;
    }>(`/pos/shifts/${shiftId}/cash-summary`),
    enabled: bukaTutup && Boolean(shiftId),
  });

  const ubahPecahan = (nilai: number, jumlah: number) => {
    const next = { ...pecahan, [nilai]: Math.max(0, jumlah) };
    setPecahan(next);
    setKasAkhir(Object.entries(next).reduce((total, [value, qty]) => total + Number(value) * qty, 0));
  };

  const shift = konteks?.openShift;
  const registerTerpakai = (konteks?.registers ?? []).filter(
    (r) => !outletId || r.outletId === outletId,
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <Store className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />

        <label className="sr-only" htmlFor="pos-outlet">
          Outlet
        </label>
        <select
          id="pos-outlet"
          className="field-input h-9 w-auto min-w-[10rem] py-1"
          value={outletId ?? ''}
          onChange={(e) => onPilihOutlet(e.target.value)}
          disabled={Boolean(shiftId)}
        >
          {(konteks?.outlets ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="pos-register">
          Register
        </label>
        <select
          id="pos-register"
          className="field-input h-9 w-auto min-w-[9rem] py-1"
          value={terminalId ?? ''}
          onChange={(e) => onPilihTerminal(e.target.value)}
          disabled={Boolean(shiftId)}
        >
          {registerTerpakai.map((r) => (
            <option key={r.terminalId} value={r.terminalId}>
              {r.name}
            </option>
          ))}
        </select>

        <div className="ms-auto flex items-center gap-2">
          {shift ? (
            <>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Shift <strong className="ltr-code">{shift.shiftNumber}</strong> · kas awal{' '}
                <span className="tabular-nums">{formatMoney(Number(shift.openingCash), mata)}</span>
              </span>
              <button
                type="button"
                className="btn-outline h-9 py-1 text-sm"
                onClick={() => setBukaTutup(true)}
              >
                <LockKeyhole className="h-4 w-4" aria-hidden />
                Tutup shift
              </button>
            </>
          ) : (
            <>
              <label className="sr-only" htmlFor="kas-awal">
                Kas awal
              </label>
              <input
                id="kas-awal"
                type="number"
                inputMode="numeric"
                min={0}
                value={kasAwal}
                onChange={(e) => setKasAwal(Number(e.target.value))}
                placeholder="Kas awal"
                className="field-input h-9 w-32 py-1 text-end tabular-nums"
              />
              <button
                type="button"
                className="btn-primary h-9 py-1 text-sm"
                disabled={!terminalId || bukaShift.isPending}
                onClick={() => bukaShift.mutate()}
              >
                {bukaShift.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Unlock className="h-4 w-4" aria-hidden />
                )}
                Buka shift
              </button>
            </>
          )}
        </div>
      </div>

      {bukaTutup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tutup shift"
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-bold">Tutup shift</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Hitung uang di laci, lalu masukkan jumlahnya. Kas yang diharapkan dihitung peladen
              dari kas awal, penjualan tunai, dan pergerakan kas — bukan dari angka ini.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Kas awal', ringkasan.data?.openingCash], ['Penjualan tunai', ringkasan.data?.cashSales],
                ['Kas masuk', ringkasan.data?.cashIn], ['Kas keluar', ringkasan.data?.cashOut],
                ['Kembalian', ringkasan.data?.changeGiven], ['Seharusnya', ringkasan.data?.expectedCash],
              ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[11px] uppercase text-slate-500">{label}</p><p className="mt-1 font-bold tabular-nums">{formatMoney(Number(value ?? 0), mata)}</p></div>)}
            </div>

            <h3 className="mt-5 font-bold">Hitung denominasi</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[100000, 50000, 20000, 10000, 5000, 2000, 1000].map((nilai) => (
                <label key={nilai} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                  <span className="font-semibold">{formatMoney(nilai, mata)}</span>
                  <input type="number" min={0} inputMode="numeric" className="field-input mt-2" value={pecahan[nilai] ?? 0} onChange={(e) => ubahPecahan(nilai, Number(e.target.value))} />
                </label>
              ))}
            </div>

            <label className="field-label mt-4" htmlFor="kas-akhir">
              Kas yang dihitung
            </label>
            <input
              id="kas-akhir"
              type="number"
              inputMode="numeric"
              min={0}
              value={kasAkhir}
              onChange={(e) => setKasAkhir(Number(e.target.value))}
              className="field-input text-end text-2xl tabular-nums"
              autoFocus
            />
            <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
              <span className="font-medium">Selisih sementara</span>
              <strong className={kasAkhir - Number(ringkasan.data?.expectedCash ?? 0) === 0 ? 'text-emerald-700' : 'text-amber-700'}>{formatMoney(kasAkhir - Number(ringkasan.data?.expectedCash ?? 0), mata)}</strong>
            </div>
            <label className="field-label mt-4" htmlFor="catatan-shift">Catatan rekonsiliasi / serah terima</label>
            <textarea id="catatan-shift" className="field-input min-h-20" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catat selisih, kendala printer, resep tertahan, atau informasi untuk petugas berikutnya." />
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Server akan menolak penutupan bila masih ada transaksi DRAFT, PAYMENT_PENDING, atau PAID yang belum diselesaikan.</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="btn-ghost flex-1 justify-center"
                onClick={() => setBukaTutup(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary flex-1 justify-center"
                disabled={tutupShift.isPending}
                onClick={() => tutupShift.mutate()}
              >
                {tutupShift.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Tutup shift
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
