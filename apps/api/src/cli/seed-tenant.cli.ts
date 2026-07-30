/**
 * pnpm seed:tenant --schema <tenant>
 *
 * Menjalankan seed master pada satu schema tenant yang sudah diprovision.
 * Idempotent — dapat dijalankan berulang.
 */
import 'dotenv/config';
import { createSeedContext, provisionDemo } from './seed-runner';
import { parseArgs, printReport } from './cli-utils';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ctx = await createSeedContext();

  try {
    const demoSchema = ctx.config.get<string>('schema.demo', 'demo');
    const schemaName = args.options.schema ?? demoSchema;

    const registry = await ctx.prisma.tenantSchemaRegistry.findUnique({
      where: { schemaName },
    });

    if (!registry) {
      if (schemaName === demoSchema) {
        process.stdout.write(`Schema demo belum diprovision. Memprovision sekarang…\n`);
        await provisionDemo(ctx);
      } else {
        process.stderr.write(
          `Schema "${schemaName}" tidak terdaftar pada platform.tenant_schema_registry.\n` +
            'Gunakan endpoint pendaftaran atau POST /api/v1/platform/tenants/:id/migrate.\n',
        );
        process.exit(1);
      }
    } else {
      const summary = await ctx.masterSeed.seedTenant(schemaName);
      process.stdout.write(
        `\n[${schemaName}] seed master: ${summary.totalInserted} baru, ${summary.totalUpdated} diperbarui.\n`,
      );
      for (const resource of summary.resources) {
        process.stdout.write(
          `  ${resource.resourceCode.padEnd(28)} +${resource.inserted} / ~${resource.updated} / =${resource.skipped}\n`,
        );
      }
    }

    printReport(await ctx.masterSeed.verifyTenant(schemaName));
    process.exit(0);
  } finally {
    await ctx.app.close();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
