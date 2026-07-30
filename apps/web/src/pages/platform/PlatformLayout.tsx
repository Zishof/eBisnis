import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2, FileText, LayoutDashboard, Moon, Package, ScrollText, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../app/auth-context';
import { useTheme } from '../../app/theme-context';

const NAV = [
  { to: '/platform', label: 'platform.dashboard', icon: LayoutDashboard, end: true },
  { to: '/platform/tenants', label: 'platform.tenants', icon: Building2 },
  { to: '/platform/registrations', label: 'platform.registrations', icon: FileText },
  { to: '/platform/packages', label: 'platform.packages', icon: Package },
  { to: '/platform/cms', label: 'platform.cms', icon: FileText },
  { to: '/platform/audit', label: 'platform.audit', icon: ScrollText },
] as const;

export function PlatformLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <p className="text-sm font-bold tracking-tight">{t('platform.title')}</p>
          <nav className="flex flex-1 flex-wrap items-center gap-1" aria-label={t('platform.title')}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  clsx(
                    'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium',
                    isActive ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            className="rounded bg-white/10 p-1.5 hover:bg-white/20"
            aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>
          <a href="/app" className="text-xs text-slate-300 hover:text-white">
            <ArrowLeft className="inline h-3.5 w-3.5" aria-hidden /> Portal tenant
          </a>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20"
          >
            {t('nav.logout')}
          </button>
        </div>
        {user && (
          <p className="mx-auto max-w-7xl px-4 pb-2 text-xs text-slate-400">
            {user.displayName} · <span className="ltr-code font-mono">{user.username}</span>
          </p>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
