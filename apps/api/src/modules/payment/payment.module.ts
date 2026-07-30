import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Module,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EsmartlinkClient } from './esmartlink/esmartlink.client';
import { EsmartlinkPaymentService } from './esmartlink/esmartlink-payment.service';
import { parseLegacyChannelConfig, LEGACY_EXPIRY_OPTIONS } from './esmartlink/esmartlink-channel.parser';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  PlatformPermissions,
  Public,
  RequireStepUp,
} from '../../common/decorators';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

class CreatePaymentOrderDto {
  @ApiProperty()
  @IsUUID()
  invoiceId!: string;

  @ApiPropertyOptional({ example: 'VA_BCA' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  channelCode?: string;

  @ApiPropertyOptional({ enum: LEGACY_EXPIRY_OPTIONS.map((o) => o.code), example: 'HOUR_24' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  expiryCode?: string;
}

class CheckBatchDto {
  @ApiProperty({ type: [String], description: 'Maksimum 300 payment order per batch.' })
  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID('4', { each: true })
  orderIds!: string[];
}

class ImportLegacyChannelDto {
  @ApiProperty({
    example: 'VA_BCA:4000:Virtual Account BCA;VA_BRI:4000:Virtual Account BRI',
    description: 'Format legacy KODE:BIAYA:LABEL dipisahkan titik koma.',
  })
  @IsString()
  @MaxLength(8000)
  rawConfig!: string;
}

@ApiTags('payments')
@Controller()
export class PaymentController {
  constructor(
    private readonly esmartlink: EsmartlinkPaymentService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Callback provider (tanpa auth user, dengan validasi provider) --------

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 240 } })
  @Post('payments/esmartlink/callback')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Callback pembayaran Esmartlink',
    description:
      'Selalu mencatat host-to-host log, memvalidasi provider, mendeduplikasi transaction_id, ' +
      'dan memproses pembayaran secara atomik. ACK provider tidak sama dengan commit bisnis.',
  })
  async callback(@Req() request: Request, @Ip() ip: string) {
    const rawBody =
      typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
    const result = await this.esmartlink.handleCallback(rawBody, {
      remoteIp: resolveRemoteIp(request, ip),
      headers: request.headers as Record<string, unknown>,
      endpoint: '/api/v1/payments/esmartlink/callback',
    });
    // ACK legacy berupa string polos.
    return rawResponse(result.ack);
  }

  // --- Tenant: buat payment order dan cek pembayaran -----------------------

  @ApiBearerAuth('access-token')
  @BlockDemo()
  @Post('billing/invoices/:id/payment-orders')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat payment order Esmartlink untuk sebuah invoice' })
  createOrder(
    @Param('id') invoiceId: string,
    @Body() dto: Omit<CreatePaymentOrderDto, 'invoiceId'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.esmartlink.createOrder({
      invoiceId,
      channelCode: dto.channelCode,
      expiryCode: dto.expiryCode,
      actorUserId: user.userId,
    });
  }

  @ApiBearerAuth('access-token')
  @BlockDemo()
  @Post('payments/esmartlink/orders')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat payment order Esmartlink' })
  createOrderDirect(@Body() dto: CreatePaymentOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.esmartlink.createOrder({ ...dto, actorUserId: user.userId });
  }

  @ApiBearerAuth('access-token')
  @BlockDemo()
  @Post('billing/payment-orders/:id/check-payment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cek pembayaran satu payment order melalui inquiry provider',
    description: 'Hasil inquiry diproses oleh payment callback processor yang sama.',
  })
  checkPayment(@Param('id') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.esmartlink.checkPayment(orderId, {
      source: 'MANUAL_SINGLE',
      actorUserId: user.userId,
    });
  }

  @ApiBearerAuth('access-token')
  @Get('payments/orders/:id')
  @ApiOperation({ summary: 'Detail payment order' })
  async getOrder(@Param('id') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: {
        invoice: { select: { invoiceNumber: true, tenantId: true, status: true } },
        attempts: { orderBy: { occurredAt: 'desc' }, take: 10 },
        transitions: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!order) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Payment order tidak ditemukan.');
    // Cross-tenant ID menghasilkan 404, bukan membocorkan keberadaan data.
    if (!user.isPlatformStaff && order.invoice.tenantId !== user.tenantId) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Payment order tidak ditemukan.');
    }
    return order;
  }

  // --- Platform admin ------------------------------------------------------

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PAYMENT.READ')
  @Get('platform/payment-providers/esmartlink')
  @ApiOperation({ summary: 'Konfigurasi provider Esmartlink' })
  async getProvider() {
    const provider = await this.prisma.paymentProvider.findUnique({
      where: { code: 'ESMARTLINK' },
      include: { channels: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!provider) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Provider belum di-seed.');
    // secretReference hanya berisi nama env var, bukan nilai secret.
    return provider;
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PAYMENT.READ')
  @Get('platform/payment-channels')
  @ApiOperation({ summary: 'Daftar channel pembayaran' })
  listChannels() {
    return this.prisma.paymentChannel.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.ESMARTLINK.MANAGE')
  @BlockDemo()
  @Post('platform/payment-channels/import-legacy-config')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Impor konfigurasi channel format legacy KODE:BIAYA:LABEL',
    description: 'Entri tidak valid dilewati dan dilaporkan, bukan menggagalkan seluruh impor.',
  })
  async importLegacyChannels(
    @Body() dto: ImportLegacyChannelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { code: 'ESMARTLINK' } });
    if (!provider) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Provider belum di-seed.');

    const parsed = parseLegacyChannelConfig(dto.rawConfig);

    for (const [index, channel] of parsed.channels.entries()) {
      await this.prisma.paymentChannel.upsert({
        where: { providerId_code: { providerId: provider.id, code: channel.code } },
        create: {
          providerId: provider.id,
          code: channel.code,
          name: channel.label,
          labelKey: `payment.channel.${channel.code.toLowerCase()}`,
          adminFeeType: 'FIXED',
          adminFeeValue: channel.adminFee,
          expiryOptions: LEGACY_EXPIRY_OPTIONS,
          sortOrder: index + 1,
        },
        update: { name: channel.label, adminFeeValue: channel.adminFee },
      });
    }

    await this.prisma.paymentChannelLegacyConfig.create({
      data: {
        providerId: provider.id,
        rawConfig: dto.rawConfig,
        parsedCount: parsed.channels.length,
        skippedCount: parsed.skipped.length,
        parsedResult: JSON.parse(JSON.stringify(parsed)) as Prisma.InputJsonValue,
        importedBy: user.userId,
      },
    });

    await this.audit.record({
      moduleCode: 'PAYMENT',
      actionCode: 'LEGACY_CHANNEL_IMPORTED',
      entityType: 'PaymentProvider',
      entityId: provider.id,
      actorUserId: user.userId,
      metadata: { parsed: parsed.channels.length, skipped: parsed.skipped.length },
    });

    return { imported: parsed.channels.length, skipped: parsed.skipped };
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PAYMENT.RECONCILE')
  @BlockDemo()
  @Post('platform/payments/check-batches')
  @HttpCode(201)
  @ApiOperation({ summary: 'Cek pembayaran massal (maksimum 300 order)' })
  createCheckBatch(@Body() dto: CheckBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.esmartlink.createCheckBatch({ orderIds: dto.orderIds, actorUserId: user.userId });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PAYMENT.READ')
  @Get('platform/payments/check-batches/:id')
  @ApiOperation({ summary: 'Progress cek pembayaran massal' })
  async getCheckBatch(@Param('id') id: string) {
    const batch = await this.prisma.paymentCheckBatch.findUnique({ where: { id } });
    if (!batch) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Batch tidak ditemukan.');
    return batch;
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PAYMENT.READ')
  @Get('platform/payments/check-batches/:id/items')
  @ApiOperation({ summary: 'Hasil per item cek pembayaran massal' })
  listCheckBatchItems(@Param('id') id: string) {
    return this.prisma.paymentCheckBatchItem.findMany({
      where: { batchId: id },
      orderBy: { sequence: 'asc' },
      include: { order: { select: { orderNumber: true, status: true, totalAmount: true } } },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PAYMENT.READ')
  @Get('platform/payment-h2h-logs')
  @ApiOperation({ summary: 'Log host-to-host inbound provider' })
  listH2hLogs(@Query('limit') limit?: string) {
    return this.prisma.hostToHostLog.findMany({
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Number(limit ?? 100) || 100, 500),
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.PAYMENT.RECONCILE')
  @RequireStepUp('PAYMENT_REPLAY')
  @BlockDemo()
  @Post('platform/payment-callbacks/:id/replay')
  @HttpCode(200)
  @ApiOperation({ summary: 'Memutar ulang pemrosesan sebuah callback' })
  async replayCallback(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const event = await this.prisma.paymentCallbackEvent.findUnique({ where: { id } });
    if (!event || !event.orderId) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Callback event tidak ditemukan.');
    }
    const result = await this.esmartlink.checkPayment(event.orderId, {
      source: 'SUPPORT_REPLAY',
      actorUserId: user.userId,
    });
    await this.audit.record({
      moduleCode: 'PAYMENT',
      actionCode: 'CALLBACK_REPLAYED',
      entityType: 'PaymentCallbackEvent',
      entityId: id,
      actorUserId: user.userId,
    });
    return result;
  }

  @Public()
  @Get('public/payment-channels')
  @ApiOperation({ summary: 'Channel pembayaran aktif untuk halaman checkout' })
  async listPublicChannels() {
    const channels = await this.prisma.paymentChannel.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        code: true,
        name: true,
        labelKey: true,
        adminFeeType: true,
        adminFeeValue: true,
        expiryOptions: true,
      },
    });
    return channels.map((channel) => ({
      ...channel,
      adminFeeValue: channel.adminFeeValue.toFixed(),
    }));
  }
}

function resolveRemoteIp(request: Request, fallback: string): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    // Forwarded IP hanya dipercaya bila trust proxy diaktifkan pada provider.
    return forwarded.split(',')[0].trim();
  }
  return request.socket?.remoteAddress ?? fallback;
}

@Module({
  controllers: [PaymentController],
  providers: [EsmartlinkClient, EsmartlinkPaymentService],
  exports: [EsmartlinkPaymentService],
})
export class PaymentModule {}
