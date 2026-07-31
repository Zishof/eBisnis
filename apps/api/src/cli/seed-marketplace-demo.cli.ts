/**
 * Menanam produk contoh marketplace pada tenant demo.
 *
 * Memanggil layanan yang sama dengan endpoint platform. Dua jalur yang menanam
 * hal yang sama pada akhirnya akan berbeda isinya, dan yang satu akan
 * memperbaiki cacat yang tetap ada pada yang lain.
 *
 * Gerbang publikasi tetap dijalankan — produk contoh tidak diistimewakan.
 *
 *   pnpm --filter @ebisnis/api seed:marketplace-demo
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { SampleCatalogService } from '../modules/catalog/sample-catalog.service';

async function main(): Promise<void> {
  const logger = new Logger('seed-marketplace-demo');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const samples = app.get(SampleCatalogService);
    const result = await samples.seed({
      userId: randomUUID(),
      username: 'seed-marketplace-demo',
      requestId: randomUUID(),
    });

    logger.log(
      `${result.listingsCreated} listing dibuat, ${result.published} terbit, ` +
        `${result.skipped} dilewati, ${result.projected} masuk katalog publik.`,
    );

    const rows = await samples.list();
    const terlihat = rows.filter((r) => r.visible).length;
    logger.log(`Total produk contoh: ${rows.length}, terlihat publik: ${terlihat}.`);
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
