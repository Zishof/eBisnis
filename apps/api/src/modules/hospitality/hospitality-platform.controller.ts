import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HospitalityPlatformService } from './hospitality-platform.service';

@ApiTags('hospitality-platform')
@ApiBearerAuth('access-token')
@Controller('hospitality/platform')
export class HospitalityPlatformController {
  constructor(private readonly platform: HospitalityPlatformService) {}

  @Get('health')
  @Permissions('HOSPITALITY_PROPERTI.READ')
  @ApiOperation({ summary: 'Health katalog, entitlement, schema, dan usage contract MitraInap' })
  health(@CurrentUser() user: AuthenticatedUser) {
    if (!user.schemaName || !user.tenantId) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks tenant tidak ditemukan pada sesi.');
    }
    return this.platform.health(user.schemaName, user.tenantId);
  }
}
