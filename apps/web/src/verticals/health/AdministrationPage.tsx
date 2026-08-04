/**
 * eMAR: daftar kerja pemberian obat.
 *
 * Rujukan desainnya sederhana: enam benar harus terlihat sebagai langkah kerja,
 * bukan paragraf edukasi. Keterlambatan dan obat risiko tinggi tampil di daftar
 * karena perawat sering memindai layar sambil berdiri, bukan membaca dokumen.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Pill,
  ScanLine,
  ShieldCheck,
  SkipForward,
  Syringe,
} from 'lucide-react';
import { clsx } from 'clsx';
import { EmptyState, LoadingState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import {
  healthApi,
  LABEL_GOLONGAN_OBAT,
  umurDari,
  type BarisPemberianObat,
} from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Terjadwal',
  ADMINISTERED: 'Diberikan',
  OMITTED: 'Dilewati',
  REFUSED: 'Ditolak pasien',
  HELD: 'Ditahan',
  CANCELLED: 'Dibatalkan',
};

const SKIP_REASONS = [
  'Pasien menolak',
  'Pasien puasa/prosedur',
  'Obat tidak tersedia',
  'Instruksi dokter ditahan',
  'Kondisi pasien berubah',
];

function waktu(value: string | null): string {
  if (!value) return 'Tanpa jadwal';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function selisihMenit(minutes: number | null): string {
  if (minutes === null) return 'belum terjadwal';
  if (minutes === 0) return 'sekarang';
  if (minutes > 0) return `${minutes} menit lewat`;
  return `${Math.abs(minutes)} menit lagi`;
}

export function AdministrationPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [scanPatientId, setScanPatientId] = useState('');
  const [scanDrugId, setScanDrugId] = useState('');
  const [doseValue, setDoseValue] = useState('');
  const [route, setRoute] = useState('');
  const [witnessedBy, setWitnessedBy] = useState('');
  const [wastedAmount, setWastedAmount] = useState('');
  const [note, setNote] = useState('');
  const [skipStatus, setSkipStatus] = useState<'OMITTED' | 'REFUSED' | 'HELD'>('OMITTED');
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0]);
  const [skipNote, setSkipNote] = useState('');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const daftar = useQuery({
    queryKey: ['health', 'administrations', facilityId],
    queryFn: () => healthApi.administrationQueue(facilityId as string),
    enabled: Boolean(facilityId),
    refetchInterval: 20_000,
  });

  const aktif = useMemo(
    () => daftar.data?.find((item) => item.id === dipilih) ?? daftar.data?.[0] ?? null,
    [daftar.data, dipilih],
  );

  const ringkas = useMemo(() => {
    const rows = daftar.data ?? [];
    return {
      total: rows.length,
      overdue: rows.filter((r) => r.overdue).length,
      highAlert: rows.filter((r) => r.is_high_alert).length,
      held: rows.filter((r) => r.status === 'HELD').length,
    };
  }, [daftar.data]);

  const resetForm = (row?: BarisPemberianObat | null) => {
    setScanPatientId(row?.patient_id ?? '');
    setScanDrugId(row?.drug_id ?? '');
    setDoseValue(row ? String(row.dose_value) : '');
    setRoute(row?.route ?? '');
    setWitnessedBy('');
    setWastedAmount('');
    setNote('');
    setSkipStatus('OMITTED');
    setSkipReason(SKIP_REASONS[0]);
    setSkipNote('');
  };

  const pilih = (row: BarisPemberianObat) => {
    setDipilih(row.id);
    resetForm(row);
  };

  const berikan = useMutation({
    mutationFn: () =>
      healthApi.administer(
        {
          administrationId: aktif?.id,
          scanPatientId: scanPatientId || undefined,
          scanDrugId: scanDrugId || undefined,
          doseValue: Number(doseValue),
          route,
          witnessedBy: witnessedBy || undefined,
          wastedAmount: wastedAmount ? Number(wastedAmount) : undefined,
          note: note || undefined,
        },
        ctx,
      ),
    onSuccess: () => {
      toast.push('Pemberian obat tercatat.', 'success');
      setDipilih(null);
      resetForm(null);
      void queryClient.invalidateQueries({ queryKey: ['health', 'administrations'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const lewati = useMutation({
    mutationFn: () =>
      healthApi.skipAdministration(
        {
          administrationId: aktif?.id ?? '',
          status: skipStatus,
          reason: skipReason,
          note: skipNote || undefined,
        },
        ctx,
      ),
    onSuccess: () => {
      toast.push('Keputusan tidak memberikan obat tercatat.', 'info');
      setDipilih(null);
      resetForm(null);
      void queryClient.invalidateQueries({ queryKey: ['health', 'administrations'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  if (!ctx.purpose) return <PurposeSelector />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pemberian Obat"
        description="eMAR untuk mencatat enam benar: pasien, obat, dosis, rute, waktu, dan dokumentasi."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Ringkasan label="Menunggu keputusan" value={ringkas.total} icon={Pill} />
        <Ringkasan label="Lewat jadwal" value={ringkas.overdue} icon={Clock} danger={ringkas.overdue > 0} />
        <Ringkasan label="High-alert" value={ringkas.highAlert} icon={AlertTriangle} warning={ringkas.highAlert > 0} />
        <Ringkasan label="Sedang ditahan" value={ringkas.held} icon={ShieldCheck} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,30rem)_1fr]">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Jadwal yang perlu tindakan
            </h2>
            <p className="text-xs text-slate-500">Diurutkan: terlambat, high-alert, terkendali.</p>
          </div>

          {daftar.isLoading ? (
            <LoadingState label="Memuat daftar eMAR..." />
          ) : !daftar.data?.length ? (
            <EmptyState
              title="Tidak ada pemberian obat menunggu"
              description="Jadwal baru akan tampil setelah resep menghasilkan jadwal pemberian."
            />
          ) : (
            <ul className="space-y-2">
              {daftar.data.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => pilih(row)}
                    className={clsx(
                      'w-full rounded-lg border p-4 text-left transition',
                      aktif?.id === row.id
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950 dark:text-white">{row.patient_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.medical_record_number ?? 'tanpa MRN'} · {umurDari(row.birth_date)}
                        </p>
                      </div>
                      <span
                        className={clsx(
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          row.overdue
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
                        )}
                      >
                        {row.overdue ? 'Lewat jadwal' : STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </div>
                    <p className="mt-3 font-medium text-slate-900 dark:text-slate-100">
                      {row.generic_name}
                      {row.brand_name ? <span className="font-normal text-slate-500"> ({row.brand_name})</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {row.dose_value} {row.dose_unit} · {row.route} · {row.frequency_code}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {waktu(row.scheduled_at)}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {selisihMenit(row.minutes_from_schedule)}
                      </span>
                      {row.is_high_alert ? (
                        <span className="rounded bg-orange-100 px-2 py-1 font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                          High-alert
                        </span>
                      ) : null}
                      {row.is_controlled ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-1 font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                          <Lock className="h-3 w-3" aria-hidden />
                          Terkendali
                        </span>
                      ) : null}
                      {row.is_lasa ? (
                        <span className="rounded bg-amber-100 px-2 py-1 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          LASA
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          {!aktif ? (
            <EmptyState title="Pilih jadwal pemberian" description="Form enam benar dan alasan melewati obat tampil di sini." />
          ) : (
            <div className="space-y-5">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <p className="font-mono text-xs text-slate-500">{aktif.prescription_number}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{aktif.patient_name}</h3>
                  <p className="text-sm text-slate-500">
                    {aktif.generic_name} · {aktif.dose_value} {aktif.dose_unit} · {aktif.route}
                  </p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                  {LABEL_GOLONGAN_OBAT[aktif.drug_class] ?? aktif.drug_class}
                </span>
              </header>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Pasien', scanPatientId === aktif.patient_id],
                  ['Obat', scanDrugId === aktif.drug_id],
                  ['Dosis', Number(doseValue) === aktif.dose_value],
                  ['Rute', route === aktif.route],
                  ['Waktu', !aktif.overdue],
                  ['Dokumentasi', true],
                ].map(([label, ok]) => (
                  <div
                    key={label as string}
                    className={clsx(
                      'flex items-center gap-2 rounded-lg border p-3 text-sm',
                      ok
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
                    )}
                  >
                    {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
                    {label as string}
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Scan gelang pasien">
                  <input className="field-input ltr-code" value={scanPatientId} onChange={(e) => setScanPatientId(e.target.value)} />
                </Field>
                <Field label="Scan label obat">
                  <input className="field-input ltr-code" value={scanDrugId} onChange={(e) => setScanDrugId(e.target.value)} />
                </Field>
                <Field label="Dosis diberikan">
                  <input className="field-input ltr-code" type="number" step="0.0001" value={doseValue} onChange={(e) => setDoseValue(e.target.value)} />
                </Field>
                <Field label="Rute">
                  <input className="field-input ltr-code" value={route} onChange={(e) => setRoute(e.target.value)} />
                </Field>
                <Field label="Saksi pemeriksaan ganda">
                  <input className="field-input ltr-code" value={witnessedBy} onChange={(e) => setWitnessedBy(e.target.value)} placeholder="UUID petugas lain bila perlu" />
                </Field>
                <Field label="Sisa dibuang">
                  <input className="field-input ltr-code" type="number" step="0.0001" value={wastedAmount} onChange={(e) => setWastedAmount(e.target.value)} />
                </Field>
              </div>
              <Field label="Catatan pemberian">
                <textarea className="field-input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>

              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950/40">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary bg-teal-700 hover:bg-teal-800"
                    disabled={!aktif || berikan.isPending || lewati.isPending}
                    onClick={() => berikan.mutate()}
                  >
                    <Syringe className="h-4 w-4" aria-hidden />
                    Catat diberikan
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={!aktif}
                    onClick={() => resetForm(aktif)}
                  >
                    <ScanLine className="h-4 w-4" aria-hidden />
                    Isi dari jadwal
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Nilai scan tetap diverifikasi di peladen. Bila salah, kejadian nyaris cedera
                  dicatat sebelum permintaan ditolak.
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <h4 className="font-semibold text-amber-950 dark:text-amber-100">Tidak diberikan</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Status">
                    <select className="field-input" value={skipStatus} onChange={(e) => setSkipStatus(e.target.value as typeof skipStatus)}>
                      <option value="OMITTED">Dilewati</option>
                      <option value="REFUSED">Ditolak pasien</option>
                      <option value="HELD">Ditahan</option>
                    </select>
                  </Field>
                  <Field label="Alasan wajib">
                    <input className="field-input" list="alasan-pemberian" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} />
                    <datalist id="alasan-pemberian">
                      {SKIP_REASONS.map((reason) => (
                        <option key={reason} value={reason} />
                      ))}
                    </datalist>
                  </Field>
                </div>
                <Field label="Catatan alasan">
                  <textarea className="field-input min-h-20" value={skipNote} onChange={(e) => setSkipNote(e.target.value)} />
                </Field>
                <button
                  type="button"
                  className="btn border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100"
                  disabled={!aktif || skipReason.trim().length < 3 || berikan.isPending || lewati.isPending}
                  onClick={() => lewati.mutate()}
                >
                  <SkipForward className="h-4 w-4" aria-hidden />
                  Catat tidak diberikan
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Ringkasan({
  label,
  value,
  icon: Icon,
  danger,
  warning,
}: {
  label: string;
  value: number;
  icon: typeof Pill;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <Icon
          className={clsx(
            'h-5 w-5',
            danger ? 'text-rose-600' : warning ? 'text-orange-600' : 'text-teal-700',
          )}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default AdministrationPage;
