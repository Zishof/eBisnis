import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Globe2,
  Mail,
  Presentation,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import {
  ALL_BUSINESS_VERTICALS,
  businessTenantNameFromHost,
  businessVerticalByCode,
  businessVerticalFromHost,
} from './business-verticals';

const documents = [
  { label: 'Proposal Penawaran', href: '/proposal', icon: FileText },
  { label: 'Surat Penawaran', href: '/penawaran', icon: Mail },
  { label: 'Presentasi', href: '/presentasi', icon: Presentation },
  { label: 'Draft PKS', href: '/pks', icon: FileSignature },
];

const proof = [
  'CTA jelas untuk demo, login, dan dokumen',
  'Gambar industri relevan dan bisa diganti lewat CMS tenant',
  'Data contoh minimal 50 dan maksimal 1000 per area demo',
  'Responsive untuk calon tenant di desktop maupun mobile',
];

const inventoryBestSellers = [
  'Bodrex',
  'Bodrex Extra',
  'Bodrex Flu-B',
  'Paramex',
  'Konidin',
  'Mixagrip',
  'Decolgen',
  'Promag',
  'Antimo',
  'Antangin Cair',
  'Komix OBH',
  'Tolak Angin',
  'Laserin Madu',
  'Salonpas',
  'Betadine',
  'Oskadon SP',
  'Panadol Merah',
  'Vegeta Herbal',
];

export function BusinessVerticalPage() {
  const params = useParams();
  const fallbackVertical = businessVerticalByCode('toko');
  if (!fallbackVertical) return null;
  const vertical = businessVerticalByCode(params.vertical) ?? businessVerticalFromHost() ?? fallbackVertical;
  const tenantName = businessTenantNameFromHost();
  const isTenantProfile = Boolean(tenantName);
  const heroHeadline = isTenantProfile
    ? `${tenantName}: profil ${vertical.category.toLowerCase()} yang siap melayani pelanggan.`
    : vertical.headline;
  const heroDescription = isTenantProfile
    ? `${tenantName} memakai pola usaha ${vertical.title.toLowerCase()} dengan katalog layanan/produk, pengumuman, kontak, dan akses aplikasi pelanggan pada domain tenant sendiri.`
    : vertical.description;
  const primaryCta = isTenantProfile ? `Masuk ${tenantName}` : `Coba demo ${vertical.title}`;
  const profilePoints = isTenantProfile
    ? [
        'Profil usaha, foto, headline, katalog, dan pengumuman dapat diganti oleh admin tenant',
        'Pelanggan melihat informasi usaha dan katalog tanpa masuk',
        'Pemesanan/aksi transaksi diarahkan ke aplikasi atau login sesuai hak akses tenant',
        'Domain tenant tetap menjaga brand tenant, bukan kembali ke parent eBisnis.id',
      ]
    : proof;
  const hostExample = tenantName
    ? `${tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${vertical.tenantSuffix}.ebisnis.id`
    : `demo-${vertical.tenantSuffix}.ebisnis.id`;
  const related = ALL_BUSINESS_VERTICALS.filter((item) => item.code !== vertical.code).slice(0, 8);
  const catalogItems = isTenantProfile && vertical.code === 'inventory' ? inventoryBestSellers : vertical.features;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <main>
        <section className="overflow-hidden border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="container-page grid gap-10 py-10 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-14">
          <div>
            <p className="section-eyebrow bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {isTenantProfile ? `Profil tenant ${vertical.title}` : vertical.category}
            </p>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.04] text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
              {heroHeadline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg dark:text-slate-300">
              {heroDescription}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to={isTenantProfile ? '/masuk' : '/demo'} className="btn-primary bg-teal-700 px-6 py-3 text-base hover:bg-teal-800">
                {primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href={isTenantProfile ? '#Katalog' : '#Dokumen'} className="btn-outline px-6 py-3 text-base">
                {isTenantProfile ? 'Lihat katalog' : 'Lihat dokumen'}
              </a>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {profilePoints.map((item) => (
                <p key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  {item}
                  </p>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-2xl dark:border-slate-800">
              <div className="relative min-h-[24rem] sm:min-h-[32rem]">
                <img
                  src={vertical.imageUrl}
                  alt={vertical.imageAlt}
                  className="absolute inset-0 h-full w-full object-cover opacity-85"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {vertical.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-lg bg-white/10 p-4 text-white ring-1 ring-white/15 backdrop-blur">
                        <p className="text-xs text-slate-300">{metric.label}</p>
                        <p className="mt-1 text-2xl font-black">{metric.value}</p>
                        <p className="mt-1 text-xs text-slate-300">{metric.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id={isTenantProfile ? 'Profil' : 'Workflow'} className="py-14">
          <div className="container-page">
            <div className="grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
              <div>
                <p className="section-eyebrow bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                  {isTenantProfile ? 'Profil usaha' : 'Workflow'}
                </p>
                <h2 className="section-heading">
                  {isTenantProfile ? `${tenantName} hadir untuk pelanggan ${vertical.title.toLowerCase()}.` : 'Alur kerja yang dekat dengan lapangan.'}
                </h2>
                <p className="section-lead">
                  {isTenantProfile
                    ? `Halaman ini menjadi etalase tenant: cerita singkat, layanan unggulan, kontak, katalog, dan jalur masuk aplikasi untuk pelanggan maupun tim internal.`
                    : `${vertical.audience} butuh layar yang cepat dipahami oleh admin, kasir, sales, operator, dan pemilik.`}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {vertical.workflows.map((workflow, index) => (
                  <article key={workflow} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="font-mono text-sm font-black text-teal-700 dark:text-teal-300">{String(index + 1).padStart(2, '0')}</span>
                    <h3 className="mt-3 font-bold">{workflow}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      Status, penanggung jawab, nilai transaksi, dan tindak lanjut dibuat terlihat tanpa membuka banyak tab.
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id={isTenantProfile ? 'Katalog' : 'Fitur'} className="bg-white py-14 dark:bg-slate-900">
          <div className="container-page">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-eyebrow bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                  {isTenantProfile ? 'Katalog tenant' : 'Fitur inti'}
                </p>
                <h2 className="section-heading">
                  {isTenantProfile ? `Produk dan layanan unggulan ${tenantName}.` : 'Satu platform, isi layar mengikuti jenis usaha.'}
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {isTenantProfile
                  ? 'Katalog ini dapat diedit admin tenant. Pengunjung boleh melihat, sementara pemesanan mengikuti aturan login/aplikasi tenant.'
                  : 'Struktur ini bisa dipakai untuk tenant produksi: gambar, judul, promo, dan katalog dapat dipindahkan ke CMS tenant.'}
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalogItems.map((feature, index) => (
                <div key={feature} className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                  <BadgeCheck className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden />
                  <h3 className="mt-4 font-bold">{feature}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {isTenantProfile && vertical.code === 'inventory'
                      ? `Produk fast moving CMN untuk katalog display. Detail harga, stok, foto, dan promo dapat dikelola admin tenant. Kode katalog: CMN-${String(index + 1).padStart(3, '0')}.`
                      : isTenantProfile
                        ? `Ditampilkan sebagai layanan/produk ${tenantName}; detail harga, foto, dan promo dapat dikelola admin tenant.`
                      : 'Disiapkan dengan pola data demo, hak akses, dan jalur audit yang konsisten dengan modul eBisnis lain.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id={isTenantProfile ? 'Cara-Pesan' : 'Data-Demo'} className="py-14">
          <div className="container-page grid gap-6 lg:grid-cols-[0.75fr_0.25fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-teal-700 dark:text-teal-300" aria-hidden />
                <div>
                  <h2 className="text-xl font-black">{isTenantProfile ? 'Cara melihat dan memesan' : 'Data demo realistis'}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {isTenantProfile
                      ? 'Web publik dipakai sebagai katalog dan profil. Transaksi atau pemesanan dilakukan setelah pelanggan masuk ke aplikasi tenant.'
                      : 'Minimal 50, maksimal 1000 data contoh per area agar dashboard terlihat seperti kondisi lapangan.'}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {vertical.sampleData.map((item) => (
                  <div key={item.label} className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="mt-2 text-2xl font-black">{item.count}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-6 text-teal-950 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-50">
              <Globe2 className="h-6 w-6" aria-hidden />
              <h3 className="mt-4 font-black">Pola domain</h3>
              <p className="mt-2 font-mono text-sm">{vertical.tenantSuffix}.ebisnis.id</p>
              <p className="mt-1 font-mono text-sm">{hostExample}</p>
            </div>
          </div>
        </section>

        <section id={isTenantProfile ? 'Download' : 'Dokumen'} className="bg-white py-14 dark:bg-slate-900">
          <div className="container-page">
            <div className="grid gap-4 md:grid-cols-4">
              {(isTenantProfile
                ? [
                    { label: 'APK Pelanggan', href: '/update/ebisnis-pos.apk', icon: Smartphone },
                    { label: 'Aplikasi Desktop', href: '/update/ebisnis-pos.exe', icon: Download },
                    { label: 'Masuk Pelanggan', href: '/masuk', icon: Globe2 },
                    { label: 'Kontak Tenant', href: '/kontak', icon: Mail },
                  ]
                : documents
              ).map((doc) => {
                const Icon = doc.icon;
                return (
                  <Link key={doc.label} to={doc.href} className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
                    <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden />
                    <h3 className="mt-4 font-bold">{doc.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {isTenantProfile
                        ? 'Akses tetap berada pada domain tenant ini dan dapat disesuaikan dengan aplikasi tenant.'
                        : 'Bahan komersial siap dibuka sesuai domain dan konteks calon tenant.'}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="container-page">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-eyebrow bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200">Ide tambahan</p>
                <h2 className="section-heading">Unit usaha lain yang bisa langsung dibuat landing.</h2>
              </div>
              <Link to="/daftar" className="btn-outline">
                Daftarkan tenant
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <Link key={item.code} to={`/contoh-usaha/${item.code}`} className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <img src={item.imageUrl} alt={item.imageAlt} className="h-32 w-full object-cover transition duration-300 group-hover:scale-105" />
                  <div className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">{item.category}</p>
                    <h3 className="mt-2 font-black">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{item.audience}</p>
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
