import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sales order cancellation contract', () => {
  const source = readFileSync(resolve(__dirname, 'tenant.module.ts'), 'utf8');

  it('exposes history and cancellation only through authenticated sales permissions', () => {
    expect(source).toContain("@Get('inventory/mobile-orders')");
    expect(source).toContain("@Permissions('SALES_ORDER.READ')");
    expect(source).toContain("@Post('inventory/mobile-orders/:id/cancel')");
    expect(source).toContain("@Permissions('SALES_ORDER.CREATE')");
  });

  it('limits cancellation to the current sales owner and an untouched confirmed order', () => {
    expect(source).toContain('AND COALESCE(so.salesperson_id, so.created_by) = (');
    expect(source).toContain("current.status !== 'CONFIRMED'");
    expect(source).toContain("new Decimal(delivery.rows[0]?.delivered_qty ?? 0).greaterThan(0)");
    expect(source).toContain("SET status = 'CANCELLED'");
    expect(source).toContain("actionCode: 'SALES_ORDER_CANCELLED'");
  });
});
