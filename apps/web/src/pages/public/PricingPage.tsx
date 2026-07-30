import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { api, formatMoney } from '../../lib/api';
import { LoadingState } from '../../components/ui';
import { localeTag } from './HomePage';

export interface PackageDto {
  code: string;
  name: string;
  description?: string | null;
  isRecommended: boolean;
  sortOrder: number;
  versionNumber: number;
  trialDays: number;
  price: {
    currencyCode: string;
    billingMetric: string;
    billingInterval: string;
    intervalCount: number;
    unitPrice: string;
    minimumQty: number;
    tiers: Array<{ minQuantity: number; maxQuantity: number | null; unitPrice: string | null }>;
  } | null;
  modules: Array<{ code: string; name: string; entitlementScope: string }>;
  features: Array<{ code: string; name: string; limitValue?: number | null; unit?: string | null }>;
}

interface ComparisonDto {
  modules: Array<{ code: string; name: string; category: string }>;
  packages: Array<{
    code: string;
    name: string;
    price: PackageDto['price'];
    isRecommended: boolean;
    moduleMatrix: Record<string, boolean>;
  }>;
}

export function usePackages() {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: ['public-packages', i18n.language],
    queryFn: () => api.get<PackageDto[]>('/public/packages'),
    staleTime: 5 * 60_000,
  });
}

/**
 * Kartu paket. Seluruh angka berasal dari pricing engine yang dipublikasikan —
 * tidak ada harga yang ditulis pada source frontend.
 */
export function PackageCards({
  packages,
  loading,
}: {
  packages: PackageDto[];
  loading?: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (loading) return <LoadingState />;

  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {packages.map((pkg) => (
        <article
          key={pkg.code}
          data-testid={`package-card-${pkg.code}`}
          className={clsx(
            'card relative flex flex-col p-6',
            pkg.isRecommended && 'ring-2 ring-brand-600',
          )}
        >
          {pkg.isRecommended && (
            <span className="absolute -top-3 start-6 rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white">
              {t('web.recommended')}
            </span>
          )}
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{pkg.name}</h3>
          {pkg.description && (
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{pkg.description}</p>
          )}

          <div className="mt-5">
            <span
              className="text-3xl font-extrabold text-slate-900 dark:text-white"
              data-testid={`package-price-${pkg.code}`}
            >
              {pkg.price
                ? formatMoney(pkg.price.unitPrice, pkg.price.currencyCode, localeTag(i18n.language))
                : '—'}
            </span>
            <span className="ms-1 text-sm text-slate-500 dark:text-slate-400">{t('web.perMonth')}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('web.trialDays', { days: pkg.trialDays })}
          </p>

          {pkg.price && pkg.price.tiers.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {pkg.price.tiers.map((tier) => (
                <li key={tier.minQuantity} className="flex justify-between gap-2">
                  <span>
                    {tier.minQuantity}
                    {tier.maxQuantity ? `–${tier.maxQuantity}` : '+'} POS
                  </span>
                  <span className="font-medium">
                    {formatMoney(tier.unitPrice, pkg.price!.currencyCode, localeTag(i18n.language))}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('web.modulesIncluded')} ({pkg.modules.length})
            </p>
            <ul className="space-y-1.5">
              {pkg.modules.slice(0, 8).map((module) => (
                <li key={module.code} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <span className="text-slate-700 dark:text-slate-200">{module.name}</span>
                </li>
              ))}
              {pkg.modules.length > 8 && (
                <li className="ps-6 text-sm text-slate-500 dark:text-slate-400">
                  + {pkg.modules.length - 8} modul lainnya
                </li>
              )}
            </ul>
          </div>

          <Link
            to={`/daftar?paket=${pkg.code}`}
            className={clsx('mt-6', pkg.isRecommended ? 'btn-primary' : 'btn-outline')}
          >
            {t('web.choosePackage')}
          </Link>
        </article>
      ))}
    </div>
  );
}

export function PricingPage() {
  const { t, i18n } = useTranslation();
  const packages = usePackages();
  const comparison = useQuery({
    queryKey: ['package-comparison', i18n.language],
    queryFn: () => api.get<ComparisonDto>('/public/subscription-packages/compare'),
  });

  return (
    <div className="py-14">
      <div className="container-page">
        <header className="text-center">
          <p className="section-eyebrow">{t('nav.pricing')}</p>
          <h1 className="section-heading">Bayar per Mesin Kasir, Pilih Paket Modul</h1>
          <p className="section-lead mx-auto">
            Harga dasar sebelum pajak dan biaya administrasi. Seluruh angka berasal dari katalog
            paket yang dipublikasikan, bukan nilai tetap pada aplikasi.
          </p>
        </header>

        <PackageCards packages={packages.data ?? []} loading={packages.isLoading} />

        {comparison.data && (
          <section className="mt-16">
            <h2 className="section-heading text-center">Perbandingan Modul</h2>
            <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="table-grid min-w-[720px]">
                <thead>
                  <tr>
                    <th scope="col">Modul</th>
                    {comparison.data.packages.map((pkg) => (
                      <th key={pkg.code} scope="col" className="text-center">
                        <span className="block">{pkg.name}</span>
                        <span className="block text-xs font-normal normal-case text-slate-500">
                          {pkg.price
                            ? formatMoney(pkg.price.unitPrice, pkg.price.currencyCode, localeTag(i18n.language))
                            : '—'}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.data.modules.map((module) => (
                    <tr key={module.code}>
                      <th scope="row" className="px-3 py-2.5 text-start text-sm font-medium">
                        {module.name}
                      </th>
                      {comparison.data!.packages.map((pkg) => (
                        <td key={pkg.code} className="text-center">
                          {pkg.moduleMatrix[module.code] ? (
                            <Check className="mx-auto h-4 w-4 text-brand-600" aria-label="Termasuk" />
                          ) : (
                            <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="Tidak termasuk" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
