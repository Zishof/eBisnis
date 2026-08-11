import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sales inventory command migration contract', () => {
  const migrationRoot = resolve(process.cwd(), 'tenant-migrations');

  it('keeps the tenant manifest valid JSON without a BOM', () => {
    const raw = readFileSync(resolve(migrationRoot, 'manifest.json'), 'utf8');

    expect(raw.charCodeAt(0)).not.toBe(0xfeff);
    const manifest = JSON.parse(raw) as { migrations: Array<{ version: string; sequence: number; file: string }> };
    const commandParity = manifest.migrations.find((entry) => entry.version === 'V048');

    expect(commandParity).toEqual(expect.objectContaining({
      sequence: 48,
      file: 'V048__sales_inventory_command_parity.sql',
    }));
  });

  it('adds only command, approval, close-run, and synchronization structures', () => {
    const sql = readFileSync(resolve(migrationRoot, 'V048__sales_inventory_command_parity.sql'), 'utf8');

    expect(sql).toContain('ALTER TABLE "{{TENANT_SCHEMA}}".price_book');
    expect(sql).toContain('inventory_period_close_run');
    expect(sql).toContain('inventory_sync_event');
    expect(sql).toContain('inventory_mobile_command');
    expect(sql).toContain('ux_inventory_mobile_command_event');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".product');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".sales_order');
  });

  it('registers pricing, custody, report, and supplier-invoice migrations in sequence', () => {
    const raw = readFileSync(resolve(migrationRoot, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw) as { migrations: Array<{ version: string; sequence: number; file: string }> };
    expect(manifest.migrations.filter((entry) => ['V064', 'V065', 'V066', 'V067', 'V068'].includes(entry.version)))
      .toEqual([
        expect.objectContaining({ version: 'V064', sequence: 64, file: 'V064__inventory_report_governance.sql' }),
        expect.objectContaining({ version: 'V065', sequence: 65, file: 'V065__sales_note_full_custody_lifecycle.sql' }),
        expect.objectContaining({ version: 'V066', sequence: 66, file: 'V066__sales_order_pricing_cost_attribution.sql' }),
        expect.objectContaining({ version: 'V067', sequence: 67, file: 'V067__purchase_supplier_pricing_two_discounts.sql' }),
        expect.objectContaining({ version: 'V068', sequence: 68, file: 'V068__supplier_invoice_goods_receipt_link.sql' }),
      ]);
  });

  it('preserves server-authoritative prices, sequential purchase discounts, FEFO, and credit control', () => {
    const tenantModule = readFileSync(resolve(process.cwd(), 'src/modules/tenant/tenant.module.ts'), 'utf8');
    const purchasing = readFileSync(resolve(process.cwd(), 'src/modules/tenant/erp-purchasing.service.ts'), 'utf8');

    expect(tenantModule).toContain("selected.scope_type === 'CUSTOMER' ? 'CUSTOMER_PRICE_BOOK'");
    expect(tenantModule).toContain('outstandingAmount + grandTotal > creditLimit');
    expect(tenantModule).toContain("ORDER BY lot.expiry_date ASC NULLS LAST");
    expect(tenantModule).toContain("lot.quality_status = 'GOOD'");
    expect(tenantModule).toContain('so.salesperson_id ?? so.created_by');
    expect(purchasing).toContain('afterFirstDiscount');
    expect(purchasing).toContain('new Decimal(100).minus(discountPercent2)');
    expect(purchasing).toContain("'SUPPLIER_PRICE_BOOK'");
    expect(purchasing).toContain('outboundCost: Number(movement.unit_cost)');
    expect(purchasing).toContain('Penerimaan tidak dapat direversal karena sebagian stok sudah dipakai atau berpindah.');
  });

  it('links a posted goods receipt to one approved supplier invoice and payable', () => {
    const tenantModule = readFileSync(resolve(process.cwd(), 'src/modules/tenant/tenant.module.ts'), 'utf8');
    const migration = readFileSync(resolve(migrationRoot, 'V068__supplier_invoice_goods_receipt_link.sql'), 'utf8');

    expect(tenantModule).toContain("@Post('goods-receipts/:id/supplier-invoice')");
    expect(tenantModule).toContain('supplier_invoice_id = $5::uuid');
    expect(migration).toContain('goods_receipt_id');
    expect(migration).toContain('ux_supplier_invoice_goods_receipt');
  });
});
