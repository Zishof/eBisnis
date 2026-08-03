/**
 * Endpoint kebijakan pembagian jasa dan kontributor.
 *
 * Tiga pemisahan, dan yang ketiga tidak dapat ditegakkan hak akses saja:
 *
 * 1. `HEALTH_FEE_POLICY.CREATE` menyusun; `HEALTH_FEE_POLICY.APPROVE`
 *    menyetujui.
 * 2. Yang menghitung settlement tidak menyetujuinya sendiri (H-9F).
 * 3. **Penerima jasa tidak menyetujui aturan yang membayar dirinya** —
 *    diperiksa pada tingkat baris, sebab dokter yang juga administrator
 *    memegang dua peran yang sah masing-masing.
 *
 * Tidak ada tajuk tujuan penggunaan di sini: kebijakan jasa bukan data pasien.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthFeeService } from './health-fee.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type { CaraBagi, DasarPerhitungan, PenerimaJasa } from './health-fee';

const DASAR = [
  'GROSS_CHARGE', 'NET_CHARGE', 'NET_COLLECTED', 'VERIFIED_CLAIM', 'PAID_CLAIM', 'FIXED_AMOUNT',
];
const CARA = [
  'PERCENTAGE', 'FIXED_AMOUNT', 'POINT_BASED', 'TIME_BASED', 'UNIT_BASED', 'WEIGHTED_SCORE',
];
const PENERIMA = [
  'FACILITY_FEE', 'DOCTOR_FEE', 'MIDWIFE_FEE', 'NURSE_FEE', 'PHARMACY_SERVICE_FEE',
  'LAB_SERVICE_FEE', 'RADIOLOGY_SERVICE_FEE', 'ANESTHESIA_FEE', 'ASSISTANT_FEE',
  'WARD_SERVICE_FEE', 'BED_FACILITY_FEE', 'EQUIPMENT_USAGE_FEE', 'MEDICAL_DEVICE_USAGE_FEE',
  'DRUG_DISPENSING_FEE', 'TEAM_POOL_FEE', 'MANAGEMENT_POOL', 'SUPPORT_STAFF_POOL',
  'SYSTEM_PLATFORM_FEE', 'INVESTOR_SHARE', 'RESERVE_FUND', 'QUALITY_FUND', 'TAX_WITHHOLDING',
  'OTHER_FEE',
];
const TANGGUNG_JAWAB = ['PRIMARY', 'ASSISTANT', 'SUPERVISING', 'CONSULTING', 'SUPPORT'];

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

class BarisKebijakanDto {
  @ApiProperty({ enum: PENERIMA })
  @IsIn(PENERIMA)
  recipient!: PenerimaJasa;

  @ApiProperty({ enum: CARA })
  @IsIn(CARA)
  method!: CaraBagi;

  @ApiProperty({
    description:
      'Nilainya datang dari kesepakatan fasilitas. Sistem tidak menetapkan satu pun bawaan.',
  })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  contributorRole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class KebijakanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: DASAR,
    description:
      'Bawaan PAID_CLAIM. Penjamin yang membayar lewat klaim TIDAK boleh memakai dasar ' +
      'taksiran untuk perhitungan final.',
  })
  @IsOptional()
  @IsIn(DASAR)
  basis?: DasarPerhitungan;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  serviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  payerType?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description:
      'Templat contoh. Bukan standar nasional dan bukan saran hukum; tidak dapat aktif sebelum ' +
      'disetujui untuk produksi.',
  })
  @IsOptional()
  @IsBoolean()
  isSampleData?: boolean;

  @ApiProperty({ type: [BarisKebijakanDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BarisKebijakanDto)
  lines!: BarisKebijakanDto[];
}

class SetujuiDto {
  @ApiProperty({ description: 'Apa yang disepakati dan dengan siapa.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  note!: string;
}

class KontributorDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  otCaseId?: string;

  @ApiProperty()
  @IsUUID()
  providerId!: string;

  @ApiProperty({ example: 'SURGEON' })
  @IsString()
  @MaxLength(48)
  contributorRole!: string;

  @ApiPropertyOptional({
    description:
      'Penunjuk ke sumbernya: ot_checklist.completed_by, ot_count.counted_out_by, ' +
      'ot_case.surgeon_id. Tanpa bukti kehadiran, kontributor ini tidak ikut dibayar.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  attendanceEvidence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  point?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  complexityWeight?: number;

  @ApiPropertyOptional({ enum: TANGGUNG_JAWAB })
  @IsOptional()
  @IsIn(TANGGUNG_JAWAB)
  clinicalResponsibility?: string;
}

class HitungDto {
  @ApiProperty()
  @IsUUID()
  policyId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  basisAmount!: number;

  @ApiPropertyOptional({ description: 'Penjamin membayar lewat klaim; menuntut dasar PAID_CLAIM.' })
  @IsOptional()
  @IsBoolean()
  payerPaysByClaim?: boolean;

  @ApiPropertyOptional({ description: 'Simulasi boleh memakai dasar taksiran.' })
  @IsOptional()
  @IsBoolean()
  isSimulation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  otCaseId?: string;
}

class BagiKumpulanDto {
  @ApiProperty()
  @IsUUID()
  otCaseId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  poolAmount!: number;

  @ApiProperty({ enum: CARA })
  @IsIn(CARA)
  method!: CaraBagi;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Kebijakan Jasa')
@Controller('health/fee')
export class HealthFeeController {
  constructor(
    private readonly jasa: HealthFeeService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Kebijakan -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_POLICY.CREATE')
  @Post('policies')
  @ApiOperation({
    summary: 'Menyusun kebijakan pembagian jasa',
    description:
      'Dibuat dalam keadaan TIDAK aktif. Persentase datang dari kesepakatan fasilitas — sistem ' +
      'tidak menetapkan satu pun bawaan.',
  })
  async buat(@Body() dto: KebijakanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.jasa.buatKebijakan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_POLICY.APPROVE')
  @Post('policies/:id/approve')
  @ApiOperation({
    summary: 'Menyetujui dan mengaktifkan kebijakan',
    description:
      'Penyusun tidak menyetujui versinya sendiri, dan PENERIMA JASA tidak menyetujui aturan ' +
      'yang membayar dirinya — yang kedua diperiksa pada tingkat baris.',
  })
  async setujui(
    @Param('id') id: string,
    @Body() dto: SetujuiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.jasa.setujuiKebijakan(schema, id, dto.note, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_POLICY.READ')
  @Get('policies')
  @ApiOperation({ summary: 'Daftar kebijakan pembagian jasa' })
  daftar(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.jasa.daftarKebijakan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_POLICY.READ')
  @Get('policies/:id')
  @ApiOperation({ summary: 'Satu kebijakan beserta barisnya' })
  baca(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jasa.bacaKebijakan(requireSchema(user), id);
  }

  // --- Kontributor -----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRIBUTOR.CREATE')
  @Post('contributors')
  @ApiOperation({
    summary: 'Mencatat kontributor satu tindakan',
    description:
      'Bukti kehadiran menentukan siapa yang ikut dibayar. Tanpa buktinya, daftar kontributor ' +
      'menjadi daftar keinginan — dan pada operasi yang jasanya besar, daftar keinginan ' +
      'cenderung memanjang.',
  })
  async catat(@Body() dto: KontributorDto, @CurrentUser() user: AuthenticatedUser) {
    if (!dto.encounterId && !dto.admissionId && !dto.otCaseId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Salah satu dari encounterId, admissionId, atau otCaseId wajib diisi.',
      );
    }
    const schema = requireSchema(user);
    return this.jasa.catatKontributor(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRIBUTOR.READ')
  @Get('contributors')
  @ApiOperation({
    summary: 'Kontributor satu operasi, dipisahkan antara yang layak dan yang tersaring',
    description: 'Yang tersaring dikembalikan, bukan dihapus diam-diam.',
  })
  daftarKontributor(@Query('otCaseId') otCaseId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!otCaseId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter otCaseId wajib diisi.');
    }
    return this.jasa.daftarKontributor(requireSchema(user), otCaseId);
  }

  // --- Perhitungan -----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_POLICY.READ')
  @Post('calculate')
  @ApiOperation({
    summary: 'Menghitung pembagian jasa menurut satu kebijakan',
    description:
      'Penjamin yang membayar lewat klaim wajib memakai dasar PAID_CLAIM untuk perhitungan ' +
      'final. Taksiran boleh untuk simulasi — dan perbedaan itu satu-satunya yang mencegah ' +
      'rumah sakit membayarkan uang yang tidak pernah diterimanya.',
  })
  hitung(@Body() dto: HitungDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jasa.hitung(requireSchema(user), dto);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_POLICY.READ')
  @Post('distribute')
  @ApiOperation({
    summary: 'Membagi satu kumpulan jasa kepada kontributor',
    description:
      'Sisa pembulatannya diberikan kepada kontributor dengan bobot terbesar, bukan kepada yang ' +
      'pertama pada daftar. Urutan daftar tidak berarti apa-apa; bobot berarti sesuatu.',
  })
  bagi(@Body() dto: BagiKumpulanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jasa.bagiKumpulan(requireSchema(user), dto);
  }
}
