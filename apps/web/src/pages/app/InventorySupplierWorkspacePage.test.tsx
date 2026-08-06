import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import { InventorySupplierWorkspacePage } from './InventorySupplierWorkspacePage';

const workspace = {
  summary: {
    total: 1,
    active: 1,
    inactive: 0,
    withPayables: 1,
    outstanding: '2500000',
    purchasesMonth: '4500000',
    paymentsMonth: '2000000',
  },
  suppliers: [{
    id: 'supplier-1',
    code: 'SUP-001',
    name: 'PT Sumber Makmur Abadi',
    contact_person: 'Andi Wijaya',
    phone: '081234567890',
    email: 'andi@example.test',
    legacy_payment_days: 30,
    region_name: 'Jakarta',
    is_active: true,
    payable_balance: '2500000',
    payable_document_count: 2,
    purchase_count: 4,
    purchase_ytd: '4500000',
    last_purchase: '2026-08-05',
    payment_ytd: '2000000',
  }],
  purchases: [{
    id: 'purchase-1',
    supplier_id: 'supplier-1',
    purchase_order_number: 'PO-001',
    order_date: '2026-08-05',
    warehouse_name: 'Gudang Pusat',
    status: 'POSTED',
    discount_total: '0',
    tax_total: '0',
    grand_total: '4500000',
  }],
  payables: [{
    id: 'payable-1',
    supplier_id: 'supplier-1',
    legacy_invoice_number: 'INV-001',
    transaction_date: '2026-08-05',
    due_date: '2026-09-04',
    original_amount: '4500000',
    outstanding_amount: '2500000',
    aging_bucket: 'BELUM_JATUH_TEMPO',
  }],
  payments: [{
    id: 'payment-1',
    supplier_id: 'supplier-1',
    payment_number: 'PAY-001',
    payment_date: '2026-08-06',
    method: 'TRANSFER',
    status: 'POSTED',
    total_amount: '2000000',
  }],
  topProducts: [{
    supplier_id: 'supplier-1',
    product_code: 'PRD-001',
    product_name: 'Produk A',
    uom: 'PCS',
    total_qty: '20',
    total_value: '4500000',
  }],
};

afterEach(() => vi.restoreAllMocks());

describe('InventorySupplierWorkspacePage', () => {
  it('menyediakan lima alur supplier dengan data operasional', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(workspace);
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InventorySupplierWorkspacePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText('PT Sumber Makmur Abadi')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rp 4.500.000').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Buka PT Sumber Makmur Abadi' }));
    expect(screen.getByText('Informasi supplier')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Riwayat Pembelian/ }));
    expect(screen.getByText('PO-001')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ledger & Hutang/ }));
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('PAY-001')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Analisis Kinerja/ }));
    expect(screen.getByText('Top supplier berdasarkan pembelian YTD')).toBeInTheDocument();
  });
});
