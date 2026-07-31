/**
 * Kerangka portal anggota.
 *
 * Dirancang untuk telepon genggam lebih dahulu. Anggota koperasi simpan pinjam
 * di kabupaten membuka portalnya dari telepon, bukan dari meja kerja — jadi
 * menu ada di bawah pada layar sempit, dan angka yang paling sering dicari
 * (saldo simpanan, sisa pinjaman, tanggal angsuran berikutnya) berada di layar
 * pertama tanpa perlu digulir.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Coins,
  HandCoins,
  LayoutDashboard,
  MessageSquareWarning,
  PiggyBank,
  Users,
} from 'lucide-react';
import { portalApi } from './portal-api';
import { menuUntuk, type EntriMenu, type StatusKeanggotaan } from './portal-menu';

const IKON: Record<string, typeof Bell> = {
  LayoutDashboard,
  PiggyBank,
  HandCoins,
  Coins,
  Users,
  MessageSquareWarning,
  Bell,
};

function Lencana({ jumlah }: { jumlah: number }) {
  if (jumlah <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
      {jumlah > 99 ? '99+' : jumlah}
    </span>
  );
}

export function PortalLayout() {
  const { data: ringkasan, isLoading, isError, error } = useQuery({
    queryKey: ['cooperative', 'portal', 'me'],
    queryFn: portalApi.ringkasan,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Memuat portal anggota…
      </div>
    );
  }

  /*
   * Kegagalan di sini hampir selalu berarti satu dari dua hal: penggunanya
   * bukan anggota, atau akun portalnya belum diaktifkan pengurus. Keduanya
   * bukan galat teknis, jadi disampaikan sebagai keterangan, bukan sebagai
   * tumpukan pesan kesalahan.
   */
  if (isError || !ringkasan) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950/40">
          <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
            Portal anggota belum dapat dibuka
          </h1>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            {(error as Error | undefined)?.message ??
              'Akun Anda belum tertaut ke keanggotaan koperasi mana pun.'}
          </p>
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
            Hubungi pengurus koperasi untuk mengaktifkan akun portal Anda.
          </p>
        </div>
      </div>
    );
  }

  const menu = menuUntuk(ringkasan.status as StatusKeanggotaan);

  const lencanaUntuk = (m: EntriMenu) => {
    if (m.lencana === 'pemberitahuan') return ringkasan.pemberitahuanBelumDibaca;
    if (m.lencana === 'pengaduan') return ringkasan.pengaduanTerbuka;
    return 0;
  };

  if (menu.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold">Keanggotaan Anda telah berakhir</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Data Anda tetap tersimpan untuk keperluan penyelesaian dan audit, tetapi tidak lagi
            dapat dibuka lewat portal. Hubungi pengurus bila Anda memerlukannya.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page flex items-center justify-between py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Portal Anggota</p>
            <h1 className="text-lg font-semibold">{ringkasan.fullName}</h1>
            <p className="text-xs text-slate-500">
              No. Anggota {ringkasan.memberNumber ?? '—'}
            </p>
          </div>
        </div>
      </header>

      <div className="container-page flex gap-6 py-6">
        {/* Menu samping — layar lebar */}
        <nav className="hidden w-56 shrink-0 md:block">
          <ul className="space-y-1">
            {menu.map((m) => {
              const Ikon = IKON[m.ikon] ?? LayoutDashboard;
              return (
                <li key={m.path || 'ringkasan'}>
                  <NavLink
                    to={m.path}
                    end={m.path === ''}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <Ikon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{m.label}</span>
                    <Lencana jumlah={lencanaUntuk(m)} />
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet context={ringkasan} />
        </main>
      </div>

      {/* Menu bawah — telepon genggam */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-900">
        <ul className="flex">
          {menu.slice(0, 5).map((m) => {
            const Ikon = IKON[m.ikon] ?? LayoutDashboard;
            return (
              <li key={m.path || 'ringkasan'} className="flex-1">
                <NavLink
                  to={m.path}
                  end={m.path === ''}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-2 text-[0.65rem] ${
                      isActive ? 'text-emerald-600' : 'text-slate-500'
                    }`
                  }
                >
                  <span className="relative">
                    <Ikon className="h-5 w-5" aria-hidden />
                    {lencanaUntuk(m) > 0 && (
                      <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-rose-600" />
                    )}
                  </span>
                  <span>{m.label.replace(' Saya', '')}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
