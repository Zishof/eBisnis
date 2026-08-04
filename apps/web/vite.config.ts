import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
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
  plugins: [
    react(),
    VitePWA({
      /*
       * Layar kasir dipasang sebagai aplikasi, dan cangkangnya dilayani dari
       * mesin kasir sendiri.
       *
       * Tanpa ini, kasir yang kehilangan internet mendapat halaman galat
       * peramban — bukan layar kasir yang memberitahu apa yang sedang terjadi.
       * Yang di-cache adalah cangkang aplikasinya; data tetap datang dari
       * peladen, dan bagian mana yang boleh dipakai saat luring diputuskan
       * `pos-offline`, bukan service worker.
       */
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'eBisnis.id — Kasir',
        short_name: 'Kasir',
        description: 'Kasir eBisnis.id. Dapat dipasang pada mesin kasir dan tetap terbuka saat internet terputus.',
        lang: 'id',
        start_url: '/app/pos',
        scope: '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#ffffff',
        theme_color: '#0f172a',
        /*
         * Ikon dibuat `scripts/buat-ikon-pwa.mjs`, bukan diletakkan sebagai
         * berkas biner begitu saja, supaya perubahannya terbaca pada permintaan
         * tarik dan mudah diganti ketika logo resmi tersedia.
         *
         * `maskable` memakai berkas tersendiri. Android memotong ikon maskable
         * menjadi lingkaran atau bentuk lain sesuai peluncurnya; ikon biasa yang
         * dipakai sebagai maskable akan kehilangan sudutnya. Versi maskable
         * sudah menyisakan ruang aman di tepinya.
         */
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        /*
         * PNG sengaja tidak ada di sini. Ikon manifest sudah dimasukkan plugin
         * ke precache dengan sendirinya; menambahkan polanya membuat setiap ikon
         * terdaftar dua kali. Selama revisinya sama Workbox membiarkannya, tetapi
         * begitu berbeda ia menolak dengan `add-to-cache-list-conflicting-entries`
         * dan service worker gagal dipasang — pada mesin kasir yang sudah
         * terpasang, kegagalan itu baru terlihat sebagai aplikasi yang berhenti
         * diperbarui, tanpa ada yang menghubungkannya dengan berkas ikon.
         *
         * Pola menyeluruh `**\/*.png` juga akan ikut menelan gambar apa pun yang
         * kelak ditaruh di `public/`.
         */
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        /*
         * Permintaan API TIDAK PERNAH di-cache service worker.
         *
         * Harga, stok, dan hak akses yang dilayani dari cache akan membuat
         * kasir menjual dengan angka yang sudah tidak berlaku, tanpa ada yang
         * menyadarinya. Data luring ditangani `pos-offline` yang tahu mana yang
         * boleh basi dan mana yang tidak.
         */
        navigateFallbackDenylist: [/^\/api/, /^\/health/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
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
  preview: {
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'emedik.id',
      'www.emedik.id',
      'apotik.emedik.id',
      'www.apotik.emedik.id',
      'demo.emedik.id',
      'demo-apotik.emedik.id',
    ],
    /*
     * Proxy yang sama seperti server pengembangan.
     *
     * `server.proxy` tidak berlaku bagi `vite preview`, dan tanpa salinan ini
     * aplikasi yang sudah dibangun tidak dapat menghubungi API sama sekali —
     * seluruh uji peramban akan merah dengan sebab yang tampak seperti cacat
     * antarmuka.
     */
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
    },
  },
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
