/**
 * Papan gawat darurat.
 *
 * Satu hal menentukan seluruh bentuk layar ini: **ia dibaca dari seberang
 * ruangan.** Perawat yang berdiri di tengah IGD ramai tidak membaca tabel; ia
 * memindai warna. Karena itu tingkat triase menjadi blok warna besar di sisi
 * kiri, dan pasien yang sudah lewat batas tunggunya diberi bingkai yang berbeda
 * — bukan tulisan kecil di kolom kelima.
 *
 * Dan satu hal yang sengaja ditampilkan meski tidak nyaman: **tingkat yang
 * diusulkan petugas ketika berbeda dari tingkat akhir.** Selisih itu adalah
 * data mutu IGD yang paling berharga, dan menyembunyikannya di basis data
 * berarti tidak ada yang pernah melihatnya.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, ArrowUpCircle, Stethoscope } from 'lucide-react';
import { EmptyState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, RUPA_TRIASE, type BarisPapanIgd } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

export function EmergencyPage() {
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
    queryKey: ['health', 'ed-board', facilityId],
    queryFn: () => healthApi.edBoard(facilityId as string),
    enabled: Boolean(facilityId),
    // Batas tunggu pasien tingkat 2 hanya sepuluh menit. Menyegarkan tiap menit
    // masih terlalu jarang, tetapi lebih sering akan membuat layar berkedip
    // sementara orang sedang membacanya.
    refetchInterval: 20_000,
  });

  const tandaiDilihat = useMutation({
    mutationFn: (b: BarisPapanIgd) => healthApi.markSeen(b.id, ctx),
    onSuccess: () => {
      toast.push('Tercatat sudah dilihat dokter.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['health', 'ed-board'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  if (!ctx.purpose) return <PurposeSelector />;

  const daftar = papan.data ?? [];
  const terlambat = daftar.filter((r) => r.wait.overdue);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gawat Darurat"
        description="Diurutkan tingkat triase, lalu lama menunggu. Bukan urutan kedatangan."
      />

      {terlambat.length ? (
        <p className="flex items-center gap-2 rounded-lg border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          <AlarmClock className="h-5 w-5 shrink-0" aria-hidden />
          {terlambat.length} pasien sudah melewati batas waktu triasenya.
        </p>
      ) : null}

      {papan.isLoading ? (
        <p className="text-sm text-slate-500">Memuat papan…</p>
      ) : !daftar.length ? (
        <EmptyState
          title="Tidak ada pasien di gawat darurat"
          description="Pasien yang ditriase akan langsung muncul di sini, tanpa perlu dimuat ulang."
        />
      ) : (
        <ul className="space-y-2">
          {daftar.map((r) => (
            <BarisPasien key={r.id} baris={r} onDilihat={() => tandaiDilihat.mutate(r)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BarisPasien({ baris, onDilihat }: { baris: BarisPapanIgd; onDilihat: () => void }) {
  const rupa = RUPA_TRIASE[baris.triage_level] ?? RUPA_TRIASE[5];
  const dinaikkan =
    baris.requested_level !== null && baris.requested_level !== baris.triage_level;

  return (
    <li
      className={`flex overflow-hidden rounded-lg border ${
        baris.wait.overdue
          ? 'border-rose-500 ring-1 ring-rose-400'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* Blok warna besar — dibaca dari seberang ruangan. */}
      <div
        className={`flex w-16 shrink-0 flex-col items-center justify-center ${rupa.kelas}`}
        aria-label={`Tingkat triase ${baris.triage_level}, ${rupa.label}`}
      >
        <span className="text-2xl font-bold leading-none">{baris.triage_level}</span>
        <span className="mt-0.5 text-[10px] leading-tight opacity-90">{rupa.label}</span>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {baris.patient_name ?? 'Pasien belum teridentifikasi'}
          </p>
          <p className="truncate text-sm text-slate-600 dark:text-slate-300">
            {baris.chief_complaint ?? '—'}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">{baris.visit_number}</span>
            <span>menunggu {baris.wait.waitedMinutes} menit</span>
            {baris.wait.overdue ? (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                lewat {baris.wait.lateMinutes} menit
              </span>
            ) : (
              <span>batas {baris.max_wait_minutes} menit</span>
            )}
          </p>

          {/*
           * Kenaikan tingkat ditampilkan, bukan disembunyikan. Petugas yang
           * melihat bahwa penilaiannya dinaikkan sistem akan menilai lebih
           * cermat lain kali; petugas yang tidak pernah melihatnya tidak akan.
           */}
          {dinaikkan ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <ArrowUpCircle className="h-3.5 w-3.5" aria-hidden />
              dinilai tingkat {baris.requested_level}, dinaikkan karena{' '}
              {(baris.triage_red_flags ?? []).join('; ')}
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
          {baris.seen_by_doctor_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              <Stethoscope className="h-3.5 w-3.5" aria-hidden />
              sudah dilihat dokter
            </span>
          ) : (
            <button
              type="button"
              onClick={onDilihat}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              <Stethoscope className="h-4 w-4" aria-hidden />
              Tandai sudah dilihat
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default EmergencyPage;
