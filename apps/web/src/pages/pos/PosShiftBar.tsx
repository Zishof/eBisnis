/**
 * Batang konteks kasir: outlet, register, shift, dan kas.
 *
 * Selalu terlihat di atas layar karena ketiganya menentukan setiap transaksi
 * yang dibuat di bawahnya. Kasir yang tidak dapat melihat register mana yang
 * sedang dipakainya akan mengetahuinya dari struk yang salah cetak.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
        { countedCash: kasAkhir },
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
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-bold">Tutup shift</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Hitung uang di laci, lalu masukkan jumlahnya. Kas yang diharapkan dihitung peladen
              dari kas awal, penjualan tunai, dan pergerakan kas — bukan dari angka ini.
            </p>
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
