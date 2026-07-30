import { Body, Controller, Get, HttpCode, Module, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { MarketplaceDomainVerificationMethod, MarketplaceStoreStatus } from '@prisma/client';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  Permissions,
  PlatformPermissions,
  Public,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorefrontResolverService } from './storefront-resolver.service';
import { StoreDomainService } from './store-domain.service';
import { normalizeStoreSlug } from './host.util';

class CreateStoreDto {
  @ApiProperty({ minLength: 3, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  storeName!: string;

  @ApiProperty({ minLength: 3, maxLength: 64, description: 'Alamat toko pada marketplace.' })
  @IsString()
  @IsNotEmpty()
  storeSlug!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline?: string;
}

class RegisterDomainDto {
  @ApiProperty({ maxLength: 255, example: 'tokojoni.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  host!: string;

  @ApiPropertyOptional({ enum: MarketplaceDomainVerificationMethod })
  @IsOptional()
  @IsEnum(MarketplaceDomainVerificationMethod)
  method?: MarketplaceDomainVerificationMethod;
}

class RevokeDomainDto {
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
// Publik: resolusi konteks storefront
// ---------------------------------------------------------------------------

@ApiTags('storefront')
@Controller('storefront')
export class PublicStorefrontController {
  constructor(private readonly resolver: StorefrontResolverService) {}

  @Get('context')
  @Public()
  @ApiOperation({
    summary: 'Konteks storefront untuk host permintaan',
    description:
      'Menentukan toko mana yang ditampilkan. Host yang tidak terdaftar atau belum ' +
      'terverifikasi ditolak — tidak pernah diarahkan ke toko bawaan.',
  })
  async context(@Req() request: Request, @Query('slug') slug?: string) {
    const result = await this.resolver.resolve(request.headers.host, slug);
    if (!result.ok) {
      this.resolver.logRejection(result, request.headers.host);
      // Alasan penolakan tidak dikembalikan: memberi tahu penyerang mengapa
      // tebakannya gagal mempermudah tebakan berikutnya.
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Toko tidak ditemukan pada alamat ini.');
    }

    // `schemaName` sengaja tidak ikut dikembalikan. Pengunjung tidak pernah
    // perlu tahu nama schema, dan mengirimkannya membuka jalan untuk mencoba
    // memakainya pada permintaan lain.
    return {
      mode: result.mode,
      host: result.host,
      canonicalHost: result.canonicalHost,
      storeId: result.storeId,
      storeSlug: result.storeSlug,
      storeName: result.storeName,
    };
  }
}

// ---------------------------------------------------------------------------
// Sisi tenant: toko dan domain
// ---------------------------------------------------------------------------

@ApiTags('storefront')
@ApiBearerAuth('access-token')
@Controller('seller/store')
export class SellerStoreController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domains: StoreDomainService,
  ) {}

  /** Toko milik tenant saat ini; menolak bila tenant belum menjadi seller. */
  private async storeOf(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const store = await this.prisma.marketplaceStore.findFirst({
      where: { seller: { tenantId }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!store) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tenant ini belum memiliki toko online.');
    }
    return store;
  }

  @Get()
  @Permissions('ONLINE_STORE_PROFILE.READ')
  @ApiOperation({ summary: 'Profil toko online tenant' })
  async get(@CurrentUser() user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const store = await this.prisma.marketplaceStore.findFirst({
      where: { seller: { tenantId }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return store ?? { configured: false };
  }

  @Post()
  @Permissions('ONLINE_STORE_PROFILE.UPDATE')
  @BlockDemo()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Membuat toko online',
    description: 'Slug divalidasi ketat dan tidak boleh memakai jalur yang dicadangkan platform.',
  })
  async create(
    @Body() dto: CreateStoreDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const tenantId = requireTenant(user);
    const slug = normalizeStoreSlug(dto.storeSlug);
    if (!slug.ok) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Slug tidak valid: ${slug.reason}`);
    }

    const seller = await this.prisma.marketplaceSeller.findFirst({
      where: { tenantId, deletedAt: null },
    });
    if (!seller) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Daftarkan tenant ke marketplace terlebih dahulu pada Pusat Aktivasi.',
      );
    }

    const taken = await this.prisma.marketplaceStore.findFirst({
      where: { storeSlug: slug.host!, deletedAt: null },
    });
    if (taken) {
      throw AppError.conflict(ErrorCodes.CONFLICT, `Alamat toko "${slug.host}" sudah dipakai.`);
    }

    void meta;
    return this.prisma.marketplaceStore.create({
      data: {
        sellerId: seller.id,
        storeSlug: slug.host!,
        storeName: dto.storeName,
        tagline: dto.tagline ?? null,
        status: MarketplaceStoreStatus.DRAFT,
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    });
  }

  @Get('domains')
  @Permissions('ONLINE_STORE_DOMAIN.READ')
  @ApiOperation({ summary: 'Domain toko beserta petunjuk verifikasinya' })
  async listDomains(@CurrentUser() user: AuthenticatedUser) {
    const store = await this.storeOf(user);
    return this.domains.listForStore(store.id);
  }

  @Post('domains')
  @Permissions('ONLINE_STORE_DOMAIN.CREATE')
  @BlockDemo()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Mendaftarkan domain toko',
    description:
      'Domain belum dilayani sampai kepemilikannya terbukti. Respons memuat petunjuk ' +
      'TXT record atau berkas yang harus dipasang.',
  })
  async registerDomain(
    @Body() dto: RegisterDomainDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const store = await this.storeOf(user);
    return this.domains.register(store.id, dto.host, { method: dto.method }, actorOf(user, meta));
  }

  @Post('domains/:id/verify')
  @Permissions('ONLINE_STORE_DOMAIN.UPDATE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({ summary: 'Memeriksa kepemilikan domain' })
  async verifyDomain(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    await this.assertOwnsDomain(user, id);
    return this.domains.verify(id, actorOf(user, meta));
  }

  @Post('domains/:id/primary')
  @Permissions('ONLINE_STORE_DOMAIN.UPDATE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({ summary: 'Menjadikan domain sebagai domain utama' })
  async setPrimary(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    await this.assertOwnsDomain(user, id);
    return this.domains.setPrimary(id, actorOf(user, meta));
  }

  @Post('domains/:id/revoke')
  @Permissions('ONLINE_STORE_DOMAIN.DELETE')
  @BlockDemo()
  @HttpCode(200)
  @ApiOperation({ summary: 'Mencabut domain' })
  async revokeDomain(
    @Param('id') id: string,
    @Body() dto: RevokeDomainDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    await this.assertOwnsDomain(user, id);
    return this.domains.revoke(id, dto.reason, actorOf(user, meta));
  }

  /**
   * Memastikan domain benar-benar milik toko tenant pemanggil.
   *
   * Tanpa ini, id domain yang ditebak memungkinkan satu tenant mencabut atau
   * memverifikasi domain tenant lain.
   */
  private async assertOwnsDomain(user: AuthenticatedUser, domainId: string): Promise<void> {
    const store = await this.storeOf(user);
    const domain = await this.prisma.marketplaceStoreDomain.findUnique({
      where: { id: domainId },
      select: { storeId: true },
    });
    if (!domain || domain.storeId !== store.id) {
      // Pesannya sama dengan "tidak ditemukan" agar keberadaan domain milik
      // tenant lain tidak dapat disimpulkan dari perbedaan jawaban.
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Domain tidak ditemukan.');
    }
  }
}

// ---------------------------------------------------------------------------
// Sisi platform
// ---------------------------------------------------------------------------

@ApiTags('storefront')
@ApiBearerAuth('access-token')
@Controller('platform/marketplace/domains')
export class PlatformStoreDomainController {
  constructor(private readonly domains: StoreDomainService) {}

  @Get(':id')
  @PlatformPermissions('PLATFORM.MARKETPLACE.READ')
  @ApiOperation({ summary: 'Detail domain beserta riwayat verifikasinya' })
  get(@Param('id') id: string) {
    return this.domains.load(id);
  }

  @Post(':id/revoke')
  @PlatformPermissions('PLATFORM.MARKETPLACE.SUSPEND')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mencabut domain atas keputusan platform' })
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeDomainDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.domains.revoke(id, dto.reason, actorOf(user, meta));
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [PublicStorefrontController, SellerStoreController, PlatformStoreDomainController],
  providers: [StorefrontResolverService, StoreDomainService],
  exports: [StorefrontResolverService, StoreDomainService],
})
export class StorefrontModule {}
