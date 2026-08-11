import { indexedDB as fakeIndexedDb } from 'fake-indexeddb';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createTransactionEventId,
  deleteInventoryDraft,
  loadInventoryDraft,
  resetInventoryDraftDatabaseForTest,
  saveInventoryDraft,
} from './inventory-transaction-draft';

beforeAll(() => {
  Object.defineProperty(globalThis, 'indexedDB', { value: fakeIndexedDb, configurable: true });
  resetInventoryDraftDatabaseForTest();
});

describe('draft transaksi inventory tahan-tutup', () => {
  it('menyimpan payload dan idempotency key yang sama sampai draft dihapus', async () => {
    const eventId = createTransactionEventId('sales');
    expect(eventId).toMatch(/^WEB_SALES_[0-9a-f-]{36}$/i);

    await saveInventoryDraft('sales', eventId, { customerId: 'customer-1', itemCount: 2 });
    await saveInventoryDraft('sales', eventId, { customerId: 'customer-1', itemCount: 3 });

    const restored = await loadInventoryDraft<{ customerId: string; itemCount: number }>('sales');
    expect(restored?.eventId).toBe(eventId);
    expect(restored?.payload).toEqual({ customerId: 'customer-1', itemCount: 3 });
    expect(restored?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await deleteInventoryDraft('sales');
    expect(await loadInventoryDraft('sales')).toBeNull();
  });

  it('memisahkan draft penjualan dan pembelian', async () => {
    await saveInventoryDraft('sales', createTransactionEventId('sales'), { kind: 'sales' });
    await saveInventoryDraft('purchase', createTransactionEventId('purchase'), { kind: 'purchase' });

    expect((await loadInventoryDraft<{ kind: string }>('sales'))?.payload.kind).toBe('sales');
    expect((await loadInventoryDraft<{ kind: string }>('purchase'))?.payload.kind).toBe('purchase');
  });
});
