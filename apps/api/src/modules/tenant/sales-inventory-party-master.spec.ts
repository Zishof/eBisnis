import { partyMasterBalanceSql } from './sales-inventory-operations.controller';

describe('sales inventory party master balance queries', () => {
  const schema = '"tenant_test"';

  it.each([
    ['suppliers', 'legacy_payable_ledger'],
    ['customers', 'legacy_receivable_ledger'],
    ['salespeople', 'inventory_salesperson_profile'],
  ])('builds a tenant-scoped query for %s', (kind, expectedTable) => {
    const sql = partyMasterBalanceSql(kind, schema);
    expect(sql).toContain(schema);
    expect(sql).toContain(expectedTable);
    expect(sql).toContain('balance');
  });

  it('rejects an unknown party kind before it can become a SQL identifier', () => {
    expect(partyMasterBalanceSql('suppliers; DROP SCHEMA public', schema)).toBeNull();
  });
});
