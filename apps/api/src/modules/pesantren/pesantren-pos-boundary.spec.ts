/**
 * Batas EP-N terhadap POS: modul ePesantren TIDAK PERNAH menulis ke tabel
 * `pos_*` mana pun.
 *
 * Diperiksa terhadap isi berkas, bukan perilaku saat dijalankan — pola sama
 * dengan `cooperative/adapters/pos-adapter-readonly.spec.ts`. Ini KEBALIKAN
 * dari batas koperasi: `PesantrenDompetPaymentHandler` bahkan tidak perlu
 * MEMBACA tabel POS sama sekali (tidak seperti koperasi yang perlu nomor
 * struk lewat adapter), sebab catatan pembayarannya hanya merujuk id
 * penahanannya sendiri — jauh lebih sederhana daripada meniru pola koperasi
 * apa adanya akan memaksa.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR_MODUL = __dirname;

function berkasModul(dir: string): string[] {
  const hasil: string[] = [];
  for (const entri of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entri.name);
    if (entri.isDirectory()) hasil.push(...berkasModul(p));
    else if (entri.name.endsWith('.ts') && !entri.name.endsWith('.spec.ts')) hasil.push(p);
  }
  return hasil;
}

function tanpaKomentar(teks: string): string {
  return teks.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

describe('modul ePesantren tidak menulis maupun membaca tabel pos_* langsung', () => {
  const berkas = berkasModul(DIR_MODUL);

  it('menemukan berkas modul untuk diperiksa', () => {
    expect(berkas.length).toBeGreaterThan(10);
  });

  it('tidak ada berkas yang menulis ke tabel pos_*', () => {
    const pelanggaran: string[] = [];
    for (const p of berkas) {
      const isi = tanpaKomentar(readFileSync(p, 'utf8'));
      const pola = /(INSERT\s+INTO|UPDATE|DELETE\s+FROM)[^;]{0,120}\bpos_\w+/i;
      if (pola.test(isi)) {
        pelanggaran.push(p.replace(DIR_MODUL, ''));
      }
    }
    expect(pelanggaran).toEqual([]);
  });

  it('tidak ada berkas yang membaca tabel pos_* secara langsung', () => {
    // Beda dari koperasi: dompet santri tidak butuh satu pun data POS
    // (nomor struk, outlet, dsb.) untuk mencatat mutasinya sendiri.
    const pelanggaran: string[] = [];
    for (const p of berkas) {
      const isi = tanpaKomentar(readFileSync(p, 'utf8'));
      if (/\bpos_\w+/.test(isi)) {
        pelanggaran.push(p.replace(DIR_MODUL, ''));
      }
    }
    expect(pelanggaran).toEqual([]);
  });

  it('penangan dompet mengimpor kontrak ExternalPaymentRegistry, bukan menyunting POS', () => {
    const isi = readFileSync(join(DIR_MODUL, 'pesantren-dompet-payment.handler.ts'), 'utf8');
    expect(isi).toContain("from '../pos/external-payment.registry'");
  });
});
