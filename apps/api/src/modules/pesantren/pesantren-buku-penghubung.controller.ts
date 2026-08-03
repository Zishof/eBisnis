/**
 * Titik masuk HTTP buku penghubung santri.
 */

import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  JENIS_BUKU_PENGHUBUNG,
  STATUS_BUKU_PENGHUBUNG,
  VISIBILITAS_BUKU_PENGHUBUNG,
} from './pesantren-buku-penghubung';
import { PesantrenBukuPenghubungService } from './pesantren-buku-penghubung.service';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarBukuPenghubungQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional({ enum: JENIS_BUKU_PENGHUBUNG }) @IsOptional() @IsIn(JENIS_BUKU_PENGHUBUNG as unknown as string[])
  jenis?: string;

  @ApiPropertyOptional({ enum: STATUS_BUKU_PENGHUBUNG }) @IsOptional() @IsIn(STATUS_BUKU_PENGHUBUNG as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatBukuPenghubungDto {
  @ApiProperty() @IsString()
  santriId!: string;

  @ApiPropertyOptional({ example: '2026-08-04' }) @IsOptional() @IsString()
  tanggal?: string;

  @ApiProperty({ enum: JENIS_BUKU_PENGHUBUNG }) @IsIn(JENIS_BUKU_PENGHUBUNG as unknown as string[])
  jenis!: string;

  @ApiProperty({ enum: VISIBILITAS_BUKU_PENGHUBUNG }) @IsIn(VISIBILITAS_BUKU_PENGHUBUNG as unknown as string[])
  visibilitas!: string;

  @ApiProperty({ example: 'Perlu perhatian hafalan sore' }) @IsString() @MaxLength(180)
  judul!: string;

  @ApiProperty() @IsString() @MaxLength(4000)
  isi!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000)
  tindakLanjut?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  ditulisOlehGuruId?: string;
}

class SelesaikanBukuPenghubungDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000)
  tindakLanjut?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/buku-penghubung')
export class PesantrenBukuPenghubungController {
  constructor(private readonly bukuPenghubung: PesantrenBukuPenghubungService) {}

  @Permissions('EPESANTREN_BUKU_PENGHUBUNG.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar buku penghubung/catatan santri' })
  daftar(@Query() query: DaftarBukuPenghubungQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.bukuPenghubung.daftar(schemaWajib(user), {
      santriId: query.santriId,
      jenis: query.jenis,
      status: query.status,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_BUKU_PENGHUBUNG.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail catatan buku penghubung' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const catatan = await this.bukuPenghubung.satu(schemaWajib(user), id);
    if (!catatan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Catatan buku penghubung tidak ditemukan.');
    }
    return catatan;
  }

  @Permissions('EPESANTREN_BUKU_PENGHUBUNG.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat buku penghubung santri' })
  catat(@Body() dto: CatatBukuPenghubungDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bukuPenghubung.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_BUKU_PENGHUBUNG.UPDATE')
  @Patch(':id/selesai')
  @ApiOperation({ summary: 'Menutup catatan setelah ditindaklanjuti' })
  selesaikan(
    @Param('id') id: string,
    @Body() dto: SelesaikanBukuPenghubungDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bukuPenghubung.selesaikan(schemaWajib(user), id, dto, user.userId);
  }
}
