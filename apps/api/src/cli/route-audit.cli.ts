/**
 * pnpm route:audit
 *
 * Menyalakan aplikasi tanpa membuka port, lalu memeriksa bahwa setiap route
 * menyatakan hak akses yang dibutuhkannya. Keluar dengan kode 1 bila ada yang
 * tidak, sehingga dapat dipakai sebagai gerbang CI.
 */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { findUnmarkedRoutes } from '../common/security/route-authorization.audit';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const unmarked = findUnmarkedRoutes(app);
    process.stdout.write(`Route tanpa penanda otorisasi: ${unmarked.length}\n`);
    for (const route of unmarked) {
      process.stdout.write(
        `  ${route.method.padEnd(6)} ${route.path || '/'}  ${route.controller}.${route.handler}\n`,
      );
    }
    process.exitCode = unmarked.length === 0 ? 0 : 1;
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(2);
});
