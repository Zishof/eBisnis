/**
 * Titik masuk HTTP setoran tahfiz (EP-I). Pola sama dengan
 * `pesantren-presensi.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenTahfizService } from './pesantren-tahfiz.service';
import { JENIS_SETORAN, PREDIKAT_SETORAN } from './pesantren-tahfiz';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarSetoranQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional() @IsISO8601()
  tanggal?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatSetoranDto {
  @ApiProperty()
  @IsString()
  santriId!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsISO8601()
  tanggal!: string;

  @ApiProperty({ enum: JENIS_SETORAN })
  @IsIn(JENIS_SETORAN as unknown as string[])
  jenis!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 30 })
  @IsInt() @Min(1) @Max(30)
  juz!: number;

  @ApiProperty({ enum: PREDIKAT_SETORAN })
  @IsIn(PREDIKAT_SETORAN as unknown as string[])
  predikat!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  catatan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/tahfiz')
export class PesantrenTahfizController {
  constructor(private readonly tahfiz: PesantrenTahfizService) {}

  @Permissions('EPESANTREN_TAHFIZ.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar setoran tahfiz' })
  daftar(@Query() query: DaftarSetoranQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.tahfiz.daftar(schemaWajib(user), {
      santriId: query.santriId,
      tanggal: query.tanggal,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_TAHFIZ.READ')
  @Get('capaian/:santriId')
  @ApiOperation({ summary: 'Capaian juz tertinggi dan total setoran satu santri' })
  capaian(@Param('santriId') santriId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tahfiz.capaian(schemaWajib(user), santriId);
  }

  @Permissions('EPESANTREN_TAHFIZ.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat setoran tahfiz' })
  catat(@Body() dto: CatatSetoranDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tahfiz.catat(schemaWajib(user), dto, user.userId);
  }
}
