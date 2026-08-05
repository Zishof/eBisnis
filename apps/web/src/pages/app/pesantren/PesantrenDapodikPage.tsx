import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Database, Download, FileCheck2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useErrorMessage } from '../../../app/auth-context';
import { PageHeader, StatusBadge, useToast } from '../../../components/ui';
import { api } from '../../../lib/api';

interface Dataset {
  code: string;
  name: string;
  description: string;
  columns: string[];
  required: string[];
}

interface CsvPayload {
  filename: string;
  mimeType: string;
  content: string;
  columns?: string[];
}

interface ImportResult {
  dataset: string;
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export function PesantrenDapodikPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const [datasetCode, setDatasetCode] = useState('santri');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const datasets = useQuery({
    queryKey: ['pesantren-dapodik-datasets'],
    queryFn: () => api.get<Dataset[]>('/pesantren/dapodik/datasets'),
  });
  const active = useMemo(
    () => datasets.data?.find((item) => item.code === datasetCode) ?? datasets.data?.[0],
    [datasets.data, datasetCode],
  );

  const template = useMutation({
    mutationFn: () => api.get<CsvPayload>(`/pesantren/dapodik/${datasetCode}/template`),
    onSuccess: (payload) => unduh(payload),
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Template gagal diunduh.'), 'error'),
  });

  const ekspor = useMutation({
    mutationFn: () => api.get<CsvPayload>(`/pesantren/dapodik/${datasetCode}/export`),
    onSuccess: (payload) => unduh(payload),
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Data gagal diekspor.'), 'error'),
  });

  const impor = useMutation({
    mutationFn: (dryRun: boolean) =>
      api.post<ImportResult>(`/pesantren/dapodik/${datasetCode}/import`, {
        format: 'csv',
        content,
        dryRun,
      }),
    onSuccess: (payload) => {
      setResult(payload);
      toast.push(payload.dryRun ? 'Validasi selesai.' : 'Impor Dapodik selesai.', 'success');
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Impor Dapodik gagal.'), 'error'),
  });

  return (
    <>
      <PageHeader
        title="Impor/Ekspor Dapodik"
        description="Pusat pertukaran data sekolah: peserta didik, GTK, rombongan belajar, mata pelajaran, jadwal, dan nilai."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Dapodik' }]}
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => template.mutate()} disabled={!active || template.isPending}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Template
            </button>
            <button type="button" className="btn-outline" onClick={() => ekspor.mutate()} disabled={!active || ekspor.isPending}>
              <Download className="h-4 w-4" aria-hidden />
              Ekspor CSV
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <Database className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Dataset</p>
                <p className="text-xs text-slate-500">Pilih data yang akan ditukar.</p>
              </div>
            </div>
            <div className="space-y-2">
              {(datasets.data ?? []).map((item) => (
                <button
                  type="button"
                  key={item.code}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    item.code === active?.code
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40'
                  }`}
                  onClick={() => {
                    setDatasetCode(item.code);
                    setResult(null);
                  }}
                >
                  <span className="block font-semibold">{item.name}</span>
                  <span className="mt-1 line-clamp-2 block text-xs text-slate-500">{item.description}</span>
                </button>
              ))}
            </div>
          </div>

          {active && (
            <div className="card p-4">
              <p className="text-sm font-semibold text-slate-900">Kolom wajib</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.required.map((column) => <StatusBadge key={column} status={column} />)}
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">Kolom tersedia</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{active.columns.join(', ')}</p>
            </div>
          )}
        </aside>

        <section className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3">
              <h2 className="section-title">Area Impor CSV</h2>
              <p className="text-sm text-slate-600">Gunakan template yang diunduh dari tombol atas, isi datanya, lalu unggah atau tempel CSV di sini.</p>
            </div>
            <div className="space-y-3 p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-emerald-300 hover:bg-emerald-50">
                <UploadCloud className="h-7 w-7 text-emerald-700" aria-hidden />
                <span className="mt-2 text-sm font-semibold text-slate-900">Unggah file CSV</span>
                <span className="text-xs text-slate-500">Atau tempel manual pada kotak di bawah.</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void file.text().then(setContent);
                  }}
                />
              </label>
              <textarea
                className="field-input min-h-72 font-mono text-xs"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="nis,nisn,nama_lengkap,jenis_kelamin..."
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-outline" onClick={() => impor.mutate(true)} disabled={!content.trim() || impor.isPending}>
                  <FileCheck2 className="h-4 w-4" aria-hidden />
                  Validasi Dulu
                </button>
                <button type="button" className="btn-primary" onClick={() => impor.mutate(false)} disabled={!content.trim() || impor.isPending}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Impor Final
                </button>
              </div>
            </div>
          </div>

          {result && (
            <div className="card p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label="Baris" value={result.totalRows} />
                <Metric label="Dibuat" value={result.created} />
                <Metric label="Diperbarui" value={result.updated} />
                <Metric label="Dilewati" value={result.skipped} />
              </div>
              {result.errors.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">Catatan validasi</p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-900">
                    {result.errors.slice(0, 10).map((error) => (
                      <li key={`${error.row}-${error.message}`}>Baris {error.row}: {error.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function unduh(payload: CsvPayload) {
  const blob = new Blob([payload.content], { type: payload.mimeType || 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = payload.filename || 'dapodik.csv';
  link.click();
  URL.revokeObjectURL(url);
}
