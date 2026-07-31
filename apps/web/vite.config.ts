import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Sasaran proxy API.
 *
 * Dapat diatur lewat `API_PROXY_TARGET` karena port 3000 tidak selalu bebas —
 * pengembang yang menjalankan proyek lain pada port itu sebelumnya harus
 * menyunting berkas ini, dan suntingan seperti itu mudah ikut ter-commit.
 */
const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy API agar frontend dan backend satu origin saat development.
      '/api': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: { port: 5173, strictPort: true },
  build: {
    // Vendor dipisah agar bundle aplikasi tetap kecil dan cache browser efektif.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', '@tanstack/react-table'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          charts: ['recharts'],
          forms: ['react-hook-form', 'zod'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Spesifikasi Playwright pada `e2e/` dijalankan `pnpm test:e2e`, bukan Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e', 'playwright-report'],
  },
});
