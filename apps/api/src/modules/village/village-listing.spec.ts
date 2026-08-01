/**
 * Pengujian konfigurasi daftar.
 *
 * Berkas `village-listing.ts` adalah konfigurasi yang diterjemahkan menjadi SQL
 * apa adanya. Kekeliruan di sana tidak menghasilkan galat tipe — ia menghasilkan
 * kueri yang gagal saat dijalankan petugas, atau lebih buruk, kueri yang
 * berhasil dan mengembalikan kolom yang seharusnya tidak pernah terbaca.
 *
 * Karena itu pengujian ini membaca **berkas migrasi yang sebenarnya** dan
 * mencocokkan setiap kolom yang dirujuk. Pengujian yang hanya memeriksa bentuk
 * konfigurasinya akan tetap lulus pada hari sebuah kolom diganti namanya.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DAFTAR,
  HALAMAN_MAKSIMAL,
  RUAS_TERLARANG,
  TABEL_TERLARANG,
  bacaBatas,
  bacaNilaiSaringan,
  cariDaftar,
  type Saringan,
} from './village-listing';

const MIGRASI = join(__dirname, '..', '..', '..', 'tenant-migrations', 'village');

/** Kolom setiap tabel, dibaca dari berkas migrasi. */
function bacaSkema(): Map<string, Set<string>> {
  const tabel = new Map<string, Set<string>>();

  for (const berkas of readdirSync(MIGRASI).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRASI, berkas), 'utf8');

    for (const m of sql.matchAll(
      /CREATE TABLE IF NOT EXISTS "\{\{TENANT_SCHEMA\}\}"\.(\w+)\s*\(/g,
    )) {
      const nama = m[1];
      let dalam = 0;
      const mulai = m.index! + m[0].length - 1;
      let badan = '';
      for (let i = mulai; i < sql.length; i += 1) {
        if (sql[i] === '(') dalam += 1;
        else if (sql[i] === ')') {
          dalam -= 1;
          if (dalam === 0) {
            badan = sql.slice(mulai + 1, i);
            break;
          }
        }
      }

      const kolom = tabel.get(nama) ?? new Set<string>();
      for (const baris of badan.split('\n')) {
        const b = baris.trim();
        if (!b || b.startsWith('--')) continue;
        if (/^(CONSTRAINT|CHECK|UNIQUE|PRIMARY KEY|FOREIGN KEY|EXCLUDE)\b/i.test(b)) continue;
        const c = b.match(/^(\w+)\s+[A-Za-z]/);
        if (c) kolom.add(c[1]);
      }
      tabel.set(nama, kolom);
    }

    // ALTER TABLE ... ADD COLUMN, yang dipakai migrasi susulan.
    for (const m of sql.matchAll(
      /ALTER TABLE\s+"\{\{TENANT_SCHEMA\}\}"\.(\w+)\s+ADD COLUMN(?: IF NOT EXISTS)?\s+(\w+)/gi,
    )) {
      const kolom = tabel.get(m[1]) ?? new Set<string>();
      kolom.add(m[2]);
      tabel.set(m[1], kolom);
    }
  }

  return tabel;
}

const SKEMA = bacaSkema();

/** Alias tabel pada tiap daftar: alias → nama tabel. */
function aliasDaftar(d: (typeof DAFTAR)[number]): Map<string, string> {
  const peta = new Map<string, string>([[d.alias, d.tabel]]);
  if (d.gabung) {
    for (const m of d.gabung.matchAll(/JOIN\s+\{S\}\.(\w+)\s+(\w+)\b/g)) {
      peta.set(m[2], m[1]);
    }
  }
  return peta;
}

describe('konfigurasi daftar: bentuk', () => {
  it('kodenya unik', () => {
    const kode = DAFTAR.map((d) => d.kode);
    expect(kode).toEqual([...new Set(kode)]);
  });

  it('setiap daftar punya proyeksi dan urutan', () => {
    for (const d of DAFTAR) {
      expect([d.kode, d.pilih.length > 0]).toEqual([d.kode, true]);
      expect([d.kode, d.urut.trim().length > 0]).toEqual([d.kode, true]);
      expect([d.kode, /^VILLAGE_[A-Z_]+\.[A-Z_]+$/.test(d.hakAkses)]).toEqual([d.kode, true]);
    }
  });

  it('cariDaftar menemukan yang ada dan menolak yang tidak', () => {
    expect(cariDaftar('pengaduan')?.tabel).toBe('village_complaint');
    expect(cariDaftar('tidak-ada')).toBeUndefined();
    // Nama yang mirip tabel pun bukan kode daftar.
    expect(cariDaftar('village_resident')).toBeUndefined();
  });
});

describe('konfigurasi daftar: tabel dan kolom benar-benar ada', () => {
  it('setiap tabel yang dirujuk ada pada migrasi', () => {
    const hilang: string[] = [];
    for (const d of DAFTAR) {
      for (const [, tabel] of aliasDaftar(d)) {
        if (!SKEMA.has(tabel)) hilang.push(`${d.kode} → ${tabel}`);
      }
      // Sub-kueri pada proyeksi juga menyebut tabel.
      for (const p of d.pilih) {
        for (const m of p.matchAll(/FROM \{S\}\.(\w+)/g)) {
          if (!SKEMA.has(m[1])) hilang.push(`${d.kode} → ${m[1]} (sub-kueri)`);
        }
      }
    }
    expect(hilang).toEqual([]);
  });

  it('hapusLunak cocok dengan kenyataan tabelnya', () => {
    // Menyatakannya salah pada tabel yang punya `deleted_at` membuat baris
    // terhapus muncul kembali di layar petugas — tanpa galat dan tanpa tanda.
    // Menyatakannya benar pada tabel yang tidak punya membuat kuerinya gagal.
    const salah: string[] = [];
    for (const d of DAFTAR) {
      const punya = SKEMA.get(d.tabel)?.has('deleted_at') ?? false;
      if (punya !== Boolean(d.hapusLunak)) {
        salah.push(`${d.kode}: tabel ${punya ? 'punya' : 'tidak punya'} deleted_at`);
      }
    }
    expect(salah).toEqual([]);
  });

  it('setiap kolom yang dirujuk ada pada tabelnya', () => {
    const hilang: string[] = [];

    for (const d of DAFTAR) {
      const alias = aliasDaftar(d);
      // Alias sub-kueri ikut dikenali agar tidak dianggap kolom hilang.
      for (const p of d.pilih) {
        for (const m of p.matchAll(/FROM \{S\}\.(\w+) (\w+)/g)) alias.set(m[2], m[1]);
      }

      const teks = [...d.pilih, d.urut, d.gabung ?? '', ...(d.saring ?? []).map((s) => s.klausa)]
        .join(' ');

      for (const m of teks.matchAll(/\b([a-z])\.(\w+)\b/g)) {
        const tabel = alias.get(m[1]);
        if (!tabel) continue; // bukan alias yang kami kenali
        const kolom = SKEMA.get(tabel);
        if (kolom && !kolom.has(m[2])) hilang.push(`${d.kode}: ${tabel}.${m[2]}`);
      }
    }

    expect([...new Set(hilang)]).toEqual([]);
  });
});

describe('konfigurasi daftar: batas yang tidak boleh dilewati', () => {
  it('tabel orang per orang tidak pernah menjadi tabel utama daftar', () => {
    // Tabel ini dibaca lewat layanannya masing-masing, sebab pembacaannya wajib
    // menghormati cakupan wilayah petugas dan wajib tercatat pada log akses.
    // Daftar umum tidak mengetahui keduanya.
    for (const d of DAFTAR) {
      expect([d.kode, TABEL_TERLARANG.includes(d.tabel)]).toEqual([d.kode, false]);
    }
  });

  it('tabel orang per orang hanya boleh disentuh sebagai CACAH, tidak pernah dibaca isinya', () => {
    // Menghitung berapa banyak penerima sebuah program adalah angka; menyebut
    // siapa saja mereka adalah pengumuman siapa yang miskin di desa ini.
    //
    // Perbedaannya harus dapat diperiksa, bukan dipercayakan pada niat baik
    // orang yang menambahkan daftar berikutnya. Karena itu setiap penyebutan
    // tabel terlarang wajib berbentuk `COUNT(*)` — proyeksi kolom apa pun dari
    // tabel itu menggagalkan berkas ini.
    const pelanggaran: string[] = [];

    for (const d of DAFTAR) {
      for (const terlarang of TABEL_TERLARANG) {
        // Gabungan KIRI untuk mengambil SATU nama tampilan aparatur bukan
        // pembacaan data penduduk: tanpanya, daftar jabatan hanya berisi UUID.
        const gabungSah = new RegExp(`LEFT JOIN \\{S\\}\\.${terlarang}\\s`).test(d.gabung ?? '');

        for (const p of d.pilih) {
          if (!p.includes(terlarang)) continue;
          const cacahSaja = new RegExp(
            `^\\(SELECT COUNT\\(\\*\\) FROM \\{S\\}\\.${terlarang}\\b[^)]*\\)\\s+AS \\w+$`,
          ).test(p);
          if (!cacahSaja) pelanggaran.push(`${d.kode}: proyeksi "${p}" menyentuh ${terlarang}`);
        }

        for (const s of d.saring ?? []) {
          if (s.klausa.includes(terlarang)) {
            pelanggaran.push(`${d.kode}: saringan ${s.kunci} menyentuh ${terlarang}`);
          }
        }

        if (d.gabung?.includes(terlarang) && !gabungSah) {
          pelanggaran.push(`${d.kode}: gabungan ke ${terlarang} bukan LEFT JOIN`);
        }
      }
    }

    expect(pelanggaran).toEqual([]);
  });

  it('tidak satu pun proyeksi memuat ruas terlarang', () => {
    // Pemeriksaan KEDUA, berdiri sendiri dari daftar izin `pilih`. Yang pertama
    // menyatakan apa yang boleh; yang kedua menangkap apa yang lolos ketika
    // seseorang menambahkan satu kolom tanpa memikirkannya.
    const bocor: string[] = [];
    for (const d of DAFTAR) {
      for (const p of d.pilih) {
        for (const ruas of RUAS_TERLARANG) {
          if (new RegExp(`\\b${ruas}\\b`).test(p)) bocor.push(`${d.kode}: ${ruas} pada "${p}"`);
        }
      }
    }
    expect(bocor).toEqual([]);
  });

  it('nama pelapor hanya tampil bila ia memilih terbuka', () => {
    // Pengaduan dan aspirasi menyimpan nama pelapor meskipun ia memilih tidak
    // ditampilkan — sengaja, supaya petugas dapat menghubunginya. Daftar yang
    // dibaca banyak orang tidak boleh menampilkannya begitu saja.
    for (const kode of ['pengaduan', 'aspirasi']) {
      const d = cariDaftar(kode)!;
      const ruas = d.pilih.find((p) => p.includes('reporter_name'));
      expect([kode, ruas]).toEqual([kode, expect.stringContaining("reporter_mode = 'TERBUKA'")]);
    }
  });

  it('daftar tanah menyebut PENGUASA, bukan pemilik', () => {
    // D-9: pemerintah desa mencatat siapa yang menguasai bidang menurut
    // administrasinya. Kepemilikan ditetapkan BPN, dan kolom bernama `owner_`
    // pada layar desa membuat orang membacanya sebagai bukti kepemilikan.
    const d = cariDaftar('tanah')!;
    expect(d.pilih.join(' ')).toContain('possessor_name');
    expect(d.pilih.join(' ')).not.toContain('owner');
  });

  it('daftar insiden tidak memuat terlapor maupun terduga', () => {
    const d = cariDaftar('insiden')!;
    const teks = d.pilih.join(' ').toLowerCase();
    for (const kata of ['accused', 'suspect', 'terduga', 'terlapor', 'perpetrator']) {
      expect([kata, teks.includes(kata)]).toEqual([kata, false]);
    }
  });

  it('program bantuan menampilkan JUMLAH penerima, bukan namanya', () => {
    const d = cariDaftar('program-bantuan')!;
    expect(d.pilih.join(' ')).toContain('beneficiary_count');
    expect(d.pilih.join(' ')).not.toContain('resident');
  });
});

describe('pembacaan nilai saringan', () => {
  const s = (bentuk: Saringan['bentuk'], pilihan?: string[]): Saringan => ({
    kunci: 'x',
    klausa: 'x = $n',
    bentuk,
    pilihan,
  });

  it('UUID yang bukan UUID ditolak', () => {
    expect(bacaNilaiSaringan(s('UUID'), '3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(
      '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    );
    expect(bacaNilaiSaringan(s('UUID'), "' OR 1=1 --")).toBeNull();
    expect(bacaNilaiSaringan(s('UUID'), '123')).toBeNull();
  });

  it('PILIHAN hanya menerima yang terdaftar', () => {
    const p = s('PILIHAN', ['DIAJUKAN', 'DITERBITKAN']);
    expect(bacaNilaiSaringan(p, 'DIAJUKAN')).toBe('DIAJUKAN');
    expect(bacaNilaiSaringan(p, 'diajukan')).toBeNull();
    expect(bacaNilaiSaringan(p, 'APA SAJA')).toBeNull();
  });

  it('TAHUN di luar jangkauan ditolak', () => {
    expect(bacaNilaiSaringan(s('TAHUN'), '2026')).toBe(2026);
    expect(bacaNilaiSaringan(s('TAHUN'), '1900')).toBeNull();
    expect(bacaNilaiSaringan(s('TAHUN'), '20260')).toBeNull();
    expect(bacaNilaiSaringan(s('TAHUN'), 'dua ribu')).toBeNull();
  });

  it('TANGGAL wajib berbentuk ISO', () => {
    expect(bacaNilaiSaringan(s('TANGGAL'), '2026-08-01')).toBe('2026-08-01');
    expect(bacaNilaiSaringan(s('TANGGAL'), '1 Agustus 2026')).toBeNull();
  });

  it('BENAR_SALAH tidak menerima nilai lain', () => {
    expect(bacaNilaiSaringan(s('BENAR_SALAH'), 'true')).toBe(true);
    expect(bacaNilaiSaringan(s('BENAR_SALAH'), 'false')).toBe(false);
    expect(bacaNilaiSaringan(s('BENAR_SALAH'), '1')).toBeNull();
  });

  it('TEKS dibungkus untuk ILIKE dan dibatasi panjangnya', () => {
    expect(bacaNilaiSaringan(s('TEKS'), 'Sumiati')).toBe('%Sumiati%');
    // Pencarian sepanjang seribu huruf bukan pencarian; ia beban peladen.
    expect(bacaNilaiSaringan(s('TEKS'), 'a'.repeat(101))).toBeNull();
    expect(bacaNilaiSaringan(s('TEKS'), '   ')).toBeNull();
  });
});

describe('batas halaman', () => {
  it('bawaannya wajar dan batas atasnya tidak dapat dilewati', () => {
    expect(bacaBatas(undefined)).toBe(50);
    expect(bacaBatas('25')).toBe(25);
    // Permintaan sepuluh ribu baris menarik seluruh tabel ke memori peladen
    // lalu mengirimkannya lewat sambungan kantor desa.
    expect(bacaBatas('10000')).toBe(HALAMAN_MAKSIMAL);
    expect(bacaBatas('-5')).toBe(50);
    expect(bacaBatas('banyak')).toBe(50);
  });
});
