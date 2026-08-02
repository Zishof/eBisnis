/**
 * Titik masuk HTTP kitab, halaqah, dan keanggotaan santri (EP-H). Pola sama
 * dengan `pesantren-santri.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PesantrenDiniyahService } from './pesantren-diniyah.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class CatatKitabDto {
  @ApiProperty({ example: 'FQ-01' })
  @IsString() @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Safinatun Najah' })
  @IsString() @MaxLength(160)
  judul!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  pengarang?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  keterangan?: string;
}

class CatatHalaqahDto {
  @ApiProperty({ example: 'HLQ-FQ-01' })
  @IsString() @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Kajian Fikih Kelas 1' })
  @IsString() @MaxLength(160)
  nama!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  kitabId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  ustadzId?: string;
}

class GabungkanDto {
  @ApiProperty()
  @IsString()
  santriId!: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/kitab')
export class PesantrenKitabController {
  constructor(private readonly diniyah: PesantrenDiniyahService) {}

  @Permissions('EPESANTREN_DINIYAH.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar kitab' })
  daftar(@CurrentUser() user: AuthenticatedUser) {
    return this.diniyah.daftarKitab(schemaWajib(user));
  }

  @Permissions('EPESANTREN_DINIYAH.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan kitab baru ke katalog' })
  catat(@Body() dto: CatatKitabDto, @CurrentUser() user: AuthenticatedUser) {
    return this.diniyah.catatKitab(schemaWajib(user), dto, user.userId);
  }
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/halaqah')
export class PesantrenHalaqahController {
  constructor(private readonly diniyah: PesantrenDiniyahService) {}

  @Permissions('EPESANTREN_DINIYAH.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar halaqah beserta jumlah anggota aktif' })
  daftar(@CurrentUser() user: AuthenticatedUser) {
    return this.diniyah.daftarHalaqah(schemaWajib(user));
  }

  @Permissions('EPESANTREN_DINIYAH.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat halaqah baru' })
  catat(@Body() dto: CatatHalaqahDto, @CurrentUser() user: AuthenticatedUser) {
    return this.diniyah.catatHalaqah(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_DINIYAH.READ')
  @Get(':id/anggota')
  @ApiOperation({ summary: 'Daftar anggota satu halaqah' })
  anggota(@Param('id') halaqahId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.diniyah.daftarAnggota(schemaWajib(user), halaqahId);
  }

  @Permissions('EPESANTREN_DINIYAH.CREATE')
  @Post(':id/anggota')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menggabungkan santri ke halaqah' })
  gabungkan(@Param('id') halaqahId: string, @Body() dto: GabungkanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.diniyah.gabungkan(schemaWajib(user), halaqahId, dto, user.userId);
  }

  @Permissions('EPESANTREN_DINIYAH.UPDATE')
  @Post('anggota/:id/keluar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengeluarkan santri dari halaqah' })
  keluarkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.diniyah.keluarkan(schemaWajib(user), id, user.userId);
  }
}
