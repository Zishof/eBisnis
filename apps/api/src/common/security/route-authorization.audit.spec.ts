import { Controller, Get, Module, Post } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as decorators from '../decorators';
import {
  AUTHORIZATION_MARKER_KEYS,
  AuthenticatedOnly,
  DEMO_BLOCKED_KEY,
  Permissions,
  PlatformPermissions,
  Public,
  ReportPermission,
  ResourcePermission,
} from '../decorators';
import { assertEveryRouteIsMarked, findUnmarkedRoutes } from './route-authorization.audit';

@Controller('marked')
class MarkedController {
  @Get('public')
  @Public()
  publicRoute() {
    return null;
  }

  @Get('self')
  @AuthenticatedOnly()
  selfRoute() {
    return null;
  }

  @Get('tenant')
  @Permissions('CATALOG_PRODUCT.READ')
  tenantRoute() {
    return null;
  }

  @Get('platform')
  @PlatformPermissions('PLATFORM.TENANT.READ')
  platformRoute() {
    return null;
  }

  @Post(':resource')
  @ResourcePermission('CREATE')
  resourceRoute() {
    return null;
  }

  @Post('reports/:code/preview')
  @ReportPermission()
  reportRoute() {
    return null;
  }

  /** Bukan route; tidak boleh ikut terhitung. */
  helper() {
    return null;
  }
}

@Controller('lupa')
class ForgottenController {
  @Get('tanpa-penanda')
  forgotten() {
    return null;
  }

  @Post('juga-lupa')
  alsoForgotten() {
    return null;
  }
}

@Module({ imports: [DiscoveryModule], controllers: [MarkedController] })
class MarkedModule {}

@Module({ imports: [DiscoveryModule], controllers: [MarkedController, ForgottenController] })
class ForgottenModule {}

describe('audit otorisasi route', () => {
  it('menerima route yang menyatakan hak aksesnya', async () => {
    const app = await Test.createTestingModule({ imports: [MarkedModule] }).compile();
    expect(findUnmarkedRoutes(app)).toEqual([]);
    expect(() => assertEveryRouteIsMarked(app)).not.toThrow();
    await app.close();
  });

  it('menemukan route yang tidak menyatakan hak aksesnya', async () => {
    const app = await Test.createTestingModule({ imports: [ForgottenModule] }).compile();
    const unmarked = findUnmarkedRoutes(app);
    expect(unmarked.map((r) => r.handler).sort()).toEqual(['alsoForgotten', 'forgotten']);
    expect(unmarked[0].controller).toBe('ForgottenController');
    await app.close();
  });

  it('menghentikan aplikasi dan menyebut route yang bermasalah', async () => {
    const app = await Test.createTestingModule({ imports: [ForgottenModule] }).compile();
    expect(() => assertEveryRouteIsMarked(app)).toThrow(/tanpa-penanda/);
    expect(() => assertEveryRouteIsMarked(app)).toThrow(/2 route/);
    await app.close();
  });

  it('tidak menghitung metode yang bukan route', async () => {
    const app = await Test.createTestingModule({ imports: [MarkedModule] }).compile();
    expect(findUnmarkedRoutes(app).some((r) => r.handler === 'helper')).toBe(false);
    await app.close();
  });

  it('menerima @ReportPermission sebagai penanda', async () => {
    /*
     * Penanda ini sempat ditambahkan ke `PermissionGuard` SAJA. Akibatnya bukan
     * endpoint yang lolos, melainkan aplikasi yang tidak dapat menyala sama
     * sekali -- audit ini berjalan pada bootstrap dan menolak dua route laporan.
     * Ketahuan dari uji peramban, bukan dari uji satuan mana pun.
     */
    const app = await Test.createTestingModule({ imports: [MarkedModule] }).compile();
    expect(findUnmarkedRoutes(app).some((r) => r.handler === 'reportRoute')).toBe(false);
    await app.close();
  });
});

describe('daftar penanda otorisasi', () => {
  /**
   * Kunci metadata yang SENGAJA bukan penanda otorisasi.
   *
   * `@BlockDemo` melarang aksi pada tenant demo; ia tidak menyatakan hak akses,
   * jadi route yang hanya memilikinya tetap harus ditolak.
   */
  const BUKAN_PENANDA = new Set<string>([DEMO_BLOCKED_KEY]);

  it('setiap kunci metadata sudah diputuskan: penanda atau bukan', () => {
    /*
     * Penjaga terhadap penyimpangan yang baru saja terjadi.
     *
     * Menambahkan kunci baru tanpa memasukkannya ke `AUTHORIZATION_MARKER_KEYS`
     * membuat penjaga dan audit berbeda pendapat, dan bedanya baru terlihat saat
     * aplikasi gagal menyala. Uji ini memaksa keputusannya diambil di sini,
     * pada saat kuncinya ditulis.
     */
    const semuaKunci = Object.entries(decorators)
      .filter(([nama, nilai]) => nama.endsWith('_KEY') && typeof nilai === 'string')
      .map(([, nilai]) => nilai as string);

    const penanda = new Set<string>(AUTHORIZATION_MARKER_KEYS);
    const belumDiputuskan = semuaKunci.filter(
      (kunci) => !penanda.has(kunci) && !BUKAN_PENANDA.has(kunci),
    );

    expect(belumDiputuskan).toEqual([]);
  });

  it('penanda dan bukan-penanda tidak tumpang tindih', () => {
    const tumpang = AUTHORIZATION_MARKER_KEYS.filter((kunci) => BUKAN_PENANDA.has(kunci));
    expect(tumpang).toEqual([]);
  });

  it('memuat penanda laporan', () => {
    expect(AUTHORIZATION_MARKER_KEYS).toContain(decorators.REPORT_PERMISSION_KEY);
  });
});
