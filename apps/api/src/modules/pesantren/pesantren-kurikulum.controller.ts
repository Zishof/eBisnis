/**
 * Titik masuk HTTP kurikulum dan jadwal pelajaran (EP-O4). Pola sama
 * dengan `pesantren-nilai.controller.ts`.
 */

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PesantrenKurikulumService } from './pesantren-kurikulum.service';
import { HARI } from './pesantren-kurikulum';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarKurikulumQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  unitPendidikanId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tahunAjaranId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tingkat?: string;
}

class CatatKurikulumDto {
  @ApiProperty() @IsString()
  unitPendidikanId!: string;

  @ApiProperty() @IsString()
  tahunAjaranId!: string;

  @ApiProperty({ example: 'VII' }) @IsString()
  tingkat!: string;

  @ApiProperty() @IsString()
  mataPelajaranId!: string;

  @ApiProperty({ example: 4 }) @IsNumber() @Min(1)
  jamPerMinggu!: number;
}

class DaftarJadwalQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  rombonganId?: string;

  @ApiPropertyOptional({ enum: HARI }) @IsOptional() @IsIn(HARI as unknown as string[])
  hari?: string;
}

class CatatJadwalDto {
  @ApiProperty() @IsString()
  rombonganId!: string;

  @ApiProperty() @IsString()
  mataPelajaranId!: string;

  @ApiProperty({ enum: HARI }) @IsIn(HARI as unknown as string[])
  hari!: string;

  @ApiProperty({ example: '07:00' }) @IsString()
  waktuMulai!: string;

  @ApiProperty({ example: '08:30' }) @IsString()
  waktuSelesai!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  pengajarUserId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  ruangan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/kurikulum')
export class PesantrenKurikulumController {
  constructor(private readonly kurikulum: PesantrenKurikulumService) {}

  @Permissions('EPESANTREN_KURIKULUM.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar kurikulum (mata pelajaran + jam per minggu)' })
  daftar(@Query() query: DaftarKurikulumQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.kurikulum.daftarKurikulum(schemaWajib(user), query);
  }

  @Permissions('EPESANTREN_KURIKULUM.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan mata pelajaran ke kurikulum' })
  catat(@Body() dto: CatatKurikulumDto, @CurrentUser() user: AuthenticatedUser) {
    return this.kurikulum.catatKurikulum(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_KURIKULUM.READ')
  @Get('jadwal')
  @ApiOperation({ summary: 'Daftar jadwal pelajaran' })
  daftarJadwal(@Query() query: DaftarJadwalQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.kurikulum.daftarJadwal(schemaWajib(user), query);
  }

  @Permissions('EPESANTREN_KURIKULUM.CREATE')
  @Post('jadwal')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menjadwalkan mata pelajaran pada rombongan belajar' })
  catatJadwal(@Body() dto: CatatJadwalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.kurikulum.catatJadwal(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_KURIKULUM.CANCEL')
  @Delete('jadwal/:id')
  @ApiOperation({ summary: 'Membatalkan satu jadwal pelajaran' })
  batalkanJadwal(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.kurikulum.batalkanJadwal(schemaWajib(user), id, user.userId);
  }
}
