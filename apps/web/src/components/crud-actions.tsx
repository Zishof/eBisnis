import { useRef } from 'react';
import { BarChart3, Download, FileText, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { GridColumn } from './ui';

interface CrudMetric {
  label: string;
  value: string | number;
  tone?: 'emerald' | 'sky' | 'amber' | 'slate';
}

interface CrudActionBarProps<T extends Record<string, unknown>> {
  title: string;
  rows: T[];
  columns?: Array<GridColumn<T>>;
  filename: string;
  onUploadRows?: (rows: Array<Record<string, unknown>>, file: File) => Promise<void> | void;
  uploadLabel?: string;
}

export function CrudDashboard({ metrics }: { metrics: CrudMetric[] }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className={`rounded-xl border p-4 ${metricClass(metric.tone)}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
            <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-950">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

export function CrudActionBar<T extends Record<string, unknown>>({
  title,
  rows,
  columns,
  filename,
  onUploadRows,
  uploadLabel = 'Upload Excel',
}: CrudActionBarProps<T>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const exportColumns = resolveColumns(rows, columns);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <button type="button" className="btn-outline" onClick={() => downloadExcel(rows, exportColumns, filename)}>
        <Download className="h-4 w-4" aria-hidden />
        Download Excel
      </button>
      {onUploadRows && (
        <>
          <button type="button" className="btn-outline" onClick={() => inputRef.current?.click()}>
            <UploadCloud className="h-4 w-4" aria-hidden />
            {uploadLabel}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              void readSheetRows(file).then((sheetRows) => onUploadRows(sheetRows, file));
            }}
          />
        </>
      )}
      <button type="button" className="btn-outline" onClick={() => printPdf(title, rows, exportColumns, filename)}>
        <FileText className="h-4 w-4" aria-hidden />
        Cetak PDF
      </button>
    </div>
  );
}

function resolveColumns<T extends Record<string, unknown>>(rows: T[], columns?: Array<GridColumn<T>>) {
  if (columns?.length) {
    return columns
      .filter((column) => column.key !== 'aksi')
      .map((column) => ({ key: column.key, header: column.header }));
  }
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return keys.map((key) => ({ key, header: humanizeColumn(key) }));
}

function downloadExcel<T extends Record<string, unknown>>(rows: T[], columns: Array<{ key: string; header: string }>, filename: string) {
  const data = rows.map((row) => Object.fromEntries(columns.map((column) => [column.header, cellValue(row[column.key])])));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, ensureExt(filename, 'xlsx'));
}

async function printPdf<T extends Record<string, unknown>>(title: string, rows: T[], columns: Array<{ key: string; header: string }>, filename: string) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  const autoTable = autoTableModule.default;
  autoTable(doc, {
    head: [columns.map((column) => column.header)],
    body: rows.map((row) => columns.map((column) => cellValue(row[column.key]))),
    startY: 22,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [6, 120, 100] },
  });
  doc.save(ensureExt(filename, 'pdf'));
}

async function readSheetRows(file: File): Promise<Array<Record<string, unknown>>> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

function cellValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function ensureExt(filename: string, ext: string) {
  return filename.toLowerCase().endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
}

function humanizeColumn(key: string) {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (char) => char.toUpperCase());
}

function metricClass(tone: CrudMetric['tone']) {
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50';
  if (tone === 'sky') return 'border-sky-200 bg-sky-50';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50';
  return 'border-slate-200 bg-white';
}
