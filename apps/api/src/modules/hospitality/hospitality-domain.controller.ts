import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, BlockDemo, CurrentUser, Permissions, PlatformPermissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HospitalityDomainService } from './hospitality-domain.service';

function tenant(user: AuthenticatedUser): string {
  if (!user.tenantId) throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks tenant tidak ditemukan.');
  return user.tenantId;
}

@ApiTags('hospitality-domain')
@ApiBearerAuth('access-token')
@Controller('hospitality/domains')
export class HospitalityDomainController {
  constructor(private readonly domains: HospitalityDomainService) {}

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.domains.list(tenant(user)); }

  @BlockDemo()
  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post()
  register(@Body() body: { host?: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.domains.register(tenant(user), body.host ?? '');
  }

  @BlockDemo()
  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':id/verify')
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.domains.verify(tenant(user), id); }

  @BlockDemo()
  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Delete(':id')
  revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.domains.revoke(tenant(user), id); }

  @BlockDemo()
  @PlatformPermissions('PLATFORM.TENANT.ACTIVATE')
  @Post(':id/tls-activation')
  activateTls(@Param('id') id: string, @Body() body: { providerReference?: string; certificateExpiresAt?: string }) {
    return this.domains.activateTls(id, body.providerReference ?? '', body.certificateExpiresAt ?? '');
  }
}
