import { INestApplicationContext, Logger } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { AUTHORIZATION_MARKER_KEYS } from '../decorators';

/**
 * Memeriksa bahwa setiap route menyatakan hak akses yang dibutuhkannya.
 *
 * PermissionGuard menolak handler tanpa penanda saat dipanggil. Pemeriksaan ini
 * memajukan penemuannya ke saat aplikasi menyala, sehingga endpoint yang lupa
 * diberi penanda tidak lolos sampai produksi lalu gagal di depan pengguna.
 *
 * Dijalankan juga sebagai test, sehingga kesalahannya terlihat pada CI —
 * lebih awal lagi.
 */

/*
 * Daftarnya TIDAK ditulis ulang di sini.
 *
 * Berkas ini dan `PermissionGuard` dulu menyimpan daftar penandanya
 * sendiri-sendiri. `@ReportPermission` sempat ditambahkan ke penjaganya saja,
 * dan akibatnya bukan sekadar penanda yang terlewat: audit ini menolak, lalu
 * aplikasi gagal menyala seluruhnya.
 */
const MARKER_KEYS = AUTHORIZATION_MARKER_KEYS;

export interface UnmarkedRoute {
  controller: string;
  handler: string;
  method: string;
  path: string;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

/** Mengumpulkan route yang tidak menyatakan satu pun penanda otorisasi. */
export function findUnmarkedRoutes(app: INestApplicationContext): UnmarkedRoute[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const unmarked: UnmarkedRoute[] = [];

  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;
    const prototype = Object.getPrototypeOf(instance) as object;

    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = (instance as Record<string, unknown>)[methodName];
      if (typeof handler !== 'function') continue;

      const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (httpMethod === undefined) continue;

      const marked = MARKER_KEYS.some((key) => {
        const value = reflector.getAllAndOverride<unknown>(key, [handler, metatype]);
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
      });
      if (marked) continue;

      unmarked.push({
        controller: metatype.name,
        handler: methodName,
        method: HTTP_METHODS[httpMethod] ?? String(httpMethod),
        path: String(Reflect.getMetadata(PATH_METADATA, handler) ?? ''),
      });
    }
  }

  return unmarked;
}

/**
 * Menghentikan aplikasi bila ada route tanpa penanda otorisasi.
 *
 * Menyala dengan endpoint yang tidak terlindungi lebih buruk daripada tidak
 * menyala sama sekali: yang pertama diam, yang kedua terlihat.
 */
export function assertEveryRouteIsMarked(app: INestApplicationContext): void {
  const unmarked = findUnmarkedRoutes(app);
  if (unmarked.length === 0) {
    new Logger('RouteAuthorization').log('Seluruh route menyatakan hak aksesnya.');
    return;
  }

  const detail = unmarked
    .map((r) => `  ${r.method.padEnd(6)} ${r.path || '/'}  ${r.controller}.${r.handler}`)
    .join('\n');

  throw new Error(
    `${unmarked.length} route tidak menyatakan hak akses yang dibutuhkannya.\n\n${detail}\n\n` +
      'Tambahkan @Permissions, @PlatformPermissions, @ResourcePermission, ' +
      '@ReportPermission, @RequireStepUp, @AuthenticatedOnly, atau @Public ' +
      'pada masing-masing.',
  );
}
