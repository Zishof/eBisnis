/**
 * Pengujian guard schema pendidikan.
 *
 * Dua sifat yang menentukan: permintaan non-pendidikan melewatinya tanpa
 * disentuh, dan permintaan pendidikan **tidak pernah** lewat tanpa schema.
 * Yang pertama menjaga seluruh aplikasi tetap hidup; yang kedua menjaga kueri
 * pendidikan tidak berjalan di schema inti.
 */

import type { ExecutionContext } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import type { EducationSchemaResolver } from './education-schema-resolver.service';
import { EducationSchemaGuard } from './education-schema.guard';

const SCHEMA = {
  moduleCode: 'eschool',
  schemaName: 'joniutama_eschool',
  auditSchemaName: 'joniutama_eschool__audit',
  status: 'ACTIVE',
};

function konteks(path: string, tenantId?: string) {
  const request: Record<string, unknown> = { path };
  if (tenantId) request.tenant = { tenantId };
  return {
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
}

const resolverYang = (hasil: unknown, gagal = false): EducationSchemaResolver =>
  ({
    resolve: jest.fn(async () => {
      if (gagal) throw AppError.notFound('NOT_FOUND', 'Modul belum diaktifkan.');
      return hasil;
    }),
  }) as unknown as EducationSchemaResolver;

describe('permintaan di luar pendidikan', () => {
  it('lewat tanpa memanggil resolver', async () => {
    // Guard ini terdaftar global. Satu kesalahan di sini mematikan seluruh
    // aplikasi, bukan hanya jalur pendidikan.
    const resolver = resolverYang(SCHEMA);
    const guard = new EducationSchemaGuard(resolver);

    for (const p of ['/api/v1/pos/sales', '/api/v1/auth/me', '/health']) {
      const { ctx, request } = konteks(p, 'tenant-1');
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(request.educationSchema).toBeUndefined();
    }
    expect(resolver.resolve).not.toHaveBeenCalled();
  });
});

describe('permintaan pendidikan', () => {
  it('melekatkan schema modul pada permintaan', async () => {
    const guard = new EducationSchemaGuard(resolverYang(SCHEMA));
    const { ctx, request } = konteks('/api/v1/education/school/pupils', 'tenant-1');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.educationSchema).toEqual(SCHEMA);
  });

  it('billing dan integrations memakai schema inti dari sesi', async () => {
    const resolver = resolverYang(SCHEMA);
    const guard = new EducationSchemaGuard(resolver);

    for (const p of ['/api/v1/education/billing/usage', '/api/v1/education/integrations/dapodik']) {
      const { ctx, request } = konteks(p, 'tenant-1');
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(request.educationSchema).toBeUndefined();
    }
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('segmen asing ditolak sebagai 404', async () => {
    const guard = new EducationSchemaGuard(resolverYang(SCHEMA));
    const { ctx } = konteks('/api/v1/education/schoool/pupils', 'tenant-1');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AppError);
  });

  it('tanpa konteks tenant ditolak di sini, bukan diserahkan ke controller', async () => {
    /*
     * Melewatkannya menyerahkan penolakan kepada controller, dan controller
     * yang lupa memeriksanya akan menerima permintaan tanpa tenant sama sekali.
     */
    const guard = new EducationSchemaGuard(resolverYang(SCHEMA));
    const { ctx } = konteks('/api/v1/education/school/pupils');
    await expect(guard.canActivate(ctx)).rejects.toThrow(/konteks tenant/);
  });

  it('modul yang belum aktif menolak permintaan, bukan meneruskannya', async () => {
    // Tidak ada jalur cadangan ke schema inti.
    const guard = new EducationSchemaGuard(resolverYang(null, true));
    const { ctx, request } = konteks('/api/v1/education/school/pupils', 'tenant-1');

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AppError);
    expect(request.educationSchema).toBeUndefined();
  });
});
