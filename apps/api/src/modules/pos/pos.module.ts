/**
 * Modul kasir (POS).
 *
 * Satu modul untuk seluruh jalur kasir — konteks, katalog, harga, dan kelak
 * keranjang serta pembayaran — supaya cakupan POS dapat dilihat dan diuji
 * sebagai satu kesatuan alih-alih tersebar.
 *
 * Aturan yang berlaku bagi setiap jalan di sini:
 *
 * 1. Nama skema tenant tidak pernah berasal dari permintaan; ia diambil dari
 *    token dan sudah dicocokkan ke daftar resmi oleh penjaga.
 * 2. Harga, pajak, diskon, dan total selalu dihitung peladen.
 * 3. Setiap penolakan menyebutkan alasannya dalam bentuk yang dapat dibaca
 *    kasir — bukan hanya kode HTTP.
 */

import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PosCatalogService } from './pos-catalog.service';
import { PosContextService } from './pos-context.service';
import { AuthModule } from '../auth/auth.module';
import { TenantPermissionService } from '../auth/tenant-permission.service';

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

// --- DTO --------------------------------------------------------------------

class DiskonManualDto {
  @ApiProperty({ enum: ['PERCENT', 'AMOUNT'] })
  @IsIn(['PERCENT', 'AMOUNT'])
  type!: 'PERCENT' | 'AMOUNT';

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

class KuotasiDto {
  @ApiProperty()
  @IsUUID()
  outletId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    description:
      'Harga yang diketik kasir. Hanya sah bila ia memiliki POS_SALE.PRICE_OVERRIDE; ' +
      'selalu menandai transaksi sebagai memerlukan persetujuan dan selalu tercatat pada audit.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ type: DiskonManualDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiskonManualDto)
  manualDiscount?: DiskonManualDto;

  @ApiPropertyOptional({ description: 'Saat transaksi; bawaannya sekarang.' })
  @IsOptional()
  @IsISO8601()
  at?: string;
}

class BukaShiftDto {
  @ApiProperty()
  @IsUUID()
  terminalId!: string;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(0)
  openingCash!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class PenugasanDto {
  @ApiProperty()
  @IsUUID()
  terminalId!: string;

  @ApiProperty()
  @IsUUID()
  userSubjectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

// --- Controller -------------------------------------------------------------

@ApiTags('POS')
@Controller('pos')
export class PosController {
  constructor(
    private readonly katalog: PosCatalogService,
    private readonly konteks: PosContextService,
    private readonly izin: TenantPermissionService,
  ) {}

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('context')
  @ApiOperation({
    summary: 'Konteks kasir',
    description:
      'Brand, outlet, dan register yang boleh dipakai pengguna ini, beserta shift yang sedang ' +
      'terbuka. Jawabannya berasal dari cakupan data dan penugasan register — bukan dari ' +
      'parameter yang dikirim peramban.',
  })
  context(@CurrentUser() user: AuthenticatedUser) {
    return this.konteks.context(requireSchema(user), user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('catalog/search')
  @ApiOperation({ summary: 'Cari produk menurut nama, kode, SKU, atau barcode' })
  cari(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.katalog.cariProduk(requireSchema(user), q ?? '', {
      categoryId: categoryId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('products/by-barcode')
  @ApiOperation({
    summary: 'Cari produk menurut barcode',
    description: 'Barcode utama maupun alternatif; pemindai tidak tahu bedanya.',
  })
  async barcode(@CurrentUser() user: AuthenticatedUser, @Query('code') code: string) {
    const produk = await this.katalog.produkDariBarcode(requireSchema(user), code ?? '');
    if (!produk) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        `Barcode ${code} tidak dikenali. Cari produk menurut namanya, atau daftarkan barcode ini pada master produk.`,
      );
    }
    return produk;
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Post('price/quote')
  @ApiOperation({
    summary: 'Kuotasi harga otoritatif',
    description:
      'Satu-satunya sumber harga yang sah pada jalur kasir. Mengembalikan harga satuan, bruto, ' +
      'diskon beserta asal-usulnya, pajak beserta tarif yang dipakai, neto, total, dan peringatan.',
  })
  async quote(@Body() dto: KuotasiDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);

    /*
     * Penggantian harga diperiksa di sini, bukan di dalam layanan.
     *
     * Layanan tidak mengenal hak akses, dan seharusnya memang tidak — tetapi
     * itu berarti seseorang yang memanggilnya dari tempat lain dapat melewati
     * pemeriksaan ini. Karena itu penggantian harga juga selalu menandai
     * transaksi sebagai memerlukan persetujuan, sehingga andaikan pemeriksaan
     * ini terlewat sekalipun, hasilnya tetap tidak dapat diselesaikan diam-diam.
     */
    if (dto.priceOverride !== undefined && dto.priceOverride !== null) {
      const kurang = await this.izin.findMissing(schema, user.userId, ['POS_SALE.PRICE_OVERRIDE'], {
        isDemo: user.isDemo,
        activeRoleId: user.activeRoleId ?? null,
      });
      if (kurang.length) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak berwenang mengubah harga secara manual. Mintakan persetujuan supervisor.',
        );
      }
    }

    return this.katalog.kuotasi(schema, {
      outletId: dto.outletId,
      productId: dto.productId,
      uomId: dto.uomId,
      quantity: dto.quantity,
      customerId: dto.customerId ?? null,
      brandId: dto.brandId ?? null,
      priceOverride: dto.priceOverride ?? null,
      manualDiscount: dto.manualDiscount ?? null,
      at: dto.at,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_REGISTER_ASSIGN.READ')
  @Get('register-assignments')
  @ApiOperation({ summary: 'Penugasan kasir pada register' })
  penugasan(@CurrentUser() user: AuthenticatedUser, @Query('terminalId') terminalId?: string) {
    return this.konteks.daftarPenugasan(requireSchema(user), terminalId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_REGISTER_ASSIGN.CREATE')
  @Post('register-assignments')
  @ApiOperation({ summary: 'Menugaskan kasir pada register' })
  tugaskan(@Body() dto: PenugasanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.konteks.tugaskan(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SHIFT.OPEN_SHIFT')
  @Post('shifts/open')
  @ApiOperation({
    summary: 'Membuka shift',
    description:
      'Menolak bila register tidak aktif, dalam perawatan, tidak ditugaskan kepada pengguna ini, ' +
      'atau sudah memiliki shift yang terbuka.',
  })
  bukaShift(@Body() dto: BukaShiftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.konteks.bukaShift(requireSchema(user), dto, user);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SHIFT.READ')
  @Get('shifts/current')
  @ApiOperation({ summary: 'Shift yang sedang terbuka bagi pengguna ini' })
  shiftBerjalan(@CurrentUser() user: AuthenticatedUser) {
    return this.konteks.shiftBerjalan(requireSchema(user), user);
  }
}

@Module({
  imports: [InfrastructureModule, AuthModule],
  controllers: [PosController],
  providers: [PosCatalogService, PosContextService],
  exports: [PosCatalogService, PosContextService],
})
export class PosModule {}
