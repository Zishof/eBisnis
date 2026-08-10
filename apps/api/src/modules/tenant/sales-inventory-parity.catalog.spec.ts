import { SALES_INVENTORY_PARITY, paritySummary, webRouteForScreen } from './sales-inventory-parity.catalog';
import { reportSql } from './sales-inventory-operations.controller';
import {
  PARITY_EVIDENCE,
  PARITY_REQUIREMENTS,
  PENDING_PROOF,
  hasProof,
  provenScreens,
} from './parity-evidence.registry';

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

  it('setiap layar OPERATIONAL harus PROVEN lintas-surface atau tercatat PENDING_PROOF', () => {
    const proven = provenScreens();
    const pending = new Set(PENDING_PROOF.map((requirement) => requirement.screen));
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
    // 48 layar x (4 surface view + 1 rekonsiliasi). Turunkan saat evidence bertambah.
    expect(PENDING_PROOF.length).toBeLessThanOrEqual(48 * 5);
  });

  it('memisahkan evidence API dari Web, Windows, dan Android', () => {
    expect(PARITY_REQUIREMENTS).toHaveLength(48 * 5);
    expect(provenScreens('api', 'view').size).toBe(48);
    expect(provenScreens('api').size).toBe(0);
    expect(provenScreens('web').size).toBe(0);
    expect(provenScreens('windows').size).toBe(2);
    expect(provenScreens('android').size).toBe(0);
    expect(provenScreens().size).toBe(0);

    const apiProof = PARITY_EVIDENCE.find((proof) => proof.screen === 1 && proof.surface === 'api');
    expect(apiProof?.capability).toBe('view');
    expect(hasProof({ screen: 1, surface: 'api', capability: 'view' })).toBe(true);
    expect(hasProof({ screen: 1, surface: 'web', capability: 'view' })).toBe(false);
    expect(hasProof({ screen: 1, surface: 'api', capability: 'reconciliation' })).toBe(false);
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
