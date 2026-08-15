import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Permissions, RequestContext, type RequestMeta } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HospitalityNightAuditService } from './hospitality-night-audit.service';
function schema(user: AuthenticatedUser) { if (!user.schemaName) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan.'); return user.schemaName; }
@ApiTags('hospitality-night-audit') @ApiBearerAuth('access-token') @Controller('hospitality/night-audit')
export class HospitalityNightAuditController {
  constructor(private readonly service: HospitalityNightAuditService) {}
  @Permissions('HOSPITALITY_NIGHT_AUDIT.CREATE') @Post() start(@Body() body: any, @RequestContext() meta: RequestMeta, @CurrentUser() user: AuthenticatedUser) { return this.service.start(schema(user), body, meta.idempotencyKey, user.userId); }
  @Permissions('HOSPITALITY_NIGHT_AUDIT.READ') @Get(':id') detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.service.detail(schema(user), id); }
  @Permissions('HOSPITALITY_NIGHT_AUDIT.POST') @Post(':id/steps/:step') step(@Param('id') id: string, @Param('step') step: string, @RequestContext() meta: RequestMeta, @CurrentUser() user: AuthenticatedUser) { return this.service.executeStep(schema(user), id, step, meta.idempotencyKey); }
  @Permissions('HOSPITALITY_NIGHT_AUDIT.UPDATE') @Post('exceptions/:id/resolve') resolve(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthenticatedUser) { return this.service.resolveException(schema(user), id, body.resolution, user.userId); }
  @Permissions('HOSPITALITY_NIGHT_AUDIT.APPROVE') @Post(':id/finalize') finalize(@Param('id') id: string, @Headers('x-step-up-reference') stepUp: string | undefined, @CurrentUser() user: AuthenticatedUser) { return this.service.finalize(schema(user), id, stepUp, user.userId); }
  @Permissions('HOSPITALITY_NIGHT_AUDIT.REVIEW') @Post(':id/income-review') review(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthenticatedUser) { return this.service.review(schema(user), id, body, user.userId); }
}
