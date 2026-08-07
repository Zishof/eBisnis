import { AccountingEventCatalogRegistry } from '../accounting/event-catalog.registry';
import { PURCHASE_EVENT_CATALOG } from './purchasing-events.catalog';

describe('katalog peristiwa akuntansi pembelian', () => {
  it('setiap peristiwa berawalan sesuai dan punya nilai wajib', () => {
    for (const event of PURCHASE_EVENT_CATALOG.events) {
      expect(event.startsWith(PURCHASE_EVENT_CATALOG.prefix)).toBe(true);
      expect(PURCHASE_EVENT_CATALOG.requiredAmounts[event]?.length).toBeGreaterThan(0);
    }
  });

  it('terdaftar tanpa galat ke registri Core', () => {
    const registry = new AccountingEventCatalogRegistry();
    expect(() => registry.register(PURCHASE_EVENT_CATALOG)).not.toThrow();
    expect(registry.isKnownEvent('PURCHASE_GOODS_RECEIPT_VALUED')).toBe(true);
    expect(registry.requiredAmountsOf('PURCHASE_GOODS_RECEIPT_VALUED')).toEqual(['inventoryValue']);
  });

  it('pendaftaran ganda ditolak, bukan menimpa diam-diam', () => {
    const registry = new AccountingEventCatalogRegistry();
    registry.register(PURCHASE_EVENT_CATALOG);
    expect(() => registry.register(PURCHASE_EVENT_CATALOG)).toThrow();
  });
});
