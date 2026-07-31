/**
 * Pesanan marketplace.
 *
 * Tiga sudut pandang, tiga tingkat hak:
 *
 * - **Pembeli** melihat pesanannya sendiri, dikenali lewat `X-Buyer-Id`.
 * - **Penjual** melihat pesanan yang masuk ke tokonya, dikenali lewat sesi
 *   tenant — bukan lewat id penjual yang dikirim pemanggil.
 * - **Platform** menjalankan pelepasan penahanan yang kedaluwarsa.
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedUser,
  CurrentUser,
  Permissions,
  PlatformPermissions,
  Public,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { OrderService } from './order.service';
import { StockReservationService } from './stock-reservation.service';
import type { OrderStatus } from './order-state';

/** Status yang boleh disetel penjual lewat API. */
const SELLER_SETTABLE: OrderStatus[] = ['PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'CANCELLED'];

class CreateOrderDto {
  @ApiProperty({ description: 'Checkout yang sudah dikonfirmasi.' })
  @IsString()
  checkoutId!: string;
}

class TransitionDto {
  @ApiProperty({ enum: SELLER_SETTABLE })
  @IsIn(SELLER_SETTABLE)
  status!: OrderStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

function requireBuyer(raw: string | undefined): string {
  if (!raw || !/^[0-9a-f-]{36}$/i.test(raw)) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Diperlukan akun pembeli.');
  }
  return raw;
}

function requireTenant(user: AuthenticatedUser): string {
  if (!user.tenantId) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Sesi ini tidak terhubung ke tenant mana pun.');
  }
  return user.tenantId;
}

// ---------------------------------------------------------------------------
// Pembeli
// ---------------------------------------------------------------------------

@ApiTags('pesanan')
@Controller('public/orders')
export class BuyerOrderController {
  constructor(private readonly orders: OrderService) {}

  @Post()
  @Public()
  @HttpCode(201)
  @ApiHeader({ name: 'X-Buyer-Id', required: true })
  @ApiOperation({
    summary: 'Membuat pesanan dari checkout yang sudah dikonfirmasi',
    description:
      'Idempoten: memanggilnya dua kali mengembalikan pesanan yang sama. Stok ditahan ' +
      'bersamaan dengan pembuatan pesanan.',
  })
  create(@Body() dto: CreateOrderDto, @Headers('x-buyer-id') buyerId?: string) {
    return this.orders.createFromCheckout(requireBuyer(buyerId), dto.checkoutId);
  }

  @Get()
  @Public()
  @ApiHeader({ name: 'X-Buyer-Id', required: true })
  @ApiOperation({ summary: 'Pesanan milik pembeli' })
  list(
    @Headers('x-buyer-id') buyerId?: string,
    @Query('jumlah') limit?: string,
    @Query('lewati') offset?: string,
  ) {
    return this.orders.listForBuyer(
      requireBuyer(buyerId),
      Number(limit) || 20,
      Number(offset) || 0,
    );
  }

  @Get(':id')
  @Public()
  @ApiHeader({ name: 'X-Buyer-Id', required: true })
  @ApiOperation({ summary: 'Detail pesanan milik pembeli' })
  detail(@Param('id') id: string, @Headers('x-buyer-id') buyerId?: string) {
    return this.orders.findForBuyer(requireBuyer(buyerId), id);
  }

  @Post(':id/cancel')
  @Public()
  @HttpCode(200)
  @ApiHeader({ name: 'X-Buyer-Id', required: true })
  @ApiOperation({
    summary: 'Membatalkan pesanan yang belum dibayar',
    description: 'Pesanan yang sudah dibayar menuntut pengembalian dana dan tidak dapat dibatalkan sendiri.',
  })
  async cancel(@Param('id') id: string, @Headers('x-buyer-id') buyerId?: string) {
    const buyer = requireBuyer(buyerId);
    // Kepemilikan diperiksa lebih dulu; tanpa ini id yang ditebak memungkinkan
    // seseorang membatalkan pesanan orang lain.
    await this.orders.findForBuyer(buyer, id);
    await this.orders.transition(id, 'CANCELLED', { type: 'BUYER', id: buyer }, 'Dibatalkan pembeli.');
    return this.orders.findForBuyer(buyer, id);
  }
}

// ---------------------------------------------------------------------------
// Penjual
// ---------------------------------------------------------------------------

@ApiTags('pesanan')
@ApiBearerAuth('access-token')
@Controller('seller/orders')
export class SellerOrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  @Permissions('ONLINE_ORDER.READ')
  @ApiQuery({ name: 'status', required: false })
  @ApiOperation({ summary: 'Pesanan yang masuk ke toko' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('jumlah') limit?: string,
    @Query('lewati') offset?: string,
  ) {
    return this.orders.listForSeller(
      requireTenant(user),
      status,
      Number(limit) || 20,
      Number(offset) || 0,
    );
  }

  @Post(':id/status')
  @Permissions('ONLINE_ORDER.UPDATE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mengubah status pesanan',
    description:
      'Perpindahan yang tidak diizinkan ditolak beserta daftar status yang mungkin. ' +
      'Penjual tidak dapat menyatakan pembayaran sudah masuk.',
  })
  async setStatus(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const tenantId = requireTenant(user);

    // Memastikan pesanan memang milik toko pemanggil sebelum menyentuhnya.
    const owned = await this.orders.listForSeller(tenantId, undefined, 50, 0);
    if (!owned.some((o) => o.id === id)) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesanan tidak ditemukan.');
    }

    await this.orders.transition(
      id,
      dto.status,
      { type: 'SELLER', id: user.userId, requestId: meta.requestId },
      dto.reason,
    );
    return { id, status: dto.status };
  }
}

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

@ApiTags('pesanan')
@ApiBearerAuth('access-token')
@Controller('platform/orders')
export class PlatformOrderController {
  constructor(private readonly reservations: StockReservationService) {}

  @Post('reservations/release-expired')
  @PlatformPermissions('PLATFORM.MARKETPLACE.MODERATE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Melepas penahanan stok yang kedaluwarsa',
    description:
      'Aman dijalankan berulang: status disimpan, bukan disimpulkan dari waktu, sehingga ' +
      'menjalankannya dua kali tidak melepas dua kali.',
  })
  async releaseExpired() {
    const released = await this.reservations.releaseExpired();
    return { released };
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [BuyerOrderController, SellerOrderController, PlatformOrderController],
  providers: [OrderService, StockReservationService],
  exports: [OrderService, StockReservationService],
})
export class OrderModule {}
