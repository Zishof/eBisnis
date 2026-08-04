import type { SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  FileText,
  GraduationCap,
  Handshake,
  Image as ImageIcon,
  LibraryBig,
  Presentation,
  School,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';

interface MediaSlot {
  code: string;
  title: string;
  alt: string;
  url: string;
  adminNote: string;
}

const MEDIA: Record<string, MediaSlot> = {
  hero: {
    code: 'education-hero-classroom',
    title: 'Belajar di kelas',
    alt: 'Siswa belajar bersama di ruang kelas modern',
    url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1800&q=85',
    adminNote: 'Hero utama enterprise-education.id.',
  },
  library: {
    code: 'education-library',
    title: 'Literasi dan perpustakaan',
    alt: 'Perpustakaan sekolah dengan rak buku dan ruang baca',
    url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=85',
    adminNote: 'Bagian kurikulum, bahan ajar, dan rapor.',
  },
  pesantren: {
    code: 'education-pesantren-community',
    title: 'Komunitas pesantren',
    alt: 'Pelajar berdiskusi dalam kelompok pendidikan',
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=85',
    adminNote: 'Bagian pesantren, asrama, wali, dan pembinaan.',
  },
  campus: {
    code: 'education-campus',
    title: 'Lingkungan sekolah',
    alt: 'Bangunan lembaga pendidikan dengan halaman yang rapi',
    url: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1200&q=85',
    adminNote: 'Bagian sekolah, madrasah, dan unit pendidikan.',
  },
  digital: {
    code: 'education-digital-admin',
    title: 'Administrasi digital',
    alt: 'Tim pendidikan mengelola data memakai laptop',
    url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=85',
    adminNote: 'Bagian dashboard, portal wali, dan layanan mandiri.',
  },
};

const SOLUSI = [
  {
    title: 'Sekolah dan madrasah',
    text: 'PPDB, siswa, rombongan belajar, jadwal, presensi, nilai, rapor, tagihan, dan portal wali.',
    icon: School,
    media: MEDIA.campus,
  },
  {
    title: 'Pesantren',
    text: 'Santri, asrama, diniyah, tahfiz, izin keluar-masuk, gerbang, uang saku, dapur, dan unit usaha.',
    icon: BookOpenCheck,
    media: MEDIA.pesantren,
  },
  {
    title: 'Kampus dan yayasan',
    text: 'Multi unit, tata kelola, keuangan, aset, pengadaan, SDM, audit, dan pelaporan pimpinan.',
    icon: GraduationCap,
    media: MEDIA.library,
  },
  {
    title: 'Portal publik',
    text: 'Website lembaga, berita, gallery, program unggulan, pendaftaran online, dan dokumen kerja sama.',
    icon: ImageIcon,
    media: MEDIA.digital,
  },
];

const ALUR = [
  ['Penerimaan', 'PPDB/PSB online, seleksi, verifikasi berkas, jadwal wawancara, dan status pendaftar.'],
  ['Akademik', 'Kelas, mapel, jadwal, presensi, penilaian, rapor, leger, dan kalender akademik.'],
  ['Kehidupan siswa', 'Asrama, pembinaan, prestasi, pelanggaran, perizinan, portal wali, dan komunikasi dua arah.'],
  ['Keuangan', 'Tagihan, pembayaran, dompet siswa, kantin, koperasi, laporan, dan rekonsiliasi.'],
] as const;

const DOKUMEN = [
  { href: '/proposal', label: 'Proposal Penawaran', icon: FileText },
  { href: '/penawaran', label: 'Surat Penawaran', icon: Handshake },
  { href: '/presentasi', label: 'Presentasi', icon: Presentation },
  { href: '/pks', label: 'Draft PKS', icon: ShieldCheck },
];

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none';
}

function EducationImage({ slot, className = '' }: { slot: MediaSlot; className?: string }) {
  return (
    <img
      src={slot.url}
      alt={slot.alt}
      loading="lazy"
      decoding="async"
      onError={hideBrokenImage}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

export function EducationLandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-40 border-b border-white/20 bg-white/90 backdrop-blur dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-black">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-700 text-sm text-white">eE</span>
            <span>Enterprise Education</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi Enterprise Education">
            {[
              ['Solusi', '#solusi'],
              ['Alur', '#alur'],
              ['Media', '#media'],
              ['Dokumen', '#dokumen'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                {label}
              </a>
            ))}
          </nav>
          <Link to="/masuk" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800 dark:bg-white dark:text-slate-950">
            Masuk
          </Link>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <EducationImage slot={MEDIA.hero} className="brightness-[0.55]" />
          </div>
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl content-end gap-10 px-4 pb-10 pt-24 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-16">
            <div className="max-w-3xl pb-4 text-white">
              <p className="inline-flex rounded-full bg-cyan-400 px-3 py-1 text-xs font-black uppercase text-slate-950">
                Satu ekosistem pendidikan
              </p>
              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">
                Enterprise Education
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/90">
                Platform untuk sekolah, madrasah, pesantren, kampus, dan yayasan yang membutuhkan data akademik, asrama, keuangan, wali, dan website publik dalam satu fondasi.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/kontak" className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300">
                  Konsultasi penerapan <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a href="#dokumen" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-bold text-slate-950 hover:bg-slate-100">
                  Lihat dokumen
                </a>
              </div>
            </div>

            <div className="grid content-end gap-3 text-white sm:grid-cols-2">
              {[
                ['99,9%', 'alur harian tetap berjalan'],
                ['1 data', 'dipakai lintas unit'],
                ['24 jam', 'portal wali dan pendaftar'],
                ['Admin', 'dapat mengganti visual portal'],
              ].map(([metric, label]) => (
                <div key={label} className="rounded-lg border border-white/20 bg-slate-950/55 p-4 backdrop-blur">
                  <div className="text-2xl font-black">{metric}</div>
                  <div className="mt-1 text-sm text-white/80">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="solusi" className="bg-slate-50 py-16 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase text-cyan-700 dark:text-cyan-300">Solusi lembaga</p>
                <h2 className="mt-3 text-3xl font-black sm:text-4xl">Dibangun mengikuti ritme pendidikan nyata.</h2>
              </div>
              <p className="text-base leading-8 text-slate-600 dark:text-slate-300">
                Sistem sekolah formal membutuhkan rapor dan jadwal yang tertib; pesantren membutuhkan asrama, diniyah, tahfiz, dan izin keluar-masuk; yayasan membutuhkan laporan lintas unit yang dapat dipercaya.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {SOLUSI.map((item) => (
                <article key={item.title} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="relative h-44">
                    <EducationImage slot={item.media} />
                    <div className="absolute bottom-3 left-3 grid h-11 w-11 place-items-center rounded-lg bg-white text-cyan-700 shadow-sm">
                      <item.icon className="h-5 w-5" aria-hidden />
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-black">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="alur" className="py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-black uppercase text-cyan-700 dark:text-cyan-300">Alur operasional</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Mulai dari penerimaan sampai laporan pimpinan.</h2>
              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                Praktik terbaiknya sederhana: pekerjaan harian dibuat cepat, data penting diberi pagar, dan setiap perubahan meninggalkan jejak audit.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <span className="inline-flex items-center gap-2 rounded-lg bg-cyan-50 px-3 py-2 font-semibold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200">
                  <CalendarClock className="h-4 w-4" aria-hidden /> Jadwal
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                  <WalletCards className="h-4 w-4" aria-hidden /> Keuangan
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 font-semibold text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
                  <UsersRound className="h-4 w-4" aria-hidden /> Wali
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <LibraryBig className="h-4 w-4" aria-hidden /> Kurikulum
                </span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {ALUR.map(([title, text], index) => (
                <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-sm font-black text-cyan-700 dark:text-cyan-300">0{index + 1}</div>
                  <h3 className="mt-3 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="media" className="bg-slate-950 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase text-cyan-300">Media dapat diganti admin</p>
                <h2 className="mt-3 text-3xl font-black sm:text-4xl">Gambar portal tidak dikunci di desain.</h2>
                <p className="mt-4 leading-8 text-slate-300">
                  Setiap gambar memakai kode slot stabil, alt text, dan catatan penggunaan. Pola ini siap dipindahkan ke media manager agar admin dapat mengganti foto sekolah, pesantren, kegiatan, dan fasilitas tanpa mengubah kode.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.values(MEDIA)
                  .filter((slot) => slot.code !== MEDIA.hero.code)
                  .map((slot) => (
                    <figure key={slot.code} className="overflow-hidden rounded-lg bg-white/10">
                      <div className="h-36">
                        <EducationImage slot={slot} />
                      </div>
                      <figcaption className="p-3">
                        <div className="font-bold">{slot.title}</div>
                        <div className="mt-1 text-xs text-slate-300">{slot.adminNote}</div>
                      </figcaption>
                    </figure>
                  ))}
              </div>
            </div>
          </div>
        </section>

        <section id="dokumen" className="bg-slate-50 py-16 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase text-cyan-700 dark:text-cyan-300">Dokumen kerja sama</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Siap dibaca sebelum masuk dashboard.</h2>
              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                Proposal, penawaran, presentasi, dan draft PKS memakai merek Enterprise Education ketika dibuka dari domain pendidikan.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DOKUMEN.map((doc) => (
                <Link key={doc.href} to={doc.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400 dark:border-slate-800 dark:bg-slate-950">
                  <doc.icon className="h-6 w-6 text-cyan-700 dark:text-cyan-300" aria-hidden />
                  <div className="mt-5 text-lg font-black">{doc.label}</div>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-cyan-800 dark:text-cyan-300">
                    Buka dokumen <ArrowRight className="h-4 w-4" aria-hidden />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
