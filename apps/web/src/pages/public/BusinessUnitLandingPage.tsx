import { ArrowRight, Check, FileSignature, FileText, Mail, Presentation } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CONTOH_USAHA } from './HomePage';
import { businessTenantLabelFromHost, businessUnitLabelFromHost } from './business-unit-links';

const DOKUMEN = [
  { label: 'Proposal Penawaran', href: '/proposal', icon: FileText },
  { label: 'Surat Penawaran', href: '/penawaran', icon: Mail },
  { label: 'Presentasi', href: '/presentasi', icon: Presentation },
  { label: 'Draft PKS', href: '/pks', icon: FileSignature },
];

const MODUL_UMUM = [
  'Website dan katalog yang bisa diedit admin',
  'POS, invoice, stok, dan laporan harian',
  'Pelanggan, membership, promo, dan voucher',
  'Pembelian, supplier, kas, piutang, dan hutang',
  'Dashboard pemilik untuk omzet, laba, tren, dan performa tim',
  'Akses web, desktop, dan Android sesuai paket tenant',
];

export function BusinessUnitLandingPage() {
  const unitLabel = businessUnitLabelFromHost() ?? 'Unit Usaha';
  const tenantLabel = businessTenantLabelFromHost() ?? unitLabel;
  const item = CONTOH_USAHA.find((contoh) => contoh.label === unitLabel) ?? CONTOH_USAHA[0];
  const Icon = item.icon;
  const isTenant = tenantLabel !== unitLabel;
  const headline = isTenant
    ? `${tenantLabel}: website usaha ${unitLabel.toLowerCase()} siap melayani pelanggan.`
    : `${unitLabel}: contoh website dan aplikasi operasional eBisnis.`;

  return (
    <div className="bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 via-white to-white py-12 dark:border-slate-800 dark:from-brand-950/30 dark:via-slate-950 dark:to-slate-950 sm:py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-800 ring-1 ring-brand-100 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-900">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {isTenant ? 'Profil tenant' : 'Contoh unit usaha'}
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-slate-950 dark:text-white sm:text-5xl">
              {headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              {isTenant
                ? `${tenantLabel} memakai domain sendiri agar pelanggan melihat profil, katalog, promo, pengumuman, dan akses aplikasi tanpa kembali ke domain induk.`
                : `Halaman ini menampilkan rancangan landing page ${unitLabel.toLowerCase()} untuk calon tenant. Visual, headline, katalog, promo, dan pengumuman disiapkan agar bisa dikelola admin toko.`}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/masuk" className="btn-primary px-5 py-3">
                Masuk aplikasi
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#katalog" className="btn-outline px-5 py-3">
                Lihat katalog
              </a>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800">
            <img src={item.imageUrl} alt={item.imageAlt} className="h-80 w-full object-cover opacity-90" />
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {['CMS-ready', 'Multi-cabang', 'Mobile responsif'].map((label) => (
                <div key={label} className="rounded-xl bg-white/10 p-3 text-white ring-1 ring-white/10">
                  <p className="text-xs text-white/70">{label}</p>
                  <p className="mt-1 font-semibold">{unitLabel}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="katalog" className="py-12 sm:py-16">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1fr]">
            <div>
              <p className="section-eyebrow">Modul siap disesuaikan</p>
              <h2 className="section-heading text-left">
                Operasional {unitLabel.toLowerCase()} dari website, kasir, sampai laporan pemilik.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Struktur ini mengikuti pola landing SaaS yang fokus pada satu aksi utama, proposisi nilai yang jelas,
                tampilan responsif, bukti modul, dan katalog visual agar calon tenant cepat memahami manfaatnya.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODUL_UMUM.map((modul) => (
                <div key={modul} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <Check className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden />
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-900 dark:text-white">{modul}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DOKUMEN.map((dokumen) => {
              const DokumenIcon = dokumen.icon;
              return (
                <Link
                  key={dokumen.label}
                  to={`${dokumen.href}?jenis=${encodeURIComponent(unitLabel)}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                >
                  <DokumenIcon className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden />
                  <span className="mt-3 block">{dokumen.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

