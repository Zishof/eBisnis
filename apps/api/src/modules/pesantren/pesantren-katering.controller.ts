/**
 * Titik masuk HTTP dapur dan katering (EP-S6). Pola sama dengan
 * `pesantren-dompet.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PesantrenKateringService } from './pesantren-katering.service';
import { JENIS_TRANSAKSI_STOK, STATUS_MENU, WAKTU_MAKAN } from './pesantren-katering';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class CatatMenuDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggal?: string;

  @ApiProperty({ enum: WAKTU_MAKAN }) @IsIn(WAKTU_MAKAN as unknown as string[])
  waktuMakan!: string;

  @ApiProperty({ example: 'Nasi, ayam goreng, sayur bening' }) @IsString()
  namaMenu!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  deskripsi?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1)
  jumlahPorsiDisiapkan?: number;
}

class UbahStatusMenuDto {
  @ApiProperty({ enum: STATUS_MENU }) @IsIn(STATUS_MENU as unknown as string[])
  status!: string;
}

class CatatKonsumsiDto {
  @ApiProperty() @IsString()
  menuId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  asramaId?: string;

  @ApiProperty({ example: 120 }) @IsNumber() @Min(1)
  jumlahPorsi!: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  catatan?: string;
}

class CatatBahanDto {
  @ApiProperty({ example: 'Beras' }) @IsString()
  namaBahan!: string;

  @ApiProperty({ example: 'kg' }) @IsString()
  satuan!: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  stokMinimum?: number;
}

class CatatTransaksiStokDto {
  @ApiProperty({ enum: JENIS_TRANSAKSI_STOK }) @IsIn(JENIS_TRANSAKSI_STOK as unknown as string[])
  jenis!: string;

  @ApiProperty({ example: 50 }) @IsNumber() @Min(0.01)
  jumlah!: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  keterangan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/katering')
export class PesantrenKateringController {
  constructor(private readonly katering: PesantrenKateringService) {}

  @Permissions('EPESANTREN_KATERING.READ')
  @Get('menu')
  @ApiOperation({ summary: 'Daftar menu makan' })
  daftarMenu(@Query('dari') dari: string, @Query('sampai') sampai: string, @CurrentUser() user: AuthenticatedUser) {
    return this.katering.daftarMenu(schemaWajib(user), { dari, sampai });
  }

  @Permissions('EPESANTREN_KATERING.CREATE')
  @Post('menu')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan menu makan' })
  catatMenu(@Body() dto: CatatMenuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.katering.catatMenu(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_KATERING.UPDATE')
  @Post('menu/:id/status')
  @ApiOperation({ summary: 'Mengubah status menu (disiapkan/selesai/dibatalkan)' })
  ubahStatusMenu(@Param('id') id: string, @Body() dto: UbahStatusMenuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.katering.ubahStatusMenu(schemaWajib(user), id, dto.status, user.userId);
  }

  @Permissions('EPESANTREN_KATERING.READ')
  @Get('menu/:id/konsumsi')
  @ApiOperation({ summary: 'Daftar konsumsi (porsi terdistribusi) untuk satu menu' })
  daftarKonsumsi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.katering.daftarKonsumsi(schemaWajib(user), id);
  }

  @Permissions('EPESANTREN_KATERING.CREATE')
  @Post('konsumsi')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat porsi yang didistribusikan' })
  catatKonsumsi(@Body() dto: CatatKonsumsiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.katering.catatKonsumsi(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_KATERING.READ')
  @Get('bahan')
  @ApiOperation({ summary: 'Daftar bahan dapur dan stoknya' })
  daftarBahan(@CurrentUser() user: AuthenticatedUser) {
    return this.katering.daftarBahan(schemaWajib(user));
  }

  @Permissions('EPESANTREN_KATERING.READ')
  @Get('bahan/stok-menipis')
  @ApiOperation({ summary: 'Bahan dengan stok di bawah ambang minimum' })
  bahanStokMenipis(@CurrentUser() user: AuthenticatedUser) {
    return this.katering.bahanStokMenipis(schemaWajib(user));
  }

  @Permissions('EPESANTREN_KATERING.CREATE')
  @Post('bahan')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan bahan dapur' })
  catatBahan(@Body() dto: CatatBahanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.katering.catatBahan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_KATERING.READ')
  @Get('bahan/:id/transaksi')
  @ApiOperation({ summary: 'Riwayat pergerakan stok satu bahan' })
  daftarTransaksiStok(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.katering.daftarTransaksiStok(schemaWajib(user), id);
  }

  @Permissions('EPESANTREN_KATERING.CREATE')
  @Post('bahan/:id/transaksi')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat pergerakan stok (masuk/keluar/penyesuaian)' })
  catatTransaksiStok(@Param('id') id: string, @Body() dto: CatatTransaksiStokDto, @CurrentUser() user: AuthenticatedUser) {
    return this.katering.catatTransaksiStok(schemaWajib(user), { ...dto, bahanId: id }, user.userId);
  }
}
