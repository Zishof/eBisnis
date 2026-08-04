/**
 * Endpoint kerangka impor KFA dan terminologi resmi.
 *
 * Pemisahan yang menentukan bentuknya:
 *
 * ```
 * TERMINOLOGY.IMPORT menerima berkas
 *   ≠  VERIFY memvalidasinya  ≠  APPROVE menerapkannya
 * ```
 *
 * Katalog obat menentukan apa yang boleh diresepkan seluruh rumah sakit.
 * Penerapan oleh pemeriksanya sendiri hanya membaca ulang keyakinannya — dan
 * berkas dua ribu baris adalah tempat paling mudah bagi satu baris yang keliru
 * untuk lolos tanpa dilihat siapa pun.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthKfaService } from './health-kfa.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { SUMBER_DATA, TERMINOLOGI, type JenisPemetaanKfa, type SumberData } from './health-kfa';

const KATALOG = TERMINOLOGI.map((t) => t.kode);
const SUMBER = SUMBER_DATA.map((s) => s.kode);
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

class ImporDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: KATALOG })
  @IsIn(KATALOG)
  catalogCode!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ description: 'Isi berkas apa adanya. Sidik jarinya dihitung dari ini.' })
  @IsString()
  @MinLength(1)
  @MaxLength(1_000_000)
  fileContent!: string;

  @ApiProperty({
    enum: SUMBER,
    description: 'Hanya OFFICIAL_REFERENCE yang boleh diklaim resmi, dan ia wajib berterbitan.',
  })
  @IsIn(SUMBER)
  dataSource!: SumberData;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  editionRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TANGGAL)
  editionDate?: string;
}

class ValidasiDto {
  @ApiProperty({ minimum: 0, description: 'Jumlah baris bergalat. Lebih dari nol -> DITOLAK.' })
  @IsInt()
  @Min(0)
  rowError!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  errorNote?: string;
}

class PemetaanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: ['PRODUCT', 'INGREDIENT', 'MEDICAL_DEVICE'] })
  @IsIn(['PRODUCT', 'INGREDIENT', 'MEDICAL_DEVICE'])
  mappingKind!: JenisPemetaanKfa;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  kfaCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  kfaName?: string;

  @ApiProperty({ enum: ['RX_PRODUCT', 'RX_INGREDIENT', 'MEDICAL_DEVICE'] })
  @IsIn(['RX_PRODUCT', 'RX_INGREDIENT', 'MEDICAL_DEVICE'])
  localKind!: string;

  @ApiProperty()
  @IsUUID()
  localId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localName?: string;

  @ApiProperty({
    enum: ['MANUAL', 'IMPORTED', 'NAME_SIMILARITY'],
    description: 'NAME_SIMILARITY selalu DITOLAK. Ada supaya penolakannya jelas.',
  })
  @IsIn(['MANUAL', 'IMPORTED', 'NAME_SIMILARITY'])
  mappingMethod!: 'MANUAL' | 'IMPORTED' | 'NAME_SIMILARITY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

@ApiTags('eMedik — Terminologi dan KFA')
@Controller('health/terminology')
export class HealthKfaController {
  constructor(
    private readonly kfa: HealthKfaService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TERMINOLOGY.READ')
  @Get('catalog')
  @ApiOperation({
    summary: 'Katalog terminologi, sumber data, dan aturan tanpa KFA',
    description:
      'Menyatakan tegas: obat yang belum terpetakan ke KFA TETAP dapat dipakai di dalam rumah ' +
      'sakit; ia hanya tidak dapat dikirim ke SATUSEHAT.',
  })
  katalog() {
    return this.kfa.katalog();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TERMINOLOGY.READ')
  @Get('readiness')
  @ApiOperation({
    summary: 'Kesiapan setiap katalog',
    description:
      'Yang kosong dijawab "belum dapat dinilai", bukan "tidak ada masalah". Keduanya berbeda, ' +
      'dan yang membacanya bertindak berbeda pula.',
  })
  kesiapan(@CurrentUser() user: AuthenticatedUser) {
    return this.kfa.kesiapan(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TERMINOLOGY.IMPORT')
  @Post('imports')
  @ApiOperation({
    summary: 'Menerima berkas impor',
    description:
      'Berkas disimpan beserta sidik jarinya. Hanya OFFICIAL_REFERENCE yang boleh diklaim ' +
      'resmi, dan ia wajib menyebutkan terbitan beserta tanggalnya.',
  })
  async terima(@Body() dto: ImporDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.kfa.terimaBerkas(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TERMINOLOGY.VERIFY')
  @Post('imports/:id/validate')
  @ApiOperation({
    summary: 'Memvalidasi berkas impor',
    description: 'Lebih dari nol baris bergalat -> DITOLAK. Impor sebagian tidak diterapkan.',
  })
  async validasi(
    @Param('id') id: string,
    @Body() dto: ValidasiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.kfa.validasi(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TERMINOLOGY.APPROVE')
  @Post('imports/:id/apply')
  @ApiOperation({
    summary: 'Menerapkan impor ke katalog',
    description:
      'Sengaja BUKAN hak yang memvalidasinya. Katalog obat menentukan apa yang boleh ' +
      'diresepkan seluruh rumah sakit.',
  })
  async terapkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.kfa.terapkan(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TERMINOLOGY.READ')
  @Get('imports')
  @ApiOperation({ summary: 'Riwayat impor' })
  daftarImpor(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.kfa.daftarImpor(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_KFA_MAPPING.CREATE')
  @Post('kfa-mappings')
  @ApiOperation({
    summary: 'Memetakan produk lokal ke kode KFA',
    description:
      'Pemetaan berdasarkan KEMIRIPAN NAMA selalu ditolak. "Amlodipine 5 mg" dan ' +
      '"Amlodipine 10 mg" berbeda satu karakter dan berbeda dua kali lipat dosisnya.',
  })
  async petakan(@Body() dto: PemetaanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.kfa.petakan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_KFA_MAPPING.READ')
  @Get('kfa-mappings')
  @ApiOperation({ summary: 'Daftar pemetaan KFA' })
  daftarPemetaan(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.kfa.daftarPemetaan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_KFA_MAPPING.READ')
  @Get('kfa-mappings/readiness')
  @ApiOperation({
    summary: 'Apakah satu produk dapat dikirim ke SATUSEHAT',
    description:
      'Membedakan DAPAT DIPAKAI dari DAPAT DIKIRIM — dan perbedaan itulah seluruh isi fase ini.',
  })
  kesiapanKirim(
    @Query('facilityId') facilityId: string,
    @Query('localId') localId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !localId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId dan localId wajib diisi.',
      );
    }
    return this.kfa.kesiapanKirim(requireSchema(user), facilityId, localId);
  }
}
