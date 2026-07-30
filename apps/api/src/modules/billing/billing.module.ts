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
import { BillingInterval, Prisma, SubscriptionPaymentMode } from '@prisma/client';
import { BillingService } from './billing.service';
import { PricingModule } from '../pricing/pricing.module';
import { PricingEngineService } from '../pricing/pricing-engine.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

class CreateQuoteDto {
  @ApiProperty({ example: 'POS_BUSINESS' })
  @IsString()
  @MaxLength(48)
  planCode!: string;

  @ApiProperty({ enum: SubscriptionPaymentMode })
  @IsEnum(SubscriptionPaymentMode)
  paymentMode!: SubscriptionPaymentMode;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  deviceIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity?: number;

  @ApiPropertyOptional({ enum: BillingInterval })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional()
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
}

class RegisterDeviceDto {
  @ApiProperty({ example: 'POS-001' })
  @IsString()
  @MaxLength(48)
  code!: string;

  @ApiProperty({ example: 'Kasir Depan' })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  outletCode?: string;
}

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly engine: PricingEngineService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Perangkat POS -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Get('devices')
  @ApiOperation({ summary: 'Daftar perangkat POS tenant' })
  async listDevices(@CurrentUser() user: AuthenticatedUser) {
    requireTenant(user);
    return this.prisma.posDevice.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { code: 'asc' },
      include: {
        entitlements: {
          where: { status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] } },
          select: { moduleCode: true, status: true, endsAt: true },
        },
      },
    });
  }

  @ApiBearerAuth('access-token')
  @BlockDemo()
  @Post('devices')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mendaftarkan perangkat POS baru' })
  registerDevice(@Body() dto: RegisterDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    requireTenant(user);
    return this.billing.registerDevice(user.tenantId!, dto, user.userId);
  }

  @ApiBearerAuth('access-token')
  @BlockDemo()
  @Post('devices/:id/revoke')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mencabut perangkat POS' })
  revokeDevice(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    requireTenant(user);
    return this.billing.revokeDevice(user.tenantId!, id, body?.reason, user.userId);
  }

  // --- Quote ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Post('subscriptions/quotes')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Membuat quote langganan dengan explanation trace',
    description: 'Quote menyimpan snapshot paket, modul, harga, diskon, pajak, dan biaya admin.',
  })
  async createQuote(
    @Body() dto: CreateQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    requireTenant(user);
    return this.billing.createQuote(user.tenantId!, dto, {
      actorUserId: user.userId,
      idempotencyKey: meta.idempotencyKey,
    });
  }

  @ApiBearerAuth('access-token')
  @Get('subscriptions/quotes/:id')
  @ApiOperation({ summary: 'Detail quote' })
  async getQuote(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const quote = await this.prisma.pricingQuote.findUnique({
      where: { id },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, adjustments: { orderBy: { sequence: 'asc' } } },
    });
    if (!quote || (!user.isPlatformStaff && quote.tenantId !== user.tenantId)) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Quote tidak ditemukan.');
    }
    return quote;
  }

  @ApiBearerAuth('access-token')
  @BlockDemo()
  @Post('subscriptions/quotes/:id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menerima quote dan menerbitkan invoice immutable' })
  acceptQuote(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    requireTenant(user);
    return this.billing.acceptQuote(user.tenantId!, id, user.userId);
  }

  // --- Subscription dan invoice -------------------------------------------

  @ApiBearerAuth('access-token')
  @Get('subscriptions')
  @ApiOperation({ summary: 'Daftar langganan tenant' })
  listSubscriptions(@CurrentUser() user: AuthenticatedUser) {
    requireTenant(user);
    return this.prisma.subscription.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        planVersion: { include: { plan: { select: { code: true, name: true } } } },
        items: { include: { device: { select: { code: true, label: true } } } },
      },
    });
  }

  @ApiBearerAuth('access-token')
  @Get('billing/invoices')
  @ApiOperation({ summary: 'Daftar invoice langganan' })
  listInvoices(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    requireTenant(user);
    return this.prisma.billingInvoice.findMany({
      where: {
        tenantId: user.tenantId!,
        ...(status ? { status: status as Prisma.EnumInvoiceStatusFilter } : {}),
      },
      orderBy: { issueDate: 'desc' },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  @ApiBearerAuth('access-token')
  @Get('billing/invoices/:id')
  @ApiOperation({ summary: 'Detail invoice' })
  async getInvoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const invoice = await this.prisma.billingInvoice.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        allocations: true,
        receipts: true,
        paymentOrders: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice || (!user.isPlatformStaff && invoice.tenantId !== user.tenantId)) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Invoice tidak ditemukan.');
    }
    return invoice;
  }

  @ApiBearerAuth('access-token')
  @Get('devices/:id/entitlements')
  @ApiOperation({ summary: 'Hak akses efektif satu perangkat POS' })
  async deviceEntitlements(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const device = await this.prisma.posDevice.findUnique({ where: { id } });
    if (!device || (!user.isPlatformStaff && device.tenantId !== user.tenantId)) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perangkat tidak ditemukan.');
    }
    return this.billing.resolveDeviceEntitlements(id);
  }
}

function requireTenant(user: AuthenticatedUser): void {
  if (!user.tenantId) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terhubung ke tenant mana pun.');
  }
}

@Module({
  imports: [PricingModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
