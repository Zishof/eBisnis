import { MasterSeedVerifyReport } from '../modules/master-seed/master-seed.types';

export interface ParsedArgs {
  flags: Set<string>;
  options: Record<string, string>;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Set<string>();
  const options: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const name = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        options[name] = next;
        i += 1;
      } else {
        flags.add(name);
      }
    } else {
      positional.push(token);
    }
  }
  return { flags, options, positional };
}

const STATUS_LABEL: Record<string, string> = {
  OK: 'OK',
  INSUFFICIENT: 'KURANG',
  EXEMPT: 'DIKECUALIKAN',
  MISSING_TABLE: 'TABEL HILANG',
};

export function printReport(report: MasterSeedVerifyReport): void {
  const header = `LAPORAN VERIFIKASI SEED — ${report.scope.toUpperCase()} "${report.schemaName}"`;
  process.stdout.write(`\n${header}\n${'='.repeat(header.length)}\n`);
  process.stdout.write(
    `${'resourceCode'.padEnd(28)}${'min'.padStart(5)}${'aktif'.padStart(7)}${'contoh'.padStart(8)}  status\n`,
  );
  process.stdout.write(`${'-'.repeat(64)}\n`);

  for (const row of report.rows) {
    const line =
      row.resourceCode.padEnd(28) +
      String(row.requiredMinimum).padStart(5) +
      String(row.activeCount).padStart(7) +
      String(row.sampleCount).padStart(8) +
      `  ${STATUS_LABEL[row.status] ?? row.status}`;
    process.stdout.write(`${line}\n`);
    if (row.missingCodes.length) {
      process.stdout.write(
        `${' '.repeat(30)}kode belum ada: ${row.missingCodes.slice(0, 8).join(', ')}${
          row.missingCodes.length > 8 ? `, … (+${row.missingCodes.length - 8})` : ''
        }\n`,
      );
    }
  }

  process.stdout.write(
    `\nTotal resource: ${report.totalResources} | gagal: ${report.failingResources} | status: ${
      report.passed ? 'LULUS' : 'GAGAL'
    }\n`,
  );
}
