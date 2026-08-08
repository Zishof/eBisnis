import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import { InventoryControlPage } from './InventoryControlPage';

afterEach(() => vi.restoreAllMocks());

describe('InventoryControlPage — layar 08', () => {
  it('menampilkan saldo live per gudang dari endpoint yang ter-scope', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/inventory/balances') {
        return [{
          id: 'balance-1',
          warehouse_code: 'GDG-PUSAT',
          warehouse_name: 'Gudang Pusat',
          product_code: 'OBT-001',
          product_name: 'Amoksisilin 500 mg',
          uom_code: 'KAPLET',
          on_hand_qty: '30',
          available_qty: '25',
          reserved_qty: '5',
          in_transit_qty: '2',
          quarantine_qty: '1',
          last_movement_at: '2026-08-08T00:00:00.000Z',
        }];
      }
      if (path === '/inventory/sales-dashboard') {
        return { summary: { products: 1 }, topSales: [], topProducts: [], recentOrders: [] };
      }
      if (path === '/inventory/legacy-import-reconciliation') {
        return {
          totals: { raw_records: 0, files: 0, purchase_orders: 0, receivable_amount: '0', payable_amount: '0', price_history_rows: 0, stock_opname_rows: 0 },
          salesMap: [],
        };
      }
      if (path.startsWith('/inventory/parity-summary')) {
        return { asOf: '2026-08-08', includeSettled: false, receivables: {}, payables: {}, profitBySales: [], profitByProduct: [], evidence: {}, parity: { screens: 48, mapped: 48, requiresBusinessUat: [] } };
      }
      if (path === '/inventory/parity-contract') {
        return { summary: { screens: 48, web: { operational: 48, readOnly: 0, contractOnly: 0 }, flutter: { operational: 48, readOnly: 0, contractOnly: 0 } }, items: [] };
      }
      if (path === '/inventory/master-data') return { products: [], customers: [], suppliers: [] };
      if (path === '/stock-opnames') return { warehouses: [], sessions: [] };
      return [];
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/inventory/stock']}>
          <InventoryControlPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText('Amoksisilin 500 mg')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('GDG-PUSAT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('KAPLET').length).toBeGreaterThan(0);
    expect(get).toHaveBeenCalledWith('/inventory/balances');
  });
});
