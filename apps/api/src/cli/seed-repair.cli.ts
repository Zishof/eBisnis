/**
 * pnpm seed:repair --schema <tenant>
 *
 * "Tambahkan Data Contoh yang Kurang" — menambahkan kembali record master
 * contoh yang hilang tanpa menduplikasi record yang sudah ada.
 */
import 'dotenv/config';
import { createSeedContext } from './seed-runner';
import { parseArgs, printReport } from './cli-utils';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ctx = await createSeedContext();

  try {
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
      schemas.push(ctx.config.get<string>('schema.demo', 'demo'));
    }

    for (const schemaName of schemas) {
      const summary = await ctx.masterSeed.repairTenant(schemaName);
      process.stdout.write(
        `\n[${schemaName}] perbaikan seed: ${summary.totalInserted} baru, ${summary.totalUpdated} diperbarui.\n`,
      );
      for (const resource of summary.resources) {
        if (resource.inserted || resource.updated) {
          process.stdout.write(
            `  ${resource.resourceCode.padEnd(28)} +${resource.inserted} baru, ~${resource.updated} diperbarui\n`,
          );
        }
      }
      printReport(await ctx.masterSeed.verifyTenant(schemaName));
    }
    process.exit(0);
  } finally {
    await ctx.app.close();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
