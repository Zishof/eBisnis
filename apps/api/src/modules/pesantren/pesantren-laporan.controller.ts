/**
 * Titik masuk HTTP laporan ePesantren (EP-P). Pola dasbor+laporan-per-kode
 * mengikuti endpoint POS (didaftarkan langsung di `pos.module.ts`); di
 * sini dipisah ke controller tersendiri seperti modul pesantren lain.
 */

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PesantrenLaporanService } from './pesantren-laporan.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class LaporanQuery {
  @ApiPropertyOptional({ example: '2026-01-01' }) @IsOptional() @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' }) @IsOptional() @IsString()
  to?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tahunAjaranId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  gelombangId?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/laporan')
export class PesantrenLaporanController {
  constructor(private readonly laporan: PesantrenLaporanService) {}

  @Permissions('EPESANTREN_LAPORAN.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar laporan yang tersedia' })
  daftar() {
    return this.laporan.daftarLaporan();
  }

  @Permissions('EPESANTREN_LAPORAN.READ')
  @Get('dasbor')
  @ApiOperation({ summary: 'Dasbor ringkas -- gabungan beberapa laporan sekaligus' })
  dasbor(@CurrentUser() user: AuthenticatedUser) {
    return this.laporan.dasbor(schemaWajib(user));
  }

  @Permissions('EPESANTREN_LAPORAN.READ')
  @Get(':code')
  @ApiOperation({ summary: 'Menjalankan satu laporan berdasarkan kode' })
  jalankan(@Param('code') code: string, @Query() query: LaporanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.laporan.jalankan(schemaWajib(user), code, query);
  }
}
