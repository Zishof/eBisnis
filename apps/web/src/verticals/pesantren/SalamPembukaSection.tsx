/**
 * Salam dan muqaddimah — bagian paling depan halaman santri.info.
 *
 * ## Yang perlu benar pada teks Arab
 *
 * Setiap blok Arab ditandai `lang="ar"` dan `dir="rtl"`. Tanpa keduanya, tanda
 * baca berpindah ke sisi yang salah dan pembaca layar melafalkannya sebagai
 * bahasa Indonesia — dua hal yang langsung dikenali pembaca yang terbiasa.
 *
 * Ukuran hurufnya sengaja lebih besar dari teks biasa. Harakat pada ukuran
 * teks Latin menjadi terlalu rapat untuk dibaca dengan nyaman.
 *
 * ## Alih aksara ada, dan itu disengaja
 *
 * Tidak semua wali santri lancar membaca Arab. Menyediakan alih aksara Latin
 * membuat pembukaan ini dapat dibaca semua orang tanpa mengurangi keasliannya.
 */

import type { BarisArab } from './salam-pembuka';
import {
  BASMALAH,
  DOA_PENUTUP,
  HAMDALAH,
  MUQADDIMAH_PARAGRAF,
  SALAM,
} from './salam-pembuka';

function Arab({ baris, besar }: { baris: BarisArab; besar?: boolean }) {
  return (
    <div className="text-center">
      <p
        lang="ar"
        dir="rtl"
        className={
          besar
            ? 'font-serif text-2xl leading-loose text-emerald-900 sm:text-3xl dark:text-emerald-100'
            : 'font-serif text-xl leading-loose text-emerald-900 sm:text-2xl dark:text-emerald-100'
        }
      >
        {baris.arab}
      </p>
      <p className="mt-2 text-sm italic text-emerald-800/80 dark:text-emerald-200/80">
        {baris.latin}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{baris.arti}</p>
    </div>
  );
}

export function SalamPembukaSection() {
  return (
    <section
      className="border-b border-emerald-200 bg-gradient-to-b from-emerald-50 to-white px-4 py-14 dark:border-emerald-900 dark:from-emerald-950 dark:to-slate-950"
      aria-labelledby="judul-muqaddimah"
    >
      <div className="mx-auto max-w-3xl">
        <div className="space-y-8">
          <Arab baris={BASMALAH} besar />
          <Arab baris={SALAM} besar />
        </div>

        <div className="my-8 border-t border-emerald-200 dark:border-emerald-900" />

        <Arab baris={HAMDALAH} />

        <h2
          id="judul-muqaddimah"
          className="mt-10 text-center text-2xl font-bold text-slate-900 dark:text-white"
        >
          Muqaddimah
        </h2>

        <div className="mt-5 space-y-4 text-slate-700 dark:text-slate-200">
          {MUQADDIMAH_PARAGRAF.map((p) => (
            <p key={p.slice(0, 28)} className="leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-emerald-200 bg-white/70 p-5 dark:border-emerald-900 dark:bg-slate-900/60">
          <Arab baris={DOA_PENUTUP} />
        </div>
      </div>
    </section>
  );
}
