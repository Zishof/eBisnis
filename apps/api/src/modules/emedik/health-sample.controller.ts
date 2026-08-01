/**
 * Endpoint data contoh, laporan, dan penghalang yang dicatat.
 *
 * Pemisahan yang menentukan bentuknya:
 *
 * ```
 * SAMPLE_DATA.CREATE menyemai  ≠  HARD_DELETE membersihkan
 * ```
 *
 * Nama aksinya sengaja menakutkan sekalipun yang dilakukannya menyembunyikan:
 * pembersihan menjalankan perintah atas ratusan baris pada tabel yang sama
 * dengan tempat rekam medis sungguhan berada, dan nama yang menenangkan akan
 * membuat orang menekannya tanpa membaca layar konfirmasi.
 *
 * Dan satu jalan yang sengaja **selalu menolak**: `POST /reports/:kode/export`.
 * Ia menolak dengan menyebutkan sebab dan jalan keluarnya — bukan dengan
 * berkata "belum tersedia".
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthSampleService } from './health-sample.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { LAPORAN, type JenisLaporan, type ProfilContoh } from './health-sample';

const PROFIL = ['MINIMAL', 'STANDARD', 'RICH'];
const KODE_LAPORAN = LAPORAN.map((l) => l.kode);
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

class PenyemaianDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  runCode!: string;

  @ApiProperty({ enum: PROFIL })
  @IsIn(PROFIL)
  profile!: ProfilContoh;

  @ApiProperty({ minLength: 4, description: 'Benih deterministik. WAJIB.' })
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  seed!: string;

  @ApiProperty({ minimum: 50, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(1000)
  rowsPerTable!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(200)
  tableCount!: number;
}

class PembersihanDto {
  @ApiProperty()
  @IsUUID()
  sampleRunId!: string;

  @ApiPropertyOptional({
    isArray: true,
    description:
      'Kosongkan untuk seluruh tabel yang diizinkan. Tabel di luar daftar izin DITOLAK.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tables?: string[];

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

@ApiTags('eMedik — Data Contoh dan Laporan')
@Controller('health/sample')
export class HealthSampleController {
  constructor(
    private readonly contoh: HealthSampleService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAMPLE_DATA.READ')
  @Get('catalog')
  @ApiOperation({
    summary: 'Profil data contoh, katalog laporan, dan penghalang',
    description: 'Penghalang dicatat apa adanya, beserta jalan keluarnya.',
  })
  katalog() {
    return this.contoh.katalog();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAMPLE_DATA.READ')
  @Get('tables')
  @ApiOperation({
    summary: 'Tabel yang boleh disentuh pembersihan',
    description:
      'Dibaca dari basis data, bukan dari tetapan pada kode. Menyertakan pula tabel yang TIDAK ' +
      'dapat dibersihkan beserta sebabnya — keterbatasan yang dinyatakan, bukan kemampuan yang ' +
      'berpura-pura ada.',
  })
  tabel(@CurrentUser() user: AuthenticatedUser) {
    return this.contoh.tabelDiizinkan(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAMPLE_DATA.CREATE')
  @Post('runs')
  @ApiOperation({
    summary: 'Mencatat kumpulan penyemaian',
    description:
      'Benih WAJIB dan deterministik: data contoh yang berbeda setiap kali disemai tidak dapat ' +
      'dipakai mendemonstrasikan apa pun dua kali.',
  })
  async catat(@Body() dto: PenyemaianDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.contoh.catatPenyemaian(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAMPLE_DATA.READ')
  @Get('runs')
  @ApiOperation({ summary: 'Daftar kumpulan penyemaian' })
  daftar(@CurrentUser() user: AuthenticatedUser) {
    return this.contoh.daftarPenyemaian(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAMPLE_DATA.HARD_DELETE')
  @Post('runs/clean')
  @ApiOperation({
    summary: 'Membersihkan data contoh',
    description:
      'MENYEMBUNYIKAN, bukan menghapus — dan tidak pernah menyentuh baris yang tidak bertanda ' +
      'contoh. Jumlah baris sungguhan dihitung sebelum dan sesudahnya, dan seluruh transaksinya ' +
      'dibatalkan bila satu baris pun berubah. Sengaja BUKAN hak yang menyemainya.',
  })
  async bersihkan(@Body() dto: PembersihanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.contoh.bersihkan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_REPORT.READ')
  @Get('reports/:kode')
  @ApiOperation({
    summary: 'Menjalankan laporan agregat',
    description:
      'Seluruh laporan bersifat agregat dan dapat dibuka tanpa satu pun hak atas data pasien. ' +
      'Rentangnya wajib berbatas: laporan tanpa batas memindai seluruh riwayat rumah sakit, dan ' +
      'pemindaian itu berjalan pada jam sibuk.',
  })
  laporan(
    @Param('kode') kode: string,
    @Query('facilityId') facilityId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !TANGGAL.test(from ?? '') || !TANGGAL.test(to ?? '')) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId, from, dan to wajib diisi (tanggal YYYY-MM-DD).',
      );
    }
    if (!KODE_LAPORAN.includes(kode as JenisLaporan)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Laporan "${kode}" tidak ada pada katalog. Katalognya daftar TERTUTUP.`,
      );
    }
    return this.contoh.laporan(requireSchema(user), {
      kode: kode as JenisLaporan,
      facilityId,
      dari: from,
      sampai: to,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_REPORT.EXPORT')
  @Post('reports/:kode/export')
  @ApiOperation({
    summary: 'Mengekspor laporan — SELALU MENOLAK',
    description:
      'Ekspor Excel dan cetak PDF terhalang: kerangkanya (V8-5/V8-6, V8-7) tidak pernah ' +
      'dibangun. Penolakannya menyebutkan sebab DAN jalan keluarnya — sistem yang diam tentang ' +
      'apa yang tidak dapat dilakukannya akan ditanyakan berulang kali oleh orang yang berbeda, ' +
      'dan salah satu di antaranya akan membangunnya sendiri.',
  })
  ekspor(@Param('kode') kode: string, @Query('format') format: string) {
    void kode;
    return this.contoh.ekspor((format ?? 'EXCEL').toUpperCase());
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAMPLE_DATA.READ')
  @Get('blockers')
  @ApiOperation({
    summary: 'Penghalang yang dicatat',
    description: 'Dicatat, bukan disembunyikan — beserta jalan keluarnya masing-masing.',
  })
  penghalang() {
    return this.contoh.penghalang();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SAMPLE_DATA.READ')
  @Get('roles')
  @ApiOperation({
    summary: 'Ringkasan peran kesehatan',
    description:
      'Dibaca dari basis data, bukan dari katalog pada kode. Yang menentukan siapa boleh apa ' +
      'adalah barisnya.',
  })
  peran(@CurrentUser() user: AuthenticatedUser) {
    return this.contoh.ringkasanPeran(requireSchema(user));
  }
}
