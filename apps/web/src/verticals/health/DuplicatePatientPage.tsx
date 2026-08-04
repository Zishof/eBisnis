import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitMerge, ShieldCheck, UserRoundX } from 'lucide-react';
import { Code, EmptyState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type DugaanGanda } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

export function DuplicatePatientPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<Record<string, string>>({});
  const daftar = useQuery({ queryKey: ['health', 'patient-duplicates'], queryFn: () => healthApi.duplicates(), refetchInterval: 60_000 });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['health', 'patient-duplicates'] });

  const bukanGanda = useMutation({
    mutationFn: (row: DugaanGanda) => healthApi.notDuplicate(row.id, reason[row.id]?.trim() || 'Telaah identitas menyatakan bukan pasien yang sama.', ctx),
    onSuccess: () => {
      toast.push('Dugaan ditutup sebagai bukan ganda.', 'success');
      refresh();
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const gabung = useMutation({
    mutationFn: ({ sourceId, targetId, row }: { sourceId: string; targetId: string; row: DugaanGanda }) =>
      healthApi.merge({ sourceId, targetId, reason: reason[row.id]?.trim() || `Penggabungan dari telaah dugaan ${row.id}.` }, ctx),
    onSuccess: (hasil) => {
      toast.push(`Rekam medis digabung. Ringkasan pindah: ${Object.keys(hasil.moved).length} jenis data.`, 'success');
      refresh();
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const rows = daftar.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pasien Ganda"
        description="Telaah dugaan rekam medis ganda sebelum alergi, resep, klaim, dan riwayat klinis terpecah."
        breadcrumbs={[{ label: 'eMedik' }, { label: 'Pasien Ganda' }]}
        actions={<PurposeSelector />}
      />
      {daftar.isLoading ? (
        <p className="text-sm text-slate-500">Memuat dugaan pasien ganda...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada dugaan terbuka" description="Dugaan dari pendaftaran atau impor pasien akan muncul di sini untuk ditelaah." />
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => (
            <li key={row.id} className="card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="grid flex-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
                  <PatientBox label="Pasien utama" id={row.patient_id} name={row.patient_name} birth={row.patient_birth} />
                  <div className="flex items-center justify-center"><div className="rounded-full bg-amber-100 px-3 py-2 text-center text-sm font-black text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">{row.match_score}%</div></div>
                  <PatientBox label="Kandidat" id={row.candidate_id} name={row.candidate_name} birth={row.candidate_birth} />
                </div>
                <div className="lg:w-80">
                  <label className="field-label" htmlFor={`reason-${row.id}`}>Catatan telaah</label>
                  <textarea id={`reason-${row.id}`} className="field-input min-h-24" value={reason[row.id] ?? ''} onChange={(event) => setReason((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Alasan merge atau alasan bukan ganda" />
                </div>
              </div>
              <MatchReason row={row} />
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => gabung.mutate({ sourceId: row.candidate_id, targetId: row.patient_id, row })} disabled={gabung.isPending || bukanGanda.isPending}><GitMerge className="h-4 w-4" aria-hidden />Gabung kandidat ke utama</button>
                <button type="button" className="btn-outline" onClick={() => gabung.mutate({ sourceId: row.patient_id, targetId: row.candidate_id, row })} disabled={gabung.isPending || bukanGanda.isPending}><GitMerge className="h-4 w-4" aria-hidden />Gabung utama ke kandidat</button>
                <button type="button" className="btn-outline border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40" onClick={() => bukanGanda.mutate(row)} disabled={gabung.isPending || bukanGanda.isPending}><UserRoundX className="h-4 w-4" aria-hidden />Bukan ganda</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PatientBox({ label, id, name, birth }: { label: string; id: string; name: string; birth: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
      <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <h2 className="mt-2 font-semibold text-slate-950 dark:text-white">{name}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Tanggal lahir: {birth ?? '-'}</p>
      <p className="mt-2 text-xs text-slate-500"><Code>{id}</Code></p>
    </div>
  );
}

function MatchReason({ row }: { row: DugaanGanda }) {
  const reasons = Array.isArray(row.match_reason) ? row.match_reason : [];
  if (!reasons.length) return null;
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />Alasan kecocokan</p>
      <div className="flex flex-wrap gap-2">
        {reasons.map((item, index) => <span key={`${item.field}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.field}: {item.detail}</span>)}
      </div>
    </div>
  );
}

export default DuplicatePatientPage;
