import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, PlayCircle } from 'lucide-react';
import { api, formatDateTime } from '../../lib/api';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import { berandaSesudahMasuk } from '../../app/beranda-sesudah-masuk';

interface DemoStatus {
  available: boolean;
  schemaName?: string | null;
  tenantName?: string | null;
  schemaVersion?: string | null;
  activeSessions: number;
  lastReset?: { startedAt: string; finishedAt?: string | null; generation: number } | null;
  notice: string;
}

export function DemoEntryPage() {
  const { t } = useTranslation();
  const { loginDemo } = useAuth();
  const navigate = useNavigate();
  const toMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['demo-status'],
    queryFn: () => api.get<DemoStatus>('/public/demo/status'),
  });

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await loginDemo();
      navigate(berandaSesudahMasuk(session), { replace: true });
    } catch (err) {
      setError(toMessage(err, (key, fallback) => t(key, fallback ?? key)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="w-full max-w-lg">
        <div className="card p-8 text-center">
          <PlayCircle className="mx-auto h-12 w-12 text-brand-600" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{t('nav.demo')}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Jelajahi seluruh modul tanpa membuat akun. Sesi demo berumur pendek dan hanya mengarah
            ke sandbox bersama.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-start dark:border-amber-800 dark:bg-amber-950/40">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {status.data?.notice ?? t('app.demoBanner')}
            </p>
          </div>

          {status.data && (
            <dl className="mt-5 grid grid-cols-2 gap-3 text-start text-sm">
              <div>
                <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">Schema</dt>
                <dd className="ltr-code text-slate-800 dark:text-slate-100">{status.data.schemaName ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">Versi schema</dt>
                <dd className="ltr-code text-slate-800 dark:text-slate-100">{status.data.schemaVersion ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">Sesi aktif</dt>
                <dd className="text-slate-800 dark:text-slate-100">{status.data.activeSessions}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500 dark:text-slate-400">Reset terakhir</dt>
                <dd className="text-slate-800 dark:text-slate-100">
                  {status.data.lastReset ? formatDateTime(status.data.lastReset.startedAt) : 'Belum pernah'}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <button
            type="button"
            className="btn-primary mt-6 w-full"
            onClick={() => void start()}
            disabled={busy || status.data?.available === false}
          >
            {busy ? t('common.loading') : t('nav.demo')}
          </button>

          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Siap memakai data sendiri?{' '}
            <Link to="/daftar" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Daftar Bisnis Saya
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
