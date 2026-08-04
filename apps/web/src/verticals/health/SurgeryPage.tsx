import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Circle, Scissors, ShieldCheck } from 'lucide-react';
import { Code, EmptyState, PageHeader, StatusBadge } from '../../components/ui';
import { healthApi, type BarisJadwalOperasi } from './health-api';
import { PurposeSelector } from './PurposeGate';

export function SurgeryPage() {
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const fasilitas = useQuery({ queryKey: ['health', 'facilities'], queryFn: () => healthApi.facilities() });
  const facilityId = fasilitas.data?.[0]?.id ?? null;
  const jadwal = useQuery({
    queryKey: ['health', 'surgery-schedule', facilityId, tanggal],
    queryFn: () => healthApi.surgerySchedule(facilityId as string, tanggal),
    enabled: Boolean(facilityId),
    refetchInterval: 30_000,
  });
  const checklist = useQuery({ queryKey: ['health', 'surgery-checklist-items'], queryFn: () => healthApi.checklistItems() });
  const rows = jadwal.data ?? [];
  const siapSite = rows.filter((r) => !r.requires_site_marking || r.marked_site).length;
  const insisi = rows.filter((r) => r.incision_at).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operasi"
        description="Jadwal kamar operasi dengan pagar keselamatan sebelum insisi dan sebelum pasien keluar kamar."
        breadcrumbs={[{ label: 'eMedik' }, { label: 'Operasi' }]}
        actions={<><PurposeSelector /><label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><CalendarDays className="h-4 w-4" aria-hidden /><input type="date" className="field-input w-auto py-1 text-sm" value={tanggal} onChange={(event) => setTanggal(event.target.value)} /></label></>}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Ringkasan label="Kasus terjadwal" value={String(rows.length)} />
        <Ringkasan label="Site siap" value={`${siapSite}/${rows.length}`} />
        <Ringkasan label="Sudah insisi" value={String(insisi)} />
      </section>
      {jadwal.isLoading ? <p className="text-sm text-slate-500">Memuat jadwal operasi...</p> : rows.length === 0 ? (
        <EmptyState title="Tidak ada operasi pada tanggal ini" description="Kasus yang dijadwalkan akan muncul bersama status site marking dan fase keselamatan." />
      ) : <ul className="grid gap-3">{rows.map((row) => <SurgeryCard key={row.id} row={row} />)}</ul>}
      {checklist.data ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden /><h2 className="font-semibold text-slate-900 dark:text-white">Checklist keselamatan</h2></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {Object.entries(checklist.data).map(([phase, items]) => (
              <div key={phase} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{phase.replace('_', ' ')}</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {items.slice(0, 4).map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /><span>{item}</span></li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SurgeryCard({ row }: { row: BarisJadwalOperasi }) {
  const steps = useMemo(() => [
    ['Site', !row.requires_site_marking || Boolean(row.marked_site)],
    ['Sign in', Boolean(row.sign_in_at)],
    ['Time out', Boolean(row.time_out_at)],
    ['Insisi', Boolean(row.incision_at)],
    ['Keluar OK', Boolean(row.left_theatre_at)],
  ], [row]);
  return (
    <li className="card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Code>{row.case_number}</Code><StatusBadge status={row.status} /><span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{row.urgency}</span></div>
          <h2 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{row.procedure_name}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.patient_name} - {row.theatre_name ?? 'Kamar belum ditentukan'}</p>
          <p className="mt-1 text-xs text-slate-500">{row.scheduled_start ?? '-'} sampai {row.scheduled_end ?? '-'}</p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-5 lg:min-w-[34rem]">
          {steps.map(([label, done]) => (
            <div key={String(label)} className={`rounded-lg border p-3 text-xs ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
              {done ? <CheckCircle2 className="mb-2 h-4 w-4" aria-hidden /> : <Circle className="mb-2 h-4 w-4" aria-hidden />}
              {label}
            </div>
          ))}
        </div>
      </div>
      {row.requires_site_marking && !row.marked_site ? <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><Scissors className="h-4 w-4" aria-hidden />Site marking wajib sebelum alur operasi dilanjutkan.</p> : null}
    </li>
  );
}

function Ringkasan({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p></div>;
}

export default SurgeryPage;
