import { Body, Controller, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MarketplaceEnrollmentStatus } from '@prisma/client';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  Permissions,
  PlatformPermissions,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MarketplaceEnrollmentService } from './marketplace-enrollment.service';
import { MarketplaceReadinessService } from './marketplace-readiness.service';
import { EsmartlinkActivationService } from './esmartlink-activation.service';
import { CredentialResolverService } from './credential-resolver.service';
import {
  PlatformEsmartlinkController,
  SellerEsmartlinkController,
} from './esmartlink-activation.controller';

class EnrollDto {
  @ApiProperty({ example: 'Toko Joni Jaya', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  displayName!: string;

  @ApiPropertyOptional({ example: 'dukungan@tokojoni.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  supportEmail?: string;

  @ApiPropertyOptional({ example: '+628123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  supportPhone?: string;
}

class TransitionDto {
  @ApiProperty({ enum: MarketplaceEnrollmentStatus })
  @IsEnum(MarketplaceEnrollmentStatus)
  toStatus!: MarketplaceEnrollmentStatus;

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
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
// Controller seller: dipakai tenant untuk mendaftar dan memantau kesiapannya
// ---------------------------------------------------------------------------

@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@Controller('seller/marketplace')
export class SellerMarketplaceController {
  constructor(private readonly enrollment: MarketplaceEnrollmentService) {}

  @Get('enrollment')
  @Permissions('MARKETPLACE_ENROLLMENT.READ')
  @ApiOperation({ summary: 'Pendaftaran marketplace milik tenant saat ini' })
  async get(@CurrentUser() user: AuthenticatedUser) {
    const seller = await this.enrollment.findByTenant(requireTenant(user));
    return seller ?? { enrolled: false };
  }

  @Post('enrollment')
  @Permissions('MARKETPLACE_ENROLLMENT.CREATE')
  @BlockDemo()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Mendaftarkan tenant ke program marketplace',
    description:
      'Idempoten. Memanggilnya berulang mengembalikan pendaftaran yang sama, ' +
      'bukan membuat berkas kedua.',
  })
  create(
    @Body() dto: EnrollDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.enrollment.enroll(requireTenant(user), dto, actorOf(user, meta));
  }

  @Get('readiness')
  @Permissions('MARKETPLACE_READINESS.READ')
  @ApiOperation({ summary: 'Pemeriksaan kesiapan seller beserta alasannya' })
  async readiness(@CurrentUser() user: AuthenticatedUser) {
    const seller = await this.enrollment.findByTenant(requireTenant(user));
    if (!seller) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tenant belum mendaftar ke marketplace.');
    }
    return this.enrollment.readinessFor(seller.id);
  }

  @Post('readiness/refresh')
  @Permissions('MARKETPLACE_READINESS.READ', 'MARKETPLACE_ENROLLMENT.UPDATE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Memeriksa ulang kesiapan dan memperbarui status pendaftaran',
    description: 'Status ditentukan hasil pemeriksaan, bukan dipilih pengguna.',
  })
  async refresh(@CurrentUser() user: AuthenticatedUser, @RequestContext() meta: RequestMeta) {
    const seller = await this.enrollment.findByTenant(requireTenant(user));
    if (!seller) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tenant belum mendaftar ke marketplace.');
    }
    return this.enrollment.refreshReadiness(seller.id, actorOf(user, meta));
  }

  @Post('enrollment/submit')
  @Permissions('MARKETPLACE_ENROLLMENT.SUBMIT')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengajukan pendaftaran untuk ditinjau platform' })
  async submit(@CurrentUser() user: AuthenticatedUser, @RequestContext() meta: RequestMeta) {
    const seller = await this.enrollment.findByTenant(requireTenant(user));
    if (!seller) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tenant belum mendaftar ke marketplace.');
    }

    // Kesiapan diperiksa ulang lebih dulu supaya pengajuan tidak lolos hanya
    // karena hasil pemeriksaan lama masih tersimpan.
    const report = await this.enrollment.readinessFor(seller.id);
    if (!report.readyForReview) {
      const pending = report.checks
        .filter((c) => c.blocking && c.status !== 'PASS')
        .map((c) => c.label);
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Pendaftaran belum dapat diajukan. Belum terpenuhi: ${pending.join('; ')}.`,
        { pending: report.checks.filter((c) => c.blocking && c.status !== 'PASS') },
      );
    }

    return this.enrollment.transition(
      seller.id,
      MarketplaceEnrollmentStatus.UNDER_REVIEW,
      'Diajukan oleh tenant.',
      actorOf(user, meta),
    );
  }
}

// ---------------------------------------------------------------------------
// Controller platform: dipakai admin untuk meninjau dan memutuskan
// ---------------------------------------------------------------------------

@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@Controller('platform/marketplace')
export class PlatformMarketplaceController {
  constructor(private readonly enrollment: MarketplaceEnrollmentService) {}

  @Get('sellers/:id')
  @PlatformPermissions('PLATFORM.MARKETPLACE.READ')
  @ApiOperation({ summary: 'Detail seller beserta riwayat pendaftarannya' })
  get(@Param('id') id: string) {
    return this.enrollment.load(id);
  }

  @Get('sellers/:id/readiness')
  @PlatformPermissions('PLATFORM.MARKETPLACE.READ')
  @ApiOperation({ summary: 'Hasil pemeriksaan kesiapan seller' })
  readiness(@Param('id') id: string) {
    return this.enrollment.readinessFor(id);
  }

  @Post('sellers/:id/transition')
  @PlatformPermissions('PLATFORM.MARKETPLACE.APPROVE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Memindahkan status pendaftaran seller',
    description: 'Transisi yang tidak sah ditolak beserta daftar status yang mungkin.',
  })
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.enrollment.transition(id, dto.toStatus, dto.reason, actorOf(user, meta));
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [
    SellerMarketplaceController,
    PlatformMarketplaceController,
    SellerEsmartlinkController,
    PlatformEsmartlinkController,
  ],
  providers: [
    MarketplaceEnrollmentService,
    MarketplaceReadinessService,
    EsmartlinkActivationService,
    CredentialResolverService,
  ],
  exports: [
    MarketplaceEnrollmentService,
    MarketplaceReadinessService,
    EsmartlinkActivationService,
    CredentialResolverService,
  ],
})
export class MarketplaceModule {}
