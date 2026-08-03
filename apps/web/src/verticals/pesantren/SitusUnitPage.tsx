import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, GraduationCap } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface ProfilUnit {
  theme_code: string;
  nama_tampilan: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  alamat_publik: string | null;
  kontak_telepon: string | null;
  kontak_whatsapp: string | null;
  kontak_email: string | null;
}

interface UnitPublik {
  code: string;
  name: string;
  jenis: string;
  public_slug: string;
  santri_subdomain: string | null;
  custom_domain: string | null;
  domain_status: string;
  welcome_title: string | null;
  welcome_body: string | null;
}

interface GelombangUnit {
  id: string;
  kode: string;
  nama: string;
  tanggal_buka: string;
  tanggal_tutup: string;
  biaya_pendaftaran: string;
  status: string;
}

interface IsiUnit {
  profil: ProfilUnit;
  unit: UnitPublik;
  gelombang: GelombangUnit[];
}

const LABEL_JENIS_UNIT: Record<string, string> = {
  SEKOLAH_FORMAL: 'Pendidikan Formal',
  DINIYAH: 'Madrasah Diniyah',
  TAHFIZ: 'Tahfizul Quran',
  LAINNYA: 'Pendidikan Nonformal',
};

export function SitusUnitPage() {
  const { slug = '' } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pesantren', 'unit-publik', slug],
    queryFn: () => apiRequest<IsiUnit>(`/pesantren/public/unit/${slug}`),
    retry: false,
  });

  useEffect(() => {
    const sebelumnya = document.title;
    document.title = data?.unit.name ?? 'Unit pendidikan';
    return () => {
      document.title = sebelumnya;
    };
  }, [data?.unit.name]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-slate-500">Memuat unit...</div>;
  if (isError || !data) return <UnitTidakDitemukan />;

  const { profil, unit, gelombang } = data;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="relative overflow-hidden bg-emerald-800 text-white">
        {profil.hero_image_url && <img src={profil.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />}
        <div className="container-page relative py-14 sm:py-20">
          <Link to="/santri/pondok" className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Situs pondok
          </Link>
          <div className="mt-6 flex items-center gap-4">
            {profil.logo_url ? (
              <img src={profil.logo_url} alt="" className="h-14 w-14 rounded-full ring-4 ring-white/25" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-white/15">
                <GraduationCap className="h-7 w-7" aria-hidden />
              </span>
            )}
            <div>
              <p className="text-sm uppercase tracking-widest text-white/70">{LABEL_JENIS_UNIT[unit.jenis] ?? unit.jenis}</p>
              <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{unit.name}</h1>
              {profil.nama_tampilan && <p className="mt-2 text-white/85">Bagian dari Pondok Pesantren {profil.nama_tampilan}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="container-page space-y-10 py-12">
        <section className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {unit.welcome_title || `Selamat datang di ${unit.name}`}
            </h2>
            <p className="mt-4 whitespace-pre-line leading-7 text-slate-700 dark:text-slate-300">
              {unit.welcome_body ||
                'Halaman unit ini disiapkan sebagai pintu informasi khusus satuan pendidikan. Pengurus dapat melengkapi sambutan, informasi program, dan tautan penerimaan santri baru dari pengaturan unit pendidikan.'}
            </p>
          </div>
          <aside className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">Alamat Digital</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <Info label="Kode unit" value={unit.code} />
              <Info label="Halaman induk" value={`/santri/pondok/unit/${unit.public_slug}`} />
              <Info label="Subdomain santri.info" value={unit.santri_subdomain ? `${unit.santri_subdomain}.santri.info` : '-'} />
              <Info label="Domain kustom" value={unit.custom_domain ?? '-'} />
              <Info label="Status domain" value={unit.domain_status} />
            </dl>
          </aside>
        </section>

        <section>
          <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-700 dark:text-emerald-400">
            <CalendarDays className="h-5 w-5" aria-hidden />
            PSB/PPDB Unit Ini
          </h2>
          {gelombang.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Belum ada gelombang PSB yang diumumkan untuk unit ini.</p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gelombang.map((g) => (
                <Link
                  key={g.id}
                  to={`/santri/pondok/psb/daftar/${g.id}`}
                  className="rounded-xl border border-slate-200 p-5 hover:border-emerald-400 dark:border-slate-800"
                >
                  <p className="text-xs font-medium uppercase text-slate-400">{g.kode}</p>
                  <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{g.nama}</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {g.tanggal_buka} - {g.tanggal_tutup}
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {g.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}

function UnitTidakDitemukan() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-16 dark:bg-slate-950">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Unit pendidikan belum tersedia</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Halaman unit ini belum diterbitkan atau alamatnya tidak ditemukan.
        </p>
        <Link to="/santri/pondok" className="btn-primary mt-6">
          Kembali ke situs pondok
        </Link>
      </div>
    </div>
  );
}
