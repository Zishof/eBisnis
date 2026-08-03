import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  FileText,
  HeartPulse,
  Hospital,
  LockKeyhole,
  Pill,
  Presentation,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
} from 'lucide-react';

const facilityTypes = [
  {
    icon: Hospital,
    title: 'Rumah sakit',
    body: 'Rawat jalan, rawat inap, IGD, operasi, ICU, penunjang, klaim, dan rekam medis.',
  },
  {
    icon: Stethoscope,
    title: 'Klinik',
    body: 'Pendaftaran cepat, jadwal dokter, SOAP, resep, billing, dan antrean pasien harian.',
  },
  {
    icon: Building2,
    title: 'Puskesmas',
    body: 'UKP, UKM, keluarga, imunisasi, kunjungan rumah, indikator program, dan jejaring layanan.',
  },
  {
    icon: UsersRound,
    title: 'Posyandu',
    body: 'Kader, meja layanan, KMS digital, tumbuh kembang, ibu hamil, lansia, dan rujukan.',
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
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <LandingHeader brand="eMedik.id" links={['Solusi', 'Alur', 'Keamanan', 'Dokumen', 'Demo']} />

      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:py-16">
            <div>
              <p className="section-eyebrow bg-teal-50 text-teal-800">
                Sistem Rumah Sakit, Klinik, Puskesmas, dan Posyandu
              </p>
              <h1 className="max-w-4xl text-4xl font-black leading-[1.05] text-slate-950 sm:text-5xl lg:text-6xl">
                Operasional kesehatan dalam satu alur yang aman.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                eMedik.id menyatukan pendaftaran, rekam medis, penunjang, farmasi,
                billing, klaim, dan portal pasien tanpa mengorbankan kontrol akses
                klinis.
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
                  <p key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <div className="lg:ps-4">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500 text-slate-950">
                      <HeartPulse className="h-4 w-4" aria-hidden />
                    </span>
                    Command center fasilitas
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Live demo
                  </span>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  {[
                    ['128', 'antrean hari ini'],
                    ['37', 'resep ditelaah'],
                    ['4', 'akses darurat'],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-lg bg-white/10 p-4 ring-1 ring-white/10">
                      <p className="text-2xl font-black text-white">{value}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-lg bg-white p-4 text-slate-950">
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                      Alur pasien
                    </p>
                    <ol className="mt-4 space-y-3">
                      {['Check-in', 'Triase', 'Dokter', 'Farmasi', 'Billing'].map((step, index) => (
                        <li key={step} className="flex items-center gap-3">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-50 text-xs font-black text-teal-800">
                            {index + 1}
                          </span>
                          <span className="text-sm font-semibold">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="rounded-lg bg-teal-400 p-4 text-slate-950">
                    <p className="text-sm font-bold">Portal tenant</p>
                    <p className="mt-1 break-all font-mono text-base sm:text-lg">mitrasehat.emedik.id</p>
                    <p className="mt-3 text-sm leading-6">
                      Profil fasilitas, dokter, jadwal, layanan, pendaftaran online,
                      antrean, hasil yang boleh diakses, resep, dan edukasi pasien.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="Solusi" className="bg-slate-50 py-14 sm:py-16">
          <div className="container-page">
            <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <p className="section-eyebrow bg-white text-teal-800">Satu vertical kesehatan</p>
                <h2 className="section-heading text-slate-950">
                  Dibangun untuk fasilitas yang ritmenya berbeda.
                </h2>
              </div>
              <p className="section-lead mt-0">
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
                    key={item.title}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
                  >
                    <Icon className="h-6 w-6 text-teal-700" aria-hidden />
                    <h3 className="mt-4 font-bold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
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
              <p className="section-lead">
                Informasi penting dinaikkan ke permukaan, aksi berbahaya diberi
                pagar, dan setiap perpindahan status meninggalkan jejak.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {workflow.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <Icon className="h-6 w-6 text-teal-700" aria-hidden />
                    <h3 className="mt-4 font-bold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                );
              })}
            </div>

            <ol className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {implementationSteps.map(([number, title, body]) => (
                <li key={number} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
                <article key={title} className="rounded-lg bg-white/10 p-5 ring-1 ring-white/10">
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
              <p className="section-lead">
                Landing ini menonjolkan cerita sukses yang paling sering terjadi
                di lapangan: antrean lebih terbaca, data pasien tidak ganda,
                resep tidak lepas dari telaah, dan pimpinan mendapat laporan yang
                dapat dipercaya.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Activity, 'Antrean lebih terkendali', 'Loket, klinisi, farmasi, dan kasir membaca status yang sama.'],
                [UsersRound, 'Pasien ganda terdeteksi', 'Identitas lintas kunjungan ditelaah sebelum digabungkan.'],
                [Pill, 'Obat lebih aman', 'Resep, telaah, dispensing, dan pemberian memakai pagar keselamatan.'],
                [Sparkles, 'Demo tidak menipu', 'Data contoh terlihat jelas dan dapat dibersihkan tanpa menghapus jejak produksi.'],
              ].map(([Icon, title, body]) => {
                const IconComponent = Icon as typeof Activity;
                return (
                  <article key={title as string} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
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

        <LandingCta title="Siapkan fasilitas kesehatan Anda di eMedik.id" primary="Mulai daftar" secondary="Buka demo" />
      </main>
    </div>
  );
}

export function LandingHeader({ brand, links }: { brand: string; links: string[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex min-h-16 items-center justify-between gap-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-black text-slate-950">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-700 text-sm text-white">eM</span>
          <span>{brand}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi landing">
          {links.map((link) => (
            <a
              key={link}
              href={`#${link}`}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              {link}
            </a>
          ))}
        </nav>
        <Link to="/masuk" className="btn-secondary px-4 py-2.5">
          Masuk
        </Link>
      </div>
    </header>
  );
}

export function LandingCta({ title, primary, secondary }: { title: string; primary: string; secondary: string }) {
  return (
    <section id="Demo" className="bg-teal-700 py-14 text-white">
      <div className="container-page flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-teal-50">
            Tim operasional bisa mulai dari data demo, lalu memindahkan konfigurasi
            ke lingkungan produksi setelah alurnya disepakati.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link to="/daftar" className="btn bg-white px-5 py-3 text-teal-800 hover:bg-teal-50">
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
          <p className="section-lead">
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
                className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
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
