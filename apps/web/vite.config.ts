import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

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
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
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
