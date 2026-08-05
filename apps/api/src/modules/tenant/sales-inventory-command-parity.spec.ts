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
});
