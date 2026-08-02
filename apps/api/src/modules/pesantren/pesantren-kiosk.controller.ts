/**
 * Titik masuk HTTP anjungan mandiri (EP-M). Dipanggil akun perangkat kiosk
 * (`EPESANTREN_SERVICE_ACCOUNT_KIOSK`), bukan santri secara pribadi.
 */

import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PesantrenKioskService } from './pesantren-kiosk.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

@ApiTags('pesantren-kiosk')
@ApiBearerAuth('access-token')
@Controller('pesantren/kiosk')
export class PesantrenKioskController {
  constructor(private readonly kiosk: PesantrenKioskService) {}

  @Permissions('EPESANTREN_KIOSK.READ')
  @Get('kartu/:nomorKartu')
  @ApiOperation({ summary: 'Cuplikan data diri pemegang kartu yang dipindai' })
  pindai(@Param('nomorKartu') nomorKartu: string, @CurrentUser() user: AuthenticatedUser) {
    return this.kiosk.pindaiKartu(schemaWajib(user), nomorKartu);
  }
}
