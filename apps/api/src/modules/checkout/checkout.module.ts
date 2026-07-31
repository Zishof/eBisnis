/**
 * Keranjang dan checkout marketplace.
 *
 * Endpoint keranjang terbuka untuk siapa pun — pengunjung harus dapat memilih
 * barang sebelum memutuskan mendaftar. Yang menuntut identitas hanyalah
 * checkout, karena barang harus dikirim ke seseorang.
 *
 * Identitas pembeli untuk sementara datang dari header `X-Buyer-Id`. Login
 * pembeli dibangun bersama akun marketplace; sampai itu ada, header ini
 * memungkinkan alur diuji dari awal sampai akhir tanpa membuat mekanisme
 * otentikasi kedua yang kelak harus dibongkar.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Module,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { Public } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { CartService } from './cart.service';
import { CheckoutService } from './checkout.service';
import { MAX_QUANTITY_PER_LINE } from './checkout-validation';

class AddItemDto {
  @ApiProperty({ description: 'Alamat produk pada katalog, mis. toko-demo/kaos-polos.' })
  @IsString()
  listingSlug!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_QUANTITY_PER_LINE, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_LINE)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantRef?: string;
}

class SetQuantityDto {
  @ApiProperty({ minimum: 0, maximum: MAX_QUANTITY_PER_LINE })
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY_PER_LINE)
  quantity!: number;
}

class CreateCheckoutDto {
  @ApiPropertyOptional({ description: 'Alamat kirim. Kosong berarti alamat utama.' })
  @IsOptional()
  @IsUUID()
  addressId?: string;
}

/** Membaca identitas pembeli dari header, menolak bentuk yang tidak sah. */
function requireBuyer(raw: string | undefined): string {
  if (!raw || !/^[0-9a-f-]{36}$/i.test(raw)) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Checkout memerlukan akun pembeli. Silakan masuk terlebih dahulu.',
    );
  }
  return raw;
}

@ApiTags('keranjang')
@Controller('public/cart')
export class CartController {
  constructor(private readonly carts: CartService) {}

  @Get()
  @Public()
  @ApiHeader({ name: 'X-Cart-Token', required: false, description: 'Token keranjang tamu.' })
  @ApiOperation({
    summary: 'Isi keranjang',
    description:
      'Menampilkan perbandingan harga saat dimasukkan dengan harga sekarang, agar pembeli ' +
      'mengetahui perubahan sebelum sampai di halaman pembayaran.',
  })
  view(
    @Headers('x-cart-token') cartToken?: string,
    @Headers('x-buyer-id') buyerId?: string,
  ) {
    return this.carts.view({ buyerId: buyerId ?? null, guestToken: cartToken ?? null });
  }

  @Post('items')
  @Public()
  @HttpCode(200)
  @ApiHeader({ name: 'X-Cart-Token', required: false })
  @ApiOperation({ summary: 'Menambahkan produk ke keranjang' })
  addItem(
    @Body() dto: AddItemDto,
    @Headers('x-cart-token') cartToken?: string,
    @Headers('x-buyer-id') buyerId?: string,
  ) {
    return this.carts.addItem(
      { buyerId: buyerId ?? null, guestToken: cartToken ?? null },
      dto.listingSlug,
      dto.quantity ?? 1,
      dto.variantRef,
    );
  }

  @Patch('items/:id')
  @Public()
  @ApiHeader({ name: 'X-Cart-Token', required: false })
  @ApiOperation({ summary: 'Mengubah jumlah; nol menghapus baris' })
  setQuantity(
    @Param('id') id: string,
    @Body() dto: SetQuantityDto,
    @Headers('x-cart-token') cartToken?: string,
    @Headers('x-buyer-id') buyerId?: string,
  ) {
    return this.carts.setQuantity(
      { buyerId: buyerId ?? null, guestToken: cartToken ?? null },
      id,
      dto.quantity,
    );
  }

  @Delete('items/:id')
  @Public()
  @ApiHeader({ name: 'X-Cart-Token', required: false })
  @ApiOperation({ summary: 'Menghapus satu baris keranjang' })
  removeItem(
    @Param('id') id: string,
    @Headers('x-cart-token') cartToken?: string,
    @Headers('x-buyer-id') buyerId?: string,
  ) {
    return this.carts.removeItem(
      { buyerId: buyerId ?? null, guestToken: cartToken ?? null },
      id,
    );
  }

  @Delete()
  @Public()
  @ApiHeader({ name: 'X-Cart-Token', required: false })
  @ApiOperation({ summary: 'Mengosongkan keranjang' })
  clear(
    @Headers('x-cart-token') cartToken?: string,
    @Headers('x-buyer-id') buyerId?: string,
  ) {
    return this.carts.clear({ buyerId: buyerId ?? null, guestToken: cartToken ?? null });
  }
}

@ApiTags('checkout')
@Controller('public/checkout')
export class CheckoutController {
  constructor(private readonly checkouts: CheckoutService) {}

  @Post()
  @Public()
  @HttpCode(201)
  @ApiHeader({ name: 'X-Buyer-Id', required: true })
  @ApiOperation({
    summary: 'Membuat checkout dari keranjang',
    description:
      'Keranjang dikelompokkan menurut penjual. Setiap kelompok menjadi satu pesanan dan ' +
      'satu perintah bayar, karena penyedia pembayaran belum terbukti mendukung pembagian ' +
      'setelmen ke beberapa rekening.',
  })
  create(@Body() dto: CreateCheckoutDto, @Headers('x-buyer-id') buyerId?: string) {
    return this.checkouts.create(requireBuyer(buyerId), dto.addressId ?? null);
  }

  @Get(':id')
  @Public()
  @ApiHeader({ name: 'X-Buyer-Id', required: true })
  @ApiOperation({
    summary: 'Isi checkout beserta hasil pemeriksaan',
    description: 'Pemeriksaan dijalankan ulang setiap kali dibaca, bukan hanya saat konfirmasi.',
  })
  view(@Param('id') id: string, @Headers('x-buyer-id') buyerId?: string) {
    return this.checkouts.view(requireBuyer(buyerId), id);
  }

  @Post(':id/confirm')
  @Public()
  @HttpCode(200)
  @ApiHeader({ name: 'X-Buyer-Id', required: true })
  @ApiOperation({
    summary: 'Mengunci checkout sebelum pembayaran',
    description: 'Ditolak bila ada syarat yang belum terpenuhi, beserta alasannya.',
  })
  confirm(@Param('id') id: string, @Headers('x-buyer-id') buyerId?: string) {
    return this.checkouts.confirm(requireBuyer(buyerId), id);
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [CartController, CheckoutController],
  providers: [CartService, CheckoutService],
  exports: [CartService, CheckoutService],
})
export class CheckoutModule {}
