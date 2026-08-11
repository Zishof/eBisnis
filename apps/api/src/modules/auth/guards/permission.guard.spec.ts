import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StepUpPurpose } from '@prisma/client';
import {
  AUTHENTICATED_ONLY_KEY,
  AuthenticatedUser,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  PLATFORM_PERMISSIONS_KEY,
  REPORT_PERMISSION_KEY,
  RESOURCE_PERMISSION_KEY,
  STEP_UP_KEY,
} from '../../../common/decorators';
import { AuthService } from '../auth.service';
import { TenantPermissionService } from '../tenant-permission.service';
import { PermissionGuard } from './permission.guard';

type Markers = Partial<Record<string, unknown>>;

const user = (over: Partial<AuthenticatedUser> = {}): AuthenticatedUser =>
  ({
    userId: 'user-1',
    username: 'joni',
    displayName: 'Joni',
    isPlatformStaff: false,
    platformPermissions: [],
    mustChangePassword: false,
    sessionId: 'sess-1',
    tokenFamilyId: 'fam-1',
    schemaName: 'tokosaya',
    isDemo: false,
    localeCode: 'id',
    ...over,
  }) as AuthenticatedUser;

function build(markers: Markers, request: Record<string, unknown>) {
  const reflector = {
    getAllAndOverride: (key: string) => markers[key],
  } as unknown as Reflector;

  const findMissing = jest.fn(async (_s: string, _u: string, required: string[]) =>
    required.filter((p) => !(request.granted as string[] | undefined)?.includes(p)),
  );
  const consumeStepUp = jest.fn(async () => undefined);

  const guard = new PermissionGuard(
    reflector,
    { consumeStepUp } as unknown as AuthService,
    { findMissing } as unknown as TenantPermissionService,
  );

  const context = {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { guard, context, findMissing, consumeStepUp };
}

describe('PermissionGuard', () => {
  describe('handler tanpa penanda otorisasi', () => {
    // Ini yang menutup V6-0-F03. Sebelum perbaikan, guard mengembalikan true
    // pada kasus ini sehingga 32 endpoint dapat dipanggil tanpa pemeriksaan hak.
    it('ditolak, bukan diloloskan', async () => {
      const { guard, context } = build({}, { user: user() });
      await expect(guard.canActivate(context)).rejects.toThrow(
        /tidak menyatakan hak akses yang dibutuhkannya/,
      );
    });

    it('ditolak walaupun pengguna sudah masuk dan berhak atas segalanya', async () => {
      const { guard, context } = build(
        {},
        { user: user({ platformPermissions: ['PLATFORM.EVERYTHING'] }), granted: ['ANY.THING'] },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/tidak menyatakan hak akses/);
    });

    it('ditolak walaupun tidak ada pengguna sama sekali', async () => {
      const { guard, context } = build({}, {});
      await expect(guard.canActivate(context)).rejects.toThrow(/tidak menyatakan hak akses/);
    });
  });

  describe('penanda yang meloloskan', () => {
    it('meloloskan route publik tanpa pengguna', async () => {
      const { guard, context } = build({ [IS_PUBLIC_KEY]: true }, {});
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('meloloskan AuthenticatedOnly bagi pengguna yang sudah masuk', async () => {
      const { guard, context, findMissing } = build(
        { [AUTHENTICATED_ONLY_KEY]: true },
        { user: user() },
      );
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(findMissing).not.toHaveBeenCalled();
    });

    it('menolak AuthenticatedOnly tanpa pengguna', async () => {
      const { guard, context } = build({ [AUTHENTICATED_ONLY_KEY]: true }, {});
      await expect(guard.canActivate(context)).rejects.toThrow(/Autentikasi diperlukan/);
    });
  });

  describe('permission tenant', () => {
    it('meloloskan bila seluruh permission dimiliki', async () => {
      const { guard, context } = build(
        { [PERMISSIONS_KEY]: ['CATALOG_PRODUCT.READ'] },
        { user: user(), granted: ['CATALOG_PRODUCT.READ'] },
      );
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('menolak bila ada yang kurang', async () => {
      const { guard, context } = build(
        { [PERMISSIONS_KEY]: ['CATALOG_PRODUCT.READ', 'CATALOG_PRODUCT.DELETE'] },
        { user: user(), granted: ['CATALOG_PRODUCT.READ'] },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/Hak akses tidak mencukupi/);
    });

    it('menolak bila sesi tidak terhubung ke tenant', async () => {
      const { guard, context } = build(
        { [PERMISSIONS_KEY]: ['CATALOG_PRODUCT.READ'] },
        { user: user({ schemaName: undefined }) },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/tidak terhubung ke tenant/);
    });
  });

  describe('permission dari parameter :resource', () => {
    it('menurunkan kode menu dari registry', async () => {
      const { guard, context, findMissing } = build(
        { [RESOURCE_PERMISSION_KEY]: 'DELETE' },
        { user: user(), params: { resource: 'products' }, granted: ['CATALOG_PRODUCT.DELETE'] },
      );
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(findMissing).toHaveBeenCalledWith('tokosaya', 'user-1', ['CATALOG_PRODUCT.DELETE'], {
        isDemo: false,
      });
    });

    it('menolak bila permission turunannya tidak dimiliki', async () => {
      const { guard, context } = build(
        { [RESOURCE_PERMISSION_KEY]: 'DELETE' },
        { user: user(), params: { resource: 'products' }, granted: ['CATALOG_PRODUCT.READ'] },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/Hak akses tidak mencukupi/);
    });

    it('menolak sumber daya yang tidak dikenal, bukan meloloskannya', async () => {
      const { guard, context } = build(
        { [RESOURCE_PERMISSION_KEY]: 'READ' },
        { user: user(), params: { resource: 'produk-salah-ketik' }, granted: [] },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/tidak dikenal/);
    });

    it('menolak bila parameter resource tidak ada sama sekali', async () => {
      const { guard, context } = build(
        { [RESOURCE_PERMISSION_KEY]: 'READ' },
        { user: user(), params: {}, granted: [] },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/tidak dikenal/);
    });
  });

  describe('aturan lain', () => {
    it('menuntut ganti kata sandi sebelum apa pun yang lain', async () => {
      const { guard, context } = build(
        { [PERMISSIONS_KEY]: ['CATALOG_PRODUCT.READ'] },
        { user: user({ mustChangePassword: true }), granted: ['CATALOG_PRODUCT.READ'] },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/wajib mengganti kata sandi/);
    });

    it('menolak permission platform yang kurang', async () => {
      const { guard, context } = build(
        { [PLATFORM_PERMISSIONS_KEY]: ['PLATFORM.TENANT.READ'] },
        { user: user() },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/Hak akses tidak mencukupi/);
    });

    it('mengonsumsi token step-up', async () => {
      const { guard, context, consumeStepUp } = build(
        { [STEP_UP_KEY]: StepUpPurpose.HARD_DELETE },
        { user: user(), headers: { 'x-step-up-token': 'tok-1' } },
      );
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(consumeStepUp).toHaveBeenCalledWith('user-1', StepUpPurpose.HARD_DELETE, 'tok-1');
    });
  });

  describe('hak per laporan (@ReportPermission)', () => {
    /*
     * Diuji lewat PERILAKU penjaganya, bukan lewat teks sumbernya.
     *
     * Penjaga berbasis teks sempat meloloskan satu cacat: `izinUntukLaporan(code)
     * ?? 'SALES.READ'` di dalam penjaga membuat laporan tak dikenal jatuh kembali
     * ke hak bawaan, dan tidak ada satu pun uji yang gagal. Blok inilah yang
     * menutupnya.
     */
    const laporan = (code: string, granted: string[]) =>
      build({ [REPORT_PERMISSION_KEY]: true }, { user: user(), params: { code }, granted });

    it('menuntut hak keuangan untuk laba rugi', async () => {
      const { guard, context, findMissing } = laporan('profit-loss', ['FINANCE_JOURNAL.READ']);
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(findMissing).toHaveBeenCalledWith(
        'tokosaya',
        'user-1',
        ['FINANCE_JOURNAL.READ'],
        expect.anything(),
      );
    });

    it('MENOLAK pemegang SALES.READ membuka laba rugi', async () => {
      // Inti seluruh perubahan ini.
      const { guard, context } = laporan('profit-loss', ['SALES.READ', 'SALES_REPORT.READ']);
      await expect(guard.canActivate(context)).rejects.toThrow(/Hak akses tidak mencukupi/);
    });

    it('MENOLAK pemegang SALES.READ membuka laba kotor', async () => {
      const { guard, context } = laporan('gross-profit', ['SALES.READ']);
      await expect(guard.canActivate(context)).rejects.toThrow(/Hak akses tidak mencukupi/);
    });

    it('menuntut hak pembelian untuk umur hutang pemasok', async () => {
      const { guard, context } = laporan('ap-aging', ['PURCHASING.READ']);
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('menolak kode laporan tak dikenal, tanpa jatuh ke hak bawaan', async () => {
      const { guard, context, findMissing } = laporan('laporan-karangan', ['SALES.READ']);
      await expect(guard.canActivate(context)).rejects.toThrow(/Kode laporan tidak dikenal/);
      // Ditolak SEBELUM hak apa pun diperiksa, bukan diperiksa lalu kebetulan gagal.
      expect(findMissing).not.toHaveBeenCalled();
    });

    it('menolak permintaan tanpa parameter kode sama sekali', async () => {
      const { guard, context } = build(
        { [REPORT_PERMISSION_KEY]: true },
        { user: user(), params: {}, granted: ['SALES.READ'] },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(/Kode laporan tidak dikenal/);
    });

    it('penanda ini sendiri sudah cukup sebagai penanda otorisasi', async () => {
      // Tanpa ini endpoint laporan akan ditolak sebagai "tidak menyatakan hak
      // akses" -- penjaga menolak handler yang tidak punya satu pun penanda.
      const { guard, context } = laporan('stock-list', ['INVENTORY.READ']);
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });
});
