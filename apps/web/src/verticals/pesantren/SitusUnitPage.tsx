import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, GraduationCap, Globe2, Mail, MapPin, Phone } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { usePondokFavicon } from './use-pondok-favicon';
import { usePondokSeo } from './use-pondok-seo';

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

  usePondokFavicon(data?.profil.logo_url);
  usePondokSeo(
    data
      ? {
          nama: data.unit.name,
          deskripsi:
            data.unit.welcome_body ||
            data.unit.welcome_title ||
            (data.profil.nama_tampilan ? `Unit pendidikan Pondok Pesantren ${data.profil.nama_tampilan}` : null),
          logoUrl: data.profil.logo_url,
          heroImageUrl: data.profil.hero_image_url,
          alamat: data.profil.alamat_publik,
          telepon: data.profil.kontak_telepon,
        }
      : undefined,
  );

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-slate-500">Memuat unit...</div>;
  if (isError || !data) return <UnitTidakDitemukan />;

  const { profil, unit, gelombang } = data;
  const alamatDigital = unit.custom_domain || (unit.santri_subdomain ? `${unit.santri_subdomain}.santri.info` : null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-sky-50">
        {profil.hero_image_url && (
          <>
            <img src={profil.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/40" aria-hidden />
          </>
        )}
        <div className="container-page relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <Link to="/santri/pondok" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Situs pondok
            </Link>
            <div className="mt-8 flex items-center gap-4">
              {profil.logo_url ? (
                <img src={profil.logo_url} alt="" className="h-16 w-16 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200">
                  <GraduationCap className="h-8 w-8" aria-hidden />
                </span>
              )}
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">{LABEL_JENIS_UNIT[unit.jenis] ?? unit.jenis}</p>
                <h1 className="mt-2 max-w-4xl text-3xl font-bold leading-tight text-slate-950 sm:text-5xl">{unit.name}</h1>
                {profil.nama_tampilan && <p className="mt-3 text-base text-slate-600">Bagian dari Pondok Pesantren {profil.nama_tampilan}</p>}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {gelombang.length > 0 && (
                <Link
                  to={`/santri/pondok/psb/daftar/${gelombang[0].id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                >
                  Daftar PSB/PPDB
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
              {alamatDigital && (
                <a
                  href={`https://${alamatDigital}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:border-emerald-300 hover:text-emerald-800"
                >
                  <Globe2 className="h-4 w-4" aria-hidden />
                  {alamatDigital}
                </a>
              )}
            </div>
          </div>
          <aside className="rounded-2xl border border-white bg-white/85 p-5 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Ringkasan Unit</p>
            <div className="mt-4 space-y-3">
              <HeroFact icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} label="Status domain" value={unit.domain_status} />
              <HeroFact icon={<Globe2 className="h-5 w-5" aria-hidden />} label="Alamat digital" value={alamatDigital ?? `/santri/pondok/unit/${unit.public_slug}`} />
              {profil.alamat_publik && <HeroFact icon={<MapPin className="h-5 w-5" aria-hidden />} label="Alamat" value={profil.alamat_publik} />}
            </div>
          </aside>
        </div>
      </section>

      <main className="container-page space-y-12 py-12">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Selamat Datang</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">
              {unit.welcome_title || `Selamat datang di ${unit.name}`}
            </h2>
            <p className="mt-4 whitespace-pre-line leading-7 text-slate-700">
              {unit.welcome_body ||
                'Halaman unit ini disiapkan sebagai pintu informasi khusus satuan pendidikan. Pengurus dapat melengkapi sambutan, informasi program, dan tautan penerimaan santri baru dari pengaturan unit pendidikan.'}
            </p>
          </div>
          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-950">Alamat Digital</h3>
            <dl className="mt-4 space-y-4 text-sm">
              <Info label="Kode unit" value={unit.code} />
              <Info label="Halaman induk" value={`/santri/pondok/unit/${unit.public_slug}`} />
              <Info label="Subdomain santri.info" value={unit.santri_subdomain ? `${unit.santri_subdomain}.santri.info` : '-'} />
              <Info label="Domain kustom" value={unit.custom_domain ?? '-'} />
              <Info label="Status domain" value={unit.domain_status} />
            </dl>
          </aside>
        </section>

        {(profil.kontak_telepon || profil.kontak_whatsapp || profil.kontak_email || profil.alamat_publik) && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {profil.kontak_telepon && <ContactCard icon={<Phone className="h-5 w-5" aria-hidden />} label="Telepon" value={profil.kontak_telepon} />}
            {profil.kontak_whatsapp && <ContactCard icon={<Phone className="h-5 w-5" aria-hidden />} label="WhatsApp" value={profil.kontak_whatsapp} />}
            {profil.kontak_email && <ContactCard icon={<Mail className="h-5 w-5" aria-hidden />} label="Email" value={profil.kontak_email} />}
            {profil.alamat_publik && <ContactCard icon={<MapPin className="h-5 w-5" aria-hidden />} label="Alamat" value={profil.alamat_publik} />}
          </section>
        )}

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">
                <CalendarDays className="h-4 w-4" aria-hidden />
                PSB/PPDB
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Gelombang Penerimaan Unit Ini</h2>
            </div>
          </div>
          {gelombang.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              Belum ada gelombang PSB yang diumumkan untuk unit ini.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gelombang.map((g) => (
                <Link
                  key={g.id}
                  to={`/santri/pondok/psb/daftar/${g.id}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{g.kode}</p>
                  <h3 className="mt-2 font-bold text-slate-950">{g.nama}</h3>
                  <p className="mt-3 text-sm text-slate-500">
                    {g.tanggal_buka} - {g.tanggal_tutup}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {g.status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:text-emerald-900">
                      Daftar
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
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
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function HeroFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function ContactCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">{icon}</span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function UnitTidakDitemukan() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-950">Unit pendidikan belum tersedia</h1>
        <p className="mt-3 text-slate-600">
          Halaman unit ini belum diterbitkan atau alamatnya tidak ditemukan.
        </p>
        <Link to="/santri/pondok" className="btn-primary mt-6">
          Kembali ke situs pondok
        </Link>
      </div>
    </div>
  );
}
