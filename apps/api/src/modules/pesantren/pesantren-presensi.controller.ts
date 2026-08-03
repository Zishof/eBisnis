/**
 * Titik masuk HTTP presensi santri (EP-E). Pola sama dengan
 * `pesantren-santri.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenPresensiService } from './pesantren-presensi.service';
import { JENIS_PRESENSI, STATUS_PRESENSI } from './pesantren-presensi';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Konteks ruang kerja tidak ditemukan pada sesi Anda.',
    );
  }
  return user.schemaName;
}

class DaftarPresensiQuery {
  @ApiPropertyOptional({ example: '2026-08-02' })
  @IsOptional() @IsISO8601()
  tanggal?: string;

  @ApiPropertyOptional({ enum: JENIS_PRESENSI })
  @IsOptional() @IsIn(JENIS_PRESENSI as unknown as string[])
  jenis?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatPresensiDto {
  @ApiProperty()
  @IsString()
  santriId!: string;

  @ApiProperty({ example: '2026-08-02' })
  @IsISO8601()
  tanggal!: string;

  @ApiProperty({ enum: JENIS_PRESENSI })
  @IsIn(JENIS_PRESENSI as unknown as string[])
  jenis!: string;

  @ApiProperty({ enum: STATUS_PRESENSI })
  @IsIn(STATUS_PRESENSI as unknown as string[])
  status!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  keterangan?: string;
}

class ItemPresensiMassalDto {
  @ApiProperty() @IsString()
  santriId!: string;

  @ApiProperty({ enum: STATUS_PRESENSI }) @IsIn(STATUS_PRESENSI as unknown as string[])
  status!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  keterangan?: string;
}

class CatatPresensiMassalDto {
  @ApiProperty({ example: '2026-08-02' }) @IsISO8601()
  tanggal!: string;

  @ApiProperty({ enum: JENIS_PRESENSI }) @IsIn(JENIS_PRESENSI as unknown as string[])
  jenis!: string;

  @ApiProperty({ type: [ItemPresensiMassalDto] })
  items!: ItemPresensiMassalDto[];
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/presensi')
export class PesantrenPresensiController {
  constructor(private readonly presensi: PesantrenPresensiService) {}

  @Permissions('EPESANTREN_PRESENSI.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar presensi' })
  async daftar(@Query() query: DaftarPresensiQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.presensi.daftar(schemaWajib(user), {
      tanggal: query.tanggal,
      jenis: query.jenis,
      santriId: query.santriId,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100
          ? query.ukuranHalaman
          : 25,
    });
  }

  @Permissions('EPESANTREN_PRESENSI.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat presensi satu santri' })
  async catat(@Body() dto: CatatPresensiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.presensi.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PRESENSI.CREATE')
  @Post('massal')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mencatat atau memperbarui presensi banyak santri sekaligus' })
  async catatMassal(@Body() dto: CatatPresensiMassalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.presensi.catatMassal(schemaWajib(user), dto, user.userId);
  }
}
