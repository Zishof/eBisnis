import { describe, expect, it } from 'vitest';
import { inventoryRouteContext, inventoryRouteForLegacyScreen, inventoryTabRoutes } from './inventory-route-context';

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

  it('maps every legacy screen 1-48 to an operational route', () => {
    const routes = Array.from({ length: 48 }, (_, index) => inventoryRouteForLegacyScreen(index + 1));
    expect(routes).toHaveLength(48);
    expect(routes.every((route) => route.startsWith('/app/'))).toBe(true);
    expect(routes).not.toContain('/app/inventory-control');
    expect(routes[0]).toBe('/app/master/suppliers');
    expect(routes[19]).toBe('/app/purchasing/invoices');
    expect(routes[29]).toBe('/app/sales/invoices');
    expect(routes[47]).toBe('/app/finance/profit-loss');
    expect(() => inventoryRouteForLegacyScreen(0)).toThrow(RangeError);
    expect(() => inventoryRouteForLegacyScreen(49)).toThrow(RangeError);
  });
});
