/**
 * pnpm seed:cleanup --schema <tenant> [--hard] [--restore]
 *
 * "Hapus Data Contoh" / "Pulihkan Data Contoh".
 * Data contoh yang telah direferensikan transaksi nyata TIDAK dihapus dan
 * dilaporkan sebagai terblokir.
 */
import 'dotenv/config';
import { createSeedContext } from './seed-runner';
import { parseArgs } from './cli-utils';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ctx = await createSeedContext();
  const schemaName = args.options.schema ?? ctx.config.get<string>('schema.demo', 'demo');

  try {
    if (args.flags.has('restore')) {
      const result = await ctx.masterSeed.restoreSampleData(schemaName);
      process.stdout.write(
        `\n[${schemaName}] pemulihan data contoh: ${result.restored} record dipulihkan.\n`,
      );
      process.exit(0);
    }

    const summary = await ctx.masterSeed.cleanupSampleData(schemaName, {
      hard: args.flags.has('hard'),
      reason: args.options.reason ?? 'Hapus data contoh via CLI',
    });

    process.stdout.write(
      `\n[${schemaName}] pembersihan data contoh (${args.flags.has('hard') ? 'hard purge' : 'soft delete'}): ` +
        `${summary.totalRemoved} record dihapus.\n`,
    );
    for (const removed of summary.removed) {
      process.stdout.write(`  ${removed.resourceCode.padEnd(28)} -${removed.count}\n`);
    }
    if (summary.blocked.length) {
      process.stdout.write(
        `\nTIDAK dihapus karena sudah direferensikan (${summary.blocked.length} record):\n`,
      );
      for (const blocked of summary.blocked.slice(0, 30)) {
        process.stdout.write(
          `  ${blocked.resourceCode.padEnd(24)} ${blocked.code.padEnd(24)} ${blocked.reason}\n`,
        );
      }
      if (summary.blocked.length > 30) {
        process.stdout.write(`  … dan ${summary.blocked.length - 30} lainnya.\n`);
      }
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
