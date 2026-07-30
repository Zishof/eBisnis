import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, Plus } from 'lucide-react';
import { api, formatDate, formatMoney } from '../../lib/api';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import {
  Code,
  DataGrid,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  useToast,
  type GridColumn,
} from '../../components/ui';

interface PosDevice extends Record<string, unknown> {
  id: string;
  code: string;
  label: string;
  status: string;
  outletCode: string | null;
  createdAt: string;
  entitlements: Array<{ moduleCode: string; status: string; endsAt: string | null }>;
}

interface PublicPlan {
  code: string;
  name: string;
  description: string | null;
  price: { currencyCode: string; unitPrice: string; billingInterval: string } | null;
  modules: Array<{ code: string; name: string }>;
}

interface QuoteAdjustment {
  sequence: number;
  sourceType: string;
  label: string;
  amount: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  quantity: number;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  adminFeeTotal: string;
  grandTotal: string;
  currencyCode: string;
  adjustments: QuoteAdjustment[];
  lines: Array<{
    description: string;
    quantity: number;
    effectiveUnitPrice: string;
    lineTotal: string;
  }>;
}

interface Invoice extends Record<string, unknown> {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  grandTotal: string;
  currencyCode: string;
}

type Tab = 'devices' | 'checkout' | 'invoices';

type PaymentMode = 'PER_DEVICE' | 'SELECTED_DEVICES' | 'CONSOLIDATED_ALL_DEVICES';

const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  PER_DEVICE: 'billing.perDevice',
  SELECTED_DEVICES: 'billing.selectedDevices',
  CONSOLIDATED_ALL_DEVICES: 'billing.consolidated',
};

const TAB_PATHS: Record<Tab, string> = {
  devices: '/app/devices',
  checkout: '/app/subscription/checkout',
  invoices: '/app/subscription/invoices',
};

export function SubscriptionPage({ tab }: { tab: Tab }) {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title={t('billing.subscription')}
        description="Kelola perangkat POS, hitung harga langganan dengan rincian perhitungan, dan pantau invoice."
        breadcrumbs={[{ label: t('app.dashboard'), href: '/app' }, { label: t('billing.subscription') }]}
      />

      <nav className="mb-6 flex flex-wrap gap-2" aria-label={t('billing.subscription')}>
        {(Object.keys(TAB_PATHS) as Tab[]).map((key) => (
          <Link
            key={key}
            to={TAB_PATHS[key]}
            className={key === tab ? 'btn-primary px-3 py-1.5 text-sm' : 'btn-outline px-3 py-1.5 text-sm'}
          >
            {t(`billing.${key}`)}
          </Link>
        ))}
      </nav>

      {tab === 'devices' && <DevicesTab />}
      {tab === 'checkout' && <CheckoutTab />}
      {tab === 'invoices' && <InvoicesTab />}
    </>
  );
}

// --- Perangkat POS ---------------------------------------------------------

function DevicesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();
  const { user } = useAuth();
  const [form, setForm] = useState({ code: '', label: '', outletCode: '' });

  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<PosDevice[]>('/devices'),
  });

  const register = useMutation({
    mutationFn: () =>
      api.post<PosDevice>('/devices', {
        code: form.code.trim(),
        label: form.label.trim(),
        ...(form.outletCode.trim() ? { outletCode: form.outletCode.trim() } : {}),
      }),
    onSuccess: () => {
      toast.push('Perangkat POS terdaftar.', 'success');
      setForm({ code: '', label: '', outletCode: '' });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/devices/${id}/revoke`, { reason: 'Dicabut dari portal tenant' }),
    onSuccess: () => {
      toast.push('Perangkat dicabut.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  const columns: Array<GridColumn<PosDevice>> = [
    { key: 'code', header: t('common.code'), render: (row) => <Code>{row.code}</Code> },
    { key: 'label', header: t('common.name') },
    { key: 'outletCode', header: 'Outlet', render: (row) => (row.outletCode ? <Code>{row.outletCode}</Code> : '—') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'entitlements',
      header: 'Modul aktif',
      render: (row) =>
        row.entitlements.length === 0 ? (
          <span className="text-xs text-slate-500">Belum ada langganan aktif</span>
        ) : (
          <span className="flex flex-wrap justify-end gap-1">
            {row.entitlements.map((item) => (
              <span key={item.moduleCode} className="badge bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                {item.moduleCode}
              </span>
            ))}
          </span>
        ),
    },
    { key: 'createdAt', header: 'Terdaftar', render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions',
      header: t('common.actions'),
      className: 'text-end',
      render: (row) =>
        row.status === 'REVOKED' || row.status === 'REPLACED' ? (
          '—'
        ) : (
          <button
            type="button"
            className="btn-outline px-2 py-1 text-xs"
            disabled={revoke.isPending || Boolean(user?.isDemo)}
            onClick={() => revoke.mutate(row.id)}
          >
            Cabut
          </button>
        ),
    },
  ];

  return (
    <>
      <form
        className="card mb-6 grid gap-3 p-4 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          register.mutate();
        }}
      >
        <div>
          <label className="field-label" htmlFor="device-code">
            {t('common.code')}
          </label>
          <input
            id="device-code"
            className="field-input ltr-code"
            value={form.code}
            required
            maxLength={48}
            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="device-label">
            {t('common.name')}
          </label>
          <input
            id="device-label"
            className="field-input"
            value={form.label}
            required
            maxLength={120}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="device-outlet">
            Outlet (opsional)
          </label>
          <input
            id="device-outlet"
            className="field-input ltr-code"
            value={form.outletCode}
            maxLength={64}
            onChange={(event) => setForm((current) => ({ ...current, outletCode: event.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full" disabled={register.isPending || Boolean(user?.isDemo)}>
            <Plus className="h-4 w-4" aria-hidden />
            Daftarkan
          </button>
        </div>
      </form>

      <DataGrid
        columns={columns}
        rows={devices.data ?? []}
        loading={devices.isLoading}
        error={
          devices.isError ? toMessage(devices.error, (key, fallback) => t(key, fallback ?? key)) : undefined
        }
        rowKey={(row) => row.id}
        onRetry={() => void devices.refetch()}
      />
    </>
  );
}

// --- Checkout --------------------------------------------------------------

function CheckoutTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();
  const { user } = useAuth();
  const [planCode, setPlanCode] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CONSOLIDATED_ALL_DEVICES');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);

  const plans = useQuery({
    queryKey: ['public', 'packages'],
    queryFn: () => api.get<PublicPlan[]>('/public/packages'),
  });

  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<PosDevice[]>('/devices'),
  });

  const createQuote = useMutation({
    mutationFn: () =>
      api.post<Quote>('/subscriptions/quotes', {
        planCode: planCode || plans.data?.[0]?.code,
        paymentMode,
        ...(paymentMode === 'SELECTED_DEVICES' && selectedDevices.length > 0
          ? { deviceIds: selectedDevices }
          : {}),
        ...(promoCode.trim() ? { promoCode: promoCode.trim().toUpperCase() } : {}),
      }),
    onSuccess: (result) => {
      setQuote(result);
      toast.push(`Quote ${result.quoteNumber} dibuat.`, 'success');
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  const accept = useMutation({
    mutationFn: (quoteId: string) => api.post<Invoice>(`/subscriptions/quotes/${quoteId}/accept`),
    onSuccess: (invoice) => {
      toast.push(`Invoice ${invoice.invoiceNumber} diterbitkan.`, 'success');
      setQuote(null);
      void queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  if (plans.isLoading) return <LoadingState />;

  const activeDevices = (devices.data ?? []).filter(
    (device) => device.status !== 'REVOKED' && device.status !== 'REPLACED',
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form
        className="card space-y-4 p-5 lg:col-span-2"
        onSubmit={(event) => {
          event.preventDefault();
          createQuote.mutate();
        }}
      >
        <div>
          <label className="field-label" htmlFor="plan-code">
            Paket
          </label>
          <select
            id="plan-code"
            className="field-input"
            value={planCode || plans.data?.[0]?.code || ''}
            onChange={(event) => setPlanCode(event.target.value)}
          >
            {(plans.data ?? []).map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name}
                {plan.price ? ` — ${formatMoney(plan.price.unitPrice, plan.price.currencyCode)}` : ''}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="field-label">{t('billing.paymentMode')}</legend>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="payment-mode"
                  value={mode}
                  checked={paymentMode === mode}
                  onChange={() => setPaymentMode(mode)}
                />
                {t(PAYMENT_MODE_LABELS[mode])}
              </label>
            ))}
          </div>
        </fieldset>

        {paymentMode === 'SELECTED_DEVICES' && (
          <fieldset>
            <legend className="field-label">{t('billing.selectedDevices')}</legend>
            {activeDevices.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada perangkat aktif. Seluruh perangkat akan dihitung.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 dark:border-slate-800">
                {activeDevices.map((device) => (
                  <label key={device.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedDevices.includes(device.id)}
                      onChange={(event) =>
                        setSelectedDevices((current) =>
                          event.target.checked
                            ? [...current, device.id]
                            : current.filter((id) => id !== device.id),
                        )
                      }
                    />
                    <span className="ltr-code font-mono text-xs">{device.code}</span>
                    <span className="text-slate-600 dark:text-slate-300">{device.label}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}

        <div>
          <label className="field-label" htmlFor="promo-code">
            Kode promo (opsional)
          </label>
          <input
            id="promo-code"
            className="field-input ltr-code"
            value={promoCode}
            maxLength={48}
            onChange={(event) => setPromoCode(event.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={createQuote.isPending}>
          {t('billing.quote')}
        </button>
      </form>

      <div className="lg:col-span-3">
        {!quote ? (
          <EmptyState
            title={t('billing.quote')}
            description="Pilih paket dan mode pembayaran, lalu hitung harga. Seluruh langkah perhitungan akan ditampilkan."
          />
        ) : (
          <div className="card p-5" data-testid="quote-result">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{t('billing.quote')}</p>
                <p className="font-mono text-sm text-slate-900 dark:text-white">{quote.quoteNumber}</p>
              </div>
              <StatusBadge status={quote.status} />
            </div>

            <dl className="space-y-1 text-sm">
              <Row label={t('billing.subtotal')} value={formatMoney(quote.subtotal, quote.currencyCode)} />
              <Row
                label={t('billing.discount')}
                value={`- ${formatMoney(quote.discountTotal, quote.currencyCode)}`}
              />
              <Row label={t('billing.tax')} value={formatMoney(quote.taxTotal, quote.currencyCode)} />
              <Row label={t('billing.adminFee')} value={formatMoney(quote.adminFeeTotal, quote.currencyCode)} />
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold dark:border-slate-800">
                <dt>{t('billing.grandTotal')}</dt>
                <dd data-testid="quote-grand-total">{formatMoney(quote.grandTotal, quote.currencyCode)}</dd>
              </div>
            </dl>

            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-900 dark:text-white">
              {t('billing.calculationTrace')}
            </h3>
            <ol className="space-y-1 text-xs">
              {quote.adjustments.map((adjustment) => (
                <li
                  key={`${adjustment.sequence}-${adjustment.sourceType}`}
                  className="flex items-start justify-between gap-3 rounded bg-slate-50 px-3 py-1.5 dark:bg-slate-800"
                >
                  <span className="text-slate-600 dark:text-slate-300">
                    <span className="ltr-code font-mono">
                      {adjustment.sequence}. {adjustment.sourceType}
                    </span>{' '}
                    — {adjustment.label}
                  </span>
                  <span className="shrink-0 font-medium">{formatMoney(adjustment.amount, quote.currencyCode)}</span>
                </li>
              ))}
            </ol>

            {quote.lines.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="table-grid">
                  <thead>
                    <tr>
                      <th scope="col">Rincian</th>
                      <th scope="col">Qty</th>
                      <th scope="col">Harga satuan</th>
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lines.map((line, index) => (
                      <tr key={`${line.description}-${index}`}>
                        <td>{line.description}</td>
                        <td>{line.quantity}</td>
                        <td>{formatMoney(line.effectiveUnitPrice, quote.currencyCode)}</td>
                        <td>{formatMoney(line.lineTotal, quote.currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              type="button"
              className="btn-primary mt-6 w-full"
              disabled={accept.isPending || Boolean(user?.isDemo)}
              onClick={() => accept.mutate(quote.id)}
              data-testid="accept-quote"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {t('billing.acceptQuote')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="font-medium text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

// --- Invoice ---------------------------------------------------------------

function InvoicesTab() {
  const { t } = useTranslation();
  const toMessage = useErrorMessage();

  const invoices = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => api.get<Invoice[]>('/billing/invoices'),
  });

  const columns: Array<GridColumn<Invoice>> = [
    { key: 'invoiceNumber', header: 'Nomor', render: (row) => <Code>{row.invoiceNumber}</Code> },
    { key: 'issueDate', header: 'Terbit', render: (row) => formatDate(row.issueDate) },
    { key: 'dueDate', header: 'Jatuh tempo', render: (row) => formatDate(row.dueDate) },
    {
      key: 'grandTotal',
      header: t('billing.grandTotal'),
      className: 'text-end',
      render: (row) => formatMoney(row.grandTotal, row.currencyCode),
    },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={invoices.data ?? []}
      loading={invoices.isLoading}
      error={
        invoices.isError ? toMessage(invoices.error, (key, fallback) => t(key, fallback ?? key)) : undefined
      }
      rowKey={(row) => row.id}
      onRetry={() => void invoices.refetch()}
    />
  );
}
