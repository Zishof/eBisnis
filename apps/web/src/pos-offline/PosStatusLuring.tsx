/**
 * Batang status luring pada layar kasir.
 *
 * Tiga hal ditampilkan, dan ketiganya dipilih karena kasir tidak dapat
 * mengetahuinya dengan cara lain:
 *
 * 1. **Apakah peladen menjawab** — bukan apakah ada Wi-Fi. Keduanya berbeda,
 *    dan yang kedua tidak menolong siapa pun.
 * 2. **Seberapa baru salinan katalog** — supaya harga yang dipakai luring dapat
 *    dipertanggungjawabkan, dan supaya kasir tahu bila salinannya sudah tidak
 *    boleh dipakai.
 * 3. **Apakah katalognya lengkap** — katalog yang dipotong diam-diam membuat
 *    barang tampak "tidak ada" tanpa penjelasan apa pun.
 *
 * Lencana berwarna saja tidak cukup. Setiap keadaan membawa kalimat yang
 * menyebutkan **akibatnya bagi pekerjaan kasir**, karena warna kuning tidak
 * memberi tahu siapa pun apa yang harus dilakukan berikutnya.
 */

import { AlertTriangle, CloudOff, Download, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { warnaKoneksi, type KeadaanKoneksi } from './koneksi';
import { jam } from './katalog';
import type { HasilKatalogLuring } from './useKatalogLuring';
import type { HasilServiceWorker } from './useServiceWorker';

const KELAS: Record<ReturnType<typeof warnaKoneksi>, string> = {
  hijau: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  kuning: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  merah: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
  kelabu: 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
};

const LABEL: Record<KeadaanKoneksi, string> = {
  DARING: 'Daring',
  TERBATAS: 'Peladen tidak menjawab',
  LURING: 'Luring',
  MEMERIKSA: 'Memeriksa…',
};

export function PosStatusLuring({
  koneksi,
  katalog,
  sw,
}: {
  koneksi: { state: KeadaanKoneksi; message: string; periksaSekarang: () => void };
  katalog: HasilKatalogLuring;
  sw: HasilServiceWorker;
}) {
  const warna = warnaKoneksi(koneksi.state);
  const salinan = katalog.salinan;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${KELAS[warna]}`}
          // Keadaan dibacakan pembaca layar saat berubah, tetapi tidak menyela
          // apa pun yang sedang dikerjakan kasir.
          role="status"
          aria-live="polite"
        >
          {koneksi.state === 'DARING' ? (
            <Wifi className="h-3.5 w-3.5" aria-hidden />
          ) : koneksi.state === 'LURING' ? (
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
          ) : koneksi.state === 'TERBATAS' ? (
            <CloudOff className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          )}
          {LABEL[koneksi.state]}
        </span>

        <span className="text-slate-600 dark:text-slate-300">{koneksi.message}</span>

        <button
          type="button"
          className="btn-outline h-7 px-2 py-0 text-xs"
          onClick={koneksi.periksaSekarang}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Periksa lagi
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        {katalog.menyalin ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Menyalin katalog ke mesin ini…
          </span>
        ) : salinan ? (
          <span>
            Katalog luring: <strong className="tabular-nums">{salinan.produk.length}</strong> produk,
            disalin {jam(Math.max(0, Date.now() - salinan.syncedAt))} lalu.
          </span>
        ) : (
          <span>Katalog belum disalin ke mesin ini.</span>
        )}

        <button
          type="button"
          className="btn-outline h-7 px-2 py-0 text-xs"
          onClick={katalog.salinSekarang}
          disabled={katalog.menyalin || koneksi.state === 'LURING'}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Salin ulang
        </button>
      </div>

      {/*
        Katalog yang terpotong disebutkan dengan angkanya. "Sebagian produk tidak
        tersalin" tidak dapat ditindaklanjuti; "4.999 dari 12.480" memberi tahu
        kasir bahwa barang yang tidak ketemu memang mungkin ada di peladen.
      */}
      {salinan?.truncated && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Katalog terlalu besar untuk disalin seluruhnya:{' '}
            <strong className="tabular-nums">{salinan.produk.length}</strong> dari{' '}
            <strong className="tabular-nums">{salinan.productTotal}</strong> produk. Saat luring,
            barang di luar salinan tidak akan ditemukan meskipun ada di peladen.
          </span>
        </p>
      )}

      {katalog.penghalang.length > 0 && koneksi.state !== 'DARING' && (
        <p className="flex items-start gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{katalog.penghalang[0].message}</span>
        </p>
      )}

      {katalog.galat && (
        <p className="text-xs text-rose-700 dark:text-rose-300">{katalog.galat}</p>
      )}

      {sw.state !== 'TIDAK_ADA' && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs dark:bg-slate-800">
          <span className="text-slate-700 dark:text-slate-200">{sw.message}</span>
          {sw.bolehTerapkan && (
            <button type="button" className="btn-primary h-7 px-2 py-0 text-xs" onClick={sw.terapkan}>
              Muat ulang
            </button>
          )}
        </div>
      )}
    </div>
  );
}
