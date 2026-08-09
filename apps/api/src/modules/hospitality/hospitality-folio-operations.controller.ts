import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Permissions, RequestContext, type RequestMeta } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HospitalityFolioService } from './hospitality-folio.service';

function tenantSchema(user: AuthenticatedUser) {
  if (!user.schemaName) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan.');
  return user.schemaName;
}

@ApiTags('hospitality-folio-operations')
@ApiBearerAuth('access-token')
@Controller('hospitality/folio-operations')
export class HospitalityFolioOperationsController {
  constructor(private readonly service: HospitalityFolioService) {}

  @Permissions('HOSPITALITY_FOLIO.UPDATE')
  @Post(':folioId/windows')
  addWindow(@Param('folioId') folioId: string, @Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addWindow(tenantSchema(user), folioId, body);
  }

  @Permissions('HOSPITALITY_FOLIO.UPDATE')
  @Post(':folioId/routing')
  addRouting(@Param('folioId') folioId: string, @Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addRouting(tenantSchema(user), folioId, body, user.userId);
  }

  @Permissions('HOSPITALITY_FOLIO.POST')
  @Post(':folioId/transfer')
  transfer(@Param('folioId') folioId: string, @Body() body: any, @RequestContext() meta: RequestMeta, @CurrentUser() user: AuthenticatedUser) {
    return this.service.transferBalance(tenantSchema(user), folioId, body, meta.idempotencyKey, user.userId);
  }

  @Permissions('HOSPITALITY_FOLIO.CREATE')
  @Post('city-ledger')
  cityLedger(@Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCityLedger(tenantSchema(user), body, user.userId);
  }

  @Permissions('HOSPITALITY_FOLIO.POST')
  @Post(':folioId/shifts/:shiftId/transactions')
  postFromShift(@Param('folioId') folioId: string, @Param('shiftId') shiftId: string, @Body() body: any, @RequestContext() meta: RequestMeta, @CurrentUser() user: AuthenticatedUser) {
    return this.service.postFromShift(tenantSchema(user), folioId, shiftId, body, meta.idempotencyKey, user.userId);
  }
}
