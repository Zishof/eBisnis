/**
 * Menanam katalog kategori marketplace.
 *
 * Terpisah dari `seed-platform` karena kategori marketplace bukan bagian dari
 * penyiapan platform yang wajib: instalasi yang tidak memakai marketplace
 * tidak perlu memilikinya. Menyatukannya akan memaksa setiap instalasi
 * menanam kategori yang tidak akan pernah dipakai.
 *
 *   pnpm --filter @ebisnis/api seed:catalog
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { CategoryService } from '../modules/catalog/category.service';

async function main(): Promise<void> {
  const logger = new Logger('seed-catalog');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const outcome = await app.get(CategoryService).seed();
    logger.log(
      `Selesai: ${outcome.created} dibuat, ${outcome.updated} diperbarui, ` +
        `${outcome.unchanged} tidak berubah.`,
    );

    const tree = await app.get(CategoryService).tree();
    const leaves = await app.get(CategoryService).selectable();
    logger.log(`${tree.length} kategori akar, ${leaves.length} kategori dapat dipilih listing.`);
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  // Keluar dengan kode bukan nol agar kegagalan penanaman menghentikan
  // rangkaian penyiapan, bukan lewat tanpa terlihat.
  console.error(error.message);
  process.exit(1);
});
