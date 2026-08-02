/**
 * Bagian "apa yang berubah bagi setiap bagian di pondok".
 *
 * ## Mengapa dapat disaring, bukan digelar seluruhnya
 *
 * Ada dua puluh lebih peran. Menggelar semuanya sekaligus membuat halaman
 * sepanjang beberapa layar penuh, dan pembaca yang mencari bagiannya sendiri
 * harus menggulir melewati sembilan belas bagian yang bukan urusannya.
 *
 * Namun penyaringnya **tidak menyembunyikan** apa pun secara permanen: seluruh
 * kelompok tetap dapat dibuka, dan pilihan "Semua" ada sejak awal. Penyaring
 * yang menyembunyikan tanpa jalan kembali membuat pengunjung mengira isinya
 * memang hanya sedikit.
 */

import { useState } from 'react';
import { KELOMPOK_PERAN, MUKADIMAH, SELURUH_PERAN } from './manfaat-peran';

const SEMUA = 'SEMUA';

export function ManfaatPeranSection() {
  const [kelompokAktif, setKelompokAktif] = useState<string>(SEMUA);
  const [terbuka, setTerbuka] = useState<string | null>(SELURUH_PERAN[0]?.kode ?? null);

  const kelompokTampil =
    kelompokAktif === SEMUA
      ? KELOMPOK_PERAN
      : KELOMPOK_PERAN.filter((k) => k.kode === kelompokAktif);

  return (
    <section className="border-y border-slate-200 bg-white px-4 py-16 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl">
        {/* --- Mukadimah -------------------------------------------------- */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Manfaat bagi setiap bagian
          </p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {MUKADIMAH.judul}
          </h2>
        </div>

        <div className="mx-auto mt-6 max-w-3xl space-y-4 text-slate-600 dark:text-slate-300">
          {MUKADIMAH.paragraf.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>

        <figure className="mx-auto mt-8 max-w-3xl rounded-xl border-s-4 border-emerald-600 bg-emerald-50 p-5 dark:bg-emerald-950/40">
          <blockquote className="text-slate-800 dark:text-emerald-50">
            &ldquo;{MUKADIMAH.ayat.teks}&rdquo;
          </blockquote>
          <figcaption className="mt-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            — {MUKADIMAH.ayat.rujukan}
          </figcaption>
        </figure>

        {/* --- Penyaring kelompok ----------------------------------------- */}
        <div className="mt-10 flex flex-wrap justify-center gap-2" role="group" aria-label="Kelompok bagian">
          <button
            type="button"
            onClick={() => setKelompokAktif(SEMUA)}
            aria-pressed={kelompokAktif === SEMUA}
            className={
              kelompokAktif === SEMUA
                ? 'rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white'
                : 'rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900'
            }
          >
            Semua ({SELURUH_PERAN.length})
          </button>
          {KELOMPOK_PERAN.map((k) => (
            <button
              key={k.kode}
              type="button"
              onClick={() => setKelompokAktif(k.kode)}
              aria-pressed={kelompokAktif === k.kode}
              className={
                kelompokAktif === k.kode
                  ? 'rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white'
                  : 'rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900'
              }
            >
              {k.nama} ({k.peran.length})
            </button>
          ))}
        </div>

        {/* --- Daftar peran ------------------------------------------------ */}
        <div className="mt-10 space-y-10">
          {kelompokTampil.map((k) => (
            <div key={k.kode}>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{k.nama}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{k.ringkas}</p>

              <div className="mt-5 space-y-3">
                {k.peran.map((p) => {
                  const dibuka = terbuka === p.kode;
                  return (
                    <article
                      key={p.kode}
                      className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                      data-testid={`peran-${p.kode}`}
                    >
                      <h4>
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 p-5 text-start hover:bg-slate-50 dark:hover:bg-slate-900"
                          onClick={() => setTerbuka(dibuka ? null : p.kode)}
                          aria-expanded={dibuka}
                        >
                          <span
                            aria-hidden
                            className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-400"
                          >
                            {dibuka ? '−' : '+'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-slate-900 dark:text-white">
                              {p.peran}
                            </span>
                            <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                              {p.untuk}
                            </span>
                          </span>
                        </button>
                      </h4>

                      {dibuka && (
                        <div className="border-t border-slate-200 px-5 pb-5 pt-4 dark:border-slate-700">
                          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                            <strong className="font-semibold">Yang terasa berat hari ini:</strong>{' '}
                            {p.keresahan}
                          </p>

                          <h5 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                            Yang berubah
                          </h5>
                          <ul className="mt-2 space-y-2">
                            {p.manfaat.map((m) => (
                              <li key={m} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <span aria-hidden className="text-emerald-700 dark:text-emerald-400">
                                  ✓
                                </span>
                                <span>{m}</span>
                              </li>
                            ))}
                          </ul>

                          <p className="mt-4 border-t border-slate-100 pt-3 text-sm italic text-emerald-800 dark:border-slate-800 dark:text-emerald-300">
                            {p.keutamaan.nilai}
                            {p.keutamaan.rujukan && (
                              <span className="not-italic"> — {p.keutamaan.rujukan}</span>
                            )}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
