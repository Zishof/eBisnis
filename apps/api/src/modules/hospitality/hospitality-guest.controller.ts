/**
 * Titik masuk HTTP profil tamu, consent, do-not-rent, penggabungan, dan
 * permintaan privasi (MI-7). Pola sama dengan
 * `hospitality-properti.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { HospitalityGuestService } from './hospitality-guest.service';
import { JENIS_IDENTITAS, JENIS_PERMINTAAN_PRIVASI, STATUS_PERMINTAAN_PRIVASI } from './hospitality-guest';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarTamuQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  cari?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CariKemiripanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  namaLengkap?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  telepon?: string;
}

class CatatTamuDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString() @MaxLength(160)
  namaLengkap!: string;

  @ApiPropertyOptional({ enum: JENIS_IDENTITAS })
  @IsOptional() @IsIn(JENIS_IDENTITAS as unknown as string[])
  jenisIdentitas?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  nomorIdentitas?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32)
  telepon?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  alamat?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  kewarganegaraan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalLahir?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  preferensi?: string;
}

class ConsentDto {
  @ApiProperty()
  @IsBoolean()
  marketingConsent!: boolean;
}

class DoNotRentDto {
  @ApiProperty()
  @IsBoolean()
  doNotRent!: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  alasan?: string;
}

class GabungDto {
  @ApiProperty()
  @IsString()
  intoGuestId!: string;
}

class PermintaanPrivasiDto {
  @ApiProperty({ enum: JENIS_PERMINTAAN_PRIVASI })
  @IsIn(JENIS_PERMINTAAN_PRIVASI as unknown as string[])
  jenis!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  catatan?: string;
}

class ProsesPermintaanPrivasiDto {
  @ApiProperty({ enum: STATUS_PERMINTAAN_PRIVASI })
  @IsIn(STATUS_PERMINTAAN_PRIVASI as unknown as string[])
  status!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  catatan?: string;
}

@ApiTags('hospitality')
@ApiBearerAuth('access-token')
@Controller('hospitality/tamu')
export class HospitalityGuestController {
  constructor(private readonly tamu: HospitalityGuestService) {}

  @Permissions('HOSPITALITY_TAMU.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar tamu' })
  daftar(@Query() query: DaftarTamuQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.tamu.daftarTamu(schemaWajib(user), {
      cari: query.cari,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('HOSPITALITY_TAMU.READ')
  @Get('cari-kemiripan')
  @ApiOperation({ summary: 'Mencari profil tamu yang mirip (deteksi duplikat, bukan penolakan)' })
  cariKemiripan(@Query() query: CariKemiripanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.tamu.cariKemiripan(schemaWajib(user), query);
  }

  @Permissions('HOSPITALITY_TAMU.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu tamu' })
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tamu.detailTamu(schemaWajib(user), id);
  }

  @Permissions('HOSPITALITY_TAMU.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat tamu baru' })
  catat(@Body() dto: CatatTamuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tamu.catatTamu(schemaWajib(user), dto, user.userId);
  }

  @Permissions('HOSPITALITY_TAMU.UPDATE')
  @Post(':id/consent')
  @ApiOperation({ summary: 'Mengatur consent komunikasi pemasaran' })
  consent(@Param('id') id: string, @Body() dto: ConsentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tamu.aturConsent(schemaWajib(user), id, dto.marketingConsent, user.userId);
  }

  @Permissions('HOSPITALITY_TAMU.UPDATE')
  @Post(':id/do-not-rent')
  @ApiOperation({ summary: 'Menandai atau membuka status do-not-rent' })
  doNotRent(@Param('id') id: string, @Body() dto: DoNotRentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tamu.aturDoNotRent(schemaWajib(user), id, dto, user.userId);
  }

  @Permissions('HOSPITALITY_TAMU.UPDATE')
  @Post(':id/gabung')
  @ApiOperation({ summary: 'Menggabungkan profil tamu ini ke profil lain' })
  gabung(@Param('id') id: string, @Body() dto: GabungDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tamu.gabungkan(schemaWajib(user), id, dto, user.userId);
  }

  @Permissions('HOSPITALITY_TAMU.READ')
  @Get(':id/permintaan-privasi')
  @ApiOperation({ summary: 'Daftar permintaan privasi tamu ini' })
  daftarPermintaanPrivasi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tamu.daftarPermintaanPrivasi(schemaWajib(user), id);
  }

  @Permissions('HOSPITALITY_TAMU.UPDATE')
  @Post(':id/permintaan-privasi')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mengajukan permintaan privasi (ekspor/penghapusan data)' })
  ajukanPermintaanPrivasi(
    @Param('id') id: string,
    @Body() dto: PermintaanPrivasiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tamu.ajukanPermintaanPrivasi(schemaWajib(user), id, dto, user.userId);
  }

  @Permissions('HOSPITALITY_TAMU.UPDATE')
  @Post('permintaan-privasi/:requestId/proses')
  @ApiOperation({ summary: 'Menyelesaikan atau menolak permintaan privasi' })
  prosesPermintaanPrivasi(
    @Param('requestId') requestId: string,
    @Body() dto: ProsesPermintaanPrivasiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tamu.prosesPermintaanPrivasi(schemaWajib(user), requestId, dto, user.userId);
  }
}
