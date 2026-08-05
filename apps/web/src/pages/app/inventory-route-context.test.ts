import { describe, expect, it } from 'vitest';
import { inventoryRouteContext, inventoryTabRoutes } from './inventory-route-context';

describe('inventory 48-screen route context', () => {
  it('maps explicit routes to the correct operational workspace', () => {
    expect(inventoryRouteContext('/app/master/suppliers').tab).toBe('suppliers');
    expect(inventoryRouteContext('/app/inventory/stock-opnames').screenRange).toBe('09-10');
    expect(inventoryRouteContext('/app/sales/note-custody').tab).toBe('salesOrders');
    expect(inventoryRouteContext('/app/finance/profit-loss', '?panel=period-close').tab).toBe('periodClose');
  });

  it('keeps the compatibility route and provides one destination per tab', () => {
    expect(inventoryRouteContext('/app/inventory-control').screenRange).toBe('01-48');
    expect(new Set(Object.values(inventoryTabRoutes)).size).toBe(Object.keys(inventoryTabRoutes).length);
  });
});
