import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { AlertTriangle, LogOut, Menu, Moon, Search, Sparkles, Sun, X } from 'lucide-react';
import { CopilotPanel } from './CopilotPanel';
import { api } from '../../lib/api';
import { useAuth } from '../../app/auth-context';
import { useTheme } from '../../app/theme-context';
import { SUPPORTED_LOCALES } from '../../i18n';

export interface MenuNode {
  id: string;
  code: string;
  label: string;
  translationKey: string;
  route: string | null;
  icon: string | null;
  moduleCode: string | null;
  sortOrder: number;
  isComingSoon: boolean;
  actions: string[];
  children: MenuNode[];
}

export function useMenuTree() {
  return useQuery({
    queryKey: ['me-menus'],
    queryFn: () => api.get<MenuNode[]>('/me/menus'),
    staleTime: 60_000,
  });
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [query, setQuery] = useState('');

  const menus = useMenuTree();

  const flatMenus = useMemo(() => {
    const out: MenuNode[] = [];
    const walk = (nodes: MenuNode[]) => {
      for (const node of nodes) {
        if (node.route) out.push(node);
        walk(node.children);
      }
    };
    walk(menus.data ?? []);
    return out;
  }, [menus.data]);

  const filtered = useMemo(
    () =>
      query.trim()
        ? flatMenus.filter((menu) => menu.label.toLowerCase().includes(query.trim().toLowerCase()))
        : flatMenus.slice(0, 12),
    [flatMenus, query],
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-e border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        <SidebarContent menus={menus.data ?? []} />
      </aside>

      {/* Drawer mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 start-0 w-72 overflow-y-auto bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">eBisnis.id</span>
              <button type="button" onClick={() => setSidebarOpen(false)} aria-label={t('common.close')}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <SidebarContent menus={menus.data ?? []} onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex h-14 items-center gap-3 px-4">
            <button
              type="button"
              className="btn-ghost px-2 py-1.5 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <Link to="/app" className="hidden items-center gap-2 font-bold text-slate-900 lg:flex dark:text-white">
              <span className="grid h-7 w-7 place-items-center rounded bg-brand-700 text-xs font-black text-white">
                eB
              </span>
            </Link>

            <button
              type="button"
              className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-start text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="h-4 w-4" aria-hidden />
              <span className="truncate">{t('app.searchMenu')}</span>
            </button>

            {user?.tenant && (
              <span className="hidden rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline dark:bg-slate-800 dark:text-slate-300">
                <span className="ltr-code">{user.tenant.schemaName}</span>
              </span>
            )}

            {/*
              Asisten AI. Ditempatkan pada bilah atas supaya tersedia di setiap
              halaman — aksinya menyesuaikan rute yang sedang dibuka.
            */}
            <button
              type="button"
              className="btn-ghost px-2 py-1.5"
              onClick={() => setCopilotOpen((v) => !v)}
              aria-label={t('ai.open')}
              aria-expanded={copilotOpen}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
            </button>

            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              value={i18n.language}
              onChange={(event) => void i18n.changeLanguage(event.target.value)}
              aria-label={t('common.language')}
            >
              {SUPPORTED_LOCALES.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.nativeName}
                </option>
              ))}
            </select>

            <button type="button" className="btn-ghost px-2 py-1.5" onClick={toggle} aria-label={t('common.darkMode')}>
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>

            {user?.isPlatformStaff && (
              <Link to="/platform" className="btn-ghost hidden text-xs sm:inline-flex">
                {t('platform.title')}
              </Link>
            )}

            <button
              type="button"
              className="btn-ghost px-2 py-1.5"
              onClick={() => {
                void logout().then(() => navigate('/masuk'));
              }}
              aria-label={t('nav.logout')}
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {user?.isDemo && (
            <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              <span data-testid="demo-banner">{t('app.demoBanner')}</span>
            </div>
          )}
        </header>

        {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}

        <main className="flex-1 p-4 sm:p-6" key={location.pathname}>
          <Outlet />
        </main>
      </div>

      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-24">
          <div className="card w-full max-w-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
              <Search className="h-4 w-4 text-slate-400" aria-hidden />
              <input
                autoFocus
                className="flex-1 bg-transparent py-3 text-sm outline-none"
                placeholder={t('app.searchMenu')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setCommandOpen(false);
                }}
              />
              <button type="button" onClick={() => setCommandOpen(false)} aria-label={t('common.close')}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {filtered.map((menu) => (
                <li key={menu.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2.5 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => {
                      setCommandOpen(false);
                      setQuery('');
                      if (menu.route) navigate(menu.route);
                    }}
                  >
                    <span>{menu.label}</span>
                    {menu.isComingSoon && (
                      <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800">
                        {t('app.comingSoon')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ menus, onNavigate }: { menus: MenuNode[]; onNavigate?: () => void }) {
  return (
    <nav className="p-3" aria-label="Navigasi aplikasi">
      <MenuList menus={menus} depth={0} onNavigate={onNavigate} />
    </nav>
  );
}

/**
 * Menu tree dirender rekursif pada kedalaman berapa pun. Katalog menu tenant
 * memiliki tiga tingkat, sehingga pembatasan dua tingkat akan menyembunyikan
 * modul yang sebenarnya sudah memiliki hak akses.
 */
function MenuList({
  menus,
  depth,
  onNavigate,
}: {
  menus: MenuNode[];
  depth: number;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ul className={depth === 0 ? 'space-y-1' : 'mt-0.5 space-y-0.5 ps-3'}>
      {menus.map((menu) => {
        const hasChildren = menu.children.length > 0;

        // Node dengan rute dan tanpa anak menjadi tautan biasa.
        if (menu.route && !hasChildren) {
          return (
            <li key={menu.id}>
              <NavLink
                to={menu.route}
                end={menu.route === '/app'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center justify-between rounded-lg px-3',
                    depth === 0 ? 'py-2 text-sm font-medium' : 'py-1.5 text-sm',
                    isActive
                      ? 'bg-brand-50 font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )
                }
              >
                <span className="truncate">{menu.label}</span>
                {menu.isComingSoon && (
                  <span className="ms-2 shrink-0 text-[10px] text-slate-400">
                    {depth === 0 ? t('app.comingSoon') : '•'}
                  </span>
                )}
              </NavLink>
            </li>
          );
        }

        // Node dengan anak menjadi grup yang dapat dilipat. Node yang punya rute
        // sekaligus anak tetap dapat dibuka melalui tautan pada barisnya.
        return (
          <li key={menu.id}>
            <details className="group" open={depth === 0}>
              <summary
                className={clsx(
                  'flex cursor-pointer items-center justify-between rounded-lg px-3 hover:bg-slate-100 dark:hover:bg-slate-800',
                  depth === 0
                    ? 'py-2 text-sm font-semibold text-slate-800 dark:text-slate-200'
                    : 'py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300',
                )}
              >
                {menu.route ? (
                  <NavLink
                    to={menu.route}
                    onClick={onNavigate}
                    className="truncate hover:underline"
                    onClickCapture={(event) => event.stopPropagation()}
                  >
                    {menu.label}
                  </NavLink>
                ) : (
                  <span className="truncate">{menu.label}</span>
                )}
              </summary>
              <MenuList menus={menu.children} depth={depth + 1} onNavigate={onNavigate} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}
