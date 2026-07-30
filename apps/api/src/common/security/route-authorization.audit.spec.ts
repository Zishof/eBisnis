import { Controller, Get, Module, Post } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  AuthenticatedOnly,
  Permissions,
  PlatformPermissions,
  Public,
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
});
