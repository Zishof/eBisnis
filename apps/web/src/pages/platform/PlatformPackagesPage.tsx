import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Calculator } from 'lucide-react';
import { api, formatMoney, formatNumber } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { Code, ErrorState, LoadingState, PageHeader, StatusBadge, useToast } from '../../components/ui';

interface PlanTier {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: string | null;
  flatAmount: string | null;
}

interface PlanPrice {
  id: string;
  currencyCode: string;
  billingMetric: string;
  billingInterval: string;
  intervalCount: number;
  unitPrice: string;
  minimumQty: number;
  tiers: PlanTier[];
}

interface PlanVersion {
  id: string;
  versionNumber: number;
  status: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  trialDays: number | null;
  gracePeriodDays: number | null;
  prices: PlanPrice[];
  modules: Array<{ module: { code: string; name: string }; included: boolean }>;
  features: Array<{ feature: { code: string; name: string }; limitValue: number | null }>;
  constraints: Array<{ constraintType: string; numericValue: number | null; note: string | null }>;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  marketSegment: string;
  status: string;
  isPublic: boolean;
  isRecommended: boolean;
  sortOrder: number;
  product: { code: string; name: string } | null;
  versions: PlanVersion[];
}

interface DiscountProgram {
  id: string;
  code: string;
  name: string;
  stackPolicy: string;
  priority: number;
  status: string;
  requiresPromoCode: boolean;
  rules: Array<{
    id: string;
    code: string;
    name: string;
    sequence: number;
    benefits: Array<{ benefitType: string; numericValue: string; currencyCode: string | null }>;
    conditionGroups: Array<{
      operator: string;
      conditions: Array<{ field: string; operator: string; valueJson: unknown }>;
    }>;
  }>;
  promoCodes: Array<{ code: string; maxRedemptions: number | null; usedCount: number }>;
}

interface SimulationResult {
  grandTotal: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  adminFeeTotal: string;
  currencyCode: string;
  quantity: number;
  planVersionNumber: number;
  adjustments: Array<{ sourceType: string; label: string; amount: string }>;
  trace: {
    roundingMode: string;
    steps: Array<{ step: number; name: string; runningSubtotal: string }>;
    discountEvaluations: Array<{
      programCode: string;
      ruleCode: string;
      matched: boolean;
      stackPolicy: string;
      priority: number;
      benefitApplied: string | null;
      amount: string;
    }>;
  };
}

export function PlatformPackagesPage() {
  const { t } = useTranslation();
  const toMessage = useErrorMessage();

  const plans = useQuery({
    queryKey: ['platform', 'subscription-plans'],
    queryFn: () => api.get<Plan[]>('/platform/subscription-plans'),
  });

  const discounts = useQuery({
    queryKey: ['platform', 'discount-programs'],
    queryFn: () => api.get<DiscountProgram[]>('/platform/discount-programs'),
  });

  if (plans.isLoading) return <LoadingState />;
  if (plans.isError) {
    return (
      <ErrorState
        message={toMessage(plans.error, (key, fallback) => t(key, fallback ?? key))}
        onRetry={() => void plans.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={t('platform.packages')}
        description="Paket bersifat versioned: harga dan cakupan modul yang sudah dipakai quote tidak pernah berubah. Perubahan harga membuat versi baru."
        breadcrumbs={[{ label: t('platform.dashboard'), href: '/platform' }]}
      />

      <Simulator plans={plans.data ?? []} />

      <section className="mt-8 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Paket dan versi</h2>
        {(plans.data ?? []).map((plan) => (
          <article key={plan.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {plan.name} <Code>{plan.code}</Code>
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Produk: {plan.product?.name ?? '—'} · segmen <Code>{plan.marketSegment}</Code>
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={plan.status} />
                {plan.isPublic && <StatusBadge status="PUBLIK" tone="info" />}
                {plan.isRecommended && <StatusBadge status="DIREKOMENDASIKAN" tone="brand" />}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {plan.versions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      Versi {version.versionNumber} <StatusBadge status={version.status} />
                    </p>
                    {version.trialDays ? (
                      <p className="text-xs text-slate-500">Uji coba {version.trialDays} hari</p>
                    ) : null}
                  </div>

                  {version.prices.map((price) => (
                    <div key={price.id} className="mt-3">
                      <p className="text-sm">
                        {formatMoney(price.unitPrice, price.currencyCode)} /{' '}
                        {price.intervalCount > 1 ? `${price.intervalCount} ` : ''}
                        {price.billingInterval.toLowerCase()} · <Code>{price.billingMetric}</Code> · minimum{' '}
                        {price.minimumQty}
                      </p>
                      {price.tiers.length > 0 && (
                        <div className="mt-2 overflow-x-auto">
                          <table className="table-grid">
                            <thead>
                              <tr>
                                <th scope="col">Kuantitas</th>
                                <th scope="col">Harga satuan</th>
                                <th scope="col">Harga flat</th>
                              </tr>
                            </thead>
                            <tbody>
                              {price.tiers.map((tier) => (
                                <tr key={`${tier.minQuantity}-${tier.maxQuantity ?? 'inf'}`}>
                                  <td>
                                    {tier.minQuantity}
                                    {tier.maxQuantity ? `–${tier.maxQuantity}` : '+'}
                                  </td>
                                  <td>
                                    {tier.unitPrice ? formatMoney(tier.unitPrice, price.currencyCode) : '—'}
                                  </td>
                                  <td>
                                    {tier.flatAmount ? formatMoney(tier.flatAmount, price.currencyCode) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {version.modules
                      .filter((item) => item.included)
                      .map((item) => (
                        <span
                          key={item.module.code}
                          className="badge bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300"
                        >
                          {item.module.name}
                        </span>
                      ))}
                  </div>

                  {version.constraints.length > 0 && (
                    <ul className="mt-3 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {version.constraints.map((constraint) => (
                        <li key={constraint.constraintType}>
                          <Code>{constraint.constraintType}</Code>
                          {constraint.numericValue !== null && `: ${formatNumber(constraint.numericValue)}`}
                          {constraint.note && ` — ${constraint.note}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('platform.discounts')}</h2>
        {discounts.isLoading ? (
          <LoadingState />
        ) : (
          (discounts.data ?? []).map((program) => (
            <article key={program.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {program.name} <Code>{program.code}</Code>
                </h3>
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={program.status} />
                  <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {program.stackPolicy}
                  </span>
                  <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    prioritas {program.priority}
                  </span>
                  {program.requiresPromoCode && (
                    <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      butuh kode promo
                    </span>
                  )}
                </div>
              </div>

              {program.rules.map((rule) => (
                <div key={rule.id} className="mt-3 rounded border border-slate-200 p-3 text-xs dark:border-slate-800">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {rule.sequence}. {rule.name} <Code>{rule.code}</Code>
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    Manfaat:{' '}
                    {rule.benefits
                      .map((benefit) => `${benefit.benefitType} ${benefit.numericValue}`)
                      .join(', ') || '—'}
                  </p>
                  {rule.conditionGroups.map((group, groupIndex) => (
                    <p key={groupIndex} className="mt-1 text-slate-600 dark:text-slate-300">
                      Kondisi ({group.operator}):{' '}
                      {group.conditions
                        .map(
                          (condition) =>
                            `${condition.field} ${condition.operator} ${JSON.stringify(condition.valueJson)}`,
                        )
                        .join(' · ')}
                    </p>
                  ))}
                </div>
              ))}

              {program.promoCodes.length > 0 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Kode promo:{' '}
                  {program.promoCodes
                    .map((promo) => `${promo.code} (${promo.usedCount}/${promo.maxRedemptions ?? '∞'})`)
                    .join(', ')}
                </p>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}

function Simulator({ plans }: { plans: Plan[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? '');
  const [quantity, setQuantity] = useState('10');
  const [promoCode, setPromoCode] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  const simulate = useMutation({
    mutationFn: () =>
      api.post<SimulationResult>('/platform/pricing/simulate', {
        planCode: planCode || plans[0]?.code,
        paymentMode: 'CONSOLIDATED_ALL_DEVICES',
        quantity: Number(quantity) || 1,
        ...(promoCode.trim() ? { promoCode: promoCode.trim().toUpperCase() } : {}),
      }),
    onSuccess: setResult,
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  return (
    <section className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
        <Calculator className="h-4 w-4" aria-hidden />
        Simulasi harga dengan explanation trace
      </h2>
      <form
        className="grid gap-3 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          simulate.mutate();
        }}
      >
        <div>
          <label className="field-label" htmlFor="sim-plan">
            Paket
          </label>
          <select
            id="sim-plan"
            className="field-input"
            value={planCode}
            onChange={(event) => setPlanCode(event.target.value)}
          >
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="sim-quantity">
            Jumlah perangkat
          </label>
          <input
            id="sim-quantity"
            type="number"
            min={1}
            max={10000}
            className="field-input"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="sim-promo">
            Kode promo
          </label>
          <input
            id="sim-promo"
            className="field-input ltr-code"
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full" disabled={simulate.isPending}>
            Hitung
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-5" data-testid="simulation-result">
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatMoney(result.grandTotal, result.currencyCode)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Versi paket {result.planVersionNumber} · {formatNumber(result.quantity)} perangkat · Subtotal{' '}
            {formatMoney(result.subtotal, result.currencyCode)} · Diskon{' '}
            {formatMoney(result.discountTotal, result.currencyCode)} · Pajak{' '}
            {formatMoney(result.taxTotal, result.currencyCode)} · Biaya admin{' '}
            {formatMoney(result.adminFeeTotal, result.currencyCode)} · Pembulatan{' '}
            <Code>{result.trace.roundingMode}</Code>
          </p>

          <ol className="mt-4 space-y-1 text-xs">
            {result.trace.steps.map((step) => (
              <li
                key={step.step}
                className="flex items-start justify-between gap-3 rounded bg-slate-50 px-3 py-1.5 dark:bg-slate-800"
              >
                <span className="text-slate-600 dark:text-slate-300">
                  <Code>{step.step}</Code> — {step.name}
                </span>
                <span className="shrink-0 font-medium">
                  {formatMoney(step.runningSubtotal, result.currencyCode)}
                </span>
              </li>
            ))}
          </ol>

          {result.adjustments.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {result.adjustments.map((adjustment, index) => (
                <li
                  key={`${adjustment.sourceType}-${index}`}
                  className="flex items-start justify-between gap-3"
                >
                  <span>
                    <Code>{adjustment.sourceType}</Code> — {adjustment.label}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatMoney(adjustment.amount, result.currencyCode)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {result.trace.discountEvaluations.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {result.trace.discountEvaluations.map((evaluation, index) => (
                <li key={`${evaluation.programCode}-${evaluation.ruleCode}-${index}`}>
                  <StatusBadge
                    status={evaluation.matched ? 'COCOK' : 'TIDAK COCOK'}
                    tone={evaluation.matched ? 'success' : 'neutral'}
                  />{' '}
                  <Code>
                    {evaluation.programCode}/{evaluation.ruleCode}
                  </Code>{' '}
                  — {evaluation.stackPolicy}, prioritas {evaluation.priority}
                  {evaluation.benefitApplied && `, ${evaluation.benefitApplied}`} ·{' '}
                  {formatMoney(evaluation.amount, result.currencyCode)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
