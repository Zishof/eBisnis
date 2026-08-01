/**
 * Setiap menu info-desa wajib punya rutenya di router.
 *
 * ## Mengapa pengujian ini ada
 *
 * Menu dan router adalah dua berkas yang tidak saling mengetahui: katalog menu
 * berada di peladen (`village-permission.catalog.ts`), rutenya di
 * `app/App.tsx`. Menambah menu tanpa menambah rutenya menghasilkan kegagalan
 * yang **tidak terlihat sebagai kegagalan**: menunya tampil di sidebar, dapat
 * diklik, lalu React Router menjatuhkannya ke penangkap `*` dan memantulkan
 * petugas ke halaman depan.
 *
 * Tidak ada galat, tidak ada pesan, tidak ada apa pun di log. Yang ada hanya
 * petugas yang mengira sistemnya rusak.
 *
 * Kekeliruan persis ini sudah pernah terjadi sekali: seluruh katalog memakai
 * awalan `/info-desa` tanpa `/app`, sehingga **tidak satu pun** dari tiga puluh
 * delapan menu dapat dibuka. Ia lolos ke tahap ini karena tidak ada berkas yang
 * membaca keduanya sekaligus.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AKAR = join(__dirname, '..', '..', '..', '..', '..', '..');
const KATALOG = join(
  AKAR,
  'apps', 'api', 'src', 'modules', 'village', 'catalog', 'village-permission.catalog.ts',
);
const ROUTER = join(AKAR, 'apps', 'web', 'src', 'app', 'App.tsx');

const katalog = readFileSync(KATALOG, 'utf8');
const router = readFileSync(ROUTER, 'utf8');

/** Rute yang disebut katalog menu, tanpa awalan `/app/`. */
const ruteMenu = [...katalog.matchAll(/route:\s*'\/app\/(info-desa\/[^']+)'/g)].map((m) => m[1]);

/** Rute yang benar-benar terdaftar pada router, di bawah `/app`. */
const ruteSemua = [...router.matchAll(/<Route path="(info-desa\/[^"]+)"/g)].map((m) => m[1]);

/**
 * Rute berparameter tidak ikut dicocokkan dengan menu.
 *
 * `layanan/permohonan/:id` adalah rincian satu berkas, dan ia dibuka dari
 * daftarnya. Menu untuk satu berkas tertentu tidak masuk akal — sidebar tidak
 * dapat menautkan ke permohonan yang belum ada.
 */
const ruteRouter = new Set(ruteSemua.filter((r) => !r.includes(':')));
const ruteBerparameter = ruteSemua.filter((r) => r.includes(':'));

describe('rute info-desa', () => {
  it('membaca kedua berkas dengan benar', () => {
    // Bila salah satu nol, pengujian di bawah lulus tanpa memeriksa apa pun.
    expect(ruteMenu.length).toBeGreaterThan(20);
    expect(ruteRouter.size).toBeGreaterThan(20);
  });

  it('seluruh rute katalog berawalan /app', () => {
    // Rute tanpa `/app` tidak akan tertangkap pencocokan di atas sama sekali,
    // sehingga jumlahnya yang menurun. Diperiksa langsung supaya sebabnya
    // terbaca, bukan muncul sebagai "menu hilang".
    const semua = [...katalog.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(semua.filter((r) => !r.startsWith('/app/info-desa/'))).toEqual([]);
  });

  /**
   * Menu yang layar petugasnya memang **belum dibangun**, beserta alasannya.
   *
   * Dinyatakan di sini, bukan didiamkan. Menu-menu ini jatuh ke penangkap `*`
   * di dalam `/app`, yang menampilkan halaman "belum tersedia" — jawaban jujur,
   * bukan pantulan ke halaman depan.
   *
   * Daftar ini harus mengecil, tidak membesar. Setiap baris di sini adalah menu
   * yang dilihat petugas tetapi tidak dapat ia pakai.
   */
  const BELUM_DIBANGUN: Record<string, string> = {
    'info-desa/situs/halaman': 'D-10. Penyuntingan halaman situs; layar petugasnya belum dibangun.',
    'info-desa/situs/berita': 'D-10. Penyuntingan berita dan agenda; layar petugasnya belum dibangun.',
    'info-desa/situs/siaran': 'D-10. Siaran informasi; kanal WhatsApp dan surel juga masih TERHALANG karena kredensial penyedia belum ada.',
    'info-desa/ppid': 'D-11. Permohonan informasi publik dan keberatan; layar petugasnya belum dibangun.',
    'info-desa/laporan': 'D-11. Penerbitan laporan beserta penekanan angka kecil; layar petugasnya belum dibangun.',
  };

  it('setiap menu punya rutenya, kecuali yang dinyatakan belum dibangun', () => {
    const hilang = ruteMenu.filter((r) => !ruteRouter.has(r) && !(r in BELUM_DIBANGUN));
    expect(hilang).toEqual([]);
  });

  it('yang dinyatakan belum dibangun memang belum punya rute', () => {
    // Arah sebaliknya: begitu layarnya dibangun, barisnya WAJIB dihapus dari
    // daftar di atas. Tanpa pemeriksaan ini, daftar pengecualian akan
    // menyembunyikan menu yang sebenarnya sudah berfungsi.
    const sudahAda = Object.keys(BELUM_DIBANGUN).filter((r) => ruteRouter.has(r));
    expect(sudahAda).toEqual([]);
  });

  it('setiap pengecualian menyebutkan alasannya', () => {
    for (const [rute, alasan] of Object.entries(BELUM_DIBANGUN)) {
      expect([rute, alasan.length > 40]).toEqual([rute, true]);
    }
  });

  it('setiap rute berparameter berada di bawah rute daftarnya', () => {
    // Rincian yang jalurnya tidak bersarang di bawah daftarnya akan kehilangan
    // penanda menu aktif pada sidebar: petugas yang membuka satu permohonan
    // melihat menu yang tidak tersorot, dan tidak lagi tahu ia sedang di bagian
    // mana.
    for (const r of ruteBerparameter) {
      const induk = r.slice(0, r.indexOf('/:'));
      expect([r, ruteRouter.has(induk)]).toEqual([r, true]);
    }
  });

  it('tidak ada rute router yang tidak punya menunya', () => {
    // Arah sebaliknya. Rute tanpa menu bukan kesalahan berbahaya, tetapi ia
    // halaman yang tidak dapat dicapai siapa pun lewat antarmuka — dan halaman
    // yang tidak dapat dicapai tidak pernah diperiksa ketika ia rusak.
    const menu = new Set(ruteMenu);
    const yatim = [...ruteRouter].filter((r) => !menu.has(r));
    expect(yatim).toEqual([]);
  });
});
