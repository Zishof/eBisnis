/**
 * Titik masuk HTTP data santri.
 *
 * Seluruh impor di atas kelas — `@Controller` menulis `design:paramtypes` saat
 * kelas didefinisikan, dan impor di bawahnya membuat Nest membaca `undefined`
 * sebagai tipe dependensi (cacat yang pernah terjadi pada modul POS).
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsISO8601, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenSantriService } from './pesantren-santri.service';
import { JENIS_KELAMIN, STATUS_SANTRI, STATUS_TINGGAL } from './pesantren-santri';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/**
 * Data satu orang tua/wali -- bentuk yang sama dipakai tiga kali pada
 * `CatatSantriDto` (ayah, ibu, wali). Lihat `DataOrangTua` pada
 * `pesantren-santri.ts` untuk kembarannya di sisi aturan/validasi murni.
 */
export class DataOrangTuaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  nama?: string;

  @ApiPropertyOptional({ example: '3201234567890123' }) @IsOptional() @IsString() @MaxLength(16)
  nik?: string;

  @ApiPropertyOptional({ example: 1985 }) @IsOptional() @Type(() => Number) @IsInt()
  tahunLahir?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  pendidikan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  pekerjaan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  penghasilan?: string;
}

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

  // -- Kelengkapan setara Dapodik (lihat migrasi 20260802T340000) ----------
  @ApiPropertyOptional({ example: '3201234567890123', description: '16 digit' })
  @IsOptional() @IsString() @MaxLength(16)
  nik?: string;

  @ApiPropertyOptional({ example: '0012345678', description: '10 digit' })
  @IsOptional() @IsString() @MaxLength(10)
  nisn?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  nipd?: string;

  @ApiPropertyOptional({ example: 'Islam' }) @IsOptional() @IsString() @MaxLength(20)
  agama?: string;

  @ApiPropertyOptional({ default: 'WNI' }) @IsOptional() @IsString() @MaxLength(3)
  kewarganegaraan?: string;

  @ApiPropertyOptional({ default: 'TIDAK_ADA' }) @IsOptional() @IsString() @MaxLength(30)
  kebutuhanKhusus?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt()
  anakKe?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt()
  jumlahSaudara?: number;

  @ApiPropertyOptional({ example: 'JALAN_KAKI' }) @IsOptional() @IsString() @MaxLength(30)
  alatTransportasi?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number)
  jarakTempatTinggalKm?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  telepon?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  hp?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  penerimaKip?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  nomorKip?: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  penerimaKks?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  nomorKks?: string;

  @ApiPropertyOptional({ example: '3201234567890000', description: '16 digit' })
  @IsOptional() @IsString() @MaxLength(16)
  nomorKk?: string;

  @ApiPropertyOptional({ type: DataOrangTuaDto })
  @IsOptional() @ValidateNested() @Type(() => DataOrangTuaDto)
  ayah?: DataOrangTuaDto;

  @ApiPropertyOptional({ type: DataOrangTuaDto })
  @IsOptional() @ValidateNested() @Type(() => DataOrangTuaDto)
  ibu?: DataOrangTuaDto;

  @ApiPropertyOptional({ type: DataOrangTuaDto, description: 'Diisi hanya bila bukan ayah/ibu kandung.' })
  @IsOptional() @ValidateNested() @Type(() => DataOrangTuaDto)
  wali?: DataOrangTuaDto;
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
