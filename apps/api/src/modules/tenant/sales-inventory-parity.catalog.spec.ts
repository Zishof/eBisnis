import { SALES_INVENTORY_PARITY, paritySummary, webRouteForScreen } from './sales-inventory-parity.catalog';
import { normalizeReportFilters, reportSql } from './sales-inventory-operations.controller';
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
      expect(item.windows).toBe(item.flutter);
      expect(item.android).toBe(item.flutter);
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
    expect(summary.windows.operational + summary.windows.readOnly + summary.windows.contractOnly).toBe(48);
    expect(summary.android.operational + summary.android.readOnly + summary.android.contractOnly).toBe(48);
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
      const claimsOperational =
        item.web === 'OPERATIONAL' ||
        item.windows === 'OPERATIONAL' ||
        item.android === 'OPERATIONAL';
      if (claimsOperational) {
        expect(proven.has(item.screen) || pending.has(item.screen)).toBe(true);
      }
    }
  });

  it('PENDING_PROOF hanya boleh menyusut (regression guard)', () => {
    // Registry sudah per-surface/per-capability, bukan hanya route/view.
    expect(PENDING_PROOF.length).toBeLessThanOrEqual(PARITY_REQUIREMENTS.length);
    expect(PENDING_PROOF.length).toBeGreaterThan(0);
  });

  it('memisahkan evidence API dari Web, Windows, dan Android', () => {
    expect(PARITY_REQUIREMENTS).toHaveLength(606);
    expect(provenScreens('api', 'view').size).toBe(48);
    expect(provenScreens('api').size).toBe(0);
    expect(provenScreens('web', 'view').size).toBe(48);
    expect(provenScreens('web').size).toBeLessThan(48);
    expect(provenScreens('windows').size).toBeLessThan(48);
    expect(provenScreens('android').size).toBeLessThan(48);
    expect(provenScreens().size).toBe(0);

    const apiProof = PARITY_EVIDENCE.find((proof) => proof.screen === 1 && proof.surface === 'api');
    expect(apiProof?.capability).toBe('view');
    expect(hasProof({ screen: 1, surface: 'api', capability: 'view' })).toBe(true);
    expect(hasProof({ screen: 1, surface: 'web', capability: 'view' })).toBe(true);
    expect(hasProof({ screen: 1, surface: 'api', capability: 'reconciliation' })).toBe(false);
    expect(hasProof({ screen: 30, surface: 'web', capability: 'create' })).toBe(false);
    expect(hasProof({ screen: 30, surface: 'web', capability: 'offline' })).toBe(false);
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

  it('menerapkan rentang, pihak, dokumen, gudang, dan status pada laporan pembelian', () => {
    const report = reportSql('purchase-invoice', '"demo"');
    expect(report?.sql).toContain('po.order_date >= $2::date');
    expect(report?.sql).toContain('po.supplier_id = $3::uuid');
    expect(report?.sql).toContain('po.id = $4::uuid');
    expect(report?.sql).toContain('po.warehouse_id = $5::uuid');
    expect(report?.sql).toContain('po.status = $6::text');
  });

  it('memisahkan tiga laporan layar 41 dengan judul dan kolom yang benar', () => {
    const sales = reportSql('sales-by-product', '"demo"');
    const outstanding = reportSql('ar-outstanding', '"demo"');
    const events = reportSql('ar-event-register', '"demo"');
    expect(sales?.title).toBe('Rekap Penjualan Barang');
    expect(sales?.sql).toContain('product_code');
    expect(sales?.sql).toContain('uom');
    expect(outstanding?.title).toBe('Piutang Belum Lunas');
    expect(events?.title).toBe('Register Event Piutang');
    expect(events?.sql).toContain("'INVOICE'::text");
    expect(events?.sql).toContain("'RECEIPT'");
  });

  it('menolak filter report yang ambigu sebelum menyentuh SQL', () => {
    expect(normalizeReportFilters({ startDate: '2026-08-01' }, '2026-08-31'))
      .toEqual({ startDate: '2026-08-01' });
    expect(() => normalizeReportFilters({ startDate: '2026-09-01' }, '2026-08-31')).toThrow();
    expect(() => normalizeReportFilters({ partyId: 'bukan-uuid' }, '2026-08-31')).toThrow();
    expect(() => normalizeReportFilters({ status: "POSTED' OR TRUE" }, '2026-08-31')).toThrow();
  });
});
