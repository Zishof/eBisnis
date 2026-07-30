import { clsx } from 'clsx';
import { AlertTriangle, Check, Info, Loader2, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

// --- State primitives ------------------------------------------------------

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="text-sm">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center dark:border-rose-900 dark:bg-rose-950/40"
    >
      <XCircle className="h-8 w-8 text-rose-600 dark:text-rose-400" aria-hidden />
      <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{message}</p>
      {onRetry && (
        <button type="button" className="btn-outline" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description }: { title?: string; description?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <Info className="h-8 w-8 text-slate-400" aria-hidden />
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {title ?? t('common.empty')}
      </p>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
  );
}

// --- Badge -----------------------------------------------------------------

const STATUS_TONES: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300',
};

export function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: keyof typeof STATUS_TONES;
}) {
  const resolved = tone ?? inferTone(status);
  return <span className={clsx('badge', STATUS_TONES[resolved])}>{status}</span>;
}

function inferTone(status: string): keyof typeof STATUS_TONES {
  const value = status.toUpperCase();
  if (['ACTIVE', 'READY', 'PAID', 'VALIDATED', 'STOCK_POSTED', 'RECEIVED', 'APPROVED', 'PUBLISHED', 'SUCCEEDED', 'OK', 'LULUS', 'PASSED'].includes(value)) {
    return 'success';
  }
  if (['DRAFT', 'PENDING', 'WAITING_PAYMENT', 'WAITING_VALIDATION', 'WAITING_APPROVAL', 'IN_TRANSIT', 'SUBMITTED', 'PROVISIONING', 'RUNNING', 'AUTO_GENERATED'].includes(value)) {
    return 'warning';
  }
  if (['FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'DISCREPANCY', 'INSUFFICIENT', 'KURANG', 'GAGAL'].includes(value)) {
    return 'danger';
  }
  if (['ISSUED', 'SENT', 'ALLOCATED', 'PARTIALLY_RECEIVED', 'PARTIALLY_PAID', 'BACKORDERED'].includes(value)) {
    return 'info';
  }
  return 'neutral';
}

// --- Toast -----------------------------------------------------------------

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{
  push: (message: string, tone?: Toast['tone']) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 6000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
              toast.tone === 'success' &&
                'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
              toast.tone === 'error' &&
                'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
              toast.tone === 'info' &&
                'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
            )}
          >
            {toast.tone === 'success' && <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            {toast.tone === 'error' && (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
              className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast harus dipakai di dalam ToastProvider.');
  return context;
}

// --- Confirm dialog --------------------------------------------------------

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  requireReason,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        )}
        {requireReason && (
          <div className="mt-4">
            <label className="field-label" htmlFor="confirm-reason">
              {t('common.reason')}
            </label>
            <textarea
              id="confirm-reason"
              className="field-input"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={clsx('btn', destructive ? 'bg-rose-600 text-white hover:bg-rose-700' : 'btn-primary')}
            disabled={requireReason && reason.trim().length === 0}
            onClick={() => onConfirm(requireReason ? reason : undefined)}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Step-up dialog --------------------------------------------------------

/**
 * Verifikasi ulang kata sandi untuk aksi sensitif (purge, suspend tenant,
 * support write). Kata sandi tidak pernah tampil sebagai teks biasa dan tidak
 * pernah disimpan pada state global.
 */
export function StepUpDialog({
  open,
  title,
  description,
  onSubmit,
  onCancel,
  pending,
}: {
  open: boolean;
  title?: string;
  description?: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) setPassword('');
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? t('auth.stepUpTitle')}
    >
      <form
        className="card w-full max-w-md p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (password) onSubmit(password);
        }}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title ?? t('auth.stepUpTitle')}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {description ?? t('auth.stepUpSubtitle')}
        </p>
        <div className="mt-4">
          <label className="field-label" htmlFor="step-up-password">
            {t('auth.password')}
          </label>
          <input
            id="step-up-password"
            type="password"
            autoComplete="current-password"
            className="field-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!password || pending}>
            {t('auth.stepUpVerify')}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Page header -----------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <header className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 && <span aria-hidden>/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-brand-700 dark:hover:text-brand-300">
                    {crumb.label}
                  </a>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// --- Data grid -------------------------------------------------------------

export interface GridColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

export function DataGrid<T extends Record<string, unknown>>({
  columns,
  rows,
  loading,
  error,
  emptyTitle,
  rowKey,
  onRetry,
  sortBy,
  sortDir,
  onSort,
}: {
  columns: Array<GridColumn<T>>;
  rows: T[];
  loading?: boolean;
  error?: string;
  emptyTitle?: string;
  rowKey: (row: T) => string;
  onRetry?: () => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!rows.length) return <EmptyState title={emptyTitle} />;

  return (
    <>
      {/* Tabel penuh pada layar besar */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block dark:border-slate-800">
        <table className="table-grid">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={column.className}>
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-brand-700 dark:hover:text-brand-300"
                      onClick={() => onSort(column.key)}
                    >
                      {column.header}
                      {sortBy === column.key && <span aria-hidden>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.render ? column.render(row) : String(row[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fallback kartu pada layar kecil */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="card p-4">
            <dl className="space-y-2">
              {columns.map((column) => (
                <div key={column.key} className="flex items-start justify-between gap-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {column.header}
                  </dt>
                  <dd className="text-end text-sm text-slate-800 dark:text-slate-100">
                    {column.render ? column.render(row) : String(row[column.key] ?? '-')}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t('common.total')}: {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-outline px-3 py-1.5 text-xs"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          {t('common.previous')}
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {t('common.page')} {page} {t('common.of')} {totalPages}
        </span>
        <button
          type="button"
          className="btn-outline px-3 py-1.5 text-xs"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          {t('common.next')}
        </button>
      </div>
    </nav>
  );
}

/** Nilai teknis (kode, SKU, nomor dokumen) selalu ditampilkan LTR. */
export function Code({ children }: { children: ReactNode }) {
  return <span className="ltr-code font-mono text-xs">{children}</span>;
}
