/**
 * Endpoint kontrak fee sistem dan fee investor.
 *
 * Tiga wewenang, tiga pemegang berbeda:
 *
 * ```
 * CREATE menyusun  ->  REVIEW menelaah hukum  ->  APPROVE + ACTIVATE menyetujui
 * ```
 *
 * Ketiganya harus orang yang berbeda, dan itu diperiksa pada tingkat baris —
 * bukan hanya lewat hak akses. Hak akses menjaga siapa yang boleh membuka
 * pintu; pemeriksaan baris menjaga siapa yang boleh melewatinya kali ini.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
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
import { HealthFeeContractService } from './health-fee-contract.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type { JenisKontrakFee } from './health-fee-contract';

const JENIS = ['SYSTEM_PLATFORM_FEE', 'INVESTOR_SHARE'];
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

// --- DTO ---------------------------------------------------------------------

class SusunDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: JENIS })
  @IsIn(JENIS)
  contractType!: JenisKontrakFee;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  counterpartyName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contractReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  taxTreatment?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description: 'Batas maksimum. Ditegakkan pula saat menghitung, bukan sekadar dicatat.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maximumPercent?: number;

  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSampleData?: boolean;
}

class CatatanDto {
  @ApiProperty({ description: 'Sekurang-kurangnya sepuluh huruf.' })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  note!: string;
}

class AlasanDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

class PengecualianDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  serviceType?: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

class TerapkanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: JENIS })
  @IsIn(JENIS)
  contractType!: JenisKontrakFee;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  requestedPercent!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  baseAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  settlementId?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  onDate?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Kontrak Fee')
@Controller('health/fee-contract')
export class HealthFeeContractController {
  constructor(
    private readonly kontrak: HealthFeeContractService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Penyusunan ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.CREATE')
  @Post()
  @ApiOperation({
    summary: 'Menyusun kontrak fee',
    description:
      'Disusun sebagai DRAFT. Sampai ia aktif, fee-nya nol — dan aktivasinya menuntut telaah ' +
      'hukum serta persetujuan manajemen oleh dua orang lain.',
  })
  async susun(@Body() dto: SusunDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.kontrak.susun(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.REVIEW')
  @Post(':id/legal-review')
  @ApiOperation({
    summary: 'Menelaah hukum kontrak',
    description:
      'Penyusun tidak menelaah hukumnya sendiri. Catatannya wajib — kotak centang dapat ' +
      'dicentang siapa saja, dan yang membacanya kelak menuntut alasannya.',
  })
  async telaah(
    @Param('id') id: string,
    @Body() dto: CatatanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.kontrak.telaah(schema, id, dto.note, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.APPROVE')
  @Post(':id/approve')
  @ApiOperation({
    summary: 'Menyetujui kontrak atas nama manajemen',
    description:
      'Penyusun, pemeriksa hukum, dan penyetuju manajemen harus TIGA ORANG yang berbeda. ' +
      'Telaah hukum menyatakan kontraknya sah; persetujuan manajemen menyatakan kontraknya ' +
      'dikehendaki — dua pertanyaan yang berbeda.',
  })
  async setujui(
    @Param('id') id: string,
    @Body() dto: CatatanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.kontrak.setujui(schema, id, dto.note, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.ACTIVATE')
  @Post(':id/activate')
  @ApiOperation({
    summary: 'Mengaktifkan kontrak',
    description: 'Menuntut SELURUH syaratnya, dan yang kurang disebutkan satu per satu.',
  })
  aktifkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.kontrak.aktifkan(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.CANCEL')
  @Post(':id/terminate')
  @ApiOperation({
    summary: 'Mengakhiri kontrak',
    description:
      'Kontrak yang sudah diakhiri tidak dihidupkan kembali; yang hendak melanjutkannya membuat ' +
      'kontrak baru, dan kontrak baru menuntut telaah hukum baru.',
  })
  akhiri(@Param('id') id: string, @Body() dto: AlasanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.kontrak.akhiri(requireSchema(user), id, dto.reason);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.UPDATE')
  @Post(':id/exclusions')
  @ApiOperation({
    summary: 'Mengecualikan layanan dari fee',
    description:
      'Disimpan sebagai baris, bukan sebagai daftar di dalam satu kolom — supaya dapat ' +
      'ditanyakan layanan apa saja yang dikecualikan bulan lalu.',
  })
  async kecualikan(
    @Param('id') id: string,
    @Body() dto: PengecualianDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.kontrak.kecualikanLayanan(schema, id, dto, await this.aktor(schema, user));
  }

  // --- Penerapan -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.READ')
  @Post('apply')
  @ApiOperation({
    summary: 'Menghitung fee kontrak dan mencatat penerapannya',
    description:
      'TANPA kontrak yang aktif, jawabannya NOL beserta sebabnya. Batas maksimum ditegakkan di ' +
      'sini, bukan sekadar dicatat pada kontraknya — batas yang hanya tertulis akan dilampaui ' +
      'oleh perhitungan yang tidak pernah membacanya.',
  })
  async terapkan(@Body() dto: TerapkanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.kontrak.terapkan(schema, dto, await this.aktor(schema, user));
  }

  // --- Pembacaan -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar kontrak fee satu fasilitas' })
  daftar(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.kontrak.daftar(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.READ')
  @Get(':id/applications')
  @ApiOperation({
    summary: 'Jejak penerapan fee satu kontrak',
    description:
      'Tanpa jejak ini, pertanyaan "mengapa fee bulan lalu segini" hanya dapat dijawab dengan ' +
      'menghitung ulang memakai kontrak hari ini — dan kontrak hari ini mungkin sudah berbeda.',
  })
  jejak(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.kontrak.jejakPenerapan(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_CONTRACT.READ')
  @Get('investor-summary')
  @ApiOperation({
    summary: 'Ringkasan hasil usaha bagi pemegang kontrak investor',
    description:
      'Disaring lewat daftar PUTIH medan yang boleh dilihat. Tidak ada satu pun medan pasien di ' +
      'dalamnya, dan medan baru yang ditambahkan kelak tertolak sampai ia sengaja dimasukkan ke ' +
      'daftar itu.',
  })
  ringkasan(
    @Query('facilityId') facilityId: string,
    @Query('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !year) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId dan year wajib diisi.',
      );
    }
    return this.kontrak.ringkasanInvestor(requireSchema(user), facilityId, Number(year));
  }
}
