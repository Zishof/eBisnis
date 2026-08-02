/**
 * Titik masuk HTTP portal wali (EP-K). Pola sama dengan
 * `CooperativePortalController` — permission TERPISAH dari layar pengurus
 * (`EPESANTREN_PORTAL_WALI`, bukan `EPESANTREN_SANTRI`), dan `santriId`
 * dari path TIDAK PERNAH dipercaya tanpa verifikasi kepemilikan (lihat
 * `pesantren-portal-wali.service.ts`).
 */

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenPortalWaliService } from './pesantren-portal-wali.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class HalamanQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

@ApiTags('pesantren-portal-wali')
@ApiBearerAuth('access-token')
@Controller('pesantren/portal/wali')
export class PesantrenPortalWaliController {
  constructor(private readonly portal: PesantrenPortalWaliService) {}

  private async konteks(user: AuthenticatedUser) {
    const schema = schemaWajib(user);
    const wali = await this.portal.waliDiriSendiri(schema, user.userId);
    return { schema, wali };
  }

  @Permissions('EPESANTREN_PORTAL_WALI.READ')
  @Get('anak')
  @ApiOperation({ summary: 'Daftar anak (santri) milik wali yang sedang masuk' })
  async anakSaya(@CurrentUser() user: AuthenticatedUser) {
    const { schema, wali } = await this.konteks(user);
    return this.portal.anakSaya(schema, wali.wali_id);
  }

  @Permissions('EPESANTREN_PORTAL_WALI.READ')
  @Get('anak/:santriId')
  @ApiOperation({ summary: 'Profil satu anak — hanya bila benar anak wali yang masuk' })
  async detailAnak(@Param('santriId') santriId: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, wali } = await this.konteks(user);
    return this.portal.detailAnak(schema, wali.wali_id, santriId);
  }

  @Permissions('EPESANTREN_PORTAL_WALI.READ')
  @Get('anak/:santriId/presensi')
  @ApiOperation({ summary: 'Presensi satu anak' })
  async presensiAnak(
    @Param('santriId') santriId: string,
    @Query() query: HalamanQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { schema, wali } = await this.konteks(user);
    return this.portal.presensiAnak(schema, wali.wali_id, santriId, {
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_PORTAL_WALI.READ')
  @Get('anak/:santriId/tahfiz')
  @ApiOperation({ summary: 'Capaian dan riwayat tahfiz satu anak' })
  async tahfizAnak(@Param('santriId') santriId: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, wali } = await this.konteks(user);
    return this.portal.tahfizAnak(schema, wali.wali_id, santriId);
  }

  @Permissions('EPESANTREN_PORTAL_WALI.READ')
  @Get('anak/:santriId/izin')
  @ApiOperation({ summary: 'Riwayat izin satu anak' })
  async izinAnak(@Param('santriId') santriId: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, wali } = await this.konteks(user);
    return this.portal.izinAnak(schema, wali.wali_id, santriId);
  }

  @Permissions('EPESANTREN_PORTAL_WALI.READ')
  @Get('anak/:santriId/dompet')
  @ApiOperation({ summary: 'Saldo dan riwayat dompet satu anak (baca saja)' })
  async dompetAnak(@Param('santriId') santriId: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, wali } = await this.konteks(user);
    return this.portal.dompetAnak(schema, wali.wali_id, santriId);
  }
}
