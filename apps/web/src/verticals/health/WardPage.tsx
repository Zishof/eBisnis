/**
 * Papan bangsal dan tempat tidur.
 *
 * Yang paling penting di layar ini bukan siapa berbaring di mana — itu mudah
 * dilihat dari pintu kamar. Yang tidak dapat dilihat dari pintu kamar adalah
 * **siapa yang sudah lewat waktu pengamatannya**, dan itulah yang ditaruh
 * paling menonjol.
 *
 * Pengamatan yang terlambat pada pasien berisiko tinggi adalah cara paling
 * sering perburukan luput — bukan karena tidak ada yang peduli, melainkan
 * karena tidak ada yang mengingatkan.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, BedDouble, ShieldAlert, Sparkles } from 'lucide-react';
import { EmptyState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import {
  healthApi,
  LABEL_ISOLASI,
  RUPA_RISIKO,
  LABEL_STATUS_TEMPAT_TIDUR,
  type BarisPapanBangsal,
  type TempatTidurBaris,
} from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

export function WardPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const papan = useQuery({
    queryKey: ['health', 'ward-board', facilityId],
    queryFn: () => healthApi.wardBoard(facilityId as string),
    enabled: Boolean(facilityId),
    // Tenggat pengamatan berjalan terus; menyegarkannya berkala jauh lebih baik
    // daripada menuntut perawat menekan muat ulang.
    refetchInterval: 30_000,
  });

  const tempatTidur = useQuery({
    queryKey: ['health', 'beds', facilityId],
    queryFn: () => healthApi.beds(facilityId as string),
    enabled: Boolean(facilityId),
    refetchInterval: 60_000,
  });

  const bersihkan = useMutation({
    mutationFn: (b: TempatTidurBaris) => healthApi.setBedStatus(b.id, { status: 'AVAILABLE' }, ctx),
    onSuccess: (h) => {
      toast.push(`Tempat tidur ${h.code} dinyatakan bersih dan siap dipakai.`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['health', 'beds'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  if (!ctx.purpose) return <PurposeSelector />;

  const terlambat = (papan.data ?? []).filter((r) => r.observation.overdue);
  const kotor = (tempatTidur.data ?? []).filter((b) => b.status === 'CLEANING');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bangsal"
        description="Siapa di tempat tidur mana, dan siapa yang pengamatannya sudah lewat waktunya."
      />

      {/* --- Yang lewat waktu pengamatan, paling atas --- */}
      {terlambat.length ? (
        <section
          className="rounded-xl border-2 border-amber-500 bg-amber-50 p-5 dark:bg-amber-950/40"
          aria-label="Pengamatan yang sudah lewat waktunya"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-amber-900 dark:text-amber-100">
            <AlarmClock className="h-5 w-5" aria-hidden />
            {terlambat.length} pasien sudah lewat waktu pengamatannya
          </h2>
          <ul className="mt-3 space-y-2">
            {terlambat.map((r) => (
              <li
                key={r.admission_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-slate-900"
              >
                <span>
                  <strong>{r.patient_name}</strong>
                  {r.bed_code ? ` · ${r.room_name} ${r.bed_code}` : ''}
                </span>
                <span className="text-amber-800 dark:text-amber-200">
                  terlambat {r.observation.minutesLate} menit
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* --- Papan bangsal --- */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <BedDouble className="h-4 w-4" aria-hidden />
          Pasien yang sedang dirawat
        </h2>

        {papan.isLoading ? (
          <p className="text-sm text-slate-500">Memuat papan bangsal…</p>
        ) : !papan.data?.length ? (
          <EmptyState
            title="Tidak ada pasien rawat inap"
            description="Pasien yang diterima rawat inap akan muncul di sini beserta tempat tidurnya."
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {papan.data.map((r) => (
              <BarisPasien key={r.admission_id} baris={r} />
            ))}
          </ul>
        )}
      </section>

      {/* --- Tempat tidur menunggu pembersihan --- */}
      {kotor.length ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Sparkles className="h-4 w-4" aria-hidden />
            {kotor.length} tempat tidur menunggu pembersihan
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Tempat tidur yang baru ditinggalkan tidak dapat langsung ditempati orang lain. Ia
            menunggu sampai ada yang membersihkannya dan menyatakannya bersih.
          </p>
          <ul className="space-y-2">
            {kotor.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <span className="text-sm">
                  <strong>{b.code}</strong>{' '}
                  <span className="text-slate-500">· {b.room_name}</span>
                </span>
                <button
                  type="button"
                  disabled={bersihkan.isPending}
                  onClick={() => bersihkan.mutate(b)}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Nyatakan bersih
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function BarisPasien({ baris }: { baris: BarisPapanBangsal }) {
  const rupa = baris.risk_level ? RUPA_RISIKO[baris.risk_level] : null;

  return (
    <li
      className={`rounded-lg border p-3 ${
        baris.observation.overdue
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{baris.patient_name}</p>
          <p className="text-xs text-slate-500">
            {baris.room_name ?? 'tanpa kamar'} {baris.bed_code ?? ''}
          </p>
        </div>
        {rupa ? (
          <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${rupa.kelas}`}>
            {rupa.label}
            {baris.early_warning_score !== null ? ` ${baris.early_warning_score}` : ''}
          </span>
        ) : (
          <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] dark:bg-slate-800">
            belum diamati
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-mono text-slate-500">{baris.admission_number}</span>
        {baris.isolation_type !== 'NONE' ? (
          <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
            <ShieldAlert className="h-3 w-3" aria-hidden />
            {LABEL_ISOLASI[baris.isolation_type] ?? baris.isolation_type}
          </span>
        ) : null}
        {baris.observation.overdue ? (
          <span className="rounded bg-amber-200 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
            pengamatan terlambat {baris.observation.minutesLate} menit
          </span>
        ) : null}
      </div>
    </li>
  );
}

export default WardPage;

/** Dipakai layar penempatan tempat tidur. */
export { LABEL_STATUS_TEMPAT_TIDUR };
