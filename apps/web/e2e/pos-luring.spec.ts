/**
 * Uji perilaku kasir ketika peladen tidak menjawab.
 *
 * Uji satuan sudah menjaga aturannya — kapan salinan dianggap basi, keadaan mana
 * yang disebut `TERBATAS` — tetapi aturan yang benar pada berkas terpisah tidak
 * membuktikan apa pun tentang layar yang sebenarnya dipakai kasir. Yang diuji di
 * sini hanya yang tidak dapat dijangkau uji satuan:
 *
 * - **Service worker benar-benar terdaftar** dan cangkang aplikasi benar-benar
 *   tercache. Tanpa itu, seluruh berkas manifest hanya hiasan.
 * - **Katalog benar-benar mendarat di IndexedDB**, bukan sekadar dimintakan.
 * - **Layar berubah ketika peladen berhenti menjawab** — dan berubah menjadi
 *   keterangan yang menyebutkan akibatnya, bukan sekadar lencana berwarna.
 * - **Barang yang dipindai luring dilaporkan BELUM masuk keranjang.** Kasir yang
 *   mengira barangnya sudah tercatat akan menagih pembeli untuk barang yang tidak
 *   pernah ada di transaksi.
 *
 * Dijalankan terhadap hasil build (`E2E_BASE_URL` menunjuk `vite preview`), sebab
 * service worker tidak dibangun pada server pengembangan.
 */

import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

interface FixturePos {
  username: string;
  password: string;
  productName: string;
  barcode: string;
  unitPrice: number;
}

const BERKAS = process.env.E2E_POS_FIXTURE ?? '.playwright/pos-fixture.json';
const fixture: FixturePos | null = existsSync(BERKAS)
  ? (JSON.parse(readFileSync(BERKAS, 'utf8')) as FixturePos)
  : null;

test.skip(
  ({ viewport }) => Boolean(viewport && viewport.width < 900),
  'Layar kasir menyasar desktop dan tablet lanskap, bukan ponsel (perintah prioritas §20).',
);

test.skip(
  !fixture,
  'Fixture POS tidak ada. Jalankan: node apps/api/scripts/e2e-pos-fixture.mjs setup',
);

/*
 * Hanya berjalan terhadap hasil build.
 *
 * `devOptions.enabled` sengaja `false`: service worker yang aktif pada server
 * pengembangan menyajikan berkas lama sesudah setiap penyuntingan, dan jam-jam
 * yang habis mengejar perubahan yang "tidak muncul" tidak sebanding dengan apa
 * pun yang didapat. Akibatnya uji ini tidak dapat berjalan di sana, dan itu
 * dikatakan apa adanya, bukan disamarkan menjadi lulus.
 *
 * Dua keadaan menyajikan hasil build, dan **keduanya** harus disebut:
 * `E2E_BASE_URL` menunjuk `vite preview` yang sudah berjalan, atau `CI` yang
 * membuat `playwright.config.ts` menjalankan `pnpm preview` sendiri. Semula
 * hanya yang pertama yang diperiksa — dan akibatnya seluruh berkas ini
 * dilewati diam-diam pada CI, tempat ia justru paling dibutuhkan. Rangkaian uji
 * yang hijau karena tidak pernah berjalan lebih buruk daripada tidak ada.
 */
test.skip(
  !process.env.E2E_BASE_URL && !process.env.CI,
  'Service worker hanya ada pada hasil build. Jalankan `vite preview` lalu setel E2E_BASE_URL.',
);

async function masukSebagaiKasir(page: Page): Promise<void> {
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
      if (percobaan === 3) throw e;
      await page.waitForTimeout(20_000);
    }
  }
}

async function bukaKasir(page: Page): Promise<void> {
  const drawer = page.getByRole('button', { name: 'Menu', exact: true });
  if (await drawer.isVisible().catch(() => false)) await drawer.click();
  const tautan = page.getByRole('link', { name: /^Kasir \/ POS( |$)/ }).first();
  await tautan.scrollIntoViewIfNeeded();
  await tautan.click();
  await expect(page).toHaveURL(/\/app\/pos/, { timeout: 20_000 });
  await expect(page.getByLabel('Outlet')).toBeVisible({ timeout: 20_000 });
}

/** Membaca salinan katalog dari IndexedDB sebagaimana adanya di mesin itu. */
async function salinanDiMesin(page: Page): Promise<{
  ada: boolean;
  jumlahProduk: number;
  barcodeAda: boolean;
  truncated: boolean;
} | null> {
  return page.evaluate(async (barcode: string) => {
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open('ebisnis-pos-katalog', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => resolve(null);
    });
    if (!db) return null;
    const isi = await new Promise<Record<string, unknown> | undefined>((resolve) => {
      const tx = db.transaction('snapshot', 'readonly');
      const r = tx.objectStore('snapshot').get('aktif');
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => resolve(undefined);
    });
    db.close();
    if (!isi) return { ada: false, jumlahProduk: 0, barcodeAda: false, truncated: false };
    const produk = (isi.produk ?? []) as Array<{ barcodes: string[] }>;
    return {
      ada: true,
      jumlahProduk: produk.length,
      barcodeAda: produk.some((p) => (p.barcodes ?? []).includes(barcode)),
      truncated: Boolean(isi.truncated),
    };
  }, fixture!.barcode);
}

/**
 * Memutus peladen tanpa memutus jaringan.
 *
 * Inilah keadaan yang paling sering terjadi di lapangan dan paling menyesatkan
 * bila tidak dibedakan: router menyala, langganan internetnya yang mati.
 * `context.setOffline` tidak dapat menirunya — ia mematikan jaringan sekaligus,
 * sehingga `navigator.onLine` ikut berubah dan bedanya justru hilang.
 */
async function putuskanPeladen(page: Page): Promise<void> {
  await page.route('**/health', (r) => r.abort());
  await page.route('**/api/v1/**', (r) => r.abort());
}

let halaman: Page;

async function pastikanSesi(browser: Browser): Promise<void> {
  if (halaman && !halaman.isClosed()) return;
  const konteks = await browser.newContext({ locale: 'id-ID' });
  halaman = await konteks.newPage();
  await masukSebagaiKasir(halaman);
  await bukaKasir(halaman);
}

test.beforeEach(async ({ browser }: { browser: Browser }) => {
  if (!fixture || (!process.env.E2E_BASE_URL && !process.env.CI)) return;
  await pastikanSesi(browser);
});

test.afterAll(async () => {
  if (halaman && !halaman.isClosed()) await halaman.context().close();
});

test.describe('Kasir saat peladen tidak menjawab', () => {
  test.describe.configure({ mode: 'serial' });

  test('service worker terdaftar dan cangkang aplikasi tercache', async () => {
    const hasil = await halaman.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const nama = await caches.keys();
      let berkas = 0;
      for (const n of nama) berkas += (await (await caches.open(n)).keys()).length;
      return { aktif: Boolean(reg.active), scope: reg.scope, cache: nama.length, berkas };
    });
    expect(hasil.aktif).toBe(true);
    // Cakupan harus akar, bukan `/app/pos`. Kasir yang menutup lalu membuka
    // aplikasinya mendarat di `/` lebih dahulu; service worker bercakupan sempit
    // tidak akan melayaninya dan halaman galat peramban yang muncul.
    expect(hasil.scope).toMatch(/\/$/);
    expect(hasil.berkas).toBeGreaterThan(20);
  });

  test('katalog tersalin ke mesin ini beserta barcodenya', async () => {
    await expect
      .poll(async () => (await salinanDiMesin(halaman))?.ada, { timeout: 30_000 })
      .toBe(true);

    const salinan = await salinanDiMesin(halaman);
    expect(salinan!.jumlahProduk).toBeGreaterThan(0);
    // Barcode yang dipakai kasir memindai harus ada di salinan. Salinan yang
    // lengkap produknya tetapi kehilangan barcode alternatif akan menolak barang
    // yang di peladen dikenali — dan kasir tidak akan tahu sebabnya.
    expect(salinan!.barcodeAda).toBe(true);
  });

  test('lencana berubah dan menyebutkan akibatnya ketika peladen berhenti menjawab', async () => {
    await putuskanPeladen(halaman);
    await halaman.getByRole('button', { name: /periksa lagi/i }).click();

    const lencana = halaman.getByRole('status').filter({ hasText: /peladen tidak menjawab/i });
    await expect(lencana).toBeVisible({ timeout: 20_000 });

    // Lencana berwarna saja tidak memberitahu kasir apa yang harus dilakukannya.
    await expect(
      halaman.getByText(/transaksi disimpan di mesin ini|peladen tidak menjawab/i).first(),
    ).toBeVisible();
  });

  test('daftar produk dilayani dari salinan, dan layar mengatakannya', async () => {
    await expect(
      halaman.getByText(/dari salinan di mesin ini/i),
    ).toBeVisible({ timeout: 20_000 });

    /*
     * Dicari menurut nama, bukan mengandalkan barang itu kebetulan muncul pada
     * ubin favorit. Pencarian inilah yang sebenarnya dipakai kasir saat ditanya
     * "berapa harga ini?" — dan pencarian itu harus bekerja dari salinan lokal,
     * tanpa satu pun permintaan ke peladen.
     */
    await halaman.getByLabel(/cari produk/i).fill(fixture!.productName);

    // Ubin tetap terlihat supaya harga dapat diperiksa, tetapi tidak dapat
    // ditekan: memasukkan ke keranjang masih menuntut peladen.
    const ubin = halaman.getByRole('button', { name: new RegExp(fixture!.productName, 'i') }).first();
    await expect(ubin).toBeVisible({ timeout: 20_000 });
    await expect(ubin).toBeDisabled();

    // Harganya benar-benar terbaca, bukan sekadar ubinnya ada.
    await expect(ubin).toContainText(String(fixture!.unitPrice).slice(0, 2));
  });

  test('memindai barcode luring melaporkan barangnya BELUM masuk keranjang', async () => {
    const kotak = halaman.getByLabel(/kotak pindai barcode/i);
    await kotak.fill(fixture!.barcode);
    await kotak.press('Enter');

    /*
     * Dua hal wajib ada pada satu pesan: nama barangnya — itu yang ditanyakan
     * pembeli — dan penegasan bahwa barangnya belum tercatat. Menyebut namanya
     * saja membuat kasir mengira transaksinya sudah masuk, lalu menagih untuk
     * barang yang tidak pernah ada di keranjang.
     */
    const pesan = halaman.getByText(new RegExp(fixture!.productName, 'i')).last();
    await expect(pesan).toBeVisible({ timeout: 20_000 });
    await expect(halaman.getByText(/BELUM masuk keranjang/i)).toBeVisible();
  });

  test('barcode yang tidak ada di salinan dibedakan dari barcode yang tidak ada sama sekali', async () => {
    const kotak = halaman.getByLabel(/kotak pindai barcode/i);
    await kotak.fill('0000000000000');
    await kotak.press('Enter');

    // Bukan "barcode tidak dikenali": saat luring, layar ini tidak tahu itu.
    // Yang diketahuinya hanyalah bahwa barangnya tidak ada pada salinannya.
    await expect(
      halaman.getByText(/tidak ada pada salinan di mesin ini/i),
    ).toBeVisible({ timeout: 20_000 });
  });
});
