/**
 * Kait React yang menjaga keadaan sambungan tetap mutakhir.
 *
 * Aturan penilaiannya ada di `koneksi.ts` dan tidak diulang di sini; berkas ini
 * hanya mengurus waktu, pembatalan, dan pembersihan.
 *
 * Yang dijaga:
 *
 * - **Peladen benar-benar dihubungi**, bukan sekadar `navigator.onLine` dibaca.
 *   Wi-Fi warung yang tersambung tetapi tidak sampai ke peladen adalah keadaan
 *   yang paling sering terjadi dan paling menyesatkan.
 * - **Permintaan yang menggantung dibatalkan.** Peladen yang mati sering tidak
 *   menolak sambungan, melainkan diam. Tanpa batas waktu, satu percobaan
 *   menggantung selamanya dan kasir melihat "memeriksa" tak berujung.
 * - **Diperiksa segera saat tab kembali terlihat.** Kasir yang baru menyalakan
 *   layarnya tidak boleh menunggu satu putaran jeda untuk tahu keadaannya.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  JEDA_MAKS_MS,
  jedaPercobaan,
  nilaiKoneksi,
  type RingkasanKoneksi,
} from './koneksi';

/** Batas waktu satu percobaan. Peladen yang diam lebih lama dianggap tidak menjawab. */
const BATAS_PERCOBAAN_MS = 5_000;

export interface HasilKoneksi extends RingkasanKoneksi {
  /** Memaksa satu pemeriksaan sekarang, di luar jadwal. */
  periksaSekarang: () => void;
}

export function useKoneksi(jalur = '/health'): HasilKoneksi {
  const [ringkasan, setRingkasan] = useState<RingkasanKoneksi>(() =>
    nilaiKoneksi({
      browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
      lastReachableAt: null,
      lastAttemptAt: null,
      lastAttemptOk: null,
      now: Date.now(),
    }),
  );

  // Disimpan pada ref, bukan state: nilainya dibaca di dalam penjadwalan dan
  // tidak boleh memicu penjadwalan ulang setiap kali berubah.
  const terakhirTerjangkau = useRef<number | null>(null);
  const gagalBerturut = useRef(0);
  const hidup = useRef(true);
  const timer = useRef<number | null>(null);
  const sedangPeriksa = useRef(false);

  const periksa = useCallback(async () => {
    if (!hidup.current || sedangPeriksa.current) return;

    /*
     * Tab yang tersembunyi tidak didenyutkan.
     *
     * Tidak ada yang membaca lencana sambungan pada layar yang tidak terlihat,
     * sementara denyutnya tetap membangunkan radio tablet kasir tiap lima detik
     * sepanjang hari dan tetap membebani peladen. Pemeriksaan dijadwalkan ulang
     * dengan jeda panjang, dan `visibilitychange` sudah memaksa pemeriksaan
     * seketika begitu layarnya kembali dilihat — jadi kasir tidak pernah
     * menunggu jeda itu.
     */
    if (typeof document !== 'undefined' && document.hidden) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(periksa, JEDA_MAKS_MS);
      return;
    }

    sedangPeriksa.current = true;

    const pembatal = new AbortController();
    const batas = window.setTimeout(() => pembatal.abort(), BATAS_PERCOBAAN_MS);
    let berhasil = false;

    try {
      const jawab = await fetch(jalur, {
        method: 'GET',
        cache: 'no-store',
        signal: pembatal.signal,
        // Tanpa kredensial: ini hanya pemeriksaan hidup-mati, bukan permintaan
        // data. Mengirim token pada denyut setiap beberapa detik memperluas
        // permukaan yang tidak perlu diperluas.
        credentials: 'omit',
      });
      berhasil = jawab.ok;
    } catch {
      berhasil = false;
    } finally {
      window.clearTimeout(batas);
      sedangPeriksa.current = false;
    }

    if (!hidup.current) return;

    const sekarang = Date.now();
    if (berhasil) {
      terakhirTerjangkau.current = sekarang;
      gagalBerturut.current = 0;
    } else {
      gagalBerturut.current += 1;
    }

    setRingkasan(
      nilaiKoneksi({
        browserOnline: navigator.onLine,
        lastReachableAt: terakhirTerjangkau.current,
        lastAttemptAt: sekarang,
        lastAttemptOk: berhasil,
        now: sekarang,
      }),
    );

    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(periksa, jedaPercobaan(gagalBerturut.current));
  }, [jalur]);

  const periksaSekarang = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    void periksa();
  }, [periksa]);

  useEffect(() => {
    hidup.current = true;
    void periksa();

    /*
     * Kejadian `online`/`offline` peramban dipakai sebagai pemicu, bukan sebagai
     * jawaban: keduanya hanya menandakan antarmuka jaringan berubah, dan justru
     * itulah saat yang tepat untuk bertanya kepada peladen.
     */
    const saatBerubah = () => periksaSekarang();
    const saatTerlihat = () => {
      if (!document.hidden) periksaSekarang();
    };

    window.addEventListener('online', saatBerubah);
    window.addEventListener('offline', saatBerubah);
    document.addEventListener('visibilitychange', saatTerlihat);

    return () => {
      hidup.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
      window.removeEventListener('online', saatBerubah);
      window.removeEventListener('offline', saatBerubah);
      document.removeEventListener('visibilitychange', saatTerlihat);
    };
  }, [periksa, periksaSekarang]);

  return { ...ringkasan, periksaSekarang };
}
