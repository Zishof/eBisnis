/**
 * Melekatkan schema modul pendidikan pada permintaan.
 *
 * Berjalan sesudah autentikasi, dan hanya berbuat sesuatu untuk jalur di bawah
 * `/api/v1/education/`. Permintaan lain melewatinya dengan satu pemeriksaan
 * awalan string.
 *
 * ## Mengapa guard, bukan urusan tiap controller
 *
 * Bila setiap controller menyelesaikan schema-nya sendiri, satu controller yang
 * lupa akan memakai schema inti dari sesi — dan kueri pendidikan yang berjalan
 * di schema inti tidak menghasilkan penolakan, melainkan galat "relasi tidak
 * ada" yang membuat pembacanya mencari sebabnya pada migrasi.
 *
 * Dengan guard, controller yang lupa tidak memperoleh apa pun untuk dipakai.
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { EducationSchemaResolver, type SchemaModul } from './education-schema-resolver.service';
import { modulDariJalur, perluSchemaSendiri } from './education-schema-route';

/** Bentuk yang dilekatkan pada permintaan. */
export type EducationSchemaContext = SchemaModul;

@Injectable()
export class EducationSchemaGuard implements CanActivate {
  constructor(private readonly resolver: EducationSchemaResolver) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rute = modulDariJalur(request.path);

    if (!rute.pendidikan) return true;

    if (rute.alasanTolak) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, rute.alasanTolak);
    }

    const module = rute.module!;
    if (!perluSchemaSendiri(module)) {
      // `billing` dan `integrations` memakai schema inti dari sesi.
      return true;
    }

    const tenant = (request as unknown as { tenant?: { tenantId?: string } }).tenant;
    if (!tenant?.tenantId) {
      /*
       * Tidak ada konteks tenant berarti permintaannya belum terautentikasi,
       * atau penggunanya belum memilih tenant. Ditolak di sini alih-alih
       * dibiarkan lewat: melewatkannya menyerahkan penolakan kepada controller,
       * dan controller yang lupa memeriksanya akan menerima permintaan tanpa
       * tenant sama sekali.
       */
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Jalur pendidikan memerlukan konteks tenant.',
      );
    }

    (request as unknown as { educationSchema: EducationSchemaContext }).educationSchema =
      await this.resolver.resolve(tenant.tenantId, module);

    return true;
  }
}
