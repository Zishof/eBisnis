/**
 * Pengujian salam dan muqaddimah.
 *
 * Teks Arab tidak dapat "hampir benar". Satu huruf yang hilang mengubah
 * bacaannya, dan yang membacanya mengenali kesalahan itu seketika. Uji ini
 * tidak dapat menilai kebenaran bacaan — itu urusan manusia — tetapi ia menjaga
 * hal-hal yang dapat diperiksa mesin: teksnya benar-benar berhuruf Arab,
 * berharakat, tidak terpotong, dan alih aksaranya tidak tertukar.
 */

import { describe, expect, it } from 'vitest';
import {
  BASMALAH,
  DOA_PENUTUP,
  HAMDALAH,
  MUQADDIMAH_PARAGRAF,
  SALAM,
  type BarisArab,
} from './salam-pembuka';

const SELURUH: Array<[string, BarisArab]> = [
  ['BASMALAH', BASMALAH],
  ['SALAM', SALAM],
  ['HAMDALAH', HAMDALAH],
  ['DOA_PENUTUP', DOA_PENUTUP],
];

/** Rentang huruf Arab dasar dan suplemennya. */
const HURUF_ARAB = /[ؠ-يٮ-ۓ]/;
/** Harakat dan tanda baca Arab. */
const HARAKAT = /[ً-ْٰ]/;
/** Huruf Latin. */
const HURUF_LATIN = /[A-Za-z]/;

/**
 * Membuang tanda diakritik dari alih aksara sebelum dibandingkan.
 *
 * Alih aksara ilmiah memakai ḥ, ṣ, ṭ, dan ā. Perbandingan yang menuntut
 * ejaan tanpa diakritik akan menyala merah pada alih aksara yang justru lebih
 * benar — penjaga yang menghukum ketelitian akan dijawab dengan mengurangi
 * ketelitiannya.
 */
const tanpaDiakritik = (t: string) =>
  t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

describe('teks Arab', () => {
  it.each(SELURUH)('%s benar-benar berhuruf Arab', (_nama, baris) => {
    expect(HURUF_ARAB.test(baris.arab)).toBe(true);
  });

  it.each(SELURUH)('%s berharakat, bukan gundul', (_nama, baris) => {
    /*
     * Teks gundul dapat dibaca keliru oleh yang belum lancar. Pada halaman yang
     * dibuka umum, harakat bukan kemewahan.
     */
    expect(HARAKAT.test(baris.arab)).toBe(true);
  });

  it.each(SELURUH)('%s tidak tercampur huruf Latin', (_nama, baris) => {
    // Huruf Latin yang terselip biasanya sisa penyuntingan, dan pada teks Arab
    // ia terlihat seperti kesalahan cetak.
    expect(HURUF_LATIN.test(baris.arab)).toBe(false);
  });

  it.each(SELURUH)('%s tidak terpotong di ujung', (_nama, baris) => {
    const bersih = baris.arab.trim();
    expect(bersih).toBe(baris.arab);
    expect(bersih.length).toBeGreaterThan(10);
  });

  it.each(SELURUH)('%s punya alih aksara dan arti', (_nama, baris) => {
    expect(HURUF_LATIN.test(baris.latin)).toBe(true);
    expect(HURUF_ARAB.test(baris.latin)).toBe(false);
    expect(baris.arti.trim().length).toBeGreaterThan(20);
  });
});

describe('isi pembuka', () => {
  it('salam memuat lafaz yang lengkap', () => {
    // Salam yang dipotong pada "assalamu alaikum" saja mengurangi haknya.
    const latin = tanpaDiakritik(SALAM.latin);
    expect(latin).toContain('warahmatull');
    expect(latin).toContain('barak');
  });

  it('hamdalah memuat selawat dan ammā ba‘du', () => {
    /*
     * Ketiganya adalah kerangka pembuka yang dikenali: hamdalah, selawat, lalu
     * ammā ba‘du sebagai peralihan ke maksud. Kehilangan salah satunya membuat
     * pembukaan terasa terpotong bagi yang terbiasa mendengarnya.
     */
    const latin = tanpaDiakritik(HAMDALAH.latin);
    expect(latin).toContain('alhamdulill');
    expect(latin).toContain('salatu');
    expect(latin).toContain('amma ba');
  });

  it('muqaddimah cukup panjang untuk dibaca sebagai pembuka, bukan slogan', () => {
    expect(MUQADDIMAH_PARAGRAF.length).toBeGreaterThanOrEqual(4);
    for (const p of MUQADDIMAH_PARAGRAF) {
      expect(p.trim().length).toBeGreaterThan(150);
    }
  });

  it('muqaddimah menutup dengan harapan dan doa', () => {
    const akhir = tanpaDiakritik(MUQADDIMAH_PARAGRAF[MUQADDIMAH_PARAGRAF.length - 1]);
    expect(akhir).toContain('semoga');
    expect(akhir).toContain('amin');
  });

  it('muqaddimah tidak mengecilkan peran kiai dan asatidz', () => {
    /*
     * Sistem yang diperkenalkan kepada pesantren wajib menempatkan dirinya
     * sebagai pembantu, bukan pengganti. Kalimat itu ada dengan sengaja.
     */
    const semua = MUQADDIMAH_PARAGRAF.join(' ').toLowerCase();
    expect(semua).toContain('bukan untuk mengganti peran');
  });

  it('muqaddimah menyebut dasar pencatatan', () => {
    const semua = MUQADDIMAH_PARAGRAF.join(' ').toLowerCase();
    expect(semua).toContain('pencatatan');
  });
});
