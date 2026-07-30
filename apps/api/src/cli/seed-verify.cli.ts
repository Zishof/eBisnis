/**
 * pnpm seed:verify [--schema <tenant>] [--platform] [--json]
 *
 * Menghasilkan laporan verifikasi seed:
 *   resourceCode | requiredMinimum | activeCount | sampleCount | status | missingCodes
 *
 * Exit code 1 bila ada master wajib yang memiliki kurang dari minimum record aktif.
 */
import 'dotenv/config';
import { createSeedContext } from './seed-runner';
import { MasterSeedVerifyReport } from '../modules/master-seed/master-seed.types';
import { parseArgs, printReport } from './cli-utils';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ctx = await createSeedContext();
  const reports: MasterSeedVerifyReport[] = [];

  try {
    const wantPlatform = args.flags.has('platform') || !args.options.schema;
    if (wantPlatform) {
      reports.push(await ctx.platformSeed.verify());
    }

    const schemas: string[] = [];
    if (args.options.schema) {
      schemas.push(args.options.schema);
    } else if (args.flags.has('all-tenants')) {
      const registries = await ctx.prisma.tenantSchemaRegistry.findMany({
        where: { status: 'READY' },
        select: { schemaName: true },
      });
      schemas.push(...registries.map((r) => r.schemaName));
    } else {
      const demo = ctx.config.get<string>('schema.demo', 'demo');
      if (await ctx.tenantDb.schemaExists(demo)) schemas.push(demo);
    }

    for (const schemaName of schemas) {
      reports.push(await ctx.masterSeed.verifyTenant(schemaName));
    }

    if (args.flags.has('json')) {
      process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
    } else {
      for (const report of reports) printReport(report);
    }

    const failed = reports.some((r) => !r.passed);
    if (failed) {
      process.stderr.write(
        '\nQUALITY GATE GAGAL: terdapat master wajib dengan record aktif di bawah minimum.\n' +
          'Jalankan `pnpm seed:repair --schema <nama>` untuk menambahkan data contoh yang kurang.\n',
      );
    }
    process.exit(failed ? 1 : 0);
  } finally {
    await ctx.app.close();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
