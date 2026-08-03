/**
 * Titik masuk HTTP izin santri (EP-J). Pola sama dengan
 * `pesantren-santri.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenPerizinanService } from './pesantren-perizinan.service';
import { JENIS_IZIN } from './pesantren-perizinan';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarIzinQuery {
  @ApiPropertyOptional({ enum: ['MENUNGGU', 'DISETUJUI', 'DITOLAK', 'SELESAI', 'DIBATALKAN'] })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class AjukanIzinDto {
  @ApiProperty()
  @IsString()
  santriId!: string;

  @ApiProperty({ enum: JENIS_IZIN })
  @IsIn(JENIS_IZIN as unknown as string[])
  jenis!: string;

  @ApiProperty({ example: 'Ada acara keluarga' })
  @IsString() @MaxLength(500)
  alasan!: string;

  @ApiProperty({ example: '2026-08-02' })
  @IsISO8601()
  tanggalMulai!: string;

  @ApiProperty({ example: '2026-08-03' })
  @IsISO8601()
  tanggalSelesaiRencana!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  lampiranUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  kontakPenjemput?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  noHpPenjemput?: string;

  @ApiPropertyOptional() @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

class KeputusanIzinDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  catatan?: string;
}

class DisposisiIzinDto {
  @ApiProperty() @IsString()
  disposisiKe!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  catatan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/perizinan')
export class PesantrenPerizinanController {
  constructor(private readonly perizinan: PesantrenPerizinanService) {}

  @Permissions('EPESANTREN_PERIZINAN.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar izin santri' })
  daftar(@Query() query: DaftarIzinQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.perizinan.daftar(schemaWajib(user), {
      status: query.status,
      santriId: query.santriId,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_PERIZINAN.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu izin' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const izin = await this.perizinan.satu(schemaWajib(user), id);
    if (!izin) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Izin tidak ditemukan.');
    }
    return izin;
  }

  @Permissions('EPESANTREN_PERIZINAN.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mengajukan izin baru untuk satu santri' })
  ajukan(@Body() dto: AjukanIzinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.perizinan.ajukan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PERIZINAN.APPROVE')
  @Post(':id/disposisi')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mendisposisikan izin menunggu ke pengurus lain' })
  disposisi(@Param('id') id: string, @Body() dto: DisposisiIzinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.perizinan.disposisi(schemaWajib(user), id, dto, user.userId);
  }

  @Permissions('EPESANTREN_PERIZINAN.APPROVE')
  @Post(':id/setujui')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menyetujui izin yang menunggu' })
  setujui(@Param('id') id: string, @Body() dto: KeputusanIzinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.perizinan.setujui(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PERIZINAN.REJECT')
  @Post(':id/tolak')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menolak izin yang menunggu' })
  tolak(@Param('id') id: string, @Body() dto: KeputusanIzinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.perizinan.tolak(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PERIZINAN.CANCEL')
  @Post(':id/batalkan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Membatalkan izin yang belum selesai' })
  batalkan(@Param('id') id: string, @Body() dto: KeputusanIzinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.perizinan.batalkan(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PERIZINAN.UPDATE')
  @Post(':id/selesai')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menandai izin selesai setelah santri kembali' })
  selesaikan(@Param('id') id: string, @Body() dto: KeputusanIzinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.perizinan.selesaikan(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PERIZINAN.READ')
  @Get(':id/riwayat')
  @ApiOperation({ summary: 'Riwayat keputusan dan disposisi izin' })
  riwayat(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.perizinan.riwayat(schemaWajib(user), id);
  }
}
