/**
 * Pendaftaran service worker dan penanganan pembaruan.
 *
 * Keputusan **kapan** pembaruan boleh dipasang ada di `pembaruan.ts` sebagai
 * aturan murni. Berkas ini hanya menjalankan keputusan itu.
 *
 * ## Mengapa modulnya dimuat dinamis
 *
 * `virtual:pwa-register` hanya ada bila plugin PWA ikut membangun. Impor statis
 * membuat berkas ini — dan seluruh layar kasir yang mengimpornya — gagal dimuat
 * pada lingkungan mana pun yang tidak memakai plugin itu, termasuk pelari uji.
 * Layar kasir tidak boleh mati hanya karena pemasangan luringnya tidak aktif.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { nilaiPembaruan, type RingkasanPembaruan } from './pembaruan';

export interface HasilServiceWorker extends RingkasanPembaruan {
  /** Cangkang aplikasi sudah tercache dan siap dibuka tanpa jaringan. */
  siapLuring: boolean;
  /** Memuat ulang dengan versi baru. Tidak melakukan apa pun bila belum aman. */
  terapkan: () => void;
}

export function useServiceWorker(konteks: {
  keranjangTerbuka: boolean;
  antreanBelumTerkirim: number;
}): HasilServiceWorker {
  const [adaPembaruan, setAdaPembaruan] = useState(false);
  const [siapLuring, setSiapLuring] = useState(false);
  const perbarui = useRef<((muatUlang?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const { registerSW } = await import('virtual:pwa-register');
        if (batal) return;
        perbarui.current = registerSW({
          immediate: true,
          onNeedRefresh: () => !batal && setAdaPembaruan(true),
          onOfflineReady: () => !batal && setSiapLuring(true),
        });
      } catch {
        /*
         * Tidak ada plugin PWA pada lingkungan ini. Bukan galat: aplikasi tetap
         * berjalan seperti aplikasi web biasa, hanya tanpa pemasangan luring.
         */
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  const ringkasan = nilaiPembaruan({
    adaPembaruan,
    keranjangTerbuka: konteks.keranjangTerbuka,
    antreanBelumTerkirim: konteks.antreanBelumTerkirim,
  });

  const terapkan = useCallback(() => {
    // Dijaga juga di sini, bukan hanya disembunyikan pada antarmuka. Tombol yang
    // tidak tampak tetap dapat terpanggil dari tempat lain, dan akibat salahnya
    // — keranjang yang hilang di depan pembeli — terlalu mahal untuk bergantung
    // pada tata letak.
    if (!ringkasan.bolehTerapkan) return;
    void perbarui.current?.(true);
  }, [ringkasan.bolehTerapkan]);

  return { ...ringkasan, siapLuring, terapkan };
}
