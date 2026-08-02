import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Menu, Moon, Sun, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../lib/api';
import { SUPPORTED_LOCALES } from '../../i18n';
import { useTheme } from '../../app/theme-context';
import { useAuth } from '../../app/auth-context';
import { slugPondokDariHost } from '../../verticals/pesantren/santri-host';
import { PondokChrome } from '../../verticals/pesantren/PondokChrome';

export interface SiteConfig {
  code: string;
  name: string;
  primaryDomain: string;
  defaultLocaleCode: string;
  activeLocale: string;
  locales: Array<{ code: string; nativeName: string; direction: string; isDefault: boolean }>;
  navigation: Array<{
    code: string;
    location: string;
    items: Array<{ labelKey: string; label: string; url: string; icon?: string | null; sortOrder: number }>;
  }>;
  footer: Array<{
    code: string;
    title: string;
    items: Array<{ label: string; url: string }>;
  }>;
  hero: Array<{
    code: string;
    /**
     * Setiap teks disertai `*Key` sehingga frontend dapat memakai terjemahan
     * bila tersedia, dan jatuh ke nilai bawaan dari CMS bila belum diterjemahkan.
     */
    eyebrowKey?: string | null;
    eyebrow?: string | null;
    titleKey?: string | null;
    title: string;
    subtitleKey?: string | null;
    subtitle?: string | null;
    primaryCta?: { labelKey?: string | null; label: string; url: string } | null;
    secondaryCta?: { labelKey?: string | null; label: string; url: string } | null;
  }>;
  pricingSection: {
    title: string;
    description?: string | null;
    footnote?: string | null;
    displayMode: string;
  } | null;
}

export function useSiteConfig() {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: ['public-site', i18n.language],
    queryFn: () => api.get<SiteConfig>('/public/site'),
    staleTime: 5 * 60_000,
  });
}

export function PublicLayout() {
  const { t, i18n } = useTranslation();
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const { data: site } = useSiteConfig();

  /*
   * Subdomain pondok (`<slug>.santri.info`) TIDAK PERNAH memakai bingkai
   * eBisnis.id ini -- pengunjungnya sedang mencari pondoknya sendiri, bukan
   * platformnya. Diperiksa di titik masuk paling atas, sebelum satu pun
   * elemen bermerek eBisnis dirender, supaya tidak ada kedipan merek yang
   * salah sebelum beralih ke `PondokChrome`.
   */
  if (slugPondokDariHost()) {
    return <PondokChrome />;
  }
  return <PublicLayoutEBisnis site={site} t={t} i18n={i18n} theme={theme} toggle={toggle} user={user} />;
}

function PublicLayoutEBisnis({
  site,
  t,
  i18n,
  theme,
  toggle,
  user,
}: {
  site: ReturnType<typeof useSiteConfig>['data'];
  t: ReturnType<typeof useTranslation>['t'];
  i18n: ReturnType<typeof useTranslation>['i18n'];
  theme: ReturnType<typeof useTheme>['theme'];
  toggle: ReturnType<typeof useTheme>['toggle'];
  user: ReturnType<typeof useAuth>['user'];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const location = useLocation();

  const headerItems =
    site?.navigation.find((nav) => nav.location === 'HEADER')?.items ?? [
      { labelKey: 'nav.home', label: t('nav.home'), url: '/', sortOrder: 1 },
      { labelKey: 'nav.pricing', label: t('nav.pricing'), url: '/harga', sortOrder: 2 },
      { labelKey: 'nav.presentation', label: t('nav.presentation'), url: '/presentasi', sortOrder: 3 },
      { labelKey: 'nav.proposal', label: t('nav.proposal'), url: '/proposal', sortOrder: 4 },
      { labelKey: 'nav.news', label: t('nav.news'), url: '/berita', sortOrder: 5 },
      { labelKey: 'nav.contact', label: t('nav.contact'), url: '/kontak', sortOrder: 6 },
    ];

  const currentLocale =
    SUPPORTED_LOCALES.find((l) => l.code === i18n.language) ?? SUPPORTED_LOCALES[0];

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Lewati ke konten utama
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-sm font-black text-white">
              eB
            </span>
            <span className="hidden sm:inline">{site?.name ?? 'eBisnis.id'}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
            {headerItems.map((item) => (
              <NavLink
                key={item.labelKey}
                to={item.url}
                className={({ isActive }) =>
                  clsx(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive && item.url !== '/'
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                className="btn-ghost px-2.5 py-2"
                onClick={() => setLangOpen((v) => !v)}
                aria-label={t('common.language')}
                aria-expanded={langOpen}
              >
                <Globe className="h-4 w-4" aria-hidden />
                <span className="hidden text-xs sm:inline">{currentLocale.code.toUpperCase()}</span>
              </button>
              {langOpen && (
                <ul
                  className="absolute end-0 z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  role="listbox"
                >
                  {SUPPORTED_LOCALES.map((locale) => (
                    <li key={locale.code}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={locale.code === i18n.language}
                        className={clsx(
                          'flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800',
                          locale.code === i18n.language && 'font-semibold text-brand-700 dark:text-brand-300',
                        )}
                        onClick={() => {
                          void i18n.changeLanguage(locale.code);
                          setLangOpen(false);
                        }}
                      >
                        <span>{locale.nativeName}</span>
                        <span className="ltr-code text-xs text-slate-400">{locale.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              className="btn-ghost px-2.5 py-2"
              onClick={toggle}
              aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>

            {user ? (
              <Link to={user.isPlatformStaff ? '/platform' : '/app'} className="btn-primary hidden sm:inline-flex">
                {t('nav.dashboard')}
              </Link>
            ) : (
              <>
                <Link to="/masuk" className="btn-ghost hidden sm:inline-flex">
                  {t('nav.login')}
                </Link>
                <Link to="/daftar" className="btn-primary hidden sm:inline-flex">
                  {t('nav.register')}
                </Link>
              </>
            )}

            <button
              type="button"
              className="btn-ghost px-2.5 py-2 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-950">
            <div className="container-page flex flex-col py-3">
              {headerItems.map((item) => (
                <Link
                  key={item.labelKey}
                  to={item.url}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex gap-2">
                <Link to="/masuk" className="btn-outline flex-1" onClick={() => setMenuOpen(false)}>
                  {t('nav.login')}
                </Link>
                <Link to="/daftar" className="btn-primary flex-1" onClick={() => setMenuOpen(false)}>
                  {t('nav.register')}
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-1" key={location.pathname}>
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page py-12">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-sm font-black text-white">
                  eB
                </span>
                {site?.name ?? 'eBisnis.id'}
              </div>
              <p className="mt-3 max-w-sm text-sm text-slate-600 dark:text-slate-400">
                Platform SaaS POS dan ERP terintegrasi untuk retail, F&amp;B, distribusi, dan manufaktur.
              </p>
            </div>
            {(site?.footer ?? []).map((section) => (
              <div key={section.code}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{section.title}</h3>
                <ul className="mt-3 space-y-2">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        to={item.url}
                        className="text-sm text-slate-600 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            © {new Date().getFullYear()} {site?.name ?? 'eBisnis.id'}. Seluruh hak cipta dilindungi.
          </div>
        </div>
      </footer>
    </div>
  );
}
