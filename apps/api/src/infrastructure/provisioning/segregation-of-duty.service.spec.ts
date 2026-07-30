import { ForbiddenException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { SegregationOfDutyService } from './segregation-of-duty.service';

interface Row {
  rule_id: string;
  rule_code: string;
  rule_name: string;
  severity: string;
  enforcement: string;
  existing_role_id: string;
  existing_role_code: string;
  existing_role_name: string;
  existing_side: string;
  attempted_side: string;
  exception_id: string | null;
}

const row = (over: Partial<Row> = {}): Row => ({
  rule_id: 'rule-1',
  rule_code: 'JOURNAL',
  rule_name: 'Penyiap jurnal bukan penyetujunya',
  severity: 'CRITICAL',
  enforcement: 'BLOCK',
  existing_role_id: 'role-existing',
  existing_role_code: 'AKUNTAN_BUKU_BESAR',
  existing_role_name: 'Akuntan Buku Besar',
  existing_side: 'PREPARER',
  attempted_side: 'APPROVER',
  exception_id: null,
  ...over,
});

/** Klien palsu: SELECT mengembalikan konflik yang disiapkan, INSERT dicatat. */
function fakeClient(conflicts: Row[]) {
  const inserts: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (/^\s*INSERT/i.test(sql)) {
        inserts.push({ sql, params });
        return { rows: [], rowCount: 1 };
      }
      return { rows: conflicts, rowCount: conflicts.length };
    }),
  } as unknown as PoolClient;
  return { client, inserts };
}

describe('SegregationOfDutyService', () => {
  const service = new SegregationOfDutyService();
  const SCHEMA = '"tokosaya"';

  it('meloloskan penetapan yang tidak berkonflik', async () => {
    const { client } = fakeClient([]);
    const result = await service.check(client, SCHEMA, 'user-1', 'role-baru');
    expect(result).toEqual({ allowed: true, conflicts: [], waived: [] });
  });

  it('menolak ketika pengguna sudah memegang sisi berlawanan', async () => {
    const { client } = fakeClient([row()]);
    const result = await service.check(client, SCHEMA, 'user-1', 'role-baru');
    expect(result.allowed).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].existingRoleCode).toBe('AKUNTAN_BUKU_BESAR');
    expect(result.waived).toHaveLength(0);
  });

  it('meloloskan konflik yang punya pengecualian tertulis yang masih berlaku', async () => {
    const { client } = fakeClient([row({ exception_id: 'exc-1' })]);
    const result = await service.check(client, SCHEMA, 'user-1', 'role-baru');
    expect(result.allowed).toBe(true);
    expect(result.waived).toHaveLength(1);
  });

  it('meneruskan aturan bertanda WARN tetapi tetap menganggapnya pelanggaran', async () => {
    const { client } = fakeClient([row({ enforcement: 'WARN' })]);
    const result = await service.check(client, SCHEMA, 'user-1', 'role-baru');
    expect(result.allowed).toBe(true);
    expect(result.waived).toHaveLength(1);
  });

  it('memisahkan konflik yang ditolak dari yang diloloskan dalam satu penetapan', async () => {
    const { client } = fakeClient([
      row({ rule_id: 'r1', rule_code: 'JOURNAL' }),
      row({ rule_id: 'r2', rule_code: 'PAYROLL', exception_id: 'exc-2' }),
    ]);
    const result = await service.check(client, SCHEMA, 'user-1', 'role-baru');
    expect(result.allowed).toBe(false);
    expect(result.conflicts.map((c) => c.ruleCode)).toEqual(['JOURNAL']);
    expect(result.waived.map((c) => c.ruleCode)).toEqual(['PAYROLL']);
  });

  it('mencatat pelanggaran yang ditolak maupun yang diloloskan', async () => {
    const { client, inserts } = fakeClient([
      row({ rule_id: 'r1' }),
      row({ rule_id: 'r2', exception_id: 'exc-2' }),
      row({ rule_id: 'r3', enforcement: 'WARN' }),
    ]);
    await expect(
      service.enforce(client, SCHEMA, 'user-1', 'role-baru', { actorId: 'admin-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(inserts).toHaveLength(3);
    const outcomes = inserts.map((i) => i.params[4]);
    expect(outcomes).toEqual(['BLOCKED', 'ALLOWED_BY_EXCEPTION', 'WARNED']);
    // Pelaku pencatat ikut tersimpan agar jejaknya dapat ditelusuri.
    expect(inserts[0].params[5]).toBe('admin-1');
  });

  it('menyebut role yang bertabrakan pada pesan penolakan', async () => {
    const { client } = fakeClient([row()]);
    await expect(service.enforce(client, SCHEMA, 'user-1', 'role-baru')).rejects.toThrow(
      /Akuntan Buku Besar/,
    );
  });

  it('tidak melempar ketika seluruh konflik punya pengecualian', async () => {
    const { client, inserts } = fakeClient([row({ exception_id: 'exc-1' })]);
    const result = await service.enforce(client, SCHEMA, 'user-1', 'role-baru');
    expect(result.allowed).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].params[4]).toBe('ALLOWED_BY_EXCEPTION');
  });

  it('membatasi pemeriksaan pada pengguna dan role yang diminta', async () => {
    const { client } = fakeClient([]);
    await service.check(client, SCHEMA, 'user-42', 'role-99');
    const [, params] = (client.query as jest.Mock).mock.calls[0];
    expect(params).toEqual(['user-42', 'role-99']);
  });
});
