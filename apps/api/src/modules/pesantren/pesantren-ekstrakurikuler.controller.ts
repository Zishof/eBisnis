/**
 * Titik masuk HTTP ekstrakurikuler dan organisasi siswa (EP-S4). Pola
 * sama dengan `pesantren-rombongan.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PesantrenEkstrakurikulerService } from './pesantren-ekstrakurikuler.service';
import { JABATAN_EKSTRAKURIKULER, JENIS_EKSTRAKURIKULER } from './pesantren-ekstrakurikuler';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class CatatEkskulDto {
  @ApiProperty({ example: 'PRAMUKA' }) @IsString() @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Pramuka' }) @IsString() @MaxLength(160)
  nama!: string;

  @ApiProperty({ enum: JENIS_EKSTRAKURIKULER }) @IsIn(JENIS_EKSTRAKURIKULER as unknown as string[])
  jenis!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  pembinaGuruId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  deskripsi?: string;
}

class TambahAnggotaDto {
  @ApiProperty() @IsString()
  ekstrakurikulerId!: string;

  @ApiProperty() @IsString()
  santriId!: string;

  @ApiProperty() @IsString()
  tahunAjaranId!: string;

  @ApiPropertyOptional({ enum: JABATAN_EKSTRAKURIKULER }) @IsOptional() @IsIn(JABATAN_EKSTRAKURIKULER as unknown as string[])
  jabatan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalBergabung?: string;
}

class NilaiPartisipasiDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100)
  nilaiPartisipasi?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  catatan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/ekstrakurikuler')
export class PesantrenEkstrakurikulerController {
  constructor(private readonly ekskul: PesantrenEkstrakurikulerService) {}

  @Permissions('EPESANTREN_EKSTRAKURIKULER.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar ekstrakurikuler dan organisasi siswa' })
  daftar(@Query('jenis') jenis: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ekskul.daftar(schemaWajib(user), { jenis });
  }

  @Permissions('EPESANTREN_EKSTRAKURIKULER.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu ekstrakurikuler' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const ekskul = await this.ekskul.satu(schemaWajib(user), id);
    if (!ekskul) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Ekstrakurikuler tidak ditemukan.');
    }
    return ekskul;
  }

  @Permissions('EPESANTREN_EKSTRAKURIKULER.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat ekstrakurikuler/organisasi siswa baru' })
  catat(@Body() dto: CatatEkskulDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ekskul.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_EKSTRAKURIKULER.READ')
  @Get(':id/anggota')
  @ApiOperation({ summary: 'Daftar anggota satu ekstrakurikuler' })
  daftarAnggota(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ekskul.daftarAnggota(schemaWajib(user), id);
  }

  @Permissions('EPESANTREN_EKSTRAKURIKULER.READ')
  @Get('santri/:santriId')
  @ApiOperation({ summary: 'Daftar ekstrakurikuler yang diikuti satu santri' })
  daftarEkskulSantri(@Param('santriId') santriId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ekskul.daftarEkskulSantri(schemaWajib(user), santriId);
  }

  @Permissions('EPESANTREN_EKSTRAKURIKULER.CREATE')
  @Post('anggota')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan santri sebagai anggota ekstrakurikuler' })
  tambahAnggota(@Body() dto: TambahAnggotaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ekskul.tambahAnggota(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_EKSTRAKURIKULER.UPDATE')
  @Post('anggota/:id/keluar')
  @ApiOperation({ summary: 'Mengeluarkan santri dari ekstrakurikuler' })
  keluarkanAnggota(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ekskul.keluarkanAnggota(schemaWajib(user), id, user.userId);
  }

  @Permissions('EPESANTREN_EKSTRAKURIKULER.UPDATE')
  @Post('anggota/:id/nilai-partisipasi')
  @ApiOperation({ summary: 'Mencatat nilai partisipasi seorang anggota' })
  catatNilaiPartisipasi(@Param('id') id: string, @Body() dto: NilaiPartisipasiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ekskul.catatNilaiPartisipasi(schemaWajib(user), id, dto, user.userId);
  }
}
