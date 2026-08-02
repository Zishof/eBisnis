/**
 * Titik masuk HTTP data santri.
 *
 * Seluruh impor di atas kelas — `@Controller` menulis `design:paramtypes` saat
 * kelas didefinisikan, dan impor di bawahnya membuat Nest membaca `undefined`
 * sebagai tipe dependensi (cacat yang pernah terjadi pada modul POS).
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenSantriService } from './pesantren-santri.service';
import { JENIS_KELAMIN, STATUS_SANTRI, STATUS_TINGGAL } from './pesantren-santri';
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

class DaftarSantriQuery {
  @ApiPropertyOptional({ enum: STATUS_SANTRI })
  @IsOptional() @IsIn(STATUS_SANTRI as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ description: 'Mencari pada nama atau NIS' })
  @IsOptional() @IsString() @MaxLength(160)
  cari?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatSantriDto {
  @ApiProperty({ example: 'S-2026-0001' })
  @IsString() @MaxLength(32)
  nis!: string;

  @ApiProperty({ example: 'Ahmad Fulan' })
  @IsString() @MaxLength(160)
  namaLengkap!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  namaPanggilan?: string;

  @ApiProperty({ enum: JENIS_KELAMIN })
  @IsIn(JENIS_KELAMIN as unknown as string[])
  jenisKelamin!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  tempatLahir?: string;

  @ApiPropertyOptional({ example: '2012-05-01' })
  @IsOptional() @IsISO8601()
  tanggalLahir?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  unitPendidikanId?: string;

  @ApiProperty({ enum: STATUS_TINGGAL })
  @IsIn(STATUS_TINGGAL as unknown as string[])
  statusTinggal!: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional() @IsISO8601()
  tanggalMasuk?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  alamatAsal?: string;

  @ApiPropertyOptional({ example: 'O+' })
  @IsOptional() @IsString() @MaxLength(4)
  golonganDarah?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  catatanAlergi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  catatan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/santri')
export class PesantrenSantriController {
  constructor(private readonly santri: PesantrenSantriService) {}

  @Permissions('EPESANTREN_SANTRI.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar santri' })
  async daftar(@Query() query: DaftarSantriQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.santri.daftar(schemaWajib(user), {
      status: query.status,
      cari: query.cari,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100
          ? query.ukuranHalaman
          : 25,
    });
  }

  @Permissions('EPESANTREN_SANTRI.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu santri' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const santri = await this.santri.satu(schemaWajib(user), id);
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }
    return santri;
  }

  @Permissions('EPESANTREN_SANTRI.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mendaftarkan santri baru' })
  async catat(@Body() dto: CatatSantriDto, @CurrentUser() user: AuthenticatedUser) {
    return this.santri.catat(schemaWajib(user), dto, user.userId);
  }
}
