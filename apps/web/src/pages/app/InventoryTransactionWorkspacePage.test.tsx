import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { InventoryTransactionWorkspacePage, PartyAutocomplete } from './InventoryTransactionWorkspacePage';

const parties = [
  { id: 'supplier-1', code: 'SUP-001', name: 'Sumber Makmur' },
  { id: 'supplier-2', code: 'SUP-002', name: 'Mitra Sejahtera' },
];

describe('PartyAutocomplete', () => {
  it('mencari supplier berdasarkan nama dan memilih id yang benar', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PartyAutocomplete parties={parties} value="supplier-1" onChange={onChange} label="Cari supplier" />);

    const input = screen.getByRole('combobox', { name: 'Cari supplier' });
    expect(input).toHaveValue('SUP-001 - Sumber Makmur');

    await user.clear(input);
    await user.type(input, 'mitra');
    expect(screen.queryByRole('option', { name: /Sumber Makmur/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Mitra Sejahtera/ }));

    expect(onChange).toHaveBeenCalledWith('supplier-2');
    expect(input).toHaveValue('SUP-002 - Mitra Sejahtera');
  });

  it('dapat memilih hasil pertama dengan Enter dan melaporkan hasil kosong', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PartyAutocomplete parties={parties} value="" onChange={onChange} label="Cari customer" />);

    const input = screen.getByRole('combobox', { name: 'Cari customer' });
    await user.type(input, 'SUP-002{Enter}');
    expect(onChange).toHaveBeenCalledWith('supplier-2');

    await user.clear(input);
    await user.type(input, 'tidak ada');
    expect(screen.getByText('Pihak transaksi tidak ditemukan.')).toBeInTheDocument();
  });
});

describe('InventoryTransactionWorkspacePage pembelian', () => {
  it('memposting PO, penerimaan, stok, faktur supplier, dan hutang sebagai satu alur UI', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(api, 'get').mockImplementation(async (path) => {
      if (path === '/inventory/mobile-catalog') return {
        customers: [],
        products: [{
          id: '11111111-1111-4111-8111-111111111111', code: 'PRD-1', name: 'Produk Uji',
          uom_id: '22222222-2222-4222-8222-222222222222', price: '10000', available_qty: '10',
        }],
      } as never;
      if (path === '/inventory/master-data') return {
        suppliers: [{ id: '33333333-3333-4333-8333-333333333333', code: 'SUP-1', name: 'Supplier Uji' }],
      } as never;
      if (path === '/stock-opnames') return {
        warehouses: [{ id: '44444444-4444-4444-8444-444444444444', code: 'GDG', name: 'Gudang' }],
      } as never;
      throw new Error(`GET tidak diduga: ${path}`);
    });
    const post = vi.spyOn(api, 'post').mockImplementation(async (path) => {
      if (path === '/purchase-orders') return {
        id: '55555555-5555-4555-8555-555555555555', purchase_order_number: 'PO-1', status: 'DRAFT',
        lines: [{ id: '66666666-6666-4666-8666-666666666666', product_id: '11111111-1111-4111-8111-111111111111', ordered_qty: '1' }],
      } as never;
      if (path.endsWith('/submit')) return { id: '55555555-5555-4555-8555-555555555555', purchase_order_number: 'PO-1', status: 'WAITING_APPROVAL', lines: [{ id: '66666666-6666-4666-8666-666666666666', product_id: '11111111-1111-4111-8111-111111111111', ordered_qty: '1' }] } as never;
      if (path.endsWith('/approve')) return { id: '55555555-5555-4555-8555-555555555555', purchase_order_number: 'PO-1', status: 'APPROVED', lines: [{ id: '66666666-6666-4666-8666-666666666666', product_id: '11111111-1111-4111-8111-111111111111', ordered_qty: '1' }] } as never;
      if (path.endsWith('/send')) return { id: '55555555-5555-4555-8555-555555555555', purchase_order_number: 'PO-1', status: 'SENT', lines: [{ id: '66666666-6666-4666-8666-666666666666', product_id: '11111111-1111-4111-8111-111111111111', ordered_qty: '1' }] } as never;
      if (path === '/goods-receipts') return { id: '77777777-7777-4777-8777-777777777777', receipt_number: 'GR-1', status: 'DRAFT', lines: [{ id: '88888888-8888-4888-8888-888888888888', purchase_order_line_id: '66666666-6666-4666-8666-666666666666', received_qty: '1' }] } as never;
      if (path.endsWith('/inspect')) return { id: '77777777-7777-4777-8777-777777777777', receipt_number: 'GR-1', status: 'INSPECTED', lines: [{ id: '88888888-8888-4888-8888-888888888888', purchase_order_line_id: '66666666-6666-4666-8666-666666666666', received_qty: '1' }] } as never;
      if (path.endsWith('/validate')) return { id: '77777777-7777-4777-8777-777777777777', receipt_number: 'GR-1', status: 'STOCK_POSTED', lines: [] } as never;
      if (path.endsWith('/supplier-invoice')) return { id: 'invoice-1', payableLinked: true } as never;
      throw new Error(`POST tidak diduga: ${path}`);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}>
      <InventoryTransactionWorkspacePage mode="purchase" />
    </QueryClientProvider>);

    await screen.findByText('Produk Uji');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Cari supplier' })).toHaveValue('SUP-1 - Supplier Uji'));
    await waitFor(() => expect(screen.getAllByRole('combobox').some((element) => (element as HTMLSelectElement).value === '44444444-4444-4444-8444-444444444444')).toBe(true));
    await user.type(screen.getByPlaceholderText('Masukkan nomor faktur'), 'INV-SUP-1');
    await user.click(screen.getByTitle('Tambah item'));
    await user.click(screen.getAllByRole('button', { name: /Simpan Pembelian/ })[0]);

    await waitFor(() => expect(post.mock.calls.map(([path]) => path)).toContain(
      '/goods-receipts/77777777-7777-4777-8777-777777777777/supplier-invoice',
    ));
    expect(post.mock.calls.map(([path]) => path)).toEqual(expect.arrayContaining([
      '/purchase-orders',
      '/purchase-orders/55555555-5555-4555-8555-555555555555/submit',
      '/purchase-orders/55555555-5555-4555-8555-555555555555/approve',
      '/purchase-orders/55555555-5555-4555-8555-555555555555/send',
      '/goods-receipts',
      '/goods-receipts/77777777-7777-4777-8777-777777777777/inspect',
      '/goods-receipts/77777777-7777-4777-8777-777777777777/validate',
      '/goods-receipts/77777777-7777-4777-8777-777777777777/supplier-invoice',
    ]));
    get.mockRestore();
    post.mockRestore();
  });
});
