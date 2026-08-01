/**
 * Pengujian narasi manfaat per bagian pondok.
 *
 * Yang dijaga bukan logika — tidak ada logika di sini — melainkan kelengkapan
 * dan kejujuran isinya. Kelalaian pada berkas ini tidak menghasilkan galat: ia
 * menghasilkan kartu kosong, janji berlebihan, atau rujukan yang keliru pada
 * halaman yang dibaca calon wali santri.
 */

import { describe, expect, it } from 'vitest';
import { KELOMPOK_PERAN, MUKADIMAH, SELURUH_PERAN } from './manfaat-peran';

describe('kelengkapan', () => {
  it('mencakup seluruh bagian yang diminta', () => {
    /*
     * Empat belas bagian disebut satu per satu, sisanya diminta didefinisikan.
     * Uji ini mengikat yang disebut eksplisit — bila salah satunya hilang saat
     * berkas ini disunting, yang kehilangan adalah pembaca yang mencari
     * bagiannya sendiri dan tidak menemukannya.
     */
    const kode = SELURUH_PERAN.map((p) => p.kode);
    for (const wajib of [
      'PIMPINAN',
      'PENGURUS',
      'OPS_PONDOK',
      'SEKOLAH_FORMAL',
      'DINIYAH',
      'USTADZ',
      'WALI',
      'SANTRI_MUKIM',
      'SANTRI_KALONG',
      'BENDAHARA',
      'DAKWAH',
      'UNIT_USAHA',
      'KESEHATAN',
      'PERIZINAN',
    ]) {
      expect(kode).toContain(wajib);
    }
  });

  it('menambahkan bagian lain yang relevan bagi pondok', () => {
    // Yang diminta "definisikan semua yang relevan". Ini batas bawahnya.
    expect(SELURUH_PERAN.length).toBeGreaterThanOrEqual(20);
  });

  it('kode peran tidak kembar', () => {
    const kode = SELURUH_PERAN.map((p) => p.kode);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('kode kelompok tidak kembar dan tidak ada kelompok kosong', () => {
    const kode = KELOMPOK_PERAN.map((k) => k.kode);
    expect(new Set(kode).size).toBe(kode.length);
    expect(KELOMPOK_PERAN.filter((k) => k.peran.length === 0)).toEqual([]);
  });
});

describe('mutu tiap butir', () => {
  it('setiap peran menyebut siapa yang dimaksud', () => {
    const cacat = SELURUH_PERAN.filter((p) => p.untuk.trim().length < 15).map((p) => p.kode);
    expect(cacat).toEqual([]);
  });

  it('setiap peran menyebut keresahan yang nyata', () => {
    /*
     * Tanpa keresahan, daftar manfaat menjadi daftar fitur. Yang meyakinkan
     * pembaca adalah mengenali dirinya pada kalimat pertama.
     */
    const cacat = SELURUH_PERAN.filter((p) => p.keresahan.trim().length < 60).map((p) => p.kode);
    expect(cacat).toEqual([]);
  });

  it('setiap peran punya sedikitnya empat manfaat yang terjabar', () => {
    const cacat = SELURUH_PERAN.filter(
      (p) => p.manfaat.length < 4 || p.manfaat.some((m) => m.trim().length < 30),
    ).map((p) => p.kode);
    expect(cacat).toEqual([]);
  });

  it('setiap peran punya keutamaan yang terisi', () => {
    const cacat = SELURUH_PERAN.filter((p) => p.keutamaan.nilai.trim().length < 20).map(
      (p) => p.kode,
    );
    expect(cacat).toEqual([]);
  });
});

describe('kejujuran narasi', () => {
  it('tidak memakai istilah perangkat lunak yang tidak dikenal pengurus pondok', () => {
    /*
     * Halaman ini dibaca pengasuh dan bendahara, bukan pemrogram. Istilah yang
     * tidak mereka kenal membuat pembaca merasa halaman ini bukan untuknya.
     */
    const teks = JSON.stringify(SELURUH_PERAN).toLowerCase();

    /*
     * Dicocokkan sebagai KATA UTUH, bukan potongan.
     *
     * Pemeriksaan potongan menyalakan merah pada "rapi", "siapa", dan "kapan"
     * — kata Indonesia biasa yang kebetulan memuat "api". Penjaga yang menyala
     * pada kalimat yang benar akan dijawab dengan mematikan penjaganya.
     */
    const terlarang = [
      'dashboard',
      'real-time',
      'realtime',
      'api',
      'database',
      'multi-tenant',
      'cloud',
      'server',
      'backend',
      'query',
    ];
    /*
     * Batas kata ditulis sebagai `[^a-z]` di tepi, bukan sebagai escape di
     * dalam template literal.
     *
     * `\b` di dalam template literal adalah karakter BACKSPACE, bukan batas
     * kata. Penjaga yang memakainya mencari backspace+istilah+backspace — yang
     * tidak pernah ada — sehingga selalu hijau tanpa memeriksa apa pun. Cacat
     * itu sempat terjadi di berkas ini.
     */
    const ditemukan = terlarang.filter((istilah) => {
      const pola = new RegExp(`(^|[^a-z])${istilah.replace('-', '[- ]')}([^a-z]|$)`);
      return pola.test(teks);
    });
    expect(ditemukan).toEqual([]);
  });

  it('tidak menjanjikan hal yang mustahil', () => {
    // Kata-kata yang menjanjikan kesempurnaan adalah kata yang dipegang pondok
    // saat sesuatu tidak berjalan.
    const teks = JSON.stringify(SELURUH_PERAN).toLowerCase();
    for (const janji of ['tanpa kesalahan', 'pasti untung', '100%', 'selalu benar', 'tidak akan pernah gagal']) {
      expect(teks).not.toContain(janji);
    }
  });

  it('santri nonmukim dibedakan dari santri mukim', () => {
    /*
     * Diminta secara khusus. Santri kalong sering terlewat pendataan justru
     * karena diperlakukan sama dengan yang mukim.
     */
    const kalong = SELURUH_PERAN.find((p) => p.kode === 'SANTRI_KALONG');
    expect(kalong).toBeDefined();
    const teks = [kalong!.keresahan, ...kalong!.manfaat].join(' ').toLowerCase();
    expect(teks).toContain('menginap');
  });

  it('pemisahan wewenang disebut, bukan hanya kemudahan', () => {
    /*
     * Bagian yang memegang uang dan izin adalah bagian yang paling sering
     * dipersoalkan. Menyebut pemisahan wewenang di depan melindungi petugasnya,
     * bukan mencurigainya.
     */
    const bendahara = SELURUH_PERAN.find((p) => p.kode === 'BENDAHARA');
    expect(bendahara!.manfaat.join(' ').toLowerCase()).toContain('orang berbeda');

    const izin = SELURUH_PERAN.find((p) => p.kode === 'PERIZINAN');
    expect(izin!.manfaat.join(' ').toLowerCase()).toContain('tidak dapat mengubah');
  });

  it('kerahasiaan data anak dan kesehatan disebut', () => {
    const wali = SELURUH_PERAN.find((p) => p.kode === 'WALI');
    expect(wali!.manfaat.join(' ').toLowerCase()).toContain('bukan data santri lain');

    const sehat = SELURUH_PERAN.find((p) => p.kode === 'KESEHATAN');
    expect(sehat!.manfaat.join(' ').toLowerCase()).toContain('bukan seluruh pengurus');
  });
});

describe('mukadimah', () => {
  it('terisi dan memuat rujukan yang disebut lengkap', () => {
    expect(MUKADIMAH.paragraf.length).toBeGreaterThanOrEqual(3);
    expect(MUKADIMAH.ayat.teks.length).toBeGreaterThan(40);
    expect(MUKADIMAH.ayat.rujukan).toMatch(/^QS\. .+: \d+$/);
  });

  it('setiap rujukan yang dipakai berbentuk sebutan yang dapat ditelusuri', () => {
    /*
     * Rujukan yang ditulis samar tidak dapat diperiksa pembacanya. Yang tidak
     * dapat diperiksa sebaiknya tidak ditulis sama sekali.
     */
    const rujukan = SELURUH_PERAN.map((p) => p.keutamaan.rujukan).filter(Boolean) as string[];
    expect(rujukan.length).toBeGreaterThan(0);
    for (const r of rujukan) {
      expect(r).toMatch(/^(QS\. .+: \d+|Makna hadis .+)$/);
    }
  });
});
