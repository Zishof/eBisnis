/**
 * Uji peramban layar kesehatan.
 *
 * ## Yang tidak terjangkau uji lain
 *
 * Naskah bukti API memeriksa peladen; uji komponen memeriksa komponen terhadap
 * perlengkapan yang ditulis penulisnya sendiri. Di antara keduanya ada celah
 * yang sudah pernah menelan cacat sungguhan:
 *
 * Pada W-1, `CoveragePage` membaca `percentage` dan `shortfall` sementara
 * peladen mengirim `coverage`, `gap`, dan `message`. Halamannya melempar
 * TypeError dan kosong sama sekali — dan **enam uji komponennya lulus**, sebab
 * perlengkapan yang keliru dan kode yang keliru saling menyetujui.
 *
 * Berkas ini menutup celah itu dengan cara yang paling langsung: membuka tiap
 * layar di peramban sungguhan, terhadap peladen sungguhan, lalu memeriksa
 * **galat konsol**. Halaman yang melempar TypeError tidak dapat menyembunyikannya
 * di sini.
 *
 * ## Yang diperiksa tiap layar
 *
 *   1. utasnya benar-benar berpindah ke sana (rute terdaftar),
 *   2. ada judul yang terlihat — bukan halaman kosong,
 *   3. tidak ada galat konsol,
 *   4. tidak ada pesan penolakan hak akses.
 *
 * Yang keempat penting: pengguna fixture memegang sembilan peran kesehatan, jadi
 * penolakan di sini berarti layar menuntut hak yang tidak dimiliki peran mana
 * pun yang wajar — bukan sekadar fixture yang kurang lengkap.
 *
 * Datanya disiapkan `apps/api/scripts/e2e-health-fixture.mjs`. Tidak ada
 * kredensial yang tersimpan di repositori.
 */

import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface FixtureKesehatan {
  username: string;
  password: string;
  facilityId: string;
  facilityCode: string;
  roles: string[];
}

const BERKAS = process.env.E2E_HEALTH_FIXTURE ?? '.playwright/health-fixture.json';

function bacaFixture(): FixtureKesehatan | null {
  if (!existsSync(BERKAS)) return null;
  return JSON.parse(readFileSync(BERKAS, 'utf8')) as FixtureKesehatan;
}

const fixture = bacaFixture();

test.skip(
  !fixture,
  'Fixture kesehatan tidak ada. Jalankan: node apps/api/scripts/e2e-health-fixture.mjs setup',
);

/**
 * Layar yang dibuka, beserta sebab layar itu ada.
 *
 * Utasnya disalin dari basis data (`demo.menu`), bukan ditulis dari ingatan.
 * Utas yang ditebak tidak menghasilkan galat kompilasi — ia menghasilkan
 * halaman kosong yang tampak seperti cacat antarmuka.
 */
const LAYAR: Array<{ utas: string; judul: string; kerja: string }> = [
  { utas: '/app/emedik/pasien', judul: 'Pasien', kerja: 'petugas pendaftaran mencari pasien' },
  // Judul layarnya "Farmasi", bukan "Resep" seperti nama menunya.
  { utas: '/app/emedik/resep', judul: 'Farmasi', kerja: 'apoteker menelaah resep masuk' },
  { utas: '/app/emedik/pemberian', judul: 'Pemberian Obat', kerja: 'perawat memberi obat menurut eMAR' },
  { utas: '/app/emedik/koding', judul: 'Pengkodean Rekam Medis', kerja: 'koder mengoding kunjungan selesai' },
  { utas: '/app/emedik/klaim', judul: 'Klaim', kerja: 'petugas klaim menyusun berkas klaim' },
  { utas: '/app/emedik/kunjungan-rumah', judul: 'Kunjungan Rumah', kerja: 'petugas puskesmas menyusun rute kunjungan' },
  { utas: '/app/emedik/pertumbuhan', judul: 'Pertumbuhan Anak', kerja: 'penimbangan balita di posyandu' },
  { utas: '/app/emedik/imunisasi', judul: 'Imunisasi', kerja: 'jadwal dan pemberian imunisasi' },
  { utas: '/app/emedik/mutu', judul: 'Indikator Mutu', kerja: 'manajer mutu membaca indikator' },
  { utas: '/app/emedik/keselamatan', judul: 'Keselamatan Pasien', kerja: 'insiden keselamatan pasien' },
  // Judulnya menyebut keamanan pula; nama menunya hanya "Pemeliharaan Alat".
  { utas: '/app/emedik/pemeliharaan-alat', judul: 'Pemeliharaan dan Keamanan Alat', kerja: 'teknisi biomedis mengerjakan perintah kerja' },
];

/**
 * Judul di atas DISALIN dari layar yang berjalan, bukan dari nama menunya.
 *
 * Dua di antaranya memang berbeda dari nama menu — `resep` berjudul "Farmasi",
 * dan `pemeliharaan-alat` menyebut keamanan pula. Menuliskan nama menu di sini
 * akan membuat dua uji gagal karena alasan yang tidak ada hubungannya dengan
 * mutu layarnya.
 */

/**
 * Masuk sebagai petugas uji, dengan kesabaran terhadap pembatas laju.
 *
 * Polanya sama seperti `pos-cashier.spec.ts`, dan alasannya sama: melonggarkan
 * pembatasnya akan menghilangkan perlindungan yang memang diinginkan, sementara
 * menunggu adalah yang dilakukan orang sungguhan.
 */
async function masuk(page: Page): Promise<void> {
  const f = fixture!;
  for (let percobaan = 1; percobaan <= 3; percobaan += 1) {
    await page.goto('/masuk');
    await page.getByLabel(/nama pengguna atau surel/i).fill(f.username);
    await page.getByLabel(/^kata sandi$/i).fill(f.password);
    await page.getByRole('button', { name: /^masuk$/i }).click();
    try {
      await page.waitForURL(/\/app/, { timeout: 20_000 });
      return;
    } catch (e) {
      const pesan = await page.getByRole('alert').first().textContent().catch(() => null);
      const dibatasi = /terlalu banyak|too many|coba lagi/i.test(pesan ?? '');
      if (!dibatasi || percobaan === 3) {
        throw new Error(`Masuk gagal pada percobaan ${percobaan}` + (pesan ? `: ${pesan.trim()}` : ''), { cause: e });
      }
      await page.waitForTimeout(20_000);
    }
  }
}

/**
 * Berpindah layar lewat routing sisi klien.
 *
 * `page.goto` sengaja TIDAK dipakai. Token akses disimpan di memori, sehingga
 * muat ulang penuh membuang sesinya dan halaman kembali ke situs publik.
 * Aturan yang sama sudah dicatat pada `auth-and-erp.spec.ts` dan
 * `pos-cashier.spec.ts`.
 */
async function bukaLayar(page: Page, utas: string): Promise<void> {
  await page.evaluate((jalan) => {
    window.history.pushState({}, '', jalan);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, utas);
}

test.describe('Layar kesehatan', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;
  const galatKonsol: string[] = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    /*
     * Galat konsol dikumpulkan sepanjang berkas ini, bukan per-uji, sebab
     * halaman yang sama dipakai berturut-turut. Tiap uji memeriksa apa yang
     * bertambah SELAMA dirinya berjalan.
     */
    page.on('console', (m) => {
      if (m.type() === 'error') galatKonsol.push(m.text());
    });
    page.on('pageerror', (e) => galatKonsol.push(`pageerror: ${e.message}`));

    await masuk(page);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  for (const layar of LAYAR) {
    test(`${layar.judul} terbuka tanpa galat — ${layar.kerja}`, async () => {
      const sebelum = galatKonsol.length;
      await bukaLayar(page, layar.utas);

      // Utasnya benar-benar berpindah; rute yang tidak terdaftar akan tertahan.
      await expect(page).toHaveURL(new RegExp(layar.utas.replace(/\//g, '\\/')));

      /*
       * Judul layar ini SENDIRI, bukan judul apa pun.
       *
       * Percobaan pertama hanya menuntut "ada judul yang terlihat", dan kendali
       * negatif membuktikannya tidak berguna: rute karangan pun lulus, sebab
       * rute /app/emedik/* yang tidak dikenal jatuh ke Command Center yang
       * judulnya banyak. Uji yang tidak dapat gagal tidak membuktikan apa pun.
       */
      await expect(page.getByRole('heading', { name: layar.judul, exact: true }).first())
        .toBeVisible({ timeout: 20_000 });

      /* Penolakan hak akses disebut apa adanya, bukan dibiarkan tampak sebagai
       * layar kosong. */
      const penolakan = page.getByText(/tidak berwenang|tidak memiliki hak|akses ditolak/i);
      await expect(penolakan).toHaveCount(0);

      const baru = galatKonsol.slice(sebelum);
      /*
       * Galat jaringan yang bukan salah layar disaring — 404 pada data yang
       * memang belum ada bukan cacat antarmuka. Yang TIDAK disaring: TypeError
       * dan kawan-kawannya, yang justru menjadi sebab halaman kosong pada W-1.
       */
      const berarti = baru.filter((g) => !/Failed to load resource|404|favicon/i.test(g));
      expect(berarti, `galat konsol saat membuka ${layar.utas}:\n${berarti.join('\n')}`).toHaveLength(0);
    });
  }

  /**
   * Kendali negatif — dan sebabnya ia tetap tinggal di sini.
   *
   * Rangkaian uji di atas semula hanya menuntut "ada judul yang terlihat", dan
   * kendali inilah yang membuktikan tuntutan itu kosong: rute karangan pun
   * lulus. Sebabnya setiap rute `/app/emedik/*` yang tidak dikenal jatuh ke
   * Command Center — bukan ke halaman "tidak ditemukan" — dan Command Center
   * punya banyak judul.
   *
   * Selama perilaku itu bertahan, uji ini yang menjaga agar asersi di atas
   * tidak pernah kembali melemah tanpa ketahuan.
   */
  test('rute kesehatan karangan TIDAK menampilkan layar mana pun', async () => {
    await bukaLayar(page, '/app/emedik/rute-yang-tidak-ada');
    for (const layar of LAYAR) {
      await expect(
        page.getByRole('heading', { name: layar.judul, exact: true }),
        `rute karangan menampilkan layar ${layar.judul}`,
      ).toHaveCount(0);
    }
    /*
     * Yang sebenarnya tampil dicatat apa adanya. Menuliskannya sebagai halaman
     * "tidak ditemukan" akan membuat uji ini berbohong tentang perilaku yang
     * sesungguhnya — dan orang yang mengikuti penanda buku usang memang mendarat
     * di beranda modul tanpa diberitahu bahwa halamannya tidak ada.
     */
    await expect(page.getByRole('heading', { name: 'Command Center eMedik', exact: true })).toBeVisible();
  });
});
