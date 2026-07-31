import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/**
 * Playwright memakai server dev Vite yang mem-proxy `/api` ke API pada port 3000.
 * API dan database harus sudah berjalan sebelum `pnpm test:e2e`.
 */
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  /*
   * Batas waktu pada CI dilonggarkan.
   *
   * Runner CI jauh lebih lambat daripada mesin pengembang, dan batas yang
   * ditala di mesin pengembang menghasilkan kegagalan yang tampak seperti cacat
   * padahal hanya lambat. Kegagalan palsu lebih merugikan daripada uji yang
   * berjalan setengah menit lebih lama: ia melatih orang mengabaikan warna
   * merah.
   */
  timeout: CI ? 120_000 : 60_000,
  expect: { timeout: CI ? 20_000 : 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'id-ID',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        /*
         * Pada CI dipakai hasil build, bukan server pengembangan.
         *
         * Server pengembangan menyusun modul saat pertama diminta, sehingga
         * navigasi pertama ke setiap halaman jauh lebih lambat — dan itulah
         * sumber sebagian besar kedipan pada runner yang lambat. `vite preview`
         * menyajikan berkas yang sudah jadi, sekaligus lebih menyerupai apa
         * yang benar-benar dijalankan penyewa.
         */
        command: CI ? 'pnpm preview' : 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: !CI,
        timeout: 180_000,
      },
});
