/**
 * Laboratorium: daftar kerja dan nilai kritis.
 *
 * Nilai kritis ditempatkan di ATAS daftar kerja, bukan di tab tersendiri.
 *
 * Tab tersendiri berarti seseorang harus memilih untuk melihatnya, dan
 * laboratorium yang sibuk tidak memilih untuk melihat apa pun — ia mengerjakan
 * apa yang ada di depan mata. Nilai kritis yang menunggu di balik satu klik
 * akan menunggu selama tidak ada yang mengklik, dan kalium 7,2 yang menunggu
 * satu jam bukan lagi nilai kritis; ia riwayat.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, AlertOctagon, PhoneCall, TestTube } from 'lucide-react';
import { EmptyState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import {
  healthApi,
  LABEL_PRIORITAS_LAB,
  RUPA_HASIL,
  type BarisKerjaLab,
  type NilaiKritis,
} from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

export function LabPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [bacaanUlang, setBacaanUlang] = useState<Record<string, string>>({});

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const kritis = useQuery({
    queryKey: ['health', 'lab-critical', facilityId],
    queryFn: () => healthApi.criticalPending(facilityId ?? undefined),
    enabled: Boolean(facilityId),
    // Lebih sering daripada daftar kerja. Yang ditunggu di sini bukan pekerjaan,
    // melainkan tenggat tiga puluh menit yang sedang berjalan.
    refetchInterval: 10_000,
  });

  const kerja = useQuery({
    queryKey: ['health', 'lab-worklist', facilityId],
    queryFn: () => healthApi.labWorklist(facilityId as string),
    enabled: Boolean(facilityId),
    refetchInterval: 20_000,
  });

  const sampaikan = useMutation({
    mutationFn: (n: NilaiKritis) =>
      healthApi.notifyCritical(n.id, { channel: 'PHONE', notifiedTo: n.patient_name }, ctx),
    onSuccess: () => {
      toast.push('Percobaan penyampaian tercatat. Menunggu penerimaan klinisi.', 'info');
      void queryClient.invalidateQueries({ queryKey: ['health', 'lab-critical'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const terima = useMutation({
    mutationFn: (n: NilaiKritis) =>
      healthApi.acknowledgeCritical(n.id, { readBackValue: bacaanUlang[n.id] ?? '' }, ctx),
    onSuccess: (_h, n) => {
      toast.push('Nilai kritis diterima dan tercatat.', 'success');
      setBacaanUlang((b) => ({ ...b, [n.id]: '' }));
      void queryClient.invalidateQueries({ queryKey: ['health', 'lab-critical'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  if (!ctx.purpose) return <PurposeSelector />;

  const tertunda = kritis.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratorium"
        description="Daftar kerja dan nilai kritis. Hasil yang tidak dibaca sama saja dengan pemeriksaan yang tidak pernah dilakukan."
      />

      {/* --- Nilai kritis, paling atas --- */}
      {tertunda.length ? (
        <section
          className="rounded-xl border-2 border-rose-500 bg-rose-50 p-5 dark:bg-rose-950/40"
          aria-label="Nilai kritis menunggu penerimaan"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-rose-900 dark:text-rose-100">
            <AlertOctagon className="h-5 w-5" aria-hidden />
            {tertunda.length} nilai kritis menunggu penerimaan klinisi
          </h2>
          <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
            Tenggatnya tiga puluh menit. Penerimaan menuntut bacaan ulang — klinisi mengulang
            angkanya, dan angkanya dicocokkan di peladen.
          </p>

          <ul className="mt-4 space-y-3">
            {tertunda.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-rose-300 bg-white p-4 dark:border-rose-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{n.patient_name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {n.test_name}:{' '}
                      <strong className="text-rose-700 dark:text-rose-300">
                        {n.value_numeric ?? n.value_text} {n.unit ?? ''}
                      </strong>{' '}
                      <span
                        className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          (RUPA_HASIL[n.flag] ?? RUPA_HASIL.UNKNOWN).kelas
                        }`}
                      >
                        {(RUPA_HASIL[n.flag] ?? RUPA_HASIL.UNKNOWN).label}
                      </span>
                    </p>
                    <p className="font-mono text-xs text-slate-500">{n.order_number}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                      n.delivery.state === 'OVERDUE'
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                    }`}
                  >
                    <AlarmClock className="h-3.5 w-3.5" aria-hidden />
                    {n.delivery.minutesElapsed} menit
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {n.delivery.message}
                </p>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    disabled={sampaikan.isPending}
                    onClick={() => sampaikan.mutate(n)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    <PhoneCall className="h-4 w-4" aria-hidden />
                    {n.notified_at ? 'Sampaikan lagi' : 'Catat penyampaian'}
                  </button>

                  <div className="flex items-end gap-2">
                    <label className="text-sm" htmlFor={`bacaan-${n.id}`}>
                      <span className="mb-1 block text-xs text-slate-500">
                        Bacaan ulang klinisi
                      </span>
                      <input
                        id={`bacaan-${n.id}`}
                        value={bacaanUlang[n.id] ?? ''}
                        onChange={(e) =>
                          setBacaanUlang((b) => ({ ...b, [n.id]: e.target.value }))
                        }
                        placeholder="ulangi angkanya"
                        className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={terima.isPending || !(bacaanUlang[n.id] ?? '').trim()}
                      onClick={() => terima.mutate(n)}
                      className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Catat penerimaan
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* --- Daftar kerja --- */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <TestTube className="h-4 w-4" aria-hidden />
          Daftar kerja
        </h2>

        {kerja.isLoading ? (
          <p className="text-sm text-slate-500">Memuat daftar kerja…</p>
        ) : !kerja.data?.length ? (
          <EmptyState
            title="Tidak ada pemeriksaan menunggu"
            description="Pesanan baru dari poliklinik akan muncul di sini dalam beberapa detik."
          />
        ) : (
          <ul className="space-y-2">
            {kerja.data.map((b) => (
              <BarisKerja key={b.id} baris={b} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BarisKerja({ baris }: { baris: BarisKerjaLab }) {
  return (
    <li
      className={`rounded-lg border p-3 ${
        baris.isCritical
          ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
          : baris.overdue
            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
            : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{baris.patient_name}</p>
          <p className="font-mono text-xs text-slate-500">{baris.order_number}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {baris.priority !== 'ROUTINE' ? (
            <span className="rounded bg-slate-900 px-1.5 py-0.5 font-medium text-white dark:bg-slate-100 dark:text-slate-900">
              {LABEL_PRIORITAS_LAB[baris.priority]}
            </span>
          ) : null}
          {baris.overdue ? (
            <span className="rounded bg-amber-200 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              Lewat tenggat
            </span>
          ) : null}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
            {baris.resulted_count}/{baris.item_count} selesai
          </span>
        </div>
      </div>
    </li>
  );
}

export default LabPage;
