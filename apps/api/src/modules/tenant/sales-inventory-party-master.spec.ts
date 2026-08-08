import { partyMasterBalanceSql } from './sales-inventory-operations.controller';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  it('blocks a deactivated salesperson before accepting a new mobile order', () => {
    const source = readFileSync(join(__dirname, 'tenant.module.ts'), 'utf8');
    const idempotentRetry = source.indexOf('if (existing.rowCount)');
    const activeProfileCheck = source.indexOf('FROM ${S}.inventory_salesperson_profile', idempotentRetry);
    const customerCheck = source.indexOf('Customer tidak ditemukan atau tidak aktif.', activeProfileCheck);

    expect(idempotentRetry).toBeGreaterThan(-1);
    expect(activeProfileCheck).toBeGreaterThan(idempotentRetry);
    expect(customerCheck).toBeGreaterThan(activeProfileCheck);
    expect(source).toContain('Profil sales tidak aktif; order baru tidak dapat dikirim.');
  });
});
