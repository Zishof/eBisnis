/**
 * Entry point `prisma db seed`.
 *
 * Menjalankan:
 *  1. seed control plane (`platform`) termasuk super admin, locale, katalog
 *     modul/fitur, paket harga, diskon, provider pembayaran, dan CMS;
 *  2. provisioning schema `demo` + `demo__audit` beserta seluruh seed master.
 */
import 'dotenv/config';
import { runSeed } from '../src/cli/seed-runner';

runSeed({ platform: true, demo: true })
  .then((summary) => {
    // eslint-disable-next-line no-console
    console.log('\nSeed selesai.');
    // eslint-disable-next-line no-console
    console.table(summary.platform);
    if (summary.demo) {
      // eslint-disable-next-line no-console
      console.log(`Schema demo   : ${summary.demo.schemaName} (${summary.demo.schemaVersion})`);
    }
    process.exit(0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed gagal:', error);
    process.exit(1);
  });
