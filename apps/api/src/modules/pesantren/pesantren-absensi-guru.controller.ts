/**
 * Titik masuk HTTP absensi guru dan piket (EP-S3). Pola sama dengan
 * `pesantren-presensi.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenAbsensiGuruService } from './pesantren-absensi-guru.service';
import { JENIS_PIKET, STATUS_ABSENSI_GURU } from './pesantren-absensi-guru';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarAbsensiQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  guruId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dari?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  sampai?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatAbsensiDto {
  @ApiProperty() @IsString()
  guruId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggal?: string;

  @ApiProperty({ enum: STATUS_ABSENSI_GURU }) @IsIn(STATUS_ABSENSI_GURU as unknown as string[])
  status!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  jamMasuk?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  jamPulang?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  keterangan?: string;
}

class JadwalkanPiketDto {
  @ApiProperty() @IsString()
  guruId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggal?: string;

  @ApiProperty({ enum: JENIS_PIKET }) @IsIn(JENIS_PIKET as unknown as string[])
  jenisPiket!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  keterangan?: string;
}

class KehadiranPiketDto {
  @ApiProperty({ example: true }) @IsBoolean()
  hadir!: boolean;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/absensi-guru')
export class PesantrenAbsensiGuruController {
  constructor(private readonly absensi: PesantrenAbsensiGuruService) {}

  @Permissions('EPESANTREN_ABSENSI_GURU.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar absensi harian guru' })
  daftar(@Query() query: DaftarAbsensiQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.absensi.daftarAbsensi(schemaWajib(user), {
      guruId: query.guruId,
      dari: query.dari,
      sampai: query.sampai,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_ABSENSI_GURU.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat absensi harian guru' })
  catat(@Body() dto: CatatAbsensiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.absensi.catatAbsensi(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_ABSENSI_GURU.READ')
  @Get('rekap/:guruId')
  @ApiOperation({ summary: 'Rekap kehadiran guru dalam rentang tanggal' })
  rekap(
    @Param('guruId') guruId: string,
    @Query('dari') dari: string,
    @Query('sampai') sampai: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.absensi.rekapKehadiran(schemaWajib(user), guruId, dari, sampai);
  }

  @Permissions('EPESANTREN_ABSENSI_GURU.READ')
  @Get('piket')
  @ApiOperation({ summary: 'Daftar jadwal piket' })
  daftarPiket(@Query('guruId') guruId: string, @Query('tanggal') tanggal: string, @CurrentUser() user: AuthenticatedUser) {
    return this.absensi.daftarPiket(schemaWajib(user), { guruId, tanggal });
  }

  @Permissions('EPESANTREN_ABSENSI_GURU.CREATE')
  @Post('piket')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menjadwalkan piket' })
  jadwalkanPiket(@Body() dto: JadwalkanPiketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.absensi.jadwalkanPiket(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_ABSENSI_GURU.UPDATE')
  @Post('piket/:id/kehadiran')
  @ApiOperation({ summary: 'Mencatat kehadiran piket (hadir/tidak hadir)' })
  catatKehadiranPiket(@Param('id') id: string, @Body() dto: KehadiranPiketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.absensi.catatKehadiranPiket(schemaWajib(user), id, dto.hadir, user.userId);
  }
}
