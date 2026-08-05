import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Database, Download, FileCheck2, FileSpreadsheet, Search, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [datasetSearch, setDatasetSearch] = useState('');

  const datasets = useQuery({
    queryKey: ['pesantren-dapodik-datasets'],
    queryFn: () => api.get<Dataset[]>('/pesantren/dapodik/datasets'),
  });
  const active = useMemo(
    () => datasets.data?.find((item) => item.code === datasetCode) ?? datasets.data?.[0],
    [datasets.data, datasetCode],
  );
  const filteredDatasets = useMemo(() => {
    const term = datasetSearch.trim().toLowerCase();
    if (!term) return datasets.data ?? [];
    return (datasets.data ?? []).filter((item) =>
      [item.code, item.name, item.description, ...item.columns].some((value) => value.toLowerCase().includes(term)),
    );
  }, [datasets.data, datasetSearch]);
  const datasetStats = useMemo(() => {
    const list = datasets.data ?? [];
    return {
      total: list.length,
      wajib: active?.required.length ?? 0,
      kolom: active?.columns.length ?? 0,
      referensi: list.filter((item) => item.code.startsWith('ref-')).length,
    };
  }, [active, datasets.data]);

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
        format,
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

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Dataset" value={datasetStats.total} />
        <Metric label="Referensi" value={datasetStats.referensi} />
        <Metric label="Kolom Aktif" value={datasetStats.kolom} />
        <Metric label="Wajib" value={datasetStats.wajib} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
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
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                className="field-input pl-9"
                value={datasetSearch}
                onChange={(event) => setDatasetSearch(event.target.value)}
                placeholder="Cari santri, guru, nilai, penghasilan..."
              />
            </div>
            <div className="space-y-2">
              {filteredDatasets.map((item) => (
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
              {filteredDatasets.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Dataset tidak ditemukan.
                </div>
              )}
            </div>
          </div>

          {active && (
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Dataset Aktif</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{active.name}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{active.description}</p>
              <p className="mt-4 text-sm font-semibold text-slate-900">Kolom wajib</p>
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
              <p className="text-sm text-slate-600">Gunakan template yang diunduh dari tombol atas, isi datanya, lalu unggah CSV/Excel/JSON atau tempel isi file di sini.</p>
            </div>
            <div className="space-y-3 p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-emerald-300 hover:bg-emerald-50">
                <UploadCloud className="h-7 w-7 text-emerald-700" aria-hidden />
                <span className="mt-2 text-sm font-semibold text-slate-900">Unggah file CSV, Excel, atau JSON</span>
                <span className="text-xs text-slate-500">Header Dapodik umum akan dicocokkan otomatis dengan kolom internal.</span>
                <input
                  type="file"
                  accept=".csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void bacaFileImpor(file).then(({ format: nextFormat, content: nextContent }) => {
                      setFormat(nextFormat);
                      setContent(nextContent);
                    }).catch((error: unknown) => {
                      toast.push(error instanceof Error ? error.message : 'File tidak dapat dibaca.', 'error');
                    });
                  }}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Format impor</p>
                  <p className="text-xs text-slate-500">Excel akan otomatis dikonversi menjadi CSV.</p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button type="button" className={format === 'csv' ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-ghost px-3 py-1.5 text-xs'} onClick={() => setFormat('csv')}>CSV</button>
                  <button type="button" className={format === 'json' ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-ghost px-3 py-1.5 text-xs'} onClick={() => setFormat('json')}>JSON</button>
                </div>
              </div>
              <textarea
                className="field-input min-h-72 font-mono text-xs"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={format === 'json' ? '[{"nis":"001","nama_lengkap":"Ahmad","jenis_kelamin":"L"}]' : 'nis,nisn,nama_lengkap,jenis_kelamin...'}
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

async function bacaFileImpor(file: File): Promise<{ format: 'csv' | 'json'; content: string }> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('Workbook tidak memiliki sheet.');
    const worksheet = workbook.Sheets[firstSheet];
    return { format: 'csv', content: XLSX.utils.sheet_to_csv(worksheet) };
  }
  const content = await file.text();
  return { format: lowerName.endsWith('.json') ? 'json' : 'csv', content };
}
