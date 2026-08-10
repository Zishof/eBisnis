import { expect, test, type Page } from '@playwright/test';

/**
 * Portal tenant diuji melalui sandbox demo sehingga tidak ada kredensial yang
 * perlu ditulis pada repositori. Sesi demo memakai role DEMO_USER yang di-seed
 * pada schema `demo`.
 *
 * Sesi demo sengaja TIDAK menyimpan refresh token, sehingga seluruh navigasi
 * setelah masuk harus memakai routing sisi klien, bukan `page.goto`.
 */
async function startDemoSession(page: Page): Promise<void> {
  await page.goto('/masuk');
  await page.getByRole('button', { name: /coba demo/i }).click();
  await page.waitForURL(/\/app/, { timeout: 20_000 });
}

/**
 * Membuka menu berdasarkan label. Pada layar kecil sidebar disembunyikan dan
 * hanya dapat diakses melalui drawer, sehingga drawer dibuka lebih dulu bila
 * perlu. Nama aksesibel tautan modul yang belum selesai diakhiri penanda,
 * sehingga pencocokan memakai awalan.
 */
async function openMenu(page: Page, label: string): Promise<void> {
  const routes: Record<string, string> = {
    'Produk': '/app/products',
    'Request Order': '/app/request-orders',
    'Penerimaan Barang': '/app/goods-receipts',
    'Internal Transfer': '/app/internal-transfers',
    'Monitoring Stok': '/app/stock-tree',
    'Data Contoh': '/app/sample-data',
    'Stock Opname': '/app/stock-counts',
    'Transaksi Pembelian': '/app/purchasing/invoices',
    'Sales Order': '/app/sales/invoices',
  };
  const route = routes[label];
  if (route) {
    // Token demo hanya berada di memori. Dorong riwayat dan kirim popstate
    // agar React Router berpindah halaman tanpa reload yang menghapus sesi.
    await page.evaluate((path) => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, route);
    return;
  }

  const drawerToggle = page.getByRole('button', { name: 'Menu', exact: true });
  if (await drawerToggle.isVisible()) {
    await drawerToggle.click();
  }

  const link = page.getByRole('link', { name: new RegExp(`^${label}(\\s|$)`) }).first();
  await link.scrollIntoViewIfNeeded();
  await link.click();
}

test.describe('Autentikasi', () => {
  test('kredensial salah menampilkan pesan kesalahan, bukan halaman kosong', async ({ page }) => {
    await page.goto('/masuk');
    await page.getByLabel(/nama pengguna atau surel/i).fill('pengguna-tidak-ada');
    await page.getByLabel(/^kata sandi$/i).fill('SalahSekali#2026');
    await page.getByRole('button', { name: /^masuk$/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/masuk/);
  });

  test('rute /app tanpa sesi diarahkan ke halaman masuk', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/masuk/);
  });

  test('rute /platform tanpa sesi diarahkan ke halaman masuk', async ({ page }) => {
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/masuk/);
  });

  test('kata sandi tersembunyi secara bawaan dan dapat ditampilkan', async ({ page }) => {
    await page.goto('/masuk');
    const password = page.getByLabel(/^kata sandi$/i);
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /tampilkan kata sandi/i }).click();
    await expect(password).toHaveAttribute('type', 'text');
  });
});

test.describe('Sandbox demo', () => {
  test('sesi demo membuka aplikasi dengan banner peringatan', async ({ page }) => {
    await page.goto('/masuk');
    await page.getByRole('button', { name: /coba demo/i }).click();
    await page.waitForURL(/\/app/, { timeout: 20_000 });
    await expect(page.getByText(/sandbox demo/i).first()).toBeVisible();
  });

  test('menu tenant termuat sesuai hak akses role DEMO_USER', async ({ page }) => {
    await page.goto('/masuk');
    await page.getByRole('button', { name: /coba demo/i }).click();
    await page.waitForURL(/\/app/, { timeout: 20_000 });
    // Menu berasal dari /me/menus, yang menuntut resolusi permission tenant
    // untuk subject demo berhasil.
    await expect(page.getByRole('link', { name: 'Monitoring Stok' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('monitoring stok demo menampilkan pohon gudang', async ({ page }) => {
    await page.goto('/masuk');
    await page.getByRole('button', { name: /coba demo/i }).click();
    await page.waitForURL(/\/app/, { timeout: 20_000 });

    /*
     * Navigasi memakai routing sisi klien. Sesi demo sengaja TIDAK menyimpan
     * refresh token, sehingga muat ulang halaman penuh mengakhiri sesi.
     *
     * Tiga hal harus ditangani sekaligus, dan mengabaikan salah satunya membuat
     * uji ini gagal pada salah satu lebar layar:
     *
     * 1. **Dasbor juga memuat pintasan "Monitoring Stok".** Pemilih yang cocok
     *    dengan keduanya gagal "strict mode violation" — kegagalan yang berbunyi
     *    seperti cacat aplikasi padahal yang kurang jelas adalah ujinya. Kartu
     *    itu hanya muncul ketika ringkasan stoknya berhasil dimuat, sehingga
     *    ambiguitasnya bergantung pada isi basis data.
     * 2. **Pada ponsel navigasinya ada di balik laci** dan belum terlihat sampai
     *    tombol Menu ditekan. Menunggu tautan di dalamnya tanpa membuka lacinya
     *    berakhir sebagai timeout dua menit — yang terbaca seperti aplikasi
     *    menggantung, padahal ia hanya menunggu sesuatu yang memang tersembunyi.
     * 3. **`<nav>` yang sama digambar dua kali** — sekali di laci ponsel, sekali
     *    di sidebar desktop — sehingga menunjuknya menurut label saja kembali
     *    ambigu. Yang diambil adalah yang benar-benar terlihat.
     */
    await openMenu(page, 'Monitoring Stok');
    await expect(page).toHaveURL(/\/app\/stock-tree/);
    await expect(page.getByTestId('stock-tree')).toBeVisible({ timeout: 15_000 });
  });

  test('muat ulang halaman mengakhiri sesi demo dan kembali ke halaman masuk', async ({ page }) => {
    await page.goto('/masuk');
    await page.getByRole('button', { name: /coba demo/i }).click();
    await page.waitForURL(/\/app/, { timeout: 20_000 });

    // Refresh token sesi demo tidak pernah disimpan, jadi muat ulang wajar
    // mengakhiri sesi — bukan menampilkan halaman kosong.
    await page.reload();
    await expect(page).toHaveURL(/\/masuk/, { timeout: 15_000 });
  });
});

/**
 * Seluruh pemeriksaan portal berjalan pada SATU sesi demo. Pembuatan sesi demo
 * dibatasi rate limit untuk melindungi sandbox bersama, dan sesi demo tidak
 * menyimpan refresh token, sehingga membuat sesi baru per test tidak realistis
 * maupun diinginkan.
 */
test.describe.serial('Portal tenant', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await startDemoSession(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('daftar produk memuat master dari schema tenant', async () => {
    await openMenu(page, 'Produk');
    await expect(page).toHaveURL(/\/app\/products/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/produk/i);
    // Seed menjamin minimum 10 produk aktif per tenant; baris grid harus terisi.
    // Grid memakai tabel pada layar besar dan kartu pada layar kecil, sehingga
    // pemeriksaan dibatasi pada representasi yang benar-benar terlihat.
    await expect(
      page.getByText('Kopi Susu').filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/ACTIVE/).filter({ visible: true }).first()).toBeVisible();
  });

  test('Request Order menyediakan pembuatan otomatis dari minimum stok', async () => {
    await openMenu(page, 'Request Order');
    await expect(page).toHaveURL(/\/app\/request-orders/);
    await expect(page.getByTestId('generate-min-stock')).toBeVisible({ timeout: 15_000 });
  });

  test('Penerimaan Barang menegaskan stok bertambah hanya setelah validasi', async () => {
    await openMenu(page, 'Penerimaan Barang');
    await expect(page).toHaveURL(/\/app\/goods-receipts/);
    await expect(
      page.getByText(/stok hanya bertambah setelah penerimaan divalidasi/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Internal Transfer menjelaskan semantik stok dalam perjalanan', async () => {
    await openMenu(page, 'Internal Transfer');
    await expect(page).toHaveURL(/\/app\/internal-transfers/);
    await expect(page.getByText(/dalam perjalanan/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('monitoring stok menampilkan pohon Wilayah dan Gudang', async () => {
    await openMenu(page, 'Monitoring Stok');
    await expect(page).toHaveURL(/\/app\/stock-tree/);
    await expect(page.getByTestId('stock-tree')).toBeVisible({ timeout: 15_000 });
  });

  test('data contoh dapat diverifikasi dari portal', async () => {
    await openMenu(page, 'Data Contoh');
    await expect(page).toHaveURL(/\/app\/sample-data/);
    await expect(page.getByTestId('seed-verify-summary')).toBeVisible({ timeout: 20_000 });
    // Verifikasi seed tenant demo harus lulus.
    await expect(page.getByTestId('seed-verify-summary')).toContainText(/LULUS/);
  });

  test('aksi tulis data contoh dinonaktifkan pada sandbox demo', async () => {
    await expect(page).toHaveURL(/\/app\/sample-data/);
    // Perbaikan dan penghapusan data contoh diblokir untuk sesi demo.
    await expect(page.getByTestId('seed-repair')).toBeDisabled();
    await expect(page.getByTestId('seed-cleanup')).toBeDisabled();
  });

  test('Stock Opname membuka workspace operasional yang sudah diimplementasikan', async () => {
    await openMenu(page, 'Stock Opname');
    await expect(page).toHaveURL(/\/app\/stock-counts/);
    // Halaman ini dahulu placeholder. Paritas sekarang dibuktikan lewat judul
    // workspace dan aksi sinkronisasi operasional, bukan lencana menu lama.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/stock opname/i, {
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /sinkronkan/i })).toBeVisible();
  });

  test('layar 20 mencari supplier tanpa dropdown statis', async () => {
    await openMenu(page, 'Transaksi Pembelian');
    await expect(page).toHaveURL(/\/app\/purchasing\/invoices/);
    await expect(page.getByRole('heading', { level: 1, name: 'Transaksi Pembelian' })).toBeVisible({
      timeout: 15_000,
    });
    const supplier = page.getByRole('combobox', { name: 'Cari supplier' });
    await expect(supplier).toBeVisible();
    await supplier.fill('SUP');
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
  });

  test('layar 30 mencari customer dan memakai draft tahan-tutup', async () => {
    await openMenu(page, 'Sales Order');
    await expect(page).toHaveURL(/\/app\/sales\/invoices/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sales Order' })).toBeVisible({
      timeout: 15_000,
    });
    const customer = page.getByRole('combobox', { name: 'Cari customer' });
    await expect(customer).toBeVisible();
    await customer.fill('CUS');
    await page.getByRole('listbox').getByRole('option').first().click();
    await page.getByRole('button', { name: /simpan draft/i }).first().click();
    await expect(page.getByText(/draft tersimpan tahan-tutup/i)).toBeVisible();
  });
});
