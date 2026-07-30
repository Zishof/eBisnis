import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ArrowRight, Check, ChevronDown, Star } from 'lucide-react';
import { api, formatDate, formatMoney } from '../../lib/api';
import { useSiteConfig } from './PublicLayout';
import { LoadingState, ErrorState } from '../../components/ui';
import { PackageCards, usePackages } from './PricingPage';

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
    return (
      <div className="container-page py-20">
        <ErrorState message={t('common.error')} onRetry={() => void page.refetch()} />
      </div>
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
              <section key={block.key} className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50 via-white to-white py-16 sm:py-24 dark:border-slate-800 dark:from-brand-950/40 dark:via-slate-950 dark:to-slate-950">
                <div className="container-page text-center">
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
                  <div className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-3">
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
    </>
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
