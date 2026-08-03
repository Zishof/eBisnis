/**
 * Beranda penyewa pondok pesantren — halaman pertama sesudah masuk.
 *
 * ## Mengapa terpisah dari `/app`
 *
 * `/app` adalah ruang kerja eBisnis: kasir, stok, faktur, distribusi. Pengurus
 * pondok yang mendarat di sana harus menerjemahkan sendiri istilah yang bukan
 * istilahnya, dan menu yang paling menonjol bukan menu yang ia butuhkan.
 *
 * ## Yang jujur ditampilkan di sini
 *
 * Sebagian besar modul pesantren **belum dibangun**. Halaman ini menyebutkan
 * mana yang sudah dapat dibuka dan mana yang belum — dan yang belum tidak dibuat
 * menjadi tombol.
 *
 * Kartu yang dapat ditekan tetapi mendarat di halaman kosong lebih buruk
 * daripada kartu yang menyatakan dirinya belum siap: yang pertama membuat
 * pengurus mengira ia salah memakai, yang kedua memberitahunya apa adanya.
 */

import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { useAuth } from '../../app/auth-context';

interface Kartu {
  judul: string;
  isi: string;
  ke?: string;
}

/** Yang sudah dapat dibuka hari ini. */
const SIAP: Kartu[] = [
  {
    judul: 'Unit pendidikan',
    isi: 'MI, madrasah diniyah, tahfiz, BLK, dan urutan tampilnya.',
    ke: '/app/pesantren/unit-pendidikan',
  },
  {
    judul: 'Santri dan asrama',
    isi: 'Biodata santri, asrama, kamar, dan penempatan santri.',
    ke: '/app/pesantren/asrama',
  },
  {
    judul: 'Tagihan dan pembayaran',
    isi: 'Tagihan SPP, item tagihan, penerbitan, dan pencatatan pembayaran.',
    ke: '/app/pesantren/tagihan',
  },
  {
    judul: 'Pengaturan pondok',
    isi: 'Identitas, pengguna, peran, dan hak akses.',
    ke: '/app/pengaturan',
  },
  {
    judul: 'Ruang kerja lengkap',
    isi: 'Seluruh modul inti — keuangan, pengguna, laporan — masih dapat dibuka dari ruang kerja umum.',
    ke: '/app',
  },
];

/** Yang dijanjikan halaman pemasaran dan belum dibangun. */
const BELUM: Kartu[] = [
  { judul: 'Diniyah dan tahfiz', isi: 'Halaqah, setoran hafalan, dan rapor diniyah.' },
  { judul: 'Perizinan keluar–masuk', isi: 'Pengajuan, persetujuan berjenjang, dan pemberitahuan wali.' },
  { judul: 'Uang saku nontunai', isi: 'Dompet santri untuk kantin dan koperasi.' },
  { judul: 'Situs dan berita pondok', isi: 'Halaman profil dan berita yang disunting pengurus sendiri.' },
];

export function BerandaPondokPage() {
  const { user } = useAuth();

  useEffect(() => {
    const sebelumnya = document.title;
    document.title = 'Beranda pondok';
    return () => {
      document.title = sebelumnya;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-700 font-black text-white">
              ص
            </span>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Beranda pondok</p>
              {user?.username && (
                <p className="ltr-code text-xs text-slate-500 dark:text-slate-400">{user.username}</p>
              )}
            </div>
          </div>
          <Link
            to="/app"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
          >
            Ruang kerja lengkap
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Selamat datang{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Ini beranda pondok Anda, terpisah dari ruang kerja eBisnis. Modul pesantren
          akan muncul di sini seiring dibangun — yang sudah siap dapat ditekan
          sekarang.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sudah dapat dibuka</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SIAP.map((k) => (
              <Link
                key={k.judul}
                to={k.ke!}
                className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
              >
                <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  {k.judul}
                  <ArrowRight
                    className="h-4 w-4 text-emerald-700 transition-transform group-hover:translate-x-0.5 dark:text-emerald-400"
                    aria-hidden
                  />
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{k.isi}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sedang dibangun</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Belum dapat dibuka. Disebutkan di sini supaya Anda tahu apa yang sedang
            disiapkan, bukan mencarinya di menu.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BELUM.map((k) => (
              <div
                key={k.judul}
                className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-5 dark:border-slate-700 dark:bg-slate-900/50"
              >
                <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                  <Clock className="h-4 w-4 text-slate-400" aria-hidden />
                  {k.judul}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{k.isi}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
