import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Hospital,
  Pill,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-react';

const facilityTypes = [
  { icon: Hospital, title: 'Rumah sakit', body: 'Rawat jalan, rawat inap, IGD, operasi, ICU, lab, radiologi, klaim, dan rekam medis.' },
  { icon: Stethoscope, title: 'Klinik', body: 'Pendaftaran cepat, jadwal dokter, SOAP, resep, billing, dan antrean pasien harian.' },
  { icon: Building2, title: 'Puskesmas', body: 'UKP, UKM, keluarga, imunisasi, kunjungan rumah, indikator program, dan jejaring layanan.' },
  { icon: UsersRound, title: 'Posyandu', body: 'Kader, meja layanan, KMS digital, tumbuh kembang, ibu hamil, lansia, dan rujukan.' },
];

const operatingLines = [
  'Enterprise patient index dengan deteksi pasien ganda.',
  'Purpose of use, consent, break-glass, masking, dan audit.',
  'Resep, farmasi, lab, radiologi, billing, BPJS, dan SATUSEHAT lewat adapter.',
  'Sample data demo ditandai jelas dan tidak bercampur dengan data nyata.',
];

const workflow = [
  { icon: CalendarCheck, title: 'Daftar dan check-in', body: 'Appointment, walk-in, eligibility, antrean, dan alur pasien sejak loket.' },
  { icon: ClipboardList, title: 'Kunjungan klinis', body: 'SOAP, tanda vital, diagnosis, order, edukasi, follow-up, dan tanda tangan catatan.' },
  { icon: Pill, title: 'Penunjang dan obat', body: 'Telaah resep, dispensing, eMAR, lab, radiologi, hasil kritis, dan penyerahan hasil.' },
  { icon: ShieldCheck, title: 'Rekam medis aman', body: 'Koding, pelepasan informasi, legal hold, mutu, keselamatan pasien, dan audit akses.' },
];

export const offerDocuments = [
  { title: 'Proposal Penawaran', href: '/proposal', body: 'Ringkasan kebutuhan, ruang lingkup, manfaat, dan tahapan implementasi.' },
  { title: 'Surat Penawaran', href: '/penawaran', body: 'Dokumen penawaran resmi untuk pembahasan harga dan paket layanan.' },
  { title: 'Presentasi', href: '/presentasi', body: 'Bahan presentasi untuk pimpinan fasilitas, tim operasional, dan calon mitra.' },
  { title: 'Draft PKS', href: '/pks', body: 'Draft perjanjian kerja sama sebagai bahan review legal dan manajemen.' },
];

export function EmedikLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <LandingHeader brand="eMedik.id" links={['Solusi', 'Alur', 'Keamanan', 'Dokumen', 'Demo']} />

      <main>
        <section className="relative overflow-hidden bg-white">
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-teal-600 via-sky-500 to-emerald-500" />
          <div className="container-page grid min-h-[calc(100vh-4rem)] gap-10 py-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-20">
            <div>
              <p className="section-eyebrow bg-teal-50 text-teal-800">
                Sistem Rumah Sakit, Klinik, Puskesmas, dan Posyandu
              </p>
              <h1 className="max-w-4xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                eMedik.id
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Platform operasional kesehatan untuk fasilitas yang butuh alur pasien,
                rekam medis, penunjang, farmasi, klaim, dan portal pasien dalam satu
                vertical yang tetap tunduk pada keamanan data klinis.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/daftar" className="btn-primary bg-teal-700 px-6 py-3 text-base hover:bg-teal-800">
                  Daftar fasilitas
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to="/demo" className="btn-outline px-6 py-3 text-base">
                  Lihat demo
                </Link>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {operatingLines.map((item) => (
                  <p key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white shadow-2xl">
                <div className="grid gap-3 sm:grid-cols-2">
                  {facilityTypes.map((item) => {
                    const Icon = item.icon;
                    return (
                      <article key={item.title} className="rounded-lg bg-white/10 p-4 ring-1 ring-white/10">
                        <Icon className="h-6 w-6 text-teal-300" aria-hidden />
                        <h2 className="mt-4 text-base font-bold">{item.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                      </article>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-lg bg-teal-400 p-4 text-slate-950">
                  <p className="text-sm font-bold">Portal tenant</p>
                  <p className="mt-1 font-mono text-lg">mitrasehat.emedik.id</p>
                  <p className="mt-2 text-sm leading-6">
                    Profil fasilitas, dokter, jadwal, layanan, antrean, pendaftaran
                    online, hasil yang boleh diakses, resep, dan edukasi pasien.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="Solusi" className="bg-slate-50 py-16">
          <div className="container-page">
            <div className="max-w-3xl">
              <p className="section-eyebrow bg-white text-teal-800">Satu vertical kesehatan</p>
              <h2 className="section-heading text-slate-950">Dibangun untuk kerja fasilitas, bukan sekadar formulir.</h2>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {workflow.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5">
                    <Icon className="h-6 w-6 text-teal-700" aria-hidden />
                    <h3 className="mt-4 font-bold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="Alur" className="bg-white py-16">
          <div className="container-page grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <p className="section-eyebrow bg-teal-50 text-teal-800">Alur implementasi</p>
              <h2 className="section-heading text-slate-950">Dari trial sampai go-live.</h2>
              <p className="section-lead">
                Portal eMedik mengikuti spesifikasi fasilitas kesehatan: pilih jenis
                fasilitas, aktifkan trial, isi profil, generate sample data, lalu
                lakukan konfigurasi operasional sebelum produksi.
              </p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {['Daftar fasilitas', 'Pilih tipe layanan', 'Aktivasi trial atau demo', 'Generate sample data', 'Konfigurasi unit dan peran', 'Go-live bertahap'].map((step, index) => (
                <li key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <span className="font-mono text-xs font-bold text-teal-700">{String(index + 1).padStart(2, '0')}</span>
                  <p className="mt-2 font-semibold text-slate-950">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="Keamanan" className="bg-slate-950 py-16 text-white">
          <div className="container-page grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="section-eyebrow bg-white/10 text-teal-200">Keamanan klinis</p>
              <h2 className="text-3xl font-black">Data pasien tidak diperlakukan seperti data kasir.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              {['Purpose of use untuk pembacaan rekam medis', 'Break-glass tercatat dan ditelaah', 'Investor tidak melihat data pasien', 'SATUSEHAT dan BPJS tidak dikarang tanpa kredensial'].map((item) => (
                <p key={item} className="rounded-lg bg-white/10 p-4 text-sm leading-6 text-slate-200 ring-1 ring-white/10">
                  {item}
                </p>
              ))}
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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-black text-slate-950">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-700 text-sm text-white">eM</span>
          {brand}
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi landing">
          {links.map((link) => (
            <a key={link} href={`#${link}`} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              {link}
            </a>
          ))}
        </nav>
        <Link to="/masuk" className="btn-outline hidden sm:inline-flex">Masuk</Link>
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
        <div className="flex flex-wrap gap-3">
          <Link to="/daftar" className="btn bg-white px-5 py-3 text-teal-800 hover:bg-teal-50">{primary}</Link>
          <Link to="/demo" className="btn border border-white/40 px-5 py-3 text-white hover:bg-white/10">{secondary}</Link>
        </div>
      </div>
    </section>
  );
}

export function OfferDocumentSection({ tone }: { tone: 'teal' | 'emerald' }) {
  const accent = tone === 'emerald' ? 'text-emerald-800 bg-emerald-50' : 'text-teal-800 bg-teal-50';
  const button = tone === 'emerald' ? 'text-emerald-800 hover:bg-emerald-50' : 'text-teal-800 hover:bg-teal-50';

  return (
    <section id="Dokumen" className="bg-white py-16">
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
          {offerDocuments.map((doc) => (
            <Link
              key={doc.href}
              to={doc.href}
              className="group rounded-lg border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
              <h3 className="font-bold text-slate-950">{doc.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{doc.body}</p>
              <span className={`mt-4 inline-flex items-center gap-2 text-sm font-bold ${button}`}>
                Buka dokumen
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default EmedikLandingPage;
