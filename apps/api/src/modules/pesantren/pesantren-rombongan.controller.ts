/**
 * Titik masuk HTTP rombongan belajar/kelas (EP-O3). Pola sama dengan
 * `pesantren-asrama.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenRombonganService } from './pesantren-rombongan.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarRombonganQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  unitPendidikanId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tahunAjaranId?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatRombonganDto {
  @ApiProperty() @IsString()
  unitPendidikanId!: string;

  @ApiProperty() @IsString()
  tahunAjaranId!: string;

  @ApiProperty({ example: 'VII' }) @IsString()
  tingkat!: string;

  @ApiProperty({ example: 'VII-A' }) @IsString()
  nama!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  waliKelasUserId?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1)
  kapasitas?: number;
}

class TempatkanDto {
  @ApiProperty() @IsString()
  rombonganId!: string;

  @ApiProperty() @IsString()
  santriId!: string;

  @ApiProperty() @IsString()
  tahunAjaranId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalMasuk?: string;
}

class PindahkanDto {
  @ApiProperty() @IsString()
  rombonganBaruId!: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/rombongan')
export class PesantrenRombonganController {
  constructor(private readonly rombongan: PesantrenRombonganService) {}

  @Permissions('EPESANTREN_ROMBONGAN.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar rombongan belajar/kelas' })
  daftar(@Query() query: DaftarRombonganQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.rombongan.daftar(schemaWajib(user), {
      unitPendidikanId: query.unitPendidikanId,
      tahunAjaranId: query.tahunAjaranId,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_ROMBONGAN.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu rombongan belajar' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const rombongan = await this.rombongan.satu(schemaWajib(user), id);
    if (!rombongan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Rombongan belajar tidak ditemukan.');
    }
    return rombongan;
  }

  @Permissions('EPESANTREN_ROMBONGAN.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat rombongan belajar/kelas baru' })
  catat(@Body() dto: CatatRombonganDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rombongan.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_ROMBONGAN.READ')
  @Get(':id/anggota')
  @ApiOperation({ summary: 'Daftar anggota satu rombongan belajar' })
  daftarAnggota(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rombongan.daftarAnggota(schemaWajib(user), id);
  }

  @Permissions('EPESANTREN_ROMBONGAN.CREATE')
  @Post('anggota')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menempatkan santri ke rombongan belajar' })
  tempatkan(@Body() dto: TempatkanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rombongan.tempatkan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_ROMBONGAN.CREATE')
  @Post('anggota/:id/pindah')
  @ApiOperation({ summary: 'Memindahkan santri ke rombongan lain' })
  pindahkan(@Param('id') id: string, @Body() dto: PindahkanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rombongan.pindahkan(schemaWajib(user), id, dto.rombonganBaruId, user.userId);
  }

  @Permissions('EPESANTREN_ROMBONGAN.CREATE')
  @Post('anggota/:id/keluar')
  @ApiOperation({ summary: 'Mengeluarkan santri dari rombongan (tanpa memindahkan ke rombongan lain)' })
  keluarkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rombongan.keluarkan(schemaWajib(user), id, user.userId);
  }
}
