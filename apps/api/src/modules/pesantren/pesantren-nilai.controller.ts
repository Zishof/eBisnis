/**
 * Titik masuk HTTP nilai dan rapor (EP-O). Pola sama dengan
 * `pesantren-santri.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PesantrenNilaiService } from './pesantren-nilai.service';
import { JENJANG_MAPEL } from './pesantren-nilai';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class CatatMataPelajaranDto {
  @ApiProperty({ example: 'FIQH' })
  @IsString() @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Fikih' })
  @IsString() @MaxLength(160)
  nama!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32)
  kelompok?: string;

  @ApiPropertyOptional({ example: '070', description: 'Kode referensi Dapodik/EMIS Kemenag' })
  @IsOptional() @IsString() @MaxLength(10)
  kodeMapelDapodik?: string;

  @ApiPropertyOptional({ enum: JENJANG_MAPEL })
  @IsOptional() @IsIn(JENJANG_MAPEL as unknown as string[])
  jenjang?: string;
}

class CatatKomponenDto {
  @ApiProperty({ example: 'UTS' })
  @IsString() @MaxLength(32)
  kode!: string;

  @ApiProperty({ example: 'Ujian Tengah Semester' })
  @IsString() @MaxLength(120)
  nama!: string;

  @ApiProperty({ example: 30 })
  @IsNumber() @Min(1) @Max(100)
  bobotPersen!: number;
}

class CatatSkalaHurufDto {
  @ApiProperty({ example: 'A' })
  @IsString() @MaxLength(4)
  huruf!: string;

  @ApiProperty({ example: 90 })
  @IsNumber() @Min(0) @Max(100)
  nilaiMinimum!: number;

  @ApiProperty({ example: 100 })
  @IsNumber() @Min(0) @Max(100)
  nilaiMaksimum!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  keterangan?: string;
}

class CatatNilaiDto {
  @ApiProperty()
  @IsString()
  santriId!: string;

  @ApiProperty()
  @IsString()
  komponenId!: string;

  @ApiProperty()
  @IsString()
  tahunAjaranId!: string;

  @ApiProperty({ example: 85 })
  @IsNumber() @Min(0) @Max(100)
  nilaiAngka!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  catatan?: string;
}

class FinalisasiRaporDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  catatanFinalisasi?: string;

  @ApiPropertyOptional({ description: 'User subject wali kelas yang menandatangani rapor.' })
  @IsOptional() @IsString()
  waliKelasUserId?: string;

  @ApiPropertyOptional({ description: 'User subject kepala satuan pendidikan yang menandatangani rapor.' })
  @IsOptional() @IsString()
  kepalaUserId?: string;
}

class BatalkanFinalisasiRaporDto {
  @ApiProperty({ example: 'Koreksi nilai UAS Fikih setelah verifikasi wali kelas.' })
  @IsString() @MaxLength(1000)
  reason!: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/nilai')
export class PesantrenNilaiController {
  constructor(private readonly nilai: PesantrenNilaiService) {}

  @Permissions('EPESANTREN_NILAI.READ')
  @Get('tahun-ajaran')
  @ApiOperation({ summary: 'Daftar tahun ajaran untuk input nilai dan rapor' })
  daftarTahunAjaran(@CurrentUser() user: AuthenticatedUser) {
    return this.nilai.daftarTahunAjaran(schemaWajib(user));
  }

  @Permissions('EPESANTREN_NILAI.READ')
  @Get('mata-pelajaran')
  @ApiOperation({ summary: 'Daftar mata pelajaran' })
  daftarMataPelajaran(@CurrentUser() user: AuthenticatedUser) {
    return this.nilai.daftarMataPelajaran(schemaWajib(user));
  }

  @Permissions('EPESANTREN_NILAI.CREATE')
  @Post('mata-pelajaran')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan mata pelajaran' })
  catatMataPelajaran(@Body() dto: CatatMataPelajaranDto, @CurrentUser() user: AuthenticatedUser) {
    return this.nilai.catatMataPelajaran(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_NILAI.READ')
  @Get('mata-pelajaran/:id/komponen')
  @ApiOperation({ summary: 'Daftar komponen nilai satu mata pelajaran' })
  daftarKomponen(@Param('id') mataPelajaranId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.nilai.daftarKomponen(schemaWajib(user), mataPelajaranId);
  }

  @Permissions('EPESANTREN_NILAI.CREATE')
  @Post('mata-pelajaran/:id/komponen')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan komponen nilai (mis. Tugas, UTS, UAS) beserta bobotnya' })
  catatKomponen(@Param('id') mataPelajaranId: string, @Body() dto: CatatKomponenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.nilai.catatKomponen(schemaWajib(user), mataPelajaranId, dto, user.userId);
  }

  @Permissions('EPESANTREN_NILAI.READ')
  @Get('mata-pelajaran/:id/total-bobot')
  @ApiOperation({ summary: 'Total bobot komponen aktif — peringatan bila bukan 100' })
  async totalBobot(@Param('id') mataPelajaranId: string, @CurrentUser() user: AuthenticatedUser) {
    const total = await this.nilai.totalBobot(schemaWajib(user), mataPelajaranId);
    return { totalBobotPersen: total, lengkap: total === 100 };
  }

  @Permissions('EPESANTREN_NILAI.READ')
  @Get('skala-huruf')
  @ApiOperation({ summary: 'Daftar skala konversi nilai ke huruf mutu' })
  daftarSkalaHuruf(@CurrentUser() user: AuthenticatedUser) {
    return this.nilai.daftarSkalaHuruf(schemaWajib(user));
  }

  @Permissions('EPESANTREN_NILAI.CREATE')
  @Post('skala-huruf')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan skala huruf mutu (mis. A = 90-100)' })
  catatSkalaHuruf(@Body() dto: CatatSkalaHurufDto, @CurrentUser() user: AuthenticatedUser) {
    return this.nilai.catatSkalaHuruf(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_NILAI.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencatat atau memperbaiki nilai satu santri pada satu komponen' })
  catatNilai(@Body() dto: CatatNilaiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.nilai.catatNilai(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_NILAI.READ')
  @Get('rapor/:santriId/:tahunAjaranId')
  @ApiOperation({ summary: 'Rapor satu santri untuk satu tahun ajaran' })
  rapor(
    @Param('santriId') santriId: string,
    @Param('tahunAjaranId') tahunAjaranId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nilai.rapor(schemaWajib(user), santriId, tahunAjaranId);
  }

  @Permissions('EPESANTREN_NILAI.READ')
  @Get('leger/:tahunAjaranId')
  @ApiOperation({ summary: 'Leger rapor dan ranking santri per tahun ajaran/rombongan' })
  legerRapor(
    @Param('tahunAjaranId') tahunAjaranId: string,
    @Query('rombonganId') rombonganId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nilai.legerRapor(schemaWajib(user), tahunAjaranId, rombonganId);
  }

  @Permissions('EPESANTREN_NILAI.READ')
  @Get('rapor/:santriId/:tahunAjaranId/finalisasi')
  @ApiOperation({ summary: 'Status finalisasi rapor aktif satu santri/tahun ajaran' })
  finalisasiAktif(
    @Param('santriId') santriId: string,
    @Param('tahunAjaranId') tahunAjaranId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nilai.finalisasiAktif(schemaWajib(user), santriId, tahunAjaranId);
  }

  @Permissions('EPESANTREN_NILAI.APPROVE')
  @Post('rapor/:santriId/:tahunAjaranId/finalisasi')
  @HttpCode(201)
  @ApiOperation({ summary: 'Finalisasi rapor dengan snapshot, checksum, dan QR verifikasi' })
  finalisasiRapor(
    @Param('santriId') santriId: string,
    @Param('tahunAjaranId') tahunAjaranId: string,
    @Body() dto: FinalisasiRaporDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nilai.finalisasiRapor(schemaWajib(user), santriId, tahunAjaranId, dto, user.userId);
  }

  @Permissions('EPESANTREN_NILAI.CANCEL')
  @Post('rapor/finalisasi/:id/batalkan')
  @ApiOperation({ summary: 'Membatalkan finalisasi rapor agar nilai dapat dikoreksi' })
  batalkanFinalisasiRapor(
    @Param('id') id: string,
    @Body() dto: BatalkanFinalisasiRaporDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nilai.batalkanFinalisasi(schemaWajib(user), id, dto.reason, user.userId);
  }
}
