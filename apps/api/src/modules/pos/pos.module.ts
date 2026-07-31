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
  Query,
} from '@nestjs/common';
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
import { PosSaleService } from './pos-sale.service';
import { PosStockService } from './pos-stock.service';
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

class BuatKeranjangDto {
  @ApiProperty()
  @IsUUID()
  outletId!: string;

  @ApiProperty()
  @IsUUID()
  terminalId!: string;

  @ApiProperty()
  @IsUUID()
  shiftId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

class TambahBarisDto {
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
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ type: DiskonManualDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiskonManualDto)
  manualDiscount?: DiskonManualDto;
}

class UbahBarisDto {
  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity!: number;
}

class PembayaranDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId!: string;

  @ApiProperty({ example: 53900 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ description: 'Uang yang diserahkan pembeli; hanya tunai memberi kembalian.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tenderedAmount?: number;

  @ApiPropertyOptional({
    description: 'Nomor rujukan dari mesin EDC. Nomor kartu dan CVV TIDAK PERNAH disimpan.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

class CekStokDto {
  @ApiProperty()
  @IsUUID()
  outletId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  quantity!: number;
}

class AlasanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// --- Controller -------------------------------------------------------------

@ApiTags('POS')
@Controller('pos')
export class PosController {
  constructor(
    private readonly katalog: PosCatalogService,
    private readonly konteks: PosContextService,
    private readonly izin: TenantPermissionService,
    private readonly jual: PosSaleService,
    private readonly stokLayanan: PosStockService,
  ) {}

  /**
   * Identitas tenant dari identitas control plane.
   *
   * Diselesaikan di satu tempat supaya setiap jalan memakai id yang sama. Cacat
   * yang ditemukan pada POS-2 berawal dari dua tempat yang memakai id berbeda
   * tanpa ada yang menyadarinya: kuerinya berhasil dan mengembalikan nol baris.
   */
  private async subjek(schema: string, user: AuthenticatedUser): Promise<string> {
    return this.konteks.subjectIdPublik(schema, user.userId);
  }

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

  // --- Keranjang dan penjualan ---------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('sales')
  @ApiOperation({ summary: 'Membuka keranjang baru' })
  async buatKeranjang(@Body() dto: BuatKeranjangDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.jual.buatKeranjang(schema, dto, user, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('sales/:id')
  @ApiOperation({ summary: 'Membaca satu keranjang beserta barisnya' })
  ambilKeranjang(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jual.ambil(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('sales/:id/items')
  @ApiOperation({
    summary: 'Menambahkan baris',
    description:
      'Harga dikuotasi peladen dan stok ditahan; keduanya harus berhasil bersama. Baris yang ' +
      'masuk keranjang tanpa penahanan stok akan membuat dua kasir sama-sama menjual barang ' +
      'terakhir yang sama.',
  })
  async tambahBaris(
    @Param('id') id: string,
    @Body() dto: TambahBarisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
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
    return this.jual.tambahBaris(schema, id, dto, user, await this.subjek(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Patch('sales/:id/items/:lineId')
  @ApiOperation({ summary: 'Mengubah jumlah pada satu baris' })
  async ubahBaris(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UbahBarisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.ubahBaris(
      schema,
      id,
      lineId,
      dto.quantity,
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.UPDATE')
  @Delete('sales/:id/items/:lineId')
  @ApiOperation({ summary: 'Membatalkan satu baris sebelum pembayaran' })
  hapusBaris(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jual.hapusBaris(requireSchema(user), id, lineId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.HOLD')
  @Post('sales/:id/hold')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menahan keranjang' })
  async tahan(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.pindahStatus(
      schema,
      id,
      'HELD',
      dto.reason ?? 'Ditahan kasir',
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.RESUME')
  @Post('sales/:id/resume')
  @HttpCode(200)
  @ApiOperation({ summary: 'Melanjutkan keranjang yang ditahan' })
  async lanjutkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.jual.pindahStatus(
      schema,
      id,
      'DRAFT',
      'Dilanjutkan kasir',
      user,
      await this.subjek(schema, user),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.UPDATE')
  @Post('sales/:id/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Membatalkan keranjang sebelum pembayaran',
    description: 'Seluruh penahanan stoknya dilepaskan.',
  })
  async batal(
    @Param('id') id: string,
    @Body() dto: AlasanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.pindahStatus(
      schema,
      id,
      'CANCELLED',
      dto.reason ?? 'Dibatalkan kasir',
      user,
      await this.subjek(schema, user),
    );
  }

  // --- Pembayaran ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('sales/:id/payments')
  @ApiOperation({
    summary: 'Menerima pembayaran',
    description:
      'Wajib menyertakan tajuk Idempotency-Key. Klik ganda pada layar yang lambat adalah ' +
      'keadaan yang pasti terjadi di lapangan, bukan kemungkinan.',
  })
  async bayar(
    @Param('id') id: string,
    @Body() dto: PembayaranDto,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    if (!kunci?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tajuk Idempotency-Key wajib disertakan pada penerimaan pembayaran.',
      );
    }
    // Siapa yang menerima pembayaran tidak diteruskan tersendiri: ia sudah
    // melekat pada shift dan pada `pos_sale.cashier_id`, dan menyimpannya lagi
    // di sini hanya menciptakan tempat kedua yang dapat berbeda.
    return this.jual.tambahPembayaran(schema, id, dto, kunci.trim());
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('sales/:id/complete')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyelesaikan transaksi',
    description:
      'Sepuluh langkah dalam satu transaksi basis data: validasi penjualan, shift, persetujuan, ' +
      'dan total pembayaran; nomor struk; potong persediaan; peristiwa akuntansi; terbitkan ' +
      'struk; tandai selesai; titipkan ke outbox. Bila satu gagal, seluruhnya digulung balik.',
  })
  async selesaikan(
    @Param('id') id: string,
    @Headers('idempotency-key') kunci: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jual.selesaikan(
      schema,
      id,
      kunci?.trim() || id,
      user,
      await this.subjek(schema, user),
    );
  }

  // --- Stok ------------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Post('stock/check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Memeriksa ketersediaan tanpa mengubah apa pun' })
  async cekStok(@Body() dto: CekStokDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    const gudang = await this.stokLayanan.gudangOutlet(schema, dto.outletId);
    if (!gudang) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Outlet ini belum memiliki gudang.');
    }
    const setelan = await this.katalog.setelanPos(schema);
    return this.stokLayanan.periksa(
      schema,
      { warehouseId: gudang, productId: dto.productId, quantity: dto.quantity },
      setelan.allowNegativeStock,
    );
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
  providers: [PosCatalogService, PosContextService, PosSaleService, PosStockService],
  exports: [PosCatalogService, PosContextService, PosSaleService, PosStockService],
})
export class PosModule {}
