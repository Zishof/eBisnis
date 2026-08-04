/**
 * Titik masuk HTTP lintasan gerbang (EP-J). Pola sama dengan
 * `pesantren-santri.controller.ts`.
 *
 * Sengaja tidak ada endpoint apa pun di sini yang menyentuh status izin —
 * lihat catatan pada `pesantren-gerbang.service.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenGerbangService } from './pesantren-gerbang.service';
import { ARAH_GERBANG } from './pesantren-perizinan';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarLintasanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  izinId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatLintasanDto {
  @ApiProperty()
  @IsString()
  izinId!: string;

  @ApiProperty({ enum: ARAH_GERBANG })
  @IsIn(ARAH_GERBANG as unknown as string[])
  arah!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  catatan?: string;
}

class DaftarKunjunganQuery {
  @ApiPropertyOptional({ enum: ['MASUK', 'SELESAI', 'DIBATALKAN'] })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatKunjunganDto {
  @ApiProperty({ enum: ['TAMU', 'PAKET', 'PENJEMPUT'] })
  @IsString()
  kategori!: string;

  @ApiProperty()
  @IsString() @MaxLength(160)
  namaTamu!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(40)
  noHp?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(160)
  instansi?: string;

  @ApiProperty()
  @IsString() @MaxLength(240)
  tujuan!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  catatan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/gerbang')
export class PesantrenGerbangController {
  constructor(private readonly gerbang: PesantrenGerbangService) {}

  @Permissions('EPESANTREN_GERBANG.READ')
  @Get('izin-aktif')
  @ApiOperation({ summary: 'Daftar izin yang boleh melewati gerbang hari ini' })
  izinAktif(@CurrentUser() user: AuthenticatedUser) {
    return this.gerbang.daftarIzinAktif(schemaWajib(user));
  }

  @Permissions('EPESANTREN_GERBANG.READ')
  @Get('kartu/:nomorKartu')
  @ApiOperation({ summary: 'Mencari santri dan izin aktif dari kartu gerbang' })
  pindaiKartu(@Param('nomorKartu') nomorKartu: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gerbang.pindaiKartu(schemaWajib(user), nomorKartu);
  }

  @Permissions('EPESANTREN_GERBANG.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar lintasan keluar-masuk' })
  daftar(@Query() query: DaftarLintasanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.gerbang.daftar(schemaWajib(user), {
      izinId: query.izinId,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_GERBANG.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat lintasan keluar atau masuk terhadap izin yang sudah disetujui' })
  catat(@Body() dto: CatatLintasanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gerbang.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_GERBANG.READ')
  @Get('kunjungan')
  @ApiOperation({ summary: 'Daftar tamu, paket, dan penjemput di gerbang' })
  daftarKunjungan(@Query() query: DaftarKunjunganQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.gerbang.daftarKunjungan(schemaWajib(user), {
      status: query.status,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_GERBANG.CREATE')
  @Post('kunjungan')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat tamu, paket, atau penjemput masuk gerbang' })
  catatKunjungan(@Body() dto: CatatKunjunganDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gerbang.catatKunjungan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_GERBANG.CREATE')
  @Post('kunjungan/:id/selesai')
  @ApiOperation({ summary: 'Menandai tamu, paket, atau penjemput sudah keluar/selesai' })
  selesaikanKunjungan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gerbang.selesaikanKunjungan(schemaWajib(user), id, user.userId);
  }
}
