/**
 * Titik masuk HTTP asrama, kamar, dan penempatan santri (EP-G). Pola sama
 * dengan `pesantren-santri.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PesantrenAsramaService } from './pesantren-asrama.service';
import { JENIS_ASRAMA } from './pesantren-asrama';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class CatatAsramaDto {
  @ApiProperty({ example: 'ASR-PA-01' })
  @IsString() @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Asrama Putra Al-Fatih' })
  @IsString() @MaxLength(160)
  nama!: string;

  @ApiProperty({ enum: JENIS_ASRAMA })
  @IsIn(JENIS_ASRAMA as unknown as string[])
  jenis!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  alamat?: string;
}

class CatatKamarDto {
  @ApiProperty({ example: '101' })
  @IsString() @MaxLength(32)
  nomor!: string;

  @ApiProperty({ example: 8 })
  @IsInt() @IsPositive()
  kapasitas!: number;
}

class DaftarPenempatanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  kamarId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional({ description: 'Hanya penempatan yang masih berjalan' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  hanyaAktif?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class TempatkanDto {
  @ApiProperty()
  @IsString()
  santriId!: string;

  @ApiProperty()
  @IsString()
  kamarId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  catatan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/asrama')
export class PesantrenAsramaController {
  constructor(private readonly asrama: PesantrenAsramaService) {}

  @Permissions('EPESANTREN_ASRAMA.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar asrama' })
  daftarAsrama(@CurrentUser() user: AuthenticatedUser) {
    return this.asrama.daftarAsrama(schemaWajib(user));
  }

  @Permissions('EPESANTREN_ASRAMA.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat asrama baru' })
  catatAsrama(@Body() dto: CatatAsramaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.asrama.catatAsrama(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_ASRAMA.READ')
  @Get(':id/kamar')
  @ApiOperation({ summary: 'Daftar kamar pada satu asrama, beserta jumlah terisi' })
  daftarKamar(@Param('id') asramaId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.asrama.daftarKamar(schemaWajib(user), asramaId);
  }

  @Permissions('EPESANTREN_ASRAMA.CREATE')
  @Post(':id/kamar')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat kamar baru pada satu asrama' })
  catatKamar(@Param('id') asramaId: string, @Body() dto: CatatKamarDto, @CurrentUser() user: AuthenticatedUser) {
    return this.asrama.catatKamar(schemaWajib(user), asramaId, dto, user.userId);
  }
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/penempatan')
export class PesantrenPenempatanController {
  constructor(private readonly asrama: PesantrenAsramaService) {}

  @Permissions('EPESANTREN_ASRAMA.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar penempatan santri ke kamar' })
  daftar(@Query() query: DaftarPenempatanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.asrama.daftarPenempatan(schemaWajib(user), {
      kamarId: query.kamarId,
      santriId: query.santriId,
      hanyaAktif: query.hanyaAktif,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_ASRAMA.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Menempatkan santri ke sebuah kamar' })
  tempatkan(@Body() dto: TempatkanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.asrama.tempatkan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_ASRAMA.UPDATE')
  @Post(':id/akhiri')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengakhiri penempatan aktif' })
  akhiri(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.asrama.akhiri(schemaWajib(user), id, user.userId);
  }
}
