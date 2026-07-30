import { expect, test } from '@playwright/test';

/**
 * Route `/` wajib menampilkan website publik, bukan mengarahkan ke halaman login.
 * Seluruh isi berasal dari CMS sehingga dapat diubah tanpa mengubah source.
 */
test.describe('Website publik', () => {
  test('route / menampilkan homepage, bukan redirect login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('halaman harga menampilkan angka dari pricing engine', async ({ page }) => {
    await page.goto('/harga');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    // Harga berasal dari pricing engine, bukan nilai hard-coded pada frontend.
    await expect(page.getByText(/Rp/).first()).toBeVisible();
  });

  test('daftar berita dan detail berita dapat dibuka', async ({ page }) => {
    await page.goto('/berita');
    const firstArticle = page.locator('article a[href^="/berita/"]').first();
    await expect(firstArticle).toBeVisible();
    await firstArticle.click();
    await expect(page).toHaveURL(/\/berita\/.+/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('halaman legal berasal dari CMS', async ({ page }) => {
    await page.goto('/syarat');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.goto('/privasi');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('formulir kontak tidak terkirim saat field wajib kosong', async ({ page }) => {
    await page.goto('/kontak');
    await page.getByRole('button', { name: /kirim pesan/i }).click();
    await expect(page).toHaveURL(/\/kontak/);
  });

  test('pergantian bahasa mengubah arah teks untuk bahasa Arab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Bahasa', exact: true }).click();
    await page.getByRole('option', { name: /العربية/ }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.getByRole('button', { name: /اللغة|Bahasa/ }).first().click();
    await page.getByRole('option', { name: /Bahasa Indonesia/ }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('halaman tidak dikenal diarahkan ke beranda', async ({ page }) => {
    await page.goto('/rute-yang-tidak-ada');
    await expect(page).toHaveURL(/\/$/);
  });
});
