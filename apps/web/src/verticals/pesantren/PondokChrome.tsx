/**
 * Bingkai halaman untuk pengunjung yang datang lewat SUBDOMAIN PONDOK
 * (`<slug>.santri.info`) -- dipakai `PublicLayout` menggantikan bingkai
 * eBisnis.id/santri.info bawaannya.
 *
 * ## Mengapa harus ada, bukan sekadar memakai `PublicLayout`/`SantriLayout`
 *
 * Subdomain pondok adalah alamat PELANGGAN, bukan alamat platform. Pengunjung
 * yang mengetik `raudlatul-ulum.santri.info/masuk` sedang mencari pondoknya
 * sendiri -- ia tidak boleh disambut merek eBisnis.id (retail/POS/ERP, sama
 * sekali bukan urusannya), dan tidak boleh pula disambut merek "santri.info"
 * generik lengkap dengan tombol "Daftarkan pondok" atau "Coba Demo Pesantren"
 * -- keduanya ajakan PROSPEK calon pelanggan BARU, bukan sesuatu yang relevan
 * bagi pondok yang SUDAH menjadi pelanggan.
 *
 * Karena itu bingkai ini TIDAK menautkan apa pun ke luar pondoknya sendiri:
 * tidak ada tautan ekosistem, tidak ada "daftarkan pondok baru", tidak ada
 * tombol demo, tidak ada pendaftaran akun mandiri (akun pengguna pondok
 * dibuat pengurusnya, bukan pendaftaran umum).
 *
 * ## Sumber identitas pondok
 *
 * Nama, logo, dan temanya diambil dari `/pesantren/public/site` -- endpoint
 * publik yang sama dipakai `SitusPondokPage`. Bila situsnya belum diterbitkan
 * pengurus (404), bingkai tetap tampil dengan identitas netral (ikon pondok
 * generik) -- BUKAN jatuh ke merek eBisnis/santri.info, sebab kegagalan
 * memuat profil tidak mengubah fakta bahwa pengunjung ada di alamat pondok.
 */

import { Link, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { usePondokFavicon } from './use-pondok-favicon';

interface ProfilRingkas {
  profil: {
    nama_tampilan: string | null;
    tagline: string | null;
    logo_url: string | null;
    kontak_email: string | null;
    kontak_telepon: string | null;
  };
}

export function PondokChrome() {
  const { data } = useQuery({
    queryKey: ['pesantren', 'situs-publik', 'chrome'],
    queryFn: () => apiRequest<ProfilRingkas>('/pesantren/public/site'),
    retry: false,
  });

  const nama = data?.profil.nama_tampilan;

  useEffect(() => {
    const sebelumnya = document.title;
    document.title = nama ? `${nama} — Pondok Pesantren` : 'Sistem Informasi Pondok Pesantren';
    return () => {
      document.title = sebelumnya;
    };
  }, [nama]);

  usePondokFavicon(data?.profil.logo_url);

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
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            {data?.profil.logo_url ? (
              <img src={data.profil.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-700 text-sm font-black text-white">
                ص
              </span>
            )}
            <span>{nama ?? 'Pondok Pesantren'}</span>
          </Link>

          <Link
            to="/masuk"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Masuk
          </Link>
        </div>
      </header>

      <main id="isi-utama" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            {data?.profil.logo_url ? (
              <img src={data.profil.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-xs font-black text-white">
                ص
              </span>
            )}
            {nama ?? 'Pondok Pesantren'}
          </div>
          {data?.profil.tagline && (
            <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">{data.profil.tagline}</p>
          )}
          {(data?.profil.kontak_email || data?.profil.kontak_telepon) && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {data.profil.kontak_telepon}
              {data.profil.kontak_telepon && data.profil.kontak_email && ' · '}
              {data.profil.kontak_email}
            </p>
          )}
          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            © {new Date().getFullYear()} {nama ?? 'Pondok Pesantren'}
          </div>
        </div>
      </footer>
    </div>
  );
}
