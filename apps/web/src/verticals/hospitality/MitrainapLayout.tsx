/**
 * Kerangka halaman mitrainap.id.
 *
 * Bentuknya mengikuti `SantriLayout` (santri.info) -- alasannya sama:
 * `PublicLayout` memakai lambang dan merek eBisnis.id, dan memakainya di sini
 * berarti pengunjung mitrainap.id disambut merek yang bukan yang ia tuju.
 *
 * Tautan silang diambil dari `/public/portals`, bukan ditulis di sini -- lihat
 * catatan lengkap di `SantriLayout`.
 *
 * Subdomain properti (`<slug>.mitrainap.id`) BELUM punya kerangkanya sendiri
 * (setara `PondokChrome`) -- menyusul MI-5 (Property Foundation), saat
 * properti pertama benar-benar bisa didaftarkan. Sampai saat itu, pengunjung
 * subdomain properti jatuh ke `AkarMenurutHost` di `App.tsx` seperti host lain
 * yang belum dikenali; dicatat sebagai keterbatasan yang diketahui, bukan
 * ditutupi dengan kerangka kosong yang tidak menjawab apa-apa.
 */

import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface TautanEkosistem {
  code: string;
  label: string | null;
  description: string | null;
  url: string | null;
}

interface PortalPublik {
  code: string;
  name: string;
  ecosystem: TautanEkosistem[];
}

const KODE_PORTAL = 'MITRAINAP';

function useTautanEkosistem() {
  return useQuery({
    queryKey: ['public-portals'],
    queryFn: () => api.get<PortalPublik[]>('/public/portals'),
    staleTime: 30 * 60_000,
    retry: false,
  });
}

function useJudulMitrainap() {
  useEffect(() => {
    const sebelumnya = document.title;
    document.title = 'MitraInap.id — PMS dan Operasional Hotel Terintegrasi';
    return () => {
      document.title = sebelumnya;
    };
  }, []);
}

export function MitrainapLayout() {
  useJudulMitrainap();
  const { data } = useTautanEkosistem();
  const ekosistem =
    data?.find((p) => p.code === KODE_PORTAL)?.ecosystem.filter((t) => t.url) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <a
        href="#isi-utama"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-violet-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Lewati ke konten utama
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link
            to="/mitrainap"
            className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-700 text-sm font-black text-white">
              MI
            </span>
            <span>MitraInap.id</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/mitrainap/masuk" className="hidden px-3 py-2 text-sm font-medium sm:inline-block">
              Masuk
            </Link>
          </div>
        </div>
      </header>

      <main id="isi-utama" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-700 text-xs font-black text-white">
              MI
            </span>
            MitraInap.id
          </div>
          <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
            PMS, booking engine, front office, housekeeping, dan folio untuk
            hotel, homestay, dan properti sewa dalam satu platform.
          </p>

          {ekosistem.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Bagian dari satu ekosistem
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ekosistem.map((t) => (
                  <li key={t.code}>
                    <a
                      href={t.url!}
                      className="text-sm text-slate-600 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-400"
                    >
                      {t.label ?? t.code}
                      {t.description && (
                        <span className="block text-xs text-slate-500 dark:text-slate-500">
                          {t.description}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <Link to="/kontak" className="hover:text-violet-700 dark:hover:text-violet-400">
              Kontak
            </Link>
            <Link to="/syarat" className="hover:text-violet-700 dark:hover:text-violet-400">
              Syarat dan Ketentuan
            </Link>
            <Link to="/privasi" className="hover:text-violet-700 dark:hover:text-violet-400">
              Kebijakan Privasi
            </Link>
            <span className="ms-auto">© {new Date().getFullYear()} MitraInap.id</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
