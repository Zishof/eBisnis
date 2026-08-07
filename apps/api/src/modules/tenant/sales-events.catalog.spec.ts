import { AccountingEventCatalogRegistry } from '../accounting/event-catalog.registry';
import { SALES_ORDER_EVENT_CATALOG } from './sales-events.catalog';

describe('katalog peristiwa akuntansi pesanan penjualan', () => {
  it('setiap peristiwa berawalan sesuai dan punya nilai wajib', () => {
    for (const event of SALES_ORDER_EVENT_CATALOG.events) {
      expect(event.startsWith(SALES_ORDER_EVENT_CATALOG.prefix)).toBe(true);
      expect(SALES_ORDER_EVENT_CATALOG.requiredAmounts[event]?.length).toBeGreaterThan(0);
    }
  });

  it('terdaftar tanpa galat ke registri Core', () => {
    const registry = new AccountingEventCatalogRegistry();
    expect(() => registry.register(SALES_ORDER_EVENT_CATALOG)).not.toThrow();
    expect(registry.isKnownEvent('SALES_ORDER_INVOICED')).toBe(true);
    expect(registry.requiredAmountsOf('SALES_ORDER_INVOICED')).toEqual(['gross', 'net', 'tax']);
  });

  it('nama medan nilai sama dengan peristiwa kasir yang setara', () => {
    // Bukan kebetulan -- lihat komentar pada katalog. Operator yang sudah
    // menyemai aturan posting kasir dapat menyalinnya untuk pesanan
    // penjualan tanpa mempelajari kosakata baru.
    expect(SALES_ORDER_EVENT_CATALOG.requiredAmounts.SALES_ORDER_COGS).toEqual(['cost']);
    expect(SALES_ORDER_EVENT_CATALOG.requiredAmounts.SALES_ORDER_INVENTORY_RELEASE).toEqual(['inventoryValue']);
  });
});
