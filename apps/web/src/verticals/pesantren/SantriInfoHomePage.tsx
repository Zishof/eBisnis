/**
 * Halaman utama santri.info, portal ePesantren.
 *
 * Halaman ini ditulis untuk pengasuh, pengurus pondok, bendahara, asatidz,
 * wali santri, dan panitia PSB. Karena itu isinya menonjolkan pekerjaan
 * sehari-hari pondok, bukan istilah teknis platform.
 */

import type { ReactNode, SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Home,
  Image as ImageIcon,
  Landmark,
  Mail,
  Presentation,
  ShieldCheck,
  Smartphone,
  Store,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { ManfaatPeranSection } from './ManfaatPeranSection';
import { SalamPembukaSection } from './SalamPembukaSection';

interface MediaSlot {
  kode: string;
  judul: string;
  alt: string;
  url: string;
  catatanAdmin: string;
}

/**
 * Slot gambar portal. Untuk situs pondok pelanggan, pengurus sudah dapat
 * mengganti logo, hero image, dan gambar berita lewat menu profil/berita.
 * Untuk portal umum santri.info, slot stabil ini menjadi daftar yang mudah
 * dipindahkan ke CMS platform ketika admin ingin mengganti visual tanpa edit
 * komponen.
 */
const MEDIA_PORTAL: Record<string, MediaSlot> = {
  hero: {
    kode: 'santri-hero-belajar',
    judul: 'Suasana belajar santri',
    alt: 'Santri belajar bersama di ruang kelas pesantren',
    url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1600&q=85',
    catatanAdmin: 'Hero utama portal santri.info.',
  },
  kelas: {
    kode: 'santri-kelas-formal',
    judul: 'Kelas formal',
    alt: 'Kegiatan belajar mengajar di kelas',
    url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=85',
    catatanAdmin: 'Kartu pendidikan formal dan diniyah.',
  },
  perpustakaan: {
    kode: 'santri-perpustakaan-kitab',
    judul: 'Perpustakaan dan kitab',
    alt: 'Rak buku perpustakaan sebagai gambaran literasi pesantren',
    url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=85',
    catatanAdmin: 'Kartu perpustakaan, kitab, dan bahan ajar.',
  },
  komunitas: {
    kode: 'santri-komunitas',
    judul: 'Komunitas pendidikan',
    alt: 'Kelompok pelajar berdiskusi bersama',
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=85',
    catatanAdmin: 'Bagian wali santri, pengurus, dan komunitas pondok.',
  },
  kampus: {
    kode: 'santri-kampus-pondok',
    judul: 'Lingkungan belajar',
    alt: 'Gedung pendidikan sebagai gambaran lingkungan belajar pondok',
    url: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1200&q=85',
    catatanAdmin: 'Visual area unit pendidikan dan fasilitas.',
  },
  digital: {
    kode: 'santri-digital',
    judul: 'Layanan digital',
    alt: 'Tim pendidikan memakai laptop untuk mengelola layanan digital',
    url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=85',
    catatanAdmin: 'Visual operasional digital, dashboard, dan anjungan.',
  },
};

const MODUL_INTI = [
  {
    judul: 'Santri dan Asrama',
    isi: 'Biodata lengkap, kamar, asrama, prestasi, catatan pembinaan, dan riwayat kesehatan santri.',
    icon: Home,
    gambar: MEDIA_PORTAL.komunitas,
  },
  {
    judul: 'Diniyah, Sekolah, dan Tahfiz',
    isi: 'Kurikulum diniyah, halaqah, kajian kitab, kelas formal, setoran hafalan, dan rapor.',
    icon: GraduationCap,
    gambar: MEDIA_PORTAL.kelas,
  },
  {
    judul: 'Perizinan dan Presensi',
    isi: 'Izin keluar-masuk, absensi QR/RFID, gerbang, jadwal besuk, dan pemberitahuan wali.',
    icon: CalendarDays,
    gambar: MEDIA_PORTAL.kampus,
  },
  {
    judul: 'Tagihan dan Uang Saku',
    isi: 'SPP, cicilan, tabungan, e-wallet santri, batas belanja harian, dan rekonsiliasi otomatis.',
    icon: WalletCards,
    gambar: MEDIA_PORTAL.digital,
  },
  {
    judul: 'Kantin, Koperasi, dan BMT',
    isi: 'POS multi-gerai, stok, marketplace pesantren, simpan pinjam syariah, SHU, dan laporan RAT.',
    icon: Store,
    gambar: MEDIA_PORTAL.perpustakaan,
  },
  {
    judul: 'Back Office Pondok',
    isi: 'SDM, payroll, pengadaan, aset, persuratan, arsip, audit, dan laporan pimpinan.',
    icon: ClipboardList,
    gambar: MEDIA_PORTAL.digital,
  },
];

const ALUR = [
  {
    judul: 'Pendaftaran pondok',
    isi: 'Nama pondok, penanggung jawab, dan perkiraan santri cukup untuk menyiapkan ruang kerja awal.',
    icon: Building2,
  },
  {
    judul: 'Alamat publik aktif',
    isi: 'Pondok mendapat alamat seperti ponpes-demo.santri.info, atau memakai domain sendiri bila sudah punya.',
    icon: Smartphone,
  },
  {
    judul: 'Migrasi dan pelatihan',
    isi: 'Data Excel dan sistem lama dibersihkan, dipindahkan, lalu operator dilatih bertahap.',
    icon: UsersRound,
  },
  {
    judul: 'Go-live bertahap',
    isi: 'Mulai dari santri, tagihan, dan presensi; modul lain menyusul tanpa mengganti sistem.',
    icon: CheckCircle2,
  },
];

const DOKUMEN = [
  {
    ke: '/santri/proposal',
    label: 'Proposal Penawaran',
    isi: 'Ruang lingkup, manfaat, tahapan penerapan, dan kesiapan modul.',
    icon: FileText,
  },
  {
    ke: '/santri/penawaran',
    label: 'Surat Penawaran',
    isi: 'Versi ringkas untuk pembahasan harga dan tindak lanjut resmi.',
    icon: Mail,
  },
  {
    ke: '/santri/presentasi',
    label: 'Presentasi',
    isi: 'Bahan rapat pengasuh, yayasan, bendahara, dan kepala unit.',
    icon: Presentation,
  },
  {
    ke: '/santri/pks',
    label: 'Draft PKS',
    isi: 'Rancangan pasal kerja sama, ruang lingkup, biaya, dan serah-terima data.',
    icon: Handshake,
  },
];

const CAPAIAN = [
  ['150+', 'institusi pengguna aktif'],
  ['1 data', 'dipakai lintas unit pondok'],
  ['24 jam', 'portal wali dan layanan mandiri'],
  ['Bertahap', 'mulai dari modul yang paling mendesak'],
] as const;

function sembunyikanGambar(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none';
}

function Foto({ slot, className = '' }: { slot: MediaSlot; className?: string }) {
  return (
    <img
      src={slot.url}
      alt={slot.alt}
      className={`h-full w-full object-cover ${className}`}
      loading="lazy"
      decoding="async"
      onError={sembunyikanGambar}
    />
  );
}

function IconBubble({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800">
      {children}
    </span>
  );
}

export function SantriInfoHomePage() {
  return (
    <div className="bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <SalamPembukaSection />

      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white dark:border-slate-800">
        <div className="absolute inset-0" aria-hidden>
          <Foto slot={MEDIA_PORTAL.hero} className="opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/86 to-emerald-950/55" />
        </div>

        <div className="relative mx-auto grid min-h-[620px] max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div>
            <p className="inline-flex rounded-full bg-cyan-300 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
              ePesantren untuk dunia pendidikan Islam
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Satu sistem untuk pondok yang ritmenya tidak pernah berhenti.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-100">
              Santri, asrama, diniyah, tahfiz, PSB, perizinan, tagihan, kantin,
              koperasi, BMT, kepegawaian, persuratan, dan laporan pimpinan
              berjalan dari satu data yang sama.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/daftar-pesantren"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-bold text-slate-950 shadow-lg shadow-emerald-950/30 hover:bg-emerald-400"
              >
                Daftarkan pondok
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/santri/presentasi"
                className="inline-flex min-h-12 items-center rounded-lg border border-white/35 px-5 py-3 font-bold text-white hover:bg-white/10"
              >
                Lihat presentasi
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                'Alamat pondok sendiri: ponpes-demo.santri.info.',
                'Situs pondok dapat diisi pengurus: logo, hero, berita, dan PSB.',
                'Santri tanpa ponsel tetap terlayani lewat kartu, RFID, dan anjungan.',
                'Data contoh dan data produksi dipisahkan sejak awal.',
              ].map((item) => (
                <p key={item} className="flex gap-2 text-sm leading-6 text-slate-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/18 bg-white/10 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <div className="overflow-hidden rounded-xl bg-slate-900">
              <Foto slot={MEDIA_PORTAL.digital} className="h-56" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3">
              {CAPAIAN.map(([angka, label]) => (
                <div key={label} className="rounded-xl bg-white p-4 text-slate-950">
                  <p className="text-2xl font-black text-emerald-700">{angka}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Yang sering tercecer
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
                Pondok bukan hanya sekolah, bukan hanya asrama, dan bukan hanya kas.
              </h2>
            </div>
            <p className="text-base leading-8 text-slate-600 dark:text-slate-300">
              Best practice landing pendidikan adalah membantu pengunjung cepat
              mengenali perannya. Karena itu halaman ini memetakan urusan
              pondok sebagai alur harian: belajar, tinggal, izin, bayar,
              belanja, berobat, berkomunikasi, dan dilaporkan ke pimpinan.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {MODUL_INTI.map((m) => {
              const Icon = m.icon;
              return (
                <article
                  key={m.judul}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="relative h-44 bg-gradient-to-br from-emerald-100 to-sky-100 dark:from-slate-800 dark:to-slate-900">
                    <Foto slot={m.gambar} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/72 via-transparent to-transparent" />
                    <span className="absolute bottom-4 left-4 grid h-11 w-11 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-black text-slate-950 dark:text-white">{m.judul}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{m.isi}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
              <Foto slot={MEDIA_PORTAL.perpustakaan} className="h-72" />
            </div>
            <div className="grid gap-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                <Foto slot={MEDIA_PORTAL.kelas} className="h-32" />
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                <Foto slot={MEDIA_PORTAL.komunitas} className="h-32" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Situs pondok dan admin konten
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
              Setiap pondok tampil dengan identitasnya sendiri.
            </h2>
            <p className="mt-5 leading-8 text-slate-600 dark:text-slate-300">
              Begitu pondok terdaftar, pengurus dapat mengatur profil, logo,
              gambar latar, berita, unit pendidikan, dan alur PSB dari aplikasi.
              Portal umum ini memakai slot gambar terpusat, sedangkan situs
              pondok memakai gambar yang diunggah pengurus sendiri.
            </p>
            <div className="mt-6 grid gap-3">
              {[
                ['ponpes-demo.santri.info', 'Alamat bawaan, aktif setelah pendaftaran.'],
                ['pondoksendiri.sch.id', 'Domain milik pondok dapat diarahkan setelah diverifikasi.'],
              ].map(([alamat, isi]) => (
                <div key={alamat} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">{alamat}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{isi}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
              <p className="font-bold">Catatan gambar untuk admin</p>
              <p className="mt-1">
                Slot portal disiapkan dengan kode stabil seperti{' '}
                <span className="font-mono">{MEDIA_PORTAL.hero.kode}</span>. Pada situs pondok, logo,
                hero, dan gambar berita sudah mengikuti data yang dikelola pengurus.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-4 py-16 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Dari mendaftar sampai dipakai
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
              Implementasi dibuat bertahap supaya operator tidak tenggelam.
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {ALUR.map((l, index) => {
              const Icon = l.icon;
              return (
                <article key={l.judul} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <IconBubble>
                      <Icon className="h-5 w-5" aria-hidden />
                    </IconBubble>
                    <span className="font-mono text-sm font-black text-slate-300">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 font-black text-slate-950 dark:text-white">{l.judul}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{l.isi}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <ManfaatPeranSection />

      <section className="bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="inline-flex rounded-full bg-emerald-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
              Dokumen kerja sama
            </p>
            <h2 className="mt-4 text-3xl font-black">
              Bahan rapat tersedia tanpa harus masuk dashboard.
            </h2>
            <p className="mt-4 leading-8 text-slate-300">
              Pengurus dapat membaca proposal, surat penawaran, presentasi, dan
              draft PKS sebelum membuat akun atau mengundang tim teknis.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {DOKUMEN.map((d) => {
              const Icon = d.icon;
              return (
                <Link
                  key={d.ke}
                  to={d.ke}
                  className="group rounded-xl border border-white/12 bg-white/8 p-5 transition hover:-translate-y-0.5 hover:bg-white/12"
                >
                  <Icon className="h-6 w-6 text-cyan-300" aria-hidden />
                  <h3 className="mt-4 font-black text-white">{d.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{d.isi}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-300">
                    Buka dokumen
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Biaya awal yang mudah dipahami
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
              Rp 2.000 per santri per bulan, ditagihkan per pondok.
            </h2>
            <p className="mt-5 leading-8 text-slate-600 dark:text-slate-300">
              Angka ini adalah penawaran bawaan dan dapat berubah sesuai
              kesepakatan. Yang dihitung adalah santri aktif bulan berjalan;
              santri lulus, keluar, atau data contoh tidak ikut ditagihkan.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/kontak"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800"
              >
                Minta penawaran
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/daftar-pesantren"
                className="inline-flex min-h-12 items-center rounded-lg border border-slate-300 px-5 py-3 font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                Mulai pendaftaran
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-start gap-4">
              <IconBubble>
                <Landmark className="h-5 w-5" aria-hidden />
              </IconBubble>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Data milik pondok
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  Bila kerja sama berakhir, data diserahkan dalam bentuk yang
                  dapat dibuka sendiri. Setiap perubahan tetap menyimpan jejak:
                  siapa, kapan, dan apa yang berubah.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['Hak akses', 'Peran berjenjang untuk pengasuh, admin, operator, dan wali.'],
                ['Audit', 'Perubahan data penting meninggalkan catatan pemeriksaan.'],
                ['Kanal', 'Web, mobile, tablet, desktop, dan anjungan mandiri.'],
                ['Keamanan', 'Data pondok terpisah dari pondok lain.'],
              ].map(([judul, isi]) => (
                <div key={judul} className="rounded-xl bg-white p-4 dark:bg-slate-950">
                  <p className="font-bold text-slate-950 dark:text-white">{judul}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{isi}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              judul: 'Aman untuk proses bertahap',
              isi: 'Mulai dari modul paling mendesak, tanpa memaksa semua unit berubah serentak.',
            },
            {
              icon: ImageIcon,
              judul: 'Visual bisa dikelola',
              isi: 'Situs pondok memakai logo, hero, dan berita bergambar yang diisi pengurus.',
            },
            {
              icon: HeartHandshake,
              judul: 'Sesuai kultur pondok',
              isi: 'Diniyah, tahfiz, asrama, BMT, tabungan santri, dan wali santri diperlakukan sebagai alur utama.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.judul} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <IconBubble>
                  <Icon className="h-5 w-5" aria-hidden />
                </IconBubble>
                <h3 className="mt-4 font-black text-slate-950 dark:text-white">{item.judul}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.isi}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
