/**
 * Titik masuk HTTP dompet santri (EP-L). Pola sama dengan
 * `pesantren-santri.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenDompetService } from './pesantren-dompet.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class BuatDompetDto {
  @ApiProperty()
  @IsString()
  santriId!: string;

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional() @IsNumber()
  batasHarian?: number;
}

class TransaksiDto {
  @ApiProperty({ example: 10000 })
  @IsNumber() @IsPositive()
  jumlah!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  keterangan?: string;
}

class HalamanQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/dompet')
export class PesantrenDompetController {
  constructor(private readonly dompet: PesantrenDompetService) {}

  @Permissions('EPESANTREN_DOMPET.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar dompet santri' })
  daftar(@CurrentUser() user: AuthenticatedUser) {
    return this.dompet.daftar(schemaWajib(user));
  }

  @Permissions('EPESANTREN_DOMPET.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuka dompet baru untuk satu santri' })
  buat(@Body() dto: BuatDompetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dompet.buat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_DOMPET.READ')
  @Get(':id/riwayat')
  @ApiOperation({ summary: 'Riwayat transaksi satu dompet' })
  riwayat(@Param('id') id: string, @Query() query: HalamanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.dompet.riwayat(schemaWajib(user), id, {
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_DOMPET.CREATE')
  @Post(':id/topup')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambah saldo (topup)' })
  topup(@Param('id') id: string, @Body() dto: TransaksiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dompet.topup(schemaWajib(user), id, dto, user.userId);
  }

  @Permissions('EPESANTREN_DOMPET.CREATE')
  @Post(':id/belanja')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat belanja, ditolak bila melebihi saldo atau batas harian' })
  belanja(@Param('id') id: string, @Body() dto: TransaksiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dompet.belanja(schemaWajib(user), id, dto, user.userId);
  }
}
