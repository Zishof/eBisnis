import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PartyAutocomplete } from './InventoryTransactionWorkspacePage';

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
