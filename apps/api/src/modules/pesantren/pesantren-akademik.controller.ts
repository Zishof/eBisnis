import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PesantrenAkademikService } from './pesantren-akademik.service';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarKeputusanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  tahunAjaranId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class BuatKeputusanDto {
  @ApiProperty() @IsString()
  santriId!: string;

  @ApiProperty() @IsString()
  tahunAjaranAsalId!: string;

  @ApiProperty({ enum: ['NAIK_KELAS', 'TINGGAL_KELAS', 'LULUS', 'KELUAR'] }) @IsString()
  jenis!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  rombonganTujuanId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalKeputusan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalEfektif?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  catatan?: string;
}

class BatalkanKeputusanDto {
  @ApiProperty() @IsString()
  reason!: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/akademik')
export class PesantrenAkademikController {
  constructor(private readonly akademik: PesantrenAkademikService) {}

  @Permissions('EPESANTREN_AKADEMIK.READ')
  @Get('keputusan')
  @ApiOperation({ summary: 'Daftar keputusan kenaikan kelas dan kelulusan' })
  daftar(@Query() query: DaftarKeputusanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.akademik.daftar(schemaWajib(user), {
      tahunAjaranId: query.tahunAjaranId,
      status: query.status,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_AKADEMIK.CREATE')
  @Post('keputusan')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat draft keputusan akademik' })
  buat(@Body() dto: BuatKeputusanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.akademik.buat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_AKADEMIK.APPROVE')
  @Post('keputusan/:id/finalisasi')
  @ApiOperation({ summary: 'Finalisasi keputusan akademik setelah rapor final' })
  finalisasi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.akademik.finalisasi(schemaWajib(user), id, user.userId);
  }

  @Permissions('EPESANTREN_AKADEMIK.APPROVE')
  @Post('keputusan/:id/eksekusi')
  @ApiOperation({ summary: 'Eksekusi keputusan akademik ke status santri atau rombongan baru' })
  eksekusi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.akademik.eksekusi(schemaWajib(user), id, user.userId);
  }

  @Permissions('EPESANTREN_AKADEMIK.CANCEL')
  @Post('keputusan/:id/batalkan')
  @ApiOperation({ summary: 'Batalkan keputusan akademik yang belum dieksekusi' })
  batalkan(@Param('id') id: string, @Body() dto: BatalkanKeputusanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.akademik.batalkan(schemaWajib(user), id, dto.reason, user.userId);
  }
}
