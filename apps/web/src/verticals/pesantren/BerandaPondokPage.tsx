/**
 * Beranda penyewa pondok pesantren, halaman pertama sesudah masuk.
 *
 * Kartu pada halaman ini hanya mengarah ke rute yang sudah punya layar nyata.
 * Jika modul baru tersambung, ia harus tampil sebagai kartu siap dibuka supaya
 * pengurus tidak lagi melihat janji lama "sedang dibangun".
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../app/auth-context';

interface Kartu {
  judul: string;
  isi: string;
  ke: string;
}

const SIAP: Kartu[] = [
  {
    judul: 'Unit pendidikan',
    isi: 'MI, madrasah diniyah, tahfiz, BLK, website unit, dan subdomainnya.',
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
    judul: 'Diniyah dan kitab',
    isi: 'Katalog kitab, halaqah, dan anggota pembelajaran diniyah.',
    ke: '/app/pesantren/diniyah',
  },
  {
    judul: 'Tahfiz',
    isi: 'Setoran hafalan, predikat, dan capaian tahfiz santri.',
    ke: '/app/pesantren/tahfiz',
  },
  {
    judul: 'Perizinan keluar-masuk',
    isi: 'Pengajuan izin santri, keputusan pengurus, dan log gerbang.',
    ke: '/app/pesantren/perizinan',
  },
  {
    judul: 'Uang saku nontunai',
    isi: 'Dompet santri, saldo, batas belanja harian, dan kartu RFID/QR.',
    ke: '/app/pesantren/dompet',
  },
  {
    judul: 'Situs dan berita pondok',
    isi: 'Profil situs publik, tema, kontak, dan kabar pondok.',
    ke: '/app/pesantren/profil',
  },
  {
    judul: 'Berita pondok',
    isi: 'Tulis draft kabar pondok dan terbitkan ke halaman publik.',
    ke: '/app/pesantren/berita',
  },
  {
    judul: 'PSB / PPDB',
    isi: 'Gelombang penerimaan, pendaftar, dan tindak lanjut calon santri.',
    ke: '/app/pesantren/psb',
  },
  {
    judul: 'Guru dan akademik',
    isi: 'Guru, rombongan belajar, kurikulum, nilai, dan absensi guru.',
    ke: '/app/pesantren/guru',
  },
  {
    judul: 'Kesiswaan',
    isi: 'Presensi, pelanggaran, prestasi, ekstrakurikuler, dan katering.',
    ke: '/app/pesantren/presensi',
  },
  {
    judul: 'Pengaturan pondok',
    isi: 'Identitas, pengguna, peran, dan hak akses.',
    ke: '/app/pengaturan',
  },
  {
    judul: 'Ruang kerja lengkap',
    isi: 'Seluruh modul inti eBisnis tetap dapat dibuka dari ruang kerja umum.',
    ke: '/app',
  },
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
              S
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
          yang sudah tersambung dapat ditekan langsung dari sini.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sudah dapat dibuka</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SIAP.map((k) => (
              <Link
                key={k.judul}
                to={k.ke}
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

        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
          Beberapa layar masih berupa daftar operasional awal, tetapi sudah membaca API asli dan dapat dibuka dari menu.
        </p>
      </main>
    </div>
  );
}
