import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ProviderEnvironment, StepUpPurpose } from '@prisma/client';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  Permissions,
  PlatformPermissions,
  RequestContext,
  RequestMeta,
  RequireStepUp,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { EsmartlinkActivationService } from './esmartlink-activation.service';

class RequestActivationDto {
  @ApiPropertyOptional({ enum: ProviderEnvironment, default: ProviderEnvironment.SANDBOX })
  @IsOptional()
  @IsEnum(ProviderEnvironment)
  environment?: ProviderEnvironment;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Keterangan tambahan untuk tim dukungan.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/**
 * Credential dikirim lewat DTO ini dan hanya lewat DTO ini.
 *
 * Tidak ada endpoint yang mengembalikannya. Tidak ada catatan tiket yang
 * memuatnya. Nilai yang masuk langsung disandikan dan yang keluar hanyalah
 * petunjuk empat karakter.
 */
class SetCredentialDto {
  @ApiPropertyOptional({ minLength: 8, maxLength: 512 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  MERCHANT_KEY?: string;

  @ApiPropertyOptional({ minLength: 8, maxLength: 512 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  SECRET_KEY?: string;
}

class HealthCheckDto {
  @ApiProperty({ enum: ['CREATE_ORDER', 'CALLBACK', 'INQUIRY'] })
  @IsIn(['CREATE_ORDER', 'CALLBACK', 'INQUIRY'])
  @IsNotEmpty()
  checkType!: string;
}

function requireTenant(user: AuthenticatedUser): string {
  if (!user.tenantId) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terhubung ke tenant mana pun.');
  }
  return user.tenantId;
}

const actorOf = (user: AuthenticatedUser, meta: RequestMeta) => ({
  userId: user.userId,
  username: user.username,
  requestId: meta.requestId,
});

// ---------------------------------------------------------------------------
// Sisi tenant
// ---------------------------------------------------------------------------

@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@Controller('seller/marketplace/esmartlink')
export class SellerEsmartlinkController {
  constructor(private readonly activation: EsmartlinkActivationService) {}

  @Get('capability')
  @Permissions('ESMARTLINK_ACCOUNT.READ')
  @ApiOperation({
    summary: 'Mode onboarding yang berlaku',
    description:
      'Menyatakan metode mana yang benar-benar tersedia. Mode MANUAL_TICKET berarti ' +
      'aktivasi berjalan lewat tiket dukungan, bukan panggilan API.',
  })
  capability() {
    return this.activation.capability();
  }

  @Get('account')
  @Permissions('ESMARTLINK_ACCOUNT.READ')
  @ApiOperation({
    summary: 'Akun eSmartlink tenant',
    description: 'Tidak pernah memuat nilai credential; hanya petunjuk empat karakter terakhir.',
  })
  async account(
    @Query('environment') environment: ProviderEnvironment | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const account = await this.activation.findAccountForTenant(requireTenant(user), environment);
    return account ?? { configured: false };
  }

  @Post('activation-ticket')
  @Permissions('ESMARTLINK_ACCOUNT.CREATE')
  @BlockDemo()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Membuat tiket aktivasi eSmartlink',
    description:
      'Idempoten. Tiket yang masih terbuka untuk akun yang sama dikembalikan alih-alih ' +
      'dibuat ulang, sehingga antrean dukungan tidak terisi tiket kembar.',
  })
  requestActivation(
    @Body() dto: RequestActivationDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.activation.requestActivation(requireTenant(user), dto, actorOf(user, meta));
  }
}

// ---------------------------------------------------------------------------
// Sisi platform: credential dan aktivasi
// ---------------------------------------------------------------------------

@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@Controller('platform/marketplace/esmartlink')
export class PlatformEsmartlinkController {
  constructor(private readonly activation: EsmartlinkActivationService) {}

  @Get('accounts/:id')
  @PlatformPermissions('PLATFORM.MARKETPLACE.READ')
  @ApiOperation({ summary: 'Detail akun provider tenant' })
  account(@Param('id') id: string) {
    return this.activation.loadAccount(id);
  }

  @Post('accounts/:id/credentials')
  @PlatformPermissions('PLATFORM.ESMARTLINK.MANAGE')
  @RequireStepUp(StepUpPurpose.CREDENTIAL_MANAGE)
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyimpan atau merotasi credential',
    description:
      'Menuntut step-up. Nilai lama tidak ditimpa: versi baru dibuat dan versi ' +
      'sebelumnya dinonaktifkan, sehingga rotasi yang keliru dapat dikembalikan. ' +
      'Respons hanya memuat petunjuk empat karakter terakhir.',
  })
  setCredentials(
    @Param('id') id: string,
    @Body() dto: SetCredentialDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.activation.setCredentials(id, dto, actorOf(user, meta));
  }

  @Post('accounts/:id/health-check')
  @PlatformPermissions('PLATFORM.ESMARTLINK.MANAGE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menjalankan uji kesehatan akun',
    description: 'Ringkasan yang disimpan hanya memuat nama field yang dipakai, bukan nilainya.',
  })
  healthCheck(
    @Param('id') id: string,
    @Body() dto: HealthCheckDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.activation.runHealthCheck(id, dto.checkType, actorOf(user, meta));
  }

  @Post('accounts/:id/activate')
  @PlatformPermissions('PLATFORM.MARKETPLACE.APPROVE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mengaktifkan akun provider',
    description: 'Menuntut uji kesehatan yang lulus lebih dahulu.',
  })
  activate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.activation.activate(id, actorOf(user, meta));
  }
}
