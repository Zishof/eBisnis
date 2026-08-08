import { ensureCurrentFiscalPeriods } from './default-fiscal-periods';

describe('periode fiskal bawaan', () => {
  it('menyemai dua belas bulan dengan kode stabil', async () => {
    const params: unknown[][] = [];
    const client = {
      query: jest.fn(async (_sql: string, values: unknown[]) => {
        params.push(values);
        return { rowCount: 1, rows: [{ inserted: true }] };
      }),
    };
    const result = await ensureCurrentFiscalPeriods(
      client as never,
      'demo',
      new Date('2026-08-08T00:00:00.000Z'),
    );
    expect(result).toEqual({ inserted: 12, existing: 0 });
    expect(params[0]).toEqual(['2026-01', 'Januari 2026', 2026, 1]);
    expect(params[11]).toEqual(['2026-12', 'Desember 2026', 2026, 12]);
  });
});
