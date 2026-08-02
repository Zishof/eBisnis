import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn<T> {
  key: keyof T;
  label: string;
}

/**
 * Mengunduh tabel sebagai berkas Excel (.xlsx), sepenuhnya di peramban --
 * tidak ada permintaan ke server. Data yang diekspor persis data yang sudah
 * tampil pada dialog (tidak dihitung ulang), jadi tidak mungkin berbeda dari
 * yang dilihat pengguna sebelum mengunduh.
 */
export function downloadExcel<T extends Record<string, unknown>>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
): void {
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((col) => [col.label, row[col.key] ?? ''])),
  );
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Data');
  XLSX.writeFile(book, `${filename}.xlsx`);
}

/** Mengunduh tabel sebagai PDF sederhana (judul + satu tabel), sepenuhnya di peramban. */
export function downloadPdf<T extends Record<string, unknown>>(
  filename: string,
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
): void {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString('id-ID'), 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [columns.map((col) => col.label)],
    body: rows.map((row) => columns.map((col) => String(row[col.key] ?? ''))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [6, 78, 59] },
  });

  doc.save(`${filename}.pdf`);
}
