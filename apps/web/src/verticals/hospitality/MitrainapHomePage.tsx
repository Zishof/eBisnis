/**
 * Halaman utama mitrainap.id, portal Hospitality.
 *
 * MI-3 menambahkan "Daftarkan Properti" (menuju `/mitrainap/daftar`,
 * `HospitalityRegistrationService` sungguhan -- membuat schema, akun
 * pemilik, dan situs `<slug>.mitrainap.id`) dan "Coba Demo" (menuju
 * `/demo`, `DemoEntryPage` yang sudah ada, dipilihkan tenant
 * `mitrainap_demo` oleh `resolveDemoSchema()` karena host ini terdaftar
 * pada katalog portal). Keduanya CTA yang sebelumnya SENGAJA belum ada
 * (MI-1: "menjanjikan alur yang belum dibangun") -- sekarang sungguhan
 * berfungsi.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  BookOpenCheck,
  CalendarRange,
  ClipboardList,
  Globe2,
  ReceiptText,
  Sparkles,
  UsersRound,
} from 'lucide-react';

interface Modul {
  ikon: typeof BedDouble;
  judul: string;
  keterangan: string;
}

const MODUL_UTAMA: Modul[] = [
  {
    ikon: BedDouble,
    judul: 'Property Management System',
    keterangan: 'Properti, tipe kamar, rate plan, dan ketersediaan dalam satu tempat.',
  },
  {
    ikon: Globe2,
    judul: 'Booking Engine Langsung',
    keterangan: 'Situs pemesanan resmi milik properti sendiri, tanpa komisi OTA.',
  },
  {
    ikon: CalendarRange,
    judul: 'Reservasi dan CRS',
    keterangan: 'Individu, grup, korporat, dan alotmen dalam satu kalender terpadu.',
  },
  {
    ikon: ClipboardList,
    judul: 'Front Office dan Housekeeping',
    keterangan: 'Check-in, check-out, room move, dan status kamar real-time.',
  },
  {
    ikon: ReceiptText,
    judul: 'Folio dan Night Audit',
    keterangan: 'Tagihan tamu, kasir, dan tutup buku malam yang tertelusur.',
  },
  {
    ikon: UsersRound,
    judul: 'Guest CRM',
    keterangan: 'Riwayat menginap dan preferensi tamu lintas kunjungan.',
  },
];

export function MitrainapHomePage() {
  return (
    <div>
      <section className="border-b border-slate-200 bg-gradient-to-b from-indigo-50 to-white dark:border-slate-800 dark:from-indigo-950/20 dark:to-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Bagian dari ekosistem eBisnis.id
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            Operasional hotel dan properti, dalam satu platform.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
            MitraInap.id menyatukan PMS, booking engine langsung, front office,
            housekeeping, dan folio -- di atas fondasi ERP, keuangan, dan SDM
            yang sama dengan eBisnis.id.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/mitrainap/daftar"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Daftarkan Properti
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:border-indigo-400 dark:border-slate-700 dark:text-slate-200"
            >
              Coba Demo
            </Link>
            <Link
              to="/mitrainap/masuk"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:border-indigo-400 dark:border-slate-700 dark:text-slate-200"
            >
              Masuk
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Cakupan yang sedang dibangun
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          MitraInap.id sedang dibangun bertahap. Modul berikut adalah cakupan
          yang direncanakan, dibangun berurutan mengikuti kesiapan masing-masing.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODUL_UTAMA.map((m) => (
            <div
              key={m.judul}
              className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
            >
              <m.ikon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                {m.judul}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {m.keterangan}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BookOpenCheck className="mt-1 h-6 w-6 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Ingin tahu lebih lanjut?
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
                Sampaikan kebutuhan properti Anda -- tim kami akan menghubungi
                Anda kembali.
              </p>
            </div>
          </div>
          <Link
            to="/kontak"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Hubungi Kami
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
