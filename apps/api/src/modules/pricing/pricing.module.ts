import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingInterval, SubscriptionPaymentMode } from '@prisma/client';
import { PricingEngineService } from './pricing-engine.service';
import { DiscountEvaluatorService } from './discount-evaluator.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  AuthenticatedUser,
  CurrentUser,
  PlatformPermissions,
  Public,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

class SimulateQuoteDto {
  @ApiProperty({ example: 'POS_BUSINESS' })
  @IsString()
  @MaxLength(48)
  planCode!: string;

  @ApiPropertyOptional({ enum: SubscriptionPaymentMode, default: 'CONSOLIDATED_ALL_DEVICES' })
  @IsOptional()
  @IsEnum(SubscriptionPaymentMode)
  paymentMode?: SubscriptionPaymentMode;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  deviceIds?: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity?: number;

  @ApiPropertyOptional({ enum: BillingInterval, default: 'MONTH' })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  billingIntervalCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  promoCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  channelCode?: string;

  @ApiPropertyOptional({ description: 'Hanya untuk simulasi platform admin.' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

@ApiTags('pricing')
@Controller()
export class PricingController {
  constructor(
    private readonly engine: PricingEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('platform/modules')
  @ApiOperation({ summary: 'Katalog modul ERP global' })
  listModules() {
    return this.prisma.moduleCatalog.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        features: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          select: { code: true, name: true, nameKey: true, featureType: true, defaultLimit: true, unit: true },
        },
      },
    });
  }

  @Public()
  @Get('platform/features')
  @ApiOperation({ summary: 'Katalog fitur granular' })
  listFeatures() {
    return this.prisma.featureCatalog.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { module: { select: { code: true, name: true } } },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PRICING.READ')
  @Get('platform/subscription-plans')
  @ApiOperation({ summary: 'Daftar paket beserta seluruh versi' })
  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        product: { select: { code: true, name: true } },
        versions: {
          where: { deletedAt: null },
          orderBy: { versionNumber: 'desc' },
          include: {
            prices: { include: { tiers: { orderBy: { minQuantity: 'asc' } } } },
            modules: { include: { module: { select: { code: true, name: true } } } },
            features: { include: { feature: { select: { code: true, name: true } } } },
            constraints: true,
          },
        },
      },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PRICING.READ')
  @Get('platform/subscription-plans/:id')
  @ApiOperation({ summary: 'Detail satu paket' })
  async getPlan(@Param('id') id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            prices: { include: { tiers: true } },
            modules: { include: { module: true } },
            features: { include: { feature: true } },
            constraints: true,
          },
        },
      },
    });
    if (!plan) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Paket tidak ditemukan.');
    return plan;
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.DISCOUNT.READ')
  @Get('platform/discount-programs')
  @ApiOperation({ summary: 'Program diskon beserta rule dan kondisi' })
  listDiscountPrograms() {
    return this.prisma.discountProgram.findMany({
      where: { deletedAt: null },
      orderBy: { priority: 'asc' },
      include: {
        rules: {
          where: { deletedAt: null },
          orderBy: { sequence: 'asc' },
          include: {
            benefits: { orderBy: { sequence: 'asc' } },
            conditionGroups: { include: { conditions: { orderBy: { sequence: 'asc' } } } },
          },
        },
        promoCodes: { where: { deletedAt: null } },
      },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PRICING.READ')
  @Post('platform/pricing/simulate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Simulasi harga dengan explanation trace',
    description:
      'Menjalankan price waterfall lengkap: base price, volume tier, tenant override, ' +
      'diskon, pajak, dan biaya admin channel.',
  })
  async simulate(@Body() dto: SimulateQuoteDto, @CurrentUser() user: AuthenticatedUser) {
    const tenantId = dto.tenantId ?? user.tenantId;
    if (!tenantId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'tenantId wajib diisi untuk simulasi tanpa konteks tenant.',
      );
    }
    return this.engine.calculate({
      tenantId,
      planCode: dto.planCode,
      paymentMode: dto.paymentMode ?? 'CONSOLIDATED_ALL_DEVICES',
      deviceIds: dto.deviceIds,
      quantity: dto.quantity,
      billingInterval: dto.billingInterval,
      billingIntervalCount: dto.billingIntervalCount,
      promoCode: dto.promoCode,
      channelCode: dto.channelCode,
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.DISCOUNT.READ')
  @Post('platform/discount-programs/:id/simulate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Simulasi satu program diskon terhadap parameter quote' })
  async simulateDiscount(
    @Param('id') id: string,
    @Body() dto: SimulateQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Evaluasi pada trace memakai kode program, sedangkan endpoint memakai id;
    // kode dicari lebih dulu agar penyaringan benar-benar terjadi.
    const program = await this.prisma.discountProgram.findUnique({
      where: { id },
      select: { code: true, name: true, stackPolicy: true, priority: true },
    });
    if (!program) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Program diskon tidak ditemukan.');
    }

    const result = await this.simulate(dto, user);
    return {
      programId: id,
      programCode: program.code,
      programName: program.name,
      stackPolicy: program.stackPolicy,
      priority: program.priority,
      evaluations: result.trace.discountEvaluations.filter(
        (evaluation) => evaluation.programCode === program.code,
      ),
      appliedAdjustments: result.adjustments.filter((adjustment) => adjustment.sourceId === id),
      grandTotal: result.grandTotal,
      discountTotal: result.discountTotal,
    };
  }

  @Public()
  @Get('public/pricing/preview')
  @ApiOperation({
    summary: 'Pratinjau harga publik untuk sejumlah perangkat',
    description: 'Dipakai kartu harga pada website agar angka selalu berasal dari pricing engine.',
  })
  async publicPreview(
    @Query('planCode') planCode: string,
    @Query('quantity') quantity?: string,
  ) {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { code: planCode, status: 'PUBLISHED', isPublic: true, deletedAt: null },
      include: {
        versions: {
          where: { status: 'PUBLISHED', deletedAt: null },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: { prices: { include: { tiers: { orderBy: { minQuantity: 'asc' } } } } },
        },
      },
    });
    const plan = plans[0];
    if (!plan?.versions.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Paket tidak ditemukan.');
    }
    const price = plan.versions[0].prices.find(
      (p) => p.billingInterval === 'MONTH' && p.intervalCount === 1,
    );
    if (!price) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Harga paket belum tersedia.');

    const qty = Math.max(1, Number(quantity ?? 1) || 1);
    const tier = price.tiers.find(
      (t) => qty >= t.minQuantity && (t.maxQuantity === null || qty <= t.maxQuantity),
    );
    const unitPrice = tier?.unitPrice ?? price.unitPrice;

    return {
      planCode: plan.code,
      quantity: qty,
      currencyCode: price.currencyCode,
      unitPrice: unitPrice.toFixed(),
      subtotal: unitPrice.mul(qty).toFixed(),
      tierApplied: tier
        ? { minQuantity: tier.minQuantity, maxQuantity: tier.maxQuantity }
        : null,
      note: 'Harga dasar sebelum pajak, biaya administrasi, dan promo.',
    };
  }
}

@Module({
  controllers: [PricingController],
  providers: [PricingEngineService, DiscountEvaluatorService],
  exports: [PricingEngineService, DiscountEvaluatorService],
})
export class PricingModule {}
