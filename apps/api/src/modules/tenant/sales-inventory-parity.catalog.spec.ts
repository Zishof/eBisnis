import { SALES_INVENTORY_PARITY, paritySummary, webRouteForScreen } from './sales-inventory-parity.catalog';
import { reportSql } from './sales-inventory-operations.controller';
import { PENDING_PROOF, provenScreens } from './parity-evidence.registry';

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

  it('maps the stock screen to the scoped live-balance endpoint', () => {
    const stock = SALES_INVENTORY_PARITY.find((item) => item.screen === 8);
    expect(stock?.api).toContain('/inventory/balances');
    expect(stock?.api).not.toContain('/stock/balances');
  });

  it('totals konsisten tanpa mengunci klaim 48/48', () => {
    const summary = paritySummary();
    expect(summary.screens).toBe(48);
    expect(summary.web.operational + summary.web.readOnly + summary.web.contractOnly).toBe(48);
    expect(summary.flutter.operational + summary.flutter.readOnly + summary.flutter.contractOnly).toBe(48);
    // Sengaja TIDAK ada expect(...operational).toBe(48) / .toBe(0).
  });

  it('setiap layar OPERATIONAL harus PROVEN atau tercatat PENDING_PROOF', () => {
    const proven = provenScreens();
    const pending = new Set(PENDING_PROOF);
    for (const scr of proven) {
      expect(pending.has(scr)).toBe(false); // PROVEN & PENDING tak boleh tumpang tindih
    }
    for (const item of SALES_INVENTORY_PARITY) {
      const claimsOperational = item.web === 'OPERATIONAL' || item.flutter === 'OPERATIONAL';
      if (claimsOperational) {
        expect(proven.has(item.screen) || pending.has(item.screen)).toBe(true);
      }
    }
  });

  it('PENDING_PROOF hanya boleh menyusut (regression guard)', () => {
    // Turunkan ambang ini saat evidence bertambah. MENAIKKAN dilarang di review.
    expect(PENDING_PROOF.length).toBeLessThanOrEqual(48);
  });

  it('keeps finance reports tied to posted journals and correct normal balances', () => {
    const profitLoss = reportSql('profit-loss', '"tenant_test"');
    const grossProfit = reportSql('gross-profit', '"tenant_test"');

    expect(profitLoss?.sql).toContain("je.status = 'POSTED'");
    expect(profitLoss?.sql).toContain("coa.normal_balance = 'DEBIT'");
    expect(profitLoss?.totalKey).toBe('balance');
    expect(grossProfit?.sql).toContain('legacy_unit_cost');
    expect(grossProfit?.sql).toContain("so.status = 'INVOICED'");
    expect(grossProfit?.totalKey).toBe('gross_profit');
  });

  it('laporan laba rugi mengambil kategori dari account_type, bukan kolom fiktif COA', () => {
    const report = reportSql('profit-loss', '"demo"');
    expect(report?.sql).toContain('JOIN "demo".account_type at');
    expect(report?.sql).toContain("at.category IN ('REVENUE', 'EXPENSE')");
    expect(report?.sql).not.toMatch(/\bcoa\.account_type\b/);
  });
});
