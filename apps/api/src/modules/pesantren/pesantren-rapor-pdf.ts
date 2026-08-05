export interface DataRaporPdf {
  pondok: {
    nama: string;
    alamat: string;
  };
  santri: {
    nis: string;
    nama: string;
  };
  tahunAjaran: {
    nama: string;
  };
  rows: Array<{
    mata_pelajaran: string;
    nilai_akhir: number | null;
    huruf_mutu: string | null;
  }>;
  ringkasan: {
    jumlahMapel: number;
    rataRata: number | null;
    predikatDominan: string | null;
  };
  tanggalCetak: string;
}

export function buatRaporPdf(data: DataRaporPdf): Buffer {
  const lines = susunBaris(data);
  const pages = potongHalaman(lines, 42);
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const pageIds: number[] = [];
  let nextId = 4;
  for (const pageLines of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    const content = pageLines.map((line) => teks(line.text, line.x, line.y, line.size)).join('\n');
    objects[contentId] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    const object = objects[id];
    if (!object) continue;
    offsets[id] = Buffer.byteLength(body, 'latin1');
    body += `${id} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  const count = objects.length;
  body += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id += 1) {
    body += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

interface BarisPdf {
  text: string;
  x: number;
  y: number;
  size: number;
}

function susunBaris(data: DataRaporPdf): Omit<BarisPdf, 'y'>[] {
  const rows: Omit<BarisPdf, 'y'>[] = [];
  const add = (text: string, x = 50, size = 11) => rows.push({ text, x, size });

  add('RAPOR SANTRI', 50, 18);
  add(data.pondok.nama, 50, 14);
  for (const part of bungkus(data.pondok.alamat, 86)) add(part, 50, 9);
  add('', 50, 8);
  add(`Nama Santri : ${data.santri.nama}`);
  add(`NIS         : ${data.santri.nis || '-'}`);
  add(`Tahun Ajaran: ${data.tahunAjaran.nama}`);
  add(`Tanggal Cetak: ${data.tanggalCetak}`);
  add('', 50, 8);
  add('Mata Pelajaran                                      Nilai Akhir   Huruf', 50, 10);
  add('-----------------------------------------------------------------------', 50, 10);
  for (const row of data.rows) {
    const nama = potong(row.mata_pelajaran, 48).padEnd(50, ' ');
    const nilai = String(row.nilai_akhir ?? '-').padStart(8, ' ');
    const huruf = row.huruf_mutu ?? '-';
    add(`${nama}${nilai}       ${huruf}`, 50, 10);
  }
  add('', 50, 8);
  add(`Jumlah mata pelajaran: ${data.ringkasan.jumlahMapel}`);
  add(`Rata-rata           : ${data.ringkasan.rataRata === null ? '-' : data.ringkasan.rataRata.toFixed(2)}`);
  add(`Predikat dominan    : ${data.ringkasan.predikatDominan ?? '-'}`);
  add('', 50, 8);
  add('Catatan: dokumen ini dibangkitkan otomatis dari data nilai yang tersimpan di sistem.');
  add('', 50, 8);
  add('Wali Kelas                         Orang Tua/Wali                      Kepala Madrasah', 50, 10);
  add('', 50, 8);
  add('', 50, 8);
  add('', 50, 8);
  add('(........................)          (........................)          (........................)', 50, 10);
  return rows;
}

function potongHalaman(lines: Omit<BarisPdf, 'y'>[], perPage: number): BarisPdf[][] {
  const pages: BarisPdf[][] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    pages.push(lines.slice(i, i + perPage).map((line, index) => ({ ...line, y: 800 - index * 17 })));
  }
  return pages.length ? pages : [[{ text: 'Rapor belum memiliki data.', x: 50, y: 800, size: 12 }]];
}

function teks(text: string, x: number, y: number, size: number): string {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdf(normalisasi(text))}) Tj ET`;
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function normalisasi(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?');
}

function potong(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, Math.max(0, length - 3))}...`;
}

function bungkus(value: string, length: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > length) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}
