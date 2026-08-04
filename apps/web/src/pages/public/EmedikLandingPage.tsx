import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  FileText,
  HeartPulse,
  Hospital,
  LockKeyhole,
  Microscope,
  Pill,
  Presentation,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  UsersRound,
} from 'lucide-react';
import { emedikPublicBrandFor } from './emedik-host';

type LandingTone = 'teal' | 'emerald';

const photos = {
  hero:
    'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1600&q=85',
  hospital:
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=82',
  clinic:
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=82',
  community:
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=900&q=82',
  lab:
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=82',
};

const facilityTypes = [
  {
    id: 'rumah-sakit',
    icon: Hospital,
    title: 'Rumah sakit',
    body: 'Rawat jalan, rawat inap, IGD, operasi, ICU, penunjang, klaim, dan rekam medis.',
    image: photos.hospital,
    alt: 'Koridor rumah sakit modern dengan tempat tidur pasien',
  },
  {
    id: 'klinik',
    icon: Stethoscope,
    title: 'Klinik',
    body: 'Pendaftaran cepat, jadwal dokter, SOAP, resep, billing, dan antrean pasien harian.',
    image: photos.clinic,
    alt: 'Dokter menggunakan tablet saat konsultasi klinik',
  },
  {
    id: 'puskesmas',
    icon: Building2,
    title: 'Puskesmas',
    body: 'UKP, UKM, keluarga, imunisasi, kunjungan rumah, indikator program, dan jejaring layanan.',
    image: photos.community,
    alt: 'Tenaga kesehatan melayani pasien komunitas',
  },
  {
    id: 'posyandu',
    icon: UsersRound,
    title: 'Posyandu',
    body: 'Kader, meja layanan, KMS digital, tumbuh kembang, ibu hamil, lansia, dan rujukan.',
    image: photos.lab,
    alt: 'Tim layanan kesehatan menyiapkan pemeriksaan',
  },
];

const trustSignals = [
  'Data demo diberi tanda jelas',
  'Akses rekam medis diaudit',
  'BPJS dan SATUSEHAT lewat adapter',
  'Investor tidak melihat data pasien',
];

const workflow = [
  {
    icon: CalendarCheck,
    title: 'Pendaftaran dan antrean',
    body: 'Appointment, walk-in, check-in, eligibility, loket, dan alur pasien sejak pintu depan.',
  },
  {
    icon: ClipboardList,
    title: 'Pelayanan klinis',
    body: 'SOAP, tanda vital, diagnosis, order, edukasi, follow-up, dan tanda tangan catatan.',
  },
  {
    icon: Pill,
    title: 'Farmasi dan penunjang',
    body: 'Telaah resep, dispensing, eMAR, lab, radiologi, hasil kritis, dan pelepasan hasil.',
  },
  {
    icon: ShieldCheck,
    title: 'Mutu dan kepatuhan',
    body: 'Koding, legal hold, break-glass, masking, audit akses, dan keselamatan pasien.',
  },
];

const implementationSteps = [
  ['01', 'Profil fasilitas', 'Jenis fasilitas, unit layanan, jam operasional, dan kanal pendaftaran.'],
  ['02', 'Peran dan hak akses', 'Dokter, perawat, farmasi, kasir, admin, manajemen, dan auditor dipisahkan.'],
  ['03', 'Data awal aman', 'Sample data bisa dinyalakan untuk demo tanpa bercampur dengan data produksi.'],
  ['04', 'Go-live bertahap', 'Mulai dari pendaftaran, rawat jalan, farmasi, billing, lalu penunjang dan klaim.'],
];

const securityControls = [
  ['Purpose of use', 'Setiap akses rekam medis membawa alasan penggunaan.'],
  ['Break-glass', 'Akses darurat tercatat dan wajib ditelaah setelah kejadian.'],
  ['Masking', 'Medan sensitif disamarkan sesuai peran dan konteks.'],
  ['Audit klinis', 'Jejak baca dan tulis pasien tetap dapat ditelusuri.'],
];

const successStories = [
  [Activity, 'Antrean lebih terkendali', 'Loket, klinisi, farmasi, dan kasir membaca status yang sama.'],
  [UsersRound, 'Pasien ganda terdeteksi', 'Identitas lintas kunjungan ditelaah sebelum digabungkan.'],
  [Pill, 'Obat lebih aman', 'Resep, telaah, dispensing, dan pemberian memakai pagar keselamatan.'],
  [Sparkles, 'Demo tidak menipu', 'Data contoh terlihat jelas dan dapat dibersihkan tanpa menghapus jejak produksi.'],
];

const medicalSignals = [
  [BedDouble, 'Rawat inap dan bed management'],
  [Microscope, 'Lab, radiologi, dan hasil kritis'],
  [Syringe, 'Imunisasi dan layanan komunitas'],
  [HeartPulse, 'IGD, operasi, ICU, dan telaah darurat'],
];

function fallbackImageData(label: string, tone: 'teal' | 'emerald' | 'cyan') {
  const colors = {
    teal: ['#0f766e', '#155e75', '#f0fdfa'],
    emerald: ['#047857', '#064e3b', '#ecfdf5'],
    cyan: ['#0369a1', '#0f766e', '#ecfeff'],
  }[tone];
  const safeLabel = label.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="${colors[0]}"/>
        <stop offset="1" stop-color="${colors[1]}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <circle cx="980" cy="120" r="240" fill="${colors[2]}" opacity=".18"/>
    <circle cx="180" cy="690" r="220" fill="${colors[2]}" opacity=".14"/>
    <path d="M570 230h120v120h120v120H690v120H570V470H450V350h120z" fill="${colors[2]}" opacity=".82"/>
    <text x="80" y="700" fill="${colors[2]}" font-family="Arial, sans-serif" font-size="54" font-weight="800">${safeLabel}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function LandingImage({
  src,
  alt,
  className,
  fallbackLabel,
  tone = 'teal',
}: {
  src: string;
  alt: string;
  className: string;
  fallbackLabel: string;
  tone?: 'teal' | 'emerald' | 'cyan';
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="eager"
      decoding="async"
      onError={(event) => {
        event.currentTarget.src = fallbackImageData(fallbackLabel, tone);
      }}
    />
  );
}

export const offerDocuments = [
  {
    icon: FileText,
    title: 'Proposal Penawaran',
    href: '/proposal',
    body: 'Ruang lingkup, manfaat, tahapan implementasi, dan gambaran kerja sama.',
  },
  {
    icon: BadgeCheck,
    title: 'Surat Penawaran',
    href: '/penawaran',
    body: 'Dokumen ringkas untuk pembahasan paket, harga, dan langkah berikutnya.',
  },
  {
    icon: Presentation,
    title: 'Presentasi',
    href: '/presentasi',
    body: 'Bahan rapat untuk pimpinan fasilitas, tim operasional, dan calon mitra.',
  },
  {
    icon: FileSignature,
    title: 'Draft PKS',
    href: '/pks',
    body: 'Draf perjanjian kerja sama sebagai bahan review legal dan manajemen.',
  },
];

export function EmedikLandingPage() {
  const brand = emedikPublicBrandFor();
  const brandName = brand?.kind === 'emedik' ? brand.name : 'eMedik.id';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <LandingHeader
        brand={brandName}
        logoText={brand?.logoText ?? 'eM'}
        links={['Solusi', 'Alur', 'Keamanan', 'Dokumen', 'Demo']}
      />

      <main>
        <section className="overflow-hidden border-b border-slate-200 bg-white">
          <div className="container-page grid gap-10 py-8 sm:py-12 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-14">
            <div className="relative z-10">
              <p className="section-eyebrow bg-teal-50 text-teal-800">
                Sistem Rumah Sakit, Klinik, Puskesmas, dan Posyandu
              </p>
              <h1 className="max-w-4xl text-4xl font-black leading-[1.04] text-slate-950 sm:text-5xl lg:text-6xl">
                Satu rekam perjalanan pasien, dari loket sampai layanan selesai.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
                eMedik.id menyatukan pendaftaran, rekam medis, farmasi, penunjang,
                billing, klaim, dan portal pasien dengan kontrol akses klinis yang
                tetap mudah dipakai oleh tim harian.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/daftar" className="btn-primary bg-teal-700 px-6 py-3 text-base hover:bg-teal-800">
                  Daftar fasilitas
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to="/demo" className="btn-outline px-6 py-3 text-base">
                  Lihat demo
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {trustSignals.map((item) => (
                  <p key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-2xl">
                <div className="relative min-h-[23rem] sm:min-h-[30rem]">
                  <LandingImage
                    src={photos.hero}
                    alt="Tim rumah sakit menyiapkan layanan pasien di ruang perawatan"
                    className="absolute inset-0 h-full w-full object-cover opacity-80"
                    fallbackLabel="eMedik command center"
                    tone="cyan"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                    <div className="rounded-xl bg-white/95 p-4 text-slate-950 shadow-xl ring-1 ring-white/40 backdrop-blur sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-teal-700">
                            Command center fasilitas
                          </p>
                          <h2 className="mt-1 text-2xl font-black">Status pasien lintas unit</h2>
                        </div>
                        <span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                          Live demo
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {[
                          ['128', 'antrean hari ini'],
                          ['37', 'resep ditelaah'],
                          ['4', 'akses darurat'],
                        ].map(([value, label]) => (
                          <div key={label} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                            <p className="text-2xl font-black text-slate-950">{value}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-5">
                        {['Check-in', 'Triase', 'Dokter', 'Farmasi', 'Billing'].map((step, index) => (
                          <div key={step} className="rounded-lg bg-teal-50 px-3 py-2 text-center text-xs font-bold text-teal-900">
                            {index + 1}. {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {medicalSignals.map(([Icon, label]) => {
                  const IconComponent = Icon as typeof BedDouble;
                  return (
                    <div key={label as string} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                        <IconComponent className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="text-sm font-bold text-slate-800">{label as string}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="Solusi" className="bg-slate-50 py-14 sm:py-16">
          <div className="container-page">
            <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <p className="section-eyebrow bg-white text-teal-800">Satu vertical kesehatan</p>
                <h2 className="section-heading text-slate-950">
                  Dibangun untuk fasilitas yang ritmenya berbeda.
                </h2>
              </div>
              <p className="max-w-3xl text-base leading-8 text-slate-700">
                Rumah sakit butuh koordinasi lintas unit, klinik butuh cepat,
                puskesmas butuh program komunitas, dan posyandu butuh alur kader
                yang sederhana. Semuanya memakai fondasi data pasien yang sama.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {facilityTypes.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    id={item.id}
                    key={item.title}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg"
                  >
                    <div className="relative h-44 overflow-hidden bg-gradient-to-br from-teal-100 via-cyan-50 to-slate-200">
                      <LandingImage
                        src={item.image}
                        alt={item.alt}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        fallbackLabel={item.title}
                        tone="teal"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 to-transparent" />
                      <span className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-lg bg-white text-teal-700 shadow">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-slate-950">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="Alur" className="bg-white py-14 sm:py-16">
          <div className="container-page">
            <div className="max-w-3xl">
              <p className="section-eyebrow bg-teal-50 text-teal-800">Alur kerja harian</p>
              <h2 className="section-heading text-slate-950">
                Dari pasien datang sampai tagihan selesai.
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-8 text-slate-700">
                Informasi penting dinaikkan ke permukaan, aksi berbahaya diberi
                pagar, dan setiap perpindahan status meninggalkan jejak.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {workflow.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <Icon className="h-6 w-6 text-teal-700" aria-hidden />
                    <h3 className="mt-4 font-bold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                );
              })}
            </div>

            <ol className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {implementationSteps.map(([number, title, body]) => (
                <li key={number} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="font-mono text-xs font-black text-teal-700">{number}</span>
                  <p className="mt-2 font-bold text-slate-950">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="Keamanan" className="bg-slate-950 py-14 text-white sm:py-16">
          <div className="container-page grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="section-eyebrow bg-white/10 text-teal-200">Keamanan klinis</p>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">
                Data pasien tidak diperlakukan seperti data transaksi biasa.
              </h2>
              <p className="mt-4 leading-7 text-slate-300">
                Pola keamanan dibuat untuk situasi klinis: ada akses rutin, ada
                akses darurat, ada data yang harus disamarkan, dan semuanya harus
                bisa ditelaah.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {securityControls.map(([title, body]) => (
                <article key={title} className="rounded-xl bg-white/10 p-5 ring-1 ring-white/10">
                  <LockKeyhole className="h-5 w-5 text-teal-200" aria-hidden />
                  <h3 className="mt-4 font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-14 sm:py-16">
          <div className="container-page grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="section-eyebrow bg-cyan-50 text-cyan-800">Best practice operasional</p>
              <h2 className="section-heading text-slate-950">
                Dibuat untuk mengurangi kerja ulang, bukan menambah layar.
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-8 text-slate-700">
                Pengalaman terbaik di fasilitas kesehatan biasanya sederhana:
                status antrean terbaca, identitas pasien tidak ganda, resep tidak
                lepas dari telaah, dan pimpinan mendapat laporan yang dapat dipercaya.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {successStories.map(([Icon, title, body]) => {
                const IconComponent = Icon as typeof Activity;
                return (
                  <article key={title as string} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <IconComponent className="h-6 w-6 text-cyan-700" aria-hidden />
                    <h3 className="mt-4 font-bold text-slate-950">{title as string}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{body as string}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <OfferDocumentSection tone="teal" />

        <LandingCta
          title={`Siapkan fasilitas kesehatan Anda di ${brandName}`}
          primary="Mulai daftar"
          secondary="Buka demo"
        />
      </main>
    </div>
  );
}

export function LandingHeader({
  brand,
  links,
  logoText = 'eM',
  tone = 'teal',
}: {
  brand: string;
  links: string[];
  logoText?: string;
  tone?: LandingTone;
}) {
  const logoClass = tone === 'emerald' ? 'bg-emerald-700' : 'bg-teal-700';
  const navHover =
    tone === 'emerald' ? 'hover:bg-emerald-50 hover:text-emerald-800' : 'hover:bg-teal-50 hover:text-teal-800';
  const mobileClass = tone === 'emerald' ? 'bg-emerald-50 text-emerald-800' : 'bg-teal-50 text-teal-800';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex min-h-16 items-center justify-between gap-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-black text-slate-950">
          <span className={`grid h-9 w-9 place-items-center rounded-lg text-sm text-white ${logoClass}`}>
            {logoText}
          </span>
          <span>{brand}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi landing">
          {links.map((link) => (
            <a
              key={link}
              href={`#${link.replace(/\s+/g, '-')}`}
              className={`rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 ${navHover}`}
            >
              {link}
            </a>
          ))}
        </nav>
        <Link to="/masuk" className="btn-secondary px-4 py-2.5">
          Masuk
        </Link>
      </div>
      <nav className="container-page flex gap-2 overflow-x-auto pb-3 md:hidden" aria-label="Navigasi landing mobile">
        {links.map((link) => (
          <a
            key={link}
            href={`#${link.replace(/\s+/g, '-')}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${mobileClass}`}
          >
            {link}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function LandingCta({
  title,
  primary,
  secondary,
  tone = 'teal',
}: {
  title: string;
  primary: string;
  secondary: string;
  tone?: LandingTone;
}) {
  const sectionClass = tone === 'emerald' ? 'bg-emerald-700' : 'bg-teal-700';
  const copyClass = tone === 'emerald' ? 'text-emerald-50' : 'text-teal-50';
  const primaryClass =
    tone === 'emerald' ? 'text-emerald-800 hover:bg-emerald-50' : 'text-teal-800 hover:bg-teal-50';

  return (
    <section id="Demo" className={`${sectionClass} py-14 text-white`}>
      <div className="container-page flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
          <p className={`mt-2 max-w-2xl ${copyClass}`}>
            Tim operasional bisa mulai dari data demo, lalu memindahkan konfigurasi
            ke lingkungan produksi setelah alurnya disepakati.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link to="/daftar" className={`btn bg-white px-5 py-3 ${primaryClass}`}>
            {primary}
          </Link>
          <Link to="/demo" className="btn border border-white/40 px-5 py-3 text-white hover:bg-white/10">
            {secondary}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function OfferDocumentSection({ tone }: { tone: 'teal' | 'emerald' }) {
  const accent = tone === 'emerald' ? 'text-emerald-800 bg-emerald-50' : 'text-teal-800 bg-teal-50';
  const button = tone === 'emerald' ? 'text-emerald-800 hover:bg-emerald-50' : 'text-teal-800 hover:bg-teal-50';

  return (
    <section id="Dokumen" className="bg-slate-50 py-14 sm:py-16">
      <div className="container-page">
        <div className="max-w-3xl">
          <p className={`section-eyebrow ${accent}`}>Dokumen kerja sama</p>
          <h2 className="section-heading text-slate-950">Bahan resmi untuk evaluasi dan approval.</h2>
          <p className="mt-3 max-w-3xl text-base leading-8 text-slate-700">
            Empat dokumen ini tersedia langsung dari landing page supaya calon
            fasilitas dapat membaca proposal, penawaran, presentasi, dan draft
            PKS tanpa masuk ke dashboard.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {offerDocuments.map((doc) => {
            const Icon = doc.icon;
            return (
              <Link
                key={doc.href}
                to={doc.href}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <Icon className="h-5 w-5 text-slate-500" aria-hidden />
                <h3 className="mt-4 font-bold text-slate-950">{doc.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{doc.body}</p>
                <span className={`mt-4 inline-flex items-center gap-2 text-sm font-bold ${button}`}>
                  Buka dokumen
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default EmedikLandingPage;
