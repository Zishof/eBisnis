import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api, formatNumber } from '../../lib/api';
import { Code, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';

interface TreeNode {
  type: 'REGION' | 'WAREHOUSE';
  id: string;
  code: string;
  name: string;
  onHand: string;
  available: string;
  reserved: string;
  inTransit: string;
  quarantine: string;
  damaged: string;
  totalChildren: number;
  children: TreeNode[];
}

interface StockTreeResponse {
  nodes: TreeNode[];
  totals: Omit<TreeNode, 'children' | 'type' | 'id' | 'code' | 'name' | 'totalChildren'>;
}

/** Monitoring stok berbentuk tree: Wilayah → Gudang. */
export function StockTreePage() {
  const { t } = useTranslation();
  const toMessage = useErrorMessage();
  const [includeZero, setIncludeZero] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useQuery({
    queryKey: ['stock-tree', includeZero],
    queryFn: () => api.get<StockTreeResponse>(`/inventory/stock-tree?includeZero=${includeZero}`),
  });

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <PageHeader
        title={t('inventory.stockTree')}
        description="Agregasi saldo stok per wilayah dan gudang. Sumber kebenaran adalah ledger mutasi stok."
        breadcrumbs={[{ label: t('app.dashboard'), href: '/app' }, { label: t('inventory.stockTree') }]}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeZero}
              onChange={(event) => setIncludeZero(event.target.checked)}
            />
            {t('inventory.includeZero')}
          </label>
        }
      />

      {tree.data && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ['onHand', t('inventory.onHand')],
              ['available', t('inventory.available')],
              ['reserved', t('inventory.reserved')],
              ['inTransit', t('inventory.inTransit')],
              ['quarantine', t('inventory.quarantine')],
              ['damaged', t('inventory.damaged')],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="card p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                {formatNumber(tree.data.totals[key])}
              </p>
            </div>
          ))}
        </div>
      )}

      {tree.isLoading ? (
        <LoadingState />
      ) : tree.isError ? (
        <ErrorState
          message={toMessage(tree.error, (key, fallback) => t(key, fallback ?? key))}
          onRetry={() => void tree.refetch()}
        />
      ) : (
        <div className="card overflow-hidden" data-testid="stock-tree">
          <table className="table-grid">
            <thead>
              <tr>
                <th scope="col">{t('inventory.region')} / {t('inventory.warehouse')}</th>
                <th scope="col" className="text-end">{t('inventory.onHand')}</th>
                <th scope="col" className="text-end">{t('inventory.available')}</th>
                <th scope="col" className="text-end">{t('inventory.inTransit')}</th>
                <th scope="col" className="text-end">{t('inventory.quarantine')}</th>
              </tr>
            </thead>
            <tbody>
              {(tree.data?.nodes ?? []).map((region) => {
                const isOpen = expanded.has(region.id) || expanded.size === 0;
                return (
                  <>
                    <tr key={region.id} className="bg-slate-50 font-semibold dark:bg-slate-800/60">
                      <td>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2"
                          onClick={() => toggle(region.id)}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                          )}
                          <Code>{region.code}</Code>
                          <span>{region.name}</span>
                          <span className="text-xs font-normal text-slate-500">
                            ({region.totalChildren})
                          </span>
                        </button>
                      </td>
                      <td className="text-end">{formatNumber(region.onHand)}</td>
                      <td className="text-end">{formatNumber(region.available)}</td>
                      <td className="text-end">{formatNumber(region.inTransit)}</td>
                      <td className="text-end">{formatNumber(region.quarantine)}</td>
                    </tr>
                    {isOpen &&
                      region.children.map((warehouse) => (
                        <tr key={warehouse.id}>
                          <td className="ps-10">
                            <Code>{warehouse.code}</Code> <span>{warehouse.name}</span>
                          </td>
                          <td className="text-end">{formatNumber(warehouse.onHand)}</td>
                          <td className="text-end">{formatNumber(warehouse.available)}</td>
                          <td className="text-end">{formatNumber(warehouse.inTransit)}</td>
                          <td className="text-end">{formatNumber(warehouse.quarantine)}</td>
                        </tr>
                      ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
