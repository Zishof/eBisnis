/**
 * Endpoint katalog layanan, pemetaan unit, dan master data.
 *
 * Satu pemisahan menentukan bentuknya: **yang memetakan bukan yang
 * mengaktifkan.** `HEALTH_SERVICE_CATALOG.UPDATE` memetakan;
 * `HEALTH_SERVICE_CATALOG.ACTIVATE` mengaktifkan. Menyatukan keduanya berarti
 * orang yang sedang mengetik baris keseratus akan mengaktifkan layanan yang
 * belum pernah dilihat siapa pun.
 *
 * Tidak ada tajuk tujuan penggunaan di sini: katalog layanan bukan data pasien.
 * Menuntut `X-Purpose-Of-Use` untuk menyunting daftar tarif akan mengajarkan
 * penggunanya bahwa tajuk itu sekadar formalitas — dan pelajaran itu akan
 * dibawa ke layar yang benar-benar memerlukannya.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthMasterDataService } from './health-master-data.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type { CareSetting, JenisLayanan, PenerbitResmi, SumberMasterData } from './health-master-data';

const JENIS_LAYANAN = [
  'CONSULTATION', 'PROCEDURE', 'LABORATORY', 'RADIOLOGY', 'SURGERY', 'ANAESTHESIA',
  'MIDWIFERY', 'NURSING', 'EMERGENCY', 'REHABILITATION', 'DENTAL', 'NUTRITION',
  'DIALYSIS', 'ONCOLOGY', 'ROOM', 'AMBULANCE', 'OTHER',
];

const CARE_SETTING = [
  'OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'OPERATING_THEATRE', 'ICU', 'NICU', 'PICU',
  'DELIVERY_ROOM', 'LABORATORY', 'RADIOLOGY', 'PHARMACY', 'NUTRITION', 'REHABILITATION',
  'DENTAL', 'DIALYSIS', 'ONCOLOGY', 'HOMECARE', 'PUSKESMAS', 'POSYANDU',
];

const SUMBER = ['OFFICIAL_REFERENCE', 'FACILITY_IMPORT', 'SYNTHETIC_DEMO', 'LOCAL_MAPPING'];
const PENERBIT = ['KFA', 'BPOM', 'LKPP', 'BPJS', 'KEMENKES', 'WHO'];
const SISTEM_TUJUAN = ['ICD10', 'ICD9CM', 'LOINC', 'SNOMED', 'KFA', 'BPJS'];

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

// --- DTO ---------------------------------------------------------------------

class BuatLayananDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ example: 'LAB-DL' })
  @IsString()
  @MaxLength(48)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/, {
    message: 'Kode layanan hanya boleh huruf kapital, angka, titik, garis, dan garis bawah.',
  })
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: JENIS_LAYANAN })
  @IsIn(JENIS_LAYANAN)
  serviceType!: JenisLayanan;

  @ApiProperty({ enum: CARE_SETTING })
  @IsIn(CARE_SETTING)
  careSetting!: CareSetting;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Memakai persediaan; menentukan wajib tidaknya akun HPP.' })
  @IsOptional()
  @IsBoolean()
  usesInventory?: boolean;

  @ApiPropertyOptional({ description: 'Jasanya dibagi; menentukan wajib tidaknya aturan jasa.' })
  @IsOptional()
  @IsBoolean()
  hasFeeSharing?: boolean;

  @ApiPropertyOptional({ enum: SUMBER })
  @IsOptional()
  @IsIn(SUMBER)
  source?: SumberMasterData;

  @ApiPropertyOptional({
    enum: PENERBIT,
    description: 'Hanya boleh diisi bila sumbernya OFFICIAL_REFERENCE.',
  })
  @IsOptional()
  @IsIn(PENERBIT)
  issuer?: PenerbitResmi;

  @ApiPropertyOptional({ description: 'Nomor atau tanggal terbitan yang dapat ditelusuri.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  issuerReference?: string;
}

class PemetaanDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() serviceUnitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) performerRole?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) verifierRole?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(48) specimenTypeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(48) clinicalOrderType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clinicalFormId?: string;

  @ApiPropertyOptional({ description: 'Menunggu H-9H.' })
  @IsOptional() @IsUUID() equipmentId?: string;
  @ApiPropertyOptional({ description: 'Menunggu H-9D.' })
  @IsOptional() @IsUUID() tariffId?: string;
  @ApiPropertyOptional({ description: 'Menunggu H-9D.' })
  @IsOptional() @IsUUID() payerCoverageId?: string;
  @ApiPropertyOptional({ description: 'Menunggu H-9E.' })
  @IsOptional() @IsUUID() feeRuleId?: string;
  @ApiPropertyOptional({ description: 'Menunggu H-9N.' })
  @IsOptional() @IsUUID() revenueAccountId?: string;
  @ApiPropertyOptional({ description: 'Menunggu H-9N.' })
  @IsOptional() @IsUUID() cogsAccountId?: string;
}

class NonaktifkanDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

class PetakanKodeDto {
  @ApiProperty({ example: 'LOCAL_LAB' })
  @IsString()
  @MaxLength(32)
  localSystem!: string;

  @ApiProperty({ example: 'LAB-DL' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  localCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localDisplay?: string;

  @ApiProperty({ enum: SISTEM_TUJUAN })
  @IsIn(SISTEM_TUJUAN)
  targetSystem!: string;

  @ApiProperty({ example: '58410-2' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  targetDisplay?: string;

  @ApiPropertyOptional({
    enum: ['EXACT', 'NARROWER', 'BROADER', 'APPROXIMATE'],
    description:
      'Pemetaan yang ditebak tetap berguna asal ketahuan bahwa ia tebakan; yang berbahaya ' +
      'adalah tebakan yang tercatat sebagai kepastian.',
  })
  @IsOptional()
  @IsIn(['EXACT', 'NARROWER', 'BROADER', 'APPROXIMATE'])
  confidence?: string;
}

class SemaiContohDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ minimum: 1, maximum: 2000 })
  @IsInt()
  @Min(1)
  @Max(2000)
  count!: number;

  @ApiProperty({ description: 'Benih pembangkitan. Benih yang sama menghasilkan katalog yang sama.' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  seed!: string;

  @ApiPropertyOptional({ enum: ['MINIMAL', 'STANDARD', 'LARGE_HOSPITAL'] })
  @IsOptional()
  @IsIn(['MINIMAL', 'STANDARD', 'LARGE_HOSPITAL'])
  profile?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Katalog Layanan dan Master Data')
@Controller('health/master-data')
export class HealthMasterDataController {
  constructor(
    private readonly master: HealthMasterDataService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Katalog layanan -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SERVICE_CATALOG.CREATE')
  @Post('services')
  @ApiOperation({
    summary: 'Mendaftarkan layanan baru',
    description:
      'Layanan dibuat dalam keadaan TIDAK aktif. Ia baru dapat dipesan setelah pemetaannya ' +
      'lengkap dan diaktifkan orang lain.',
  })
  async buat(@Body() dto: BuatLayananDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.master.buatLayanan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SERVICE_CATALOG.UPDATE')
  @Post('services/:id/mapping')
  @ApiOperation({
    summary: 'Memetakan layanan ke unit, peran, tarif, dan akun',
    description:
      'Melaporkan yang kurang SATU PER SATU, bukan "pemetaan belum lengkap". Slot yang ' +
      'tabelnya memang belum dibangun disebutkan beserta fase yang akan membangunnya.',
  })
  petakan(@Param('id') id: string, @Body() dto: PemetaanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.master.petakan(requireSchema(user), id, dto);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SERVICE_CATALOG.ACTIVATE')
  @Post('services/:id/activate')
  @ApiOperation({
    summary: 'Mengaktifkan layanan',
    description:
      'Ditolak bila pemetaannya belum lengkap — ditegakkan trigger basis data pula. Wewenang ' +
      'ini sengaja terpisah dari wewenang memetakan.',
  })
  async aktifkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.master.aktifkan(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SERVICE_CATALOG.ACTIVATE')
  @Post('services/:id/deactivate')
  @ApiOperation({ summary: 'Menonaktifkan layanan' })
  nonaktifkan(
    @Param('id') id: string,
    @Body() dto: NonaktifkanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.master.nonaktifkan(requireSchema(user), id, dto.reason);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SERVICE_CATALOG.READ')
  @Get('services')
  @ApiOperation({ summary: 'Katalog layanan' })
  daftar(
    @Query('facilityId') facilityId: string,
    @Query('activeOnly') activeOnly: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.master.daftarLayanan(
      requireSchema(user),
      facilityId,
      activeOnly === 'true' || activeOnly === '1',
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SERVICE_CATALOG.READ')
  @Get('gaps')
  @ApiOperation({
    summary: 'Kekurangan pemetaan seluruh katalog, dikelompokkan menurut slotnya',
    description:
      'Yang paling berguna bukan daftar layanan yang belum lengkap, melainkan daftar SLOT yang ' +
      'paling sering kosong — satu penyebab biasanya menjelaskan puluhan layanan sekaligus.',
  })
  kekurangan(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.master.kekuranganKatalog(requireSchema(user), facilityId);
  }

  // --- Pemetaan kode ---------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CODE_MAPPING.CREATE')
  @Post('code-mappings')
  @ApiOperation({
    summary: 'Memetakan kode lokal ke kode resmi',
    description:
      'Satu kode lokal tidak dapat menunjuk dua kode resmi pada sistem yang sama — yang ' +
      'mengirim ke luar akan memilih salah satunya menurut urutan baris.',
  })
  async petakanKode(@Body() dto: PetakanKodeDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.master.petakanKode(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CODE_MAPPING.UPDATE')
  @Post('code-mappings/:id/retire')
  @ApiOperation({
    summary: 'Memensiunkan pemetaan kode',
    description:
      'Dipensiunkan, bukan dihapus. Rekam lama yang dikirim memakai pemetaan ini harus tetap ' +
      'dapat dijelaskan.',
  })
  async pensiunkan(
    @Param('id') id: string,
    @Body() dto: NonaktifkanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.master.pensiunkanPemetaanKode(schema, id, dto.reason, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CODE_MAPPING.READ')
  @Get('code-mappings')
  @ApiOperation({ summary: 'Daftar pemetaan kode lokal' })
  daftarKode(
    @Query('targetSystem') targetSystem: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.master.daftarPemetaanKode(requireSchema(user), targetSystem);
  }

  // --- Data contoh -----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_MASTER_DATA.CREATE')
  @Post('samples/services')
  @ApiOperation({
    summary: 'Menyemai katalog layanan contoh',
    description:
      'Deterministik: benih yang sama menghasilkan katalog yang sama, dan benihnya disimpan. ' +
      'Seluruh barisnya bertanda data contoh dan tidak dapat mengaku bersumber resmi.',
  })
  async semai(@Body() dto: SemaiContohDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.master.semaiLayananContoh(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_MASTER_DATA.DELETE')
  @Post('samples/:id/hide')
  @ApiOperation({
    summary: 'Menyembunyikan satu kumpulan data contoh',
    description:
      'Menolak bila ada data nyata yang merujuknya, menyebutkan apa yang merujuknya, dan ' +
      'menyerahkan keputusannya kepada manusia. Penyembunyian, bukan penghapusan.',
  })
  async sembunyikan(
    @Param('id') id: string,
    @Body() dto: NonaktifkanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.master.sembunyikanDataContoh(schema, id, dto.reason, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_MASTER_DATA.READ')
  @Get('samples')
  @ApiOperation({ summary: 'Daftar kumpulan data contoh' })
  daftarContoh(@CurrentUser() user: AuthenticatedUser) {
    return this.master.daftarDataContoh(requireSchema(user));
  }
}
