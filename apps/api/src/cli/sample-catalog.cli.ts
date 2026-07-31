/**
 * Menyembunyikan atau menampilkan produk contoh dari baris perintah.
 *
 * Berguna ketika antarmuka platform belum dapat diakses — misalnya saat
 * menyiapkan server sebelum ada administrator yang masuk.
 *
 *   pnpm --filter @ebisnis/api sample:hide
 *   pnpm --filter @ebisnis/api sample:show
 *   pnpm --filter @ebisnis/api sample:list
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { SampleCatalogService } from '../modules/catalog/sample-catalog.service';

const ACTIONS = ['hide', 'show', 'list'] as const;
type Action = (typeof ACTIONS)[number];

async function main(): Promise<void> {
  const logger = new Logger('sample-catalog');
  const action = (process.argv[2] ?? 'list') as Action;

  if (!ACTIONS.includes(action)) {
    console.error(`Tindakan tidak dikenal: ${action}. Pilih: ${ACTIONS.join(', ')}`);
    process.exit(2);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const samples = app.get(SampleCatalogService);
    const actor = {
      userId: randomUUID(),
      username: 'sample-catalog-cli',
      requestId: randomUUID(),
    };

    if (action === 'list') {
      const rows = await samples.list();
      if (rows.length === 0) {
        logger.log('Belum ada produk contoh. Jalankan seed:marketplace-demo lebih dahulu.');
        return;
      }
      for (const row of rows) {
        logger.log(
          `${row.visible ? 'TAMPIL     ' : 'TERSEMBUNYI'}  ${row.code}  ${row.title}`,
        );
      }
      logger.log(`${rows.filter((r) => r.visible).length} dari ${rows.length} terlihat publik.`);
      return;
    }

    const result =
      action === 'hide' ? await samples.hideAll(actor) : await samples.showAll(actor);
    logger.log(`${result.affected} diproses, ${result.skipped} dilewati.`);
    for (const reason of result.reasons) logger.warn(reason);
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
