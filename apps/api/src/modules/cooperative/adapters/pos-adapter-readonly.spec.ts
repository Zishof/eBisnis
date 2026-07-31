/**
 * Pengujian bahwa adapter POS benar-benar hanya membaca.
 *
 * Diperiksa terhadap **isi berkas adapternya sendiri**, bukan terhadap
 * perilakunya saat dijalankan. Alasannya: perilaku hanya membuktikan jalur yang
 * kebetulan diuji, sedangkan pemeriksaan isi berkas menangkap setiap `INSERT`
 * yang kelak ditambahkan seseorang — termasuk pada jalur yang belum ada
 * pengujiannya.
 *
 * Ini pengujian yang tidak biasa, dan itu disengaja. Batas antara koperasi dan
 * POS adalah kesepakatan lintas sesi yang tertulis pada kontrak integrasi
 * K-0; melanggarnya tidak akan menghasilkan galat, hanya persediaan yang
 * terbelah dan pendapatan yang tercatat dua kali.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PERISTIWA_POS_TERLARANG, TABEL_POS_TERLARANG } from '../cooperative-unit';

const DIR_MODUL = join(__dirname, '..');

/** Seluruh berkas TypeScript modul koperasi, kecuali pengujiannya. */
function berkasModul(dir: string): string[] {
  const hasil: string[] = [];
  for (const entri of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entri.name);
    if (entri.isDirectory()) hasil.push(...berkasModul(p));
    else if (entri.name.endsWith('.ts') && !entri.name.endsWith('.spec.ts')) hasil.push(p);
  }
  return hasil;
}

/** Membuang komentar supaya nama tabel di dalam keterangan tidak ikut terbaca. */
function tanpaKomentar(teks: string): string {
  return teks.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

describe('adapter POS hanya membaca', () => {
  const adapter = tanpaKomentar(
    readFileSync(join(DIR_MODUL, 'adapters', 'pos.adapter.ts'), 'utf8'),
  );

  it('tidak memuat INSERT, UPDATE, DELETE, maupun TRUNCATE', () => {
    for (const perintah of ['INSERT INTO', 'UPDATE ', 'DELETE FROM', 'TRUNCATE']) {
      expect(adapter.toUpperCase()).not.toContain(perintah);
    }
  });

  it('tidak memuat SELECT ... FOR UPDATE', () => {
    // Mengunci baris POS dari koperasi dapat menahan kasir yang sedang melayani
    // pembeli — dan kasir yang layarnya menggantung tidak tahu sebabnya.
    expect(adapter.toUpperCase()).not.toContain('FOR UPDATE');
  });

  it('memuat SELECT — ia memang membaca', () => {
    expect(adapter.toUpperCase()).toContain('SELECT');
  });
});

describe('modul koperasi tidak menulis ke tabel POS mana pun', () => {
  const berkas = berkasModul(DIR_MODUL);

  it('menemukan berkas modul untuk diperiksa', () => {
    expect(berkas.length).toBeGreaterThan(5);
  });

  it('tidak ada berkas yang menulis ke tabel POS atau stok', () => {
    /*
     * Penjualan di unit toko sudah menghasilkan pergerakan stok dan jurnal
     * lewat mesin POS. Koperasi yang ikut menulis ke sana akan menggandakan
     * pendapatan dan membelah persediaan menjadi dua angka yang tidak pernah
     * cocok saat opname.
     */
    const pelanggaran: string[] = [];

    for (const p of berkas) {
      const isi = tanpaKomentar(readFileSync(p, 'utf8'));
      for (const tabel of TABEL_POS_TERLARANG) {
        const pola = new RegExp(
          `(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)[^;]{0,120}\\b${tabel}\\b`,
          'i',
        );
        if (pola.test(isi)) {
          pelanggaran.push(`${p.replace(DIR_MODUL, '')} menulis ke ${tabel}`);
        }
      }
    }

    expect(pelanggaran).toEqual([]);
  });

  it('tidak ada berkas yang menerbitkan peristiwa akuntansi POS', () => {
    // Menjurnal ulang penjualan yang sudah dijurnal POS akan mencatat
    // pendapatan dua kali.
    const pelanggaran: string[] = [];

    for (const p of berkas) {
      if (p.includes('cooperative-unit.ts')) continue; // daftar terlarangnya sendiri
      const isi = tanpaKomentar(readFileSync(p, 'utf8'));
      for (const peristiwa of PERISTIWA_POS_TERLARANG) {
        if (isi.includes(`'${peristiwa}'`) || isi.includes(`"${peristiwa}"`)) {
          pelanggaran.push(`${p.replace(DIR_MODUL, '')} menyebut ${peristiwa}`);
        }
      }
    }

    expect(pelanggaran).toEqual([]);
  });

  it('hanya adapter yang menyebut tabel pos_sale', () => {
    /*
     * Membaca pun harus lewat satu pintu. Layanan koperasi yang membaca
     * `pos_sale` langsung akan membuat batas antara kedua konteks kabur, dan
     * batas yang kabur akan dilanggar tanpa ada yang menyadarinya.
     */
    const penyebut = berkas.filter((p) => {
      const isi = tanpaKomentar(readFileSync(p, 'utf8'));
      return /\bpos_sale\b/.test(isi);
    });

    const diizinkan = penyebut.filter(
      (p) => p.includes('adapters') || p.includes('cooperative-unit.ts'),
    );
    expect(penyebut.sort()).toEqual(diizinkan.sort());
  });
});
