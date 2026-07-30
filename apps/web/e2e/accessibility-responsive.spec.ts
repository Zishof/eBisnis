import { expect, test } from '@playwright/test';

test.describe('Responsif dan aksesibilitas', () => {
  test('halaman tidak menghasilkan scroll horizontal pada layar 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    for (const path of ['/', '/harga', '/berita', '/kontak', '/masuk']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `Halaman ${path} melebar melebihi viewport`).toBeLessThanOrEqual(1);
    }
  });

  test('menu mobile dapat dibuka dan menampilkan navigasi', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('link', { name: /daftar/i }).first()).toBeVisible();
  });

  test('tautan lewati ke konten utama tersedia untuk pengguna keyboard', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /lewati ke konten utama/i })).toBeFocused();
  });

  test('setiap halaman publik memiliki tepat satu heading tingkat 1', async ({ page }) => {
    for (const path of ['/harga', '/berita', '/kontak', '/tentang']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('mode gelap dapat diaktifkan dan bertahan antar halaman', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /mode gelap|mode terang/i }).click();
    const themed = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.goto('/harga');
    const stillThemed = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(stillThemed).toBe(themed);
  });
});
