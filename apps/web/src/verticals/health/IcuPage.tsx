import { useQuery } from '@tanstack/react-query';
import { Activity, HeartPulse, ShieldAlert, Wind } from 'lucide-react';
import { Code, EmptyState, PageHeader } from '../../components/ui';
import { healthApi, type BarisPapanIcu } from './health-api';
import { PurposeSelector } from './PurposeGate';

const RUPA_RISIKO: Record<string, string> = {
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  HIGH: 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100',
  CRITICAL: 'border-rose-400 bg-rose-50 text-rose-900 ring-1 ring-rose-300 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
};

export function IcuPage() {
  const fasilitas = useQuery({ queryKey: ['health', 'facilities'], queryFn: () => healthApi.facilities() });
  const facilityId = fasilitas.data?.[0]?.id ?? null;
  const papan = useQuery({
    queryKey: ['health', 'icu-board', facilityId],
    queryFn: () => healthApi.icuBoard(facilityId as string),
    enabled: Boolean(facilityId),
    refetchInterval: 20_000,
  });

  const rows = papan.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perawatan Intensif"
        description="Papan ICU untuk skor keparahan, dukungan organ, dan risiko pasien yang harus dibaca cepat."
        breadcrumbs={[{ label: 'eMedik' }, { label: 'ICU' }]}
        actions={<PurposeSelector />}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Ringkasan icon={ShieldAlert} label="Kritis" value={String(rows.filter((row) => row.risk_level === 'CRITICAL').length)} />
        <Ringkasan icon={Wind} label="Ventilator" value={String(rows.filter((row) => row.on_ventilator).length)} />
        <Ringkasan icon={HeartPulse} label="Vasopressor" value={String(rows.filter((row) => row.on_vasopressor).length)} />
      </section>
      {papan.isLoading ? (
        <p className="text-sm text-slate-500">Memuat papan ICU...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada pasien ICU aktif" description="Pasien intensif akan muncul bersama skor dan dukungan organ terakhir." />
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">{rows.map((row) => <IcuCard key={row.id} row={row} />)}</ul>
      )}
    </div>
  );
}

function IcuCard({ row }: { row: BarisPapanIcu }) {
  const risk = row.risk_level ?? 'BELUM DINILAI';
  const riskClass = row.risk_level ? RUPA_RISIKO[row.risk_level] : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  const supports = [
    ['Ventilator', row.on_ventilator],
    ['Vasopressor', row.on_vasopressor],
    ['Dialisis', row.on_dialysis],
  ].filter(([, active]) => active);

  return (
    <li className={`rounded-xl border p-4 ${riskClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase opacity-80">{risk}</p>
          <h2 className="mt-1 text-lg font-black">{row.patient_name}</h2>
          <p className="mt-1 text-sm opacity-80"><Code>{row.admission_number}</Code></p>
        </div>
        <div className="rounded-lg bg-white/70 px-3 py-2 text-right dark:bg-slate-950/40">
          <p className="text-xs opacity-70">Skor</p>
          <p className="text-2xl font-black tabular-nums">{row.severity_score ?? '-'}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 opacity-90">{row.admission_reason ?? 'Alasan masuk belum diisi.'}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {supports.length ? supports.map(([label]) => (
          <span key={String(label)} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold dark:bg-slate-950/50">{label}</span>
        )) : <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold dark:bg-slate-950/50">Tanpa dukungan organ aktif</span>}
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold dark:bg-slate-950/50">Organ support {row.organ_support ?? '-'}</span>
      </div>
      <p className="mt-4 text-xs opacity-70">Asesmen terakhir: {row.last_assessed_at ?? '-'}</p>
    </li>
  );
}

function Ringkasan({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <Icon className="h-5 w-5 text-brand-600" aria-hidden />
      <p className="mt-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

export default IcuPage;
