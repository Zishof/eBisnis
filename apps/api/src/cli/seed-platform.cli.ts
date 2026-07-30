/**
 * pnpm seed:platform
 *
 * Seed control plane saja (tanpa provisioning demo).
 */
import 'dotenv/config';
import { runSeed } from './seed-runner';
import { createSeedContext } from './seed-runner';
import { printReport } from './cli-utils';

async function main(): Promise<void> {
  const result = await runSeed({ platform: true, demo: false });
  process.stdout.write('\nSeed control plane selesai.\n');
  for (const [key, value] of Object.entries(result.platform)) {
    process.stdout.write(`  ${key.padEnd(26)} ${value}\n`);
  }

  const ctx = await createSeedContext();
  try {
    printReport(await ctx.platformSeed.verify());
  } finally {
    await ctx.app.close();
  }
  process.exit(0);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
