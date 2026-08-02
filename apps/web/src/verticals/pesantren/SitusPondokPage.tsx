/**
 * Apa yang tampil di `<pondok>.santri.info` sebelum situs pondoknya ada.
 *
 * ## Mengapa halaman ini ada
 *
 * Subdomain pondok sudah dikenali `santri-host.ts`, tetapi situs penyewa yang
 * dapat disunting sendiri **belum dibangun** — CMS dan berita publik yang ada
 * sekarang milik platform, bukan per penyewa
 * (`apps/api/src/modules/public/public.controller.ts`).
 *
 * Tanpa halaman ini, pondok pertama yang menerima subdomainnya akan melihat
 * halaman perusahaan eBisnis: 200, tanpa galat, dan salah bagi setiap
 * pengunjung yang datang mencari pondok itu.
 *
 * Yang ditampilkan sengaja tidak menyebut nama pondok. Nama itu hanya diketahui
 * API dari registry; menebaknya dari slug di peramban berarti menampilkan nama
 * yang mungkin bukan milik siapa pun.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function SitusPondokPage() {
  /*
   * Judul netral, bukan "eBisnis.id" dari `index.html` dan bukan pula
   * "santri.info". Alamat ini milik pondok; menuliskan merek platform di
   * tabnya sama saja dengan menempelkan papan nama kita di gerbang orang lain.
   */
  useEffect(() => {
    const sebelumnya = document.title;
    document.title = 'Situs pondok sedang disiapkan';
    return () => {
      document.title = sebelumnya;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-16 dark:bg-slate-950">
      <div className="max-w-lg text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-700 text-lg font-black text-white">
          ص
        </span>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
          Situs pondok sedang disiapkan
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          Alamat ini sudah aktif. Halaman profil, berita, dan pendaftaran santri
          baru akan tampil di sini setelah pengurus pondok mengisinya.
        </p>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Pengurus pondok dapat masuk untuk mulai mengisi.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/santri/masuk"
            className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
          >
            Masuk
          </Link>
          <a
            href="https://santri.info"
            className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Tentang santri.info
          </a>
        </div>
      </div>
    </div>
  );
}
