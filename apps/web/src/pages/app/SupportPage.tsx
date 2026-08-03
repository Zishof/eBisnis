import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, LifeBuoy, MessageSquare, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui';

const TOPICS = [
  {
    title: 'Setup awal ePesantren',
    body: 'Lengkapi profil pondok, unit pendidikan, situs publik, dan berita pertama.',
    href: '/app/pesantren/profil',
    icon: BookOpen,
  },
  {
    title: 'Hak akses pengurus',
    body: 'Cek pengguna, role, dan menu yang sedang efektif untuk tenant ini.',
    href: '/app/role-permissions',
    icon: ShieldCheck,
  },
  {
    title: 'Notifikasi dan tindak lanjut',
    body: 'Pantau pemberitahuan yang belum dibaca atau masih menunggu tindakan.',
    href: '/app/notifications',
    icon: MessageSquare,
  },
  {
    title: 'Audit perubahan data',
    body: 'Lihat tabel dan pengguna yang paling banyak mengubah data tenant.',
    href: '/app/audit',
    icon: LifeBuoy,
  },
];

export function SupportPage() {
  return (
    <>
      <PageHeader
        title="Bantuan dan Dukungan"
        description="Pusat bantuan singkat untuk pengurus tenant. Halaman ini menggantikan placeholder agar menu dukungan bisa langsung dipakai."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Bantuan dan Dukungan' }]}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          return (
            <Link
              key={topic.href}
              to={topic.href}
              className="card group flex items-start gap-3 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
            >
              <span className="rounded bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {topic.title}
                  <ExternalLink className="h-4 w-4 opacity-0 transition group-hover:opacity-100" aria-hidden />
                </span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{topic.body}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Kontak dukungan</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Untuk kendala deploy, domain, Cloudflare, atau data yang tidak tampil, siapkan nama pondok,
          alamat subdomain, waktu kejadian, dan tangkapan layar. Informasi itu mempercepat pemeriksaan
          log serta audit perubahan.
        </p>
      </section>
    </>
  );
}
