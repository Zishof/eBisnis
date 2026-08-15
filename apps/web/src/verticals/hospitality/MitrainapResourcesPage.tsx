import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, CircleHelp, PlayCircle, Search } from 'lucide-react';

const CAPABILITIES = [
  'Multi-property PMS, room inventory, dan reservasi',
  'Booking engine langsung dan manage booking',
  'Front office, housekeeping, maintenance, folio, dan night audit',
  'POS F&B, corporate/group/MICE, CRM, long stay, dan guest portal',
  'Channel/ERP/provider contracts dengan retry, rekonsiliasi, dan audit',
];

export function MitrainapPricingPage() {
  return <Page title="Paket sesuai operasional properti Anda" intro="Harga tidak dikarang sebagai angka statis. Tim kami memetakan jumlah properti, kamar, outlet, perangkat, integrasi, dan kebutuhan implementasi sebelum memberi penawaran tertulis.">
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="text-xl font-bold">Cakupan yang dapat dipilih</h2>
        <ul className="mt-5 space-y-3">{CAPABILITIES.map((item) => <li key={item} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>
      </section>
      <aside className="rounded-2xl bg-indigo-600 p-6 text-white">
        <h2 className="text-xl font-bold">Minta penawaran</h2>
        <p className="mt-2 text-sm text-indigo-100">Dapatkan scope, jadwal onboarding, kebutuhan migrasi, dan harga yang dapat disetujui sebelum aktivasi.</p>
        <Link to="/kontak" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-indigo-700">Konsultasi kebutuhan <ArrowRight className="h-4 w-4" /></Link>
      </aside>
    </div>
  </Page>;
}

export function MitrainapDemoPage() {
  return <Page title="Demo operasional MitraInap" intro="Sandbox memakai data contoh yang ditandai, tidak ditagihkan, dan dapat direset tanpa menyentuh data tenant lain.">
    <div className="grid gap-4 md:grid-cols-3">{['Masuk ke sandbox', 'Pilih peran operasional', 'Jalankan skenario terpandu'].map((title, index) => <article key={title} className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"><span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-700">{index + 1}</span><h2 className="mt-4 font-bold">{title}</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{index === 0 ? 'Gunakan tombol di bawah untuk membuat sesi demo terbatas.' : index === 1 ? 'Coba front desk, housekeeping, revenue, cashier, atau admin.' : 'Ikuti help kontekstual dan data contoh yang tersedia di workspace.'}</p></article>)}</div>
    <Link to="/demo" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-bold text-white"><PlayCircle className="h-4 w-4" />Mulai demo</Link>
  </Page>;
}

const ARTICLES = [
  { slug: 'persiapan-go-live-hotel', title: 'Checklist persiapan go-live sistem hotel', summary: 'Data master, cutover, UAT per peran, backup, rollback, dan hypercare.' },
  { slug: 'booking-langsung-tanpa-dark-pattern', title: 'Booking langsung yang transparan', summary: 'Harga total, kebijakan pembatalan, aksesibilitas, dan pembayaran idempoten.' },
  { slug: 'night-audit-tertelusur', title: 'Night audit yang dapat dilanjutkan dan diaudit', summary: 'Business date, exception queue, snapshot, step-up, dan income audit.' },
];

export function MitrainapBlogPage() {
  return <Page title="Sumber daya Hospitality" intro="Panduan praktis untuk tim hotel, penginapan, dan rental."><div className="grid gap-4 md:grid-cols-3">{ARTICLES.map((article) => <article key={article.slug} className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"><BookOpen className="h-5 w-5 text-indigo-600" /><h2 className="mt-4 font-bold">{article.title}</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{article.summary}</p><Link to="/mitrainap/bantuan" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-indigo-700">Baca panduan <ArrowRight className="h-4 w-4" /></Link></article>)}</div></Page>;
}

const HELP = [
  ['Bagaimana memulai?', 'Daftarkan tenant, buat properti, tipe kamar, kamar, rate plan, lalu terbitkan kalender harga.'],
  ['Bagaimana custom domain aktif?', 'Tambahkan domain, pasang DNS TXT verifikasi, verifikasi kepemilikan, lalu tunggu status sertifikat TLS aktif.'],
  ['Bagaimana mencegah overbooking?', 'Ledger stay-date dihitung di dalam transaksi terkunci dan memakai batas overbooking per tipe kamar.'],
  ['Bagaimana integrasi OTA bekerja?', 'Job ARI/reservasi dikirim worker idempoten. Provider tanpa kontrak resmi berhenti dengan BLOCKED_PROVIDER_INPUT.'],
  ['Bagaimana rollback?', 'Kode kembali ke commit sebelumnya; database memakai migration additive dan forward repair atau restore terkontrol.'],
];

export function MitrainapHelpPage() {
  const [search, setSearch] = useState('');
  const results = useMemo(() => HELP.filter(([q, a]) => `${q} ${a}`.toLowerCase().includes(search.toLowerCase())), [search]);
  return <Page title="Pusat bantuan" intro="Cari jawaban operasional dan deployment MitraInap.">
    <label className="relative block max-w-2xl"><Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" /><span className="sr-only">Cari bantuan</span><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 py-3 pl-12 pr-4 dark:border-slate-700 dark:bg-slate-900" placeholder="Cari topik..." /></label>
    <div className="mt-6 grid gap-3">{results.map(([q, a]) => <details key={q} className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"><summary className="cursor-pointer font-bold">{q}</summary><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{a}</p></details>)}</div>
    {!results.length && <p className="mt-6 text-sm text-slate-500">Topik tidak ditemukan. <Link to="/kontak" className="font-bold text-indigo-700">Hubungi dukungan</Link>.</p>}
  </Page>;
}

function Page({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-14"><div className="mb-10 max-w-3xl"><CircleHelp className="h-7 w-7 text-indigo-600" /><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 text-slate-600 dark:text-slate-400">{intro}</p></div>{children}</div>;
}
