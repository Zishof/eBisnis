/**
 * Titik masuk HTTP guru dan penugasan mengajar (EP-S2). Pola sama dengan
 * `pesantren-santri.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenGuruService } from './pesantren-guru.service';
import { JENIS_GURU } from './pesantren-guru';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarGuruQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  cari?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatGuruDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  nip?: string;

  @ApiProperty({ example: 'Ust. Abdullah' }) @IsString()
  nama!: string;

  @ApiProperty({ enum: JENIS_GURU }) @IsIn(JENIS_GURU as unknown as string[])
  jenis!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  noHp?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  alamat?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  userSubjectId?: string;
}

class CatatPenugasanDto {
  @ApiProperty() @IsString()
  guruId!: string;

  @ApiProperty() @IsString()
  mataPelajaranId!: string;

  @ApiProperty() @IsString()
  rombonganId!: string;

  @ApiProperty() @IsString()
  tahunAjaranId!: string;

  @ApiProperty({ example: 4 }) @IsNumber() @Min(1)
  jamPerMinggu!: number;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/guru')
export class PesantrenGuruController {
  constructor(private readonly guru: PesantrenGuruService) {}

  @Permissions('EPESANTREN_GURU.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar guru' })
  daftar(@Query() query: DaftarGuruQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.guru.daftar(schemaWajib(user), {
      status: query.status,
      cari: query.cari,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_GURU.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu guru' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const guru = await this.guru.satu(schemaWajib(user), id);
    if (!guru) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Guru tidak ditemukan.');
    }
    return guru;
  }

  @Permissions('EPESANTREN_GURU.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan guru baru' })
  catat(@Body() dto: CatatGuruDto, @CurrentUser() user: AuthenticatedUser) {
    return this.guru.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_GURU.UPDATE')
  @Post(':id/nonaktifkan')
  @ApiOperation({ summary: 'Menonaktifkan guru' })
  nonaktifkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.guru.nonaktifkan(schemaWajib(user), id, user.userId);
  }

  @Permissions('EPESANTREN_GURU.READ')
  @Get(':id/total-jam-mengajar')
  @ApiOperation({ summary: 'Total jam mengajar per minggu dari penugasan aktif' })
  async totalJamMengajar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const totalJamPerMinggu = await this.guru.totalJamMengajar(schemaWajib(user), id);
    return { guruId: id, totalJamPerMinggu };
  }

  @Permissions('EPESANTREN_GURU.READ')
  @Get('penugasan/daftar')
  @ApiOperation({ summary: 'Daftar penugasan mengajar' })
  daftarPenugasan(@Query('guruId') guruId: string, @Query('rombonganId') rombonganId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.guru.daftarPenugasan(schemaWajib(user), { guruId, rombonganId });
  }

  @Permissions('EPESANTREN_GURU.CREATE')
  @Post('penugasan')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menugaskan guru mengajar mata pelajaran pada satu rombongan' })
  catatPenugasan(@Body() dto: CatatPenugasanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.guru.catatPenugasan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_GURU.UPDATE')
  @Post('penugasan/:id/selesai')
  @ApiOperation({ summary: 'Menandai penugasan mengajar selesai' })
  selesaikanPenugasan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.guru.selesaikanPenugasan(schemaWajib(user), id, user.userId);
  }
}
