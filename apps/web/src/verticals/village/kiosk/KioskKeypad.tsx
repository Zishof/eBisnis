/**
 * Papan ketik kode ambil.
 *
 * Anjungan tidak boleh mengandalkan papan ketik bawaan peramban: pada layar
 * sentuh kios, papan ketik sistem sering tidak muncul, menutup separuh layar
 * bila muncul, dan menyediakan huruf yang justru tidak dipakai kode ambil.
 *
 * Papan ketik ini hanya menampilkan **huruf yang mungkin** — tanpa 0, O, 1, I,
 * dan L. Warga tidak dapat mengetik huruf yang pasti salah, sehingga tidak
 * perlu diberi tahu bahwa ia salah.
 */

import { Delete } from 'lucide-react';
import { HURUF_KODE } from './useKiosk';

export function KioskKeypad({
  nilai,
  onUbah,
  panjang = 8,
}: {
  nilai: string;
  onUbah: (nilai: string) => void;
  panjang?: number;
}) {
  const tekan = (huruf: string) => {
    if (nilai.length >= panjang) return;
    onUbah(nilai + huruf);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Kotak isian — besar, dikelompokkan empat, terbaca dari satu meter. */}
      <div
        className="mb-8 flex items-center justify-center gap-2 sm:gap-3"
        aria-live="polite"
        aria-label={`Kode ambil: ${nilai.split('').join(' ') || 'kosong'}`}
      >
        {Array.from({ length: panjang }).map((_, i) => (
          <span
            key={i}
            className={[
              'flex h-16 w-12 items-center justify-center rounded-lg border-2 text-3xl font-bold sm:h-20 sm:w-14 sm:text-4xl',
              i < nilai.length
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                : 'border-slate-300 text-slate-300 dark:border-slate-700 dark:text-slate-700',
              i === 3 ? 'mr-4 sm:mr-6' : '',
            ].join(' ')}
          >
            {nilai[i] ?? '•'}
          </span>
        ))}
      </div>

      {/* Tombol huruf — 64 piksel ke atas, jarak antar tombol lebar. Jari orang
          tua yang membawa map tidak dapat mengenai tombol 32 piksel. */}
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 sm:gap-3">
        {HURUF_KODE.split('').map((huruf) => (
          <button
            key={huruf}
            type="button"
            onClick={() => tekan(huruf)}
            disabled={nilai.length >= panjang}
            className="h-16 rounded-lg border border-slate-300 bg-white text-2xl font-semibold text-slate-900 active:bg-slate-200 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:active:bg-slate-700"
          >
            {huruf}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onUbah(nilai.slice(0, -1))}
          disabled={!nilai.length}
          className="col-span-2 flex h-16 items-center justify-center gap-2 rounded-lg border border-amber-400 bg-amber-50 text-lg font-semibold text-amber-900 active:bg-amber-200 disabled:opacity-40 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <Delete size={22} aria-hidden /> Hapus
        </button>
      </div>
    </div>
  );
}
