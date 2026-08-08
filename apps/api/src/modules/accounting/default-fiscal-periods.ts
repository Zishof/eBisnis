import type { PoolClient } from 'pg';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/** Menjamin dua belas periode bulanan tahun berjalan tersedia dan terbuka. */
export async function ensureCurrentFiscalPeriods(
  client: PoolClient,
  schemaName: string,
  now = new Date(),
): Promise<{ inserted: number; existing: number }> {
  const year = now.getUTCFullYear();
  let inserted = 0;
  let existing = 0;
  for (let month = 1; month <= 12; month += 1) {
    const code = `${year}-${String(month).padStart(2, '0')}`;
    const result = await client.query<{ inserted: boolean }>(
      `INSERT INTO "${schemaName}".fiscal_period
         (code, name, fiscal_year, period_no, start_date, end_date,
          status, is_active, is_system, is_sample, sort_order)
       VALUES ($1, $2, $3, $4,
               make_date($3, $4, 1),
               (make_date($3, $4, 1) + interval '1 month - 1 day')::date,
               'OPEN', TRUE, TRUE, FALSE, $4)
       ON CONFLICT (code) WHERE deleted_at IS NULL DO NOTHING
       RETURNING TRUE AS inserted`,
      [code, `${MONTH_NAMES[month - 1]} ${year}`, year, month],
    );
    if (result.rowCount) inserted += 1;
    else existing += 1;
  }
  return { inserted, existing };
}
