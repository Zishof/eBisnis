import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Rocket,
  Send,
  XCircle,
} from 'lucide-react';
import { api, formatDateTime } from '../../lib/api';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  useToast,
} from '../../components/ui';

// --- Bentuk data dari API --------------------------------------------------

type CheckStatus = 'PASS' | 'FAIL' | 'PENDING_PHASE';

interface ReadinessCheck {
  code: string;
  label: string;
  status: CheckStatus;
  detail: string;
  availableIn?: string;
  blocking: boolean;
}

interface ReadinessReport {
  checkedAt: string;
  profileComplete: boolean;
  paymentAccountReady: boolean;
  readyForReview: boolean;
  checks: ReadinessCheck[];
}

interface EnrollmentTransition {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  occurredAt: string;
}

interface Enrollment {
  id: string;
  status: string;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  readinessCheckedAt: string | null;
  transitions: EnrollmentTransition[];
}

interface Seller {
  id: string;
  sellerCode: string;
  displayName: string;
  status: string;
  supportEmail: string | null;
  supportPhone: string | null;
  program: { code: string; name: string; publicHost: string; minimumListingImages: number };
  stores: Array<{ id: string; storeSlug: string; storeName: string; status: string }>;
  enrollments: Enrollment[];
}

type EnrollmentResponse = Seller | { enrolled: false };

const isEnrolled = (value: EnrollmentResponse | undefined): value is Seller =>
  Boolean(value && 'id' in value);

// --- Penyajian status ------------------------------------------------------

/**
 * PENDING_PHASE tidak boleh terlihat seperti FAIL. Yang pertama berarti
 * kapabilitasnya belum dibangun; yang kedua berarti tenant harus bertindak.
 * Menyamakan keduanya membuat tenant mengira dirinya bersalah atas sesuatu yang
 * bukan urusannya.
 */
const CHECK_PRESENTATION: Record<
  CheckStatus,
  { tone: 'success' | 'danger' | 'info'; Icon: typeof CheckCircle2 }
> = {
  PASS: { tone: 'success', Icon: CheckCircle2 },
  FAIL: { tone: 'danger', Icon: XCircle },
  PENDING_PHASE: { tone: 'info', Icon: Clock },
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  UNDER_REVIEW: 'info',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  CLOSED: 'neutral',
};

export default function MarketplaceActivationPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const toMessage = useErrorMessage();
  /** Menyatukan pola (error, t) agar pemanggilnya tetap ringkas. */
  const errorMessage = (error: unknown) =>
    toMessage(error, (key, fallback) => t(key, fallback ?? key));
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');

  const canEnroll = hasPermission('MARKETPLACE_ENROLLMENT.CREATE');
  const canSubmit = hasPermission('MARKETPLACE_ENROLLMENT.SUBMIT');
  const canRefresh = hasPermission('MARKETPLACE_ENROLLMENT.UPDATE');

  const enrollmentQuery = useQuery({
    queryKey: ['marketplace', 'enrollment'],
    queryFn: () =>
      api.get<EnrollmentResponse>('/seller/marketplace/enrollment'),
  });

  const seller = isEnrolled(enrollmentQuery.data) ? enrollmentQuery.data : null;

  const readinessQuery = useQuery({
    queryKey: ['marketplace', 'readiness'],
    queryFn: () => api.get<ReadinessReport>('/seller/marketplace/readiness'),
    enabled: Boolean(seller),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['marketplace'] });
  };

  const enrollMutation = useMutation({
    mutationFn: () =>
      api.post<Seller>('/seller/marketplace/enrollment', {
        displayName: displayName.trim(),
        supportEmail: supportEmail.trim() || undefined,
        supportPhone: supportPhone.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push(t('marketplace.enrolled'), 'success');
      invalidate();
    },
    onError: (error) => toast.push(errorMessage(error), 'error'),
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.post<Seller>('/seller/marketplace/readiness/refresh'),
    onSuccess: () => {
      toast.push(t('marketplace.readinessRefreshed'), 'success');
      invalidate();
    },
    onError: (error) => toast.push(errorMessage(error), 'error'),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post<Seller>('/seller/marketplace/enrollment/submit'),
    onSuccess: () => {
      toast.push(t('marketplace.submitted'), 'success');
      invalidate();
    },
    onError: (error) => toast.push(errorMessage(error), 'error'),
  });

  if (enrollmentQuery.isLoading) return <LoadingState />;
  if (enrollmentQuery.isError) {
    return <ErrorState message={errorMessage(enrollmentQuery.error)} onRetry={() => enrollmentQuery.refetch()} />;
  }

  // --- Belum mendaftar -----------------------------------------------------

  if (!seller) {
    return (
      <>
        <PageHeader
          title={t('marketplace.title')}
          description={t('marketplace.subtitle')}
          breadcrumbs={[{ label: t('nav.app'), href: '/app' }, { label: t('marketplace.title') }]}
        />
        {canEnroll ? (
          <section className="card max-w-2xl p-6">
            <h2 className="text-lg font-semibold">{t('marketplace.startTitle')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t('marketplace.startBody')}
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                enrollMutation.mutate();
              }}
            >
              <label className="block">
                <span className="label">{t('marketplace.displayName')}</span>
                <input
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  minLength={3}
                  maxLength={160}
                  required
                  placeholder={t('marketplace.displayNamePlaceholder')}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">{t('marketplace.supportEmail')}</span>
                  <input
                    className="input"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    maxLength={255}
                  />
                </label>
                <label className="block">
                  <span className="label">{t('marketplace.supportPhone')}</span>
                  <input
                    className="input"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    maxLength={48}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('marketplace.contactHint')}
              </p>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={enrollMutation.isPending || displayName.trim().length < 3}
              >
                <Rocket size={16} />
                {t('marketplace.enroll')}
              </button>
            </form>
          </section>
        ) : (
          <EmptyState title={t('app.noPermission')} description={t('marketplace.needEnrollPermission')} />
        )}
      </>
    );
  }

  // --- Sudah mendaftar -----------------------------------------------------

  const enrollment = seller.enrollments[0];
  const readiness = readinessQuery.data;
  const blockingOpen = readiness?.checks.filter((c: ReadinessCheck) => c.blocking && c.status !== 'PASS') ?? [];

  return (
    <>
      <PageHeader
        title={t('marketplace.title')}
        description={t('marketplace.subtitle')}
        breadcrumbs={[{ label: t('nav.app'), href: '/app' }, { label: t('marketplace.title') }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canRefresh && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                <RefreshCw size={16} className={refreshMutation.isPending ? 'animate-spin' : ''} />
                {t('marketplace.refreshReadiness')}
              </button>
            )}
            {canSubmit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !readiness?.readyForReview}
                title={
                  readiness?.readyForReview ? undefined : t('marketplace.submitBlockedHint')
                }
              >
                <Send size={16} />
                {t('marketplace.submit')}
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ringkasan seller */}
        <section className="card p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('marketplace.sellerSummary')}
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{t('marketplace.displayName')}</dt>
              <dd className="font-medium">{seller.displayName}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{t('marketplace.sellerCode')}</dt>
              <dd className="font-mono text-xs">{seller.sellerCode}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{t('marketplace.sellerStatus')}</dt>
              <dd>
                <StatusBadge status={seller.status} tone={STATUS_TONE[seller.status]} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{t('marketplace.program')}</dt>
              <dd className="font-medium">{seller.program.name}</dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">
                {seller.program.publicHost}
              </dd>
            </div>
          </dl>
        </section>

        {/* Status pendaftaran */}
        <section className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t('marketplace.enrollmentStatus')}
            </h2>
            {enrollment && (
              <StatusBadge status={enrollment.status} tone={STATUS_TONE[enrollment.status]} />
            )}
          </div>

          {enrollment && (
            <>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                {t(`marketplace.guidance.${enrollment.status}`, {
                  defaultValue: t('marketplace.statusUnknown'),
                })}
              </p>
              {enrollment.decisionNote && (
                <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  {enrollment.decisionNote}
                </p>
              )}
              {enrollment.readinessCheckedAt && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {t('marketplace.lastChecked', {
                    time: formatDateTime(enrollment.readinessCheckedAt),
                  })}
                </p>
              )}
            </>
          )}

          {blockingOpen.length > 0 && (
            <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">{t('marketplace.notReadyTitle')}</p>
                <p className="mt-1 text-slate-700 dark:text-slate-300">
                  {t('marketplace.notReadyBody', { count: blockingOpen.length })}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Daftar pemeriksaan kesiapan */}
      <section className="card mt-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('marketplace.readinessTitle')}
        </h2>

        {readinessQuery.isLoading && <LoadingState />}
        {readinessQuery.isError && (
          <ErrorState
            message={errorMessage(readinessQuery.error)}
            onRetry={() => readinessQuery.refetch()}
          />
        )}

        {readiness && (
          <ul className="mt-4 space-y-3">
            {readiness.checks.map((check: ReadinessCheck) => {
              const { tone, Icon } = CHECK_PRESENTATION[check.status];
              return (
                <li
                  key={check.code}
                  className="flex gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700"
                >
                  <Icon
                    size={18}
                    className={
                      tone === 'success'
                        ? 'mt-0.5 shrink-0 text-emerald-600'
                        : tone === 'danger'
                          ? 'mt-0.5 shrink-0 text-rose-600'
                          : 'mt-0.5 shrink-0 text-sky-600'
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{check.label}</span>
                      {!check.blocking && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {t('marketplace.optional')}
                        </span>
                      )}
                      {check.status === 'PENDING_PHASE' && check.availableIn && (
                        <StatusBadge status={check.availableIn} tone="info" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {check.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Riwayat perpindahan status */}
      {enrollment && enrollment.transitions.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('marketplace.historyTitle')}
          </h2>
          <ol className="mt-4 space-y-3">
            {enrollment.transitions.map((transition: EnrollmentTransition) => (
              <li key={transition.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {formatDateTime(transition.occurredAt)}
                </span>
                {transition.fromStatus && (
                  <>
                    <StatusBadge status={transition.fromStatus} tone="neutral" />
                    <span className="text-slate-400">&rarr;</span>
                  </>
                )}
                <StatusBadge status={transition.toStatus} tone={STATUS_TONE[transition.toStatus]} />
                {transition.reason && (
                  <span className="text-slate-600 dark:text-slate-400">{transition.reason}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
