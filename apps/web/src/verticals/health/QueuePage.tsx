/**
 * Pendaftaran kunjungan dan antrean.
 *
 * Layar ini dipakai petugas loket sepanjang hari, jadi yang diutamakan hal-hal
 * yang terasa saat itu: nomor antrean besar dan terbaca dari jauh, alasan
 * prioritas terlihat, dan tombol panggil tidak perlu dicari.
 *
 * Rekap penagihan ditampilkan di halaman yang sama dengan sengaja — petugas
 * yang melihat "12 dari 14 tertagih" akan bertanya soal dua sisanya hari itu
 * juga, bukan pada akhir bulan ketika tagihannya sudah terbit.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, ClipboardList, Receipt } from 'lucide-react';
import { Code, EmptyState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisAntrean } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

const LABEL_PRIORITAS: Record<string, string> = {
  EMERGENCY: 'Gawat darurat',
  INFANT: 'Bayi',
  PREGNANT: 'Ibu hamil',
  DISABILITY: 'Disabilitas',
  ELDERLY: 'Lanjut usia',
};

const LABEL_TIDAK_TERTAGIH: Record<string, string> = {
  SAMPLE_DATA: 'data contoh',
  TRAINING_TENANT: 'lingkungan pelatihan',
  TEST_PATIENT: 'pasien uji',
  CANCELLED_BEFORE_SERVICE: 'batal sebelum dilayani',
  DUPLICATE_CORRECTED: 'koreksi pendaftaran ganda',
};

export function QueuePage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dipanggil, setDipanggil] = useState<BarisAntrean | null>(null);

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const antrean = useQuery({
    queryKey: ['health', 'queue', facilityId],
    queryFn: () => healthApi.queue(facilityId as string),
    enabled: Boolean(facilityId),
    // Layar antrean dibaca terus-menerus; menyegarkannya berkala jauh lebih
    // baik daripada menuntut petugas menekan muat ulang.
    refetchInterval: 15_000,
  });

  const rekap = useQuery({
    queryKey: ['health', 'billing-daily', facilityId, antrean.data?.businessDate],
    queryFn: () => healthApi.dailyBilling(facilityId as string, antrean.data?.businessDate as string),
    enabled: Boolean(facilityId && antrean.data?.businessDate),
  });

  const panggil = useMutation({
    mutationFn: () => healthApi.callNext({ facilityId: facilityId as string }, ctx),
    onSuccess: (hasil) => {
      if (!hasil.called) {
        toast.push(hasil.message ?? 'Tidak ada pasien yang menunggu.', 'info');
        setDipanggil(null);
        return;
      }
      setDipanggil(hasil.called);
      void queryClient.invalidateQueries({ queryKey: ['health', 'queue'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const daftar = antrean.data?.queue ?? [];

  return (
    <>
      <PageHeader
        title="Pendaftaran dan Antrean"
        description="Antrean yang sedang menunggu pada fasilitas ini."
        breadcrumbs={[{ label: 'eMedik' }, { label: 'Antrean' }]}
        actions={
          <>
            <PurposeSelector />
            <button
              type="button"
              className="btn-primary"
              onClick={() => panggil.mutate()}
              disabled={!facilityId || panggil.isPending || daftar.length === 0}
            >
              <BellRing className="h-4 w-4" aria-hidden />
              Panggil berikutnya
            </button>
          </>
        }
      />

      {/* --- Yang sedang dipanggil ---------------------------------------- */}
      {dipanggil && (
        <div className="mb-5 rounded-xl border-2 border-brand-500 bg-brand-50 p-6 text-center dark:border-brand-700 dark:bg-brand-950/40">
          <p className="text-sm uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Sedang dipanggil
          </p>
          <p className="mt-1 text-5xl font-bold tabular-nums text-brand-800 dark:text-brand-200">
            {dipanggil.queue_label}
          </p>
          <p className="mt-2 text-lg text-slate-800 dark:text-slate-100">{dipanggil.patient_name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <Code>{dipanggil.registration_number}</Code>
          </p>
        </div>
      )}

      {/* --- Rekap penagihan hari ini -------------------------------------- */}
      {rekap.data && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <Receipt className="h-5 w-5 text-slate-500" aria-hidden />
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <strong className="tabular-nums">{rekap.data.billable}</strong> dari{' '}
            <strong className="tabular-nums">{rekap.data.total}</strong> pendaftaran hari ini
            tertagih.
          </p>
          {Object.keys(rekap.data.excludedByReason).length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tidak tertagih:{' '}
              {Object.entries(rekap.data.excludedByReason)
                .map(([sebab, n]) => `${n} ${LABEL_TIDAK_TERTAGIH[sebab] ?? sebab}`)
                .join(', ')}
              .
            </p>
          )}
        </div>
      )}

      {/* --- Antrean ------------------------------------------------------- */}
      {antrean.isLoading && <p className="text-sm text-slate-500">Memuat antrean…</p>}

      {antrean.data && daftar.length === 0 && (
        <EmptyState
          title="Tidak ada yang menunggu"
          description="Antrean kosong. Pasien yang baru didaftarkan akan muncul di sini."
        />
      )}

      {daftar.length > 0 && (
        <ol className="space-y-2">
          {daftar.map((b, i) => (
            <li
              key={b.id}
              className={
                i === 0
                  ? 'card flex items-center gap-4 border-2 border-brand-400 p-4'
                  : 'card flex items-center gap-4 p-4'
              }
            >
              <span className="w-24 shrink-0 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {b.queue_label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900 dark:text-white">
                  {b.patient_name}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  <Code>{b.registration_number}</Code>
                </span>
              </span>
              {b.priority > 0 && (
                <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  {LABEL_PRIORITAS[b.priority_reason ?? ''] ?? 'Prioritas'}
                </span>
              )}
              {b.status === 'CALLED' && (
                <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                  Sudah dipanggil
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Prioritas mendahului nomor, tetapi tidak menghapus urutan di dalam prioritas yang sama —
        lanjut usia yang datang belakangan tetap menunggu lanjut usia yang datang lebih dahulu.
        Yang sudah dipanggil didahulukan atas yang belum.
      </p>
    </>
  );
}
