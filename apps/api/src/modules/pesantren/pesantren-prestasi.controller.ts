/**
 * Titik masuk HTTP prestasi dan penghargaan santri (EP-S5). Pola sama
 * dengan `pesantren-pelanggaran.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenPrestasiService } from './pesantren-prestasi.service';
import { JENIS_PENGHARGAAN, PERINGKAT_PRESTASI, TINGKAT_PRESTASI } from './pesantren-prestasi';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class HalamanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatPrestasiDto {
  @ApiProperty() @IsString()
  santriId!: string;

  @ApiProperty({ example: 'Olimpiade Matematika' }) @IsString() @MaxLength(160)
  cabang!: string;

  @ApiProperty({ example: 'OSN Tingkat Kabupaten 2026' }) @IsString() @MaxLength(255)
  namaKompetisi!: string;

  @ApiProperty({ enum: TINGKAT_PRESTASI }) @IsIn(TINGKAT_PRESTASI as unknown as string[])
  tingkat!: string;

  @ApiProperty({ enum: PERINGKAT_PRESTASI }) @IsIn(PERINGKAT_PRESTASI as unknown as string[])
  peringkat!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggal?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  penyelenggara?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  keterangan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dokumenUrl?: string;
}

class CatatPenghargaanDto {
  @ApiProperty() @IsString()
  santriId!: string;

  @ApiProperty({ example: 'Santri Teladan Bulan Ini' }) @IsString() @MaxLength(255)
  judul!: string;

  @ApiProperty({ enum: JENIS_PENGHARGAAN }) @IsIn(JENIS_PENGHARGAAN as unknown as string[])
  jenis!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggal?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  diberikanOleh?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  keterangan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/prestasi')
export class PesantrenPrestasiController {
  constructor(private readonly prestasi: PesantrenPrestasiService) {}

  @Permissions('EPESANTREN_PRESTASI.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar prestasi kompetisi' })
  daftar(@Query() query: HalamanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.prestasi.daftarPrestasi(schemaWajib(user), {
      santriId: query.santriId,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_PRESTASI.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu prestasi' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const prestasi = await this.prestasi.satuPrestasi(schemaWajib(user), id);
    if (!prestasi) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Prestasi tidak ditemukan.');
    }
    return prestasi;
  }

  @Permissions('EPESANTREN_PRESTASI.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat prestasi kompetisi' })
  catat(@Body() dto: CatatPrestasiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.prestasi.catatPrestasi(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PRESTASI.READ')
  @Get('penghargaan/daftar')
  @ApiOperation({ summary: 'Daftar penghargaan/apresiasi internal' })
  daftarPenghargaan(@Query() query: HalamanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.prestasi.daftarPenghargaan(schemaWajib(user), {
      santriId: query.santriId,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_PRESTASI.CREATE')
  @Post('penghargaan')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat penghargaan/apresiasi internal' })
  catatPenghargaan(@Body() dto: CatatPenghargaanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.prestasi.catatPenghargaan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PRESTASI.READ')
  @Get('santri/:santriId/rekap')
  @ApiOperation({ summary: 'Rekap prestasi dan penghargaan seorang santri' })
  rekapSantri(@Param('santriId') santriId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.prestasi.rekapSantri(schemaWajib(user), santriId);
  }
}
