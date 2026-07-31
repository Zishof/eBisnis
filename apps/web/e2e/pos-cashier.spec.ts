/**
 * Uji layar kasir sebagaimana kasir mengalaminya.
 *
 * Tiga naskah bukti yang sudah ada menguji API dengan sungguh-sungguh — 113
 * pemeriksaan — tetapi tidak satu pun menekan tombol. Yang tidak terjangkau
 * olehnya persis hal-hal yang paling sering rusak pada layar kasir:
 *
 * - **Fokus kembali ke kotak pindai.** Pemindai barcode mengetik lalu menekan
 *   Enter; bila fokus berpindah sesudah barang masuk, pindaian berikutnya
 *   mendarat di tempat yang salah dan kasir baru menyadarinya beberapa barang
 *   kemudian.
 * - **Tombol yang seharusnya mati.** Bayar sebelum ada barang, atau sebelum
 *   shift dibuka.
 * - **Angka di layar sama dengan angka di peladen.** Layar yang menghitung
 *   sendiri akan berbeda pada kasus yang jarang, dan pembeli membaca layar.
 *
 * Datanya disiapkan `apps/api/scripts/e2e-pos-fixture.mjs` melalui
 * `globalSetup`, dan dibersihkan lagi pada `globalTeardown`. Tidak ada
 * kredensial yang tersimpan di repositori.
 */

import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

interface FixturePos {
  username: string;
  password: string;
  productName: string;
  barcode: string;
  unitPrice: number;
  paymentMethodName: string;
}

const BERKAS = process.env.E2E_POS_FIXTURE ?? '.playwright/pos-fixture.json';

function bacaFixture(): FixturePos | null {
  if (!existsSync(BERKAS)) return null;
  return JSON.parse(readFileSync(BERKAS, 'utf8')) as FixturePos;
}

const fixture = bacaFixture();

/*
 * Layar kasir tidak diuji pada ponsel.
 *
 * Perintah prioritas §20 menyebut sasarannya secara tegas: meja kasir desktop,
 * tablet lanskap, layar sentuh, papan ketik, dan pemindai barcode. Ponsel
 * 375 piksel tidak termasuk — pada lebar itu keranjang tidak dapat tetap
 * terlihat bersamaan dengan katalog, dan keduanya harus terlihat bersamaan.
 *
 * Dilewati dengan keterangan, bukan dipaksa lulus dengan tata letak yang tidak
 * pernah dipakai siapa pun. Bila kelak POS ponsel benar-benar dijanjikan,
 * baris ini yang dihapus lebih dahulu.
 */
test.skip(
  ({ viewport }) => Boolean(viewport && viewport.width < 900),
  'Layar kasir menyasar desktop dan tablet lanskap, bukan ponsel (perintah prioritas §20).',
);

/*
 * Tanpa fixture, seluruh berkas ini dilewati dengan keterangan — bukan gagal.
 * Uji yang merah karena datanya belum disiapkan tidak memberitahu apa pun
 * tentang mutu kodenya, dan lama-lama membuat orang mengabaikan warna merah.
 */
test.skip(
  !fixture,
  'Fixture POS tidak ada. Jalankan: node apps/api/scripts/e2e-pos-fixture.mjs setup',
);

/** Masuk sebagai kasir uji. */
async function masukSebagaiKasir(page: Page): Promise<void> {
  const f = fixture!;
  await page.goto('/masuk');
  await page.getByLabel(/nama pengguna atau surel/i).fill(f.username);
  await page.getByLabel(/^kata sandi$/i).fill(f.password);
  await page.getByRole('button', { name: /^masuk$/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

/**
 * Membuka satu menu lewat routing sisi klien.
 *
 * `page.goto` sengaja TIDAK dipakai. Token akses disimpan di memori, bukan di
 * penyimpanan peramban, sehingga muat ulang penuh membuang sesinya dan halaman
 * kembali ke situs publik — persis yang terjadi pada percobaan pertama uji ini.
 * Aturan yang sama sudah dicatat pada `auth-and-erp.spec.ts`.
 */
async function bukaMenu(page: Page, label: string): Promise<void> {
  const drawer = page.getByRole('button', { name: 'Menu', exact: true });
  if (await drawer.isVisible().catch(() => false)) {
    await drawer.click();
  }
  const tautan = page.getByRole('link', { name: new RegExp(`^${label}( |$)`) }).first();
  await tautan.scrollIntoViewIfNeeded();
  await tautan.click();
}

/** Membuka layar kasir dan menunggu batang konteksnya siap. */
async function bukaKasir(page: Page): Promise<void> {
  await bukaMenu(page, 'Kasir / POS');
  await expect(page).toHaveURL(/\/app\/pos/, { timeout: 20_000 });
  await expect(page.getByLabel('Outlet')).toBeVisible({ timeout: 20_000 });
}

/** Membuka shift bila belum terbuka. */
async function pastikanShiftTerbuka(page: Page): Promise<void> {
  const tombolBuka = page.getByRole('button', { name: /buka shift/i });
  if (await tombolBuka.isVisible().catch(() => false)) {
    await page.getByLabel(/kas awal/i).fill('500000');
    await tombolBuka.click();
  }
  await expect(page.getByRole('button', { name: /tutup shift/i })).toBeVisible({ timeout: 20_000 });
}

/** Membuka keranjang baru bila belum ada. */
async function pastikanKeranjang(page: Page): Promise<void> {
  const tombol = page.getByRole('button', { name: /keranjang baru/i });
  if (await tombol.isVisible().catch(() => false)) {
    await tombol.click();
  }
  await expect(page.getByLabel(/kotak pindai barcode/i)).toBeEnabled({ timeout: 20_000 });
}

/*
 * Satu sesi untuk seluruh berkas.
 *
 * Semula setiap uji masuk sendiri-sendiri, dan uji ketujuh mulai gagal tanpa
 * sebab yang jelas: pembatas laju masuk menolak percobaan kesebelas dalam satu
 * menit. Pembatas itu bekerja sebagaimana mestinya — yang keliru adalah ujinya.
 *
 * Sesi tunggal juga lebih menyerupai kenyataan: kasir masuk sekali pada awal
 * shift, bukan sekali untuk setiap barang yang dipindainya.
 */
let halaman: Page;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  if (!fixture) return;
  const konteks = await browser.newContext({ locale: 'id-ID' });
  halaman = await konteks.newPage();
  await masukSebagaiKasir(halaman);
});

test.afterAll(async () => {
  await halaman?.context().close();
});

test.describe('Layar kasir', () => {
  // Alur kasir bersifat berurutan: shift, keranjang, barang, bayar. Menjalankan
  // uji secara paralel pada satu register akan membuat keduanya berebut shift
  // yang sama — dan aturan "satu shift terbuka per register" memang benar.
  test.describe.configure({ mode: 'serial' });

  test('menolak masuk tanpa sesi', async ({ page }) => {
    // Uji ini sengaja memakai halaman barunya sendiri: yang diuji justru
    // ketiadaan sesi.
    await page.goto('/app/pos');
    await expect(page).toHaveURL(/\/masuk/);
  });

  test('shift harus dibuka sebelum keranjang dapat dibuat', async () => {
    await bukaKasir(halaman);

    // Sebelum shift dibuka, layar mengatakan apa yang harus dilakukan alih-alih
    // hanya menonaktifkan tombolnya tanpa keterangan.
    const tombolKeranjang = halaman.getByRole('button', { name: /keranjang baru/i });
    const adaTombolBukaShift = await halaman
      .getByRole('button', { name: /buka shift/i })
      .isVisible()
      .catch(() => false);

    if (adaTombolBukaShift) {
      await expect(halaman.getByText(/buka shift terlebih dahulu/i)).toBeVisible();
      await expect(tombolKeranjang).toBeDisabled();
    }

    await pastikanShiftTerbuka(halaman);
    await expect(tombolKeranjang).toBeEnabled();});

  test('memindai barcode memasukkan barang, dan fokus kembali ke kotak pindai', async () => {
    const f = fixture!;
    await bukaKasir(halaman);
    await pastikanShiftTerbuka(halaman);
    await pastikanKeranjang(halaman);

    const kotak = halaman.getByLabel(/kotak pindai barcode/i);
    await kotak.fill(f.barcode);
    await kotak.press('Enter');

    await expect(halaman.getByText(f.productName)).toBeVisible({ timeout: 20_000 });

    /*
     * Inti pengujian ini. Pemindai mengirim kode lalu Enter tanpa menyentuh
     * apa pun; bila fokus tidak kembali, barang kedua tidak akan pernah masuk.
     */
    await expect(kotak).toBeFocused();
    await expect(kotak).toHaveValue('');});

  test('total di layar sama dengan harga dikali jumlah', async () => {
    const f = fixture!;
    await bukaKasir(halaman);
    await pastikanShiftTerbuka(halaman);
    await pastikanKeranjang(halaman);

    const kotak = halaman.getByLabel(/kotak pindai barcode/i);
    await kotak.fill(f.barcode);
    await kotak.press('Enter');
    await expect(halaman.getByText(f.productName)).toBeVisible({ timeout: 20_000 });

    // Menaikkan menjadi tiga lewat tombol, seperti kasir menambah barang yang
    // sama alih-alih memindainya berulang.
    await halaman.getByRole('button', { name: 'Tambah' }).first().click();
    await halaman.getByRole('button', { name: 'Tambah' }).first().click();

    await expect(halaman.getByText('3', { exact: true }).first()).toBeVisible();

    // 3 × 10.000 = 30.000. Angka ini dihitung peladen; layar hanya menampilkan.
    const total = halaman.locator('dd').filter({ hasText: /30\.000/ });
    await expect(total.first()).toBeVisible({ timeout: 15_000 });});

  test('tombol bayar mati selama keranjang kosong', async () => {
    await bukaKasir(halaman);
    await pastikanShiftTerbuka(halaman);
    await pastikanKeranjang(halaman);

    await expect(halaman.getByRole('button', { name: /bayar/i })).toBeDisabled();});

  test('alur penuh: pindai, bayar tunai, struk terbit', async () => {
    const f = fixture!;
    await bukaKasir(halaman);
    await pastikanShiftTerbuka(halaman);
    await pastikanKeranjang(halaman);

    const kotak = halaman.getByLabel(/kotak pindai barcode/i);
    await kotak.fill(f.barcode);
    await kotak.press('Enter');
    await expect(halaman.getByText(f.productName)).toBeVisible({ timeout: 20_000 });

    await halaman.getByRole('button', { name: /bayar/i }).click();

    const dialog = halaman.getByRole('dialog', { name: /pembayaran/i });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: f.paymentMethodName }).click();
    await dialog.getByRole('button', { name: /terima pembayaran/i }).click();

    // Layar menyatakan uang sudah diterima, lalu meminta penyelesaian —
    // dua langkah dengan sengaja, karena penyelesaian memotong stok dan
    // membentuk jurnal.
    await expect(dialog.getByText(/pembayaran diterima/i)).toBeVisible({ timeout: 20_000 });

    await dialog.getByRole('button', { name: /selesaikan dan cetak struk/i }).click();

    // Nomor struk muncul pada pesan keberhasilan. Bukti bahwa seluruh batas
    // penyelesaian berjalan: stok terpotong, jurnal terbentuk, struk terbit.
    await expect(halaman.getByText(/transaksi selesai\. struk/i)).toBeVisible({ timeout: 30_000 });

    // Keranjang kembali kosong dan siap melayani pembeli berikutnya.
    await expect(halaman.getByText(/belum ada barang/i)).toBeVisible({ timeout: 15_000 });});

  test('barcode yang tidak dikenal ditolak dengan keterangan, bukan diam', async () => {
    await bukaKasir(halaman);
    await pastikanShiftTerbuka(halaman);
    await pastikanKeranjang(halaman);

    const kotak = halaman.getByLabel(/kotak pindai barcode/i);
    await kotak.fill('0000000000000');
    await kotak.press('Enter');

    // Pesan dari peladen ditampilkan apa adanya: ia sudah ditulis untuk dibaca
    // kasir, dan menyebutkan apa yang harus dilakukan berikutnya.
    await expect(halaman.getByText(/tidak dikenali/i)).toBeVisible({ timeout: 20_000 });

    // Fokus tetap di kotak pindai supaya kasir dapat langsung mencoba lagi.
    await expect(kotak).toBeFocused();
    await expect(kotak).toHaveValue('');});

  test('menahan keranjang mengosongkan layar tanpa kehilangan transaksinya', async () => {
    const f = fixture!;
    await bukaKasir(halaman);
    await pastikanShiftTerbuka(halaman);
    await pastikanKeranjang(halaman);

    const kotak = halaman.getByLabel(/kotak pindai barcode/i);
    await kotak.fill(f.barcode);
    await kotak.press('Enter');
    await expect(halaman.getByText(f.productName)).toBeVisible({ timeout: 20_000 });

    await halaman.getByRole('button', { name: /^tahan$/i }).click();
    await expect(halaman.getByText(/keranjang ditahan/i)).toBeVisible({ timeout: 20_000 });

    // Layar siap untuk pembeli berikutnya.
    await expect(halaman.getByRole('button', { name: /keranjang baru/i })).toBeVisible();});
});

test.describe('Laporan kasir', () => {
  test('halaman laporan menampilkan rentang dan jumlah baris', async () => {
    await bukaKasir(halaman);
    await bukaMenu(halaman, 'Laporan');

    await expect(halaman.getByRole('heading', { name: /laporan kasir/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(halaman.getByLabel(/^laporan$/i)).toBeVisible();
    await expect(halaman.getByLabel(/^dari$/i)).toBeVisible();
    await expect(halaman.getByLabel(/^sampai$/i)).toBeVisible();

    // Ringkasan menyebutkan rentang dan jumlah baris, sehingga pembaca tahu
    // laporan kosong berarti tidak ada transaksi — bukan gagal memuat.
    await expect(halaman.getByText(/hari\) ·/)).toBeVisible({ timeout: 20_000 });});
});
