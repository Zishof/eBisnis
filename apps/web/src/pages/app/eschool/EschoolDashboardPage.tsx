import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  DatabaseZap,
  GraduationCap,
  Library,
  School,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, StatusBadge } from '../../../components/ui';
import { api } from '../../../lib/api';

type ModuleStatus = 'TERIMPLEMENTASI' | 'SEBAGIAN' | 'FONDASI' | 'BELUM';
type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface EschoolNavigationItem {
  code: string;
  name: string;
  description: string;
  href: string;
  status: ModuleStatus;
  priority: Priority;
  metricLabel: string;
  metricValue: string;
  foundation: string;
}

interface EschoolDashboard {
  title: string;
  subtitle: string;
  readiness: Array<{ label: string; value: string; status: ModuleStatus }>;
  quickActions: Array<{ label: string; href: string; description: string }>;
  modules: EschoolNavigationItem[];
}

const FALLBACK_DASHBOARD: EschoolDashboard = {
  title: 'Dashboard eSchool',
  subtitle: 'Ruang kerja sekolah formal untuk operator, guru, wali kelas, BK, dan pimpinan sekolah.',
  readiness: [
    { label: 'DAPODIK', value: 'Import/export', status: 'SEBAGIAN' },
    { label: 'Akademik', value: 'Fondasi', status: 'FONDASI' },
    { label: 'Layanan', value: 'Roadmap', status: 'BELUM' },
  ],
  quickActions: [
    { label: 'Import DAPODIK', href: '/app/eschool/dapodik', description: 'Validasi dan rollback batch.' },
    { label: 'Data siswa', href: '/app/eschool/siswa', description: 'Biodata siswa formal.' },
  ],
  modules: [],
};

const STATUS_TONE: Record<ModuleStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  TERIMPLEMENTASI: 'success',
  SEBAGIAN: 'warning',
  FONDASI: 'info',
  BELUM: 'neutral',
};

const ICONS = [School, UsersRound, GraduationCap, Building2, BookOpen, ClipboardCheck, ShieldCheck, DatabaseZap, Library, BarChart3];

export function EschoolDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['eschool-dashboard'],
    queryFn: () => api.get<EschoolDashboard>('/eschool/dashboard'),
  });
  const dashboard = dashboardQuery.data ?? FALLBACK_DASHBOARD;
  const modules = dashboard.modules;

  return (
    <>
      <PageHeader
        title={dashboard.title}
        description={dashboard.subtitle}
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'eSchool' }, { label: 'Dashboard' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-outline" to="/app/eschool/dapodik">
              <DatabaseZap className="h-4 w-4" aria-hidden />
              DAPODIK
            </Link>
            <Link className="btn-primary" to="/app/education/implementasi">
              <Sparkles className="h-4 w-4" aria-hidden />
              Roadmap
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.readiness.map((item) => (
          <div key={item.label} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{item.value}</p>
              </div>
              <StatusBadge status={item.status} tone={STATUS_TONE[item.status]} />
            </div>
          </div>
        ))}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 to-emerald-50 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Aksi cepat</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Pekerjaan operator hari ini</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dashboard.quickActions.map((action) => (
              <Link key={action.href} to={action.href} className="group flex items-center justify-between gap-4 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-900/70">
                <span>
                  <span className="block font-semibold text-slate-950 dark:text-white">{action.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">{action.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" aria-hidden />
              </Link>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Modul eSchool</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Namespace sekolah formal</h2>
              </div>
              <StatusBadge status={`${modules.length} modul`} tone="info" />
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {modules.map((module, index) => {
              const Icon = ICONS[index % ICONS.length] ?? School;
              return (
                <Link
                  key={module.code}
                  to={module.href}
                  className="group rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      <StatusBadge status={module.status} tone={STATUS_TONE[module.status]} />
                      <StatusBadge status={module.priority} tone={module.priority === 'P0' ? 'danger' : module.priority === 'P1' ? 'warning' : 'neutral'} />
                    </div>
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-950 dark:text-white">{module.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{module.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                    <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {module.metricLabel}: {module.metricValue}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                      Buka <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" aria-hidden />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
