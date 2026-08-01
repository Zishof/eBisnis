/**
 * Kerangka halaman santri.info.
 *
 * ## Mengapa tidak memakai `PublicLayout`
 *
 * `PublicLayout` memakai lambang "eB", nama eBisnis.id, dan keterangan footer
 * tentang retail dan F&B. Memakainya di sini berarti pengunjung `santri.info`
 * disambut merek yang bukan yang ia tuju — tepat kebalikan dari alasan domain
 * ini dibeli.
 *
 * Bentuknya mengikuti `BelanjaLayout`, yang sudah menyelesaikan persoalan yang
 * sama untuk `belanja.ebisnis.id`.
 *
 * ## Tautan silang diambil dari API, bukan ditulis di sini
 *
 * §487 meminta setiap portal menautkan portal lain. Alamatnya diambil dari
 * `/public/portals`, yang menyusunnya dari registry. Menuliskannya di berkas ini
 * berarti daftar host hidup di dua tempat — dan yang tertinggal adalah yang
 * dilihat pengunjung.
 *
 * Bila registry belum diseed, jawabannya kosong dan bagian itu tidak
 * ditampilkan. Footer tanpa tautan lebih baik daripada footer berisi tautan mati.
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

const KODE_PORTAL = 'SANTRI_INFO';

function useTautanEkosistem() {
  return useQuery({
    queryKey: ['public-portals'],
    queryFn: () => api.get<PortalPublik[]>('/public/portals'),
    staleTime: 30 * 60_000,
    // Halaman pemasaran tidak boleh menunggu bagian yang bukan isinya.
    retry: false,
  });
}

/**
 * Judul tab.
 *
 * `index.html` menuliskan judul eBisnis.id secara statis. Tanpa ini, pengunjung
 * santri.info melihat "eBisnis.id — Platform SaaS POS & ERP Terintegrasi" pada
 * tab, pada penanda buku, dan pada judul yang ikut saat halamannya dibagikan —
 * kebocoran merek yang sama dengan memakai `PublicLayout`, hanya di tempat yang
 * lebih jarang diperiksa.
 *
 * Judul sebelumnya dikembalikan saat kerangka ini dilepas, sebab pengunjung yang
 * berpindah ke halaman lain dalam aplikasi yang sama tidak boleh membawa judul
 * santri.info ke sana.
 */
function useJudulSantri() {
  useEffect(() => {
    const sebelumnya = document.title;
    document.title = 'santri.info — Sistem Informasi Pondok Pesantren';
    return () => {
      document.title = sebelumnya;
    };
  }, []);
}

export function SantriLayout() {
  useJudulSantri();
  const { data } = useTautanEkosistem();
  const ekosistem =
    data?.find((p) => p.code === KODE_PORTAL)?.ecosystem.filter((t) => t.url) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <a
        href="#isi-utama"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Lewati ke konten utama
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link
            to="/santri"
            className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-700 text-sm font-black text-white">
              ص
            </span>
            <span>santri.info</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/masuk" className="hidden px-3 py-2 text-sm font-medium sm:inline-block">
              Masuk
            </Link>
            <Link
              to="/daftar"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Daftarkan pondok
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
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-xs font-black text-white">
              ص
            </span>
            santri.info
          </div>
          <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Sistem informasi pondok pesantren — santri, asrama, diniyah, tahfiz,
            keuangan, dan unit usaha dalam satu tempat.
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
                      className="text-sm text-slate-600 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400"
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
            <Link to="/kontak" className="hover:text-emerald-700 dark:hover:text-emerald-400">
              Kontak
            </Link>
            <Link to="/syarat" className="hover:text-emerald-700 dark:hover:text-emerald-400">
              Syarat dan Ketentuan
            </Link>
            <Link to="/privasi" className="hover:text-emerald-700 dark:hover:text-emerald-400">
              Kebijakan Privasi
            </Link>
            <span className="ms-auto">© {new Date().getFullYear()} santri.info</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
