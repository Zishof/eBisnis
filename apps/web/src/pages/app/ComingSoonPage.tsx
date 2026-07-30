import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { Code, PageHeader } from '../../components/ui';

/**
 * Modul yang sudah terdaftar pada menu dan hak aksesnya dapat diatur, tetapi
 * implementasi layarnya belum selesai. Halaman ini menjaga agar navigasi tidak
 * pernah menghasilkan rute mati.
 */
export function ComingSoonPage() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <>
      <PageHeader
        title={t('app.comingSoon')}
        breadcrumbs={[{ label: t('app.dashboard'), href: '/app' }, { label: t('app.comingSoon') }]}
      />
      <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Construction className="h-10 w-10 text-amber-500" aria-hidden />
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">{t('app.comingSoonBody')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Rute: <Code>{location.pathname}</Code>
        </p>
      </div>
    </>
  );
}
