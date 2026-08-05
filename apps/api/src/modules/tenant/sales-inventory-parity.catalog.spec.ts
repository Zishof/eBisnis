import { SALES_INVENTORY_PARITY, paritySummary, webRouteForScreen } from './sales-inventory-parity.catalog';
import { reportSql } from './sales-inventory-operations.controller';

describe('sales inventory legacy parity contract', () => {
  it('keeps every one of the 48 documented screens in sequence', () => {
    expect(SALES_INVENTORY_PARITY).toHaveLength(48);
    expect(SALES_INVENTORY_PARITY.map((item) => item.screen)).toEqual(
      Array.from({ length: 48 }, (_, index) => index + 1),
    );
  });

  it('requires traceable API evidence for every surface', () => {
    for (const item of SALES_INVENTORY_PARITY) {
      expect(item.legacyName.trim()).not.toBe('');
      expect(item.api.length).toBeGreaterThan(0);
      expect(item.api.every((path) => path.startsWith('/'))).toBe(true);
      expect(item.webRoute).toBe(webRouteForScreen(item.screen));
      expect(item.webRoute).not.toBe('/app/inventory-control');
      expect(item.flutterModule).toBe('Inventory Control');
    }
  });

  it('maps every screen to its explicit operational route', () => {
    expect(webRouteForScreen(1)).toBe('/app/master/suppliers');
    expect(webRouteForScreen(20)).toBe('/app/purchasing/invoices');
    expect(webRouteForScreen(39)).toBe('/app/sales/note-custody');
    expect(webRouteForScreen(48)).toBe('/app/finance/profit-loss');
    expect(() => webRouteForScreen(49)).toThrow(RangeError);
  });

  it('reports surface totals without hiding read-only or contract-only gaps', () => {
    const summary = paritySummary();
    expect(summary.screens).toBe(48);
    expect(summary.web.operational + summary.web.readOnly + summary.web.contractOnly).toBe(48);
    expect(summary.flutter.operational + summary.flutter.readOnly + summary.flutter.contractOnly).toBe(48);
    expect(summary.flutter.operational).toBe(48);
    expect(summary.flutter.readOnly).toBe(0);
    expect(summary.flutter.contractOnly).toBe(0);
    expect(summary.web.operational).toBe(48);
    expect(summary.web.readOnly).toBe(0);
    expect(summary.web.contractOnly).toBe(0);
  });

  it('keeps finance reports tied to posted journals and correct normal balances', () => {
    const profitLoss = reportSql('profit-loss', '"tenant_test"');
    const grossProfit = reportSql('gross-profit', '"tenant_test"');

    expect(profitLoss?.sql).toContain("je.status = 'POSTED'");
    expect(profitLoss?.sql).toContain("coa.normal_balance = 'DEBIT'");
    expect(profitLoss?.totalKey).toBe('balance');
    expect(grossProfit?.sql).toContain('legacy_unit_cost');
    expect(grossProfit?.totalKey).toBe('gross_profit');
  });
});
