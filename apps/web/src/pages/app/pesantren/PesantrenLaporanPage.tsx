import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Printer, RefreshCw } from 'lucide-react';
import { useErrorMessage } from '../../../app/auth-context';
import { PageHeader, StatusBadge } from '../../../components/ui';
import { api, formatDate, formatMoney } from '../../../lib/api';

interface LaporanItem {
  code: string;
  name: string;
  description?: string;
}

interface LaporanResult {
  code?: string;
  range?: { from: string; to: string; days: number };
  rows?: Record<string, unknown>[];
  summary?: Record<string, unknown>;
  items?: Record<string, unknown>[];
  [key: string]: unknown;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return date.toISOString().slice(0, 10);
}

export function PesantrenLaporanPage() {
  const toMessage = useErrorMessage();
  const [code, setCode] = useState('');
  const [filter, setFilter] = useState({ from: defaultFrom(), to: today(), tahunAjaranId: '', gelombangId: '' });

  const daftar = useQuery({ queryKey: ['pesantren-laporan-daftar'], queryFn: () => api.get<LaporanItem[]>('/pesantren/laporan') });
  const kodeAktif = code || daftar.data?.[0]?.code || '';
  const laporanAktif = daftar.data?.find((item) => item.code === kodeAktif);

  const hasil = useQuery({
    queryKey: ['pesantren-laporan-hasil', kodeAktif, filter],
    enabled: Boolean(kodeAktif),
    queryFn: () => {
      const params = new URLSearchParams({ from: filter.from, to: filter.to });
      if (filter.tahunAjaranId.trim()) params.set('tahunAjaranId', filter.tahunAjaranId.trim());
      if (filter.gelombangId.trim()) params.set('gelombangId', filter.gelombangId.trim());
      return api.get<LaporanResult>(`/pesantren/laporan/${kodeAktif}?${params.toString()}`);
    },
  });

  const rows = useMemo(() => normalisasiRows(hasil.data), [hasil.data]);
  const columns = useMemo(() => Object.keys(rows[0] ?? {}).slice(0, 8), [rows]);
  const bisaEkspor = rows.length > 0 && columns.length > 0;

  return (
    <>
      <PageHeader
        title="Laporan ePesantren"
        description="Katalog laporan operasional pondok dengan rentang tanggal terkendali."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Laporan' }]}
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => void hasil.refetch()} disabled={!kodeAktif}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Jalankan
            </button>
            <button type="button" className="btn-outline" onClick={() => window.print()} disabled={!rows.length}>
              <Printer className="h-4 w-4" aria-hidden />
              Cetak / PDF
            </button>
            <button type="button" className="btn-outline" onClick={() => unduhCsv(kodeAktif, rows, columns)} disabled={!bisaEkspor}>
              <Download className="h-4 w-4" aria-hidden />
              Excel CSV
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="card p-4 print:hidden">
          <label className="mb-3 block">
            <span className="field-label">Jenis laporan</span>
            <select className="field-input" value={kodeAktif} onChange={(event) => setCode(event.target.value)}>
              {(daftar.data ?? []).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari" type="date" value={filter.from} onChange={(value) => setFilter({ ...filter, from: value })} />
            <Field label="Sampai" type="date" value={filter.to} onChange={(value) => setFilter({ ...filter, to: value })} />
          </div>
          <Field label="Tahun Ajaran ID" value={filter.tahunAjaranId} onChange={(value) => setFilter({ ...filter, tahunAjaranId: value })} />
          <Field label="Gelombang PSB ID" value={filter.gelombangId} onChange={(value) => setFilter({ ...filter, gelombangId: value })} />
          <button type="button" className="btn-primary mt-3 w-full" onClick={() => void hasil.refetch()} disabled={!kodeAktif}>
            <BarChart3 className="h-4 w-4" aria-hidden />
            Tampilkan
          </button>
        </aside>

        <section className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{laporanAktif?.code ?? kodeAktif}</p>
                <h2 className="section-title">{laporanAktif?.name ?? 'Laporan'}</h2>
              </div>
              {hasil.data?.range && <StatusBadge status={`${hasil.data.range.days} hari`} />}
            </div>
            {hasil.isError && <p className="mt-3 text-sm text-red-600">{toMessage(hasil.error, (_key, fallback) => fallback ?? 'Gagal menjalankan laporan.')}</p>}
          </div>

          {hasil.data?.summary && (
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(hasil.data.summary).map(([key, value]) => (
                <div key={key} className="card p-4">
                  <p className="text-sm text-slate-500">{labelKolom(key)}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{renderValue(value)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="card overflow-hidden print:border-0 print:shadow-none">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>{columns.length ? columns.map((column) => <th key={column} className="px-4 py-3 text-left font-semibold text-slate-600">{labelKolom(column)}</th>) : <th className="px-4 py-3 text-left font-semibold text-slate-600">Data</th>}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasil.isLoading && <tr><td className="px-4 py-6 text-slate-500">Memuat laporan...</td></tr>}
                  {!hasil.isLoading && !rows.length && <tr><td className="px-4 py-6 text-slate-500">Belum ada data laporan.</td></tr>}
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? row.code ?? index)}>
                      {columns.map((column) => <td key={column} className="px-4 py-3 text-slate-700">{renderValue(row[column])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function unduhCsv(code: string, rows: Record<string, unknown>[], columns: string[]) {
  const csv = [
    columns.map(csvCell).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${code || 'laporan-pesantren'}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = renderValue(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function normalisasiRows(data?: LaporanResult): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.items)) return data.items;
  return Object.entries(data)
    .filter(([, value]) => Array.isArray(value))
    .flatMap(([, value]) => value as Record<string, unknown>[]);
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="mb-3 block">
      <span className="field-label">{label}</span>
      <input className="field-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function labelKolom(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderValue(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
  if (typeof value === 'string' && /saldo|total|jumlah|nominal|tagihan|bayar/i.test(value)) return formatMoney(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
