/**
 * Titik masuk HTTP pelanggaran dan hukuman santri (EP-S1). Pola sama
 * dengan `pesantren-perizinan.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenPelanggaranService } from './pesantren-pelanggaran.service';
import { JENIS_HUKUMAN, KATEGORI_PELANGGARAN } from './pesantren-pelanggaran';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class HalamanQuery {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class DaftarPelanggaranQuery extends HalamanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;
}

class CatatJenisDto {
  @ApiProperty({ example: 'TL01' }) @IsString() @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Terlambat masuk kelas' }) @IsString() @MaxLength(160)
  nama!: string;

  @ApiProperty({ enum: KATEGORI_PELANGGARAN }) @IsIn(KATEGORI_PELANGGARAN as unknown as string[])
  kategori!: string;

  @ApiProperty({ example: 5 }) @IsNumber() @Min(1)
  poin!: number;
}

class CatatPelanggaranDto {
  @ApiProperty() @IsString()
  santriId!: string;

  @ApiProperty() @IsString()
  jenisPelanggaranId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggal?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  keterangan?: string;
}

class BatalkanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  alasan?: string;
}

class CatatHukumanDto {
  @ApiProperty() @IsString()
  pelanggaranId!: string;

  @ApiProperty({ enum: JENIS_HUKUMAN }) @IsIn(JENIS_HUKUMAN as unknown as string[])
  jenisHukuman!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  keterangan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalMulai?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalSelesai?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/pelanggaran')
export class PesantrenPelanggaranController {
  constructor(private readonly pelanggaran: PesantrenPelanggaranService) {}

  @Permissions('EPESANTREN_PELANGGARAN.READ')
  @Get('jenis')
  @ApiOperation({ summary: 'Daftar jenis pelanggaran (katalog berbobot poin)' })
  daftarJenis(@CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.daftarJenis(schemaWajib(user));
  }

  @Permissions('EPESANTREN_PELANGGARAN.CREATE')
  @Post('jenis')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan jenis pelanggaran' })
  catatJenis(@Body() dto: CatatJenisDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.catatJenis(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PELANGGARAN.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar catatan pelanggaran' })
  daftar(@Query() query: DaftarPelanggaranQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.daftarPelanggaran(schemaWajib(user), {
      santriId: query.santriId,
      status: query.status,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_PELANGGARAN.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu catatan pelanggaran' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const pelanggaran = await this.pelanggaran.satuPelanggaran(schemaWajib(user), id);
    if (!pelanggaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pelanggaran tidak ditemukan.');
    }
    return pelanggaran;
  }

  @Permissions('EPESANTREN_PELANGGARAN.READ')
  @Get('santri/:santriId/total-poin')
  @ApiOperation({ summary: 'Total poin pelanggaran aktif seorang santri' })
  async totalPoin(@Param('santriId') santriId: string, @CurrentUser() user: AuthenticatedUser) {
    const totalPoin = await this.pelanggaran.totalPoin(schemaWajib(user), santriId);
    return { santriId, totalPoin };
  }

  @Permissions('EPESANTREN_PELANGGARAN.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat pelanggaran tata tertib' })
  catat(@Body() dto: CatatPelanggaranDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.catatPelanggaran(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PELANGGARAN.CANCEL')
  @Post(':id/batalkan')
  @ApiOperation({ summary: 'Membatalkan catatan pelanggaran (mis. salah catat)' })
  batalkan(@Param('id') id: string, @Body() dto: BatalkanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.batalkanPelanggaran(schemaWajib(user), id, dto.alasan, user.userId);
  }

  @Permissions('EPESANTREN_PELANGGARAN.READ')
  @Get(':id/hukuman')
  @ApiOperation({ summary: 'Daftar hukuman atas satu pelanggaran' })
  daftarHukuman(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.daftarHukuman(schemaWajib(user), id);
  }

  @Permissions('EPESANTREN_PELANGGARAN.CREATE')
  @Post(':id/hukuman')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menjatuhkan hukuman atas satu pelanggaran' })
  catatHukuman(@Param('id') id: string, @Body() dto: Omit<CatatHukumanDto, 'pelanggaranId'>, @CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.catatHukuman(schemaWajib(user), { ...dto, pelanggaranId: id }, user.userId);
  }

  @Permissions('EPESANTREN_PELANGGARAN.UPDATE')
  @Post('hukuman/:hukumanId/selesai')
  @ApiOperation({ summary: 'Menandai hukuman sudah selesai dijalani' })
  selesaikanHukuman(@Param('hukumanId') hukumanId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.selesaikanHukuman(schemaWajib(user), hukumanId, user.userId);
  }

  @Permissions('EPESANTREN_PELANGGARAN.CANCEL')
  @Post('hukuman/:hukumanId/batalkan')
  @ApiOperation({ summary: 'Membatalkan hukuman' })
  batalkanHukuman(@Param('hukumanId') hukumanId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pelanggaran.batalkanHukuman(schemaWajib(user), hukumanId, user.userId);
  }
}
