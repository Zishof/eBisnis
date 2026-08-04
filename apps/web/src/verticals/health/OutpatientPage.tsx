import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Stethoscope } from 'lucide-react';
import { Code, EmptyState, PageHeader, StatusBadge, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisAntrean } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

export function OutpatientPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fasilitas = useQuery({ queryKey: ['health', 'facilities'], queryFn: () => healthApi.facilities() });
  const facilityId = fasilitas.data?.[0]?.id ?? null;
  const antrean = useQuery({
    queryKey: ['health', 'outpatient-queue', facilityId],
    queryFn: () => healthApi.queue(facilityId as string),
    enabled: Boolean(facilityId),
    refetchInterval: 20_000,
  });

  const mulai = useMutation({
    mutationFn: (row: BarisAntrean) => healthApi.startEncounter({ registrationId: row.registration_id }, ctx),
    onSuccess: (hasil) => {
      toast.push(`Kunjungan ${hasil.encounterNumber} dibuka.`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['health', 'outpatient-queue'] });
      navigate(`/app/emedik/kunjungan/${hasil.encounterId}`);
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const daftar = antrean.data?.queue ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rawat Jalan"
        description="Daftar pasien yang menunggu klinisi, dengan akses langsung ke ruang kerja kunjungan."
        breadcrumbs={[{ label: 'eMedik' }, { label: 'Rawat Jalan' }]}
        actions={<PurposeSelector />}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Ringkasan label="Menunggu" value={String(daftar.filter((r) => r.status === 'WAITING').length)} />
        <Ringkasan label="Sudah dipanggil" value={String(daftar.filter((r) => r.status === 'CALLED').length)} />
        <Ringkasan label="Tanggal layanan" value={antrean.data?.businessDate ?? '-'} />
      </section>
      {antrean.isLoading ? (
        <p className="text-sm text-slate-500">Memuat daftar rawat jalan...</p>
      ) : daftar.length === 0 ? (
        <EmptyState title="Belum ada pasien rawat jalan" description="Pasien dari pendaftaran akan muncul di sini begitu masuk antrean layanan." />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {daftar.map((row) => (
            <li key={row.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-2xl font-black tabular-nums text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
                {row.queue_label}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">{row.patient_name}</h2>
                  <StatusBadge status={row.status} tone={row.status === 'CALLED' ? 'info' : 'warning'} />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400"><Code>{row.registration_number}</Code></p>
                {row.priority > 0 ? (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    Prioritas {row.priority_reason ?? 'klinis'}
                  </p>
                ) : null}
              </div>
              <button type="button" className="btn-primary shrink-0" onClick={() => mulai.mutate(row)} disabled={mulai.isPending}>
                <Stethoscope className="h-4 w-4" aria-hidden />
                Buka kunjungan
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Ringkasan({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

export default OutpatientPage;
