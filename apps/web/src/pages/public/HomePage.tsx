import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  ArrowRight,
  Bike,
  BriefcaseBusiness,
  Car,
  Check,
  ChevronDown,
  Coffee,
  FileSignature,
  FileText,
  Dumbbell,
  Hammer,
  Mail,
  PackageSearch,
  Pill,
  Presentation,
  Scissors,
  Shirt,
  ShoppingBag,
  Sparkles,
  Sprout,
  Star,
  Truck,
  Utensils,
  WashingMachine,
  Wrench,
} from 'lucide-react';
import { api, formatDate, formatMoney } from '../../lib/api';
import { useSiteConfig } from './PublicLayout';
import { LoadingState, ErrorState } from '../../components/ui';
import { PackageCards, usePackages } from './PricingPage';
import { BerandaRinci } from './BerandaRinci';

interface CmsBlock {
  key: string;
  type: string;
  sortOrder: number;
  eyebrow?: string | null;
  heading?: string | null;
  subheading?: string | null;
  body?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
}

export interface CmsPageData {
  slug: string;
  title: string;
  summary?: string | null;
  seo: { title?: string | null; description?: string | null };
  blocks: CmsBlock[];
}

interface MarketingContent {
  features: Array<{ code: string; icon?: string | null; title: string; description?: string | null }>;
  modules: Array<{ code: string; moduleCode?: string | null; icon?: string | null; title: string; description?: string | null }>;
  steps: Array<{ code: string; icon?: string | null; title: string; description?: string | null }>;
  advantages: Array<{ code: string; icon?: string | null; title: string; description?: string | null }>;
  testimonials: Array<{
    code: string;
    personName: string;
    organization?: string | null;
    roleTitle?: string | null;
    quote: string;
    rating: number;
  }>;
  partners: Array<{ code: string; name: string }>;
  callToActions: Array<{ code: string; title: string; body?: string | null; button: string; url: string; style: string }>;
  contactOffices: Array<{ code: string; name: string; address: string; phone?: string | null; email?: string | null; openingHours?: string | null }>;
}

interface NewsItem {
  slug: string;
  title: string;
  summary?: string | null;
  publishedAt?: string | null;
  category: { slug: string; name: string };
}

interface Announcement {
  code: string;
  title: string;
  body: string;
  severity: string;
  linkUrl?: string | null;
}

interface FaqCategory {
  code: string;
  name: string;
  items: Array<{ code: string; question: string; answer: string }>;
}

const DOKUMEN_DEMO = [
  { label: 'Proposal', href: '/proposal', icon: FileText },
  { label: 'Surat', href: '/penawaran', icon: Mail },
  { label: 'Presentasi', href: '/presentasi', icon: Presentation },
  { label: 'PKS', href: '/pks', icon: FileSignature },
];

const CONTOH_USAHA = [
  {
    label: 'Demo',
    detail: 'Pedagang UMKM',
    href: '/demo',
    icon: ShoppingBag,
    status: 'Siap dicoba',
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Pemilik UMKM melayani pembeli di toko kecil',
  },
  {
    label: 'Barbershop',
    detail: 'Potong rambut pria',
    href: '/contoh/salon',
    icon: Scissors,
    status: 'Siap dicoba',
    imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Kursi dan alat barbershop profesional',
  },
  {
    label: 'Salon',
    detail: 'Perawatan wanita',
    href: '/contoh/salon',
    icon: Sparkles,
    status: 'Siap dicoba',
    imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Aktivitas salon kecantikan modern',
  },
  {
    label: 'Cuci Mobil',
    detail: 'Booking, paket cuci, membership',
    href: '/demo',
    icon: Car,
    status: 'Berikutnya',
    imageUrl: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Mobil sedang dicuci di layanan car wash',
  },
  {
    label: 'Laundry',
    detail: 'Kiloan, satuan, antar jemput',
    href: '/demo',
    icon: WashingMachine,
    status: 'Berikutnya',
    imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Mesin laundry dan pakaian bersih',
  },
  {
    label: 'Rental Kendaraan',
    detail: 'Sewa mobil dan motor',
    href: '/demo',
    icon: Truck,
    status: 'Berikutnya',
    imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Kendaraan rental siap digunakan pelanggan',
  },
  {
    label: 'Rental Sepeda',
    detail: 'Sewa harian dan wisata',
    href: '/demo',
    icon: Bike,
    status: 'Berikutnya',
    imageUrl: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Deretan sepeda untuk disewakan',
  },
  {
    label: 'Bengkel Motor',
    detail: 'Servis, sparepart, antrian',
    href: '/demo',
    icon: Wrench,
    status: 'Berikutnya',
    imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Motor sedang diperiksa di bengkel',
  },
  {
    label: 'Bengkel Mobil',
    detail: 'Work order, estimasi, invoice',
    href: '/demo',
    icon: Hammer,
    status: 'Berikutnya',
    imageUrl: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Mekanik memeriksa mobil di bengkel',
  },
  {
    label: 'Bengkel Sepeda',
    detail: 'Servis ringan, part, booking',
    href: '/demo',
    icon: Bike,
    status: 'Berikutnya',
    imageUrl: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Sepeda di area servis bengkel',
  },
  {
    label: 'Apotek',
    detail: 'Terhubung eMedik.id',
    href: 'https://emedik.id',
    icon: Pill,
    status: 'Berikutnya',
    imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Rak obat dan layanan apotek',
  },
  {
    label: 'Inventory Obat',
    detail: 'Sales, batch, expiry, piutang',
    href: 'https://inventory.ebisnis.id',
    icon: PackageSearch,
    status: 'Siap dicoba',
    imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Rak obat dan pengelolaan inventory farmasi',
  },
  {
    label: 'Kuliner',
    detail: 'Restoran, warung, katering',
    href: '/demo',
    icon: Utensils,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Dapur restoran menyiapkan pesanan',
  },
  {
    label: 'Kafe',
    detail: 'Menu, meja, kasir, member',
    href: '/demo',
    icon: Coffee,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Area kafe dengan meja dan barista',
  },
  {
    label: 'Fashion',
    detail: 'Butik, konveksi, stok ukuran',
    href: '/demo',
    icon: Shirt,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Rak pakaian butik fashion',
  },
  {
    label: 'Toko Kelontong',
    detail: 'Retail harian dan grosir kecil',
    href: '/demo',
    icon: ShoppingBag,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Rak produk toko kelontong',
  },
  {
    label: 'Fitness & Spa',
    detail: 'Member, jadwal, paket layanan',
    href: '/demo',
    icon: Dumbbell,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Area fitness dan layanan kebugaran',
  },
  {
    label: 'Pertanian Olahan',
    detail: 'Produk pangan dan stok batch',
    href: '/demo',
    icon: Sprout,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Produk pertanian dan hasil panen',
  },
  {
    label: 'Jasa Umum',
    detail: 'Servis rumahan dan pekerjaan lapangan',
    href: '/demo',
    icon: BriefcaseBusiness,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Tim jasa mengelola pekerjaan operasional',
  },
  {
    label: 'Katering',
    detail: 'Pesanan harian, paket acara, produksi',
    href: '/demo',
    icon: Utensils,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Paket makanan katering siap dikirim',
  },
  {
    label: 'Online Shop',
    detail: 'Katalog, pesanan, stok, pengiriman',
    href: '/belanja',
    icon: ShoppingBag,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Pengemasan pesanan online shop',
  },
  {
    label: 'Kosmetik & Skincare',
    detail: 'Batch, varian, member, promo',
    href: '/demo',
    icon: Sparkles,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Produk kosmetik dan skincare tersusun rapi',
  },
  {
    label: 'Minimarket',
    detail: 'Barcode, stok rak, promo harian',
    href: '/demo',
    icon: ShoppingBag,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Lorong minimarket dengan rak produk',
  },
  {
    label: 'Kerajinan',
    detail: 'Produksi kecil, konsinyasi, katalog',
    href: '/demo',
    icon: Hammer,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Proses produksi kerajinan tangan',
  },
  {
    label: 'Rental Alat',
    detail: 'Sewa alat, deposit, jadwal kembali',
    href: '/demo',
    icon: Wrench,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Peralatan kerja untuk disewakan',
  },
  {
    label: 'Event Organizer',
    detail: 'Paket acara, vendor, termin pembayaran',
    href: '/demo',
    icon: BriefcaseBusiness,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Persiapan acara dan layanan event organizer',
  },
  {
    label: 'Toko Bangunan',
    detail: 'Material, satuan besar, pengiriman',
    href: '/demo',
    icon: Hammer,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Material dan alat bangunan di toko',
  },
  {
    label: 'Percetakan',
    detail: 'Order desain, produksi, finishing',
    href: '/demo',
    icon: FileText,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Pekerjaan percetakan dan desain dokumen',
  },
  {
    label: 'Optik',
    detail: 'Frame, lensa, resep, garansi',
    href: '/demo',
    icon: Sparkles,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Etalase kacamata dan layanan optik',
  },
  {
    label: 'Klinik Kecil',
    detail: 'Obat, tindakan, antrean, invoice',
    href: 'https://emedik.id',
    icon: Pill,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Ruang layanan kesehatan dan farmasi klinik',
  },
  {
    label: 'Toko Elektronik',
    detail: 'Serial number, garansi, cicilan',
    href: '/demo',
    icon: PackageSearch,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Produk elektronik dan perangkat toko',
  },
  {
    label: 'Jasa Kebersihan',
    detail: 'Tim lapangan, jadwal, langganan',
    href: '/demo',
    icon: WashingMachine,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Tim jasa kebersihan menyiapkan perlengkapan',
  },
  {
    label: 'Agribisnis',
    detail: 'Panen, olahan, batch, distribusi',
    href: '/demo',
    icon: Sprout,
    status: 'Umum',
    imageUrl: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Aktivitas agribisnis di lahan pertanian',
  },
];

const FILTER_CONTOH_USAHA = [
  { key: 'semua', label: 'Semua' },
  { key: 'siap', label: 'Siap dicoba' },
  { key: 'berikutnya', label: 'Berikutnya' },
  { key: 'umum', label: 'Umum' },
] as const;

const UNIT_USAHA_HERO = [
  'Barbershop',
  'Salon',
  'Cuci Mobil',
  'Laundry',
  'Rental Kendaraan',
  'Bengkel Motor',
  'Bengkel Mobil',
  'Apotek',
  'Inventory Obat',
] as const;

export function HomePage() {
  const { t, i18n } = useTranslation();
  const cmsText = useCmsText();
  const { data: site } = useSiteConfig();

  const page = useQuery({
    queryKey: ['cms-page', 'beranda', i18n.language],
    queryFn: () => api.get<CmsPageData>('/public/pages/beranda'),
  });
  const marketing = useQuery({
    queryKey: ['marketing', i18n.language],
    queryFn: () => api.get<MarketingContent>('/public/marketing'),
  });
  const news = useQuery({
    queryKey: ['news-latest', i18n.language],
    queryFn: () => api.get<NewsItem[]>('/public/news?pageSize=3'),
  });
  const announcements = useQuery({
    queryKey: ['announcements', i18n.language],
    queryFn: () => api.get<Announcement[]>('/public/announcements'),
  });
  const faqs = useQuery({
    queryKey: ['faqs', i18n.language],
    queryFn: () => api.get<FaqCategory[]>('/public/faqs'),
  });
  const packages = usePackages();

  if (page.isLoading) return <LoadingState />;
  if (page.isError) {
    /*
     * Blok CMS gagal dimuat — tetapi keterangan produk di bawah tidak
     * bergantung padanya sama sekali. Menampilkan halaman galat kosong berarti
     * calon penyewa yang datang saat API sedang bermasalah tidak melihat apa pun
     * tentang apa yang kami tawarkan. Jadi galatnya disebutkan di atas, dan
     * sisanya tetap dapat dibaca.
     */
    return (
      <>
        <div className="container-page py-10">
          <ErrorState message={t('common.error')} onRetry={() => void page.refetch()} />
        </div>
        <BerandaRinci />
      </>
    );
  }

  const blocks = [...(page.data?.blocks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const hero = site?.hero?.[0];

  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case 'HERO':
            return (
              <section key={block.key} className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50 via-white to-white py-12 sm:py-16 dark:border-slate-800 dark:from-brand-950/40 dark:via-slate-950 dark:to-slate-950">
                <div className="container-page">
                  <div className="text-center">
                    {(() => {
                      // Terjemahan dipakai bila kuncinya ada; jika tidak, teks CMS.
                      const eyebrow = cmsText(hero?.eyebrowKey, hero?.eyebrow ?? block.eyebrow);
                      return eyebrow ? (
                        <p className="section-eyebrow animate-fade-up">
                          <Star className="h-3.5 w-3.5" aria-hidden />
                          {eyebrow}
                        </p>
                      ) : null;
                    })()}
                    <h1 className="mx-auto max-w-4xl animate-fade-up text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                      {cmsText(hero?.titleKey, hero?.title ?? block.heading)}
                    </h1>
                    {(() => {
                      const subtitle = cmsText(hero?.subtitleKey, hero?.subtitle ?? block.subheading);
                      return subtitle ? (
                        <p className="mx-auto mt-5 max-w-2xl animate-fade-up text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                          {subtitle}
                        </p>
                      ) : null;
                    })()}
                    <UnitUsahaHeroStrip />
                    <div className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-3">
                      <Link to={hero?.primaryCta?.url ?? '/daftar'} className="btn-primary px-6 py-3 text-base">
                        {cmsText(hero?.primaryCta?.labelKey, hero?.primaryCta?.label) ||
                          t('web.ctaRegister')}
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                      </Link>
                      <Link to={hero?.secondaryCta?.url ?? '/demo'} className="btn-outline px-6 py-3 text-base">
                        {cmsText(hero?.secondaryCta?.labelKey, hero?.secondaryCta?.label) ||
                          t('web.ctaDemo')}
                      </Link>
                      <Link to="/harga" className="btn-ghost px-6 py-3 text-base">
                        {t('web.ctaPricing')}
                      </Link>
                    </div>
                  </div>
                  <ContohUsahaGrid />
                </div>
              </section>
            );

          case 'PARTNER_LOGOS':
            return (
              <section key={block.key} className="border-b border-slate-200 py-10 dark:border-slate-800">
                <div className="container-page">
                  <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {block.heading ?? t('web.trustedBy')}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                    {(marketing.data?.partners ?? []).map((partner) => (
                      <span
                        key={partner.code}
                        className="text-sm font-semibold text-slate-400 dark:text-slate-500"
                      >
                        {partner.name}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            );

          case 'FEATURE_GRID':
            return (
              <Section key={block.key} block={block}>
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {(marketing.data?.features ?? []).map((feature) => (
                    <article key={feature.code} className="card p-5 transition-shadow hover:shadow-md">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {feature.title}
                      </h3>
                      {feature.description && (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {feature.description}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </Section>
            );

          case 'MODULE_SHOWCASE':
            return (
              <Section key={block.key} block={block} tinted>
                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(marketing.data?.modules ?? []).map((module) => (
                    <article key={module.code} className="card p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                          {module.title}
                        </h3>
                        {module.moduleCode && (
                          <span className="ltr-code rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {module.moduleCode}
                          </span>
                        )}
                      </div>
                      {module.description && (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {module.description}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </Section>
            );

          case 'ADVANTAGE_GRID':
            return (
              <Section key={block.key} block={block}>
                <div className="mt-10 grid gap-5 sm:grid-cols-2">
                  {(marketing.data?.advantages ?? []).map((advantage) => (
                    <article key={advantage.code} className="flex gap-4 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{advantage.title}</h3>
                        {advantage.description && (
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {advantage.description}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </Section>
            );

          case 'STEP_LIST':
            return (
              <Section key={block.key} block={block} tinted>
                <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {(marketing.data?.steps ?? []).map((step, index) => (
                    <li key={step.code} className="card relative p-5">
                      <span className="absolute -top-3 start-5 grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                      {step.description && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </Section>
            );

          case 'PRICING_CARDS':
            return (
              <Section key={block.key} block={block} id="harga">
                <PackageCards packages={packages.data ?? []} loading={packages.isLoading} />
                {site?.pricingSection?.footnote && (
                  <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    {site.pricingSection.footnote}
                  </p>
                )}
              </Section>
            );

          case 'NEWS_LATEST':
            return (
              <Section key={block.key} block={block} tinted>
                <div className="mt-8 grid gap-5 md:grid-cols-3">
                  {(news.data ?? []).map((item) => (
                    <article key={item.slug} className="card flex flex-col p-5">
                      <span className="badge w-fit bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        {item.category.name}
                      </span>
                      <h3 className="mt-3 font-semibold leading-snug text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      {item.summary && (
                        <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
                      )}
                      <div className="mt-4 flex items-center justify-between">
                        <time className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(item.publishedAt, localeTag(i18n.language))}
                        </time>
                        <Link
                          to={`/berita/${item.slug}`}
                          className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                        >
                          {t('web.readMore')}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <Link to="/berita" className="btn-outline">
                    {t('web.allNews')}
                  </Link>
                </div>
              </Section>
            );

          case 'ANNOUNCEMENTS':
            return (
              <Section key={block.key} block={block}>
                <ul className="mt-6 space-y-3">
                  {(announcements.data ?? []).slice(0, 5).map((announcement) => (
                    <li
                      key={announcement.code}
                      className={clsx(
                        'rounded-lg border px-4 py-3',
                        announcement.severity === 'WARNING'
                          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
                          : announcement.severity === 'SUCCESS'
                            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900',
                      )}
                    >
                      <p className="font-semibold text-slate-900 dark:text-white">{announcement.title}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{announcement.body}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            );

          case 'TESTIMONIALS':
            return (
              <Section key={block.key} block={block} tinted>
                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {(marketing.data?.testimonials ?? []).slice(0, 6).map((testimonial) => (
                    <figure key={testimonial.code} className="card p-5">
                      <div className="flex gap-0.5" aria-label={`${testimonial.rating} dari 5`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={clsx(
                              'h-4 w-4',
                              i < testimonial.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
                            )}
                            aria-hidden
                          />
                        ))}
                      </div>
                      <blockquote className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                        “{testimonial.quote}”
                      </blockquote>
                      <figcaption className="mt-4 text-sm">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {testimonial.personName}
                        </span>
                        {(testimonial.roleTitle || testimonial.organization) && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {[testimonial.roleTitle, testimonial.organization].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </Section>
            );

          case 'FAQ':
            return (
              <Section key={block.key} block={block} id="faq">
                <FaqAccordion categories={faqs.data ?? []} />
              </Section>
            );

          case 'CALL_TO_ACTION':
            return (
              <section key={block.key} className="py-14">
                <div className="container-page">
                  <div className="rounded-2xl bg-brand-700 px-6 py-10 text-center text-white sm:px-12">
                    <h2 className="text-2xl font-bold sm:text-3xl">{block.heading}</h2>
                    {block.body && <p className="mx-auto mt-3 max-w-2xl text-brand-50">{block.body}</p>}
                    {block.buttonUrl && (
                      <Link
                        to={block.buttonUrl}
                        className="btn mt-6 bg-white px-6 py-3 text-base text-brand-800 hover:bg-brand-50"
                      >
                        {block.buttonLabel}
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            );

          case 'CONTACT':
            return (
              <Section key={block.key} block={block} tinted id="kontak">
                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  {(marketing.data?.contactOffices ?? []).map((office) => (
                    <article key={office.code} className="card p-5">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{office.name}</h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{office.address}</p>
                      <dl className="mt-3 space-y-1 text-sm">
                        {office.phone && (
                          <div className="flex gap-2">
                            <dt className="text-slate-500 dark:text-slate-400">Telepon</dt>
                            <dd className="ltr-code text-slate-700 dark:text-slate-200">{office.phone}</dd>
                          </div>
                        )}
                        {office.email && (
                          <div className="flex gap-2">
                            <dt className="text-slate-500 dark:text-slate-400">Surel</dt>
                            <dd className="ltr-code text-slate-700 dark:text-slate-200">{office.email}</dd>
                          </div>
                        )}
                        {office.openingHours && (
                          <div className="flex gap-2">
                            <dt className="text-slate-500 dark:text-slate-400">Jam</dt>
                            <dd className="text-slate-700 dark:text-slate-200">{office.openingHours}</dd>
                          </div>
                        )}
                      </dl>
                    </article>
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <Link to="/kontak" className="btn-primary">
                    {t('web.contactForm')}
                  </Link>
                </div>
              </Section>
            );

          default:
            return block.body ? (
              <Section key={block.key} block={block}>
                <div
                  className="prose-cms mt-6 max-w-3xl"
                  // Konten CMS sudah disanitasi server-side dengan whitelist tag.
                  dangerouslySetInnerHTML={{ __html: block.body }}
                />
              </Section>
            ) : null;
        }
      })}

      {/*
        Bagian rinci diletakkan SESUDAH blok CMS, bukan menggantikannya.
        Blok CMS adalah bagian yang boleh disunting pengelola sewaktu-waktu —
        sapaan, pengumuman, testimoni. Bagian di bawah menerangkan produknya
        sendiri, dan isinya harus tetap sama dengan proposal serta surat
        penawaran; karena itu ia bersumber dari kode, bukan dari basis data.
      */}
      <BerandaRinci />
    </>
  );
}

function UnitUsahaHeroStrip() {
  const items = UNIT_USAHA_HERO.map((label) => CONTOH_USAHA.find((item) => item.label === label)).filter(
    (item): item is (typeof CONTOH_USAHA)[number] => Boolean(item),
  );

  return (
    <div className="mx-auto mt-8 max-w-5xl animate-fade-up">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <span>Contoh unit usaha</span>
        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden />
        <span>Gambar dapat diganti admin lewat katalog media/CMS</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <TautanContohUsaha
              key={item.label}
              href={item.href}
              className="group relative min-h-28 overflow-hidden rounded-xl border border-white/70 bg-slate-900 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800"
            >
              <img
                src={item.imageUrl}
                alt={item.imageAlt}
                className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-300 group-hover:scale-105 group-hover:opacity-80"
                loading="lazy"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
              <span className="relative flex min-h-28 flex-col justify-between p-3 text-white">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-brand-700 shadow-sm">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-white/80">{item.detail}</span>
                </span>
              </span>
            </TautanContohUsaha>
          );
        })}
      </div>
    </div>
  );
}

function ContohUsahaGrid() {
  const [filter, setFilter] = useState<(typeof FILTER_CONTOH_USAHA)[number]['key']>('semua');
  const usahaTerlihat = useMemo(
    () =>
      CONTOH_USAHA.filter((item) => {
        if (filter === 'semua') return true;
        if (filter === 'siap') return item.status === 'Siap dicoba';
        if (filter === 'berikutnya') return item.status === 'Berikutnya';
        return item.status === 'Umum';
      }),
    [filter],
  );
  const jumlahSiap = CONTOH_USAHA.filter((item) => item.status === 'Siap dicoba').length;
  const usahaUtama = usahaTerlihat.find((item) => item.status === 'Siap dicoba') ?? usahaTerlihat[0] ?? CONTOH_USAHA[0];
  const IconUtama = usahaUtama.icon;

  return (
    <div className="mx-auto mt-8 max-w-6xl rounded-2xl border border-slate-200 bg-white/90 p-4 text-start shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
      <div className="grid gap-4 px-1 pb-5 lg:grid-cols-[1fr_0.9fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Coba sesuai jenis usaha
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
            Pilih contoh yang paling mirip dengan bisnis Anda
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {jumlahSiap} contoh sudah siap dibuka langsung. Yang lain disediakan sebagai peta kebutuhan
            agar calon tenant paham modul apa yang akan aktif ketika jenis usahanya dipilih.
          </p>
        </div>
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950/30">
          <div className="flex items-start gap-3">
            <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
              <img
                src={usahaUtama.imageUrl}
                alt={usahaUtama.imageAlt}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-brand-700 shadow-sm dark:bg-slate-950/90">
                <IconUtama className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                Rekomendasi dibuka dulu
              </p>
              <p className="mt-1 font-bold text-slate-950 dark:text-white">{usahaUtama.label}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{usahaUtama.detail}</p>
              <TautanContohUsaha
                href={usahaUtama.href}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Buka contoh
                <ArrowRight className="h-4 w-4" aria-hidden />
              </TautanContohUsaha>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Visual default dapat diganti dari media/CMS admin saat katalog contoh dibuat editable.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 px-1" role="tablist" aria-label="Filter contoh usaha">
        {FILTER_CONTOH_USAHA.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            className={clsx(
              'rounded-full border px-3 py-1.5 text-sm font-semibold transition',
              filter === item.key
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
            )}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {usahaTerlihat.map((item) => {
          const Icon = item.icon;
          const siap = item.status === 'Siap dicoba';
          return (
            <article
              key={`${item.label}-${item.detail}`}
              className={clsx(
                'group flex min-h-64 flex-col overflow-hidden rounded-xl border transition hover:-translate-y-0.5 hover:shadow-md',
                siap
                  ? 'border-brand-200 bg-brand-50/70 hover:border-brand-400 dark:border-brand-900 dark:bg-brand-950/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900',
              )}
            >
              <TautanContohUsaha href={item.href} className="flex flex-1 flex-col">
                <span className="relative block aspect-[16/10] overflow-hidden bg-slate-200 dark:bg-slate-800">
                  <img
                    src={item.imageUrl}
                    alt={item.imageAlt}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/70 to-transparent" />
                  <span
                    className={clsx(
                      'absolute left-3 top-3 grid h-10 w-10 shrink-0 place-items-center rounded-lg shadow-sm',
                      siap
                        ? 'bg-brand-700 text-white'
                        : 'bg-white/90 text-slate-700 dark:bg-slate-950/90 dark:text-slate-200',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span
                    className={clsx(
                      'absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm',
                      siap
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-white/90 text-slate-600 dark:bg-slate-950/90 dark:text-slate-200',
                    )}
                  >
                    {item.status}
                  </span>
                </span>
                <span className="flex flex-1 flex-col p-4">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate font-semibold text-slate-900 dark:text-white">{item.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      CMS-ready
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-300">
                    {item.detail}
                  </span>
                </span>
              </TautanContohUsaha>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
                {DOKUMEN_DEMO.map((dokumen) => {
                  const DokumenIcon = dokumen.icon;
                  return (
                    <Link
                      key={`${item.label}-${dokumen.label}`}
                      to={`${dokumen.href}?jenis=${encodeURIComponent(item.label)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                    >
                      <DokumenIcon className="h-3.5 w-3.5" aria-hidden />
                      {dokumen.label}
                    </Link>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TautanContohUsaha({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  if (href.startsWith('http')) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

export function Section({
  block,
  children,
  tinted,
  id,
}: {
  block: CmsBlock;
  children?: React.ReactNode;
  tinted?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id ?? block.key}
      className={clsx('py-14 sm:py-16', tinted && 'bg-slate-50 dark:bg-slate-900/50')}
    >
      <div className="container-page">
        <div className="text-center">
          {block.eyebrow && <p className="section-eyebrow">{block.eyebrow}</p>}
          {block.heading && <h2 className="section-heading">{block.heading}</h2>}
          {block.subheading && <p className="section-lead mx-auto">{block.subheading}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function FaqAccordion({ categories }: { categories: FaqCategory[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const items = useMemo(
    () => categories.flatMap((category) => category.items.map((item) => ({ ...item, category: category.name }))),
    [categories],
  );

  return (
    <div className="mx-auto mt-8 max-w-3xl divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {items.map((item) => {
        const isOpen = openKey === item.code;
        return (
          <div key={item.code}>
            <h3>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
                aria-expanded={isOpen}
                onClick={() => setOpenKey(isOpen ? null : item.code)}
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.question}</span>
                <ChevronDown
                  className={clsx('h-4 w-4 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>
            </h3>
            {isOpen && (
              <div className="px-5 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Memilih teks untuk konten CMS.
 *
 * Nilai dari CMS SELALU menang. Ini keharusan: konten homepage wajib dapat
 * diubah dari portal CMS tanpa perubahan source, sehingga katalog terjemahan
 * frontend tidak boleh menimpanya. Kunci terjemahan hanya dipakai sebagai
 * cadangan ketika CMS belum memiliki nilai untuk field tersebut, dan hanya bila
 * kuncinya benar-benar terdaftar — tanpa pemeriksaan `exists`, kunci yang hilang
 * akan tampil sebagai penanda kunci alih-alih teks yang berguna.
 *
 * Terjemahan konten yang sesungguhnya berada pada CMS itu sendiri melalui
 * `cms_block_translation.locale_code`, bukan pada katalog frontend.
 */
export function useCmsText() {
  const { t, i18n } = useTranslation();
  return (key: string | null | undefined, cmsValue: string | null | undefined): string => {
    if (cmsValue) return cmsValue;
    return key && i18n.exists(key) ? t(key) : '';
  };
}

export function localeTag(locale: string): string {
  switch (locale) {
    case 'en':
      return 'en-US';
    case 'ar':
      return 'ar-SA';
    case 'zh-CN':
      return 'zh-CN';
    default:
      return 'id-ID';
  }
}

export { formatMoney };
