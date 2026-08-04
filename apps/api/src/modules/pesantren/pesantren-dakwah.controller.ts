import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PesantrenDakwahService } from './pesantren-dakwah.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

const STATUS_KAJIAN = ['DRAFT', 'TERBIT', 'ARSIP'] as const;

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarKajianQuery {
  @ApiPropertyOptional({ enum: STATUS_KAJIAN })
  @IsOptional()
  @IsIn(STATUS_KAJIAN as unknown as string[])
  status?: string;
}

class SimpanKajianDto {
  @ApiProperty({ example: 'Kajian Kitab Adabul Alim wal Mutaallim' })
  @IsString()
  @MaxLength(180)
  judul!: string;

  @ApiPropertyOptional({ example: 'KH. Masyhuri Dahlan' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  pemateri?: string | null;

  @ApiProperty({ example: '2026-08-04T19:30:00+07:00' })
  @IsISO8601()
  tanggalMulai!: string;

  @ApiPropertyOptional({ example: '2026-08-04T21:00:00+07:00' })
  @IsOptional()
  @IsISO8601()
  tanggalSelesai?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  lokasi?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ringkasan?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  materiUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rekamanUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarUrl?: string | null;

  @ApiPropertyOptional({ enum: STATUS_KAJIAN })
  @IsOptional()
  @IsIn(STATUS_KAJIAN as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number | null;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/kajian')
export class PesantrenKajianController {
  constructor(private readonly dakwah: PesantrenDakwahService) {}

  @Permissions('EPESANTREN_DINIYAH.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar jadwal kajian dan arsip dakwah' })
  daftar(@Query() query: DaftarKajianQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.dakwah.daftar(schemaWajib(user), { status: query.status });
  }

  @Permissions('EPESANTREN_DINIYAH.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat jadwal kajian atau arsip dakwah' })
  catat(@Body() dto: SimpanKajianDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dakwah.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_DINIYAH.UPDATE')
  @Patch(':id')
  @ApiOperation({ summary: 'Memperbarui jadwal kajian atau arsip dakwah' })
  ubah(@Param('id') id: string, @Body() dto: SimpanKajianDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dakwah.ubah(schemaWajib(user), id, dto, user.userId);
  }

  @Permissions('EPESANTREN_DINIYAH.UPDATE')
  @Delete(':id')
  @ApiOperation({ summary: 'Menghapus jadwal kajian atau arsip dakwah' })
  hapus(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dakwah.hapus(schemaWajib(user), id, user.userId);
  }
}
